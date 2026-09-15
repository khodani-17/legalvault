"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type Client = {
  id: string;
  name: string;
  referenceNumber: string;
};

type Matter = {
  id: string;
  title: string;
  referenceNumber: string;
  clientId: string;
};

type User = {
  id: string;
  email: string;
  role: string;
};

const correspondenceTypes = [
  { value: "LETTER", label: "Letter" },
  { value: "COURT_NOTICE", label: "Court Notice" },
  { value: "CLIENT_EMAIL", label: "Client Email" },
  { value: "DEMAND", label: "Demand" },
  { value: "NOTICE", label: "Notice" },
  {
    value: "OPPOSING_ATTORNEY",
    label: "Opposing Attorney",
  },
  {
    value: "CLIENT_CORRESPONDENCE",
    label: "Client Correspondence",
  },
  {
    value: "COURT_CORRESPONDENCE",
    label: "Court Correspondence",
  },
  { value: "FOLLOW_UP", label: "Follow-up" },
  { value: "OTHER", label: "Other" },
];

export default function NewCorrespondencePage() {
  const [direction, setDirection] = useState<
    "INCOMING" | "OUTGOING"
  >("INCOMING");

  const [correspondenceDate, setCorrespondenceDate] =
    useState(
      new Date().toISOString().slice(0, 10),
    );

  const [sender, setSender] = useState("");
  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [type, setType] = useState("LETTER");

  const [clientId, setClientId] = useState("");
  const [matterId, setMatterId] = useState("");
  const [responsibleUserId, setResponsibleUserId] =
    useState("");

  const [responseRequired, setResponseRequired] =
    useState(false);

  const [responseDeadline, setResponseDeadline] =
    useState("");

  const [notes, setNotes] = useState("");

  const [clients, setClients] = useState<Client[]>([]);
  const [matters, setMatters] = useState<Matter[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [loadingData, setLoadingData] =
    useState(true);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [success, setSuccess] =
    useState(false);

  /*
   * Load clients, matters and employees.
   *
   * These use existing LegalVault endpoints.
   */
  useEffect(() => {
    async function loadFormData() {
      try {
        setLoadingData(true);
        setError("");

        const [
          clientsResponse,
          mattersResponse,
          usersResponse,
        ] = await Promise.all([
          fetch("/api/clients", {
            cache: "no-store",
          }),

          fetch("/api/matters", {
            cache: "no-store",
          }),

          fetch("/api/users", {
            cache: "no-store",
          }),
        ]);

        const [
          clientsData,
          mattersData,
          usersData,
        ] = await Promise.all([
          clientsResponse.json(),
          mattersResponse.json(),
          usersResponse.json(),
        ]);

        if (!clientsResponse.ok) {
          throw new Error(
            clientsData?.error ||
              "Failed to load clients.",
          );
        }

        if (!mattersResponse.ok) {
          throw new Error(
            mattersData?.error ||
              "Failed to load matters.",
          );
        }

        if (!usersResponse.ok) {
          throw new Error(
            usersData?.error ||
              "Failed to load employees.",
          );
        }

        setClients(
          clientsData.clients ||
            clientsData.data ||
            [],
        );

        setMatters(
          mattersData.matters ||
            mattersData.data ||
            [],
        );

        setUsers(
          usersData.users ||
            usersData.data ||
            [],
        );
      } catch (err) {
        console.error(err);

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load form data.",
        );
      } finally {
        setLoadingData(false);
      }
    }

    loadFormData();
  }, []);

  /*
   * When a client is selected, clear a matter
   * that belongs to a different client.
   */
  useEffect(() => {
    if (!clientId || !matterId) {
      return;
    }

    const selectedMatter = matters.find(
      (matter) => matter.id === matterId,
    );

    if (
      selectedMatter &&
      selectedMatter.clientId !== clientId
    ) {
      setMatterId("");
    }
  }, [clientId, matterId, matters]);

  const availableMatters = clientId
    ? matters.filter(
        (matter) =>
          matter.clientId === clientId,
      )
    : matters;

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setSuccess(false);

    if (!sender.trim()) {
      setError("Please enter the sender.");
      return;
    }

    if (!recipient.trim()) {
      setError("Please enter the recipient.");
      return;
    }

    if (!subject.trim()) {
      setError("Please enter the subject.");
      return;
    }

    if (
      responseRequired &&
      !responseDeadline
    ) {
      setError(
        "Please provide a response deadline.",
      );
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(
        "/api/correspondence",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            direction,
            correspondenceDate,
            sender: sender.trim(),
            recipient: recipient.trim(),
            subject: subject.trim(),
            type,
            clientId: clientId || null,
            matterId: matterId || null,
            responsibleUserId:
              responsibleUserId || null,
            responseRequired,
            responseDeadline:
              responseRequired
                ? responseDeadline
                : null,
            notes:
              notes.trim() || null,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Failed to create correspondence.",
        );
      }

      setSuccess(true);

      /*
       * Return to the Correspondence Centre
       * after successful creation.
       */
      window.location.href =
        "/dashboard/correspondence";
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to create correspondence.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="new-correspondence-page">
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            LegalVault / Correspondence / New
          </div>

          <h1>New Correspondence</h1>

          <p>
            Capture and assign incoming or
            outgoing legal correspondence.
          </p>
        </div>

        <Link
          href="/dashboard/correspondence"
          className="secondary-button"
        >
          ← Back to Correspondence
        </Link>
      </div>

      {error && (
        <div className="error-banner">
          <strong>Unable to save.</strong>

          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="success-banner">
          Correspondence created successfully.
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="form-card"
      >
        <section className="form-section">
          <div className="section-heading">
            <h2>Correspondence Details</h2>

            <p>
              Record the basic details of the
              correspondence.
            </p>
          </div>

          <div className="direction-selector">
            <button
              type="button"
              onClick={() =>
                setDirection("INCOMING")
              }
              className={
                direction === "INCOMING"
                  ? "direction-option active"
                  : "direction-option"
              }
            >
              <span className="direction-icon">
                ↓
              </span>

              <span>
                <strong>Incoming</strong>
                <small>
                  Received by the firm
                </small>
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                setDirection("OUTGOING")
              }
              className={
                direction === "OUTGOING"
                  ? "direction-option active"
                  : "direction-option"
              }
            >
              <span className="direction-icon">
                ↑
              </span>

              <span>
                <strong>Outgoing</strong>
                <small>
                  Sent by the firm
                </small>
              </span>
            </button>
          </div>

          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="correspondenceDate">
                Date
              </label>

              <input
                id="correspondenceDate"
                type="date"
                value={correspondenceDate}
                onChange={(event) =>
                  setCorrespondenceDate(
                    event.target.value,
                  )
                }
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="type">
                Correspondence Type
              </label>

              <select
                id="type"
                value={type}
                onChange={(event) =>
                  setType(event.target.value)
                }
                required
              >
                {correspondenceTypes.map(
                  (item) => (
                    <option
                      key={item.value}
                      value={item.value}
                    >
                      {item.label}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="sender">
                Sender
              </label>

              <input
                id="sender"
                value={sender}
                onChange={(event) =>
                  setSender(event.target.value)
                }
                placeholder="Person, firm, court or organisation"
                maxLength={500}
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="recipient">
                Recipient
              </label>

              <input
                id="recipient"
                value={recipient}
                onChange={(event) =>
                  setRecipient(
                    event.target.value,
                  )
                }
                placeholder="Person, firm, court or organisation"
                maxLength={500}
                required
              />
            </div>

            <div className="form-field full-width">
              <label htmlFor="subject">
                Subject
              </label>

              <input
                id="subject"
                value={subject}
                onChange={(event) =>
                  setSubject(
                    event.target.value,
                  )
                }
                placeholder="Enter the correspondence subject"
                maxLength={1000}
                required
              />
            </div>
          </div>
        </section>

        <section className="form-section">
          <div className="section-heading">
            <h2>Client & Matter</h2>

            <p>
              Link the correspondence to the
              relevant client file and matter.
            </p>
          </div>

          {loadingData ? (
            <div className="loading-message">
              Loading clients and matters...
            </div>
          ) : (
            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="client">
                  Client
                </label>

                <select
                  id="client"
                  value={clientId}
                  onChange={(event) => {
                    setClientId(
                      event.target.value,
                    );
                    setMatterId("");
                  }}
                >
                  <option value="">
                    No client selected
                  </option>

                  {clients.map((client) => (
                    <option
                      key={client.id}
                      value={client.id}
                    >
                      {client.referenceNumber} —{" "}
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label htmlFor="matter">
                  Matter
                </label>

                <select
                  id="matter"
                  value={matterId}
                  onChange={(event) =>
                    setMatterId(
                      event.target.value,
                    )
                  }
                >
                  <option value="">
                    No matter selected
                  </option>

                  {availableMatters.map(
                    (matter) => (
                      <option
                        key={matter.id}
                        value={matter.id}
                      >
                        {matter.referenceNumber} —{" "}
                        {matter.title}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </div>
          )}
        </section>

        <section className="form-section">
          <div className="section-heading">
            <h2>Responsibility</h2>

            <p>
              Assign an employee responsible for
              dealing with this correspondence.
            </p>
          </div>

          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="responsibleUser">
                Responsible Employee
              </label>

              <select
                id="responsibleUser"
                value={responsibleUserId}
                onChange={(event) =>
                  setResponsibleUserId(
                    event.target.value,
                  )
                }
                disabled={loadingData}
              >
                <option value="">
                  Unassigned
                </option>

                {users.map((user) => (
                  <option
                    key={user.id}
                    value={user.id}
                  >
                    {user.email} — {user.role}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="form-section">
          <div className="section-heading">
            <h2>Response Tracking</h2>

            <p>
              Track correspondence that requires
              a response.
            </p>
          </div>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={responseRequired}
              onChange={(event) => {
                setResponseRequired(
                  event.target.checked,
                );

                if (
                  !event.target.checked
                ) {
                  setResponseDeadline("");
                }
              }}
            />

            <span>
              <strong>
                Response required
              </strong>

              <small>
                This correspondence requires
                follow-up or a formal response.
              </small>
            </span>
          </label>

          {responseRequired && (
            <div className="form-grid deadline-grid">
              <div className="form-field">
                <label htmlFor="responseDeadline">
                  Response Deadline
                </label>

                <input
                  id="responseDeadline"
                  type="datetime-local"
                  value={responseDeadline}
                  onChange={(event) =>
                    setResponseDeadline(
                      event.target.value,
                    )
                  }
                  required
                />
              </div>
            </div>
          )}
        </section>

        <section className="form-section">
          <div className="section-heading">
            <h2>Notes</h2>

            <p>
              Add any relevant instructions or
              background information.
            </p>
          </div>

          <div className="form-field">
            <label htmlFor="notes">
              Internal Notes
            </label>

            <textarea
              id="notes"
              value={notes}
              onChange={(event) =>
                setNotes(event.target.value)
              }
              placeholder="Add internal notes..."
              rows={6}
              maxLength={10000}
            />

            <div className="character-count">
              {notes.length} / 10,000
            </div>
          </div>
        </section>

        <div className="form-actions">
          <Link
            href="/dashboard/correspondence"
            className="cancel-button"
          >
            Cancel
          </Link>

          <button
            type="submit"
            className="primary-button"
            disabled={saving}
          >
            {saving
              ? "Saving..."
              : "Save Correspondence"}
          </button>
        </div>
      </form>

      <style jsx>{`
        .new-correspondence-page {
          max-width: 1100px;
          margin: 0 auto;
          padding: 32px;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
          margin-bottom: 28px;
        }

        .breadcrumb {
          margin-bottom: 8px;
          color: #64748b;
          font-size: 13px;
        }

        h1 {
          margin: 0;
          color: #172033;
          font-size: 30px;
        }

        .page-header p {
          margin: 8px 0 0;
          color: #64748b;
          font-size: 15px;
        }

        .secondary-button,
        .cancel-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 40px;
          padding: 0 15px;
          border-radius: 8px;
          text-decoration: none;
          font-size: 13px;
          font-weight: 600;
        }

        .secondary-button {
          border: 1px solid #cbd5e1;
          color: #334155;
          background: white;
        }

        .cancel-button {
          border: 1px solid #cbd5e1;
          color: #475569;
          background: white;
        }

        .primary-button {
          min-height: 42px;
          padding: 0 18px;
          border-radius: 8px;
          border: 1px solid #173b2a;
          background: #173b2a;
          color: white;
          font-weight: 600;
          cursor: pointer;
        }

        .primary-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .form-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          overflow: hidden;
        }

        .form-section {
          padding: 26px;
          border-bottom: 1px solid #e2e8f0;
        }

        .section-heading {
          margin-bottom: 20px;
        }

        .section-heading h2 {
          margin: 0;
          color: #172033;
          font-size: 18px;
        }

        .section-heading p {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 13px;
        }

        .direction-selector {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 22px;
        }

        .direction-option {
          display: flex;
          align-items: center;
          gap: 13px;
          text-align: left;
          padding: 15px;
          border: 1px solid #cbd5e1;
          background: white;
          border-radius: 9px;
          cursor: pointer;
        }

        .direction-option.active {
          border-color: #173b2a;
          background: #f3f8f5;
          box-shadow:
            0 0 0 2px
              rgba(23, 59, 42, 0.08);
        }

        .direction-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background: #eef4f0;
          color: #173b2a;
          font-size: 20px;
          font-weight: 700;
        }

        .direction-option strong {
          display: block;
          color: #172033;
          font-size: 14px;
        }

        .direction-option small {
          display: block;
          margin-top: 3px;
          color: #64748b;
          font-size: 11px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
        }

        .deadline-grid {
          margin-top: 18px;
        }

        .form-field {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .full-width {
          grid-column: 1 / -1;
        }

        .form-field label {
          color: #334155;
          font-size: 13px;
          font-weight: 650;
        }

        .form-field input,
        .form-field select,
        .form-field textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          background: white;
          color: #172033;
          font-family: inherit;
          font-size: 13px;
          outline: none;
        }

        .form-field input,
        .form-field select {
          height: 42px;
          padding: 0 11px;
        }

        .form-field textarea {
          padding: 11px;
          resize: vertical;
        }

        .form-field input:focus,
        .form-field select:focus,
        .form-field textarea:focus {
          border-color: #173b2a;
          box-shadow:
            0 0 0 3px
              rgba(23, 59, 42, 0.08);
        }

        .checkbox-row {
          display: flex;
          align-items: flex-start;
          gap: 11px;
          padding: 15px;
          border: 1px solid #e2e8f0;
          border-radius: 9px;
          cursor: pointer;
        }

        .checkbox-row input {
          margin-top: 3px;
          width: 16px;
          height: 16px;
          accent-color: #173b2a;
        }

        .checkbox-row strong {
          display: block;
          color: #334155;
          font-size: 13px;
        }

        .checkbox-row small {
          display: block;
          margin-top: 3px;
          color: #64748b;
          font-size: 11px;
        }

        .character-count {
          text-align: right;
          color: #94a3b8;
          font-size: 11px;
        }

        .loading-message {
          padding: 20px;
          border-radius: 8px;
          background: #f8fafc;
          color: #64748b;
          font-size: 13px;
        }

        .error-banner,
        .success-banner {
          margin-bottom: 20px;
          padding: 14px 16px;
          border-radius: 8px;
          font-size: 13px;
        }

        .error-banner {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          border: 1px solid #fecaca;
          background: #fef2f2;
          color: #991b1b;
        }

        .success-banner {
          border: 1px solid #bbf7d0;
          background: #f0fdf4;
          color: #166534;
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          padding: 20px 26px;
          background: #f8fafc;
        }

        @media (max-width: 700px) {
          .new-correspondence-page {
            padding: 20px;
          }

          .page-header {
            flex-direction: column;
          }

          .direction-selector,
          .form-grid {
            grid-template-columns: 1fr;
          }

          .full-width {
            grid-column: auto;
          }
        }
      `}</style>
    </main>
  );
}