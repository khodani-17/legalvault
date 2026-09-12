import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Mail,
  ShieldCheck,
  UserCircle,
} from "lucide-react";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function AccountSettingsPage() {
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
      name: true,
      email: true,
      role: true,
      status: true,
      firmId: true,
      firm: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!user || user.status !== "ACTIVE" || !user.firmId || !user.firm) {
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
            Account
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            View your LegalVault account information and account status.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">

          {/* Personal Information */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                <UserCircle className="h-5 w-5 text-slate-700" />
              </div>

              <div>
                <h2 className="font-semibold text-slate-900">
                  Personal Information
                </h2>

                <p className="text-xs text-slate-500">
                  Your LegalVault account details
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-5">

              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Full Name
                </p>

                <p className="mt-1 text-sm font-medium text-slate-900">
                  {user.name}
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-slate-400" />

                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    Email Address
                  </p>
                </div>

                <p className="mt-1 text-sm font-medium text-slate-900">
                  {user.email}
                </p>
              </div>

            </div>
          </section>

          {/* Firm */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                <Building2 className="h-5 w-5 text-slate-700" />
              </div>

              <div>
                <h2 className="font-semibold text-slate-900">
                  Firm
                </h2>

                <p className="text-xs text-slate-500">
                  Your LegalVault organisation
                </p>
              </div>
            </div>

            <div className="mt-6">

              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Firm Name
              </p>

              <p className="mt-1 text-sm font-medium text-slate-900">
                {user.firm.name}
              </p>

            </div>
          </section>

          {/* Role */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                <ShieldCheck className="h-5 w-5 text-slate-700" />
              </div>

              <div>
                <h2 className="font-semibold text-slate-900">
                  Access Role
                </h2>

                <p className="text-xs text-slate-500">
                  Your current LegalVault role
                </p>
              </div>
            </div>

            <div className="mt-6">
              <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                {user.role}
              </span>
            </div>
          </section>

          {/* Status */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
              </div>

              <div>
                <h2 className="font-semibold text-slate-900">
                  Account Status
                </h2>

                <p className="text-xs text-slate-500">
                  Current account state
                </p>
              </div>
            </div>

            <div className="mt-6">
              <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">
                {user.status}
              </span>
            </div>
          </section>

        </div>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-slate-900">
            Account Management
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Your account identity, role and access permissions are controlled
            by LegalVault's authentication and firm-level access controls.
            Changes to user roles and firm membership are managed through
            Users &amp; Roles.
          </p>

          <div className="mt-4">
            <Link
              href="/dashboard/users"
              className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Users &amp; Roles
            </Link>
          </div>
        </section>

      </div>
    </main>
  );
}