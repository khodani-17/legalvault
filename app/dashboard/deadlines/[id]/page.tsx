import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  User,
} from "lucide-react";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

function formatStatus(value: string) {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
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

function getStatusClasses(status: string) {
  switch (status) {
    case "COMPLETED":
      return "bg-green-100 text-green-700";

    case "PENDING":
      return "bg-yellow-100 text-yellow-700";

    case "OVERDUE":
      return "bg-red-100 text-red-700";

    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default async function DeadlineDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const firmId = session.user.firmId;

  if (!firmId) {
    redirect("/login");
  }

  const { id } = await params;

  const deadline = await prisma.deadline.findFirst({
    where: {
      id,
      firmId,
    },
    select: {
      id: true,
      firmId: true,
      matterId: true,

      title: true,
      description: true,

      type: true,
      priority: true,
      status: true,

      dueDate: true,

      assignedToId: true,
      createdById: true,

      isCalculated: true,
      sourceDate: true,
      calculationNote: true,

      completedAt: true,
      completedById: true,

      createdAt: true,
      updatedAt: true,

      matter: {
        select: {
          id: true,
          referenceNumber: true,
          title: true,
          status: true,
        },
      },

      assignedTo: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },

      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },

      completedBy: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  });

  if (!deadline) {
    notFound();
  }

  const isCompleted = deadline.completedAt !== null;
  const isOverdue =
    !isCompleted && deadline.dueDate.getTime() < Date.now();

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-6 py-8">

        {/* HEADER */}

        <div className="mb-8">
          <Link
            href="/dashboard/deadlines"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Deadlines
          </Link>

          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

            <div>
              <div className="flex items-center gap-3">

                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
                  <CalendarDays className="h-6 w-6" />
                </div>

                <div>
                  <p className="text-sm font-medium text-slate-500">
                    LegalVault Deadline
                  </p>

                  <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
                    {deadline.title}
                  </h1>
                </div>

              </div>
            </div>

            <div className="flex flex-wrap gap-2">

              <span
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${getPriorityClasses(
                  deadline.priority
                )}`}
              >
                {formatStatus(deadline.priority)}
              </span>

              <span
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${getStatusClasses(
                  deadline.status
                )}`}
              >
                {isOverdue
                  ? "Overdue"
                  : isCompleted
                    ? "Completed"
                    : formatStatus(deadline.status)}
              </span>

            </div>

          </div>
        </div>

        {/* OVERDUE / COMPLETED NOTICE */}

        {isOverdue && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

            <div>
              <p className="font-semibold text-red-800">
                This deadline is overdue
              </p>

              <p className="mt-1 text-sm text-red-700">
                The due date was {formatDateTime(deadline.dueDate)}.
              </p>
            </div>
          </div>
        )}

        {isCompleted && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />

            <div>
              <p className="font-semibold text-green-800">
                Deadline completed
              </p>

              {deadline.completedAt && (
                <p className="mt-1 text-sm text-green-700">
                  Completed on {formatDateTime(deadline.completedAt)}.
                </p>
              )}
            </div>
          </div>
        )}

        {/* MAIN INFORMATION */}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

          {/* DEADLINE DETAILS */}

          <section className="lg:col-span-2 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">

            <div className="border-b border-slate-200 px-6 py-5">
              <h2 className="text-lg font-bold text-slate-900">
                Deadline Details
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Information relating to this legal deadline.
              </p>
            </div>

            <div className="divide-y divide-slate-100">

              <div className="grid grid-cols-1 gap-2 px-6 py-5 sm:grid-cols-3">
                <p className="text-sm font-medium text-slate-500">
                  Title
                </p>

                <p className="text-sm font-semibold text-slate-900 sm:col-span-2">
                  {deadline.title}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2 px-6 py-5 sm:grid-cols-3">
                <p className="text-sm font-medium text-slate-500">
                  Type
                </p>

                <p className="text-sm text-slate-900 sm:col-span-2">
                  {formatStatus(deadline.type)}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2 px-6 py-5 sm:grid-cols-3">
                <p className="text-sm font-medium text-slate-500">
                  Due Date
                </p>

                <div className="sm:col-span-2">
                  <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <CalendarDays className="h-4 w-4 text-purple-600" />
                    {formatDateTime(deadline.dueDate)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 px-6 py-5 sm:grid-cols-3">
                <p className="text-sm font-medium text-slate-500">
                  Priority
                </p>

                <div className="sm:col-span-2">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getPriorityClasses(
                      deadline.priority
                    )}`}
                  >
                    {formatStatus(deadline.priority)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 px-6 py-5 sm:grid-cols-3">
                <p className="text-sm font-medium text-slate-500">
                  Status
                </p>

                <p className="text-sm text-slate-900 sm:col-span-2">
                  {isOverdue
                    ? "Overdue"
                    : isCompleted
                      ? "Completed"
                      : formatStatus(deadline.status)}
                </p>
              </div>

              {deadline.description && (
                <div className="px-6 py-5">
                  <p className="text-sm font-medium text-slate-500">
                    Description
                  </p>

                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {deadline.description}
                  </p>
                </div>
              )}

            </div>
          </section>

          {/* ASSIGNMENT */}

          <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">

            <div className="border-b border-slate-200 px-6 py-5">
              <h2 className="text-lg font-bold text-slate-900">
                Assignment
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                People associated with this deadline.
              </p>
            </div>

            <div className="space-y-6 p-6">

              <div>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-slate-400" />

                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Assigned To
                  </p>
                </div>

                {deadline.assignedTo ? (
                  <div className="mt-2">
                    <p className="font-semibold text-slate-900">
                      {deadline.assignedTo.name ||
                        deadline.assignedTo.email}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {deadline.assignedTo.role}
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">
                    Not assigned
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-slate-400" />

                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Created By
                  </p>
                </div>

                <div className="mt-2">
                  <p className="font-semibold text-slate-900">
                    {deadline.createdBy.name ||
                      deadline.createdBy.email}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {formatDateTime(deadline.createdAt)}
                  </p>
                </div>
              </div>

              {deadline.completedBy && (
                <div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />

                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Completed By
                    </p>
                  </div>

                  <div className="mt-2">
                    <p className="font-semibold text-slate-900">
                      {deadline.completedBy.name ||
                        deadline.completedBy.email}
                    </p>

                    {deadline.completedAt && (
                      <p className="mt-1 text-xs text-slate-500">
                        {formatDateTime(deadline.completedAt)}
                      </p>
                    )}
                  </div>
                </div>
              )}

            </div>
          </section>
        </div>

        {/* MATTER */}

        <section className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">

          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-lg font-bold text-slate-900">
              Matter
            </h2>
          </div>

          <div className="p-6">

            {deadline.matter ? (
              <Link
                href={`/dashboard/matters/${deadline.matter.id}`}
                className="group flex items-center justify-between rounded-xl border border-slate-200 p-4 transition hover:border-purple-300 hover:bg-purple-50"
              >
                <div className="flex items-center gap-4">

                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-purple-50 text-purple-700">
                    <FileText className="h-5 w-5" />
                  </div>

                  <div>
                    <p className="font-mono text-xs text-slate-500">
                      {deadline.matter.referenceNumber}
                    </p>

                    <p className="mt-1 font-semibold text-slate-900 group-hover:text-purple-700">
                      {deadline.matter.title}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {formatStatus(deadline.matter.status)}
                    </p>
                  </div>

                </div>

                <span className="text-sm font-semibold text-purple-700">
                  View Matter →
                </span>
              </Link>
            ) : (
              <p className="text-sm text-slate-500">
                This deadline is not linked to a matter.
              </p>
            )}

          </div>
        </section>

        {/* CALCULATION INFORMATION */}

        {deadline.isCalculated && (
          <section className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">

            <div className="border-b border-slate-200 px-6 py-5">
              <h2 className="text-lg font-bold text-slate-900">
                Deadline Calculation
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Information explaining how this deadline was calculated.
              </p>
            </div>

            <div className="space-y-5 p-6">

              {deadline.sourceDate && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Source Date
                  </p>

                  <p className="mt-1 text-sm text-slate-900">
                    {formatDateTime(deadline.sourceDate)}
                  </p>
                </div>
              )}

              {deadline.calculationNote && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Calculation Note
                  </p>

                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {deadline.calculationNote}
                  </p>
                </div>
              )}

            </div>
          </section>
        )}

        {/* FOOTER */}

        <div className="mt-8 flex flex-wrap gap-3">

          <Link
            href="/dashboard/deadlines"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Deadlines
          </Link>

          {deadline.matter && (
            <Link
              href={`/dashboard/matters/${deadline.matter.id}`}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              View Matter
            </Link>
          )}

        </div>

      </div>
    </main>
  );
}