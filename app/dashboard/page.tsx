import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Users,
  BriefcaseBusiness,
  FileText,
  CheckSquare,
  ArrowRight,
  Clock,
  Building2,
  WalletCards,
  AlertCircle,
  CalendarDays,
  Mail,
  ClipboardCheck,
  CircleAlert,
  ListTodo,
} from "lucide-react";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";

function formatStatus(status: string) {
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getMatterStatusClasses(status: string) {
  switch (status) {
    case "OPEN":
      return "bg-green-100 text-green-700";

    case "PENDING":
      return "bg-yellow-100 text-yellow-700";

    case "CLOSED":
      return "bg-slate-200 text-slate-700";

    case "ARCHIVED":
      return "bg-red-100 text-red-700";

    default:
      return "bg-slate-100 text-slate-700";
  }
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
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

/**
 * LegalVault uses South African time for the working day.
 *
 * Johannesburg is UTC+2 year-round, so we calculate the
 * beginning and end of the South African calendar day and
 * convert those boundaries into Date objects for Prisma.
 */
function getSouthAfricaDayBounds(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = Number(
    parts.find((part) => part.type === "year")?.value
  );

  const month = Number(
    parts.find((part) => part.type === "month")?.value
  );

  const day = Number(
    parts.find((part) => part.type === "day")?.value
  );

  const start = new Date(
    Date.UTC(year, month - 1, day) - 2 * 60 * 60 * 1000
  );

  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  return {
    start,
    end,
  };
}

function getPriorityClasses(priority: string) {
  switch (priority) {
    case "URGENT":
      return "bg-red-100 text-red-700";

    case "HIGH":
      return "bg-orange-100 text-orange-700";

    case "MEDIUM":
      return "bg-yellow-100 text-yellow-700";

    case "LOW":
      return "bg-slate-100 text-slate-600";

    default:
      return "bg-slate-100 text-slate-600";
  }
}

function getCorrespondenceStatusClasses(status: string) {
  switch (status) {
    case "ACTION_REQUIRED":
      return "bg-red-100 text-red-700";

    case "ASSIGNED":
      return "bg-blue-100 text-blue-700";

    case "RESPONDED":
      return "bg-green-100 text-green-700";

    case "CLOSED":
      return "bg-slate-200 text-slate-700";

    default:
      return "bg-yellow-100 text-yellow-700";
  }
}

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const firmId = session.user.firmId;

  if (!firmId) {
    redirect("/login");
  }

  const userId = session.user.id;
  const role = session.user.role;

  const isFinanceUser = role === "FINANCE";

  const canCreateClient = hasPermission(
    role,
    "clients.create"
  );

  const canCreateMatter = hasPermission(
    role,
    "matters.create"
  );

  const canUploadDocument = hasPermission(
    role,
    "documents.upload"
  );

  const canCreateTask = hasPermission(
    role,
    "tasks.create"
  );

  const canCreateCorrespondence = hasPermission(
    role,
    "correspondence.create"
  );

  const { start: todayStart, end: tomorrowStart } =
    getSouthAfricaDayBounds();

  const now = new Date();

  /*
   * ============================================================
   * DASHBOARD DATA
   * ============================================================
   *
   * Everything below uses existing LegalVault records.
   * No new database model is required.
   */

  const [
    firm,
    clientsCount,
    mattersCount,
    documentsCount,
    tasksCount,

    recentDocuments,
    recentMatters,

    overdueTasks,
    todayTasks,
    reportRequiredTasks,
    upcomingTasks,

    overdueDeadlines,
    todayDeadlines,
    upcomingDeadlines,

    actionCorrespondence,
    overdueCorrespondence,
    todayCorrespondence,
    upcomingCorrespondence,
  ] = await Promise.all([
    /*
     * FIRM
     */
    prisma.firm.findUnique({
      where: {
        id: firmId,
      },
      select: {
        name: true,
        referenceNumber: true,
      },
    }),

    /*
     * COUNTS
     */
    prisma.client.count({
      where: {
        firmId,
      },
    }),

    prisma.matter.count({
      where: {
        firmId,
      },
    }),

    prisma.document.count({
      where: {
        firmId,
        status: "ACTIVE",
      },
    }),

    prisma.task.count({
      where: {
        firmId,
        assignedToId: userId,
        status: {
          not: "COMPLETED",
        },
      },
    }),

    /*
     * RECENT DOCUMENTS
     */
    prisma.document.findMany({
      where: {
        firmId,
        status: "ACTIVE",
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
      select: {
        id: true,
        referenceNumber: true,
        name: true,
        originalName: true,
        createdAt: true,
      },
    }),

    /*
     * RECENT MATTERS
     */
    prisma.matter.findMany({
      where: {
        firmId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
      select: {
        id: true,
        referenceNumber: true,
        title: true,
        status: true,
        createdAt: true,
      },
    }),

    /*
     * ==========================================================
     * MY DAY — OVERDUE TASKS
     * ==========================================================
     */
    prisma.task.findMany({
      where: {
        firmId,
        assignedToId: userId,
        status: {
          not: "COMPLETED",
        },
        dueDate: {
          lt: now,
        },
      },
      orderBy: [
        {
          dueDate: "asc",
        },
        {
          priority: "desc",
        },
      ],
      take: 8,
      select: {
        id: true,
        title: true,
        priority: true,
        status: true,
        dueDate: true,
        matterId: true,
        matter: {
          select: {
            id: true,
            referenceNumber: true,
            title: true,
          },
        },
      },
    }),

    /*
     * ==========================================================
     * MY DAY — TASKS DUE TODAY
     * ==========================================================
     */
    prisma.task.findMany({
      where: {
        firmId,
        assignedToId: userId,
        status: {
          not: "COMPLETED",
        },
        dueDate: {
          gte: todayStart,
          lt: tomorrowStart,
        },
      },
      orderBy: [
        {
          dueDate: "asc",
        },
        {
          priority: "desc",
        },
      ],
      take: 8,
      select: {
        id: true,
        title: true,
        priority: true,
        status: true,
        dueDate: true,
        matterId: true,
        matter: {
          select: {
            id: true,
            referenceNumber: true,
            title: true,
          },
        },
      },
    }),

    /*
     * ==========================================================
     * MY DAY — REPORTS REQUIRED
     * ==========================================================
     */
    prisma.task.findMany({
      where: {
        firmId,
        assignedToId: userId,
        requiresReport: true,
        reportSubmittedAt: null,
        status: {
          not: "COMPLETED",
        },
      },
      orderBy: [
        {
          dueDate: "asc",
        },
        {
          priority: "desc",
        },
      ],
      take: 8,
      select: {
        id: true,
        title: true,
        priority: true,
        status: true,
        dueDate: true,
        matterId: true,
        matter: {
          select: {
            id: true,
            referenceNumber: true,
            title: true,
          },
        },
      },
    }),

    /*
     * ==========================================================
     * MY DAY — UPCOMING TASKS
     * ==========================================================
     */
    prisma.task.findMany({
      where: {
        firmId,
        assignedToId: userId,
        status: {
          not: "COMPLETED",
        },
        dueDate: {
          gt: tomorrowStart,
        },
      },
      orderBy: {
        dueDate: "asc",
      },
      take: 6,
      select: {
        id: true,
        title: true,
        priority: true,
        status: true,
        dueDate: true,
        matterId: true,
        matter: {
          select: {
            id: true,
            referenceNumber: true,
            title: true,
          },
        },
      },
    }),

    /*
     * ==========================================================
     * MY DAY — OVERDUE DEADLINES
     *
     * We use completedAt rather than guessing DeadlineStatus
     * enum values.
     * ==========================================================
     */
    prisma.deadline.findMany({
      where: {
        firmId,
        assignedToId: userId,
        completedAt: null,
        dueDate: {
          lt: now,
        },
      },
      orderBy: {
        dueDate: "asc",
      },
      take: 8,
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        priority: true,
        status: true,
        dueDate: true,
        matterId: true,
        matter: {
          select: {
            id: true,
            referenceNumber: true,
            title: true,
          },
        },
      },
    }),

    /*
     * ==========================================================
     * MY DAY — DEADLINES DUE TODAY
     * ==========================================================
     */
    prisma.deadline.findMany({
      where: {
        firmId,
        assignedToId: userId,
        completedAt: null,
        dueDate: {
          gte: todayStart,
          lt: tomorrowStart,
        },
      },
      orderBy: {
        dueDate: "asc",
      },
      take: 8,
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        priority: true,
        status: true,
        dueDate: true,
        matterId: true,
        matter: {
          select: {
            id: true,
            referenceNumber: true,
            title: true,
          },
        },
      },
    }),

    /*
     * ==========================================================
     * MY DAY — UPCOMING DEADLINES
     * ==========================================================
     */
    prisma.deadline.findMany({
      where: {
        firmId,
        assignedToId: userId,
        completedAt: null,
        dueDate: {
          gt: tomorrowStart,
        },
      },
      orderBy: {
        dueDate: "asc",
      },
      take: 6,
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        priority: true,
        status: true,
        dueDate: true,
        matterId: true,
        matter: {
          select: {
            id: true,
            referenceNumber: true,
            title: true,
          },
        },
      },
    }),

    /*
     * ==========================================================
     * MY DAY — CORRESPONDENCE REQUIRING ACTION
     * ==========================================================
     */
    prisma.correspondence.findMany({
      where: {
        firmId,
        responsibleUserId: userId,
        responseRequired: true,
        status: {
          notIn: ["RESPONDED", "CLOSED"],
        },
      },
      orderBy: {
        responseDeadline: "asc",
      },
      take: 8,
      select: {
        id: true,
        direction: true,
        correspondenceDate: true,
        sender: true,
        recipient: true,
        subject: true,
        type: true,
        status: true,
        responseRequired: true,
        responseDeadline: true,
        matterId: true,
        matter: {
          select: {
            id: true,
            referenceNumber: true,
            title: true,
          },
        },
      },
    }),

    /*
     * ==========================================================
     * MY DAY — OVERDUE CORRESPONDENCE
     * ==========================================================
     */
    prisma.correspondence.findMany({
      where: {
        firmId,
        responsibleUserId: userId,
        responseRequired: true,
        status: {
          notIn: ["RESPONDED", "CLOSED"],
        },
        responseDeadline: {
          lt: now,
        },
      },
      orderBy: {
        responseDeadline: "asc",
      },
      take: 8,
      select: {
        id: true,
        direction: true,
        correspondenceDate: true,
        sender: true,
        recipient: true,
        subject: true,
        type: true,
        status: true,
        responseRequired: true,
        responseDeadline: true,
        matterId: true,
        matter: {
          select: {
            id: true,
            referenceNumber: true,
            title: true,
          },
        },
      },
    }),

    /*
     * ==========================================================
     * MY DAY — CORRESPONDENCE DUE TODAY
     * ==========================================================
     */
    prisma.correspondence.findMany({
      where: {
        firmId,
        responsibleUserId: userId,
        responseRequired: true,
        status: {
          notIn: ["RESPONDED", "CLOSED"],
        },
        responseDeadline: {
          gte: todayStart,
          lt: tomorrowStart,
        },
      },
      orderBy: {
        responseDeadline: "asc",
      },
      take: 8,
      select: {
        id: true,
        direction: true,
        correspondenceDate: true,
        sender: true,
        recipient: true,
        subject: true,
        type: true,
        status: true,
        responseRequired: true,
        responseDeadline: true,
        matterId: true,
        matter: {
          select: {
            id: true,
            referenceNumber: true,
            title: true,
          },
        },
      },
    }),

    /*
     * ==========================================================
     * MY DAY — UPCOMING CORRESPONDENCE
     * ==========================================================
     */
    prisma.correspondence.findMany({
      where: {
        firmId,
        responsibleUserId: userId,
        responseRequired: true,
        status: {
          notIn: ["RESPONDED", "CLOSED"],
        },
        responseDeadline: {
          gt: tomorrowStart,
        },
      },
      orderBy: {
        responseDeadline: "asc",
      },
      take: 6,
      select: {
        id: true,
        direction: true,
        correspondenceDate: true,
        sender: true,
        recipient: true,
        subject: true,
        type: true,
        status: true,
        responseRequired: true,
        responseDeadline: true,
        matterId: true,
        matter: {
          select: {
            id: true,
            referenceNumber: true,
            title: true,
          },
        },
      },
    }),
  ]);

  /*
   * ============================================================
   * MY DAY COUNTS
   * ============================================================
   */

  const overdueCount =
    overdueTasks.length +
    overdueDeadlines.length +
    overdueCorrespondence.length;

  const dueTodayCount =
    todayTasks.length +
    todayDeadlines.length +
    todayCorrespondence.length;

  const reportCount = reportRequiredTasks.length;

  const actionCount = actionCorrespondence.length;

  const upcomingCount =
    upcomingTasks.length +
    upcomingDeadlines.length +
    upcomingCorrespondence.length;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-6 py-8">

        {/* ===================================================== */}
        {/* MY DAY COMMAND CENTRE */}
        {/* ===================================================== */}

        <section className="mb-8">

          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">

            <div>
              <p className="text-sm font-semibold text-slate-500">
                LegalVault · My Day
              </p>

              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                Good morning, {session.user.name || "User"}
              </h1>

              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                Your employee command centre. Start with what needs your
                attention, then move through today's work.
              </p>
            </div>

            <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 shadow-sm ring-1 ring-slate-200">

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                <Building2 className="h-5 w-5" />
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {firm?.name || "Law Firm"}
                </p>

                <p className="mt-1 font-mono text-xs text-slate-500">
                  {firm?.referenceNumber || "—"}
                </p>
              </div>

            </div>

          </div>

          {/* ===================================================== */}
          {/* NEEDS ATTENTION */}
          {/* ===================================================== */}

          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50/60 p-5">

            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

              <div>
                <div className="flex items-center gap-2">
                  <CircleAlert className="h-5 w-5 text-red-700" />

                  <h2 className="text-sm font-bold uppercase tracking-wide text-red-800">
                    Needs Attention
                  </h2>
                </div>

                <p className="mt-1 text-sm text-red-700/80">
                  {overdueCount > 0
                    ? "These items require attention before you continue with your day."
                    : "Nothing is overdue right now."}
                </p>
              </div>

              <Link
                href="/dashboard/tasks?filter=overdue"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-red-700 shadow-sm ring-1 ring-red-200 transition hover:bg-red-50"
              >
                Open attention queue
                <ArrowRight className="h-4 w-4" />
              </Link>

            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">

              {/* OVERDUE */}

              <Link
                href="/dashboard/tasks?filter=overdue"
                className="group rounded-xl bg-white p-4 shadow-sm ring-1 ring-red-100 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center justify-between">

                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-700">
                      <AlertCircle className="h-5 w-5" />
                    </div>

                    <div>
                      <p className="text-xs font-medium text-slate-500">
                        Overdue
                      </p>

                      <p className="mt-0.5 text-2xl font-bold text-red-700">
                        {overdueCount}
                      </p>
                    </div>
                  </div>

                  <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-1 group-hover:text-red-600" />

                </div>

                <p className="mt-3 text-xs text-slate-500">
                  Tasks, deadlines and responses
                </p>
              </Link>

              {/* DUE TODAY */}

              <Link
                href="/dashboard/tasks"
                className="group rounded-xl bg-white p-4 shadow-sm ring-1 ring-blue-100 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center justify-between">

                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                      <CalendarDays className="h-5 w-5" />
                    </div>

                    <div>
                      <p className="text-xs font-medium text-slate-500">
                        Due Today
                      </p>

                      <p className="mt-0.5 text-2xl font-bold text-slate-900">
                        {dueTodayCount}
                      </p>
                    </div>
                  </div>

                  <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-1 group-hover:text-blue-600" />

                </div>

                <p className="mt-3 text-xs text-slate-500">
                  Tasks, deadlines and responses
                </p>
              </Link>

              {/* REPORTS */}

              <Link
                href="/dashboard/tasks?filter=report-required"
                className="group rounded-xl bg-white p-4 shadow-sm ring-1 ring-purple-100 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center justify-between">

                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
                      <ClipboardCheck className="h-5 w-5" />
                    </div>

                    <div>
                      <p className="text-xs font-medium text-slate-500">
                        Reports Awaiting Review
                      </p>

                      <p className="mt-0.5 text-2xl font-bold text-slate-900">
                        {reportCount}
                      </p>
                    </div>
                  </div>

                  <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-1 group-hover:text-purple-600" />

                </div>

                <p className="mt-3 text-xs text-slate-500">
                  Delegated work requiring your report
                </p>
              </Link>

            </div>

          </div>

          {/* ===================================================== */}
          {/* TODAY */}
          {/* ===================================================== */}

          <div className="mt-6">

            <div className="mb-3 flex items-end justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Today
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Your work for today at a glance.
                </p>
              </div>

              <Link
                href="/dashboard/tasks"
                className="hidden text-sm font-semibold text-slate-700 hover:text-slate-900 sm:inline-flex"
              >
                View work
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

              <Link
                href="/dashboard/tasks"
                className="group rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                    <CheckSquare className="h-5 w-5" />
                  </div>

                  <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-1 group-hover:text-blue-600" />
                </div>

                <p className="mt-4 text-sm font-semibold text-slate-900">
                  Tasks
                </p>

                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {todayTasks.length}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Due today
                </p>
              </Link>

              <Link
                href="/dashboard/deadlines"
                className="group rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-700">
                    <CalendarDays className="h-5 w-5" />
                  </div>

                  <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-1 group-hover:text-purple-600" />
                </div>

                <p className="mt-4 text-sm font-semibold text-slate-900">
                  Deadlines
                </p>

                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {todayDeadlines.length}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Due today
                </p>
              </Link>

              <Link
                href="/dashboard/correspondence"
                className="group rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 text-orange-700">
                    <Mail className="h-5 w-5" />
                  </div>

                  <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-1 group-hover:text-orange-600" />
                </div>

                <p className="mt-4 text-sm font-semibold text-slate-900">
                  Correspondence
                </p>

                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {todayCorrespondence.length}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Responses due today
                </p>
              </Link>

            </div>

          </div>

          {/* ===================================================== */}
          {/* UPCOMING */}
          {/* ===================================================== */}

          <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

              <div>
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-slate-700" />

                  <h2 className="text-base font-bold text-slate-900">
                    Upcoming
                  </h2>
                </div>

                <p className="mt-1 text-sm text-slate-500">
                  Next 7 days of assigned work.
                </p>
              </div>

              <div className="flex items-center gap-5 text-sm">
                <div>
                  <span className="font-bold text-slate-900">
                    {upcomingTasks.length}
                  </span>{" "}
                  <span className="text-slate-500">tasks</span>
                </div>

                <div>
                  <span className="font-bold text-slate-900">
                    {upcomingDeadlines.length}
                  </span>{" "}
                  <span className="text-slate-500">deadlines</span>
                </div>

                <div>
                  <span className="font-bold text-slate-900">
                    {upcomingCorrespondence.length}
                  </span>{" "}
                  <span className="text-slate-500">responses</span>
                </div>
              </div>

            </div>

          </div>

          {/* ===================================================== */}
          {/* QUICK ACTIONS */}
          {/* ===================================================== */}

          <div className="mt-6">

            <div className="mb-3">
              <h2 className="text-lg font-bold text-slate-900">
                Quick Actions
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Start a common piece of work without searching through menus.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">

              {canCreateTask && (
                <Link
                  href="/dashboard/tasks/new"
                  className="inline-flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  <span>Delegate Task</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}

              {canCreateCorrespondence && (
                <Link
                  href="/dashboard/correspondence/new"
                  className="inline-flex items-center justify-between rounded-xl bg-white px-4 py-3.5 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
                >
                  <span>Add Correspondence</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}

              <Link
                href="/dashboard/deadlines/new"
                className="inline-flex items-center justify-between rounded-xl bg-white px-4 py-3.5 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
              >
                <span>Add Deadline</span>
                <ArrowRight className="h-4 w-4" />
              </Link>

              {canCreateMatter && (
                <Link
                  href="/dashboard/matters/new"
                  className="inline-flex items-center justify-between rounded-xl bg-white px-4 py-3.5 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
                >
                  <span>Add Matter</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}

            </div>

          </div>

        </section>

        {/* ===================================================== */}
        {/* OVERDUE WORK */}
        {/* ===================================================== */}

        {overdueCount > 0 && (
          <section className="mb-8">

            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Needs Attention
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  These items are already overdue.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

              {/* OVERDUE TASKS */}

              <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-red-200">

                <div className="border-b border-slate-200 px-5 py-4">
                  <div className="flex items-center gap-3">

                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-700">
                      <ListTodo className="h-4 w-4" />
                    </div>

                    <div>
                      <h3 className="font-semibold text-slate-900">
                        Overdue Tasks
                      </h3>

                      <p className="text-xs text-slate-500">
                        {overdueTasks.length} overdue
                      </p>
                    </div>

                  </div>
                </div>

                {overdueTasks.length === 0 ? (
                  <div className="p-6 text-center text-sm text-slate-500">
                    No overdue tasks.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">

                    {overdueTasks.map((task) => (
                      <Link
                        key={task.id}
                        href={`/dashboard/tasks/${task.id}`}
                        className="group block p-5 transition hover:bg-red-50"
                      >

                        <div className="flex items-start justify-between gap-3">

                          <div className="min-w-0">

                            <p className="font-semibold text-slate-900 group-hover:text-red-700">
                              {task.title}
                            </p>

                            {task.matter && (
                              <p className="mt-1 truncate text-xs text-slate-500">
                                {task.matter.referenceNumber} ·{" "}
                                {task.matter.title}
                              </p>
                            )}

                            {task.dueDate && (
                              <p className="mt-2 flex items-center gap-1 text-xs font-medium text-red-600">
                                <Clock className="h-3 w-3" />
                                Due {formatDateTime(task.dueDate)}
                              </p>
                            )}

                          </div>

                          <span
                            className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${getPriorityClasses(
                              task.priority
                            )}`}
                          >
                            {formatStatus(task.priority)}
                          </span>

                        </div>

                        <div className="mt-4">
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold text-white transition group-hover:bg-red-800">
                            Open Task
                            <ArrowRight className="h-3.5 w-3.5" />
                          </span>
                        </div>

                      </Link>
                    ))}

                  </div>
                )}

              </section>

              {/* OVERDUE DEADLINES */}

              <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-red-200">

                <div className="border-b border-slate-200 px-5 py-4">
                  <div className="flex items-center gap-3">

                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-700">
                      <CalendarDays className="h-4 w-4" />
                    </div>

                    <div>
                      <h3 className="font-semibold text-slate-900">
                        Overdue Deadlines
                      </h3>

                      <p className="text-xs text-slate-500">
                        {overdueDeadlines.length} overdue
                      </p>
                    </div>

                  </div>
                </div>

                {overdueDeadlines.length === 0 ? (
                  <div className="p-6 text-center text-sm text-slate-500">
                    No overdue deadlines.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">

                    {overdueDeadlines.map((deadline) => (
                      <Link
                        key={deadline.id}
                        href={`/dashboard/deadlines/${deadline.id}`}
                        className="group block p-5 transition hover:bg-red-50"
                      >

                        <p className="font-semibold text-slate-900 group-hover:text-red-700">
                          {deadline.title}
                        </p>

                        {deadline.matter && (
                          <p className="mt-1 truncate text-xs text-slate-500">
                            {deadline.matter.referenceNumber} ·{" "}
                            {deadline.matter.title}
                          </p>
                        )}

                        <p className="mt-2 flex items-center gap-1 text-xs font-medium text-red-600">
                          <Clock className="h-3 w-3" />
                          Due {formatDateTime(deadline.dueDate)}
                        </p>

                        <div className="mt-4">
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold text-white transition group-hover:bg-red-800">
                            Open Deadline
                            <ArrowRight className="h-3.5 w-3.5" />
                          </span>
                        </div>

                      </Link>
                    ))}

                  </div>
                )}

              </section>

              {/* OVERDUE CORRESPONDENCE */}

              <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-red-200">

                <div className="border-b border-slate-200 px-5 py-4">
                  <div className="flex items-center gap-3">

                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-700">
                      <Mail className="h-4 w-4" />
                    </div>

                    <div>
                      <h3 className="font-semibold text-slate-900">
                        Overdue Responses
                      </h3>

                      <p className="text-xs text-slate-500">
                        {overdueCorrespondence.length} overdue
                      </p>
                    </div>

                  </div>
                </div>

                {overdueCorrespondence.length === 0 ? (
                  <div className="p-6 text-center text-sm text-slate-500">
                    No overdue correspondence.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">

                    {overdueCorrespondence.map((correspondence) => (
                      <Link
                        key={correspondence.id}
                        href={`/dashboard/correspondence/${correspondence.id}`}
                        className="group block p-5 transition hover:bg-red-50"
                      >

                        <p className="font-semibold text-slate-900 group-hover:text-red-700">
                          {correspondence.subject}
                        </p>

                        <p className="mt-1 truncate text-xs text-slate-500">
                          {correspondence.sender}
                        </p>

                        {correspondence.responseDeadline && (
                          <p className="mt-2 flex items-center gap-1 text-xs font-medium text-red-600">
                            <Clock className="h-3 w-3" />
                            Response due{" "}
                            {formatDateTime(
                              correspondence.responseDeadline
                            )}
                          </p>
                        )}

                        <div className="mt-4">
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold text-white transition group-hover:bg-red-800">
                            Open Correspondence
                            <ArrowRight className="h-3.5 w-3.5" />
                          </span>
                        </div>

                      </Link>
                    ))}

                  </div>
                )}

              </section>

            </div>
          </section>
        )}

        {/* ===================================================== */}
        {/* TODAY'S WORK */}
        {/* ===================================================== */}

        <section className="mb-8">

          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900">
              Today's Work
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Tasks, deadlines and correspondence due today.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

            {/* TODAY TASKS */}

            <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">

              <div className="border-b border-slate-200 px-5 py-4">
                <div className="flex items-center gap-3">

                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                    <CheckSquare className="h-4 w-4" />
                  </div>

                  <div>
                    <h3 className="font-semibold text-slate-900">
                      Tasks Due Today
                    </h3>

                    <p className="text-xs text-slate-500">
                      {todayTasks.length} task
                      {todayTasks.length === 1 ? "" : "s"}
                    </p>
                  </div>

                </div>
              </div>

              {todayTasks.length === 0 ? (
                <div className="p-6 text-center">

                  <CheckSquare className="mx-auto h-8 w-8 text-slate-300" />

                  <p className="mt-2 text-sm font-medium text-slate-700">
                    No tasks due today
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    You are up to date.
                  </p>

                </div>
              ) : (
                <div className="divide-y divide-slate-100">

                  {todayTasks.map((task) => (
                    <Link
                      key={task.id}
                      href={`/dashboard/tasks/${task.id}`}
                      className="group block p-5 transition hover:bg-slate-50"
                    >

                      <div className="flex items-start justify-between gap-3">

                        <div className="min-w-0">

                          <p className="font-semibold text-slate-900 group-hover:text-blue-700">
                            {task.title}
                          </p>

                          {task.matter && (
                            <p className="mt-1 truncate text-xs text-slate-500">
                              {task.matter.referenceNumber}
                            </p>
                          )}

                          {task.dueDate && (
                            <p className="mt-2 flex items-center gap-1 text-xs text-slate-400">
                              <Clock className="h-3 w-3" />
                              {formatDateTime(task.dueDate)}
                            </p>
                          )}

                        </div>

                        <span
                          className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${getPriorityClasses(
                            task.priority
                          )}`}
                        >
                          {formatStatus(task.priority)}
                        </span>

                      </div>

                      <div className="mt-4">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700">
                          Open Task
                          <ArrowRight className="h-3.5 w-3.5" />
                        </span>
                      </div>

                    </Link>
                  ))}

                </div>
              )}

            </section>

            {/* TODAY DEADLINES */}

            <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">

              <div className="border-b border-slate-200 px-5 py-4">
                <div className="flex items-center gap-3">

                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 text-purple-700">
                    <CalendarDays className="h-4 w-4" />
                  </div>

                  <div>
                    <h3 className="font-semibold text-slate-900">
                      Deadlines Due Today
                    </h3>

                    <p className="text-xs text-slate-500">
                      {todayDeadlines.length} deadline
                      {todayDeadlines.length === 1 ? "" : "s"}
                    </p>
                  </div>

                </div>
              </div>

              {todayDeadlines.length === 0 ? (
                <div className="p-6 text-center">

                  <CalendarDays className="mx-auto h-8 w-8 text-slate-300" />

                  <p className="mt-2 text-sm font-medium text-slate-700">
                    No deadlines today
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    No assigned deadlines are due today.
                  </p>

                </div>
              ) : (
                <div className="divide-y divide-slate-100">

                  {todayDeadlines.map((deadline) => (
                    <Link
                      key={deadline.id}
                      href={`/dashboard/deadlines/${deadline.id}`}
                      className="group block p-5 transition hover:bg-slate-50"
                    >

                      <div className="flex items-start justify-between gap-3">

                        <div className="min-w-0">

                          <p className="font-semibold text-slate-900 group-hover:text-purple-700">
                            {deadline.title}
                          </p>

                          {deadline.matter && (
                            <p className="mt-1 truncate text-xs text-slate-500">
                              {deadline.matter.referenceNumber}
                            </p>
                          )}

                          <p className="mt-2 flex items-center gap-1 text-xs text-slate-400">
                            <Clock className="h-3 w-3" />
                            {formatDateTime(deadline.dueDate)}
                          </p>

                        </div>

                        <span
                          className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${getPriorityClasses(
                            deadline.priority
                          )}`}
                        >
                          {formatStatus(deadline.priority)}
                        </span>

                      </div>

                      <div className="mt-4">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700">
                          Open Deadline
                          <ArrowRight className="h-3.5 w-3.5" />
                        </span>
                      </div>

                    </Link>
                  ))}

                </div>
              )}

            </section>

            {/* TODAY CORRESPONDENCE */}

            <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">

              <div className="border-b border-slate-200 px-5 py-4">
                <div className="flex items-center gap-3">

                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50 text-orange-700">
                    <Mail className="h-4 w-4" />
                  </div>

                  <div>
                    <h3 className="font-semibold text-slate-900">
                      Responses Due Today
                    </h3>

                    <p className="text-xs text-slate-500">
                      {todayCorrespondence.length} response
                      {todayCorrespondence.length === 1 ? "" : "s"}
                    </p>
                  </div>

                </div>
              </div>

              {todayCorrespondence.length === 0 ? (
                <div className="p-6 text-center">

                  <Mail className="mx-auto h-8 w-8 text-slate-300" />

                  <p className="mt-2 text-sm font-medium text-slate-700">
                    No responses due today
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    No correspondence responses are due today.
                  </p>

                </div>
              ) : (
                <div className="divide-y divide-slate-100">

                  {todayCorrespondence.map((correspondence) => (
                    <Link
                      key={correspondence.id}
                      href={`/dashboard/correspondence/${correspondence.id}`}
                      className="group block p-5 transition hover:bg-slate-50"
                    >

                      <div className="flex items-start justify-between gap-3">

                        <div className="min-w-0">

                          <p className="truncate font-semibold text-slate-900 group-hover:text-orange-700">
                            {correspondence.subject}
                          </p>

                          <p className="mt-1 truncate text-xs text-slate-500">
                            {correspondence.sender}
                          </p>

                          {correspondence.responseDeadline && (
                            <p className="mt-2 flex items-center gap-1 text-xs text-slate-400">
                              <Clock className="h-3 w-3" />
                              {formatDateTime(
                                correspondence.responseDeadline
                              )}
                            </p>
                          )}

                        </div>

                        <span
                          className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${getCorrespondenceStatusClasses(
                            correspondence.status
                          )}`}
                        >
                          {formatStatus(correspondence.status)}
                        </span>

                      </div>

                      <div className="mt-4">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-700">
                          Open Correspondence
                          <ArrowRight className="h-3.5 w-3.5" />
                        </span>
                      </div>

                    </Link>
                  ))}

                </div>
              )}

            </section>

          </div>
        </section>

        {/* ===================================================== */}
        {/* REPORTS REQUIRED */}
        {/* ===================================================== */}

        {reportRequiredTasks.length > 0 && (
          <section className="mb-8 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-purple-200">

            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">

              <div>
                <div className="flex items-center gap-3">

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
                    <ClipboardCheck className="h-5 w-5" />
                  </div>

                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Reports Required
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Report back on the following delegated work.
                    </p>
                  </div>

                </div>
              </div>

              <Link
                href="/dashboard/tasks?filter=report-required"
                className="text-sm font-semibold text-purple-700 hover:text-purple-900"
              >
                View all
              </Link>

            </div>

            <div className="divide-y divide-slate-100">

              {reportRequiredTasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/dashboard/tasks/${task.id}`}
                  className="group block px-6 py-5 transition hover:bg-purple-50"
                >

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                    <div className="min-w-0">

                      <p className="font-semibold text-slate-900 group-hover:text-purple-700">
                        {task.title}
                      </p>

                      {task.matter && (
                        <p className="mt-1 text-xs text-slate-500">
                          {task.matter.referenceNumber} ·{" "}
                          {task.matter.title}
                        </p>
                      )}

                    </div>

                    <div className="flex shrink-0 items-center gap-3">

                      {task.dueDate && (
                        <span className="text-xs text-slate-500">
                          Due {formatDate(task.dueDate)}
                        </span>
                      )}

                      <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
                        Report Required
                      </span>

                      <ArrowRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-purple-600" />

                    </div>

                  </div>

                </Link>
              ))}

            </div>

          </section>
        )}

        {/* ===================================================== */}
        {/* UPCOMING WORK */}
        {/* ===================================================== */}

        {upcomingCount > 0 && (
          <section className="mb-8">

            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-900">
                Upcoming Work
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Work coming up after today.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

              {/* UPCOMING TASKS */}

              <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">

                <div className="border-b border-slate-200 px-5 py-4">

                  <div className="flex items-center gap-3">

                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                      <CheckSquare className="h-4 w-4" />
                    </div>

                    <div>
                      <h3 className="font-semibold text-slate-900">
                        Upcoming Tasks
                      </h3>

                      <p className="text-xs text-slate-500">
                        Next assigned tasks
                      </p>
                    </div>

                  </div>

                </div>

                {upcomingTasks.length === 0 ? (
                  <div className="p-6 text-center text-sm text-slate-500">
                    No upcoming tasks.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">

                    {upcomingTasks.map((task) => (
                      <Link
                        key={task.id}
                        href={`/dashboard/tasks/${task.id}`}
                        className="group block p-5 transition hover:bg-slate-50"
                      >

                        <p className="font-semibold text-slate-900 group-hover:text-blue-700">
                          {task.title}
                        </p>

                        {task.matter && (
                          <p className="mt-1 truncate text-xs text-slate-500">
                            {task.matter.referenceNumber}
                          </p>
                        )}

                        {task.dueDate && (
                          <p className="mt-2 flex items-center gap-1 text-xs text-slate-400">
                            <Clock className="h-3 w-3" />
                            {formatDate(task.dueDate)}
                          </p>
                        )}

                        <div className="mt-3">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700">
                            Open Task
                            <ArrowRight className="h-3.5 w-3.5" />
                          </span>
                        </div>

                      </Link>
                    ))}

                  </div>
                )}

              </section>

              {/* UPCOMING DEADLINES */}

              <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">

                <div className="border-b border-slate-200 px-5 py-4">

                  <div className="flex items-center gap-3">

                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 text-purple-700">
                      <CalendarDays className="h-4 w-4" />
                    </div>

                    <div>
                      <h3 className="font-semibold text-slate-900">
                        Upcoming Deadlines
                      </h3>

                      <p className="text-xs text-slate-500">
                        Next legal deadlines
                      </p>
                    </div>

                  </div>

                </div>

                {upcomingDeadlines.length === 0 ? (
                  <div className="p-6 text-center text-sm text-slate-500">
                    No upcoming deadlines.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">

                    {upcomingDeadlines.map((deadline) => (
                      <Link
                        key={deadline.id}
                        href={`/dashboard/deadlines/${deadline.id}`}
                        className="group block p-5 transition hover:bg-slate-50"
                      >

                        <p className="font-semibold text-slate-900 group-hover:text-purple-700">
                          {deadline.title}
                        </p>

                        {deadline.matter && (
                          <p className="mt-1 truncate text-xs text-slate-500">
                            {deadline.matter.referenceNumber}
                          </p>
                        )}

                        <p className="mt-2 flex items-center gap-1 text-xs text-slate-400">
                          <Clock className="h-3 w-3" />
                          {formatDate(deadline.dueDate)}
                        </p>

                        <div className="mt-3">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700">
                            Open Deadline
                            <ArrowRight className="h-3.5 w-3.5" />
                          </span>
                        </div>

                      </Link>
                    ))}

                  </div>
                )}

              </section>

              {/* UPCOMING CORRESPONDENCE */}

              <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">

                <div className="border-b border-slate-200 px-5 py-4">

                  <div className="flex items-center gap-3">

                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50 text-orange-700">
                      <Mail className="h-4 w-4" />
                    </div>

                    <div>
                      <h3 className="font-semibold text-slate-900">
                        Upcoming Responses
                      </h3>

                      <p className="text-xs text-slate-500">
                        Future correspondence responses
                      </p>
                    </div>

                  </div>

                </div>

                {upcomingCorrespondence.length === 0 ? (
                  <div className="p-6 text-center text-sm text-slate-500">
                    No upcoming responses.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">

                    {upcomingCorrespondence.map((correspondence) => (
                      <Link
                        key={correspondence.id}
                        href={`/dashboard/correspondence/${correspondence.id}`}
                        className="group block p-5 transition hover:bg-slate-50"
                      >

                        <p className="truncate font-semibold text-slate-900 group-hover:text-orange-700">
                          {correspondence.subject}
                        </p>

                        <p className="mt-1 truncate text-xs text-slate-500">
                          {correspondence.sender}
                        </p>

                        {correspondence.responseDeadline && (
                          <p className="mt-2 flex items-center gap-1 text-xs text-slate-400">
                            <Clock className="h-3 w-3" />
                            {formatDate(correspondence.responseDeadline)}
                          </p>
                        )}

                        <div className="mt-3">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-700">
                            Open Correspondence
                            <ArrowRight className="h-3.5 w-3.5" />
                          </span>
                        </div>

                      </Link>
                    ))}

                  </div>
                )}

              </section>

            </div>
          </section>
        )}

        {/* ===================================================== */}
        {/* QUICK ACCESS */}
        {/* ===================================================== */}

        <section className="mb-8">

          <div className="mb-4">

            <h2 className="text-lg font-bold text-slate-900">
              Quick Access
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Access the main areas of your legal practice.
            </p>

          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

            {/* CLIENTS */}

            <Link
              href="/dashboard/clients"
              className="group rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-blue-200"
            >

              <div className="flex items-start justify-between">

                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <Users className="h-6 w-6" />
                </div>

                <ArrowRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-blue-600" />

              </div>

              <p className="mt-5 text-sm font-medium text-slate-500">
                Clients
              </p>

              <p className="mt-1 text-3xl font-bold text-slate-900">
                {clientsCount}
              </p>

              <p className="mt-2 text-xs text-slate-500">
                Total clients
              </p>

            </Link>

            {/* MATTERS */}

            <Link
              href="/dashboard/matters"
              className="group rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-purple-200"
            >

              <div className="flex items-start justify-between">

                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
                  <BriefcaseBusiness className="h-6 w-6" />
                </div>

                <ArrowRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-purple-600" />

              </div>

              <p className="mt-5 text-sm font-medium text-slate-500">
                Matters
              </p>

              <p className="mt-1 text-3xl font-bold text-slate-900">
                {mattersCount}
              </p>

              <p className="mt-2 text-xs text-slate-500">
                Total legal matters
              </p>

            </Link>

            {/* DOCUMENTS */}

            <Link
              href="/dashboard/documents"
              className="group rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-green-200"
            >

              <div className="flex items-start justify-between">

                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-green-700">
                  <FileText className="h-6 w-6" />
                </div>

                <ArrowRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-green-600" />

              </div>

              <p className="mt-5 text-sm font-medium text-slate-500">
                Documents
              </p>

              <p className="mt-1 text-3xl font-bold text-slate-900">
                {documentsCount}
              </p>

              <p className="mt-2 text-xs text-slate-500">
                Active documents
              </p>

            </Link>

            {/* TASKS */}

            <Link
              href="/dashboard/tasks"
              className="group rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-orange-200"
            >

              <div className="flex items-start justify-between">

                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50 text-orange-700">
                  <CheckSquare className="h-6 w-6" />
                </div>

                <ArrowRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-orange-600" />

              </div>

              <p className="mt-5 text-sm font-medium text-slate-500">
                Tasks
              </p>

              <p className="mt-1 text-3xl font-bold text-slate-900">
                {tasksCount}
              </p>

              <p className="mt-2 text-xs text-slate-500">
                Your outstanding tasks
              </p>

            </Link>

            {/* FINANCE */}

            {isFinanceUser && (
              <Link
                href="/dashboard/finance"
                className="group rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-emerald-200"
              >

                <div className="flex items-start justify-between">

                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                    <WalletCards className="h-6 w-6" />
                  </div>

                  <ArrowRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-emerald-600" />

                </div>

                <p className="mt-5 text-sm font-medium text-slate-500">
                  Finance
                </p>

                <p className="mt-1 text-3xl font-bold text-slate-900">
                  Vault
                </p>

                <p className="mt-2 text-xs text-slate-500">
                  Secure Finance documents
                </p>

              </Link>
            )}

          </div>
        </section>

        {/* ===================================================== */}
        {/* RECENT ACTIVITY */}
        {/* ===================================================== */}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">

          {/* RECENT DOCUMENTS */}

          <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">

            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">

              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Recent Documents
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Recently uploaded legal documents
                </p>
              </div>

              <Link
                href="/dashboard/documents"
                className="text-sm font-semibold text-blue-700 hover:text-blue-900"
              >
                View all
              </Link>

            </div>

            {recentDocuments.length === 0 ? (
              <div className="p-8 text-center">

                <FileText className="mx-auto h-10 w-10 text-slate-300" />

                <p className="mt-3 font-semibold text-slate-900">
                  No documents
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  No active documents have been uploaded yet.
                </p>

                {canUploadDocument && (
                  <Link
                    href="/dashboard/documents/new"
                    className="mt-4 inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    Upload Document
                  </Link>
                )}

              </div>
            ) : (
              <div className="divide-y divide-slate-200">

                {recentDocuments.map((document) => (
                  <Link
                    key={document.id}
                    href={`/dashboard/documents/${document.id}`}
                    className="group block px-6 py-5 transition hover:bg-slate-50"
                  >

                    <div className="flex items-center justify-between gap-4">

                      <div className="flex min-w-0 items-center gap-4">

                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                          <FileText className="h-5 w-5" />
                        </div>

                        <div className="min-w-0">

                          <p className="truncate font-semibold text-slate-900 group-hover:text-blue-700">
                            {document.name}
                          </p>

                          <p className="mt-1 font-mono text-xs text-slate-500">
                            {document.referenceNumber}
                          </p>

                          <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                            <Clock className="h-3 w-3" />
                            {formatDate(document.createdAt)}
                          </p>

                        </div>

                      </div>

                      <ArrowRight className="h-5 w-5 shrink-0 text-slate-300 transition group-hover:translate-x-1 group-hover:text-blue-600" />

                    </div>

                  </Link>
                ))}

              </div>
            )}

          </section>

          {/* RECENT MATTERS */}

          <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">

            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">

              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Recent Matters
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Recently created legal matters
                </p>
              </div>

              <Link
                href="/dashboard/matters"
                className="text-sm font-semibold text-blue-700 hover:text-blue-900"
              >
                View all
              </Link>

            </div>

            {recentMatters.length === 0 ? (
              <div className="p-8 text-center">

                <BriefcaseBusiness className="mx-auto h-10 w-10 text-slate-300" />

                <p className="mt-3 font-semibold text-slate-900">
                  No matters
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  No legal matters have been created yet.
                </p>

                {canCreateMatter && (
                  <Link
                    href="/dashboard/matters/new"
                    className="mt-4 inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    Create Matter
                  </Link>
                )}

              </div>
            ) : (
              <div className="divide-y divide-slate-200">

                {recentMatters.map((matter) => (
                  <Link
                    key={matter.id}
                    href={`/dashboard/matters/${matter.id}`}
                    className="group block px-6 py-5 transition hover:bg-slate-50"
                  >

                    <div className="flex items-center justify-between gap-4">

                      <div className="flex min-w-0 items-center gap-4">

                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-700">
                          <BriefcaseBusiness className="h-5 w-5" />
                        </div>

                        <div className="min-w-0">

                          <p className="truncate font-semibold text-slate-900 group-hover:text-blue-700">
                            {matter.title}
                          </p>

                          <p className="mt-1 font-mono text-xs text-slate-500">
                            {matter.referenceNumber}
                          </p>

                          <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                            <Clock className="h-3 w-3" />
                            {formatDate(matter.createdAt)}
                          </p>

                        </div>

                      </div>

                      <div className="flex shrink-0 items-center gap-3">

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${getMatterStatusClasses(
                            matter.status
                          )}`}
                        >
                          {formatStatus(matter.status)}
                        </span>

                        <ArrowRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-blue-600" />

                      </div>

                    </div>

                  </Link>
                ))}

              </div>
            )}

          </section>

        </div>

        {/* ===================================================== */}
        {/* FOOTER QUICK ACTIONS */}
        {/* ===================================================== */}

        <section className="mt-8 rounded-2xl bg-slate-900 p-6 text-white">

          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

            <div>
              <h2 className="text-lg font-bold">
                Quick Actions
              </h2>

              <p className="mt-1 text-sm text-slate-300">
                Create and manage records for your firm.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">

              {canCreateClient && (
                <Link
                  href="/dashboard/clients/new"
                  className="rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                >
                  + New Client
                </Link>
              )}

              {canCreateMatter && (
                <Link
                  href="/dashboard/matters/new"
                  className="rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                >
                  + New Matter
                </Link>
              )}

              {canUploadDocument && (
                <Link
                  href="/dashboard/documents/new"
                  className="rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                >
                  + Upload Document
                </Link>
              )}

              {canCreateTask && (
                <Link
                  href="/dashboard/tasks/new"
                  className="rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                >
                  + Delegate Task
                </Link>
              )}

              {canCreateCorrespondence && (
                <Link
                  href="/dashboard/correspondence/new"
                  className="rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                >
                  + New Correspondence
                </Link>
              )}

              {isFinanceUser && (
                <Link
                  href="/dashboard/finance"
                  className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
                >
                  Open Finance Vault
                </Link>
              )}

            </div>

          </div>

        </section>

      </div>
    </main>
  );
}