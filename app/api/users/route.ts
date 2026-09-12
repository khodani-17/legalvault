import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import {
  UserRole,
  UserStatus,
} from "@/src/generated/prisma/enums";
import { createAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions-server";

/**
 * ============================================================
 * USER MANAGEMENT API
 * ============================================================
 *
 * GET
 *     /api/users
 *     Permission: users.view
 *
 * POST
 *     /api/users
 *     Permission: users.create
 *
 * Security:
 * - Users are restricted to the authenticated user's firm.
 * - Only ACTIVE users may access this endpoint.
 * - A user cannot create another user with a role more
 *   privileged than their own role.
 * - SUPER_ADMIN is reserved for SUPER_ADMIN.
 * - FINANCE is a restricted security role.
 * - Only SUPER_ADMIN, MANAGING_PARTNER, PARTNER, and DIRECTOR
 *   may create FINANCE users.
 * - Password hashes are never returned.
 * ============================================================
 */

// ============================================================
// ROLE HIERARCHY
// ============================================================
//
// Higher number = greater administrative authority.
//
// SUPER_ADMIN may manage all roles.
// Other roles cannot create users above their own level.
//
// FINANCE is intentionally kept outside the normal hierarchy.
// It is a restricted functional/security role, not a lower
// administrative role.
//
// ============================================================

const ROLE_LEVEL: Record<UserRole, number> = {
  SUPER_ADMIN: 100,
  MANAGING_PARTNER: 90,
  PARTNER: 80,
  DIRECTOR: 70,
  ATTORNEY: 60,
  ADMIN: 50,
  CANDIDATE_ATTORNEY: 40,
  PARALEGAL: 30,
  LEGAL_SECRETARY: 20,
  FINANCE: 0,
};

// ============================================================
// ROLE ASSIGNMENT SECURITY
// ============================================================
//
// FINANCE is a restricted role.
//
// Only:
// - SUPER_ADMIN
// - MANAGING_PARTNER
// - PARTNER
// - DIRECTOR
//
// may create a FINANCE user.
//
// This prevents lower-level users such as ADMIN, ATTORNEY,
// CANDIDATE_ATTORNEY, PARALEGAL, or LEGAL_SECRETARY from
// manually submitting role=FINANCE to the API.
//
// ============================================================

function canAssignRole(
  actorRole: UserRole,
  targetRole: UserRole
): boolean {
  // SUPER_ADMIN may assign any role.
  if (actorRole === UserRole.SUPER_ADMIN) {
    return true;
  }

  // FINANCE is a restricted security role.
  // Only senior management may create Finance users.
  if (targetRole === UserRole.FINANCE) {
    return (
      actorRole === UserRole.MANAGING_PARTNER ||
      actorRole === UserRole.PARTNER ||
      actorRole === UserRole.DIRECTOR
    );
  }

  // Finance users cannot create or manage users
  // through the normal user-management hierarchy.
  if (actorRole === UserRole.FINANCE) {
    return false;
  }

  // Normal role hierarchy.
  return (
    ROLE_LEVEL[targetRole] <=
    ROLE_LEVEL[actorRole]
  );
}

// ============================================================
// VERIFY ACTIVE USER
// ============================================================

async function getActiveSessionUser(
  session: {
    user: {
      id?: string | null;
      firmId?: string | null;
    };
  }
) {
  const userId = session.user?.id;
  const firmId = session.user?.firmId;

  if (!userId || !firmId) {
    return null;
  }

  return prisma.user.findFirst({
    where: {
      id: userId,
      firmId,
      status: UserStatus.ACTIVE,
    },
    select: {
      id: true,
      firmId: true,
      role: true,
      name: true,
      email: true,
    },
  });
}

// ============================================================
// GET USERS
// ============================================================

export async function GET(request: Request) {
  try {
    const permission =
      await requirePermission("users.view");

    if (!permission.authorized) {
      return permission.response;
    }

    const session = permission.session;

    const actor =
      await getActiveSessionUser(session);

    if (!actor) {
      return NextResponse.json(
        {
          error: "Unauthorized.",
        },
        {
          status: 401,
        }
      );
    }

    const users =
      await prisma.user.findMany({
        where: {
          firmId: actor.firmId,
          status: UserStatus.ACTIVE,
        },

        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          avatarUrl: true,
          lastLoginAt: true,
          createdAt: true,
        },

        orderBy: {
          name: "asc",
        },
      });

    await createAuditLog({
      request,
      firmId: actor.firmId,
      userId: actor.id,
      action: "READ",
      entityType: "User",
      description: "Viewed active user list.",
      metadata: {
        resultCount: users.length,
      },
    });

    return NextResponse.json({
      success: true,
      users,
    });
  } catch (error) {
    console.error(
      "GET USERS ERROR:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to load users.",
      },
      {
        status: 500,
      }
    );
  }
}

