"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type User = {
  id: string;
  name: string | null;
  email: string;
  role: string;
};

type Client = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
};

type IntakeResponse = {
  success?: boolean;
  message?: string;
  intake?: {
    id: string;
  };
  error?: string;
};

const PRACTICE_AREAS = [
  "Civil Litigation",
  "Criminal Law",
  "Family Law",
  "Labour Law",
  "Commercial Law",
  "Corporate Law",
  "Property Law",
  "Conveyancing",
  "Immigration Law",
  "Personal Injury",
  "Medical Negligence",
  "Debt Collection",
  "Insolvency",
  "Estates and Wills",
  "Tax Law",
  "Environmental Law",
  "Administrative Law",
  "Constitutional Law",
  "Other",
];

const SOURCES = [
  "Website Enquiry",
  "Telephone",
  "Email",
  "Walk-in",
  "Referral",
  "Existing Client",
  "Social Media",
  "Other",
];

const ROLES_ALLOWED_TO_CREATE = [
  "SUPER_ADMIN",
  "MANAGING_PARTNER",
  "PARTNER",
  "DIRECTOR",
  "ATTORNEY",
  "CANDIDATE_ATTORNEY",
  "PARALEGAL",
  "LEGAL_SECRETARY",
  "ADMIN",
];

export default function NewLegalIntakePage() {
  const [prospectiveClientName, setProspectiveClientName] = useState("");
  const [clientId, setClientId] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [practiceArea, setPracticeArea] = useState("");
  const [description, setDescription] = useState("");

  const [opposingParties, setOpposingParties] = useState<string[]>([""]);
  const [relatedParties, setRelatedParties] = useState<string[]>([""]);

  const [source, setSource] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [assignedToId, setAssignedToId] = useState("");
  const [conflictCheckRequired, setConflictCheckRequired] = useState(true);

  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    loadClients();
    loadUsers();
  }, []);

  async function loadClients() {
    try {
      setLoadingClients(true);

      const response = await fetch("/api/clients", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Unable to load existing clients.");
      }

      const data = await response.json();

      const possibleClients =
        data.clients ??
        data.data ??
        (Array.isArray(data) ? data : []);

      setClients(
        possibleClients.map((client: any) => ({
          id: client.id,
          name:
            client.name ??
            client.fullName ??
            client.clientName ??
            "Unnamed Client",
          email: client.email ?? null,
          phone: client.phone ?? null,
        }))
      );
    } catch (err) {
      console.error("Failed to load clients:", err);
      setClients([]);
    } finally {
      setLoadingClients(false);
    }
  }

  async function loadUsers() {
    try {
      setLoadingUsers(true);

      const response = await fetch("/api/users", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Unable to load staff members.");
      }

      const data = await response.json();

      const possibleUsers =
        data.users ??
        data.data ??
        (Array.isArray(data) ? data : []);

      setUsers(
        possibleUsers
          .filter((user: User) =>
            ROLES_ALLOWED_TO_CREATE.includes(user.role)
          )
          .map((user: User) => ({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          }))
      );
    } catch (err) {
      console.error("Failed to load users:", err);
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }

  function updateOpposingParty(index: number, value: string) {
    setOpposingParties((current) =>
      current.map((party, partyIndex) =>
        partyIndex === index ? value : party
      )
    );
  }

  function addOpposingParty() {
    setOpposingParties((current) => [...current, ""]);
  }

  function removeOpposingParty(index: number) {
    setOpposingParties((current) => {
      if (current.length === 1) {
        return [""];
      }

      return current.filter((_, partyIndex) => partyIndex !== index);
    });
  }

  function updateRelatedParty(index: number, value: string) {
    setRelatedParties((current) =>
      current.map((party, partyIndex) =>
        partyIndex === index ? value : party
      )
    );
  }

  function addRelatedParty() {
    setRelatedParties((current) => [...current, ""]);
  }

  function removeRelatedParty(index: number) {
    setRelatedParties((current) => {
      if (current.length === 1) {
        return [""];
      }

      return current.filter((_, partyIndex) => partyIndex !== index);
    });
  }

  function selectExistingClient(value: string) {
    setClientId(value);

    if (!value) {
      return;
    }

    const selectedClient = clients.find((client) => client.id === value);

    if (!selectedClient) {
      return;
    }

    if (!prospectiveClientName.trim()) {
      setProspectiveClientName(selectedClient.name);
    }

    if (!email.trim() && selectedClient.email) {
      setEmail(selectedClient.email);
    }

    if (!phone.trim() && selectedClient.phone) {
      setPhone(selectedClient.phone);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccessMessage("");

    if (!prospectiveClientName.trim()) {
      setError("Please enter the prospective client's name.");
      return;
    }

    if (email.trim()) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailPattern.test(email.trim())) {
        setError("Please enter a valid email address.");
        return;
      }
    }

    const cleanedOpposingParties = opposingParties
      .map((party) => party.trim())
      .filter(Boolean);

    const cleanedRelatedParties = relatedParties
      .map((party) => party.trim())
      .filter(Boolean);

    if (conflictCheckRequired && cleanedOpposingParties.length === 0) {
      setError(
        "Please enter at least one opposing party when conflict checking is required."
      );
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch("/api/intake", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prospectiveClientName: prospectiveClientName.trim(),
          clientId: clientId || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
          practiceArea: practiceArea || null,
          description: description.trim() || null,
          opposingParties: cleanedOpposingParties,
          relatedParties: cleanedRelatedParties,
          source: source || null,
          priority,
          conflictCheckRequired,
          assignedToId: assignedToId || null,
        }),
      });

      const data: IntakeResponse = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            data.error ||
            "The legal intake could not be created."
        );
      }

      if (!data.success && !data.intake?.id) {
        throw new Error(
          data.message ||
            data.error ||
            "The legal intake could not be created."
        );
      }

      const intakeId = data.intake?.id;

      setSuccessMessage(
        data.message || "Legal intake created successfully."
      );

      if (intakeId) {
        window.location.href = `/dashboard/intake/${intakeId}`;
        return;
      }

      window.location.href = "/dashboard/intake";
    } catch (err) {
      console.error("Create intake error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while creating the legal intake."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-sm text-slate-500">
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

          <span className="font-medium text-slate-900">
            New Intake
          </span>
        </div>

        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-500">
              Legal Intake Centre
            </p>

            <h1 className="text-3xl font-bold tracking-tight text-slate-950">
              New Legal Enquiry
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Record a prospective client, capture the relevant parties,
              and prepare the enquiry for conflict checking and authorised
              review.
            </p>
          </div>

          <Link
            href="/dashboard/intake"
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Back to Intake Centre
          </Link>
        </div>

        {/* Assisted conflict check notice */}
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex gap-3">
            <div className="mt-0.5 text-amber-700">
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
                  d="M12 9v4m0 4h.01M10.29 3.86 2.82 17a2 2 0 0 0 1.74 3h14.88a2 2 0 0 0 1.74-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
                />
              </svg>
            </div>

            <div>
              <h2 className="font-semibold text-amber-900">
                Conflict checking is an assisted review process
              </h2>

              <p className="mt-1 text-sm leading-6 text-amber-800">
                LegalVault identifies potential matches across your firm's
                clients and matters. A potential match must be reviewed by
                an authorised person before the prospective client is
                accepted.
              </p>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <div className="flex gap-3">
              <span className="font-bold">Error:</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Success */}
        {successMessage && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Client information */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-6 py-5">
                <h2 className="text-lg font-bold text-slate-950">
                  1. Prospective Client
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Identify the person or organisation making the enquiry.
                </p>
              </div>

              <div className="grid gap-5 p-6 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label
                    htmlFor="existingClient"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Existing Client
                  </label>

                  <select
                    id="existingClient"
                    value={clientId}
                    onChange={(event) =>
                      selectExistingClient(event.target.value)
                    }
                    disabled={loadingClients}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                  >
                    <option value="">
                      {loadingClients
                        ? "Loading clients..."
                        : "Not an existing client / prospective client"}
                    </option>

                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                        {client.email ? ` — ${client.email}` : ""}
                      </option>
                    ))}
                  </select>

                  <p className="mt-2 text-xs text-slate-500">
                    If this enquiry relates to an existing client, select
                    them here. Otherwise leave this field unchanged.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="prospectiveClientName"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Prospective Client Name{" "}
                    <span className="text-red-600">*</span>
                  </label>

                  <input
                    id="prospectiveClientName"
                    type="text"
                    value={prospectiveClientName}
                    onChange={(event) =>
                      setProspectiveClientName(event.target.value)
                    }
                    placeholder="e.g. Naledi Mokoena"
                    required
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  />
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Email Address
                  </label>

                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="client@example.com"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  />
                </div>

                <div>
                  <label
                    htmlFor="phone"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Phone Number
                  </label>

                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="e.g. 012 555 0182"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  />
                </div>

                <div>
                  <label
                    htmlFor="practiceArea"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Practice Area
                  </label>

                  <select
                    id="practiceArea"
                    value={practiceArea}
                    onChange={(event) =>
                      setPracticeArea(event.target.value)
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  >
                    <option value="">Select practice area</option>

                    {PRACTICE_AREAS.map((area) => (
                      <option key={area} value={area}>
                        {area}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            {/* Matter information */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-6 py-5">
                <h2 className="text-lg font-bold text-slate-950">
                  2. Enquiry Details
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Capture enough information for the firm to understand the
                  nature of the enquiry.
                </p>
              </div>

              <div className="p-6">
                <label
                  htmlFor="description"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Enquiry Description
                </label>

                <textarea
                  id="description"
                  value={description}
                  onChange={(event) =>
                    setDescription(event.target.value)
                  }
                  rows={5}
                  placeholder="Describe the legal issue, background, requested assistance and any important information received from the prospective client..."
                  className="w-full resize-y rounded-lg border border-slate-300 px-3 py-3 text-sm leading-6 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />

                <p className="mt-2 text-xs text-slate-500">
                  Avoid recording unnecessary sensitive information at this
                  stage. The intake can be expanded after acceptance.
                </p>
              </div>
            </section>

            {/* Parties */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-6 py-5">
                <h2 className="text-lg font-bold text-slate-950">
                  3. Parties for Conflict Checking
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Capture names that should be checked against existing firm
                  records.
                </p>
              </div>

              <div className="grid gap-8 p-6 lg:grid-cols-2">
                {/* Opposing parties */}
                <div>
                  <div className="mb-3 flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Opposing Parties
                      </h3>

                      <p className="mt-1 text-xs text-slate-500">
                        Parties on the other side of the enquiry.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={addOpposingParty}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      + Add Party
                    </button>
                  </div>

                  <div className="space-y-3">
                    {opposingParties.map((party, index) => (
                      <div
                        key={`opposing-${index}`}
                        className="flex gap-2"
                      >
                        <input
                          type="text"
                          value={party}
                          onChange={(event) =>
                            updateOpposingParty(
                              index,
                              event.target.value
                            )
                          }
                          placeholder="e.g. Khumalo Property Investments (Pty) Ltd"
                          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            removeOpposingParty(index)
                          }
                          aria-label="Remove opposing party"
                          className="rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-500 transition hover:bg-red-50 hover:text-red-700"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Related parties */}
                <div>
                  <div className="mb-3 flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Related Parties
                      </h3>

                      <p className="mt-1 text-xs text-slate-500">
                        Other people or organisations connected to the
                        enquiry.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={addRelatedParty}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      + Add Party
                    </button>
                  </div>

                  <div className="space-y-3">
                    {relatedParties.map((party, index) => (
                      <div
                        key={`related-${index}`}
                        className="flex gap-2"
                      >
                        <input
                          type="text"
                          value={party}
                          onChange={(event) =>
                            updateRelatedParty(
                              index,
                              event.target.value
                            )
                          }
                          placeholder="e.g. ABC Property Consultants"
                          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            removeRelatedParty(index)
                          }
                          aria-label="Remove related party"
                          className="rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-500 transition hover:bg-red-50 hover:text-red-700"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Processing */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-6 py-5">
                <h2 className="text-lg font-bold text-slate-950">
                  4. Intake Processing
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Set the priority, source and initial responsibility for
                  the enquiry.
                </p>
              </div>

              <div className="grid gap-5 p-6 md:grid-cols-3">
                <div>
                  <label
                    htmlFor="source"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Source
                  </label>

                  <select
                    id="source"
                    value={source}
                    onChange={(event) => setSource(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  >
                    <option value="">Select source</option>

                    {SOURCES.map((sourceOption) => (
                      <option
                        key={sourceOption}
                        value={sourceOption}
                      >
                        {sourceOption}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="priority"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Priority
                  </label>

                  <select
                    id="priority"
                    value={priority}
                    onChange={(event) =>
                      setPriority(event.target.value)
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="assignedTo"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Assign To
                  </label>

                  <select
                    id="assignedTo"
                    value={assignedToId}
                    onChange={(event) =>
                      setAssignedToId(event.target.value)
                    }
                    disabled={loadingUsers}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                  >
                    <option value="">
                      {loadingUsers
                        ? "Loading staff..."
                        : "Unassigned"}
                    </option>

                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name || user.email} — {user.role}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            {/* Conflict check */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-6 py-5">
                <h2 className="text-lg font-bold text-slate-950">
                  5. Conflict Check
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Determine whether this enquiry should enter the firm's
                  conflict-check workflow.
                </p>
              </div>

              <div className="p-6">
                <label className="flex cursor-pointer items-start gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300">
                  <input
                    type="checkbox"
                    checked={conflictCheckRequired}
                    onChange={(event) =>
                      setConflictCheckRequired(
                        event.target.checked
                      )
                    }
                    className="mt-1 h-4 w-4 rounded border-slate-300"
                  />

                  <span>
                    <span className="block text-sm font-bold text-slate-900">
                      Require conflict check
                    </span>

                    <span className="mt-1 block text-sm leading-6 text-slate-600">
                      LegalVault will place this intake into the appropriate
                      conflict-check workflow after it is created.
                    </span>
                  </span>
                </label>
              </div>
            </section>

            {/* Submission */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-bold text-slate-950">
                    Ready to create the intake?
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    The intake will be recorded in LegalVault and audited
                    as a new legal enquiry.
                  </p>
                </div>

                <div className="flex flex-col-reverse gap-3 sm:flex-row">
                  <Link
                    href="/dashboard/intake"
                    className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Cancel
                  </Link>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center justify-center rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? (
                      <>
                        <svg
                          className="mr-2 h-4 w-4 animate-spin"
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
                        Creating Intake...
                      </>
                    ) : (
                      "Create Legal Intake"
                    )}
                  </button>
                </div>
              </div>
            </section>
          </div>
        </form>
      </div>
    </main>
  );
}