import { notFound } from "next/navigation";
import Link from "next/link";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { getMatterControl } from "@/lib/matter-control/engine";

import FolderManager from "./components/FolderManager";
import MatterUsers from "./components/MatterUsers";
import MatterControl from "./components/MatterControl";
import MatterTimeline from "./components/MatterTimeline";

type MatterPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function formatDate(date: Date | null) {
  if (!date) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatDateTime(date: Date | null) {
  if (!date) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatStatus(status: string) {
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getStatusClasses(status: string) {
  switch (status) {
    case "OPEN":
      return "bg-green-100 text-green-700 ring-green-200";

    case "PENDING":
      return "bg-yellow-100 text-yellow-700 ring-yellow-200";

    case "CLOSED":
      return "bg-slate-200 text-slate-700 ring-slate-300";

    case "ARCHIVED":
      return "bg-red-100 text-red-700 ring-red-200";

    default:
      return "bg-slate-100 text-slate-700 ring-slate-200";
  }
}

function getTaskStatusClasses(status: string) {
  switch (status) {
    case "COMPLETED":
      return "bg-green-100 text-green-700";

    case "IN_PROGRESS":
      return "bg-blue-100 text-blue-700";

    case "PENDING":
      return "bg-yellow-100 text-yellow-700";

    case "CANCELLED":
      return "bg-red-100 text-red-700";

    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default async function MatterPage({
  params,
}: MatterPageProps) {
  const session = await auth();

  if (!session?.user?.id || !session.user.firmId) {
    notFound();
  }

  const { id } = await params;

  const matter = await prisma.matter.findFirst({
    where: {
      id,
      firmId: session.user.firmId,
    },

    include: {
      client: true,

      users: {
        include: {
          user: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },

      documents: {
        orderBy: {
          createdAt: "desc",
        },
        take: 10,
      },

      tasks: {
        orderBy: {
          createdAt: "desc",
        },
        take: 10,
      },

      folders: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!matter) {
    notFound();
  }

  /*
   * ============================================================
   * MATTER CONTROL
   * ============================================================
   *
   * Matter Control is calculated directly on the server.
   *
   * No numerical score is used.
   */

  const matterControl = await getMatterControl(
    matter.id,
    session.user.firmId,
  );

  const role = session.user.role;

  const canUpdateMatter = hasPermission(
    role,
    "matters.update",
  );

  const canDeleteMatter = hasPermission(
    role,
    "matters.delete",
  );

  const canUploadDocument = hasPermission(
    role,
    "documents.upload",
  );

  const canCreateTask = hasPermission(
    role,
    "tasks.create",
  );

  const canManageUsers = hasPermission(
    role,
    "matters.manage_users",
  );

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl">

        {/* ===================================================== */}
        {/* BACK */}
        {/* ===================================================== */}

        <div className="mb-6">
          <Link
            href="/dashboard/matters"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-blue-700"
          >
            ← Back to Matters
          </Link>
        </div>

        {/* ===================================================== */}
        {/* HEADER */}
        {/* ===================================================== */}

        <section className="mb-8 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 p-6 sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">

              <div className="min-w-0">

                <div className="mb-3 flex flex-wrap items-center gap-3">

                  <span className="rounded-lg bg-slate-100 px-3 py-1.5 font-mono text-xs font-semibold text-slate-700">
                    {matter.referenceNumber}
                  </span>

                  <span
                    className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${getStatusClasses(
                      matter.status,
                    )}`}
                  >
                    {formatStatus(matter.status)}
                  </span>

                </div>

                <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                  {matter.title}
                </h1>

                <p className="mt-2 text-slate-500">
                  {matter.practiceArea ||
                    "No practice area specified"}
                </p>

              </div>

              <div className="flex flex-wrap gap-3">

                {canUpdateMatter && (
                  <Link
                    href={`/dashboard/matters/${matter.id}/edit`}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Edit Matter
                  </Link>
                )}

                {canDeleteMatter &&
                  matter.status !== "ARCHIVED" && (
                    <Link
                      href={`/dashboard/matters/${matter.id}/edit`}
                      className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
                    >
                      Archive Matter
                    </Link>
                  )}

              </div>

            </div>
          </div>

          {/* =================================================== */}
          {/* MATTER METADATA */}
          {/* =================================================== */}

          <div className="grid grid-cols-1 divide-y divide-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">

            <div className="p-6">

              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Client
              </p>

              <Link
                href={`/dashboard/clients/${matter.client.id}`}
                className="mt-2 block font-semibold text-slate-900 hover:text-blue-700"
              >
                {matter.client.name}
              </Link>

              <p className="mt-1 text-xs text-slate-500">
                {matter.client.referenceNumber}
              </p>

            </div>

            <div className="p-6">

              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Practice Area
              </p>

              <p className="mt-2 font-semibold text-slate-900">
                {matter.practiceArea || "Not specified"}
              </p>

            </div>

            <div className="p-6">

              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Opened
              </p>

              <p className="mt-2 font-semibold text-slate-900">
                {formatDate(matter.openedAt)}
              </p>

            </div>

            <div className="p-6">

              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Closed
              </p>

              <p className="mt-2 font-semibold text-slate-900">
                {formatDate(matter.closedAt)}
              </p>

            </div>

          </div>
        </section>

        {/* ===================================================== */}
        {/* DESCRIPTION */}
        {/* ===================================================== */}

        <section className="mb-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">

          <div className="mb-4">

            <h2 className="text-lg font-bold text-slate-900">
              Matter Description
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Summary and background information for this matter.
            </p>

          </div>

          {matter.description ? (
            <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
              {matter.description}
            </p>
          ) : (
            <div className="rounded-lg bg-slate-50 p-5 text-sm text-slate-500">
              No description has been added to this matter.
            </div>
          )}

        </section>

        {/* ===================================================== */}
        {/* MATTER CONTROL */}
        {/* ===================================================== */}

        {matterControl && (
          <MatterControl
            control={matterControl}
          />
        )}

        {/* ===================================================== */}
        {/* MATTER TIMELINE */}
        {/* ===================================================== */}

        <MatterTimeline
          matterId={matter.id}
        />

        {/* ===================================================== */}
        {/* QUICK STATS */}
        {/* ===================================================== */}

        <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">

            <p className="text-sm text-slate-500">
              Assigned Users
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              {matter.users.length}
            </p>

          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">

            <p className="text-sm text-slate-500">
              Documents
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              {matter.documents.length}
            </p>

          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">

            <p className="text-sm text-slate-500">
              Tasks
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              {matter.tasks.length}
            </p>

          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">

            <p className="text-sm text-slate-500">
              Folders
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              {matter.folders.length}
            </p>

          </div>

        </section>

        {/* ===================================================== */}
        {/* MAIN CONTENT */}
        {/* ===================================================== */}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">

          {/* =================================================== */}
          {/* LEFT / MAIN */}
          {/* =================================================== */}

          <div className="space-y-8 lg:col-span-2">

            {/* ================================================= */}
            {/* DOCUMENTS */}
            {/* ================================================= */}

            <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">

              <div className="flex items-center justify-between border-b border-slate-200 p-6">

                <div>

                  <h2 className="text-lg font-bold text-slate-900">
                    Documents
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Recent documents associated with this matter.
                  </p>

                </div>

                {canUploadDocument && (
                  <Link
                    href={`/dashboard/documents/new?matterId=${matter.id}`}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    + Upload
                  </Link>
                )}

              </div>

              {matter.documents.length === 0 ? (
                <div className="p-8 text-center">

                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xl">
                    📄
                  </div>

                  <h3 className="mt-4 font-semibold text-slate-900">
                    No documents
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    No documents have been uploaded to this matter.
                  </p>

                  {canUploadDocument && (
                    <Link
                      href={`/dashboard/documents/new?matterId=${matter.id}`}
                      className="mt-4 inline-flex rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                    >
                      Upload Document
                    </Link>
                  )}

                </div>
              ) : (
                <div className="divide-y divide-slate-200">

                  {matter.documents.map((document) => (

                    <Link
                      key={document.id}
                      href={`/dashboard/documents/${document.id}`}
                      className="flex items-center justify-between gap-4 p-5 transition hover:bg-slate-50"
                    >

                      <div className="min-w-0">

                        <p className="truncate font-semibold text-slate-900">
                          {document.name}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {document.referenceNumber}
                        </p>

                      </div>

                      <span className="shrink-0 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                        {document.status}
                      </span>

                    </Link>

                  ))}

                </div>
              )}

            </section>

            {/* ================================================= */}
            {/* TASKS */}
            {/* ================================================= */}

            <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">

              <div className="flex items-center justify-between border-b border-slate-200 p-6">

                <div>

                  <h2 className="text-lg font-bold text-slate-900">
                    Tasks
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Tasks associated with this matter.
                  </p>

                </div>

                {canCreateTask && (
                  <Link
                    href={`/dashboard/tasks/new?matterId=${matter.id}`}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    + Task
                  </Link>
                )}

              </div>

              {matter.tasks.length === 0 ? (
                <div className="p-8 text-center">

                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xl">
                    ✓
                  </div>

                  <h3 className="mt-4 font-semibold text-slate-900">
                    No tasks
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    No tasks have been assigned to this matter.
                  </p>

                  {canCreateTask && (
                    <Link
                      href={`/dashboard/tasks/new?matterId=${matter.id}`}
                      className="mt-4 inline-flex rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                    >
                      Create Task
                    </Link>
                  )}

                </div>
              ) : (
                <div className="divide-y divide-slate-200">

                  {matter.tasks.map((task) => (

                    <Link
                      key={task.id}
                      href={`/dashboard/tasks/${task.id}`}
                      className="block p-5 transition hover:bg-slate-50"
                    >

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                        <div className="min-w-0">

                          <p className="font-semibold text-slate-900">
                            {task.title}
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            {task.priority}

                            {task.dueDate
                              ? ` • Due ${formatDate(task.dueDate)}`
                              : ""}
                          </p>

                        </div>

                        <span
                          className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${getTaskStatusClasses(
                            task.status,
                          )}`}
                        >
                          {formatStatus(task.status)}
                        </span>

                      </div>

                    </Link>

                  ))}

                </div>
              )}

            </section>

            {/* ================================================= */}
            {/* FOLDERS */}
            {/* ================================================= */}

            <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">

              <div className="mb-6">

                <h2 className="text-lg font-bold text-slate-900">
                  Matter Folders
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Organise documents and files for this matter.
                </p>

              </div>

              <FolderManager
                matterId={matter.id}
                canCreateFolder={canUploadDocument}
              />

            </section>

            {/* ================================================= */}
            {/* ASSIGNED USERS MANAGEMENT */}
            {/* ================================================= */}

            <MatterUsers
              matterId={matter.id}
              canManageUsers={canManageUsers}
            />

          </div>

          {/* =================================================== */}
          {/* RIGHT SIDEBAR */}
          {/* =================================================== */}

          <aside className="space-y-8">

            {/* ================================================= */}
            {/* CLIENT */}
            {/* ================================================= */}

            <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">

              <div className="mb-5">

                <h2 className="text-lg font-bold text-slate-900">
                  Client
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Client linked to this matter.
                </p>

              </div>

              <div className="rounded-xl bg-slate-50 p-4">

                <p className="font-semibold text-slate-900">
                  {matter.client.name}
                </p>

                <p className="mt-1 font-mono text-xs text-slate-500">
                  {matter.client.referenceNumber}
                </p>

                {matter.client.email && (
                  <p className="mt-3 text-sm text-slate-600">
                    {matter.client.email}
                  </p>
                )}

                {matter.client.phone && (
                  <p className="mt-1 text-sm text-slate-600">
                    {matter.client.phone}
                  </p>
                )}

              </div>

              <Link
                href={`/dashboard/clients/${matter.client.id}`}
                className="mt-4 block text-center text-sm font-semibold text-blue-700 hover:text-blue-900"
              >
                View Client →
              </Link>

            </section>

            {/* ================================================= */}
            {/* MATTER INFORMATION */}
            {/* ================================================= */}

            <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">

              <h2 className="text-lg font-bold text-slate-900">
                Matter Information
              </h2>

              <div className="mt-5 space-y-4">

                <div>

                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Reference
                  </p>

                  <p className="mt-1 font-mono text-sm text-slate-700">
                    {matter.referenceNumber}
                  </p>

                </div>

                <div>

                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Status
                  </p>

                  <p className="mt-1 text-sm font-medium text-slate-700">
                    {formatStatus(matter.status)}
                  </p>

                </div>

                <div>

                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Created
                  </p>

                  <p className="mt-1 text-sm text-slate-700">
                    {formatDateTime(matter.createdAt)}
                  </p>

                </div>

                <div>

                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Last Updated
                  </p>

                  <p className="mt-1 text-sm text-slate-700">
                    {formatDateTime(matter.updatedAt)}
                  </p>

                </div>

              </div>

            </section>

          </aside>

        </div>

      </div>
    </main>
  );
}