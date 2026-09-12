import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type PaidPlan =
  | "STARTER"
  | "PROFESSIONAL"
  | "ENTERPRISE";

const VALID_PLANS: readonly PaidPlan[] = [
  "STARTER",
  "PROFESSIONAL",
  "ENTERPRISE",
];

const FINANCE_ROLE = "FINANCE" as const;

function isValidPlan(
  value: unknown,
): value is PaidPlan {
  return (
    typeof value === "string" &&
    VALID_PLANS.includes(
      value as PaidPlan,
    )
  );
}

export async function POST(
  request: Request,
) {
  try {
    /*
     * ---------------------------------------------------------
     * 1. AUTHENTICATE
     * ---------------------------------------------------------
     */
    const session = await auth();

    const sessionUser = session?.user;

    if (!sessionUser?.id) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication is required.",
        },
        {
          status: 401,
        },
      );
    }

    /*
     * ---------------------------------------------------------
     * 2. REVALIDATE USER FROM DATABASE
     * ---------------------------------------------------------
     *
     * JWT/session values are not trusted for authorization.
     */
    const user =
      await prisma.user.findUnique({
        where: {
          id: sessionUser.id,
        },
        select: {
          id: true,
          status: true,
          role: true,
          firmId: true,
        },
      });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Authenticated user could not be found.",
        },
        {
          status: 401,
        },
      );
    }

    /*
     * ---------------------------------------------------------
     * 3. ACTIVE USER
     * ---------------------------------------------------------
     */
    if (user.status !== "ACTIVE") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Your account is not active.",
        },
        {
          status: 403,
        },
      );
    }

    /*
     * ---------------------------------------------------------
     * 4. FINANCE ONLY
     * ---------------------------------------------------------
     *
     * Subscription selection is strictly restricted to the
     * Finance role.
     */
    if (user.role !== FINANCE_ROLE) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Only Finance users are authorized to manage the firm's subscription.",
        },
        {
          status: 403,
        },
      );
    }

    /*
     * ---------------------------------------------------------
     * 5. FIRM MEMBERSHIP
     * ---------------------------------------------------------
     */
    const firmId = user.firmId;

    if (!firmId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Your account is not associated with a firm.",
        },
        {
          status: 403,
        },
      );
    }

    /*
     * ---------------------------------------------------------
     * 6. READ REQUEST
     * ---------------------------------------------------------
     */
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            "A subscription plan is required.",
        },
        {
          status: 400,
        },
      );
    }

    const selectedPlan =
      typeof body === "object" &&
      body !== null &&
      "plan" in body
        ? (body as {
            plan?: unknown;
          }).plan
        : undefined;

    if (!isValidPlan(selectedPlan)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Please select a valid LegalVault subscription plan.",
        },
        {
          status: 400,
        },
      );
    }

    const plan = selectedPlan;

    /*
     * ---------------------------------------------------------
     * 7. VERIFY FIRM
     * ---------------------------------------------------------
     */
    const firm =
      await prisma.firm.findUnique({
        where: {
          id: firmId,
        },
        select: {
          id: true,
        },
      });

    if (!firm) {
      return NextResponse.json(
        {
          success: false,
          error: "Firm could not be found.",
        },
        {
          status: 404,
        },
      );
    }

    /*
     * ---------------------------------------------------------
     * 8. LOAD FIRM SUBSCRIPTION
     * ---------------------------------------------------------
     */
    const subscription =
      await prisma.subscription.findUnique({
        where: {
          firmId,
        },
        select: {
          id: true,
          firmId: true,
          plan: true,
          status: true,
          trialEndsAt: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
          cancelledAt: true,
          cancelAtPeriodEnd: true,
          provider: true,
          providerCustomerId: true,
          providerSubscriptionId: true,
        },
      });

    if (!subscription) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Your firm does not have a subscription record.",
        },
        {
          status: 404,
        },
      );
    }

    /*
     * ---------------------------------------------------------
     * 9. EXPLICIT FIRM ISOLATION
     * ---------------------------------------------------------
     */
    if (subscription.firmId !== firmId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Subscription ownership could not be verified.",
        },
        {
          status: 403,
        },
      );
    }

    /*
     * ---------------------------------------------------------
     * 10. ACTIVE SUBSCRIPTION
     * ---------------------------------------------------------
     *
     * An already-active subscription must not be sent through
     * the initial payment-selection flow.
     */
    if (subscription.status === "ACTIVE") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Your firm already has an active subscription.",
        },
        {
          status: 409,
        },
      );
    }

    /*
     * ---------------------------------------------------------
     * 11. TRIAL -> PENDING PAYMENT
     * ---------------------------------------------------------
     *
     * A firm with a valid 14-day trial may choose a paid plan.
     *
     * The trial is NOT restarted.
     *
     * The existing trial dates are retained so that server-side
     * trial enforcement can still determine whether the firm is
     * within its original 14-day trial window if payment is
     * abandoned.
     *
     * The status changes to PENDING_PAYMENT because the existing
     * PayFast checkout endpoint intentionally accepts only
     * PENDING_PAYMENT subscriptions.
     */
    if (subscription.status === "TRIAL") {
      const now = new Date();

      /*
       * The trial must still be valid when the user attempts
       * to select a paid plan.
       */
      if (
        subscription.trialEndsAt &&
        subscription.trialEndsAt <= now
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Your 14-day free trial has ended. Please contact LegalVault support if you need assistance activating a paid subscription.",
          },
          {
            status: 409,
          },
        );
      }

      /*
       * A trial subscription should never already have a
       * PayFast recurring subscription token.
       */
      if (
        subscription.providerSubscriptionId
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "The trial subscription contains an unexpected PayFast subscription token. Payment cannot continue.",
          },
          {
            status: 409,
          },
        );
      }

      const updated =
        await prisma.subscription.updateMany({
          where: {
            id: subscription.id,
            firmId,
            status: "TRIAL",
            providerSubscriptionId: null,
          },
          data: {
            plan,

            /*
             * Payment has not yet been completed.
             */
            status: "PENDING_PAYMENT",

            /*
             * Trial dates are deliberately retained.
             *
             * They are not extended or restarted.
             */
            trialEndsAt:
              subscription.trialEndsAt,

            currentPeriodStart:
              subscription.currentPeriodStart,

            currentPeriodEnd:
              subscription.currentPeriodEnd,

            cancelledAt: null,
            cancelAtPeriodEnd: false,

            /*
             * There cannot be an active PayFast provider
             * subscription at this point.
             */
            provider:
              subscription.provider === "PAYFAST"
                ? null
                : subscription.provider,

            providerCustomerId:
              subscription.providerCustomerId,
          },
        });

      if (updated.count !== 1) {
        return NextResponse.json(
          {
            success: false,
            error:
              "The subscription changed while payment was being prepared. Please try again.",
          },
          {
            status: 409,
          },
        );
      }

      return NextResponse.json(
        {
          success: true,
          nextStep: "PAYMENT",
          subscription: {
            id: subscription.id,
            plan,
            status: "PENDING_PAYMENT",
          },
        },
        {
          status: 200,
        },
      );
    }

    /*
     * ---------------------------------------------------------
     * 12. PENDING PAYMENT
     * ---------------------------------------------------------
     *
     * This supports:
     *
     * TRIAL
     *   ↓
     * PENDING_PAYMENT
     *   ↓
     * PayFast
     *
     * It also supports an existing pending payment attempt.
     */
    if (
      subscription.status ===
      "PENDING_PAYMENT"
    ) {
      /*
       * Never allow a previous PayFast recurring token to
       * remain attached to a new payment attempt.
       */
      if (
        subscription.providerSubscriptionId
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "A previous PayFast subscription token is still associated with this payment attempt. Please contact support before continuing.",
          },
          {
            status: 409,
          },
        );
      }

      /*
       * Update the selected plan atomically.
       *
       * The browser may choose the plan, but it cannot choose
       * the payment amount. The payment amount is independently
       * determined by the PayFast checkout server.
       */
      const updated =
        await prisma.subscription.updateMany({
          where: {
            id: subscription.id,
            firmId,
            status: "PENDING_PAYMENT",
            providerSubscriptionId: null,
          },
          data: {
            plan,
            cancelledAt: null,
            cancelAtPeriodEnd: false,
          },
        });

      if (updated.count !== 1) {
        return NextResponse.json(
          {
            success: false,
            error:
              "The subscription changed while payment was being prepared. Please try again.",
          },
          {
            status: 409,
          },
        );
      }

      return NextResponse.json(
        {
          success: true,
          nextStep: "PAYMENT",
          subscription: {
            id: subscription.id,
            plan,
            status: "PENDING_PAYMENT",
          },
        },
        {
          status: 200,
        },
      );
    }

    /*
     * ---------------------------------------------------------
     * 13. CANCELLED -> PENDING PAYMENT
     * ---------------------------------------------------------
     *
     * Cancellation means the previous PayFast subscription has
     * ended.
     *
     * Renewal therefore creates a completely new PayFast
     * subscription and must never reuse the old token.
     */
    if (
      subscription.status ===
      "CANCELLED"
    ) {
      const updated =
        await prisma.subscription.updateMany({
          where: {
            id: subscription.id,
            firmId,
            status: "CANCELLED",
          },
          data: {
            plan,
            status: "PENDING_PAYMENT",

            cancelledAt: null,
            cancelAtPeriodEnd: false,

            currentPeriodStart: null,
            currentPeriodEnd: null,
            trialEndsAt: null,

            provider: null,
            providerCustomerId: null,
            providerSubscriptionId: null,
          },
        });

      if (updated.count !== 1) {
        return NextResponse.json(
          {
            success: false,
            error:
              "The subscription changed while renewal was being prepared. Please try again.",
          },
          {
            status: 409,
          },
        );
      }

      return NextResponse.json(
        {
          success: true,
          nextStep: "PAYMENT",
          subscription: {
            id: subscription.id,
            plan,
            status: "PENDING_PAYMENT",
          },
        },
        {
          status: 200,
        },
      );
    }

    /*
     * ---------------------------------------------------------
     * 14. UNSUPPORTED SUBSCRIPTION STATE
     * ---------------------------------------------------------
     */
    return NextResponse.json(
      {
        success: false,
        error:
          "This subscription is not currently available for payment.",
      },
      {
        status: 409,
      },
    );
  } catch (error) {
    console.error(
      "Subscription selection error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Unable to prepare the subscription payment. Please try again.",
      },
      {
        status: 500,
      },
    );
  }
}