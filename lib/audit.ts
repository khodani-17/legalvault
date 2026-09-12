import { prisma } from "@/lib/prisma";

type AuditAction =
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

type AuditRequest = {
  request?: Request;
  firmId: string;
  userId: string;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  description?: string | null;
  metadata?: unknown;
};

// ------------------------------------------------------------
// SENSITIVE METADATA PROTECTION
// ------------------------------------------------------------

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordHash",
  "currentPassword",
  "newPassword",
  "confirmPassword",
  "token",
  "accessToken",
  "refreshToken",
  "idToken",
  "authorization",
  "cookie",
  "set-cookie",
  "secret",
  "apiKey",
  "api_key",
  "privateKey",
  "private_key",
]);

function sanitizeMetadata(
  value: unknown,
  depth = 0,
): unknown {
  // Prevent excessively deep objects from being processed.
  if (depth > 10) {
    return "[REDACTED]";
  }

  if (value === null) {
    return null;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) =>
      sanitizeMetadata(
        item,
        depth + 1,
      ),
    );
  }

  if (typeof value === "object") {
    const sanitized: Record<
      string,
      unknown
    > = {};

    for (const [
      key,
      item,
    ] of Object.entries(
      value as Record<
        string,
        unknown
      >,
    )) {
      if (
        SENSITIVE_KEYS.has(
          key.toLowerCase(),
        )
      ) {
        sanitized[key] =
          "[REDACTED]";
        continue;
      }

      sanitized[key] =
        sanitizeMetadata(
          item,
          depth + 1,
        );
    }

    return sanitized;
  }

  return String(value);
}

// ------------------------------------------------------------
// CLIENT IP
// ------------------------------------------------------------

function isValidIpAddress(
  value: string,
): boolean {
  // IPv4
  const ipv4Pattern =
    /^(?:\d{1,3}\.){3}\d{1,3}$/;

  if (
    ipv4Pattern.test(value)
  ) {
    const parts = value
      .split(".")
      .map(Number);

    return parts.every(
      (part) =>
        Number.isInteger(part) &&
        part >= 0 &&
        part <= 255,
    );
  }

  // IPv6
  // We deliberately use a conservative validation here.
  if (value.includes(":")) {
    return /^[0-9a-fA-F:]+$/.test(
      value,
    );
  }

  return false;
}

function getClientIp(
  request?: Request,
): string | null {
  if (!request) {
    return null;
  }

  // ----------------------------------------------------------
  // TRUSTED REVERSE PROXY HEADERS
  //
  // These headers should only be trusted when the deployment
  // uses a trusted reverse proxy/load balancer that replaces
  // them rather than allowing clients to supply arbitrary values.
  // ----------------------------------------------------------

  const forwardedFor =
    request.headers.get(
      "x-forwarded-for",
    );

  if (forwardedFor) {
    const firstIp =
      forwardedFor
        .split(",")[0]
        .trim();

    if (
      isValidIpAddress(firstIp)
    ) {
      return firstIp;
    }
  }

  const realIp =
    request.headers.get(
      "x-real-ip",
    );

  if (realIp) {
    const ip =
      realIp.trim();

    if (
      isValidIpAddress(ip)
    ) {
      return ip;
    }
  }

  return null;
}

// ------------------------------------------------------------
// USER AGENT
// ------------------------------------------------------------

function getUserAgent(
  request?: Request,
): string | null {
  if (!request) {
    return null;
  }

  const userAgent =
    request.headers.get(
      "user-agent",
    );

  if (!userAgent) {
    return null;
  }

  // Avoid storing unnecessarily huge header values.
  return userAgent.slice(
    0,
    1000,
  );
}

// ------------------------------------------------------------
// CREATE AUDIT LOG
// ------------------------------------------------------------

export async function createAuditLog({
  request,
  firmId,
  userId,
  action,
  entityType,
  entityId,
  description,
  metadata,
}: AuditRequest) {
  const sanitizedMetadata =
    metadata === undefined
      ? undefined
      : sanitizeMetadata(
          metadata,
        );

  return prisma.auditLog.create({
    data: {
      firmId,
      userId,
      action,
      entityType,
      entityId:
        entityId ?? null,
      description:
        description ?? null,
      ipAddress:
        getClientIp(request),
      userAgent:
        getUserAgent(request),

      metadata:
        sanitizedMetadata ===
        undefined
          ? undefined
          : (sanitizedMetadata as object),
    },
  });
}