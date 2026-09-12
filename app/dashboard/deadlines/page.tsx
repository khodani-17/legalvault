"use client";

import Link from "next/link";
import {
  AlertCircle,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Plus,
  RefreshCw,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type Deadline = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  priority: string;
  status: string;
  dueDate: string;
  assignedTo: {
    id: string;
    name: string;
    email: string;
  } | null;
  matter: {
    id: string;
    referenceNumber: string;
    title: string;
  };
  isCalculated: boolean;
  calculationNote: string | null;
};

type DeadlineResponse = {
  success?: boolean;
  deadlines?: Deadline[];
  error?: string;
};

const TYPE_LABELS: Record<string, string> = {
  COURT_DATE: "Court Date",
  FILING_DEADLINE: "Filing Deadline",
  PRESCRIPTION_DATE: "Prescription Date",
  NOTICE_PERIOD: "Notice Period",
  CONSULTATION: "Consultation",
  DISCOVERY_DEADLINE: "Discovery Deadline",
  OPPOSING_PARTY_DEADLINE:
    "Opposing Party Deadline",
  INTERNAL_REVIEW: "Internal Review",
};

const PRIORITY_CLASSES: Record<
  string,
  string
> = {
  LOW:
    "bg-slate-100 text-slate-700",
  MEDIUM:
    "bg-blue-100 text-blue-700",
  HIGH:
    "bg-orange-100 text-orange-700",
  CRITICAL:
    "bg-red-100 text-red-700",
};

const STATUS_CLASSES: Record<
  string,
  string
> = {
  PENDING:
    "bg-amber-100 text-amber-700",
  COMPLETED:
    "bg-emerald-100 text-emerald-700",
  CANCELLED:
    "bg-slate-100 text-slate-600",
  OVERDUE:
    "bg-red-100 text-red-700",
};

function formatDate(
  value: string,
) {
  return new Intl.DateTimeFormat(
    "en-ZA",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  ).format(new Date(value));
}

