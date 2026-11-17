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
import SmartAccess from "@/components/SmartAccess";


function formatStatus(status: string) {
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getMatterStatusClasses(status: string) {
  switch (status) {
    case "OPEN":
      return "bg-[#244C45] text-[#9DE2C6]";

    case "PENDING":
      return "bg-[#4C4029] text-[#F4D88B]";

    case "CLOSED":
      return "bg-[#2B4261] text-[#E0E8F3]";

    case "ARCHIVED":
      return "bg-[#4C293C] text-[#FFB9BC]";

    default:
      return "bg-[#203653] text-[#E0E8F3]";
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

  const end = new Date(
    start.getTime() + 24 * 60 * 60 * 1000
  );

  return {
    start,
    end,
  };
}

function getPriorityClasses(priority: string) {
  switch (priority) {
    case "URGENT":
      return "bg-[#4C293C] text-[#FFB9BC]";

    case "HIGH":
      return "bg-[#513D2B] text-gold";

    case "MEDIUM":
      return "bg-[#4C4029] text-[#F4D88B]";

    case "LOW":
      return "bg-[#203653] text-[#C4D0E0]";

    default:
      return "bg-[#203653] text-[#C4D0E0]";
  }
}

function getCorrespondenceStatusClasses(status: string) {
  switch (status) {
    case "ACTION_REQUIRED":
      return "bg-[#4C293C] text-[#FFB9BC]";

    case "ASSIGNED":
      return "bg-[#213E61] text-gold";

    case "RESPONDED":
      return "bg-[#244C45] text-[#9DE2C6]";

    case "CLOSED":
      return "bg-[#2B4261] text-[#E0E8F3]";

    default:
      return "bg-[#4C4029] text-[#F4D88B]";
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

  const {
    start: todayStart,
    end: tomorrowStart,
  } = getSouthAfricaDayBounds();

  const now = new Date();

  /**
   * Upcoming work means the next 7 calendar days
   * after today.
   */
  const next7DaysEnd = new Date(
    tomorrowStart.getTime() + 7 * 24 * 60 * 60 * 1000
  );

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

    overdueCorrespondence,
    todayCorrespondence,
    upcomingCorrespondence,
  ] = await Promise.all([
    prisma.firm.findUnique({
      where: {
        id: firmId,
      },
      select: {
        name: true,
        referenceNumber: true,
      },
    }),

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

    prisma.task.findMany({
      where: {
        firmId,
        assignedToId: userId,
        status: {
          not: "COMPLETED",
        },
        dueDate: {
          gte: tomorrowStart,
          lt: next7DaysEnd,
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

    prisma.deadline.findMany({
      where: {
        firmId,
        assignedToId: userId,
        completedAt: null,
        dueDate: {
          gte: tomorrowStart,
          lt: next7DaysEnd,
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

    prisma.correspondence.findMany({
      where: {
        firmId,
        responsibleUserId: userId,
        responseRequired: true,
        status: {
          notIn: ["RESPONDED", "CLOSED"],
        },
        responseDeadline: {
          gte: tomorrowStart,
          lt: next7DaysEnd,
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

  const overdueCount =
    overdueTasks.length +
    overdueDeadlines.length +
    overdueCorrespondence.length;

  const dueTodayCount =
    todayTasks.length +
    todayDeadlines.length +
    todayCorrespondence.length;

  const reportCount = reportRequiredTasks.length;

  const upcomingCount =
    upcomingTasks.length +
    upcomingDeadlines.length +
    upcomingCorrespondence.length;

  return (
    <main className="min-h-screen bg-navy">
      <div className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 lg:px-10">

        {/* ===================================================== */}
        {/* MY DAY COMMAND CENTRE */}
        {/* ===================================================== */}

        <section className="mb-8">

          <div className="relative overflow-hidden rounded-[28px] bg-navy px-6 py-8 text-white shadow-[0_20px_60px_-30px_rgba(8,23,47,0.6)] sm:px-9 sm:py-10">
            <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-32 h-80 w-80 rounded-full border border-[#D4AF37]/20" />
            <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-20 h-64 w-64 rounded-full border border-[#D4AF37]/10" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-gold">
                LegalVault / Command Centre
              </p>

              <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Good morning, {session.user.name || "User"}
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#C8D2E2]">
                Your matters, priorities and deadlines — organised for a focused working day.
              </p>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-5 py-4 backdrop-blur-sm">

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D4AF37] text-navy">
                <Building2 className="h-5 w-5" />
              </div>

              <div>
                <p className="text-sm font-semibold text-white">
                  {firm?.name || "Law Firm"}
                </p>

                <p className="mt-1 font-mono text-xs text-[#C8D2E2]">
                  {firm?.referenceNumber || "—"}
                </p>
              </div>

            </div>

            </div>
            <div className="relative mt-7 flex flex-wrap gap-2 border-t border-white/15 pt-5">
              <Link href="/dashboard/matters" className="rounded-lg bg-[#D4AF37] px-4 py-2.5 text-sm font-bold text-navy transition hover:bg-[#E8C65B]">Open Matters →</Link>
              <Link href="/dashboard/documents" className="rounded-lg border border-white/25 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10">Documents</Link>
              <Link href="/dashboard/tasks" className="rounded-lg border border-white/25 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10">My Tasks</Link>
              <Link href="/dashboard/deadlines" className="rounded-lg border border-white/25 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10">Court Dates & Deadlines</Link>
            </div>
          </div>

{/* ===================================================== */}
          {/* SMARTACCESS */}
          {/* ===================================================== */}

          <SmartAccess />

          {/* ===================================================== */}
          {/* NEEDS ATTENTION */}
          {/* ===================================================== */}

          <div
            id="needs-attention"
            className="mt-6 rounded-2xl border border-[#7A4657] bg-[#321F34] p-5"
          >

            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

              <div>
                <div className="flex items-center gap-2">
                  <CircleAlert className="h-5 w-5 text-[#FFB9BC]" />

                  <h2 className="text-sm font-bold uppercase tracking-wide text-[#FFB9BC]">
                    Needs Attention
                  </h2>
                </div>

                <p className="mt-1 text-sm text-[#FFB9BC]">
                  {overdueCount > 0
                    ? `${overdueCount} ${
                        overdueCount === 1 ? "item needs" : "items need"
                      } attention.`
                    : "Nothing is overdue right now."}
                </p>
              </div>

              {overdueCount > 0 && (
                <Link
                  href="#overdue-work"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-navy-light px-4 py-2.5 text-sm font-semibold text-[#FFB9BC] shadow-sm ring-1 ring-[#7A4657] transition hover:bg-[#34243A]"
                >
                  Open overdue work
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}

            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">

              {/* OVERDUE SUMMARY */}

              <Link
                href="#overdue-work"
                className="group rounded-xl bg-navy-light p-4 shadow-sm ring-1 ring-[#6B4051] transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center justify-between">

                  <div className="flex items-center gap-3">

                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#4C293C] text-[#FFB9BC]">
                      <AlertCircle className="h-5 w-5" />
                    </div>

                    <div>
                      <p className="text-xs font-medium text-[#B7C6D9]">
                        Overdue
                      </p>

                      <p className="mt-0.5 text-2xl font-bold text-[#FFB9BC]">
                        {overdueCount}
                      </p>
                    </div>

                  </div>

                  <ArrowRight className="h-4 w-4 text-[#8EA4C2] transition group-hover:translate-x-1 group-hover:text-[#FFB9BC]" />

                </div>

                <p className="mt-3 text-xs text-[#B7C6D9]">
                  Tasks, deadlines and responses
                </p>
              </Link>

              {/* DUE TODAY */}

              <Link
                href="#today-work"
                className="group rounded-xl bg-navy-light p-4 shadow-sm ring-1 ring-[#304663] transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center justify-between">

                  <div className="flex items-center gap-3">

                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#213E61] text-gold">
                      <CalendarDays className="h-5 w-5" />
                    </div>

                    <div>
                      <p className="text-xs font-medium text-[#B7C6D9]">
                        Due Today
                      </p>

                      <p className="mt-0.5 text-2xl font-bold text-[#F6F1E5]">
                        {dueTodayCount}
                      </p>
                    </div>

                  </div>

                  <ArrowRight className="h-4 w-4 text-[#8EA4C2] transition group-hover:translate-x-1 group-hover:text-[#A68122]" />

                </div>

                <p className="mt-3 text-xs text-[#B7C6D9]">
                  Tasks, deadlines and responses
                </p>
              </Link>

              {/* REPORTS */}

              <Link
                href="#reports-required"
                className="group rounded-xl bg-navy-light p-4 shadow-sm ring-1 ring-[#304663] transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center justify-between">

                  <div className="flex items-center gap-3">

                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#333052] text-gold">
                      <ClipboardCheck className="h-5 w-5" />
                    </div>

                    <div>
                      <p className="text-xs font-medium text-[#B7C6D9]">
                        Reports Required
                      </p>

                      <p className="mt-0.5 text-2xl font-bold text-[#F6F1E5]">
                        {reportCount}
                      </p>
                    </div>

                  </div>

                  <ArrowRight className="h-4 w-4 text-[#8EA4C2] transition group-hover:translate-x-1 group-hover:text-gold" />

                </div>

                <p className="mt-3 text-xs text-[#B7C6D9]">
                  Delegated work requiring your report
                </p>
              </Link>

            </div>

            {/* ===================================================== */}
            {/* IMMEDIATE OVERDUE ITEMS */}
            {/* ===================================================== */}

            {overdueCount > 0 && (
              <div className="mt-5 overflow-hidden rounded-xl bg-navy-light shadow-sm ring-1 ring-[#6B4051]">

                <div className="border-b border-[#6B4051] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-[#FFB9BC]" />

                    <p className="text-sm font-semibold text-[#F6F1E5]">
                      Immediate overdue work
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-slate-100">

                  {/* FIRST OVERDUE TASK */}

                  {overdueTasks.length > 0 && (
                    <Link
                      href={`/dashboard/tasks/${overdueTasks[0].id}`}
                      className="group flex items-center justify-between gap-4 px-4 py-4 transition hover:bg-[#34243A]"
                    >
                      <div className="flex min-w-0 items-center gap-3">

                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#34243A] text-[#FFB9BC]">
                          <ListTodo className="h-4 w-4" />
                        </div>

                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-wide text-[#FFB9BC]">
                            {overdueTasks.length}{" "}
                            {overdueTasks.length === 1
                              ? "Overdue Task"
                              : "Overdue Tasks"}
                          </p>

                          <p className="mt-0.5 truncate font-semibold text-[#F6F1E5] group-hover:text-[#FFB9BC]">
                            {overdueTasks[0].title}
                          </p>

                          {overdueTasks[0].matter && (
                            <p className="mt-1 truncate text-xs text-[#B7C6D9]">
                              {overdueTasks[0].matter.referenceNumber} ·{" "}
                              {overdueTasks[0].matter.title}
                            </p>
                          )}

                          {overdueTasks[0].dueDate && (
                            <p className="mt-1 flex items-center gap-1 text-xs text-[#FFB9BC]">
                              <Clock className="h-3 w-3" />
                              Due {formatDateTime(overdueTasks[0].dueDate)}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">

                        <span className="hidden rounded-full bg-[#4C293C] px-2.5 py-1 text-[10px] font-semibold text-[#FFB9BC] sm:inline-flex">
                          {formatStatus(overdueTasks[0].priority)}
                        </span>

                        <ArrowRight className="h-4 w-4 text-[#8EA4C2] transition group-hover:translate-x-1 group-hover:text-[#FFB9BC]" />

                      </div>

                    </Link>
                  )}

                  {/* FIRST OVERDUE DEADLINE */}

                  {overdueDeadlines.length > 0 && (
                    <Link
                      href={`/dashboard/deadlines/${overdueDeadlines[0].id}`}
                      className="group flex items-center justify-between gap-4 px-4 py-4 transition hover:bg-[#34243A]"
                    >
                      <div className="flex min-w-0 items-center gap-3">

                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#34243A] text-[#FFB9BC]">
                          <CalendarDays className="h-4 w-4" />
                        </div>

                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-wide text-[#FFB9BC]">
                            {overdueDeadlines.length}{" "}
                            {overdueDeadlines.length === 1
                              ? "Overdue Deadline"
                              : "Overdue Deadlines"}
                          </p>

                          <p className="mt-0.5 truncate font-semibold text-[#F6F1E5] group-hover:text-[#FFB9BC]">
                            {overdueDeadlines[0].title}
                          </p>

                          {overdueDeadlines[0].matter && (
                            <p className="mt-1 truncate text-xs text-[#B7C6D9]">
                              {overdueDeadlines[0].matter.referenceNumber} ·{" "}
                              {overdueDeadlines[0].matter.title}
                            </p>
                          )}

                          <p className="mt-1 flex items-center gap-1 text-xs text-[#FFB9BC]">
                            <Clock className="h-3 w-3" />
                            Due{" "}
                            {formatDateTime(
                              overdueDeadlines[0].dueDate
                            )}
                          </p>
                        </div>
                      </div>

                      <ArrowRight className="h-4 w-4 shrink-0 text-[#8EA4C2] transition group-hover:translate-x-1 group-hover:text-[#FFB9BC]" />

                    </Link>
                  )}

                  {/* FIRST OVERDUE RESPONSE */}

                  {overdueCorrespondence.length > 0 && (
                    <Link
                      href={`/dashboard/correspondence/${overdueCorrespondence[0].id}`}
                      className="group flex items-center justify-between gap-4 px-4 py-4 transition hover:bg-[#34243A]"
                    >
                      <div className="flex min-w-0 items-center gap-3">

                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#34243A] text-[#FFB9BC]">
                          <Mail className="h-4 w-4" />
                        </div>

                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-wide text-[#FFB9BC]">
                            {overdueCorrespondence.length}{" "}
                            {overdueCorrespondence.length === 1
                              ? "Overdue Response"
                              : "Overdue Responses"}
                          </p>

                          <p className="mt-0.5 truncate font-semibold text-[#F6F1E5] group-hover:text-[#FFB9BC]">
                            {overdueCorrespondence[0].subject}
                          </p>

                          <p className="mt-1 truncate text-xs text-[#B7C6D9]">
                            {overdueCorrespondence[0].sender}
                          </p>

                          {overdueCorrespondence[0].responseDeadline && (
                            <p className="mt-1 flex items-center gap-1 text-xs text-[#FFB9BC]">
                              <Clock className="h-3 w-3" />
                              Response due{" "}
                              {formatDateTime(
                                overdueCorrespondence[0].responseDeadline
                              )}
                            </p>
                          )}
                        </div>
                      </div>

                      <ArrowRight className="h-4 w-4 shrink-0 text-[#8EA4C2] transition group-hover:translate-x-1 group-hover:text-[#FFB9BC]" />

                    </Link>
                  )}

                </div>

                {overdueCount > 3 && (
                  <div className="border-t border-[#304663] bg-[#102440] px-4 py-3">
                    <Link
                      href="#overdue-work"
                      className="inline-flex items-center gap-2 text-xs font-semibold text-[#FFB9BC] hover:text-[#FFD5D7]"
                    >
                      View all {overdueCount} overdue items
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                )}

              </div>
            )}

          </div>

          {/* ===================================================== */}
          {/* TODAY */}
          {/* ===================================================== */}

          <div
            id="today-work"
            className="mt-6"
          >

            <div className="mb-3 flex items-end justify-between">

              <div>
                <h2 className="text-lg font-bold text-gold">
                  Today
                </h2>

                <p className="mt-1 text-sm text-[#B7C6D9]">
                  Your work for today at a glance.
                </p>
              </div>

              <Link
                href="#today-work"
                className="hidden text-sm font-semibold text-[#E0E8F3] hover:text-[#F6F1E5] sm:inline-flex"
              >
                View work
              </Link>

            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

              <Link
                href="/dashboard/tasks"
                className="group rounded-2xl bg-navy-light p-5 shadow-sm ring-1 ring-[#304663] transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center justify-between">

                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#213B5B] text-gold">
                    <CheckSquare className="h-5 w-5" />
                  </div>

                  <ArrowRight className="h-4 w-4 text-[#8EA4C2] transition group-hover:translate-x-1 group-hover:text-[#A68122]" />

                </div>

                <p className="mt-4 text-sm font-semibold text-[#F6F1E5]">
                  Tasks
                </p>

                <p className="mt-1 text-2xl font-bold text-[#F6F1E5]">
                  {todayTasks.length}
                </p>

                <p className="mt-1 text-xs text-[#B7C6D9]">
                  Due today
                </p>

              </Link>

              <Link
                href="/dashboard/deadlines"
                className="group rounded-2xl bg-navy-light p-5 shadow-sm ring-1 ring-[#304663] transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center justify-between">

                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#213B5B] text-gold">
                    <CalendarDays className="h-5 w-5" />
                  </div>

                  <ArrowRight className="h-4 w-4 text-[#8EA4C2] transition group-hover:translate-x-1 group-hover:text-gold" />

                </div>

                <p className="mt-4 text-sm font-semibold text-[#F6F1E5]">
                  Deadlines
                </p>

                <p className="mt-1 text-2xl font-bold text-[#F6F1E5]">
                  {todayDeadlines.length}
                </p>

                <p className="mt-1 text-xs text-[#B7C6D9]">
                  Due today
                </p>

              </Link>

              <Link
                href="/dashboard/correspondence"
                className="group rounded-2xl bg-navy-light p-5 shadow-sm ring-1 ring-[#304663] transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center justify-between">

                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#213B5B] text-gold">
                    <Mail className="h-5 w-5" />
                  </div>

                  <ArrowRight className="h-4 w-4 text-[#8EA4C2] transition group-hover:translate-x-1 group-hover:text-gold" />

                </div>

                <p className="mt-4 text-sm font-semibold text-[#F6F1E5]">
                  Correspondence
                </p>

                <p className="mt-1 text-2xl font-bold text-[#F6F1E5]">
                  {todayCorrespondence.length}
                </p>

                <p className="mt-1 text-xs text-[#B7C6D9]">
                  Responses due today
                </p>

              </Link>

            </div>

          </div>

          {/* ===================================================== */}
          {/* UPCOMING */}
          {/* ===================================================== */}

          <div className="mt-6 rounded-2xl bg-navy-light p-5 shadow-sm ring-1 ring-[#304663]">

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

              <div>

                <div className="flex items-center gap-2">

                  <CalendarDays className="h-5 w-5 text-[#E0E8F3]" />

                  <h2 className="text-base font-bold text-gold">
                    Upcoming
                  </h2>

                </div>

                <p className="mt-1 text-sm text-[#B7C6D9]">
                  Next 7 days of assigned work.
                </p>

              </div>

              <div className="flex items-center gap-5 text-sm">

                <div>
                  <span className="font-bold text-[#F6F1E5]">
                    {upcomingTasks.length}
                  </span>{" "}
                  <span className="text-[#B7C6D9]">
                    tasks
                  </span>
                </div>

                <div>
                  <span className="font-bold text-[#F6F1E5]">
                    {upcomingDeadlines.length}
                  </span>{" "}
                  <span className="text-[#B7C6D9]">
                    deadlines
                  </span>
                </div>

                <div>
                  <span className="font-bold text-[#F6F1E5]">
                    {upcomingCorrespondence.length}
                  </span>{" "}
                  <span className="text-[#B7C6D9]">
                    responses
                  </span>
                </div>

              </div>

            </div>

          </div>

          {/* ===================================================== */}
          {/* QUICK ACTIONS */}
          {/* ===================================================== */}

          <div className="mt-6">

            <div className="mb-3">

              <h2 className="text-lg font-bold text-gold">
                Quick Actions
              </h2>

              <p className="mt-1 text-sm text-[#B7C6D9]">
                Start a common piece of work without searching through menus.
              </p>

            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">

              {canCreateTask && (
                <Link
                  href="/dashboard/tasks/new"
                  className="inline-flex items-center justify-between rounded-xl bg-navy px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-navy-light"
                >
                  <span>Delegate Task</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}

              {canCreateCorrespondence && (
                <Link
                  href="/dashboard/correspondence/new"
                  className="inline-flex items-center justify-between rounded-xl bg-navy-light px-4 py-3.5 text-sm font-semibold text-[#F6F1E5] shadow-sm ring-1 ring-[#304663] transition hover:bg-[#102440]"
                >
                  <span>Add Correspondence</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}

              <Link
                href="/dashboard/deadlines/new"
                className="inline-flex items-center justify-between rounded-xl bg-navy-light px-4 py-3.5 text-sm font-semibold text-[#F6F1E5] shadow-sm ring-1 ring-[#304663] transition hover:bg-[#102440]"
              >
                <span>Add Deadline</span>
                <ArrowRight className="h-4 w-4" />
              </Link>

              {canCreateMatter && (
                <Link
                  href="/dashboard/matters/new"
                  className="inline-flex items-center justify-between rounded-xl bg-navy-light px-4 py-3.5 text-sm font-semibold text-[#F6F1E5] shadow-sm ring-1 ring-[#304663] transition hover:bg-[#102440]"
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
          <section
            id="overdue-work"
            className="mb-8"
          >

            <div className="mb-4 flex items-center justify-between">

              <div>
                <h2 className="text-lg font-bold text-gold">
                  Needs Attention
                </h2>

                <p className="mt-1 text-sm text-[#B7C6D9]">
                  These items are already overdue.
                </p>
              </div>

            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

              {/* OVERDUE TASKS */}

              <section className="overflow-hidden rounded-2xl bg-navy-light shadow-sm ring-1 ring-[#7A4657]">

                <div className="border-b border-[#304663] px-5 py-4">

                  <div className="flex items-center gap-3">

                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#34243A] text-[#FFB9BC]">
                      <ListTodo className="h-4 w-4" />
                    </div>

                    <div>

                      <h3 className="font-semibold text-[#F6F1E5]">
                        Overdue Tasks
                      </h3>

                      <p className="text-xs text-[#B7C6D9]">
                        {overdueTasks.length} overdue
                      </p>

                    </div>

                  </div>

                </div>

                {overdueTasks.length === 0 ? (
                  <div className="p-6 text-center text-sm text-[#B7C6D9]">
                    No overdue tasks.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">

                    {overdueTasks.map((task) => (
                      <Link
                        key={task.id}
                        href={`/dashboard/tasks/${task.id}`}
                        className="group block p-5 transition hover:bg-[#34243A]"
                      >

                        <div className="flex items-start justify-between gap-3">

                          <div className="min-w-0">

                            <p className="font-semibold text-[#F6F1E5] group-hover:text-[#FFB9BC]">
                              {task.title}
                            </p>

                            {task.matter && (
                              <p className="mt-1 truncate text-xs text-[#B7C6D9]">
                                {task.matter.referenceNumber} ·{" "}
                                {task.matter.title}
                              </p>
                            )}

                            {task.dueDate && (
                              <p className="mt-2 flex items-center gap-1 text-xs font-medium text-[#FFB9BC]">
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

              <section className="overflow-hidden rounded-2xl bg-navy-light shadow-sm ring-1 ring-[#7A4657]">

                <div className="border-b border-[#304663] px-5 py-4">

                  <div className="flex items-center gap-3">

                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#34243A] text-[#FFB9BC]">
                      <CalendarDays className="h-4 w-4" />
                    </div>

                    <div>

                      <h3 className="font-semibold text-[#F6F1E5]">
                        Overdue Deadlines
                      </h3>

                      <p className="text-xs text-[#B7C6D9]">
                        {overdueDeadlines.length} overdue
                      </p>

                    </div>

                  </div>

                </div>

                {overdueDeadlines.length === 0 ? (
                  <div className="p-6 text-center text-sm text-[#B7C6D9]">
                    No overdue deadlines.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">

                    {overdueDeadlines.map((deadline) => (
                      <Link
                        key={deadline.id}
                        href={`/dashboard/deadlines/${deadline.id}`}
                        className="group block p-5 transition hover:bg-[#34243A]"
                      >

                        <p className="font-semibold text-[#F6F1E5] group-hover:text-[#FFB9BC]">
                          {deadline.title}
                        </p>

                        {deadline.matter && (
                          <p className="mt-1 truncate text-xs text-[#B7C6D9]">
                            {deadline.matter.referenceNumber} ·{" "}
                            {deadline.matter.title}
                          </p>
                        )}

                        <p className="mt-2 flex items-center gap-1 text-xs font-medium text-[#FFB9BC]">
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

              <section className="overflow-hidden rounded-2xl bg-navy-light shadow-sm ring-1 ring-[#7A4657]">

                <div className="border-b border-[#304663] px-5 py-4">

                  <div className="flex items-center gap-3">

                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#34243A] text-[#FFB9BC]">
                      <Mail className="h-4 w-4" />
                    </div>

                    <div>

                      <h3 className="font-semibold text-[#F6F1E5]">
                        Overdue Responses
                      </h3>

                      <p className="text-xs text-[#B7C6D9]">
                        {overdueCorrespondence.length} overdue
                      </p>

                    </div>

                  </div>

                </div>

                {overdueCorrespondence.length === 0 ? (
                  <div className="p-6 text-center text-sm text-[#B7C6D9]">
                    No overdue correspondence.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">

                    {overdueCorrespondence.map((correspondence) => (
                      <Link
                        key={correspondence.id}
                        href={`/dashboard/correspondence/${correspondence.id}`}
                        className="group block p-5 transition hover:bg-[#34243A]"
                      >

                        <p className="font-semibold text-[#F6F1E5] group-hover:text-[#FFB9BC]">
                          {correspondence.subject}
                        </p>

                        <p className="mt-1 truncate text-xs text-[#B7C6D9]">
                          {correspondence.sender}
                        </p>

                        {correspondence.responseDeadline && (
                          <p className="mt-2 flex items-center gap-1 text-xs font-medium text-[#FFB9BC]">
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

            <h2 className="text-lg font-bold text-gold">
              Today's Work
            </h2>

            <p className="mt-1 text-sm text-[#B7C6D9]">
              Tasks, deadlines and correspondence due today.
            </p>

          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

            {/* TODAY TASKS */}

            <section className="overflow-hidden rounded-2xl bg-navy-light shadow-sm ring-1 ring-[#304663]">

              <div className="border-b border-[#304663] px-5 py-4">

                <div className="flex items-center gap-3">

                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#213B5B] text-gold">
                    <CheckSquare className="h-4 w-4" />
                  </div>

                  <div>

                    <h3 className="font-semibold text-[#F6F1E5]">
                      Tasks Due Today
                    </h3>

                    <p className="text-xs text-[#B7C6D9]">
                      {todayTasks.length} task
                      {todayTasks.length === 1 ? "" : "s"}
                    </p>

                  </div>

                </div>

              </div>

              {todayTasks.length === 0 ? (
                <div className="p-6 text-center">

                  <CheckSquare className="mx-auto h-8 w-8 text-[#8EA4C2]" />

                  <p className="mt-2 text-sm font-medium text-[#E0E8F3]">
                    No tasks due today
                  </p>

                  <p className="mt-1 text-xs text-[#B7C6D9]">
                    You are up to date.
                  </p>

                </div>
              ) : (
                <div className="divide-y divide-slate-100">

                  {todayTasks.map((task) => (
                    <Link
                      key={task.id}
                      href={`/dashboard/tasks/${task.id}`}
                      className="group block p-5 transition hover:bg-[#102440]"
                    >

                      <div className="flex items-start justify-between gap-3">

                        <div className="min-w-0">

                          <p className="font-semibold text-[#F6F1E5] group-hover:text-[#A68122]">
                            {task.title}
                          </p>

                          {task.matter && (
                            <p className="mt-1 truncate text-xs text-[#B7C6D9]">
                              {task.matter.referenceNumber}
                            </p>
                          )}

                          {task.dueDate && (
                            <p className="mt-2 flex items-center gap-1 text-xs text-[#A9BBD2]">
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

                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold">
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

            <section className="overflow-hidden rounded-2xl bg-navy-light shadow-sm ring-1 ring-[#304663]">

              <div className="border-b border-[#304663] px-5 py-4">

                <div className="flex items-center gap-3">

                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#213B5B] text-gold">
                    <CalendarDays className="h-4 w-4" />
                  </div>

                  <div>

                    <h3 className="font-semibold text-[#F6F1E5]">
                      Deadlines Due Today
                    </h3>

                    <p className="text-xs text-[#B7C6D9]">
                      {todayDeadlines.length} deadline
                      {todayDeadlines.length === 1 ? "" : "s"}
                    </p>

                  </div>

                </div>

              </div>

              {todayDeadlines.length === 0 ? (
                <div className="p-6 text-center">

                  <CalendarDays className="mx-auto h-8 w-8 text-[#8EA4C2]" />

                  <p className="mt-2 text-sm font-medium text-[#E0E8F3]">
                    No deadlines today
                  </p>

                  <p className="mt-1 text-xs text-[#B7C6D9]">
                    No assigned deadlines are due today.
                  </p>

                </div>
              ) : (
                <div className="divide-y divide-slate-100">

                  {todayDeadlines.map((deadline) => (
                    <Link
                      key={deadline.id}
                      href={`/dashboard/deadlines/${deadline.id}`}
                      className="group block p-5 transition hover:bg-[#102440]"
                    >

                      <div className="flex items-start justify-between gap-3">

                        <div className="min-w-0">

                          <p className="font-semibold text-[#F6F1E5] group-hover:text-gold">
                            {deadline.title}
                          </p>

                          {deadline.matter && (
                            <p className="mt-1 truncate text-xs text-[#B7C6D9]">
                              {deadline.matter.referenceNumber}
                            </p>
                          )}

                          <p className="mt-2 flex items-center gap-1 text-xs text-[#A9BBD2]">
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

                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold">
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

            <section className="overflow-hidden rounded-2xl bg-navy-light shadow-sm ring-1 ring-[#304663]">

              <div className="border-b border-[#304663] px-5 py-4">

                <div className="flex items-center gap-3">

                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#213B5B] text-gold">
                    <Mail className="h-4 w-4" />
                  </div>

                  <div>

                    <h3 className="font-semibold text-[#F6F1E5]">
                      Responses Due Today
                    </h3>

                    <p className="text-xs text-[#B7C6D9]">
                      {todayCorrespondence.length} response
                      {todayCorrespondence.length === 1 ? "" : "s"}
                    </p>

                  </div>

                </div>

              </div>

              {todayCorrespondence.length === 0 ? (
                <div className="p-6 text-center">

                  <Mail className="mx-auto h-8 w-8 text-[#8EA4C2]" />

                  <p className="mt-2 text-sm font-medium text-[#E0E8F3]">
                    No responses due today
                  </p>

                  <p className="mt-1 text-xs text-[#B7C6D9]">
                    No correspondence responses are due today.
                  </p>

                </div>
              ) : (
                <div className="divide-y divide-slate-100">

                  {todayCorrespondence.map((correspondence) => (
                    <Link
                      key={correspondence.id}
                      href={`/dashboard/correspondence/${correspondence.id}`}
                      className="group block p-5 transition hover:bg-[#102440]"
                    >

                      <div className="flex items-start justify-between gap-3">

                        <div className="min-w-0">

                          <p className="truncate font-semibold text-[#F6F1E5] group-hover:text-gold">
                            {correspondence.subject}
                          </p>

                          <p className="mt-1 truncate text-xs text-[#B7C6D9]">
                            {correspondence.sender}
                          </p>

                          {correspondence.responseDeadline && (
                            <p className="mt-2 flex items-center gap-1 text-xs text-[#A9BBD2]">
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

                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold">
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
          <section
            id="reports-required"
            className="mb-8 overflow-hidden rounded-2xl bg-navy-light shadow-sm ring-1 ring-[#304663]"
          >

            <div className="flex items-center justify-between border-b border-[#304663] px-6 py-5">

              <div>

                <div className="flex items-center gap-3">

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#213B5B] text-gold">
                    <ClipboardCheck className="h-5 w-5" />
                  </div>

                  <div>

                    <h2 className="text-lg font-bold text-gold">
                      Reports Required
                    </h2>

                    <p className="mt-1 text-sm text-[#B7C6D9]">
                      Report back on the following delegated work.
                    </p>

                  </div>

                </div>

              </div>

              <Link
                href="#reports-required"
                className="text-sm font-semibold text-gold hover:text-gold-light"
              >
                View all
              </Link>

            </div>

            <div className="divide-y divide-slate-100">

              {reportRequiredTasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/dashboard/tasks/${task.id}`}
                  className="group block px-6 py-5 transition hover:bg-[#213B5B]"
                >

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                    <div className="min-w-0">

                      <p className="font-semibold text-[#F6F1E5] group-hover:text-gold">
                        {task.title}
                      </p>

                      {task.matter && (
                        <p className="mt-1 text-xs text-[#B7C6D9]">
                          {task.matter.referenceNumber} ·{" "}
                          {task.matter.title}
                        </p>
                      )}

                    </div>

                    <div className="flex shrink-0 items-center gap-3">

                      {task.dueDate && (
                        <span className="text-xs text-[#B7C6D9]">
                          Due {formatDate(task.dueDate)}
                        </span>
                      )}

                      <span className="rounded-full bg-[#333052] px-3 py-1 text-xs font-semibold text-gold">
                        Report Required
                      </span>

                      <ArrowRight className="h-5 w-5 text-[#8EA4C2] transition group-hover:translate-x-1 group-hover:text-gold" />

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

              <h2 className="text-lg font-bold text-gold">
                Upcoming Work
              </h2>

              <p className="mt-1 text-sm text-[#B7C6D9]">
                Work coming up within the next 7 days.
              </p>

            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

              {/* UPCOMING TASKS */}

              <section className="overflow-hidden rounded-2xl bg-navy-light shadow-sm ring-1 ring-[#304663]">

                <div className="border-b border-[#304663] px-5 py-4">

                  <div className="flex items-center gap-3">

                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#213B5B] text-gold">
                      <CheckSquare className="h-4 w-4" />
                    </div>

                    <div>

                      <h3 className="font-semibold text-[#F6F1E5]">
                        Upcoming Tasks
                      </h3>

                      <p className="text-xs text-[#B7C6D9]">
                        Next assigned tasks
                      </p>

                    </div>

                  </div>

                </div>

                {upcomingTasks.length === 0 ? (
                  <div className="p-6 text-center text-sm text-[#B7C6D9]">
                    No upcoming tasks.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">

                    {upcomingTasks.map((task) => (
                      <Link
                        key={task.id}
                        href={`/dashboard/tasks/${task.id}`}
                        className="group block p-5 transition hover:bg-[#102440]"
                      >

                        <p className="font-semibold text-[#F6F1E5] group-hover:text-[#A68122]">
                          {task.title}
                        </p>

                        {task.matter && (
                          <p className="mt-1 truncate text-xs text-[#B7C6D9]">
                            {task.matter.referenceNumber}
                          </p>
                        )}

                        {task.dueDate && (
                          <p className="mt-2 flex items-center gap-1 text-xs text-[#A9BBD2]">
                            <Clock className="h-3 w-3" />
                            {formatDate(task.dueDate)}
                          </p>
                        )}

                        <div className="mt-3">

                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold">
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

              <section className="overflow-hidden rounded-2xl bg-navy-light shadow-sm ring-1 ring-[#304663]">

                <div className="border-b border-[#304663] px-5 py-4">

                  <div className="flex items-center gap-3">

                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#213B5B] text-gold">
                      <CalendarDays className="h-4 w-4" />
                    </div>

                    <div>

                      <h3 className="font-semibold text-[#F6F1E5]">
                        Upcoming Deadlines
                      </h3>

                      <p className="text-xs text-[#B7C6D9]">
                        Next legal deadlines
                      </p>

                    </div>

                  </div>

                </div>

                {upcomingDeadlines.length === 0 ? (
                  <div className="p-6 text-center text-sm text-[#B7C6D9]">
                    No upcoming deadlines.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">

                    {upcomingDeadlines.map((deadline) => (
                      <Link
                        key={deadline.id}
                        href={`/dashboard/deadlines/${deadline.id}`}
                        className="group block p-5 transition hover:bg-[#102440]"
                      >

                        <p className="font-semibold text-[#F6F1E5] group-hover:text-gold">
                          {deadline.title}
                        </p>

                        {deadline.matter && (
                          <p className="mt-1 truncate text-xs text-[#B7C6D9]">
                            {deadline.matter.referenceNumber}
                          </p>
                        )}

                        <p className="mt-2 flex items-center gap-1 text-xs text-[#A9BBD2]">
                          <Clock className="h-3 w-3" />
                          {formatDate(deadline.dueDate)}
                        </p>

                        <div className="mt-3">

                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold">
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

              <section className="overflow-hidden rounded-2xl bg-navy-light shadow-sm ring-1 ring-[#304663]">

                <div className="border-b border-[#304663] px-5 py-4">

                  <div className="flex items-center gap-3">

                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#213B5B] text-gold">
                      <Mail className="h-4 w-4" />
                    </div>

                    <div>

                      <h3 className="font-semibold text-[#F6F1E5]">
                        Upcoming Responses
                      </h3>

                      <p className="text-xs text-[#B7C6D9]">
                        Future correspondence responses
                      </p>

                    </div>

                  </div>

                </div>

                {upcomingCorrespondence.length === 0 ? (
                  <div className="p-6 text-center text-sm text-[#B7C6D9]">
                    No upcoming responses.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">

                    {upcomingCorrespondence.map((correspondence) => (
                      <Link
                        key={correspondence.id}
                        href={`/dashboard/correspondence/${correspondence.id}`}
                        className="group block p-5 transition hover:bg-[#102440]"
                      >

                        <p className="truncate font-semibold text-[#F6F1E5] group-hover:text-gold">
                          {correspondence.subject}
                        </p>

                        <p className="mt-1 truncate text-xs text-[#B7C6D9]">
                          {correspondence.sender}
                        </p>

                        {correspondence.responseDeadline && (
                          <p className="mt-2 flex items-center gap-1 text-xs text-[#A9BBD2]">
                            <Clock className="h-3 w-3" />
                            {formatDate(correspondence.responseDeadline)}
                          </p>
                        )}

                        <div className="mt-3">

                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold">
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

            <h2 className="text-lg font-bold text-gold">
              Quick Access
            </h2>

            <p className="mt-1 text-sm text-[#B7C6D9]">
              Access the main areas of your legal practice.
            </p>

          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

            {/* CLIENTS */}

            <Link
              href="/dashboard/clients"
              className="group rounded-2xl bg-navy-light p-6 shadow-sm ring-1 ring-[#304663] transition hover:-translate-y-0.5 hover:shadow-md hover:ring-gold/60"
            >

              <div className="flex items-start justify-between">

                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#213B5B] text-gold">
                  <Users className="h-6 w-6" />
                </div>

                <ArrowRight className="h-5 w-5 text-[#8EA4C2] transition group-hover:translate-x-1 group-hover:text-[#A68122]" />

              </div>

              <p className="mt-5 text-sm font-medium text-[#B7C6D9]">
                Clients
              </p>

              <p className="mt-1 text-3xl font-bold text-[#F6F1E5]">
                {clientsCount}
              </p>

              <p className="mt-2 text-xs text-[#B7C6D9]">
                Total clients
              </p>

            </Link>

            {/* MATTERS */}

            <Link
              href="/dashboard/matters"
              className="group rounded-2xl bg-navy-light p-6 shadow-sm ring-1 ring-[#304663] transition hover:-translate-y-0.5 hover:shadow-md hover:ring-[#304663]"
            >

              <div className="flex items-start justify-between">

                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#213B5B] text-gold">
                  <BriefcaseBusiness className="h-6 w-6" />
                </div>

                <ArrowRight className="h-5 w-5 text-[#8EA4C2] transition group-hover:translate-x-1 group-hover:text-gold" />

              </div>

              <p className="mt-5 text-sm font-medium text-[#B7C6D9]">
                Matters
              </p>

              <p className="mt-1 text-3xl font-bold text-[#F6F1E5]">
                {mattersCount}
              </p>

              <p className="mt-2 text-xs text-[#B7C6D9]">
                Total legal matters
              </p>

            </Link>

            {/* DOCUMENTS */}

            <Link
              href="/dashboard/documents"
              className="group rounded-2xl bg-navy-light p-6 shadow-sm ring-1 ring-[#304663] transition hover:-translate-y-0.5 hover:shadow-md hover:ring-gold/60"
            >

              <div className="flex items-start justify-between">

                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy-light text-[#9DE2C6]">
                  <FileText className="h-6 w-6" />
                </div>

                <ArrowRight className="h-5 w-5 text-[#8EA4C2] transition group-hover:translate-x-1 group-hover:text-gold" />

              </div>

              <p className="mt-5 text-sm font-medium text-[#B7C6D9]">
                Documents
              </p>

              <p className="mt-1 text-3xl font-bold text-[#F6F1E5]">
                {documentsCount}
              </p>

              <p className="mt-2 text-xs text-[#B7C6D9]">
                Active documents
              </p>

            </Link>

            {/* TASKS */}

            <Link
              href="/dashboard/tasks"
              className="group rounded-2xl bg-navy-light p-6 shadow-sm ring-1 ring-[#304663] transition hover:-translate-y-0.5 hover:shadow-md hover:ring-gold/60"
            >

              <div className="flex items-start justify-between">

                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#213B5B] text-gold">
                  <CheckSquare className="h-6 w-6" />
                </div>

                <ArrowRight className="h-5 w-5 text-[#8EA4C2] transition group-hover:translate-x-1 group-hover:text-gold" />

              </div>

              <p className="mt-5 text-sm font-medium text-[#B7C6D9]">
                Tasks
              </p>

              <p className="mt-1 text-3xl font-bold text-[#F6F1E5]">
                {tasksCount}
              </p>

              <p className="mt-2 text-xs text-[#B7C6D9]">
                Your outstanding tasks
              </p>

            </Link>

            {/* FINANCE */}

            {isFinanceUser && (
              <Link
                href="/dashboard/finance"
                className="group rounded-2xl bg-navy-light p-6 shadow-sm ring-1 ring-[#304663] transition hover:-translate-y-0.5 hover:shadow-md hover:ring-gold/60"
              >

                <div className="flex items-start justify-between">

                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy-light text-gold">
                    <WalletCards className="h-6 w-6" />
                  </div>

                  <ArrowRight className="h-5 w-5 text-[#8EA4C2] transition group-hover:translate-x-1 group-hover:text-gold" />

                </div>

                <p className="mt-5 text-sm font-medium text-[#B7C6D9]">
                  Finance
                </p>

                <p className="mt-1 text-3xl font-bold text-[#F6F1E5]">
                  Vault
                </p>

                <p className="mt-2 text-xs text-[#B7C6D9]">
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

          <section className="overflow-hidden rounded-2xl bg-navy-light shadow-sm ring-1 ring-[#304663]">

            <div className="flex items-center justify-between border-b border-[#304663] px-6 py-5">

              <div>

                <h2 className="text-lg font-bold text-gold">
                  Recent Documents
                </h2>

                <p className="mt-1 text-sm text-[#B7C6D9]">
                  Recently uploaded legal documents
                </p>

              </div>

              <Link
                href="/dashboard/documents"
                className="text-sm font-semibold text-gold hover:text-gold-light"
              >
                View all
              </Link>

            </div>

            {recentDocuments.length === 0 ? (
              <div className="p-8 text-center">

                <FileText className="mx-auto h-10 w-10 text-[#8EA4C2]" />

                <p className="mt-3 font-semibold text-[#F6F1E5]">
                  No documents
                </p>

                <p className="mt-1 text-sm text-[#B7C6D9]">
                  No active documents have been uploaded yet.
                </p>

                {canUploadDocument && (
                  <Link
                    href="/dashboard/documents/new"
                    className="mt-4 inline-flex rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light"
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
                    className="group block px-6 py-5 transition hover:bg-[#102440]"
                  >

                    <div className="flex items-center justify-between gap-4">

                      <div className="flex min-w-0 items-center gap-4">

                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#213B5B] text-gold">
                          <FileText className="h-5 w-5" />
                        </div>

                        <div className="min-w-0">

                          <p className="truncate font-semibold text-[#F6F1E5] group-hover:text-[#A68122]">
                            {document.name}
                          </p>

                          <p className="mt-1 font-mono text-xs text-[#B7C6D9]">
                            {document.referenceNumber}
                          </p>

                          <p className="mt-1 flex items-center gap-1 text-xs text-[#A9BBD2]">
                            <Clock className="h-3 w-3" />
                            {formatDate(document.createdAt)}
                          </p>

                        </div>

                      </div>

                      <ArrowRight className="h-5 w-5 shrink-0 text-[#8EA4C2] transition group-hover:translate-x-1 group-hover:text-[#A68122]" />

                    </div>

                  </Link>
                ))}

              </div>
            )}

          </section>

          {/* RECENT MATTERS */}

          <section className="overflow-hidden rounded-2xl bg-navy-light shadow-sm ring-1 ring-[#304663]">

            <div className="flex items-center justify-between border-b border-[#304663] px-6 py-5">

              <div>

                <h2 className="text-lg font-bold text-gold">
                  Recent Matters
                </h2>

                <p className="mt-1 text-sm text-[#B7C6D9]">
                  Recently created legal matters
                </p>

              </div>

              <Link
                href="/dashboard/matters"
                className="text-sm font-semibold text-gold hover:text-gold-light"
              >
                View all
              </Link>

            </div>

            {recentMatters.length === 0 ? (
              <div className="p-8 text-center">

                <BriefcaseBusiness className="mx-auto h-10 w-10 text-[#8EA4C2]" />

                <p className="mt-3 font-semibold text-[#F6F1E5]">
                  No matters
                </p>

                <p className="mt-1 text-sm text-[#B7C6D9]">
                  No legal matters have been created yet.
                </p>

                {canCreateMatter && (
                  <Link
                    href="/dashboard/matters/new"
                    className="mt-4 inline-flex rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light"
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
                    className="group block px-6 py-5 transition hover:bg-[#102440]"
                  >

                    <div className="flex items-center justify-between gap-4">

                      <div className="flex min-w-0 items-center gap-4">

                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#213B5B] text-gold">
                          <BriefcaseBusiness className="h-5 w-5" />
                        </div>

                        <div className="min-w-0">

                          <p className="truncate font-semibold text-[#F6F1E5] group-hover:text-[#A68122]">
                            {matter.title}
                          </p>

                          <p className="mt-1 font-mono text-xs text-[#B7C6D9]">
                            {matter.referenceNumber}
                          </p>

                          <p className="mt-1 flex items-center gap-1 text-xs text-[#A9BBD2]">
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

                        <ArrowRight className="h-5 w-5 text-[#8EA4C2] transition group-hover:translate-x-1 group-hover:text-[#A68122]" />

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

        <section className="mt-8 rounded-2xl bg-navy p-6 text-white">

          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

            <div>

              <h2 className="text-lg font-bold">
                Quick Actions
              </h2>

              <p className="mt-1 text-sm text-[#8EA4C2]">
                Create and manage records for your firm.
              </p>

            </div>

            <div className="flex flex-wrap gap-3">

              {canCreateClient && (
                <Link
                  href="/dashboard/clients/new"
                  className="rounded-lg bg-navy-light px-4 py-2.5 text-sm font-semibold text-[#F6F1E5] transition hover:bg-[#203653]"
                >
                  + New Client
                </Link>
              )}

              {canCreateMatter && (
                <Link
                  href="/dashboard/matters/new"
                  className="rounded-lg bg-navy-light px-4 py-2.5 text-sm font-semibold text-[#F6F1E5] transition hover:bg-[#203653]"
                >
                  + New Matter
                </Link>
              )}

              {canUploadDocument && (
                <Link
                  href="/dashboard/documents/new"
                  className="rounded-lg bg-navy-light px-4 py-2.5 text-sm font-semibold text-[#F6F1E5] transition hover:bg-[#203653]"
                >
                  + Upload Document
                </Link>
              )}

              {canCreateTask && (
                <Link
                  href="/dashboard/tasks/new"
                  className="rounded-lg bg-navy-light px-4 py-2.5 text-sm font-semibold text-[#F6F1E5] transition hover:bg-[#203653]"
                >
                  + Delegate Task
                </Link>
              )}

              {canCreateCorrespondence && (
                <Link
                  href="/dashboard/correspondence/new"
                  className="rounded-lg bg-navy-light px-4 py-2.5 text-sm font-semibold text-[#F6F1E5] transition hover:bg-[#203653]"
                >
                  + New Correspondence
                </Link>
              )}

              {isFinanceUser && (
                <Link
                  href="/dashboard/finance"
                  className="rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-navy transition hover:bg-[#E8C65B]"
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