"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

type Matter = {
  id: string;
  referenceNumber: string;
  title: string;
};

type Task = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  createdAt: string;
  matter: Matter | null;
};

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  avatarUrl: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignedTasks: Task[];
};

type UserProfileProps = {
  canUpdateUser: boolean;
  canDeactivateUser: boolean;
};

function formatRole(role: string) {
  return role
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function formatDate(date: string | null) {
  if (!date) return "Never";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return parsed.toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateTime(date: string | null) {
  if (!date) return "Never";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return parsed.toLocaleString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) =>
      part[0]?.toUpperCase()
    )
    .join("");
}

function formatStatus(status: string) {
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function getTaskStatusClass(status: string) {
  switch (status) {
    case "COMPLETED":
      return "bg-emerald-50 text-emerald-700";

    case "IN_PROGRESS":
      return "bg-blue-50 text-blue-700";

    case "CANCELLED":
      return "bg-red-50 text-red-700";

    default:
      return "bg-slate-100 text-slate-700";
  }
}

function getPriorityClass(priority: string) {
  switch (priority) {
    case "URGENT":
      return "bg-red-50 text-red-700";

    case "HIGH":
      return "bg-orange-50 text-orange-700";

    case "MEDIUM":
      return "bg-blue-50 text-blue-700";

    default:
      return "bg-slate-100 text-slate-600";
  }
}

export default function UserProfilePage({
  canUpdateUser,
  canDeactivateUser,
}: UserProfileProps) {
  const params = useParams();
  const router = useRouter();

  const id = String(params.id);

  const [user, setUser] = useState<User | null>(
    null
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deactivating, setDeactivating] =
    useState(false);

  async function loadUser() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `/api/users/${id}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          cache: "no-store",
        }
      );

      const contentType =
        response.headers.get("content-type");

      if (
        !contentType?.includes(
          "application/json"
        )
      ) {
        const text =
          await response.text();

        console.error(
          "Unexpected user response:",
          text
        );

        throw new Error(
          "The server returned an unexpected response."
        );
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to load user."
        );
      }

      setUser(data.user);
    } catch (err) {
      console.error(
        "LOAD USER ERROR:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load user."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUser();
  }, [id]);

  async function handleDeactivate() {
    if (!user || !canDeactivateUser) return;

    const confirmed =
      window.confirm(
        `Are you sure you want to deactivate ${user.name}? They will no longer be able to access the firm.`
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeactivating(true);
      setError("");

      const response = await fetch(
        `/api/users/${id}`,
        {
          method: "DELETE",
          headers: {
            Accept: "application/json",
          },
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to deactivate user."
        );
      }

      router.push("/dashboard/users");
      router.refresh();
    } catch (err) {
      console.error(
        "DEACTIVATE USER ERROR:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to deactivate user."
      );
    } finally {
      setDeactivating(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-sm text-slate-500">
              Loading user...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl border border-red-200 bg-white p-8">
            <h1 className="text-xl font-semibold text-slate-900">
              User not found
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              {error ||
                "The requested user could not be found."}
            </p>

            <Link
              href="/dashboard/users"
              className="mt-6 inline-flex rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Back to Users
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl">

        {/* BACK */}

        <div className="mb-6">
          <Link
            href="/dashboard/users"
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            ← Back to Users
          </Link>
        </div>

        {/* ERROR */}

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* HEADER */}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">

            <div className="flex items-center gap-4">

              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="h-20 w-20 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-900 text-xl font-bold text-white">
                  {getInitials(user.name)}
                </div>
              )}

              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  User Profile
                </p>

                <h1 className="mt-1 text-3xl font-bold text-slate-900">
                  {user.name}
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                  {user.email}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">

                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {formatRole(user.role)}
                  </span>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      user.status ===
                      "ACTIVE"
                        ? "bg-emerald-50 text-emerald-700"
                        : user.status ===
                            "SUSPENDED"
                          ? "bg-orange-50 text-orange-700"
                          : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {formatStatus(
                      user.status
                    )}
                  </span>

                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">

              {canUpdateUser && (
                <Link
                  href={`/dashboard/users/${id}/edit`}
                  className="rounded-xl bg-slate-900 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Edit User
                </Link>
              )}

              {canDeactivateUser &&
                user.status ===
                  "ACTIVE" && (
                <button
                  type="button"
                  onClick={
                    handleDeactivate
                  }
                  disabled={
                    deactivating
                  }
                  className="rounded-xl border border-red-200 bg-white px-5 py-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deactivating
                    ? "Deactivating..."
                    : "Deactivate"}
                </button>
              )}

            </div>
          </div>
        </section>

        {/* INFORMATION */}

        <div className="mt-6 grid gap-6 lg:grid-cols-3">

          {/* ACCOUNT */}

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-1">

            <h2 className="text-lg font-semibold text-slate-900">
              Account Information
            </h2>

            <div className="mt-6 space-y-5">

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Full Name
                </p>

                <p className="mt-1 text-sm font-medium text-slate-900">
                  {user.name}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Email Address
                </p>

                <p className="mt-1 break-all text-sm font-medium text-slate-900">
                  {user.email}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Role
                </p>

                <p className="mt-1 text-sm font-medium text-slate-900">
                  {formatRole(user.role)}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Status
                </p>

                <p className="mt-1 text-sm font-medium text-slate-900">
                  {formatStatus(
                    user.status
                  )}
                </p>
              </div>

            </div>
          </section>

          {/* ACTIVITY */}

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">

            <h2 className="text-lg font-semibold text-slate-900">
              Account Activity
            </h2>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Last Login
                </p>

                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {formatDateTime(
                    user.lastLoginAt
                  )}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Account Created
                </p>

                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {formatDate(
                    user.createdAt
                  )}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Last Updated
                </p>

                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {formatDateTime(
                    user.updatedAt
                  )}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Assigned Tasks
                </p>

                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {user.assignedTasks
                    ?.length || 0}
                </p>
              </div>

            </div>
          </section>

        </div>

        {/* TASKS */}

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-lg font-semibold text-slate-900">
              Assigned Tasks
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Recent tasks assigned to this user.
            </p>
          </div>

          {!user.assignedTasks ||
          user.assignedTasks.length ===
            0 ? (
            <div className="p-10 text-center">
              <h3 className="text-base font-semibold text-slate-900">
                No assigned tasks
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                This user currently has no tasks assigned to them.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="min-w-full">

                <thead className="bg-slate-50">
                  <tr>

                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Task
                    </th>

                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Matter
                    </th>

                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </th>

                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Priority
                    </th>

                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Due Date
                    </th>

                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">

                  {user.assignedTasks.map(
                    (task) => (
                      <tr
                        key={task.id}
                        className="hover:bg-slate-50"
                      >

                        <td className="px-6 py-5">
                          <Link
                            href={`/dashboard/tasks/${task.id}`}
                            className="text-sm font-semibold text-slate-900 hover:text-blue-700"
                          >
                            {task.title}
                          </Link>
                        </td>

                        <td className="px-6 py-5">
                          {task.matter ? (
                            <Link
                              href={`/dashboard/matters/${task.matter.id}`}
                              className="text-sm text-slate-700 hover:text-blue-700"
                            >
                              {task.matter.referenceNumber}
                            </Link>
                          ) : (
                            <span className="text-sm text-slate-400">
                              General task
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-5">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getTaskStatusClass(
                              task.status
                            )}`}
                          >
                            {formatStatus(
                              task.status
                            )}
                          </span>
                        </td>

                        <td className="px-6 py-5">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getPriorityClass(
                              task.priority
                            )}`}
                          >
                            {formatStatus(
                              task.priority
                            )}
                          </span>
                        </td>

                        <td className="px-6 py-5 text-sm text-slate-600">
                          {formatDate(
                            task.dueDate
                          )}
                        </td>

                      </tr>
                    )
                  )}

                </tbody>

              </table>

            </div>
          )}

        </section>

      </div>
    </main>
  );
}