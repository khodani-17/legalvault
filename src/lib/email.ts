import { Resend } from "resend";

interface SendPasswordResetEmailParams {
  to: string;
  resetUrl: string;
}

export async function sendPasswordResetEmail({
  to,
  resetUrl,
}: SendPasswordResetEmailParams) {
  // ------------------------------------------------------------
  // VALIDATE RESEND CONFIGURATION
  // ------------------------------------------------------------

  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  // Create the Resend client only after confirming the API key
  // exists.
  const resend = new Resend(apiKey);

  // ------------------------------------------------------------
  // FROM ADDRESS
  // ------------------------------------------------------------

  const fromEmail =
    process.env.RESEND_FROM_EMAIL ||
    "LegalVault <onboarding@resend.dev>";

  // ------------------------------------------------------------
  // SEND EMAIL
  // ------------------------------------------------------------

  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to: [to],
    subject: "Reset your LegalVault password",

    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          />
          <title>Reset your LegalVault password</title>
        </head>

        <body
          style="
            margin: 0;
            padding: 0;
            background-color: #f4f6f8;
            font-family: Arial, Helvetica, sans-serif;
            color: #1f2937;
          "
        >
          <div style="padding: 40px 20px;">
            <div
              style="
                max-width: 600px;
                margin: 0 auto;
                background: #ffffff;
                border-radius: 12px;
                padding: 40px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
              "
            >
              <div
                style="
                  text-align: center;
                  margin-bottom: 30px;
                "
              >
                <h1
                  style="
                    margin: 0;
                    font-size: 28px;
                    color: #111827;
                    letter-spacing: 1px;
                  "
                >
                  LEGALVAULT
                </h1>

                <p
                  style="
                    margin-top: 8px;
                    color: #6b7280;
                    font-size: 14px;
                  "
                >
                  Secure Legal Document Management
                </p>
              </div>

              <h2
                style="
                  font-size: 22px;
                  margin-bottom: 16px;
                  color: #111827;
                "
              >
                Reset your password
              </h2>

              <p
                style="
                  font-size: 16px;
                  line-height: 1.6;
                  color: #4b5563;
                "
              >
                We received a request to reset the password for your
                LegalVault account.
              </p>

              <p
                style="
                  font-size: 16px;
                  line-height: 1.6;
                  color: #4b5563;
                "
              >
                Click the button below to create a new password.
              </p>

              <div
                style="
                  text-align: center;
                  margin: 32px 0;
                "
              >
                <a
                  href="${resetUrl}"
                  style="
                    display: inline-block;
                    padding: 14px 28px;
                    background-color: #1f4e79;
                    color: #ffffff;
                    text-decoration: none;
                    border-radius: 8px;
                    font-size: 16px;
                    font-weight: bold;
                  "
                >
                  Reset Password
                </a>
              </div>

              <p
                style="
                  font-size: 14px;
                  line-height: 1.6;
                  color: #6b7280;
                "
              >
                This password reset link will expire in 30 minutes.
              </p>

              <p
                style="
                  font-size: 14px;
                  line-height: 1.6;
                  color: #6b7280;
                "
              >
                If you did not request a password reset, you can safely
                ignore this email. Your password will not be changed.
              </p>

              <hr
                style="
                  border: 0;
                  border-top: 1px solid #e5e7eb;
                  margin: 32px 0;
                "
              />

              <p
                style="
                  margin: 0;
                  text-align: center;
                  font-size: 12px;
                  color: #9ca3af;
                "
              >
                This is an automated message from LegalVault.
              </p>
            </div>
          </div>
        </body>
      </html>
    `,
  });

  // ------------------------------------------------------------
  // HANDLE RESEND ERROR
  // ------------------------------------------------------------

  if (error) {
    console.error("Resend email error:", error);
    throw new Error("Failed to send password reset email");
  }

  return data;
}