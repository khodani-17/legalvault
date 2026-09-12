import crypto from "crypto";

/**
 * PayFast Custom Integration URL encoding.
 *
 * PayFast requires:
 * - URL encoding
 * - uppercase hexadecimal encoding
 * - spaces represented as "+"
 *
 * encodeURIComponent() already produces uppercase
 * hexadecimal escape sequences.
 */
function encodeValue(
  value: string,
): string {
  return encodeURIComponent(
    value.trim(),
  ).replace(
    /%20/g,
    "+",
  );
}

/**
 * Generates a PayFast Custom Integration security signature.
 *
 * IMPORTANT:
 *
 * This function implements the CUSTOM PAYMENT
 * INTEGRATION signature format.
 *
 * It must NOT alphabetically sort the fields.
 *
 * PayFast requires Custom Integration parameters
 * to be signed in the same order in which they
 * appear in the payment form/documentation.
 *
 * The API signature format is different and uses
 * alphabetical ordering.
 *
 * PayFast documentation:
 * https://developers.payfast.co.za/docs/itn-instant-transaction-notification/
 */
export function generatePayFastSignature(
  fields: Record<string, string>,
  passphrase?: string,
): string {
  const parameterString =
    Object.entries(fields)
      .filter(
        ([, value]) =>
          value !== undefined &&
          value !== null &&
          String(value).trim() !== "",
      )
      .map(
        ([key, value]) =>
          `${key}=${encodeValue(
            String(value),
          )}`,
      )
      .join("&");

  /*
   * For recurring subscriptions, PayFast requires
   * the merchant passphrase to be included.
   */
  const stringToHash =
    passphrase !== undefined &&
    passphrase !== null &&
    passphrase.trim() !== ""
      ? `${parameterString}&passphrase=${encodeValue(
          passphrase,
        )}`
      : parameterString;

  /*
   * PayFast requires a lowercase MD5 hash.
   *
   * Node's digest("hex") returns lowercase hexadecimal.
   */
  return crypto
    .createHash("md5")
    .update(stringToHash, "utf8")
    .digest("hex");
}