"use client";

import {
  FormEvent,
  Suspense,
  useEffect,
  useState,
} from "react";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";

type Matter = {
  id: string;
  referenceNumber: string;
  title: string;
};

type User = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
};

function NewTaskForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const preselectedMatterId =
    searchParams.get("matterId") || "";

  const [matters, setMatters] = useState<Matter[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [loadingData, setLoadingData] =
    useState(true);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] = useState("");

  const [form, setForm] = useState({
    matterId: preselectedMatterId,
    title: "",
    description: "",
    status: "TODO",
    priority: "MEDIUM",
    assignedToId: "",
    dueDate: "",
  });

  useEffect(() => {
    async function loadData() {
      try {
        setLoadingData(true);
        setError("");

        const [
          mattersResponse,
          usersResponse,
        ] = await Promise.all([
          fetch("/api/matters"),
          fetch("/api/users"),
        ]);

        const mattersData =
          await mattersResponse.json();

        const usersData =
          await usersResponse.json();

        if (!mattersResponse.ok) {
          throw new Error(
            mattersData.error ||
              "Failed to load matters."
          );
        }

        if (!usersResponse.ok) {
          throw new Error(
            usersData.error ||
              "Failed to load users."
          );
        }

        setMatters(
          mattersData.matters || []
        );

        setUsers(
          usersData.users || []
        );
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Failed to load task data."
        );
      } finally {
        setLoadingData(false);
      }
    }

    loadData();
  }, []);

  function updateField(
    field: keyof typeof form,
    value: string
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
      setError(
        "Task title is required."
      );
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "/api/tasks",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            matterId:
              form.matterId || null,

            title:
              form.title.trim(),

            description:
              form.description.trim() ||
              null,

            status:
              form.status,

            priority:
              form.priority,

            assignedToId:
              form.assignedToId ||
              null,

            dueDate:
              form.dueDate ||
              null,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to create task."
        );
      }

      if (form.matterId) {
        router.push(
          `/dashboard/matters/${form.matterId}`
        );
      } else {
        router.push(
          "/dashboard/tasks"
        );
      }

      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-4xl">

        {/* Header */}

        <div className="mb-8">

          <p className="text-sm font-medium text-slate-500">
            Task Management
          </p>

          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            Create Task
          </h1>

          <p className="mt-2 text-slate-600">
            Create and assign a task to a matter,
            attorney, or staff member.
          </p>

        </div>

        {/* Form */}

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200"
        >

          {/* Error */}

          {error && (
            <div
              role="alert"
              className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2">

            {/* Matter */}

            <div className="md:col-span-2">

              <label
                htmlFor="matterId"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Matter
              </label>

              <select
                id="matterId"
                value={form.matterId}
                onChange={(event) =>
                  updateField(
                    "matterId",
                    event.target.value
                  )
                }
                disabled={loadingData}
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              >

                <option value="">
                  {loadingData
                    ? "Loading matters..."
                    : "No matter / General task"}
                </option>

                {matters.map(
                  (matter) => (
                    <option
                      key={matter.id}
                      value={matter.id}
                    >
                      {
                        matter.referenceNumber
                      }{" "}
                      —{" "}
                      {matter.title}
                    </option>
                  )
                )}

              </select>

              <p className="mt-1 text-xs text-slate-500">
                Select the matter this task
                belongs to, or leave blank for
                a general firm task.
              </p>

            </div>

            {/* Title */}

            <div className="md:col-span-2">

              <label
                htmlFor="taskTitle"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Task Title *
              </label>

              <input
                id="taskTitle"
                required
                value={form.title}
                onChange={(event) =>
                  updateField(
                    "title",
                    event.target.value
                  )
                }
                placeholder="e.g. Prepare RAF claim documents"
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />

            </div>

            {/* Description */}

            <div className="md:col-span-2">

              <label
                htmlFor="description"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Description
              </label>

              <textarea
                id="description"
                value={form.description}
                onChange={(event) =>
                  updateField(
                    "description",
                    event.target.value
                  )
                }
                rows={5}
                placeholder="Describe what needs to be done..."
                className="w-full resize-none rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />

            </div>

            {/* Status */}

            <div>

              <label
                htmlFor="status"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Status
              </label>

              <select
                id="status"
                value={form.status}
                onChange={(event) =>
                  updateField(
                    "status",
                    event.target.value
                  )
                }
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
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

            {/* Priority */}

            <div>

              <label
                htmlFor="priority"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Priority
              </label>

              <select
                id="priority"
                value={form.priority}
                onChange={(event) =>
                  updateField(
                    "priority",
                    event.target.value
                  )
                }
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
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

            {/* Assigned To */}

            <div>

              <label
                htmlFor="assignedToId"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Assign To
              </label>

              <select
                id="assignedToId"
                value={form.assignedToId}
                onChange={(event) =>
                  updateField(
                    "assignedToId",
                    event.target.value
                  )
                }
                disabled={loadingData}
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              >

                <option value="">
                  {loadingData
                    ? "Loading users..."
                    : "Unassigned"}
                </option>

                {users.map(
                  (user) => (
                    <option
                      key={user.id}
                      value={user.id}
                    >
                      {user.name ||
                        user.email ||
                        "User"}{" "}
                      — {user.role}
                    </option>
                  )
                )}

              </select>

            </div>

            {/* Due Date */}

            <div>

              <label
                htmlFor="dueDate"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Due Date
              </label>

              <input
                id="dueDate"
                type="date"
                value={form.dueDate}
                onChange={(event) =>
                  updateField(
                    "dueDate",
                    event.target.value
                  )
                }
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />

            </div>

          </div>

          {/* Actions */}

          <div className="mt-8 flex justify-end gap-3">

            <button
              type="button"
              onClick={() =>
                router.back()
              }
              disabled={loading}
              className="rounded-lg border border-slate-300 px-5 py-3 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                loading ||
                loadingData
              }
              className="rounded-lg bg-slate-900 px-6 py-3 font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Creating..."
                : "Create Task"}
            </button>

          </div>

        </form>

      </div>
    </main>
  );
}

export default function NewTaskPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-50 p-6">
          <div className="mx-auto max-w-4xl">
            <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
              <p className="text-sm text-slate-500">
                Loading task form...
              </p>
            </div>
          </div>
        </main>
      }
    >
      <NewTaskForm />
    </Suspense>
  );
}