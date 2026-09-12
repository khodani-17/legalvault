export type PayFastConfig = {
  merchantId: string;
  merchantKey: string;
  passphrase: string;
  sandbox: boolean;
  processUrl: string;
};

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `Missing required PayFast environment variable: ${name}`,
    );
  }

  return value;
}

function getSandboxMode(): boolean {
  const value = process.env.PAYFAST_SANDBOX
    ?.trim()
    .toLowerCase();

  if (value !== "true" && value !== "false") {
    throw new Error(
      "PAYFAST_SANDBOX must be explicitly set to true or false.",
    );
  }

  return value === "true";
}

export function getPayFastConfig(): PayFastConfig {
  const sandbox = getSandboxMode();

  const merchantId = getRequiredEnv(
    "PAYFAST_MERCHANT_ID",
  );

  const merchantKey = getRequiredEnv(
    "PAYFAST_MERCHANT_KEY",
  );

  const passphrase = getRequiredEnv(
    "PAYFAST_PASSPHRASE",
  );

  console.log("[PayFast diagnostic]", {
    sandbox,
    merchantIdLength: merchantId.length,
    merchantKeyLength: merchantKey.length,
    passphraseLength: passphrase.length,
    processUrl: sandbox
      ? "https://sandbox.payfast.co.za/eng/process"
      : "https://www.payfast.co.za/eng/process",
  });

  if (
    process.env.NODE_ENV === "production" &&
    sandbox
  ) {
    throw new Error(
      "PAYFAST_SANDBOX must be false in production.",
    );
  }

  const processUrl = sandbox
    ? "https://sandbox.payfast.co.za/eng/process"
    : "https://www.payfast.co.za/eng/process";

  return {
    merchantId,
    merchantKey,
    passphrase,
    sandbox,
    processUrl,
  };
}