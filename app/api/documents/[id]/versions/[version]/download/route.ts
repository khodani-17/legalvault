import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions-server";
import fs from "fs/promises";
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
// SAFE DOWNLOAD FILENAME
// =====================================================
//
// Generates a standards-safe Content-Disposition header.
//
// Uses:
// - ASCII fallback filename
// - RFC 5987 UTF-8 filename
//
// Prevents CRLF/header injection and unsafe filename
// characters from being inserted into the response.
// =====================================================

function createContentDispositionFilename(
  filename: string,
  fallback: string,
): string {
  const cleanedFilename =
    filename
      .replace(/[\u0000-\u001F\u007F]/g, "")
      .replace(/[/\\]/g, "_")
      .replace(/"/g, "")
      .trim();

  const cleanedFallback =
    fallback
      .replace(/[\u0000-\u001F\u007F]/g, "")
      .replace(/[^A-Za-z0-9._-]/g, "_")
      .replace(/^[-.]+$/, "")
      .slice(0, 180) ||
    "document";

  const asciiFallback =
    cleanedFilename
      .replace(/[^\x20-\x7E]/g, "_")
      .replace(/["\\]/g, "")
      .trim()
      .slice(0, 180) ||
    cleanedFallback;

  const encodedFilename =
    encodeURIComponent(
      cleanedFilename || cleanedFallback,
    );

  return (
    `attachment; filename="${asciiFallback}"; ` +
    `filename*=UTF-8''${encodedFilename}`
  );
}

export async function GET(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    // =================================================
    // RBAC AUTHORIZATION
    // =================================================

    const authorization =
      await requirePermission(
        "documents.download",
      );

    if (!authorization.authorized) {
      return authorization.response;
    }

    const session =
      authorization.session;

    // =================================================
    // AUTHENTICATION
    // =================================================

    if (
      !session?.user?.id ||
      !session.user.firmId
    ) {
      return NextResponse.json(
        {
          error: "Unauthorized.",
        },
        {
          status: 401,
        },
      );
    }

    const userId =
      session.user.id;

    const firmId =
      session.user.firmId;

    // =================================================
    // ROUTE PARAMETERS
    // =================================================

    const {
      id,
      version: versionParam,
    } = await params;

    if (
      typeof id !== "string" ||
      id.length === 0 ||
      id.length > 128
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid document ID.",
        },
        {
          status: 400,
        },
      );
    }

    const versionNumber =
      Number(versionParam);

    if (
      !Number.isSafeInteger(
        versionNumber,
      ) ||
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

    // =================================================
    // FIND DOCUMENT
    // =================================================
    //
    // firmId comes exclusively from the authenticated
    // session and is never accepted from the request.
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

    // =================================================
    // MATTER-LEVEL ACCESS CONTROL
    // =================================================

    const isPrivileged =
      PRIVILEGED_ROLES.has(
        user.role,
      );

    if (!isPrivileged) {
      const matterAccess =
        await prisma.matterUser.findFirst(
          {
            where: {
              matterId:
                document.matterId,

              userId:
                user.id,

              canView: true,

              canDownload: true,
            },

            select: {
              id: true,
            },
          },
        );

      if (!matterAccess) {
        return NextResponse.json(
          {
            error:
              "You do not have permission to download this document.",
          },
          {
            status: 403,
          },
        );
      }
    }

    // =================================================
    // FIND SPECIFIC VERSION
    // =================================================

    const documentVersion =
      await prisma.documentVersion.findFirst({
        where: {
          documentId:
            document.id,

          version:
            versionNumber,
        },

        select: {
          id: true,
          version: true,
          storageKey: true,
          originalName: true,
          mimeType: true,
          extension: true,
          size: true,
          uploadedById: true,
          changeNote: true,
          createdAt: true,
        },
      });

    if (!documentVersion) {
      return NextResponse.json(
        {
          error:
            "Document version was not found.",
        },
        {
          status: 404,
        },
      );
    }

    // =================================================
    // STORAGE PATH SECURITY
    // =================================================

    const storageRoot =
      path.resolve(
        process.cwd(),
        "storage",
      );

    const normalizedStorageKey =
      documentVersion.storageKey
        .replace(/\\/g, "/")
        .trim();

    if (
      !normalizedStorageKey ||
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

    const storagePath =
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
        storagePath,
      );

    if (
      relativePath.startsWith("..") ||
      path.isAbsolute(
        relativePath,
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

    // =================================================
    // VERIFY FILE EXISTS
    // =================================================

    let fileStat;

    try {
      fileStat =
        await fs.stat(
          storagePath,
        );
    } catch (error) {
      console.error(
        "DOCUMENT_VERSION_FILE_STAT_ERROR",
        {
          documentId:
            document.id,

          versionId:
            documentVersion.id,

          version:
            documentVersion.version,

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

    // =================================================
    // ENSURE STORAGE OBJECT IS A REGULAR FILE
    // =================================================

    if (!fileStat.isFile()) {
      console.error(
        "DOCUMENT_VERSION_STORAGE_NOT_FILE",
        {
          documentId:
            document.id,

          versionId:
            documentVersion.id,

          version:
            documentVersion.version,
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

    // =================================================
    // VERIFY FILE SIZE
    // =================================================
    //
    // Ensure the physical storage object matches the
    // database metadata before serving it.
    //
    // =================================================

    if (
      fileStat.size !==
      Number(documentVersion.size)
    ) {
      console.error(
        "DOCUMENT_VERSION_SIZE_MISMATCH",
        {
          documentId:
            document.id,

          versionId:
            documentVersion.id,

          version:
            documentVersion.version,

          expectedSize:
            documentVersion.size.toString(),

          actualSize:
            fileStat.size,
        },
      );

      return NextResponse.json(
        {
          error:
            "The requested document version is unavailable.",
        },
        {
          status: 409,
        },
      );
    }

    // =================================================
    // DOWNLOAD NAME
    // =================================================

    const downloadName =
      documentVersion.originalName ||
      `${document.name}-v${documentVersion.version}${
        documentVersion.extension ||
        ""
      }`;

    const safeDownloadName =
      downloadName
        .replace(
          /[\u0000-\u001F\u007F]/g,
          "",
        )
        .replace(
          /[/\\]/g,
          "_",
        )
        .trim()
        .slice(0, 255) ||
      `document-v${documentVersion.version}`;

    const contentDisposition =
      createContentDispositionFilename(
        safeDownloadName,
        `document-v${documentVersion.version}${
          documentVersion.extension ||
          ""
        }`,
      );

    // =================================================
    // AUDIT LOG
    // =================================================

    await createAuditLog({
      request,

      firmId,

      userId:
        user.id,

      action:
        "DOWNLOAD",

      entityType:
        "DocumentVersion",

      entityId:
        documentVersion.id,

      description:
        `Downloaded version ${documentVersion.version} of document ${document.referenceNumber}: ${document.name}.`,

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
          document.matter
            ?.referenceNumber ??
          null,

        matterTitle:
          document.matter?.title ??
          null,

        versionId:
          documentVersion.id,

        version:
          documentVersion.version,

        currentVersion:
          document.currentVersion,

        originalName:
          documentVersion.originalName,

        downloadName:
          safeDownloadName,

        mimeType:
          documentVersion.mimeType,

        extension:
          documentVersion.extension,

        storedSize:
          documentVersion.size.toString(),

        actualFileSize:
          fileStat.size,

        uploadedById:
          documentVersion.uploadedById,

        changeNote:
          documentVersion.changeNote,

        downloadedById:
          user.id,

        downloadedByName:
          user.name,

        downloadedByEmail:
          user.email,

        permission:
          "documents.download",

        accessLevel:
          isPrivileged
            ? "FULL_FIRM_ACCESS"
            : "MATTER_ACCESS",

        privileged:
          isPrivileged,
      },
    });

    // =================================================
    // STREAM FILE
    // =================================================
    //
    // Do not use fs.readFile().
    //
    // Streaming prevents the complete document from
    // being loaded into Node.js memory before sending.
    //
    // =================================================

    const fileStream =
      (await import("fs")).createReadStream(
        storagePath,
      );

    const webStream =
      new ReadableStream<Uint8Array>({
        start(controller) {
          fileStream.on(
            "data",
            (chunk) => {
              const buffer =
                typeof chunk === "string"
                  ? Buffer.from(chunk)
                  : chunk;

              controller.enqueue(
                new Uint8Array(buffer),
              );
            },
          );

          fileStream.on(
            "end",
            () => {
              controller.close();
            },
          );

          fileStream.on(
            "error",
            (error) => {
              console.error(
                "DOCUMENT_VERSION_FILE_STREAM_ERROR",
                {
                  documentId:
                    document.id,

                  versionId:
                    documentVersion.id,

                  version:
                    documentVersion.version,

                  error,
                },
              );

              controller.error(
                new Error(
                  "Document stream failed.",
                ),
              );
            },
          );
        },

        cancel() {
          fileStream.destroy();
        },
      });

    // =================================================
    // RESPONSE
    // =================================================

    return new NextResponse(
      webStream,
      {
        status: 200,

        headers: {
          "Content-Type":
            documentVersion.mimeType ||
            "application/octet-stream",

          "Content-Disposition":
            contentDisposition,

          "Content-Length":
            fileStat.size.toString(),

          "Cache-Control":
            "private, no-store",

          "X-Content-Type-Options":
            "nosniff",

          "Referrer-Policy":
            "no-referrer",

          "X-Download-Options":
            "noopen",
        },
      },
    );
  } catch (error) {
    // =================================================
    // INTERNAL ERROR
    // =================================================
    //
    // Log details server-side only.
    // Never expose internal errors, filesystem paths,
    // database errors, or stack traces to the client.
    //
    // =================================================

    console.error(
      "DOWNLOAD_DOCUMENT_VERSION_ERROR",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Failed to download document version.",
      },
      {
        status: 500,
      },
    );
  }
}