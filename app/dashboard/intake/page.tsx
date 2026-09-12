"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type IntakePriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

type IntakeStatus =
  | "NEW"
  | "CONFLICT_CHECK_PENDING"
  | "CONFLICT_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "CONVERTED"
  | "CLOSED";

type ConflictStatus =
  | "NOT_CHECKED"
  | "CLEAR"
  | "POTENTIAL_CONFLICT"
  | "CONFLICT_DETECTED"
  | "REQUIRES_REVIEW";

type Intake = {
  id: string;
  prospectiveClientName: string;
  email: string | null;
  phone: string | null;
  practiceArea: string | null;
  priority: IntakePriority;
  status: IntakeStatus;
  conflictStatus: ConflictStatus;
  conflictCheckRequired: boolean;
  createdAt: string;
  updatedAt: string;
  assignedTo: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  client: {
    id: string;
    referenceNumber: string;
    name: string;
    type: string;
  } | null;
  conflictChecks: {
    id: string;
    status: ConflictStatus;
    matchedMatterIds: string[];
    matchedClientIds: string[];
    notes: string | null;
    reviewedAt: string | null;
    createdAt: string;
  }[];
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type ApiResponse = {
  success?: boolean;
  data?: Intake[];
  pagination?: Pagination;
  error?: string;
};

const statusLabels: Record<IntakeStatus, string> = {
  NEW: "New",
  CONFLICT_CHECK_PENDING: "Conflict Check Pending",
  CONFLICT_REVIEW: "Conflict Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CONVERTED: "Converted",
  CLOSED: "Closed",
};

const conflictLabels: Record<ConflictStatus, string> = {
  NOT_CHECKED: "Not Checked",
  CLEAR: "Clear",
  POTENTIAL_CONFLICT: "Potential Conflict",
  CONFLICT_DETECTED: "Conflict Detected",
  REQUIRES_REVIEW: "Requires Review",
};

function getPriorityClass(priority: IntakePriority) {
  switch (priority) {
    case "URGENT":
      return "bg-red-100 text-red-700 border-red-200";
    case "HIGH":
      return "bg-orange-100 text-orange-700 border-orange-200";
    case "MEDIUM":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "LOW":
      return "bg-gray-100 text-gray-600 border-gray-200";
  }
}

function getStatusClass(status: IntakeStatus) {
  switch (status) {
    case "APPROVED":
      return "bg-emerald-100 text-emerald-700";
    case "REJECTED":
      return "bg-red-100 text-red-700";
    case "CONVERTED":
      return "bg-purple-100 text-purple-700";
    case "CONFLICT_REVIEW":
      return "bg-amber-100 text-amber-700";
    case "CONFLICT_CHECK_PENDING":
      return "bg-yellow-100 text-yellow-700";
    case "CLOSED":
      return "bg-gray-100 text-gray-600";
    default:
      return "bg-blue-100 text-blue-700";
  }
}

function getConflictClass(status: ConflictStatus) {
  switch (status) {
    case "CLEAR":
      return "bg-emerald-100 text-emerald-700";
    case "CONFLICT_DETECTED":
      return "bg-red-100 text-red-700";
    case "POTENTIAL_CONFLICT":
      return "bg-orange-100 text-orange-700";
    case "REQUIRES_REVIEW":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en-ZA", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function IntakePage() {
  const [intakes, setIntakes] = useState<Intake[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchIntakes = useCallback(
    async (page = 1, showRefresh = false) => {
      try {
        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const params = new URLSearchParams();

        if (search.trim()) {
          params.set("search", search.trim());
        }

        if (status) {
          params.set("status", status);
        }

        if (priority) {
          params.set("priority", priority);
        }

        params.set("page", String(page));
        params.set("pageSize", "20");

        const response = await fetch(`/api/intake?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
        });

        const result: ApiResponse = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Failed to load legal intakes.");
        }

        setIntakes(result.data || []);

        setPagination(
          result.pagination || {
            page: 1,
            pageSize: 20,
            total: 0,
            totalPages: 0,
          },
        );
      } catch (err) {
        console.error("Failed to fetch intakes:", err);

        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong while loading intakes.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [search, status, priority],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchIntakes(1);
    }, 300);

    return () => clearTimeout(timer);
  }, [fetchIntakes]);

  const handleClearFilters = () => {
    setSearch("");
    setStatus("");
    setPriority("");
  };

  const handlePreviousPage = () => {
    if (pagination.page > 1) {
      fetchIntakes(pagination.page - 1);
    }
  };

  const handleNextPage = () => {
    if (pagination.page < pagination.totalPages) {
      fetchIntakes(pagination.page + 1);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm text-gray-500">
                <Link
                  href="/dashboard"
                  className="transition hover:text-gray-900"
                >
                  Dashboard
                </Link>
                <span>/</span>
                <span className="text-gray-900">Legal Intake</span>
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                Legal Intake Centre
              </h1>

              <p className="mt-1 text-sm text-gray-500">
                Manage new legal enquiries, prospective clients and conflict
                checks.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fetchIntakes(pagination.page, true)}
                disabled={refreshing}
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <svg
                  className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h5M20 20v-5h-5M5.05 19A9 9 0 1019 5.05"
                  />
                </svg>
                Refresh
              </button>

              <Link
                href="/dashboard/intake/new"
                className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800"
              >
                <svg
                  className="mr-2 h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                New Legal Intake
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Summary cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  Total Intakes
                </p>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {loading ? "—" : pagination.total}
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a3 3 0 006 0M9 5h6"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  Conflict Checks
                </p>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {loading
                    ? "—"
                    : intakes.filter(
                        (item) =>
                          item.conflictStatus !== "NOT_CHECKED" ||
                          item.conflictCheckRequired,
                      ).length}
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 12c0 5.591 3.824 10.29 9 11.622C17.176 22.29 21 17.591 21 12c0-1.244-.189-2.444-.54-3.572z"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  Needs Review
                </p>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {loading
                    ? "—"
                    : intakes.filter(
                        (item) =>
                          item.conflictStatus === "POTENTIAL_CONFLICT" ||
                          item.conflictStatus === "REQUIRES_REVIEW" ||
                          item.conflictStatus === "CONFLICT_DETECTED" ||
                          item.status === "CONFLICT_REVIEW",
                      ).length}
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01M5.07 19h13.86a2 2 0 001.732-3L13.732 4a2 2 0 00-3.464 0L3.338 16a2 2 0 001.732 3z"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  High Priority
                </p>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {loading
                    ? "—"
                    : intakes.filter(
                        (item) =>
                          item.priority === "HIGH" ||
                          item.priority === "URGENT",
                      ).length}
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-red-50 text-red-600">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Search and filters */}
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <label
                htmlFor="search"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Search
              </label>

              <div className="relative">
                <svg
                  className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-4.35-4.35m1.35-5.65a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>

                <input
                  id="search"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search client name, email, phone..."
                  className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="status"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Intake Status
              </label>

              <select
                id="status"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
              >
                <option value="">All statuses</option>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="priority"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Priority
              </label>

              <select
                id="priority"
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
              >
                <option value="">All priorities</option>
                <option value="URGENT">Urgent</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
          </div>

          {(search || status || priority) && (
            <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
              <p className="text-sm text-gray-500">
                Filters are currently active.
              </p>

              <button
                type="button"
                onClick={handleClearFilters}
                className="text-sm font-medium text-gray-700 transition hover:text-gray-900"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <svg
                className="mt-0.5 h-5 w-5 shrink-0 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>

              <div>
                <p className="text-sm font-semibold text-red-800">
                  Unable to load legal intakes
                </p>
                <p className="mt-1 text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Intake table */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">
                  Legal Enquiries
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Prospective clients awaiting intake processing.
                </p>
              </div>

              {!loading && (
                <span className="text-sm text-gray-500">
                  {pagination.total}{" "}
                  {pagination.total === 1 ? "record" : "records"}
                </span>
              )}
            </div>
          </div>

          {loading ? (
            <div className="p-8">
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((item) => (
                  <div
                    key={item}
                    className="h-16 animate-pulse rounded-lg bg-gray-100"
                  />
                ))}
              </div>
            </div>
          ) : intakes.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                <svg
                  className="h-7 w-7 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a3 3 0 006 0"
                  />
                </svg>
              </div>

              <h3 className="mt-4 text-lg font-semibold text-gray-900">
                No legal intakes found
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
                {search || status || priority
                  ? "No enquiries match the current search and filters."
                  : "Start by recording a new legal enquiry or prospective client."}
              </p>

              {search || status || priority ? (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="mt-5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  Clear filters
                </button>
              ) : (
                <Link
                  href="/dashboard/intake/new"
                  className="mt-5 inline-flex rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800"
                >
                  Create first intake
                </Link>
              )}
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto lg:block">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Prospective Client
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Practice Area
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Status
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Conflict Check
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Priority
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Assigned To
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Received
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100 bg-white">
                    {intakes.map((intake) => (
                      <tr
                        key={intake.id}
                        className="transition hover:bg-gray-50"
                      >
                        <td className="whitespace-nowrap px-5 py-4">
                          <div>
                            <p className="font-semibold text-gray-900">
                              {intake.prospectiveClientName}
                            </p>

                            <p className="mt-0.5 text-xs text-gray-500">
                              {intake.email ||
                                intake.phone ||
                                "No contact information"}
                            </p>

                            {intake.client && (
                              <p className="mt-1 text-xs text-gray-400">
                                Existing client:{" "}
                                {intake.client.referenceNumber}
                              </p>
                            )}
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">
                          {intake.practiceArea || "—"}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClass(
                              intake.status,
                            )}`}
                          >
                            {statusLabels[intake.status]}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getConflictClass(
                              intake.conflictStatus,
                            )}`}
                          >
                            {conflictLabels[intake.conflictStatus]}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-5 py-4">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getPriorityClass(
                              intake.priority,
                            )}`}
                          >
                            {intake.priority}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">
                          {intake.assignedTo?.name || "Unassigned"}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-500">
                          {formatDate(intake.createdAt)}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-right">
                          <Link
                            href={`/dashboard/intake/${intake.id}`}
                            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-400 hover:bg-gray-50"
                          >
                            View
                            <svg
                              className="ml-1.5 h-4 w-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile/tablet cards */}
              <div className="divide-y divide-gray-200 lg:hidden">
                {intakes.map((intake) => (
                  <div key={intake.id} className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {intake.prospectiveClientName}
                        </h3>

                        <p className="mt-1 text-sm text-gray-500">
                          {intake.practiceArea || "Practice area not specified"}
                        </p>
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${getPriorityClass(
                          intake.priority,
                        )}`}
                      >
                        {intake.priority}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-gray-400">Status</p>
                        <span
                          className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClass(
                            intake.status,
                          )}`}
                        >
                          {statusLabels[intake.status]}
                        </span>
                      </div>

                      <div>
                        <p className="text-xs text-gray-400">
                          Conflict Check
                        </p>
                        <span
                          className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getConflictClass(
                            intake.conflictStatus,
                          )}`}
                        >
                          {conflictLabels[intake.conflictStatus]}
                        </span>
                      </div>

                      <div>
                        <p className="text-xs text-gray-400">Assigned To</p>
                        <p className="mt-1 text-sm font-medium text-gray-700">
                          {intake.assignedTo?.name || "Unassigned"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-gray-400">Received</p>
                        <p className="mt-1 text-sm font-medium text-gray-700">
                          {formatDate(intake.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex justify-end">
                      <Link
                        href={`/dashboard/intake/${intake.id}`}
                        className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                      >
                        View Intake
                        <svg
                          className="ml-1.5 h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Pagination */}
          {!loading && pagination.totalPages > 0 && (
            <div className="flex flex-col gap-3 border-t border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-gray-500">
                Page {pagination.page} of {pagination.totalPages}
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePreviousPage}
                  disabled={pagination.page <= 1}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>

                <button
                  type="button"
                  onClick={handleNextPage}
                  disabled={pagination.page >= pagination.totalPages}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Information panel */}
        <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-5">
          <div className="flex items-start gap-3">
            <svg
              className="mt-0.5 h-5 w-5 shrink-0 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M12 22a10 10 0 100-20 10 10 0 000 20z"
              />
            </svg>

            <div>
              <h3 className="text-sm font-semibold text-blue-900">
                Conflict checking is an assisted review process
              </h3>

              <p className="mt-1 text-sm leading-6 text-blue-800">
                LegalVault identifies potential matches across the firm&apos;s
                clients and matters. A potential match should be reviewed by
                an authorised person before the prospective client is
                accepted.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}