import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { headers } from "next/headers";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { requireFinanceAccess } from "@/lib/authz/finance";

import FinanceWorkspace from "./FinanceWorkspace";

export default async function FinancePage() {
  const session = await auth();

  /*
   * ---------------------------------------------------------
   * AUTHENTICATION
   * ---------------------------------------------------------
   */

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!session.user.firmId) {
    redirect("/login");
  }

  /*
   * ---------------------------------------------------------
   * BUILD A SERVER REQUEST FOR SECURITY LOGGING
   * ---------------------------------------------------------
   *
   * The Finance authorization helper normally receives a
   * Request from an API route. A server-rendered page does not
   * automatically expose the same Request object, so we rebuild
   * the relevant headers here.
   */

  const requestHeaders = await headers();

  const request = new Request(
    "http://internal.local/dashboard/finance",
    {
      headers: Object.fromEntries(requestHeaders.entries()),
    },
  );

  /*
   * ---------------------------------------------------------
   * FINANCE AUTHORIZATION
   * ---------------------------------------------------------
   *
   * This checks:
   *
   * 1. Authentication
   * 2. Active database user
   * 3. Correct firm
   * 4. FINANCE role
   *
   * Unauthorized access is also audited/notified by the
   * existing Finance authorization layer.
   */

  const authorization =
    await requireFinanceAccess(request);

  if (!authorization.authorized) {
    /*
     * For a protected Finance workspace we do not expose
     * Finance content to unauthorized users.
     *
     * The authorization helper has already returned the
     * appropriate response for unauthorized access.
     *
     * Server pages cannot return that NextResponse directly,
     * so we deliberately return a generic 404-style result.
     */

    notFound();
  }

  /*
   * ---------------------------------------------------------
   * ADDITIONAL DATABASE-LEVEL CHECK
   * ---------------------------------------------------------
   *
   * Re-verify the user belongs to the same firm and remains
   * active in the database.
   *
   * This prevents relying solely on stale session information.
   */

  const financeUser =
    await prisma.user.findFirst({
      where: {
        id: session.user.id,
        firmId: session.user.firmId,
        role: "FINANCE",
        status: "ACTIVE",
      },

      select: {
        id: true,
        firmId: true,
        role: true,
        status: true,
      },
    });

  if (!financeUser) {
    try {
      await createAuditLog({
        request,
        firmId: session.user.firmId,
        userId: session.user.id,
        action: "READ",
        entityType: "FinanceSecurity",
        description:
          "Finance workspace access was denied because the authenticated database user was not an active Finance user.",
        metadata: {
          event:
            "FINANCE_PAGE_DATABASE_AUTHORIZATION_FAILED",
          requestedPath:
            "/dashboard/finance",
          sessionRole:
            session.user.role,
        },
      });
    } catch (auditError) {
      console.error(
        "FINANCE PAGE: Failed to create authorization audit log.",
        auditError,
      );
    }

    notFound();
  }

  /*
   * ---------------------------------------------------------
   * AUTHORIZED
   * ---------------------------------------------------------
   */

  return <FinanceWorkspace />;
}