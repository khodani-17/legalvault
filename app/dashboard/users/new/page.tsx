"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const roles = [
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
    value: "LEGAL_SECRETARY",
    label: "Legal Secretary",
  },
  {
    value: "PARALEGAL",
    label: "Paralegal",
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

export default function NewUserPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");
  const [role, setRole] =
    useState("LEGAL_SECRETARY");
  const [status, setStatus] =
    useState("ACTIVE");

  const [showPassword, setShowPassword] =
    useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");

    if (!name.trim()) {
      setError("Full name is required.");
      return;
    }

    if (!email.trim()) {
      setError("Email address is required.");
      return;
    }

    if (!email.includes("@")) {
      setError(
        "Please provide a valid email address."
      );
      return;
    }

    if (password.length < 8) {
      setError(
        "Password must be at least 8 characters."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError(
        "Password confirmation does not match."
      );
      return;
    }

    try {
      setSaving(true);

      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          role,
          status,
        }),
      });

      const contentType =
        response.headers.get("content-type");

      let data: {
        error?: string;
        user?: {
          id: string;
        };
      } = {};

      if (contentType?.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();

        console.error(
          "Unexpected server response:",
          text
        );

        throw new Error(
          "The server returned an unexpected response."
        );
      }

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to create user."
        );
      }

      router.push("/dashboard/users");
      router.refresh();
    } catch (err) {
      console.error("CREATE USER ERROR:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to create user."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-3xl">

        {/* BACK */}

        <div className="mb-6">
          <Link
            href="/dashboard/users"
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            ← Back to Users
          </Link>
        </div>

        {/* HEADER */}

        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Administration
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Add User
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Create a new user account for your firm.
          </p>
        </div>

        {/* ERROR */}

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-6"
        >

          {/* ACCOUNT */}

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

            <h2 className="text-lg font-semibold text-slate-900">
              Account Information
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Enter the user's basic account details.
            </p>

            <div className="mt-6 space-y-5">

              {/* NAME */}

              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-slate-700"
                >
                  Full Name
                </label>

                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  placeholder="e.g. Jane Doe"
                  autoComplete="name"
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </div>

              {/* EMAIL */}

              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-slate-700"
                >
                  Email Address
                </label>

                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="name@lawfirm.co.za"
                  autoComplete="email"
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </div>

              {/* PASSWORD */}

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-slate-700"
                >
                  Temporary Password
                </label>

                <div className="relative mt-2">

                  <input
                    id="password"
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
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-24 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        (value) => !value
                      )
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500 hover:text-slate-900"
                  >
                    {showPassword
                      ? "Hide"
                      : "Show"}
                  </button>

                </div>

                <p className="mt-2 text-xs text-slate-400">
                  The password is securely hashed before
                  it is stored.
                </p>
              </div>

              {/* CONFIRM PASSWORD */}

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-slate-700"
                >
                  Confirm Password
                </label>

                <input
                  id="confirmPassword"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(
                      event.target.value
                    )
                  }
                  placeholder="Repeat the password"
                  autoComplete="new-password"
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </div>

            </div>
          </section>

          {/* ACCESS */}

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

            <h2 className="text-lg font-semibold text-slate-900">
              Access & Permissions
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Define the user's role and account status.
            </p>

            <div className="mt-6 grid gap-5 md:grid-cols-2">

              {/* ROLE */}

              <div>
                <label
                  htmlFor="role"
                  className="block text-sm font-medium text-slate-700"
                >
                  Role
                </label>

                <select
                  id="role"
                  value={role}
                  onChange={(event) =>
                    setRole(event.target.value)
                  }
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                >
                  {roles.map((item) => (
                    <option
                      key={item.value}
                      value={item.value}
                    >
                      {item.label}
                    </option>
                  ))}
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
                <label
                  htmlFor="status"
                  className="block text-sm font-medium text-slate-700"
                >
                  Status
                </label>

                <select
                  id="status"
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value)
                  }
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                >
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

            </div>
          </section>

          {/* ACTIONS */}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">

            <Link
              href="/dashboard/users"
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-center text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving
                ? "Creating User..."
                : "Create User"}
            </button>

          </div>

        </form>
      </div>
    </main>
  );
}