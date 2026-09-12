import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Session } from "next-auth";

import {
  UserStatus,
  type UserRole,
} from "@/src/generated/prisma/enums";

import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  type Permission,
} from "@/lib/permissions";

// ============================================================
// TYPES
// ============================================================

type PermissionCheck =
  | {
      type: "single";
      permission: Permission;
    }
  | {
      type: "any";
      permissions: readonly Permission[];
    }
  | {
      type: "all";
      permissions: readonly Permission[];
    };

type PermissionResult =
  | {
      authorized: true;
      session: Session;
    }
  | {
      authorized: false;
      response: NextResponse;
    };

// ============================================================
// DATABASE USER
// ============================================================
//
// The JWT is used only to identify the authenticated user.
//
// The database remains authoritative for:
// - user existence
// - firm membership
// - account status
// - current role
//
// We intentionally do NOT authorize using:
//
//     session.user.role
//
// because that value can become stale while the JWT remains
// valid.
//
// ============================================================

type DatabaseAuthenticatedUser = {
  id: string;
  firmId: string;
  role: UserRole;
  status: UserStatus;
};

// ============================================================
// GET AUTHENTICATED SESSION
// ============================================================

async function getAuthenticatedSession(): Promise<Session | null> {
  const session = await auth();

  if (
    !session ||
    typeof session !== "object"
  ) {
    return null;
  }

  if (
    !session.user ||
    typeof session.user !== "object"
  ) {
    return null;
  }

  return session as Session;
}

// ============================================================
// GET CURRENT DATABASE USER
// ============================================================
//
// The session supplies the identity.
//
// The database determines whether that identity is currently
// allowed to access LegalVault.
//
// ============================================================

async function getCurrentDatabaseUser(
  session: Session,
): Promise<DatabaseAuthenticatedUser | null> {
  const userId =
    session.user?.id;

  const sessionFirmId =
    session.user?.firmId;

  // ----------------------------------------------------------
  // Validate session identity.
  // ----------------------------------------------------------

  if (
    typeof userId !== "string" ||
    userId.length === 0 ||
    typeof sessionFirmId !== "string" ||
    sessionFirmId.length === 0
  ) {
    return null;
  }

  // ----------------------------------------------------------
  // Query current database state.
  //
  // Both user ID and firm ID are required.
  // The account must also currently be ACTIVE.
  // ----------------------------------------------------------

  const user =
    await prisma.user.findFirst({
      where: {
        id: userId,
        firmId: sessionFirmId,
        status: UserStatus.ACTIVE,
      },

      select: {
        id: true,
        firmId: true,
        role: true,
        status: true,
      },
    });

  if (!user) {
    return null;
  }

  return user;
}

// ============================================================
// PERMISSION CHECK
// ============================================================

function hasRequiredPermission(
  role: UserRole,
  check: PermissionCheck,
): boolean {
  switch (check.type) {
    case "single":
      return hasPermission(
        role,
        check.permission,
      );

    case "any":
      return hasAnyPermission(
        role,
        check.permissions,
      );

    case "all":
      return hasAllPermissions(
        role,
        check.permissions,
      );

    default:
      return false;
  }
}

// ============================================================
// CENTRAL AUTHORIZATION
// ============================================================

async function requirePermissions(
  check: PermissionCheck,
): Promise<PermissionResult> {
  // ==========================================================
  // STEP 1 — AUTHENTICATION
  // ==========================================================

  const session =
    await getAuthenticatedSession();

  if (!session?.user) {
    return {
      authorized: false,

      response:
        NextResponse.json(
          {
            error: "Unauthorized.",
          },
          {
            status: 401,
          },
        ),
    };
  }

  // ==========================================================
  // STEP 2 — CURRENT DATABASE USER
  // ==========================================================
  //
  // Never trust the role stored in the JWT.
  //
  // The database is authoritative.
  //
  // ==========================================================

  let databaseUser:
    | DatabaseAuthenticatedUser
    | null;

  try {
    databaseUser =
      await getCurrentDatabaseUser(
        session,
      );
  } catch (error) {
    // --------------------------------------------------------
    // Do not expose database errors to the client.
    // --------------------------------------------------------

    console.error(
      "PERMISSION DATABASE LOOKUP ERROR:",
      error,
    );

    return {
      authorized: false,

      response:
        NextResponse.json(
          {
            error:
              "Authorization could not be completed.",
          },
          {
            status: 503,
          },
        ),
    };
  }

  // ==========================================================
  // STEP 3 — ACTIVE USER REQUIRED
  // ==========================================================

  if (!databaseUser) {
    return {
      authorized: false,

      response:
        NextResponse.json(
          {
            error: "Unauthorized.",
          },
          {
            status: 401,
          },
        ),
    };
  }

  // ==========================================================
  // STEP 4 — USE CURRENT DATABASE ROLE
  // ==========================================================
  //
  // This is the critical security improvement.
  //
  // BEFORE:
  //
  //     session.user.role
  //
  // AFTER:
  //
  //     databaseUser.role
  //
  // Therefore:
  //
  // - role changes take effect immediately
  // - deactivated users are rejected
  // - firm membership is revalidated
  //
  // ==========================================================

  const authorized =
    hasRequiredPermission(
      databaseUser.role,
      check,
    );

  if (!authorized) {
    return {
      authorized: false,

      response:
        NextResponse.json(
          {
            error: "Forbidden.",
            message:
              "You do not have permission to perform this action.",
          },
          {
            status: 403,
          },
        ),
    };
  }

  // ==========================================================
  // STEP 5 — AUTHORIZED
  // ==========================================================

  return {
    authorized: true,
    session,
  };
}

// ============================================================
// REQUIRE SINGLE PERMISSION
// ============================================================

export async function requirePermission(
  permission: Permission,
): Promise<PermissionResult> {
  return requirePermissions({
    type: "single",
    permission,
  });
}

// ============================================================
// REQUIRE ANY PERMISSION
// ============================================================

export async function requireAnyPermission(
  permissions: readonly Permission[],
): Promise<PermissionResult> {
  return requirePermissions({
    type: "any",
    permissions,
  });
}

// ============================================================
// REQUIRE ALL PERMISSIONS
// ============================================================

export async function requireAllPermissions(
  permissions: readonly Permission[],
): Promise<PermissionResult> {
  return requirePermissions({
    type: "all",
    permissions,
  });
}