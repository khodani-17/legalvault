import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions-server";
import { userCanAccessMatter } from "@/lib/matter-access";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

// ============================================================
// GET /api/matters/[id]
// ============================================================

export async function GET(
  request: Request,
  context: RouteContext
) {
  try {
    const authorization =
      await requirePermission("matters.view");

    if (!authorization.authorized) {
      return authorization.response;
    }

    const session = authorization.session;

    if (
      !session.user.id ||
      !session.user.firmId
    ) {
      return NextResponse.json(
        {
          error: "Unauthorized.",
        },
        {
          status: 401,
        }
      );
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          error: "Matter ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    // --------------------------------------------------------
    // MATTER-LEVEL ACCESS CHECK
    // --------------------------------------------------------

    const canAccess = await userCanAccessMatter({
      matterId: id,
      userId: session.user.id,
      firmId: session.user.firmId,
      role: session.user.role,
    });

    if (!canAccess) {
      return NextResponse.json(
        {
          error: "Matter not found.",
        },
        {
          status: 404,
        }
      );
    }

    // --------------------------------------------------------
    // FIND MATTER
    // --------------------------------------------------------

    const matter =
      await prisma.matter.findFirst({
        where: {
          id,
          firmId: session.user.firmId,
        },

        include: {
          client: true,

          users: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                  status: true,
                  avatarUrl: true,
                },
              },
            },
          },

          folders: {
            orderBy: {
              createdAt: "asc",
            },
          },

          documents: {
            orderBy: {
              createdAt: "desc",
            },
          },

          tasks: {
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      });

    if (!matter) {
      return NextResponse.json(
        {
          error: "Matter not found.",
        },
        {
          status: 404,
        }
      );
    }

    await createAuditLog({
      request,
      firmId: session.user.firmId,
      userId: session.user.id,
      action: "READ",
      entityType: "Matter",
      entityId: matter.id,
      description:
        `Viewed matter ${matter.referenceNumber}: ${matter.title}.`,
      metadata: {
        matterId: matter.id,
        matterReferenceNumber:
          matter.referenceNumber,
        matterTitle: matter.title,
        clientId: matter.clientId,
        clientReferenceNumber:
          matter.client?.referenceNumber ?? null,
        clientName:
          matter.client?.name ?? null,
      },
    });

    return NextResponse.json({
      success: true,
      matter,
    });
  } catch (error) {
    console.error(
      "GET MATTER ERROR:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to load matter.",
      },
      {
        status: 500,
      }
    );
  }
}

