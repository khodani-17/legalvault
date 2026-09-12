"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Archive,
  CheckCircle2,
  FileText,
  Loader2,
  Save,
  UserRound,
} from "lucide-react";
import {
  useParams,
  useRouter,
} from "next/navigation";

type Client = {
  id: string;
  name: string;
  referenceNumber: string;
};

type Matter = {
  id: string;
  referenceNumber: string;
  title: string;
  description: string | null;
  practiceArea: string | null;
  status: string;
  openedAt: string;
  closedAt: string | null;
  client: Client;
};

const statuses = [
  {
    value: "OPEN",
    label: "Open",
  },
  {
    value: "PENDING",
    label: "Pending",
  },
  {
    value: "CLOSED",
    label: "Closed",
  },
  {
    value: "ARCHIVED",
    label: "Archived",
  },
];

const practiceAreas = [
  "Civil Litigation",
  "Criminal Law",
  "Commercial Law",
  "Corporate Law",
  "Family Law",
  "Labour Law",
  "Property Law",
  "Personal Injury",
  "Road Accident Fund",
  "Medical Negligence",
  "Constitutional Law",
  "Administrative Law",
  "Mining Law",
  "Tax Law",
  "Debt Collection",
  "Immigration Law",
  "Wills & Estates",
  "Other",
];