function formatTime(
  value: string,
) {
  return new Intl.DateTimeFormat(
    "en-ZA",
    {
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(new Date(value));
}

function startOfDay(
  date: Date,
) {
  const result =
    new Date(date);

  result.setHours(
    0,
    0,
    0,
    0,
  );

  return result;
}

function endOfDay(
  date: Date,
) {
  const result =
    new Date(date);

  result.setHours(
    23,
    59,
    59,
    999,
  );

  return result;
}

function getWeekEnd(
  date: Date,
) {
  const result =
    new Date(date);

  const day =
    result.getDay();

  const daysUntilSunday =
    7 - day;

  result.setDate(
    result.getDate() +
      daysUntilSunday,
  );

  return endOfDay(result);
}

function isOverdue(
  deadline: Deadline,
) {
  if (
    deadline.status ===
    "COMPLETED"
  ) {
    return false;
  }

  if (
    deadline.status ===
    "CANCELLED"
  ) {
    return false;
  }

  return (
    new Date(
      deadline.dueDate,
    ) < new Date()
  );
}

function isToday(
  deadline: Deadline,
) {
  const due =
    new Date(
      deadline.dueDate,
    );

  const now =
    new Date();

  return (
    due >= startOfDay(now) &&
    due <= endOfDay(now)
  );
}

function isThisWeek(
  deadline: Deadline,
) {
  const due =
    new Date(
      deadline.dueDate,
    );

  const now =
    new Date();

  const today =
    startOfDay(now);

  const weekEnd =
    getWeekEnd(now);

  return (
    due >= today &&
    due <= weekEnd
  );
}

function getDeadlineCategory(
  deadline: Deadline,
) {
  if (
    isOverdue(deadline)
  ) {
    return "overdue";
  }

  if (
    isToday(deadline)
  ) {
    return "today";
  }

  if (
    isThisWeek(deadline)
  ) {
    return "week";
  }

  return "upcoming";
}

export default function DeadlinesPage() {
  const [deadlines, setDeadlines] =
    useState<Deadline[]>(
      [],
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const loadDeadlines =
    useCallback(
      async () => {
        try {
          setLoading(true);
          setError("");

          const response =
            await fetch(
              "/api/deadlines",
              {
                method: "GET",
                cache: "no-store",
              },
            );

          const data =
            (await response.json()) as DeadlineResponse;

          if (!response.ok) {
            setError(
              data.error ||
                "Unable to load deadlines.",
            );

            return;
          }

          setDeadlines(
            data.deadlines ||
              [],
          );
        } catch {
          setError(
            "Unable to load deadlines right now.",
          );
        } finally {
          setLoading(false);
        }
      },
      [],
    );

  useEffect(() => {
    void loadDeadlines();
  }, [loadDeadlines]);

  const statistics =
    useMemo(() => {
      const overdue =
        deadlines.filter(
          (deadline) =>
            getDeadlineCategory(
              deadline,
            ) === "overdue",
        );

      const today =
        deadlines.filter(
          (deadline) =>
            getDeadlineCategory(
              deadline,
            ) === "today",
        );

      const week =
        deadlines.filter(
          (deadline) =>
            getDeadlineCategory(
              deadline,
            ) === "week",
        );

      const upcoming =
        deadlines.filter(
          (deadline) =>
            getDeadlineCategory(
              deadline,
            ) === "upcoming",
        );

      return {
        overdue,
        today,
        week,
        upcoming,
      };
    }, [deadlines]);

  const visibleDeadlines =
    useMemo(() => {
      return [
        ...statistics.overdue,
        ...statistics.today,
        ...statistics.week,
        ...statistics.upcoming,
      ];
    }, [statistics]);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Link
                href="/dashboard"
                className="transition hover:text-blue-700"
              >
                Dashboard
              </Link>

              <span>/</span>

              <span className="text-slate-700">
                Deadlines
              </span>
            </div>

            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
              Legal Deadlines
            </h1>

            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Monitor court dates, filing
              deadlines, prescription dates,
              consultations and other
              matter-related deadlines.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                void loadDeadlines()
              }
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  loading
                    ? "animate-spin"
                    : ""
                }`}
              />

              Refresh
            </button>

            <Link
              href="/dashboard/deadlines/new"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800"
            >
              <Plus className="h-4 w-4" />

              New Deadline
            </Link>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />

            <div>
              <p className="font-semibold">
                Unable to load deadlines
              </p>

              <p className="mt-1">
                {error}
              </p>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="Overdue"
            count={
              statistics.overdue.length
            }
            description="Requires attention"
            icon={
              <AlertCircle className="h-5 w-5" />
            }
            iconClass="bg-red-100 text-red-700"
          />

          <SummaryCard
            title="Due Today"
            count={
              statistics.today.length
            }
            description="Due before midnight"
            icon={
              <Clock3 className="h-5 w-5" />
            }
            iconClass="bg-orange-100 text-orange-700"
          />

          <SummaryCard
            title="Due This Week"
            count={
              statistics.week.length
            }
            description="Remaining this week"
            icon={
              <CalendarClock className="h-5 w-5" />
            }
            iconClass="bg-blue-100 text-blue-700"
          />

          <SummaryCard
            title="Upcoming"
            count={
              statistics.upcoming.length
            }
            description="Future deadlines"
            icon={
              <CheckCircle2 className="h-5 w-5" />
            }
            iconClass="bg-emerald-100 text-emerald-700"
          />
        </div>

        {/* Deadline List */}
        <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Deadline Schedule
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {deadlines.length}{" "}
                  {deadlines.length === 1
                    ? "deadline"
                    : "deadlines"}{" "}
                  available to you.
                </p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="px-6 py-16 text-center">
              <RefreshCw className="mx-auto h-7 w-7 animate-spin text-blue-600" />

              <p className="mt-4 text-sm text-slate-500">
                Loading deadlines...
              </p>
            </div>
          ) : visibleDeadlines.length ===
            0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                <CalendarClock className="h-6 w-6 text-slate-500" />
              </div>

              <h3 className="mt-4 text-base font-semibold text-slate-900">
                No deadlines found
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                There are currently no
                deadlines available for
                the matters you can access.
              </p>

              <Link
                href="/dashboard/deadlines/new"
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800"
              >
                <Plus className="h-4 w-4" />

                Create Deadline
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {visibleDeadlines.map(
                (deadline) => {
                  const overdue =
                    isOverdue(
                      deadline,
                    );

                  return (
                    <div
                      key={
                        deadline.id
                      }
                      className="px-6 py-5 transition hover:bg-slate-50"
                    >
                      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-slate-900">
                              {
                                deadline.title
                              }
                            </h3>

                            {deadline.isCalculated && (
                              <span className="rounded-full bg-purple-100 px-2.5 py-1 text-xs font-semibold text-purple-700">
                                Calculated
                              </span>
                            )}

                            {overdue && (
                              <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                                Overdue
                              </span>
                            )}
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
                            <span>
                              {
                                deadline
                                  .matter
                                  .referenceNumber
                              }
                            </span>

                            <span className="hidden text-slate-300 sm:inline">
                              •
                            </span>

                            <span>
                              {
                                deadline
                                  .matter
                                  .title
                              }
                            </span>
                          </div>

                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                              {TYPE_LABELS[
                                deadline
                                  .type
                              ] ||
                                deadline.type}
                            </span>

                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                PRIORITY_CLASSES[
                                  deadline
                                    .priority
                                ] ||
                                "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {
                                deadline.priority
                              }
                            </span>

                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                STATUS_CLASSES[
                                  deadline
                                    .status
                                ] ||
                                "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {
                                deadline.status
                              }
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center lg:justify-end">
                          <div className="text-sm lg:text-right">
                            <p
                              className={`font-semibold ${
                                overdue
                                  ? "text-red-700"
                                  : "text-slate-900"
                              }`}
                            >
                              {formatDate(
                                deadline.dueDate,
                              )}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              {formatTime(
                                deadline.dueDate,
                              )}
                            </p>
                          </div>

                          <div className="min-w-40 text-sm lg:text-right">
                            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                              Responsible
                            </p>

                            <p className="mt-1 font-medium text-slate-700">
                              {deadline
                                .assignedTo
                                ?.name ||
                                "Unassigned"}
                            </p>
                          </div>

                          <Link
                            href={`/dashboard/deadlines/${deadline.id}`}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                          >
                            View

                            <ArrowUpRight className="h-4 w-4" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function SummaryCard({
  title,
  count,
  description,
  icon,
  iconClass,
}: {
  title: string;
  count: number;
  description: string;
  icon: React.ReactNode;
  iconClass: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>

          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            {count}
          </p>
        </div>

        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconClass}`}
        >
          {icon}
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        {description}
      </p>
    </div>
  );
}