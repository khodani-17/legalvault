import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { requirePermission } from "@/lib/permissions-server";
import {
  canReviewTaskReport,
  getActiveTaskUser,
} from "@/lib/task-authorization";

const ALLOWED_DECISIONS = [
  "ACCEPT",
  "SEND_BACK",
] as const;

type ReviewDecision =
  (typeof ALLOWED_DECISIONS)[number];

type RouteContext = {
  params: Promise<{ id: string }>;
};

function isValidDecision(
  value: unknown,
): value is ReviewDecision {
  return (
    typeof value === "string" &&
    ALLOWED_DECISIONS.includes(
      value as ReviewDecision,
    )
  );
}

export async function POST(
  request: Request,
  context: RouteContext,
) {
  const permission = await requirePermission(
    "tasks.update",
  );

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
      await canReviewTaskReport({
        taskId: id,
        userId: user.id,
        firmId: user.firmId,
      });

    if (!authorization.allowed) {
      return NextResponse.json(
        {
          error:
            authorization.reason ??
            "You are not authorized to review this task report",
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
        reportSubmittedAt: true,
        reportReviewedAt: true,
        reportOutcome: true,
        reports: {
          orderBy: {
            submittedAt: "desc",
          },
          take: 1,
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

    if (!task.requiresReport) {
      return NextResponse.json(
        {
          error:
            "This task does not require a formal report",
        },
        { status: 400 },
      );
    }

    const latestReport = task.reports[0];

    if (!latestReport) {
      return NextResponse.json(
        {
          error:
            "There is no report available for review",
        },
        { status: 400 },
      );
    }

    if (latestReport.reviewedAt) {
      return NextResponse.json(
        {
          error:
            "The latest report has already been reviewed",
        },
        { status: 400 },
      );
    }

    const body = await request.json();

    const decision = body.decision;

    const reviewNote =
      typeof body.reviewNote === "string"
        ? body.reviewNote.trim()
        : "";

    if (!isValidDecision(decision)) {
      return NextResponse.json(
        {
          error:
            "Invalid decision. Expected ACCEPT or SEND_BACK.",
        },
        { status: 400 },
      );
    }

    if (reviewNote.length > 10000) {
      return NextResponse.json(
        {
          error:
            "Review note must not exceed 10,000 characters",
        },
        { status: 400 },
      );
    }

    /*
     * A SEND_BACK decision should explain what needs
     * to be corrected or completed.
     */
    if (decision === "SEND_BACK" && !reviewNote) {
      return NextResponse.json(
        {
          error:
            "A review note is required when sending a report back",
        },
        { status: 400 },
      );
    }

    const reviewedAt = new Date();

    const result = await prisma.$transaction(
      async (tx) => {
        const reviewedReport =
          await tx.taskReport.update({
            where: {
              id: latestReport.id,
            },
            data: {
              reviewedAt,
              reviewedById: user.id,
              reviewNote:
                reviewNote.length > 0
                  ? reviewNote
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
              reviewedBy: {
                select: {
                  id: true,
                  name: true,
                  role: true,
                },
              },
            },
          });

        /*
         * ACCEPT:
         *
         * The Director/reviewer has accepted the
         * employee's report, so the task becomes
         * officially completed.
         */
        if (decision === "ACCEPT") {
          await tx.task.update({
            where: {
              id: task.id,
            },
            data: {
              status: "COMPLETED",
              completedAt:
                task.status === "COMPLETED"
                  ? undefined
                  : reviewedAt,
              reportReviewedAt: reviewedAt,
              reportOutcome:
                latestReport.outcome,
            },
          });
        }

        /*
         * SEND_BACK:
         *
         * The report is reviewed but the work is not
         * accepted as complete. The employee can
         * continue working on the task.
         */
        if (decision === "SEND_BACK") {
          await tx.task.update({
            where: {
              id: task.id,
            },
            data: {
              status: "IN_PROGRESS",
              completedAt: null,
              reportReviewedAt: reviewedAt,
              reportOutcome:
                latestReport.outcome,
            },
          });
        }

        await tx.taskActivity.create({
          data: {
            taskId: task.id,
            userId: user.id,
            action:
              decision === "ACCEPT"
                ? "TASK_REPORT_ACCEPTED"
                : "TASK_REPORT_SENT_BACK",
            description:
              decision === "ACCEPT"
                ? `Accepted the report for task "${task.title}"`
                : `Sent the report for task "${task.title}" back to the employee`,
            metadata: {
              reportId: latestReport.id,
              decision,
              reviewNote:
                reviewNote.length > 0
                  ? reviewNote
                  : null,
              submittedById:
                latestReport.submittedById,
              reportOutcome:
                latestReport.outcome,
            },
          },
        });

        return reviewedReport;
      },
    );

    await createAuditLog({
      firmId: user.firmId,
      userId: user.id,
      action: "UPDATE",
      entityType: "TASK_REPORT",
      entityId: result.id,
      description:
        decision === "ACCEPT"
          ? `Accepted the report for task "${task.title}"`
          : `Sent the report for task "${task.title}" back to the employee`,
      metadata: {
        taskId: task.id,
        decision,
        reviewNote:
          reviewNote.length > 0
            ? reviewNote
            : null,
        submittedById:
          latestReport.submittedById,
        reportOutcome:
          latestReport.outcome,
      },
      request,
    });

    /*
     * Notify the employee who submitted the report.
     */
    if (
      latestReport.submittedById !== user.id
    ) {
      try {
        await createNotification({
          firmId: user.firmId,
          userId: latestReport.submittedById,
          type: "TASK",
          title:
            decision === "ACCEPT"
              ? "Task report accepted"
              : "Task report sent back",
          message:
            decision === "ACCEPT"
              ? `Your report for "${task.title}" has been accepted.`
              : `Your report for "${task.title}" has been sent back for further action.`,
        });
      } catch (notificationError) {
        console.error(
          "Task report review notification failed:",
          notificationError,
        );
      }
    }

    /*
     * If the report is accepted, notify the physical
     * delegator when they are different from the reviewer.
     */
    if (
      decision === "ACCEPT" &&
      task.delegatedById &&
      task.delegatedById !== user.id &&
      task.delegatedById !==
        latestReport.submittedById
    ) {
      try {
        await createNotification({
          firmId: user.firmId,
          userId: task.delegatedById,
          type: "TASK",
          title: "Delegated task completed",
          message: `The report for "${task.title}" has been accepted and the task is complete.`,
        });
      } catch (notificationError) {
        console.error(
          "Delegated task completion notification failed:",
          notificationError,
        );
      }
    }

    /*
     * If someone delegated on behalf of a Director,
     * notify the represented Director when the task
     * has been accepted.
     */
    if (
      decision === "ACCEPT" &&
      task.delegatedOnBehalfOfId &&
      task.delegatedOnBehalfOfId !== user.id &&
      task.delegatedOnBehalfOfId !==
        latestReport.submittedById
    ) {
      try {
        await createNotification({
          firmId: user.firmId,
          userId:
            task.delegatedOnBehalfOfId,
          type: "TASK",
          title: "Delegated task completed",
          message: `The report for "${task.title}" has been accepted and the task is complete.`,
        });
      } catch (notificationError) {
        console.error(
          "Director task completion notification failed:",
          notificationError,
        );
      }
    }

    return NextResponse.json({
      success: true,
      message:
        decision === "ACCEPT"
          ? "Task report accepted successfully"
          : "Task report sent back successfully",
      decision,
      report: result,
    });
  } catch (error) {
    console.error(
      "POST /api/tasks/[id]/report/review error:",
      error,
    );

    return NextResponse.json(
      { error: "Failed to review task report" },
      { status: 500 },
    );
  }
}