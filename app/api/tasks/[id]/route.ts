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

// =====================================================
// GET /api/tasks/[id]
// =====================================================

export async function GET(
  request: Request,
  { params }: RouteContext
) {
  try {
    const authorization =
      await requirePermission("tasks.view");

    if (!authorization.authorized) {
      return authorization.response;
    }

    const session = authorization.session;
    const { id } = await params;

    // Verify that the authenticated user is still active
    // and belongs to the same firm.
    const user = await prisma.user.findFirst({
      where: {
        id: session.user.id,
        firmId: session.user.firmId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        firmId: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          error:
            "User account is inactive or invalid.",
        },
        { status: 403 }
      );
    }

    // Tenant boundary:
    // The task must belong to the authenticated user's firm.
    const task = await prisma.task.findFirst({
      where: {
        id,
        firmId: user.firmId,
      },
      include: {
        matter: {
          include: {
            client: true,
          },
        },
        assignedTo: true,
        createdBy: true,
      },
    });

    if (!task) {
      return NextResponse.json(
        {
          error: "Task not found.",
        },
        { status: 404 }
      );
    }

    await createAuditLog({
      request,
      firmId: user.firmId,
      userId: user.id,
      action: "READ",
      entityType: "Task",
      entityId: task.id,
      description: `Viewed task ${task.title}.`,
      metadata: {
        taskId: task.id,
        taskTitle: task.title,
        status: task.status,
        priority: task.priority,
        matterId: task.matterId,
        matterReference:
          task.matter?.referenceNumber ?? null,
        assignedToId: task.assignedToId,
        createdById: task.createdById,
      },
    });

    return NextResponse.json({
      task,
    });
  } catch (error) {
    console.error(
      "GET TASK ERROR:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to load task.",
      },
      {
        status: 500,
      }
    );
  }
}

// =====================================================
// PATCH /api/tasks/[id]
// Update task
// =====================================================

