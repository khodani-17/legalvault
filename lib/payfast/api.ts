import crypto from "crypto";

const PAYFAST_API_BASE = "https://api.payfast.co.za";

type PayFastConfig = {
  merchantId: string;
  passphrase: string;
  sandbox: boolean;
};

function getPayFastConfig(): PayFastConfig {
  const merchantId = process.env.PAYFAST_MERCHANT_ID;
  const passphrase = process.env.PAYFAST_PASSPHRASE;

  if (!merchantId) {
    throw new Error("PayFast merchant ID is not configured.");
  }

  if (!passphrase) {
    throw new Error("PayFast passphrase is not configured.");
  }

  return {
    merchantId,
    passphrase,
    sandbox:
      process.env.PAYFAST_MODE?.toLowerCase() === "sandbox" ||
      process.env.PAYFAST_SANDBOX === "true",
  };
}

function createTimestamp(): string {
  return new Date().toISOString();
}

function encodeValue(value: unknown): string {
  return encodeURIComponent(String(value))
    .replace(/%20/g, "+")
    .replace(/!/g, "%21")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29");
}

function createApiSignature(
  values: Record<string, string>,
  passphrase: string,
): string {
  const canonical = Object.keys(values)
    .sort()
    .map(
      (key) =>
        `${encodeURIComponent(key)}=${encodeValue(values[key])}`,
    )
    .join("&");

  const signedString = `${canonical}&passphrase=${encodeValue(
    passphrase,
  )}`;

  return crypto
    .createHash("md5")
    .update(signedString)
    .digest("hex")
    .toLowerCase();
}

type PayFastApiResponse = {
  status?: string;
  data?: {
    response?: boolean;
    message?: string;
    [key: string]: unknown;
  };
  message?: string;
  [key: string]: unknown;
};

export async function cancelPayFastSubscription(
  subscriptionToken: string,
): Promise<void> {
  if (!subscriptionToken || !subscriptionToken.trim()) {
    throw new Error("Invalid PayFast subscription token.");
  }

  const config = getPayFastConfig();

  const timestamp = createTimestamp();

  const signatureValues: Record<string, string> = {
    "merchant-id": config.merchantId,
    version: "v1",
    timestamp,
  };

  const signature = createApiSignature(
    signatureValues,
    config.passphrase,
  );

  const query = config.sandbox ? "?testing=true" : "";

  const response = await fetch(
    `${PAYFAST_API_BASE}/subscriptions/${encodeURIComponent(
      subscriptionToken,
    )}/cancel${query}`,
    {
      method: "PUT",
      headers: {
        "merchant-id": config.merchantId,
        version: "v1",
        timestamp,
        signature,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      cache: "no-store",
    },
  );

  const responseText = await response.text();

  let data: PayFastApiResponse;

  try {
    data = responseText
      ? (JSON.parse(responseText) as PayFastApiResponse)
      : {};
  } catch {
    throw new Error(
      `PayFast returned an invalid response (${response.status}).`,
    );
  }

  if (!response.ok) {
    const message =
      typeof data.message === "string"
        ? data.message
        : typeof data.data?.message === "string"
          ? data.data.message
          : `HTTP ${response.status}`;

    throw new Error(`PayFast cancellation failed: ${message}`);
  }

  if (
    data.status !== "success" ||
    data.data?.response !== true
  ) {
    const message =
      typeof data.message === "string"
        ? data.message
        : typeof data.data?.message === "string"
          ? data.data.message
          : "PayFast did not confirm the cancellation.";

    throw new Error(`PayFast cancellation failed: ${message}`);
  }
}