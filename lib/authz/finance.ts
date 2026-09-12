import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import {
  UserRole,
  UserStatus,
} from "@/src/generated/prisma/enums";

// ============================================================
// FINANCE AUTHORIZATION
// ============================================================
//
// Finance is a completely separate security area.
//
// Only:
//     FINANCE
//
// may access Finance functionality.
//
// The following roles do NOT automatically receive Finance
// access:
//
//     SUPER_ADMIN
//     MANAGING_PARTNER
//     PARTNER
//     DIRECTOR
//     ATTORNEY
//     CANDIDATE_ATTORNEY
//     PARALEGAL
//     LEGAL_SECRETARY
//     ADMIN
//
// Finance authorization is checked against the database,
// rather than trusting only the JWT role.
//
// ============================================================

type FinanceAuthorizationResult =
  | {
      authorized: true;
      user: {
        id: string;
        firmId: string;
        name: string;
        email: string;
        role: UserRole;
      };
    }
  | {
      authorized: false;
      response: NextResponse;
    };

// ============================================================
// GET CURRENT DATABASE USER
// ============================================================
//
// We deliberately query the database.
//
// This means that if a user's role or status changes,
// Finance access is removed without relying solely on an
// old JWT session.
//
// ============================================================

async function getCurrentFinanceUser() {
  const session = await auth();

  if (!session?.user?.id || !session.user.firmId) {
    return null;
  }

  const user = await prisma.user.findFirst({
    where: {
      id: session.user.id,
      firmId: session.user.firmId,
      status: UserStatus.ACTIVE,
    },

    select: {
      id: true,
      firmId: true,
      name: true,
      email: true,
      role: true,
    },
  });

  return user;
}

// ============================================================
// SECURITY NOTIFICATION
// ============================================================
//
// When an authenticated user attempts to enter Finance
// without authorization:
//
// 1. Create an audit event.
// 2. Notify active DIRECTOR users.
// 3. Notify active FINANCE users.
//
// We intentionally do not expose sensitive Finance details
// in the notification.
//
// ============================================================

async function notifyFinanceSecurityIncident({
  request,
  userId,
  firmId,
  userName,
  userEmail,
  userRole,
}: {
  request: Request;
  userId: string;
  firmId: string;
  userName: string;
  userEmail: string;
  userRole: UserRole;
}) {
  // ----------------------------------------------------------
  // AUDIT
  // ----------------------------------------------------------

  try {
    await createAuditLog({
      request,
      firmId,
      userId,
      action: "READ",
      entityType: "FinanceSecurity",
      description:
        `Unauthorized Finance access attempt by ${userName} (${userEmail}).`,
      metadata: {
        event: "UNAUTHORIZED_FINANCE_ACCESS",
        attemptedByUserId: userId,
        attemptedByRole: userRole,
        area: "FINANCE",
      },
    });
  } catch (error) {
    console.error(
      "FINANCE SECURITY: Failed to create audit log.",
      error,
    );
  }

  // ----------------------------------------------------------
  // FIND DIRECTORS AND FINANCE USERS
  // ----------------------------------------------------------

  try {
    const recipients =
      await prisma.user.findMany({
        where: {
          firmId,
          status: UserStatus.ACTIVE,
          role: {
            in: [
              UserRole.DIRECTOR,
              UserRole.FINANCE,
            ],
          },
        },

        select: {
          id: true,
          role: true,
        },
      });

    // --------------------------------------------------------
    // REMOVE DUPLICATES
    // --------------------------------------------------------

    const uniqueRecipients =
      Array.from(
        new Map(
          recipients.map((recipient) => [
            recipient.id,
            recipient,
          ]),
        ).values(),
      );

    // --------------------------------------------------------
    // CREATE SECURITY NOTIFICATIONS
    // --------------------------------------------------------

    if (uniqueRecipients.length > 0) {
      await prisma.notification.createMany({
        data: uniqueRecipients.map(
          (recipient) => ({
            firmId,
            userId: recipient.id,
            type: "SECURITY",
            title:
              "Unauthorized Finance access attempt",
            message:
              `User ${userName} (${userRole}) attempted to access the restricted Finance area.`,
          }),
        ),
      });
    }
  } catch (error) {
    console.error(
      "FINANCE SECURITY: Failed to create notifications.",
      error,
    );
  }
}

// ============================================================
// REQUIRE FINANCE ACCESS
// ============================================================
//
// This is the main function Finance API routes will use.
//
// Example:
//
// const authorization =
//   await requireFinanceAccess(request);
//
// if (!authorization.authorized) {
//   return authorization.response;
// }
//
// const financeUser = authorization.user;
//
// ============================================================

export async function requireFinanceAccess(
  request: Request,
): Promise<FinanceAuthorizationResult> {
  // ----------------------------------------------------------
  // GET DATABASE USER
  // ----------------------------------------------------------

  const user =
    await getCurrentFinanceUser();

  // ----------------------------------------------------------
  // NOT AUTHENTICATED
  // ----------------------------------------------------------

  if (!user) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          error: "Unauthorized.",
        },
        {
          status: 401,
        },
      ),
    };
  }

  // ----------------------------------------------------------
  // FINANCE ROLE CHECK
  // ----------------------------------------------------------

  if (user.role !== UserRole.FINANCE) {
    // --------------------------------------------------------
    // SECURITY INCIDENT
    // --------------------------------------------------------

    await notifyFinanceSecurityIncident({
      request,
      userId: user.id,
      firmId: user.firmId,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
    });

    // --------------------------------------------------------
    // GENERIC RESPONSE
    // --------------------------------------------------------
    //
    // Do not reveal whether Finance exists, what files exist,
    // or what financial records are stored.
    //
    // --------------------------------------------------------

    return {
      authorized: false,
      response: NextResponse.json(
        {
          error: "Forbidden.",
        },
        {
          status: 403,
        },
      ),
    };
  }

  // ----------------------------------------------------------
  // AUTHORIZED
  // ----------------------------------------------------------

  return {
    authorized: true,
    user,
  };
}