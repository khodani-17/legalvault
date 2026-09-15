import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions-server";
import { createNotification } from "@/lib/notifications";
import {
  canAccessTask,
  canUpdateTask,
  getActiveTaskUser,
  isManagementRole,
} from "@/lib/task-authorization";

const ALLOWED_STATUSES = [
  "TODO",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;

const ALLOWED_PRIORITIES = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
] as const;

type RouteContext = {
  params: Promise<{ id: string }>;
};

function isValidStatus(
  value: unknown,
): value is (typeof ALLOWED_STATUSES)[number] {
  return (
    typeof value === "string" &&
    ALLOWED_STATUSES.includes(
      value as (typeof ALLOWED_STATUSES)[number],
    )
  );
}

function isValidPriority(
  value: unknown,
): value is (typeof ALLOWED_PRIORITIES)[number] {
  return (
    typeof value === "string" &&
    ALLOWED_PRIORITIES.includes(
      value as (typeof ALLOWED_PRIORITIES)[number],
    )
  );
}

function parseOptionalDate(value: unknown): Date | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed;
}

export async function GET(
  request: Request,
  context: RouteContext,
) {
  const permission = await requirePermission("tasks.view");

  if (!permission.authorized) {
    return permission.response;
  }

  try {
    const session = permission.session;

    if (!session.user?.id || !session.user.firmId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: "Task ID is required" },
        { status: 400 },
      );
    }

    const user = await getActiveTaskUser(
      session.user.id,
      session.user.firmId,
    );

    if (!user) {
      return NextResponse.json(
        { error: "Active user account not found" },
        { status: 403 },
      );
    }

    const authorization = await canAccessTask({
      taskId: id,
      userId: user.id,
      firmId: user.firmId,
    });

    if (!authorization.allowed) {
      return NextResponse.json(
        {
          error:
            authorization.reason ??
            "You are not authorized to access this task",
        },
        { status: 403 },
      );
    }

    const task = await prisma.task.findFirst({
      where: {
        id,
        firmId: user.firmId,
      },
      select: {
        id: true,
        firmId: true,
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

        matter: {
          select: {
            id: true,
            title: true,
            client: {
              select: {
                id: true,
                name: true,
              },
            },
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

        reports: {
          orderBy: {
            submittedAt: "desc",
          },
          select: {
            id: true,
            submittedById: true,
            outcome: true,
            report: true,
            nextAction: true,
            submittedAt: true,
            reviewedAt: true,
            reviewedById: true,
            reviewNote: true,
            submittedBy: {
              select: {
                id: true,
                name: true,
                role: true,
              },
            },
            reviewedBy: {
              select: {
                id: true,
                name: true,
                role: true,
              },
            },
          },
        },

        assistanceRequests: {
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
            requestedById: true,
            reason: true,
            response: true,
            status: true,
            respondedAt: true,
            createdAt: true,
            updatedAt: true,
            requestedBy: {
              select: {
                id: true,
                name: true,
                role: true,
              },
            },
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 },
      );
    }

    await createAuditLog({
      firmId: user.firmId,
      userId: user.id,
      action: "READ",
      entityType: "TASK",
      entityId: task.id,
      description: `Viewed task "${task.title}"`,
      request,
    });

    return NextResponse.json({
      success: true,
      task,
    });
  } catch (error) {
    console.error("GET /api/tasks/[id] error:", error);

    return NextResponse.json(
      { error: "Failed to load task" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext,
) {
  const permission = await requirePermission("tasks.update");

  if (!permission.authorized) {
    return permission.response;
  }

  try {
    const session = permission.session;

    if (!session.user?.id || !session.user.firmId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: "Task ID is required" },
        { status: 400 },
      );
    }

    const user = await getActiveTaskUser(
      session.user.id,
      session.user.firmId,
    );

    if (!user) {
      return NextResponse.json(
        { error: "Active user account not found" },
        { status: 403 },
      );
    }

    const authorization = await canUpdateTask({
      taskId: id,
      userId: user.id,
      firmId: user.firmId,
    });

    if (!authorization.allowed) {
      return NextResponse.json(
        {
          error:
            authorization.reason ??
            "You are not authorized to update this task",
        },
        { status: 403 },
      );
    }

    const existingTask = await prisma.task.findFirst({
      where: {
        id,
        firmId: user.firmId,
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        assignedToId: true,
        matterId: true,
        dueDate: true,
        completedAt: true,
        requiresReport: true,
        delegatedById: true,
        delegatedOnBehalfOfId: true,
      },
    });

    if (!existingTask) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 },
      );
    }

    const body = await request.json();

    const {
      title,
      description,
      status,
      priority,
      assignedToId,
      matterId,
      dueDate,
      requiresReport,
    } = body;

    if (
      title !== undefined &&
      (typeof title !== "string" ||
        title.trim().length === 0 ||
        title.trim().length > 200)
    ) {
      return NextResponse.json(
        {
          error:
            "Title must be between 1 and 200 characters",
        },
        { status: 400 },
      );
    }

    if (
      description !== undefined &&
      description !== null &&
      (typeof description !== "string" ||
        description.length > 10000)
    ) {
      return NextResponse.json(
        {
          error:
            "Description must not exceed 10,000 characters",
        },
        { status: 400 },
      );
    }

    if (
      status !== undefined &&
      !isValidStatus(status)
    ) {
      return NextResponse.json(
        { error: "Invalid task status" },
        { status: 400 },
      );
    }

    if (
      priority !== undefined &&
      !isValidPriority(priority)
    ) {
      return NextResponse.json(
        { error: "Invalid task priority" },
        { status: 400 },
      );
    }

    if (
      requiresReport !== undefined &&
      typeof requiresReport !== "boolean"
    ) {
      return NextResponse.json(
        { error: "requiresReport must be a boolean" },
        { status: 400 },
      );
    }

    const parsedDueDate = parseOptionalDate(dueDate);

    if (
      dueDate !== undefined &&
      parsedDueDate === undefined
    ) {
      return NextResponse.json(
        { error: "Invalid due date" },
        { status: 400 },
      );
    }

    if (
      assignedToId !== undefined &&
      assignedToId !== null
    ) {
      if (
        typeof assignedToId !== "string" ||
        assignedToId.trim().length === 0
      ) {
        return NextResponse.json(
          { error: "Invalid assigned user" },
          { status: 400 },
        );
      }

      const assignedUser = await prisma.user.findFirst({
        where: {
          id: assignedToId,
          firmId: user.firmId,
          status: "ACTIVE",
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });

      if (!assignedUser) {
        return NextResponse.json(
          {
            error:
              "Assigned user does not exist or is not active",
          },
          { status: 400 },
        );
      }
    }

    if (
      matterId !== undefined &&
      matterId !== null
    ) {
      if (
        typeof matterId !== "string" ||
        matterId.trim().length === 0
      ) {
        return NextResponse.json(
          { error: "Invalid matter" },
          { status: 400 },
        );
      }

      const matter = await prisma.matter.findFirst({
        where: {
          id: matterId,
          firmId: user.firmId,
        },
        select: {
          id: true,
        },
      });

      if (!matter) {
        return NextResponse.json(
          {
            error:
              "Matter does not exist in this firm",
          },
          { status: 400 },
        );
      }
    }

    const nextStatus =
      status !== undefined
        ? status
        : existingTask.status;

    const nextAssignedToId =
      assignedToId !== undefined
        ? assignedToId
        : existingTask.assignedToId;

    const nextRequiresReport =
      requiresReport !== undefined
        ? requiresReport
        : existingTask.requiresReport;

    const isCompleting =
      nextStatus === "COMPLETED" &&
      existingTask.status !== "COMPLETED";

    const isReopening =
      nextStatus !== "COMPLETED" &&
      existingTask.status === "COMPLETED";

    const updatedTask = await prisma.$transaction(
      async (tx) => {
        const task = await tx.task.update({
          where: {
            id: existingTask.id,
          },
          data: {
            ...(title !== undefined
              ? { title: title.trim() }
              : {}),

            ...(description !== undefined
              ? {
                  description:
                    description === null
                      ? null
                      : description.trim(),
                }
              : {}),

            ...(status !== undefined
              ? {
                  status,
                  completedAt:
                    status === "COMPLETED"
                      ? existingTask.completedAt ??
                        new Date()
                      : null,
                }
              : {}),

            ...(priority !== undefined
              ? { priority }
              : {}),

            ...(assignedToId !== undefined
              ? { assignedToId }
              : {}),

            ...(matterId !== undefined
              ? { matterId }
              : {}),

            ...(dueDate !== undefined
              ? { dueDate: parsedDueDate ?? null }
              : {}),

            ...(requiresReport !== undefined
              ? { requiresReport }
              : {}),
          },

          select: {
            id: true,
            firmId: true,
            title: true,
            description: true,
            status: true,
            priority: true,
            assignedToId: true,
            matterId: true,
            dueDate: true,
            completedAt: true,
            requiresReport: true,
            reportSubmittedAt: true,
            reportReviewedAt: true,
            reportOutcome: true,
            createdAt: true,
            updatedAt: true,

            matter: {
              select: {
                id: true,
                title: true,
                client: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
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
          },
        });

        await tx.taskActivity.create({
          data: {
            taskId: task.id,
            userId: user.id,
            action: "TASK_UPDATED",
            description: `Task "${task.title}" was updated`,
            metadata: {
              previousStatus: existingTask.status,
              newStatus: task.status,
              previousPriority: existingTask.priority,
              newPriority: task.priority,
              previousAssignedToId:
                existingTask.assignedToId,
              newAssignedToId: task.assignedToId,
              previousMatterId:
                existingTask.matterId,
              newMatterId: task.matterId,
              previousRequiresReport:
                existingTask.requiresReport,
              newRequiresReport:
                task.requiresReport,
              isCompleting,
              isReopening,
            },
          },
        });

        return task;
      },
    );

    await createAuditLog({
      firmId: user.firmId,
      userId: user.id,
      action: "UPDATE",
      entityType: "TASK",
      entityId: updatedTask.id,
      description: `Updated task "${updatedTask.title}"`,
      metadata: {
        previousStatus: existingTask.status,
        newStatus: updatedTask.status,
        previousPriority: existingTask.priority,
        newPriority: updatedTask.priority,
        previousAssignedToId:
          existingTask.assignedToId,
        newAssignedToId:
          updatedTask.assignedToId,
        previousMatterId:
          existingTask.matterId,
        newMatterId:
          updatedTask.matterId,
        previousRequiresReport:
          existingTask.requiresReport,
        newRequiresReport:
          updatedTask.requiresReport,
        delegatedById:
          updatedTask.delegatedBy?.id ?? null,
        delegatedOnBehalfOfId:
          updatedTask.delegatedOnBehalfOf?.id ?? null,
      },
      request,
    });

    /*
     * Notify a newly assigned employee.
     */
    if (
      updatedTask.assignedToId &&
      updatedTask.assignedToId !==
        existingTask.assignedToId
    ) {
      try {
        await createNotification({
          firmId: user.firmId,
          userId: updatedTask.assignedToId,
          type: "TASK",
          title: "Task assigned to you",
          message: `You have been assigned the task "${updatedTask.title}".`,
        });
      } catch (notificationError) {
        console.error(
          "Task assignment notification failed:",
          notificationError,
        );
      }
    }

    /*
     * Notify the assigned employee when a task is completed.
     */
    if (
      isCompleting &&
      updatedTask.assignedToId &&
      updatedTask.assignedToId !== user.id
    ) {
      try {
        await createNotification({
          firmId: user.firmId,
          userId: updatedTask.assignedToId,
          type: "TASK",
          title: "Task completed",
          message: `The task "${updatedTask.title}" has been marked as completed.`,
        });
      } catch (notificationError) {
        console.error(
          "Task completion notification failed:",
          notificationError,
        );
      }
    }

    /*
     * Notify the task creator when the task is completed.
     */
    if (
      isCompleting &&
      updatedTask.createdBy &&
      updatedTask.createdBy.id !== user.id
    ) {
      try {
        await createNotification({
          firmId: user.firmId,
          userId: updatedTask.createdBy.id,
          type: "TASK",
          title: "Task completed",
          message: `The task "${updatedTask.title}" has been marked as completed.`,
        });
      } catch (notificationError) {
        console.error(
          "Task creator notification failed:",
          notificationError,
        );
      }
    }

    /*
     * Notify the represented Director/Managing Partner if
     * someone else changes the task.
     */
    if (
      updatedTask.delegatedOnBehalfOf &&
      updatedTask.delegatedOnBehalfOf.id !== user.id &&
      updatedTask.delegatedOnBehalfOf.id !==
        updatedTask.assignedToId
    ) {
      try {
        await createNotification({
          firmId: user.firmId,
          userId: updatedTask.delegatedOnBehalfOf.id,
          type: "TASK",
          title: "Delegated task updated",
          message: `The delegated task "${updatedTask.title}" has been updated.`,
        });
      } catch (notificationError) {
        console.error(
          "Delegated task notification failed:",
          notificationError,
        );
      }
    }

    return NextResponse.json({
      success: true,
      task: updatedTask,
    });
  } catch (error) {
    console.error("PATCH /api/tasks/[id] error:", error);

    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  context: RouteContext,
) {
  const permission = await requirePermission("tasks.delete");

  if (!permission.authorized) {
    return permission.response;
  }

  try {
    const session = permission.session;

    if (!session.user?.id || !session.user.firmId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: "Task ID is required" },
        { status: 400 },
      );
    }

    const user = await getActiveTaskUser(
      session.user.id,
      session.user.firmId,
    );

    if (!user) {
      return NextResponse.json(
        { error: "Active user account not found" },
        { status: 403 },
      );
    }

    const authorization = await canUpdateTask({
      taskId: id,
      userId: user.id,
      firmId: user.firmId,
    });

    if (!authorization.allowed) {
      return NextResponse.json(
        {
          error:
            authorization.reason ??
            "You are not authorized to delete this task",
        },
        { status: 403 },
      );
    }

    const task = await prisma.task.findFirst({
      where: {
        id,
        firmId: user.firmId,
      },
      select: {
        id: true,
        title: true,
        assignedToId: true,
        createdById: true,
        delegatedById: true,
        delegatedOnBehalfOfId: true,
      },
    });

    if (!task) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.task.delete({
        where: {
          id: task.id,
        },
      });
    });

    await createAuditLog({
      firmId: user.firmId,
      userId: user.id,
      action: "DELETE",
      entityType: "TASK",
      entityId: task.id,
      description: `Deleted task "${task.title}"`,
      metadata: {
        assignedToId: task.assignedToId,
        createdById: task.createdById,
        delegatedById: task.delegatedById,
        delegatedOnBehalfOfId:
          task.delegatedOnBehalfOfId,
      },
      request,
    });

    return NextResponse.json({
      success: true,
      message: "Task deleted successfully",
    });
  } catch (error) {
    console.error("DELETE /api/tasks/[id] error:", error);

    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 },
    );
  }
}