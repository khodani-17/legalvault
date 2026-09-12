import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions-server";
import { createNotification } from "@/lib/notifications";

// =====================================================
// GET /api/tasks
// Get tasks belonging to the logged-in user's firm
// Optional:
// ?matterId=...
// ?status=...
// =====================================================

export async function GET(request: Request) {
  try {
    // =====================================================
    // AUTHENTICATION + RBAC
    // =====================================================

    const authorization =
      await requirePermission("tasks.view");

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

    const userId = session.user.id;
    const firmId = session.user.firmId;

    // =====================================================
    // VERIFY ACTIVE USER
    // =====================================================

    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        firmId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        firmId: true,
        name: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          error:
            "Your user account could not be verified.",
        },
        {
          status: 403,
        }
      );
    }

    // =====================================================
    // QUERY PARAMETERS
    // =====================================================

    const { searchParams } = new URL(request.url);

    const matterId =
      searchParams.get("matterId")?.trim() || null;

    const status =
      searchParams.get("status")?.trim() || null;

    // =====================================================
    // GET TASKS
    // =====================================================

    const tasks = await prisma.task.findMany({
      where: {
        firmId,

        ...(matterId
          ? {
              matterId,
            }
          : {}),

        ...(status
          ? {
              status: status as
                | "TODO"
                | "IN_PROGRESS"
                | "COMPLETED"
                | "CANCELLED",
            }
          : {}),
      },

      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        dueDate: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,

        matter: {
          select: {
            id: true,
            referenceNumber: true,
            title: true,
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
      },

      orderBy: [
        {
          dueDate: "asc",
        },
        {
          createdAt: "desc",
        },
      ],
    });

    // =====================================================
    // AUDIT LOG
    // =====================================================

    await createAuditLog({
      request,
      firmId,
      userId: user.id,
      action: "READ",
      entityType: "Task",
      description: "Viewed task list.",
      metadata: {
        matterId,
        status,
        resultCount: tasks.length,
      },
    });

    // =====================================================
    // RESPONSE
    // =====================================================

    return NextResponse.json({
      tasks,
    });
  } catch (error) {
    console.error(
      "GET TASKS ERROR:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to load tasks.",
      },
      {
        status: 500,
      }
    );
  }
}

// =====================================================
// POST /api/tasks
// Create a new task
// =====================================================

