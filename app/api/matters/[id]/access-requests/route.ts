import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions-server";
import { hasPermission } from "@/lib/permissions";
import { userCanAccessMatter } from "@/lib/matter-access";
import { createAuditLog } from "@/lib/audit";
import { createNotifications } from "@/lib/notifications";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const REVIEWER_ROLES = [
  "SUPER_ADMIN",
  "MANAGING_PARTNER",
  "PARTNER",
  "DIRECTOR",
  "ATTORNEY",
  "ADMIN",
] as const;

/**
 * GET
 *
 * Allows an authorised reviewer to view access requests
 * for a matter.
 */
export async function GET(
  request: Request,
  context: RouteContext,
) {
  try {
    const permissionResult =
      await requirePermission("matters.manage_users");

    if (!permissionResult.authorized) {
      return permissionResult.response;
    }

    const { session } = permissionResult;

    const userId = session.user.id;
    const firmId = session.user.firmId;
    const sessionRole = session.user.role;

    if (!userId || !firmId || !sessionRole) {
      return NextResponse.json(
        { error: "Invalid session." },
        { status: 401 },
      );
    }

    /*
     * Verify that the reviewer is an active member
     * of the firm and has an authorised reviewer role.
     *
     * IMPORTANT:
     * The database role is authoritative.
     * We do not use the potentially stale JWT role
     * for the reviewer authorization decision.
     */
    const reviewer = await prisma.user.findFirst({
      where: {
        id: userId,
        firmId,
        status: "ACTIVE",
        role: {
          in: [...REVIEWER_ROLES],
        },
      },
      select: {
        id: true,
        role: true,
      },
    });

    if (!reviewer) {
      return NextResponse.json(
        {
          error:
            "Your user account is not authorised to review requests.",
        },
        { status: 403 },
      );
    }

    /*
     * Use the current database role from this point onward.
     */
    const role = reviewer.role;

    const { id: matterId } = await context.params;

    if (!matterId) {
      return NextResponse.json(
        {
          error: "Matter ID is required.",
        },
        { status: 400 },
      );
    }

    /*
     * Firm isolation:
     * The matter must belong to the authenticated
     * reviewer's firm.
     */
    const matter = await prisma.matter.findFirst({
      where: {
        id: matterId,
        firmId,
      },
      select: {
        id: true,
        referenceNumber: true,
        title: true,
        status: true,
      },
    });

    if (!matter) {
      return NextResponse.json(
        {
          error: "Matter not found.",
        },
        { status: 404 },
      );
    }

    /*
     * The reviewer must have access to this matter.
     *
     * The current database role is supplied to the
     * matter-access authorization function.
     */
    const hasMatterAccess = await userCanAccessMatter({
      matterId,
      userId,
      firmId,
      role,
    });

    if (!hasMatterAccess) {
      return NextResponse.json(
        {
          error:
            "You do not have access to review requests for this matter.",
        },
        { status: 403 },
      );
    }

    /*
     * Return requests belonging to this matter and firm.
     */
    const accessRequests =
      await prisma.matterAccessRequest.findMany({
        where: {
          matterId,
          firmId,
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          reason: true,
          status: true,
          reviewerComment: true,
          reviewedAt: true,
          createdAt: true,
          updatedAt: true,
          requester: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          reviewedBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      });

    /*
     * Record successful viewing of access requests.
     */
    await createAuditLog({
      request,
      firmId,
      userId,
      action: "READ",
      entityType: "MatterAccessRequest",
      entityId: matterId,
      description: `Viewed access requests for matter ${matter.referenceNumber}.`,
      metadata: {
        matterId: matter.id,
        matterReference: matter.referenceNumber,
        requestCount: accessRequests.length,
      },
    });

    return NextResponse.json({
      matter: {
        id: matter.id,
        referenceNumber: matter.referenceNumber,
        title: matter.title,
        status: matter.status,
      },
      requests: accessRequests,
    });
  } catch (error) {
    console.error(
      "GET /api/matters/[id]/access-requests error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "An unexpected error occurred while loading access requests.",
      },
      { status: 500 },
    );
  }
}

