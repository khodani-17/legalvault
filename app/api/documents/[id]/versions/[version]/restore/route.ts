import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions-server";
import { access } from "fs/promises";
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

// =====================================================
// RESTORE DOCUMENT VERSION
// =====================================================
//
// Makes an existing historical version the document's
// current version.
//
// No historical version is deleted.
// No new version is created.
// Complete version history remains intact.
//
// =====================================================

export async function POST(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    // =================================================
    // RBAC AUTHORIZATION
    // =================================================

    const authorization =
      await requirePermission("documents.restore");

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

    // =================================================
    // ROUTE PARAMETERS
    // =================================================

    const {
      id,
      version: versionParam,
    } = await params;

    // Prevent obviously malformed document IDs from
    // reaching the database.
    if (
      typeof id !== "string" ||
      id.length === 0 ||
      id.length > 128
    ) {
      return NextResponse.json(
        {
          error: "Invalid document ID.",
        },
        {
          status: 400,
        },
      );
    }

    const version = Number(versionParam);

    if (
      !Number.isSafeInteger(version) ||
      version < 1
    ) {
      return NextResponse.json(
        {
          error: "Invalid document version.",
        },
        {
          status: 400,
        },
      );
    }

    // =================================================
    // VERIFY ACTIVE USER
    // =================================================

    const user =
      await prisma.user.findFirst({
        where: {
          id: userId,
          firmId,
          status: "ACTIVE",
        },
        select: {
          id: true,
          role: true,
          name: true,
          email: true,
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

    // =================================================
    // FIND DOCUMENT
    // =================================================
    //
    // firmId comes from the authenticated session.
    // It is never accepted from the request.
    //
    // =================================================

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
          extension: true,
          size: true,
          storageKey: true,
          currentVersion: true,
          status: true,

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
          error: "Document not found.",
        },
        {
          status: 404,
        },
      );
    }

    // =================================================
    // MATTER-LEVEL MANAGEMENT ACCESS
    // =================================================

    const isPrivileged =
      PRIVILEGED_ROLES.has(user.role);

    let canManage = isPrivileged;

    if (!isPrivileged) {
      const matterAccess =
        await prisma.matterUser.findFirst({
          where: {
            matterId: document.matterId,
            userId: user.id,
            canView: true,
            canManage: true,
          },
          select: {
            id: true,
          },
        });

      canManage =
        matterAccess !== null;
    }

    if (!canManage) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to restore document versions.",
        },
        {
          status: 403,
        },
      );
    }

    // =================================================
    // PREVENT RESTORING CURRENT VERSION
    // =================================================

    if (
      document.currentVersion === version
    ) {
      return NextResponse.json(
        {
          error:
            `Version ${version} is already the current version.`,
        },
        {
          status: 400,
        },
      );
    }

    // =================================================
    // FIND VERSION
    // =================================================
    //
    // The document was already verified using:
    //
    //   id + firmId
    //
    // Therefore the version is necessarily attached
    // to a document belonging to this firm.
    //
    // =================================================

    const documentVersion =
      await prisma.documentVersion.findFirst({
        where: {
          documentId: document.id,
          version,
        },
        select: {
          id: true,
          documentId: true,
          version: true,
          storageKey: true,
          originalName: true,
          mimeType: true,
          extension: true,
          size: true,
          uploadedById: true,
          changeNote: true,
          createdAt: true,
          updatedAt: true,
        },
      });

    if (!documentVersion) {
      return NextResponse.json(
        {
          error:
            `Version ${version} was not found.`,
        },
        {
          status: 404,
        },
      );
    }

    // =================================================
    // VALIDATE STORAGE KEY
    // =================================================
    //
    // Storage keys are internal values.
    //
    // Never allow:
    // - absolute Unix paths
    // - Windows drive paths
    // - ../ traversal
    // - backslash traversal
    //
    // =================================================

    const normalizedStorageKey =
      documentVersion.storageKey
        .replace(/\\/g, "/")
        .trim();

    const storageSegments =
      normalizedStorageKey.split("/");

    const hasTraversal =
      storageSegments.some(
        (segment) =>
          segment === "..",
      );

    const isAbsoluteWindowsPath =
      /^[A-Za-z]:\//.test(
        normalizedStorageKey,
      );

    const isAbsoluteUnixPath =
      normalizedStorageKey.startsWith("/");

    if (
      !normalizedStorageKey ||
      hasTraversal ||
      isAbsoluteWindowsPath ||
      isAbsoluteUnixPath
    ) {
      return NextResponse.json(
        {
          error: "Invalid storage path.",
        },
        {
          status: 400,
        },
      );
    }

    const storageRoot =
      path.resolve(
        process.cwd(),
        "storage",
      );

    const resolvedFilePath =
      path.resolve(
        storageRoot,
        normalizedStorageKey,
      );

    // =================================================
    // FINAL PATH CONTAINMENT CHECK
    // =================================================

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
          error: "Invalid storage path.",
        },
        {
          status: 400,
        },
      );
    }

    // =================================================
    // VERIFY VERSION FILE EXISTS
    // =================================================
    //
    // Never point the document at a storage object
    // that does not exist.
    //
    // =================================================

    try {
      await access(resolvedFilePath);
    } catch {
      console.error(
        "DOCUMENT_VERSION_STORAGE_MISSING",
        {
          documentId: document.id,
          versionId: documentVersion.id,
          version: documentVersion.version,
        },
      );

      return NextResponse.json(
        {
          error:
            "The selected document version is unavailable.",
        },
        {
          status: 404,
        },
      );
    }

    // =================================================
    // SAVE EXPECTED CURRENT VERSION
    // =================================================
    //
    // This value is used for optimistic concurrency
    // protection inside the transaction.
    //
    // If another request changes the document before
    // our update executes, the update will affect zero
    // rows and we will return a conflict instead of
    // silently overwriting the newer state.
    //
    // =================================================

    const expectedCurrentVersion =
      document.currentVersion;

    const previousVersion =
      expectedCurrentVersion;

    // =================================================
    // DATABASE TRANSACTION
    // =================================================

    const result =
      await prisma.$transaction(
        async (tx) => {
          // -------------------------------------------------
          // ATOMIC CONCURRENCY-SAFE UPDATE
          // -------------------------------------------------
          //
          // We require ALL of these conditions:
          //
          // 1. Correct document
          // 2. Correct firm
          // 3. Document is not deleted
          // 4. Current version has not changed
          //
          // This prevents stale restore requests from
          // overwriting a newer restore/update.
          //
          // -------------------------------------------------

          const updateResult =
            await tx.document.updateMany({
              where: {
                id: document.id,
                firmId,
                status: {
                  not: "DELETED",
                },
                currentVersion:
                  expectedCurrentVersion,
              },
              data: {
                currentVersion:
                  documentVersion.version,

                storageKey:
                  documentVersion.storageKey,

                originalName:
                  documentVersion.originalName ??
                  document.originalName,

                mimeType:
                  documentVersion.mimeType ??
                  document.mimeType,

                extension:
                  documentVersion.extension ??
                  document.extension,

                size:
                  documentVersion.size,
              },
            });

          // -------------------------------------------------
          // CONCURRENCY CONFLICT
          // -------------------------------------------------

          if (updateResult.count !== 1) {
            throw new Error(
              "DOCUMENT_RESTORE_CONFLICT",
            );
          }

          // -------------------------------------------------
          // READ UPDATED DOCUMENT
          // -------------------------------------------------

          const updatedDocument =
            await tx.document.findFirst({
              where: {
                id: document.id,
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
                extension: true,
                size: true,
                currentVersion: true,
                status: true,
                updatedAt: true,
              },
            });

          if (!updatedDocument) {
            throw new Error(
              "DOCUMENT_NOT_FOUND",
            );
          }

          return updatedDocument;
        },
      );

    // =================================================
    // AUDIT LOG
    // =================================================

    await createAuditLog({
      request,
      firmId,
      userId: user.id,
      action: "RESTORE",
      entityType: "DocumentVersion",
      entityId: documentVersion.id,

      description:
        `Restored version ${documentVersion.version} of document ${document.referenceNumber}: ${document.name}. Version ${previousVersion} was replaced as the current version.`,

      metadata: {
        permission:
          "documents.restore",

        documentId:
          document.id,

        documentReference:
          document.referenceNumber,

        documentName:
          document.name,

        matterId:
          document.matterId,

        matterReferenceNumber:
          document.matter
            ?.referenceNumber ?? null,

        matterTitle:
          document.matter
            ?.title ?? null,

        versionId:
          documentVersion.id,

        previousVersion,

        restoredVersion:
          documentVersion.version,

        originalName:
          documentVersion.originalName,

        mimeType:
          documentVersion.mimeType,

        extension:
          documentVersion.extension,

        size:
          documentVersion.size.toString(),

        // Internal storage information is retained
        // only in the server-side audit trail.
        storageKey:
          documentVersion.storageKey,

        uploadedById:
          documentVersion.uploadedById,

        changeNote:
          documentVersion.changeNote,

        restoredById:
          user.id,

        restoredByName:
          user.name,

        restoredByEmail:
          user.email,

        accessLevel:
          isPrivileged
            ? "FULL_FIRM_ACCESS"
            : "MATTER_ACCESS",

        privileged:
          isPrivileged,
      },
    });

    // =================================================
    // RESPONSE
    // =================================================
    //
    // IMPORTANT:
    // Never expose storageKey to the browser.
    //
    // =================================================

    return NextResponse.json({
      success: true,

      message:
        `Version ${version} restored successfully.`,

      document: {
        id:
          result.id,

        firmId:
          result.firmId,

        matterId:
          result.matterId,

        referenceNumber:
          result.referenceNumber,

        name:
          result.name,

        originalName:
          result.originalName,

        mimeType:
          result.mimeType,

        extension:
          result.extension,

        size:
          result.size.toString(),

        currentVersion:
          result.currentVersion,

        status:
          result.status,

        updatedAt:
          result.updatedAt,
      },

      restoredVersion: {
        id:
          documentVersion.id,

        version:
          documentVersion.version,

        originalName:
          documentVersion.originalName,

        mimeType:
          documentVersion.mimeType,

        extension:
          documentVersion.extension,

        size:
          documentVersion.size.toString(),

        changeNote:
          documentVersion.changeNote,

        createdAt:
          documentVersion.createdAt,

        updatedAt:
          documentVersion.updatedAt,
      },
    });
  } catch (error) {
    // =================================================
    // EXPECTED CONCURRENCY CONFLICT
    // =================================================

    if (
      error instanceof Error &&
      error.message ===
        "DOCUMENT_RESTORE_CONFLICT"
    ) {
      return NextResponse.json(
        {
          error:
            "The document was changed by another request. Please refresh and try again.",
        },
        {
          status: 409,
        },
      );
    }

    // =================================================
    // EXPECTED DOCUMENT NOT FOUND
    // =================================================

    if (
      error instanceof Error &&
      error.message ===
        "DOCUMENT_NOT_FOUND"
    ) {
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

    // =================================================
    // INTERNAL ERROR
    // =================================================

    console.error(
      "POST /api/documents/[id]/versions/[version]/restore error:",
      error,
    );

    // Never expose internal error.message,
    // database errors, paths, stack traces, or
    // implementation details to the client.

    return NextResponse.json(
      {
        error:
          "Failed to restore document version.",
      },
      {
        status: 500,
      },
    );
  }
}