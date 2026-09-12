"use client";

import {
  FormEvent,
  Suspense,
  useState,
} from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

function getSafeCallbackUrl(
  callbackUrl: string | null,
): string {
  if (
    callbackUrl &&
    callbackUrl.startsWith("/") &&
    !callbackUrl.startsWith("//")
  ) {
    return callbackUrl;
  }

  return "/dashboard";
}

function LoginForm() {
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (loading) {
      return;
    }

    setError("");
    setLoading(true);

    const callbackUrl = getSafeCallbackUrl(
      searchParams.get("callbackUrl"),
    );

    try {
      const result = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
        callbackUrl,
      });

      if (!result || result.error) {
        setError("Invalid email or password.");
        setLoading(false);
        return;
      }

      if (result.url) {
        window.location.href = result.url;
        return;
      }

      window.location.href = callbackUrl;
    } catch {
      setError(
        "Unable to sign in right now. Please try again.",
      );

      setLoading(false);
    }
  }

  return (
    <main
      className="relative flex min-h-screen items-center justify-center bg-slate-950 bg-cover bg-center bg-no-repeat px-6 py-10"
      style={{
        backgroundImage:
          "url('/images/legal%20vault.png')",
      }}
    >
      {/* Background overlay */}
      <div className="absolute inset-0 bg-slate-950/65" />

      {/* Login card */}
      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-2xl border border-white/20 bg-white/95 p-8 shadow-2xl backdrop-blur-sm">

          {/* Logo / Brand */}
          <div className="mb-8 text-center">
            <p className="text-sm font-bold tracking-[0.25em] text-blue-700">
              LEGALVAULT
            </p>

            <h1 className="mt-3 text-3xl font-bold text-slate-900">
              Welcome back
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Sign in to access your secure law firm
              document management system.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700"
              >
                Email address
              </label>

              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                placeholder="you@lawfirm.co.za"
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-slate-700"
                >
                  Password
                </label>

                <a
                  href="/forgot-password"
                  className="text-sm font-medium text-blue-700 hover:text-blue-900 hover:underline"
                >
                  Forgot password?
                </a>
              </div>

              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                placeholder="Enter your password"
              />
            </div>

            {/* Sign in */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? "Signing in..."
                : "Sign in"}
            </button>
          </form>

          {/* Sign up */}
          <div className="mt-6 text-center">
            <p className="text-sm text-slate-500">
              Don't have a LegalVault account?{" "}
              <a
                href="/signup"
                className="font-semibold text-blue-700 hover:text-blue-900 hover:underline"
              >
                Create an account
              </a>
            </p>
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

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main
          className="flex min-h-screen items-center justify-center bg-slate-950 bg-cover bg-center px-6"
          style={{
            backgroundImage:
              "url('/images/legal%20vault.png')",
          }}
        >
          <div className="absolute inset-0 bg-slate-950/65" />

          <div className="relative z-10 w-full max-w-md">
            <div className="rounded-2xl bg-white/95 p-8 text-center shadow-2xl backdrop-blur-sm">
              <p className="text-sm font-bold tracking-[0.25em] text-blue-700">
                LEGALVAULT
              </p>

              <p className="mt-4 text-sm text-slate-500">
                Loading sign in...
              </p>
            </div>
          </div>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}