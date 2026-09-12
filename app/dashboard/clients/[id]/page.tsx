import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";

import DeleteClientButton from "./components/DeleteClientButton";

type ClientPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatFileSize(bytes: bigint | number) {
  const value = Number(bytes);

  if (!Number.isFinite(value) || value < 0) {
    return "Unknown";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  if (value < 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(
    value /
    (1024 * 1024 * 1024)
  ).toFixed(1)} GB`;
}

export default async function ClientDetailsPage({
  params,
}: ClientPageProps) {
  // =====================================================
  // AUTHENTICATION
  // =====================================================

  const session = await auth();

  if (
    !session?.user?.id ||
    !session.user.firmId
  ) {
    redirect("/login");
  }

  const userId = session.user.id;
  const firmId = session.user.firmId;

  const { id } = await params;

  // =====================================================
  // PERMISSIONS
  // =====================================================

  const canUpdateClient = hasPermission(
    session.user.role,
    "clients.update"
  );

  const canDeleteClient = hasPermission(
    session.user.role,
    "clients.delete"
  );

  const canCreateMatter = hasPermission(
    session.user.role,
    "matters.create"
  );

  const canUploadDocument = hasPermission(
    session.user.role,
    "documents.upload"
  );

  const canDownloadDocument = hasPermission(
    session.user.role,
    "documents.download"
  );

  // =====================================================
  // VERIFY USER BELONGS TO FIRM
  // =====================================================

  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      firmId,
      status: "ACTIVE",
    },
    select: {
      id: true,
      role: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  // =====================================================
  // CLIENT
  // =====================================================

  const client = await prisma.client.findFirst({
    where: {
      id,
      firmId,
    },

    include: {
      matters: {
        orderBy: {
          createdAt: "desc",
        },

        include: {
          documents: {
            where: {
              status: {
                not: "DELETED",
              },
            },

            orderBy: {
              createdAt: "desc",
            },

            select: {
              id: true,
              referenceNumber: true,
              name: true,
              originalName: true,
              mimeType: true,
              extension: true,
              size: true,
              status: true,
              currentVersion: true,
              category: true,
              createdAt: true,
            },
          },

          _count: {
            select: {
              documents: true,
              tasks: true,
            },
          },
        },
      },

      _count: {
        select: {
          matters: true,
        },
      },
    },
  });

  // =====================================================
  // CLIENT NOT FOUND
  // =====================================================

  if (!client) {
    notFound();
  }

  // =====================================================
  // DOCUMENT COUNT
  // =====================================================

  const documentCount = client.matters.reduce(
    (total, matter) =>
      total + matter.documents.length,
    0
  );

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl">

        {/* ================================================= */}
        {/* HEADER */}
        {/* ================================================= */}

        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

          <div>
            <p className="text-sm font-medium text-slate-500">
              Client File
            </p>

            <h1 className="mt-1 text-3xl font-bold text-slate-900">
              {client.name}
            </h1>

            <p className="mt-2 font-mono text-sm font-semibold text-blue-700">
              {client.referenceNumber}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">

            <Link
              href="/dashboard/clients"
              className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              ← Back to Clients
            </Link>

            {canUpdateClient && (
              <Link
                href={`/dashboard/clients/${client.id}/edit`}
                className="rounded-lg border border-blue-300 bg-white px-5 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-50"
              >
                Edit Client
              </Link>
            )}

            {canDeleteClient && (
              <DeleteClientButton
                clientId={client.id}
                clientName={client.name}
              />
            )}

            {canCreateMatter && (
              <Link
                href={`/dashboard/matters/new?clientId=${client.id}`}
                className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
              >
                + New Matter
              </Link>
            )}

          </div>
        </div>

        {/* ================================================= */}
        {/* SUMMARY CARDS */}
        {/* ================================================= */}

        <div className="grid gap-4 md:grid-cols-3">

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">
              Client Reference
            </p>

            <p className="mt-2 font-mono text-xl font-bold text-blue-700">
              {client.referenceNumber}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">
              Legal Matters
            </p>

            <p className="mt-2 text-2xl font-bold text-slate-900">
              {client._count.matters}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">
              Documents
            </p>

            <p className="mt-2 text-2xl font-bold text-slate-900">
              {documentCount}
            </p>
          </div>

        </div>

        {/* ================================================= */}
        {/* CLIENT INFORMATION */}
        {/* ================================================= */}

        <section className="mt-6 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">

          <div className="mb-6 flex items-center justify-between">

            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Client Information
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Core information for this client file.
              </p>
            </div>

            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
              Active
            </span>

          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Client Name
              </p>

              <p className="mt-2 font-semibold text-slate-900">
                {client.name}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Client Type
              </p>

              <p className="mt-2 font-semibold text-slate-900">
                {client.type.replaceAll("_", " ")}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Reference Number
              </p>

              <p className="mt-2 font-mono font-semibold text-blue-700">
                {client.referenceNumber}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                ID / Registration
              </p>

              <p className="mt-2 font-semibold text-slate-900">
                {client.idNumber || "Not provided"}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Phone
              </p>

              <p className="mt-2 font-semibold text-slate-900">
                {client.phone || "Not provided"}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Email
              </p>

              <p className="mt-2 font-semibold text-slate-900">
                {client.email || "Not provided"}
              </p>
            </div>

            <div className="lg:col-span-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Address
              </p>

              <p className="mt-2 text-slate-900">
                {client.address || "Not provided"}
              </p>
            </div>

            <div className="lg:col-span-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Notes
              </p>

              <p className="mt-2 whitespace-pre-wrap text-slate-900">
                {client.notes || "No notes have been added."}
              </p>
            </div>

          </div>
        </section>

        {/* ================================================= */}
        {/* LEGAL MATTERS */}
        {/* ================================================= */}

        <section className="mt-6 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">

          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Legal Matters
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                All matters associated with this client.
              </p>
            </div>

            {canCreateMatter && (
              <Link
                href={`/dashboard/matters/new?clientId=${client.id}`}
                className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
              >
                + New Matter
              </Link>
            )}

          </div>

          {client.matters.length === 0 ? (

            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">

              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl shadow-sm">
                ⚖️
              </div>

              <h3 className="font-semibold text-slate-900">
                No legal matters yet
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                {canCreateMatter
                  ? "Create a matter to start building this client's legal file."
                  : "No legal matters have been created for this client yet."}
              </p>

              {canCreateMatter && (
                <Link
                  href={`/dashboard/matters/new?clientId=${client.id}`}
                  className="mt-5 inline-flex rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Create Matter
                </Link>
              )}

            </div>

          ) : (

            <div className="space-y-6">

              {client.matters.map((matter) => (

                <div
                  key={matter.id}
                  className="rounded-xl border border-slate-200"
                >

                  {/* Matter header */}

                  <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50 p-5 md:flex-row md:items-center md:justify-between">

                    <div>

                      <Link
                        href={`/dashboard/matters/${matter.id}`}
                        className="font-semibold text-blue-700 hover:text-blue-900 hover:underline"
                      >
                        {matter.referenceNumber}
                      </Link>

                      <h3 className="mt-1 text-lg font-semibold text-slate-900">
                        {matter.title}
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        Opened {formatDate(matter.openedAt)}
                      </p>

                    </div>

                    <div className="flex flex-wrap gap-2">

                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                        {matter.status}
                      </span>

                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                        {matter._count.documents} documents
                      </span>

                    </div>

                  </div>

                  {/* Documents */}

                  <div className="p-5">

                    <div className="mb-4 flex items-center justify-between">

                      <div>
                        <h4 className="font-semibold text-slate-900">
                          Matter Documents
                        </h4>

                        <p className="mt-1 text-xs text-slate-500">
                          Court files, correspondence and other documents.
                        </p>
                      </div>

                      {canUploadDocument && (
                        <Link
                          href={`/dashboard/documents/new?matterId=${matter.id}`}
                          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          + Upload
                        </Link>
                      )}

                    </div>

                    {matter.documents.length === 0 ? (

                      <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center">

                        <p className="text-sm font-medium text-slate-700">
                          No documents in this matter.
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {canUploadDocument
                            ? "Upload court documents or other matter-related files."
                            : "No documents have been uploaded to this matter yet."}
                        </p>

                      </div>

                    ) : (

                      <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">

                        {matter.documents.map((document) => (

                          <div
                            key={document.id}
                            className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between"
                          >

                            <div className="min-w-0">

                              <Link
                                href={`/dashboard/documents/${document.id}`}
                                className="font-medium text-slate-900 hover:text-blue-700 hover:underline"
                              >
                                {document.name}
                              </Link>

                              <p className="mt-1 text-xs text-slate-500">
                                {document.referenceNumber}
                              </p>

                              <div className="mt-2 flex flex-wrap gap-2">

                                <span className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-600">
                                  v{document.currentVersion}
                                </span>

                                <span className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-600">
                                  {document.extension.toUpperCase()}
                                </span>

                                <span className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-600">
                                  {formatFileSize(document.size)}
                                </span>

                                {document.category && (
                                  <span className="rounded bg-blue-50 px-2 py-1 text-[11px] text-blue-700">
                                    {document.category}
                                  </span>
                                )}

                              </div>

                            </div>

                            <div className="flex shrink-0 gap-2">

                              <a
                                href={`/api/documents/${document.id}/preview`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                Preview
                              </a>

                              {canDownloadDocument && (
                                <a
                                  href={`/api/documents/${document.id}/download`}
                                  className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
                                >
                                  Download
                                </a>
                              )}

                            </div>

                          </div>

                        ))}

                      </div>

                    )}

                  </div>

                </div>

              ))}

            </div>

          )}

        </section>

        {/* ================================================= */}
        {/* CLIENT FILE INFORMATION */}
        {/* ================================================= */}

        <section className="mt-6 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">

          <h2 className="text-xl font-bold text-slate-900">
            Client File
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            This file belongs exclusively to your law firm.
          </p>

          <div className="mt-5 rounded-xl bg-slate-50 p-5">

            <div className="grid gap-4 md:grid-cols-3">

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Client Reference
                </p>

                <p className="mt-1 font-mono font-semibold text-slate-900">
                  {client.referenceNumber}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Created
                </p>

                <p className="mt-1 text-sm font-medium text-slate-900">
                  {formatDate(client.createdAt)}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Matters
                </p>

                <p className="mt-1 text-sm font-medium text-slate-900">
                  {client._count.matters}
                </p>
              </div>

            </div>

          </div>

        </section>

      </div>
    </main>
  );
}