import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";

function generateFirmReference(): string {
  const timestamp = Date.now().toString(36).toUpperCase();

  const random = Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase();

  return `FIRM-${timestamp}-${random}`;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPassword(password: string): boolean {
  return password.length >= 8;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const firmName =
      typeof body.firmName === "string"
        ? body.firmName.trim()
        : "";

    const registrationNumber =
      typeof body.registrationNumber === "string"
        ? body.registrationNumber.trim()
        : "";

    const firmEmail =
      typeof body.firmEmail === "string"
        ? body.firmEmail.trim().toLowerCase()
        : "";

    const firmPhone =
      typeof body.firmPhone === "string"
        ? body.firmPhone.trim()
        : "";

    const firmAddress =
      typeof body.firmAddress === "string"
        ? body.firmAddress.trim()
        : "";

    const adminName =
      typeof body.adminName === "string"
        ? body.adminName.trim()
        : "";

    const adminEmail =
      typeof body.adminEmail === "string"
        ? body.adminEmail.trim().toLowerCase()
        : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    const confirmPassword =
      typeof body.confirmPassword === "string"
        ? body.confirmPassword
        : "";

    // ----------------------------------------------------------
    // VALIDATION
    // ----------------------------------------------------------

    if (!firmName) {
      return NextResponse.json(
        {
          error: "Law firm name is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (firmName.length > 255) {
      return NextResponse.json(
        {
          error: "Law firm name is too long.",
        },
        {
          status: 400,
        },
      );
    }

    if (firmEmail && !isValidEmail(firmEmail)) {
      return NextResponse.json(
        {
          error:
            "Please provide a valid firm email address.",
        },
        {
          status: 400,
        },
      );
    }

    if (!adminName) {
      return NextResponse.json(
        {
          error: "Administrator name is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (adminName.length > 255) {
      return NextResponse.json(
        {
          error: "Administrator name is too long.",
        },
        {
          status: 400,
        },
      );
    }

    if (!adminEmail || !isValidEmail(adminEmail)) {
      return NextResponse.json(
        {
          error:
            "A valid administrator email is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (!isValidPassword(password)) {
      return NextResponse.json(
        {
          error:
            "Password must be at least 8 characters long.",
        },
        {
          status: 400,
        },
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        {
          error: "Passwords do not match.",
        },
        {
          status: 400,
        },
      );
    }

    // ----------------------------------------------------------
    // CHECK EMAIL
    // ----------------------------------------------------------

    const existingUser = await prisma.user.findUnique({
      where: {
        email: adminEmail,
      },

      select: {
        id: true,
      },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          error:
            "An account with this email address already exists.",
        },
        {
          status: 409,
        },
      );
    }

    // ----------------------------------------------------------
    // HASH PASSWORD
    // ----------------------------------------------------------

    const passwordHash = await bcrypt.hash(
      password,
      12,
    );

    // ----------------------------------------------------------
    // CREATE FIRM + ADMIN + 14-DAY FREE TRIAL
    // ----------------------------------------------------------

    let createdFirmReference = "";

    for (let attempt = 0; attempt < 5; attempt++) {
      const referenceNumber =
        generateFirmReference();

      try {
        await prisma.$transaction(async (tx) => {
          // ----------------------------------------------------
          // CREATE LAW FIRM
          // ----------------------------------------------------

          const firm = await tx.firm.create({
            data: {
              referenceNumber,
              name: firmName,
              registrationNumber:
                registrationNumber || null,
              email: firmEmail || null,
              phone: firmPhone || null,
              address: firmAddress || null,
            },
          });

          // ----------------------------------------------------
          // CREATE FIRST ADMINISTRATOR
          // ----------------------------------------------------
          //
          // The public signup endpoint deliberately does
          // not accept a role from the browser.
          //

          await tx.user.create({
            data: {
              firmId: firm.id,
              name: adminName,
              email: adminEmail,
              passwordHash,
              role: "ADMIN",
              status: "ACTIVE",
            },
          });

          // ----------------------------------------------------
          // CREATE 14-DAY FREE TRIAL
          // ----------------------------------------------------
          //
          // The trial starts immediately when the firm is
          // created. No payment is required to start the trial.
          //

          const now = new Date();

          const trialEndsAt = new Date(
            now.getTime() +
              14 * 24 * 60 * 60 * 1000,
          );

          await tx.subscription.create({
            data: {
              firmId: firm.id,

              // The firm is currently on the free trial.
              plan: "TRIAL",

              // IMPORTANT:
              // This must be TRIAL rather than
              // PENDING_PAYMENT.
              status: "TRIAL",

              // Trial period start.
              currentPeriodStart: now,

              // Current period ends when the trial ends.
              currentPeriodEnd: trialEndsAt,

              // Exact date/time the free trial expires.
              trialEndsAt,
            },
          });
        });

        createdFirmReference = referenceNumber;

        break;
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : "";

        // The firm reference is generated locally, but
        // we still protect against the extremely unlikely
        // event of a unique-reference collision.
        if (
          message.includes(
            "Firm_referenceNumber_key",
          )
        ) {
          continue;
        }

        throw error;
      }
    }

    // ----------------------------------------------------------
    // HANDLE REFERENCE GENERATION FAILURE
    // ----------------------------------------------------------

    if (!createdFirmReference) {
      return NextResponse.json(
        {
          error:
            "Unable to create the firm account right now. Please try again.",
        },
        {
          status: 500,
        },
      );
    }

    // ----------------------------------------------------------
    // SUCCESS
    // ----------------------------------------------------------

    return NextResponse.json(
      {
        success: true,

        message:
          "Firm account created successfully. Your 14-day free trial has started.",

        firmReference:
          createdFirmReference,

        nextStep: "TRIAL",

        trialDays: 14,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "Firm signup error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to create the firm account right now. Please try again.",
      },
      {
        status: 500,
      },
    );
  }
}