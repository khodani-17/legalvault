"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;

  matter: {
    id: string;
    title: string;
    referenceNumber: string | null;
  } | null;

  assignedTo: {
    id: string;
    name: string | null;
    email: string;
    role: string;
  } | null;

  createdBy: {
    id: string;
    name: string | null;
    email: string;
    role: string;
  } | null;

  delegatedBy: {
    id: string;
    name: string | null;
    email: string;
    role: string;
  } | null;

  delegatedOnBehalfOf: {
    id: string;
    name: string | null;
    email: string;
    role: string;
  } | null;

  requiresReport: boolean;
  reportSubmittedAt: string | null;
  reportReviewedAt: string | null;

  createdAt: string;
  updatedAt: string;
};

type CurrentUser = {
  id: string;
  role: string;
};

type TasksListProps = {
  canCreateTask: boolean;
};

type Filter =
  | "ALL"
  | "MY_WORK"
  | "DUE_TODAY"
  | "IN_PROGRESS"
  | "REPORT_REQUIRED"
  | "OVERDUE"
  | "DELEGATED_BY_ME"
  | "AWAITING_REPORTS";

function displayName(
  user:
    | {
        name: string | null;
        email: string;
      }
    | null
    | undefined
) {
  if (!user) {
    return "Unassigned";
  }

  return user.name || user.email;
}

function formatDate(date: string | null) {
  if (!date) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

function isDueToday(date: string | null) {
  if (!date) {
    return false;
  }

  const due = new Date(date);
  const today = new Date();

  return (
    due.getFullYear() === today.getFullYear() &&
    due.getMonth() === today.getMonth() &&
    due.getDate() === today.getDate()
  );
}

function isOverdue(task: Task) {
  if (!task.dueDate) {
    return false;
  }

  if (
    task.status === "COMPLETED" ||
    task.status === "CANCELLED"
  ) {
    return false;
  }

  return new Date(task.dueDate).getTime() < Date.now();
}

function priorityLabel(priority: string) {
  return priority.replaceAll("_", " ");
}

function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}

