import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

const RESET_TOKEN_EXPIRY_MINUTES = 30;

export async function POST(request: NextRequest) {
  try {
    // ------------------------------------------------------------
    // VALIDATE REQUEST BODY
    // ------------------------------------------------------------

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json({
        message:
          "If an account with that email exists, a password reset link has been sent.",
      });
    }

    if (
      typeof body !== "object" ||
      body === null ||
      !("email" in body) ||
      typeof body.email !== "string"
    ) {
      return NextResponse.json({
        message:
          "If an account with that email exists, a password reset link has been sent.",
      });
    }

    // ------------------------------------------------------------
    // NORMALIZE EMAIL
    // ------------------------------------------------------------

    const email = body.email.trim().toLowerCase();

    if (!email) {
      return NextResponse.json({
        message:
          "If an account with that email exists, a password reset link has been sent.",
      });
    }

    // ------------------------------------------------------------
    // FIND USER
    // ------------------------------------------------------------

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    // ------------------------------------------------------------
    // PREVENT ACCOUNT ENUMERATION
    // ------------------------------------------------------------

    if (!user) {
      return NextResponse.json({
        message:
          "If an account with that email exists, a password reset link has been sent.",
      });
    }

    // ------------------------------------------------------------
    // ONLY ACTIVE USERS MAY RESET PASSWORDS
    // ------------------------------------------------------------

    if (user.status !== "ACTIVE") {
      return NextResponse.json({
        message:
          "If an account with that email exists, a password reset link has been sent.",
      });
    }

    // ------------------------------------------------------------
    // GENERATE CRYPTOGRAPHICALLY SECURE TOKEN
    // ------------------------------------------------------------

    const rawToken = crypto.randomBytes(32).toString("hex");

    // Only the hash is stored in the database.
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    // ------------------------------------------------------------
    // TOKEN EXPIRATION
    // ------------------------------------------------------------

    const expiresAt = new Date(
      Date.now() +
        RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000,
    );

    // ------------------------------------------------------------
    // INVALIDATE PREVIOUS RESET TOKENS
    // ------------------------------------------------------------

    await prisma.passwordResetToken.deleteMany({
      where: {
        userId: user.id,
      },
    });

    // ------------------------------------------------------------
    // STORE NEW RESET TOKEN
    // ------------------------------------------------------------

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    // ------------------------------------------------------------
    // APPLICATION URL
    // ------------------------------------------------------------

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL;

    if (!appUrl) {
      console.error(
        "NEXT_PUBLIC_APP_URL is not configured.",
      );

      // Remove the token because we cannot create a usable
      // password reset link.
      await prisma.passwordResetToken.deleteMany({
        where: {
          tokenHash,
        },
      });

      return NextResponse.json({
        message:
          "If an account with that email exists, a password reset link has been sent.",
      });
    }

    // ------------------------------------------------------------
    // CREATE RESET URL
    // ------------------------------------------------------------

    const resetUrl =
      `${appUrl.replace(/\/$/, "")}` +
      `/reset-password?token=${encodeURIComponent(rawToken)}`;

    // ------------------------------------------------------------
    // SEND PASSWORD RESET EMAIL
    // ------------------------------------------------------------

    try {
      await sendEmail({
        to: user.email,

        subject:
          "Reset your LegalVault password",

        text: `
We received a request to reset your LegalVault password.

Use the link below to create a new password:

${resetUrl}

This password reset link will expire in 30 minutes.

If you did not request a password reset, you can safely ignore this email. Your password will not be changed.

LegalVault
Secure Legal Document Management
        `.trim(),

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
          We received a request to reset the password
          for your LegalVault account.
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
          This password reset link will expire in
          30 minutes.
        </p>

        <p
          style="
            font-size: 14px;
            line-height: 1.6;
            color: #6b7280;
          "
        >
          If you did not request a password reset,
          you can safely ignore this email.
          Your password will not be changed.
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
        `.trim(),
      });
    } catch (error) {
      console.error(
        "Password reset email failed:",
        error,
      );

      // The email was not sent, so invalidate the token.
      await prisma.passwordResetToken.deleteMany({
        where: {
          tokenHash,
        },
      });

      // Never reveal whether the account exists.
      return NextResponse.json({
        message:
          "If an account with that email exists, a password reset link has been sent.",
      });
    }

    // ------------------------------------------------------------
    // SUCCESS
    // ------------------------------------------------------------

    return NextResponse.json({
      message:
        "If an account with that email exists, a password reset link has been sent.",
    });
  } catch (error) {
    // ------------------------------------------------------------
    // UNEXPECTED ERROR
    // ------------------------------------------------------------

    console.error(
      "Password reset request error:",
      error,
    );

    // Never expose internal errors or account existence.
    return NextResponse.json({
      message:
        "If an account with that email exists, a password reset link has been sent.",
    });
  }
}