import Link from "next/link";
import {
  Building2,
  UserCircle,
  Bell,
  ShieldCheck,
  Users,
  CreditCard,
  ChevronRight,
} from "lucide-react";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const session = await auth();

  // ----------------------------------------------------------
  // AUTHENTICATION
  // ----------------------------------------------------------

  if (!session?.user?.id) {
    redirect("/login");
  }

  // ----------------------------------------------------------
  // GET CURRENT USER
  // ----------------------------------------------------------

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
    },
  });

  if (!user || user.status !== "ACTIVE" || !user.firmId) {
    redirect("/login");
  }

  // ----------------------------------------------------------
  // GET FIRM
  // ----------------------------------------------------------

  const firm = await prisma.firm.findUnique({
    where: {
      id: user.firmId,
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!firm) {
    redirect("/login");
  }

  // ----------------------------------------------------------
  // GET SUBSCRIPTION
  // ----------------------------------------------------------

  const subscription = await prisma.subscription.findUnique({
    where: {
      firmId: user.firmId,
    },
    select: {
      plan: true,
      status: true,
      currentPeriodStart: true,
      currentPeriodEnd: true,
      trialEndsAt: true,
      cancelAtPeriodEnd: true,
    },
  });

  // ----------------------------------------------------------
  // FINANCE ACCESS
  // ----------------------------------------------------------

  const isFinanceUser = user.role === "FINANCE";

  // ----------------------------------------------------------
  // SETTINGS SECTIONS
  // ----------------------------------------------------------

  const settingsSections = [
    {
      title: "Firm Settings",
      description:
        "Manage your firm's profile, contact information and organisation details.",
      href: "/dashboard/firm",
      icon: Building2,
    },
    {
      title: "Account",
      description:
        "Manage your personal profile, email address and account security.",
      href: "/dashboard/settings/account",
      icon: UserCircle,
    },
    {
      title: "Notifications",
      description:
        "Manage how LegalVault keeps you informed about important activity.",
      href: "/dashboard/settings/notifications",
      icon: Bell,
    },
    {
      title: "Security",
      description:
        "Review account security information and access controls.",
      href: "/dashboard/settings/security",
      icon: ShieldCheck,
    },
    {
      title: "Users & Roles",
      description:
        "Manage users, roles and access to your LegalVault firm.",
      href: "/dashboard/users",
      icon: Users,
    },
  ];

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="mx-auto max-w-6xl">

        {/* --------------------------------------------------
            HEADER
        -------------------------------------------------- */}

        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Settings
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            Manage your LegalVault account, firm and subscription settings.
          </p>
        </div>

        {/* --------------------------------------------------
            FIRM SUMMARY
        -------------------------------------------------- */}

        <section className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Current Firm
              </p>

              <h2 className="mt-1 text-xl font-semibold text-slate-900">
                {firm.name}
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Signed in as{" "}
                <span className="font-medium text-slate-700">
                  {user.email}
                </span>
              </p>
            </div>

            <div className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
              {user.role}
            </div>

          </div>
        </section>

        {/* --------------------------------------------------
            SETTINGS
        -------------------------------------------------- */}

        <div className="grid gap-4 md:grid-cols-2">

          {settingsSections.map((section) => {
            const Icon = section.icon;

            return (
              <Link
                key={section.title}
                href={section.href}
                className="group rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between">

                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100">
                    <Icon className="h-5 w-5 text-slate-700" />
                  </div>

                  <ChevronRight className="h-5 w-5 text-slate-400 transition group-hover:translate-x-1 group-hover:text-slate-700" />

                </div>

                <h3 className="mt-5 text-lg font-semibold text-slate-900">
                  {section.title}
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {section.description}
                </p>
              </Link>
            );
          })}

          {/* ------------------------------------------------
              SUBSCRIPTION & BILLING
          ------------------------------------------------ */}

          {isFinanceUser && (
            <Link
              href="/dashboard/settings/subscription"
              className="group rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow-md"
            >
              <div className="flex items-start justify-between">

                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100">
                  <CreditCard className="h-5 w-5 text-slate-700" />
                </div>

                <ChevronRight className="h-5 w-5 text-slate-400 transition group-hover:translate-x-1 group-hover:text-slate-700" />

              </div>

              <h3 className="mt-5 text-lg font-semibold text-slate-900">
                Subscription & Billing
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Manage your LegalVault subscription, billing period,
                payment history, cancellation and renewal.
              </p>

              {subscription && (
                <div className="mt-4 flex flex-wrap gap-2">

                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                    {subscription.plan}
                  </span>

                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                    {subscription.status}
                  </span>

                  {subscription.cancelAtPeriodEnd && (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                      Cancellation scheduled
                    </span>
                  )}

                </div>
              )}

            </Link>
          )}

        </div>

        {/* --------------------------------------------------
            ACCOUNT INFORMATION
        -------------------------------------------------- */}

        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">

          <h2 className="text-lg font-semibold text-slate-900">
            Account Information
          </h2>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">

            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Name
              </p>

              <p className="mt-1 text-sm text-slate-900">
                {user.name}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Email
              </p>

              <p className="mt-1 text-sm text-slate-900">
                {user.email}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Role
              </p>

              <p className="mt-1 text-sm text-slate-900">
                {user.role}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Account Status
              </p>

              <p className="mt-1 text-sm font-medium text-emerald-600">
                {user.status}
              </p>
            </div>

          </div>

        </section>

      </div>
    </main>
  );
}