import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

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
    // LOAD FINANCE DOCUMENTS
    // ========================================================

    const documents =
      await prisma.financeDocument.findMany({
        where: {
          firmId:
            financeUser.firmId,

          deletedAt:
            null,
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

    // ========================================================
    // RESPONSE
    // ========================================================

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
  let storagePath: string | null = null;

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
    //
    // IMPORTANT:
    //
    // Do not trust:
    // - file.type
    // - the client-provided MIME type
    // - the client-provided extension
    //
    // validateDocumentFile() checks:
    // - file size
    // - filename
    // - allowed extension
    // - actual file signature
    // - detected file type
    // - MIME/extension consistency
    // - supported Office formats
    //
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
    // STORAGE KEY
    // ========================================================
    //
    // The storage filename is generated by the server.
    //
    // The user's filename is NEVER used as the physical
    // storage filename.
    //
    // ========================================================

    const storageFileName =
      createStorageFileName(
        extension,
      );

    const relativeStorageKey =
      path.join(
        financeUser.firmId,
        "finance",
        storageFileName,
      );

    const storageRoot =
      path.resolve(
        process.cwd(),
        "storage",
      );

    storagePath =
      path.resolve(
        storageRoot,
        relativeStorageKey,
      );

    // ========================================================
    // FINAL STORAGE CONTAINMENT CHECK
    // ========================================================

    const normalizedStorageKey =
      relativeStorageKey.replace(
        /\\/g,
        "/",
      );

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

    const relativePath =
      path.relative(
        storageRoot,
        storagePath,
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

    // ========================================================
    // WRITE FILE
    // ========================================================

    await fs.mkdir(
      path.dirname(storagePath),
      {
        recursive: true,
      },
    );

    await fs.writeFile(
      storagePath,
      buffer,
      {
        flag: "wx",
      },
    );

    // ========================================================
    // VERIFY PHYSICAL FILE
    // ========================================================

    const fileStat =
      await fs.stat(
        storagePath,
      );

    if (
      !fileStat.isFile() ||
      fileStat.size !== buffer.length
    ) {
      throw new Error(
        "Stored Finance document failed integrity verification.",
      );
    }

    // ========================================================
    // DATABASE RECORD
    // ========================================================

    const financeDocument =
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
            normalizedStorageKey,

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
    // ========================================================
    // CLEAN UP FILE IF DATABASE OPERATION FAILED
    // ========================================================

    if (storagePath) {
      try {
        await fs.unlink(
          storagePath,
        );
      } catch (cleanupError) {
        console.error(
          "FINANCE DOCUMENTS: Failed to clean up uploaded file.",
          cleanupError,
        );
      }
    }

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