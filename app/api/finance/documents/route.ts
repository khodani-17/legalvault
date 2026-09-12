import { NextResponse } from "next/server";
import crypto from "crypto";
import { put } from "@vercel/blob";

import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { requireFinanceAccess } from "@/lib/authz/finance";
import {
  validateDocumentFile,
} from "@/lib/security/file-validation";

// ==========================================================
// STORAGE
// ==========================================================

function createStorageFileName(
  extension: string,
): string {
  return `${crypto.randomUUID()}${extension}`;
}

// ==========================================================
// GET — LIST FINANCE DOCUMENTS
// ==========================================================

export async function GET(
  request: Request,
) {
  try {
    const authorization =
      await requireFinanceAccess(request);

    if (!authorization.authorized) {
      return authorization.response;
    }

    const financeUser =
      authorization.user;

    const documents =
      await prisma.financeDocument.findMany({
        where: {
          firmId: financeUser.firmId,
          deletedAt: null,
        },

        select: {
          id: true,
          name: true,
          originalName: true,
          mimeType: true,
          extension: true,
          size: true,
          folderId: true,
          uploadedById: true,
          createdAt: true,
          updatedAt: true,
        },

        orderBy: {
          createdAt: "desc",
        },
      });

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
          "FinanceDocument",

        description:
          "Finance documents were listed.",

        metadata: {
          event:
            "FINANCE_DOCUMENTS_LISTED",

          documentCount:
            documents.length,

          accessedByRole:
            financeUser.role,
        },
      });
    } catch (auditError) {
      console.error(
        "FINANCE DOCUMENTS: Failed to create audit log.",
        auditError,
      );
    }

    return NextResponse.json(
      {
        success: true,

        documents:
          documents.map(
            (document) => ({
              id:
                document.id,

              name:
                document.name,

              originalName:
                document.originalName,

              mimeType:
                document.mimeType,

              extension:
                document.extension,

              size:
                document.size.toString(),

              folderId:
                document.folderId,

              uploadedById:
                document.uploadedById,

              createdAt:
                document.createdAt,

              updatedAt:
                document.updatedAt,
            }),
          ),
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error(
      "Finance documents listing error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to load Finance documents.",
      },
      {
        status: 500,
      },
    );
  }
}

// ==========================================================
// POST — UPLOAD FINANCE DOCUMENT
// ==========================================================

