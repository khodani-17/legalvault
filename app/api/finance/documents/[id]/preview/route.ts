import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { requireFinanceAccess } from "@/lib/authz/finance";

const PREVIEWABLE_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "text/plain",
]);

function sanitizeFilename(filename: string): string {
  const sanitized = filename
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/[\/\\:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 255);

  return sanitized || "finance-document";
}

function encodeRFC5987(value: string): string {
  return encodeURIComponent(value).replace(
    /['()*]/g,
    (character) =>
      `%${character
        .charCodeAt(0)
        .toString(16)
        .toUpperCase()}`,
  );
}

function resolveSafeStoragePath(
  storageKey: string,
): string | null {
  if (!storageKey || storageKey.includes("\0")) {
    return null;
  }

  const storageRoot = path.resolve(
    process.cwd(),
    "storage",
  );

  const normalizedKey = storageKey
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");

  if (!normalizedKey) {
    return null;
  }

  const storagePath = path.resolve(
    storageRoot,
    ...normalizedKey.split("/"),
  );

  const relativePath = path.relative(
    storageRoot,
    storagePath,
  );

  if (
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    return null;
  }

  return storagePath;
}

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  const financeAccess =
    await requireFinanceAccess(request);

  if (!financeAccess.authorized) {
    return financeAccess.response;
  }

  const { user } = financeAccess;
  const { id } = await context.params;

  try {
    /*
     * Re-check the current database user.
     *
     * We deliberately do not rely only on the JWT role.
     */
    const currentUser =
      await prisma.user.findFirst({
        where: {
          id: user.id,
          firmId: user.firmId,
          status: "ACTIVE",
          role: "FINANCE",
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
        { status: 403 },
      );
    }

    /*
     * Firm isolation is mandatory.
     *
     * storageKey is selected server-side only and is
     * never returned to the client.
     */
    const financeDocument =
      await prisma.financeDocument.findFirst({
        where: {
          id,
          firmId: currentUser.firmId,
          deletedAt: null,
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
        { status: 404 },
      );
    }

    /*
     * Only browser-safe preview types are allowed.
     *
     * Office documents remain download-only.
     */
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
        { status: 415 },
      );
    }

    const storagePath =
      resolveSafeStoragePath(
        financeDocument.storageKey,
      );

    if (!storagePath) {
      console.error(
        "Finance preview blocked unsafe storage path:",
        {
          documentId: financeDocument.id,
          userId: currentUser.id,
        },
      );

      return NextResponse.json(
        {
          error:
            "The Finance document could not be accessed.",
        },
        { status: 500 },
      );
    }

    /*
     * The storage path has already been validated and
     * contained inside the storage directory.
     *
     * turbopackIgnore prevents Turbopack from attempting
     * to statically trace this dynamically resolved path.
     */
    const fileStats =
      await fs.stat(
        /* turbopackIgnore: true */ storagePath,
      );

    if (!fileStats.isFile()) {
      return NextResponse.json(
        {
          error:
            "The Finance document could not be accessed.",
        },
        { status: 404 },
      );
    }

    /*
     * Verify the physical file size against the
     * database metadata before serving it.
     */
    const databaseSize =
      Number(financeDocument.size);

    if (
      !Number.isSafeInteger(databaseSize) ||
      databaseSize < 0
    ) {
      console.error(
        "Finance preview encountered invalid database file size:",
        {
          documentId: financeDocument.id,
        },
      );

      return NextResponse.json(
        {
          error:
            "The Finance document could not be accessed.",
        },
        { status: 500 },
      );
    }

    if (
      fileStats.size !== databaseSize
    ) {
      console.error(
        "Finance preview file size mismatch:",
        {
          documentId: financeDocument.id,
          databaseSize,
          filesystemSize: fileStats.size,
        },
      );

      return NextResponse.json(
        {
          error:
            "The Finance document could not be accessed.",
        },
        { status: 409 },
      );
    }

    /*
     * Read the file only after all authorization,
     * firm-isolation and path checks have passed.
     */
    const buffer =
      await fs.readFile(
        /* turbopackIgnore: true */ storagePath,
      );

    if (buffer.length !== databaseSize) {
      console.error(
        "Finance preview buffer size mismatch:",
        {
          documentId: financeDocument.id,
          databaseSize,
          bufferSize: buffer.length,
        },
      );

      return NextResponse.json(
        {
          error:
            "The Finance document could not be accessed.",
        },
        { status: 409 },
      );
    }

    const filename =
      sanitizeFilename(
        financeDocument.originalName ||
          financeDocument.name ||
          `finance-document${financeDocument.extension}`,
      );

    /*
     * Preview is a READ operation.
     *
     * Audit failure must not expose the document
     * or break an otherwise authorized preview.
     */
    try {
      await createAuditLog({
        firmId: currentUser.firmId,
        userId: currentUser.id,
        action: "READ",
        entityType: "FinanceDocument",
        entityId: financeDocument.id,
        description:
          "Finance document previewed",
        metadata: {
          mimeType:
            financeDocument.mimeType,
          extension:
            financeDocument.extension,
          size: databaseSize,
        },
      });
    } catch (auditError) {
      console.error(
        "Finance document preview audit failed:",
        auditError,
      );
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          financeDocument.mimeType,

        "Content-Length":
          String(buffer.length),

        "Content-Disposition":
          `inline; filename="${filename.replace(/"/g, "_")}"; filename*=UTF-8''${encodeRFC5987(filename)}`,

        "Cache-Control":
          "private, no-store, max-age=0",

        "X-Content-Type-Options":
          "nosniff",

        "Content-Security-Policy":
          "default-src 'none'; sandbox",
      },
    });
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
      { status: 500 },
    );
  }
}