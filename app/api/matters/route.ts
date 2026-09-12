import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions-server";
import { canAccessAllFirmMatters } from "@/lib/matter-access";

// =====================================================
// GET /api/matters
// Get matters available to the logged-in user
// Permission: matters.view
// =====================================================

export async function GET(request: Request) {
  try {
    // --------------------------------------------------
    // 1. Authentication + RBAC
    // --------------------------------------------------

    const permission =
      await requirePermission("matters.view");

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

    const userId = session.user.id;
    const firmId = session.user.firmId;
    const role = session.user.role;

    // --------------------------------------------------
    // 2. Build resource-level access filter
    // --------------------------------------------------

    const where = canAccessAllFirmMatters(role)
      ? {
          firmId,
        }
      : {
          firmId,
          users: {
            some: {
              userId,
              canView: true,
            },
          },
        };

    // --------------------------------------------------
    // 3. Get authorised matters
    // --------------------------------------------------

    const matters =
      await prisma.matter.findMany({
        where,
        select: {
          id: true,
          referenceNumber: true,
          title: true,
          status: true,
          client: {
            select: {
              id: true,
              referenceNumber: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

    // --------------------------------------------------
    // 4. Audit log
    // --------------------------------------------------

    await createAuditLog({
      request,
      firmId,
      userId,
      action: "READ",
      entityType: "Matter",
      description: "Viewed authorised matter list.",
      metadata: {
        resultCount: matters.length,
      },
    });

    // --------------------------------------------------
    // 5. Response
    // --------------------------------------------------

    return NextResponse.json({
      matters,
    });
  } catch (error) {
    console.error(
      "GET MATTERS ERROR:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Failed to load matters.",
      },
      { status: 500 },
    );
  }
}

// =====================================================
// POST /api/matters
// Create a new matter
// Automatically creates standard folders
// Automatically assigns creator to matter
// Permission: matters.create
// =====================================================

export async function POST(
  request: Request,
) {
  try {
    // --------------------------------------------------
    // 1. Authentication + RBAC
    // --------------------------------------------------

    const permission =
      await requirePermission("matters.create");

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

    // --------------------------------------------------
    // 2. Verify user belongs to a firm
    // --------------------------------------------------

    const user =
      await prisma.user.findFirst({
        where: {
          id: session.user.id,
          firmId: session.user.firmId,
          status: "ACTIVE",
        },
        select: {
          id: true,
          firmId: true,
          role: true,
        },
      });

    if (!user) {
      return NextResponse.json(
        {
          error:
            "User not found or inactive.",
        },
        { status: 403 },
      );
    }

    // --------------------------------------------------
    // 3. Read request
    // --------------------------------------------------

    const body = await request.json();

    const clientId = String(
      body.clientId || "",
    ).trim();

    const title = String(
      body.title || "",
    ).trim();

    const description = String(
      body.description || "",
    ).trim();

    const practiceArea = String(
      body.practiceArea || "",
    ).trim();

    const status = String(
      body.status || "OPEN",
    ).trim();

    // --------------------------------------------------
    // 4. Validate required fields
    // --------------------------------------------------

    if (!clientId) {
      return NextResponse.json(
        {
          error:
            "Please select a client.",
        },
        { status: 400 },
      );
    }

    if (!title) {
      return NextResponse.json(
        {
          error:
            "Matter title is required.",
        },
        { status: 400 },
      );
    }

    // --------------------------------------------------
    // 5. Validate matter status
    // --------------------------------------------------

    const validStatuses = [
      "OPEN",
      "PENDING",
      "CLOSED",
      "ARCHIVED",
    ];

    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        {
          error:
            "Invalid matter status.",
        },
        { status: 400 },
      );
    }

    // --------------------------------------------------
    // 6. Verify client belongs to same firm
    // --------------------------------------------------

    const client =
      await prisma.client.findFirst({
        where: {
          id: clientId,
          firmId: user.firmId,
        },
        select: {
          id: true,
          firmId: true,
          referenceNumber: true,
          name: true,
        },
      });

    if (!client) {
      return NextResponse.json(
        {
          error:
            "The selected client does not belong to your firm.",
        },
        { status: 403 },
      );
    }

    // --------------------------------------------------
    // 7. Generate matter reference
    //
    // Example:
    // MAT-2026-000001
    // --------------------------------------------------

    const year =
      new Date().getFullYear();

    const prefix =
      `MAT-${year}-`;

    const lastMatter =
      await prisma.matter.findFirst({
        where: {
          firmId: user.firmId,
          referenceNumber: {
            startsWith: prefix,
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

    if (lastMatter?.referenceNumber) {
      const lastNumber =
        Number(
          lastMatter.referenceNumber.replace(
            prefix,
            "",
          ),
        );

      if (
        Number.isInteger(lastNumber) &&
        lastNumber >= 1
      ) {
        nextNumber =
          lastNumber + 1;
      }
    }

    const referenceNumber =
      `${prefix}${String(
        nextNumber,
      ).padStart(6, "0")}`;

    // --------------------------------------------------
    // 8. Standard folder structure
    // --------------------------------------------------

    const standardFolders = [
      "Court File",
      "Pleadings",
      "Correspondence",
      "Evidence",
      "Expert Reports",
      "Invoices & Fees",
      "Other Documents",
    ];

    // --------------------------------------------------
    // 9. Create matter + folders + creator assignment
    // --------------------------------------------------

    const matter =
      await prisma.$transaction(
        async (tx) => {
          const createdMatter =
            await tx.matter.create({
              data: {
                firmId: user.firmId,
                clientId: client.id,
                referenceNumber,
                title,
                description:
                  description || null,
                practiceArea:
                  practiceArea || null,
                status:
                  status as
                    | "OPEN"
                    | "PENDING"
                    | "CLOSED"
                    | "ARCHIVED",
              },
            });

          // --------------------------------------------
          // Create standard folders
          // --------------------------------------------

          await tx.folder.createMany({
            data: standardFolders.map(
              (folderName) => ({
                firmId: user.firmId,
                matterId:
                  createdMatter.id,
                name: folderName,
              }),
            ),
          });

          // --------------------------------------------
          // Automatically assign creator
          //
          // Creator can:
          // - View
          // - Upload
          // - Download
          //
          // Creator cannot:
          // - Delete
          // - Manage users
          // --------------------------------------------

          await tx.matterUser.create({
            data: {
              matterId: createdMatter.id,
              userId: user.id,
              canView: true,
              canUpload: true,
              canDownload: true,
              canDelete: false,
              canManage: false,
            },
          });

          return createdMatter;
        },
      );

    // --------------------------------------------------
    // 10. Audit log
    // --------------------------------------------------

    await createAuditLog({
      request,
      firmId: user.firmId,
      userId: user.id,
      action: "CREATE",
      entityType: "Matter",
      entityId: matter.id,
      description:
        `Created matter ${matter.referenceNumber}: ${matter.title}`,
      metadata: {
        matterId: matter.id,
        referenceNumber:
          matter.referenceNumber,
        title: matter.title,
        description:
          matter.description,
        practiceArea:
          matter.practiceArea,
        status: matter.status,
        clientId: client.id,
        clientReferenceNumber:
          client.referenceNumber,
        clientName:
          client.name,
        foldersCreated:
          standardFolders,
        creatorAssigned: true,
        creatorPermissions: {
          canView: true,
          canUpload: true,
          canDownload: true,
          canDelete: false,
          canManage: false,
        },
      },
    });

    // --------------------------------------------------
    // 11. Return matter
    // --------------------------------------------------

    return NextResponse.json(
      {
        success: true,
        matter,
        folders: standardFolders,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(
      "CREATE MATTER ERROR:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Failed to create matter.",
      },
      { status: 500 },
    );
  }
}