// ============================================================
// CREATE USER
// ============================================================

export async function POST(
  request: Request
) {
  try {
    const permission =
      await requirePermission("users.create");

    if (!permission.authorized) {
      return permission.response;
    }

    const session = permission.session;

    const actor =
      await getActiveSessionUser(session);

    if (!actor) {
      return NextResponse.json(
        {
          error: "Unauthorized.",
        },
        {
          status: 401,
        }
      );
    }

    // --------------------------------------------------------
    // REQUEST BODY
    // --------------------------------------------------------

    let body: {
      name?: unknown;
      email?: unknown;
      password?: unknown;
      role?: unknown;
      status?: unknown;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          error: "Invalid JSON request.",
        },
        {
          status: 400,
        }
      );
    }

    // --------------------------------------------------------
    // NORMALISE INPUT
    // --------------------------------------------------------

    const name =
      typeof body.name === "string"
        ? body.name.trim()
        : "";

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    // --------------------------------------------------------
    // VALIDATE ROLE
    // --------------------------------------------------------

    const requestedRole =
      typeof body.role === "string"
        ? body.role
        : UserRole.LEGAL_SECRETARY;

    if (
      !Object.values(UserRole).includes(
        requestedRole as UserRole
      )
    ) {
      return NextResponse.json(
        {
          error: "Invalid user role.",
        },
        {
          status: 400,
        }
      );
    }

    const role =
      requestedRole as UserRole;

    // --------------------------------------------------------
    // PREVENT PRIVILEGE ESCALATION
    // --------------------------------------------------------

    if (
      !canAssignRole(
        actor.role,
        role
      )
    ) {
      return NextResponse.json(
        {
          error:
            role === UserRole.FINANCE
              ? "You are not authorised to create a Finance user."
              : "You cannot create a user with a role more privileged than your own.",
        },
        {
          status: 403,
        }
      );
    }

    // --------------------------------------------------------
    // VALIDATE STATUS
    // --------------------------------------------------------

    const requestedStatus =
      typeof body.status === "string"
        ? body.status
        : UserStatus.ACTIVE;

    if (
      !Object.values(UserStatus).includes(
        requestedStatus as UserStatus
      )
    ) {
      return NextResponse.json(
        {
          error: "Invalid user status.",
        },
        {
          status: 400,
        }
      );
    }

    const status =
      requestedStatus as UserStatus;

    // --------------------------------------------------------
    // VALIDATION
    // --------------------------------------------------------

    if (!name) {
      return NextResponse.json(
        {
          error: "Name is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (!email) {
      return NextResponse.json(
        {
          error: "Email address is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (!email.includes("@")) {
      return NextResponse.json(
        {
          error:
            "Please provide a valid email address.",
        },
        {
          status: 400,
        }
      );
    }

    if (!password) {
      return NextResponse.json(
        {
          error: "Password is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        {
          error:
            "Password must be at least 8 characters.",
        },
        {
          status: 400,
        }
      );
    }

    // --------------------------------------------------------
    // CHECK EXISTING USER
    // --------------------------------------------------------

    const existingUser =
      await prisma.user.findUnique({
        where: {
          email,
        },
      });

    if (existingUser) {
      return NextResponse.json(
        {
          error:
            "A user with this email address already exists.",
        },
        {
          status: 409,
        }
      );
    }

    // --------------------------------------------------------
    // HASH PASSWORD
    // --------------------------------------------------------

    const passwordHash =
      await bcrypt.hash(
        password,
        12
      );

    // --------------------------------------------------------
    // CREATE USER
    // --------------------------------------------------------

    const user =
      await prisma.user.create({
        data: {
          firmId: actor.firmId,
          name,
          email,
          passwordHash,
          role,
          status,
        },

        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          avatarUrl: true,
          lastLoginAt: true,
          createdAt: true,
        },
      });

    // --------------------------------------------------------
    // AUDIT
    // --------------------------------------------------------

    await createAuditLog({
      request,
      firmId: actor.firmId,
      userId: actor.id,
      action: "CREATE",
      entityType: "User",
      entityId: user.id,
      description:
        `Created user ${user.name} (${user.email}).`,
      metadata: {
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
      },
    });

    return NextResponse.json(
      {
        success: true,
        user,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "CREATE USER ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to create user.",
      },
      {
        status: 500,
      }
    );
  }
}