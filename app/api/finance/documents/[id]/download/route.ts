import { NextResponse } from "next/server";
import { get } from "@vercel/blob";

import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { requireFinanceAccess } from "@/lib/authz/finance";

function sanitizeDownloadFilename(
  filename: string,
): string {
  const sanitized = filename
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/[\/\\:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();

  if (!sanitized) {
    return "finance-document";
  }

  return sanitized.slice(0, 255);
}

function encodeRFC5987(
  value: string,
): string {
  return encodeURIComponent(value)
    .replace(/['()]/g, escape)
    .replace(/\*/g, "%2A");
}

export async function GET(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  const financeAccess =
    await requireFinanceAccess(request);

  if (!financeAccess.authorized) {
    return financeAccess.response;
  }

  const { user } =
    financeAccess;

  const { id } =
    await context.params;

  if (!id || id.length > 100) {
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
        },
      });

    if (!currentUser) {
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
        "Finance document has invalid Blob storage key:",
        financeDocument.id,
      );

      return NextResponse.json(
        {
          error:
            "Finance document is unavailable.",
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
        "Finance document storage isolation violation:",
        financeDocument.id,
      );

      return NextResponse.json(
        {
          error:
            "Finance document is unavailable.",
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
            "Finance document is unavailable.",
        },
        {
          status: 404,
        },
      );
    }

    // ========================================================
    // SIZE VALIDATION
    // ========================================================

    const expectedSize =
      Number(
        financeDocument.size,
      );

    if (
      !Number.isSafeInteger(
        expectedSize,
      ) ||
      expectedSize < 0
    ) {
      console.error(
        "Invalid Finance document size metadata:",
        financeDocument.id,
      );

      return NextResponse.json(
        {
          error:
            "Finance document is unavailable.",
        },
        {
          status: 404,
        },
      );
    }

    // ========================================================
    // DOWNLOAD STREAM
    // ========================================================

    const filename =
      sanitizeDownloadFilename(
        financeDocument.originalName ||
          financeDocument.name ||
          `finance-document${financeDocument.extension}`,
      );

    const encodedFilename =
      encodeRFC5987(filename);

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
          "DOWNLOAD",

        entityType:
          "FinanceDocument",

        entityId:
          financeDocument.id,

        description:
          `Finance document "${financeDocument.name}" was downloaded.`,

        metadata: {
          mimeType:
            financeDocument.mimeType,

          extension:
            financeDocument.extension,

          size:
            financeDocument.size.toString(),
        },
      });
    } catch (auditError) {
      console.error(
        "Finance document download audit failed:",
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
            financeDocument.mimeType ||
            "application/octet-stream",

          "Content-Length":
            String(expectedSize),

          "Content-Disposition":
            `attachment; filename="${filename.replace(/"/g, "")}"; filename*=UTF-8''${encodedFilename}`,

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
      "Finance document download error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to download Finance document.",
      },
      {
        status: 500,
      },
    );
  }
}