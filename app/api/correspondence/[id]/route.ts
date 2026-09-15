import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import {
  CorrespondenceDirection,
  CorrespondenceStatus,
  CorrespondenceType,
  NotificationType,
  UserStatus,
} from "@/src/generated/prisma/enums";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/*
 * Explicit enum values.
 *
 * Using explicit string arrays avoids TypeScript treating
 * Object.values() as unknown[] with Prisma 7 generated enums.
 */
const statusValues = [
  "RECEIVED",
  "ASSIGNED",
  "ACTION_REQUIRED",
  "RESPONDED",
  "CLOSED",
] as const;

const directionValues = [
  "INCOMING",
  "OUTGOING",
] as const;

const typeValues = [
  "LETTER",
  "COURT_NOTICE",
  "CLIENT_EMAIL",
  "DEMAND",
  "NOTICE",
  "OPPOSING_ATTORNEY",
  "CLIENT_CORRESPONDENCE",
  "COURT_CORRESPONDENCE",
  "FOLLOW_UP",
  "OTHER",
] as const;

function cleanString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}

function parseOptionalDate(
  value: unknown
): Date | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function isEnumValue<T extends string>(
  value: unknown,
  values: readonly T[]
): value is T {
  return (
    typeof value === "string" &&
    values.includes(value as T)
  );
}

/*
 * Correspondence workflow:
 *
 * RECEIVED
 *    ↓
 * ASSIGNED
 *    ↓
 * ACTION_REQUIRED
 *    ↓
 * RESPONDED
 *    ↓
 * CLOSED
 *
 * Permitted reversals:
 *
 * ACTION_REQUIRED → ASSIGNED
 * RESPONDED → ACTION_REQUIRED
 *
 * CLOSED is final.
 */
const allowedStatusTransitions: Record<
  CorrespondenceStatus,
  CorrespondenceStatus[]
> = {
  [CorrespondenceStatus.RECEIVED]: [
    CorrespondenceStatus.ASSIGNED,
  ],

  [CorrespondenceStatus.ASSIGNED]: [
    CorrespondenceStatus.ACTION_REQUIRED,
  ],

  [CorrespondenceStatus.ACTION_REQUIRED]: [
    CorrespondenceStatus.RESPONDED,
    CorrespondenceStatus.ASSIGNED,
  ],

  [CorrespondenceStatus.RESPONDED]: [
    CorrespondenceStatus.CLOSED,
    CorrespondenceStatus.ACTION_REQUIRED,
  ],

  [CorrespondenceStatus.CLOSED]: [],
};

function canTransitionStatus(
  currentStatus: CorrespondenceStatus,
  nextStatus: CorrespondenceStatus
): boolean {
  if (currentStatus === nextStatus) {
    return true;
  }

  return (
    allowedStatusTransitions[currentStatus]?.includes(
      nextStatus
    ) ?? false
  );
}

/**
 * GET
 * Retrieve one correspondence record.
 */
