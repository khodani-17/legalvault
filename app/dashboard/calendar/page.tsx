"use client";

import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileClock,
  ListTodo,
  Loader2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type CalendarEvent = {
  id: string;
  sourceId: string;
  type: "TASK" | "DEADLINE";
  title: string;
  description: string | null;
  date: string | null;
  status: string;
  priority: string;
  completedAt: string | null;
  isCalculated?: boolean;
  calculationNote?: string | null;
  matter: {
    id: string;
    referenceNumber: string;
    title: string;
  } | null;
  assignedTo: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  href: string;
};

type CalendarResponse = {
  events: CalendarEvent[];
  totals: {
    events: number;
    tasks: number;
    deadlines: number;
  };
};

function startOfMonth(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    1,
  );
}

function endOfMonth(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    1,
  );
}

function formatMonth(date: Date) {
  return date.toLocaleDateString("en-ZA", {
    month: "long",
    year: "numeric",
  });
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
  });
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function buildCalendarDays(month: Date) {
  const first = startOfMonth(month);
  const dayOfWeek = first.getDay();

  const start = new Date(first);
  start.setDate(first.getDate() - dayOfWeek);

  const days: Date[] = [];

  for (let i = 0; i < 42; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    days.push(day);
  }

  return days;
}

function priorityClass(priority: string) {
  switch (priority.toUpperCase()) {
    case "HIGH":
    case "URGENT":
      return "border-red-200 bg-red-50 text-red-700";

    case "LOW":
      return "border-gray-200 bg-gray-50 text-gray-600";

    default:
      return "border-blue-200 bg-blue-50 text-blue-700";
  }
}

function isCompleted(event: CalendarEvent) {
  return (
    Boolean(event.completedAt) ||
    ["COMPLETED", "DONE", "CLOSED"].includes(
      event.status.toUpperCase(),
    )
  );
}

