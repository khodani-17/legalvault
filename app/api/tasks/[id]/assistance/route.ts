import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { requirePermission } from "@/lib/permissions-server";
import {
  canRequestTaskAssistance,
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

    const authorization =
      await canRequestTaskAssistance({
        taskId: id,
        userId: user.id,
        firmId: user.firmId,
      });

    if (!authorization.allowed) {
      return NextResponse.json(
        {
          error:
            authorization.reason ??
            "You are not authorized to request assistance for this task",
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
        status: true,
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

    if (task.status === "COMPLETED") {
      return NextResponse.json(
        {
          error:
            "Assistance cannot be requested for a completed task",
        },
        { status: 400 },
      );
    }

    if (task.status === "CANCELLED") {
      return NextResponse.json(
        {
          error:
            "Assistance cannot be requested for a cancelled task",
        },
        { status: 400 },
      );
    }

    const body = await request.json();

    const reason =
      typeof body.reason === "string"
        ? body.reason.trim()
        : "";

    if (!reason) {
      return NextResponse.json(
        { error: "Assistance reason is required" },
        { status: 400 },
      );
    }

    if (reason.length > 10000) {
      return NextResponse.json(
        {
          error:
            "Assistance reason must not exceed 10,000 characters",
        },
        { status: 400 },
      );
    }

    /*
     * Prevent unnecessary duplicate pending requests.
     *
     * An employee should normally have one active
     * assistance request at a time for the same task.
     */
    const existingRequest =
      await prisma.taskAssistanceRequest.findFirst({
        where: {
          taskId: task.id,
          requestedById: user.id,
          status: "PENDING",
        },
        select: {
          id: true,
        },
      });

    if (existingRequest) {
      return NextResponse.json(
        {
          error:
            "You already have a pending assistance request for this task",
        },
        { status: 409 },
      );
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const assistanceRequest =
          await tx.taskAssistanceRequest.create({
            data: {
              taskId: task.id,
              requestedById: user.id,
              reason,
              status: "PENDING",
            },
            select: {
              id: true,
              taskId: true,
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
          });

        await tx.taskActivity.create({
          data: {
            taskId: task.id,
            userId: user.id,
            action: "TASK_ASSISTANCE_REQUESTED",
            description: `Requested assistance for task "${task.title}"`,
            metadata: {
              assistanceRequestId:
                assistanceRequest.id,
            },
          },
        });

        return assistanceRequest;
      },
    );

    await createAuditLog({
      firmId: user.firmId,
      userId: user.id,
      action: "UPDATE",
      entityType: "TASK_ASSISTANCE_REQUEST",
      entityId: result.id,
      description: `Requested assistance for task "${task.title}"`,
      metadata: {
        taskId: task.id,
        assignedToId: task.assignedToId,
        delegatedById: task.delegatedById,
        delegatedOnBehalfOfId:
          task.delegatedOnBehalfOfId,
      },
      request,
    });

    /*
     * Notify the relevant person or people.
     *
     * Priority is given to the Director/Managing Partner
     * represented by the task. The physical delegator and
     * original creator are also notified where applicable.
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
          title: "Assistance requested",
          message: `Assistance has been requested for the task "${task.title}".`,
        });
      } catch (notificationError) {
        /*
         * Notification failure must never invalidate
         * the assistance request.
         */
        console.error(
          "Task assistance notification failed:",
          notificationError,
        );
      }
    }

    return NextResponse.json(
      {
        success: true,
        message:
          "Assistance request submitted successfully",
        assistanceRequest: result,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(
      "POST /api/tasks/[id]/assistance error:",
      error,
    );

    return NextResponse.json(
      { error: "Failed to request assistance" },
      { status: 500 },
    );
  }
}