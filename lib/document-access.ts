
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import type { Permission } from "@/lib/permissions";
import type { UserRole } from "@/src/generated/prisma/enums";

const PRIVILEGED_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "MANAGING_PARTNER",
  "PARTNER",
  "DIRECTOR",
  "ADMIN",
];

export type DocumentAccessAction =
  | "view"
  | "preview"
  | "download"
  | "update"
  | "archive"
  | "restore"
  | "delete"
  | "manage_versions"
  | "version_create";

export type DocumentAccessResult = {
  allowed: boolean;
  reason:
    | "ALLOWED"
    | "DOCUMENT_NOT_FOUND"
    | "USER_NOT_FOUND"
    | "MATTER_ACCESS_DENIED"
    | "PERMISSION_DENIED";

  user?: {
    id: string;
    firmId: string;
    name: string | null;
    email: string | null;
    role: UserRole;
  };

  document?: {
    id: string;
    firmId: string;
    matterId: string;
    referenceNumber: string;
    name: string;
    originalName: string | null;
    mimeType: string | null;
    extension: string | null;
    currentVersion: number;
    size: bigint;
    storageKey: string;
    status: string;
    matter: {
      id: string;
      referenceNumber: string;
      title: string;
    } | null;
  };
};

function isPrivilegedRole(role: UserRole): boolean {
  return PRIVILEGED_ROLES.includes(role);
}

export async function userCanAccessDocument({
  documentId,
  userId,
  firmId,
  role,
  permission,
  action,
}: {
  documentId: string;
  userId: string;
  firmId: string;
  role: UserRole;
  permission?: Permission;
  action: DocumentAccessAction;
}): Promise<DocumentAccessResult> {
  /*
   * STEP 1
   * Verify the RBAC permission when one is supplied.
   */
  if (
    permission &&
    !hasPermission(role, permission)
  ) {
    return {
      allowed: false,
      reason: "PERMISSION_DENIED",
    };
  }

  /*
   * STEP 2
   * Verify that the user is active and belongs
   * to the requested firm.
   */
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
    return {
      allowed: false,
      reason: "USER_NOT_FOUND",
    };
  }

  /*
   * STEP 3
   * Find the document strictly inside the user's firm.
   */
  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
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
      originalName: true,
      mimeType: true,
      extension: true,
      currentVersion: true,
      size: true,
      storageKey: true,
      status: true,
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
    return {
      allowed: false,
      reason: "DOCUMENT_NOT_FOUND",
    };
  }

  /*
   * STEP 4
   * Privileged firm roles have access to all
   * documents belonging to their own firm.
   */
  if (isPrivilegedRole(user.role)) {
    return {
      allowed: true,
      reason: "ALLOWED",
      user,
      document,
    };
  }

  /*
   * STEP 5
   * Ordinary users must have access to the matter.
   */
  const matterAccess =
    await prisma.matterUser.findFirst({
      where: {
        matterId: document.matterId,
        userId: user.id,
        canView: true,
      },
      select: {
        canView: true,
        canUpload: true,
        canDownload: true,
        canDelete: true,
        canManage: true,
      },
    });

  if (!matterAccess?.canView) {
    return {
      allowed: false,
      reason: "MATTER_ACCESS_DENIED",
      user,
      document,
    };
  }

  /*
   * STEP 6
   * Apply the specific resource-level permission.
   */
  let allowed = false;

  switch (action) {
    case "view":
    case "preview":
      allowed = matterAccess.canView;
      break;

    case "download":
      allowed = matterAccess.canDownload;
      break;

    case "version_create":
      allowed = matterAccess.canUpload;
      break;

    case "update":
    case "archive":
    case "restore":
    case "manage_versions":
      allowed = matterAccess.canManage;
      break;

    case "delete":
      allowed = matterAccess.canDelete;
      break;

    default:
      allowed = false;
  }

  if (!allowed) {
    return {
      allowed: false,
      reason: "PERMISSION_DENIED",
      user,
      document,
    };
  }

  return {
    allowed: true,
    reason: "ALLOWED",
    user,
    document,
  };
}

export async function userCanViewDocument({
  documentId,
  userId,
  firmId,
  role,
}: {
  documentId: string;
  userId: string;
  firmId: string;
  role: UserRole;
}): Promise<boolean> {
  const result = await userCanAccessDocument({
    documentId,
    userId,
    firmId,
    role,
    action: "view",
  });

  return result.allowed;
}

export async function userCanPreviewDocument({
  documentId,
  userId,
  firmId,
  role,
}: {
  documentId: string;
  userId: string;
  firmId: string;
  role: UserRole;
}): Promise<boolean> {
  const result = await userCanAccessDocument({
    documentId,
    userId,
    firmId,
    role,
    action: "preview",
  });

  return result.allowed;
}

export async function userCanDownloadDocument({
  documentId,
  userId,
  firmId,
  role,
}: {
  documentId: string;
  userId: string;
  firmId: string;
  role: UserRole;
}): Promise<boolean> {
  const result = await userCanAccessDocument({
    documentId,
    userId,
    firmId,
    role,
    action: "download",
  });

  return result.allowed;
}

export async function userCanCreateDocumentVersion({
  documentId,
  userId,
  firmId,
  role,
}: {
  documentId: string;
  userId: string;
  firmId: string;
  role: UserRole;
}): Promise<boolean> {
  const result = await userCanAccessDocument({
    documentId,
    userId,
    firmId,
    role,
    action: "version_create",
  });

  return result.allowed;
}

export async function userCanManageDocument({
  documentId,
  userId,
  firmId,
  role,
}: {
  documentId: string;
  userId: string;
  firmId: string;
  role: UserRole;
}): Promise<boolean> {
  const result = await userCanAccessDocument({
    documentId,
    userId,
    firmId,
    role,
    action: "update",
  });

  return result.allowed;
}

export async function userCanDeleteDocument({
  documentId,
  userId,
  firmId,
  role,
}: {
  documentId: string;
  userId: string;
  firmId: string;
  role: UserRole;
}): Promise<boolean> {
  const result = await userCanAccessDocument({
    documentId,
    userId,
    firmId,
    role,
    action: "delete",
  });

  return result.allowed;
}