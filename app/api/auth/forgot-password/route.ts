import { NextResponse } from "next/server";
import crypto from "crypto";

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

const RESET_TOKEN_EXPIRY_HOURS = 1;

function hashToken(token: string): string {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function getAppUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL;

  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL or NEXTAUTH_URL is not configured."
    );
  }

  return url.replace(/\/+$/, "");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const email =
      typeof body?.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    /*
     * Always return the same response regardless of
     * whether the account exists.
     *
     * This prevents account enumeration.
     */
    const genericResponse = NextResponse.json({
      success: true,
      message:
        "If an account exists for that email address, a password reset link has been sent.",
    });

    if (!email || email.length > 320) {
      return genericResponse;
    }

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        firmId: true,
      },
    });

    /*
     * Do not reveal whether the account exists.
     */
    if (!user || user.status !== "ACTIVE") {
      return genericResponse;
    }

    /*
     * Remove previous reset tokens for this user.
     */
    await prisma.passwordResetToken.deleteMany({
      where: {
        userId: user.id,
      },
    });

    /*
     * Generate a cryptographically secure token.
     */
    const rawToken = generateToken();
    const tokenHash = hashToken(rawToken);

    const expiresAt = new Date(
      Date.now() +
        RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000
    );

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    const resetUrl =
      `${getAppUrl()}/reset-password/${rawToken}`;

    await sendEmail({
      to: user.email,
      subject: "LegalVault Password Reset",
      text: [
        `Hello ${user.name},`,
        "",
        "We received a request to reset your LegalVault password.",
        "",
        `Reset your password here: ${resetUrl}`,
        "",
        "This link expires in 1 hour.",
        "",
        "If you did not request a password reset, you can safely ignore this email.",
        "",
        "LegalVault",
      ].join("\n"),
      html: `
        <!DOCTYPE html>
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
            <h2>LegalVault Password Reset</h2>

            <p>Hello ${escapeHtml(user.name)},</p>

            <p>
              We received a request to reset your LegalVault password.
            </p>

            <p>
              <a
                href="${escapeHtml(resetUrl)}"
                style="
                  display:inline-block;
                  padding:12px 20px;
                  background:#111827;
                  color:#ffffff;
                  text-decoration:none;
                  border-radius:6px;
                "
              >
                Reset Password
              </a>
            </p>

            <p>
              This link expires in <strong>1 hour</strong>.
            </p>

            <p>
              If you did not request a password reset, you can safely
              ignore this email.
            </p>

            <p>LegalVault</p>
          </body>
        </html>
      `,
    });

    return genericResponse;
  } catch (error) {
    console.error(
      "Forgot password error:",
      error
    );

    /*
     * Do not expose internal errors to the client.
     * Keep the response generic.
     */
    return NextResponse.json(
      {
        success: false,
        message:
          "If an account exists for that email address, a password reset link has been sent.",
      },
      { status: 200 }
    );
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}