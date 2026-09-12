import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions-server";
import { readFile } from "fs/promises";
import path from "path";

type RouteContext = {
  params: Promise<{
    id: string;
    version: string;
  }>;
};

const PRIVILEGED_ROLES = new Set([
  "SUPER_ADMIN",
  "MANAGING_PARTNER",
  "PARTNER",
  "DIRECTOR",
  "ADMIN",
]);

export async function GET(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    // =====================================================
    // RBAC AUTHORIZATION
    // =====================================================

    const authorization =
      await requirePermission("documents.preview");

    if (!authorization.authorized) {
      return authorization.response;
    }

    const session = authorization.session;

    const userId = session.user.id;
    const firmId = session.user.firmId;

    if (!userId || !firmId) {
      return NextResponse.json(
        {
          error: "Unauthorized.",
        },
        {
          status: 401,
        },
      );
    }

    const {
      id,
      version: versionParam,
    } = await params;

    // =====================================================
    // VERSION VALIDATION
    // =====================================================

    const versionNumber =
      Number(versionParam);

    if (
      !Number.isInteger(versionNumber) ||
      versionNumber < 1
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid document version.",
        },
        {
          status: 400,
        },
      );
    }

    // =====================================================
    // VERIFY ACTIVE USER
    // =====================================================

    const user =
      await prisma.user.findFirst({
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
        {
          error: "Unauthorized.",
        },
        {
          status: 401,
        },
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
          firmId: true,
          matterId: true,
          referenceNumber: true,
          name: true,
          originalName: true,
          mimeType: true,
          currentVersion: true,
          matter: {
            select: {
              id: true,
              referenceNumber: true,
              title: true,
            },
          },
        },
      });

    if (!document) {
      return NextResponse.json(
        {
          error:
            "Document not found.",
        },
        {
          status: 404,
        },
      );
    }

    // =====================================================
    // MATTER-LEVEL ACCESS CONTROL
    // =====================================================

    const isPrivileged =
      PRIVILEGED_ROLES.has(user.role);

    let canView = isPrivileged;

    if (!isPrivileged) {
      const matterAccess =
        await prisma.matterUser.findFirst({
          where: {
            matterId: document.matterId,
            userId: user.id,
            canView: true,
          },
          select: {
            id: true,
          },
        });

      canView =
        matterAccess !== null;
    }

    if (!canView) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to preview this document version.",
        },
        {
          status: 403,
        },
      );
    }

    // =====================================================
    // FIND VERSION
    // =====================================================

    const documentVersion =
      await prisma.documentVersion.findFirst({
        where: {
          documentId: document.id,
          version: versionNumber,
        },
        select: {
          id: true,
          version: true,
          storageKey: true,
          size: true,
          createdAt: true,
          originalName: true,
          mimeType: true,
          extension: true,
        },
      });

    if (!documentVersion) {
      return NextResponse.json(
        {
          error:
            `Document version ${versionNumber} was not found.`,
        },
        {
          status: 404,
        },
      );
    }

    // =====================================================
    // STORAGE PATH SECURITY
    // =====================================================

    const storageRoot =
      path.resolve(
        process.cwd(),
        "storage",
      );

    /*
     * Normalize Windows separators to forward slashes
     * before validating the storage key.
     */
    const normalizedStorageKey =
      documentVersion.storageKey.replace(
        /\\/g,
        "/",
      );

    /*
     * Reject absolute paths and traversal attempts.
     *
     * Examples rejected:
     *
     * /outside/file.pdf
     * C:/outside/file.pdf
     * ../outside/file.pdf
     * folder/../../outside/file.pdf
     */
    if (
      normalizedStorageKey.startsWith("/") ||
      /^[A-Za-z]:\//.test(
        normalizedStorageKey,
      ) ||
      normalizedStorageKey
        .split("/")
        .some(
          (segment) =>
            segment === "..",
        )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid storage path.",
        },
        {
          status: 400,
        },
      );
    }

    const resolvedFilePath =
      path.resolve(
        storageRoot,
        normalizedStorageKey,
      );

    /*
     * Final containment check.
     *
     * This ensures the resolved path remains
     * physically inside the application's storage
     * directory.
     */
    const relativePath =
      path.relative(
        storageRoot,
        resolvedFilePath,
      );

    if (
      relativePath.startsWith("..") ||
      path.isAbsolute(relativePath)
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid storage path.",
        },
        {
          status: 400,
        },
      );
    }

    // =====================================================
    // READ FILE
    // =====================================================

    let file: Buffer;

    try {
      file =
        await readFile(
          resolvedFilePath,
        );
    } catch (error) {
      console.error(
        "DOCUMENT_VERSION_PREVIEW_FILE_READ_ERROR",
        {
          documentId:
            document.id,

          versionId:
            documentVersion.id,

          version:
            documentVersion.version,

          storageKey:
            documentVersion.storageKey,

          error,
        },
      );

      return NextResponse.json(
        {
          error:
            "The requested document version could not be found.",
        },
        {
          status: 404,
        },
      );
    }

    // =====================================================
    // DETERMINE MIME TYPE
    // =====================================================

    const extension =
      path
        .extname(
          documentVersion.storageKey,
        )
        .toLowerCase();

    const mimeTypes: Record<
      string,
      string
    > = {
      ".pdf":
        "application/pdf",

      ".jpg":
        "image/jpeg",

      ".jpeg":
        "image/jpeg",

      ".png":
        "image/png",

      ".txt":
        "text/plain",

      ".doc":
        "application/msword",

      ".docx":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

      ".xls":
        "application/vnd.ms-excel",

      ".xlsx":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

      ".ppt":
        "application/vnd.ms-powerpoint",

      ".pptx":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    };

    const mimeType =
      documentVersion.mimeType ||
      mimeTypes[extension] ||
      "application/octet-stream";

    // =====================================================
    // AUDIT LOG
    // =====================================================

    await createAuditLog({
      request,
      firmId,
      userId: user.id,
      action: "READ",
      entityType:
        "DocumentVersion",
      entityId:
        documentVersion.id,
      description:
        `Previewed version ${documentVersion.version} of document ${document.referenceNumber}: ${document.name}.`,
      metadata: {
        permission:
          "documents.preview",

        documentId:
          document.id,

        documentReference:
          document.referenceNumber,

        documentName:
          document.name,

        originalName:
          documentVersion.originalName ||
          document.originalName,

        matterId:
          document.matterId,

        matterReferenceNumber:
          document.matter
            ?.referenceNumber ??
          null,

        matterTitle:
          document.matter
            ?.title ??
          null,

        versionId:
          documentVersion.id,

        version:
          documentVersion.version,

        currentVersion:
          document.currentVersion,

        mimeType,

        extension:
          documentVersion.extension ||
          extension,

        fileSize:
          file.length,

        databaseSize:
          documentVersion.size.toString(),

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
      },
    });

    // =====================================================
    // RESPONSE
    // =====================================================

    return new NextResponse(
      new Uint8Array(file),
      {
        status: 200,

        headers: {
          "Content-Type":
            mimeType,

          "Content-Disposition":
            "inline",

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
      "PREVIEW_DOCUMENT_VERSION_ERROR",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Failed to preview document version.",
      },
      {
        status: 500,
      },
    );
  }
}