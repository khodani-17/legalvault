import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import {
  UserRole,
  UserStatus,
} from "../../../../src/generated/prisma/enums";
import { createAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions-server";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

// ============================================================
// ROLE HIERARCHY
// ============================================================
//
// Higher number = greater administrative authority.
//
// IMPORTANT:
// FINANCE is NOT part of the normal administrative hierarchy.
// It is a restricted departmental role.
//
// Finance users:
// - do not manage other users
// - do not receive legal/admin authority
// - cannot promote users
// - cannot deactivate users
//
// Only:
// - SUPER_ADMIN
// - MANAGING_PARTNER
// - PARTNER
// - DIRECTOR
//
// may manage Finance users or assign the FINANCE role.
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

  // Finance is deliberately outside the normal hierarchy.
  FINANCE: 0,
};

// ============================================================
// ROLE MANAGEMENT AUTHORIZATION
// ============================================================
//
// This function protects both:
//
// 1. The role of the existing target user.
// 2. The new role being assigned.
//
// This is important because checking only the existing role
// would allow privilege escalation.
//
// Example:
// ADMIN editing an ATTORNEY -> denied.
// ATTORNEY changing a PARALEGAL into ATTORNEY -> allowed
// according to hierarchy.
// ADMIN changing a PARALEGAL into FINANCE -> denied.
//
// Finance is handled separately because it is a restricted
// departmental role rather than an administrative level.
//
// ============================================================

function canManageRole(
  actorRole: UserRole,
  targetRole: UserRole
): boolean {
  // SUPER_ADMIN has complete user-management authority.
  if (actorRole === UserRole.SUPER_ADMIN) {
    return true;
  }

  // FINANCE is a restricted departmental role.
  //
  // Only senior management can:
  // - edit Finance users
  // - assign the Finance role
  // - deactivate Finance users
  //
  if (targetRole === UserRole.FINANCE) {
    return (
      actorRole === UserRole.MANAGING_PARTNER ||
      actorRole === UserRole.PARTNER ||
      actorRole === UserRole.DIRECTOR
    );
  }

  // Finance users do not have administrative authority
  // over other users.
  if (actorRole === UserRole.FINANCE) {
    return false;
  }

  // Normal administrative hierarchy.
  return (
    ROLE_LEVEL[targetRole] <=
    ROLE_LEVEL[actorRole]
  );
}

// ============================================================
// VERIFY ACTIVE SESSION USER
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
// GET USER
// ============================================================

export async function GET(
  request: Request,
  context: RouteContext
) {
  try {
    // --------------------------------------------------------
    // PERMISSION CHECK
    // --------------------------------------------------------

    const authorization =
      await requirePermission("users.view");

    if (!authorization.authorized) {
      return authorization.response;
    }

    const session = authorization.session;

    // --------------------------------------------------------
    // DATABASE SESSION USER CHECK
    // --------------------------------------------------------

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
    // TARGET ID
    // --------------------------------------------------------

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          error: "User ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    // --------------------------------------------------------
    // FIND USER IN SAME FIRM
    // --------------------------------------------------------

    const user =
      await prisma.user.findFirst({
        where: {
          id,
          firmId: actor.firmId,
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
          updatedAt: true,

          assignedTasks: {
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
              dueDate: true,
              createdAt: true,

              matter: {
                select: {
                  id: true,
                  referenceNumber: true,
                  title: true,
                },
              },
            },

            orderBy: {
              createdAt: "desc",
            },

            take: 20,
          },
        },
      });

    if (!user) {
      return NextResponse.json(
        {
          error: "User not found.",
        },
        {
          status: 404,
        }
      );
    }

    // --------------------------------------------------------
    // AUDIT
    // --------------------------------------------------------

    await createAuditLog({
      request,
      firmId: actor.firmId,
      userId: actor.id,
      action: "READ",
      entityType: "User",
      entityId: user.id,
      description:
        `Viewed user ${user.name} (${user.email}).`,
      metadata: {
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        role: user.role,
        status: user.status,
        assignedTaskCount:
          user.assignedTasks.length,
      },
    });

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error(
      "GET USER ERROR:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to load user.",
      },
      {
        status: 500,
      }
    );
  }
}

