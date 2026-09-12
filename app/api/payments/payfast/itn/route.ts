import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

import { prisma } from "@/lib/prisma";
import { getPayFastConfig } from "@/lib/payfast/config";
import { createAuditLog } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { createPaymentReceiptEmail } from "@/lib/payments/receipt";

/*
 * PayFast published ITN source networks.
 *
 * Review these periodically against current PayFast
 * documentation before production deployment.
 */
const PAYFAST_IP_RANGES = [
  {
    network: "197.97.145.144",
    prefix: 28,
  },
  {
    network: "41.74.179.192",
    prefix: 27,
  },
  {
    network: "102.216.36.0",
    prefix: 28,
  },
  {
    network: "102.216.36.128",
    prefix: 28,
  },
  {
    network: "144.126.193.139",
    prefix: 32,
  },
];

/*
 * ------------------------------------------------------------
 * IP ADDRESS HELPERS
 * ------------------------------------------------------------
 */

function ipv4ToNumber(ip: string): number | null {
  const parts = ip.split(".");

  if (parts.length !== 4) {
    return null;
  }

  const numbers = parts.map(Number);

  if (
    numbers.some(
      (part) =>
        !Number.isInteger(part) ||
        part < 0 ||
        part > 255,
    )
  ) {
    return null;
  }

  return (
    ((numbers[0] << 24) >>> 0) +
    ((numbers[1] << 16) >>> 0) +
    ((numbers[2] << 8) >>> 0) +
    (numbers[3] >>> 0)
  );
}

function isIpInRange(
  ip: string,
  network: string,
  prefix: number,
): boolean {
  const ipNumber = ipv4ToNumber(ip);
  const networkNumber = ipv4ToNumber(network);

  if (
    ipNumber === null ||
    networkNumber === null
  ) {
    return false;
  }

  if (prefix === 32) {
    return ipNumber === networkNumber;
  }

  const mask =
    (0xffffffff << (32 - prefix)) >>> 0;

  return (
    (ipNumber & mask) ===
    (networkNumber & mask)
  );
}

function isValidPayFastIp(
  ip: string,
): boolean {
  return PAYFAST_IP_RANGES.some(
    ({ network, prefix }) =>
      isIpInRange(
        ip,
        network,
        prefix,
      ),
  );
}

/*
 * ------------------------------------------------------------
 * REQUEST IP
 * ------------------------------------------------------------
 *
 * IMPORTANT:
 *
 * x-forwarded-for / x-real-ip must only be trusted when
 * the deployment's trusted reverse proxy overwrites them.
 *
 * In production, configure the hosting platform/proxy so
 * client-supplied forwarding headers cannot be spoofed.
 */

function getClientIp(
  request: NextRequest,
): string | null {
  const forwardedFor =
    request.headers.get(
      "x-forwarded-for",
    );

  if (forwardedFor) {
    const firstIp =
      forwardedFor
        .split(",")[0]
        .trim();

    if (firstIp) {
      return firstIp;
    }
  }

  const realIp =
    request.headers.get(
      "x-real-ip",
    );

  return (
    realIp?.trim() || null
  );
}

/*
 * ------------------------------------------------------------
 * CONSTANT-TIME STRING COMPARISON
 * ------------------------------------------------------------
 */

function safeCompare(
  received: string,
  expected: string,
): boolean {
  if (
    received.length !==
    expected.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(received),
    Buffer.from(expected),
  );
}

/*
 * ------------------------------------------------------------
 * PAYFAST URL ENCODING
 * ------------------------------------------------------------
 */

function encodePayFastValue(
  value: string,
): string {
  return encodeURIComponent(value)
    .replace(/%20/g, "+");
}

/*
 * ------------------------------------------------------------
 * ITN SIGNATURE
 * ------------------------------------------------------------
 */

function generateItnSignature(
  rawBody: string,
  passphrase?: string,
): string {
  const params =
    new URLSearchParams(
      rawBody,
    );

  const parts: string[] = [];

  for (const [
    key,
    value,
  ] of params.entries()) {
    if (key === "signature") {
      continue;
    }

    parts.push(
      `${key}=${encodePayFastValue(
        value.trim(),
      )}`,
    );
  }

  let parameterString =
    parts.join("&");

  if (passphrase) {
    parameterString +=
      `&passphrase=${encodePayFastValue(
        passphrase.trim(),
      )}`;
  }

  return crypto
    .createHash("md5")
    .update(parameterString)
    .digest("hex");
}

/*
 * ------------------------------------------------------------
 * AMOUNT HELPERS
 * ------------------------------------------------------------
 */

function parseAmount(
  value: string | undefined,
): number | null {
  if (!value) {
    return null;
  }

  const amount = Number(value);

  if (
    !Number.isFinite(amount) ||
    amount < 0
  ) {
    return null;
  }

  return amount;
}

function amountsMatch(
  expected: unknown,
  received: string | undefined,
): boolean {
  const expectedAmount =
    Number(
      expected?.toString(),
    );

  const receivedAmount =
    parseAmount(received);

  if (
    !Number.isFinite(
      expectedAmount,
    ) ||
    receivedAmount === null
  ) {
    return false;
  }

  /*
   * Currency amounts are compared to two decimal places.
   */
  return (
    Math.abs(
      expectedAmount -
        receivedAmount,
    ) <= 0.01
  );
}

/*
 * ------------------------------------------------------------
 * STRING NORMALISATION
 * ------------------------------------------------------------
 */

function normaliseCurrency(
  value: string | undefined,
): string | null {
  if (!value) {
    return null;
  }

  return value
    .trim()
    .toUpperCase();
}

