import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";

const MIN_PASSWORD_LENGTH = 8;

export async function POST(request: NextRequest) {
  try {
    // ------------------------------------------------------------
    // VALIDATE REQUEST BODY
    // ------------------------------------------------------------

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          message: "Invalid request.",
        },
        { status: 400 },
      );
    }

    if (
      typeof body !== "object" ||
      body === null ||
      !("token" in body) ||
      !("password" in body) ||
      typeof body.token !== "string" ||
      typeof body.password !== "string"
    ) {
      return NextResponse.json(
        {
          message: "Invalid request.",
        },
        { status: 400 },
      );
    }

    const token = body.token.trim();
    const password = body.password;

    // ------------------------------------------------------------
    // BASIC TOKEN VALIDATION
    // ------------------------------------------------------------

    if (!token) {
      return NextResponse.json(
        {
          message: "Invalid or expired password reset link.",
        },
        { status: 400 },
      );
    }

    // ------------------------------------------------------------
    // PASSWORD VALIDATION
    // ------------------------------------------------------------

    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        {
          message:
            "Password must be at least 8 characters long.",
        },
        { status: 400 },
      );
    }

    // ------------------------------------------------------------
    // HASH THE TOKEN
    // ------------------------------------------------------------
    //
    // The database never contains the raw reset token.
    // The email contains the raw token, while the database
    // contains only its SHA-256 hash.
    //

    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    // ------------------------------------------------------------
    // FIND VALID RESET TOKEN
    // ------------------------------------------------------------

    const resetToken =
      await prisma.passwordResetToken.findUnique({
        where: {
          tokenHash,
        },
        include: {
          user: true,
        },
      });

    // ------------------------------------------------------------
    // INVALID TOKEN
    // ------------------------------------------------------------

    if (!resetToken) {
      return NextResponse.json(
        {
          message:
            "Invalid or expired password reset link.",
        },
        { status: 400 },
      );
    }

    // ------------------------------------------------------------
    // CHECK TOKEN EXPIRATION
    // ------------------------------------------------------------

    if (resetToken.expiresAt <= new Date()) {
      // Delete expired token so it cannot be used again.
      await prisma.passwordResetToken.delete({
        where: {
          id: resetToken.id,
        },
      });

      return NextResponse.json(
        {
          message:
            "Invalid or expired password reset link.",
        },
        { status: 400 },
      );
    }

    // ------------------------------------------------------------
    // CHECK USER STATUS
    // ------------------------------------------------------------

    if (resetToken.user.status !== "ACTIVE") {
      // Remove the token if the account is no longer active.
      await prisma.passwordResetToken.delete({
        where: {
          id: resetToken.id,
        },
      });

      return NextResponse.json(
        {
          message:
            "Invalid or expired password reset link.",
        },
        { status: 400 },
      );
    }

    // ------------------------------------------------------------
    // HASH NEW PASSWORD
    // ------------------------------------------------------------

    const passwordHash = await bcrypt.hash(
      password,
      12,
    );

    // ------------------------------------------------------------
    // UPDATE PASSWORD AND INVALIDATE TOKEN
    // ------------------------------------------------------------
    //
    // These operations happen inside a transaction.
    // This prevents the password from being changed while
    // leaving the reset token usable.
    //

    await prisma.$transaction([
      prisma.user.update({
        where: {
          id: resetToken.userId,
        },
        data: {
          passwordHash,
        },
      }),

      prisma.passwordResetToken.delete({
        where: {
          id: resetToken.id,
        },
      }),

      // Invalidate any other reset tokens belonging to
      // this user as an additional security measure.
      prisma.passwordResetToken.deleteMany({
        where: {
          userId: resetToken.userId,
          id: {
            not: resetToken.id,
          },
        },
      }),
    ]);

    // ------------------------------------------------------------
    // SUCCESS
    // ------------------------------------------------------------

    return NextResponse.json({
      message:
        "Your password has been reset successfully. You can now sign in with your new password.",
    });
  } catch (error) {
    // ------------------------------------------------------------
    // UNEXPECTED ERROR
    // ------------------------------------------------------------

    console.error(
      "Password reset error:",
      error,
    );

    return NextResponse.json(
      {
        message:
          "Unable to reset your password. Please try again.",
      },
      { status: 500 },
    );
  }
}