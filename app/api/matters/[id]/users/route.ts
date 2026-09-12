import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions-server";
import { createNotification } from "@/lib/notifications";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

// ============================================================
// GET /api/matters/[id]/users
// Get users assigned to a matter
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

    const matter = await prisma.matter.findFirst({
      where: {
        id,
        firmId: session.user.firmId,
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

    const users = await prisma.matterUser.findMany({
      where: {
        matterId: id,
        matter: {
          firmId: session.user.firmId,
        },
      },
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
      orderBy: {
        createdAt: "asc",
      },
    });

    await createAuditLog({
      request,
      firmId: session.user.firmId,
      userId: session.user.id,
      action: "READ",
      entityType: "MatterUser",
      entityId: matter.id,
      description:
        `Viewed users assigned to matter ${matter.referenceNumber}.`,
      metadata: {
        matterId: matter.id,
        matterReferenceNumber:
          matter.referenceNumber,
        resultCount: users.length,
      },
    });

    return NextResponse.json({
      success: true,
      users,
    });
  } catch (error) {
    console.error(
      "GET MATTER USERS ERROR:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to load matter users.",
      },
      {
        status: 500,
      }
    );
  }
}

// ============================================================
// POST /api/matters/[id]/users
// Assign a user to a matter
// ============================================================

