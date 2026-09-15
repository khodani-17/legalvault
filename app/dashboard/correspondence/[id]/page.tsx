"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Correspondence = {
  id: string;
  direction: "INCOMING" | "OUTGOING";
  correspondenceDate: string;
  sender: string;
  recipient: string;
  subject: string;
  type: string;
  status: string;
  responseRequired: boolean;
  responseDeadline: string | null;
  notes: string | null;

  client: {
    id: string;
    name: string;
    referenceNumber: string;
  } | null;

  matter: {
    id: string;
    title: string;
    referenceNumber: string;
  } | null;

  responsibleUser: {
    id: string;
    email: string;
    role: string;
  } | null;

  createdBy: {
    id: string;
    email: string;
    role: string;
  };

  attachments: Array<{
    id: string;
    document: {
      id: string;
      name: string;
      originalName: string | null;
      mimeType: string;
      extension: string | null;
    };
  }>;
};

type HistoryItem = {
  id: string;
  action: string;
  entityType: string;
  description: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
  };
};

const statusLabels: Record<string, string> = {
  RECEIVED: "Received",
  ASSIGNED: "Assigned",
  ACTION_REQUIRED: "Action Required",
  RESPONDED: "Responded",
  CLOSED: "Closed",
};

const typeLabels: Record<string, string> = {
  LETTER: "Letter",
  COURT_NOTICE: "Court Notice",
  CLIENT_EMAIL: "Client Email",
  DEMAND: "Demand",
  NOTICE: "Notice",
  OPPOSING_ATTORNEY: "Opposing Attorney",
  CLIENT_CORRESPONDENCE: "Client Correspondence",
  COURT_CORRESPONDENCE: "Court Correspondence",
  FOLLOW_UP: "Follow-Up",
  OTHER: "Other",
};

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getStatusClass(status: string) {
  switch (status) {
    case "RECEIVED":
      return "status received";

    case "ASSIGNED":
      return "status assigned";

    case "ACTION_REQUIRED":
      return "status action";

    case "RESPONDED":
      return "status responded";

    case "CLOSED":
      return "status closed";

    default:
      return "status";
  }
}

