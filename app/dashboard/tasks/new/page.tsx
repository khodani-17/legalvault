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

type Correspondence = {
  id: string;
  direction: "INCOMING" | "OUTGOING";
  correspondenceDate: string;
  sender: string;
  recipient: string;
  subject: string;
  type: string;
  status: string;
  responseRequired: boolean;
  responseDeadline: string | null;
  notes: string | null;
  client: {
    id: string;
    name: string;
    referenceNumber: string;
  } | null;
  matter: {
    id: string;
    title: string;
    referenceNumber: string | null;
  } | null;
  responsibleUser: {
    id: string;
    name: string | null;
    email: string;
    role: string;
  } | null;
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

function formatDateForInput(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function formatDisplayDate(value: string | null | undefined) {
  if (!value) {
    return "â€”";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "â€”";
  }

  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getCorrespondenceTypeLabel(type: string) {
  return type
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function NewTaskPage() {
  const router = useRouter();

  const [form, setForm] = useState<FormState>(initialForm);
  const [users, setUsers] = useState<User[]>([]);
  const [matters, setMatters] = useState<Matter[]>([]);
  const [correspondence, setCorrespondence] =
    useState<Correspondence | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingCorrespondence, setLoadingCorrespondence] =
    useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError("");

        const correspondenceId =
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get(
                "correspondenceId"
              )
            : null;

        const requests = [
          fetch("/api/users", {
            cache: "no-store",
          }),
          fetch("/api/matters", {
            cache: "no-store",
          }),
        ];

        if (correspondenceId) {
          setLoadingCorrespondence(true);

          requests.push(
            fetch(`/api/correspondence/${correspondenceId}`, {
              cache: "no-store",
            })
          );
        }

        const responses = await Promise.all(requests);

        const usersResponse = responses[0];
        const mattersResponse = responses[1];
        const correspondenceResponse = responses[2];

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

        if (correspondenceResponse) {
          if (!correspondenceResponse.ok) {
            const correspondenceData =
              await correspondenceResponse.json().catch(() => null);

            throw new Error(
              correspondenceData?.error ||
                "Unable to load the correspondence."
            );
          }

          const correspondenceData =
            await correspondenceResponse.json();

          const loadedCorrespondence =
            correspondenceData.correspondence ??
            correspondenceData.data ??
            correspondenceData;

          setCorrespondence(loadedCorrespondence);

          if (loadedCorrespondence) {
            const matter =
              loadedCorrespondence.matter ?? null;

            const correspondenceTitle =
              loadedCorrespondence.subject?.trim()
                ? `Respond to correspondence: ${loadedCorrespondence.subject.trim()}`
                : "Follow up on legal correspondence";

            const correspondenceDescription = [
              "Task created from Legal Correspondence Centre.",
              "",
              `Correspondence type: ${getCorrespondenceTypeLabel(
                loadedCorrespondence.type
              )}`,
              `Direction: ${
                loadedCorrespondence.direction === "INCOMING"
                  ? "Incoming"
                  : "Outgoing"
              }`,
              `Date: ${formatDisplayDate(
                loadedCorrespondence.correspondenceDate
              )}`,
              `From: ${loadedCorrespondence.sender}`,
              `To: ${loadedCorrespondence.recipient}`,
              `Subject: ${loadedCorrespondence.subject}`,
              loadedCorrespondence.client?.name
                ? `Client: ${loadedCorrespondence.client.name}`
                : null,
              matter?.title
                ? `Matter: ${
                    matter.referenceNumber
                      ? `${matter.referenceNumber} â€” ${matter.title}`
                      : matter.title
                  }`
                : null,
              loadedCorrespondence.responseRequired
                ? `Response required: Yes${
                    loadedCorrespondence.responseDeadline
                      ? ` â€” deadline ${formatDisplayDate(
                          loadedCorrespondence.responseDeadline
                        )}`
                      : ""
                  }`
                : "Response required: No",
              loadedCorrespondence.notes?.trim()
                ? `Correspondence notes: ${loadedCorrespondence.notes.trim()}`
                : null,
              "",
              `Correspondence ID: ${loadedCorrespondence.id}`,
            ]
              .filter(Boolean)
              .join("\n");

            setForm((current) => ({
              ...current,
              matterId: matter?.id ?? "",
              title: correspondenceTitle,
              description: correspondenceDescription,
              dueDate: formatDateForInput(
                loadedCorrespondence.responseDeadline
              ),
              assignedToId:
                loadedCorrespondence.responsibleUser?.id ?? "",
              requiresReport:
                loadedCorrespondence.responseRequired === true
                  ? true
                  : current.requiresReport,
            }));
          }
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load the delegation form."
        );
      } finally {
        setLoading(false);
        setLoadingCorrespondence(false);
      }
    }

    loadData();
  }, []);

  const delegationUsers = useMemo(() => {
    return users.filter((user) =>
      onBehalfRoles.includes(user.role)
    );
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

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");

    if (!form.title.trim()) {
      setError("Task title is required.");
      return;
    }

    if (!form.assignedToId) {
      setError(
        "Please select the employee who will receive the task."
      );
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
    <main className="mx-auto max-w-4xl p-6">      <div className="mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Delegate Task
            </h1>

            <p className="mt-2 text-sm text-gray-600">
              Delegate work to an attorney or staff member and track
              the required follow-up.
            </p>
          </div>

          {correspondence && (
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/dashboard/correspondence/${encodeURIComponent(
                    correspondence.id
                  )}`
                )
              }
              className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              disabled={saving}
            >
              ← Back to Correspondence
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loadingCorrespondence && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          Loading correspondence details...
        </div>
      )}

      {correspondence && (
        <section className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                Created from Correspondence
              </p>

              <h2 className="mt-1 text-lg font-semibold text-gray-900">
                {correspondence.subject}
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                The task below has been pre-filled from this
                correspondence. You can still edit the task before
                delegating it.
              </p>
            </div>

            <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-blue-700">
              {correspondence.direction === "INCOMING"
                ? "Incoming"
                : "Outgoing"}
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border bg-white p-4">
              <p className="text-xs font-medium text-gray-500">
                Sender
              </p>
              <p className="mt-1 text-sm font-medium text-gray-900">
                {correspondence.sender}
              </p>
            </div>

            <div className="rounded-lg border bg-white p-4">
              <p className="text-xs font-medium text-gray-500">
                Recipient
              </p>
              <p className="mt-1 text-sm font-medium text-gray-900">
                {correspondence.recipient}
              </p>
            </div>

            <div className="rounded-lg border bg-white p-4">
              <p className="text-xs font-medium text-gray-500">
                Correspondence Date
              </p>
              <p className="mt-1 text-sm font-medium text-gray-900">
                {formatDisplayDate(
                  correspondence.correspondenceDate
                )}
              </p>
            </div>

            <div className="rounded-lg border bg-white p-4">
              <p className="text-xs font-medium text-gray-500">
                Type
              </p>
              <p className="mt-1 text-sm font-medium text-gray-900">
                {getCorrespondenceTypeLabel(
                  correspondence.type
                )}
              </p>
            </div>

            {correspondence.client && (
              <div className="rounded-lg border bg-white p-4">
                <p className="text-xs font-medium text-gray-500">
                  Client
                </p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {correspondence.client.name}
                </p>

                {correspondence.client.referenceNumber && (
                  <p className="mt-1 text-xs text-gray-500">
                    {correspondence.client.referenceNumber}
                  </p>
                )}
              </div>
            )}

            {correspondence.matter && (
              <div className="rounded-lg border bg-white p-4">
                <p className="text-xs font-medium text-gray-500">
                  Matter
                </p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {correspondence.matter.referenceNumber
                    ? `${correspondence.matter.referenceNumber} â€” ${correspondence.matter.title}`
                    : correspondence.matter.title}
                </p>
              </div>
            )}

            <div className="rounded-lg border bg-white p-4">
              <p className="text-xs font-medium text-gray-500">
                Response Required
              </p>
              <p className="mt-1 text-sm font-medium text-gray-900">
                {correspondence.responseRequired
                  ? "Yes"
                  : "No"}
              </p>
            </div>

            {correspondence.responseDeadline && (
              <div className="rounded-lg border bg-white p-4">
                <p className="text-xs font-medium text-gray-500">
                  Response Deadline
                </p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {formatDisplayDate(
                    correspondence.responseDeadline
                  )}
                </p>
              </div>
            )}
          </div>
        </section>
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
                      ? `${matter.referenceNumber} â€” ${matter.title}`
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
                rows={8}
                placeholder="Explain what needs to be done, relevant documents to review, expected outcome, or any special instructions."
                className="w-full rounded-lg border px-3 py-2.5"
              />

              {correspondence && (
                <p className="mt-1 text-xs text-gray-500">
                  The correspondence details have been included
                  automatically. You can add or edit instructions
                  before delegating the task.
                </p>
              )}
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
                    {user.name || user.email} â€” {user.role}
                  </option>
                ))}
              </select>

              <p className="mt-1 text-xs text-gray-500">
                Choose the attorney, candidate attorney,
                secretary, administrator, or other staff member
                responsible for completing the task.
              </p>

              {correspondence?.responsibleUser && (
                <p className="mt-2 rounded-md bg-gray-50 p-2 text-xs text-gray-600">
                  The correspondence currently has{" "}
                  <strong>
                    {correspondence.responsibleUser.name ||
                      correspondence.responsibleUser.email}
                  </strong>{" "}
                  assigned as the responsible employee. You can
                  change the task assignee above if necessary.
                </p>
              )}
            </div>

            {delegationUsers.length > 0 && (
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
                    {user.name || user.email} â€” {user.role}
                  </option>
                ))}
              </select>

              <p className="mt-1 text-xs text-gray-500">
                Legal Administrators and Legal Secretaries can
                delegate on behalf of an authorised Director or
                Managing Partner.
              </p>
            </div>


            )}
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

              {correspondence?.responseDeadline && (
                <p className="mt-1 text-xs text-gray-500">
                  Pre-filled from the correspondence response
                  deadline. You can change it if the task needs
                  an earlier internal deadline.
                </p>
              )}
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

          <p className="mt-1 text-sm text-gray-500">
            Require the assigned employee to report back when the work is complete.
          </p>

          {correspondence?.responseRequired && (
            <span className="mt-3 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              Response required
            </span>
          )}

          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-lg border bg-gray-50 p-4">
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

        {correspondence && (
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-6">
            <h2 className="text-sm font-semibold text-amber-900">
              Correspondence Workflow
            </h2>

            <div className="mt-3 space-y-2 text-sm text-amber-800">
              <p>
                This task is being created from a correspondence
                record.
              </p>

              <p>
                The task will remain a separate task record with
                its own permissions, updates, reports and audit
                history.
              </p>

              <p>
                Linking the task to a matter does not
                automatically grant the assigned employee access
                to that matter.
              </p>

              <p>
                Correspondence ID:{" "}
                <span className="font-mono text-xs">
                  {correspondence.id}
                </span>
              </p>
            </div>
          </section>
        )}

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

            {correspondence && (
              <p>
                5. The task remains connected to the originating
                correspondence through its matter/context
                information and can be tracked separately.
              </p>
            )}
          </div>
        </section>

                <div className="sticky bottom-4 z-10 rounded-xl border bg-white/95 p-3 shadow-lg backdrop-blur">
          <div className="mb-2 text-xs text-gray-500">
            Review the assignee, due date and reporting requirement before delegation.
          </div>

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
            disabled={saving || loadingCorrespondence}
            className="rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Delegating..." : "Delegate Task"}
          </button>
        </div>
        </div>
      </form>
    </main>
  );
}


