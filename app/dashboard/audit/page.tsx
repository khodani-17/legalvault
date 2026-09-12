import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Filter,
  ShieldCheck,
  User,
} from "lucide-react";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 25;

const ALLOWED_ROLES = [
  "SUPER_ADMIN",
  "MANAGING_PARTNER",
  "PARTNER",
  "DIRECTOR",
  "ADMIN",
];

const AUDIT_ACTIONS = [
  "CREATE",
  "READ",
  "UPDATE",
  "DELETE",
  "DOWNLOAD",
  "UPLOAD",
  "LOGIN",
  "LOGOUT",
  "SHARE",
  "ARCHIVE",
  "RESTORE",
];

function formatAction(action: string) {
  return action
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatEntityType(entityType: string) {
  return entityType
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getActionClasses(action: string) {
  switch (action) {
    case "CREATE":
    case "UPLOAD":
      return "bg-green-100 text-green-700";

    case "UPDATE":
    case "RESTORE":
      return "bg-blue-100 text-blue-700";

    case "DELETE":
      return "bg-red-100 text-red-700";

    case "DOWNLOAD":
    case "READ":
      return "bg-slate-100 text-slate-700";

    case "LOGIN":
      return "bg-emerald-100 text-emerald-700";

    case "LOGOUT":
      return "bg-amber-100 text-amber-700";

    case "SHARE":
      return "bg-purple-100 text-purple-700";

    case "ARCHIVE":
      return "bg-orange-100 text-orange-700";

    default:
      return "bg-slate-100 text-slate-700";
  }
}

type SearchParams = {
  page?: string;
  search?: string;
  action?: string;
  entityType?: string;
  from?: string;
  to?: string;
};

export default async function AuditTrailPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const firmId = session.user.firmId;
  const role = session.user.role;

  if (!firmId) {
    redirect("/login");
  }

  /*
   * Audit Trail access
   *
   * These roles have full management-level access to the
   * firm's audit trail.
   */
  if (!ALLOWED_ROLES.includes(role)) {
    redirect("/dashboard");
  }

  const params = await searchParams;

  const search = params.search?.trim() || "";
  const action = params.action || "";
  const entityType = params.entityType || "";
  const from = params.from || "";
  const to = params.to || "";

  const requestedPage = Number.parseInt(params.page || "1", 10);

  const currentPage =
    Number.isFinite(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;

  const where = {
    firmId,

    ...(action
      ? {
          action: action as
            | "CREATE"
            | "READ"
            | "UPDATE"
            | "DELETE"
            | "DOWNLOAD"
            | "UPLOAD"
            | "LOGIN"
            | "LOGOUT"
            | "SHARE"
            | "ARCHIVE"
            | "RESTORE",
        }
      : {}),

    ...(entityType
      ? {
          entityType,
        }
      : {}),

    ...(search
      ? {
          OR: [
            {
              description: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
            {
              entityType: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
            {
              entityId: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
            {
              user: {
                name: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
            },
            {
              user: {
                email: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
            },
          ],
        }
      : {}),

    ...(from || to
      ? {
          createdAt: {
            ...(from
              ? {
                  gte: new Date(`${from}T00:00:00`),
                }
              : {}),
            ...(to
              ? {
                  lte: new Date(`${to}T23:59:59.999`),
                }
              : {}),
          },
        }
      : {}),
  };

  const [totalLogs, logs] = await Promise.all([
    prisma.auditLog.count({
      where,
    }),

    prisma.auditLog.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        description: true,
        ipAddress: true,
        userAgent: true,
        metadata: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    }),
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(totalLogs / PAGE_SIZE)
  );

  const safePage = Math.min(currentPage, totalPages);

  const entityTypes = await prisma.auditLog.findMany({
    where: {
      firmId,
    },
    distinct: ["entityType"],
    orderBy: {
      entityType: "asc",
    },
    select: {
      entityType: true,
    },
  });

  function buildPageUrl(page: number) {
    const query = new URLSearchParams();

    if (search) query.set("search", search);
    if (action) query.set("action", action);
    if (entityType) query.set("entityType", entityType);
    if (from) query.set("from", from);
    if (to) query.set("to", to);

    query.set("page", String(page));

    return `/dashboard/audit?${query.toString()}`;
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-6 py-8">

        {/* HEADER */}
        <div className="mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white">
                  <ShieldCheck className="h-6 w-6" />
                </div>

                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                    Audit Trail
                  </h1>

                  <p className="mt-1 text-sm text-slate-500">
                    Review activity and security events across your firm.
                  </p>
                </div>
              </div>
            </div>

            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
          </div>
        </div>

        {/* SUMMARY */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">

          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <Activity className="h-5 w-5" />
              </div>

              <div>
                <p className="text-sm text-slate-500">
                  Total Activity
                </p>

                <p className="text-2xl font-bold text-slate-900">
                  {totalLogs}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                <User className="h-5 w-5" />
              </div>

              <div>
                <p className="text-sm text-slate-500">
                  Current User
                </p>

                <p className="text-sm font-semibold text-slate-900">
                  {session.user.name || session.user.email}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-700">
                <CalendarDays className="h-5 w-5" />
              </div>

              <div>
                <p className="text-sm text-slate-500">
                  Records Per Page
                </p>

                <p className="text-2xl font-bold text-slate-900">
                  {PAGE_SIZE}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* FILTERS */}
        <section className="mb-6 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">

          <div className="mb-4 flex items-center gap-2">
            <Filter className="h-5 w-5 text-slate-600" />

            <h2 className="font-semibold text-slate-900">
              Filter Activity
            </h2>
          </div>

          <form
            method="GET"
            action="/dashboard/audit"
            className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5"
          >
            <div>
              <label
                htmlFor="search"
                className="mb-1.5 block text-xs font-semibold text-slate-600"
              >
                Search
              </label>

              <input
                id="search"
                name="search"
                type="text"
                defaultValue={search}
                placeholder="User, description, entity..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="action"
                className="mb-1.5 block text-xs font-semibold text-slate-600"
              >
                Action
              </label>

              <select
                id="action"
                name="action"
                defaultValue={action}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">All Actions</option>

                {AUDIT_ACTIONS.map((item) => (
                  <option key={item} value={item}>
                    {formatAction(item)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="entityType"
                className="mb-1.5 block text-xs font-semibold text-slate-600"
              >
                Entity
              </label>

              <select
                id="entityType"
                name="entityType"
                defaultValue={entityType}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">All Entities</option>

                {entityTypes.map((item) => (
                  <option
                    key={item.entityType}
                    value={item.entityType}
                  >
                    {formatEntityType(item.entityType)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="from"
                className="mb-1.5 block text-xs font-semibold text-slate-600"
              >
                From
              </label>

              <input
                id="from"
                name="from"
                type="date"
                defaultValue={from}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="to"
                className="mb-1.5 block text-xs font-semibold text-slate-600"
              >
                To
              </label>

              <input
                id="to"
                name="to"
                type="date"
                defaultValue={to}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="flex items-end gap-2 md:col-span-2 lg:col-span-5">
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Apply Filters
              </button>

              <Link
                href="/dashboard/audit"
                className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Clear Filters
              </Link>
            </div>
          </form>
        </section>

        {/* AUDIT TABLE */}
        <section className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">

          <div className="border-b border-slate-200 px-6 py-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Activity Log
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {totalLogs === 0
                  ? "No activity records found."
                  : `Showing ${Math.min(
                      (safePage - 1) * PAGE_SIZE + 1,
                      totalLogs
                    )}–${Math.min(
                      safePage * PAGE_SIZE,
                      totalLogs
                    )} of ${totalLogs} records.`}
              </p>
            </div>
          </div>

          {logs.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <ShieldCheck className="mx-auto h-12 w-12 text-slate-300" />

              <h3 className="mt-4 text-lg font-semibold text-slate-900">
                No audit activity found
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Try changing your filters or perform an action in LegalVault.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left">

                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      User
                    </th>

                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Action
                    </th>

                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Entity
                    </th>

                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Description
                    </th>

                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Date & Time
                    </th>

                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Details
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">

                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      className="align-top transition hover:bg-slate-50"
                    >

                      {/* USER */}
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {log.user.name}
                          </p>

                          <p className="mt-0.5 text-xs text-slate-500">
                            {log.user.email}
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            {formatEntityType(log.user.role)}
                          </p>
                        </div>
                      </td>

                      {/* ACTION */}
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getActionClasses(
                            log.action
                          )}`}
                        >
                          {formatAction(log.action)}
                        </span>
                      </td>

                      {/* ENTITY */}
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-slate-800">
                          {formatEntityType(log.entityType)}
                        </p>

                        {log.entityId && (
                          <p className="mt-1 max-w-[180px] truncate font-mono text-xs text-slate-400">
                            {log.entityId}
                          </p>
                        )}
                      </td>

                      {/* DESCRIPTION */}
                      <td className="max-w-md px-6 py-4">
                        <p className="text-sm text-slate-700">
                          {log.description ||
                            "No description provided."}
                        </p>

                        {log.ipAddress && (
                          <p className="mt-1 text-xs text-slate-400">
                            IP: {log.ipAddress}
                          </p>
                        )}
                      </td>

                      {/* DATE */}
                      <td className="whitespace-nowrap px-6 py-4">
                        <p className="text-sm text-slate-700">
                          {formatDateTime(log.createdAt)}
                        </p>
                      </td>

                      {/* DETAILS */}
                      <td className="px-6 py-4">

                        <details className="group min-w-[180px]">
                          <summary className="cursor-pointer list-none text-sm font-semibold text-blue-700 transition hover:text-blue-900">
                            <span className="group-open:hidden">
                              View Details
                            </span>

                            <span className="hidden group-open:inline">
                              Hide Details
                            </span>
                          </summary>

                          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4">

                            <div className="space-y-3 text-xs">

                              {/* AUDIT ID */}
                              <div>
                                <p className="font-semibold text-slate-500">
                                  Audit ID
                                </p>

                                <p className="mt-1 break-all font-mono text-slate-700">
                                  {log.id}
                                </p>
                              </div>

                              {/* ENTITY ID */}
                              {log.entityId && (
                                <div>
                                  <p className="font-semibold text-slate-500">
                                    Entity ID
                                  </p>

                                  <p className="mt-1 break-all font-mono text-slate-700">
                                    {log.entityId}
                                  </p>
                                </div>
                              )}

                              {/* IP ADDRESS */}
                              <div>
                                <p className="font-semibold text-slate-500">
                                  IP Address
                                </p>

                                <p className="mt-1 font-mono text-slate-700">
                                  {log.ipAddress || "Not recorded"}
                                </p>
                              </div>

                              {/* USER AGENT */}
                              <div>
                                <p className="font-semibold text-slate-500">
                                  Browser / User Agent
                                </p>

                                <p className="mt-1 break-words text-slate-700">
                                  {log.userAgent || "Not recorded"}
                                </p>
                              </div>

                              {/* METADATA */}
                              <div>
                                <p className="font-semibold text-slate-500">
                                  Metadata
                                </p>

                                {log.metadata ? (
                                  <pre className="mt-1 max-h-64 overflow-auto rounded-md bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">
                                    {JSON.stringify(
                                      log.metadata,
                                      null,
                                      2
                                    )}
                                  </pre>
                                ) : (
                                  <p className="mt-1 text-slate-500">
                                    No metadata recorded.
                                  </p>
                                )}
                              </div>

                              {/* EXACT TIMESTAMP */}
                              <div>
                                <p className="font-semibold text-slate-500">
                                  Recorded At
                                </p>

                                <p className="mt-1 font-mono text-slate-700">
                                  {log.createdAt.toISOString()}
                                </p>
                              </div>

                            </div>
                          </div>
                        </details>

                      </td>

                    </tr>
                  ))}

                </tbody>
              </table>
            </div>
          )}

          {/* PAGINATION */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">

              <p className="text-sm text-slate-500">
                Page {safePage} of {totalPages}
              </p>

              <div className="flex items-center gap-2">

                {safePage > 1 ? (
                  <Link
                    href={buildPageUrl(safePage - 1)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-400">
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </span>
                )}

                {safePage < totalPages ? (
                  <Link
                    href={buildPageUrl(safePage + 1)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-400">
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </span>
                )}

              </div>
            </div>
          )}

        </section>
      </div>
    </main>
  );
}