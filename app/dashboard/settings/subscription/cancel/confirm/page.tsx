import Link from "next/link";
import { AlertTriangle, ArrowLeft, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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

export default async function ConfirmCancelSubscriptionPage() {
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

  // Billing actions are strictly Finance-only.
  if (user.role !== "FINANCE") {
    redirect("/dashboard/settings");
  }

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

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="mx-auto max-w-2xl">

        {/* Back */}
        <Link
          href="/dashboard/settings/subscription/cancel"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <section className="overflow-hidden rounded-xl border border-red-200 bg-white shadow-sm">

          {/* Header */}
          <div className="border-b border-red-100 bg-red-50 px-6 py-7">
            <div className="flex items-start gap-4">

              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-6 w-6 text-red-700" />
              </div>

              <div>
                <h1 className="text-2xl font-bold text-red-900">
                  Confirm Subscription Cancellation
                </h1>

                <p className="mt-2 text-sm leading-6 text-red-800">
                  Please review the information below before confirming
                  the cancellation of the LegalVault subscription for{" "}
                  <span className="font-semibold">
                    {firm.name}
                  </span>
                  .
                </p>
              </div>

            </div>
          </div>

          <div className="p-6">

            {/* Subscription summary */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">

              <h2 className="font-semibold text-slate-900">
                Subscription Summary
              </h2>

              <dl className="mt-5 space-y-4">

                <div className="flex items-center justify-between gap-4">
                  <dt className="text-sm text-slate-500">
                    Current plan
                  </dt>

                  <dd className="text-sm font-semibold text-slate-900">
                    {getPlanLabel(subscription.plan)}
                  </dd>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <dt className="text-sm text-slate-500">
                    Current status
                  </dt>

                  <dd className="text-sm font-semibold text-emerald-600">
                    Active
                  </dd>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <dt className="text-sm text-slate-500">
                    Payment provider
                  </dt>

                  <dd className="text-sm font-semibold text-slate-900">
                    PayFast
                  </dd>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <dt className="text-sm text-slate-500">
                    Access remains available until
                  </dt>

                  <dd className="text-right text-sm font-semibold text-slate-900">
                    {formatDate(subscription.currentPeriodEnd)}
                  </dd>
                </div>

              </dl>

            </div>

            {/* Important information */}
            <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-5">

              <div className="flex items-start gap-3">

                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />

                <div>
                  <h2 className="font-semibold text-amber-900">
                    Important
                  </h2>

                  <div className="mt-2 space-y-2 text-sm leading-6 text-amber-800">

                    <p>
                      Cancelling your subscription will stop the
                      PayFast recurring subscription.
                    </p>

                    <p>
                      Your LegalVault access will remain active until
                      the end of your current billing period.
                    </p>

                    <p>
                      This action cannot be undone through PayFast.
                      If you want LegalVault again later, you will
                      need to start a new subscription checkout.
                    </p>

                  </div>
                </div>

              </div>

            </div>

            {/* Security */}
            <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5">

              <div className="flex items-start gap-3">

                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-slate-700" />

                <div>
                  <h2 className="font-semibold text-slate-900">
                    Secure cancellation
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Your cancellation request will be verified again
                    on the server before any action is taken. The
                    PayFast subscription token is never sent to the
                    browser.
                  </p>
                </div>

              </div>

            </div>

            {/* Confirmation */}
            <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-5">

              <h2 className="font-semibold text-slate-900">
                Final confirmation
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                By continuing, you confirm that you want to cancel the
                recurring PayFast subscription for{" "}
                <span className="font-semibold text-slate-900">
                  {firm.name}
                </span>
                .
              </p>

            </div>

            {/* Actions */}
            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">

              <Link
                href="/dashboard/settings/subscription"
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Keep Subscription
              </Link>

              <Link
                href="/dashboard/settings/subscription/cancel/confirm/process"
                className="inline-flex items-center justify-center rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Yes, Cancel Subscription
              </Link>

            </div>

          </div>
        </section>
      </div>
    </main>
  );
}