// ============================================================
// UPDATE USER
// ============================================================

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  try {
    // --------------------------------------------------------
    // PERMISSION CHECK
    // --------------------------------------------------------

    const authorization =
      await requirePermission("users.update");

    if (!authorization.authorized) {
      return authorization.response;
    }

    const session = authorization.session;

    // --------------------------------------------------------
    // DATABASE SESSION USER CHECK
    // --------------------------------------------------------

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
    // TARGET ID
    // --------------------------------------------------------

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          error: "User ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    // --------------------------------------------------------
    // FIND TARGET USER IN SAME FIRM
    // --------------------------------------------------------

    const existingUser =
      await prisma.user.findFirst({
        where: {
          id,
          firmId: actor.firmId,
        },
      });

    if (!existingUser) {
      return NextResponse.json(
        {
          error: "User not found.",
        },
        {
          status: 404,
        }
      );
    }

    // --------------------------------------------------------
    // AUTHORITY CHECK ON EXISTING TARGET ROLE
    // --------------------------------------------------------
    //
    // Prevent a lower-level user from modifying a user
    // whose role is above their authority.
    //
    // Finance users are specifically protected here.
    //
    // --------------------------------------------------------

    if (
      !canManageRole(
        actor.role,
        existingUser.role
      )
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have authority to manage this user.",
        },
        {
          status: 403,
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
      avatarUrl?: unknown;
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
    // NORMALISE
    // --------------------------------------------------------

    const name =
      typeof body.name === "string"
        ? body.name.trim()
        : existingUser.name;

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : existingUser.email;

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    const avatarUrl =
      typeof body.avatarUrl === "string"
        ? body.avatarUrl.trim() || null
        : existingUser.avatarUrl;

    // --------------------------------------------------------
    // ROLE
    // --------------------------------------------------------

    let role: UserRole =
      existingUser.role;

    if (typeof body.role === "string") {
      if (
        !Object.values(UserRole).includes(
          body.role as UserRole
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

      role =
        body.role as UserRole;
    }

    // --------------------------------------------------------
    // NEW ROLE AUTHORITY CHECK
    // --------------------------------------------------------
    //
    // The actor must be authorised for BOTH:
    //
    // 1. Existing target role.
    // 2. Requested new role.
    //
    // This is the critical privilege-escalation protection.
    //
    // Example:
    //
    // ADMIN -> FINANCE
    // DENIED
    //
    // ATTORNEY -> FINANCE
    // DENIED
    //
    // DIRECTOR -> FINANCE
    // ALLOWED
    //
    // FINANCE -> ATTORNEY
    // DENIED
    //
    // --------------------------------------------------------

    if (
      !canManageRole(
        actor.role,
        role
      )
    ) {
      return NextResponse.json(
        {
          error:
            role === UserRole.FINANCE
              ? "You are not authorised to assign the Finance role."
              : "You cannot assign a role more privileged than your own.",
        },
        {
          status: 403,
        }
      );
    }

    // --------------------------------------------------------
    // STATUS
    // --------------------------------------------------------

    let status: UserStatus =
      existingUser.status;

    if (typeof body.status === "string") {
      if (
        !Object.values(UserStatus).includes(
          body.status as UserStatus
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

      status =
        body.status as UserStatus;
    }

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

    if (
      password &&
      password.length < 8
    ) {
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
    // EMAIL DUPLICATE CHECK
    // --------------------------------------------------------

    const emailOwner =
      await prisma.user.findUnique({
        where: {
          email,
        },
        select: {
          id: true,
          firmId: true,
        },
      });

    if (
      emailOwner &&
      emailOwner.id !== id
    ) {
      return NextResponse.json(
        {
          error:
            "Another user already uses this email address.",
        },
        {
          status: 409,
        }
      );
    }

    // --------------------------------------------------------
    // PREVENT SELF-SUSPENSION
    // --------------------------------------------------------

    if (
      id === actor.id &&
      status !== UserStatus.ACTIVE
    ) {
      return NextResponse.json(
        {
          error:
            "You cannot deactivate or suspend your own account.",
        },
        {
          status: 400,
        }
      );
    }

    // --------------------------------------------------------
    // PASSWORD
    // --------------------------------------------------------

    let passwordHash =
      existingUser.passwordHash;

    if (password) {
      passwordHash =
        await bcrypt.hash(
          password,
          12
        );
    }

    // --------------------------------------------------------
    // UPDATE USER
    // --------------------------------------------------------

    const user =
      await prisma.user.update({
        where: {
          id: existingUser.id,
        },

        data: {
          name,
          email,
          passwordHash,
          role,
          status,
          avatarUrl,
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
          updatedAt: true,
        },
      });

    // --------------------------------------------------------
    // BUILD AUDIT CHANGES
    // --------------------------------------------------------

    const changes: Record<
      string,
      {
        previous: unknown;
        new: unknown;
      }
    > = {};

    if (existingUser.name !== user.name) {
      changes.name = {
        previous: existingUser.name,
        new: user.name,
      };
    }

    if (existingUser.email !== user.email) {
      changes.email = {
        previous: existingUser.email,
        new: user.email,
      };
    }

    if (existingUser.role !== user.role) {
      changes.role = {
        previous: existingUser.role,
        new: user.role,
      };
    }

    if (existingUser.status !== user.status) {
      changes.status = {
        previous: existingUser.status,
        new: user.status,
      };
    }

    if (existingUser.avatarUrl !== user.avatarUrl) {
      changes.avatarUrl = {
        previous: existingUser.avatarUrl,
        new: user.avatarUrl,
      };
    }

    if (password) {
      changes.password = {
        previous: "[PASSWORD_CHANGED]",
        new: "[PASSWORD_CHANGED]",
      };
    }

    // --------------------------------------------------------
    // AUDIT
    // --------------------------------------------------------

    await createAuditLog({
      request,
      firmId: actor.firmId,
      userId: actor.id,
      action: "UPDATE",
      entityType: "User",
      entityId: user.id,
      description:
        `Updated user ${user.name} (${user.email}).`,
      metadata: {
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        changes,
      },
    });

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error(
      "UPDATE USER ERROR:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to update user.",
      },
      {
        status: 500,
      }
    );
  }
}

// ============================================================
// DELETE / DEACTIVATE USER
// ============================================================

export async function DELETE(
  request: Request,
  context: RouteContext
) {
  try {
    // --------------------------------------------------------
    // PERMISSION CHECK
    // --------------------------------------------------------

    const authorization =
      await requirePermission(
        "users.deactivate"
      );

    if (!authorization.authorized) {
      return authorization.response;
    }

    const session = authorization.session;

    // --------------------------------------------------------
    // DATABASE SESSION USER CHECK
    // --------------------------------------------------------

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
    // TARGET ID
    // --------------------------------------------------------

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          error: "User ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    // --------------------------------------------------------
    // PREVENT SELF-DEACTIVATION
    // --------------------------------------------------------

    if (id === actor.id) {
      return NextResponse.json(
        {
          error:
            "You cannot deactivate your own account.",
        },
        {
          status: 400,
        }
      );
    }

    // --------------------------------------------------------
    // FIND TARGET IN SAME FIRM
    // --------------------------------------------------------

    const existingUser =
      await prisma.user.findFirst({
        where: {
          id,
          firmId: actor.firmId,
        },
      });

    if (!existingUser) {
      return NextResponse.json(
        {
          error: "User not found.",
        },
        {
          status: 404,
        }
      );
    }

    // --------------------------------------------------------
    // AUTHORITY CHECK
    // --------------------------------------------------------

    if (
      !canManageRole(
        actor.role,
        existingUser.role
      )
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have authority to deactivate this user.",
        },
        {
          status: 403,
        }
      );
    }

    // --------------------------------------------------------
    // DEACTIVATE
    // --------------------------------------------------------

    const user =
      await prisma.user.update({
        where: {
          id: existingUser.id,
        },

        data: {
          status: UserStatus.INACTIVE,
        },

        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
        },
      });

    // --------------------------------------------------------
    // AUDIT
    // --------------------------------------------------------

    await createAuditLog({
      request,
      firmId: actor.firmId,
      userId: actor.id,
      action: "UPDATE",
      entityType: "User",
      entityId: user.id,
      description:
        `Deactivated user ${user.name} (${user.email}).`,
      metadata: {
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        previousStatus:
          existingUser.status,
        newStatus:
          user.status,
        action: "DEACTIVATE",
      },
    });

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error(
      "DEACTIVATE USER ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to deactivate user.",
      },
      {
        status: 500,
      }
    );
  }
}