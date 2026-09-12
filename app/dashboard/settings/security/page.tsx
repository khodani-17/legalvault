import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function SecuritySettingsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      firmId: true,
    },
  });

  if (!user || user.status !== "ACTIVE" || !user.firmId) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="mx-auto max-w-5xl">

        <div className="mb-8">
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Settings
          </Link>

          <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-900">
            Security
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            Review the security controls protecting your LegalVault account.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">

          {/* Authentication */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                <LockKeyhole className="h-5 w-5 text-slate-700" />
              </div>

              <div>
                <h2 className="font-semibold text-slate-900">
                  Authentication
                </h2>

                <p className="text-xs text-slate-500">
                  Account authentication controls
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4">

              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />

                <div>
                  <p className="font-medium text-slate-900">
                    Authenticated account
                  </p>

                  <p className="mt-1 text-sm text-slate-600">
                    Your current account is authenticated through LegalVault's
                    authentication system.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />

                <div>
                  <p className="font-medium text-slate-900">
                    Active account verification
                  </p>

                  <p className="mt-1 text-sm text-slate-600">
                    Your account is checked against your active firm membership
                    when accessing protected areas.
                  </p>
                </div>
              </div>

            </div>
          </section>

          {/* Password */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                <KeyRound className="h-5 w-5 text-slate-700" />
              </div>

              <div>
                <h2 className="font-semibold text-slate-900">
                  Password Security
                </h2>

                <p className="text-xs text-slate-500">
                  Protecting your account credentials
                </p>
              </div>
            </div>

            <div className="mt-6">

              <p className="text-sm leading-6 text-slate-600">
                Your password is protected by LegalVault's authentication
                system and is not displayed or exposed through your account
                settings.
              </p>

              <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-900">
                  Account
                </p>

                <p className="mt-1 text-sm text-slate-600">
                  {user.email}
                </p>
              </div>

            </div>
          </section>

          {/* Access Control */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                <ShieldCheck className="h-5 w-5 text-slate-700" />
              </div>

              <div>
                <h2 className="font-semibold text-slate-900">
                  Access Control
                </h2>

                <p className="text-xs text-slate-500">
                  Role-based access
                </p>
              </div>
            </div>

            <div className="mt-6">

              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Current Role
              </p>

              <p className="mt-2 text-sm font-semibold text-slate-900">
                {user.role}
              </p>

              <p className="mt-3 text-sm leading-6 text-slate-600">
                Access to LegalVault features is controlled according to your
                firm's role and permission structure.
              </p>

            </div>
          </section>

          {/* Security Status */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>

              <div>
                <h2 className="font-semibold text-slate-900">
                  Security Status
                </h2>

                <p className="text-xs text-slate-500">
                  Current account state
                </p>
              </div>
            </div>

            <div className="mt-6">

              <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">
                ACTIVE
              </span>

              <p className="mt-3 text-sm leading-6 text-slate-600">
                Your LegalVault account is currently active and associated with
                your firm.
              </p>

            </div>
          </section>

        </div>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">

          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-slate-700" />

            <div>
              <h2 className="font-semibold text-slate-900">
                Security Reminder
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Never share your LegalVault password or authentication
                credentials with another person. Always log out when using a
                shared or public computer.
              </p>
            </div>
          </div>

        </section>

      </div>
    </main>
  );
}