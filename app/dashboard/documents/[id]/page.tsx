import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import UploadVersionForm from "./UploadVersionForm";
import VersionHistory from "./VersionHistory";

type DocumentPageProps = {
  params: Promise<{
    id: string;
  }>;
};

// =====================================================
// FILE SIZE
// =====================================================

function formatFileSize(bytes: bigint | number) {
  const value =
    typeof bytes === "bigint"
      ? Number(bytes)
      : bytes;

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(2)} KB`;
  }

  if (value < 1024 * 1024 * 1024) {
    return `${(
      value /
      (1024 * 1024)
    ).toFixed(2)} MB`;
  }

  return `${(
    value /
    (1024 * 1024 * 1024)
  ).toFixed(2)} GB`;
}

// =====================================================
// DATE
// =====================================================

function formatDate(date: Date) {
  return new Intl.DateTimeFormat(
    "en-ZA",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
    }
  ).format(date);
}

// =====================================================
// STATUS
// =====================================================

function getStatusClasses(
  status: string
) {
  switch (status) {
    case "ACTIVE":
      return "bg-green-100 text-green-700";

    case "ARCHIVED":
      return "bg-amber-100 text-amber-700";

    case "DELETED":
      return "bg-red-100 text-red-700";

    default:
      return "bg-slate-100 text-slate-700";
  }
}

// =====================================================
// PAGE
// =====================================================

export default async function DocumentPage({
  params,
}: DocumentPageProps) {
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
  // CURRENT USER
  // =====================================================

  const user =
    await prisma.user.findFirst({
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
  // DOCUMENT
  // =====================================================

  const document =
    await prisma.document.findFirst({
      where: {
        id,
        firmId,

        status: {
          not: "DELETED",
        },
      },

      include: {
        // =================================================
        // MATTER
        // =================================================

        matter: {
          select: {
            id: true,
            referenceNumber: true,
            title: true,
          },
        },

        // =================================================
        // FOLDER
        // =================================================

        folder: {
          select: {
            id: true,
            name: true,
          },
        },

        // =================================================
        // UPLOADED BY
        // =================================================

        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },

        // =================================================
        // VERSION HISTORY
        // =================================================

        versions: {
          orderBy: {
            version: "desc",
          },

          select: {
            id: true,
            version: true,
            storageKey: true,
            size: true,
            uploadedById: true,
            changeNote: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

  // =====================================================
  // DOCUMENT NOT FOUND
  // =====================================================

  if (!document) {
    notFound();
  }

  // =====================================================
  // ACCESS CONTROL
  // =====================================================

  const privilegedRoles = [
    "SUPER_ADMIN",
    "MANAGING_PARTNER",
    "ADMIN",
  ];

  const isPrivileged =
    privilegedRoles.includes(
      user.role
    );

  let canView = isPrivileged;
  let canDownload = isPrivileged;
  let canUploadVersion =
    isPrivileged;
  let canManageVersions =
    isPrivileged;

  if (!isPrivileged) {
    const matterAccess =
      await prisma.matterUser.findFirst({
        where: {
          matterId:
            document.matter.id,

          userId,
        },

        select: {
          canView: true,
          canDownload: true,
          canUpload: true,
          canManage: true,
        },
      });

    canView =
      matterAccess?.canView === true;

    canDownload =
      matterAccess?.canDownload === true;

    canUploadVersion =
      matterAccess?.canUpload === true;

    canManageVersions =
      matterAccess?.canManage === true;
  }

  // =====================================================
  // DENY VIEW
  // =====================================================

  if (!canView) {
    notFound();
  }

  // =====================================================
  // STATUS
  // =====================================================

  const statusClasses =
    getStatusClasses(
      document.status
    );

  // =====================================================
  // SERIALIZE VERSION DATA
  // =====================================================
  //
  // Prisma returns BigInt for file sizes.
  // BigInt cannot be passed directly from a
  // Server Component to a Client Component.
  //
  // Convert the size to a normal number first.
  // =====================================================

  const versionHistory =
    document.versions.map(
      (version) => ({
        ...version,
        size: Number(version.size),
      })
    );

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl">

        {/* ================================================= */}
        {/* BACK */}
        {/* ================================================= */}

        <div className="mb-6">
          <Link
            href={`/dashboard/matters/${document.matter.id}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            <span aria-hidden="true">
              ←
            </span>

            Back to Matter
          </Link>
        </div>

        {/* ================================================= */}
        {/* HEADER */}
        {/* ================================================= */}

        <section className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">

          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">

            <div className="min-w-0">

              <div className="flex flex-wrap items-center gap-3">

                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses}`}
                >
                  {document.status}
                </span>

                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  v{document.currentVersion}
                </span>

              </div>

              <h1 className="mt-4 break-words text-3xl font-bold text-slate-900">
                {document.name}
              </h1>

              <p className="mt-2 break-all text-sm text-slate-500">
                {document.referenceNumber}
              </p>

              <p className="mt-3 text-sm text-slate-600">
                Original file:{" "}
                <span className="font-medium text-slate-900">
                  {document.originalName}
                </span>
              </p>

            </div>

            <div className="flex flex-wrap gap-3">

              {canView && (
                <a
                  href={`/api/documents/${document.id}/preview`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-blue-300 bg-blue-50 px-5 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                >
                  Preview
                </a>
              )}

              {canDownload && (
                <a
                  href={`/api/documents/${document.id}/download`}
                  className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Download
                </a>
              )}

              <Link
                href="/dashboard/documents"
                className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Document Repository
              </Link>

            </div>

          </div>

        </section>

        {/* ================================================= */}
        {/* DOCUMENT INFORMATION */}
        {/* ================================================= */}

        <section className="mt-6 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">

          <h2 className="text-xl font-bold text-slate-900">
            Document Information
          </h2>

          <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Matter
              </p>

              <Link
                href={`/dashboard/matters/${document.matter.id}`}
                className="mt-2 block font-semibold text-blue-600 hover:text-blue-800"
              >
                {document.matter.referenceNumber}
              </Link>

              <p className="mt-1 text-sm text-slate-600">
                {document.matter.title}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                File Type
              </p>

              <p className="mt-2 font-semibold text-slate-900">
                {document.extension.toUpperCase()}
              </p>

              <p className="mt-1 text-sm text-slate-500">
                {document.mimeType}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                File Size
              </p>

              <p className="mt-2 font-semibold text-slate-900">
                {formatFileSize(
                  document.size
                )}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Uploaded
              </p>

              <p className="mt-2 font-semibold text-slate-900">
                {formatDate(
                  document.createdAt
                )}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Last Updated
              </p>

              <p className="mt-2 font-semibold text-slate-900">
                {formatDate(
                  document.updatedAt
                )}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Current Version
              </p>

              <p className="mt-2 font-semibold text-slate-900">
                Version{" "}
                {document.currentVersion}
              </p>
            </div>

          </div>

        </section>

        {/* ================================================= */}
        {/* FOLDER */}
        {/* ================================================= */}

        <section className="mt-6 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">

          <h2 className="text-xl font-bold text-slate-900">
            Folder
          </h2>

          <div className="mt-5">

            {document.folder ? (
              <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-5">

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-xl">
                  📁
                </div>

                <div>

                  <p className="font-semibold text-slate-900">
                    {document.folder.name}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    Matter folder
                  </p>

                </div>

              </div>
            ) : (
              <p className="text-slate-500">
                This document is not assigned to a folder.
              </p>
            )}

          </div>

        </section>

        {/* ================================================= */}
        {/* CATEGORY */}
        {/* ================================================= */}

        <section className="mt-6 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">

          <h2 className="text-xl font-bold text-slate-900">
            Category
          </h2>

          <div className="mt-5">

            {document.category ? (
              <span className="rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700">
                {document.category}
              </span>
            ) : (
              <p className="text-sm text-slate-500">
                No category assigned.
              </p>
            )}

          </div>

        </section>

        {/* ================================================= */}
        {/* TAGS */}
        {/* ================================================= */}

        <section className="mt-6 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">

          <h2 className="text-xl font-bold text-slate-900">
            Tags
          </h2>

          <div className="mt-5 flex flex-wrap gap-2">

            {document.tags.length > 0 ? (
              document.tags.map(
                (tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700"
                  >
                    {tag}
                  </span>
                )
              )
            ) : (
              <p className="text-sm text-slate-500">
                No tags assigned.
              </p>
            )}

          </div>

        </section>

        {/* ================================================= */}
        {/* UPLOADED BY */}
        {/* ================================================= */}

        <section className="mt-6 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">

          <h2 className="text-xl font-bold text-slate-900">
            Uploaded By
          </h2>

          <div className="mt-5">

            <p className="font-semibold text-slate-900">
              {document.uploadedBy.name ||
                "Unknown user"}
            </p>

            {document.uploadedBy.email && (
              <p className="mt-1 text-sm text-slate-500">
                {document.uploadedBy.email}
              </p>
            )}

          </div>

        </section>

        {/* ================================================= */}
        {/* UPLOAD NEW VERSION */}
        {/* ================================================= */}

        {canUploadVersion && (
          <UploadVersionForm
            documentId={
              document.id
            }
            currentVersion={
              document.currentVersion
            }
          />
        )}

        {/* ================================================= */}
        {/* VERSION HISTORY */}
        {/* ================================================= */}

        <VersionHistory
          documentId={document.id}
          currentVersion={
            document.currentVersion
          }
          versions={versionHistory}
          canView={canView}
          canDownload={canDownload}
          canManageVersions={
            canManageVersions
          }
        />

      </div>
    </main>
  );
}