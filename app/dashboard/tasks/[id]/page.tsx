import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import {
  canAccessTask,
  canReviewTaskReport,
  canRequestTaskAssistance,
  canRespondToTaskAssistance,
} from "@/lib/task-authorization";

import TaskWorkflow from "./TaskWorkflow";

type TaskPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function formatDate(date: Date | null) {
  if (!date) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-ZA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function formatDateTime(date: Date | null) {
  if (!date) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatStatus(status: string) {
  switch (status) {
    case "TODO":
      return "TO DO";

    case "IN_PROGRESS":
      return "IN PROGRESS";

    case "COMPLETED":
      return "COMPLETED";

    case "CANCELLED":
      return "CANCELLED";

    default:
      return status.replaceAll("_", " ");
  }
}

function formatPriority(priority: string) {
  return priority.replaceAll("_", " ");
}

function statusClasses(status: string) {
  switch (status) {
    case "COMPLETED":
      return "bg-emerald-100 text-emerald-700";

    case "IN_PROGRESS":
      return "bg-blue-100 text-blue-700";

    case "CANCELLED":
      return "bg-red-100 text-red-700";

    default:
      return "bg-amber-100 text-amber-700";
  }
}

function priorityClasses(priority: string) {
  switch (priority) {
    case "URGENT":
      return "bg-red-100 text-red-700";

    case "HIGH":
      return "bg-orange-100 text-orange-700";

    case "LOW":
      return "bg-slate-100 text-slate-600";

    default:
      return "bg-blue-100 text-blue-700";
  }
}

export default async function TaskPage({
  params,
}: TaskPageProps) {
  const session = await auth();

  if (
    !session?.user?.id ||
    !session.user.firmId
  ) {
    redirect("/login");
  }

  const canViewTasks = hasPermission(
    session.user.role,
    "tasks.view"
  );

  if (!canViewTasks) {
    redirect("/dashboard");
  }

  const canUpdateTask = hasPermission(
    session.user.role,
    "tasks.update"
  );

  const canDeleteTask = hasPermission(
    session.user.role,
    "tasks.delete"
  );

  const { id } = await params;

  // =====================================================
  // VERIFY TASK ACCESS
  // =====================================================

  const taskAccess = await canAccessTask({
    taskId: id,
    userId: session.user.id,
    firmId: session.user.firmId,
  });

  if (!taskAccess.allowed) {
    redirect("/dashboard/tasks");
  }

  // =====================================================
  // LOAD TASK
  // =====================================================

  const task = await prisma.task.findFirst({
    where: {
      id,
      firmId: session.user.firmId,
    },

    include: {
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

        include: {
          submittedBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },

          reviewedBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      },

      assistanceRequests: {
        orderBy: {
          createdAt: "desc",
        },

        include: {
          requestedBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      },
    },
  });

  if (!task) {
    notFound();
  }

  // =====================================================
  // LATEST REPORT
  // =====================================================

  const latestReport =
    task.reports[0] || null;

  // =====================================================
  // PERMISSION STATE
  // =====================================================

  const canReviewReport =
    canUpdateTask &&
    (
      await canReviewTaskReport({
        taskId: task.id,
        userId: session.user.id,
        firmId: session.user.firmId,
      })
    ).allowed;

  const canRequestAssistance =
    canUpdateTask &&
    (
      await canRequestTaskAssistance({
        taskId: task.id,
        userId: session.user.id,
        firmId: session.user.firmId,
      })
    ).allowed;

  const canRespondToAssistance =
    canUpdateTask &&
    (
      await canRespondToTaskAssistance({
        taskId: task.id,
        userId: session.user.id,
        firmId: session.user.firmId,
      })
    ).allowed;

  // =====================================================
  // SERIALISE DATA FOR CLIENT COMPONENT
  // =====================================================

  const workflowTask = {
    id: task.id,
    title: task.title,
    status: task.status,
    requiresReport: task.requiresReport,
    reportSubmittedAt:
      task.reportSubmittedAt
        ? task.reportSubmittedAt.toISOString()
        : null,
    reportReviewedAt:
      task.reportReviewedAt
        ? task.reportReviewedAt.toISOString()
        : null,
    reportOutcome:
      task.reportOutcome,
    assignedToId:
      task.assignedToId,
    delegatedById:
      task.delegatedById,
    delegatedOnBehalfOfId:
      task.delegatedOnBehalfOfId,
    latestReport: latestReport
      ? {
          id: latestReport.id,
          outcome:
            latestReport.outcome,
          report:
            latestReport.report,
          nextAction:
            latestReport.nextAction,
          submittedAt:
            latestReport.submittedAt.toISOString(),
          reviewedAt:
            latestReport.reviewedAt
              ? latestReport.reviewedAt.toISOString()
              : null,
          reviewNote:
            latestReport.reviewNote,
          submittedBy: {
            id:
              latestReport
                .submittedBy.id,
            name:
              latestReport
                .submittedBy.name,
            email:
              latestReport
                .submittedBy.email,
            role:
              latestReport
                .submittedBy.role,
          },
          reviewedBy:
            latestReport.reviewedBy
              ? {
                  id:
                    latestReport
                      .reviewedBy.id,
                  name:
                    latestReport
                      .reviewedBy.name,
                  email:
                    latestReport
                      .reviewedBy.email,
                  role:
                    latestReport
                      .reviewedBy.role,
                }
              : null,
        }
      : null,
    assistanceRequests:
      task.assistanceRequests.map(
        (request) => ({
          id: request.id,
          reason: request.reason,
          response: request.response,
          status: request.status,
          createdAt:
            request.createdAt.toISOString(),
          respondedAt:
            request.respondedAt
              ? request.respondedAt.toISOString()
              : null,
          requestedBy: {
            id:
              request.requestedBy.id,
            name:
              request.requestedBy.name,
            email:
              request.requestedBy.email,
            role:
              request.requestedBy.role,
          },
        })
      ),
  };

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl">

        {/* ================================================= */}
        {/* BACK */}
        {/* ================================================= */}

        <div className="mb-6">
          <Link
            href="/dashboard/tasks"
            className="text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            ← Back to My Work
          </Link>
        </div>

        {/* ================================================= */}
        {/* HEADER */}
        {/* ================================================= */}

        <div className="mb-8">
          <p className="text-sm font-medium text-slate-500">
            Task Management
          </p>

          <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                {task.title}
              </h1>

              {task.matter && (
                <Link
                  href={`/dashboard/matters/${task.matter.id}`}
                  className="mt-2 inline-block text-sm font-medium text-blue-600 hover:text-blue-800"
                >
                  {task.matter.referenceNumber}{" "}
                  — {task.matter.title}
                </Link>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${statusClasses(
                  task.status
                )}`}
              >
                {formatStatus(
                  task.status
                )}
              </span>

              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${priorityClasses(
                  task.priority
                )}`}
              >
                {formatPriority(
                  task.priority
                )}
              </span>

              {task.requiresReport && (
                <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
                  Report Required
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ================================================= */}
        {/* MAIN CONTENT */}
        {/* ================================================= */}

        <div className="grid gap-6 lg:grid-cols-3">

          {/* ================================================= */}
          {/* LEFT / MAIN */}
          {/* ================================================= */}

          <div className="space-y-6 lg:col-span-2">

            {/* TASK DETAILS */}

            <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">

              <h2 className="text-lg font-semibold text-slate-900">
                Task Details
              </h2>

              <div className="mt-6 space-y-6">

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Instructions
                  </p>

                  {task.description ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {task.description}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">
                      No instructions were provided.
                    </p>
                  )}
                </div>

                <div className="grid gap-6 sm:grid-cols-2">

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Due Date
                    </p>

                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {formatDate(
                        task.dueDate
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Created
                    </p>

                    <p className="mt-1 text-sm text-slate-700">
                      {formatDate(
                        task.createdAt
                      )}
                    </p>
                  </div>

                </div>

              </div>

              {/* EDIT */}

              {(canUpdateTask ||
                canDeleteTask) && (
                <div className="mt-8 flex flex-wrap gap-3 border-t border-slate-200 pt-6">

                  {canUpdateTask && (
                    <Link
                      href={`/dashboard/tasks/${task.id}/edit`}
                      className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800"
                    >
                      Edit Task
                    </Link>
                  )}

                  {task.matter && (
                    <Link
                      href={`/dashboard/matters/${task.matter.id}`}
                      className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      View Matter
                    </Link>
                  )}

                </div>
              )}

            </section>

            {/* ================================================= */}
            {/* WORKFLOW */}
            {/* ================================================= */}

            <TaskWorkflow
              task={workflowTask}
              currentUserId={
                session.user.id
              }
              canUpdateTask={
                canUpdateTask
              }
              canReviewReport={
                canReviewReport
              }
              canRequestAssistance={
                canRequestAssistance
              }
              canRespondToAssistance={
                canRespondToAssistance
              }
            />

          </div>

          {/* ================================================= */}
          {/* SIDEBAR */}
          {/* ================================================= */}

          <aside className="space-y-6">

            {/* ASSIGNMENT */}

            <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">

              <h2 className="text-lg font-semibold text-slate-900">
                Assignment
              </h2>

              <div className="mt-5 space-y-5">

                {/* ASSIGNED TO */}

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Assigned To
                  </p>

                  {task.assignedTo ? (
                    <div className="mt-2">
                      <p className="font-medium text-slate-900">
                        {task.assignedTo.name ||
                          "Unnamed user"}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {task.assignedTo.email}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        {task.assignedTo.role}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">
                      Unassigned
                    </p>
                  )}
                </div>

                {/* DELEGATED BY */}

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Delegated By
                  </p>

                  {task.delegatedBy ? (
                    <div className="mt-2">
                      <p className="font-medium text-slate-900">
                        {task.delegatedBy.name ||
                          "Unnamed user"}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {task.delegatedBy.email}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        {task.delegatedBy.role}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">
                      Not recorded
                    </p>
                  )}
                </div>

                {/* ON BEHALF OF */}

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    On Behalf Of
                  </p>

                  {task.delegatedOnBehalfOf ? (
                    <div className="mt-2">
                      <p className="font-medium text-slate-900">
                        {task
                          .delegatedOnBehalfOf
                          .name ||
                          "Unnamed user"}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {task
                          .delegatedOnBehalfOf
                          .email}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        {
                          task
                            .delegatedOnBehalfOf
                            .role
                        }
                      </p>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">
                      Delegated directly by the
                      delegating user.
                    </p>
                  )}
                </div>

              </div>
            </section>

            {/* CREATED BY */}

            <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">

              <h2 className="text-lg font-semibold text-slate-900">
                Created By
              </h2>

              <div className="mt-5">

                <p className="font-medium text-slate-900">
                  {task.createdBy.name ||
                    "Unnamed user"}
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  {task.createdBy.email}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  {task.createdBy.role}
                </p>

              </div>
            </section>

            {/* DATES */}

            <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">

              <h2 className="text-lg font-semibold text-slate-900">
                Dates
              </h2>

              <div className="mt-5 space-y-4">

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Created
                  </p>

                  <p className="mt-1 text-sm text-slate-700">
                    {formatDateTime(
                      task.createdAt
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Last Updated
                  </p>

                  <p className="mt-1 text-sm text-slate-700">
                    {formatDateTime(
                      task.updatedAt
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Completed
                  </p>

                  <p className="mt-1 text-sm text-slate-700">
                    {formatDateTime(
                      task.completedAt
                    )}
                  </p>
                </div>

              </div>

            </section>

          </aside>
        </div>
      </div>
    </main>
  );
}