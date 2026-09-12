import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { requireFinanceAccess } from "@/lib/authz/finance";

// ==========================================================
// GET — LIST FINANCE FOLDERS
// ==========================================================

export async function GET(request: Request) {
  try {
    // --------------------------------------------------------
    // FINANCE AUTHORIZATION
    // --------------------------------------------------------

    const authorization =
      await requireFinanceAccess(request);

    if (!authorization.authorized) {
      return authorization.response;
    }

    const financeUser =
      authorization.user;

    // --------------------------------------------------------
    // LOAD FOLDERS
    // --------------------------------------------------------
    //
    // The firmId comes from the authenticated Finance user.
    // It is NEVER accepted from the browser.
    //
    // This prevents one firm's Finance folders from being
    // accessed by another firm's Finance user.
    //
    // --------------------------------------------------------

    const folders =
      await prisma.financeFolder.findMany({
        where: {
          firmId: financeUser.firmId,
        },

        select: {
          id: true,
          firmId: true,
          parentFolderId: true,
          name: true,
          createdAt: true,
          updatedAt: true,
        },

        orderBy: [
          {
            parentFolderId: "asc",
          },
          {
            name: "asc",
          },
        ],
      });

    // --------------------------------------------------------
    // AUDIT
    // --------------------------------------------------------

    try {
      await createAuditLog({
        request,

        firmId:
          financeUser.firmId,

        userId:
          financeUser.id,

        action:
          "READ",

        entityType:
          "FinanceFolder",

        description:
          "Finance folders were listed.",

        metadata: {
          event:
            "FINANCE_FOLDERS_LISTED",

          folderCount:
            folders.length,

          accessedByRole:
            financeUser.role,
        },
      });
    } catch (auditError) {
      console.error(
        "FINANCE FOLDERS: Failed to create audit log.",
        auditError,
      );
    }

    // --------------------------------------------------------
    // RESPONSE
    // --------------------------------------------------------

    return NextResponse.json(
      {
        success: true,
        folders,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error(
      "Finance folders listing error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to load Finance folders.",
      },
      {
        status: 500,
      },
    );
  }
}

// ==========================================================
// POST — CREATE FINANCE FOLDER
// ==========================================================

export async function POST(request: Request) {
  try {
    // --------------------------------------------------------
    // FINANCE AUTHORIZATION
    // --------------------------------------------------------

    const authorization =
      await requireFinanceAccess(request);

    if (!authorization.authorized) {
      return authorization.response;
    }

    const financeUser =
      authorization.user;

    // --------------------------------------------------------
    // READ REQUEST BODY
    // --------------------------------------------------------

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          error:
            "Invalid request body.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid request body.",
        },
        {
          status: 400,
        },
      );
    }

    const data =
      body as Record<string, unknown>;

    // --------------------------------------------------------
    // VALIDATE FOLDER NAME
    // --------------------------------------------------------

    const rawName =
      typeof data.name === "string"
        ? data.name
        : "";

    const name =
      rawName.trim();

    if (!name) {
      return NextResponse.json(
        {
          error:
            "Folder name is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (name.length > 150) {
      return NextResponse.json(
        {
          error:
            "Folder name must not exceed 150 characters.",
        },
        {
          status: 400,
        },
      );
    }

    // --------------------------------------------------------
    // VALIDATE PARENT FOLDER
    // --------------------------------------------------------

    const parentFolderId =
      typeof data.parentFolderId === "string" &&
      data.parentFolderId.trim()
        ? data.parentFolderId.trim()
        : null;

    if (parentFolderId) {
      const parentFolder =
        await prisma.financeFolder.findFirst({
          where: {
            id: parentFolderId,
            firmId: financeUser.firmId,
          },

          select: {
            id: true,
          },
        });

      if (!parentFolder) {
        return NextResponse.json(
          {
            error:
              "Parent Finance folder not found.",
          },
          {
            status: 404,
          },
        );
      }
    }

    // --------------------------------------------------------
    // PREVENT DUPLICATE FOLDER NAMES
    // --------------------------------------------------------
    //
    // A folder name can be reused in different parent folders,
    // but not twice inside the same parent folder.
    //
    // Example:
    //
    // Finance
    // ├── 2026
    // │   └── January
    // └── 2027
    //     └── January
    //
    // This is allowed.
    //
    // But:
    //
    // Finance
    // └── 2026
    //     ├── January
    //     └── January   <-- not allowed
    //
    // --------------------------------------------------------

    const existingFolder =
      await prisma.financeFolder.findFirst({
        where: {
          firmId: financeUser.firmId,
          parentFolderId,
          name,
        },

        select: {
          id: true,
        },
      });

    if (existingFolder) {
      return NextResponse.json(
        {
          error:
            "A Finance folder with this name already exists in this location.",
        },
        {
          status: 409,
        },
      );
    }

    // --------------------------------------------------------
    // CREATE FOLDER
    // --------------------------------------------------------

    const folder =
      await prisma.financeFolder.create({
        data: {
          firmId:
            financeUser.firmId,

          parentFolderId,

          name,
        },

        select: {
          id: true,
          firmId: true,
          parentFolderId: true,
          name: true,
          createdAt: true,
          updatedAt: true,
        },
      });

    // --------------------------------------------------------
    // AUDIT
    // --------------------------------------------------------

    try {
      await createAuditLog({
        request,

        firmId:
          financeUser.firmId,

        userId:
          financeUser.id,

        action:
          "CREATE",

        entityType:
          "FinanceFolder",

        entityId:
          folder.id,

        description:
          `Finance folder "${folder.name}" was created.`,

        metadata: {
          event:
            "FINANCE_FOLDER_CREATED",

          folderId:
            folder.id,

          folderName:
            folder.name,

          parentFolderId:
            folder.parentFolderId,

          createdByRole:
            financeUser.role,
        },
      });
    } catch (auditError) {
      console.error(
        "FINANCE FOLDERS: Failed to create audit log.",
        auditError,
      );
    }

    // --------------------------------------------------------
    // RESPONSE
    // --------------------------------------------------------

    return NextResponse.json(
      {
        success: true,
        folder,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "Finance folder creation error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to create Finance folder.",
      },
      {
        status: 500,
      },
    );
  }
}