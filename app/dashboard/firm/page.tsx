"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  CalendarDays,
  CreditCard,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
} from "lucide-react";

type Subscription = {
  plan: string;
  status: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  cancelledAt: string | null;
  provider: string | null;
};

type Firm = {
  id: string;
  referenceNumber: string;
  name: string;
  registrationNumber: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
  subscription: Subscription | null;
};

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function label(value: string | null | undefined) {
  if (!value) return "—";

  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function FirmProfilePage() {
  const [firm, setFirm] = useState<Firm | null>(null);
  const [canEdit, setCanEdit] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [name, setName] = useState("");
  const [registrationNumber, setRegistrationNumber] =
    useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  async function loadFirm() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "/api/firm/profile",
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to load firm profile."
        );
      }

      setFirm(data.firm);
      setCanEdit(data.canEdit === true);

      setName(data.firm.name ?? "");
      setRegistrationNumber(
        data.firm.registrationNumber ?? ""
      );
      setEmail(data.firm.email ?? "");
      setPhone(data.firm.phone ?? "");
      setAddress(data.firm.address ?? "");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to load firm profile."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFirm();
  }, []);

  async function saveProfile() {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const response = await fetch(
        "/api/firm/profile",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            registrationNumber,
            email,
            phone,
            address,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to update firm profile."
        );
      }

      setFirm((current) =>
        current
          ? {
              ...current,
              ...data.firm,
            }
          : data.firm
      );

      setSuccess(
        "Firm profile updated successfully."
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to update firm profile."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 text-sm text-slate-500">
        Loading firm profile...
      </div>
    );
  }

  if (!firm) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {error || "Firm profile could not be loaded."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* HEADER */}

      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-900 text-white">
            {firm.logoUrl ? (
              <img
                src={firm.logoUrl}
                alt={`${firm.name} logo`}
                className="h-14 w-14 rounded-xl object-cover"
              />
            ) : (
              <Building2 className="h-7 w-7" />
            )}
          </div>

          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Firm Profile
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Manage your firm's LegalVault account
              information.
            </p>
          </div>
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={saveProfile}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" />

            {saving ? "Saving..." : "Save Changes"}
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {/* FIRM INFORMATION */}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <Building2 className="h-5 w-5 text-slate-600" />

          <div>
            <h2 className="font-semibold text-slate-900">
              Firm Information
            </h2>

            <p className="text-sm text-slate-500">
              Core information associated with this firm.
            </p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Firm Name
            </label>

            <input
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
              disabled={!canEdit}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>

          <div className="flex flex-col gap-5 md:flex-row">
            <div className="flex-1">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Registration Number
              </label>

              <input
                value={registrationNumber}
                onChange={(event) =>
                  setRegistrationNumber(
                    event.target.value
                  )
                }
                disabled={!canEdit}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>

            <div className="flex-1">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Firm Reference Number
              </label>

              <input
                value={firm.referenceNumber}
                readOnly
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500"
              />

              <p className="mt-1 text-xs text-slate-400">
                System-generated and cannot be changed.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CONTACT */}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h2 className="font-semibold text-slate-900">
            Contact Information
          </h2>

          <p className="text-sm text-slate-500">
            Contact details used for the firm's account.
          </p>
        </div>

        <div className="space-y-5">
          <div className="flex flex-col gap-5 md:flex-row">
            <div className="flex-1">
              <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
                <Mail className="h-4 w-4" />
                Email
              </label>

              <input
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                disabled={!canEdit}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>

            <div className="flex-1">
              <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
                <Phone className="h-4 w-4" />
                Telephone
              </label>

              <input
                value={phone}
                onChange={(event) =>
                  setPhone(event.target.value)
                }
                disabled={!canEdit}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
              <MapPin className="h-4 w-4" />
              Address
            </label>

            <textarea
              value={address}
              onChange={(event) =>
                setAddress(event.target.value)
              }
              disabled={!canEdit}
              rows={4}
              className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
        </div>
      </section>

      {/* SUBSCRIPTION */}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <CreditCard className="h-5 w-5 text-slate-600" />

          <div>
            <h2 className="font-semibold text-slate-900">
              Subscription
            </h2>

            <p className="text-sm text-slate-500">
              Current LegalVault subscription information.
            </p>
          </div>
        </div>

        {firm.subscription ? (
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Plan
              </p>
              <p className="mt-1 font-medium text-slate-900">
                {label(firm.subscription.plan)}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Status
              </p>
              <p className="mt-1 font-medium text-slate-900">
                {label(firm.subscription.status)}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Period Start
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {formatDate(
                  firm.subscription.currentPeriodStart
                )}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Period End
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {formatDate(
                  firm.subscription.currentPeriodEnd
                )}
              </p>
            </div>

            {firm.subscription.trialEndsAt && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Trial Ends
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  {formatDate(
                    firm.subscription.trialEndsAt
                  )}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
            No subscription information is currently
            associated with this firm.
          </div>
        )}
      </section>

      {/* ACCOUNT INFORMATION */}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-slate-600" />

          <div>
            <h2 className="font-semibold text-slate-900">
              Account Information
            </h2>

            <p className="text-sm text-slate-500">
              System-managed firm information.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-6 md:flex-row">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Firm Created
            </p>

            <p className="mt-1 flex items-center gap-2 text-sm text-slate-700">
              <CalendarDays className="h-4 w-4" />
              {formatDate(firm.createdAt)}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Last Updated
            </p>

            <p className="mt-1 flex items-center gap-2 text-sm text-slate-700">
              <CalendarDays className="h-4 w-4" />
              {formatDate(firm.updatedAt)}
            </p>
          </div>
        </div>
      </section>

      {/* MOBILE SAVE */}

      {canEdit && (
        <div className="flex justify-end pb-4 md:hidden">
          <button
            type="button"
            onClick={saveProfile}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      )}
    </div>
  );
}