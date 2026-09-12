import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CreditCard,
  ShieldCheck,
} from "lucide-react";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

function formatDate(date: Date | null) {
  if (!date) {
    return "the end of the current billing period";
  }

  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function getPlanLabel(plan: string) {
  switch (plan) {
    case "STARTER":
      return "Starter";

    case "PROFESSIONAL":
      return "Professional";

    case "ENTERPRISE":
      return "Enterprise";

    case "TRIAL":
      return "Free Trial";

    default:
      return plan;
  }
}

export default async function CancelSubscriptionPage() {
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
  // FINANCE-ONLY ACCESS
  // ----------------------------------------------------------

  if (user.role !== "FINANCE") {
    redirect("/dashboard/settings");
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
      id: true,
      plan: true,
      status: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
      provider: true,
      providerSubscriptionId: true,
    },
  });

  // ----------------------------------------------------------
  // SUBSCRIPTION VALIDATION
  // ----------------------------------------------------------

  if (!subscription) {
    redirect("/dashboard/settings/subscription");
  }

  if (subscription.status !== "ACTIVE") {
    redirect("/dashboard/settings/subscription");
  }

  if (subscription.cancelAtPeriodEnd) {
    redirect("/dashboard/settings/subscription");
  }

  if (
    subscription.provider !== "PAYFAST" ||
    !subscription.providerSubscriptionId
  ) {
    redirect("/dashboard/settings/subscription");
  }

  // ----------------------------------------------------------
  // PAGE
  // ----------------------------------------------------------

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="mx-auto max-w-3xl">

        {/* --------------------------------------------------
            BACK
        -------------------------------------------------- */}

        <Link
          href="/dashboard/settings/subscription"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Subscription
        </Link>

        {/* --------------------------------------------------
            WARNING
        -------------------------------------------------- */}

        <section className="overflow-hidden rounded-xl border border-red-200 bg-white shadow-sm">

          <div className="border-b border-red-100 bg-red-50 p-6">
            <div className="flex items-start gap-4">

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-red-100">
                <AlertTriangle className="h-6 w-6 text-red-700" />
              </div>

              <div>
                <h1 className="text-2xl font-bold text-red-900">
                  Cancel Subscription
                </h1>

                <p className="mt-2 text-sm leading-6 text-red-800">
                  You are about to schedule the cancellation of your
                  LegalVault subscription for{" "}
                  <span className="font-semibold">
                    {firm.name}
                  </span>
                  .
                </p>
              </div>

            </div>
          </div>

          {/* ------------------------------------------------
              SUBSCRIPTION DETAILS
          ------------------------------------------------ */}

          <div className="p-6">

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">

              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-slate-600" />

                <h2 className="font-semibold text-slate-900">
                  Subscription Details
                </h2>
              </div>

              <div className="mt-5 grid gap-5 sm:grid-cols-2">

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Current Plan
                  </p>

                  <p className="mt-1 font-medium text-slate-900">
                    {getPlanLabel(subscription.plan)}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Status
                  </p>

                  <p className="mt-1 font-medium text-emerald-600">
                    Active
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Payment Provider
                  </p>

                  <p className="mt-1 font-medium text-slate-900">
                    PayFast
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Access Until
                  </p>

                  <p className="mt-1 font-medium text-slate-900">
                    {formatDate(subscription.currentPeriodEnd)}
                  </p>
                </div>

              </div>

            </div>

            {/* ------------------------------------------------
                WHAT HAPPENS
            ------------------------------------------------ */}

            <div className="mt-6">

              <h2 className="text-lg font-semibold text-slate-900">
                What happens when you cancel?
              </h2>

              <div className="mt-4 space-y-4">

                <div className="flex gap-3">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                    1
                  </div>

                  <p className="text-sm leading-6 text-slate-600">
                    Your PayFast recurring subscription will be
                    cancelled.
                  </p>
                </div>

                <div className="flex gap-3">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                    2
                  </div>

                  <p className="text-sm leading-6 text-slate-600">
                    Your LegalVault subscription will remain active
                    until the end of the current billing period.
                  </p>
                </div>

                <div className="flex gap-3">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                    3
                  </div>

                  <p className="text-sm leading-6 text-slate-600">
                    After the billing period ends, the subscription
                    will become cancelled and access to the paid
                    LegalVault service will end.
                  </p>
                </div>

                <div className="flex gap-3">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                    4
                  </div>

                  <p className="text-sm leading-6 text-slate-600">
                    You can subscribe again later through a new
                    checkout if you decide to return.
                  </p>
                </div>

              </div>

            </div>

            {/* ------------------------------------------------
                SECURITY NOTICE
            ------------------------------------------------ */}

            <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-5">

              <div className="flex items-start gap-3">

                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-slate-700" />

                <div>
                  <h3 className="font-semibold text-slate-900">
                    Secure cancellation
                  </h3>

                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Cancellation requires confirmation and is
                    processed securely on the server. Your PayFast
                    subscription token is never exposed to the
                    browser.
                  </p>
                </div>

              </div>

            </div>

            {/* ------------------------------------------------
                ACTIONS
            ------------------------------------------------ */}

            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">

              <Link
                href="/dashboard/settings/subscription"
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Keep Subscription
              </Link>

              <Link
                href="/dashboard/settings/subscription/cancel/confirm"
                className="inline-flex items-center justify-center rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Continue Cancellation
              </Link>

            </div>

          </div>

        </section>

      </div>
    </main>
  );
}