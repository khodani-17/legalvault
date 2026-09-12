import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions-server";
import { userCanAccessMatter } from "@/lib/matter-access";
import { readFile } from "fs/promises";
import path from "path";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const PRIVILEGED_ROLES = [
  "SUPER_ADMIN",
  "MANAGING_PARTNER",
  "PARTNER",
  "DIRECTOR",
  "ADMIN",
] as const;

function isPrivilegedRole(role: string): boolean {
  return PRIVILEGED_ROLES.includes(
    role as (typeof PRIVILEGED_ROLES)[number],
  );
}

export async function GET(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const authorization =
      await requirePermission("documents.download");

    if (!authorization.authorized) {
      return authorization.response;
    }

    const session = authorization.session;

    if (!session.user.id || !session.user.firmId) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 },
      );
    }

    const userId = session.user.id;
    const firmId = session.user.firmId;
    const { id } = await params;

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
        { error: "Unauthorized." },
        { status: 401 },
      );
    }

    const document = await prisma.document.findFirst({
      where: {
        id,
        firmId,
        status: {
          not: "DELETED",
        },
      },
      include: {
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
        { error: "Document not found." },
        { status: 404 },
      );
    }

    const hasMatterAccess = await userCanAccessMatter({
      matterId: document.matter.id,
      userId: user.id,
      firmId,
      role: user.role,
    });

    if (!hasMatterAccess) {
      return NextResponse.json(
        { error: "Document not found." },
        { status: 404 },
      );
    }

    const isPrivileged = isPrivilegedRole(user.role);

    let canDownload = isPrivileged;

    if (!isPrivileged) {
      const matterAccess =
        await prisma.matterUser.findFirst({
          where: {
            matterId: document.matter.id,
            userId: user.id,
            canView: true,
          },
          select: {
            canDownload: true,
          },
        });

      canDownload =
        matterAccess?.canDownload === true;
    }

    if (!canDownload) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to download this document.",
        },
        { status: 403 },
      );
    }

    const versionParam =
      request.nextUrl.searchParams.get("version");

    let storageKey = document.storageKey;
    let downloadedVersion = document.currentVersion;
    let downloadedSize: bigint | null = null;

    // Metadata used specifically for the file being downloaded.
    // For the current document, these come from Document.
    // For a historical version, these come from DocumentVersion.
    let downloadOriginalName =
      document.originalName || "document";

    let downloadMimeType =
      document.mimeType ||
      "application/octet-stream";

    let downloadExtension =
      document.extension;

    if (versionParam !== null) {
      const versionNumber = Number(versionParam);

      if (
        !Number.isInteger(versionNumber) ||
        versionNumber < 1
      ) {
        return NextResponse.json(
          { error: "Invalid version." },
          { status: 400 },
        );
      }

      const version =
        await prisma.documentVersion.findFirst({
          where: {
            documentId: document.id,
            version: versionNumber,
          },
          select: {
            storageKey: true,
            version: true,
            size: true,
            originalName: true,
            mimeType: true,
            extension: true,
          },
        });

      if (!version) {
        return NextResponse.json(
          { error: "Version not found." },
          { status: 404 },
        );
      }

      storageKey = version.storageKey;
      downloadedVersion = version.version;
      downloadedSize = version.size;

      // Historical versions have their own metadata.
      downloadOriginalName =
        version.originalName || "document";

      downloadMimeType =
        version.mimeType ||
        "application/octet-stream";

      downloadExtension =
        version.extension;
    }

    const storageRoot = path.resolve(
      process.cwd(),
      "storage",
    );

    const normalizedStorageKey =
      storageKey.replace(/\\/g, "/");

    if (
      normalizedStorageKey.startsWith("/") ||
      /^[A-Za-z]:\//.test(normalizedStorageKey) ||
      normalizedStorageKey
        .split("/")
        .some((segment) => segment === "..")
    ) {
      return NextResponse.json(
        { error: "Invalid storage path." },
        { status: 400 },
      );
    }

    const filePath = path.resolve(
      storageRoot,
      normalizedStorageKey,
    );

    const relativePath = path.relative(
      storageRoot,
      filePath,
    );

    if (
      relativePath.startsWith("..") ||
      path.isAbsolute(relativePath)
    ) {
      return NextResponse.json(
        { error: "Invalid storage path." },
        { status: 400 },
      );
    }

    let file: Buffer;

    try {
      file = await readFile(filePath);
    } catch (error) {
      console.error(
        "DOCUMENT_FILE_READ_ERROR",
        {
          documentId: document.id,
          storageKey,
          error,
        },
      );

      return NextResponse.json(
        {
          error:
            "The requested document file could not be found.",
        },
        { status: 404 },
      );
    }

    await createAuditLog({
      request,
      firmId,
      userId: user.id,
      action: "DOWNLOAD",
      entityType: "Document",
      entityId: document.id,
      description:
        `Downloaded document ${document.referenceNumber}: ${document.name}. Version ${downloadedVersion}.`,
      metadata: {
        documentId: document.id,
        documentReference:
          document.referenceNumber,
        documentName:
          document.name,
        originalName:
          downloadOriginalName,
        matterId:
          document.matter.id,
        matterReferenceNumber:
          document.matter.referenceNumber,
        matterTitle:
          document.matter.title,
        version:
          downloadedVersion,
        currentVersion:
          document.currentVersion,
        mimeType:
          downloadMimeType,
        extension:
          downloadExtension,
        size:
          downloadedSize?.toString() ??
          file.length,
        downloadedById:
          user.id,
        downloadedByName:
          user.name,
        downloadedByEmail:
          user.email,
        accessLevel:
          isPrivileged
            ? "FULL_FIRM_ACCESS"
            : "MATTER_ACCESS",
        privileged:
          isPrivileged,
        permission:
          "documents.download",
      },
    });

    return new NextResponse(
      new Uint8Array(file),
      {
        status: 200,
        headers: {
          "Content-Type":
            downloadMimeType,

          "Content-Disposition":
            `attachment; filename="${encodeURIComponent(
              downloadOriginalName,
            )}"`,

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
      "DOWNLOAD_DOCUMENT_ERROR",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Failed to download document.",
      },
      { status: 500 },
    );
  }
}