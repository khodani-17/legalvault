import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AuditAction } from "@/src/generated/prisma/client";

const ALLOWED_ROLES = [
  "SUPER_ADMIN",
  "MANAGING_PARTNER",
  "PARTNER",
  "DIRECTOR",
  "ATTORNEY",
  "CANDIDATE_ATTORNEY",
  "PARALEGAL",
  "LEGAL_SECRETARY",
  "ADMIN",
];

const DELETE_ROLES = [
  "SUPER_ADMIN",
  "MANAGING_PARTNER",
  "PARTNER",
  "DIRECTOR",
  "ADMIN",
];

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

async function getAuthenticatedUser() {
  const session = await auth();

  if (!session?.user?.email) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: "Unauthorized.",
        },
        { status: 401 },
      ),
    };
  }

  const user = await prisma.user.findUnique({
    where: {
      email: session.user.email,
    },
    select: {
      id: true,
      firmId: true,
      name: true,
      email: true,
      role: true,
      status: true,
    },
  });

  if (!user) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: "User account not found.",
        },
        { status: 404 },
      ),
    };
  }

  if (user.status !== "ACTIVE") {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: "Your account is not active.",
        },
        { status: 403 },
      ),
    };
  }

  if (!ALLOWED_ROLES.includes(user.role)) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error:
            "You do not have permission to access legal intakes.",
        },
        { status: 403 },
      ),
    };
  }

  if (!user.firmId) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error:
            "Your account is not associated with a firm.",
        },
        { status: 403 },
      ),
    };
  }

  return {
    user,
  };
}

