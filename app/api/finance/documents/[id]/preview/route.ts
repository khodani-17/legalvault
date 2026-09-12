import {
  NextRequest,
  NextResponse,
} from "next/server";

import { get } from "@vercel/blob";

import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { requireFinanceAccess } from "@/lib/authz/finance";

const PREVIEWABLE_TYPES =
  new Set([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "text/plain",
  ]);

function sanitizeFilename(
  filename: string,
): string {
  const sanitized =
    filename
      .replace(
        /[\u0000-\u001F\u007F]/g,
        "",
      )
      .replace(
        /[\/\\:*?"<>|]/g,
        "_",
      )
      .replace(
        /\s+/g,
        " ",
      )
      .trim()
      .slice(0, 255);

  return (
    sanitized ||
    "finance-document"
  );
}

function encodeRFC5987(
  value: string,
): string {
  return encodeURIComponent(
    value,
  ).replace(
    /['()*]/g,
    (character) =>
      `%${character
        .charCodeAt(0)
        .toString(16)
        .toUpperCase()}`,
  );
}

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  const financeAccess =
    await requireFinanceAccess(
      request,
    );

  if (!financeAccess.authorized) {
    return financeAccess.response;
  }

  const { user } =
    financeAccess;

  const { id } =
    await context.params;

  try {
    // ========================================================
    // CURRENT ACTIVE FINANCE USER
    // ========================================================

    const currentUser =
      await prisma.user.findFirst({
        where: {
          id:
            user.id,

          firmId:
            user.firmId,

          status:
            "ACTIVE",

          role:
            "FINANCE",
        },

        select: {
          id: true,
          firmId: true,
          name: true,
          email: true,
          role: true,
        },
      });

    if (!currentUser) {
      return NextResponse.json(
        {
          error:
            "You are not authorized to preview Finance documents.",
        },
        {
          status: 403,
        },
      );
    }

    // ========================================================
    // FINANCE DOCUMENT
    // ========================================================

    const financeDocument =
      await prisma.financeDocument.findFirst({
        where: {
          id,

          firmId:
            currentUser.firmId,

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
          storageKey: true,
        },
      });

    if (!financeDocument) {
      return NextResponse.json(
        {
          error:
            "Finance document not found.",
        },
        {
          status: 404,
        },
      );
    }

    // ========================================================
    // PREVIEW TYPE
    // ========================================================

    if (
      !PREVIEWABLE_TYPES.has(
        financeDocument.mimeType,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Preview is not available for this file type. Please download the document instead.",
        },
        {
          status: 415,
        },
      );
    }

    // ========================================================
    // STORAGE KEY VALIDATION
    // ========================================================

    const storageKey =
      financeDocument.storageKey
        .replace(/\\/g, "/")
        .replace(/^\/+/, "");

    if (
      !storageKey ||
      storageKey.includes("\0") ||
      storageKey.includes("..") ||
      storageKey.startsWith("/")
    ) {
      console.error(
        "Finance preview blocked invalid Blob storage key:",
        {
          documentId:
            financeDocument.id,

          userId:
            currentUser.id,
        },
      );

      return NextResponse.json(
        {
          error:
            "The Finance document could not be accessed.",
        },
        {
          status: 404,
        },
      );
    }

    // ========================================================
    // FIRM STORAGE ISOLATION
    // ========================================================

    const expectedPrefix =
      `${currentUser.firmId}/finance/`;

    if (
      !storageKey.startsWith(
        expectedPrefix,
      )
    ) {
      console.error(
        "Finance preview blocked cross-firm storage access:",
        {
          documentId:
            financeDocument.id,

          userId:
            currentUser.id,
        },
      );

      return NextResponse.json(
        {
          error:
            "The Finance document could not be accessed.",
        },
        {
          status: 404,
        },
      );
    }

    // ========================================================
    // GET PRIVATE BLOB
    // ========================================================

    const blob =
      await get(
        storageKey,
        {
          access:
            "private",
        },
      );

    if (!blob) {
      return NextResponse.json(
        {
          error:
            "The Finance document could not be accessed.",
        },
        {
          status: 404,
        },
      );
    }

    // ========================================================
    // DATABASE SIZE VALIDATION
    // ========================================================

    const databaseSize =
      Number(
        financeDocument.size,
      );

    if (
      !Number.isSafeInteger(
        databaseSize,
      ) ||
      databaseSize < 0
    ) {
      console.error(
        "Finance preview encountered invalid database file size:",
        {
          documentId:
            financeDocument.id,
        },
      );

      return NextResponse.json(
        {
          error:
            "The Finance document could not be accessed.",
        },
        {
          status: 500,
        },
      );
    }

    // ========================================================
    // PREVIEW RESPONSE
    // ========================================================

    const filename =
      sanitizeFilename(
        financeDocument.originalName ||
          financeDocument.name ||
          `finance-document${financeDocument.extension}`,
      );

    // ========================================================
    // AUDIT
    // ========================================================

    try {
      await createAuditLog({
        firmId:
          currentUser.firmId,

        userId:
          currentUser.id,

        action:
          "READ",

        entityType:
          "FinanceDocument",

        entityId:
          financeDocument.id,

        description:
          "Finance document previewed",

        metadata: {
          mimeType:
            financeDocument.mimeType,

          extension:
            financeDocument.extension,

          size:
            databaseSize,
        },
      });
    } catch (auditError) {
      console.error(
        "Finance document preview audit failed:",
        auditError,
      );
    }

    // ========================================================
    // RESPONSE
    // ========================================================

    return new NextResponse(
      blob.stream,
      {
        status: 200,

        headers: {
          "Content-Type":
            financeDocument.mimeType,

          "Content-Disposition":
            `inline; filename="${filename.replace(/"/g, "_")}"; filename*=UTF-8''${encodeRFC5987(filename)}`,

          "Cache-Control":
            "private, no-store, max-age=0",

          "X-Content-Type-Options":
            "nosniff",

          "Content-Security-Policy":
            "default-src 'none'; sandbox",
        },
      },
    );
  } catch (error) {
    console.error(
      "Finance document preview error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to preview Finance document.",
      },
      {
        status: 500,
      },
    );
  }
}