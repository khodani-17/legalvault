import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions-server";

type ClientRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const VALID_CLIENT_TYPES = [
  "INDIVIDUAL",
  "COMPANY",
  "TRUST",
  "GOVERNMENT",
  "OTHER",
] as const;

function isValidClientType(
  value: unknown,
): value is (typeof VALID_CLIENT_TYPES)[number] {
  return (
    typeof value === "string" &&
    VALID_CLIENT_TYPES.includes(
      value as (typeof VALID_CLIENT_TYPES)[number],
    )
  );
}

function cleanOptionalString(
  value: unknown,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed || null;
}

// =====================================================
// GET CLIENT
// =====================================================

export async function GET(
  request: Request,
  { params }: ClientRouteContext,
) {
  try {
    const permission =
      await requirePermission("clients.view");

    if (!permission.authorized) {
      return permission.response;
    }

    const session = permission.session;

    if (
      !session.user?.id ||
      !session.user.firmId
    ) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 },
      );
    }

    const { id } = await params;

    const client =
      await prisma.client.findFirst({
        where: {
          id,
          firmId: session.user.firmId,
        },
        include: {
          matters: {
            orderBy: {
              createdAt: "desc",
            },
            select: {
              id: true,
              referenceNumber: true,
              title: true,
              status: true,
              openedAt: true,
              closedAt: true,
            },
          },
          _count: {
            select: {
              matters: true,
            },
          },
        },
      });

    if (!client) {
      return NextResponse.json(
        {
          error: "Client not found.",
        },
        { status: 404 },
      );
    }

    await createAuditLog({
      request,
      firmId: session.user.firmId,
      userId: session.user.id,
      action: "READ",
      entityType: "Client",
      entityId: client.id,
      description:
        `Viewed client ${client.referenceNumber} - ${client.name}`,
      metadata: {
        referenceNumber:
          client.referenceNumber,
      },
    });

    return NextResponse.json({
      client,
    });
  } catch (error) {
    console.error(
      "CLIENT_GET_ERROR:",
      error,
    );

    return NextResponse.json(
      {
        error: "Failed to load client.",
      },
      { status: 500 },
    );
  }
}

// =====================================================
// UPDATE CLIENT
// =====================================================

export async function PATCH(
  request: Request,
  { params }: ClientRouteContext,
) {
  try {
    const permission =
      await requirePermission(
        "clients.update",
      );

    if (!permission.authorized) {
      return permission.response;
    }

    const session = permission.session;

    if (
      !session.user?.id ||
      !session.user.firmId
    ) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 },
      );
    }

    const { id } = await params;

    const existingClient =
      await prisma.client.findFirst({
        where: {
          id,
          firmId: session.user.firmId,
        },
      });

    if (!existingClient) {
      return NextResponse.json(
        {
          error: "Client not found.",
        },
        { status: 404 },
      );
    }

    const body = await request.json();

    const {
      type,
      name,
      email,
      phone,
      idNumber,
      address,
      notes,
    } = body;

    if (
      name !== undefined &&
      (
        typeof name !== "string" ||
        !name.trim()
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Client name is required.",
        },
        { status: 400 },
      );
    }

    if (
      type !== undefined &&
      !isValidClientType(type)
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid client type.",
        },
        { status: 400 },
      );
    }

    const updatedClient =
      await prisma.client.update({
        where: {
          id: existingClient.id,
        },
        data: {
          ...(type !== undefined && {
            type,
          }),

          ...(name !== undefined && {
            name: name.trim(),
          }),

          ...(email !== undefined && {
            email:
              cleanOptionalString(email),
          }),

          ...(phone !== undefined && {
            phone:
              cleanOptionalString(phone),
          }),

          ...(idNumber !== undefined && {
            idNumber:
              cleanOptionalString(idNumber),
          }),

          ...(address !== undefined && {
            address:
              cleanOptionalString(address),
          }),

          ...(notes !== undefined && {
            notes:
              cleanOptionalString(notes),
          }),
        },
      });

    await createAuditLog({
      request,
      firmId: session.user.firmId,
      userId: session.user.id,
      action: "UPDATE",
      entityType: "Client",
      entityId: updatedClient.id,
      description:
        `Updated client ${updatedClient.referenceNumber} - ${updatedClient.name}`,
      metadata: {
        referenceNumber:
          updatedClient.referenceNumber,
        clientType:
          updatedClient.type,
      },
    });

    return NextResponse.json({
      success: true,
      client: updatedClient,
    });
  } catch (error) {
    console.error(
      "CLIENT_UPDATE_ERROR:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Failed to update client.",
      },
      { status: 500 },
    );
  }
}

// =====================================================
// DELETE CLIENT
// =====================================================

export async function DELETE(
  request: Request,
  { params }: ClientRouteContext,
) {
  try {
    const permission =
      await requirePermission(
        "clients.delete",
      );

    if (!permission.authorized) {
      return permission.response;
    }

    const session = permission.session;

    if (
      !session.user?.id ||
      !session.user.firmId
    ) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 },
      );
    }

    const { id } = await params;

    const existingClient =
      await prisma.client.findFirst({
        where: {
          id,
          firmId: session.user.firmId,
        },
        include: {
          _count: {
            select: {
              matters: true,
            },
          },
        },
      });

    if (!existingClient) {
      return NextResponse.json(
        {
          error: "Client not found.",
        },
        { status: 404 },
      );
    }

    if (existingClient._count.matters > 0) {
      return NextResponse.json(
        {
          error:
            "This client cannot be deleted because it has associated legal matters.",
          matterCount:
            existingClient._count.matters,
        },
        { status: 409 },
      );
    }

    await prisma.client.delete({
      where: {
        id: existingClient.id,
      },
    });

    await createAuditLog({
      request,
      firmId: session.user.firmId,
      userId: session.user.id,
      action: "DELETE",
      entityType: "Client",
      entityId: existingClient.id,
      description:
        `Deleted client ${existingClient.referenceNumber} - ${existingClient.name}`,
      metadata: {
        referenceNumber:
          existingClient.referenceNumber,
        clientType:
          existingClient.type,
        clientName:
          existingClient.name,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Client deleted successfully.",
    });
  } catch (error) {
    console.error(
      "CLIENT_DELETE_ERROR:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Failed to delete client.",
      },
      { status: 500 },
    );
  }
}