// ============================================================
// PATCH /api/matters/[id]
// Update matter
// ============================================================

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  try {
    const authorization =
      await requirePermission("matters.update");

    if (!authorization.authorized) {
      return authorization.response;
    }

    const session = authorization.session;

    if (
      !session.user.id ||
      !session.user.firmId
    ) {
      return NextResponse.json(
        {
          error: "Unauthorized.",
        },
        {
          status: 401,
        }
      );
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          error: "Matter ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    // --------------------------------------------------------
    // MATTER-LEVEL ACCESS CHECK
    // --------------------------------------------------------

    const canAccess = await userCanAccessMatter({
      matterId: id,
      userId: session.user.id,
      firmId: session.user.firmId,
      role: session.user.role,
    });

    if (!canAccess) {
      return NextResponse.json(
        {
          error: "Matter not found.",
        },
        {
          status: 404,
        }
      );
    }

    // --------------------------------------------------------
    // FIND MATTER
    // --------------------------------------------------------

    const existingMatter =
      await prisma.matter.findFirst({
        where: {
          id,
          firmId: session.user.firmId,
        },
      });

    if (!existingMatter) {
      return NextResponse.json(
        {
          error: "Matter not found.",
        },
        {
          status: 404,
        }
      );
    }

    // --------------------------------------------------------
    // REQUEST BODY
    // --------------------------------------------------------

    let body: {
      title?: unknown;
      description?: unknown;
      practiceArea?: unknown;
      status?: unknown;
      clientId?: unknown;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          error: "Invalid JSON request.",
        },
        {
          status: 400,
        }
      );
    }

    // --------------------------------------------------------
    // NORMALISE
    // --------------------------------------------------------

    const title =
      typeof body.title === "string"
        ? body.title.trim()
        : existingMatter.title;

    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : existingMatter.description;

    const practiceArea =
      typeof body.practiceArea === "string"
        ? body.practiceArea.trim()
        : existingMatter.practiceArea;

    const clientId =
      typeof body.clientId === "string"
        ? body.clientId.trim()
        : existingMatter.clientId;

    const status =
      typeof body.status === "string"
        ? body.status.trim()
        : existingMatter.status;

    // --------------------------------------------------------
    // VALIDATION
    // --------------------------------------------------------

    if (!title) {
      return NextResponse.json(
        {
          error: "Matter title is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (!clientId) {
      return NextResponse.json(
        {
          error: "Client is required.",
        },
        {
          status: 400,
        }
      );
    }

    const allowedStatuses = [
      "OPEN",
      "PENDING",
      "CLOSED",
      "ARCHIVED",
    ] as const;

    if (
      !allowedStatuses.includes(
        status as (typeof allowedStatuses)[number]
      )
    ) {
      return NextResponse.json(
        {
          error: "Invalid matter status.",
        },
        {
          status: 400,
        }
      );
    }

    // --------------------------------------------------------
    // VERIFY CLIENT
    // --------------------------------------------------------

    const client =
      await prisma.client.findFirst({
        where: {
          id: clientId,
          firmId: session.user.firmId,
        },
      });

    if (!client) {
      return NextResponse.json(
        {
          error:
            "The selected client does not belong to your firm.",
        },
        {
          status: 403,
        }
      );
    }

    // --------------------------------------------------------
    // CLOSED DATE
    // --------------------------------------------------------

    let closedAt =
      existingMatter.closedAt;

    if (status === "CLOSED") {
      if (!closedAt) {
        closedAt = new Date();
      }
    } else {
      closedAt = null;
    }

    // --------------------------------------------------------
    // UPDATE
    // --------------------------------------------------------

    const matter =
      await prisma.matter.update({
        where: {
          id,
        },

        data: {
          clientId,
          title,
          description:
            description || null,
          practiceArea:
            practiceArea || null,
          status: status as
            | "OPEN"
            | "PENDING"
            | "CLOSED"
            | "ARCHIVED",
          closedAt,
        },

        include: {
          client: true,
        },
      });

    // --------------------------------------------------------
    // DETERMINE CHANGES
    // --------------------------------------------------------

    const changes: string[] = [];

    if (
      existingMatter.title !==
      matter.title
    ) {
      changes.push("title");
    }

    if (
      existingMatter.description !==
      matter.description
    ) {
      changes.push("description");
    }

    if (
      existingMatter.practiceArea !==
      matter.practiceArea
    ) {
      changes.push("practice area");
    }

    if (
      existingMatter.clientId !==
      matter.clientId
    ) {
      changes.push("client");
    }

    if (
      existingMatter.status !==
      matter.status
    ) {
      changes.push("status");
    }

    if (
      existingMatter.closedAt?.getTime() !==
      matter.closedAt?.getTime()
    ) {
      changes.push("closed date");
    }

    // --------------------------------------------------------
    // AUDIT
    // --------------------------------------------------------

    await createAuditLog({
      request,
      firmId: session.user.firmId,
      userId: session.user.id,
      action: "UPDATE",
      entityType: "Matter",
      entityId: matter.id,
      description:
        changes.length > 0
          ? `Updated matter ${matter.referenceNumber}: ${changes.join(", ")}.`
          : `Updated matter ${matter.referenceNumber}.`,
      metadata: {
        matterId: matter.id,
        matterReferenceNumber:
          matter.referenceNumber,

        changes,

        previousValues: {
          title: existingMatter.title,
          description:
            existingMatter.description,
          practiceArea:
            existingMatter.practiceArea,
          status:
            existingMatter.status,
          clientId:
            existingMatter.clientId,
          closedAt:
            existingMatter.closedAt
              ?.toISOString() ?? null,
        },

        newValues: {
          title: matter.title,
          description:
            matter.description,
          practiceArea:
            matter.practiceArea,
          status:
            matter.status,
          clientId:
            matter.clientId,
          closedAt:
            matter.closedAt
              ?.toISOString() ?? null,
        },

        client: {
          id: client.id,
          referenceNumber:
            client.referenceNumber,
          name: client.name,
        },
      },
    });

    return NextResponse.json({
      success: true,
      matter,
    });
  } catch (error) {
    console.error(
      "UPDATE MATTER ERROR:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to update matter.",
      },
      {
        status: 500,
      }
    );
  }
}

// ============================================================
// DELETE /api/matters/[id]
// Archive matter rather than permanently deleting it
// ============================================================

export async function DELETE(
  request: Request,
  context: RouteContext
) {
  try {
    const authorization =
      await requirePermission("matters.delete");

    if (!authorization.authorized) {
      return authorization.response;
    }

    const session = authorization.session;

    if (
      !session.user.id ||
      !session.user.firmId
    ) {
      return NextResponse.json(
        {
          error: "Unauthorized.",
        },
        {
          status: 401,
        }
      );
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          error: "Matter ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    // --------------------------------------------------------
    // MATTER-LEVEL ACCESS CHECK
    // --------------------------------------------------------

    const canAccess = await userCanAccessMatter({
      matterId: id,
      userId: session.user.id,
      firmId: session.user.firmId,
      role: session.user.role,
    });

    if (!canAccess) {
      return NextResponse.json(
        {
          error: "Matter not found.",
        },
        {
          status: 404,
        }
      );
    }

    // --------------------------------------------------------
    // FIND MATTER
    // --------------------------------------------------------

    const existingMatter =
      await prisma.matter.findFirst({
        where: {
          id,
          firmId: session.user.firmId,
        },
      });

    if (!existingMatter) {
      return NextResponse.json(
        {
          error: "Matter not found.",
        },
        {
          status: 404,
        }
      );
    }

    // --------------------------------------------------------
    // ARCHIVE MATTER
    // --------------------------------------------------------

    const matter =
      await prisma.matter.update({
        where: {
          id,
        },

        data: {
          status: "ARCHIVED",
        },
      });

    // --------------------------------------------------------
    // AUDIT
    // --------------------------------------------------------

    await createAuditLog({
      request,
      firmId: session.user.firmId,
      userId: session.user.id,
      action: "ARCHIVE",
      entityType: "Matter",
      entityId: matter.id,
      description:
        `Archived matter ${matter.referenceNumber}: ${matter.title}.`,
      metadata: {
        matterId: matter.id,
        matterReferenceNumber:
          matter.referenceNumber,
        matterTitle: matter.title,
        previousStatus:
          existingMatter.status,
        newStatus: matter.status,
        clientId:
          existingMatter.clientId,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Matter archived successfully.",
      matter,
    });
  } catch (error) {
    console.error(
      "ARCHIVE MATTER ERROR:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to archive matter.",
      },
      {
        status: 500,
      }
    );
  }
}