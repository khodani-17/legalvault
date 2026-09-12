import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions-server";

// ============================================================
// CREATE CLIENT
// ============================================================

export async function POST(request: Request) {
  try {
    // ----------------------------------------------------------
    // 1. Authentication + RBAC
    // ----------------------------------------------------------

    const permission =
      await requirePermission("clients.create");

    if (!permission.authorized) {
      return permission.response;
    }

    const session = permission.session;

    if (
      !session.user?.id ||
      !session.user.firmId
    ) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        },
      );
    }

    const user = session.user;

    // ----------------------------------------------------------
    // 2. Read request body
    // ----------------------------------------------------------

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

    // ----------------------------------------------------------
    // 3. Validate required fields
    // ----------------------------------------------------------

    if (!name || !name.trim()) {
      return NextResponse.json(
        {
          error: "Client name is required.",
        },
        {
          status: 400,
        },
      );
    }

    // ----------------------------------------------------------
    // 4. Validate client type
    // ----------------------------------------------------------

    const validClientTypes = [
      "INDIVIDUAL",
      "COMPANY",
      "TRUST",
      "GOVERNMENT",
      "OTHER",
    ];

    const clientType = type || "INDIVIDUAL";

    if (!validClientTypes.includes(clientType)) {
      return NextResponse.json(
        {
          error: "Invalid client type.",
        },
        {
          status: 400,
        },
      );
    }

    // ----------------------------------------------------------
    // 5. Generate client reference number
    //
    // Example:
    // CL-2026-000001
    // CL-2026-000002
    // ----------------------------------------------------------

    const currentYear =
      new Date().getFullYear();

    const lastClient =
      await prisma.client.findFirst({
        where: {
          firmId: user.firmId,
          referenceNumber: {
            startsWith:
              `CL-${currentYear}-`,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          referenceNumber: true,
        },
      });

    let nextNumber = 1;

    if (lastClient?.referenceNumber) {
      const parts =
        lastClient.referenceNumber.split("-");

      const lastNumber =
        Number(parts[2]);

      if (!Number.isNaN(lastNumber)) {
        nextNumber =
          lastNumber + 1;
      }
    }

    const referenceNumber =
      `CL-${currentYear}-${String(
        nextNumber,
      ).padStart(6, "0")}`;

    // ----------------------------------------------------------
    // 6. Create client
    // ----------------------------------------------------------

    const client =
      await prisma.client.create({
        data: {
          firmId: user.firmId,

          referenceNumber,

          type: clientType,

          name: name.trim(),

          email:
            email?.trim() || null,

          phone:
            phone?.trim() || null,

          idNumber:
            idNumber?.trim() || null,

          address:
            address?.trim() || null,

          notes:
            notes?.trim() || null,
        },
      });

    // ----------------------------------------------------------
    // 7. Create audit log
    // ----------------------------------------------------------

    await createAuditLog({
      request,
      firmId: user.firmId,
      userId: user.id,
      action: "CREATE",
      entityType: "Client",
      entityId: client.id,
      description:
        `Created client ${client.referenceNumber} - ${client.name}`,
      metadata: {
        referenceNumber:
          client.referenceNumber,
        clientType:
          client.type,
        clientName:
          client.name,
      },
    });

    // ----------------------------------------------------------
    // 8. Return created client
    // ----------------------------------------------------------

    return NextResponse.json(
      {
        success: true,
        client,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "CLIENT_CREATE_ERROR:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Failed to create client.",
      },
      {
        status: 500,
      },
    );
  }
}

// ============================================================
// GET CLIENTS
// ============================================================

export async function GET(request: Request) {
  try {
    // ----------------------------------------------------------
    // Authentication + RBAC
    // ----------------------------------------------------------

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
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        },
      );
    }

    const user = session.user;

    // ----------------------------------------------------------
    // Get clients for current firm
    // ----------------------------------------------------------

    const clients =
      await prisma.client.findMany({
        where: {
          firmId: user.firmId,
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          referenceNumber: true,
          name: true,
        },
      });

    // ----------------------------------------------------------
    // Audit client list access
    // ----------------------------------------------------------

    await createAuditLog({
      request,
      firmId: user.firmId,
      userId: user.id,
      action: "READ",
      entityType: "Client",
      description:
        "Viewed client list.",
      metadata: {
        resultCount:
          clients.length,
      },
    });

    // ----------------------------------------------------------
    // Response
    // ----------------------------------------------------------

    return NextResponse.json({
      clients,
    });
  } catch (error) {
    console.error(
      "CLIENT_LIST_ERROR:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Failed to load clients.",
      },
      {
        status: 500,
      },
    );
  }
}