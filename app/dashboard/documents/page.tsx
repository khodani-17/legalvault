"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

import {
  hasPermission,
  type Permission,
} from "@/lib/permissions";

type Document = {
  id: string;
  referenceNumber: string;
  name: string;
  originalName: string;
  mimeType: string;
  extension: string;
  size: string | number | bigint;
  status: string;
  currentVersion: number;
  category: string | null;
  tags: string[];
  createdAt: string;

  matter: {
    id: string;
    referenceNumber: string;
    title: string;
  };

  folder: {
    id: string;
    name: string;
  } | null;

  uploadedBy: {
    id: string;
    name: string;
    email: string;
  };
};

type SortOption =
  | "newest"
  | "oldest"
  | "name-asc"
  | "name-desc"
  | "version"
  | "size";

type DocumentAction =
  | "ARCHIVE"
  | "RESTORE"
  | "DELETE";

// =====================================================
// FILE SIZE
// =====================================================

function formatFileSize(
  size: string | number | bigint
) {
  const bytes = Number(size);

  if (!Number.isFinite(bytes) || bytes < 0) {
    return "Unknown";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  if (bytes < 1024 * 1024 * 1024) {
    return `${(
      bytes /
      (1024 * 1024)
    ).toFixed(1)} MB`;
  }

  return `${(
    bytes /
    (1024 * 1024 * 1024)
  ).toFixed(1)} GB`;
}

// =====================================================
// DATE
// =====================================================

function formatDate(date: string) {
  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(parsedDate);
}

// =====================================================
// NORMALIZE FILE EXTENSION
// =====================================================

function normalizeExtension(extension: string) {
  return extension
    ?.toLowerCase()
    .trim()
    .replace(/^\./, "");
}

// =====================================================
// FILE ICON
// =====================================================

function getFileIcon(extension: string) {
  const normalized =
    normalizeExtension(extension);

  switch (normalized) {
    case "pdf":
      return "📕";

    case "doc":
    case "docx":
      return "📘";

    case "xls":
    case "xlsx":
      return "📗";

    case "ppt":
    case "pptx":
      return "📙";

    case "jpg":
    case "jpeg":
    case "png":
    case "gif":
    case "webp":
      return "🖼️";

    case "txt":
      return "📄";

    case "csv":
      return "📊";

    case "zip":
    case "rar":
    case "7z":
      return "🗜️";

    default:
      return "📎";
  }
}

// =====================================================
// FILE TYPE LABEL
// =====================================================

function formatFileType(extension: string) {
  const normalized =
    normalizeExtension(extension);

  if (!normalized) {
    return "FILE";
  }

  return normalized.toUpperCase();
}

// =====================================================
// STATUS CLASSES
// =====================================================

function getStatusClasses(status: string) {
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
// STATUS LABEL
// =====================================================

function getStatusLabel(status: string) {
  switch (status) {
    case "ACTIVE":
      return "Active";

    case "ARCHIVED":
      return "Archived";

    case "DELETED":
      return "Deleted";

    default:
      return status;
  }
}

export default function DocumentsPage() {
  // =====================================================
  // SESSION / PERMISSIONS
  // =====================================================

  const { data: session } = useSession();

  const userRole =
    session?.user?.role ?? "";

  function can(permission: Permission) {
    return hasPermission(
      userRole,
      permission
    );
  }

  // =====================================================
  // STATE
  // =====================================================

  const [documents, setDocuments] =
    useState<Document[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [matterFilter, setMatterFilter] =
    useState("");

  const [categoryFilter, setCategoryFilter] =
    useState("");

  const [folderFilter, setFolderFilter] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("ACTIVE");

  const [sortBy, setSortBy] =
    useState<SortOption>("newest");

  const [currentPage, setCurrentPage] =
    useState(1);

  const [pageSize, setPageSize] =
    useState(10);

  const [actionDocument, setActionDocument] =
    useState<Document | null>(null);

  const [actionType, setActionType] =
    useState<DocumentAction | null>(null);

  const [actionLoading, setActionLoading] =
    useState(false);

  // =====================================================
  // LOAD DOCUMENTS
  // =====================================================

  async function loadDocuments() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "/api/documents",
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to load documents."
        );
      }

      setDocuments(
        data.documents || []
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDocuments();
  }, []);

  // =====================================================
  // REPOSITORY SUMMARY
  // =====================================================

  const totalDocuments =
    documents.length;

  const activeDocuments =
    documents.filter(
      (document) =>
        document.status === "ACTIVE"
    ).length;

  const archivedDocuments =
    documents.filter(
      (document) =>
        document.status === "ARCHIVED"
    ).length;

  const deletedDocuments =
    documents.filter(
      (document) =>
        document.status === "DELETED"
    ).length;

  // Prevent unused-variable warning while
  // keeping deleted count available for future
  // repository statistics.
  void deletedDocuments;

  // =====================================================
  // FILTER OPTIONS
  // =====================================================

  const matters = useMemo(() => {
    const map = new Map<
      string,
      Document["matter"]
    >();

    documents.forEach((document) => {
      if (document.matter) {
        map.set(
          document.matter.id,
          document.matter
        );
      }
    });

    return Array.from(
      map.values()
    ).sort((a, b) =>
      a.referenceNumber.localeCompare(
        b.referenceNumber
      )
    );
  }, [documents]);

  const categories = useMemo(() => {
    return Array.from(
      new Set(
        documents
          .map(
            (document) =>
              document.category
          )
          .filter(
            (
              category
            ): category is string =>
              Boolean(category)
          )
      )
    ).sort();
  }, [documents]);

  const folders = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
      }
    >();

    documents.forEach((document) => {
      if (document.folder) {
        map.set(
          document.folder.id,
          document.folder
        );
      }
    });

    return Array.from(
      map.values()
    ).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [documents]);

  // =====================================================
  // FILTERED DOCUMENTS
  // =====================================================

  const filteredDocuments = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return documents.filter((document) => {
      const tags =
        document.tags ?? [];

      const matchesSearch =
        !query ||
        document.name
          ?.toLowerCase()
          .includes(query) ||
        document.referenceNumber
          ?.toLowerCase()
          .includes(query) ||
        document.originalName
          ?.toLowerCase()
          .includes(query) ||
        document.matter?.title
          ?.toLowerCase()
          .includes(query) ||
        document.matter?.referenceNumber
          ?.toLowerCase()
          .includes(query) ||
        tags.some((tag) =>
          tag
            .toLowerCase()
            .includes(query)
        );

      const matchesMatter =
        !matterFilter ||
        document.matter?.id ===
          matterFilter;

      const matchesCategory =
        !categoryFilter ||
        document.category ===
          categoryFilter;

      const matchesFolder =
        !folderFilter ||
        document.folder?.id ===
          folderFilter;

      const matchesStatus =
        !statusFilter ||
        document.status ===
          statusFilter;

      return (
        matchesSearch &&
        matchesMatter &&
        matchesCategory &&
        matchesFolder &&
        matchesStatus
      );
    });
  }, [
    documents,
    search,
    matterFilter,
    categoryFilter,
    folderFilter,
    statusFilter,
  ]);

  // =====================================================
  // SORT DOCUMENTS
  // =====================================================

  const sortedDocuments = useMemo(() => {
    const sorted = [
      ...filteredDocuments,
    ];

    sorted.sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return (
            new Date(
              b.createdAt
            ).getTime() -
            new Date(
              a.createdAt
            ).getTime()
          );

        case "oldest":
          return (
            new Date(
              a.createdAt
            ).getTime() -
            new Date(
              b.createdAt
            ).getTime()
          );

        case "name-asc":
          return a.name.localeCompare(
            b.name
          );

        case "name-desc":
          return b.name.localeCompare(
            a.name
          );

        case "version":
          return (
            b.currentVersion -
            a.currentVersion
          );

        case "size":
          return (
            Number(b.size) -
            Number(a.size)
          );

        default:
          return 0;
      }
    });

    return sorted;
  }, [
    filteredDocuments,
    sortBy,
  ]);

  // =====================================================
  // PAGINATION
  // =====================================================

  const totalPages = Math.max(
    1,
    Math.ceil(
      sortedDocuments.length /
        pageSize
    )
  );

  const safeCurrentPage = Math.min(
    currentPage,
    totalPages
  );

  const startIndex =
    (safeCurrentPage - 1) *
    pageSize;

  const endIndex = Math.min(
    startIndex + pageSize,
    sortedDocuments.length
  );

  const paginatedDocuments =
    sortedDocuments.slice(
      startIndex,
      endIndex
    );

  // =====================================================
  // RESET PAGE WHEN FILTERS CHANGE
  // =====================================================

  useEffect(() => {
    setCurrentPage(1);
  }, [
    search,
    matterFilter,
    categoryFilter,
    folderFilter,
    statusFilter,
    sortBy,
    pageSize,
  ]);

  // =====================================================
  // CLEAR FILTERS
  // =====================================================

  function clearFilters() {
    setSearch("");
    setMatterFilter("");
    setCategoryFilter("");
    setFolderFilter("");
    setStatusFilter("ACTIVE");
    setSortBy("newest");
    setCurrentPage(1);
  }

  // =====================================================
  // REFRESH
  // =====================================================

  async function refreshDocuments() {
    await loadDocuments();
    setCurrentPage(1);
  }

  // =====================================================
  // ACTION DIALOG
  // =====================================================

  function openActionDialog(
    document: Document,
    action: DocumentAction
  ) {
    setActionDocument(document);
    setActionType(action);
    setError("");
    setSuccessMessage("");
  }

  function closeActionDialog() {
    if (actionLoading) {
      return;
    }

    setActionDocument(null);
    setActionType(null);
  }

  // =====================================================
  // PERFORM ACTION
  // =====================================================

  async function performDocumentAction() {
    if (
      !actionDocument ||
      !actionType
    ) {
      return;
    }

    try {
      setActionLoading(true);
      setError("");
      setSuccessMessage("");

      let response: Response;

      if (
        actionType === "ARCHIVE"
      ) {
        response = await fetch(
          `/api/documents/${actionDocument.id}`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              action: "ARCHIVE",
            }),
          }
        );
      } else if (
        actionType === "RESTORE"
      ) {
        response = await fetch(
          `/api/documents/${actionDocument.id}`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              action: "RESTORE",
            }),
          }
        );
      } else {
        response = await fetch(
          `/api/documents/${actionDocument.id}`,
          {
            method: "DELETE",
          }
        );
      }

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "The document action failed."
        );
      }

      if (
        actionType === "ARCHIVE"
      ) {
        setSuccessMessage(
          "Document archived successfully."
        );
      }

      if (
        actionType === "RESTORE"
      ) {
        setSuccessMessage(
          "Document restored successfully."
        );
      }

      if (
        actionType === "DELETE"
      ) {
        setSuccessMessage(
          "Document deleted successfully."
        );
      }

      setActionDocument(null);
      setActionType(null);

      await loadDocuments();
      setCurrentPage(1);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong."
      );
    } finally {
      setActionLoading(false);
    }
  }

  // =====================================================
  // ACTION DIALOG CONTENT
  // =====================================================

  function getActionTitle() {
    switch (actionType) {
      case "ARCHIVE":
        return "Archive document?";

      case "RESTORE":
        return "Restore document?";

      case "DELETE":
        return "Delete document?";

      default:
        return "";
    }
  }

  function getActionDescription() {
    if (!actionDocument) {
      return "";
    }

    switch (actionType) {
      case "ARCHIVE":
        return `Are you sure you want to archive "${actionDocument.name}"? The document will be removed from the active repository but will remain available under Archived documents.`;

      case "RESTORE":
        return `Are you sure you want to restore "${actionDocument.name}"? The document will become active again.`;

      case "DELETE":
        return `Are you sure you want to delete "${actionDocument.name}"? This will remove the document from the repository. The document record and audit history will be retained.`;

      default:
        return "";
    }
  }

  function getActionButtonLabel() {
    if (actionLoading) {
      return "Processing...";
    }

    switch (actionType) {
      case "ARCHIVE":
        return "Archive";

      case "RESTORE":
        return "Restore";

      case "DELETE":
        return "Delete";

      default:
        return "Confirm";
    }
  }

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl">

        {/* ================================================= */}
        {/* HEADER */}
        {/* ================================================= */}

        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">

          <div>
            <p className="text-sm font-medium text-slate-500">
              Document Management
            </p>

            <h1 className="mt-1 text-3xl font-bold text-slate-900">
              Documents
            </h1>

            <p className="mt-2 text-slate-600">
              Manage your firm's legal
              documents and digital repository.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">

            <button
              type="button"
              onClick={
                refreshDocuments
              }
              disabled={loading}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-3 font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ↻ Refresh
            </button>

            {can("documents.upload") && (
              <Link
                href="/dashboard/documents/new"
                className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-5 py-3 font-medium text-white transition hover:bg-slate-800"
              >
                + Upload Document
              </Link>
            )}

          </div>
        </div>

        {/* ================================================= */}
        {/* SUCCESS MESSAGE */}
        {/* ================================================= */}

        {successMessage && (
          <div className="mb-6 flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">

            <p>
              {successMessage}
            </p>

            <button
              type="button"
              onClick={() =>
                setSuccessMessage("")
              }
              className="font-semibold text-green-700 hover:text-green-900"
            >
              Dismiss
            </button>

          </div>
        )}

        {/* ================================================= */}
        {/* ERROR */}
        {/* ================================================= */}

        {error && (
          <div className="mb-6 flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">

            <p>{error}</p>

            <button
              type="button"
              onClick={
                refreshDocuments
              }
              className="rounded-lg border border-red-300 px-4 py-2 font-medium text-red-700 hover:bg-red-100"
            >
              Try again
            </button>

          </div>
        )}

        {/* ================================================= */}
        {/* LOADING */}
        {/* ================================================= */}

        {loading && (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200">
            <p className="text-slate-600">
              Loading documents...
            </p>
          </div>
        )}

        {!loading && (
          <>
            {/* ================================================= */}
            {/* SUMMARY CARDS */}
            {/* ================================================= */}

            <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between">

                  <p className="text-sm font-medium text-slate-500">
                    Total Documents
                  </p>

                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
                    📁
                  </span>

                </div>

                <p className="mt-3 text-3xl font-bold text-slate-900">
                  {totalDocuments}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  All documents in repository
                </p>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between">

                  <p className="text-sm font-medium text-slate-500">
                    Active
                  </p>

                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100">
                    ✓
                  </span>

                </div>

                <p className="mt-3 text-3xl font-bold text-slate-900">
                  {activeDocuments}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Currently active documents
                </p>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between">

                  <p className="text-sm font-medium text-slate-500">
                    Archived
                  </p>

                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100">
                    📦
                  </span>

                </div>

                <p className="mt-3 text-3xl font-bold text-slate-900">
                  {archivedDocuments}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Archived documents
                </p>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between">

                  <p className="text-sm font-medium text-slate-500">
                    Current Results
                  </p>

                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100">
                    🔎
                  </span>

                </div>

                <p className="mt-3 text-3xl font-bold text-slate-900">
                  {filteredDocuments.length}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Matching current filters
                </p>
              </div>

            </section>

            {/* ================================================= */}
            {/* FILTERS */}
            {/* ================================================= */}

            <section className="mb-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">

              <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">

                <div>

                  <h2 className="font-semibold text-slate-900">
                    Document Repository
                  </h2>

                  <p className="text-sm text-slate-500">
                    {filteredDocuments.length}{" "}
                    of{" "}
                    {documents.length}{" "}
                    documents
                  </p>

                </div>

                <button
                  type="button"
                  onClick={
                    clearFilters
                  }
                  className="text-sm font-medium text-blue-600 hover:text-blue-800"
                >
                  Clear filters
                </button>

              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">

                {/* SEARCH */}

                <div className="lg:col-span-2">

                  <label
                    htmlFor="document-search"
                    className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    Search
                  </label>

                  <input
                    id="document-search"
                    type="search"
                    value={search}
                    onChange={(event) =>
                      setSearch(
                        event.target.value
                      )
                    }
                    placeholder="Search by name, reference, matter or tag..."
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  />

                </div>

                {/* MATTER */}

                <div>

                  <label
                    htmlFor="matter-filter"
                    className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    Matter
                  </label>

                  <select
                    id="matter-filter"
                    value={matterFilter}
                    onChange={(event) =>
                      setMatterFilter(
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">
                      All Matters
                    </option>

                    {matters.map(
                      (matter) => (
                        <option
                          key={matter.id}
                          value={
                            matter.id
                          }
                        >
                          {
                            matter.referenceNumber
                          }{" "}
                          —{" "}
                          {matter.title}
                        </option>
                      )
                    )}
                  </select>

                </div>

                {/* CATEGORY */}

                <div>

                  <label
                    htmlFor="category-filter"
                    className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    Category
                  </label>

                  <select
                    id="category-filter"
                    value={
                      categoryFilter
                    }
                    onChange={(event) =>
                      setCategoryFilter(
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">
                      All Categories
                    </option>

                    {categories.map(
                      (category) => (
                        <option
                          key={category}
                          value={
                            category
                          }
                        >
                          {category}
                        </option>
                      )
                    )}
                  </select>

                </div>

                {/* FOLDER */}

                <div>

                  <label
                    htmlFor="folder-filter"
                    className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    Folder
                  </label>

                  <select
                    id="folder-filter"
                    value={
                      folderFilter
                    }
                    onChange={(event) =>
                      setFolderFilter(
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">
                      All Folders
                    </option>

                    {folders.map(
                      (folder) => (
                        <option
                          key={folder.id}
                          value={
                            folder.id
                          }
                        >
                          {folder.name}
                        </option>
                      )
                    )}
                  </select>

                </div>

              </div>

              {/* STATUS */}

              <div className="mt-4 flex flex-wrap gap-2">

                {[
                  "ACTIVE",
                  "ARCHIVED",
                  "",
                ].map((status) => (
                  <button
                    key={
                      status || "ALL"
                    }
                    type="button"
                    onClick={() =>
                      setStatusFilter(
                        status
                      )
                    }
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                      statusFilter ===
                      status
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {status ===
                    "ACTIVE"
                      ? "Active"
                      : status ===
                        "ARCHIVED"
                      ? "Archived"
                      : "All Statuses"}
                  </button>
                ))}

              </div>

              {/* SORTING */}

              <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">

                  <label
                    htmlFor="sort-documents"
                    className="text-sm font-medium text-slate-700"
                  >
                    Sort by
                  </label>

                  <select
                    id="sort-documents"
                    value={sortBy}
                    onChange={(event) =>
                      setSortBy(
                        event.target
                          .value as SortOption
                      )
                    }
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="newest">
                      Newest first
                    </option>

                    <option value="oldest">
                      Oldest first
                    </option>

                    <option value="name-asc">
                      Name A–Z
                    </option>

                    <option value="name-desc">
                      Name Z–A
                    </option>

                    <option value="version">
                      Highest version
                    </option>

                    <option value="size">
                      Largest file
                    </option>
                  </select>

                </div>

                <div className="flex items-center gap-2">

                  <label
                    htmlFor="page-size"
                    className="text-sm font-medium text-slate-700"
                  >
                    Show
                  </label>

                  <select
                    id="page-size"
                    value={pageSize}
                    onChange={(event) =>
                      setPageSize(
                        Number(
                          event.target
                            .value
                        )
                      )
                    }
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value={10}>
                      10
                    </option>

                    <option value={25}>
                      25
                    </option>

                    <option value={50}>
                      50
                    </option>
                  </select>

                  <span className="text-sm text-slate-500">
                    per page
                  </span>

                </div>

              </div>

            </section>

            {/* ================================================= */}
            {/* NO DOCUMENTS */}
            {/* ================================================= */}

            {documents.length === 0 ? (

              <div className="rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-slate-200">

                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-2xl">
                  📄
                </div>

                <h2 className="text-xl font-semibold text-slate-900">
                  No documents yet
                </h2>

                <p className="mx-auto mt-2 max-w-md text-slate-600">
                  Upload your first legal
                  document to start
                  building your firm's
                  digital repository.
                </p>

                {can("documents.upload") && (
                  <Link
                    href="/dashboard/documents/new"
                    className="mt-6 inline-flex rounded-lg bg-slate-900 px-5 py-3 font-medium text-white hover:bg-slate-800"
                  >
                    Upload your first
                    document
                  </Link>
                )}

              </div>

            ) : filteredDocuments.length === 0 ? (

              <div className="rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-slate-200">

                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-xl">
                  🔎
                </div>

                <h2 className="text-xl font-semibold text-slate-900">
                  No matching documents
                </h2>

                <p className="mt-2 text-slate-600">
                  Try changing your
                  search or filters.
                </p>

                <button
                  type="button"
                  onClick={
                    clearFilters
                  }
                  className="mt-5 rounded-lg border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Clear filters
                </button>

              </div>

            ) : (

              <>

                {/* ================================================= */}
                {/* DOCUMENT TABLE */}
                {/* ================================================= */}

                <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">

                  <div className="overflow-x-auto">

                    <table className="w-full min-w-[1250px] text-left">

                      <thead className="border-b border-slate-200 bg-slate-50">

                        <tr>

                          <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Document
                          </th>

                          <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Matter
                          </th>

                          <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Folder
                          </th>

                          <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Version
                          </th>

                          <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Size
                          </th>

                          <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Status
                          </th>

                          <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Actions
                          </th>

                        </tr>

                      </thead>

                      <tbody className="divide-y divide-slate-100">

                        {paginatedDocuments.map(
                          (document) => {

                            const tags =
                              document.tags ?? [];

                            return (
                              <tr
                                key={
                                  document.id
                                }
                                className="transition hover:bg-slate-50"
                              >

                                {/* DOCUMENT */}

                                <td className="px-6 py-5">

                                  <Link
                                    href={`/dashboard/documents/${document.id}`}
                                    className="group"
                                  >

                                    <div className="flex items-start gap-3">

                                      <span className="mt-0.5 text-xl">
                                        {getFileIcon(
                                          document.extension
                                        )}
                                      </span>

                                      <div className="min-w-0">

                                        <p className="font-semibold text-slate-900 group-hover:text-blue-600">
                                          {
                                            document.name
                                          }
                                        </p>

                                        {/* REFERENCE + FILE TYPE */}

                                        <div className="mt-1 flex flex-wrap items-center gap-2">

                                          <p className="text-xs text-slate-500">
                                            {
                                              document.referenceNumber
                                            }
                                          </p>

                                          <span className="inline-flex rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                                            {
                                              formatFileType(
                                                document.extension
                                              )
                                            }
                                          </span>

                                        </div>

                                        {/* ORIGINAL FILE NAME */}

                                        {document.originalName &&
                                          document.originalName !==
                                            document.name && (
                                            <p
                                              className="mt-1 max-w-xs truncate text-xs text-slate-400"
                                              title={
                                                document.originalName
                                              }
                                            >
                                              {
                                                document.originalName
                                              }
                                            </p>
                                          )}

                                        {/* CATEGORY */}

                                        {document.category && (
                                          <span className="mt-2 inline-block rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                                            {
                                              document.category
                                            }
                                          </span>
                                        )}

                                        {/* TAGS */}

                                        {tags.length >
                                          0 && (
                                          <div className="mt-2 flex flex-wrap gap-1">

                                            {tags
                                              .slice(
                                                0,
                                                3
                                              )
                                              .map(
                                                (
                                                  tag
                                                ) => (
                                                  <span
                                                    key={
                                                      tag
                                                    }
                                                    className="rounded bg-blue-50 px-2 py-1 text-[11px] text-blue-700"
                                                  >
                                                    {
                                                      tag
                                                    }
                                                  </span>
                                                )
                                              )}

                                            {tags.length >
                                              3 && (
                                              <span className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-500">
                                                +
                                                {tags.length -
                                                  3}{" "}
                                                more
                                              </span>
                                            )}

                                          </div>
                                        )}

                                      </div>

                                    </div>

                                  </Link>

                                </td>

                                {/* MATTER */}

                                <td className="px-6 py-5">

                                  {document.matter ? (
                                    <>
                                      <Link
                                        href={`/dashboard/matters/${document.matter.id}`}
                                        className="font-medium text-slate-900 hover:text-blue-600"
                                      >
                                        {
                                          document
                                            .matter
                                            .title
                                        }
                                      </Link>

                                      <p className="mt-1 text-xs text-slate-500">
                                        {
                                          document
                                            .matter
                                            .referenceNumber
                                        }
                                      </p>
                                    </>
                                  ) : (
                                    <span className="text-sm text-slate-400">
                                      No matter
                                    </span>
                                  )}

                                </td>

                                {/* FOLDER */}

                                <td className="px-6 py-5">

                                  {document.folder ? (
                                    <p className="text-sm text-slate-700">
                                      📁{" "}
                                      {
                                        document
                                          .folder
                                          .name
                                      }
                                    </p>
                                  ) : (
                                    <span className="text-sm text-slate-400">
                                      No folder
                                    </span>
                                  )}

                                </td>

                                {/* VERSION */}

                                <td className="px-6 py-5">

                                  <span className="inline-flex rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700">
                                    v
                                    {
                                      document.currentVersion
                                    }
                                  </span>

                                </td>

                                {/* SIZE */}

                                <td className="px-6 py-5 text-sm text-slate-700">

                                  <p>
                                    {formatFileSize(
                                      document.size
                                    )}
                                  </p>

                                  <p className="mt-1 text-xs text-slate-400">
                                    {formatDate(
                                      document.createdAt
                                    )}
                                  </p>

                                </td>

                                {/* STATUS */}

                                <td className="px-6 py-5">

                                  <span
                                    className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(
                                      document.status
                                    )}`}
                                  >
                                    {getStatusLabel(
                                      document.status
                                    )}
                                  </span>

                                </td>

                                {/* ACTIONS */}

                                <td className="px-6 py-5">

                                  <div className="flex flex-wrap items-center justify-end gap-2">

                                    {can(
                                      "documents.preview"
                                    ) && (
                                      <a
                                        href={`/api/documents/${document.id}/preview`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                                      >
                                        Preview
                                      </a>
                                    )}

                                    {can(
                                      "documents.download"
                                    ) && (
                                      <a
                                        href={`/api/documents/${document.id}/download`}
                                        className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-slate-800"
                                      >
                                        Download
                                      </a>
                                    )}

                                    {can(
                                      "documents.details"
                                    ) && (
                                      <Link
                                        href={`/dashboard/documents/${document.id}`}
                                        className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
                                      >
                                        Details
                                      </Link>
                                    )}

                                    {can(
                                      "documents.archive"
                                    ) &&
                                      document.status ===
                                        "ACTIVE" && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            openActionDialog(
                                              document,
                                              "ARCHIVE"
                                            )
                                          }
                                          className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 transition hover:bg-amber-100"
                                        >
                                          Archive
                                        </button>
                                      )}

                                    {can(
                                      "documents.restore"
                                    ) &&
                                      document.status ===
                                        "ARCHIVED" && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            openActionDialog(
                                              document,
                                              "RESTORE"
                                            )
                                          }
                                          className="rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-xs font-medium text-green-700 transition hover:bg-green-100"
                                        >
                                          Restore
                                        </button>
                                      )}

                                    {can(
                                      "documents.delete"
                                    ) && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openActionDialog(
                                            document,
                                            "DELETE"
                                          )
                                        }
                                        className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-100"
                                      >
                                        Delete
                                      </button>
                                    )}

                                  </div>

                                </td>

                              </tr>
                            );
                          }
                        )}

                      </tbody>

                    </table>

                  </div>

                </div>

                {/* ================================================= */}
                {/* PAGINATION */}
                {/* ================================================= */}

                <div className="mt-5 flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:flex-row sm:items-center sm:justify-between">

                  <div className="text-sm text-slate-600">

                    Showing{" "}
                    <span className="font-semibold text-slate-900">
                      {sortedDocuments.length ===
                      0
                        ? 0
                        : startIndex + 1}
                    </span>{" "}
                    to{" "}
                    <span className="font-semibold text-slate-900">
                      {endIndex}
                    </span>{" "}
                    of{" "}
                    <span className="font-semibold text-slate-900">
                      {
                        sortedDocuments.length
                      }
                    </span>{" "}
                    documents

                  </div>

                  <div className="flex items-center gap-2">

                    <button
                      type="button"
                      disabled={
                        safeCurrentPage ===
                        1
                      }
                      onClick={() =>
                        setCurrentPage(
                          (page) =>
                            Math.max(
                              1,
                              page - 1
                            )
                        )
                      }
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Previous
                    </button>

                    <span className="px-3 text-sm text-slate-600">
                      Page{" "}
                      <span className="font-semibold text-slate-900">
                        {
                          safeCurrentPage
                        }
                      </span>{" "}
                      of{" "}
                      <span className="font-semibold text-slate-900">
                        {totalPages}
                      </span>
                    </span>

                    <button
                      type="button"
                      disabled={
                        safeCurrentPage >=
                        totalPages
                      }
                      onClick={() =>
                        setCurrentPage(
                          (page) =>
                            Math.min(
                              totalPages,
                              page + 1
                            )
                        )
                      }
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Next
                    </button>

                  </div>

                </div>

              </>
            )}

          </>
        )}

      </div>

      {/* ===================================================== */}
      {/* CONFIRMATION DIALOG */}
      {/* ===================================================== */}

      {actionDocument &&
        actionType && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="document-action-title"
          >

            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">

              <div className="mb-5 flex items-start gap-4">

                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xl ${
                    actionType ===
                    "DELETE"
                      ? "bg-red-100"
                      : actionType ===
                        "ARCHIVE"
                      ? "bg-amber-100"
                      : "bg-green-100"
                  }`}
                >
                  {actionType ===
                  "DELETE"
                    ? "🗑️"
                    : actionType ===
                      "ARCHIVE"
                    ? "📦"
                    : "↩️"}
                </div>

                <div>

                  <h2
                    id="document-action-title"
                    className="text-xl font-semibold text-slate-900"
                  >
                    {getActionTitle()}
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {
                      getActionDescription()
                    }
                  </p>

                </div>

              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">

                <button
                  type="button"
                  onClick={
                    closeActionDialog
                  }
                  disabled={
                    actionLoading
                  }
                  className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={
                    performDocumentAction
                  }
                  disabled={
                    actionLoading
                  }
                  className={`rounded-lg px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    actionType ===
                    "DELETE"
                      ? "bg-red-600 hover:bg-red-700"
                      : actionType ===
                        "ARCHIVE"
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "bg-green-600 hover:bg-green-700"
                  }`}
                >
                  {
                    getActionButtonLabel()
                  }
                </button>

              </div>

            </div>

          </div>
        )}
    </main>
  );
}