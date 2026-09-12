import crypto from "crypto";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createPayFastCheckout } from "@/lib/payfast/checkout";

type PayFastPlan =
  | "STARTER"
  | "PROFESSIONAL"
  | "ENTERPRISE";

const VALID_PLANS: readonly PayFastPlan[] = [
  "STARTER",
  "PROFESSIONAL",
  "ENTERPRISE",
];

const PAYMENT_ROLE = "FINANCE" as const;

/*
 * -------------------------------------------------------------
 * PLAN AMOUNTS
 * -------------------------------------------------------------
 *
 * Payment amounts are NEVER accepted from the browser.
 * They are loaded from server-side environment variables.
 */
function getPlanAmount(
  plan: PayFastPlan,
): string {
  const environmentVariable =
    plan === "STARTER"
      ? "PAYFAST_STARTER_AMOUNT"
      : plan === "PROFESSIONAL"
        ? "PAYFAST_PROFESSIONAL_AMOUNT"
        : "PAYFAST_ENTERPRISE_AMOUNT";

  const value =
    process.env[environmentVariable]?.trim();

  if (!value) {
    throw new Error(
      `Missing required payment amount configuration: ${environmentVariable}`,
    );
  }

  if (
    !/^\d+(?:\.\d{1,2})?$/.test(value)
  ) {
    throw new Error(
      `${environmentVariable} must contain a valid monetary amount.`,
    );
  }

  const numericAmount = Number(value);

  if (
    !Number.isFinite(numericAmount) ||
    numericAmount <= 0
  ) {
    throw new Error(
      `${environmentVariable} must be greater than zero.`,
    );
  }

  if (
    numericAmount > 999999999.99
  ) {
    throw new Error(
      `${environmentVariable} exceeds the supported maximum.`,
    );
  }

  return numericAmount.toFixed(2);
}

/*
 * -------------------------------------------------------------
 * APPLICATION URL
 * -------------------------------------------------------------
 */
function getApplicationUrl(): string {
  const value = (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    ""
  ).trim();

  if (!value) {
    throw new Error(
      "The application URL is not configured.",
    );
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(value);
  } catch {
    throw new Error(
      "The application URL is invalid.",
    );
  }

  if (
    parsedUrl.protocol !== "http:" &&
    parsedUrl.protocol !== "https:"
  ) {
    throw new Error(
      "The application URL must use HTTP or HTTPS.",
    );
  }

  if (
    parsedUrl.username ||
    parsedUrl.password
  ) {
    throw new Error(
      "The application URL must not contain embedded credentials.",
    );
  }

  if (
    process.env.NODE_ENV === "production" &&
    parsedUrl.protocol !== "https:"
  ) {
    throw new Error(
      "The application URL must use HTTPS in production.",
    );
  }

  return value.replace(/\/+$/, "");
}

/*
 * -------------------------------------------------------------
 * PAYMENT REFERENCES
 * -------------------------------------------------------------
 */
function createPaymentReference(): string {
  return `LV-PAY-${Date.now()}-${crypto
    .randomBytes(12)
    .toString("hex")
    .toUpperCase()}`;
}

function createPendingReceiptNumber(): string {
  return `LV-RCT-${Date.now()}-${crypto
    .randomBytes(12)
    .toString("hex")
    .toUpperCase()}`;
}

/*
 * -------------------------------------------------------------
 * PLAN VALIDATION
 * -------------------------------------------------------------
 */
function isValidPlan(
  value: unknown,
): value is PayFastPlan {
  return (
    typeof value === "string" &&
    VALID_PLANS.includes(
      value as PayFastPlan,
    )
  );
}

