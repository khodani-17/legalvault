"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type User = {
  id: string;
  name: string | null;
  email: string;
  role: string;
};

type Client = {
  id: string;
  referenceNumber: string;
  name: string;
  type: string;
};

type ConflictMatchClient = {
  id: string;
  referenceNumber: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  type?: string;
};

type ConflictMatchMatter = {
  id: string;
  referenceNumber: string;
  title: string;
  status?: string;
  practiceArea?: string | null;
  client?: {
    id: string;
    name: string;
    referenceNumber?: string;
  } | null;
};

type ConflictCheck = {
  id: string;
  status: string;
  searchTerms: string[];
  matchedMatterIds: string[];
  matchedClientIds: string[];
  notes: string | null;
  reviewedAt: string | null;
  createdAt: string;
  checkedBy?: User | null;
  reviewedBy?: User | null;
};

type Intake = {
  id: string;
  firmId: string;
  prospectiveClientName: string;
  clientId: string | null;
  email: string | null;
  phone: string | null;
  practiceArea: string | null;
  description: string | null;
  opposingParties: string[];
  relatedParties: string[];
  source: string | null;
  priority: string;
  conflictCheckRequired: boolean;
  conflictStatus: string;
  status: string;
  assignedToId: string | null;
  createdById: string;
  conflictCheckedAt: string | null;
  conflictCheckedById: string | null;
  createdAt: string;
  updatedAt: string;
  client: Client | null;
  assignedTo: User | null;
  createdBy: User | null;
  conflictCheckedBy: User | null;
  conflictChecks: ConflictCheck[];
};

type ConflictCheckResult = {
  status?: string;
  conflictStatus?: string;
  searchTerms?: string[];
  matchedClientIds?: string[];
  matchedMatterIds?: string[];
  matchedClients?: ConflictMatchClient[];
  matchedMatters?: ConflictMatchMatter[];
  clients?: ConflictMatchClient[];
  matters?: ConflictMatchMatter[];
  notes?: string | null;
  disclaimer?: string;
  message?: string;
};

type ConversionResult = {
  intake?: {
    id: string;
    status: string;
  };
  client?: {
    id: string;
    referenceNumber: string;
    name: string;
  };
  matter?: {
    id: string;
    referenceNumber: string;
    title: string;
  };
};

const statusLabels: Record<string, string> = {
  NEW: "New",
  CONFLICT_CHECK_PENDING: "Conflict Check Pending",
  CONFLICT_REVIEW: "Conflict Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CONVERTED: "Converted",
  CLOSED: "Closed",
};

