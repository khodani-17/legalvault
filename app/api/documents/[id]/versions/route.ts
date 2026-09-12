import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { createNotifications } from "@/lib/notifications";
import { requirePermission } from "@/lib/permissions-server";
import { validateDocumentFile } from "@/lib/security/file-validation";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const PRIVILEGED_ROLES = new Set([
  "SUPER_ADMIN",
  "MANAGING_PARTNER",
  "PARTNER",
  "DIRECTOR",
  "ADMIN",
]);

const MAX_CHANGE_NOTE_LENGTH = 1000;

// =====================================================
// GET VERSION HISTORY
// =====================================================

export async function GET(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    // ===================================================
    // AUTHENTICATION + RBAC
    // ===================================================

    const authorization =
      await requirePermission("documents.view");

    if (!authorization.authorized) {
      return authorization.response;
    }

    const session = authorization.session;

    if (
      !session.user.id ||
      !session.user.firmId
    ) {
      return NextResponse.json(
        {
          error: "Unauthorized.",
        },
        {
          status: 401,
        }
      );
    }

    const userId = session.user.id;
    const firmId = session.user.firmId;

    const { id } = await params;

    if (!id || id.length > 200) {
      return NextResponse.json(
        {
          error: "Invalid document.",
        },
        {
          status: 400,
        }
      );
    }

    // ===================================================
    // VERIFY ACTIVE USER
    // ===================================================

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
        {
          error:
            "Your user account could not be verified.",
        },
        {
          status: 403,
        }
      );
    }

    // ===================================================
    // FIND DOCUMENT
    // ===================================================

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
          referenceNumber: true,
          name: true,
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
          error: "Document not found.",
        },
        {
          status: 404,
        }
      );
    }

    // ===================================================
    // MATTER-LEVEL ACCESS CONTROL
    // ===================================================

    const isPrivileged =
      PRIVILEGED_ROLES.has(user.role);

    if (!isPrivileged) {
      const matterAccess =
        await prisma.matterUser.findFirst({
          where: {
            matterId: document.matterId,
            userId,
            canView: true,
          },
          select: {
            id: true,
          },
        });

      if (!matterAccess) {
        return NextResponse.json(
          {
            error: "Access denied.",
          },
          {
            status: 403,
          }
        );
      }
    }

    // ===================================================
    // FETCH VERSION HISTORY
    //
    // IMPORTANT:
    // storageKey is intentionally NOT returned.
    // It is an internal server-side storage detail.
    // ===================================================

    const versions =
      await prisma.documentVersion.findMany({
        where: {
          documentId: document.id,
        },
        orderBy: {
          version: "desc",
        },
        select: {
          id: true,
          version: true,
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

    // ===================================================
    // SERIALIZE BIGINT
    // ===================================================

    const serializedVersions =
      versions.map((version) => ({
        ...version,
        size: version.size.toString(),
      }));

    // ===================================================
    // AUDIT LOG
    // ===================================================

    await createAuditLog({
      request,
      firmId,
      userId: user.id,
      action: "READ",
      entityType: "DocumentVersion",
      entityId: document.id,
      description:
        `Viewed version history for document ${document.referenceNumber}: ${document.name}.`,
      metadata: {
        documentId:
          document.id,

        documentReference:
          document.referenceNumber,

        documentName:
          document.name,

        matterId:
          document.matterId,

        matterReferenceNumber:
          document.matter?.referenceNumber ??
          null,

        matterTitle:
          document.matter?.title ??
          null,

        currentVersion:
          document.currentVersion,

        versionCount:
          serializedVersions.length,

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

    // ===================================================
    // RESPONSE
    // ===================================================

    return NextResponse.json(
      {
        versions: serializedVersions,
        count: serializedVersions.length,
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "private, no-store",
          "X-Content-Type-Options":
            "nosniff",
        },
      }
    );
  } catch (error) {
    console.error(
      "GET_DOCUMENT_VERSIONS_ERROR:",
      error
    );

    // Never expose internal database/storage
    // error details to the client.

    return NextResponse.json(
      {
        error:
          "The document version history could not be loaded.",
      },
      {
        status: 500,
      }
    );
  }
}

// =====================================================
// POST NEW DOCUMENT VERSION
// =====================================================

export async function POST(
  request: NextRequest,
  { params }: RouteContext
) {
  let storagePath: string | null = null;

  try {
    // ===================================================
    // AUTHENTICATION + RBAC
    // ===================================================

    const authorization =
      await requirePermission(
        "documents.version.create"
      );

    if (!authorization.authorized) {
      return authorization.response;
    }

    const session = authorization.session;

    if (
      !session.user.id ||
      !session.user.firmId
    ) {
      return NextResponse.json(
        {
          error: "Unauthorized.",
        },
        {
          status: 401,
        }
      );
    }

    const userId = session.user.id;
    const firmId = session.user.firmId;

    const { id } = await params;

    if (!id || id.length > 200) {
      return NextResponse.json(
        {
          error: "Invalid document.",
        },
        {
          status: 400,
        }
      );
    }

    // ===================================================
    // VERIFY ACTIVE USER
    // ===================================================

    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        firmId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        firmId: true,
        name: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          error:
            "Your user account could not be verified.",
        },
        {
          status: 403,
        }
      );
    }

    // ===================================================
    // FIND DOCUMENT
    // ===================================================

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
          error: "Document not found.",
        },
        {
          status: 404,
        }
      );
    }

    // ===================================================
    // MATTER-LEVEL ACCESS CONTROL
    // ===================================================

    const isPrivileged =
      PRIVILEGED_ROLES.has(user.role);

    let canUploadVersion =
      isPrivileged;

    if (!isPrivileged) {
      const matterAccess =
        await prisma.matterUser.findFirst({
          where: {
            matterId: document.matterId,
            userId: user.id,
            canUpload: true,
          },
          select: {
            id: true,
          },
        });

      canUploadVersion =
        !!matterAccess;
    }

    if (!canUploadVersion) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to upload a new version of this document.",
        },
        {
          status: 403,
        }
      );
    }

    // ===================================================
    // FORM DATA
    // ===================================================

    const formData =
      await request.formData();

    const file =
      formData.get("file");

    const changeNote =
      String(
        formData.get("changeNote") || ""
      ).trim();

    // ===================================================
    // CHANGE NOTE VALIDATION
    // ===================================================

    if (
      changeNote.length >
      MAX_CHANGE_NOTE_LENGTH
    ) {
      return NextResponse.json(
        {
          error:
            `Change note cannot exceed ${MAX_CHANGE_NOTE_LENGTH} characters.`,
        },
        {
          status: 400,
        }
      );
    }

    // ===================================================
    // FILE VALIDATION
    // ===================================================

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          error:
            "Please select a document file.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * IMPORTANT:
     *
     * Do not trust:
     *
     *   file.type
     *   file.name extension
     *
     * The shared validator verifies the actual
     * contents of the uploaded file.
     */

    let validatedFile;

    try {
      validatedFile =
        await validateDocumentFile(file);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The uploaded file failed security validation.";

      return NextResponse.json(
        {
          error: message,
        },
        {
          status: 400,
        }
      );
    }

    const originalName =
      validatedFile.originalName;

    const extension =
      validatedFile.extension;

    const mimeType =
      validatedFile.mimeType;

    const buffer =
      validatedFile.buffer;

    // ===================================================
    // STORAGE KEY
    // ===================================================

    const randomId =
      crypto.randomUUID();

    /*
     * The extension has already been validated
     * by the central security utility.
     */

    const storageKey =
      `${firmId}/${document.matterId}/${randomId}${extension}`;

    const storageRoot =
      path.join(
        process.cwd(),
        "storage"
      );

    storagePath =
      path.join(
        storageRoot,
        storageKey
      );

    // ===================================================
    // STORAGE PATH SECURITY
    // ===================================================

    const resolvedStorageRoot =
      path.resolve(
        storageRoot
      );

    const resolvedStoragePath =
      path.resolve(
        storagePath
      );

    const relativeStoragePath =
      path.relative(
        resolvedStorageRoot,
        resolvedStoragePath
      );

    if (
      relativeStoragePath.startsWith("..") ||
      path.isAbsolute(
        relativeStoragePath
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid storage path.",
        },
        {
          status: 400,
        }
      );
    }

    // ===================================================
    // WRITE FILE
    // ===================================================

    await fs.mkdir(
      path.dirname(storagePath),
      {
        recursive: true,
      }
    );

    /*
     * wx prevents accidental overwriting if a storage
     * filename somehow already exists.
     */

    await fs.writeFile(
      storagePath,
      buffer,
      {
        flag: "wx",
      }
    );

    // ===================================================
    // DATABASE TRANSACTION
    // ===================================================

    /*
     * Version numbering is protected using the
     * document's currentVersion value.
     *
     * We update the document only if currentVersion
     * is still the version we originally observed.
     *
     * This prevents two concurrent requests from
     * silently replacing the same current version.
     */

    const result =
      await prisma.$transaction(
        async (tx) => {
          const lockedDocument =
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
                currentVersion: true,
              },
            });

          if (!lockedDocument) {
            throw new Error(
              "DOCUMENT_NOT_FOUND"
            );
          }

          /*
           * Use the database's current version as
           * the authoritative value.
           */
          const nextVersion =
            lockedDocument.currentVersion + 1;

          /*
           * First update the document's version using
           * the expected currentVersion.
           *
           * This acts as an optimistic concurrency check.
           */
          const updateResult =
            await tx.document.updateMany({
              where: {
                id: document.id,
                firmId,
                status: {
                  not: "DELETED",
                },
                currentVersion:
                  lockedDocument.currentVersion,
              },
              data: {
                currentVersion:
                  nextVersion,

                originalName,

                mimeType,

                extension,

                size:
                  BigInt(buffer.length),

                storageKey,
              },
            });

          if (
            updateResult.count !== 1
          ) {
            throw new Error(
              "VERSION_CONFLICT"
            );
          }

          // =============================================
          // CREATE VERSION
          // =============================================

          const version =
            await tx.documentVersion.create({
              data: {
                documentId:
                  document.id,

                version:
                  nextVersion,

                storageKey,

                originalName,

                mimeType,

                extension,

                size:
                  BigInt(buffer.length),

                uploadedById:
                  user.id,

                changeNote:
                  changeNote ||
                  `Updated document to version ${nextVersion}.`,
              },
            });

          return {
            version,
            nextVersion,
            previousVersion:
              lockedDocument.currentVersion,
          };
        }
      );

    // ===================================================
    // AUDIT LOG
    // ===================================================

    await createAuditLog({
      request,
      firmId,
      userId: user.id,
      action: "UPLOAD",
      entityType: "Document",
      entityId: document.id,
      description:
        `Uploaded version ${result.nextVersion} of document ${document.referenceNumber}: ${document.name}.`,
      metadata: {
        documentId:
          document.id,

        documentReference:
          document.referenceNumber,

        documentName:
          document.name,

        originalName,

        mimeType,

        extension,

        size:
          buffer.length,

        matterId:
          document.matterId,

        matterReferenceNumber:
          document.matter?.referenceNumber ??
          null,

        matterTitle:
          document.matter?.title ??
          null,

        versionId:
          result.version.id,

        version:
          result.nextVersion,

        previousVersion:
          result.previousVersion,

        changeNote:
          changeNote ||
          `Updated document to version ${result.nextVersion}.`,

        uploadedById:
          user.id,

        uploadedByName:
          user.name,

        uploadedByEmail:
          user.email,

        accessLevel:
          isPrivileged
            ? "FULL_FIRM_ACCESS"
            : "MATTER_ACCESS",

        privileged:
          isPrivileged,
      },
    });

    // ===================================================
    // DOCUMENT VERSION NOTIFICATION
    //
    // Notify only active users who can view the matter.
    // The uploader is excluded to prevent self-notification.
    //
    // This uses the existing centralized notification
    // helper. No separate notification record logic
    // is created here.
    //
    // Notification failure must never invalidate a
    // successfully created document version.
    // ===================================================

    try {
      const matterUsers =
        await prisma.matterUser.findMany({
          where: {
            matterId: document.matterId,
            canView: true,
            user: {
              firmId,
              status: "ACTIVE",
            },
          },
          select: {
            userId: true,
          },
        });

      const recipientIds =
        matterUsers
          .map(
            (matterUser) =>
              matterUser.userId
          )
          .filter(
            (recipientId) =>
              recipientId !== user.id
          );

      if (
        recipientIds.length > 0
      ) {
        await createNotifications({
          firmId,
          userIds: recipientIds,
          type: "DOCUMENT",
          title:
            "Document version updated",
          message:
            `${user.name} uploaded version ${result.nextVersion} of "${document.name}" for matter ${document.referenceNumber}.`,
        });
      }
    } catch (notificationError) {
      console.error(
        "DOCUMENT VERSION NOTIFICATION ERROR:",
        notificationError
      );
    }

    // ===================================================
    // SUCCESS RESPONSE
    //
    // IMPORTANT:
    // storageKey is NEVER returned.
    // ===================================================

    return NextResponse.json(
      {
        success: true,

        version: {
          id:
            result.version.id,

          version:
            result.version.version,

          originalName:
            result.version.originalName,

          mimeType:
            result.version.mimeType,

          extension:
            result.version.extension,

          changeNote:
            result.version.changeNote,

          size:
            result.version.size.toString(),

          uploadedById:
            result.version.uploadedById,

          createdAt:
            result.version.createdAt,
        },

        document: {
          id:
            document.id,

          currentVersion:
            result.nextVersion,

          originalName,

          mimeType,

          extension,

          size:
            buffer.length,
        },
      },
      {
        status: 201,
        headers: {
          "Cache-Control":
            "private, no-store",

          "X-Content-Type-Options":
            "nosniff",
        },
      }
    );
  } catch (error) {
    console.error(
      "POST_DOCUMENT_VERSION_ERROR:",
      error
    );

    // ===================================================
    // CLEAN UP FILE
    // ===================================================

    if (storagePath) {
      try {
        await fs.unlink(
          storagePath
        );
      } catch {
        // File may not exist.
      }
    }

    // ===================================================
    // SPECIFIC INTERNAL CONDITIONS
    // ===================================================

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
        }
      );
    }

    if (
      error instanceof Error &&
      error.message ===
        "VERSION_CONFLICT"
    ) {
      return NextResponse.json(
        {
          error:
            "Another version was uploaded at the same time. Please try again.",
        },
        {
          status: 409,
        }
      );
    }

    // ===================================================
    // GENERIC CLIENT ERROR
    //
    // Never expose database/storage/internal
    // error.message values.
    // ===================================================

    return NextResponse.json(
      {
        error:
          "The document version could not be uploaded. Please try again.",
      },
      {
        status: 500,
      }
    );
  }
}