"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

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
};

const roles = [
  {
    value: "SUPER_ADMIN",
    label: "Super Administrator",
  },
  {
    value: "MANAGING_PARTNER",
    label: "Managing Partner",
  },
  {
    value: "PARTNER",
    label: "Partner",
  },
  {
    value: "DIRECTOR",
    label: "Director",
  },
  {
    value: "ATTORNEY",
    label: "Attorney",
  },
  {
    value: "CANDIDATE_ATTORNEY",
    label: "Candidate Attorney",
  },
  {
    value: "PARALEGAL",
    label: "Paralegal",
  },
  {
    value: "LEGAL_SECRETARY",
    label: "Legal Secretary",
  },
  {
    value: "ADMIN",
    label: "Administrator",
  },
  {
    value: "FINANCE",
    label: "Finance",
  },
];

const statuses = [
  {
    value: "ACTIVE",
    label: "Active",
  },
  {
    value: "INACTIVE",
    label: "Inactive",
  },
  {
    value: "SUSPENDED",
    label: "Suspended",
  },
];

function formatRole(role: string) {
  return role
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(date: string | null) {
  if (!date) {
    return "Never";
  }

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

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();

  const id =
    typeof params.id === "string"
      ? params.id
      : "";

  const [user, setUser] =
    useState<User | null>(null);

  const [name, setName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [role, setRole] =
    useState("");

  const [status, setStatus] =
    useState("");

  const [avatarUrl, setAvatarUrl] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [deleting, setDeleting] =
    useState(false);

  const [showPassword, setShowPassword] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  // ============================================================
  // LOAD USER
  // ============================================================

  useEffect(() => {
    if (!id) {
      setError("User ID is missing.");
      setLoading(false);
      return;
    }

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
          response.headers.get(
            "content-type"
          );

        if (
          !contentType?.includes(
            "application/json"
          )
        ) {
          throw new Error(
            "The server returned an unexpected response."
          );
        }

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Failed to load user."
          );
        }

        const loadedUser =
          data.user as User;

        setUser(loadedUser);

        setName(
          loadedUser.name || ""
        );

        setEmail(
          loadedUser.email || ""
        );

        setRole(
          loadedUser.role || ""
        );

        setStatus(
          loadedUser.status || ""
        );

        setAvatarUrl(
          loadedUser.avatarUrl || ""
        );
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

    loadUser();
  }, [id]);

  // ============================================================
  // UPDATE USER
  // ============================================================

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!name.trim()) {
      setError(
        "Full name is required."
      );
      return;
    }

    if (!email.trim()) {
      setError(
        "Email address is required."
      );
      return;
    }

    if (!email.includes("@")) {
      setError(
        "Please provide a valid email address."
      );
      return;
    }

    if (!role) {
      setError(
        "Please select a role."
      );
      return;
    }

    if (!status) {
      setError(
        "Please select a status."
      );
      return;
    }

    if (
      password &&
      password.length < 8
    ) {
      setError(
        "Password must be at least 8 characters."
      );
      return;
    }

    if (
      password !== confirmPassword
    ) {
      setError(
        "Password confirmation does not match."
      );
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(
        `/api/users/${id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
            Accept:
              "application/json",
          },
          body: JSON.stringify({
            name: name.trim(),

            email:
              email.trim().toLowerCase(),

            password:
              password || undefined,

            role,

            status,

            avatarUrl:
              avatarUrl.trim() ||
              null,
          }),
        }
      );

      const contentType =
        response.headers.get(
          "content-type"
        );

      let data: {
        error?: string;
        user?: User;
      } = {};

      if (
        contentType?.includes(
          "application/json"
        )
      ) {
        data = await response.json();
      } else {
        throw new Error(
          "The server returned an unexpected response."
        );
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to update user."
        );
      }

      if (data.user) {
        setUser(data.user);

        setName(
          data.user.name || ""
        );

        setEmail(
          data.user.email || ""
        );

        setRole(
          data.user.role || ""
        );

        setStatus(
          data.user.status || ""
        );

        setAvatarUrl(
          data.user.avatarUrl || ""
        );
      }

      setPassword("");
      setConfirmPassword("");

      setSuccess(
        "User details have been updated successfully."
      );

      setTimeout(() => {
        router.push(
          `/dashboard/users/${id}`
        );

        router.refresh();
      }, 800);
    } catch (err) {
      console.error(
        "UPDATE USER ERROR:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to update user."
      );
    } finally {
      setSaving(false);
    }
  }

  // ============================================================
  // DEACTIVATE USER
  // ============================================================

  async function handleDeactivate() {
    if (!user) {
      return;
    }

    const confirmed =
      window.confirm(
        `Are you sure you want to deactivate ${user.name}?`
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeleting(true);
      setError("");
      setSuccess("");

      const response = await fetch(
        `/api/users/${id}`,
        {
          method: "DELETE",
          headers: {
            Accept:
              "application/json",
          },
        }
      );

      const contentType =
        response.headers.get(
          "content-type"
        );

      let data: {
        error?: string;
      } = {};

      if (
        contentType?.includes(
          "application/json"
        )
      ) {
        data = await response.json();
      } else {
        throw new Error(
          "The server returned an unexpected response."
        );
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to deactivate user."
        );
      }

      router.push(
        "/dashboard/users"
      );

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
      setDeleting(false);
    }
  }

  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <p className="text-sm text-slate-500">
              Loading user...
            </p>
          </div>
        </div>
      </main>
    );
  }

  // ============================================================
  // ERROR / USER NOT FOUND
  // ============================================================

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-4xl">

          <Link
            href="/dashboard/users"
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            ← Back to Users
          </Link>

          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6">
            <h1 className="text-lg font-semibold text-red-900">
              Unable to load user
            </h1>

            <p className="mt-2 text-sm text-red-700">
              {error ||
                "The requested user could not be found."}
            </p>
          </div>

        </div>
      </main>
    );
  }

  // ============================================================
  // PAGE
  // ============================================================

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-4xl">

        {/* BACK */}

        <div className="mb-6">
          <Link
            href={`/dashboard/users/${id}`}
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            ← Back to User Profile
          </Link>
        </div>

        {/* HEADER */}

        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Administration
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Edit User
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Update account details, permissions
            and access status.
          </p>
        </div>

        {/* ERROR */}

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* SUCCESS */}

        {success && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        )}

        {/* PROFILE HEADER */}

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">

            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="h-20 w-20 rounded-full object-cover ring-4 ring-slate-100"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-900 text-xl font-bold text-white ring-4 ring-slate-100">
                {getInitials(user.name)}
              </div>
            )}

            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {user.name}
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {user.email}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">

                <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {formatRole(user.role)}
                </span>

                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                    user.status ===
                    "ACTIVE"
                      ? "bg-emerald-50 text-emerald-700"
                      : user.status ===
                        "SUSPENDED"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {formatRole(user.status)}
                </span>

              </div>
            </div>

          </div>

        </section>

        {/* FORM */}

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
        >

          <div className="mb-8">
            <h2 className="text-lg font-semibold text-slate-900">
              Account Details
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Update the user's basic account
              information.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">

            {/* NAME */}

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Full Name *
              </label>

              <input
                type="text"
                value={name}
                onChange={(event) =>
                  setName(
                    event.target.value
                  )
                }
                required
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
            </div>

            {/* EMAIL */}

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Email Address *
              </label>

              <input
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(
                    event.target.value
                  )
                }
                required
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
            </div>

            {/* ROLE */}

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Role *
              </label>

              <select
                value={role}
                onChange={(event) =>
                  setRole(
                    event.target.value
                  )
                }
                required
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              >
                <option value="">
                  Select role
                </option>

                {roles.map(
                  (item) => (
                    <option
                      key={item.value}
                      value={item.value}
                    >
                      {item.label}
                    </option>
                  )
                )}
              </select>

              {role === "FINANCE" && (
                <p className="mt-2 text-xs text-amber-600">
                  Finance users have restricted access
                  to the Finance workspace and financial
                  information.
                </p>
              )}
            </div>

            {/* STATUS */}

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Account Status *
              </label>

              <select
                value={status}
                onChange={(event) =>
                  setStatus(
                    event.target.value
                  )
                }
                required
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              >
                {statuses.map(
                  (item) => (
                    <option
                      key={item.value}
                      value={item.value}
                    >
                      {item.label}
                    </option>
                  )
                )}
              </select>
            </div>

            {/* AVATAR */}

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Profile Image URL
              </label>

              <input
                type="url"
                value={avatarUrl}
                onChange={(event) =>
                  setAvatarUrl(
                    event.target.value
                  )
                }
                placeholder="https://example.com/profile.jpg"
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />

              <p className="mt-1 text-xs text-slate-500">
                Optional. Provide a publicly accessible
                image URL.
              </p>
            </div>

          </div>

          {/* PASSWORD */}

          <div className="mt-10 border-t border-slate-200 pt-8">

            <h2 className="text-lg font-semibold text-slate-900">
              Change Password
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Leave these fields blank if you do not
              want to change the user's password.
            </p>

            <div className="mt-6 grid gap-6 md:grid-cols-2">

              {/* PASSWORD */}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  New Password
                </label>

                <div className="relative">
                  <input
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    value={password}
                    onChange={(event) =>
                      setPassword(
                        event.target.value
                      )
                    }
                    placeholder="Minimum 8 characters"
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 pr-20 outline-none transition focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        (current) =>
                          !current
                      )
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500 hover:text-slate-900"
                  >
                    {showPassword
                      ? "Hide"
                      : "Show"}
                  </button>
                </div>
              </div>

              {/* CONFIRM */}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Confirm New Password
                </label>

                <input
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  value={
                    confirmPassword
                  }
                  onChange={(event) =>
                    setConfirmPassword(
                      event.target.value
                    )
                  }
                  placeholder="Repeat new password"
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

            </div>

          </div>

          {/* ACCOUNT INFORMATION */}

          <div className="mt-10 border-t border-slate-200 pt-8">

            <h2 className="text-lg font-semibold text-slate-900">
              Account Information
            </h2>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Created
                </p>

                <p className="mt-1 text-sm font-medium text-slate-700">
                  {formatDate(
                    user.createdAt
                  )}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Last Login
                </p>

                <p className="mt-1 text-sm font-medium text-slate-700">
                  {formatDate(
                    user.lastLoginAt
                  )}
                </p>
              </div>

            </div>

          </div>

          {/* ACTIONS */}

          <div className="mt-10 flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">

            <button
              type="button"
              onClick={
                handleDeactivate
              }
              disabled={
                deleting ||
                user.status !==
                  "ACTIVE"
              }
              className="rounded-lg border border-red-200 px-5 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {deleting
                ? "Deactivating..."
                : user.status ===
                  "ACTIVE"
                ? "Deactivate User"
                : "User Inactive"}
            </button>

            <div className="flex gap-3">

              <Link
                href={`/dashboard/users/${id}`}
                className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </Link>

              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : "Save Changes"}
              </button>

            </div>

          </div>

        </form>

      </div>
    </main>
  );
}