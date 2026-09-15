import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions-server";
import { createNotification } from "@/lib/notifications";
import {
  validateDelegationAuthority,
  isManagementRole,
  canDelegateTaskRole,
} from "@/lib/task-authorization";

// =====================================================
// GET /api/tasks
// Get tasks accessible to the logged-in user
//
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

    const { searchParams } =
      new URL(request.url);

    const matterId =
      searchParams.get("matterId")?.trim() || null;

    const status =
      searchParams.get("status")?.trim() || null;

    // =====================================================
    // TASK ACCESS FILTER
    // =====================================================
    //
    // Management roles may see the firm's task workload.
    //
    // Other employees only see tasks connected to them:
    //
    // - assigned to them
    // - created by them
    // - delegated by them
    // - delegated on behalf of them
    //
    // This prevents employees from browsing unrelated
    // colleagues' tasks simply because they have tasks.view.
    // =====================================================

    const taskRelationshipFilter =
      isManagementRole(user.role)
        ? {}
        : {
            OR: [
              {
                assignedToId: user.id,
              },
              {
                createdById: user.id,
              },
              {
                delegatedById: user.id,
              },
              {
                delegatedOnBehalfOfId: user.id,
              },
            ],
          };

    // =====================================================
    // GET TASKS
    // =====================================================

    const tasks = await prisma.task.findMany({
      where: {
        firmId,

        ...taskRelationshipFilter,

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

        requiresReport: true,
        reportSubmittedAt: true,
        reportReviewedAt: true,
        reportOutcome: true,

        delegatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },

        delegatedOnBehalfOf: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },

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
      currentUser: {
        id: user.id,
        role: user.role,
      },
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
// Delegate a new task
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
    // VERIFY DELEGATION AUTHORITY
    // =====================================================

    if (!canDelegateTaskRole(user.role)) {
      return NextResponse.json(
        {
          error:
            "You do not have authority to delegate tasks.",
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

    // =====================================================
    // BASIC TASK DATA
    // =====================================================

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

    // =====================================================
    // SECURITY RULE:
    // EVERY NEW DELEGATED TASK STARTS AS TODO.
    //
    // Completion/cancellation must happen through the
    // appropriate task workflow after delegation.
    // =====================================================

    const status = "TODO";

    const dueDateValue = String(
      body.dueDate || ""
    ).trim();

    const dueDate = dueDateValue
      ? new Date(dueDateValue)
      : null;

    // =====================================================
    // DELEGATION DATA
    // =====================================================

    const delegatedOnBehalfOfIdValue =
      String(
        body.delegatedOnBehalfOfId || ""
      ).trim();

    const delegatedOnBehalfOfId =
      delegatedOnBehalfOfIdValue || null;

    const requiresReport =
      body.requiresReport === true ||
      body.requiresReport === "true";

    // =====================================================
    // VALIDATE DELEGATION AUTHORITY
    // =====================================================

    const delegationAuthority =
      await validateDelegationAuthority({
        actorId: user.id,
        firmId,
        onBehalfOfId:
          delegatedOnBehalfOfId,
      });

    if (!delegationAuthority.allowed) {
      return NextResponse.json(
        {
          error:
            delegationAuthority.reason ||
            "You are not authorized to delegate this task.",
        },
        {
          status: 403,
        }
      );
    }

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

    if (title.length > 200) {
      return NextResponse.json(
        {
          error:
            "Task title cannot exceed 200 characters.",
        },
        {
          status: 400,
        }
      );
    }

    if (description.length > 10000) {
      return NextResponse.json(
        {
          error:
            "Task instructions cannot exceed 10,000 characters.",
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
    //
    // Linking a task to a matter DOES NOT grant the
    // assigned employee MatterUser access.
    //
    // Matter permissions remain separate.
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
            name: true,
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
    // CREATE TASK + ACTIVITY
    // =====================================================

    const task = await prisma.$transaction(
      async (tx) => {
        const createdTask =
          await tx.task.create({
            data: {
              firmId,
              matterId,

              title,

              description:
                description || null,

              status: "TODO",

              priority: priority as
                | "LOW"
                | "MEDIUM"
                | "HIGH"
                | "URGENT",

              assignedToId,

              createdById:
                user.id,

              delegatedById:
                user.id,

              delegatedOnBehalfOfId,

              requiresReport,

              dueDate,

              completedAt: null,
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

              requiresReport: true,
              reportSubmittedAt: true,
              reportReviewedAt: true,
              reportOutcome: true,

              delegatedBy: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                },
              },

              delegatedOnBehalfOf: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                },
              },

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

        // =================================================
        // TASK ACTIVITY
        // =================================================

        await tx.taskActivity.create({
          data: {
            taskId:
              createdTask.id,

            userId:
              user.id,

            action:
              "TASK_DELEGATED",

            description:
              delegatedOnBehalfOfId
                ? `Task "${createdTask.title}" was delegated to ${
                    createdTask.assignedTo?.name ||
                    "the assigned employee"
                  } on behalf of ${
                    createdTask
                      .delegatedOnBehalfOf
                      ?.name ||
                    "the Director"
                  }.`
                : `Task "${createdTask.title}" was delegated by ${user.name}.`,

            metadata: {
              taskId:
                createdTask.id,

              assignedToId:
                createdTask.assignedTo?.id ??
                null,

              delegatedById:
                user.id,

              delegatedOnBehalfOfId,

              requiresReport,

              matterId:
                createdTask.matter?.id ??
                null,
            },
          },
        });

        return createdTask;
      }
    );

    // =====================================================
    // AUDIT LOG
    // =====================================================

    await createAuditLog({
      request,

      firmId,

      userId:
        user.id,

      action:
        "CREATE",

      entityType:
        "Task",

      entityId:
        task.id,

      description:
        `Delegated task: ${task.title}`,

      metadata: {
        taskId:
          task.id,

        taskTitle:
          task.title,

        description:
          task.description,

        status:
          task.status,

        priority:
          task.priority,

        matterId:
          task.matter?.id ??
          null,

        matterReference:
          task.matter?.referenceNumber ??
          null,

        assignedToId:
          task.assignedTo?.id ??
          null,

        assignedToName:
          task.assignedTo?.name ??
          null,

        delegatedById:
          task.delegatedBy?.id ??
          null,

        delegatedByName:
          task.delegatedBy?.name ??
          null,

        delegatedOnBehalfOfId:
          task.delegatedOnBehalfOf?.id ??
          null,

        delegatedOnBehalfOfName:
          task.delegatedOnBehalfOf?.name ??
          null,

        requiresReport:
          task.requiresReport,

        dueDate:
          task.dueDate,

        completedAt:
          task.completedAt,
      },
    });

    // =====================================================
    // NOTIFICATION
    // =====================================================

    try {
      if (
        task.assignedTo?.id &&
        task.assignedTo.id !== user.id
      ) {
        let message =
          `You have been assigned the task "${task.title}".`;

        if (
          task.matter?.referenceNumber
        ) {
          message +=
            ` Matter: ${task.matter.referenceNumber}.`;
        }

        if (task.requiresReport) {
          message +=
            " A report back is required.";
        }

        if (
          task.delegatedOnBehalfOf?.name
        ) {
          message +=
            ` Delegated on behalf of ${task.delegatedOnBehalfOf.name}.`;
        }

        await createNotification({
          firmId,

          userId:
            task.assignedTo.id,

          type:
            "TASK",

          title:
            "New task delegated",

          message,
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
        error:
          "Failed to create task.",
      },
      {
        status: 500,
      }
    );
  }
}