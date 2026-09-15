import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { requirePermission } from "@/lib/permissions-server";
import {
  canSubmitTaskReport,
  getActiveTaskUser,
} from "@/lib/task-authorization";

const ALLOWED_OUTCOMES = [
  "COMPLETED",
  "PARTIALLY_COMPLETED",
  "UNABLE_TO_COMPLETE",
  "AWAITING_RESPONSE",
] as const;

type TaskReportOutcome =
  (typeof ALLOWED_OUTCOMES)[number];

type RouteContext = {
  params: Promise<{ id: string }>;
};

function isValidOutcome(
  value: unknown,
): value is TaskReportOutcome {
  return (
    typeof value === "string" &&
    ALLOWED_OUTCOMES.includes(
      value as TaskReportOutcome,
    )
  );
}

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

    const authorization = await canSubmitTaskReport({
      taskId: id,
      userId: user.id,
      firmId: user.firmId,
    });

    if (!authorization.allowed) {
      return NextResponse.json(
        {
          error:
            authorization.reason ??
            "You are not authorized to submit a report for this task",
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
        requiresReport: true,
      },
    });

    if (!task) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 },
      );
    }

    if (!task.requiresReport) {
      return NextResponse.json(
        {
          error:
            "This task does not require a formal report",
        },
        { status: 400 },
      );
    }

    if (task.status === "CANCELLED") {
      return NextResponse.json(
        {
          error:
            "A report cannot be submitted for a cancelled task",
        },
        { status: 400 },
      );
    }

    const body = await request.json();

    const outcome = body.outcome;
    const report =
      typeof body.report === "string"
        ? body.report.trim()
        : "";
    const nextAction =
      typeof body.nextAction === "string"
        ? body.nextAction.trim()
        : "";

    if (!isValidOutcome(outcome)) {
      return NextResponse.json(
        {
          error:
            "Invalid report outcome. Expected COMPLETED, PARTIALLY_COMPLETED, UNABLE_TO_COMPLETE, or AWAITING_RESPONSE.",
        },
        { status: 400 },
      );
    }

    if (!report) {
      return NextResponse.json(
        { error: "Report content is required" },
        { status: 400 },
      );
    }

    if (report.length > 20000) {
      return NextResponse.json(
        {
          error:
            "Report content must not exceed 20,000 characters",
        },
        { status: 400 },
      );
    }

    if (nextAction.length > 10000) {
      return NextResponse.json(
        {
          error:
            "Next action must not exceed 10,000 characters",
        },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(
      async (tx) => {
        /*
         * A new report replaces the task's current
         * pending report state. Previous reports remain
         * permanently stored in TaskReport.
         */
        const taskReport = await tx.taskReport.create({
          data: {
            taskId: task.id,
            submittedById: user.id,
            outcome,
            report,
            nextAction:
              nextAction.length > 0
                ? nextAction
                : null,
          },
          select: {
            id: true,
            taskId: true,
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
          },
        });

        /*
         * Submitting a report does NOT automatically
         * complete the task.
         *
         * The Director/authorised reviewer must review
         * the report first.
         */
        await tx.task.update({
          where: {
            id: task.id,
          },
          data: {
            reportSubmittedAt:
              taskReport.submittedAt,
            reportReviewedAt: null,
            reportOutcome: outcome,
            status:
              task.status === "TODO"
                ? "IN_PROGRESS"
                : task.status,
          },
        });

        await tx.taskActivity.create({
          data: {
            taskId: task.id,
            userId: user.id,
            action: "TASK_REPORT_SUBMITTED",
            description: `Submitted a report for task "${task.title}"`,
            metadata: {
              reportId: taskReport.id,
              outcome,
              nextAction:
                nextAction.length > 0
                  ? nextAction
                  : null,
            },
          },
        });

        return taskReport;
      },
    );

    await createAuditLog({
      firmId: user.firmId,
      userId: user.id,
      action: "UPDATE",
      entityType: "TASK_REPORT",
      entityId: result.id,
      description: `Submitted a report for task "${task.title}"`,
      metadata: {
        taskId: task.id,
        outcome,
        assignedToId: task.assignedToId,
        delegatedById: task.delegatedById,
        delegatedOnBehalfOfId:
          task.delegatedOnBehalfOfId,
      },
      request,
    });

    /*
     * Notify the person who should review the report.
     *
     * Priority:
     * 1. Director/Managing Partner represented by the task
     * 2. Physical delegator
     * 3. Original task creator
     *
     * Duplicate recipients are prevented by the Set.
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
          title: "Task report submitted",
          message: `A report has been submitted for "${task.title}" and is awaiting review.`,
        });
      } catch (notificationError) {
        /*
         * Notification failure must never invalidate
         * a successfully submitted report.
         */
        console.error(
          "Task report notification failed:",
          notificationError,
        );
      }
    }

    return NextResponse.json(
      {
        success: true,
        message:
          "Task report submitted successfully",
        report: result,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(
      "POST /api/tasks/[id]/report error:",
      error,
    );

    return NextResponse.json(
      { error: "Failed to submit task report" },
      { status: 500 },
    );
  }
}