"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

type Intake = {
  id: string;
  prospectiveClientName: string;
  email: string | null;
  phone: string | null;
  practiceArea: string | null;
  description: string | null;
  opposingParties: string[];
  relatedParties: string[];
  source: string | null;
  priority: string;
  conflictCheckRequired: boolean;
  status: string;
  clientId: string | null;
  assignedToId: string | null;
};

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export default function EditIntakePage() {
  const params = useParams();
  const router = useRouter();

  const intakeId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [intake, setIntake] = useState<Intake | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [prospectiveClientName, setProspectiveClientName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [practiceArea, setPracticeArea] = useState("");
  const [description, setDescription] = useState("");
  const [opposingParties, setOpposingParties] = useState("");
  const [relatedParties, setRelatedParties] = useState("");
  const [source, setSource] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [conflictCheckRequired, setConflictCheckRequired] = useState(true);

  useEffect(() => {
    if (!intakeId) return;

    async function loadIntake() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(`/api/intake/${intakeId}`, {
          method: "GET",
          cache: "no-store",
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.message || "Failed to load the legal intake."
          );
        }

        const data: Intake = result.data;

        setIntake(data);

        setProspectiveClientName(data.prospectiveClientName || "");
        setEmail(data.email || "");
        setPhone(data.phone || "");
        setPracticeArea(data.practiceArea || "");
        setDescription(data.description || "");
        setOpposingParties((data.opposingParties || []).join("\n"));
        setRelatedParties((data.relatedParties || []).join("\n"));
        setSource(data.source || "");
        setPriority(data.priority || "MEDIUM");
        setConflictCheckRequired(data.conflictCheckRequired ?? true);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load the legal intake."
        );
      } finally {
        setLoading(false);
      }
    }

    loadIntake();
  }, [intakeId]);

  function parseParties(value: string): string[] {
    return value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!intakeId) {
      setError("Invalid intake ID.");
      return;
    }

    if (!prospectiveClientName.trim()) {
      setError("Prospective client name is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const response = await fetch(`/api/intake/${intakeId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prospectiveClientName: prospectiveClientName.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          practiceArea: practiceArea.trim() || null,
          description: description.trim() || null,
          opposingParties: parseParties(opposingParties),
          relatedParties: parseParties(relatedParties),
          source: source.trim() || null,
          priority,
          conflictCheckRequired,
          clientId: intake?.clientId ?? null,
          assignedToId: intake?.assignedToId ?? null,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Failed to update the legal intake."
        );
      }

      setSuccess("Legal intake updated successfully.");

      setTimeout(() => {
        router.push(`/dashboard/intake/${intakeId}`);
      }, 700);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update the legal intake."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-sm text-slate-500">
              Loading intake...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!intake) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
            <h1 className="text-xl font-bold text-slate-950">
              Intake not found
            </h1>

            <p className="mt-2 text-sm text-red-600">
              {error || "The requested legal intake could not be found."}
            </p>

            <Link
              href="/dashboard/intake"
              className="mt-6 inline-flex rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"
            >
              Back to Legal Intake
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (intake.status === "CONVERTED") {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-2xl border border-amber-200 bg-white p-8 shadow-sm">
            <h1 className="text-xl font-bold text-slate-950">
              Intake already converted
            </h1>

            <p className="mt-2 text-sm text-slate-600">
              This legal intake has already been converted into a matter and
              can no longer be edited.
            </p>

            <Link
              href={`/dashboard/intake/${intakeId}`}
              className="mt-6 inline-flex rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"
            >
              Back to Intake
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">
              Legal Intake & Conflict Check Centre
            </p>

            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
              Edit Legal Intake
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Update the prospective client and matter intake information.
            </p>
          </div>

          <Link
            href={`/dashboard/intake/${intakeId}`}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Prospective client */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="font-bold text-slate-950">
                Prospective Client
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Basic information about the person or organisation making the
                enquiry.
              </p>
            </div>

            <div className="grid gap-5 p-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Prospective Client Name *
                </label>

                <input
                  type="text"
                  value={prospectiveClientName}
                  onChange={(event) =>
                    setProspectiveClientName(event.target.value)
                  }
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  placeholder="e.g. Naledi Mokoena"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Email
                </label>

                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  placeholder="client@example.com"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Phone
                </label>

                <input
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  placeholder="012 555 0182"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Practice Area
                </label>

                <input
                  type="text"
                  value={practiceArea}
                  onChange={(event) =>
                    setPracticeArea(event.target.value)
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  placeholder="e.g. Civil Litigation"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Source
                </label>

                <input
                  type="text"
                  value={source}
                  onChange={(event) => setSource(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  placeholder="e.g. Website Enquiry"
                />
              </div>
            </div>
          </section>

          {/* Matter information */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="font-bold text-slate-950">
                Matter Information
              </h2>
            </div>

            <div className="space-y-5 p-5">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Description
                </label>

                <textarea
                  value={description}
                  onChange={(event) =>
                    setDescription(event.target.value)
                  }
                  rows={6}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  placeholder="Describe the client's legal enquiry..."
                />
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Priority
                  </label>

                  <select
                    value={priority}
                    onChange={(event) => setPriority(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  >
                    {PRIORITIES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start gap-3">
                    <input
                      id="conflictCheckRequired"
                      type="checkbox"
                      checked={conflictCheckRequired}
                      onChange={(event) =>
                        setConflictCheckRequired(event.target.checked)
                      }
                      className="mt-1 h-4 w-4 rounded border-slate-300"
                    />

                    <div>
                      <label
                        htmlFor="conflictCheckRequired"
                        className="text-sm font-semibold text-slate-800"
                      >
                        Conflict check required
                      </label>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Keep this enabled for matters that require a formal
                        conflict-check workflow before approval.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Parties */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="font-bold text-slate-950">
                Conflict Check Parties
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Enter one party per line. These names will be used when the
                conflict check is performed.
              </p>
            </div>

            <div className="grid gap-5 p-5 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Opposing Parties
                </label>

                <textarea
                  value={opposingParties}
                  onChange={(event) =>
                    setOpposingParties(event.target.value)
                  }
                  rows={7}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  placeholder={
                    "Khumalo Property Investments (Pty) Ltd\nJohn Smith"
                  }
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Related Parties
                </label>

                <textarea
                  value={relatedParties}
                  onChange={(event) =>
                    setRelatedParties(event.target.value)
                  }
                  rows={7}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  placeholder={
                    "ABC Property Consultants\nXYZ Holdings"
                  }
                />
              </div>
            </div>
          </section>

          {/* Existing workflow */}
          <section className="rounded-2xl border border-amber-200 bg-amber-50 shadow-sm">
            <div className="p-5">
              <h2 className="font-bold text-amber-900">
                Conflict Check Notice
              </h2>

              <p className="mt-2 text-sm leading-6 text-amber-800">
                If you change the prospective client's name, opposing
                parties, related parties, contact information, or other
                identifying information, the conflict check should be run
                again before the intake is approved.
              </p>
            </div>
          </section>

          {/* Actions */}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Link
              href={`/dashboard/intake/${intakeId}`}
              className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving Changes..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}