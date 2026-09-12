import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions-server";
import { userCanAccessMatter } from "@/lib/matter-access";

// =====================================================
// GET /api/folders?matterId=...
// Get folders belonging to a matter
// =====================================================

export async function GET(request: Request) {
  try {
    const authorization =
      await requirePermission("documents.view");

    if (!authorization.authorized) {
      return authorization.response;
    }

    const session = authorization.session;

    const { searchParams } = new URL(request.url);

    const matterId = String(
      searchParams.get("matterId") || ""
    ).trim();

    if (!matterId) {
      return NextResponse.json(
        {
          error: "Matter ID is required.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // Verify matter belongs to the authenticated user's
    // firm.
    // --------------------------------------------------

    const matter = await prisma.matter.findFirst({
      where: {
        id: matterId,
        firmId: session.user.firmId,
      },
    });

    if (!matter) {
      return NextResponse.json(
        {
          error: "Matter not found.",
        },
        { status: 404 }
      );
    }

    // --------------------------------------------------
    // Verify matter-level access.
    //
    // This prevents an ordinary user from viewing folders
    // belonging to another matter in the same firm.
    // --------------------------------------------------

    const canAccessMatter =
      await userCanAccessMatter({
        matterId,
        userId: session.user.id,
        firmId: session.user.firmId,
        role: session.user.role,
      });

    if (!canAccessMatter) {
      return NextResponse.json(
        {
          error: "Matter not found.",
        },
        { status: 404 }
      );
    }

    // --------------------------------------------------
    // Get folders.
    // --------------------------------------------------

    const folders = await prisma.folder.findMany({
      where: {
        matterId,
        firmId: session.user.firmId,
      },
      orderBy: {
        name: "asc",
      },
    });

    // --------------------------------------------------
    // Audit folder list access.
    // --------------------------------------------------

    await createAuditLog({
      request,
      firmId: session.user.firmId,
      userId: session.user.id,
      action: "READ",
      entityType: "Folder",
      entityId: matterId,
      description:
        `Viewed folders for matter ${matter.referenceNumber}.`,
      metadata: {
        matterId,
        matterReferenceNumber:
          matter.referenceNumber,
        resultCount: folders.length,
      },
    });

    return NextResponse.json({
      folders,
    });
  } catch (error) {
    console.error("GET FOLDERS ERROR:", error);

    return NextResponse.json(
      {
        error: "Failed to load folders.",
      },
      { status: 500 }
    );
  }
}

// =====================================================
// POST /api/folders
// Create a folder inside a matter
// =====================================================

export async function POST(request: Request) {
  try {
    const authorization =
      await requirePermission("documents.upload");

    if (!authorization.authorized) {
      return authorization.response;
    }

    const session = authorization.session;

    // --------------------------------------------------
    // Parse request body safely.
    // --------------------------------------------------

    let body: {
      matterId?: unknown;
      name?: unknown;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          error: "Invalid request body.",
        },
        { status: 400 }
      );
    }

    const matterId = String(
      body.matterId || ""
    ).trim();

    const name = String(
      body.name || ""
    ).trim();

    // --------------------------------------------------
    // Validate input.
    // --------------------------------------------------

    if (!matterId) {
      return NextResponse.json(
        {
          error: "Matter ID is required.",
        },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        {
          error: "Folder name is required.",
        },
        { status: 400 }
      );
    }

    // Prevent unnecessarily large folder names.
    if (name.length > 255) {
      return NextResponse.json(
        {
          error:
            "Folder name must not exceed 255 characters.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // Verify matter belongs to the authenticated user's
    // firm.
    // --------------------------------------------------

    const matter = await prisma.matter.findFirst({
      where: {
        id: matterId,
        firmId: session.user.firmId,
      },
    });

    if (!matter) {
      return NextResponse.json(
        {
          error: "Matter not found.",
        },
        { status: 404 }
      );
    }

    // --------------------------------------------------
    // Verify matter-level access.
    //
    // IMPORTANT:
    // For ordinary users, userCanAccessMatter() checks
    // MatterUser.canView.
    // --------------------------------------------------

    const canAccessMatter =
      await userCanAccessMatter({
        matterId,
        userId: session.user.id,
        firmId: session.user.firmId,
        role: session.user.role,
      });

    if (!canAccessMatter) {
      return NextResponse.json(
        {
          error: "Matter not found.",
        },
        { status: 404 }
      );
    }

    // --------------------------------------------------
    // For ordinary users, folder creation additionally
    // requires MatterUser.canUpload.
    //
    // Privileged users are handled by the existing
    // matter-access policy.
    // --------------------------------------------------

    const privilegedRoles = new Set([
      "SUPER_ADMIN",
      "MANAGING_PARTNER",
      "PARTNER",
      "DIRECTOR",
      "ADMIN",
    ]);

    if (
      !privilegedRoles.has(
        session.user.role
      )
    ) {
      const matterUser =
        await prisma.matterUser.findUnique({
          where: {
            matterId_userId: {
              matterId,
              userId: session.user.id,
            },
          },
          select: {
            canView: true,
            canUpload: true,
          },
        });

      if (
        !matterUser ||
        !matterUser.canView ||
        !matterUser.canUpload
      ) {
        return NextResponse.json(
          {
            error: "Matter not found.",
          },
          { status: 404 }
        );
      }
    }

    // --------------------------------------------------
    // Prevent duplicate folder names within the matter.
    // --------------------------------------------------

    const existingFolder =
      await prisma.folder.findFirst({
        where: {
          matterId,
          firmId: session.user.firmId,
          name,
        },
      });

    if (existingFolder) {
      return NextResponse.json(
        {
          error:
            "A folder with this name already exists in this matter.",
        },
        { status: 409 }
      );
    }

    // --------------------------------------------------
    // Create folder using the authenticated user's firm.
    // --------------------------------------------------

    const folder = await prisma.folder.create({
      data: {
        firmId: session.user.firmId,
        matterId,
        name,
      },
    });

    // --------------------------------------------------
    // Audit folder creation.
    // --------------------------------------------------

    await createAuditLog({
      request,
      firmId: session.user.firmId,
      userId: session.user.id,
      action: "CREATE",
      entityType: "Folder",
      entityId: folder.id,
      description:
        `Created folder "${folder.name}" in matter ${matter.referenceNumber}`,
      metadata: {
        folderId: folder.id,
        folderName: folder.name,
        matterId,
        matterReferenceNumber:
          matter.referenceNumber,
      },
    });

    return NextResponse.json(
      {
        success: true,
        folder,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("CREATE FOLDER ERROR:", error);

    return NextResponse.json(
      {
        error: "Failed to create folder.",
      },
      { status: 500 }
    );
  }
}