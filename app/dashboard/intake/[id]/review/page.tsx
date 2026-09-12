"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type IntakeStatus =
  | "NEW"
  | "CONFLICT_CHECK_PENDING"
  | "CONFLICT_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "CONVERTED"
  | "CLOSED";

type ConflictCheckStatus =
  | "NOT_CHECKED"
  | "CLEAR"
  | "POTENTIAL_CONFLICT"
  | "CONFLICT_DETECTED"
  | "REQUIRES_REVIEW";

type ClientMatch = {
  id: string;
  referenceNumber: string;
  name: string;
  type?: string | null;
  email?: string | null;
  phone?: string | null;
};

type MatterMatch = {
  id: string;
  referenceNumber: string;
  title: string;
  status?: string | null;
  practiceArea?: string | null;
  client?: {
    id: string;
    name: string;
    referenceNumber: string;
  } | null;
};

type ConflictCheck = {
  id: string;
  status: ConflictCheckStatus;
  searchTerms: string[];
  matchedClientIds: string[];
  matchedMatterIds: string[];
  notes?: string | null;
  reviewedAt?: string | null;
  createdAt?: string | null;
};

type Intake = {
  id: string;
  prospectiveClientName: string;
  email?: string | null;
  phone?: string | null;
  practiceArea?: string | null;
  description?: string | null;
  opposingParties: string[];
  relatedParties: string[];
  source?: string | null;
  priority: string;
  conflictCheckRequired: boolean;
  conflictStatus: ConflictCheckStatus;
  status: IntakeStatus;
  client?: {
    id: string;
    name: string;
    referenceNumber: string;
  } | null;
  assignedTo?: {
    id: string;
    name?: string | null;
    email: string;
    role: string;
  } | null;
  conflictChecks?: ConflictCheck[];
};

type ConflictCheckResponse = {
  success?: boolean;
  message?: string;
  error?: string;
  data?: {
    conflictCheck?: ConflictCheck | null;
    clients?: ClientMatch[];
    matters?: MatterMatch[];
    searchTerms?: string[];
    matchedClientIds?: string[];
    matchedMatterIds?: string[];
    clientMatchCount?: number;
    matterMatchCount?: number;
    requiresHumanReview?: boolean;
    disclaimer?: string;
  };
};

type IntakeResponse = {
  success?: boolean;
  message?: string;
  error?: string;
  data?: Intake;
};

type ReviewResponse = {
  success?: boolean;
  message?: string;
  error?: string;
  data?: {
    intake?: Intake;
    conflictCheck?: ConflictCheck;
  };
};

