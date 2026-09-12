"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Archive,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Folder,
  History,
  Loader2,
  LogIn,
  LogOut,
  Plus,
  RotateCcw,
  Share2,
  Shield,
  Trash2,
  UserPlus,
  UserRound,
  UserRoundCog,
  XCircle,
} from "lucide-react";

type TimelineUser = {
  id: string;
  name: string | null;
  email: string;
  role: string;
};

type TimelineItem = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  description: string | null;
  metadata: unknown;
  createdAt: string;
  user: TimelineUser | null;
};

type TimelineResponse = {
  matter: {
    id: string;
    referenceNumber: string;
    title: string;
  };
  timeline: TimelineItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

function formatDateTime(value: string) {
  const date = new Date(value);

  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatAction(action: string) {
  return action
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatEntityType(entityType: string) {
  return entityType
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
}

function getActionIcon(action: string) {
  switch (action) {
    case "CREATE":
      return Plus;

    case "UPDATE":
      return Activity;

    case "DELETE":
      return Trash2;

    case "DOWNLOAD":
      return ArrowDownToLine;

    case "UPLOAD":
      return ArrowUpFromLine;

    case "LOGIN":
      return LogIn;

    case "LOGOUT":
      return LogOut;

    case "SHARE":
      return Share2;

    case "ARCHIVE":
      return Archive;

    case "RESTORE":
      return RotateCcw;

    default:
      return History;
  }
}

function getActionClasses(action: string) {
  switch (action) {
    case "CREATE":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";

    case "UPDATE":
      return "bg-blue-50 text-blue-700 border-blue-200";

    case "DELETE":
      return "bg-red-50 text-red-700 border-red-200";

    case "DOWNLOAD":
    case "UPLOAD":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";

    case "SHARE":
      return "bg-purple-50 text-purple-700 border-purple-200";

    case "ARCHIVE":
    case "RESTORE":
      return "bg-amber-50 text-amber-700 border-amber-200";

    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
}

function getEntityIcon(entityType: string) {
  if (entityType.toLowerCase().includes("document")) {
    return FileText;
  }

  if (entityType.toLowerCase().includes("folder")) {
    return Folder;
  }

  if (entityType.toLowerCase().includes("user")) {
    return UserRoundCog;
  }

  if (entityType.toLowerCase().includes("access")) {
    return Shield;
  }

  return History;
}

export default function MatterTimeline({
  matterId,
}: {
  matterId: string;
}) {
  const [data, setData] = useState<TimelineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

  const loadTimeline = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `/api/matters/${encodeURIComponent(matterId)}/timeline?page=${page}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error || "Failed to load matter timeline",
        );
      }

      setData(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load matter timeline",
      );
    } finally {
      setLoading(false);
    }
  }, [matterId, page]);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-slate-700" />

              <h2 className="text-lg font-semibold text-slate-900">
                Matter Timeline
              </h2>
            </div>

            <p className="mt-1 text-sm text-slate-500">
              Chronological activity recorded against this matter.
            </p>
          </div>

          {data && (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
              {data.pagination.total}{" "}
              {data.pagination.total === 1 ? "activity" : "activities"}
            </div>
          )}
        </div>
      </div>

      <div className="p-6">
        {loading && (
          <div className="flex min-h-[180px] items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading timeline...
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5">
            <div className="flex items-start gap-3">
              <XCircle className="mt-0.5 h-5 w-5 text-red-600" />

              <div>
                <p className="font-medium text-red-800">
                  Unable to load timeline
                </p>

                <p className="mt-1 text-sm text-red-700">
                  {error}
                </p>

                <button
                  type="button"
                  onClick={loadTimeline}
                  className="mt-3 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}

        {!loading &&
          !error &&
          data &&
          data.timeline.length === 0 && (
            <div className="flex min-h-[180px] flex-col items-center justify-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                <History className="h-6 w-6 text-slate-500" />
              </div>

              <h3 className="mt-4 font-medium text-slate-900">
                No activity recorded yet
              </h3>

              <p className="mt-1 max-w-md text-sm text-slate-500">
                Activity will appear here as users create, update,
                upload, download and manage records associated with
                this matter.
              </p>
            </div>
          )}

        {!loading &&
          !error &&
          data &&
          data.timeline.length > 0 && (
            <div className="relative">
              <div className="absolute bottom-0 left-[19px] top-0 w-px bg-slate-200" />

              <div className="space-y-7">
                {data.timeline.map((item) => {
                  const ActionIcon = getActionIcon(item.action);
                  const EntityIcon = getEntityIcon(item.entityType);

                  return (
                    <article
                      key={item.id}
                      className="relative flex gap-4"
                    >
                      <div
                        className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${getActionClasses(
                          item.action,
                        )}`}
                      >
                        <ActionIcon className="h-4.5 w-4.5" />
                      </div>

                      <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                                {formatAction(item.action)}
                              </span>

                              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs text-slate-500 ring-1 ring-slate-200">
                                <EntityIcon className="h-3.5 w-3.5" />
                                {formatEntityType(item.entityType)}
                              </span>
                            </div>

                            <p className="mt-3 text-sm leading-6 text-slate-800">
                              {item.description ||
                                `${formatAction(
                                  item.action,
                                )} ${formatEntityType(
                                  item.entityType,
                                )}`}
                            </p>
                          </div>

                          <div className="flex shrink-0 items-center gap-1.5 text-xs text-slate-500">
                            <Clock className="h-3.5 w-3.5" />
                            {formatDateTime(item.createdAt)}
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-200 pt-3 text-xs text-slate-500">
                          <div className="flex items-center gap-1.5">
                            <UserRound className="h-3.5 w-3.5" />

                            <span>
                              {item.user?.name ||
                                item.user?.email ||
                                "System"}
                            </span>
                          </div>

                          {item.user?.role && (
                            <span className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-600">
                              {item.user.role
                                .replace(/_/g, " ")
                                .toLowerCase()
                                .replace(/\b\w/g, (letter) =>
                                  letter.toUpperCase(),
                                )}
                            </span>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}

        {!loading && !error && data && data.pagination.totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-5">
            <button
              type="button"
              disabled={!data.pagination.hasPreviousPage}
              onClick={() =>
                setPage((current) => Math.max(1, current - 1))
              }
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>

            <span className="text-sm text-slate-500">
              Page {data.pagination.page} of{" "}
              {data.pagination.totalPages}
            </span>

            <button
              type="button"
              disabled={!data.pagination.hasNextPage}
              onClick={() =>
                setPage((current) => current + 1)
              }
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}