"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;

  matter: {
    id: string;
    referenceNumber: string;
    title: string;
  } | null;

  assignedTo: {
    id: string;
    name: string | null;
    email: string | null;
    role: string;
  } | null;

  createdBy: {
    id: string;
    name: string | null;
    email: string | null;
    role: string;
  };
};

type TasksListProps = {
  canCreateTask: boolean;
};

function statusLabel(status: string) {
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
      return status;
  }
}

function priorityLabel(priority: string) {
  return priority;
}

function formatDate(date: string | null) {
  if (!date) {
    return "No due date";
  }

  return new Date(date).toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function TasksList({
  canCreateTask,
}: TasksListProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadTasks() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/tasks");

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to load tasks."
        );
      }

      setTasks(data.tasks || []);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to load tasks."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTasks();
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

          <div>
            <p className="text-sm font-medium text-slate-500">
              Task Management
            </p>

            <h1 className="mt-1 text-3xl font-bold text-slate-900">
              Tasks
            </h1>

            <p className="mt-2 text-slate-600">
              Manage tasks and deadlines across your firm's matters.
            </p>
          </div>

          {canCreateTask && (
            <Link
              href="/dashboard/tasks/new"
              className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-5 py-3 font-medium text-white transition hover:bg-slate-800"
            >
              + Create Task
            </Link>
          )}

        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Content */}
        <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">

          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-lg font-semibold text-slate-900">
              All Tasks
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {tasks.length}{" "}
              {tasks.length === 1 ? "task" : "tasks"} in your firm.
            </p>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Loading tasks...
            </div>
          ) : tasks.length === 0 ? (
            <div className="p-12 text-center">

              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-2xl">
                ✓
              </div>

              <h3 className="mt-4 font-semibold text-slate-900">
                No tasks yet
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                {canCreateTask
                  ? "Create your first task to start managing work."
                  : "No tasks have been created for your firm yet."}
              </p>

              {canCreateTask && (
                <Link
                  href="/dashboard/tasks/new"
                  className="mt-6 inline-flex rounded-lg bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Create your first task
                </Link>
              )}

            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="min-w-full divide-y divide-slate-200">

                <thead className="bg-slate-50">
                  <tr>

                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Task
                    </th>

                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Matter
                    </th>

                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Assigned To
                    </th>

                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Priority
                    </th>

                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Due
                    </th>

                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </th>

                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Action
                    </th>

                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 bg-white">

                  {tasks.map((task) => (
                    <tr
                      key={task.id}
                      className="transition hover:bg-slate-50"
                    >

                      <td className="px-6 py-5">
                        <div>
                          <Link
                            href={`/dashboard/tasks/${task.id}`}
                            className="font-semibold text-slate-900 hover:text-blue-600"
                          >
                            {task.title}
                          </Link>

                          {task.description && (
                            <p className="mt-1 max-w-sm truncate text-sm text-slate-500">
                              {task.description}
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-5">
                        {task.matter ? (
                          <Link
                            href={`/dashboard/matters/${task.matter.id}`}
                            className="text-sm font-medium text-slate-900 hover:text-blue-600"
                          >
                            <div>
                              {task.matter.referenceNumber}
                            </div>

                            <div className="mt-1 text-xs text-slate-500">
                              {task.matter.title}
                            </div>
                          </Link>
                        ) : (
                          <span className="text-sm text-slate-400">
                            No matter
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-5">
                        {task.assignedTo ? (
                          <div>
                            <p className="text-sm font-medium text-slate-900">
                              {task.assignedTo.name ||
                                task.assignedTo.email ||
                                "User"}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              {task.assignedTo.role}
                            </p>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">
                            Unassigned
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-5">
                        <span className="text-sm font-medium text-slate-700">
                          {priorityLabel(task.priority)}
                        </span>
                      </td>

                      <td className="px-6 py-5">
                        <span className="text-sm text-slate-600">
                          {formatDate(task.dueDate)}
                        </span>
                      </td>

                      <td className="px-6 py-5">
                        <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {statusLabel(task.status)}
                        </span>
                      </td>

                      <td className="px-6 py-5 text-right">
                        <Link
                          href={`/dashboard/tasks/${task.id}`}
                          className="text-sm font-semibold text-blue-600 hover:text-blue-800"
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

      </div>
    </main>
  );
}