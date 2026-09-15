import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { requirePermission } from "@/lib/permissions-server";
import {
  canRespondToTaskAssistance,
  getActiveTaskUser,
} from "@/lib/task-authorization";

type RouteContext = {
  params: Promise<{
    id: string;
    requestId: string;
  }>;
};

const VALID_STATUSES = [
  "RESPONDED",
  "RESOLVED",
] as const;

type AssistanceResponseStatus =
  (typeof VALID_STATUSES)[number];

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

    const { id, requestId } = await context.params;

    if (!id || !requestId) {
      return NextResponse.json(
        {
          error:
            "Task ID and assistance request ID are required",
        },
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
      await canRespondToTaskAssistance({
        taskId: id,
        userId: user.id,
        firmId: user.firmId,
      });

    if (!authorization.allowed) {
      return NextResponse.json(
        {
          error:
            authorization.reason ??
            "You are not authorized to respond to this assistance request",
        },
        { status: 403 },
      );
    }

    const assistanceRequest =
      await prisma.taskAssistanceRequest.findFirst({
        where: {
          id: requestId,
          taskId: id,
          task: {
            firmId: user.firmId,
          },
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
          task: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
          requestedBy: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
        },
      });

    if (!assistanceRequest) {
      return NextResponse.json(
        { error: "Assistance request not found" },
        { status: 404 },
      );
    }

    if (assistanceRequest.status !== "PENDING") {
      return NextResponse.json(
        {
          error:
            "This assistance request has already been responded to",
        },
        { status: 409 },
      );
    }

    if (assistanceRequest.task.status === "CANCELLED") {
      return NextResponse.json(
        {
          error:
            "You cannot respond to an assistance request for a cancelled task",
        },
        { status: 400 },
      );
    }

    const body = await request.json();

    const response =
      typeof body.response === "string"
        ? body.response.trim()
        : "";

    if (!response) {
      return NextResponse.json(
        { error: "A response is required" },
        { status: 400 },
      );
    }

    if (response.length > 10000) {
      return NextResponse.json(
        {
          error:
            "The response must not exceed 10,000 characters",
        },
        { status: 400 },
      );
    }

    const requestedStatus =
      typeof body.status === "string"
        ? body.status.toUpperCase()
        : "RESPONDED";

    if (
      !VALID_STATUSES.includes(
        requestedStatus as AssistanceResponseStatus,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Status must be either RESPONDED or RESOLVED",
        },
        { status: 400 },
      );
    }

    const status =
      requestedStatus as AssistanceResponseStatus;

    const respondedAt = new Date();

    const result = await prisma.$transaction(
      async (tx) => {
        const updatedRequest =
          await tx.taskAssistanceRequest.update({
            where: {
              id: assistanceRequest.id,
            },
            data: {
              response,
              status,
              respondedAt,
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
            },
          });

        await tx.taskActivity.create({
          data: {
            taskId: assistanceRequest.taskId,
            userId: user.id,
            action:
              status === "RESOLVED"
                ? "TASK_ASSISTANCE_RESOLVED"
                : "TASK_ASSISTANCE_RESPONDED",
            description:
              status === "RESOLVED"
                ? `Resolved an assistance request for task "${assistanceRequest.task.title}"`
                : `Responded to an assistance request for task "${assistanceRequest.task.title}"`,
            metadata: {
              assistanceRequestId:
                assistanceRequest.id,
              requestedById:
                assistanceRequest.requestedById,
              status,
            },
          },
        });

        return updatedRequest;
      },
    );

    await createAuditLog({
      firmId: user.firmId,
      userId: user.id,
      action: "UPDATE",
      entityType: "TASK_ASSISTANCE_REQUEST",
      entityId: result.id,
      description:
        status === "RESOLVED"
          ? `Resolved assistance request for task "${assistanceRequest.task.title}"`
          : `Responded to assistance request for task "${assistanceRequest.task.title}"`,
      metadata: {
        taskId: assistanceRequest.taskId,
        requestedById:
          assistanceRequest.requestedById,
        status,
      },
      request,
    });

    /*
     * Notify the employee who requested assistance.
     *
     * Notification failures are intentionally non-blocking.
     */
    if (assistanceRequest.requestedById !== user.id) {
      try {
        await createNotification({
          firmId: user.firmId,
          userId: assistanceRequest.requestedById,
          type: "TASK",
          title:
            status === "RESOLVED"
              ? "Assistance request resolved"
              : "Assistance request answered",
          message:
            status === "RESOLVED"
              ? `Your assistance request for "${assistanceRequest.task.title}" has been resolved.`
              : `A response has been provided to your assistance request for "${assistanceRequest.task.title}".`,
        });
      } catch (notificationError) {
        console.error(
          "Task assistance response notification failed:",
          notificationError,
        );
      }
    }

    return NextResponse.json(
      {
        success: true,
        message:
          status === "RESOLVED"
            ? "Assistance request resolved successfully"
            : "Assistance request responded to successfully",
        assistanceRequest: result,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(
      "PATCH /api/tasks/[id]/assistance/[requestId] error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Failed to respond to assistance request",
      },
      { status: 500 },
    );
  }
}