export async function POST(
  request: Request,
  context: RouteContext
) {
  try {
    const authorization =
      await requirePermission(
        "matters.manage_users"
      );

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

    const matter = await prisma.matter.findFirst({
      where: {
        id,
        firmId: session.user.firmId,
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

    let body: {
      userId?: unknown;
      canView?: unknown;
      canUpload?: unknown;
      canDownload?: unknown;
      canDelete?: unknown;
      canManage?: unknown;
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

    const userId =
      typeof body.userId === "string"
        ? body.userId.trim()
        : "";

    if (!userId) {
      return NextResponse.json(
        {
          error: "User ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    // --------------------------------------------------------
    // VERIFY USER BELONGS TO SAME FIRM
    // --------------------------------------------------------

    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        firmId: session.user.firmId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        avatarUrl: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          error:
            "The selected user does not belong to your firm.",
        },
        {
          status: 403,
        }
      );
    }

    if (user.status !== "ACTIVE") {
      return NextResponse.json(
        {
          error:
            "Only active users can be assigned to matters.",
        },
        {
          status: 400,
        }
      );
    }

    // --------------------------------------------------------
    // CHECK EXISTING ASSIGNMENT
    // --------------------------------------------------------

    const existingAssignment =
      await prisma.matterUser.findUnique({
        where: {
          matterId_userId: {
            matterId: id,
            userId,
          },
        },
      });

    if (existingAssignment) {
      return NextResponse.json(
        {
          error:
            "This user is already assigned to the matter.",
        },
        {
          status: 409,
        }
      );
    }

    // --------------------------------------------------------
    // CREATE ASSIGNMENT
    // --------------------------------------------------------

    const assignment =
      await prisma.matterUser.create({
        data: {
          matterId: id,
          userId,

          canView:
            typeof body.canView === "boolean"
              ? body.canView
              : true,

          canUpload:
            typeof body.canUpload === "boolean"
              ? body.canUpload
              : false,

          canDownload:
            typeof body.canDownload === "boolean"
              ? body.canDownload
              : false,

          canDelete:
            typeof body.canDelete === "boolean"
              ? body.canDelete
              : false,

          canManage:
            typeof body.canManage === "boolean"
              ? body.canManage
              : false,
        },

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
      });

    // --------------------------------------------------------
    // AUDIT LOG
    // --------------------------------------------------------

    await createAuditLog({
      request,
      firmId: session.user.firmId,
      userId: session.user.id,
      action: "CREATE",
      entityType: "MatterUser",
      entityId: assignment.id,
      description:
        `Assigned ${user.name} to matter ${matter.referenceNumber}.`,
      metadata: {
        assignmentId: assignment.id,
        matterId: matter.id,
        matterReferenceNumber:
          matter.referenceNumber,
        assignedUserId: user.id,
        assignedUserName: user.name,
        assignedUserEmail: user.email,
        permissions: {
          canView: assignment.canView,
          canUpload: assignment.canUpload,
          canDownload: assignment.canDownload,
          canDelete: assignment.canDelete,
          canManage: assignment.canManage,
        },
      },
    });

    // --------------------------------------------------------
    // NOTIFY ASSIGNED USER
    // --------------------------------------------------------
    //
    // Do not notify the user if they assigned themselves.
    // Notification failure must not break the assignment.
    // --------------------------------------------------------

    try {
      if (
        assignment.user.id !==
        session.user.id
      ) {
        await createNotification({
          firmId: session.user.firmId,
          userId: assignment.user.id,
          type: "MATTER",
          title: "Added to matter",
          message:
            `You have been added to matter ${matter.referenceNumber}.`,
        });
      }
    } catch (notificationError) {
      console.error(
        "MATTER USER ASSIGNMENT NOTIFICATION ERROR:",
        notificationError
      );
    }

    return NextResponse.json(
      {
        success: true,
        assignment,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "ASSIGN MATTER USER ERROR:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to assign user to matter.",
      },
      {
        status: 500,
      }
    );
  }
}

// ============================================================
// PATCH /api/matters/[id]/users
// Update matter-user permissions
// ============================================================

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  try {
    const authorization =
      await requirePermission(
        "matters.manage_users"
      );

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

    const matter = await prisma.matter.findFirst({
      where: {
        id,
        firmId: session.user.firmId,
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

    let body: {
      assignmentId?: unknown;
      canView?: unknown;
      canUpload?: unknown;
      canDownload?: unknown;
      canDelete?: unknown;
      canManage?: unknown;
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

    const assignmentId =
      typeof body.assignmentId === "string"
        ? body.assignmentId.trim()
        : "";

    if (!assignmentId) {
      return NextResponse.json(
        {
          error: "Assignment ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const assignment =
      await prisma.matterUser.findFirst({
        where: {
          id: assignmentId,
          matterId: id,
          matter: {
            firmId: session.user.firmId,
          },
        },
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
      });

    if (!assignment) {
      return NextResponse.json(
        {
          error:
            "Matter user assignment not found.",
        },
        {
          status: 404,
        }
      );
    }

    const data: {
      canView?: boolean;
      canUpload?: boolean;
      canDownload?: boolean;
      canDelete?: boolean;
      canManage?: boolean;
    } = {};

    if (typeof body.canView === "boolean") {
      data.canView = body.canView;
    }

    if (typeof body.canUpload === "boolean") {
      data.canUpload = body.canUpload;
    }

    if (typeof body.canDownload === "boolean") {
      data.canDownload = body.canDownload;
    }

    if (typeof body.canDelete === "boolean") {
      data.canDelete = body.canDelete;
    }

    if (typeof body.canManage === "boolean") {
      data.canManage = body.canManage;
    }

    // --------------------------------------------------------
    // DETERMINE WHETHER PERMISSIONS ACTUALLY CHANGED
    // --------------------------------------------------------

    const permissionsChanged =
      (data.canView !== undefined &&
        data.canView !== assignment.canView) ||
      (data.canUpload !== undefined &&
        data.canUpload !== assignment.canUpload) ||
      (data.canDownload !== undefined &&
        data.canDownload !==
          assignment.canDownload) ||
      (data.canDelete !== undefined &&
        data.canDelete !== assignment.canDelete) ||
      (data.canManage !== undefined &&
        data.canManage !== assignment.canManage);

    const updated =
      await prisma.matterUser.update({
        where: {
          id: assignment.id,
        },
        data,
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
      });

    await createAuditLog({
      request,
      firmId: session.user.firmId,
      userId: session.user.id,
      action: "UPDATE",
      entityType: "MatterUser",
      entityId: updated.id,
      description:
        `Updated matter permissions for ${updated.user.name} on ${matter.referenceNumber}.`,
      metadata: {
        assignmentId: updated.id,
        matterId: matter.id,
        matterReferenceNumber:
          matter.referenceNumber,
        assignedUserId: updated.user.id,
        assignedUserName: updated.user.name,
        previousPermissions: {
          canView: assignment.canView,
          canUpload: assignment.canUpload,
          canDownload: assignment.canDownload,
          canDelete: assignment.canDelete,
          canManage: assignment.canManage,
        },
        newPermissions: {
          canView: updated.canView,
          canUpload: updated.canUpload,
          canDownload: updated.canDownload,
          canDelete: updated.canDelete,
          canManage: updated.canManage,
        },
      },
    });

    // --------------------------------------------------------
    // NOTIFY AFFECTED USER
    // --------------------------------------------------------
    //
    // Only notify when a permission actually changed.
    // Do not notify the user if they changed their own
    // permissions (defence in depth).
    // --------------------------------------------------------

    try {
      if (
        permissionsChanged &&
        updated.user.id !== session.user.id
      ) {
        await createNotification({
          firmId: session.user.firmId,
          userId: updated.user.id,
          type: "MATTER",
          title: "Matter permissions updated",
          message:
            `Your permissions for matter ${matter.referenceNumber} have been updated.`,
        });
      }
    } catch (notificationError) {
      console.error(
        "MATTER USER PERMISSION NOTIFICATION ERROR:",
        notificationError
      );
    }

    return NextResponse.json({
      success: true,
      assignment: updated,
    });
  } catch (error) {
    console.error(
      "UPDATE MATTER USER ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to update matter permissions.",
      },
      {
        status: 500,
      }
    );
  }
}

// ============================================================
// DELETE /api/matters/[id]/users
// Remove a user from a matter
// ============================================================

export async function DELETE(
  request: Request,
  context: RouteContext
) {
  try {
    const authorization =
      await requirePermission(
        "matters.manage_users"
      );

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

    const matter = await prisma.matter.findFirst({
      where: {
        id,
        firmId: session.user.firmId,
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

    let body: {
      assignmentId?: unknown;
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

    const assignmentId =
      typeof body.assignmentId === "string"
        ? body.assignmentId.trim()
        : "";

    if (!assignmentId) {
      return NextResponse.json(
        {
          error: "Assignment ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const assignment =
      await prisma.matterUser.findFirst({
        where: {
          id: assignmentId,
          matterId: id,
          matter: {
            firmId: session.user.firmId,
          },
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

    if (!assignment) {
      return NextResponse.json(
        {
          error:
            "Matter user assignment not found.",
        },
        {
          status: 404,
        }
      );
    }

    await prisma.matterUser.delete({
      where: {
        id: assignment.id,
      },
    });

    await createAuditLog({
      request,
      firmId: session.user.firmId,
      userId: session.user.id,
      action: "DELETE",
      entityType: "MatterUser",
      entityId: assignment.id,
      description:
        `Removed ${assignment.user.name} from matter ${matter.referenceNumber}.`,
      metadata: {
        assignmentId: assignment.id,
        matterId: matter.id,
        matterReferenceNumber:
          matter.referenceNumber,
        removedUserId: assignment.user.id,
        removedUserName: assignment.user.name,
      },
    });

    return NextResponse.json({
      success: true,
      message:
        "User removed from matter successfully.",
    });
  } catch (error) {
    console.error(
      "REMOVE MATTER USER ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to remove user from matter.",
      },
      {
        status: 500,
      }
    );
  }
}