/**
 * POST
 *
 * Allows a Candidate Attorney to request access to a matter.
 *
 * Important:
 * - The request does NOT grant access.
 * - The matter must belong to the requester's firm.
 * - The requester must be an active firm user.
 * - The requester must not already have access.
 * - Only one PENDING request is allowed at a time.
 */
export async function POST(
  request: Request,
  context: RouteContext,
) {
  try {
    /*
     * The requester must have permission to view matters.
     */
    const permissionResult =
      await requirePermission("matters.view");

    if (!permissionResult.authorized) {
      return permissionResult.response;
    }

    const { session } = permissionResult;

    const userId = session.user.id;
    const firmId = session.user.firmId;
    const sessionRole = session.user.role;

    if (!userId || !firmId || !sessionRole) {
      return NextResponse.json(
        { error: "Invalid session." },
        { status: 401 },
      );
    }

    /*
     * Verify the requester directly against the database.
     *
     * The database role is authoritative.
     *
     * This endpoint is intentionally restricted to
     * Candidate Attorneys.
     *
     * Having matters.view permission alone is NOT enough.
     */
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        firmId,
        status: "ACTIVE",
        role: "CANDIDATE_ATTORNEY",
      },
      select: {
        id: true,
        name: true,
        email: true,
        firmId: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          error:
            "Only active Candidate Attorneys can submit matter access requests.",
        },
        { status: 403 },
      );
    }

    /*
     * Safely parse the request body.
     */
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          error: "Invalid request body.",
        },
        { status: 400 },
      );
    }

    /*
     * Extract and validate the reason from untrusted input.
     */
    const reason =
      typeof body === "object" &&
      body !== null &&
      "reason" in body &&
      typeof (body as { reason?: unknown }).reason ===
        "string"
        ? (
            body as {
              reason: string;
            }
          ).reason.trim()
        : "";

    if (!reason) {
      return NextResponse.json(
        {
          error:
            "Please provide a reason for requesting access.",
        },
        { status: 400 },
      );
    }

    if (reason.length < 5) {
      return NextResponse.json(
        {
          error:
            "The reason for requesting access must be at least 5 characters.",
        },
        { status: 400 },
      );
    }

    if (reason.length > 2000) {
      return NextResponse.json(
        {
          error:
            "The reason for requesting access cannot exceed 2000 characters.",
        },
        { status: 400 },
      );
    }

    const { id: matterId } = await context.params;

    if (!matterId) {
      return NextResponse.json(
        {
          error: "Matter ID is required.",
        },
        { status: 400 },
      );
    }

    /*
     * Firm isolation:
     * The matter must belong to the authenticated
     * Candidate Attorney's firm.
     */
    const matter = await prisma.matter.findFirst({
      where: {
        id: matterId,
        firmId,
      },
      select: {
        id: true,
        referenceNumber: true,
        title: true,
        status: true,
      },
    });

    if (!matter) {
      return NextResponse.json(
        {
          error: "Matter not found.",
        },
        { status: 404 },
      );
    }

    /*
     * Archived matters cannot receive new access requests.
     */
    if (matter.status === "ARCHIVED") {
      return NextResponse.json(
        {
          error:
            "Access cannot be requested for an archived matter.",
        },
        { status: 400 },
      );
    }

    /*
     * A Candidate Attorney who already has access
     * cannot submit another access request.
     *
     * IMPORTANT:
     * Use the current database role, not the JWT role.
     */
    const alreadyHasAccess =
      await userCanAccessMatter({
        matterId: matter.id,
        userId,
        firmId,
        role: user.role,
      });

    if (alreadyHasAccess) {
      return NextResponse.json(
        {
          error:
            "You already have access to this matter.",
        },
        { status: 409 },
      );
    }

    /*
     * Check whether a pending request already exists.
     *
     * This is an early application-level check for
     * a friendly 409 response.
     *
     * The database UNIQUE partial index is the final
     * protection against concurrent duplicate requests.
     */
    const existingRequest =
      await prisma.matterAccessRequest.findFirst({
        where: {
          matterId: matter.id,
          firmId,
          requesterId: userId,
          status: "PENDING",
        },
        select: {
          id: true,
          createdAt: true,
        },
      });

    if (existingRequest) {
      return NextResponse.json(
        {
          error:
            "You already have a pending access request for this matter.",
          requestId: existingRequest.id,
        },
        { status: 409 },
      );
    }

    /*
     * IMPORTANT:
     *
     * Creating an access request does NOT create
     * MatterUser access.
     *
     * The database unique index protects this operation
     * against concurrent duplicate PENDING requests.
     */
    let accessRequest;

    try {
      accessRequest =
        await prisma.matterAccessRequest.create({
          data: {
            firmId,
            matterId: matter.id,
            requesterId: userId,
            reason,
            status: "PENDING",
          },
          select: {
            id: true,
            status: true,
            createdAt: true,
          },
        });
    } catch (error) {
      /*
       * The partial unique index may reject a concurrent
       * duplicate PENDING request.
       *
       * Return a safe conflict response instead of exposing
       * a database error to the client.
       */
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: unknown }).code ===
          "P2002"
      ) {
        const concurrentRequest =
          await prisma.matterAccessRequest.findFirst({
            where: {
              matterId: matter.id,
              firmId,
              requesterId: userId,
              status: "PENDING",
            },
            select: {
              id: true,
            },
          });

        return NextResponse.json(
          {
            error:
              "You already have a pending access request for this matter.",
            ...(concurrentRequest
              ? {
                  requestId:
                    concurrentRequest.id,
                }
              : {}),
          },
          { status: 409 },
        );
      }

      throw error;
    }

    /*
     * Find potential reviewers in the same firm.
     */
    const potentialReviewers =
      await prisma.user.findMany({
        where: {
          firmId,
          status: "ACTIVE",
          role: {
            in: [...REVIEWER_ROLES],
          },
          id: {
            not: userId,
          },
        },
        select: {
          id: true,
          role: true,
        },
      });

    /*
     * Only users who actually have
     * matters.manage_users can receive
     * the notification.
     */
    const reviewers =
      potentialReviewers.filter(
        (reviewer) =>
          hasPermission(
            reviewer.role,
            "matters.manage_users",
          ),
      );

    /*
     * Notify authorised reviewers using the
     * centralized notification service.
     *
     * The helper re-validates that recipients are
     * active users belonging to this same firm.
     */
    try {
      if (reviewers.length > 0) {
        await createNotifications({
          firmId,
          userIds: reviewers.map(
            (reviewer) => reviewer.id,
          ),
          type: "MATTER",
          title:
            "Matter access request",
          message:
            `${user.name} has requested access to matter ${matter.referenceNumber}.`,
        });
      }
    } catch (notificationError) {
      /*
       * Notification failure must never cause the
       * access request itself to fail.
       */
      console.error(
        "MATTER ACCESS REQUEST NOTIFICATION ERROR:",
        notificationError,
      );
    }

    /*
     * Audit the creation of the access request.
     */
    await createAuditLog({
      request,
      firmId,
      userId,
      action: "CREATE",
      entityType: "MatterAccessRequest",
      entityId: accessRequest.id,
      description: `Requested access to matter ${matter.referenceNumber}.`,
      metadata: {
        matterId: matter.id,
        matterReference:
          matter.referenceNumber,
        requesterRole:
          user.role,
        status: "PENDING",
      },
    });

    return NextResponse.json(
      {
        message:
          "Your access request has been submitted successfully.",
        request: accessRequest,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(
      "POST /api/matters/[id]/access-requests error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "An unexpected error occurred while submitting the access request.",
      },
      { status: 500 },
    );
  }
}