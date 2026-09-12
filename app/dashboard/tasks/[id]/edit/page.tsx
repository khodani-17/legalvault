"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

type Matter = {
  id: string;
  referenceNumber: string;
  title: string;
};

type User = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  status?: string;
};

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  matter: Matter | null;
  assignedTo: User | null;
};

export default function EditTaskPage() {
  const params = useParams();
  const router = useRouter();

  const id = String(params.id);

  const [task, setTask] = useState<Task | null>(null);
  const [matters, setMatters] = useState<Matter[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [form, setForm] = useState({
    title: "",
    description: "",
    matterId: "",
    assignedToId: "",
    status: "TODO",
    priority: "MEDIUM",
    dueDate: "",
  });

  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // ==========================================================
  // LOAD TASK, MATTERS AND USERS
  // ==========================================================

  useEffect(() => {
    async function loadData() {
      try {
        setLoadingData(true);
        setError("");

        const [taskResponse, mattersResponse, usersResponse] =
          await Promise.all([
            fetch(`/api/tasks/${id}`),
            fetch("/api/matters"),
            fetch("/api/users"),
          ]);

        // ------------------------------------------------------
        // TASK
        // ------------------------------------------------------

        const taskContentType =
          taskResponse.headers.get("content-type");

        if (
          !taskResponse.ok ||
          !taskContentType?.includes("application/json")
        ) {
          throw new Error("Failed to load task.");
        }

        const taskData = await taskResponse.json();

        if (!taskData.task) {
          throw new Error("Task not found.");
        }

        const loadedTask: Task = taskData.task;

        setTask(loadedTask);

        // ------------------------------------------------------
        // POPULATE FORM
        // ------------------------------------------------------

        setForm({
          title: loadedTask.title || "",

          description:
            loadedTask.description || "",

          matterId:
            loadedTask.matter?.id || "",

          assignedToId:
            loadedTask.assignedTo?.id || "",

          status:
            loadedTask.status || "TODO",

          priority:
            loadedTask.priority || "MEDIUM",

          dueDate: loadedTask.dueDate
            ? formatDateForInput(
                loadedTask.dueDate
              )
            : "",
        });

        // ------------------------------------------------------
        // MATTERS
        // ------------------------------------------------------

        if (mattersResponse.ok) {
          const mattersContentType =
            mattersResponse.headers.get(
              "content-type"
            );

          if (
            mattersContentType?.includes(
              "application/json"
            )
          ) {
            const mattersData =
              await mattersResponse.json();

            setMatters(
              mattersData.matters || []
            );
          }
        }

        // ------------------------------------------------------
        // USERS
        // ------------------------------------------------------

        if (usersResponse.ok) {
          const usersContentType =
            usersResponse.headers.get(
              "content-type"
            );

          if (
            usersContentType?.includes(
              "application/json"
            )
          ) {
            const usersData =
              await usersResponse.json();

            const loadedUsers: User[] =
              usersData.users || [];

            setUsers(loadedUsers);
          }
        } else {
          const usersContentType =
            usersResponse.headers.get(
              "content-type"
            );

          if (
            usersContentType?.includes(
              "application/json"
            )
          ) {
            const usersData =
              await usersResponse.json();

            throw new Error(
              usersData.error ||
                "Failed to load users."
            );
          }

          throw new Error(
            "Failed to load users."
          );
        }
      } catch (error) {
        console.error(
          "EDIT TASK LOAD ERROR:",
          error
        );

        setError(
          error instanceof Error
            ? error.message
            : "Failed to load task."
        );
      } finally {
        setLoadingData(false);
      }
    }

    loadData();
  }, [id]);

  // ==========================================================
  // DATE FORMATTER
  // ==========================================================

  function formatDateForInput(
    value: string
  ) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toISOString().split("T")[0];
  }

  // ==========================================================
  // FORM UPDATE
  // ==========================================================

  function updateField(
    field: keyof typeof form,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  // ==========================================================
  // SUBMIT
  // ==========================================================

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");

    // --------------------------------------------------------
    // VALIDATION
    // --------------------------------------------------------

    if (!form.title.trim()) {
      setError(
        "Task title is required."
      );
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(
        `/api/tasks/${id}`,
        {
          method: "PATCH",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            title:
              form.title.trim(),

            description:
              form.description.trim() ||
              null,

            matterId:
              form.matterId || null,

            assignedToId:
              form.assignedToId || null,

            status:
              form.status,

            priority:
              form.priority,

            dueDate:
              form.dueDate || null,
          }),
        }
      );

      const contentType =
        response.headers.get(
          "content-type"
        );

      let data: {
        success?: boolean;
        task?: Task;
        error?: string;
      } = {};

      if (
        contentType?.includes(
          "application/json"
        )
      ) {
        data = await response.json();
      } else {
        const text =
          await response.text();

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
          data.error ||
            "Failed to update task."
        );
      }

      // ------------------------------------------------------
      // SUCCESS
      // ------------------------------------------------------

      router.push(
        `/dashboard/tasks/${id}`
      );

      router.refresh();
    } catch (error) {
      console.error(
        "UPDATE TASK ERROR:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Failed to update task."
      );
    } finally {
      setSaving(false);
    }
  }

  // ==========================================================
  // LOADING
  // ==========================================================

  if (loadingData) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-4xl">

          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">

            <div className="animate-pulse">

              <div className="h-4 w-32 rounded bg-slate-200" />

              <div className="mt-4 h-8 w-56 rounded bg-slate-200" />

              <div className="mt-8 h-40 rounded bg-slate-100" />

            </div>

            <p className="mt-6 text-sm text-slate-500">
              Loading task...
            </p>

          </div>

        </div>
      </main>
    );
  }

  // ==========================================================
  // TASK NOT FOUND
  // ==========================================================

  if (!task) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-4xl">

          <div className="rounded-2xl border border-red-200 bg-white p-8 shadow-sm">

            <h1 className="text-xl font-semibold text-slate-900">
              Task not found
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              {error ||
                "The requested task could not be found."}
            </p>

            <Link
              href="/dashboard/tasks"
              className="mt-6 inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Back to Tasks
            </Link>

          </div>

        </div>
      </main>
    );
  }

  // ==========================================================
  // PAGE
  // ==========================================================

  return (
    <main className="min-h-screen bg-slate-50 p-6">

      <div className="mx-auto max-w-4xl">

        {/* ====================================================
            BACK
        ==================================================== */}

        <div className="mb-6">

          <Link
            href={`/dashboard/tasks/${id}`}
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            ← Back to Task
          </Link>

        </div>

        {/* ====================================================
            HEADER
        ==================================================== */}

        <div className="mb-8">

          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Task Management
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Edit Task
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Update the task details, deadline,
            assignment and workflow status.
          </p>

        </div>

        {/* ====================================================
            ERROR
        ==================================================== */}

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ====================================================
            FORM
        ==================================================== */}

        <form
          onSubmit={handleSubmit}
          className="space-y-6"
        >

          {/* ==================================================
              TASK DETAILS
          ================================================== */}

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

            <h2 className="text-lg font-semibold text-slate-900">
              Task Details
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Update the basic information for
              this task.
            </p>

            <div className="mt-6 space-y-5">

              {/* TITLE */}

              <div>

                <label
                  htmlFor="task-title"
                  className="block text-sm font-medium text-slate-700"
                >
                  Task Title *
                </label>

                <input
                  id="task-title"
                  type="text"
                  required
                  value={form.title}
                  onChange={(event) =>
                    updateField(
                      "title",
                      event.target.value
                    )
                  }
                  placeholder="Enter task title"
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />

              </div>

              {/* DESCRIPTION */}

              <div>

                <label
                  htmlFor="task-description"
                  className="block text-sm font-medium text-slate-700"
                >
                  Description
                </label>

                <textarea
                  id="task-description"
                  value={form.description}
                  onChange={(event) =>
                    updateField(
                      "description",
                      event.target.value
                    )
                  }
                  rows={5}
                  placeholder="Describe what needs to be done..."
                  className="mt-2 w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />

              </div>

            </div>

          </section>

          {/* ==================================================
              MATTER
          ================================================== */}

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

            <h2 className="text-lg font-semibold text-slate-900">
              Matter
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Associate this task with a legal
              matter.
            </p>

            <div className="mt-6">

              <label
                htmlFor="task-matter"
                className="block text-sm font-medium text-slate-700"
              >
                Matter
              </label>

              <select
                id="task-matter"
                value={form.matterId}
                onChange={(event) =>
                  updateField(
                    "matterId",
                    event.target.value
                  )
                }
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              >

                <option value="">
                  No matter / General task
                </option>

                {matters.map(
                  (matter) => (
                    <option
                      key={matter.id}
                      value={matter.id}
                    >
                      {matter.referenceNumber}
                      {" — "}
                      {matter.title}
                    </option>
                  )
                )}

              </select>

              <p className="mt-2 text-xs text-slate-500">
                Select the matter this task
                belongs to, or leave blank for
                a general firm task.
              </p>

            </div>

          </section>

          {/* ==================================================
              WORKFLOW
          ================================================== */}

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

            <h2 className="text-lg font-semibold text-slate-900">
              Workflow
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Control the task status, priority,
              deadline and assignment.
            </p>

            <div className="mt-6 grid gap-5 md:grid-cols-2">

              {/* STATUS */}

              <div>

                <label
                  htmlFor="task-status"
                  className="block text-sm font-medium text-slate-700"
                >
                  Status
                </label>

                <select
                  id="task-status"
                  value={form.status}
                  onChange={(event) =>
                    updateField(
                      "status",
                      event.target.value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                >

                  <option value="TODO">
                    To Do
                  </option>

                  <option value="IN_PROGRESS">
                    In Progress
                  </option>

                  <option value="COMPLETED">
                    Completed
                  </option>

                  <option value="CANCELLED">
                    Cancelled
                  </option>

                </select>

              </div>

              {/* PRIORITY */}

              <div>

                <label
                  htmlFor="task-priority"
                  className="block text-sm font-medium text-slate-700"
                >
                  Priority
                </label>

                <select
                  id="task-priority"
                  value={form.priority}
                  onChange={(event) =>
                    updateField(
                      "priority",
                      event.target.value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                >

                  <option value="LOW">
                    Low
                  </option>

                  <option value="MEDIUM">
                    Medium
                  </option>

                  <option value="HIGH">
                    High
                  </option>

                  <option value="URGENT">
                    Urgent
                  </option>

                </select>

              </div>

              {/* DUE DATE */}

              <div>

                <label
                  htmlFor="task-due-date"
                  className="block text-sm font-medium text-slate-700"
                >
                  Due Date
                </label>

                <input
                  id="task-due-date"
                  type="date"
                  value={form.dueDate}
                  onChange={(event) =>
                    updateField(
                      "dueDate",
                      event.target.value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />

              </div>

              {/* ASSIGNED USER */}

              <div>

                <label
                  htmlFor="task-assigned-to"
                  className="block text-sm font-medium text-slate-700"
                >
                  Assigned To
                </label>

                <select
                  id="task-assigned-to"
                  value={form.assignedToId}
                  onChange={(event) =>
                    updateField(
                      "assignedToId",
                      event.target.value
                    )
                  }
                  disabled={
                    loadingData
                  }
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                >

                  <option value="">
                    Unassigned
                  </option>

                  {users.map(
                    (user) => (
                      <option
                        key={user.id}
                        value={user.id}
                      >
                        {user.name ||
                          user.email}
                        {" — "}
                        {formatRole(
                          user.role
                        )}
                      </option>
                    )
                  )}

                </select>

                <p className="mt-2 text-xs text-slate-500">
                  Active users in your firm can
                  be assigned to this task.
                </p>

                {users.length === 0 && (
                  <p className="mt-2 text-xs text-amber-600">
                    No active users are available
                    for assignment.
                  </p>
                )}

              </div>

            </div>

          </section>

          {/* ==================================================
              CURRENT ASSIGNMENT
          ================================================== */}

          {task.assignedTo && (
            <section className="rounded-2xl border border-blue-100 bg-blue-50 p-6">

              <h2 className="text-sm font-semibold text-slate-900">
                Current Assignment
              </h2>

              <div className="mt-3">

                <p className="font-medium text-slate-900">
                  {task.assignedTo.name ||
                    task.assignedTo.email}
                </p>

                <p className="mt-1 text-sm text-slate-600">
                  {task.assignedTo.email}
                </p>

                <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                  {formatRole(
                    task.assignedTo.role
                  )}
                </p>

              </div>

            </section>
          )}

          {/* ==================================================
              ACTIONS
          ================================================== */}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">

            <Link
              href={`/dashboard/tasks/${id}`}
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-center text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving
                ? "Saving..."
                : "Save Changes"}
            </button>

          </div>

        </form>

      </div>

    </main>
  );
}

// ============================================================
// ROLE DISPLAY
// ============================================================

function formatRole(
  role: string
) {
  return role
    .toLowerCase()
    .split("_")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1)
    )
    .join(" ");
}