export default function CorrespondenceDetailPage() {
  const params = useParams();
  const router = useRouter();

  /*
   * params.id can technically be undefined according to Next.js' type
   * definitions. We therefore explicitly convert it into a guaranteed
   * string so it can safely be used in API requests and URLs.
   */
  const correspondenceId = Array.isArray(params.id)
    ? params.id[0] ?? ""
    : params.id ?? "";

  const [correspondence, setCorrespondence] =
    useState<Correspondence | null>(null);

  const [history, setHistory] = useState<HistoryItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [notes, setNotes] = useState("");

  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  async function loadCorrespondence() {
    if (!correspondenceId) {
      setError("Invalid correspondence ID.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `/api/correspondence/${encodeURIComponent(
          correspondenceId
        )}`,
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Failed to load correspondence."
        );
      }

      const item = data.correspondence ?? data;

      setCorrespondence(item);
      setNotes(item.notes ?? "");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load correspondence."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadHistory() {
    if (!correspondenceId) {
      setHistoryLoading(false);
      return;
    }

    try {
      setHistoryLoading(true);

      /*
       * We use the existing AuditLog system for correspondence
       * history rather than creating another database model.
       */
      const response = await fetch(
        `/api/audit?entityType=Correspondence&entityId=${encodeURIComponent(
          correspondenceId
        )}`,
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        setHistory([]);
        return;
      }

      const data = await response.json();

      const items =
        data?.logs ??
        data?.auditLogs ??
        data?.data ??
        (Array.isArray(data) ? data : []);

      setHistory(items);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    if (!correspondenceId) {
      setLoading(false);
      setHistoryLoading(false);
      setError("Invalid correspondence ID.");
      return;
    }

    void loadCorrespondence();
    void loadHistory();
  }, [correspondenceId]);

  const overdue = useMemo(() => {
    if (
      !correspondence?.responseRequired ||
      !correspondence.responseDeadline ||
      correspondence.status === "RESPONDED" ||
      correspondence.status === "CLOSED"
    ) {
      return false;
    }

    return (
      new Date(correspondence.responseDeadline).getTime() <
      Date.now()
    );
  }, [correspondence]);

  async function updateCorrespondence(
    updates: Record<string, unknown>,
    successMessage: string
  ) {
    if (!correspondenceId) {
      setError("Invalid correspondence ID.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const response = await fetch(
        `/api/correspondence/${encodeURIComponent(
          correspondenceId
        )}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updates),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Failed to update correspondence."
        );
      }

      const updated = data.correspondence ?? data;

      setCorrespondence(updated);
      setNotes(updated.notes ?? "");

      setSuccess(successMessage);

      await loadHistory();

      setTimeout(() => {
        setSuccess("");
      }, 3500);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update correspondence."
      );
    } finally {
      setSaving(false);
      setShowStatusMenu(false);
    }
  }

  async function saveNotes() {
    await updateCorrespondence(
      {
        notes: notes.trim() || null,
      },
      "Notes saved successfully."
    );
  }

  async function changeStatus(status: string) {
    await updateCorrespondence(
      {
        status,
      },
      `Status changed to ${statusLabels[status] ?? status}.`
    );
  }

  async function deleteCorrespondence() {
    if (!correspondenceId) {
      setError("Invalid correspondence ID.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const response = await fetch(
        `/api/correspondence/${encodeURIComponent(
          correspondenceId
        )}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Failed to delete correspondence."
        );
      }

      router.push("/dashboard/correspondence");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete correspondence."
      );

      setSaving(false);
      setShowDeleteConfirm(false);
    }
  }

  if (loading) {
    return (
      <main className="page">
        <div className="loading-card">
          Loading correspondence...
        </div>
      </main>
    );
  }

  if (!correspondence) {
    return (
      <main className="page">
        <div className="error-card">
          <h1>Correspondence not found</h1>

          <p>
            {error ||
              "The requested correspondence could not be found."}
          </p>

          <Link
            href="/dashboard/correspondence"
            className="button"
          >
            Back to Correspondence
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="topbar">
        <div>
          <Link
            href="/dashboard/correspondence"
            className="back-link"
          >
            ← Correspondence Centre
          </Link>

          <div className="title-row">
            <div>
              <div className="eyebrow">
                {correspondence.direction === "INCOMING"
                  ? "Incoming Correspondence"
                  : "Outgoing Correspondence"}
              </div>

              <h1>{correspondence.subject}</h1>

              <p className="subtitle">
                {typeLabels[correspondence.type] ??
                  correspondence.type}
              </p>
            </div>

            <span
              className={getStatusClass(
                correspondence.status
              )}
            >
              {statusLabels[correspondence.status] ??
                correspondence.status}
            </span>
          </div>
        </div>

        <div className="top-actions">
          <Link
            href={`/dashboard/correspondence/${encodeURIComponent(
              correspondence.id
            )}/edit`}
            className="button secondary"
          >
            Edit
          </Link>

          <Link
            href={`/dashboard/tasks/new?correspondenceId=${encodeURIComponent(
              correspondence.id
            )}`}
            className="button primary"
          >
            Delegate Task
          </Link>
        </div>
      </div>

      {error && (
        <div className="alert error">
          {error}
        </div>
      )}

      {success && (
        <div className="alert success">
          {success}
        </div>
      )}

      <div className="grid">
        <section className="main-column">
          {/* CORRESPONDENCE DETAILS */}

          <div className="card">
            <div className="card-header">
              <div>
                <h2>Correspondence Details</h2>

                <p>
                  Information recorded for this
                  communication.
                </p>
              </div>
            </div>

            <div className="details-grid">
              <Detail
                label="Direction"
                value={
                  correspondence.direction === "INCOMING"
                    ? "Incoming"
                    : "Outgoing"
                }
              />

              <Detail
                label="Correspondence Date"
                value={formatDate(
                  correspondence.correspondenceDate
                )}
              />

              <Detail
                label="Sender"
                value={correspondence.sender}
              />

              <Detail
                label="Recipient"
                value={correspondence.recipient}
              />

              <Detail
                label="Type"
                value={
                  typeLabels[correspondence.type] ??
                  correspondence.type
                }
              />

              <Detail
                label="Created By"
                value={correspondence.createdBy.email}
              />
            </div>
          </div>

          {/* CLIENT AND MATTER */}

          <div className="card">
            <div className="card-header">
              <div>
                <h2>Client & Matter</h2>

                <p>
                  Where this correspondence belongs.
                </p>
              </div>
            </div>

            <div className="details-grid">
              <Detail
                label="Client"
                value={
                  correspondence.client ? (
                    <Link
                      href={`/dashboard/clients/${encodeURIComponent(
                        correspondence.client.id
                      )}`}
                      className="inline-link"
                    >
                      {correspondence.client.name}
                    </Link>
                  ) : (
                    "No client linked"
                  )
                }
              />

              <Detail
                label="Client Reference"
                value={
                  correspondence.client
                    ?.referenceNumber || "—"
                }
              />

              <Detail
                label="Matter"
                value={
                  correspondence.matter ? (
                    <Link
                      href={`/dashboard/matters/${encodeURIComponent(
                        correspondence.matter.id
                      )}`}
                      className="inline-link"
                    >
                      {correspondence.matter.title}
                    </Link>
                  ) : (
                    "No matter linked"
                  )
                }
              />

              <Detail
                label="Matter Reference"
                value={
                  correspondence.matter
                    ?.referenceNumber || "—"
                }
              />
            </div>
          </div>

          {/* RESPONSE MANAGEMENT */}

          <div className="card">
            <div className="card-header">
              <div>
                <h2>Response Management</h2>

                <p>
                  Track whether this correspondence
                  requires action.
                </p>
              </div>

              {overdue && (
                <span className="overdue-badge">
                  Response overdue
                </span>
              )}
            </div>

            <div className="details-grid">
              <Detail
                label="Response Required"
                value={
                  correspondence.responseRequired
                    ? "Yes"
                    : "No"
                }
              />

              <Detail
                label="Response Deadline"
                value={formatDate(
                  correspondence.responseDeadline
                )}
              />

              <Detail
                label="Current Status"
                value={
                  statusLabels[
                    correspondence.status
                  ] ?? correspondence.status
                }
              />

              <Detail
                label="Responsible Employee"
                value={
                  correspondence.responsibleUser
                    ?.email || "Not assigned"
                }
              />
            </div>

            <div className="status-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() =>
                  setShowStatusMenu(
                    (current) => !current
                  )
                }
                disabled={saving}
              >
                Change Status
              </button>

              {showStatusMenu && (
                <div className="status-menu">
                  {Object.entries(
                    statusLabels
                  ).map(([value, label]) => (
                    <button
                      type="button"
                      key={value}
                      onClick={() =>
                        void changeStatus(value)
                      }
                      disabled={
                        saving ||
                        correspondence.status ===
                          value
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {correspondence.status !==
                "ACTION_REQUIRED" &&
                correspondence.status !== "CLOSED" && (
                  <button
                    type="button"
                    className="button warning"
                    onClick={() =>
                      void changeStatus(
                        "ACTION_REQUIRED"
                      )
                    }
                    disabled={saving}
                  >
                    Mark Action Required
                  </button>
                )}

              {correspondence.status !==
                "RESPONDED" &&
                correspondence.status !== "CLOSED" && (
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() =>
                      void changeStatus("RESPONDED")
                    }
                    disabled={saving}
                  >
                    Mark Responded
                  </button>
                )}

              {correspondence.status !== "CLOSED" && (
                <button
                  type="button"
                  className="button success"
                  onClick={() =>
                    void changeStatus("CLOSED")
                  }
                  disabled={saving}
                >
                  Close Correspondence
                </button>
              )}
            </div>
          </div>

          {/* NOTES */}

          <div className="card">
            <div className="card-header">
              <div>
                <h2>Notes</h2>

                <p>
                  Internal notes relating to this
                  correspondence.
                </p>
              </div>
            </div>

            <textarea
              value={notes}
              onChange={(event) =>
                setNotes(event.target.value)
              }
              placeholder="Add internal notes..."
              rows={7}
              className="textarea"
            />

            <div className="save-row">
              <button
                type="button"
                className="button primary"
                onClick={() =>
                  void saveNotes()
                }
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : "Save Notes"}
              </button>
            </div>
          </div>

          {/* DOCUMENTS */}

          <div className="card">
            <div className="card-header">
              <div>
                <h2>Documents</h2>

                <p>
                  Documents linked to this
                  correspondence.
                </p>
              </div>

              <Link
                href="/dashboard/documents"
                className="button secondary"
              >
                Document Management
              </Link>
            </div>

            {correspondence.attachments.length ===
            0 ? (
              <div className="empty-state">
                <strong>
                  No documents linked
                </strong>

                <span>
                  Documents can be linked to this
                  correspondence from the document
                  management workflow.
                </span>
              </div>
            ) : (
              <div className="document-list">
                {correspondence.attachments.map(
                  (attachment) => (
                    <div
                      className="document-item"
                      key={attachment.id}
                    >
                      <div>
                        <strong>
                          {
                            attachment.document
                              .name
                          }
                        </strong>

                        <span>
                          {attachment.document
                            .originalName ||
                            attachment.document
                              .name}
                        </span>
                      </div>

                      <Link
                        href={`/dashboard/documents/${encodeURIComponent(
                          attachment.document.id
                        )}`}
                        className="button secondary small"
                      >
                        View
                      </Link>
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          {/* HISTORY */}

          <div className="card">
            <div className="card-header">
              <div>
                <h2>History</h2>

                <p>
                  Recorded activity relating to
                  this correspondence.
                </p>
              </div>
            </div>

            {historyLoading ? (
              <div className="history-loading">
                Loading history...
              </div>
            ) : history.length === 0 ? (
              <div className="empty-state">
                <strong>
                  No history available
                </strong>

                <span>
                  Correspondence activity will
                  appear here as actions are
                  recorded.
                </span>
              </div>
            ) : (
              <div className="timeline">
                {history.map((item) => (
                  <div
                    className="timeline-item"
                    key={item.id}
                  >
                    <div className="timeline-dot" />

                    <div className="timeline-content">
                      <div className="timeline-top">
                        <strong>
                          {item.description ||
                            `${item.action} ${item.entityType}`}
                        </strong>

                        <span>
                          {formatDateTime(
                            item.createdAt
                          )}
                        </span>
                      </div>

                      <p>
                        {item.user?.email ||
                          "System user"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* RIGHT SIDEBAR */}

        <aside className="side-column">
          <div className="card action-card">
            <h2>Actions</h2>

            <Link
              href={`/dashboard/tasks/new?correspondenceId=${encodeURIComponent(
                correspondence.id
              )}`}
              className="action-button primary-action"
            >
              <span>
                Delegate Task
              </span>

              <small>
                Assign follow-up work to an
                employee
              </small>
            </Link>

            {correspondence.status !==
              "CLOSED" && (
              <button
                type="button"
                className="action-button"
                onClick={() =>
                  void changeStatus("CLOSED")
                }
                disabled={saving}
              >
                <span>
                  Close Correspondence
                </span>

                <small>
                  Mark this correspondence as
                  completed
                </small>
              </button>
            )}

            {correspondence.status !==
              "RESPONDED" &&
              correspondence.status !==
                "CLOSED" && (
                <button
                  type="button"
                  className="action-button"
                  onClick={() =>
                    void changeStatus(
                      "RESPONDED"
                    )
                  }
                  disabled={saving}
                >
                  <span>
                    Mark Responded
                  </span>

                  <small>
                    Record that a response
                    has been sent
                  </small>
                </button>
              )}
          </div>

          {/* RESPONSIBILITY */}

          <div className="card">
            <h2>Responsibility</h2>

            <div className="person-block">
              <span className="person-label">
                Responsible Employee
              </span>

              <strong>
                {correspondence
                  .responsibleUser?.email ||
                  "Not assigned"}
              </strong>

              {correspondence
                .responsibleUser?.role && (
                <span>
                  {
                    correspondence
                      .responsibleUser.role
                  }
                </span>
              )}
            </div>

            <div className="person-block">
              <span className="person-label">
                Created By
              </span>

              <strong>
                {correspondence.createdBy.email}
              </strong>

              <span>
                {correspondence.createdBy.role}
              </span>
            </div>
          </div>

          {/* DANGER ZONE */}

          <div className="card danger-card">
            <h2>Danger Zone</h2>

            <p>
              Deleting correspondence is
              permanent and should only be used
              when the record was created
              incorrectly.
            </p>

            {!showDeleteConfirm ? (
              <button
                type="button"
                className="button danger"
                onClick={() =>
                  setShowDeleteConfirm(true)
                }
              >
                Delete Correspondence
              </button>
            ) : (
              <div className="delete-confirm">
                <strong>
                  Are you sure?
                </strong>

                <p>
                  This correspondence and its
                  linked records will be removed
                  according to the system's
                  deletion rules.
                </p>

                <div className="confirm-actions">
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() =>
                      setShowDeleteConfirm(
                        false
                      )
                    }
                    disabled={saving}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="button danger"
                    onClick={() =>
                      void deleteCorrespondence()
                    }
                    disabled={saving}
                  >
                    {saving
                      ? "Deleting..."
                      : "Yes, Delete"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      <style jsx>{`
        .page {
          min-height: 100vh;
          padding: 32px;
          background: #f7f8fa;
          color: #172033;
        }

        .topbar {
          display: flex;
          justify-content: space-between;
          gap: 24px;
          align-items: flex-end;
          margin-bottom: 28px;
        }

        .back-link,
        .inline-link {
          color: #173b2a;
          text-decoration: none;
          font-weight: 700;
        }

        .back-link:hover,
        .inline-link:hover {
          text-decoration: underline;
        }

        .eyebrow {
          margin-top: 18px;
          margin-bottom: 7px;
          color: #6b7280;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .title-row {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        h1 {
          margin: 0;
          font-size: 32px;
          line-height: 1.15;
          letter-spacing: -0.03em;
        }

        .subtitle {
          margin: 8px 0 0;
          color: #6b7280;
        }

        .top-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 330px;
          gap: 22px;
          align-items: start;
        }

        .main-column,
        .side-column {
          display: grid;
          gap: 22px;
        }

        .card,
        .loading-card,
        .error-card {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          box-shadow: 0 4px 18px rgba(15, 23, 42, 0.04);
        }

        .card {
          padding: 24px;
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          align-items: flex-start;
          margin-bottom: 22px;
        }

        .card h2 {
          margin: 0;
          font-size: 18px;
        }

        .card-header p,
        .danger-card p {
          margin: 6px 0 0;
          color: #6b7280;
          font-size: 14px;
        }

        .details-grid {
          display: grid;
          grid-template-columns: repeat(
            2,
            minmax(0, 1fr)
          );
          gap: 20px;
        }

        .detail {
          min-width: 0;
        }

        .detail-label {
          display: block;
          margin-bottom: 6px;
          color: #6b7280;
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .detail-value {
          color: #172033;
          font-size: 15px;
          font-weight: 600;
          overflow-wrap: anywhere;
        }

        .status {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 7px 11px;
          background: #eef2f7;
          color: #374151;
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }

        .status.received {
          background: #eff6ff;
          color: #1d4ed8;
        }

        .status.assigned {
          background: #f5f3ff;
          color: #6d28d9;
        }

        .status.action {
          background: #fff7ed;
          color: #c2410c;
        }

        .status.responded {
          background: #ecfdf5;
          color: #047857;
        }

        .status.closed {
          background: #f3f4f6;
          color: #4b5563;
        }

        .overdue-badge {
          padding: 7px 10px;
          border-radius: 999px;
          background: #fef2f2;
          color: #b91c1c;
          font-size: 12px;
          font-weight: 800;
        }

        .status-actions {
          position: relative;
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid #eef0f3;
        }

        .status-menu {
          position: absolute;
          top: 66px;
          left: 0;
          z-index: 10;
          min-width: 190px;
          padding: 6px;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          background: white;
          box-shadow: 0 12px 30px
            rgba(15, 23, 42, 0.12);
        }

        .status-menu button {
          display: block;
          width: 100%;
          padding: 9px 11px;
          border: 0;
          border-radius: 8px;
          background: transparent;
          text-align: left;
          cursor: pointer;
        }

        .status-menu button:hover:not(
            :disabled
          ) {
          background: #f3f4f6;
        }

        .status-menu button:disabled {
          color: #9ca3af;
          cursor: not-allowed;
        }

        .button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 40px;
          padding: 9px 14px;
          border: 1px solid transparent;
          border-radius: 10px;
          font: inherit;
          font-size: 13px;
          font-weight: 800;
          text-decoration: none;
          cursor: pointer;
          transition: 0.15s ease;
        }

        .button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .button.primary {
          background: #173b2a;
          color: white;
        }

        .button.primary:hover:not(
            :disabled
          ) {
          background: #0f2c20;
        }

        .button.secondary {
          background: white;
          color: #374151;
          border-color: #d1d5db;
        }

        .button.secondary:hover:not(
            :disabled
          ) {
          background: #f9fafb;
        }

        .button.warning {
          background: #fff7ed;
          color: #c2410c;
          border-color: #fed7aa;
        }

        .button.success {
          background: #ecfdf5;
          color: #047857;
          border-color: #a7f3d0;
        }

        .button.danger {
          background: #b91c1c;
          color: white;
        }

        .button.small {
          min-height: 34px;
          padding: 7px 10px;
        }

        .textarea {
          width: 100%;
          box-sizing: border-box;
          resize: vertical;
          padding: 13px;
          border: 1px solid #d1d5db;
          border-radius: 10px;
          font: inherit;
          line-height: 1.5;
          outline: none;
        }

        .textarea:focus {
          border-color: #173b2a;
          box-shadow: 0 0 0 3px
            rgba(23, 59, 42, 0.08);
        }

        .save-row {
          display: flex;
          justify-content: flex-end;
          margin-top: 12px;
        }

        .document-list {
          display: grid;
          gap: 10px;
        }

        .document-item {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: center;
          padding: 14px;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
        }

        .document-item > div {
          min-width: 0;
          display: grid;
          gap: 4px;
        }

        .document-item strong {
          overflow-wrap: anywhere;
        }

        .document-item span {
          color: #6b7280;
          font-size: 12px;
          overflow-wrap: anywhere;
        }

        .empty-state,
        .history-loading {
          display: grid;
          gap: 5px;
          padding: 22px;
          border: 1px dashed #d1d5db;
          border-radius: 12px;
          color: #6b7280;
          text-align: center;
        }

        .empty-state strong {
          color: #374151;
        }

        .timeline {
          display: grid;
        }

        .timeline-item {
          position: relative;
          display: grid;
          grid-template-columns: 18px 1fr;
          gap: 14px;
          min-height: 70px;
        }

        .timeline-item:not(
            :last-child
          )::before {
          content: "";
          position: absolute;
          left: 8px;
          top: 16px;
          bottom: 0;
          width: 1px;
          background: #d1d5db;
        }

        .timeline-dot {
          position: relative;
          z-index: 1;
          width: 9px;
          height: 9px;
          margin-top: 5px;
          border-radius: 50%;
          background: #173b2a;
        }

        .timeline-content {
          padding-bottom: 18px;
        }

        .timeline-top {
          display: flex;
          justify-content: space-between;
          gap: 12px;
        }

        .timeline-top strong {
          font-size: 14px;
        }

        .timeline-top span {
          flex-shrink: 0;
          color: #9ca3af;
          font-size: 12px;
        }

        .timeline-content p {
          margin: 5px 0 0;
          color: #6b7280;
          font-size: 13px;
        }

        .action-card {
          position: sticky;
          top: 20px;
        }

        .action-card h2 {
          margin-bottom: 16px;
        }

        .action-button {
          display: grid;
          gap: 4px;
          width: 100%;
          margin-top: 10px;
          padding: 14px;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          background: white;
          color: #172033;
          text-align: left;
          text-decoration: none;
          cursor: pointer;
        }

        .action-button:hover {
          border-color: #cbd5e1;
          background: #f9fafb;
        }

        .action-button span {
          font-weight: 800;
        }

        .action-button small {
          color: #6b7280;
        }

        .action-button.primary-action {
          border-color: #173b2a;
          background: #173b2a;
          color: white;
        }

        .action-button.primary-action
          small {
          color: #d1fae5;
        }

        .person-block {
          display: grid;
          gap: 4px;
          padding: 14px 0;
          border-bottom: 1px solid #eef0f3;
        }

        .person-block:last-child {
          border-bottom: 0;
          padding-bottom: 0;
        }

        .person-label {
          color: #6b7280;
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .person-block span:not(
            .person-label
          ) {
          color: #6b7280;
          font-size: 13px;
        }

        .danger-card {
          border-color: #fecaca;
        }

        .danger-card h2 {
          color: #991b1b;
        }

        .delete-confirm {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid #fee2e2;
        }

        .delete-confirm p {
          margin: 7px 0 15px;
        }

        .confirm-actions {
          display: flex;
          gap: 8px;
        }

        .alert {
          margin-bottom: 20px;
          padding: 13px 15px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 700;
        }

        .alert.error {
          background: #fef2f2;
          color: #991b1b;
          border: 1px solid #fecaca;
        }

        .alert.success {
          background: #ecfdf5;
          color: #047857;
          border: 1px solid #a7f3d0;
        }

        .loading-card,
        .error-card {
          max-width: 700px;
          margin: 80px auto;
          padding: 30px;
        }

        .error-card h1 {
          margin-bottom: 10px;
          font-size: 24px;
        }

        .error-card p {
          margin-bottom: 20px;
          color: #6b7280;
        }

        @media (max-width: 1000px) {
          .grid {
            grid-template-columns: 1fr;
          }

          .action-card {
            position: static;
          }
        }

        @media (max-width: 700px) {
          .page {
            padding: 20px;
          }

          .topbar {
            align-items: flex-start;
            flex-direction: column;
          }

          .title-row {
            align-items: flex-start;
            flex-direction: column;
          }

          h1 {
            font-size: 26px;
          }

          .details-grid {
            grid-template-columns: 1fr;
          }

          .card {
            padding: 18px;
          }

          .timeline-top {
            display: grid;
          }
        }
      `}</style>
    </main>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="detail">
      <span className="detail-label">
        {label}
      </span>

      <div className="detail-value">
        {value}
      </div>
    </div>
  );
}