export default function CalendarPage() {
  const [month, setMonth] = useState(() =>
    startOfMonth(new Date()),
  );

  const [events, setEvents] = useState<CalendarEvent[]>([]);

  const [totals, setTotals] = useState({
    events: 0,
    tasks: 0,
    deadlines: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const calendarDays = useMemo(
    () => buildCalendarDays(month),
    [month],
  );

  const loadCalendar = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const start = startOfMonth(month);
      const end = endOfMonth(month);

      const params = new URLSearchParams({
        start: start.toISOString(),
        end: end.toISOString(),
      });

      const response = await fetch(
        `/api/calendar?${params.toString()}`,
        {
          cache: "no-store",
        },
      );

      const data =
        (await response.json()) as CalendarResponse & {
          error?: string;
        };

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to load calendar.",
        );
      }

      setEvents(data.events ?? []);

      setTotals(
        data.totals ?? {
          events: 0,
          tasks: 0,
          deadlines: 0,
        },
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load calendar.",
      );
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void loadCalendar();
  }, [loadCalendar]);

  const eventsByDay = useMemo(() => {
    const map = new Map<
      string,
      CalendarEvent[]
    >();

    for (const event of events) {
      if (!event.date) {
        continue;
      }

      const date = new Date(event.date);

      const key = [
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
      ].join("-");

      const existing = map.get(key) ?? [];

      existing.push(event);

      map.set(key, existing);
    }

    return map;
  }, [events]);

  const today = new Date();

  const upcomingEvents = [...events]
    .filter((event) => !isCompleted(event))
    .sort(
      (a, b) =>
        new Date(a.date ?? 0).getTime() -
        new Date(b.date ?? 0).getTime(),
    )
    .slice(0, 8);

  const previousMonth = () => {
    setMonth(
      new Date(
        month.getFullYear(),
        month.getMonth() - 1,
        1,
      ),
    );
  };

  const nextMonth = () => {
    setMonth(
      new Date(
        month.getFullYear(),
        month.getMonth() + 1,
        1,
      ),
    );
  };

  const goToToday = () => {
    setMonth(startOfMonth(new Date()));
  };

  return (
    <main className="space-y-4 p-4">
      {/* HEADER */}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-100 p-2.5 text-blue-700">
            <CalendarDays size={21} />
          </div>

          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              Legal Calendar
            </h1>

            <p className="text-xs text-gray-500">
              Manage matter deadlines and tasks.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={goToToday}
          className="w-fit rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Today
        </button>
      </div>

      {/* SUMMARY */}

      <div className="flex flex-col gap-3 md:flex-row">
        <div className="flex-1 rounded-lg border bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">
                Calendar Events
              </p>

              <p className="mt-1 text-xl font-semibold">
                {totals.events}
              </p>
            </div>

            <CalendarDays
              size={20}
              className="text-blue-600"
            />
          </div>
        </div>

        <div className="flex-1 rounded-lg border bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">
                Tasks
              </p>

              <p className="mt-1 text-xl font-semibold">
                {totals.tasks}
              </p>
            </div>

            <ListTodo
              size={20}
              className="text-indigo-600"
            />
          </div>
        </div>

        <div className="flex-1 rounded-lg border bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">
                Deadlines
              </p>

              <p className="mt-1 text-xl font-semibold">
                {totals.deadlines}
              </p>
            </div>

            <FileClock
              size={20}
              className="text-red-600"
            />
          </div>
        </div>
      </div>

      {/* CALENDAR + UPCOMING */}

      <div className="flex flex-col gap-4 xl:flex-row">
        {/* CALENDAR */}

        <section className="min-w-0 flex-1 overflow-hidden rounded-lg border bg-white">
          {/* CALENDAR HEADER */}

          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={previousMonth}
                className="rounded-md border p-1.5 hover:bg-gray-50"
                aria-label="Previous month"
              >
                <ChevronLeft size={17} />
              </button>

              <h2 className="min-w-32 text-center text-base font-semibold">
                {formatMonth(month)}
              </h2>

              <button
                type="button"
                onClick={nextMonth}
                className="rounded-md border p-1.5 hover:bg-gray-50"
                aria-label="Next month"
              >
                <ChevronRight size={17} />
              </button>
            </div>

            {loading && (
              <Loader2
                size={17}
                className="animate-spin text-gray-500"
              />
            )}
          </div>

          {/* ERROR */}

          {error && (
            <div className="m-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle size={17} />
              {error}
            </div>
          )}

          {/* DAY HEADERS */}

          <div className="flex border-b bg-gray-50">
            {[
              "Sun",
              "Mon",
              "Tue",
              "Wed",
              "Thu",
              "Fri",
              "Sat",
            ].map((day) => (
              <div
                key={day}
                className="w-[14.2857%] border-r px-1 py-2 text-center text-[11px] font-semibold text-gray-500 last:border-r-0"
              >
                {day}
              </div>
            ))}
          </div>

          {/* CALENDAR DAYS */}

          <div className="flex flex-wrap">
            {calendarDays.map((day) => {
              const key = [
                day.getFullYear(),
                day.getMonth(),
                day.getDate(),
              ].join("-");

              const dayEvents =
                eventsByDay.get(key) ?? [];

              const belongsToMonth =
                day.getMonth() ===
                month.getMonth();

              const isToday = sameDay(
                day,
                today,
              );

              return (
                <div
                  key={key}
                  className={`min-h-24 w-[14.2857%] border-b border-r p-1.5 ${
                    belongsToMonth
                      ? "bg-white"
                      : "bg-gray-50"
                  }`}
                >
                  {/* DATE */}

                  <div className="mb-1 flex justify-end">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-medium ${
                        isToday
                          ? "bg-gray-900 text-white"
                          : belongsToMonth
                            ? "text-gray-700"
                            : "text-gray-400"
                      }`}
                    >
                      {day.getDate()}
                    </span>
                  </div>

                  {/* EVENTS */}

                  <div className="space-y-1">
                    {dayEvents
                      .slice(0, 3)
                      .map((event) => {
                        const completed =
                          isCompleted(event);

                        return (
                          <Link
                            key={event.id}
                            href={event.href}
                            className={`block rounded border px-1.5 py-1 text-[10px] transition hover:shadow-sm ${
                              completed
                                ? "border-gray-200 bg-gray-50 text-gray-500"
                                : priorityClass(
                                    event.priority,
                                  )
                            }`}
                          >
                            <div className="flex items-center gap-1">
                              {event.type ===
                              "DEADLINE" ? (
                                <FileClock
                                  size={10}
                                  className="shrink-0"
                                />
                              ) : (
                                <ListTodo
                                  size={10}
                                  className="shrink-0"
                                />
                              )}

                              <span className="truncate font-medium">
                                {event.title}
                              </span>
                            </div>

                            {event.matter && (
                              <div className="mt-0.5 truncate text-[9px] opacity-70">
                                {
                                  event.matter
                                    .referenceNumber
                                }
                              </div>
                            )}
                          </Link>
                        );
                      })}

                    {dayEvents.length > 3 && (
                      <div className="px-1 text-[9px] text-gray-500">
                        +
                        {dayEvents.length - 3}{" "}
                        more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* UPCOMING */}

        <aside className="w-full shrink-0 rounded-lg border bg-white xl:w-64">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">
              Upcoming
            </h2>

            <p className="mt-1 text-[11px] text-gray-500">
              Open tasks and deadlines
            </p>
          </div>

          <div className="divide-y">
            {upcomingEvents.length === 0 ? (
              <div className="p-5 text-center text-sm text-gray-500">
                No upcoming events.
              </div>
            ) : (
              upcomingEvents.map((event) => {
                const eventDate = event.date
                  ? new Date(event.date)
                  : null;

                return (
                  <Link
                    key={event.id}
                    href={event.href}
                    className="block p-3 hover:bg-gray-50"
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`mt-0.5 rounded-md p-1.5 ${
                          event.type ===
                          "DEADLINE"
                            ? "bg-red-50 text-red-600"
                            : "bg-blue-50 text-blue-600"
                        }`}
                      >
                        {event.type ===
                        "DEADLINE" ? (
                          <FileClock size={14} />
                        ) : (
                          <ListTodo size={14} />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-gray-900">
                          {event.title}
                        </p>

                        <p className="mt-0.5 text-[10px] text-gray-500">
                          {event.type ===
                          "DEADLINE"
                            ? "Deadline"
                            : "Task"}
                        </p>

                        {event.matter && (
                          <p className="mt-0.5 truncate text-[10px] text-gray-500">
                            {
                              event.matter
                                .referenceNumber
                            }
                          </p>
                        )}

                        {eventDate && (
                          <div className="mt-1.5 flex items-center gap-1 text-[10px] font-medium text-gray-600">
                            <Clock size={11} />
                            {formatDate(
                              eventDate,
                            )}
                          </div>
                        )}
                      </div>

                      {isCompleted(event) && (
                        <CheckCircle2
                          size={15}
                          className="shrink-0 text-green-600"
                        />
                      )}
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}