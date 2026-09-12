"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Version = {
  id: string;
  version: number;
  size: number;
  uploadedById: string;
  changeNote: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type VersionHistoryProps = {
  documentId: string;
  currentVersion: number;
  versions: Version[];
  canView: boolean;
  canDownload: boolean;
  canManageVersions: boolean;
};

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

function formatDate(date: Date) {
  return new Intl.DateTimeFormat(
    "en-ZA",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
    }
  ).format(new Date(date));
}

export default function VersionHistory({
  documentId,
  currentVersion,
  versions,
  canView,
  canDownload,
  canManageVersions,
}: VersionHistoryProps) {
  const router = useRouter();

  const [restoringVersion, setRestoringVersion] =
    useState<number | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const [success, setSuccess] =
    useState<string | null>(null);

  async function handleRestore(
    version: number
  ) {
    const confirmed =
      window.confirm(
        `Restore Version ${version}?\n\n` +
          `This will make Version ${version} the current version of this document. ` +
          `The existing current version will remain preserved in the version history.`
      );

    if (!confirmed) {
      return;
    }

    setRestoringVersion(version);
    setError(null);
    setSuccess(null);

    try {
      const response =
        await fetch(
          `/api/documents/${documentId}/versions/${version}/restore`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Failed to restore the document version."
        );
      }

      setSuccess(
        `Version ${version} restored successfully.`
      );

      router.refresh();
    } catch (restoreError) {
      setError(
        restoreError instanceof Error
          ? restoreError.message
          : "Failed to restore the document version."
      );
    } finally {
      setRestoringVersion(null);
    }
  }

  return (
    <section className="mt-6 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">

      {/* ================================================= */}
      {/* HEADER */}
      {/* ================================================= */}

      <div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Version History
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              View, download, and restore previous versions of this document.
            </p>
          </div>

          <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {versions.length}{" "}
            {versions.length === 1
              ? "version"
              : "versions"}
          </span>

        </div>
      </div>

      {/* ================================================= */}
      {/* SUCCESS MESSAGE */}
      {/* ================================================= */}

      {success && (
        <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-700">
          {success}
        </div>
      )}

      {/* ================================================= */}
      {/* ERROR MESSAGE */}
      {/* ================================================= */}

      {error && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {/* ================================================= */}
      {/* VERSION LIST */}
      {/* ================================================= */}

      <div className="mt-6 space-y-4">

        {versions.length === 0 ? (

          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">

            <p className="text-sm text-slate-500">
              No version history available.
            </p>

          </div>

        ) : (

          versions.map((version) => {
            const isCurrent =
              version.version ===
              currentVersion;

            const isRestoring =
              restoringVersion ===
              version.version;

            return (
              <div
                key={version.id}
                className={`rounded-xl border p-5 transition ${
                  isCurrent
                    ? "border-green-200 bg-green-50/40"
                    : "border-slate-200 bg-white"
                }`}
              >

                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

                  {/* ======================================= */}
                  {/* VERSION INFORMATION */}
                  {/* ======================================= */}

                  <div className="min-w-0">

                    <div className="flex flex-wrap items-center gap-3">

                      <span
                        className={`rounded-lg px-3 py-1 text-sm font-semibold ${
                          isCurrent
                            ? "bg-green-100 text-green-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        Version{" "}
                        {version.version}
                      </span>

                      {isCurrent && (
                        <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                          Current
                        </span>
                      )}

                    </div>

                    <p className="mt-3 break-words text-sm font-medium text-slate-800">
                      {version.changeNote ||
                        "Document version"}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">

                      <span>
                        Uploaded{" "}
                        {formatDate(
                          version.createdAt
                        )}
                      </span>

                      <span>
                        {formatFileSize(
                          version.size
                        )}
                      </span>

                    </div>

                  </div>

                  {/* ======================================= */}
                  {/* ACTIONS */}
                  {/* ======================================= */}

                  <div className="flex flex-wrap gap-2">

                    {canView && (
                      <a
                        href={`/api/documents/${documentId}/versions/${version.version}/preview`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-fit rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
                      >
                        Preview
                      </a>
                    )}

                    {canDownload && (
                      <a
                        href={`/api/documents/${documentId}/versions/${version.version}/download`}
                        className="w-fit rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Download
                      </a>
                    )}

                    {canManageVersions &&
                      !isCurrent && (
                        <button
                          type="button"
                          onClick={() =>
                            handleRestore(
                              version.version
                            )
                          }
                          disabled={isRestoring}
                          className="w-fit rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isRestoring
                            ? "Restoring..."
                            : "Restore"}
                        </button>
                      )}

                  </div>

                </div>

              </div>
            );
          })

        )}

      </div>

    </section>
  );
}