function formatDate(date: string | null) {
  if (!date) {
    return "—";
  }

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return parsed.toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatStatus(status: string) {
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function statusClasses(status: string) {
  switch (status) {
    case "OPEN":
      return "bg-green-100 text-green-700";

    case "PENDING":
      return "bg-yellow-100 text-yellow-700";

    case "CLOSED":
      return "bg-slate-200 text-slate-700";

    case "ARCHIVED":
      return "bg-red-100 text-red-700";

    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default function EditMatterPage() {
  const router = useRouter();
  const params = useParams();

  const id =
    typeof params.id === "string"
      ? params.id
      : "";

  const [matter, setMatter] =
    useState<Matter | null>(null);

  const [clients, setClients] =
    useState<Client[]>([]);

  const [title, setTitle] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [practiceArea, setPracticeArea] =
    useState("");

  const [clientId, setClientId] =
    useState("");

  const [status, setStatus] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [loadingClients, setLoadingClients] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [archiving, setArchiving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  // ============================================================
  // LOAD MATTER
  // ============================================================

  useEffect(() => {
    if (!id) {
      setError("Matter ID is missing.");
      setLoading(false);
      return;
    }

    async function loadMatter() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `/api/matters/${id}`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
            cache: "no-store",
          }
        );

        const contentType =
          response.headers.get(
            "content-type"
          );

        if (
          !contentType?.includes(
            "application/json"
          )
        ) {
          throw new Error(
            "The server returned an unexpected response."
          );
        }

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Failed to load matter."
          );
        }

        const loadedMatter =
          data.matter as Matter;

        setMatter(loadedMatter);

        setTitle(
          loadedMatter.title || ""
        );

        setDescription(
          loadedMatter.description || ""
        );

        setPracticeArea(
          loadedMatter.practiceArea || ""
        );

        setClientId(
          loadedMatter.client?.id || ""
        );

        setStatus(
          loadedMatter.status || ""
        );
      } catch (err) {
        console.error(
          "LOAD MATTER ERROR:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load matter."
        );
      } finally {
        setLoading(false);
      }
    }

    loadMatter();
  }, [id]);

  // ============================================================
  // LOAD CLIENTS
  // ============================================================

  useEffect(() => {
    async function loadClients() {
      try {
        setLoadingClients(true);

        const response = await fetch(
          "/api/clients",
          {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
            cache: "no-store",
          }
        );

        const contentType =
          response.headers.get(
            "content-type"
          );

        if (
          !contentType?.includes(
            "application/json"
          )
        ) {
          throw new Error(
            "The server returned an unexpected response."
          );
        }

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Failed to load clients."
          );
        }

        setClients(
          Array.isArray(data.clients)
            ? data.clients
            : []
        );
      } catch (err) {
        console.error(
          "LOAD CLIENTS ERROR:",
          err
        );

        /*
         * Do not replace a matter-loading
         * error with a client-loading error.
         */
        if (!matter) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load clients."
          );
        }
      } finally {
        setLoadingClients(false);
      }
    }

    loadClients();
  }, [matter]);

  // ============================================================
  // UPDATE MATTER
  // ============================================================

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!title.trim()) {
      setError(
        "Matter title is required."
      );
      return;
    }

    if (!clientId) {
      setError(
        "Please select a client."
      );
      return;
    }

    if (!status) {
      setError(
        "Please select a matter status."
      );
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(
        `/api/matters/${id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
            Accept:
              "application/json",
          },
          body: JSON.stringify({
            title: title.trim(),
            description:
              description.trim(),
            practiceArea:
              practiceArea.trim(),
            clientId,
            status,
          }),
        }
      );

      const contentType =
        response.headers.get(
          "content-type"
        );

      if (
        !contentType?.includes(
          "application/json"
        )
      ) {
        throw new Error(
          "The server returned an unexpected response."
        );
      }

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to update matter."
        );
      }

      if (data.matter) {
        setMatter(data.matter);
      }

      setSuccess(
        "Matter details have been updated successfully."
      );

      setTimeout(() => {
        router.push(
          `/dashboard/matters/${id}`
        );

        router.refresh();
      }, 900);
    } catch (err) {
      console.error(
        "UPDATE MATTER ERROR:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to update matter."
      );
    } finally {
      setSaving(false);
    }
  }

  // ============================================================
  // ARCHIVE MATTER
  // ============================================================

  async function handleArchive() {
    if (!matter) {
      return;
    }

    const confirmed =
      window.confirm(
        `Are you sure you want to archive matter ${matter.referenceNumber}?\n\nThis will remove it from active matter management.`
      );

    if (!confirmed) {
      return;
    }

    try {
      setArchiving(true);
      setError("");
      setSuccess("");

      const response = await fetch(
        `/api/matters/${id}`,
        {
          method: "DELETE",
          headers: {
            Accept:
              "application/json",
          },
        }
      );

      const contentType =
        response.headers.get(
          "content-type"
        );

      if (
        !contentType?.includes(
          "application/json"
        )
      ) {
        throw new Error(
          "The server returned an unexpected response."
        );
      }

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to archive matter."
        );
      }

      router.push(
        "/dashboard/matters"
      );

      router.refresh();
    } catch (err) {
      console.error(
        "ARCHIVE MATTER ERROR:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to archive matter."
      );
    } finally {
      setArchiving(false);
    }
  }

  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-700" />

            <p className="mt-4 text-sm text-slate-500">
              Loading matter...
            </p>
          </div>
        </div>
      </main>
    );
  }

  // ============================================================
  // MATTER NOT FOUND
  // ============================================================

  if (!matter) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-5xl">
          <Link
            href="/dashboard/matters"
            className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Matters
          </Link>

          <div className="mt-6 rounded-2xl border border-red-200 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
              <FileText className="h-7 w-7 text-red-600" />
            </div>

            <h1 className="mt-5 text-2xl font-bold text-slate-900">
              Matter not found
            </h1>

            <p className="mt-2 text-slate-500">
              {error ||
                "The matter could not be found."}
            </p>

            <Link
              href="/dashboard/matters"
              className="mt-6 inline-flex rounded-lg bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800"
            >
              Return to Matters
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // ============================================================
  // PAGE
  // ============================================================

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl">

        {/* Back */}
        <Link
          href={`/dashboard/matters/${matter.id}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Matter
        </Link>

        {/* Header */}
        <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100">
                  <FileText className="h-5 w-5 text-blue-700" />
                </div>

                <div>
                  <p className="text-sm font-medium text-slate-500">
                    Edit Matter
                  </p>

                  <h1 className="text-2xl font-bold text-slate-900">
                    {matter.referenceNumber}
                  </h1>
                </div>
              </div>

              <p className="mt-4 text-sm text-slate-500">
                Update the legal matter details,
                client, practice area and status.
              </p>
            </div>

            <span
              className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(
                status
              )}`}
            >
              {formatStatus(status)}
            </span>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            <strong className="font-semibold">
              Error:
            </strong>{" "}
            {error}
          </div>
        )}

        {success && (
          <div className="mt-6 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-5 py-4 text-sm text-green-700">
            <CheckCircle2 className="h-5 w-5 shrink-0" />

            <span>{success}</span>
          </div>
        )}

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="mt-6 space-y-6"
        >

          {/* Matter Information */}
          <section className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="border-b border-slate-200 px-6 py-5">
              <h2 className="text-lg font-bold text-slate-900">
                Matter Information
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Basic information about this legal matter.
              </p>
            </div>

            <div className="space-y-6 p-6">

              {/* Reference */}
              <div>
                <label className="block text-sm font-semibold text-slate-700">
                  Matter Reference
                </label>

                <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600">
                  {matter.referenceNumber}
                </div>

                <p className="mt-1 text-xs text-slate-400">
                  Matter references cannot be changed.
                </p>
              </div>

              {/* Title */}
              <div>
                <label
                  htmlFor="title"
                  className="block text-sm font-semibold text-slate-700"
                >
                  Matter Title
                  <span className="ml-1 text-red-500">
                    *
                  </span>
                </label>

                <input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(event) =>
                    setTitle(event.target.value)
                  }
                  placeholder="e.g. Sadiki RAF Claim"
                  className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {/* Description */}
              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-semibold text-slate-700"
                >
                  Description
                </label>

                <textarea
                  id="description"
                  rows={6}
                  value={description}
                  onChange={(event) =>
                    setDescription(
                      event.target.value
                    )
                  }
                  placeholder="Provide a description of the matter..."
                  className="mt-2 w-full resize-y rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />

                <p className="mt-1 text-xs text-slate-400">
                  Include relevant background or
                  instructions about the matter.
                </p>
              </div>

              {/* Practice Area */}
              <div>
                <label
                  htmlFor="practiceArea"
                  className="block text-sm font-semibold text-slate-700"
                >
                  Practice Area
                </label>

                <select
                  id="practiceArea"
                  value={practiceArea}
                  onChange={(event) =>
                    setPracticeArea(
                      event.target.value
                    )
                  }
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">
                    Select practice area
                  </option>

                  {practiceAreas.map(
                    (area) => (
                      <option
                        key={area}
                        value={area}
                      >
                        {area}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>
          </section>

          {/* Client & Status */}
          <section className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="border-b border-slate-200 px-6 py-5">
              <h2 className="text-lg font-bold text-slate-900">
                Client & Status
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Assign the matter to a client and
                control its current status.
              </p>
            </div>

            <div className="grid gap-6 p-6 md:grid-cols-2">

              {/* Client */}
              <div>
                <label
                  htmlFor="clientId"
                  className="flex items-center gap-2 text-sm font-semibold text-slate-700"
                >
                  <UserRound className="h-4 w-4 text-slate-400" />
                  Client
                  <span className="text-red-500">
                    *
                  </span>
                </label>

                <select
                  id="clientId"
                  value={clientId}
                  onChange={(event) =>
                    setClientId(
                      event.target.value
                    )
                  }
                  disabled={loadingClients}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none disabled:bg-slate-100 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">
                    {loadingClients
                      ? "Loading clients..."
                      : "Select client"}
                  </option>

                  {clients.map(
                    (client) => (
                      <option
                        key={client.id}
                        value={client.id}
                      >
                        {client.name} —{" "}
                        {client.referenceNumber}
                      </option>
                    )
                  )}
                </select>

                {!loadingClients &&
                  clients.length === 0 && (
                    <p className="mt-2 text-xs text-red-600">
                      No clients are available.
                    </p>
                  )}
              </div>

              {/* Status */}
              <div>
                <label
                  htmlFor="status"
                  className="block text-sm font-semibold text-slate-700"
                >
                  Matter Status
                  <span className="ml-1 text-red-500">
                    *
                  </span>
                </label>

                <select
                  id="status"
                  value={status}
                  onChange={(event) =>
                    setStatus(
                      event.target.value
                    )
                  }
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                >
                  {statuses.map(
                    (item) => (
                      <option
                        key={item.value}
                        value={item.value}
                      >
                        {item.label}
                      </option>
                    )
                  )}
                </select>

                {status === "CLOSED" && (
                  <p className="mt-2 text-xs text-slate-500">
                    Closing the matter will record
                    the current date as its closed date.
                  </p>
                )}

                {status === "ARCHIVED" && (
                  <p className="mt-2 text-xs text-red-600">
                    Archived matters are retained for
                    record-keeping but are no longer
                    active.
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Matter Dates */}
          <section className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="border-b border-slate-200 px-6 py-5">
              <h2 className="text-lg font-bold text-slate-900">
                Matter Dates
              </h2>
            </div>

            <div className="grid gap-6 p-6 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Opened
                </p>

                <p className="mt-2 text-sm font-medium text-slate-900">
                  {formatDate(
                    matter.openedAt
                  )}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Closed
                </p>

                <p className="mt-2 text-sm font-medium text-slate-900">
                  {formatDate(
                    matter.closedAt
                  )}
                </p>
              </div>
            </div>
          </section>

          {/* Actions */}
          <section className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">

              <Link
                href={`/dashboard/matters/${matter.id}`}
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </Link>

              <button
                type="submit"
                disabled={saving || archiving}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </section>
        </form>

        {/* Archive */}
        <section className="mt-6 rounded-2xl border border-red-200 bg-red-50">
          <div className="p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-bold text-red-900">
                  Archive Matter
                </h2>

                <p className="mt-1 max-w-2xl text-sm text-red-700">
                  Archiving keeps the matter and its
                  records in the system while removing
                  it from active matter management.
                </p>
              </div>

              <button
                type="button"
                onClick={handleArchive}
                disabled={
                  archiving || saving
                }
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-red-300 bg-white px-5 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {archiving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Archiving...
                  </>
                ) : (
                  <>
                    <Archive className="h-4 w-4" />
                    Archive Matter
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}