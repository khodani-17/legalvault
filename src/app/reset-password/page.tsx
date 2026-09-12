"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [loading, setLoading] = useState(false);

  const [success, setSuccess] =
    useState(false);

  const [error, setError] =
    useState("");

  const [redirectCountdown, setRedirectCountdown] =
    useState(3);

  // ------------------------------------------------------------
  // PASSWORD REQUIREMENTS
  // ------------------------------------------------------------

  const passwordRequirements = useMemo(
    () => ({
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
    }),
    [password],
  );

  const passwordValid =
    passwordRequirements.length &&
    passwordRequirements.uppercase &&
    passwordRequirements.lowercase &&
    passwordRequirements.number;

  const passwordsMatch =
    password.length > 0 &&
    password === confirmPassword;

  // ------------------------------------------------------------
  // FORM SUBMISSION
  // ------------------------------------------------------------

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");

    // ----------------------------------------------------------
    // TOKEN VALIDATION
    // ----------------------------------------------------------

    if (!token) {
      setError(
        "This password reset link is invalid or incomplete.",
      );
      return;
    }

    // ----------------------------------------------------------
    // PASSWORD VALIDATION
    // ----------------------------------------------------------

    if (!passwordValid) {
      setError(
        "Please meet all password requirements.",
      );
      return;
    }

    if (!passwordsMatch) {
      setError(
        "The passwords do not match.",
      );
      return;
    }

    // ----------------------------------------------------------
    // SUBMIT
    // ----------------------------------------------------------

    setLoading(true);

    try {
      const response = await fetch(
        "/api/password-reset/reset",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token,
            password,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data?.message ||
            "Unable to reset your password. Please try again.",
        );

        return;
      }

      // --------------------------------------------------------
      // SUCCESS
      // --------------------------------------------------------

      setSuccess(true);

      // Redirect to login after a short delay.
      let countdown = 3;

      setRedirectCountdown(countdown);

      const interval = window.setInterval(() => {
        countdown -= 1;

        setRedirectCountdown(countdown);

        if (countdown <= 0) {
          window.clearInterval(interval);
          router.push("/login");
        }
      }, 1000);
    } catch {
      setError(
        "Unable to connect to LegalVault. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  // ------------------------------------------------------------
  // SUCCESS SCREEN
  // ------------------------------------------------------------

  if (success) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          <div className="rounded-2xl bg-white p-8 shadow-2xl">
            <div className="flex justify-center mb-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2
                  className="h-9 w-9 text-emerald-600"
                  strokeWidth={2}
                />
              </div>
            </div>

            <div className="text-center">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Password reset successful
              </h1>

              <p className="mt-3 text-sm leading-6 text-slate-600">
                Your LegalVault password has been
                successfully changed.
              </p>

              <p className="mt-4 text-sm text-slate-500">
                Redirecting you to the login page in{" "}
                <span className="font-semibold text-slate-900">
                  {redirectCountdown}
                </span>{" "}
                seconds...
              </p>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} LegalVault.
            Secure Legal Document Management.
          </p>
        </div>
      </main>
    );
  }

  // ------------------------------------------------------------
  // MAIN RESET PAGE
  // ------------------------------------------------------------

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        {/* BRAND */}
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-lg">
              <LockKeyhole
                className="h-7 w-7 text-slate-900"
                strokeWidth={2}
              />
            </div>
          </div>

          <h1 className="text-3xl font-bold tracking-[0.18em] text-white">
            LEGALVAULT
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Secure Legal Document Management
          </p>
        </div>

        {/* CARD */}
        <div className="rounded-2xl bg-white p-8 shadow-2xl">
          <div className="mb-7">
            <h2 className="text-2xl font-bold text-slate-900">
              Create a new password
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Choose a strong password for your
              LegalVault account.
            </p>
          </div>

          {/* ERROR */}
          {error && (
            <div className="mb-6 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

              <p className="text-sm leading-5 text-red-700">
                {error}
              </p>
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            {/* PASSWORD */}
            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                New password
              </label>

              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  value={password}
                  onChange={(event) =>
                    setPassword(
                      event.target.value,
                    )
                  }
                  autoComplete="new-password"
                  disabled={loading}
                  placeholder="Enter your new password"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pr-12 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-100"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(
                      !showPassword,
                    )
                  }
                  disabled={loading}
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700 disabled:cursor-not-allowed"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* CONFIRM PASSWORD */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Confirm new password
              </label>

              <div className="relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={
                    showConfirmPassword
                      ? "text"
                      : "password"
                  }
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(
                      event.target.value,
                    )
                  }
                  autoComplete="new-password"
                  disabled={loading}
                  placeholder="Confirm your new password"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pr-12 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-100"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowConfirmPassword(
                      !showConfirmPassword,
                    )
                  }
                  disabled={loading}
                  aria-label={
                    showConfirmPassword
                      ? "Hide password"
                      : "Show password"
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700 disabled:cursor-not-allowed"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* PASSWORD REQUIREMENTS */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-slate-700" />

                <span className="text-sm font-semibold text-slate-800">
                  Password requirements
                </span>
              </div>

              <div className="space-y-2 text-sm">
                <Requirement
                  valid={
                    passwordRequirements.length
                  }
                  text="At least 8 characters"
                />

                <Requirement
                  valid={
                    passwordRequirements.uppercase
                  }
                  text="At least one uppercase letter"
                />

                <Requirement
                  valid={
                    passwordRequirements.lowercase
                  }
                  text="At least one lowercase letter"
                />

                <Requirement
                  valid={
                    passwordRequirements.number
                  }
                  text="At least one number"
                />

                <Requirement
                  valid={passwordsMatch}
                  text="Passwords match"
                />
              </div>
            </div>

            {/* SUBMIT */}
            <button
              type="submit"
              disabled={
                loading ||
                !token ||
                !passwordValid ||
                !passwordsMatch
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Resetting password...
                </>
              ) : (
                <>
                  <LockKeyhole className="h-5 w-5" />
                  Reset password
                </>
              )}
            </button>
          </form>

          {/* TOKEN WARNING */}
          {!token && (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm leading-5 text-amber-800">
                This page requires a valid password
                reset link. Please request a new link
                from the password recovery page.
              </p>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <p className="mt-6 text-center text-xs text-slate-500">
          Secure password recovery powered by LegalVault
        </p>
      </div>
    </main>
  );
}

// ------------------------------------------------------------
// PASSWORD REQUIREMENT COMPONENT
// ------------------------------------------------------------

function Requirement({
  valid,
  text,
}: {
  valid: boolean;
  text: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
          valid
            ? "bg-emerald-500 text-white"
            : "bg-slate-200 text-slate-400"
        }`}
      >
        {valid ? "✓" : ""}
      </span>

      <span
        className={
          valid
            ? "text-emerald-700"
            : "text-slate-500"
        }
      >
        {text}
      </span>
    </div>
  );
}