/*
 * -------------------------------------------------------------
 * POST
 * -------------------------------------------------------------
 */
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
     * Session/JWT values are not trusted for authorization.
     */
    const user =
      await prisma.user.findUnique({
        where: {
          id: sessionUser.id,
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
     * 3. ACTIVE ACCOUNT
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
     */
    if (user.role !== PAYMENT_ROLE) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Only Finance users are authorized to manage the firm's subscription payment.",
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
     * 6. READ REQUEST BODY
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
          name: true,
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
     *
     * The subscription is always resolved through the
     * authenticated user's firm.
     *
     * The browser cannot choose another firm's subscription.
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
          cancelAtPeriodEnd: true,
          cancelledAt: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
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
     * 10. SUBSCRIPTION STATE
     * ---------------------------------------------------------
     *
     * Only PENDING_PAYMENT may proceed to checkout.
     *
     * This includes:
     *
     *   NEW SUBSCRIPTION
     *       PENDING_PAYMENT
     *
     *   RENEWAL
     *       CANCELLED
     *          ↓
     *       PENDING_PAYMENT
     *
     * ACTIVE subscriptions must never be sent through this
     * endpoint.
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

    if (
      subscription.status !==
      "PENDING_PAYMENT"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This subscription is not awaiting payment.",
        },
        {
          status: 409,
        },
      );
    }

    /*
     * ---------------------------------------------------------
     * 11. AMOUNT MUST COME FROM SERVER CONFIGURATION
     * ---------------------------------------------------------
     */
    const amount =
      getPlanAmount(plan);

    /*
     * ---------------------------------------------------------
     * 12. PREVENT REUSE OF A CANCELLED PAYFAST TOKEN
     * ---------------------------------------------------------
     *
     * Renewal is a NEW PayFast recurring subscription.
     *
     * A cancelled PayFast subscription token must never be
     * reused for the new checkout.
     *
     * The renewal endpoint already clears the token when moving
     * CANCELLED -> PENDING_PAYMENT.
     *
     * This additional server-side check prevents an inconsistent
     * subscription record from accidentally being used.
     */
    if (
      subscription.providerSubscriptionId
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A previous PayFast subscription token is still associated with this payment attempt. Renewal cannot continue until the previous subscription token has been cleared.",
        },
        {
          status: 409,
        },
      );
    }

    /*
     * ---------------------------------------------------------
     * 13. PENDING PAYMENT CONCURRENCY PROTECTION
     * ---------------------------------------------------------
     *
     * PROCESSING payments are never automatically replaced.
     *
     * They may represent a payment currently being processed
     * by PayFast.
     */
    const existingProcessingPayment =
      await prisma.payment.findFirst({
        where: {
          firmId,
          subscriptionId:
            subscription.id,
          provider: "PAYFAST",
          status: "PROCESSING",
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          paymentReference: true,
          status: true,
          createdAt: true,
        },
      });

    if (existingProcessingPayment) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A PayFast payment is currently being processed for this subscription. Please wait for it to complete.",
        },
        {
          status: 409,
        },
      );
    }

    /*
     * ---------------------------------------------------------
     * 14. CLEAR ABANDONED PENDING PAYMENTS
     * ---------------------------------------------------------
     *
     * A PENDING payment means checkout was created but the
     * payment has not been completed.
     *
     * Starting a new checkout replaces those abandoned attempts.
     *
     * Payment history remains intact because records are marked
     * FAILED rather than deleted.
     */
    await prisma.payment.updateMany({
      where: {
        firmId,
        subscriptionId:
          subscription.id,
        provider: "PAYFAST",
        status: "PENDING",
      },
      data: {
        status: "FAILED",
        receiptSendError:
          "Previous PayFast checkout replaced by a new Finance payment attempt.",
      },
    });

    /*
     * ---------------------------------------------------------
     * 15. SAVE SELECTED PLAN
     * ---------------------------------------------------------
     *
     * The browser can select the plan.
     *
     * The browser cannot control the payment amount.
     */
    if (subscription.plan !== plan) {
      const planUpdate =
        await prisma.subscription.updateMany({
          where: {
            id: subscription.id,
            firmId,
            status: "PENDING_PAYMENT",
            providerSubscriptionId: null,
          },
          data: {
            plan,
          },
        });

      if (planUpdate.count !== 1) {
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
    }

    /*
     * ---------------------------------------------------------
     * 16. APPLICATION URLS
     * ---------------------------------------------------------
     */
    const applicationUrl =
      getApplicationUrl();

    const returnUrl =
      `${applicationUrl}/signup/payment?payment=success`;

    const cancelUrl =
      `${applicationUrl}/signup/payment?payment=cancelled`;

    const notifyUrl =
      `${applicationUrl}/api/payments/payfast/itn`;

    /*
     * ---------------------------------------------------------
     * 17. CREATE PAYMENT REFERENCES
     * ---------------------------------------------------------
     */
    const paymentReference =
      createPaymentReference();

    const receiptNumber =
      createPendingReceiptNumber();

    /*
     * ---------------------------------------------------------
     * 18. CREATE PAYMENT RECORD
     * ---------------------------------------------------------
     *
     * This creates a completely new payment record for every
     * new checkout attempt.
     *
     * Previous payment history is never overwritten.
     */
    const payment =
      await prisma.payment.create({
        data: {
          firmId,
          subscriptionId:
            subscription.id,
          amount,
          currency: "ZAR",
          status: "PENDING",
          paymentReference,
          receiptNumber,
          provider: "PAYFAST",
          receiptEmail:
            user.email,
        },
        select: {
          id: true,
          paymentReference: true,
          receiptNumber: true,
          amount: true,
          currency: true,
          status: true,
        },
      });

    /*
     * ---------------------------------------------------------
     * 19. CREATE PAYFAST CHECKOUT
     * ---------------------------------------------------------
     */
    let checkout;

    try {
      checkout =
        createPayFastCheckout({
          paymentReference:
            payment.paymentReference,

          email:
            user.email,

          firstName:
            user.name?.split(
              " ",
            )[0] ??
            "LegalVault",

          lastName:
            user.name
              ?.split(" ")
              .slice(1)
              .join(" ") ||
            "Customer",

          plan,

          amount,

          returnUrl,

          cancelUrl,

          notifyUrl,

          /*
           * Monthly recurring subscription.
           *
           * The first recurring billing date is tomorrow.
           */
          billingDate:
            new Date(
              Date.now() +
                24 *
                  60 *
                  60 *
                  1000,
            )
              .toISOString()
              .slice(0, 10),

          frequency: 3,

          /*
           * 0 = recurring indefinitely.
           */
          cycles: 0,
        });
    } catch (error) {
      /*
       * PayFast checkout creation failed before the user was
       * redirected to PayFast.
       *
       * The payment is therefore safely marked FAILED.
       */
      await prisma.payment.update({
        where: {
          id: payment.id,
        },
        data: {
          status: "FAILED",
          receiptSendError:
            error instanceof Error
              ? error.message
              : "PayFast checkout generation failed.",
        },
      });

      throw error;
    }

    /*
     * ---------------------------------------------------------
     * 20. RETURN CHECKOUT
     * ---------------------------------------------------------
     */
    return NextResponse.json(
      {
        success: true,

        payment: {
          id: payment.id,

          paymentReference:
            payment.paymentReference,

          receiptNumber:
            payment.receiptNumber,

          amount:
            payment.amount.toString(),

          currency:
            payment.currency,

          status:
            payment.status,
        },

        subscription: {
          id: subscription.id,

          plan,

          status:
            "PENDING_PAYMENT",
        },

        checkout: {
          processUrl:
            checkout.processUrl,

          fields:
            checkout.fields,
        },
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error(
      "PayFast checkout error:",
      error,
    );

    /*
     * Do not expose sensitive payment configuration,
     * PayFast credentials, signatures, or internal database
     * information to the browser.
     */
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Payment checkout could not be created.",
      },
      {
        status: 500,
      },
    );
  }
}