/**
 * GET /api/intake/[id]
 *
 * Retrieves one legal intake.
 *
 * Firm isolation is enforced using the authenticated
 * user's firmId.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const authResult = await getAuthenticatedUser();

    if (authResult.error) {
      return authResult.error;
    }

    const user = authResult.user;

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "Intake ID is required.",
        },
        { status: 400 },
      );
    }

    const intake = await prisma.matterIntake.findFirst({
      where: {
        id,
        firmId: user.firmId,
      },

      include: {
        client: {
          select: {
            id: true,
            referenceNumber: true,
            name: true,
            type: true,
          },
        },

        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },

        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },

        conflictCheckedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },

        conflictChecks: {
          orderBy: {
            createdAt: "desc",
          },

          take: 10,

          include: {
            checkedBy: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },

            reviewedBy: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
        },

        convertedMatter: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!intake) {
      return NextResponse.json(
        {
          success: false,
          error: "Legal intake not found.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: intake,
    });
  } catch (error) {
    console.error(
      "GET /api/intake/[id] error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Unable to retrieve the legal intake.",
      },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/intake/[id]
 *
 * Updates an existing legal intake.
 *
 * Conflict checking is deliberately handled by
 * a separate endpoint.
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const authResult = await getAuthenticatedUser();

    if (authResult.error) {
      return authResult.error;
    }

    const user = authResult.user;

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "Intake ID is required.",
        },
        { status: 400 },
      );
    }

    const existingIntake =
      await prisma.matterIntake.findFirst({
        where: {
          id,
          firmId: user.firmId,
        },

        select: {
          id: true,
          firmId: true,
          status: true,
          conflictStatus: true,
          conflictCheckRequired: true,
          clientId: true,
          assignedToId: true,
        },
      });

    if (!existingIntake) {
      return NextResponse.json(
        {
          success: false,
          error: "Legal intake not found.",
        },
        { status: 404 },
      );
    }

    const body = await request.json();

    const {
      prospectiveClientName,
      clientId,
      email,
      phone,
      practiceArea,
      description,
      opposingParties,
      relatedParties,
      source,
      priority,
      conflictCheckRequired,
      assignedToId,
      status,
    } = body;

    const data: Record<string, unknown> = {};

    /*
     * Prospective client name
     */
    if (prospectiveClientName !== undefined) {
      if (
        typeof prospectiveClientName !== "string" ||
        !prospectiveClientName.trim()
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Prospective client name cannot be empty.",
          },
          { status: 400 },
        );
      }

      data.prospectiveClientName =
        prospectiveClientName.trim();
    }

    /*
     * Email
     */
    if (email !== undefined) {
      data.email =
        typeof email === "string" && email.trim()
          ? email.trim()
          : null;
    }

    /*
     * Phone
     */
    if (phone !== undefined) {
      data.phone =
        typeof phone === "string" && phone.trim()
          ? phone.trim()
          : null;
    }

    /*
     * Practice area
     */
    if (practiceArea !== undefined) {
      data.practiceArea =
        typeof practiceArea === "string" &&
        practiceArea.trim()
          ? practiceArea.trim()
          : null;
    }

    /*
     * Description
     */
    if (description !== undefined) {
      data.description =
        typeof description === "string" &&
        description.trim()
          ? description.trim()
          : null;
    }

    /*
     * Source
     */
    if (source !== undefined) {
      data.source =
        typeof source === "string" && source.trim()
          ? source.trim()
          : null;
    }

    /*
     * Priority
     */
    if (priority !== undefined) {
      const validPriorities = [
        "LOW",
        "MEDIUM",
        "HIGH",
        "URGENT",
      ];

      if (
        typeof priority !== "string" ||
        !validPriorities.includes(priority)
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Invalid priority. Use LOW, MEDIUM, HIGH, or URGENT.",
          },
          { status: 400 },
        );
      }

      data.priority = priority;
    }

    /*
     * Opposing parties
     */
    if (opposingParties !== undefined) {
      if (!Array.isArray(opposingParties)) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Opposing parties must be an array.",
          },
          { status: 400 },
        );
      }

      data.opposingParties = opposingParties
        .filter(
          (party): party is string =>
            typeof party === "string",
        )
        .map((party) => party.trim())
        .filter(Boolean);
    }

    /*
     * Related parties
     */
    if (relatedParties !== undefined) {
      if (!Array.isArray(relatedParties)) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Related parties must be an array.",
          },
          { status: 400 },
        );
      }

      data.relatedParties = relatedParties
        .filter(
          (party): party is string =>
            typeof party === "string",
        )
        .map((party) => party.trim())
        .filter(Boolean);
    }

    /*
     * Conflict-check requirement
     */
    if (conflictCheckRequired !== undefined) {
      if (typeof conflictCheckRequired !== "boolean") {
        return NextResponse.json(
          {
            success: false,
            error:
              "conflictCheckRequired must be true or false.",
          },
          { status: 400 },
        );
      }

      data.conflictCheckRequired =
        conflictCheckRequired;

      /*
       * Enable conflict checking.
       */
      if (
        conflictCheckRequired === true &&
        existingIntake.conflictStatus === "NOT_CHECKED"
      ) {
        data.status = "CONFLICT_CHECK_PENDING";
      }

      /*
       * Disable conflict checking.
       */
      if (
        conflictCheckRequired === false &&
        existingIntake.conflictStatus === "NOT_CHECKED" &&
        existingIntake.status ===
          "CONFLICT_CHECK_PENDING"
      ) {
        data.status = "NEW";
      }
    }

    /*
     * Client
     *
     * Client must belong to the same firm.
     */
    if (clientId !== undefined) {
      if (clientId === null || clientId === "") {
        data.clientId = null;
      } else {
        const client = await prisma.client.findFirst({
          where: {
            id: clientId,
            firmId: user.firmId,
          },

          select: {
            id: true,
          },
        });

        if (!client) {
          return NextResponse.json(
            {
              success: false,
              error:
                "The selected client does not belong to your firm or does not exist.",
            },
            { status: 400 },
          );
        }

        data.clientId = client.id;
      }
    }

    /*
     * Assigned user
     *
     * Assignee must belong to the same firm
     * and have an active account.
     */
    if (assignedToId !== undefined) {
      if (
        assignedToId === null ||
        assignedToId === ""
      ) {
        data.assignedToId = null;
      } else {
        const assignedUser =
          await prisma.user.findFirst({
            where: {
              id: assignedToId,
              firmId: user.firmId,
              status: "ACTIVE",
            },

            select: {
              id: true,
            },
          });

        if (!assignedUser) {
          return NextResponse.json(
            {
              success: false,
              error:
                "The selected assignee does not belong to your firm or is not active.",
            },
            { status: 400 },
          );
        }

        data.assignedToId = assignedUser.id;
      }
    }

    /*
     * Status
     */
    if (status !== undefined) {
      const validStatuses = [
        "NEW",
        "CONFLICT_CHECK_PENDING",
        "CONFLICT_REVIEW",
        "APPROVED",
        "REJECTED",
        "CONVERTED",
        "CLOSED",
      ];

      if (
        typeof status !== "string" ||
        !validStatuses.includes(status)
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid intake status.",
          },
          { status: 400 },
        );
      }

      /*
       * Conversion must use the dedicated
       * conversion workflow.
       */
      if (
        status === "CONVERTED" &&
        existingIntake.status !== "CONVERTED"
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "An intake must be converted through the dedicated matter-conversion workflow.",
          },
          { status: 400 },
        );
      }

      data.status = status;
    }

    /*
     * No changes.
     */
    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No changes were provided.",
        },
        { status: 400 },
      );
    }

    /*
     * Update the intake.
     */
    const updatedIntake =
      await prisma.matterIntake.update({
        where: {
          id: existingIntake.id,
        },

        data,

        include: {
          client: {
            select: {
              id: true,
              referenceNumber: true,
              name: true,
              type: true,
            },
          },

          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },

          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },

          conflictCheckedBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },

          conflictChecks: {
            orderBy: {
              createdAt: "desc",
            },

            take: 10,
          },

          convertedMatter: {
            select: {
              id: true,
            },
          },
        },
      });

    /*
     * Audit update.
     *
     * JSON.parse(JSON.stringify(...)) converts the
     * dynamically constructed object into a JSON-safe
     * value accepted by Prisma's JSON field.
     */
    await prisma.auditLog.create({
      data: {
        firmId: user.firmId,
        userId: user.id,
        action: AuditAction.UPDATE,
        entityType: "MatterIntake",
        entityId: existingIntake.id,
        metadata: JSON.parse(
          JSON.stringify({
            changes: data,
          }),
        ),
      },
    });

    return NextResponse.json({
      success: true,
      message:
        "Legal intake updated successfully.",
      data: updatedIntake,
    });
  } catch (error) {
    console.error(
      "PATCH /api/intake/[id] error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Unable to update the legal intake.",
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/intake/[id]
 *
 * Deletes an intake belonging to the authenticated
 * user's firm.
 */
export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const authResult = await getAuthenticatedUser();

    if (authResult.error) {
      return authResult.error;
    }

    const user = authResult.user;

    /*
     * Only senior/administrative roles can delete
     * an intake.
     */
    if (!DELETE_ROLES.includes(user.role)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "You do not have permission to delete legal intakes.",
        },
        { status: 403 },
      );
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "Intake ID is required.",
        },
        { status: 400 },
      );
    }

    const intake =
      await prisma.matterIntake.findFirst({
        where: {
          id,
          firmId: user.firmId,
        },

        select: {
          id: true,
          prospectiveClientName: true,
          status: true,
        },
      });

    if (!intake) {
      return NextResponse.json(
        {
          success: false,
          error: "Legal intake not found.",
        },
        { status: 404 },
      );
    }

    /*
     * Converted intakes must not be deleted.
     */
    if (intake.status === "CONVERTED") {
      return NextResponse.json(
        {
          success: false,
          error:
            "A converted intake cannot be deleted.",
        },
        { status: 400 },
      );
    }

    /*
     * Conflict checks are configured with cascade
     * deletion from MatterIntake.
     */
    await prisma.matterIntake.delete({
      where: {
        id: intake.id,
      },
    });

    /*
     * Record deletion in the audit log.
     */
    await prisma.auditLog.create({
      data: {
        firmId: user.firmId,
        userId: user.id,
        action: AuditAction.DELETE,
        entityType: "MatterIntake",
        entityId: intake.id,
        metadata: {
          prospectiveClientName:
            intake.prospectiveClientName,
          previousStatus: intake.status,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message:
        "Legal intake deleted successfully.",
    });
  } catch (error) {
    console.error(
      "DELETE /api/intake/[id] error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Unable to delete the legal intake.",
      },
      { status: 500 },
    );
  }
}