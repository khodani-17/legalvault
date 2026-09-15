"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Correspondence = {
  id: string;
  direction: "INCOMING" | "OUTGOING";
  correspondenceDate: string;
  sender: string;
  recipient: string;
  subject: string;
  type: string;
  status:
    | "RECEIVED"
    | "ASSIGNED"
    | "ACTION_REQUIRED"
    | "RESPONDED"
    | "CLOSED";
  responseRequired: boolean;
  responseDeadline: string | null;
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
  _count?: {
    attachments: number;
  };
};

type Filter =
  | "ALL"
  | "INCOMING"
  | "OUTGOING"
  | "ACTION_REQUIRED"
  | "AWAITING_RESPONSE"
  | "OVERDUE"
  | "CLOSED";

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
  FOLLOW_UP: "Follow-up",
  OTHER: "Other",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function isOverdue(item: Correspondence) {
  if (!item.responseRequired || !item.responseDeadline) {
    return false;
  }

  if (
    item.status === "RESPONDED" ||
    item.status === "CLOSED"
  ) {
    return false;
  }

  return new Date(item.responseDeadline) < new Date();
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

export default function CorrespondenceCentre() {
  const [items, setItems] = useState<Correspondence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [search, setSearch] = useState("");

  async function loadCorrespondence() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/correspondence", {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Failed to load correspondence.",
        );
      }

      /*
       * The API returns:
       *
       * {
       *   correspondences: [...]
       * }
       *
       * Make sure the frontend reads the plural
       * property name.
       */
      setItems(data.correspondences || []);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load correspondence.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCorrespondence();
  }, []);

  const statistics = useMemo(() => {
    const incoming = items.filter(
      (item) => item.direction === "INCOMING",
    ).length;

    const outgoing = items.filter(
      (item) => item.direction === "OUTGOING",
    ).length;

    const actionRequired = items.filter(
      (item) => item.status === "ACTION_REQUIRED",
    ).length;

    const awaitingResponse = items.filter(
      (item) =>
        item.responseRequired &&
        item.status !== "RESPONDED" &&
        item.status !== "CLOSED",
    ).length;

    const overdue = items.filter((item) =>
      isOverdue(item),
    ).length;

    const closed = items.filter(
      (item) => item.status === "CLOSED",
    ).length;

    return {
      incoming,
      outgoing,
      actionRequired,
      awaitingResponse,
      overdue,
      closed,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    let result = [...items];

    switch (filter) {
      case "INCOMING":
        result = result.filter(
          (item) => item.direction === "INCOMING",
        );
        break;

      case "OUTGOING":
        result = result.filter(
          (item) => item.direction === "OUTGOING",
        );
        break;

      case "ACTION_REQUIRED":
        result = result.filter(
          (item) => item.status === "ACTION_REQUIRED",
        );
        break;

      case "AWAITING_RESPONSE":
        result = result.filter(
          (item) =>
            item.responseRequired &&
            item.status !== "RESPONDED" &&
            item.status !== "CLOSED",
        );
        break;

      case "OVERDUE":
        result = result.filter((item) =>
          isOverdue(item),
        );
        break;

      case "CLOSED":
        result = result.filter(
          (item) => item.status === "CLOSED",
        );
        break;

      default:
        break;
    }

    const query = search.trim().toLowerCase();

    if (query) {
      result = result.filter((item) => {
        return (
          item.subject
            .toLowerCase()
            .includes(query) ||
          item.sender
            .toLowerCase()
            .includes(query) ||
          item.recipient
            .toLowerCase()
            .includes(query) ||
          item.client?.name
            ?.toLowerCase()
            .includes(query) ||
          item.matter?.title
            ?.toLowerCase()
            .includes(query) ||
          item.matter?.referenceNumber
            ?.toLowerCase()
            .includes(query)
        );
      });
    }

    return result;
  }, [items, filter, search]);

  return (
    <main className="correspondence-page">
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            LegalVault / Correspondence
          </div>

          <h1>Correspondence Centre</h1>

          <p>
            Capture, assign, track and manage
            legal correspondence across the firm.
          </p>
        </div>

        <Link
          href="/dashboard/correspondence/new"
          className="primary-button"
        >
          + New Correspondence
        </Link>
      </div>

      {error && (
        <div className="error-banner">
          <strong>
            Unable to load correspondence.
          </strong>

          <span>{error}</span>

          <button
            onClick={loadCorrespondence}
            className="retry-button"
          >
            Retry
          </button>
        </div>
      )}

      <section className="summary-grid">
        <button
          className="summary-card"
          onClick={() => setFilter("INCOMING")}
        >
          <span className="summary-label">
            Incoming
          </span>

          <strong>{statistics.incoming}</strong>

          <span className="summary-description">
            Received by the firm
          </span>
        </button>

        <button
          className="summary-card"
          onClick={() => setFilter("OUTGOING")}
        >
          <span className="summary-label">
            Outgoing
          </span>

          <strong>{statistics.outgoing}</strong>

          <span className="summary-description">
            Sent by the firm
          </span>
        </button>

        <button
          className="summary-card"
          onClick={() =>
            setFilter("ACTION_REQUIRED")
          }
        >
          <span className="summary-label">
            Action Required
          </span>

          <strong>
            {statistics.actionRequired}
          </strong>

          <span className="summary-description">
            Requires employee action
          </span>
        </button>

        <button
          className="summary-card"
          onClick={() =>
            setFilter("AWAITING_RESPONSE")
          }
        >
          <span className="summary-label">
            Awaiting Response
          </span>

          <strong>
            {statistics.awaitingResponse}
          </strong>

          <span className="summary-description">
            Response still outstanding
          </span>
        </button>

        <button
          className="summary-card overdue-card"
          onClick={() => setFilter("OVERDUE")}
        >
          <span className="summary-label">
            Overdue
          </span>

          <strong>
            {statistics.overdue}
          </strong>

          <span className="summary-description">
            Response deadline passed
          </span>
        </button>

        <button
          className="summary-card"
          onClick={() => setFilter("CLOSED")}
        >
          <span className="summary-label">
            Closed
          </span>

          <strong>{statistics.closed}</strong>

          <span className="summary-description">
            Completed correspondence
          </span>
        </button>
      </section>

      <section className="workspace-card">
        <div className="toolbar">
          <div className="filter-group">
            {(
              [
                ["ALL", "All"],
                ["INCOMING", "Incoming"],
                ["OUTGOING", "Outgoing"],
                [
                  "ACTION_REQUIRED",
                  "Action Required",
                ],
                [
                  "AWAITING_RESPONSE",
                  "Awaiting Response",
                ],
                ["OVERDUE", "Overdue"],
                ["CLOSED", "Closed"],
              ] as [Filter, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={
                  filter === value
                    ? "filter-button active"
                    : "filter-button"
                }
              >
                {label}
              </button>
            ))}
          </div>

          <div className="search-container">
            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search correspondence..."
              aria-label="Search correspondence"
            />
          </div>
        </div>

        <div className="table-header">
          <div>
            <h2>Correspondence</h2>

            <span>
              {filteredItems.length} record
              {filteredItems.length === 1
                ? ""
                : "s"}
            </span>
          </div>

          {filter !== "ALL" && (
            <button
              className="clear-filter"
              onClick={() => setFilter("ALL")}
            >
              Clear filter
            </button>
          )}
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="loading-spinner" />

            <p>
              Loading correspondence...
            </p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              ✉
            </div>

            <h3>
              No correspondence found
            </h3>

            <p>
              {search || filter !== "ALL"
                ? "Try changing your search or filter."
                : "Start by capturing your first correspondence."}
            </p>

            {!search &&
              filter === "ALL" && (
                <Link
                  href="/dashboard/correspondence/new"
                  className="primary-button"
                >
                  + New Correspondence
                </Link>
              )}
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Direction</th>
                  <th>Correspondence</th>
                  <th>Client / Matter</th>
                  <th>Responsible</th>
                  <th>Response</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {filteredItems.map((item) => {
                  const overdue = isOverdue(item);

                  return (
                    <tr key={item.id}>
                      <td>
                        <Link
                          href={`/dashboard/correspondence/${item.id}`}
                          className="date-link"
                        >
                          {formatDate(
                            item.correspondenceDate,
                          )}
                        </Link>
                      </td>

                      <td>
                        <span
                          className={
                            item.direction ===
                            "INCOMING"
                              ? "direction incoming"
                              : "direction outgoing"
                          }
                        >
                          {item.direction ===
                          "INCOMING"
                            ? "Incoming"
                            : "Outgoing"}
                        </span>
                      </td>

                      <td>
                        <Link
                          href={`/dashboard/correspondence/${item.id}`}
                          className="subject-link"
                        >
                          {item.subject}
                        </Link>

                        <div className="correspondence-meta">
                          <span>
                            {typeLabels[item.type] ||
                              item.type}
                          </span>

                          <span>
                            From: {item.sender}
                          </span>

                          {item._count?.attachments ? (
                            <span>
                              {item._count.attachments}{" "}
                              attachment
                              {item._count.attachments ===
                              1
                                ? ""
                                : "s"}
                            </span>
                          ) : null}
                        </div>
                      </td>

                      <td>
                        {item.client ? (
                          <div>
                            <strong>
                              {item.client.name}
                            </strong>

                            {item.matter && (
                              <div className="matter-text">
                                {
                                  item.matter
                                    .referenceNumber
                                }
                                {" — "}
                                {
                                  item.matter.title
                                }
                              </div>
                            )}
                          </div>
                        ) : item.matter ? (
                          <div>
                            <strong>
                              {
                                item.matter
                                  .referenceNumber
                              }
                            </strong>

                            <div className="matter-text">
                              {item.matter.title}
                            </div>
                          </div>
                        ) : (
                          <span className="muted">
                            Not linked
                          </span>
                        )}
                      </td>

                      <td>
                        {item.responsibleUser ? (
                          <div>
                            <strong>
                              {
                                item
                                  .responsibleUser
                                  .email
                              }
                            </strong>

                            <div className="role-text">
                              {
                                item
                                  .responsibleUser
                                  .role
                              }
                            </div>
                          </div>
                        ) : (
                          <span className="unassigned">
                            Unassigned
                          </span>
                        )}
                      </td>

                      <td>
                        {item.responseRequired ? (
                          <div
                            className={
                              overdue
                                ? "response overdue"
                                : "response"
                            }
                          >
                            <strong>
                              Required
                            </strong>

                            {item.responseDeadline && (
                              <span>
                                {formatDate(
                                  item.responseDeadline,
                                )}
                              </span>
                            )}

                            {overdue && (
                              <small>
                                Overdue
                              </small>
                            )}
                          </div>
                        ) : (
                          <span className="muted">
                            Not required
                          </span>
                        )}
                      </td>

                      <td>
                        <span
                          className={getStatusClass(
                            item.status,
                          )}
                        >
                          {
                            statusLabels[
                              item.status
                            ]
                          }
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <style jsx>{`
        .correspondence-page {
          padding: 32px;
          max-width: 1600px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 28px;
        }

        .breadcrumb {
          font-size: 13px;
          color: #64748b;
          margin-bottom: 8px;
        }

        .page-header h1 {
          margin: 0;
          font-size: 30px;
          font-weight: 700;
          color: #172033;
        }

        .page-header p {
          margin: 8px 0 0;
          color: #64748b;
          font-size: 15px;
        }

        .primary-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 42px;
          padding: 0 18px;
          border-radius: 8px;
          background: #173b2a;
          color: white;
          text-decoration: none;
          border: 1px solid #173b2a;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
        }

        .primary-button:hover {
          background: #0f2d20;
        }

        .summary-grid {
          display: grid;
          grid-template-columns:
            repeat(6, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 24px;
        }

        .summary-card {
          appearance: none;
          text-align: left;
          border: 1px solid #e2e8f0;
          background: white;
          border-radius: 12px;
          padding: 18px;
          cursor: pointer;
          min-height: 130px;
          transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease;
        }

        .summary-card:hover {
          border-color: #94a3b8;
          box-shadow:
            0 4px 14px
              rgba(15, 23, 42, 0.07);
        }

        .summary-card strong {
          display: block;
          margin-top: 8px;
          font-size: 28px;
          color: #172033;
        }

        .summary-label {
          display: block;
          color: #475569;
          font-size: 13px;
          font-weight: 600;
        }

        .summary-description {
          display: block;
          margin-top: 6px;
          color: #94a3b8;
          font-size: 12px;
        }

        .overdue-card {
          border-color: #fecaca;
        }

        .overdue-card strong {
          color: #b91c1c;
        }

        .workspace-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          overflow: hidden;
        }

        .toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 16px;
          border-bottom: 1px solid #e2e8f0;
        }

        .filter-group {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .filter-button {
          border: 1px solid transparent;
          background: transparent;
          color: #64748b;
          border-radius: 7px;
          padding: 8px 11px;
          font-size: 13px;
          cursor: pointer;
        }

        .filter-button:hover {
          background: #f8fafc;
          color: #334155;
        }

        .filter-button.active {
          background: #eef4f0;
          color: #173b2a;
          border-color: #d6e4dc;
          font-weight: 600;
        }

        .search-container input {
          width: 280px;
          height: 40px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 0 12px;
          outline: none;
          font-size: 13px;
        }

        .search-container input:focus {
          border-color: #173b2a;
          box-shadow:
            0 0 0 3px
              rgba(23, 59, 42, 0.08);
        }

        .table-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 18px 14px;
        }

        .table-header h2 {
          margin: 0;
          color: #172033;
          font-size: 18px;
        }

        .table-header span {
          color: #94a3b8;
          font-size: 12px;
        }

        .clear-filter {
          background: transparent;
          border: none;
          color: #173b2a;
          font-weight: 600;
          cursor: pointer;
        }

        .table-wrapper {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1150px;
        }

        th {
          text-align: left;
          padding: 12px 18px;
          background: #f8fafc;
          border-top: 1px solid #e2e8f0;
          border-bottom: 1px solid #e2e8f0;
          color: #64748b;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        td {
          padding: 16px 18px;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: top;
          color: #334155;
          font-size: 13px;
        }

        tbody tr:hover {
          background: #fcfdfc;
        }

        .date-link,
        .subject-link {
          text-decoration: none;
        }

        .date-link {
          color: #475569;
          white-space: nowrap;
        }

        .subject-link {
          color: #173b2a;
          font-weight: 650;
        }

        .subject-link:hover {
          text-decoration: underline;
        }

        .correspondence-meta {
          display: flex;
          flex-direction: column;
          gap: 3px;
          margin-top: 5px;
          color: #94a3b8;
          font-size: 11px;
        }

        .direction {
          display: inline-flex;
          padding: 5px 8px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
        }

        .direction.incoming {
          background: #eff6ff;
          color: #1d4ed8;
        }

        .direction.outgoing {
          background: #f0fdf4;
          color: #15803d;
        }

        .matter-text {
          color: #64748b;
          margin-top: 4px;
          font-size: 11px;
          max-width: 240px;
        }

        .role-text {
          color: #94a3b8;
          font-size: 10px;
          margin-top: 3px;
        }

        .response {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .response strong {
          color: #475569;
          font-size: 12px;
        }

        .response span {
          color: #64748b;
          font-size: 11px;
        }

        .response small {
          color: #b91c1c;
          font-weight: 700;
          font-size: 10px;
        }

        .response.overdue strong {
          color: #b91c1c;
        }

        .muted {
          color: #94a3b8;
        }

        .unassigned {
          color: #b45309;
          font-weight: 600;
        }

        .status {
          display: inline-flex;
          white-space: nowrap;
          padding: 5px 8px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          background: #f1f5f9;
          color: #475569;
        }

        .status.received {
          background: #eff6ff;
          color: #1d4ed8;
        }

        .status.assigned {
          background: #fefce8;
          color: #a16207;
        }

        .status.action {
          background: #fff7ed;
          color: #c2410c;
        }

        .status.responded {
          background: #f0fdf4;
          color: #15803d;
        }

        .status.closed {
          background: #f1f5f9;
          color: #475569;
        }

        .error-banner {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 20px;
          padding: 14px 16px;
          border: 1px solid #fecaca;
          background: #fef2f2;
          border-radius: 9px;
          color: #991b1b;
          font-size: 13px;
        }

        .retry-button {
          border: 1px solid #fca5a5;
          background: white;
          color: #991b1b;
          border-radius: 6px;
          padding: 6px 10px;
          cursor: pointer;
          font-weight: 600;
        }

        .empty-state {
          min-height: 300px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          text-align: center;
          padding: 40px;
          color: #64748b;
        }

        .empty-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: #eef4f0;
          color: #173b2a;
          font-size: 24px;
          margin-bottom: 14px;
        }

        .empty-state h3 {
          margin: 0;
          color: #334155;
          font-size: 17px;
        }

        .empty-state p {
          margin: 7px 0 18px;
          font-size: 13px;
        }

        .loading-spinner {
          width: 28px;
          height: 28px;
          border: 3px solid #e2e8f0;
          border-top-color: #173b2a;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin-bottom: 12px;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1200px) {
          .summary-grid {
            grid-template-columns:
              repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 800px) {
          .correspondence-page {
            padding: 20px;
          }

          .page-header {
            flex-direction: column;
          }

          .summary-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .toolbar {
            align-items: stretch;
            flex-direction: column;
          }

          .search-container input {
            width: 100%;
          }
        }

        @media (max-width: 520px) {
          .summary-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}