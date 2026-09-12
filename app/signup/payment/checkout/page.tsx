"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type PlanId =
  | "STARTER"
  | "PROFESSIONAL"
  | "ENTERPRISE";

type CheckoutData = {
  processUrl: string;
  fields: Record<string, string>;
};

type PaymentData = {
  id?: string;
  reference?: string;
  amount?: number | string;
  status?: string;
};

type CheckoutResponse = {
  success?: boolean;
  error?: string;
  payment?: PaymentData;
  subscription?: {
    id?: string;
    plan?: PlanId;
    status?: string;
  };
  checkout?: CheckoutData;
};

const planNames: Record<PlanId, string> = {
  STARTER: "Starter",
  PROFESSIONAL: "Professional",
  ENTERPRISE: "Enterprise",
};

function isValidPlan(
  value: string | null,
): value is PlanId {
  return (
    value === "STARTER" ||
    value === "PROFESSIONAL" ||
    value === "ENTERPRISE"
  );
}

export default function PaymentCheckoutPage() {
  const [plan, setPlan] = useState<PlanId | null>(
    null,
  );

  const [checkout, setCheckout] =
    useState<CheckoutData | null>(null);

  const [payment, setPayment] =
    useState<PaymentData | null>(null);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  /*
   * Read the selected plan from the URL.
   *
   * Example:
   * /signup/payment/checkout?plan=STARTER
   *
   * The URL is only used to identify the user's
   * selection. The server independently verifies
   * the authenticated Finance user, subscription,
   * plan and payment amount.
   */
  useEffect(() => {
    const params = new URLSearchParams(
      window.location.search,
    );

    const urlPlan = params.get("plan");

    if (!isValidPlan(urlPlan)) {
      setError(
        "No valid subscription plan was selected. Please return and select a plan.",
      );
      return;
    }

    setPlan(urlPlan);
  }, []);

  async function createCheckout() {
    if (loading) {
      return;
    }

    if (!plan) {
      setError(
        "No valid subscription plan was selected.",
      );
      return;
    }

    setError("");
    setLoading(true);

    try {
      /*
       * IMPORTANT:
       *
       * We send ONLY the plan.
       *
       * We do NOT send:
       * - amount
       * - merchant ID
       * - merchant key
       * - PayFast signature
       *
       * The server determines those values securely.
       */
      const response = await fetch(
        "/api/payments/payfast/checkout",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({
            plan,
          }),
          cache: "no-store",
        },
      );

      let data:
        | CheckoutResponse
        | null = null;

      try {
        data =
          (await response.json()) as CheckoutResponse;
      } catch {
        data = null;
      }

      if (!response.ok) {
        setError(
          data?.error ||
            "Unable to prepare the PayFast checkout.",
        );
        setLoading(false);
        return;
      }

      if (
        !data?.success ||
        !data.checkout?.processUrl ||
        !data.checkout?.fields
      ) {
        setError(
          "The PayFast checkout response was invalid. Please try again.",
        );
        setLoading(false);
        return;
      }

      setCheckout(data.checkout);
      setPayment(data.payment || null);
      setLoading(false);
    } catch {
      setError(
        "Unable to connect to the payment service. Please try again.",
      );
      setLoading(false);
    }
  }

  function handlePayNow() {
    if (!checkout) {
      return;
    }

    const form =
      document.createElement("form");

    form.method = "POST";
    form.action = checkout.processUrl;

    form.style.display = "none";

    Object.entries(checkout.fields).forEach(
      ([name, value]) => {
        const input =
          document.createElement("input");

        input.type = "hidden";
        input.name = name;
        input.value = String(value);

        form.appendChild(input);
      },
    );

    document.body.appendChild(form);
    form.submit();
  }

  function formatAmount(
    amount: number | string | undefined,
  ) {
    if (
      amount === undefined ||
      amount === null ||
      amount === ""
    ) {
      return "Amount confirmed securely at checkout";
    }

    const numericAmount =
      typeof amount === "number"
        ? amount
        : Number(amount);

    if (Number.isNaN(numericAmount)) {
      return String(amount);
    }

    return `R ${numericAmount.toFixed(2)}`;
  }

  /*
   * Invalid plan
   */
  if (!plan && error) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-10">
        <div className="mx-auto w-full max-w-2xl">
          <div className="rounded-2xl bg-white p-8 shadow-2xl md:p-10">
            <div className="text-center">
              <p className="text-sm font-semibold tracking-wide text-blue-600">
                LEGALVAULT
              </p>

              <h1 className="mt-3 text-2xl font-bold text-slate-900">
                Payment setup unavailable
              </h1>

              <div
                role="alert"
                className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700"
              >
                {error}
              </div>

              <Link
                href="/signup/payment"
                className="mt-6 inline-block rounded-lg bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800"
              >
                Return to subscription plans
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  /*
   * Loading plan
   */
  if (!plan) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-10">
        <div className="mx-auto w-full max-w-2xl">
          <div className="rounded-2xl bg-white p-8 text-center shadow-2xl md:p-10">
            <p className="text-sm font-semibold tracking-wide text-blue-600">
              LEGALVAULT
            </p>

            <h1 className="mt-3 text-2xl font-bold text-slate-900">
              Preparing secure checkout...
            </h1>

            <p className="mt-3 text-sm text-slate-500">
              Please wait.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <div className="rounded-2xl bg-white p-8 shadow-2xl md:p-10">

          {/* Header */}
          <div className="text-center">
            <p className="text-sm font-semibold tracking-wide text-blue-600">
              LEGALVAULT
            </p>

            <h1 className="mt-2 text-3xl font-bold text-slate-900">
              Secure payment
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              Complete your subscription payment
              securely through PayFast.
            </p>
          </div>

          {/* Selected plan */}
          <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Selected subscription
            </p>

            <div className="mt-2 flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-slate-900">
                {planNames[plan]}
              </h2>

              {payment?.amount !== undefined && (
                <p className="text-lg font-bold text-slate-900">
                  {formatAmount(payment.amount)}
                </p>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              role="alert"
              aria-live="polite"
              className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          {/* Checkout not created */}
          {!checkout && (
            <div className="mt-8">
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-4 text-sm leading-6 text-blue-800">
                <p className="font-semibold">
                  Ready for secure payment
                </p>

                <p className="mt-1">
                  LegalVault will prepare a secure
                  PayFast payment for your selected
                  subscription.
                </p>
              </div>

              <button
                type="button"
                onClick={createCheckout}
                disabled={loading}
                className="mt-6 w-full rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? "Preparing secure payment..."
                  : "Prepare PayFast payment"}
              </button>
            </div>
          )}

          {/* Checkout ready */}
          {checkout && (
            <div className="mt-8">
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-4 text-sm leading-6 text-green-800">
                <p className="font-semibold">
                  Payment ready
                </p>

                <p className="mt-1">
                  Your secure PayFast checkout has
                  been prepared. Click the button below
                  to continue to PayFast.
                </p>
              </div>

              {payment?.reference && (
                <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Payment reference
                  </p>

                  <p className="mt-1 break-all text-sm font-semibold text-slate-900">
                    {payment.reference}
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={handlePayNow}
                className="mt-6 w-full rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white transition hover:bg-blue-800"
              >
                Pay now with PayFast
              </button>

              <button
                type="button"
                onClick={createCheckout}
                disabled={loading}
                className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? "Preparing..."
                  : "Create a new payment attempt"}
              </button>
            </div>
          )}

          {/* Security notice */}
          <div className="mt-8 border-t border-slate-200 pt-6">
            <div className="rounded-lg bg-slate-50 px-4 py-4 text-xs leading-5 text-slate-500">
              <p className="font-semibold text-slate-700">
                Secure payment
              </p>

              <p className="mt-1">
                Payment is processed by PayFast.
                LegalVault does not receive or store
                your card details.
              </p>

              <p className="mt-2">
                The subscription plan and payment
                amount are independently verified by
                the LegalVault server.
              </p>
            </div>
          </div>

          {/* Return */}
          <div className="mt-8 text-center">
            <Link
              href="/signup/payment"
              className="text-sm font-semibold text-blue-700 hover:text-blue-800"
            >
              Return to subscription plans
            </Link>
          </div>

          <p className="mt-8 text-center text-xs text-slate-400">
            LegalVault &bull; Secure Legal Document
            Management
          </p>
        </div>
      </div>
    </main>
  );
}