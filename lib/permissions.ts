import type { UserRole } from "@/src/generated/prisma/enums";

// ============================================================
// PERMISSIONS
// ============================================================

export type Permission =
  | "dashboard.view"

  | "clients.view"
  | "clients.create"
  | "clients.update"
  | "clients.delete"

  | "matters.view"
  | "matters.create"
  | "matters.update"
  | "matters.delete"
  | "matters.manage_users"

  | "documents.view"
  | "documents.preview"
  | "documents.details"
  | "documents.download"
  | "documents.upload"
  | "documents.update"
  | "documents.version.create"
  | "documents.archive"
  | "documents.restore"
  | "documents.delete"
  | "documents.manage_versions"

  | "tasks.view"
  | "tasks.create"
  | "tasks.update"
  | "tasks.delete"

  | "correspondence.view"
  | "correspondence.create"
  | "correspondence.update"
  | "correspondence.delete"

  | "deadlines.view"
  | "deadlines.create"
  | "deadlines.update"
  | "deadlines.delete"

  | "users.view"
  | "users.create"
  | "users.update"
  | "users.deactivate"

  | "audit.view";

// ============================================================
// ROLE PERMISSIONS
// ============================================================
//
// IMPORTANT:
// Finance is deliberately isolated from the legal permission
// system. FINANCE receives no general legal permissions here.
//
// Finance authorization is handled separately by the dedicated
// Finance authorization layer.
//
// ============================================================

const ROLE_PERMISSIONS: Record<
  UserRole,
  readonly Permission[]
