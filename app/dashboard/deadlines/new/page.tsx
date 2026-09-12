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

const DEADLINE_TYPES = [
  {
    value: "COURT_DATE",
    label: "Court Date",
  },
  {
    value: "FILING_DEADLINE",
    label: "Filing Deadline",
  },
  {
    value: "PRESCRIPTION_DATE",
    label: "Prescription Date",
  },
  {
    value: "NOTICE_PERIOD",
    label: "Notice Period",
  },
  {
    value: "CONSULTATION",
    label: "Consultation",
  },
  {
    value: "DISCOVERY_DEADLINE",
    label: "Discovery Deadline",
  },
  {
    value: "OPPOSING_PARTY_DEADLINE",
    label: "Opposing Party Deadline",
  },
  {
    value: "INTERNAL_REVIEW",
    label: "Internal Review",
  },
];

const PRIORITIES = [
  {
    value: "LOW",
    label: "Low",
  },
  {
    value: "MEDIUM",
    label: "Medium",
  },
  {
    value: "HIGH",
    label: "High",
  },
  {
    value: "CRITICAL",
    label: "Critical",
  },
];

const CALCULATION_UNITS = [
  {
    value: "DAYS",
    label: "Days",
  },
  {
    value: "WEEKS",
    label: "Weeks",
  },
  {
    value: "MONTHS",
    label: "Months",
  },
  {
    value: "YEARS",
    label: "Years",
  },
];