function priorityClass(priority: string) {
  switch (priority) {
    case "URGENT":
      return "bg-red-100 text-red-700";
    case "HIGH":
      return "bg-orange-100 text-orange-700";
    case "MEDIUM":
      return "bg-yellow-100 text-yellow-700";
    case "LOW":
      return "bg-gray-100 text-gray-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function statusClass(status: string) {
  switch (status) {
    case "COMPLETED":
      return "bg-green-100 text-green-700";
    case "IN_PROGRESS":
      return "bg-blue-100 text-blue-700";
    case "CANCELLED":
      return "bg-gray-100 text-gray-600";
    case "TODO":
    case "TO_DO":
      return "bg-gray-100 text-gray-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

export default function TasksList({
  canCreateTask,
}: TasksListProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentUser, setCurrentUser] =
    useState<CurrentUser | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadTasks() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/tasks", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Unable to load tasks."
        );
      }

      setTasks(data.tasks ?? []);
      setCurrentUser(data.currentUser ?? null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load tasks."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTasks();
  }, []);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (!currentUser) {
        return filter === "ALL";
      }

      switch (filter) {
        case "MY_WORK":
          return task.assignedTo?.id === currentUser.id;

        case "DUE_TODAY":
          return (
            task.assignedTo?.id === currentUser.id &&
            isDueToday(task.dueDate)
          );

        case "IN_PROGRESS":
          return (
            task.assignedTo?.id === currentUser.id &&
            task.status === "IN_PROGRESS"
          );

        case "REPORT_REQUIRED":
          return (
            task.assignedTo?.id === currentUser.id &&
            task.requiresReport &&
            !task.reportSubmittedAt
          );

        case "OVERDUE":
          return (
            task.assignedTo?.id === currentUser.id &&
            isOverdue(task)
          );

        case "DELEGATED_BY_ME":
          return task.delegatedBy?.id === currentUser.id;

        case "AWAITING_REPORTS":
          return (
            task.requiresReport &&
            !!task.reportSubmittedAt &&
            !task.reportReviewedAt
          );

        case "ALL":
        default:
          return true;
      }
    });
  }, [tasks, currentUser, filter]);

  const counts = useMemo(() => {
    if (!currentUser) {
      return {
        all: tasks.length,
        myWork: 0,
        dueToday: 0,
        inProgress: 0,
        reportRequired: 0,
        overdue: 0,
        delegatedByMe: 0,
        awaitingReports: 0,
      };
    }

    return {
      all: tasks.length,

      myWork: tasks.filter(
        (task) =>
          task.assignedTo?.id === currentUser.id
      ).length,

      dueToday: tasks.filter(
        (task) =>
          task.assignedTo?.id === currentUser.id &&
          isDueToday(task.dueDate)
      ).length,

      inProgress: tasks.filter(
        (task) =>
          task.assignedTo?.id === currentUser.id &&
          task.status === "IN_PROGRESS"
      ).length,

      reportRequired: tasks.filter(
        (task) =>
          task.assignedTo?.id === currentUser.id &&
          task.requiresReport &&
          !task.reportSubmittedAt
      ).length,

      overdue: tasks.filter(
        (task) =>
          task.assignedTo?.id === currentUser.id &&
          isOverdue(task)
      ).length,

      delegatedByMe: tasks.filter(
        (task) =>
          task.delegatedBy?.id === currentUser.id
      ).length,

      awaitingReports: tasks.filter(
        (task) =>
          task.requiresReport &&
          !!task.reportSubmittedAt &&
          !task.reportReviewedAt
      ).length,
    };
  }, [tasks, currentUser]);

  return (
    <main className="mx-auto max-w-7xl p-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Tasks
          </h1>

          <p className="mt-2 text-sm text-gray-600">
            Manage delegated work and deadlines across your
            firm's matters.
          </p>
        </div>

        {canCreateTask && (
          <Link
            href="/dashboard/tasks/new"
            className="inline-flex items-center justify-center rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white"
          >
            + Delegate Task
          </Link>
        )}
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <button
          onClick={() => setFilter("MY_WORK")}
          className="rounded-xl border bg-white p-5 text-left shadow-sm transition hover:border-gray-400"
        >
          <p className="text-sm text-gray-500">
            My Work
          </p>

          <p className="mt-2 text-2xl font-bold">
            {counts.myWork}
          </p>
        </button>

        <button
          onClick={() => setFilter("DUE_TODAY")}
          className="rounded-xl border bg-white p-5 text-left shadow-sm transition hover:border-gray-400"
        >
          <p className="text-sm text-gray-500">
            Due Today
          </p>

          <p className="mt-2 text-2xl font-bold">
            {counts.dueToday}
          </p>
        </button>

        <button
          onClick={() => setFilter("REPORT_REQUIRED")}
          className="rounded-xl border bg-white p-5 text-left shadow-sm transition hover:border-gray-400"
        >
          <p className="text-sm text-gray-500">
            Report Required
          </p>

          <p className="mt-2 text-2xl font-bold">
            {counts.reportRequired}
          </p>
        </button>

        <button
          onClick={() => setFilter("OVERDUE")}
          className="rounded-xl border bg-white p-5 text-left shadow-sm transition hover:border-gray-400"
        >
          <p className="text-sm text-gray-500">
            Overdue
          </p>

          <p className="mt-2 text-2xl font-bold">
            {counts.overdue}
          </p>
        </button>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("ALL")}
          className={`rounded-lg border px-4 py-2 text-sm ${
            filter === "ALL"
              ? "bg-black text-white"
              : "bg-white"
          }`}
        >
          All ({counts.all})
        </button>

        <button
          onClick={() => setFilter("MY_WORK")}
          className={`rounded-lg border px-4 py-2 text-sm ${
            filter === "MY_WORK"
              ? "bg-black text-white"
              : "bg-white"
          }`}
        >
          My Work ({counts.myWork})
        </button>

        <button
          onClick={() => setFilter("IN_PROGRESS")}
          className={`rounded-lg border px-4 py-2 text-sm ${
            filter === "IN_PROGRESS"
              ? "bg-black text-white"
              : "bg-white"
          }`}
        >
          In Progress ({counts.inProgress})
        </button>

        <button
          onClick={() => setFilter("REPORT_REQUIRED")}
          className={`rounded-lg border px-4 py-2 text-sm ${
            filter === "REPORT_REQUIRED"
              ? "bg-black text-white"
              : "bg-white"
          }`}
        >
          Report Required ({counts.reportRequired})
        </button>

        <button
          onClick={() => setFilter("OVERDUE")}
          className={`rounded-lg border px-4 py-2 text-sm ${
            filter === "OVERDUE"
              ? "bg-black text-white"
              : "bg-white"
          }`}
        >
          Overdue ({counts.overdue})
        </button>

        <button
          onClick={() => setFilter("DELEGATED_BY_ME")}
          className={`rounded-lg border px-4 py-2 text-sm ${
            filter === "DELEGATED_BY_ME"
              ? "bg-black text-white"
              : "bg-white"
          }`}
        >
          Delegated by Me ({counts.delegatedByMe})
        </button>

        <button
          onClick={() => setFilter("AWAITING_REPORTS")}
          className={`rounded-lg border px-4 py-2 text-sm ${
            filter === "AWAITING_REPORTS"
              ? "bg-black text-white"
              : "bg-white"
          }`}
        >
          Awaiting Reports ({counts.awaitingReports})
        </button>
      </div>

      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-semibold">
            {filter === "ALL"
              ? "All Tasks"
              : filter === "MY_WORK"
                ? "My Work"
                : filter === "DUE_TODAY"
                  ? "Due Today"
                  : filter === "IN_PROGRESS"
                    ? "In Progress"
                    : filter === "REPORT_REQUIRED"
                      ? "Reports Required"
                      : filter === "OVERDUE"
                        ? "Overdue Tasks"
                        : filter === "DELEGATED_BY_ME"
                          ? "Delegated by Me"
                          : "Awaiting Reports"}
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            {filteredTasks.length}{" "}
            {filteredTasks.length === 1 ? "task" : "tasks"}
          </p>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">
            Loading tasks...
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="p-10 text-center">
            <h3 className="text-lg font-semibold">
              No tasks found
            </h3>

            <p className="mt-2 text-sm text-gray-500">
              {filter === "ALL"
                ? "Delegate your first task to start managing work."
                : "There are no tasks matching this view."}
            </p>

            {filter === "ALL" && canCreateTask && (
              <Link
                href="/dashboard/tasks/new"
                className="mt-5 inline-flex rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white"
              >
                Delegate your first task
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-6 py-3">
                    Task
                  </th>

                  <th className="px-6 py-3">
                    Matter
                  </th>

                  <th className="px-6 py-3">
                    Assigned To
                  </th>

                  <th className="px-6 py-3">
                    Delegated By
                  </th>

                  <th className="px-6 py-3">
                    On Behalf Of
                  </th>

                  <th className="px-6 py-3">
                    Priority
                  </th>

                  <th className="px-6 py-3">
                    Due
                  </th>

                  <th className="px-6 py-3">
                    Status
                  </th>

                  <th className="px-6 py-3">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredTasks.map((task) => (
                  <tr
                    key={task.id}
                    className="border-b last:border-b-0"
                  >
                    <td className="px-6 py-4 align-top">
                      <Link
                        href={`/dashboard/tasks/${task.id}`}
                        className="font-semibold hover:underline"
                      >
                        {task.title}
                      </Link>

                      {task.description && (
                        <p className="mt-1 max-w-sm text-sm text-gray-500">
                          {task.description}
                        </p>
                      )}
                    </td>

                    <td className="px-6 py-4 align-top text-sm">
                      {task.matter ? (
                        <div>
                          <div className="font-medium">
                            {task.matter.title}
                          </div>

                          {task.matter.referenceNumber && (
                            <div className="text-xs text-gray-500">
                              {task.matter.referenceNumber}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-500">
                          General task
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 align-top text-sm">
                      <div className="font-medium">
                        {displayName(task.assignedTo)}
                      </div>

                      {task.assignedTo && (
                        <div className="text-xs text-gray-500">
                          {task.assignedTo.role}
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-4 align-top text-sm">
                      <div className="font-medium">
                        {displayName(task.delegatedBy)}
                      </div>

                      {task.delegatedBy && (
                        <div className="text-xs text-gray-500">
                          {task.delegatedBy.role}
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-4 align-top text-sm">
                      {task.delegatedOnBehalfOf ? (
                        <div>
                          <div className="font-medium">
                            {displayName(
                              task.delegatedOnBehalfOf
                            )}
                          </div>

                          <div className="text-xs text-gray-500">
                            {task.delegatedOnBehalfOf.role}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-500">
                          —
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 align-top">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${priorityClass(
                          task.priority
                        )}`}
                      >
                        {priorityLabel(task.priority)}
                      </span>
                    </td>

                    <td className="px-6 py-4 align-top text-sm">
                      <span
                        className={
                          isOverdue(task)
                            ? "font-semibold text-red-600"
                            : ""
                        }
                      >
                        {formatDate(task.dueDate)}
                      </span>
                    </td>

                    <td className="px-6 py-4 align-top">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(
                          task.status
                        )}`}
                      >
                        {statusLabel(task.status)}
                      </span>

                      {task.requiresReport && (
                        <div className="mt-1 text-xs text-gray-500">
                          {task.reportReviewedAt
                            ? "Report reviewed"
                            : task.reportSubmittedAt
                              ? "Report submitted"
                              : "Report required"}
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-4 align-top">
                      <Link
                        href={`/dashboard/tasks/${task.id}`}
                        className="text-sm font-semibold hover:underline"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}