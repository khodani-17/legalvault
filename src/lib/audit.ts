import { prisma } from "@/lib/prisma";
import type { NextRequest } from "next/server";

interface CreateAuditLogParams {
  request?: NextRequest;
  firmId: string;
  userId: string;
  action:
    | "CREATE"
    | "READ"
    | "UPDATE"
    | "DELETE"
    | "DOWNLOAD"
    | "UPLOAD"
    | "LOGIN"
    | "LOGOUT"
    | "SHARE"
    | "ARCHIVE"
    | "RESTORE";
  entityType: string;
  entityId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export async function createAuditLog({
  request,
  firmId,
  userId,
  action,
  entityType,
  entityId,
  description,
  metadata,
}: CreateAuditLogParams) {
  try {
    const ipAddress =
      request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request?.headers.get("x-real-ip") ||
      null;

    const userAgent =
      request?.headers.get("user-agent") || null;

    return await prisma.auditLog.create({
      data: {
        firmId,
        userId,
        action,
        entityType,
        entityId: entityId ?? null,
        description: description ?? null,
        ipAddress,
        userAgent,
        metadata: metadata
          ? JSON.parse(JSON.stringify(metadata))
          : undefined,
      },
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);

    // Audit logging must not break authentication or other
    // application operations if the audit database operation fails.
    return null;
  }
}