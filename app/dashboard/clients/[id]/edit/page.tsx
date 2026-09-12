"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type ClientForm = {
  type: string;
  name: string;
  email: string;
  phone: string;
  idNumber: string;
  address: string;
  notes: string;
};

const INITIAL_FORM: ClientForm = {
  type: "INDIVIDUAL",
  name: "",
  email: "",
  phone: "",
  idNumber: "",
  address: "",
  notes: "",
};

export default function EditClientPage() {
  const router = useRouter();
  const params = useParams();

  const clientId =
    typeof params.id === "string"
      ? params.id
      : "";

  const [form, setForm] =
    useState<ClientForm>(INITIAL_FORM);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {
    if (!clientId) {
      setError("Invalid client ID.");
      setLoading(false);
      return;
    }

    async function loadClient() {
      try {
        const response = await fetch(
          `/api/clients/${clientId}`,
        );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Failed to load client.",
          );
        }

        const client = data.client;

        setForm({
          type:
            client.type ||
            "INDIVIDUAL",
          name:
            client.name || "",
          email:
            client.email || "",
          phone:
            client.phone || "",
          idNumber:
            client.idNumber || "",
          address:
            client.address || "",
          notes:
            client.notes || "",
        });
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Failed to load client.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadClient();
  }, [clientId]);

  function updateField(
    field: keyof ClientForm,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!form.name.trim()) {
      setError(
        "Client name is required.",
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        `/api/clients/${clientId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(form),
        },
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to update client.",
        );
      }

      router.push(
        `/dashboard/clients/${clientId}`,
      );

      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">
              Loading client...
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <p className="text-sm font-medium text-slate-500">
            Client Management
          </p>

          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            Edit Client
          </h1>

          <p className="mt-2 text-slate-600">
            Update the client information
            stored in your firm's records.
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
                Client Type
              </label>

              <select
                value={form.type}
                onChange={(event) =>
                  updateField(
                    "type",
                    event.target.value,
                  )
                }
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
              >
                <option value="INDIVIDUAL">
                  Individual
                </option>

                <option value="COMPANY">
                  Company
                </option>

                <option value="TRUST">
                  Trust
                </option>

                <option value="GOVERNMENT">
                  Government
                </option>

                <option value="OTHER">
                  Other
                </option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Full Name / Organisation Name *
              </label>

              <input
                required
                value={form.name}
                onChange={(event) =>
                  updateField(
                    "name",
                    event.target.value,
                  )
                }
                placeholder="Enter client name"
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Email
              </label>

              <input
                type="email"
                value={form.email}
                onChange={(event) =>
                  updateField(
                    "email",
                    event.target.value,
                  )
                }
                placeholder="client@example.com"
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Phone
              </label>

              <input
                value={form.phone}
                onChange={(event) =>
                  updateField(
                    "phone",
                    event.target.value,
                  )
                }
                placeholder="+27 ..."
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                ID / Registration Number
              </label>

              <input
                value={form.idNumber}
                onChange={(event) =>
                  updateField(
                    "idNumber",
                    event.target.value,
                  )
                }
                placeholder="ID or registration number"
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Address
              </label>

              <input
                value={form.address}
                onChange={(event) =>
                  updateField(
                    "address",
                    event.target.value,
                  )
                }
                placeholder="Client address"
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div className="mt-6">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Notes
            </label>

            <textarea
              rows={5}
              value={form.notes}
              onChange={(event) =>
                updateField(
                  "notes",
                  event.target.value,
                )
              }
              placeholder="Additional information about the client..."
              className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
            />
          </div>

          <div className="mt-8 flex justify-end gap-3">
            <button
              type="button"
              onClick={() =>
                router.back()
              }
              disabled={saving}
              className="rounded-lg border border-slate-300 px-5 py-3 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-slate-900 px-6 py-3 font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}