import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions-server";
import { userCanAccessMatter } from "@/lib/matter-access";
import { readFile } from "fs/promises";
import path from "path";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const PRIVILEGED_ROLES = [
  "SUPER_ADMIN",
  "MANAGING_PARTNER",
  "PARTNER",
  "DIRECTOR",
  "ADMIN",
] as const;

function isPrivilegedRole(role: string): boolean {
  return PRIVILEGED_ROLES.includes(
    role as (typeof PRIVILEGED_ROLES)[number],
  );
}

export async function GET(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    // =====================================================
    // AUTHENTICATION + RBAC
    // =====================================================

    const authorization =
      await requirePermission("documents.preview");

    if (!authorization.authorized) {
      return authorization.response;
    }

    const session = authorization.session;

    if (!session.user.id || !session.user.firmId) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 },
      );
    }

    const userId = session.user.id;
    const firmId = session.user.firmId;
    const { id } = await params;

    // =====================================================
    // VERSION VALIDATION
    // =====================================================

    const versionParam =
      request.nextUrl.searchParams.get("version");

    const requestedVersion =
      versionParam !== null
        ? Number(versionParam)
        : null;

    if (
      requestedVersion !== null &&
      (!Number.isInteger(requestedVersion) ||
        requestedVersion < 1)
    ) {
      return NextResponse.json(
        { error: "Invalid document version." },
        { status: 400 },
      );
    }

    // =====================================================
    // VERIFY ACTIVE USER
    // =====================================================

    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        firmId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 },
      );
    }

    // =====================================================
    // FIND DOCUMENT
    // =====================================================

    const document =
      await prisma.document.findFirst({
        where: {
          id,
          firmId,
          status: {
            not: "DELETED",
          },
        },
        select: {
          id: true,
          matterId: true,
          storageKey: true,
          originalName: true,
          mimeType: true,
          currentVersion: true,
          referenceNumber: true,
          name: true,
        },
      });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found." },
        { status: 404 },
      );
    }

    // =====================================================
    // MATTER-LEVEL ACCESS CONTROL
    // =====================================================

    const hasMatterAccess =
      await userCanAccessMatter({
        matterId: document.matterId,
        userId: user.id,
        firmId,
        role: user.role,
      });

    if (!hasMatterAccess) {
      // Return 404 rather than revealing that a document
      // exists in a matter the user cannot access.
      return NextResponse.json(
        { error: "Document not found." },
        { status: 404 },
      );
    }

    // =====================================================
    // DETERMINE VERSION TO PREVIEW
    // =====================================================

    let storageKey = document.storageKey;

    let originalName =
      document.originalName || "document";

    let mimeType =
      document.mimeType ||
      "application/octet-stream";

    let previewedVersion =
      document.currentVersion;

    if (requestedVersion !== null) {
      const version =
        await prisma.documentVersion.findFirst({
          where: {
            documentId: document.id,
            version: requestedVersion,
          },
          select: {
            storageKey: true,
            version: true,
            originalName: true,
            mimeType: true,
            extension: true,
            size: true,
          },
        });

      if (!version) {
        return NextResponse.json(
          {
            error:
              `Document version ${requestedVersion} not found.`,
          },
          { status: 404 },
        );
      }

      storageKey = version.storageKey;
      previewedVersion = version.version;

      // Historical versions have their own metadata.
      originalName =
        version.originalName || "document";

      mimeType =
        version.mimeType ||
        "application/octet-stream";
    }

    // =====================================================
    // STORAGE PATH SECURITY
    // =====================================================

    const storageRoot = path.resolve(
      process.cwd(),
      "storage",
    );

    /*
     * Normalize Windows separators to forward slashes
     * before validating the storage key.
     */
    const normalizedStorageKey =
      storageKey.replace(/\\/g, "/");

    /*
     * Reject:
     *
     * /absolute/path
     * C:/absolute/path
     * ../outside-storage
     * folder/../../outside-storage
     */
    if (
      normalizedStorageKey.startsWith("/") ||
      /^[A-Za-z]:\//.test(normalizedStorageKey) ||
      normalizedStorageKey
        .split("/")
        .some((segment) => segment === "..")
    ) {
      return NextResponse.json(
        { error: "Invalid storage path." },
        { status: 400 },
      );
    }

    const filePath = path.resolve(
      storageRoot,
      normalizedStorageKey,
    );

    /*
     * Final containment check.
     *
     * This verifies that the resolved path remains
     * physically inside the application's storage directory.
     */
    const relativePath = path.relative(
      storageRoot,
      filePath,
    );

    if (
      relativePath.startsWith("..") ||
      path.isAbsolute(relativePath)
    ) {
      return NextResponse.json(
        { error: "Invalid storage path." },
        { status: 400 },
      );
    }

    // =====================================================
    // READ FILE
    // =====================================================

    let file: Buffer;

    try {
      file = await readFile(filePath);
    } catch (error) {
      console.error(
        "DOCUMENT_PREVIEW_FILE_READ_ERROR",
        {
          documentId: document.id,
          storageKey,
          error,
        },
      );

      return NextResponse.json(
        {
          error:
            "The requested document file could not be found.",
        },
        { status: 404 },
      );
    }

    // =====================================================
    // AUDIT PREVIEW
    // =====================================================

    const isPrivileged =
      isPrivilegedRole(user.role);

    await createAuditLog({
      request,
      firmId,
      userId: user.id,
      action: "READ",
      entityType: "Document",
      entityId: document.id,
      description:
        `Previewed document ${document.referenceNumber}: ${document.name}. Version ${previewedVersion}.`,
      metadata: {
        documentId:
          document.id,

        documentReference:
          document.referenceNumber,

        documentName:
          document.name,

        originalName,

        matterId:
          document.matterId,

        version:
          previewedVersion,

        currentVersion:
          document.currentVersion,

        mimeType,

        fileSize:
          file.length,

        previewType:
          "inline",

        viewedById:
          user.id,

        viewedByName:
          user.name,

        viewedByEmail:
          user.email,

        accessLevel:
          isPrivileged
            ? "FULL_FIRM_ACCESS"
            : "MATTER_ACCESS",

        privileged:
          isPrivileged,

        permission:
          "documents.preview",
      },
    });

    // =====================================================
    // RESPONSE
    // =====================================================

    const versionLabel =
      requestedVersion !== null
        ? `-v${requestedVersion}`
        : "";

    const filename =
      `${originalName}${versionLabel}`;

    return new NextResponse(
      new Uint8Array(file),
      {
        status: 200,

        headers: {
          "Content-Type":
            mimeType,

          "Content-Disposition":
            `inline; filename="${encodeURIComponent(
              filename,
            )}"`,

          "Content-Length":
            file.length.toString(),

          "Cache-Control":
            "private, no-store",

          "X-Content-Type-Options":
            "nosniff",
        },
      },
    );
  } catch (error) {
    console.error(
      "PREVIEW_DOCUMENT_ERROR",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Failed to preview document.",
      },
      { status: 500 },
    );
  }
}