> = {
  // ==========================================================
  // SUPER ADMIN
  // ==========================================================

  SUPER_ADMIN: [
    "dashboard.view",

    "clients.view",
    "clients.create",
    "clients.update",
    "clients.delete",

    "matters.view",
    "matters.create",
    "matters.update",
    "matters.delete",
    "matters.manage_users",

    "documents.view",
    "documents.preview",
    "documents.details",
    "documents.download",
    "documents.upload",
    "documents.update",
    "documents.version.create",
    "documents.archive",
    "documents.restore",
    "documents.delete",
    "documents.manage_versions",

    "tasks.view",
    "tasks.create",
    "tasks.update",
    "tasks.delete",

    "correspondence.view",
    "correspondence.create",
    "correspondence.update",
    "correspondence.delete",

    "deadlines.view",
    "deadlines.create",
    "deadlines.update",
    "deadlines.delete",

    "users.view",
    "users.create",
    "users.update",
    "users.deactivate",

    "audit.view",
  ],

  // ==========================================================
  // MANAGING PARTNER
  // ==========================================================

  MANAGING_PARTNER: [
    "dashboard.view",

    "clients.view",
    "clients.create",
    "clients.update",
    "clients.delete",

    "matters.view",
    "matters.create",
    "matters.update",
    "matters.delete",
    "matters.manage_users",

    "documents.view",
    "documents.preview",
    "documents.details",
    "documents.download",
    "documents.upload",
    "documents.update",
    "documents.version.create",
    "documents.archive",
    "documents.restore",
    "documents.delete",
    "documents.manage_versions",

    "tasks.view",
    "tasks.create",
    "tasks.update",
    "tasks.delete",

    "correspondence.view",
    "correspondence.create",
    "correspondence.update",
    "correspondence.delete",

    "deadlines.view",
    "deadlines.create",
    "deadlines.update",
    "deadlines.delete",

    "users.view",
    "users.create",
    "users.update",
    "users.deactivate",

    "audit.view",
  ],

  // ==========================================================
  // PARTNER
  // ==========================================================

  PARTNER: [
    "dashboard.view",

    "clients.view",
    "clients.create",
    "clients.update",
    "clients.delete",

    "matters.view",
    "matters.create",
    "matters.update",
    "matters.delete",
    "matters.manage_users",

    "documents.view",
    "documents.preview",
    "documents.details",
    "documents.download",
    "documents.upload",
    "documents.update",
    "documents.version.create",
    "documents.archive",
    "documents.restore",
    "documents.delete",
    "documents.manage_versions",

    "tasks.view",
    "tasks.create",
    "tasks.update",
    "tasks.delete",

    "correspondence.view",
    "correspondence.create",
    "correspondence.update",
    "correspondence.delete",

    "deadlines.view",
    "deadlines.create",
    "deadlines.update",
    "deadlines.delete",

    "users.view",
    "users.create",
    "users.update",
    "users.deactivate",

    "audit.view",
  ],

  // ==========================================================
  // DIRECTOR
  // ==========================================================

  DIRECTOR: [
    "dashboard.view",

    "clients.view",
    "clients.create",
    "clients.update",
    "clients.delete",

    "matters.view",
    "matters.create",
    "matters.update",
    "matters.delete",
    "matters.manage_users",

    "documents.view",
    "documents.preview",
    "documents.details",
    "documents.download",
    "documents.upload",
    "documents.update",
    "documents.version.create",
    "documents.archive",
    "documents.restore",
    "documents.delete",
    "documents.manage_versions",

    "tasks.view",
    "tasks.create",
    "tasks.update",
    "tasks.delete",

    "correspondence.view",
    "correspondence.create",
    "correspondence.update",
    "correspondence.delete",

    "deadlines.view",
    "deadlines.create",
    "deadlines.update",
    "deadlines.delete",

    "users.view",
    "users.create",
    "users.update",
    "users.deactivate",

    "audit.view",
  ],

  // ==========================================================
  // ATTORNEY
  // ==========================================================

  ATTORNEY: [
    "dashboard.view",

    "clients.view",
    "clients.create",
    "clients.update",

    "matters.view",
    "matters.create",
    "matters.update",
    "matters.manage_users",

    "documents.view",
    "documents.preview",
    "documents.details",
    "documents.download",
    "documents.upload",
    "documents.update",
    "documents.version.create",
    "documents.archive",
    "documents.restore",

    "tasks.view",
    "tasks.create",
    "tasks.update",
    "tasks.delete",

    "correspondence.view",
    "correspondence.create",
    "correspondence.update",

    "deadlines.view",
    "deadlines.create",
    "deadlines.update",
    "deadlines.delete",
  ],

  // ==========================================================
  // CANDIDATE ATTORNEY
  // ==========================================================

  CANDIDATE_ATTORNEY: [
    "dashboard.view",

    "clients.view",

    "matters.view",

    "documents.view",
    "documents.preview",
    "documents.details",
    "documents.download",
    "documents.upload",

    "tasks.view",
    "tasks.create",
    "tasks.update",

    "correspondence.view",
  ],

  // ==========================================================
  // PARALEGAL
  // ==========================================================

  PARALEGAL: [
    "dashboard.view",

    "clients.view",
    "clients.create",
    "clients.update",

    "matters.view",

    "documents.view",
    "documents.preview",
    "documents.details",
    "documents.download",
    "documents.upload",

    "tasks.view",
    "tasks.create",
    "tasks.update",

    "correspondence.view",
    "correspondence.create",
    "correspondence.update",
  ],

  // ==========================================================
  // LEGAL SECRETARY
  // ==========================================================

  LEGAL_SECRETARY: [
    "dashboard.view",

    "clients.view",
    "clients.create",
    "clients.update",

    "matters.view",

    "documents.view",
    "documents.preview",
    "documents.details",
    "documents.download",
    "documents.upload",

    "tasks.view",
    "tasks.create",
    "tasks.update",

    "correspondence.view",
    "correspondence.create",
    "correspondence.update",
  ],

  // ==========================================================
  // ADMIN
  // ==========================================================
  //
  // ADMIN has application/operational administration access.
  //
  // ADMIN DOES NOT receive Finance permissions.
  //
  // Finance files and payment operations are protected by the
  // dedicated Finance authorization layer.
  //
  // ==========================================================

  ADMIN: [
    "dashboard.view",

    "clients.view",
    "clients.create",
    "clients.update",
    "clients.delete",

    "matters.view",
    "matters.create",
    "matters.update",
    "matters.delete",
    "matters.manage_users",

    "documents.view",
    "documents.preview",
    "documents.details",
    "documents.download",
    "documents.upload",
    "documents.update",
    "documents.version.create",
    "documents.archive",
    "documents.restore",
    "documents.delete",
    "documents.manage_versions",

    "tasks.view",
    "tasks.create",
    "tasks.update",
    "tasks.delete",

    "correspondence.view",
    "correspondence.create",
    "correspondence.update",
    "correspondence.delete",

    "deadlines.view",
    "deadlines.create",
    "deadlines.update",
    "deadlines.delete",

    "users.view",
    "users.create",
    "users.update",
    "users.deactivate",

    "audit.view",
  ],

  // ==========================================================
  // FINANCE
  // ==========================================================
  //
  // FINANCE is deliberately isolated.
  //
  // DO NOT add legal permissions here.
  //
  // Dedicated Finance permissions must be enforced through the
  // Finance authorization layer.
  //
  // ==========================================================

  FINANCE: [],
};

// ============================================================
// ROLE VALIDATION
// ============================================================

function isValidRole(
  role: UserRole | string,
): role is UserRole {
  return (
    typeof role === "string" &&
    role in ROLE_PERMISSIONS
  );
}

// ============================================================
// SINGLE PERMISSION
// ============================================================

export function hasPermission(
  role: UserRole | string,
  permission: Permission,
): boolean {
  if (!isValidRole(role)) {
    return false;
  }

  return ROLE_PERMISSIONS[role].includes(
    permission,
  );
}

// ============================================================
// ANY PERMISSION
// ============================================================

export function hasAnyPermission(
  role: UserRole | string,
  permissions: readonly Permission[],
): boolean {
  return permissions.some(
    (permission) =>
      hasPermission(
        role,
        permission,
      ),
  );
}

// ============================================================
// ALL PERMISSIONS
// ============================================================

export function hasAllPermissions(
  role: UserRole | string,
  permissions: readonly Permission[],
): boolean {
  return permissions.every(
    (permission) =>
      hasPermission(
        role,
        permission,
      ),
  );
}

// ============================================================
// GET ROLE PERMISSIONS
// ============================================================

export function getRolePermissions(
  role: UserRole | string,
): readonly Permission[] {
  if (!isValidRole(role)) {
    return [];
  }

  return ROLE_PERMISSIONS[role];
}