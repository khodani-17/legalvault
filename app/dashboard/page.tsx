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

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const firmId = session.user.firmId;

  if (!firmId) {
    redirect("/login");
  }

  const role = session.user.role;

  const isFinanceUser =
    role === "FINANCE";

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

  const [
    firm,
    clientsCount,
    mattersCount,
    documentsCount,
    tasksCount,
    recentDocuments,
    recentMatters,
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
  ]);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-6 py-8">

        {/* ===================================================== */}
        {/* HEADER */}
        {/* ===================================================== */}

        <div className="mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div>
              <p className="text-sm font-medium text-slate-500">
                LegalVault
              </p>

              <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
                Welcome back, {session.user.name || "User"}
              </h1>

              <p className="mt-2 text-sm text-slate-500">
                Manage your firm's clients, matters, documents and tasks.
              </p>
            </div>

            <div className="rounded-xl bg-white px-5 py-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center gap-3">

                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
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

          </div>
        </div>

        {/* ===================================================== */}
        {/* QUICK NAVIGATION */}
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

            {/* ================================================= */}
            {/* CLIENTS */}
            {/* ================================================= */}

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

            {/* ================================================= */}
            {/* MATTERS */}
            {/* ================================================= */}

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

            {/* ================================================= */}
            {/* DOCUMENTS */}
            {/* ================================================= */}

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

            {/* ================================================= */}
            {/* TASKS */}
            {/* ================================================= */}

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
                Outstanding tasks
              </p>

            </Link>

            {/* ================================================= */}
            {/* FINANCE */}
            {/* ================================================= */}

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

          {/* =================================================== */}
          {/* RECENT DOCUMENTS */}
          {/* =================================================== */}

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

          {/* =================================================== */}
          {/* RECENT MATTERS */}
          {/* =================================================== */}

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
                  + New Task
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