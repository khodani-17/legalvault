import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";

type TaskPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function formatDate(date: Date | null) {
  if (!date) return "Not set";

  return new Intl.DateTimeFormat("en-ZA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

function formatPriority(priority: string) {
  return priority.replaceAll("_", " ");
}

function statusClasses(status: string) {
  switch (status) {
    case "DONE":
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

  if (!session?.user?.id || !session.user.firmId) {
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

  const { id } = await params;

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
    },
  });

  if (!task) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl">

        <div className="mb-6">
          <Link
            href="/dashboard/tasks"
            className="text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            ← Back to Tasks
          </Link>
        </div>

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
                  {task.matter.referenceNumber} —{" "}
                  {task.matter.title}
                </Link>
              )}
            </div>

            <div className="flex gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${statusClasses(
                  task.status
                )}`}
              >
                {formatStatus(task.status)}
              </span>

              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${priorityClasses(
                  task.priority
                )}`}
              >
                {formatPriority(task.priority)}
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">

          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 lg:col-span-2">

            <h2 className="text-lg font-semibold text-slate-900">
              Task Details
            </h2>

            <div className="mt-6 space-y-6">

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Task Title
                </p>

                <p className="mt-1 text-base font-medium text-slate-900">
                  {task.title}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Description
                </p>

                {task.description ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {task.description}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">
                    No description provided.
                  </p>
                )}
              </div>

              <div className="grid gap-6 sm:grid-cols-2">

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </p>

                  <span
                    className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-semibold uppercase ${statusClasses(
                      task.status
                    )}`}
                  >
                    {formatStatus(task.status)}
                  </span>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Priority
                  </p>

                  <span
                    className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-semibold uppercase ${priorityClasses(
                      task.priority
                    )}`}
                  >
                    {formatPriority(task.priority)}
                  </span>
                </div>

              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Due Date
                </p>

                <p className="mt-1 text-sm text-slate-900">
                  {formatDate(task.dueDate)}
                </p>
              </div>

            </div>

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

          </section>

          <aside className="space-y-6">

            <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">

              <h2 className="text-lg font-semibold text-slate-900">
                Assignment
              </h2>

              <div className="mt-5">

                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Assigned To
                </p>

                {task.assignedTo ? (
                  <div className="mt-2">
                    <p className="font-medium text-slate-900">
                      {task.assignedTo.name || "Unnamed user"}
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

            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">

              <h2 className="text-lg font-semibold text-slate-900">
                Created By
              </h2>

              <div className="mt-5">
                <p className="font-medium text-slate-900">
                  {task.createdBy.name || "Unnamed user"}
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  {task.createdBy.email}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  {task.createdBy.role}
                </p>
              </div>

            </section>

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
                    {formatDate(task.createdAt)}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Last Updated
                  </p>

                  <p className="mt-1 text-sm text-slate-700">
                    {formatDate(task.updatedAt)}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Completed
                  </p>

                  <p className="mt-1 text-sm text-slate-700">
                    {formatDate(task.completedAt)}
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