export async function GET(
  request: Request,
  context: RouteContext
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const role = session.user.role;
    const firmId = session.user.firmId;

    if (!firmId) {
      return NextResponse.json(
        {
          error:
            "Your account is not associated with a firm.",
        },
        { status: 403 }
      );
    }

    if (!hasPermission(role, "correspondence.view")) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to view correspondence.",
        },
        { status: 403 }
      );
    }

    const { id } = await context.params;

    const correspondence =
      await prisma.correspondence.findFirst({
        where: {
          id,
          firmId,
        },

        include: {
          client: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },

          matter: {
            select: {
              id: true,
              title: true,
              referenceNumber: true,
            },
          },

          responsibleUser: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              status: true,
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

          attachments: {
            include: {
              document: {
                select: {
                  id: true,
                  name: true,
                  originalName: true,
                  mimeType: true,
                  size: true,
                  createdAt: true,
                },
              },

              addedBy: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },

            orderBy: {
              createdAt: "desc",
            },
          },
        },
      });

    if (!correspondence) {
      return NextResponse.json(
        {
          error: "Correspondence not found.",
        },
        { status: 404 }
      );
    }

    /*
     * Audit failure must never prevent a valid GET request.
     */
    try {
      await createAuditLog({
        firmId,
        userId,
        action: "READ",
        entityType: "Correspondence",
        entityId: correspondence.id,
        description: `Viewed correspondence "${correspondence.subject}".`,
      });
    } catch (auditError) {
      console.error(
        "Failed to create correspondence view audit log:",
        auditError
      );
    }

    return NextResponse.json({
      correspondence,
    });
  } catch (error) {
    console.error(
      "GET /api/correspondence/[id] error:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to load correspondence.",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH
 * Update correspondence.
 */
export async function PATCH(
  request: Request,
  context: RouteContext
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const role = session.user.role;
    const firmId = session.user.firmId;

    if (!firmId) {
      return NextResponse.json(
        {
          error:
            "Your account is not associated with a firm.",
        },
        { status: 403 }
      );
    }

    if (!hasPermission(role, "correspondence.update")) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to update correspondence.",
        },
        { status: 403 }
      );
    }

    const { id } = await context.params;

    const existing =
      await prisma.correspondence.findFirst({
        where: {
          id,
          firmId,
        },

        include: {
          responsibleUser: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              status: true,
            },
          },
        },
      });

    if (!existing) {
      return NextResponse.json(
        {
          error: "Correspondence not found.",
        },
        { status: 404 }
      );
    }

    /*
     * Closed correspondence is considered final.
     */
    if (
      existing.status ===
      CorrespondenceStatus.CLOSED
    ) {
      return NextResponse.json(
        {
          error:
            "Closed correspondence cannot be modified through the normal workflow.",
        },
        { status: 409 }
      );
    }

    const body = await request.json();

    const sender =
      body.sender !== undefined
        ? cleanString(body.sender)
        : undefined;

    const recipient =
      body.recipient !== undefined
        ? cleanString(body.recipient)
        : undefined;

    const subject =
      body.subject !== undefined
        ? cleanString(body.subject)
        : undefined;

    const notes =
      body.notes !== undefined
        ? typeof body.notes === "string"
          ? body.notes.trim()
          : undefined
        : undefined;

    const direction =
      body.direction !== undefined
        ? body.direction
        : undefined;

    const type =
      body.type !== undefined
        ? body.type
        : undefined;

    const requestedStatus =
      body.status !== undefined
        ? body.status
        : undefined;

    const correspondenceDate =
      parseOptionalDate(
        body.correspondenceDate
      );

    const responseDeadline =
      parseOptionalDate(
        body.responseDeadline
      );

    const responseRequired =
      body.responseRequired !== undefined
        ? Boolean(body.responseRequired)
        : undefined;

    const clientId =
      body.clientId !== undefined
        ? body.clientId === null ||
          body.clientId === ""
          ? null
          : cleanString(body.clientId)
        : undefined;

    const matterId =
      body.matterId !== undefined
        ? body.matterId === null ||
          body.matterId === ""
          ? null
          : cleanString(body.matterId)
        : undefined;

    const responsibleUserId =
      body.responsibleUserId !== undefined
        ? body.responsibleUserId === null ||
          body.responsibleUserId === ""
          ? null
          : cleanString(
              body.responsibleUserId
            )
        : undefined;

    /*
     * Basic field validation.
     */
    if (
      body.sender !== undefined &&
      !sender
    ) {
      return NextResponse.json(
        {
          error: "Sender is required.",
        },
        { status: 400 }
      );
    }

    if (
      body.recipient !== undefined &&
      !recipient
    ) {
      return NextResponse.json(
        {
          error: "Recipient is required.",
        },
        { status: 400 }
      );
    }

    if (
      body.subject !== undefined &&
      !subject
    ) {
      return NextResponse.json(
        {
          error: "Subject is required.",
        },
        { status: 400 }
      );
    }

    if (
      direction !== undefined &&
      !isEnumValue(
        direction,
        directionValues
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid correspondence direction.",
        },
        { status: 400 }
      );
    }

    if (
      type !== undefined &&
      !isEnumValue(type, typeValues)
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid correspondence type.",
        },
        { status: 400 }
      );
    }

    if (
      requestedStatus !== undefined &&
      !isEnumValue(
        requestedStatus,
        statusValues
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid correspondence status.",
        },
        { status: 400 }
      );
    }

    if (
      body.correspondenceDate !== undefined &&
      correspondenceDate === null
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid correspondence date.",
        },
        { status: 400 }
      );
    }

    if (
      body.responseDeadline !== undefined &&
      responseDeadline === null &&
      responseRequired !== false
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid response deadline.",
        },
        { status: 400 }
      );
    }

    /*
     * Determine requested status.
     */
    let nextStatus =
      requestedStatus ??
      existing.status;

    const responsibleUserChanged =
      responsibleUserId !== undefined &&
      responsibleUserId !==
        existing.responsibleUserId;

    /*
     * Assigning an employee to newly received
     * correspondence automatically moves it to ASSIGNED.
     */
    if (
      requestedStatus === undefined &&
      responsibleUserChanged &&
      responsibleUserId &&
      existing.status ===
        CorrespondenceStatus.RECEIVED
    ) {
      nextStatus =
        CorrespondenceStatus.ASSIGNED;
    }

    /*
     * Enforce status workflow.
     */
    if (
      !canTransitionStatus(
        existing.status,
        nextStatus
      )
    ) {
      return NextResponse.json(
        {
          error: `Invalid status transition from ${existing.status} to ${nextStatus}.`,
        },
        { status: 409 }
      );
    }

    /*
     * CLOSED may only follow RESPONDED.
     */
    if (
      nextStatus ===
        CorrespondenceStatus.CLOSED &&
      existing.status !==
        CorrespondenceStatus.RESPONDED
    ) {
      return NextResponse.json(
        {
          error:
            "Correspondence can only be closed after it has been marked as responded.",
        },
        { status: 409 }
      );
    }

    /*
     * Determine final response settings.
     */
    const finalResponseRequired =
      responseRequired !== undefined
        ? responseRequired
        : existing.responseRequired;

    const finalResponseDeadline =
      body.responseDeadline !== undefined
        ? responseDeadline
        : existing.responseDeadline;

    if (
      finalResponseRequired &&
      !finalResponseDeadline
    ) {
      return NextResponse.json(
        {
          error:
            "A response deadline is required when response is required.",
        },
        { status: 400 }
      );
    }

    /*
     * Validate client.
     */
    if (
      clientId !== undefined &&
      clientId !== null
    ) {
      const client =
        await prisma.client.findFirst({
          where: {
            id: clientId,
            firmId,
          },

          select: {
            id: true,
          },
        });

      if (!client) {
        return NextResponse.json(
          {
            error:
              "Selected client was not found.",
          },
          { status: 400 }
        );
      }
    }

    /*
     * Validate matter.
     */
    if (
      matterId !== undefined &&
      matterId !== null
    ) {
      const matter =
        await prisma.matter.findFirst({
          where: {
            id: matterId,
            firmId,
          },

          select: {
            id: true,
          },
        });

      if (!matter) {
        return NextResponse.json(
          {
            error:
              "Selected matter was not found.",
          },
          { status: 400 }
        );
      }
    }

    /*
     * Validate responsible employee.
     */
    if (
      responsibleUserId !== undefined &&
      responsibleUserId !== null
    ) {
      const responsibleUser =
        await prisma.user.findFirst({
          where: {
            id: responsibleUserId,
            firmId,
            status: UserStatus.ACTIVE,
          },

          select: {
            id: true,
            name: true,
            email: true,
          },
        });

      if (!responsibleUser) {
        return NextResponse.json(
          {
            error:
              "Selected responsible employee was not found or is inactive.",
          },
          { status: 400 }
        );
      }
    }

    /*
     * Track meaningful changes.
     */
    const statusChanged =
      nextStatus !== existing.status;

    const assignmentChanged =
      responsibleUserId !== undefined &&
      responsibleUserId !==
        existing.responsibleUserId;

    const responseRequirementChanged =
      responseRequired !== undefined &&
      responseRequired !==
        existing.responseRequired;

    const deadlineChanged =
      body.responseDeadline !== undefined &&
      finalResponseDeadline?.getTime() !==
        existing.responseDeadline?.getTime();

    /*
     * Build update object.
     */
    const updateData: Record<
      string,
      unknown
    > = {};

    if (sender !== undefined) {
      updateData.sender = sender;
    }

    if (recipient !== undefined) {
      updateData.recipient = recipient;
    }

    if (subject !== undefined) {
      updateData.subject = subject;
    }

    if (direction !== undefined) {
      updateData.direction = direction;
    }

    if (type !== undefined) {
      updateData.type = type;
    }

    if (requestedStatus !== undefined) {
      updateData.status = nextStatus;
    } else if (
      responsibleUserChanged &&
      responsibleUserId &&
      existing.status ===
        CorrespondenceStatus.RECEIVED
    ) {
      updateData.status =
        CorrespondenceStatus.ASSIGNED;
    }

    if (
      body.correspondenceDate !== undefined
    ) {
      updateData.correspondenceDate =
        correspondenceDate;
    }

    if (body.clientId !== undefined) {
      updateData.clientId = clientId;
    }

    if (body.matterId !== undefined) {
      updateData.matterId = matterId;
    }

    if (
      body.responsibleUserId !== undefined
    ) {
      updateData.responsibleUserId =
        responsibleUserId;
    }

    if (
      body.responseRequired !== undefined
    ) {
      updateData.responseRequired =
        responseRequired;
    }

    if (
      body.responseDeadline !== undefined
    ) {
      updateData.responseDeadline =
        finalResponseDeadline;
    }

    if (body.notes !== undefined) {
      updateData.notes = notes ?? null;
    }

    /*
     * If response is no longer required,
     * remove the response deadline.
     */
    if (
      responseRequired === false &&
      body.responseDeadline === undefined
    ) {
      updateData.responseDeadline = null;
    }

    /*
     * Update record.
     */
    const updated =
      await prisma.correspondence.update({
        where: {
          id: existing.id,
        },

        data: updateData,

        include: {
          client: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },

          matter: {
            select: {
              id: true,
              title: true,
              referenceNumber: true,
            },
          },

          responsibleUser: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              status: true,
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

          attachments: {
            include: {
              document: {
                select: {
                  id: true,
                  name: true,
                  originalName: true,
                  mimeType: true,
                  size: true,
                  createdAt: true,
                },
              },

              addedBy: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },

            orderBy: {
              createdAt: "desc",
            },
          },
        },
      });

    /*
     * Audit the update.
     *
     * Your existing AuditAction type supports UPDATE,
     * not STATUS_CHANGE, so status changes are recorded
     * as UPDATE with a more specific description.
     */
    try {
      await createAuditLog({
        firmId,
        userId,
        action: "UPDATE",
        entityType: "Correspondence",
        entityId: updated.id,
        description: statusChanged
          ? `Updated correspondence status from ${existing.status} to ${nextStatus}.`
          : "Updated correspondence.",
      });
    } catch (auditError) {
      console.error(
        "Failed to create correspondence update audit log:",
        auditError
      );
    }

    /*
     * Notify newly assigned employee.
     */
    if (
      assignmentChanged &&
      updated.responsibleUserId &&
      updated.responsibleUserId !== userId
    ) {
      try {
        await prisma.notification.create({
          data: {
            firmId,
            userId:
              updated.responsibleUserId,
            type: NotificationType.SYSTEM,
            title: "Correspondence Assigned",
            message: `You have been assigned correspondence: "${updated.subject}".`,
          },
        });
      } catch (notificationError) {
        console.error(
          "Failed to create assignment notification:",
          notificationError
        );
      }
    }

    /*
     * Notify responsible employee when important
     * correspondence details change.
     */
    if (
      updated.responsibleUserId &&
      updated.responsibleUserId !== userId &&
      (responseRequirementChanged ||
        deadlineChanged ||
        statusChanged)
    ) {
      try {
        let message = `Correspondence "${updated.subject}" was updated.`;

        if (statusChanged) {
          message += ` Status: ${nextStatus}.`;
        }

        if (
          responseRequirementChanged &&
          updated.responseRequired
        ) {
          message +=
            " A response is required.";
        }

        if (
          deadlineChanged &&
          updated.responseDeadline
        ) {
          message += ` Response deadline: ${updated.responseDeadline.toISOString()}.`;
        }

        await prisma.notification.create({
          data: {
            firmId,
            userId:
              updated.responsibleUserId,
            type: NotificationType.SYSTEM,
            title: "Correspondence Updated",
            message,
          },
        });
      } catch (notificationError) {
        console.error(
          "Failed to create correspondence update notification:",
          notificationError
        );
      }
    }

    return NextResponse.json({
      correspondence: updated,
    });
  } catch (error) {
    console.error(
      "PATCH /api/correspondence/[id] error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to update correspondence.",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE
 *
 * Deletes the correspondence record and its
 * attachment relationships.
 *
 * The underlying Document records are NOT deleted.
 */
export async function DELETE(
  request: Request,
  context: RouteContext
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const role = session.user.role;
    const firmId = session.user.firmId;

    if (!firmId) {
      return NextResponse.json(
        {
          error:
            "Your account is not associated with a firm.",
        },
        { status: 403 }
      );
    }

    if (!hasPermission(role, "correspondence.delete")) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to delete correspondence.",
        },
        { status: 403 }
      );
    }

    const { id } = await context.params;

    const existing =
      await prisma.correspondence.findFirst({
        where: {
          id,
          firmId,
        },

        select: {
          id: true,
          subject: true,
          status: true,
        },
      });

    if (!existing) {
      return NextResponse.json(
        {
          error:
            "Correspondence not found.",
        },
        { status: 404 }
      );
    }

    /*
     * Closed correspondence becomes part of the
     * firm's historical record.
     */
    if (
      existing.status ===
      CorrespondenceStatus.CLOSED
    ) {
      return NextResponse.json(
        {
          error:
            "Closed correspondence cannot be deleted.",
        },
        { status: 409 }
      );
    }

    await prisma.correspondence.delete({
      where: {
        id: existing.id,
      },
    });

    /*
     * Audit failure must not turn a successful deletion
     * into a false error response.
     */
    try {
      await createAuditLog({
        firmId,
        userId,
        action: "DELETE",
        entityType: "Correspondence",
        entityId: existing.id,
        description: `Deleted correspondence "${existing.subject}".`,
      });
    } catch (auditError) {
      console.error(
        "Failed to create correspondence deletion audit log:",
        auditError
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Correspondence deleted successfully.",
    });
  } catch (error) {
    console.error(
      "DELETE /api/correspondence/[id] error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to delete correspondence.",
      },
      { status: 500 }
    );
  }
}