"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  avatarUrl: string | null;
  lastLoginAt: string | null;
  createdAt: string;
};

type UsersListProps = {
  canCreateUser: boolean;
  canUpdateUser: boolean;
  canDeactivateUser: boolean;
};

function formatRole(role: string) {
  return role
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(date: string | null) {
  if (!date) return "Never";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return parsed.toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function getStatusClasses(status: string) {
  switch (status) {
    case "ACTIVE":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";

    case "INACTIVE":
      return "bg-slate-100 text-slate-600 ring-1 ring-slate-200";

    case "SUSPENDED":
      return "bg-red-50 text-red-700 ring-1 ring-red-200";

    default:
      return "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
  }
}

function getRoleClasses(role: string) {
  switch (role) {
    case "MANAGING_PARTNER":
      return "bg-purple-50 text-purple-700 ring-1 ring-purple-200";

    case "PARTNER":
      return "bg-violet-50 text-violet-700 ring-1 ring-violet-200";

    case "DIRECTOR":
      return "bg-fuchsia-50 text-fuchsia-700 ring-1 ring-fuchsia-200";

    case "ATTORNEY":
      return "bg-blue-50 text-blue-700 ring-1 ring-blue-200";

    case "CANDIDATE_ATTORNEY":
      return "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200";

    case "PARALEGAL":
      return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";

    case "LEGAL_SECRETARY":
      return "bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200";

    case "ADMIN":
      return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";

    default:
      return "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
  }
}

export default function UsersList({
  canCreateUser,
  canUpdateUser,
  canDeactivateUser,
}: UsersListProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [roleFilter, setRoleFilter] = useState("ALL");

  const [actionLoading, setActionLoading] = useState<string | null>(
    null
  );

  async function loadUsers() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/users", {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      });

      const contentType = response.headers.get("content-type");

      if (!contentType?.includes("application/json")) {
        const text = await response.text();

        console.error("Unexpected users response:", text);

        throw new Error(
          "The server returned an unexpected response."
        );
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to load users."
        );
      }

      setUsers(data.users || []);
    } catch (err) {
      console.error("LOAD USERS ERROR:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load users."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function changeUserStatus(
    user: User,
    newStatus: "ACTIVE" | "INACTIVE"
  ) {
    if (!canDeactivateUser) {
      return;
    }

    const action =
      newStatus === "ACTIVE"
        ? "reactivate"
        : "deactivate";

    const confirmed = window.confirm(
      `Are you sure you want to ${action} ${user.name}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setActionLoading(user.id);
      setError("");

      const response = await fetch(
        `/api/users/${user.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            status: newStatus,
          }),
        }
      );

      const contentType =
        response.headers.get("content-type");

      if (!contentType?.includes("application/json")) {
        throw new Error(
          "The server returned an unexpected response."
        );
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            `Failed to ${action} user.`
        );
      }

      setUsers((currentUsers) =>
        currentUsers.map((currentUser) =>
          currentUser.id === user.id
            ? {
                ...currentUser,
                status: newStatus,
              }
            : currentUser
        )
      );
    } catch (err) {
      console.error(
        "CHANGE USER STATUS ERROR:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : `Failed to ${action} user.`
      );
    } finally {
      setActionLoading(null);
    }
  }

  const filteredUsers = useMemo(() => {
    const normalizedSearch =
      search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        !normalizedSearch ||
        user.name
          .toLowerCase()
          .includes(normalizedSearch) ||
        user.email
          .toLowerCase()
          .includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "ALL" ||
        user.status === statusFilter;

      const matchesRole =
        roleFilter === "ALL" ||
        user.role === roleFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesRole
      );
    });
  }, [
    users,
    search,
    statusFilter,
    roleFilter,
  ]);

  const activeUsers = users.filter(
    (user) => user.status === "ACTIVE"
  ).length;

  const administrators = users.filter((user) =>
    [
      "ADMIN",
      "MANAGING_PARTNER",
      "PARTNER",
      "DIRECTOR",
      "SUPER_ADMIN",
    ].includes(user.role)
  ).length;

  const inactiveUsers = users.filter(
    (user) => user.status === "INACTIVE"
  ).length;

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl">

        {/* HEADER */}

        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Administration
            </p>

            <h1 className="mt-2 text-3xl font-bold text-slate-900">
              User Management
            </h1>

            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Manage attorneys, administrators and staff
              members who have access to your firm.
            </p>
          </div>

          {canCreateUser && (
            <Link
              href="/dashboard/users/new"
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              + Add User
            </Link>
          )}
        </div>

        {/* ERROR */}

        {error && (
          <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>{error}</span>

            <button
              type="button"
              onClick={() => setError("")}
              className="font-semibold hover:text-red-900"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* SUMMARY */}

        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Active Users
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              {loading ? "—" : activeUsers}
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Users currently active in the firm
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Administrators
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              {loading ? "—" : administrators}
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Users with administrative responsibilities
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Inactive Users
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              {loading ? "—" : inactiveUsers}
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Accounts that cannot currently access the firm
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Task Assignment
            </p>

            <p className="mt-2 text-3xl font-bold text-emerald-600">
              Ready
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Active users can be assigned to tasks
            </p>
          </div>

        </div>

        {/* FILTERS */}

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <div className="grid gap-4 md:grid-cols-3">

            {/* SEARCH */}

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Search
              </label>

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search name or email..."
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
              />
            </div>

            {/* STATUS */}

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Status
              </label>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
              >
                <option value="ALL">
                  All statuses
                </option>

                <option value="ACTIVE">
                  Active
                </option>

                <option value="INACTIVE">
                  Inactive
                </option>

                <option value="SUSPENDED">
                  Suspended
                </option>
              </select>
            </div>

            {/* ROLE */}

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Role
              </label>

              <select
                value={roleFilter}
                onChange={(event) =>
                  setRoleFilter(event.target.value)
                }
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
              >
                <option value="ALL">
                  All roles
                </option>

                <option value="MANAGING_PARTNER">
                  Managing Partner
                </option>

                <option value="PARTNER">
                  Partner
                </option>

                <option value="DIRECTOR">
                  Director
                </option>

                <option value="ATTORNEY">
                  Attorney
                </option>

                <option value="CANDIDATE_ATTORNEY">
                  Candidate Attorney
                </option>

                <option value="PARALEGAL">
                  Paralegal
                </option>

                <option value="LEGAL_SECRETARY">
                  Legal Secretary
                </option>

                <option value="ADMIN">
                  Administrator
                </option>
              </select>
            </div>

          </div>

          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">

            <p className="text-sm text-slate-500">
              Showing{" "}
              <span className="font-semibold text-slate-900">
                {filteredUsers.length}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-slate-900">
                {users.length}
              </span>{" "}
              users
            </p>

            {(search ||
              statusFilter !== "ALL" ||
              roleFilter !== "ALL") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("ALL");
                  setRoleFilter("ALL");
                }}
                className="text-sm font-semibold text-slate-700 hover:text-slate-950"
              >
                Clear filters
              </button>
            )}

          </div>

        </section>

        {/* USERS */}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-lg font-semibold text-slate-900">
              Firm Users
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Users with access to this LegalVault firm.
            </p>
          </div>

          {loading ? (
            <div className="p-10 text-center">
              <p className="text-sm text-slate-500">
                Loading users...
              </p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-10 text-center">

              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-xl">
                👤
              </div>

              <h3 className="mt-4 text-lg font-semibold text-slate-900">
                No users found
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                {users.length === 0
                  ? canCreateUser
                    ? "Add your first attorney or staff member to start assigning tasks and managing access."
                    : "No users have been created for your firm yet."
                  : "Try changing your search or filters."}
              </p>

              {users.length === 0 && canCreateUser && (
                <Link
                  href="/dashboard/users/new"
                  className="mt-5 inline-flex rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  + Add User
                </Link>
              )}

            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="min-w-full">

                <thead className="bg-slate-50">
                  <tr>

                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      User
                    </th>

                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Role
                    </th>

                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </th>

                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Last Login
                    </th>

                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Action
                    </th>

                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">

                  {filteredUsers.map((user) => (

                    <tr
                      key={user.id}
                      className="transition hover:bg-slate-50"
                    >

                      {/* USER */}

                      <td className="px-6 py-5">

                        <Link
                          href={`/dashboard/users/${user.id}`}
                          className="flex items-center gap-3"
                        >

                          {user.avatarUrl ? (
                            <img
                              src={user.avatarUrl}
                              alt={user.name}
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                              {getInitials(user.name)}
                            </div>
                          )}

                          <div>
                            <p className="font-semibold text-slate-900 hover:underline">
                              {user.name}
                            </p>

                            <p className="mt-1 text-sm text-slate-500">
                              {user.email}
                            </p>
                          </div>

                        </Link>

                      </td>

                      {/* ROLE */}

                      <td className="px-6 py-5">

                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getRoleClasses(
                            user.role
                          )}`}
                        >
                          {formatRole(user.role)}
                        </span>

                      </td>

                      {/* STATUS */}

                      <td className="px-6 py-5">

                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(
                            user.status
                          )}`}
                        >
                          {formatRole(user.status)}
                        </span>

                      </td>

                      {/* LAST LOGIN */}

                      <td className="px-6 py-5 text-sm text-slate-600">
                        {formatDate(user.lastLoginAt)}
                      </td>

                      {/* ACTION */}

                      <td className="px-6 py-5">

                        <div className="flex items-center justify-end gap-3">

                          <Link
                            href={`/dashboard/users/${user.id}`}
                            className="text-sm font-semibold text-slate-700 hover:text-slate-950"
                          >
                            View →
                          </Link>

                          {canUpdateUser && (
                            <Link
                              href={`/dashboard/users/${user.id}/edit`}
                              className="text-sm font-semibold text-blue-700 hover:text-blue-900"
                            >
                              Edit
                            </Link>
                          )}

                          {canDeactivateUser &&
                            (user.status === "ACTIVE" ? (
                              <button
                                type="button"
                                disabled={
                                  actionLoading === user.id
                                }
                                onClick={() =>
                                  changeUserStatus(
                                    user,
                                    "INACTIVE"
                                  )
                                }
                                className="text-sm font-semibold text-red-600 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {actionLoading === user.id
                                  ? "..."
                                  : "Deactivate"}
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={
                                  actionLoading === user.id
                                }
                                onClick={() =>
                                  changeUserStatus(
                                    user,
                                    "ACTIVE"
                                  )
                                }
                                className="text-sm font-semibold text-emerald-700 hover:text-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {actionLoading === user.id
                                  ? "..."
                                  : "Reactivate"}
                              </button>
                            ))}

                        </div>

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