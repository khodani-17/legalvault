export type PaymentReceiptData = {
  firmName: string;
  plan: string;
  amount: string;
  currency: string;
  paymentReference: string;
  receiptNumber: string;
  paidAt: Date;
};

function escapeHtml(
  value: string,
): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function validateText(
  value: string,
  fieldName: string,
): string {
  const cleaned = value.trim();

  if (!cleaned) {
    throw new Error(
      `${fieldName} is required.`,
    );
  }

  if (cleaned.length > 500) {
    throw new Error(
      `${fieldName} is too long.`,
    );
  }

  return cleaned;
}

function formatAmount(
  amount: string,
  currency: string,
): string {
  const numericAmount =
    Number(amount);

  if (
    !Number.isFinite(
      numericAmount,
    ) ||
    numericAmount < 0
  ) {
    throw new Error(
      "Payment amount is invalid.",
    );
  }

  const normalizedCurrency =
    currency.trim().toUpperCase();

  if (
    !/^[A-Z]{3}$/.test(
      normalizedCurrency,
    )
  ) {
    throw new Error(
      "Payment currency is invalid.",
    );
  }

  try {
    return new Intl.NumberFormat(
      "en-ZA",
      {
        style: "currency",
        currency:
          normalizedCurrency,
      },
    ).format(numericAmount);
  } catch {
    throw new Error(
      "Payment currency is invalid.",
    );
  }
}

function formatDate(
  date: Date,
): string {
  if (
    !(date instanceof Date) ||
    Number.isNaN(date.getTime())
  ) {
    throw new Error(
      "Payment date is invalid.",
    );
  }

  return new Intl.DateTimeFormat(
    "en-ZA",
    {
      dateStyle: "long",
      timeStyle: "short",
      timeZone:
        "Africa/Johannesburg",
    },
  ).format(date);
}

export function createPaymentReceiptEmail(
  data: PaymentReceiptData,
) {
  // ----------------------------------------------------------
  // VALIDATE RECEIPT DATA
  // ----------------------------------------------------------

  const firmName =
    validateText(
      data.firmName,
      "Firm name",
    );

  const plan =
    validateText(
      data.plan,
      "Subscription plan",
    );

  const paymentReference =
    validateText(
      data.paymentReference,
      "Payment reference",
    );

  const receiptNumber =
    validateText(
      data.receiptNumber,
      "Receipt number",
    );

  const currency =
    data.currency
      .trim()
      .toUpperCase();

  if (
    !/^[A-Z]{3}$/.test(
      currency,
    )
  ) {
    throw new Error(
      "Payment currency is invalid.",
    );
  }

  const formattedAmount =
    formatAmount(
      data.amount,
      currency,
    );

  const formattedDate =
    formatDate(data.paidAt);

  // ----------------------------------------------------------
  // ESCAPE VALUES FOR HTML EMAIL
  // ----------------------------------------------------------

  const safeFirmName =
    escapeHtml(firmName);

  const safePlan =
    escapeHtml(plan);

  const safePaymentReference =
    escapeHtml(
      paymentReference,
    );

  const safeReceiptNumber =
    escapeHtml(receiptNumber);

  const safeFormattedAmount =
    escapeHtml(
      formattedAmount,
    );

  const safeFormattedDate =
    escapeHtml(
      formattedDate,
    );

  // ----------------------------------------------------------
  // PLAIN-TEXT RECEIPT
  // ----------------------------------------------------------

  const text = `
LegalVault Payment Receipt

Thank you for your payment.

Firm: ${firmName}
Subscription Plan: ${plan}
Amount Paid: ${formattedAmount}
Payment Reference: ${paymentReference}
Receipt Number: ${receiptNumber}
Payment Date: ${formattedDate}

Your LegalVault subscription has been activated.

This receipt was generated automatically by LegalVault.

LegalVault
Secure Legal Document Management
`.trim();

  // ----------------------------------------------------------
  // HTML RECEIPT
  // ----------------------------------------------------------

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  />
  <title>LegalVault Payment Receipt</title>
</head>

<body
  style="
    margin:0;
    padding:0;
    background:#f4f4f4;
    font-family:Arial,Helvetica,sans-serif;
    color:#222;
  "
>
  <div
    style="
      max-width:640px;
      margin:40px auto;
      background:#ffffff;
      border-radius:8px;
      overflow:hidden;
      box-shadow:0 2px 8px rgba(0,0,0,0.08);
    "
  >
    <div
      style="
        padding:28px;
        background:#111827;
        color:#ffffff;
      "
    >
      <h1
        style="
          margin:0;
          font-size:26px;
        "
      >
        LegalVault
      </h1>

      <p
        style="
          margin:8px 0 0;
          color:#d1d5db;
        "
      >
        Payment Receipt
      </p>
    </div>

    <div style="padding:32px;">
      <h2
        style="
          margin-top:0;
          color:#111827;
        "
      >
        Payment successful
      </h2>

      <p>
        Thank you for your payment. Your LegalVault
        subscription has been activated.
      </p>

      <table
        width="100%"
        cellpadding="10"
        cellspacing="0"
        style="
          margin-top:24px;
          border-collapse:collapse;
        "
      >
        <tr>
          <td
            style="
              border-bottom:1px solid #e5e7eb;
              font-weight:bold;
            "
          >
            Firm
          </td>

          <td
            style="
              border-bottom:1px solid #e5e7eb;
              text-align:right;
            "
          >
            ${safeFirmName}
          </td>
        </tr>

        <tr>
          <td
            style="
              border-bottom:1px solid #e5e7eb;
              font-weight:bold;
            "
          >
            Subscription
          </td>

          <td
            style="
              border-bottom:1px solid #e5e7eb;
              text-align:right;
            "
          >
            ${safePlan}
          </td>
        </tr>

        <tr>
          <td
            style="
              border-bottom:1px solid #e5e7eb;
              font-weight:bold;
            "
          >
            Amount Paid
          </td>

          <td
            style="
              border-bottom:1px solid #e5e7eb;
              text-align:right;
            "
          >
            ${safeFormattedAmount}
          </td>
        </tr>

        <tr>
          <td
            style="
              border-bottom:1px solid #e5e7eb;
              font-weight:bold;
            "
          >
            Payment Reference
          </td>

          <td
            style="
              border-bottom:1px solid #e5e7eb;
              text-align:right;
            "
          >
            ${safePaymentReference}
          </td>
        </tr>

        <tr>
          <td
            style="
              border-bottom:1px solid #e5e7eb;
              font-weight:bold;
            "
          >
            Receipt Number
          </td>

          <td
            style="
              border-bottom:1px solid #e5e7eb;
              text-align:right;
            "
          >
            ${safeReceiptNumber}
          </td>
        </tr>

        <tr>
          <td style="font-weight:bold;">
            Payment Date
          </td>

          <td style="text-align:right;">
            ${safeFormattedDate}
          </td>
        </tr>
      </table>

      <p
        style="
          margin-top:28px;
          font-size:13px;
          color:#6b7280;
        "
      >
        This receipt was generated automatically by
        LegalVault.
      </p>
    </div>

    <div
      style="
        padding:20px 32px;
        background:#f9fafb;
        color:#6b7280;
        font-size:12px;
      "
    >
      LegalVault — Secure Legal Document Management
    </div>
  </div>
</body>
</html>
`.trim();

  return {
    text,
    html,
  };
}