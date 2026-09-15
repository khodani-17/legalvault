"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type User = {
  id: string;
  name: string | null;
  email: string;
  role: string;
};

type Matter = {
  id: string;
  title: string;
  referenceNumber: string | null;
};

type FormState = {
  matterId: string;
  title: string;
  description: string;
  assignedToId: string;
  dueDate: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  delegatedOnBehalfOfId: string;
  requiresReport: boolean;
};

const initialForm: FormState = {
  matterId: "",
  title: "",
  description: "",
  assignedToId: "",
  dueDate: "",
  priority: "MEDIUM",
  delegatedOnBehalfOfId: "",
  requiresReport: false,
};

const onBehalfRoles = ["DIRECTOR", "MANAGING_PARTNER"];

export default function NewTaskPage() {
  const router = useRouter();

  const [form, setForm] = useState<FormState>(initialForm);
  const [users, setUsers] = useState<User[]>([]);
  const [matters, setMatters] = useState<Matter[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError("");

        const [usersResponse, mattersResponse] = await Promise.all([
          fetch("/api/users", {
            cache: "no-store",
          }),
          fetch("/api/matters", {
            cache: "no-store",
          }),
        ]);

        if (!usersResponse.ok) {
          throw new Error("Unable to load firm users.");
        }

        if (!mattersResponse.ok) {
          throw new Error("Unable to load matters.");
        }

        const usersData = await usersResponse.json();
        const mattersData = await mattersResponse.json();

        setUsers(usersData.users ?? []);
        setMatters(mattersData.matters ?? []);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load the delegation form."
        );
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const delegationUsers = useMemo(() => {
    return users.filter((user) => onBehalfRoles.includes(user.role));
  }, [users]);

  function updateField<K extends keyof FormState>(
    field: K,
    value: FormState[K]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");

    if (!form.title.trim()) {
      setError("Task title is required.");
      return;
    }

    if (!form.assignedToId) {
      setError("Please select the employee who will receive the task.");
      return;
    }

    try {
      setSaving(true);

      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          matterId: form.matterId || null,
          title: form.title.trim(),
          description: form.description.trim() || null,
          priority: form.priority,
          assignedToId: form.assignedToId,
          dueDate: form.dueDate || null,
          delegatedOnBehalfOfId:
            form.delegatedOnBehalfOfId || null,
          requiresReport: form.requiresReport,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Unable to delegate the task."
        );
      }

      router.push(`/dashboard/tasks/${data.task.id}`);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delegate the task."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          Loading delegation form...
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          Delegate Task
        </h1>

        <p className="mt-2 text-sm text-gray-600">
          Delegate work to an attorney or staff member and track
          the required follow-up.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-6"
      >
        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">
            Task Details
          </h2>

          <div className="mt-5 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Matter
              </label>

              <select
                value={form.matterId}
                onChange={(event) =>
                  updateField("matterId", event.target.value)
                }
                className="w-full rounded-lg border px-3 py-2.5"
              >
                <option value="">
                  No matter / General task
                </option>

                {matters.map((matter) => (
                  <option
                    key={matter.id}
                    value={matter.id}
                  >
                    {matter.referenceNumber
                      ? `${matter.referenceNumber} — ${matter.title}`
                      : matter.title}
                  </option>
                ))}
              </select>

              <p className="mt-1 text-xs text-gray-500">
                Select the matter this task belongs to, or leave
                blank for a general firm task.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Task Title *
              </label>

              <input
                type="text"
                value={form.title}
                onChange={(event) =>
                  updateField("title", event.target.value)
                }
                placeholder="e.g. Prepare case file for attorney review"
                required
                className="w-full rounded-lg border px-3 py-2.5"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Instructions
              </label>

              <textarea
                value={form.description}
                onChange={(event) =>
                  updateField(
                    "description",
                    event.target.value
                  )
                }
                rows={6}
                placeholder="Explain what needs to be done, relevant documents to review, expected outcome, or any special instructions."
                className="w-full rounded-lg border px-3 py-2.5"
              />
            </div>
          </div>
        </section>

        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">
            Assignment
          </h2>

          <div className="mt-5 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Assign To *
              </label>

              <select
                value={form.assignedToId}
                onChange={(event) =>
                  updateField(
                    "assignedToId",
                    event.target.value
                  )
                }
                required
                className="w-full rounded-lg border px-3 py-2.5"
              >
                <option value="">
                  Select employee
                </option>

                {users.map((user) => (
                  <option
                    key={user.id}
                    value={user.id}
                  >
                    {user.name || user.email} — {user.role}
                  </option>
                ))}
              </select>

              <p className="mt-1 text-xs text-gray-500">
                Choose the attorney, candidate attorney,
                secretary, administrator, or other staff member
                responsible for completing the task.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Delegating on behalf of
              </label>

              <select
                value={form.delegatedOnBehalfOfId}
                onChange={(event) =>
                  updateField(
                    "delegatedOnBehalfOfId",
                    event.target.value
                  )
                }
                className="w-full rounded-lg border px-3 py-2.5"
              >
                <option value="">
                  Myself
                </option>

                {delegationUsers.map((user) => (
                  <option
                    key={user.id}
                    value={user.id}
                  >
                    {user.name || user.email} — {user.role}
                  </option>
                ))}
              </select>

              <p className="mt-1 text-xs text-gray-500">
                Legal Administrators and Legal Secretaries can
                delegate on behalf of an authorised Director or
                Managing Partner.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">
            Deadline & Priority
          </h2>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Due Date
              </label>

              <input
                type="date"
                value={form.dueDate}
                onChange={(event) =>
                  updateField("dueDate", event.target.value)
                }
                className="w-full rounded-lg border px-3 py-2.5"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Priority
              </label>

              <select
                value={form.priority}
                onChange={(event) =>
                  updateField(
                    "priority",
                    event.target.value as FormState["priority"]
                  )
                }
                className="w-full rounded-lg border px-3 py-2.5"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
          </div>
        </section>

        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">
            Reporting
          </h2>

          <label className="mt-5 flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={form.requiresReport}
              onChange={(event) =>
                updateField(
                  "requiresReport",
                  event.target.checked
                )
              }
              className="mt-1 h-4 w-4"
            />

            <span>
              <span className="block text-sm font-medium">
                Employee must report back
              </span>

              <span className="mt-1 block text-xs text-gray-500">
                The assigned employee will be required to
                submit a report before the task can be reviewed
                by the delegating authority.
              </span>
            </span>
          </label>
        </section>

        <section className="rounded-xl border bg-gray-50 p-6">
          <h2 className="text-sm font-semibold">
            How task delegation works
          </h2>

          <div className="mt-3 space-y-2 text-sm text-gray-600">
            <p>
              1. Delegate the task to an employee.
            </p>
            <p>
              2. The employee completes the work and can add
              updates or request assistance.
            </p>
            <p>
              3. If reporting is required, the employee submits
              a report back.
            </p>
            <p>
              4. The Director or Managing Partner reviews the
              report and accepts it or sends it back.
            </p>
          </div>
        </section>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push("/dashboard/tasks")}
            className="rounded-lg border px-5 py-2.5 text-sm font-medium"
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Delegating..." : "Delegate Task"}
          </button>
        </div>
      </form>
    </main>
  );
}