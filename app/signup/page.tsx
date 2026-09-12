"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

export default function SignupPage() {
  const [form, setForm] = useState({
    firmName: "",
    registrationNumber: "",
    firmEmail: "",
    firmPhone: "",
    firmAddress: "",
    adminName: "",
    adminEmail: "",
    password: "",
    confirmPassword: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function updateField(
    field: keyof typeof form,
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

    if (loading) {
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(
          data?.error ||
            "Unable to create your firm account.",
        );

        setLoading(false);
        return;
      }

      /*
       * Store the firm reference temporarily so it can be
       * used during the signup/login flow if required.
       */
      if (data?.firmReference) {
        sessionStorage.setItem(
          "legalvault_signup_reference",
          data.firmReference,
        );
      }

      /*
       * The firm now has an automatic 14-day free trial.
       *
       * No payment is required at signup.
       *
       * Send the administrator to login and then into
       * the LegalVault dashboard.
       */
      window.location.href =
        "/login?callbackUrl=/dashboard";
    } catch {
      setError(
        "Unable to create your account right now. Please try again.",
      );

      setLoading(false);
    }
  }

  return (
    <main
      className="relative min-h-screen bg-slate-950 bg-cover bg-center bg-no-repeat px-6 py-10"
      style={{
        backgroundImage:
          "url('/images/legal%20vault.png')",
      }}
    >
      {/* Background overlay */}
      <div className="absolute inset-0 bg-slate-950/65" />

      {/* Signup content */}
      <div className="relative z-10 mx-auto w-full max-w-4xl">
        <div className="rounded-2xl border border-white/20 bg-white/95 p-8 shadow-2xl backdrop-blur-sm md:p-10">

          {/* Header */}
          <div className="mb-8 text-center">
            <p className="text-sm font-bold tracking-[0.25em] text-blue-700">
              LEGALVAULT
            </p>

            <h1 className="mt-3 text-3xl font-bold text-slate-900 md:text-4xl">
              Create your law firm account
            </h1>

            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-500">
              Register your law firm and start your
              14-day free trial. No payment is required
              to begin using LegalVault.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div
              role="alert"
              className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="space-y-8"
          >
            {/* Firm information */}
            <section>
              <div className="mb-5 border-b border-slate-200 pb-4">
                <h2 className="text-lg font-semibold text-slate-900">
                  Law firm information
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Enter the details of your law firm.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label
                    htmlFor="firmName"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Law firm name
                  </label>

                  <input
                    id="firmName"
                    name="firmName"
                    type="text"
                    required
                    autoComplete="organization"
                    value={form.firmName}
                    onChange={(event) =>
                      updateField(
                        "firmName",
                        event.target.value,
                      )
                    }
                    placeholder="Law Firm"
                    className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="registrationNumber"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Registration number
                    <span className="ml-1 text-xs font-normal text-slate-400">
                      (optional)
                    </span>
                  </label>

                  <input
                    id="registrationNumber"
                    name="registrationNumber"
                    type="text"
                    value={form.registrationNumber}
                    onChange={(event) =>
                      updateField(
                        "registrationNumber",
                        event.target.value,
                      )
                    }
                    placeholder="2020/123456/21"
                    className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="firmEmail"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Firm email
                  </label>

                  <input
                    id="firmEmail"
                    name="firmEmail"
                    type="email"
                    autoComplete="organization-email"
                    value={form.firmEmail}
                    onChange={(event) =>
                      updateField(
                        "firmEmail",
                        event.target.value,
                      )
                    }
                    placeholder="info@lawfirm.co.za"
                    className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="firmPhone"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Firm phone
                  </label>

                  <input
                    id="firmPhone"
                    name="firmPhone"
                    type="tel"
                    autoComplete="tel"
                    value={form.firmPhone}
                    onChange={(event) =>
                      updateField(
                        "firmPhone",
                        event.target.value,
                      )
                    }
                    placeholder="+27 11 123 4567"
                    className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="firmAddress"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Firm address
                  </label>

                  <input
                    id="firmAddress"
                    name="firmAddress"
                    type="text"
                    autoComplete="street-address"
                    value={form.firmAddress}
                    onChange={(event) =>
                      updateField(
                        "firmAddress",
                        event.target.value,
                      )
                    }
                    placeholder="Pretoria, Gauteng"
                    className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
            </section>

            {/* Administrator */}
            <section>
              <div className="mb-5 border-b border-slate-200 pb-4">
                <h2 className="text-lg font-semibold text-slate-900">
                  Administrator account
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  This person will become the first
                  administrator of the firm.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label
                    htmlFor="adminName"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Full name
                  </label>

                  <input
                    id="adminName"
                    name="adminName"
                    type="text"
                    required
                    autoComplete="name"
                    value={form.adminName}
                    onChange={(event) =>
                      updateField(
                        "adminName",
                        event.target.value,
                      )
                    }
                    placeholder="John Doe"
                    className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div className="md:col-span-2">
                  <label
                    htmlFor="adminEmail"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Administrator email
                  </label>

                  <input
                    id="adminEmail"
                    name="adminEmail"
                    type="email"
                    required
                    autoComplete="email"
                    value={form.adminEmail}
                    onChange={(event) =>
                      updateField(
                        "adminEmail",
                        event.target.value,
                      )
                    }
                    placeholder="admin@lawfirm.co.za"
                    className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Password
                  </label>

                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(event) =>
                      updateField(
                        "password",
                        event.target.value,
                      )
                    }
                    placeholder="Minimum 8 characters"
                    className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Confirm password
                  </label>

                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={form.confirmPassword}
                    onChange={(event) =>
                      updateField(
                        "confirmPassword",
                        event.target.value,
                      )
                    }
                    placeholder="Re-enter your password"
                    className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
            </section>

            {/* Free trial notice */}
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/90 p-5">
              <h3 className="font-semibold text-slate-900">
                Your 14-day free trial
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Your law firm will receive a full
                14-day LegalVault trial immediately
                after registration. No payment is
                required to start your trial.
              </p>

              <ol className="mt-4 space-y-2 text-sm text-slate-600">
                <li>
                  <span className="font-semibold text-emerald-700">
                    1.
                  </span>{" "}
                  Create your firm account.
                </li>

                <li>
                  <span className="font-semibold text-emerald-700">
                    2.
                  </span>{" "}
                  Your 14-day free trial starts
                  automatically.
                </li>

                <li>
                  <span className="font-semibold text-emerald-700">
                    3.
                  </span>{" "}
                  Sign in as the firm administrator.
                </li>

                <li>
                  <span className="font-semibold text-emerald-700">
                    4.
                  </span>{" "}
                  Explore and use LegalVault during
                  your trial.
                </li>

                <li>
                  <span className="font-semibold text-emerald-700">
                    5.
                  </span>{" "}
                  Choose a paid subscription before
                  your trial ends to continue using
                  LegalVault.
                </li>
              </ol>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? "Creating firm account..."
                : "Start 14-day free trial"}
            </button>
          </form>

          {/* Login */}
          <div className="mt-8 border-t border-slate-200 pt-6 text-center">
            <p className="text-sm text-slate-500">
              Already have a LegalVault account?
            </p>

            <Link
              href="/login"
              className="mt-2 inline-block text-sm font-semibold text-blue-700 hover:text-blue-900 hover:underline"
            >
              Sign in
            </Link>
          </div>

          {/* Footer */}
          <p className="mt-8 text-center text-xs text-slate-400">
            LegalVault &bull; Secure Legal Document Management
          </p>
        </div>
      </div>
    </main>
  );
}