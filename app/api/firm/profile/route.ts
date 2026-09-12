import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const EDIT_ROLES = new Set([
  "SUPER_ADMIN",
  "MANAGING_PARTNER",
  "ADMIN",
]);

async function getActiveUser() {
  const session = await auth();

  if (!session?.user?.id || !session.user.firmId) {
    return null;
  }

  const user = await prisma.user.findFirst({
    where: {
      id: session.user.id,
      firmId: session.user.firmId,
      status: "ACTIVE",
    },
    select: {
      id: true,
      role: true,
      firmId: true,
    },
  });

  if (!user) {
    return null;
  }

  return {
    ...user,
    firmId: session.user.firmId,
  };
}

// ============================================================
// GET FIRM PROFILE
// Every active user may view their own firm's profile.
// ============================================================

export async function GET() {
  try {
    const user = await getActiveUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const firm = await prisma.firm.findFirst({
      where: {
        id: user.firmId,
      },
      select: {
        id: true,
        referenceNumber: true,
        name: true,
        registrationNumber: true,
        email: true,
        phone: true,
        address: true,
        logoUrl: true,
        createdAt: true,
        updatedAt: true,

        subscription: {
          select: {
            plan: true,
            status: true,
            currentPeriodStart: true,
            currentPeriodEnd: true,
            trialEndsAt: true,
            cancelledAt: true,
            provider: true,
          },
        },
      },
    });

    if (!firm) {
      return NextResponse.json(
        { error: "Firm profile not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      firm,
      canEdit: EDIT_ROLES.has(user.role),
    });
  } catch (error) {
    console.error("GET FIRM PROFILE ERROR:", error);

    return NextResponse.json(
      { error: "Failed to load firm profile." },
      { status: 500 }
    );
  }
}

// ============================================================
// PATCH FIRM PROFILE
// Only SUPER_ADMIN, MANAGING_PARTNER and ADMIN.
// ============================================================

export async function PATCH(request: NextRequest) {
  try {
    const user = await getActiveUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    if (!EDIT_ROLES.has(user.role)) {
      return NextResponse.json(
        { error: "You do not have permission to edit the firm profile." },
        { status: 403 }
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request." },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const data = body as Record<string, unknown>;

    const name =
      typeof data.name === "string"
        ? data.name.trim()
        : undefined;

    const registrationNumber =
      typeof data.registrationNumber === "string"
        ? data.registrationNumber.trim()
        : undefined;

    const email =
      typeof data.email === "string"
        ? data.email.trim()
        : undefined;

    const phone =
      typeof data.phone === "string"
        ? data.phone.trim()
        : undefined;

    const address =
      typeof data.address === "string"
        ? data.address.trim()
        : undefined;

    if (name !== undefined && !name) {
      return NextResponse.json(
        { error: "Firm name cannot be empty." },
        { status: 400 }
      );
    }

    if (name !== undefined && name.length > 200) {
      return NextResponse.json(
        { error: "Firm name is too long." },
        { status: 400 }
      );
    }

    if (
      registrationNumber !== undefined &&
      registrationNumber.length > 100
    ) {
      return NextResponse.json(
        { error: "Registration number is too long." },
        { status: 400 }
      );
    }

    if (email !== undefined && email.length > 254) {
      return NextResponse.json(
        { error: "Email address is too long." },
        { status: 400 }
      );
    }

    if (phone !== undefined && phone.length > 50) {
      return NextResponse.json(
        { error: "Telephone number is too long." },
        { status: 400 }
      );
    }

    if (address !== undefined && address.length > 1000) {
      return NextResponse.json(
        { error: "Address is too long." },
        { status: 400 }
      );
    }

    const existingFirm = await prisma.firm.findFirst({
      where: {
        id: user.firmId,
      },
      select: {
        id: true,
        name: true,
        registrationNumber: true,
        email: true,
        phone: true,
        address: true,
      },
    });

    if (!existingFirm) {
      return NextResponse.json(
        { error: "Firm profile not found." },
        { status: 404 }
      );
    }

    const updateData: {
      name?: string;
      registrationNumber?: string | null;
      email?: string | null;
      phone?: string | null;
      address?: string | null;
    } = {};

    if (name !== undefined) {
      updateData.name = name;
    }

    if (registrationNumber !== undefined) {
      updateData.registrationNumber =
        registrationNumber || null;
    }

    if (email !== undefined) {
      updateData.email = email || null;
    }

    if (phone !== undefined) {
      updateData.phone = phone || null;
    }

    if (address !== undefined) {
      updateData.address = address || null;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No firm profile changes were provided." },
        { status: 400 }
      );
    }

    const changes: string[] = [];

    if (
      name !== undefined &&
      name !== existingFirm.name
    ) {
      changes.push("firm name");
    }

    if (
      registrationNumber !== undefined &&
      registrationNumber !==
        (existingFirm.registrationNumber ?? "")
    ) {
      changes.push("registration number");
    }

    if (
      email !== undefined &&
      email !== (existingFirm.email ?? "")
    ) {
      changes.push("email");
    }

    if (
      phone !== undefined &&
      phone !== (existingFirm.phone ?? "")
    ) {
      changes.push("telephone");
    }

    if (
      address !== undefined &&
      address !== (existingFirm.address ?? "")
    ) {
      changes.push("address");
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const firm = await tx.firm.update({
          where: {
            id: user.firmId,
          },
          data: updateData,
          select: {
            id: true,
            referenceNumber: true,
            name: true,
            registrationNumber: true,
            email: true,
            phone: true,
            address: true,
            logoUrl: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        await tx.auditLog.create({
          data: {
            firmId: user.firmId,
            userId: user.id,
            action: "UPDATE",
            entityType: "Firm",
            entityId: firm.id,
            description:
              changes.length > 0
                ? `Updated firm profile: ${changes.join(", ")}.`
                : "Updated firm profile.",
          },
        });

        return firm;
      }
    );

    return NextResponse.json({
      success: true,
      message: "Firm profile updated successfully.",
      firm: result,
    });
  } catch (error) {
    console.error("PATCH FIRM PROFILE ERROR:", error);

    return NextResponse.json(
      { error: "Failed to update firm profile." },
      { status: 500 }
    );
  }
}