export async function POST(request: Request) {
  try {
    // =====================================================
    // AUTHENTICATION + RBAC
    // =====================================================

    const authorization =
      await requirePermission("tasks.create");

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

    const userId = session.user.id;
    const firmId = session.user.firmId;

    // =====================================================
    // VERIFY ACTIVE USER + FIRM
    // =====================================================

    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        firmId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        firmId: true,
        name: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          error:
            "Your user account could not be verified.",
        },
        {
          status: 403,
        }
      );
    }

    // =====================================================
    // REQUEST BODY
    // =====================================================

    let body: Record<string, unknown>;

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

    const title = String(
      body.title || ""
    ).trim();

    const description = String(
      body.description || ""
    ).trim();

    const matterIdValue = String(
      body.matterId || ""
    ).trim();

    const matterId =
      matterIdValue || null;

    const assignedToIdValue = String(
      body.assignedToId || ""
    ).trim();

    const assignedToId =
      assignedToIdValue || null;

    const priority = String(
      body.priority || "MEDIUM"
    ).trim();

    const status = String(
      body.status || "TODO"
    ).trim();

    const dueDateValue = String(
      body.dueDate || ""
    ).trim();

    const dueDate = dueDateValue
      ? new Date(dueDateValue)
      : null;

    // =====================================================
    // VALIDATION
    // =====================================================

    if (!title) {
      return NextResponse.json(
        {
          error: "Task title is required.",
        },
        {
          status: 400,
        }
      );
    }

    const validStatuses = [
      "TODO",
      "IN_PROGRESS",
      "COMPLETED",
      "CANCELLED",
    ];

    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        {
          error: "Invalid task status.",
        },
        {
          status: 400,
        }
      );
    }

    const validPriorities = [
      "LOW",
      "MEDIUM",
      "HIGH",
      "URGENT",
    ];

    if (!validPriorities.includes(priority)) {
      return NextResponse.json(
        {
          error: "Invalid task priority.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      dueDate &&
      Number.isNaN(dueDate.getTime())
    ) {
      return NextResponse.json(
        {
          error: "Invalid due date.",
        },
        {
          status: 400,
        }
      );
    }

    // =====================================================
    // VERIFY MATTER
    // =====================================================

    if (matterId) {
      const matter =
        await prisma.matter.findFirst({
          where: {
            id: matterId,
            firmId,
          },
          select: {
            id: true,
            firmId: true,
            referenceNumber: true,
            title: true,
          },
        });

      if (!matter) {
        return NextResponse.json(
          {
            error:
              "The selected matter does not belong to your firm.",
          },
          {
            status: 403,
          }
        );
      }
    }

    // =====================================================
    // VERIFY ASSIGNED USER
    // =====================================================

    if (assignedToId) {
      const assignedUser =
        await prisma.user.findFirst({
          where: {
            id: assignedToId,
            firmId,
            status: "ACTIVE",
          },
          select: {
            id: true,
            firmId: true,
            status: true,
          },
        });

      if (!assignedUser) {
        return NextResponse.json(
          {
            error:
              "The selected user does not belong to your firm or is not active.",
          },
          {
            status: 403,
          }
        );
      }
    }

    // =====================================================
    // CREATE TASK
    // =====================================================

    const task = await prisma.task.create({
      data: {
        firmId,

        matterId,

        title,

        description:
          description || null,

        status: status as
          | "TODO"
          | "IN_PROGRESS"
          | "COMPLETED"
          | "CANCELLED",

        priority: priority as
          | "LOW"
          | "MEDIUM"
          | "HIGH"
          | "URGENT",

        assignedToId,

        createdById: user.id,

        dueDate,

        completedAt:
          status === "COMPLETED"
            ? new Date()
            : null,
      },

      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        dueDate: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,

        matter: {
          select: {
            id: true,
            referenceNumber: true,
            title: true,
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
      },
    });

    // =====================================================
    // AUDIT LOG
    // =====================================================

    await createAuditLog({
      request,
      firmId,
      userId: user.id,
      action: "CREATE",
      entityType: "Task",
      entityId: task.id,
      description:
        `Created task: ${task.title}`,
      metadata: {
        taskId: task.id,
        taskTitle: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        matterId:
          task.matter?.id ?? null,
        matterReference:
          task.matter?.referenceNumber ?? null,
        assignedToId:
          task.assignedTo?.id ?? null,
        assignedToName:
          task.assignedTo?.name ?? null,
        dueDate: task.dueDate,
        completedAt: task.completedAt,
      },
    });

    // =====================================================
    // NOTIFICATION
    // =====================================================
    //
    // Notify the assigned user when a new task is
    // assigned to them.
    //
    // Do not notify the creator when they assign a task
    // to themselves.
    //
    // Notification errors must NEVER cause the task
    // creation itself to fail.
    // =====================================================

    try {
      if (
        task.assignedTo?.id &&
        task.assignedTo.id !== user.id
      ) {
        await createNotification({
          firmId,
          userId: task.assignedTo.id,
          type: "TASK",
          title: "New task assigned",
          message:
            `You have been assigned the task "${task.title}".` +
            (task.matter?.referenceNumber
              ? ` Matter: ${task.matter.referenceNumber}.`
              : ""),
        });
      }
    } catch (notificationError) {
      console.error(
        "TASK NOTIFICATION ERROR:",
        notificationError
      );
    }

    // =====================================================
    // RESPONSE
    // =====================================================

    return NextResponse.json(
      {
        success: true,
        task,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "CREATE TASK ERROR:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to create task.",
      },
      {
        status: 500,
      }
    );
  }
}