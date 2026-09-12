"use client";

import { useState } from "react";
import Link from "next/link";

type PlanId =
  | "STARTER"
  | "PROFESSIONAL"
  | "ENTERPRISE";

type Plan = {
  id: PlanId;
  name: string;
  description: string;
  features: string[];
  price: string;
};

type SubscriptionSelectionResponse = {
  success?: boolean;
  error?: string;
  subscription?: {
    id: string;
    plan: PlanId;
    status: string;
  };
  nextStep?: string;
  plan?: PlanId;
};

const plans: Plan[] = [
  {
    id: "STARTER",
    name: "Starter",
    description:
      "For small law firms that need secure document management.",
    features: [
      "Secure document management",
      "Matter management",
      "Client management",
      "Document version control",
      "Role-based staff access",
      "Audit trail",
    ],
    price: "R499 / month",
  },
  {
    id: "PROFESSIONAL",
    name: "Professional",
    description:
      "For growing firms managing more matters and staff.",
    features: [
      "Everything in Starter",
      "Advanced matter permissions",
      "Team management",
      "Task management",
      "Advanced audit capabilities",
      "Priority support",
    ],
    price: "R999 / month",
  },
  {
    id: "ENTERPRISE",
    name: "Enterprise",
    description:
      "For larger firms requiring advanced security and support.",
    features: [
      "Everything in Professional",
      "Enterprise-grade controls",
      "Custom onboarding",
      "Custom user requirements",
      "Enhanced support",
      "Custom commercial arrangements",
    ],
    price: "R2,499 / month",
  },
];

export default function PaymentPage() {
  const [selectedPlan, setSelectedPlan] =
    useState<PlanId | "">("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleContinue() {
    if (loading) {
      return;
    }

    if (!selectedPlan) {
      setError("Please select a subscription plan.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await fetch(
        "/api/subscription/select",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({
            plan: selectedPlan,
          }),
        },
      );

      let data:
        | SubscriptionSelectionResponse
        | null = null;

      try {
        data =
          (await response.json()) as SubscriptionSelectionResponse;
      } catch {
        data = null;
      }

      if (!response.ok) {
        setError(
          data?.error ||
            "Unable to select this subscription plan.",
        );
        setLoading(false);
        return;
      }

      if (
        !data?.success ||
        data.nextStep !== "PAYMENT"
      ) {
        setError(
          "The subscription was not prepared for payment. Please try again.",
        );
        setLoading(false);
        return;
      }

      /*
       * The selected plan has been saved server-side.
       *
       * IMPORTANT:
       * Pass the selected plan to the checkout page.
       * The checkout page uses this value to prepare
       * the correct PayFast payment.
       *
       * The browser does NOT provide the payment amount.
       * The payment amount is determined server-side.
       */
      window.location.assign(
        `/signup/payment/checkout?plan=${selectedPlan}`,
      );
    } catch {
      setError(
        "Unable to select your subscription right now. Please try again.",
      );

      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10">
      <div className="mx-auto w-full max-w-6xl">
        <div className="rounded-2xl bg-white p-8 shadow-2xl md:p-10">

          {/* Header */}
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold tracking-wide text-blue-600">
              LEGALVAULT
            </p>

            <h1 className="mt-2 text-3xl font-bold text-slate-900 md:text-4xl">
              Choose your subscription
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-500 md:text-base">
              Finance users can select the subscription
              plan for the firm and proceed directly to
              payment.
            </p>
          </div>

          {/* Finance notice */}
          <div className="mx-auto mt-8 max-w-3xl rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            <span className="font-semibold">
              Finance payment access:
            </span>{" "}
            Select the required plan below and continue
            to the secure PayFast checkout.
          </div>

          {/* Error */}
          {error && (
            <div
              role="alert"
              aria-live="polite"
              className="mx-auto mt-6 max-w-3xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          {/* Plans */}
          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {plans.map((plan) => {
              const isSelected =
                selectedPlan === plan.id;

              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => {
                    if (!loading) {
                      setSelectedPlan(plan.id);
                      setError("");
                    }
                  }}
                  disabled={loading}
                  aria-pressed={isSelected}
                  className={`relative flex h-full flex-col rounded-2xl border-2 p-6 text-left transition ${
                    isSelected
                      ? "border-blue-700 bg-blue-50 shadow-lg"
                      : "border-slate-200 bg-white hover:border-blue-300 hover:shadow-md"
                  } ${
                    loading
                      ? "cursor-not-allowed opacity-70"
                      : ""
                  }`}
                >
                  {/* Recommended badge */}
                  {plan.id === "PROFESSIONAL" && (
                    <span className="absolute right-5 top-5 rounded-full bg-blue-700 px-3 py-1 text-xs font-semibold text-white">
                      Recommended
                    </span>
                  )}

                  {/* Plan information */}
                  <div className="pr-20">
                    <h2 className="text-xl font-bold text-slate-900">
                      {plan.name}
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {plan.description}
                    </p>
                  </div>

                  {/* Price */}
                  <div className="mt-6">
                    <p className="text-lg font-bold text-slate-900">
                      {plan.price}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      Payment amount is verified
                      securely on the server.
                    </p>
                  </div>

                  {/* Features */}
                  <div className="mt-6 border-t border-slate-200 pt-5">
                    <p className="text-sm font-semibold text-slate-900">
                      Includes:
                    </p>

                    <ul className="mt-3 space-y-3">
                      {plan.features.map(
                        (feature) => (
                          <li
                            key={feature}
                            className="flex gap-2 text-sm text-slate-600"
                          >
                            <span className="mt-0.5 font-bold text-blue-700">
                              ✓
                            </span>

                            <span>
                              {feature}
                            </span>
                          </li>
                        ),
                      )}
                    </ul>
                  </div>

                  {/* Selection indicator */}
                  <div className="mt-auto pt-7">
                    <div
                      className={`rounded-lg px-4 py-3 text-center text-sm font-semibold ${
                        isSelected
                          ? "bg-blue-700 text-white"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {isSelected
                        ? "Selected"
                        : "Select plan"}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Payment button */}
          <div className="mx-auto mt-10 max-w-3xl">
            <button
              type="button"
              onClick={handleContinue}
              disabled={
                loading || !selectedPlan
              }
              className="w-full rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Preparing secure payment..."
                : "Continue to secure payment"}
            </button>

            <p className="mt-4 text-center text-xs leading-5 text-slate-400">
              The selected plan is saved to the
              firm's subscription. Payment is
              processed through PayFast. LegalVault
              does not receive or store your card
              details.
            </p>
          </div>

          {/* Return */}
          <div className="mt-8 border-t border-slate-200 pt-6 text-center">
            <Link
              href="/dashboard"
              className="text-sm font-semibold text-blue-700 hover:text-blue-800"
            >
              Return to LegalVault
            </Link>
          </div>

          {/* Footer */}
          <p className="mt-8 text-center text-xs text-slate-400">
            LegalVault &bull; Secure Legal Document
            Management
          </p>
        </div>
      </div>
    </main>
  );
}