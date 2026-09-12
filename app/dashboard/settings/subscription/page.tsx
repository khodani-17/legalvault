import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type SearchParams = {
  cancel?: string;
};

function formatDate(date: Date | null) {
  if (!date) {
    return "—";
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

function getStatusLabel(status: string) {
  switch (status) {
    case "ACTIVE":
      return "Active";

    case "CANCELLED":
      return "Cancelled";

    case "PAST_DUE":
      return "Past Due";

    case "PENDING_PAYMENT":
      return "Pending Payment";

    default:
      return status;
  }
}

export default async function SubscriptionSettingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const session = await auth();

  // ----------------------------------------------------------
  // AUTHENTICATION
  // ----------------------------------------------------------

  if (!session?.user?.id) {
    redirect("/login");
  }

  // ----------------------------------------------------------
  // REVALIDATE USER
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
  // FINANCE-ONLY BILLING ACCESS
  // ----------------------------------------------------------

  if (user.role !== "FINANCE") {
    redirect("/dashboard/settings");
  }

  // ----------------------------------------------------------
  // FIRM
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
  // SUBSCRIPTION
  // ----------------------------------------------------------

  const subscription = await prisma.subscription.findUnique({
    where: {
      firmId: user.firmId,
    },
    select: {
      id: true,
      plan: true,
      status: true,
      currentPeriodStart: true,
      currentPeriodEnd: true,
      trialEndsAt: true,
      cancelledAt: true,
      cancelAtPeriodEnd: true,
      provider: true,
      providerCustomerId: true,
      providerSubscriptionId: true,
    },
  });

  // ----------------------------------------------------------
  // RESULT MESSAGE
  // ----------------------------------------------------------

  const showScheduled =
    params.cancel === "scheduled";

  const showFailed =
    params.cancel === "failed";

  const showSyncError =
    params.cancel === "sync_error";

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="mx-auto max-w-5xl">

        {/* --------------------------------------------------
            BACK
        -------------------------------------------------- */}

        <Link
          href="/dashboard/settings"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </Link>

        {/* --------------------------------------------------
            HEADER
        -------------------------------------------------- */}

        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Subscription & Billing
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Manage the LegalVault subscription for{" "}
            <span className="font-semibold text-slate-900">
              {firm.name}
            </span>
            .
          </p>
        </div>

        {/* --------------------------------------------------
            SUCCESS MESSAGE
        -------------------------------------------------- */}

        {showScheduled && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-start gap-3">

              <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-700" />

              <div>
                <h2 className="font-semibold text-emerald-900">
                  Cancellation scheduled
                </h2>

                <p className="mt-1 text-sm leading-6 text-emerald-800">
                  Your PayFast recurring subscription has been
                  cancelled. LegalVault access will remain available
                  until the end of the current billing period.
                </p>
              </div>

            </div>
          </div>
        )}

        {/* --------------------------------------------------
            FAILED MESSAGE
        -------------------------------------------------- */}

        {showFailed && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-5">
            <div className="flex items-start gap-3">

              <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-red-700" />

              <div>
                <h2 className="font-semibold text-red-900">
                  Cancellation failed
                </h2>

                <p className="mt-1 text-sm leading-6 text-red-800">
                  PayFast did not confirm the cancellation. Your
                  LegalVault subscription has not been marked for
                  cancellation.
                </p>
              </div>

            </div>
          </div>
        )}

        {/* --------------------------------------------------
            SYNC ERROR
        -------------------------------------------------- */}

        {showSyncError && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-start gap-3">

              <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-amber-700" />

              <div>
                <h2 className="font-semibold text-amber-900">
                  Subscription synchronization requires attention
                </h2>

                <p className="mt-1 text-sm leading-6 text-amber-800">
                  PayFast confirmed the cancellation, but LegalVault
                  could not update the local subscription state.
                  Do not attempt another cancellation until the
                  subscription has been reviewed.
                </p>
              </div>

            </div>
          </div>
        )}

        {subscription ? (
          <div className="space-y-6">

            {/* ------------------------------------------------
                CURRENT SUBSCRIPTION
            ------------------------------------------------ */}

            <section className="rounded-xl border border-slate-200 bg-white shadow-sm">

              <div className="border-b border-slate-200 p-6">

                <div className="flex items-start justify-between gap-4">

                  <div className="flex items-start gap-4">

                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100">
                      <CreditCard className="h-5 w-5 text-slate-700" />
                    </div>

                    <div>
                      <h2 className="text-xl font-semibold text-slate-900">
                        Current Subscription
                      </h2>

                      <p className="mt-1 text-sm text-slate-500">
                        Your firm's current LegalVault subscription.
                      </p>
                    </div>

                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      subscription.status === "ACTIVE"
                        ? "bg-emerald-100 text-emerald-700"
                        : subscription.status === "CANCELLED"
                          ? "bg-red-100 text-red-700"
                          : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {getStatusLabel(subscription.status)}
                  </span>

                </div>

              </div>

              <div className="p-6">

                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Plan
                    </p>

                    <p className="mt-1 text-base font-semibold text-slate-900">
                      {getPlanLabel(subscription.plan)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Billing Provider
                    </p>

                    <p className="mt-1 text-base font-semibold text-slate-900">
                      {subscription.provider ?? "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Current Period
                    </p>

                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {formatDate(subscription.currentPeriodStart)}
                      {" — "}
                      {formatDate(subscription.currentPeriodEnd)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Trial Ends
                    </p>

                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {formatDate(subscription.trialEndsAt)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Cancelled At
                    </p>

                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {formatDate(subscription.cancelledAt)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Cancellation
                    </p>

                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {subscription.cancelAtPeriodEnd
                        ? "Scheduled"
                        : "Not scheduled"}
                    </p>
                  </div>

                </div>

              </div>
            </section>

            {/* ------------------------------------------------
                CANCELLATION SCHEDULED
            ------------------------------------------------ */}

            {subscription.cancelAtPeriodEnd &&
              subscription.status === "ACTIVE" && (
                <section className="rounded-xl border border-amber-200 bg-amber-50 p-6">

                  <div className="flex items-start gap-3">

                    <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-amber-700" />

                    <div>
                      <h2 className="font-semibold text-amber-900">
                        Cancellation scheduled
                      </h2>

                      <p className="mt-2 text-sm leading-6 text-amber-800">
                        Your recurring PayFast subscription has been
                        cancelled. Your LegalVault access remains
                        active until{" "}
                        <span className="font-semibold">
                          {formatDate(
                            subscription.currentPeriodEnd,
                          )}
                        </span>
                        .
                      </p>

                      <p className="mt-2 text-sm leading-6 text-amber-800">
                        After that date, the subscription will be
                        marked as cancelled.
                      </p>

                    </div>

                  </div>

                </section>
              )}

            {/* ------------------------------------------------
                CANCEL SUBSCRIPTION
            ------------------------------------------------ */}

            {subscription.status === "ACTIVE" &&
              !subscription.cancelAtPeriodEnd &&
              subscription.provider === "PAYFAST" &&
              subscription.providerSubscriptionId && (
                <section className="rounded-xl border border-red-200 bg-white shadow-sm">

                  <div className="p-6">

                    <h2 className="text-lg font-semibold text-slate-900">
                      Cancel Subscription
                    </h2>

                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                      Cancelling will stop the PayFast recurring
                      subscription. Your firm's LegalVault access
                      will remain active until the end of the current
                      billing period.
                    </p>

                    <div className="mt-5">

                      <Link
                        href="/dashboard/settings/subscription/cancel"
                        className="inline-flex items-center justify-center rounded-lg border border-red-300 bg-white px-5 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50"
                      >
                        Cancel Subscription
                      </Link>

                    </div>

                  </div>

                </section>
              )}

            {/* ------------------------------------------------
                CANCELLED SUBSCRIPTION
            ------------------------------------------------ */}

            {subscription.status === "CANCELLED" && (
              <section className="rounded-xl border border-slate-200 bg-white shadow-sm">

                <div className="p-6">

                  <h2 className="text-lg font-semibold text-slate-900">
                    Subscription Cancelled
                  </h2>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                    This firm's LegalVault subscription has been
                    cancelled. You can start a new subscription
                    through a new checkout.
                  </p>

                  <div className="mt-5">

                    <Link
                      href="/signup/payment"
                      className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      Renew Subscription
                    </Link>

                  </div>

                </div>

              </section>
            )}

            {/* ------------------------------------------------
                SECURITY
            ------------------------------------------------ */}

            <section className="rounded-xl border border-slate-200 bg-slate-50 p-6">

              <div className="flex items-start gap-3">

                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-slate-700" />

                <div>

                  <h2 className="font-semibold text-slate-900">
                    Billing Security
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Subscription management is restricted to
                    authorized Finance users. PayFast credentials,
                    subscription tokens, and payment secrets are
                    processed server-side and are never exposed in
                    the browser.
                  </p>

                </div>

              </div>

            </section>

          </div>
        ) : (
          <section className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">

            <h2 className="text-lg font-semibold text-slate-900">
              No subscription found
            </h2>

            <p className="mt-2 text-sm text-slate-600">
              There is currently no subscription associated with this
              firm.
            </p>

          </section>
        )}

      </div>
    </main>
  );
}