function formatDate(value?: string | null) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatStatus(value?: string | null) {
  if (!value) {
    return "Not available";
  }

  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatPriority(value?: string | null) {
  if (!value) {
    return "Not available";
  }

  return value.toUpperCase();
}

function cleanSearchTerms(terms: string[]) {
  const cleaned: string[] = [];

  for (const term of terms) {
    if (!term) {
      continue;
    }

    const value = term.trim();

    if (!value) {
      continue;
    }

    if (!cleaned.some((existing) => existing.toLowerCase() === value.toLowerCase())) {
      cleaned.push(value);
    }
  }

  return cleaned;
}

function getConflictStatusClasses(status: ConflictCheckStatus) {
  switch (status) {
    case "CLEAR":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";

    case "POTENTIAL_CONFLICT":
      return "border-amber-200 bg-amber-50 text-amber-800";

    case "CONFLICT_DETECTED":
      return "border-red-200 bg-red-50 text-red-800";

    case "REQUIRES_REVIEW":
      return "border-orange-200 bg-orange-50 text-orange-800";

    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

export default function ReviewConflictPage() {
  const params = useParams();
  const router = useRouter();

  const intakeId = Array.isArray(params.id)
    ? params.id[0]
    : String(params.id || "");

  const [intake, setIntake] = useState<Intake | null>(null);
  const [conflictCheck, setConflictCheck] =
    useState<ConflictCheck | null>(null);

  const [matchedClients, setMatchedClients] = useState<ClientMatch[]>([]);
  const [matchedMatters, setMatchedMatters] = useState<MatterMatch[]>([]);
  const [searchTerms, setSearchTerms] = useState<string[]>([]);

  const [reviewNotes, setReviewNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const latestCheckExists = conflictCheck !== null;

  const canReview =
    intake?.status === "CONFLICT_REVIEW" &&
    latestCheckExists;

  const displaySearchTerms = useMemo(
    () => cleanSearchTerms(searchTerms),
    [searchTerms]
  );

  async function loadIntake() {
    if (!intakeId) {
      setError("Invalid intake ID.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const intakeResponse = await fetch(
        `/api/intake/${intakeId}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const intakeData =
        (await intakeResponse.json()) as IntakeResponse;

      if (!intakeResponse.ok || !intakeData.success || !intakeData.data) {
        throw new Error(
          intakeData.error ||
            intakeData.message ||
            "Failed to load the legal intake."
        );
      }

      const loadedIntake = intakeData.data;

      setIntake(loadedIntake);

      const existingLatestCheck =
        loadedIntake.conflictChecks?.[0] || null;

      if (existingLatestCheck) {
        setReviewNotes(existingLatestCheck.notes || "");
      }

      const conflictResponse = await fetch(
        `/api/intake/${intakeId}/conflict-check`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const conflictData =
        (await conflictResponse.json()) as ConflictCheckResponse;

      if (
        conflictResponse.ok &&
        conflictData.success &&
        conflictData.data
      ) {
        const returnedCheck =
          conflictData.data.conflictCheck || existingLatestCheck;

        setConflictCheck(returnedCheck || null);

        setMatchedClients(
          Array.isArray(conflictData.data.clients)
            ? conflictData.data.clients
            : []
        );

        setMatchedMatters(
          Array.isArray(conflictData.data.matters)
            ? conflictData.data.matters
            : []
        );

        const returnedSearchTerms =
          Array.isArray(conflictData.data.searchTerms)
            ? conflictData.data.searchTerms
            : returnedCheck?.searchTerms || [];

        setSearchTerms(cleanSearchTerms(returnedSearchTerms));
      } else if (existingLatestCheck) {
        setConflictCheck(existingLatestCheck);
        setSearchTerms(
          cleanSearchTerms(existingLatestCheck.searchTerms || [])
        );
      } else {
        setConflictCheck(null);
        setSearchTerms([]);
        setMatchedClients([]);
        setMatchedMatters([]);
      }
    } catch (err) {
      console.error("LOAD REVIEW ERROR:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load the conflict review."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadIntake();
  }, [intakeId]);

  async function submitReview(decision: "APPROVE" | "REJECT") {
    if (!intake) {
      return;
    }

    if (!conflictCheck) {
      setError(
        "A conflict check must exist before the intake can be reviewed."
      );
      return;
    }

    if (intake.status !== "CONFLICT_REVIEW") {
      setError(
        `This intake cannot be reviewed because its current status is ${formatStatus(
          intake.status
        )}.`
      );
      return;
    }

    const actionText =
      decision === "APPROVE"
        ? "approve this intake"
        : "reject this intake";

    const confirmed = window.confirm(
      `Are you sure you want to ${actionText}? This decision will be recorded in the audit trail.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      const response = await fetch(
        `/api/intake/${intakeId}/review`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            decision,
            notes: reviewNotes.trim() || null,
          }),
        }
      );

      const result =
        (await response.json()) as ReviewResponse;

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            result.message ||
            "Failed to submit the review."
        );
      }

      setSuccess(
        decision === "APPROVE"
          ? "The intake has been approved successfully."
          : "The intake has been rejected successfully."
      );

      await loadIntake();

      setTimeout(() => {
        router.push(`/dashboard/intake/${intakeId}`);
      }, 800);
    } catch (err) {
      console.error("SUBMIT REVIEW ERROR:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to submit the review."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
              <p className="text-sm font-medium text-slate-600">
                Loading conflict review...
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!intake) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <h1 className="text-lg font-bold text-red-900">
              Unable to load intake
            </h1>

            <p className="mt-2 text-sm leading-6 text-red-800">
              {error || "The requested legal intake could not be found."}
            </p>

            <Link
              href="/dashboard/intake"
              className="mt-5 inline-flex rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"
            >
              Back to Intake Centre
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <Link
            href="/dashboard"
            className="transition hover:text-slate-900"
          >
            Dashboard
          </Link>

          <span>/</span>

          <Link
            href="/dashboard/intake"
            className="transition hover:text-slate-900"
          >
            Legal Intake
          </Link>

          <span>/</span>

          <Link
            href={`/dashboard/intake/${intakeId}`}
            className="transition hover:text-slate-900"
          >
            {intake.prospectiveClientName}
          </Link>

          <span>/</span>

          <span className="font-medium text-slate-900">
            Review Conflict
          </span>
        </div>

        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-500">
              Legal Intake &amp; Conflict Check Centre
            </p>

            <h1 className="text-3xl font-bold tracking-tight text-slate-950">
              Review Conflict
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Human review is required before this intake can be approved.
            </p>
          </div>

          <Link
            href={`/dashboard/intake/${intakeId}`}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Back to Intake
          </Link>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="flex gap-3">
              <div className="mt-0.5 text-red-700">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path
                    strokeLinecap="round"
                    d="M12 8v4"
                  />
                  <path
                    strokeLinecap="round"
                    d="M12 16h.01"
                  />
                </svg>
              </div>

              <div>
                <p className="font-semibold text-red-900">
                  Review error
                </p>

                <p className="mt-1 text-sm leading-6 text-red-800">
                  {error}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex gap-3">
              <div className="mt-0.5 text-emerald-700">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m5 12 4 4L19 6"
                  />
                </svg>
              </div>

              <div>
                <p className="font-semibold text-emerald-900">
                  Review submitted
                </p>

                <p className="mt-1 text-sm leading-6 text-emerald-800">
                  {success}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Human review warning */}
        <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <div className="flex gap-4">
            <div className="mt-0.5 text-amber-700">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v4m0 4h.01M10.29 3.86 2.82 17a2 2 0 0 0 1.74 3h14.88a2 2 0 0 0 1.74-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
                />
              </svg>
            </div>

            <div>
              <h2 className="font-bold text-amber-950">
                Human Review Required
              </h2>

              <p className="mt-1 text-sm leading-6 text-amber-900">
                A system match does not automatically mean that a legal
                conflict exists. Review the matched clients and matters,
                consider the circumstances, and make the final professional
                determination.
              </p>
            </div>
          </div>
        </section>

        {/* Intake Summary */}
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  Intake Summary
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Review the prospective client and enquiry information.
                </p>
              </div>

              <span
                className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-bold ${getConflictStatusClasses(
                  intake.conflictStatus
                )}`}
              >
                {formatStatus(intake.conflictStatus)}
              </span>
            </div>
          </div>

          <div className="grid gap-6 p-6 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Prospective Client
              </p>

              <p className="mt-1 text-sm font-bold text-slate-950">
                {intake.prospectiveClientName}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Email
              </p>

              <p className="mt-1 break-words text-sm text-slate-800">
                {intake.email || "Not provided"}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Phone
              </p>

              <p className="mt-1 text-sm text-slate-800">
                {intake.phone || "Not provided"}
              </p>

              {intake.phone &&
                intake.email &&
                intake.phone.trim().toLowerCase() ===
                  intake.email.trim().toLowerCase() && (
                  <p className="mt-2 text-xs font-medium text-amber-700">
                    This record appears to contain the email address in the
                    phone field. Please verify the contact information in
                    Edit Intake.
                  </p>
                )}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Practice Area
              </p>

              <p className="mt-1 text-sm text-slate-800">
                {intake.practiceArea || "Not specified"}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Priority
              </p>

              <p className="mt-1 text-sm font-bold text-slate-950">
                {formatPriority(intake.priority)}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Intake Status
              </p>

              <p className="mt-1 text-sm text-slate-800">
                {formatStatus(intake.status)}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Conflict Status
              </p>

              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatStatus(intake.conflictStatus)}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Linked Client
              </p>

              <p className="mt-1 text-sm text-slate-800">
                {intake.client
                  ? `${intake.client.name} (${intake.client.referenceNumber})`
                  : "No linked client"}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Assigned To
              </p>

              <p className="mt-1 text-sm text-slate-800">
                {intake.assignedTo
                  ? intake.assignedTo.name || intake.assignedTo.email
                  : "Unassigned"}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Enquiry Source
              </p>

              <p className="mt-1 text-sm text-slate-800">
                {intake.source || "Not specified"}
              </p>
            </div>
          </div>

          {(intake.description ||
            intake.opposingParties?.length > 0 ||
            intake.relatedParties?.length > 0) && (
            <div className="border-t border-slate-200 p-6">
              <div className="grid gap-6 lg:grid-cols-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Description
                  </p>

                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {intake.description || "No description provided."}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Opposing Parties
                  </p>

                  {intake.opposingParties?.length > 0 ? (
                    <div className="mt-2 space-y-2">
                      {intake.opposingParties.map((party, index) => (
                        <div
                          key={`${party}-${index}`}
                          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
                        >
                          {party}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">
                      None provided.
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Related Parties
                  </p>

                  {intake.relatedParties?.length > 0 ? (
                    <div className="mt-2 space-y-2">
                      {intake.relatedParties.map((party, index) => (
                        <div
                          key={`${party}-${index}`}
                          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
                        >
                          {party}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">
                      None provided.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Conflict Check */}
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  Conflict Check
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  System-generated results requiring professional assessment.
                </p>
              </div>

              {conflictCheck && (
                <span
                  className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-bold ${getConflictStatusClasses(
                    conflictCheck.status
                  )}`}
                >
                  {formatStatus(conflictCheck.status)}
                </span>
              )}
            </div>
          </div>

          {!conflictCheck ? (
            <div className="p-6">
              <div className="rounded-xl border border-red-200 bg-red-50 p-5">
                <p className="font-semibold text-red-900">
                  No conflict check result is available.
                </p>

                <p className="mt-1 text-sm leading-6 text-red-800">
                  Run a conflict check before attempting to approve or reject
                  this intake.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Search terms */}
              <div className="border-b border-slate-200 p-6">
                <div className="mb-4">
                  <h3 className="font-bold text-slate-950">
                    Conflict Check Search Terms
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Terms used by LegalVault when searching existing firm
                    records.
                  </p>
                </div>

                {displaySearchTerms.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {displaySearchTerms.map((term, index) => (
                      <span
                        key={`${term}-${index}`}
                        className="inline-flex max-w-full break-words rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800"
                      >
                        {term}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    No search terms were recorded.
                  </p>
                )}
              </div>

              {/* Matched clients */}
              <div className="border-b border-slate-200 p-6">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-bold text-slate-950">
                      Matched Clients
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      Existing client records matching the conflict search.
                    </p>
                  </div>

                  <span className="inline-flex w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                    {matchedClients.length}
                  </span>
                </div>

                {matchedClients.length === 0 ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
                    <p className="font-semibold text-emerald-900">
                      No matching client records were found.
                    </p>

                    <p className="mt-1 text-sm text-emerald-800">
                      This does not by itself constitute a legal determination
                      that no conflict exists.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {matchedClients.map((client) => (
                      <div
                        key={client.id}
                        className="rounded-xl border border-amber-200 bg-amber-50 p-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="font-bold text-slate-950">
                              {client.name}
                            </p>

                            <p className="mt-1 text-sm text-slate-600">
                              {client.referenceNumber}
                            </p>
                          </div>

                          {client.type && (
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                              {formatStatus(client.type)}
                            </span>
                          )}
                        </div>

                        {(client.email || client.phone) && (
                          <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                            {client.email && (
                              <p>
                                <span className="font-semibold">
                                  Email:
                                </span>{" "}
                                {client.email}
                              </p>
                            )}

                            {client.phone && (
                              <p>
                                <span className="font-semibold">
                                  Phone:
                                </span>{" "}
                                {client.phone}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Matched matters */}
              <div className="p-6">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-bold text-slate-950">
                      Matched Matters
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      Existing matters matching the conflict search.
                    </p>
                  </div>

                  <span className="inline-flex w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                    {matchedMatters.length}
                  </span>
                </div>

                {matchedMatters.length === 0 ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
                    <p className="font-semibold text-emerald-900">
                      No matching matter records were found.
                    </p>

                    <p className="mt-1 text-sm text-emerald-800">
                      Review the circumstances and other available
                      information before making the final determination.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {matchedMatters.map((matter) => (
                      <div
                        key={matter.id}
                        className="rounded-xl border border-amber-200 bg-amber-50 p-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="font-bold text-slate-950">
                              {matter.title}
                            </p>

                            <p className="mt-1 text-sm font-medium text-slate-600">
                              {matter.referenceNumber}
                            </p>

                            {matter.client && (
                              <p className="mt-2 text-sm text-slate-700">
                                <span className="font-semibold">
                                  Client:
                                </span>{" "}
                                {matter.client.name} (
                                {matter.client.referenceNumber})
                              </p>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {matter.practiceArea && (
                              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                                {matter.practiceArea}
                              </span>
                            )}

                            {matter.status && (
                              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                                {formatStatus(matter.status)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        {/* Check metadata */}
        {conflictCheck && (
          <section className="mb-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <h2 className="text-lg font-bold text-slate-950">
                Conflict Check Record
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Audit information associated with the latest conflict check.
              </p>
            </div>

            <div className="grid gap-6 p-6 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Check Status
                </p>

                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {formatStatus(conflictCheck.status)}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Client Matches
                </p>

                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {matchedClients.length}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Matter Matches
                </p>

                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {matchedMatters.length}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Checked At
                </p>

                <p className="mt-1 text-sm text-slate-800">
                  {formatDate(conflictCheck.createdAt)}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Reviewed At
                </p>

                <p className="mt-1 text-sm text-slate-800">
                  {formatDate(conflictCheck.reviewedAt)}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Professional Review */}
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-lg font-bold text-slate-950">
              Professional Review
            </h2>

            <p className="mt-1 text-sm leading-6 text-slate-500">
              Record the reasoning or relevant observations supporting the
              review decision.
            </p>
          </div>

          <div className="p-6">
            <label
              htmlFor="reviewNotes"
              className="mb-2 block text-sm font-semibold text-slate-900"
            >
              Review Notes
            </label>

            <textarea
              id="reviewNotes"
              value={reviewNotes}
              onChange={(event) =>
                setReviewNotes(event.target.value)
              }
              disabled={!canReview || submitting}
              rows={7}
              placeholder="Record the relevant circumstances, observations, checks performed, and reasoning supporting the professional determination..."
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100"
            />

            <p className="mt-2 text-xs leading-5 text-slate-500">
              These notes form part of the professional review record and
              should explain the basis for the decision.
            </p>

            {!canReview && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-800">
                  Review unavailable
                </p>

                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {intake.status === "CONFLICT_REVIEW"
                    ? "A conflict check result is required before a decision can be submitted."
                    : `This intake is currently ${formatStatus(
                        intake.status
                      )} and cannot receive another review decision.`}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Actions */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-bold text-slate-950">
                Review Decision
              </h2>

              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                Approving this intake allows it to proceed to the matter
                conversion stage. Rejecting it records that the prospective
                client should not proceed through this intake workflow.
              </p>
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <Link
                href={`/dashboard/intake/${intakeId}`}
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </Link>

              <button
                type="button"
                onClick={() => submitReview("REJECT")}
                disabled={!canReview || submitting}
                className="inline-flex items-center justify-center rounded-lg border border-red-300 bg-white px-5 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Processing..." : "Reject Intake"}
              </button>

              <button
                type="button"
                onClick={() => submitReview("APPROVE")}
                disabled={!canReview || submitting}
                className="inline-flex items-center justify-center rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Processing..." : "Approve Intake"}
              </button>
            </div>
          </div>
        </section>

        {/* Workflow */}
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-lg font-bold text-slate-950">
            Workflow
          </h2>

          <div className="grid gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-slate-950 text-sm font-bold text-white">
                1
              </div>

              <p className="font-bold text-slate-900">
                Intake
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                Enquiry captured
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-slate-950 text-sm font-bold text-white">
                2
              </div>

              <p className="font-bold text-slate-900">
                Conflict Check
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                Existing records searched
              </p>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-amber-600 text-sm font-bold text-white">
                3
              </div>

              <p className="font-bold text-amber-950">
                Human Review
              </p>

              <p className="mt-1 text-xs leading-5 text-amber-800">
                Professional determination
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-slate-950 text-sm font-bold text-white">
                4
              </div>

              <p className="font-bold text-slate-900">
                Matter Conversion
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                Available after approval
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}