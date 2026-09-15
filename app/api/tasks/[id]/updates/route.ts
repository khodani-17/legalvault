import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions-server";
import { createNotification } from "@/lib/notifications";
import {
  canAccessTask,
  getActiveTaskUser,
} from "@/lib/task-authorization";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(
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
        title: true,
        assignedToId: true,
        createdById: true,
        delegatedById: true,
        delegatedOnBehalfOfId: true,
        status: true,
      },
    });

    if (!task) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 },
      );
    }

    const body = await request.json();

    const content =
      typeof body.content === "string"
        ? body.content.trim()
        : "";

    if (!content) {
      return NextResponse.json(
        { error: "Update content is required" },
        { status: 400 },
      );
    }

    if (content.length > 10000) {
      return NextResponse.json(
        {
          error:
            "Update content must not exceed 10,000 characters",
        },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const note = await tx.taskNote.create({
          data: {
            taskId: task.id,
            authorId: user.id,
            content,
          },
          select: {
            id: true,
            taskId: true,
            authorId: true,
            content: true,
            createdAt: true,
            updatedAt: true,
            author: {
              select: {
                id: true,
                name: true,
                role: true,
              },
            },
          },
        });

        await tx.taskActivity.create({
          data: {
            taskId: task.id,
            userId: user.id,
            action: "TASK_UPDATE_ADDED",
            description: `Added an update to task "${task.title}"`,
            metadata: {
              noteId: note.id,
            },
          },
        });

        return note;
      },
    );

    await createAuditLog({
      firmId: user.firmId,
      userId: user.id,
      action: "UPDATE",
      entityType: "TASK",
      entityId: task.id,
      description: `Added an update to task "${task.title}"`,
      metadata: {
        noteId: result.id,
        assignedToId: task.assignedToId,
        delegatedById: task.delegatedById,
        delegatedOnBehalfOfId:
          task.delegatedOnBehalfOfId,
      },
      request,
    });

    /*
     * Notify the people responsible for the task.
     *
     * We do not broadcast the update to the entire firm.
     * Only relevant task participants are notified.
     */
    const notificationRecipients = new Set<string>();

    if (
      task.delegatedOnBehalfOfId &&
      task.delegatedOnBehalfOfId !== user.id
    ) {
      notificationRecipients.add(
        task.delegatedOnBehalfOfId,
      );
    }

    if (
      task.delegatedById &&
      task.delegatedById !== user.id
    ) {
      notificationRecipients.add(task.delegatedById);
    }

    if (
      task.createdById &&
      task.createdById !== user.id
    ) {
      notificationRecipients.add(task.createdById);
    }

    for (const recipientId of notificationRecipients) {
      try {
        await createNotification({
          firmId: user.firmId,
          userId: recipientId,
          type: "TASK",
          title: "Task update added",
          message: `A task update was added to "${task.title}".`,
        });
      } catch (notificationError) {
        /*
         * Notification failures must never cause the
         * task update itself to fail.
         */
        console.error(
          "Task update notification failed:",
          notificationError,
        );
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: "Task update added successfully",
        update: result,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(
      "POST /api/tasks/[id]/updates error:",
      error,
    );

    return NextResponse.json(
      { error: "Failed to add task update" },
      { status: 500 },
    );
  }
}