/*
 * ------------------------------------------------------------
 * JSON METADATA HELPERS
 * ------------------------------------------------------------
 */

function isJsonObject(
  value: unknown,
): value is Record<
  string,
  unknown
> {
  return (
    typeof value ===
      "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

/*
 * ------------------------------------------------------------
 * PAYMENT REFERENCE
 * ------------------------------------------------------------
 */

function createPaymentReference(): string {
  return `LV-PAY-${Date.now()}-${crypto
    .randomBytes(6)
    .toString("hex")
    .toUpperCase()}`;
}

/*
 * ------------------------------------------------------------
 * RECEIPT NUMBER
 * ------------------------------------------------------------
 */

function createFinalReceiptNumber(): string {
  const datePart =
    new Date()
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "");

  const randomPart =
    crypto
      .randomBytes(6)
      .toString("hex")
      .toUpperCase();

  return `LV-REC-${datePart}-${randomPart}`;
}

/*
 * ------------------------------------------------------------
 * MONTHLY BILLING PERIOD
 * ------------------------------------------------------------
 */

function getNextMonthlyPeriodEnd(
  startDate: Date,
): Date {
  const year =
    startDate.getUTCFullYear();

  const month =
    startDate.getUTCMonth();

  const day =
    startDate.getUTCDate();

  const nextMonth =
    month + 1;

  const lastDay =
    new Date(
      Date.UTC(
        year,
        nextMonth + 1,
        0,
      ),
    ).getUTCDate();

  const targetDay =
    Math.min(
      day,
      lastDay,
    );

  return new Date(
    Date.UTC(
      year,
      nextMonth,
      targetDay,
    ),
  );
}

/*
 * ------------------------------------------------------------
 * PAYMENT REFERENCE SAFETY
 * ------------------------------------------------------------
 */

async function getSafePaymentReference(
  incomingReference: string,
): Promise<string> {
  const existing =
    await prisma.payment.findUnique({
      where: {
        paymentReference:
          incomingReference,
      },

      select: {
        id: true,
      },
    });

  if (!existing) {
    return incomingReference;
  }

  return createPaymentReference();
}

/*
 * ------------------------------------------------------------
 * ITN ROUTE
 * ------------------------------------------------------------
 */

export async function POST(
  request: NextRequest,
) {
  try {
    /*
     * --------------------------------------------------------
     * 1. Read raw PayFast notification
     * --------------------------------------------------------
     */

    const rawBody =
      await request.text();

    if (!rawBody) {
      console.error(
        "PAYFAST ITN: Empty ITN payload.",
      );

      return new NextResponse(
        "Empty ITN payload.",
        {
          status: 400,
        },
      );
    }

    const params =
      new URLSearchParams(
        rawBody,
      );

    const data: Record<
      string,
      string
    > = {};

    params.forEach(
      (value, key) => {
        data[key] = value;
      },
    );

    /*
     * --------------------------------------------------------
     * 2. Extract PayFast fields
     * --------------------------------------------------------
     */

    const paymentReference =
      data.m_payment_id;

    const receivedSignature =
      data.signature;

    const merchantId =
      data.merchant_id;

    const paymentStatus =
      data.payment_status;

    const grossAmount =
      data.amount_gross;

    const payFastPaymentId =
      data.pf_payment_id;

    /*
     * token = PayFast recurring subscription identifier.
     *
     * pf_payment_id = individual PayFast payment identifier.
     */
    const payFastSubscriptionToken =
      data.token?.trim() || null;

    const receivedCurrency =
      normaliseCurrency(
        data.currency,
      );

    if (
      !paymentReference ||
      !receivedSignature ||
      !merchantId ||
      !paymentStatus ||
      !grossAmount ||
      !payFastPaymentId ||
      !receivedCurrency
    ) {
      console.error(
        "PAYFAST ITN: Missing required fields.",
      );

      return new NextResponse(
        "Invalid ITN payload.",
        {
          status: 400,
        },
      );
    }

    /*
     * A successful recurring payment must contain the
     * PayFast subscription token.
     */
    if (
      paymentStatus ===
        "COMPLETE" &&
      !payFastSubscriptionToken
    ) {
      console.error(
        "PAYFAST ITN: Successful recurring payment does not contain a subscription token.",
        {
          paymentReference,
          payFastPaymentId,
        },
      );

      return new NextResponse(
        "Recurring subscription token missing.",
        {
          status: 400,
        },
      );
    }

    /*
     * --------------------------------------------------------
     * 3. Load PayFast configuration
     * --------------------------------------------------------
     */

    const config =
      getPayFastConfig();

    /*
     * --------------------------------------------------------
     * 4. Verify merchant ID
     * --------------------------------------------------------
     */

    if (
      merchantId !==
      config.merchantId
    ) {
      console.error(
        "PAYFAST ITN: Merchant ID mismatch.",
      );

      return new NextResponse(
        "Merchant ID mismatch.",
        {
          status: 400,
        },
      );
    }

    /*
     * --------------------------------------------------------
     * 5. Verify source IP
     * --------------------------------------------------------
     */

    const clientIp =
      getClientIp(request);

    if (!clientIp) {
      console.error(
        "PAYFAST ITN: Could not determine source IP.",
      );

      return new NextResponse(
        "Source IP could not be verified.",
        {
          status: 403,
        },
      );
    }

    if (
      !isValidPayFastIp(
        clientIp,
      )
    ) {
      console.error(
        `PAYFAST ITN: Invalid source IP ${clientIp}.`,
      );

      return new NextResponse(
        "Invalid source IP.",
        {
          status: 403,
        },
      );
    }

    /*
     * --------------------------------------------------------
     * 6. Verify ITN signature
     * --------------------------------------------------------
     */

    const expectedSignature =
      generateItnSignature(
        rawBody,
        config.passphrase,
      );

    if (
      !safeCompare(
        receivedSignature,
        expectedSignature,
      )
    ) {
      console.error(
        "PAYFAST ITN: Invalid signature.",
      );

      return new NextResponse(
        "Invalid signature.",
        {
          status: 400,
        },
      );
    }

    /*
     * --------------------------------------------------------
     * 7. Find existing payment
     * --------------------------------------------------------
     */

    let payment =
      await prisma.payment.findUnique(
        {
          where: {
            paymentReference,
          },

          include: {
            subscription: true,
            firm: true,
          },
        },
      );

    /*
     * --------------------------------------------------------
     * 8. Idempotency by PayFast payment ID
     * --------------------------------------------------------
     */

    const paymentWithProviderId =
      await prisma.payment.findUnique(
        {
          where: {
            providerPaymentId:
              payFastPaymentId,
          },

          include: {
            subscription: true,
            firm: true,
          },
        },
      );

    if (
      paymentWithProviderId &&
      (!payment ||
        paymentWithProviderId.id ===
          payment.id)
    ) {
      payment =
        paymentWithProviderId;
    }

    /*
     * --------------------------------------------------------
     * 9. Detect a reused completed merchant reference
     * --------------------------------------------------------
     *
     * PayFast recurring notifications can represent a new
     * payment even though the merchant reference relates to
     * the original subscription checkout.
     *
     * If the existing payment is already completed and the
     * PayFast payment ID is different, do not treat the new
     * recurring payment as the old payment.
     */

    if (
      payment &&
      payment.status ===
        "COMPLETED" &&
      payment.providerPaymentId !==
        payFastPaymentId &&
      payFastSubscriptionToken
    ) {
      payment = null;
    }

    /*
     * --------------------------------------------------------
     * 10. Confirm ITN with PayFast
     * --------------------------------------------------------
     */

    const validationUrl =
      config.sandbox
        ? "https://sandbox.payfast.co.za/eng/query/validate"
        : "https://www.payfast.co.za/eng/query/validate";

    const validationResponse =
      await fetch(
        validationUrl,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded",
          },

          body: rawBody,

          cache: "no-store",
        },
      );

    const validationText =
      (
        await validationResponse.text()
      ).trim();

    if (
      !validationResponse.ok ||
      validationText !== "VALID"
    ) {
      console.error(
        "PAYFAST ITN: PayFast server validation failed.",
        {
          status:
            validationResponse.status,

          response:
            validationText,
        },
      );

      return new NextResponse(
        "PayFast validation failed.",
        {
          status: 400,
        },
      );
    }

    /*
     * --------------------------------------------------------
     * 11. Existing payment processing
     * --------------------------------------------------------
     */

    if (payment) {
      /*
       * ------------------------------------------------------
       * 11A. Verify payment ownership
       * ------------------------------------------------------
       */

      if (
        !payment.subscriptionId ||
        !payment.firmId
      ) {
        console.error(
          "PAYFAST ITN: Payment has invalid ownership relationships.",
          {
            paymentReference,
          },
        );

        return new NextResponse(
          "Invalid payment ownership.",
          {
            status: 400,
          },
        );
      }

      if (
        payment.subscription.firmId !==
        payment.firmId
      ) {
        console.error(
          "PAYFAST ITN: Payment/subscription firm mismatch.",
        );

        return new NextResponse(
          "Payment ownership mismatch.",
          {
            status: 400,
          },
        );
      }

      /*
       * ------------------------------------------------------
       * 11B. Verify provider
       * ------------------------------------------------------
       */

      if (
        payment.provider !==
        "PAYFAST"
      ) {
        console.error(
          "PAYFAST ITN: Internal payment provider mismatch.",
        );

        return new NextResponse(
          "Payment provider mismatch.",
          {
            status: 400,
          },
        );
      }

      /*
       * ------------------------------------------------------
       * 11C. Verify recurring subscription token
       * ------------------------------------------------------
       */

      const storedSubscriptionToken =
        payment.subscription
          .providerSubscriptionId
          ?.trim() || null;

      if (
        storedSubscriptionToken &&
        payFastSubscriptionToken &&
        storedSubscriptionToken !==
          payFastSubscriptionToken
      ) {
        console.error(
          "PAYFAST ITN: PayFast subscription token does not match the stored subscription token.",
          {
            paymentReference,
            paymentId:
              payment.id,
          },
        );

        return new NextResponse(
          "Subscription token mismatch.",
          {
            status: 400,
          },
        );
      }

      if (
        storedSubscriptionToken &&
        paymentStatus ===
          "COMPLETE" &&
        !payFastSubscriptionToken
      ) {
        console.error(
          "PAYFAST ITN: Stored recurring subscription token exists but incoming ITN token is missing.",
          {
            paymentReference,
            paymentId:
              payment.id,
          },
        );

        return new NextResponse(
          "Subscription token missing.",
          {
            status: 400,
          },
        );
      }

      /*
       * ------------------------------------------------------
       * 11D. Verify amount
       * ------------------------------------------------------
       */

      if (
        !amountsMatch(
          payment.amount,
          grossAmount,
        )
      ) {
        console.error(
          "PAYFAST ITN: Amount mismatch.",
          {
            paymentReference,

            expected:
              payment.amount.toString(),

            received:
              grossAmount,
          },
        );

        if (
          payment.status !==
          "COMPLETED"
        ) {
          await prisma.payment.updateMany(
            {
              where: {
                id: payment.id,

                status: {
                  in: [
                    "PENDING",
                    "PROCESSING",
                  ],
                },
              },

              data: {
                status:
                  "FAILED",

                metadata: {
                  ...(isJsonObject(
                    payment.metadata,
                  )
                    ? payment.metadata
                    : {}),

                  itnError:
                    "Payment amount mismatch.",

                  receivedAmount:
                    grossAmount,

                  receivedAt:
                    new Date().toISOString(),
                },
              },
            },
          );
        }

        return new NextResponse(
          "Payment amount mismatch.",
          {
            status: 400,
          },
        );
      }

      /*
       * ------------------------------------------------------
       * 11E. Verify currency
       * ------------------------------------------------------
       */

      const expectedCurrency =
        normaliseCurrency(
          payment.currency,
        );

      if (
        !expectedCurrency ||
        receivedCurrency !==
          expectedCurrency
      ) {
        console.error(
          "PAYFAST ITN: Currency mismatch.",
          {
            paymentReference,

            expected:
              expectedCurrency,

            received:
              receivedCurrency,
          },
        );

        if (
          payment.status !==
          "COMPLETED"
        ) {
          await prisma.payment.updateMany(
            {
              where: {
                id: payment.id,

                status: {
                  in: [
                    "PENDING",
                    "PROCESSING",
                  ],
                },
              },

              data: {
                status:
                  "FAILED",

                metadata: {
                  ...(isJsonObject(
                    payment.metadata,
                  )
                    ? payment.metadata
                    : {}),

                  itnError:
                    "Payment currency mismatch.",

                  receivedCurrency,

                  receivedAt:
                    new Date().toISOString(),
                },
              },
            },
          );
        }

        return new NextResponse(
          "Payment currency mismatch.",
          {
            status: 400,
          },
        );
      }

      /*
       * ------------------------------------------------------
       * 11F. Verify provider payment ID ownership
       * ------------------------------------------------------
       */

      const existingProviderPayment =
        await prisma.payment.findUnique(
          {
            where: {
              providerPaymentId:
                payFastPaymentId,
            },

            select: {
              id: true,
              paymentReference: true,
            },
          },
        );

      if (
        existingProviderPayment &&
        existingProviderPayment.id !==
          payment.id
      ) {
        console.error(
          "PAYFAST ITN: Provider payment ID already belongs to another payment.",
          {
            payFastPaymentId,

            currentPayment:
              paymentReference,

            existingPayment:
              existingProviderPayment.paymentReference,
          },
        );

        return new NextResponse(
          "Provider payment ID already associated with another payment.",
          {
            status: 409,
          },
        );
      }

      /*
       * ------------------------------------------------------
       * 11G. Handle non-complete payment
       * ------------------------------------------------------
       */

      if (
        paymentStatus !==
        "COMPLETE"
      ) {
        const failedStatus =
          paymentStatus ===
          "CANCELLED"
            ? "CANCELLED"
            : "FAILED";

        const statusUpdate =
          await prisma.payment.updateMany(
            {
              where: {
                id: payment.id,

                status: {
                  in: [
                    "PENDING",
                    "PROCESSING",
                  ],
                },
              },

              data: {
                status:
                  failedStatus,

                provider:
                  "PAYFAST",

                providerPaymentId:
                  payFastPaymentId,

                paymentMethod:
                  data.payment_method ||
                  null,

                metadata: {
                  ...(isJsonObject(
                    payment.metadata,
                  )
                    ? payment.metadata
                    : {}),

                  paymentStatus,

                  amountGross:
                    grossAmount,

                  currency:
                    receivedCurrency,

                  payFastSubscriptionToken,

                  itnReceivedAt:
                    new Date().toISOString(),
                },
              },
            },
          );

        if (
          statusUpdate.count === 0
        ) {
          console.log(
            `PAYFAST ITN: Payment ${paymentReference} was already in a terminal state (${payment.status}).`,
          );
        }

        return new NextResponse(
          "ITN received.",
          {
            status: 200,
          },
        );
      }

      /*
       * ------------------------------------------------------
       * 11H. Existing successful payment
       * ------------------------------------------------------
       */

      if (
        payment.status ===
        "COMPLETED"
      ) {
        if (
          payFastSubscriptionToken &&
          payment.subscription
            .providerSubscriptionId !==
            payFastSubscriptionToken
        ) {
          if (
            payment.subscription
              .providerSubscriptionId
          ) {
            console.error(
              "PAYFAST ITN: Refusing to replace an existing PayFast subscription token.",
              {
                paymentReference,
                paymentId:
                  payment.id,
              },
            );

            return new NextResponse(
              "Subscription token mismatch.",
              {
                status: 400,
              },
            );
          }

          await prisma.subscription.updateMany(
            {
              where: {
                id:
                  payment.subscriptionId,

                firmId:
                  payment.firmId,

                providerSubscriptionId:
                  null,
              },

              data: {
                provider:
                  "PAYFAST",

                providerSubscriptionId:
                  payFastSubscriptionToken,
              },
            },
          );
        }

        console.log(
          `PAYFAST ITN: Payment ${paymentReference} was already completed.`,
        );

        return new NextResponse(
          "ITN already processed.",
          {
            status: 200,
          },
        );
      }

      /*
       * ------------------------------------------------------
       * 11I. Complete existing payment
       * ------------------------------------------------------
       */

      const paymentId =
        payment.id;

      const paidAt =
        new Date();

      const completionResult =
        await prisma.$transaction(
          async (tx) => {
            const currentPayment =
              await tx.payment.findUnique(
                {
                  where: {
                    id: paymentId,
                  },

                  select: {
                    id: true,
                    status: true,
                    subscriptionId:
                      true,
                    firmId: true,
                    metadata: true,
                  },
                },
              );

            if (!currentPayment) {
              throw new Error(
                "Payment disappeared during ITN processing.",
              );
            }

            if (
              currentPayment.status ===
              "COMPLETED"
            ) {
              return {
                alreadyCompleted:
                  true,
              };
            }

            if (
              currentPayment.status !==
                "PENDING" &&
              currentPayment.status !==
                "PROCESSING"
            ) {
              throw new Error(
                `Payment is in an invalid state for completion: ${currentPayment.status}`,
              );
            }

            const currentSubscription =
              await tx.subscription.findUnique(
                {
                  where: {
                    id:
                      currentPayment.subscriptionId,
                  },

                  select: {
                    id: true,
                    firmId: true,
                    status: true,
                    providerSubscriptionId:
                      true,
                    currentPeriodStart:
                      true,
                    currentPeriodEnd:
                      true,
                  },
                },
              );

            if (
              !currentSubscription
            ) {
              throw new Error(
                "Subscription could not be found during ITN processing.",
              );
            }

            if (
              currentSubscription.firmId !==
              currentPayment.firmId
            ) {
              throw new Error(
                "Subscription and payment firm ownership mismatch.",
              );
            }

            if (
              currentSubscription.status !==
                "PENDING_PAYMENT" &&
              currentSubscription.status !==
                "ACTIVE"
            ) {
              throw new Error(
                `Subscription is not in a payable state. Current status: ${currentSubscription.status}`,
              );
            }

            if (
              currentSubscription
                .providerSubscriptionId &&
              payFastSubscriptionToken &&
              currentSubscription
                .providerSubscriptionId !==
                payFastSubscriptionToken
            ) {
              throw new Error(
                "PayFast subscription token does not match the stored subscription.",
              );
            }

            const finalReceiptNumber =
              createFinalReceiptNumber();

            const claim =
              await tx.payment.updateMany(
                {
                  where: {
                    id: paymentId,

                    status: {
                      in: [
                        "PENDING",
                        "PROCESSING",
                      ],
                    },
                  },

                  data: {
                    status:
                      "COMPLETED",

                    provider:
                      "PAYFAST",

                    providerPaymentId:
                      payFastPaymentId,

                    paymentMethod:
                      data.payment_method ||
                      null,

                    paidAt,

                    receiptNumber:
                      finalReceiptNumber,

                    metadata: {
                      ...(isJsonObject(
                        currentPayment.metadata,
                      )
                        ? currentPayment.metadata
                        : {}),

                      paymentStatus,

                      amountGross:
                        grossAmount,

                      currency:
                        receivedCurrency,

                      payFastSubscriptionToken,

                      validatedByPayFast:
                        true,

                      recurring:
                        true,

                      itnProcessedAt:
                        paidAt.toISOString(),
                    },
                  },
                },
              );

            if (
              claim.count === 0
            ) {
              return {
                alreadyCompleted:
                  true,
              };
            }

            const periodEnd =
              getNextMonthlyPeriodEnd(
                paidAt,
              );

            const subscriptionUpdate =
              await tx.subscription.updateMany(
                {
                  where: {
                    id:
                      currentPayment.subscriptionId,

                    firmId:
                      currentPayment.firmId,
                  },

                  data: {
                    status:
                      "ACTIVE",

                    provider:
                      "PAYFAST",

                    ...(payFastSubscriptionToken
                      ? {
                          providerSubscriptionId:
                            payFastSubscriptionToken,
                        }
                      : {}),

                    currentPeriodStart:
                      paidAt,

                    currentPeriodEnd:
                      periodEnd,

                    cancelledAt:
                      null,
                  },
                },
              );

            if (
              subscriptionUpdate.count !==
              1
            ) {
              throw new Error(
                "Subscription could not be updated after successful payment.",
              );
            }

            return {
              alreadyCompleted:
                false,

              receiptNumber:
                finalReceiptNumber,
            };
          },
        );

      if (
        completionResult.alreadyCompleted
      ) {
        return new NextResponse(
          "ITN already processed.",
          {
            status: 200,
          },
        );
      }

      payment =
        await prisma.payment.findUnique(
          {
            where: {
              id: paymentId,
            },

            include: {
              subscription: true,
              firm: true,
            },
          },
        );

      if (!payment) {
        throw new Error(
          "Completed payment could not be reloaded.",
        );
      }
    } else {
      /*
       * ------------------------------------------------------
       * 12. No existing payment
       * ------------------------------------------------------
       */

      if (
        !payFastSubscriptionToken
      ) {
        console.error(
          "PAYFAST ITN: Payment not found and no recurring subscription token was supplied.",
          {
            paymentReference,
            payFastPaymentId,
          },
        );

        return new NextResponse(
          "Payment not found.",
          {
            status: 404,
          },
        );
      }

      const subscription =
        await prisma.subscription.findFirst(
          {
            where: {
              providerSubscriptionId:
                payFastSubscriptionToken,
            },

            include: {
              firm: true,
            },
          },
        );

      if (!subscription) {
        console.error(
          "PAYFAST ITN: Recurring subscription token was not found.",
          {
            payFastSubscriptionToken,
            payFastPaymentId,
          },
        );

        return new NextResponse(
          "Subscription not found.",
          {
            status: 404,
          },
        );
      }

      /*
       * ------------------------------------------------------
       * 12A. Verify subscription provider
       * ------------------------------------------------------
       */

      if (
        subscription.provider !==
        "PAYFAST"
      ) {
        console.error(
          "PAYFAST ITN: Subscription provider mismatch.",
          {
            subscriptionId:
              subscription.id,
          },
        );

        return new NextResponse(
          "Subscription provider mismatch.",
          {
            status: 400,
          },
        );
      }

      if (
        subscription.status ===
          "CANCELLED" &&
        paymentStatus ===
          "COMPLETE"
      ) {
        console.error(
          "PAYFAST ITN: Successful payment received for a cancelled subscription.",
          {
            subscriptionId:
              subscription.id,

            payFastPaymentId,
          },
        );

        return new NextResponse(
          "Cancelled subscription.",
          {
            status: 400,
          },
        );
      }

      /*
       * ------------------------------------------------------
       * 12B. Find previous completed payment
       * ------------------------------------------------------
       */

      const latestPayment =
        await prisma.payment.findFirst(
          {
            where: {
              subscriptionId:
                subscription.id,

              status:
                "COMPLETED",
            },

            orderBy: {
              paidAt: "desc",
            },

            select: {
              id: true,
              amount: true,
              currency: true,
            },
          },
        );

      if (!latestPayment) {
        console.error(
          "PAYFAST ITN: No previous completed payment exists for recurring subscription.",
          {
            subscriptionId:
              subscription.id,
          },
        );

        return new NextResponse(
          "Subscription payment history could not be verified.",
          {
            status: 400,
          },
        );
      }

      /*
       * ------------------------------------------------------
       * 12C. Verify recurring amount
       * ------------------------------------------------------
       */

      if (
        !amountsMatch(
          latestPayment.amount,
          grossAmount,
        )
      ) {
        console.error(
          "PAYFAST ITN: Recurring payment amount mismatch.",
          {
            subscriptionId:
              subscription.id,

            expected:
              latestPayment.amount.toString(),

            received:
              grossAmount,
          },
        );

        return new NextResponse(
          "Payment amount mismatch.",
          {
            status: 400,
          },
        );
      }

      /*
       * ------------------------------------------------------
       * 12D. Verify recurring currency
       * ------------------------------------------------------
       */

      const expectedCurrency =
        normaliseCurrency(
          latestPayment.currency,
        );

      if (
        !expectedCurrency ||
        receivedCurrency !==
          expectedCurrency
      ) {
        console.error(
          "PAYFAST ITN: Recurring payment currency mismatch.",
          {
            subscriptionId:
              subscription.id,

            expected:
              expectedCurrency,

            received:
              receivedCurrency,
          },
        );

        return new NextResponse(
          "Payment currency mismatch.",
          {
            status: 400,
          },
        );
      }

      /*
       * ------------------------------------------------------
       * 12E. Handle failed/cancelled recurring payment
       * ------------------------------------------------------
       */

      const safeReference =
        await getSafePaymentReference(
          paymentReference,
        );

      if (
        paymentStatus !==
        "COMPLETE"
      ) {
        payment =
          await prisma.payment.create(
            {
              data: {
                firmId:
                  subscription.firmId,

                subscriptionId:
                  subscription.id,

                amount:
                  latestPayment.amount,

                currency:
                  latestPayment.currency,

                status:
                  paymentStatus ===
                  "CANCELLED"
                    ? "CANCELLED"
                    : "FAILED",

                paymentReference:
                  safeReference,

                receiptNumber:
                  `PENDING-${crypto
                    .randomBytes(12)
                    .toString("hex")
                    .toUpperCase()}`,

                provider:
                  "PAYFAST",

                providerPaymentId:
                  payFastPaymentId,

                paymentMethod:
                  data.payment_method ||
                  null,

                metadata: {
                  recurring:
                    true,

                  payFastSubscriptionToken,

                  originalPayFastPaymentReference:
                    paymentReference,

                  paymentStatus,

                  amountGross:
                    grossAmount,

                  currency:
                    receivedCurrency,

                  itnReceivedAt:
                    new Date().toISOString(),
                },
              },

              include: {
                subscription: true,
                firm: true,
              },
            },
          );

        if (
          paymentStatus !==
          "CANCELLED"
        ) {
          await prisma.subscription.updateMany(
            {
              where: {
                id:
                  subscription.id,

                firmId:
                  subscription.firmId,

                status:
                  "ACTIVE",
              },

              data: {
                status:
                  "PAST_DUE",
              },
            },
          );
        }

        return new NextResponse(
          "ITN received.",
          {
            status: 200,
          },
        );
      }

      /*
       * ------------------------------------------------------
       * 12F. Prevent duplicate recurring payment
       * ------------------------------------------------------
       */

      const duplicate =
        await prisma.payment.findUnique(
          {
            where: {
              providerPaymentId:
                payFastPaymentId,
            },

            select: {
              id: true,
            },
          },
        );

      if (duplicate) {
        console.log(
          `PAYFAST ITN: Recurring payment ${payFastPaymentId} was already recorded.`,
        );

        return new NextResponse(
          "ITN already processed.",
          {
            status: 200,
          },
        );
      }

      /*
       * ------------------------------------------------------
       * 12G. Create recurring payment
       * ------------------------------------------------------
       */

      const paidAt =
        new Date();

      const finalReceiptNumber =
        createFinalReceiptNumber();

      const periodEnd =
        getNextMonthlyPeriodEnd(
          paidAt,
        );

      const recurringPaymentReference =
        safeReference;

      payment =
        await prisma.$transaction(
          async (tx) => {
            const existingProviderPayment =
              await tx.payment.findUnique(
                {
                  where: {
                    providerPaymentId:
                      payFastPaymentId,
                  },

                  select: {
                    id: true,
                  },
                },
              );

            if (
              existingProviderPayment
            ) {
              const existingPayment =
                await tx.payment.findUnique(
                  {
                    where: {
                      id:
                        existingProviderPayment.id,
                    },

                    include: {
                      subscription: true,
                      firm: true,
                    },
                  },
                );

              if (
                !existingPayment
              ) {
                throw new Error(
                  "Existing provider payment could not be loaded.",
                );
              }

              return existingPayment;
            }

            const currentSubscription =
              await tx.subscription.findUnique(
                {
                  where: {
                    id:
                      subscription.id,
                  },

                  select: {
                    id: true,
                    firmId: true,
                    provider: true,
                    providerSubscriptionId:
                      true,
                    status: true,
                  },
                },
              );

            if (
              !currentSubscription
            ) {
              throw new Error(
                "Subscription disappeared during recurring payment processing.",
              );
            }

            if (
              currentSubscription.firmId !==
              subscription.firmId
            ) {
              throw new Error(
                "Subscription firm ownership mismatch during recurring payment processing.",
              );
            }

            if (
              currentSubscription.provider !==
              "PAYFAST"
            ) {
              throw new Error(
                "Subscription provider mismatch during recurring payment processing.",
              );
            }

            if (
              currentSubscription
                .providerSubscriptionId !==
              payFastSubscriptionToken
            ) {
              throw new Error(
                "PayFast subscription token mismatch during recurring payment processing.",
              );
            }

            if (
              currentSubscription.status ===
                "CANCELLED"
            ) {
              throw new Error(
                "Cancelled subscription cannot receive a recurring payment.",
              );
            }

            const createdPayment =
              await tx.payment.create(
                {
                  data: {
                    firmId:
                      subscription.firmId,

                    subscriptionId:
                      subscription.id,

                    amount:
                      latestPayment.amount,

                    currency:
                      latestPayment.currency,

                    status:
                      "COMPLETED",

                    paymentReference:
                      recurringPaymentReference,

                    receiptNumber:
                      finalReceiptNumber,

                    provider:
                      "PAYFAST",

                    providerPaymentId:
                      payFastPaymentId,

                    paymentMethod:
                      data.payment_method ||
                      null,

                    paidAt,

                    metadata: {
                      recurring:
                        true,

                      payFastSubscriptionToken,

                      originalPayFastPaymentReference:
                        paymentReference,

                      paymentStatus,

                      amountGross:
                        grossAmount,

                      currency:
                        receivedCurrency,

                      validatedByPayFast:
                        true,

                      itnProcessedAt:
                        paidAt.toISOString(),
                    },
                  },

                  include: {
                    subscription: true,
                    firm: true,
                  },
                },
              );

            const subscriptionUpdate =
              await tx.subscription.updateMany(
                {
                  where: {
                    id:
                      subscription.id,

                    firmId:
                      subscription.firmId,

                    provider:
                      "PAYFAST",

                    providerSubscriptionId:
                      payFastSubscriptionToken,

                    status: {
                      in: [
                        "ACTIVE",
                        "PAST_DUE",
                      ],
                    },
                  },

                  data: {
                    status:
                      "ACTIVE",

                    provider:
                      "PAYFAST",

                    currentPeriodStart:
                      paidAt,

                    currentPeriodEnd:
                      periodEnd,

                    cancelledAt:
                      null,
                  },
                },
              );

            if (
              subscriptionUpdate.count !==
              1
            ) {
              throw new Error(
                "Subscription could not be updated after recurring payment.",
              );
            }

            return createdPayment;
          },
        );
    }

    /*
     * --------------------------------------------------------
     * PAYMENT EXISTENCE GUARD
     * --------------------------------------------------------
     */

    if (!payment) {
      throw new Error(
        "Payment could not be resolved after ITN processing.",
      );
    }

    /*
     * --------------------------------------------------------
     * 13. Find firm's active FINANCE user
     * --------------------------------------------------------
     *
     * IMPORTANT SECURITY RULE:
     *
     * Payment receipts, notifications and payment audit
     * attribution must never be assigned to ADMIN.
     *
     * FINANCE is the only role authorised for payment/billing
     * information inside LegalVault.
     */

    const financeUser =
      await prisma.user.findFirst(
        {
          where: {
            firmId:
              payment.firmId,

            role:
              "FINANCE",

            status:
              "ACTIVE",
          },

          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      );

    /*
     * --------------------------------------------------------
     * 14. Send payment receipt
     * --------------------------------------------------------
     */

    let receiptSent =
      false;

    let receiptSendError:
      | string
      | null =
      null;

    if (
      financeUser?.email
    ) {
      try {
        const completedPayment =
          await prisma.payment.findUnique(
            {
              where: {
                id: payment.id,
              },

              include: {
                subscription: true,
                firm: true,
              },
            },
          );

        if (!completedPayment) {
          throw new Error(
            "Completed payment could not be reloaded.",
          );
        }

        if (
          completedPayment.receiptNumber.startsWith(
            "PENDING-",
          )
        ) {
          throw new Error(
            "Completed payment still has a pending receipt number.",
          );
        }

        const receipt =
          createPaymentReceiptEmail(
            {
              firmName:
                completedPayment
                  .firm.name,

              plan:
                completedPayment
                  .subscription
                  .plan,

              amount:
                completedPayment.amount.toString(),

              currency:
                completedPayment.currency,

              paymentReference:
                completedPayment.paymentReference,

              receiptNumber:
                completedPayment.receiptNumber,

              paidAt:
                completedPayment.paidAt ??
                new Date(),
            },
          );

        await sendEmail({
          to:
            financeUser.email,

          subject:
            `LegalVault Payment Receipt - ${completedPayment.receiptNumber}`,

          text:
            receipt.text,

          html:
            receipt.html,
        });

        receiptSent =
          true;

        await prisma.payment.update(
          {
            where: {
              id: payment.id,
            },

            data: {
              receiptEmail:
                financeUser.email,

              receiptSentAt:
                new Date(),

              receiptSendError:
                null,
            },
          },
        );

        console.log(
          `PAYFAST ITN: Receipt ${completedPayment.receiptNumber} sent to FINANCE user ${financeUser.email}.`,
        );
      } catch (emailError) {
        receiptSendError =
          emailError instanceof Error
            ? emailError.message
            : "Unknown receipt email error.";

        console.error(
          "PAYFAST ITN: Receipt email failed.",
          emailError,
        );

        await prisma.payment.update(
          {
            where: {
              id: payment.id,
            },

            data: {
              receiptEmail:
                financeUser.email,

              receiptSendError,
            },
          },
        );
      }
    } else {
      receiptSendError =
        "No active FINANCE email address was found.";

      console.error(
        `PAYFAST ITN: ${receiptSendError}`,
      );

      await prisma.payment.update(
        {
          where: {
            id: payment.id,
          },

          data: {
            receiptSendError,
          },
        },
      );
    }

    /*
     * --------------------------------------------------------
     * 15. Create FINANCE notification
     * --------------------------------------------------------
     *
     * IMPORTANT SECURITY RULE:
     *
     * Payment notifications contain financial information.
     * They must only be created for the active FINANCE user.
     *
     * Notification delivery is deliberately independent from
     * payment processing. If notification creation fails,
     * the successful payment remains successful.
     */

    let notificationCreated =
      false;

    let notificationError:
      | string
      | null =
      null;

    if (financeUser) {
      try {
        await prisma.notification.create({
          data: {
            firmId:
              payment.firmId,

            userId:
              financeUser.id,

            type:
              "SYSTEM",

            title:
              "Payment successful",

            message:
              `Payment ${payment.paymentReference} of ${payment.currency} ${payment.amount.toFixed(2)} for the ${payment.subscription.plan} plan was successfully processed. Receipt: ${payment.receiptNumber}.`,
          },
        });

        notificationCreated =
          true;

        console.log(
          `PAYFAST ITN: Payment notification created for FINANCE user ${financeUser.email}.`,
        );
      } catch (notificationCreateError) {
        notificationError =
          notificationCreateError instanceof Error
            ? notificationCreateError.message
            : "Unknown notification creation error.";

        console.error(
          "PAYFAST ITN: Payment notification creation failed.",
          notificationCreateError,
        );

        /*
         * Do not reverse or invalidate the successful payment.
         *
         * The payment has already been verified and completed.
         */
      }
    } else {
      notificationError =
        "No active FINANCE user was found.";

      console.warn(
        `PAYFAST ITN: ${notificationError} Payment notification was not created.`,
        {
          paymentId:
            payment.id,

          firmId:
            payment.firmId,
        },
      );
    }

    /*
     * --------------------------------------------------------
     * 16. Create audit log
     * --------------------------------------------------------
     *
     * The audit actor is FINANCE, never ADMIN.
     *
     * The payment itself is processed server-to-server by
     * PayFast and does not require an authenticated user.
     * FINANCE is used only as the firm's authorised financial
     * owner/recipient for the audit record.
     */

    if (financeUser) {
      try {
        await createAuditLog({
          request,

          firmId:
            payment.firmId,

          userId:
            financeUser.id,

          action:
            "UPDATE",

          entityType:
            "Payment",

          entityId:
            payment.id,

          description:
            `PayFast payment ${payment.paymentReference} was verified and completed.`,

          metadata: {
            event:
              "PAYMENT_COMPLETED",

            provider:
              "PAYFAST",

            providerPaymentId:
              payFastPaymentId,

            providerSubscriptionId:
              payFastSubscriptionToken ??
              payment.subscription
                .providerSubscriptionId,

            amount:
              payment.amount.toString(),

            currency:
              payment.currency,

            subscriptionId:
              payment.subscriptionId,

            plan:
              payment.subscription
                .plan,

            receiptNumber:
              payment.receiptNumber,

            receiptSent,

            receiptSendError,

            notificationCreated,

            notificationError,

            financeUserId:
              financeUser.id,
          },
        });
      } catch (auditError) {
        /*
         * Payment has already been successfully processed.
         * An audit-log failure must not cause PayFast to retry
         * an otherwise successful payment.
         */
        console.error(
          "PAYFAST ITN: Audit log creation failed.",
          auditError,
        );
      }
    } else {
      console.warn(
        "PAYFAST ITN: Payment completed but no active FINANCE user was available for audit attribution.",
        {
          paymentId:
            payment.id,

          firmId:
            payment.firmId,
        },
      );
    }

    /*
     * --------------------------------------------------------
     * 17. Success
     * --------------------------------------------------------
     */

    console.log(
      `PAYFAST ITN: Payment ${paymentReference} completed successfully.`,
      {
        paymentId:
          payment.id,

        subscriptionId:
          payment.subscriptionId,

        payFastPaymentId,

        payFastSubscriptionToken,

        notificationCreated,

        notificationError,
      },
    );

    return new NextResponse(
      "ITN processed successfully.",
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error(
      "PAYFAST ITN ERROR:",
      error,
    );

    /*
     * Returning 500 tells PayFast that processing failed
     * and allows PayFast to retry the ITN.
     */
    return new NextResponse(
      "Internal server error.",
      {
        status: 500,
      },
    );
  }
}