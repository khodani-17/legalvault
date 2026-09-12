"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Client = {
  id: string;
  referenceNumber: string;
  name: string;
};

export default function NewMatterPage() {
  const router = useRouter();

  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    clientId: "",
    title: "",
    description: "",
    practiceArea: "",
    status: "OPEN",
  });

  useEffect(() => {
    async function loadClients() {
      try {
        const response = await fetch("/api/clients");

        if (!response.ok) {
          throw new Error("Failed to load clients.");
        }

        const data = await response.json();

        setClients(data.clients || []);
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Failed to load clients."
        );
      } finally {
        setLoadingClients(false);
      }
    }

    loadClients();
  }, []);

  function updateField(
    field: keyof typeof form,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      if (!form.clientId) {
        throw new Error("Please select a client.");
      }

      const response = await fetch("/api/matters", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to create matter."
        );
      }

      router.push(
        `/dashboard/matters/${data.matter.id}`
      );

      router.refresh();
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

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-4xl">

        <div className="mb-8">
          <p className="text-sm font-medium text-slate-500">
            Matter Management
          </p>

          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            Create Matter
          </h1>

          <p className="mt-2 text-slate-600">
            Create a new legal matter for an existing client.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200"
        >

          {error && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2">

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Client *
              </label>

              <select
                required
                value={form.clientId}
                onChange={(event) =>
                  updateField(
                    "clientId",
                    event.target.value
                  )
                }
                disabled={loadingClients}
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600 disabled:bg-slate-100"
              >
                <option value="">
                  {loadingClients
                    ? "Loading clients..."
                    : "Select a client"}
                </option>

                {clients.map((client) => (
                  <option
                    key={client.id}
                    value={client.id}
                  >
                    {client.referenceNumber} — {client.name}
                  </option>
                ))}
              </select>

              {!loadingClients &&
                clients.length === 0 && (
                  <p className="mt-2 text-sm text-amber-600">
                    No clients found. Create a client first.
                  </p>
                )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Practice Area
              </label>

              <select
                value={form.practiceArea}
                onChange={(event) =>
                  updateField(
                    "practiceArea",
                    event.target.value
                  )
                }
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
              >
                <option value="">
                  Select practice area
                </option>

                <option value="Civil Litigation">
                  Civil Litigation
                </option>

                <option value="Criminal Law">
                  Criminal Law
                </option>

                <option value="Family Law">
                  Family Law
                </option>

                <option value="Commercial Law">
                  Commercial Law
                </option>

                <option value="Labour Law">
                  Labour Law
                </option>

                <option value="Property Law">
                  Property Law
                </option>

                <option value="Mining Law">
                  Mining Law
                </option>

                <option value="Tax Law">
                  Tax Law
                </option>

                <option value="Personal Injury">
                  Personal Injury
                </option>

                <option value="Other">
                  Other
                </option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Matter Title *
              </label>

              <input
                required
                value={form.title}
                onChange={(event) =>
                  updateField(
                    "title",
                    event.target.value
                  )
                }
                placeholder="e.g. Smith v ABC (Pty) Ltd"
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Status
              </label>

              <select
                value={form.status}
                onChange={(event) =>
                  updateField(
                    "status",
                    event.target.value
                  )
                }
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
              >
                <option value="OPEN">
                  Open
                </option>

                <option value="PENDING">
                  Pending
                </option>

                <option value="CLOSED">
                  Closed
                </option>

                <option value="ARCHIVED">
                  Archived
                </option>
              </select>
            </div>

            <div />

          </div>

          <div className="mt-6">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Description
            </label>

            <textarea
              rows={6}
              value={form.description}
              onChange={(event) =>
                updateField(
                  "description",
                  event.target.value
                )
              }
              placeholder="Brief description of the legal matter..."
              className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
            />
          </div>

          <div className="mt-8 flex justify-end gap-3">

            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-lg border border-slate-300 px-5 py-3 font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                loading ||
                loadingClients ||
                clients.length === 0
              }
              className="rounded-lg bg-slate-900 px-6 py-3 font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Creating..."
                : "Create Matter"}
            </button>

          </div>
        </form>
      </div>
    </main>
  );
}