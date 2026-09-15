"use client";

import { FormEvent, useState } from "react";

type UserSummary = {
  id: string;
  name: string | null;
  email: string;
  role: string;
};

type Report = {
  id: string;
  outcome: string;
  report: string;
  nextAction: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
  submittedBy: UserSummary;
  reviewedBy: UserSummary | null;
};

type AssistanceRequest = {
  id: string;
  reason: string;
  response: string | null;
  status: string;
  createdAt: string;
  respondedAt: string | null;
  requestedBy: UserSummary;
};

type WorkflowTask = {
  id: string;
  title: string;
  status: string;
  requiresReport: boolean;
  reportSubmittedAt: string | null;
  reportReviewedAt: string | null;
  reportOutcome: string | null;
  assignedToId: string | null;
  delegatedById: string | null;
  delegatedOnBehalfOfId: string | null;
  latestReport: Report | null;
  assistanceRequests: AssistanceRequest[];
};

type Props = {
  task: WorkflowTask;
  currentUserId: string;
  canUpdateTask: boolean;
  canReviewReport: boolean;
  canRequestAssistance: boolean;
  canRespondToAssistance: boolean;
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatOutcome(value: string) {
  return value.replaceAll("_", " ");
}

function formatAssistanceStatus(value: string) {
  return value.replaceAll("_", " ");
}

export default function TaskWorkflow({
  task,
  currentUserId,
  canUpdateTask,
  canReviewReport,
  canRequestAssistance,
  canRespondToAssistance,
}: Props) {
  const [updateText, setUpdateText] =
    useState("");

  const [reportText, setReportText] =
    useState("");

  const [nextAction, setNextAction] =
    useState("");

  const [reportOutcome, setReportOutcome] =
    useState("COMPLETED");

  const [assistanceReason, setAssistanceReason] =
    useState("");

  const [reviewNote, setReviewNote] =
    useState("");

  const [assistanceResponses, setAssistanceResponses] =
    useState<Record<string, string>>({});

  const [loading, setLoading] =
    useState<string | null>(null);

  const [message, setMessage] =
    useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  function clearMessages() {
    setMessage(null);
    setError(null);
  }

  async function submitUpdate(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    clearMessages();

    if (!updateText.trim()) {
      setError("Please enter an update.");
      return;
    }

    setLoading("update");

    try {
      const response = await fetch(
        `/api/tasks/${task.id}/updates`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: updateText.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to add the update."
        );
      }

      setUpdateText("");

      setMessage(
        "Update added successfully."
      );

      window.location.reload();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to add the update."
      );
    } finally {
      setLoading(null);
    }
  }

  async function submitReport(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    clearMessages();

    if (!reportText.trim()) {
      setError(
        "Please provide a report before submitting."
      );
      return;
    }

    setLoading("report");

    try {
      const response = await fetch(
        `/api/tasks/${task.id}/report`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            outcome: reportOutcome,
            report: reportText.trim(),
            nextAction:
              nextAction.trim() || null,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to submit the report."
        );
      }

      setReportText("");
      setNextAction("");

      setMessage(
        "Report submitted successfully."
      );

      window.location.reload();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to submit the report."
      );
    } finally {
      setLoading(null);
    }
  }

  async function requestAssistance(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    clearMessages();

    if (!assistanceReason.trim()) {
      setError(
        "Please explain what assistance you need."
      );
      return;
    }

    setLoading("assistance");

    try {
      const response = await fetch(
        `/api/tasks/${task.id}/assistance`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reason:
              assistanceReason.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to request assistance."
        );
      }

      setAssistanceReason("");

      setMessage(
        "Assistance request submitted."
      );

      window.location.reload();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to request assistance."
      );
    } finally {
      setLoading(null);
    }
  }

  async function reviewReport(
    reportId: string,
    action: "ACCEPT" | "SEND_BACK"
  ) {
    clearMessages();

    setLoading(`review-${reportId}`);

    try {
      const response = await fetch(
        `/api/tasks/${task.id}/report/review`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reportId,
            action,
            reviewNote:
              reviewNote.trim() || null,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to review the report."
        );
      }

      setReviewNote("");

      setMessage(
        action === "ACCEPT"
          ? "Report accepted."
          : "Report sent back to the employee."
      );

      window.location.reload();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to review the report."
      );
    } finally {
      setLoading(null);
    }
  }

  async function respondToAssistance(
    requestId: string
  ) {
    clearMessages();

    const responseText =
      assistanceResponses[requestId]?.trim();

    if (!responseText) {
      setError(
        "Please enter a response."
      );
      return;
    }

    setLoading(
      `assistance-${requestId}`
    );

    try {
      const response = await fetch(
        `/api/tasks/${task.id}/assistance/${requestId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            response: responseText,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to respond to the assistance request."
        );
      }

      setAssistanceResponses(
        (current) => ({
          ...current,
          [requestId]: "",
        })
      );

      setMessage(
        "Assistance request responded to."
      );

      window.location.reload();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to respond to the assistance request."
      );
    } finally {
      setLoading(null);
    }
  }

  const isAssignedEmployee =
    task.assignedToId === currentUserId;

  const canReport =
    canUpdateTask &&
    isAssignedEmployee &&
    task.requiresReport;

  const hasPendingReport =
    task.latestReport &&
    !task.latestReport.reviewedAt;

  return (
    <div className="space-y-6">

      {/* ================================================= */}
      {/* SYSTEM MESSAGES */}
      {/* ================================================= */}

      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {message}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ================================================= */}
      {/* EMPLOYEE ACTIONS */}
      {/* ================================================= */}

      {canUpdateTask &&
        isAssignedEmployee && (
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Employee Workflow
              </p>

              <h2 className="mt-1 text-lg font-semibold text-slate-900">
                Work on this task
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Keep the delegating person informed
                of progress and raise assistance
                requests when necessary.
              </p>
            </div>

            {/* ADD UPDATE */}

            <form
              onSubmit={submitUpdate}
              className="mt-6"
            >
              <label className="text-sm font-semibold text-slate-900">
                Add Update
              </label>

              <textarea
                value={updateText}
                onChange={(event) =>
                  setUpdateText(
                    event.target.value
                  )
                }
                rows={4}
                placeholder="Describe the progress you have made..."
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />

              <button
                type="submit"
                disabled={
                  loading === "update"
                }
                className="mt-3 rounded-lg bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading === "update"
                  ? "Adding Update..."
                  : "Add Update"}
              </button>
            </form>

            {/* REPORT BACK */}

            {canReport && (
              <form
                onSubmit={submitReport}
                className="mt-8 border-t border-slate-200 pt-8"
              >
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    Report Back
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Submit your findings or outcome
                    to the person who delegated the
                    task.
                  </p>
                </div>

                <div className="mt-5">

                  <label className="text-sm font-medium text-slate-700">
                    Outcome
                  </label>

                  <select
                    value={reportOutcome}
                    onChange={(event) =>
                      setReportOutcome(
                        event.target.value
                      )
                    }
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="COMPLETED">
                      Completed
                    </option>

                    <option value="PARTIALLY_COMPLETED">
                      Partially Completed
                    </option>

                    <option value="UNABLE_TO_COMPLETE">
                      Unable to Complete
                    </option>

                    <option value="AWAITING_RESPONSE">
                      Awaiting Response
                    </option>
                  </select>
                </div>

                <div className="mt-5">

                  <label className="text-sm font-medium text-slate-700">
                    Report
                  </label>

                  <textarea
                    value={reportText}
                    onChange={(event) =>
                      setReportText(
                        event.target.value
                      )
                    }
                    rows={6}
                    placeholder="Explain what you did, what you found, and the outcome..."
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div className="mt-5">

                  <label className="text-sm font-medium text-slate-700">
                    Next Action
                    <span className="ml-1 font-normal text-slate-400">
                      (Optional)
                    </span>
                  </label>

                  <textarea
                    value={nextAction}
                    onChange={(event) =>
                      setNextAction(
                        event.target.value
                      )
                    }
                    rows={3}
                    placeholder="What should happen next?"
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <button
                  type="submit"
                  disabled={
                    loading === "report"
                  }
                  className="mt-4 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading === "report"
                    ? "Submitting Report..."
                    : "Report Back"}
                </button>
              </form>
            )}

            {/* REQUEST ASSISTANCE */}

            {canRequestAssistance && (
              <form
                onSubmit={requestAssistance}
                className="mt-8 border-t border-slate-200 pt-8"
              >
                <h3 className="text-base font-semibold text-slate-900">
                  Request Assistance
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Let the responsible director or
                  manager know if you need help.
                </p>

                <textarea
                  value={assistanceReason}
                  onChange={(event) =>
                    setAssistanceReason(
                      event.target.value
                    )
                  }
                  rows={4}
                  placeholder="Explain what assistance you need..."
                  className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />

                <button
                  type="submit"
                  disabled={
                    loading === "assistance"
                  }
                  className="mt-3 rounded-lg border border-orange-300 bg-orange-50 px-5 py-3 text-sm font-medium text-orange-700 hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading === "assistance"
                    ? "Requesting..."
                    : "Request Assistance"}
                </button>
              </form>
            )}

          </section>
        )}

      {/* ================================================= */}
      {/* LATEST REPORT */}
      {/* ================================================= */}

      {task.latestReport && (
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">

          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Task Report
              </p>

              <h2 className="mt-1 text-lg font-semibold text-slate-900">
                Report Back
              </h2>
            </div>

            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold uppercase text-blue-700">
              {formatOutcome(
                task.latestReport.outcome
              )}
            </span>

          </div>

          <div className="mt-6 rounded-xl bg-slate-50 p-5">

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Submitted By
              </p>

              <p className="mt-1 text-sm font-medium text-slate-900">
                {task.latestReport.submittedBy.name ||
                  "Unnamed user"}
              </p>

              <p className="text-xs text-slate-500">
                {formatDateTime(
                  task.latestReport.submittedAt
                )}
              </p>
            </div>

            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Report
              </p>

              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {task.latestReport.report}
              </p>
            </div>

            {task.latestReport.nextAction && (
              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Next Action
                </p>

                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {task.latestReport.nextAction}
                </p>
              </div>
            )}

            {/* REVIEW INFORMATION */}

            {task.latestReport.reviewedAt && (
              <div className="mt-6 border-t border-slate-200 pt-5">

                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Reviewed
                </p>

                <p className="mt-1 text-sm font-medium text-slate-900">
                  {task.latestReport.reviewedBy?.name ||
                    "Reviewer"}
                </p>

                <p className="text-xs text-slate-500">
                  {formatDateTime(
                    task.latestReport.reviewedAt
                  )}
                </p>

                {task.latestReport.reviewNote && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Review Note
                    </p>

                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                      {task.latestReport.reviewNote}
                    </p>
                  </div>
                )}

              </div>
            )}

          </div>

          {/* REPORT REVIEW */}

          {canReviewReport &&
            hasPendingReport && (
              <div className="mt-6 border-t border-slate-200 pt-6">

                <h3 className="text-base font-semibold text-slate-900">
                  Review Report
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Review the employee's report and
                  either accept it or send it back for
                  further work.
                </p>

                <textarea
                  value={reviewNote}
                  onChange={(event) =>
                    setReviewNote(
                      event.target.value
                    )
                  }
                  rows={4}
                  placeholder="Add a review note..."
                  className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />

                <div className="mt-4 flex flex-wrap gap-3">

                  <button
                    type="button"
                    disabled={
                      loading ===
                      `review-${task.latestReport.id}`
                    }
                    onClick={() =>
                      reviewReport(
                        task.latestReport!.id,
                        "ACCEPT"
                      )
                    }
                    className="rounded-lg bg-emerald-600 px-5 py-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ===
                    `review-${task.latestReport.id}`
                      ? "Processing..."
                      : "Accept Report"}
                  </button>

                  <button
                    type="button"
                    disabled={
                      loading ===
                      `review-${task.latestReport.id}`
                    }
                    onClick={() =>
                      reviewReport(
                        task.latestReport!.id,
                        "SEND_BACK"
                      )
                    }
                    className="rounded-lg border border-orange-300 bg-orange-50 px-5 py-3 text-sm font-medium text-orange-700 hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Send Back
                  </button>

                </div>

              </div>
            )}

        </section>
      )}

      {/* ================================================= */}
      {/* ASSISTANCE REQUESTS */}
      {/* ================================================= */}

      {task.assistanceRequests.length >
        0 && (
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Support
            </p>

            <h2 className="mt-1 text-lg font-semibold text-slate-900">
              Assistance Requests
            </h2>
          </div>

          <div className="mt-6 space-y-5">

            {task.assistanceRequests.map(
              (request) => (
                <div
                  key={request.id}
                  className="rounded-xl border border-slate-200 p-5"
                >

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

                    <div>
                      <p className="font-medium text-slate-900">
                        {request.requestedBy.name ||
                          "Unnamed user"}
                      </p>

                      <p className="text-xs text-slate-500">
                        {formatDateTime(
                          request.createdAt
                        )}
                      </p>
                    </div>

                    <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold uppercase text-orange-700">
                      {formatAssistanceStatus(
                        request.status
                      )}
                    </span>

                  </div>

                  <div className="mt-4">

                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Request
                    </p>

                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {request.reason}
                    </p>

                  </div>

                  {request.response && (
                    <div className="mt-4 rounded-lg bg-emerald-50 p-4">

                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                        Response
                      </p>

                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-emerald-900">
                        {request.response}
                      </p>

                      {request.respondedAt && (
                        <p className="mt-2 text-xs text-emerald-600">
                          Responded{" "}
                          {formatDateTime(
                            request.respondedAt
                          )}
                        </p>
                      )}

                    </div>
                  )}

                  {/* RESPOND */}

                  {canRespondToAssistance &&
                    request.status ===
                      "PENDING" && (
                      <div className="mt-5 border-t border-slate-200 pt-5">

                        <label className="text-sm font-medium text-slate-700">
                          Response
                        </label>

                        <textarea
                          value={
                            assistanceResponses[
                              request.id
                            ] || ""
                          }
                          onChange={(event) =>
                            setAssistanceResponses(
                              (current) => ({
                                ...current,
                                [request.id]:
                                  event.target.value,
                              })
                            )
                          }
                          rows={4}
                          placeholder="Provide guidance or assistance..."
                          className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />

                        <button
                          type="button"
                          disabled={
                            loading ===
                            `assistance-${request.id}`
                          }
                          onClick={() =>
                            respondToAssistance(
                              request.id
                            )
                          }
                          className="mt-3 rounded-lg bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {loading ===
                          `assistance-${request.id}`
                            ? "Sending..."
                            : "Respond"}
                        </button>

                      </div>
                    )}

                </div>
              )
            )}

          </div>
        </section>
      )}

      {/* ================================================= */}
      {/* WORKFLOW SUMMARY */}
      {/* ================================================= */}

      <section className="rounded-2xl bg-slate-900 p-6 text-white shadow-sm">

        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Workflow
        </p>

        <h2 className="mt-1 text-lg font-semibold">
          Task accountability
        </h2>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">

          <div className="rounded-xl bg-white/10 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Assignment
            </p>

            <p className="mt-2 text-sm">
              Task delegated to the responsible
              employee.
            </p>
          </div>

          <div className="rounded-xl bg-white/10 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Progress
            </p>

            <p className="mt-2 text-sm">
              Employee provides updates and can
              request assistance.
            </p>
          </div>

          <div className="rounded-xl bg-white/10 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Accountability
            </p>

            <p className="mt-2 text-sm">
              Required reports are reviewed by the
              responsible manager or director.
            </p>
          </div>

        </div>

      </section>

    </div>
  );
}