function NewDeadlineForm() {
  const router = useRouter();

  const searchParams = useSearchParams();

  const preselectedMatterId =
    searchParams.get("matterId") || "";

  const [matters, setMatters] =
    useState<Matter[]>([]);

  const [users, setUsers] =
    useState<User[]>([]);

  const [loadingData, setLoadingData] =
    useState(true);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [calculatedDueDate, setCalculatedDueDate] =
    useState("");

  const [form, setForm] = useState({
    matterId: preselectedMatterId,
    title: "",
    description: "",
    type: "FILING_DEADLINE",
    priority: "MEDIUM",
    assignedToId: "",
    dueDate: "",
    calculationMode: false,
    sourceDate: "",
    calculationAmount: "",
    calculationUnit: "DAYS",
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
              "Failed to load matters.",
          );
        }

        if (!usersResponse.ok) {
          throw new Error(
            usersData.error ||
              "Failed to load users.",
          );
        }

        setMatters(
          mattersData.matters || [],
        );

        setUsers(
          usersData.users || [],
        );
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Failed to load deadline data.",
        );
      } finally {
        setLoadingData(false);
      }
    }

    void loadData();
  }, []);

  function updateField(
    field: keyof typeof form,
    value: string | boolean,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    if (
      field === "calculationMode" &&
      value === false
    ) {
      setCalculatedDueDate("");
    }
  }

  function calculatePreview() {
    if (
      !form.sourceDate ||
      !form.calculationAmount ||
      !form.calculationUnit
    ) {
      setCalculatedDueDate("");
      return;
    }

    const amount =
      Number(form.calculationAmount);

    if (
      !Number.isInteger(amount) ||
      amount <= 0
    ) {
      setCalculatedDueDate("");
      return;
    }

    const sourceDate =
      new Date(
        `${form.sourceDate}T00:00:00`,
      );

    if (
      Number.isNaN(
        sourceDate.getTime(),
      )
    ) {
      setCalculatedDueDate("");
      return;
    }

    const result =
      new Date(sourceDate);

    switch (
      form.calculationUnit
    ) {
      case "DAYS":
        result.setDate(
          result.getDate() + amount,
        );
        break;

      case "WEEKS":
        result.setDate(
          result.getDate() +
            amount * 7,
        );
        break;

      case "MONTHS": {
        const originalDay =
          result.getDate();

        result.setDate(1);

        result.setMonth(
          result.getMonth() +
            amount,
        );

        const lastDay =
          new Date(
            result.getFullYear(),
            result.getMonth() + 1,
            0,
          ).getDate();

        result.setDate(
          Math.min(
            originalDay,
            lastDay,
          ),
        );

        break;
      }

      case "YEARS": {
        const originalMonth =
          result.getMonth();

        const originalDay =
          result.getDate();

        result.setDate(1);

        result.setFullYear(
          result.getFullYear() +
            amount,
        );

        result.setMonth(
          originalMonth,
        );

        const lastDay =
          new Date(
            result.getFullYear(),
            originalMonth + 1,
            0,
          ).getDate();

        result.setDate(
          Math.min(
            originalDay,
            lastDay,
          ),
        );

        break;
      }
    }

    const year =
      result.getFullYear();

    const month =
      String(
        result.getMonth() + 1,
      ).padStart(2, "0");

    const day =
      String(
        result.getDate(),
      ).padStart(2, "0");

    setCalculatedDueDate(
      `${year}-${month}-${day}`,
    );
  }

  useEffect(() => {
    if (!form.calculationMode) {
      return;
    }

    calculatePreview();
  }, [
    form.calculationMode,
    form.sourceDate,
    form.calculationAmount,
    form.calculationUnit,
  ]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");

    if (!form.matterId) {
      setError(
        "A matter is required for a legal deadline.",
      );
      return;
    }

    if (!form.title.trim()) {
      setError(
        "Deadline title is required.",
      );
      return;
    }

    if (form.calculationMode) {
      if (!form.sourceDate) {
        setError(
          "A source date is required for a calculated deadline.",
        );
        return;
      }

      if (
        !form.calculationAmount ||
        Number(
          form.calculationAmount,
        ) <= 0
      ) {
        setError(
          "Enter a valid calculation amount.",
        );
        return;
      }

      /*
       * calculatedDueDate is separate state,
       * not a property of form.
       */
      if (!calculatedDueDate) {
        setError(
          "The calculated due date could not be determined.",
        );
        return;
      }
    } else if (!form.dueDate) {
      setError(
        "A due date is required.",
      );
      return;
    }

    setLoading(true);

    try {
      const body: Record<
        string,
        unknown
      > = {
        matterId:
          form.matterId,

        title:
          form.title.trim(),

        description:
          form.description.trim() ||
          null,

        type:
          form.type,

        priority:
          form.priority,

        assignedToId:
          form.assignedToId ||
          null,
      };

      if (form.calculationMode) {
        body.sourceDate =
          form.sourceDate;

        body.calculationAmount =
          Number(
            form.calculationAmount,
          );

        body.calculationUnit =
          form.calculationUnit;

        body.isCalculated = true;
      } else {
        body.dueDate =
          `${form.dueDate}T23:59:00`;

        body.isCalculated = false;
      }

      const response =
        await fetch(
          "/api/deadlines",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify(
              body,
            ),
          },
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to create deadline.",
        );
      }

      router.push(
        `/dashboard/matters/${form.matterId}`,
      );

      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong.",
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
            Deadline Management
          </p>

          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            Create Deadline
          </h1>

          <p className="mt-2 text-slate-600">
            Record a legal deadline or use
            assisted calculation to determine
            a proposed due date.
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
                Matter *
              </label>

              <select
                id="matterId"
                required
                value={form.matterId}
                onChange={(event) =>
                  updateField(
                    "matterId",
                    event.target.value,
                  )
                }
                disabled={loadingData}
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              >
                <option value="">
                  {loadingData
                    ? "Loading matters..."
                    : "Select a matter"}
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
                  ),
                )}
              </select>

              <p className="mt-1 text-xs text-slate-500">
                Every legal deadline must
                belong to a matter.
              </p>
            </div>

            {/* Title */}

            <div className="md:col-span-2">
              <label
                htmlFor="title"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Deadline Title *
              </label>

              <input
                id="title"
                required
                value={form.title}
                onChange={(event) =>
                  updateField(
                    "title",
                    event.target.value,
                  )
                }
                placeholder="e.g. File notice of intention to defend"
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
                    event.target.value,
                  )
                }
                rows={4}
                placeholder="Add notes or additional information about this deadline..."
                className="w-full resize-none rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
            </div>

            {/* Type */}

            <div>
              <label
                htmlFor="type"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Deadline Type *
              </label>

              <select
                id="type"
                required
                value={form.type}
                onChange={(event) =>
                  updateField(
                    "type",
                    event.target.value,
                  )
                }
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              >
                {DEADLINE_TYPES.map(
                  (type) => (
                    <option
                      key={type.value}
                      value={type.value}
                    >
                      {type.label}
                    </option>
                  ),
                )}
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
                    event.target.value,
                  )
                }
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              >
                {PRIORITIES.map(
                  (priority) => (
                    <option
                      key={
                        priority.value
                      }
                      value={
                        priority.value
                      }
                    >
                      {priority.label}
                    </option>
                  ),
                )}
              </select>
            </div>

            {/* Assigned To */}

            <div className="md:col-span-2">
              <label
                htmlFor="assignedToId"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Responsible Person
              </label>

              <select
                id="assignedToId"
                value={
                  form.assignedToId
                }
                onChange={(event) =>
                  updateField(
                    "assignedToId",
                    event.target.value,
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
                  ),
                )}
              </select>
            </div>

          </div>

          {/* Calculation Mode */}

          <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-6">

            <div className="flex items-start gap-3">
              <input
                id="calculationMode"
                type="checkbox"
                checked={
                  form.calculationMode
                }
                onChange={(event) =>
                  updateField(
                    "calculationMode",
                    event.target.checked,
                  )
                }
                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
              />

              <div>
                <label
                  htmlFor="calculationMode"
                  className="font-semibold text-slate-900"
                >
                  Use assisted deadline
                  calculation
                </label>

                <p className="mt-1 text-sm text-slate-500">
                  Calculate a proposed due
                  date from a source date
                  and a specified period.
                </p>
              </div>
            </div>

            {form.calculationMode && (
              <div className="mt-6 grid gap-6 md:grid-cols-2">

                {/* Source Date */}

                <div>
                  <label
                    htmlFor="sourceDate"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Source Date *
                  </label>

                  <input
                    id="sourceDate"
                    type="date"
                    required
                    value={
                      form.sourceDate
                    }
                    onChange={(event) =>
                      updateField(
                        "sourceDate",
                        event.target.value,
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                {/* Amount */}

                <div>
                  <label
                    htmlFor="calculationAmount"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Period *
                  </label>

                  <input
                    id="calculationAmount"
                    type="number"
                    min="1"
                    max="10000"
                    step="1"
                    required
                    value={
                      form.calculationAmount
                    }
                    onChange={(event) =>
                      updateField(
                        "calculationAmount",
                        event.target.value,
                      )
                    }
                    placeholder="e.g. 15"
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                {/* Unit */}

                <div>
                  <label
                    htmlFor="calculationUnit"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Unit *
                  </label>

                  <select
                    id="calculationUnit"
                    value={
                      form.calculationUnit
                    }
                    onChange={(event) =>
                      updateField(
                        "calculationUnit",
                        event.target.value,
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  >
                    {CALCULATION_UNITS.map(
                      (unit) => (
                        <option
                          key={unit.value}
                          value={unit.value}
                        >
                          {unit.label}
                        </option>
                      ),
                    )}
                  </select>
                </div>

                {/* Preview */}

                <div>
                  <label
                    htmlFor="calculatedDueDate"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Proposed Due Date
                  </label>

                  <input
                    id="calculatedDueDate"
                    type="date"
                    value={
                      calculatedDueDate
                    }
                    readOnly
                    className="w-full rounded-lg border border-slate-300 bg-slate-100 px-4 py-3 text-slate-700 outline-none"
                  />
                </div>

                {/* Warning */}

                <div className="md:col-span-2 rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-800">
                    Attorney verification
                    required
                  </p>

                  <p className="mt-1 text-sm text-amber-700">
                    This is an assisted
                    calculation only. The
                    proposed date must be
                    verified against the
                    applicable legislation,
                    court rules, service date,
                    counting method and
                    relevant public holidays
                    before reliance.
                  </p>
                </div>

              </div>
            )}
          </div>

          {/* Manual Due Date */}

          {!form.calculationMode && (
            <div className="mt-8">
              <label
                htmlFor="dueDate"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Due Date *
              </label>

              <input
                id="dueDate"
                type="date"
                required
                value={form.dueDate}
                onChange={(event) =>
                  updateField(
                    "dueDate",
                    event.target.value,
                  )
                }
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />

              <p className="mt-1 text-xs text-slate-500">
                Enter the confirmed legal
                deadline date.
              </p>
            </div>
          )}

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
                : "Create Deadline"}
            </button>

          </div>

        </form>

      </div>
    </main>
  );
}

export default function NewDeadlinePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-50 p-6">
          <div className="mx-auto max-w-4xl">
            <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
              <p className="text-sm text-slate-500">
                Loading deadline form...
              </p>
            </div>
          </div>
        </main>
      }
    >
      <NewDeadlineForm />
    </Suspense>
  );
}