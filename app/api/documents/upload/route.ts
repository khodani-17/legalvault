import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { createNotifications } from "@/lib/notifications";
import { requirePermission } from "@/lib/permissions-server";
import { validateDocumentFile } from "@/lib/security/file-validation";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const PRIVILEGED_ROLES = [
  "SUPER_ADMIN",
  "MANAGING_PARTNER",
  "PARTNER",
  "DIRECTOR",
  "ADMIN",
];

export async function POST(request: Request) {
  let storagePath: string | null = null;

  try {
    // =====================================================
    // AUTHENTICATION + RBAC
    // =====================================================

    const authorization =
      await requirePermission("documents.upload");

    if (!authorization.authorized) {
      return authorization.response;
    }

    const session = authorization.session;

    if (!session.user.id || !session.user.firmId) {
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
        firmId: true,
        name: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          error: "Your user account could not be verified.",
        },
        {
          status: 403,
        }
      );
    }

    // =====================================================
    // FORM DATA
    // =====================================================

    const formData = await request.formData();

    const matterId = String(
      formData.get("matterId") || ""
    ).trim();

    const folderIdValue = formData.get("folderId");

    const folderId = folderIdValue
      ? String(folderIdValue).trim()
      : null;

    const documentName = String(
      formData.get("documentName") || ""
    ).trim();

    const category = String(
      formData.get("category") || ""
    ).trim();

    const tagsValue = String(
      formData.get("tags") || ""
    ).trim();

    const file = formData.get("file");

    // =====================================================
    // BASIC VALIDATION
    // =====================================================

    if (!matterId) {
      return NextResponse.json(
        {
          error: "Please select a matter.",
        },
        {
          status: 400,
        }
      );
    }

    if (!documentName) {
      return NextResponse.json(
        {
          error: "Document name is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (documentName.length > 200) {
      return NextResponse.json(
        {
          error:
            "Document name cannot exceed 200 characters.",
        },
        {
          status: 400,
        }
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          error: "Please select a document file.",
        },
        {
          status: 400,
        }
      );
    }

    // =====================================================
    // SECURE FILE VALIDATION
    //
    // This validates:
    // - file size
    // - filename
    // - extension
    // - actual file signature
    // - detected MIME type
    // - extension/content consistency
    //
    // IMPORTANT:
    // We do NOT trust file.type supplied by the browser.
    // =====================================================

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

    // =====================================================
    // VERIFY MATTER
    // =====================================================

    const matter = await prisma.matter.findFirst({
      where: {
        id: matterId,
        firmId,
      },
      select: {
        id: true,
        firmId: true,
        referenceNumber: true,
        title: true,
      },
    });

    if (!matter) {
      return NextResponse.json(
        {
          error:
            "The selected matter does not belong to your firm.",
        },
        {
          status: 403,
        }
      );
    }

    // =====================================================
    // MATTER-LEVEL UPLOAD ACCESS
    // =====================================================

    const isPrivileged =
      PRIVILEGED_ROLES.includes(user.role);

    if (!isPrivileged) {
      const matterAccess =
        await prisma.matterUser.findFirst({
          where: {
            matterId: matter.id,
            userId: user.id,
            canView: true,
            canUpload: true,
          },
          select: {
            id: true,
          },
        });

      if (!matterAccess) {
        return NextResponse.json(
          {
            error:
              "You do not have permission to upload documents to this matter.",
          },
          {
            status: 403,
          }
        );
      }
    }

    // =====================================================
    // VERIFY FOLDER
    // =====================================================

    if (folderId) {
      const folder = await prisma.folder.findFirst({
        where: {
          id: folderId,
          matterId: matter.id,
          firmId,
        },
        select: {
          id: true,
        },
      });

      if (!folder) {
        return NextResponse.json(
          {
            error:
              "The selected folder does not belong to this matter.",
          },
          {
            status: 403,
          }
        );
      }
    }

    // =====================================================
    // VERIFIED FILE INFORMATION
    // =====================================================

    const originalName =
      validatedFile.originalName;

    const extension =
      validatedFile.extension;

    const mimeType =
      validatedFile.mimeType;

    const buffer =
      validatedFile.buffer;

    // =====================================================
    // TAGS
    // =====================================================

    const tags = tagsValue
      ? tagsValue
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
          .filter(
            (tag, index, array) =>
              array.indexOf(tag) === index
          )
          .slice(0, 50)
      : [];

    // Prevent excessively large individual tag values.
    if (
      tags.some(
        (tag) =>
          tag.length > 100
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Each tag cannot exceed 100 characters.",
        },
        {
          status: 400,
        }
      );
    }

    // =====================================================
    // STORAGE KEY
    // =====================================================

    const randomId =
      crypto.randomUUID();

    /*
     * The extension comes exclusively from the
     * server-side validation utility.
     *
     * No part of the storage key comes directly
     * from an untrusted filename.
     */

    const storageKey =
      `${firmId}/${matter.id}/${randomId}${extension}`;

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

    // =====================================================
    // STORAGE PATH SECURITY
    // =====================================================

    const resolvedStorageRoot =
      path.resolve(storageRoot);

    const resolvedStoragePath =
      path.resolve(storagePath);

    const relativeStoragePath =
      path.relative(
        resolvedStorageRoot,
        resolvedStoragePath
      );

    if (
      relativeStoragePath.startsWith("..") ||
      path.isAbsolute(relativeStoragePath)
    ) {
      return NextResponse.json(
        {
          error: "Invalid storage path.",
        },
        {
          status: 400,
        }
      );
    }

    // =====================================================
    // WRITE FILE
    // =====================================================

    await fs.mkdir(
      path.dirname(storagePath),
      {
        recursive: true,
      }
    );

    await fs.writeFile(
      storagePath,
      buffer,
      {
        flag: "wx",
      }
    );

    // =====================================================
    // DOCUMENT REFERENCE NUMBER
    // =====================================================

    const year =
      new Date().getFullYear();

    const prefix =
      `DOC-${year}-`;

    let referenceNumber = "";

    /*
     * Retry reference number generation in case
     * another upload creates the same number
     * concurrently.
     */

    for (
      let attempt = 0;
      attempt < 5;
      attempt++
    ) {
      const documents =
        await prisma.document.findMany({
          where: {
            firmId,
            referenceNumber: {
              startsWith: prefix,
            },
          },
          select: {
            referenceNumber: true,
          },
        });

      let highestNumber = 0;

      for (const document of documents) {
        const number =
          Number(
            document.referenceNumber.replace(
              prefix,
              ""
            )
          );

        if (
          Number.isInteger(number) &&
          number > highestNumber
        ) {
          highestNumber = number;
        }
      }

      referenceNumber =
        `${prefix}${String(
          highestNumber + 1
        ).padStart(6, "0")}`;

      try {
        // =================================================
        // DATABASE TRANSACTION
        // =================================================

        const result =
          await prisma.$transaction(
            async (tx) => {
              const document =
                await tx.document.create({
                  data: {
                    firmId,

                    matterId:
                      matter.id,

                    folderId,

                    referenceNumber,

                    name:
                      documentName,

                    originalName,

                    mimeType,

                    extension,

                    size:
                      BigInt(buffer.length),

                    storageKey,

                    status:
                      "ACTIVE",

                    currentVersion:
                      1,

                    category:
                      category || null,

                    tags,

                    uploadedById:
                      user.id,
                  },
                });

              // =========================================
              // CREATE INITIAL VERSION
              // =========================================

              await tx.documentVersion.create({
                data: {
                  documentId:
                    document.id,

                  version:
                    1,

                  storageKey,

                  size:
                    BigInt(buffer.length),

                  uploadedById:
                    user.id,

                  originalName,

                  mimeType,

                  extension,

                  changeNote:
                    "Initial document upload.",
                },
              });

              return document;
            }
          );

        // =================================================
        // AUDIT LOG
        // =================================================

        await createAuditLog({
          request,
          firmId,
          userId: user.id,
          action: "UPLOAD",
          entityType: "Document",
          entityId: result.id,

          description:
            `Uploaded document ${result.referenceNumber}: ${result.name}`,

          metadata: {
            documentId:
              result.id,

            documentReference:
              result.referenceNumber,

            documentName:
              result.name,

            originalName:
              result.originalName,

            mimeType:
              result.mimeType,

            extension:
              result.extension,

            size:
              buffer.length,

            matterId:
              matter.id,

            matterReferenceNumber:
              matter.referenceNumber,

            matterTitle:
              matter.title,

            folderId,

            category:
              category || null,

            tags,

            version:
              1,

            uploadedById:
              user.id,

            uploadedByName:
              user.name,
          },
        });

        // =================================================
        // DOCUMENT NOTIFICATIONS
        //
        // Notify active users who have view access
        // to this matter, excluding the uploader.
        //
        // Notification failures must never cause a
        // successful document upload to fail.
        // =================================================

        try {
          const matterUsers =
            await prisma.matterUser.findMany({
              where: {
                matterId: matter.id,
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
                "New document uploaded",
              message:
                `${user.name} uploaded "${result.name}" to matter ${matter.referenceNumber}.`,
            });
          }
        } catch (notificationError) {
          console.error(
            "DOCUMENT UPLOAD NOTIFICATION ERROR:",
            notificationError
          );
        }

        // =================================================
        // SUCCESS
        // =================================================

        return NextResponse.json(
          {
            success: true,

            document: {
              id:
                result.id,

              referenceNumber:
                result.referenceNumber,

              name:
                result.name,

              originalName:
                result.originalName,
            },
          },
          {
            status: 201,
          }
        );
      } catch (error) {
        /*
         * If a unique constraint error occurs,
         * generate another reference number and retry.
         */

        if (
          attempt < 4 &&
          error instanceof Error &&
          error.message.includes(
            "Unique constraint"
          )
        ) {
          continue;
        }

        throw error;
      }
    }

    throw new Error(
      "Unable to generate a unique document reference number."
    );
  } catch (error) {
    // Log the detailed error SERVER-SIDE only.
    console.error(
      "DOCUMENT UPLOAD ERROR:",
      error
    );

    // =====================================================
    // CLEAN UP FILE IF DATABASE OPERATION FAILED
    // =====================================================

    if (storagePath) {
      try {
        await fs.unlink(
          storagePath
        );
      } catch {
        // File may not exist.
      }
    }

    // =====================================================
    // GENERIC CLIENT ERROR
    //
    // Never expose error.message to the client.
    // It may contain database/storage/internal details.
    // =====================================================

    return NextResponse.json(
      {
        error:
          "The document could not be uploaded. Please try again.",
      },
      {
        status: 500,
      }
    );
  }
}