const conflictLabels: Record<string, string> = {
  NOT_CHECKED: "Not Checked",
  CLEAR: "Clear",
  POTENTIAL_CONFLICT: "Potential Conflict",
  CONFLICT_DETECTED: "Conflict Detected",
  REQUIRES_REVIEW: "Requires Review",
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getStatusClass(status: string) {
  switch (status) {
    case "APPROVED":
    case "CLEAR":
      return "bg-emerald-100 text-emerald-800";

    case "REJECTED":
    case "CONFLICT_DETECTED":
      return "bg-red-100 text-red-800";

    case "CONFLICT_REVIEW":
    case "POTENTIAL_CONFLICT":
    case "REQUIRES_REVIEW":
      return "bg-amber-100 text-amber-800";

    case "CONVERTED":
      return "bg-blue-100 text-blue-800";

    default:
      return "bg-slate-100 text-slate-700";
  }
}

function getPriorityClass(priority: string) {
  switch (priority) {
    case "URGENT":
      return "bg-red-100 text-red-800";

    case "HIGH":
      return "bg-orange-100 text-orange-800";

    case "MEDIUM":
      return "bg-yellow-100 text-yellow-800";

    default:
      return "bg-slate-100 text-slate-700";
  }
}

function getConflictResultClass(status: string) {
  switch (status) {
    case "CLEAR":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";

    case "POTENTIAL_CONFLICT":
    case "REQUIRES_REVIEW":
      return "border-amber-200 bg-amber-50 text-amber-900";

    case "CONFLICT_DETECTED":
      return "border-red-200 bg-red-50 text-red-900";

    default:
      return "border-slate-200 bg-slate-50 text-slate-900";
  }
}

export default function LegalIntakeDetailPage() {
  const params = useParams();

  const intakeId =
    typeof params.id === "string"
      ? params.id
      : Array.isArray(params.id)
        ? params.id[0]
        : "";

  const [intake, setIntake] = useState<Intake | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [runningConflictCheck, setRunningConflictCheck] =
    useState(false);

  const [conflictError, setConflictError] = useState("");

  const [conflictResult, setConflictResult] =
    useState<ConflictCheckResult | null>(null);

  const [converting, setConverting] = useState(false);

  const [conversionError, setConversionError] = useState("");

  const [conversionSuccess, setConversionSuccess] =
    useState<ConversionResult | null>(null);

  async function loadIntake() {
    if (!intakeId) {
      setError("No intake ID was provided.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `/api/intake?page=1&pageSize=100`,
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            data.message ||
            "Unable to retrieve the legal intake."
        );
      }

      const records: Intake[] = data.data ?? [];

      const found = records.find(
        (record) => record.id === intakeId
      );

      if (!found) {
        throw new Error(
          "This legal intake could not be found."
        );
      }

      setIntake(found);
    } catch (err) {
      console.error("Load intake error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load the legal intake."
      );
    } finally {
      setLoading(false);
    }
  }

  async function runConflictCheck() {
    if (!intakeId || runningConflictCheck) {
      return;
    }

    try {
      setRunningConflictCheck(true);
      setConflictError("");
      setConflictResult(null);
      setConversionError("");
      setConversionSuccess(null);

      const response = await fetch(
        `/api/intake/${intakeId}/conflict-check`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            data.message ||
            "The conflict check could not be completed."
        );
      }

      const result: ConflictCheckResult =
        data.data ?? data;

      setConflictResult(result);

      await loadIntake();
    } catch (err) {
      console.error("Conflict check error:", err);

      setConflictError(
        err instanceof Error
          ? err.message
          : "The conflict check could not be completed."
      );
    } finally {
      setRunningConflictCheck(false);
    }
  }

  async function convertToMatter() {
    if (!intakeId || converting || !intake) {
      return;
    }

    if (intake.status !== "APPROVED") {
      setConversionError(
        "Only an approved intake can be converted into a matter."
      );
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to convert this approved legal intake into a matter?\n\nA client will be linked or created and a new matter will be opened."
    );

    if (!confirmed) {
      return;
    }

    try {
      setConverting(true);
      setConversionError("");
      setConversionSuccess(null);

      const response = await fetch(
        `/api/intake/${intakeId}/convert`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            data.message ||
            "The legal intake could not be converted."
        );
      }

      const result: ConversionResult =
        data.data ?? {};

      setConversionSuccess(result);

      await loadIntake();
    } catch (err) {
      console.error("Matter conversion error:", err);

      setConversionError(
        err instanceof Error
          ? err.message
          : "The legal intake could not be converted."
      );
    } finally {
      setConverting(false);
    }
  }

  useEffect(() => {
    loadIntake();
  }, [intakeId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <svg
                className="h-5 w-5 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />

                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>

              Loading legal intake...
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (error || !intake) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-700">
              !
            </div>

            <h1 className="text-xl font-bold text-slate-950">
              Unable to load legal intake
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              {error ||
                "The requested intake could not be found."}
            </p>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={loadIntake}
                className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Try Again
              </button>

              <Link
                href="/dashboard/intake"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Back to Intake
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const latestConflictCheck =
    intake.conflictChecks?.[0] ?? null;

  const resultStatus =
    conflictResult?.status ||
    conflictResult?.conflictStatus ||
    latestConflictCheck?.status ||
    intake.conflictStatus;

  const matchedClients =
    conflictResult?.matchedClients ??
    conflictResult?.clients ??
    [];

  const matchedMatters =
    conflictResult?.matchedMatters ??
    conflictResult?.matters ??
    [];

  const canEdit =
    intake.status !== "CONVERTED" &&
    intake.status !== "CLOSED";

  const canReview =
    intake.conflictCheckRequired &&
    latestConflictCheck !== null;

  const canConvert = intake.status === "APPROVED";

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <Link
            href="/dashboard"
            className="hover:text-slate-900"
          >
            Dashboard
          </Link>

          <span>/</span>

          <Link
            href="/dashboard/intake"
            className="hover:text-slate-900"
          >
            Legal Intake
          </Link>

          <span>/</span>

          <span className="font-medium text-slate-900">
            {intake.prospectiveClientName}
          </span>
        </div>

        {/* Header */}
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${getStatusClass(
                  intake.status
                )}`}
              >
                {statusLabels[intake.status] ||
                  intake.status}
              </span>

              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${getPriorityClass(
                  intake.priority
                )}`}
              >
                {intake.priority}
              </span>
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-slate-950">
              {intake.prospectiveClientName}
            </h1>

            <p className="mt-2 text-sm text-slate-600">
              Legal Intake Reference:{" "}
              <span className="font-mono text-slate-800">
                {intake.id}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard/intake"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Back to Intake
            </Link>

            <button
              type="button"
              onClick={loadIntake}
              disabled={loading}
              className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Conversion Success */}
        {conversionSuccess && (
          <section className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-200 text-emerald-800">
                ✓
              </div>

              <div>
                <h2 className="font-bold text-emerald-900">
                  Matter created successfully
                </h2>

                <p className="mt-1 text-sm leading-6 text-emerald-800">
                  This legal intake has been successfully converted
                  into a matter.
                </p>

                {conversionSuccess.client && (
                  <p className="mt-3 text-sm text-emerald-800">
                    <span className="font-semibold">
                      Client:
                    </span>{" "}
                    {conversionSuccess.client.name} (
                    {conversionSuccess.client.referenceNumber})
                  </p>
                )}

                {conversionSuccess.matter && (
                  <p className="mt-1 text-sm text-emerald-800">
                    <span className="font-semibold">
                      Matter:
                    </span>{" "}
                    {conversionSuccess.matter.title} (
                    {conversionSuccess.matter.referenceNumber})
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Conversion Error */}
        {conversionError && (
          <section className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
            <p className="text-sm font-bold text-red-900">
              Matter conversion failed
            </p>

            <p className="mt-1 text-sm leading-6 text-red-800">
              {conversionError}
            </p>
          </section>
        )}

        {/* Workflow */}
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-slate-950">
              Intake Workflow
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Current position of this enquiry in the LegalVault
              intake process.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              {
                label: "Intake",
                active: true,
              },
              {
                label: "Conflict Check",
                active:
                  intake.conflictStatus !== "NOT_CHECKED",
              },
              {
                label: "Review",
                active:
                  intake.status === "CONFLICT_REVIEW" ||
                  intake.status === "APPROVED" ||
                  intake.status === "REJECTED" ||
                  intake.status === "CONVERTED",
              },
              {
                label: "Approval",
                active:
                  intake.status === "APPROVED" ||
                  intake.status === "CONVERTED",
              },
              {
                label: "Matter",
                active: intake.status === "CONVERTED",
              },
            ].map((step) => (
              <div
                key={step.label}
                className={`rounded-xl border p-4 ${
                  step.active
                    ? "border-slate-900 bg-slate-950 text-white"
                    : "border-slate-200 bg-slate-50 text-slate-500"
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-wider opacity-70">
                  Stage
                </p>

                <p className="mt-1 text-sm font-bold">
                  {step.label}
                </p>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main */}
          <div className="space-y-6 lg:col-span-2">
            {/* Client */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-6 py-5">
                <h2 className="text-lg font-bold text-slate-950">
                  Client Information
                </h2>
              </div>

              <div className="grid gap-5 p-6 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Prospective Client
                  </p>

                  <p className="mt-1 font-semibold text-slate-900">
                    {intake.prospectiveClientName}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Existing Client
                  </p>

                  <p className="mt-1 font-semibold text-slate-900">
                    {intake.client?.name || "Not linked"}
                  </p>

                  {intake.client?.referenceNumber && (
                    <p className="mt-1 text-xs text-slate-500">
                      {intake.client.referenceNumber}
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Email
                  </p>

                  <p className="mt-1 text-sm text-slate-700">
                    {intake.email || "Not provided"}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Phone
                  </p>

                  <p className="mt-1 text-sm text-slate-700">
                    {intake.phone || "Not provided"}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Practice Area
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {intake.practiceArea || "Not specified"}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Source
                  </p>

                  <p className="mt-1 text-sm text-slate-700">
                    {intake.source || "Not specified"}
                  </p>
                </div>
              </div>
            </section>

            {/* Description */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-6 py-5">
                <h2 className="text-lg font-bold text-slate-950">
                  Enquiry Description
                </h2>
              </div>

              <div className="p-6">
                <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                  {intake.description ||
                    "No description was provided."}
                </p>
              </div>
            </section>

            {/* Parties */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-6 py-5">
                <h2 className="text-lg font-bold text-slate-950">
                  Parties
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Parties captured for the conflict-check process.
                </p>
              </div>

              <div className="grid gap-6 p-6 md:grid-cols-2">
                <div>
                  <h3 className="mb-3 text-sm font-bold text-slate-900">
                    Opposing Parties
                  </h3>

                  {intake.opposingParties.length > 0 ? (
                    <div className="space-y-2">
                      {intake.opposingParties.map(
                        (party, index) => (
                          <div
                            key={`${party}-${index}`}
                            className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                          >
                            {party}
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      No opposing parties recorded.
                    </p>
                  )}
                </div>

                <div>
                  <h3 className="mb-3 text-sm font-bold text-slate-900">
                    Related Parties
                  </h3>

                  {intake.relatedParties.length > 0 ? (
                    <div className="space-y-2">
                      {intake.relatedParties.map(
                        (party, index) => (
                          <div
                            key={`${party}-${index}`}
                            className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                          >
                            {party}
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      No related parties recorded.
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* Conflict Check */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-6 py-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-950">
                      Conflict Check
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Assisted identification of potential matches
                      within the firm.
                    </p>
                  </div>

                  <span
                    className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${getStatusClass(
                      intake.conflictStatus
                    )}`}
                  >
                    {conflictLabels[intake.conflictStatus] ||
                      intake.conflictStatus}
                  </span>
                </div>
              </div>

              <div className="p-6">
                {!intake.conflictCheckRequired ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                    <p className="text-sm font-semibold text-slate-800">
                      Conflict check not required
                    </p>

                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      This intake was created without requiring a
                      conflict check.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                      <p className="text-sm font-semibold text-amber-900">
                        Conflict checking is an assisted review
                        process.
                      </p>

                      <p className="mt-1 text-sm leading-6 text-amber-800">
                        A match does not automatically establish a
                        legal conflict. An authorised person must
                        review the results before the prospective
                        client is accepted.
                      </p>
                    </div>

                    <div className="mt-5 grid gap-4 sm:grid-cols-3">
                      <div className="rounded-xl border border-slate-200 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Current Status
                        </p>

                        <p className="mt-2 text-sm font-bold text-slate-900">
                          {conflictLabels[
                            intake.conflictStatus
                          ] || intake.conflictStatus}
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-200 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Last Checked
                        </p>

                        <p className="mt-2 text-sm font-bold text-slate-900">
                          {formatDate(
                            intake.conflictCheckedAt
                          )}
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-200 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Checked By
                        </p>

                        <p className="mt-2 text-sm font-bold text-slate-900">
                          {intake.conflictCheckedBy?.name ||
                            intake.conflictCheckedBy?.email ||
                            "Not checked"}
                        </p>
                      </div>
                    </div>

                    {conflictError && (
                      <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-5">
                        <p className="text-sm font-bold text-red-900">
                          Conflict check failed
                        </p>

                        <p className="mt-1 text-sm leading-6 text-red-800">
                          {conflictError}
                        </p>
                      </div>
                    )}

                    {conflictResult && (
                      <div className="mt-5 space-y-5">
                        <div
                          className={`rounded-xl border p-5 ${getConflictResultClass(
                            resultStatus
                          )}`}
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
                                Conflict Check Result
                              </p>

                              <p className="mt-1 text-xl font-bold">
                                {conflictLabels[resultStatus] ||
                                  resultStatus}
                              </p>
                            </div>

                            <span
                              className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${getStatusClass(
                                resultStatus
                              )}`}
                            >
                              {conflictLabels[resultStatus] ||
                                resultStatus}
                            </span>
                          </div>

                          <p className="mt-3 text-sm leading-6">
                            {conflictResult.disclaimer ||
                              "This result identifies potential matching records. It does not by itself establish a legal conflict. An authorised person must review the result."}
                          </p>
                        </div>

                        {/* Matched clients */}
                        <div className="rounded-xl border border-slate-200 bg-white">
                          <div className="border-b border-slate-200 px-5 py-4">
                            <h3 className="font-bold text-slate-950">
                              Matched Clients
                            </h3>

                            <p className="mt-1 text-xs text-slate-500">
                              Existing client records that matched the
                              conflict-check search.
                            </p>
                          </div>

                          <div className="p-5">
                            {matchedClients.length > 0 ? (
                              <div className="space-y-3">
                                {matchedClients.map((client) => (
                                  <div
                                    key={client.id}
                                    className="rounded-lg border border-amber-200 bg-amber-50 p-4"
                                  >
                                    <p className="font-semibold text-slate-900">
                                      {client.name}
                                    </p>

                                    <p className="mt-1 text-xs text-slate-600">
                                      Reference:{" "}
                                      {client.referenceNumber}
                                    </p>

                                    {client.email && (
                                      <p className="mt-1 text-xs text-slate-600">
                                        Email: {client.email}
                                      </p>
                                    )}

                                    {client.phone && (
                                      <p className="mt-1 text-xs text-slate-600">
                                        Phone: {client.phone}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-slate-500">
                                No matching client records were returned.
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Matched matters */}
                        <div className="rounded-xl border border-slate-200 bg-white">
                          <div className="border-b border-slate-200 px-5 py-4">
                            <h3 className="font-bold text-slate-950">
                              Matched Matters
                            </h3>

                            <p className="mt-1 text-xs text-slate-500">
                              Existing matter records that matched the
                              conflict-check search.
                            </p>
                          </div>

                          <div className="p-5">
                            {matchedMatters.length > 0 ? (
                              <div className="space-y-3">
                                {matchedMatters.map((matter) => (
                                  <div
                                    key={matter.id}
                                    className="rounded-lg border border-amber-200 bg-amber-50 p-4"
                                  >
                                    <p className="font-semibold text-slate-900">
                                      {matter.title}
                                    </p>

                                    <p className="mt-1 text-xs text-slate-600">
                                      Reference:{" "}
                                      {matter.referenceNumber}
                                    </p>

                                    {matter.practiceArea && (
                                      <p className="mt-1 text-xs text-slate-600">
                                        Practice Area:{" "}
                                        {matter.practiceArea}
                                      </p>
                                    )}

                                    {matter.status && (
                                      <p className="mt-1 text-xs text-slate-600">
                                        Status: {matter.status}
                                      </p>
                                    )}

                                    {matter.client?.name && (
                                      <p className="mt-1 text-xs text-slate-600">
                                        Client: {matter.client.name}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-slate-500">
                                No matching matter records were returned.
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Search terms */}
                        {conflictResult.searchTerms &&
                          conflictResult.searchTerms.length > 0 && (
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                              <h3 className="text-sm font-bold text-slate-900">
                                Search Terms Used
                              </h3>

                              <div className="mt-3 flex flex-wrap gap-2">
                                {conflictResult.searchTerms.map(
                                  (term, index) => (
                                    <span
                                      key={`${term}-${index}`}
                                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                                    >
                                      {term}
                                    </span>
                                  )
                                )}
                              </div>
                            </div>
                          )}
                      </div>
                    )}

                    {!conflictResult && latestConflictCheck && (
                      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-5">
                        <h3 className="text-sm font-bold text-slate-900">
                          Latest Conflict Check
                        </h3>

                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                              Result
                            </p>

                            <p className="mt-1 text-sm font-semibold text-slate-900">
                              {conflictLabels[
                                latestConflictCheck.status
                              ] ||
                                latestConflictCheck.status}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                              Checked
                            </p>

                            <p className="mt-1 text-sm text-slate-700">
                              {formatDate(
                                latestConflictCheck.createdAt
                              )}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                              Matched Clients
                            </p>

                            <p className="mt-1 text-sm font-semibold text-slate-900">
                              {
                                latestConflictCheck
                                  .matchedClientIds.length
                              }
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                              Matched Matters
                            </p>

                            <p className="mt-1 text-sm font-semibold text-slate-900">
                              {
                                latestConflictCheck
                                  .matchedMatterIds.length
                              }
                            </p>
                          </div>
                        </div>

                        {latestConflictCheck.notes && (
                          <div className="mt-4 border-t border-slate-200 pt-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                              Notes
                            </p>

                            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                              {latestConflictCheck.notes}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="mt-6">
                      <button
                        type="button"
                        onClick={runConflictCheck}
                        disabled={runningConflictCheck}
                        className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {runningConflictCheck && (
                          <svg
                            className="h-4 w-4 animate-spin"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />

                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                            />
                          </svg>
                        )}

                        {runningConflictCheck
                          ? "Running Conflict Check..."
                          : intake.conflictStatus === "NOT_CHECKED"
                            ? "Run Conflict Check"
                            : "Run Conflict Check Again"}
                      </button>

                      <p className="mt-2 text-xs text-slate-500">
                        The check searches relevant client and matter
                        records within this firm. Results require
                        authorised human review.
                      </p>
                    </div>
                  </>
                )}
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            {/* Processing */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="font-bold text-slate-950">
                  Processing
                </h2>
              </div>

              <div className="space-y-5 p-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Priority
                  </p>

                  <span
                    className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-bold ${getPriorityClass(
                      intake.priority
                    )}`}
                  >
                    {intake.priority}
                  </span>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Status
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {statusLabels[intake.status] ||
                      intake.status}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Assigned To
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {intake.assignedTo?.name ||
                      intake.assignedTo?.email ||
                      "Unassigned"}
                  </p>

                  {intake.assignedTo?.role && (
                    <p className="mt-1 text-xs text-slate-500">
                      {intake.assignedTo.role}
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Created By
                  </p>

                  <p className="mt-1 text-sm text-slate-700">
                    {intake.createdBy?.name ||
                      intake.createdBy?.email ||
                      "Unknown"}
                  </p>
                </div>
              </div>
            </section>

            {/* Dates */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="font-bold text-slate-950">
                  Record Information
                </h2>
              </div>

              <div className="space-y-5 p-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Received
                  </p>

                  <p className="mt-1 text-sm text-slate-700">
                    {formatDate(intake.createdAt)}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Last Updated
                  </p>

                  <p className="mt-1 text-sm text-slate-700">
                    {formatDate(intake.updatedAt)}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Conflict Checked
                  </p>

                  <p className="mt-1 text-sm text-slate-700">
                    {formatDate(intake.conflictCheckedAt)}
                  </p>
                </div>
              </div>
            </section>

            {/* Actions */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="font-bold text-slate-950">
                  Actions
                </h2>
              </div>

              <div className="space-y-3 p-5">
                {/* Edit */}
                {canEdit ? (
                  <Link
                    href={`/dashboard/intake/${intakeId}/edit`}
                    className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Edit Intake
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="w-full rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-400"
                  >
                    Edit Intake
                  </button>
                )}

                {/* Review */}
                {canReview ? (
                  <Link
                    href={`/dashboard/intake/${intakeId}/review`}
                    className="block w-full rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-center text-sm font-semibold text-amber-800 hover:bg-amber-100"
                  >
                    Review Conflict
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="w-full rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-400"
                  >
                    Review Conflict
                  </button>
                )}

                {/* Convert */}
                <button
                  type="button"
                  onClick={convertToMatter}
                  disabled={
                    converting ||
                    !canConvert ||
                    intake.status === "CONVERTED"
                  }
                  className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                    canConvert
                      ? "bg-emerald-700 text-white hover:bg-emerald-800"
                      : "cursor-not-allowed border border-slate-300 bg-slate-50 text-slate-400"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {converting
                    ? "Converting..."
                    : intake.status === "CONVERTED"
                      ? "Matter Created"
                      : "Convert to Matter"}
                </button>

                {/* Explanation */}
                {intake.status === "CONFLICT_REVIEW" && (
                  <p className="pt-1 text-xs leading-5 text-amber-700">
                    This intake must be reviewed and approved by an
                    authorised user before it can be converted into a
                    matter.
                  </p>
                )}

                {intake.status === "APPROVED" && (
                  <p className="pt-1 text-xs leading-5 text-emerald-700">
                    This intake has been approved and is ready to be
                    converted into a matter.
                  </p>
                )}

                {intake.status === "REJECTED" && (
                  <p className="pt-1 text-xs leading-5 text-red-600">
                    This intake has been rejected and cannot currently
                    be converted into a matter.
                  </p>
                )}

                {intake.status === "CONVERTED" && (
                  <p className="pt-1 text-xs leading-5 text-blue-700">
                    This intake has already been converted into a
                    matter.
                  </p>
                )}

                {intake.status === "NEW" ||
                intake.status === "CONFLICT_CHECK_PENDING" ? (
                  <p className="pt-1 text-xs leading-5 text-slate-500">
                    Complete the required conflict-check and review
                    workflow before converting this intake into a
                    matter.
                  </p>
                ) : null}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}