export async function POST(
  request: Request,
) {
  let storageKey: string | null = null;

  try {
    // ========================================================
    // FINANCE AUTHORIZATION
    // ========================================================

    const authorization =
      await requireFinanceAccess(request);

    if (!authorization.authorized) {
      return authorization.response;
    }

    const financeUser =
      authorization.user;

    // ========================================================
    // READ MULTIPART FORM
    // ========================================================

    const formData =
      await request.formData();

    const file =
      formData.get("file");

    const folderIdValue =
      formData.get("folderId");

    const documentNameValue =
      formData.get("documentName");

    // ========================================================
    // VALIDATE FILE OBJECT
    // ========================================================

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          error:
            "A Finance document file is required.",
        },
        {
          status: 400,
        },
      );
    }

    // ========================================================
    // SERVER-SIDE FILE VALIDATION
    // ========================================================

    let validatedFile;

    try {
      validatedFile =
        await validateDocumentFile(file);
    } catch (validationError) {
      const message =
        validationError instanceof Error
          ? validationError.message
          : "The uploaded file could not be validated.";

      const status =
        message.includes(
          "exceeds the 100 MB size limit",
        )
          ? 413
          : message.includes(
                "not permitted",
              ) ||
              message.includes(
                "not supported",
              )
            ? 415
            : 400;

      return NextResponse.json(
        {
          error:
            message,
        },
        {
          status,
        },
      );
    }

    const {
      buffer,
      originalName,
      extension,
      mimeType,
      detectedExtension,
      detectedMimeType,
    } = validatedFile;

    // ========================================================
    // VALIDATE FOLDER
    // ========================================================

    const folderId =
      typeof folderIdValue === "string" &&
      folderIdValue.trim()
        ? folderIdValue.trim()
        : null;

    if (folderId) {
      const folder =
        await prisma.financeFolder.findFirst({
          where: {
            id:
              folderId,

            firmId:
              financeUser.firmId,
          },

          select: {
            id: true,
          },
        });

      if (!folder) {
        return NextResponse.json(
          {
            error:
              "Finance folder not found.",
          },
          {
            status: 404,
          },
        );
      }
    }

    // ========================================================
    // DOCUMENT NAME
    // ========================================================

    const suppliedDocumentName =
      typeof documentNameValue === "string"
        ? documentNameValue.trim()
        : "";

    const documentName =
      suppliedDocumentName ||
      originalName;

    if (!documentName) {
      return NextResponse.json(
        {
          error:
            "Document name is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (documentName.length > 255) {
      return NextResponse.json(
        {
          error:
            "Document name must not exceed 255 characters.",
        },
        {
          status: 400,
        },
      );
    }

    // ========================================================
    // PRIVATE BLOB STORAGE KEY
    // ========================================================
    //
    // The database stores only the private Blob pathname.
    //
    // The original filename is never used as the physical
    // storage filename.
    //
    // ========================================================

    const storageFileName =
      createStorageFileName(
        extension,
      );

    storageKey =
      `${financeUser.firmId}/finance/${storageFileName}`;

    // ========================================================
    // UPLOAD TO PRIVATE VERCEL BLOB
    // ========================================================

    const blob =
      await put(
        storageKey,
        buffer,
        {
          access: "private",

          addRandomSuffix: false,

          contentType:
            mimeType,
        },
      );

    if (!blob || !blob.pathname) {
      throw new Error(
        "Private Finance document storage failed.",
      );
    }

    // ========================================================
    // DATABASE RECORD
    // ========================================================

    let financeDocument;

    try {
      financeDocument =
        await prisma.financeDocument.create({
          data: {
            firmId:
              financeUser.firmId,

            folderId,

            name:
              documentName,

            originalName:
              originalName,

            mimeType:
              mimeType,

            extension:
              extension,

            size:
              BigInt(buffer.length),

            storageKey:
              blob.pathname,

            uploadedById:
              financeUser.id,
          },

          select: {
            id: true,
            name: true,
            originalName: true,
            mimeType: true,
            extension: true,
            size: true,
            folderId: true,
            uploadedById: true,
            createdAt: true,
            updatedAt: true,
          },
        });
    } catch (databaseError) {
      // ------------------------------------------------------
      // DATABASE FAILED AFTER BLOB UPLOAD
      // ------------------------------------------------------
      //
      // Attempt to remove the orphaned private Blob.
      //
      // ------------------------------------------------------

      try {
        await import("@vercel/blob").then(
          async ({ del }) => {
            await del(blob.url);
          },
        );
      } catch (cleanupError) {
        console.error(
          "FINANCE DOCUMENTS: Failed to clean up orphaned private Blob.",
          cleanupError,
        );
      }

      throw databaseError;
    }

    // ========================================================
    // AUDIT
    // ========================================================

    try {
      await createAuditLog({
        request,

        firmId:
          financeUser.firmId,

        userId:
          financeUser.id,

        action:
          "UPLOAD",

        entityType:
          "FinanceDocument",

        entityId:
          financeDocument.id,

        description:
          `Finance document "${financeDocument.name}" was uploaded.`,

        metadata: {
          event:
            "FINANCE_DOCUMENT_UPLOADED",

          documentId:
            financeDocument.id,

          documentName:
            financeDocument.name,

          originalName:
            financeDocument.originalName,

          mimeType:
            financeDocument.mimeType,

          extension:
            financeDocument.extension,

          detectedExtension,

          detectedMimeType,

          size:
            financeDocument.size.toString(),

          folderId:
            financeDocument.folderId,

          uploadedByRole:
            financeUser.role,
        },
      });
    } catch (auditError) {
      console.error(
        "FINANCE DOCUMENTS: Failed to create audit log.",
        auditError,
      );
    }

    // ========================================================
    // RESPONSE
    // ========================================================

    return NextResponse.json(
      {
        success: true,

        document: {
          id:
            financeDocument.id,

          name:
            financeDocument.name,

          originalName:
            financeDocument.originalName,

          mimeType:
            financeDocument.mimeType,

          extension:
            financeDocument.extension,

          size:
            financeDocument.size.toString(),

          folderId:
            financeDocument.folderId,

          uploadedById:
            financeDocument.uploadedById,

          createdAt:
            financeDocument.createdAt,

          updatedAt:
            financeDocument.updatedAt,
        },
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "Finance document upload error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to upload Finance document.",
      },
      {
        status: 500,
      },
    );
  }
}