export async function PATCH(
  request: Request,
  { params }: RouteContext
) {
  try {
    const authorization =
      await requirePermission("tasks.update");

    if (!authorization.authorized) {
      return authorization.response;
    }

    const session = authorization.session;
    const { id } = await params;

    // Verify authenticated user is active and belongs
    // to the same firm.
    const user = await prisma.user.findFirst({
      where: {
        id: session.user.id,
        firmId: session.user.firmId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        firmId: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          error:
            "User account is inactive or invalid.",
        },
        {
          status: 403,
        }
      );
    }

    // Tenant boundary:
    // Never retrieve a task without verifying its firm.
    const existingTask =
      await prisma.task.findFirst({
        where: {
          id,
          firmId: user.firmId,
        },
      });

    if (!existingTask) {
      return NextResponse.json(
        {
          error: "Task not found.",
        },
        {
          status: 404,
        }
      );
    }

    let body: Record<string, unknown>;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          error: "Invalid request body.",
        },
        {
          status: 400,
        }
      );
    }

    const data: {
      title?: string;
      description?: string | null;
      status?:
        | "TODO"
        | "IN_PROGRESS"
        | "COMPLETED"
        | "CANCELLED";
      priority?:
        | "LOW"
        | "MEDIUM"
        | "HIGH"
        | "URGENT";
      assignedToId?: string | null;
      matterId?: string | null;
      dueDate?: Date | null;
      completedAt?: Date | null;
    } = {};

    // -------------------------------------------------
    // TITLE
    // -------------------------------------------------

    if (body.title !== undefined) {
      const title = String(body.title).trim();

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

      data.title = title;
    }

    // -------------------------------------------------
    // DESCRIPTION
    // -------------------------------------------------

    if (body.description !== undefined) {
      const description = String(
        body.description || ""
      ).trim();

      data.description =
        description || null;
    }

    // -------------------------------------------------
    // STATUS
    // -------------------------------------------------

    if (body.status !== undefined) {
      if (
        !ALLOWED_STATUSES.includes(
          body.status as (typeof ALLOWED_STATUSES)[number]
        )
      ) {
        return NextResponse.json(
          {
            error: "Invalid task status.",
          },
          {
            status: 400,
          }
        );
      }

      data.status =
        body.status as (typeof ALLOWED_STATUSES)[number];

      if (body.status === "COMPLETED") {
        data.completedAt = new Date();
      } else {
        data.completedAt = null;
      }
    }

    // -------------------------------------------------
    // PRIORITY
    // -------------------------------------------------

    if (body.priority !== undefined) {
      if (
        !ALLOWED_PRIORITIES.includes(
          body.priority as (typeof ALLOWED_PRIORITIES)[number]
        )
      ) {
        return NextResponse.json(
          {
            error: "Invalid task priority.",
          },
          {
            status: 400,
          }
        );
      }

      data.priority =
        body.priority as (typeof ALLOWED_PRIORITIES)[number];
    }

    // -------------------------------------------------
    // ASSIGNED USER
    // -------------------------------------------------

    if (body.assignedToId !== undefined) {
      if (!body.assignedToId) {
        data.assignedToId = null;
      } else {
        const assignedUser =
          await prisma.user.findFirst({
            where: {
              id: String(body.assignedToId),
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
              error:
                "The selected user is not an active user of your firm.",
            },
            {
              status: 403,
            }
          );
        }

        data.assignedToId =
          assignedUser.id;
      }
    }

    // -------------------------------------------------
    // MATTER
    // -------------------------------------------------

    if (body.matterId !== undefined) {
      if (!body.matterId) {
        data.matterId = null;
      } else {
        const matter =
          await prisma.matter.findFirst({
            where: {
              id: String(body.matterId),
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
                "The selected matter does not belong to your firm.",
            },
            {
              status: 403,
            }
          );
        }

        data.matterId = matter.id;
      }
    }

    // -------------------------------------------------
    // DUE DATE
    // -------------------------------------------------

    if (body.dueDate !== undefined) {
      if (!body.dueDate) {
        data.dueDate = null;
      } else {
        const parsedDate =
          new Date(String(body.dueDate));

        if (
          Number.isNaN(
            parsedDate.getTime()
          )
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

        data.dueDate = parsedDate;
      }
    }

    // -------------------------------------------------
    // UPDATE
    // -------------------------------------------------

    const updatedTask =
      await prisma.$transaction(
        async (tx) => {
          const task =
            await tx.task.update({
              where: {
                id: existingTask.id,
              },
              data,
              include: {
                matter: {
                  include: {
                    client: true,
                  },
                },
                assignedTo: true,
                createdBy: true,
              },
            });

          return task;
        }
      );

    // -------------------------------------------------
    // AUDIT CHANGES
    // -------------------------------------------------

    const changes: Record<
      string,
      {
        previous: unknown;
        new: unknown;
      }
    > = {};

    if (data.title !== undefined) {
      changes.title = {
        previous: existingTask.title,
        new: updatedTask.title,
      };
    }

    if (
      data.description !== undefined
    ) {
      changes.description = {
        previous:
          existingTask.description,
        new: updatedTask.description,
      };
    }

    if (data.status !== undefined) {
      changes.status = {
        previous: existingTask.status,
        new: updatedTask.status,
      };
    }

    if (data.priority !== undefined) {
      changes.priority = {
        previous:
          existingTask.priority,
        new: updatedTask.priority,
      };
    }

    if (
      data.assignedToId !== undefined
    ) {
      changes.assignedToId = {
        previous:
          existingTask.assignedToId,
        new: updatedTask.assignedToId,
      };
    }

    if (data.matterId !== undefined) {
      changes.matterId = {
        previous:
          existingTask.matterId,
        new: updatedTask.matterId,
      };
    }

    if (data.dueDate !== undefined) {
      changes.dueDate = {
        previous:
          existingTask.dueDate,
        new: updatedTask.dueDate,
      };
    }

    if (
      data.completedAt !== undefined
    ) {
      changes.completedAt = {
        previous:
          existingTask.completedAt,
        new: updatedTask.completedAt,
      };
    }

    await createAuditLog({
      request,
      firmId: user.firmId,
      userId: user.id,
      action: "UPDATE",
      entityType: "Task",
      entityId: updatedTask.id,
      description:
        `Updated task ${updatedTask.title}.`,
      metadata: {
        taskId: updatedTask.id,
        taskTitle: updatedTask.title,
        changes,
      },
    });

    // =================================================
    // NOTIFICATIONS
    // =================================================
    //
    // Notification failures must NEVER cause the task
    // update itself to fail.
    //
    // Notifications are generated only for meaningful
    // task events:
    //
    // 1. Task assigned/reassigned
    // 2. Task completed
    //
    // Ordinary edits do not generate notifications.
    // =================================================

    try {
      const assignmentChanged =
        data.assignedToId !== undefined &&
        existingTask.assignedToId !==
          updatedTask.assignedToId;

      const completedNow =
        existingTask.status !== "COMPLETED" &&
        updatedTask.status === "COMPLETED";

      // -------------------------------------------------
      // TASK ASSIGNED / REASSIGNED
      // -------------------------------------------------

      if (
        assignmentChanged &&
        updatedTask.assignedTo?.id &&
        updatedTask.assignedTo.id !== user.id
      ) {
        await createNotification({
          firmId: user.firmId,
          userId: updatedTask.assignedTo.id,
          type: "TASK",
          title:
            existingTask.assignedToId
              ? "Task reassigned"
              : "New task assigned",
          message:
            existingTask.assignedToId
              ? `The task "${updatedTask.title}" has been reassigned to you.`
              : `You have been assigned the task "${updatedTask.title}".`,
        });
      }

      // -------------------------------------------------
      // TASK COMPLETED
      // -------------------------------------------------

      if (completedNow) {
        const notifiedUserIds =
          new Set<string>();

        // Notify the assigned user if another user
        // completed the task.
        if (
          updatedTask.assignedTo?.id &&
          updatedTask.assignedTo.id !== user.id
        ) {
          await createNotification({
            firmId: user.firmId,
            userId: updatedTask.assignedTo.id,
            type: "TASK",
            title: "Task completed",
            message:
              `The task "${updatedTask.title}" has been marked as completed.` +
              (updatedTask.matter?.referenceNumber
                ? ` Matter: ${updatedTask.matter.referenceNumber}.`
                : ""),
          });

          notifiedUserIds.add(
            updatedTask.assignedTo.id
          );
        }

        // Notify the creator when someone else completes
        // the task.
        //
        // If the creator is also the assignee, the
        // assignee notification above already covers them.
        if (
          updatedTask.createdBy?.id &&
          updatedTask.createdBy.id !== user.id &&
          !notifiedUserIds.has(
            updatedTask.createdBy.id
          )
        ) {
          await createNotification({
            firmId: user.firmId,
            userId: updatedTask.createdBy.id,
            type: "TASK",
            title: "Task completed",
            message:
              `The task "${updatedTask.title}" that you created has been completed.` +
              (updatedTask.matter?.referenceNumber
                ? ` Matter: ${updatedTask.matter.referenceNumber}.`
                : ""),
          });
        }
      }
    } catch (notificationError) {
      console.error(
        "TASK NOTIFICATION ERROR:",
        notificationError
      );
    }

    return NextResponse.json({
      success: true,
      task: updatedTask,
    });
  } catch (error) {
    console.error(
      "UPDATE TASK ERROR:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to update task.",
      },
      {
        status: 500,
      }
    );
  }
}

