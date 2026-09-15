import { NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";

const MIN_PASSWORD_LENGTH = 12;

function hashToken(token: string): string {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const token =
      typeof body?.token === "string"
        ? body.token.trim()
        : "";

    const password =
      typeof body?.password === "string"
        ? body.password
        : "";

    if (!token || token.length !== 64) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This password reset link is invalid or has expired.",
        },
        { status: 400 }
      );
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Password must be at least 12 characters long.",
        },
        { status: 400 }
      );
    }

    if (password.length > 128) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Password must not exceed 128 characters.",
        },
        { status: 400 }
      );
    }

    const tokenHash = hashToken(token);
    const now = new Date();

    const passwordHash = await bcrypt.hash(
      password,
      12
    );

    /*
     * Claim the token inside a transaction.
     *
     * The token is deleted when successfully claimed,
     * making it single-use.
     */
    const result = await prisma.$transaction(
      async (tx) => {
        const resetToken =
          await tx.passwordResetToken.findUnique({
            where: {
              tokenHash,
            },
            select: {
              id: true,
              userId: true,
              expiresAt: true,
            },
          });

        if (
          !resetToken ||
          resetToken.expiresAt <= now
        ) {
          return false;
        }

        const deleted =
          await tx.passwordResetToken.deleteMany({
            where: {
              id: resetToken.id,
              tokenHash,
              expiresAt: {
                gt: now,
              },
            },
          });

        if (deleted.count !== 1) {
          return false;
        }

        await tx.user.update({
          where: {
            id: resetToken.userId,
          },
          data: {
            passwordHash,
          },
        });

        /*
         * Remove any other reset tokens belonging to
         * this user.
         */
        await tx.passwordResetToken.deleteMany({
          where: {
            userId: resetToken.userId,
          },
        });

        return true;
      },
      {
        isolationLevel: "Serializable",
      }
    );

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This password reset link is invalid or has expired.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Your password has been reset successfully.",
    });
  } catch (error) {
    console.error(
      "Reset password error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to reset your password. Please request a new reset link.",
      },
      { status: 500 }
    );
  }
}