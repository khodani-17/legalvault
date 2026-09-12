import { NextResponse } from "next/server";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { cancelPayFastSubscription } from "@/lib/payfast/api";

function getBaseUrl() {
  return (
    process.env.NEXTAUTH_URL ??
    process.env.AUTH_URL ??
    "http://localhost:3000"
  );
}

export async function GET() {
  // ----------------------------------------------------------
  // AUTHENTICATION
  // ----------------------------------------------------------

  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  // ----------------------------------------------------------
  // REVALIDATE USER FROM DATABASE
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
  // FINANCE-ONLY BILLING ACTION
  // ----------------------------------------------------------

  if (user.role !== "FINANCE") {
    redirect("/dashboard/settings");
  }

  // ----------------------------------------------------------
  // LOAD CURRENT SUBSCRIPTION
  // ----------------------------------------------------------

  const subscription = await prisma.subscription.findUnique({
    where: {
      firmId: user.firmId,
    },
    select: {
      id: true,
      firmId: true,
      plan: true,
      status: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
      provider: true,
      providerSubscriptionId: true,
    },
  });

  if (!subscription || subscription.firmId !== user.firmId) {
    redirect("/dashboard/settings/subscription");
  }

  // ----------------------------------------------------------
  // VALIDATE CURRENT SUBSCRIPTION STATE
  // ----------------------------------------------------------

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
  // CANCEL PAYFAST SUBSCRIPTION
  // ----------------------------------------------------------
  //
  // PayFast is contacted BEFORE our local database is changed.
  //
  // If PayFast rejects the cancellation, the local subscription
  // remains unchanged.
  //

  try {
    await cancelPayFastSubscription(
      subscription.providerSubscriptionId,
    );
  } catch (error) {
    console.error(
      "PayFast subscription cancellation failed:",
      error,
    );

    return NextResponse.redirect(
      new URL(
        "/dashboard/settings/subscription?cancel=failed",
        getBaseUrl(),
      ),
    );
  }

  // ----------------------------------------------------------
  // UPDATE LOCAL SUBSCRIPTION
  // ----------------------------------------------------------
  //
  // The subscription remains ACTIVE because the customer should
  // retain access until currentPeriodEnd.
  //
  // cancelAtPeriodEnd=true tells LegalVault that cancellation
  // has been scheduled.
  //

  const updated = await prisma.subscription.updateMany({
    where: {
      id: subscription.id,
      firmId: user.firmId,
      status: "ACTIVE",
      cancelAtPeriodEnd: false,
      provider: "PAYFAST",
      providerSubscriptionId:
        subscription.providerSubscriptionId,
    },
    data: {
      cancelAtPeriodEnd: true,
    },
  });

  // ----------------------------------------------------------
  // CONCURRENCY SAFETY
  // ----------------------------------------------------------
  //
  // If another request changed the subscription between the
  // initial validation and this update, do not silently claim
  // that the local state was updated.
  //

  if (updated.count !== 1) {
    console.error(
      "PayFast cancellation succeeded, but the local subscription could not be updated.",
    );

    return NextResponse.redirect(
      new URL(
        "/dashboard/settings/subscription?cancel=sync_error",
        getBaseUrl(),
      ),
    );
  }

  // ----------------------------------------------------------
  // AUDIT LOG
  // ----------------------------------------------------------

  try {
    await prisma.auditLog.create({
      data: {
        firmId: user.firmId,
        userId: user.id,
        action: "UPDATE",
        entityType: "Subscription",
        entityId: subscription.id,
        description:
          "Subscription cancellation scheduled through PayFast.",
        metadata: {
          event: "SUBSCRIPTION_CANCELLATION_SCHEDULED",
          plan: subscription.plan,
          provider: "PAYFAST",
          currentPeriodEnd:
            subscription.currentPeriodEnd?.toISOString() ?? null,
          cancelAtPeriodEnd: true,
        },
      },
    });
  } catch (error) {
    // The PayFast cancellation and local subscription update
    // have already succeeded. Do not reverse them because
    // an audit record failed.
    console.error(
      "Subscription cancellation audit failed:",
      error,
    );
  }

  // ----------------------------------------------------------
  // SUCCESS
  // ----------------------------------------------------------

  return NextResponse.redirect(
    new URL(
      "/dashboard/settings/subscription?cancel=scheduled",
      getBaseUrl(),
    ),
  );
}