// =====================================================
// DELETE /api/tasks/[id]
// =====================================================

export async function DELETE(
  request: Request,
  { params }: RouteContext
) {
  try {
    const authorization =
      await requirePermission(
        "tasks.delete"
      );

    if (!authorization.authorized) {
      return authorization.response;
    }

    const session = authorization.session;
    const { id } = await params;

    // Verify authenticated user is active and belongs
    // to the same firm.
    const user = await prisma.user.findFirst({
      where: {
        id: session.user.id,
        firmId: session.user.firmId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        firmId: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          error:
            "User account is inactive or invalid.",
        },
        {
          status: 403,
        }
      );
    }

    // Tenant boundary:
    // A task from another firm is invisible.
    const task = await prisma.task.findFirst({
      where: {
        id,
        firmId: user.firmId,
      },
    });

    if (!task) {
      return NextResponse.json(
        {
          error: "Task not found.",
        },
        {
          status: 404,
        }
      );
    }

    await prisma.$transaction(
      async (tx) => {
        await tx.task.delete({
          where: {
            id: task.id,
          },
        });
      }
    );

    await createAuditLog({
      request,
      firmId: user.firmId,
      userId: user.id,
      action: "DELETE",
      entityType: "Task",
      entityId: task.id,
      description:
        `Deleted task ${task.title}.`,
      metadata: {
        taskId: task.id,
        taskTitle: task.title,
        status: task.status,
        priority: task.priority,
        assignedToId:
          task.assignedToId,
        matterId: task.matterId,
        dueDate: task.dueDate,
        completedAt:
          task.completedAt,
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "DELETE TASK ERROR:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to delete task.",
      },
      {
        status: 500,
      }
    );
  }
}