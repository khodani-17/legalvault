import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions-server";
import { hasPermission } from "@/lib/permissions";
import {
  canAccessAllFirmMatters,
  userCanAccessMatter,
} from "@/lib/matter-access";
import { createNotification } from "@/lib/notifications";

type RouteContext = {
  params: Promise<{
    id: string;
    requestId: string;
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

function isReviewerRole(role: string): boolean {
  return REVIEWER_ROLES.includes(
    role as (typeof REVIEWER_ROLES)[number],
  );
}

type ReviewAction = "APPROVE" | "REJECT";

type ReviewBody = {
  action?: ReviewAction;
  reviewerComment?: string;
  canView?: boolean;
  canUpload?: boolean;
  canDownload?: boolean;
  canDelete?: boolean;
  canManage?: boolean;
};

export async function PATCH(
  request: Request,
  context: RouteContext,
) {
  try {
    // ========================================================
    // CENTRALIZED AUTHENTICATION + RBAC
    // ========================================================

    const permissionResult =
      await requirePermission("matters.manage_users");

    if (!permissionResult.authorized) {
      return permissionResult.response;
    }

    const { session } = permissionResult;

    const reviewerId = session.user.id;
    const firmId = session.user.firmId;

    if (!reviewerId || !firmId) {
      return NextResponse.json(
        { error: "Invalid session." },
        { status: 401 },
      );
    }

    // ========================================================
    // VERIFY ACTIVE REVIEWER
    // ========================================================

    const reviewer = await prisma.user.findFirst({
      where: {
        id: reviewerId,
        firmId,
        status: "ACTIVE",
        role: {
          in: [...REVIEWER_ROLES],
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
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
     * The database role is authoritative.
     */
    const role = reviewer.role;

    // ========================================================
    // REVIEWER ROLE
    // ========================================================

    if (!isReviewerRole(role)) {
      return NextResponse.json(
        {
          error:
            "You are not authorised to review matter access requests.",
        },
        { status: 403 },
      );
    }

    /*
     * Defence in depth.
     */
    if (!hasPermission(role, "matters.manage_users")) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to manage matter access.",
        },
        { status: 403 },
      );
    }

    // ========================================================
    // ROUTE PARAMETERS
    // ========================================================

    const {
      id: matterId,
      requestId,
    } = await context.params;

    if (!matterId || !requestId) {
      return NextResponse.json(
        {
          error:
            "Matter ID and request ID are required.",
        },
        { status: 400 },
      );
    }

    // ========================================================
    // REQUEST BODY
    // ========================================================

    let body: ReviewBody;

    try {
      const parsedBody: unknown =
        await request.json();

      if (
        typeof parsedBody !== "object" ||
        parsedBody === null
      ) {
        return NextResponse.json(
          {
            error: "Invalid request body.",
          },
          { status: 400 },
        );
      }

      body = parsedBody as ReviewBody;
    } catch {
      return NextResponse.json(
        {
          error: "Invalid JSON request.",
        },
        { status: 400 },
      );
    }

    const action = body.action;

    if (
      action !== "APPROVE" &&
      action !== "REJECT"
    ) {
      return NextResponse.json(
        {
          error:
            'Action must be either "APPROVE" or "REJECT".',
        },
        { status: 400 },
      );
    }

    const reviewerComment =
      typeof body.reviewerComment === "string"
        ? body.reviewerComment.trim()
        : "";

    if (reviewerComment.length > 2000) {
      return NextResponse.json(
        {
          error:
            "Reviewer comment cannot exceed 2000 characters.",
        },
        { status: 400 },
      );
    }

    // ========================================================
    // FIND ACCESS REQUEST
    // ========================================================

    const accessRequest =
      await prisma.matterAccessRequest.findFirst({
        where: {
          id: requestId,
          matterId,
          firmId,
        },
        include: {
          matter: {
            select: {
              id: true,
              referenceNumber: true,
              title: true,
              status: true,
              firmId: true,
            },
          },
          requester: {
            select: {
              id: true,
              name: true,
              email: true,
              status: true,
              firmId: true,
              role: true,
            },
          },
        },
      });

    if (!accessRequest) {
      return NextResponse.json(
        {
          error: "Access request not found.",
        },
        { status: 404 },
      );
    }

    // ========================================================
    // DEFENSIVE TENANT VALIDATION
    // ========================================================

    if (
      accessRequest.firmId !== firmId ||
      accessRequest.matter.firmId !== firmId ||
      accessRequest.requester.firmId !== firmId
    ) {
      return NextResponse.json(
        {
          error: "Access request not found.",
        },
        { status: 404 },
      );
    }

    // ========================================================
    // PREVENT SELF-APPROVAL / SELF-REJECTION
    // ========================================================

    if (
      accessRequest.requesterId === reviewerId
    ) {
      return NextResponse.json(
        {
          error:
            "You cannot review your own matter access request.",
        },
        { status: 403 },
      );
    }

    // ========================================================
    // REQUEST STATUS
    // ========================================================

    if (accessRequest.status !== "PENDING") {
      return NextResponse.json(
        {
          error:
            "This access request has already been reviewed.",
          status: accessRequest.status,
        },
        { status: 409 },
      );
    }

    // ========================================================
    // REQUESTER STATUS
    // ========================================================

    if (
      accessRequest.requester.status !== "ACTIVE"
    ) {
      return NextResponse.json(
        {
          error:
            "The requesting user's account is no longer active.",
        },
        { status: 400 },
      );
    }

    // ========================================================
    // REQUESTER ROLE
    // ========================================================

    if (
      accessRequest.requester.role !==
      "CANDIDATE_ATTORNEY"
    ) {
      return NextResponse.json(
        {
          error:
            "This access request was not submitted by a Candidate Attorney.",
        },
        { status: 400 },
      );
    }

    // ========================================================
    // REVIEWER MATTER ACCESS
    // ========================================================

    const canAccess = await userCanAccessMatter({
      matterId,
      userId: reviewerId,
      firmId,
      role,
    });

    if (!canAccess) {
      return NextResponse.json(
        {
          error:
            "You are not authorised to review access requests for this matter.",
        },
        { status: 403 },
      );
    }

    // ========================================================
    // ARCHIVED MATTER
    // ========================================================

    if (
      accessRequest.matter.status ===
      "ARCHIVED"
    ) {
      return NextResponse.json(
        {
          error:
            "Access cannot be granted on an archived matter.",
        },
        { status: 400 },
      );
    }

    // ========================================================
    // REJECT REQUEST
    // ========================================================

    if (action === "REJECT") {
      const result =
        await prisma.$transaction(
          async (tx) => {
            // ------------------------------------------------
            // RE-CHECK REQUEST
            // ------------------------------------------------

            const currentRequest =
              await tx.matterAccessRequest.findFirst({
                where: {
                  id: accessRequest.id,
                  matterId,
                  firmId,
                },
                select: {
                  id: true,
                  status: true,
                  requesterId: true,
                  matterId: true,
                  firmId: true,
                },
              });

            if (
              !currentRequest ||
              currentRequest.status !== "PENDING"
            ) {
              throw new Error(
                "REQUEST_ALREADY_REVIEWED",
              );
            }

            // ------------------------------------------------
            // DEFENSIVE TENANT CHECK
            // ------------------------------------------------

            if (
              currentRequest.firmId !== firmId ||
              currentRequest.matterId !== matterId
            ) {
              throw new Error(
                "REQUEST_NOT_FOUND",
              );
            }

            // ------------------------------------------------
            // RE-CHECK REVIEWER
            // ------------------------------------------------

            const currentReviewer =
              await tx.user.findFirst({
                where: {
                  id: reviewerId,
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

            if (
              !currentReviewer ||
              !isReviewerRole(
                currentReviewer.role,
              ) ||
              !hasPermission(
                currentReviewer.role,
                "matters.manage_users",
              )
            ) {
              throw new Error(
                "REVIEWER_NOT_AUTHORISED",
              );
            }

            // ------------------------------------------------
            // RE-CHECK REVIEWER MATTER ACCESS
            // ------------------------------------------------

            const reviewerHasFirmWideAccess =
              canAccessAllFirmMatters(
                currentReviewer.role,
              );

            if (!reviewerHasFirmWideAccess) {
              const reviewerMatterAccess =
                await tx.matterUser.findFirst({
                  where: {
                    matterId,
                    userId: reviewerId,
                    canView: true,
                  },
                  select: {
                    id: true,
                  },
                });

              if (!reviewerMatterAccess) {
                throw new Error(
                  "REVIEWER_MATTER_ACCESS_REVOKED",
                );
              }
            }

            // ------------------------------------------------
            // RE-CHECK REQUESTER
            // ------------------------------------------------

            const requester =
              await tx.user.findFirst({
                where: {
                  id:
                    currentRequest.requesterId,
                  firmId,
                  status: "ACTIVE",
                },
                select: {
                  id: true,
                  role: true,
                },
              });

            if (!requester) {
              throw new Error(
                "REQUESTER_NOT_ACTIVE",
              );
            }

            if (
              requester.role !==
              "CANDIDATE_ATTORNEY"
            ) {
              throw new Error(
                "INVALID_REQUESTER_ROLE",
              );
            }

            // ------------------------------------------------
            // UPDATE REQUEST
            // ------------------------------------------------

            const updatedRequest =
              await tx.matterAccessRequest.update({
                where: {
                  id: currentRequest.id,
                },
                data: {
                  status: "REJECTED",
                  reviewedById: reviewerId,
                  reviewerComment:
                    reviewerComment || null,
                  reviewedAt: new Date(),
                },
                select: {
                  id: true,
                  status: true,
                  reviewerComment: true,
                  reviewedAt: true,
                },
              });

            // ------------------------------------------------
            // AUDIT
            // ------------------------------------------------

            await tx.auditLog.create({
              data: {
                firmId,
                userId: reviewerId,
                action: "UPDATE",
                entityType:
                  "MatterAccessRequest",
                entityId:
                  currentRequest.id,
                description:
                  `Rejected access request for matter ${accessRequest.matter.referenceNumber} submitted by ${accessRequest.requester.name}.`,
                metadata: {
                  matterId,
                  matterReference:
                    accessRequest.matter
                      .referenceNumber,
                  requesterId:
                    currentRequest.requesterId,
                  requesterRole:
                    requester.role,
                  action: "REJECT",
                  reviewerId,
                  reviewerRole:
                    currentReviewer.role,
                  reviewerComment:
                    reviewerComment || null,
                },
              },
            });

            return {
              request: updatedRequest,
              requesterId:
                currentRequest.requesterId,
            };
          },
        );

      // ------------------------------------------------------
      // NOTIFY REQUESTER
      // ------------------------------------------------------
      //
      // Notification is deliberately outside the transaction.
      // A notification failure must never roll back the
      // security-sensitive access-request decision.
      // ------------------------------------------------------

      try {
        if (
          result.requesterId &&
          result.requesterId !== reviewerId
        ) {
          await createNotification({
            firmId,
            userId: result.requesterId,
            type: "MATTER",
            title:
              "Matter access request rejected",
            message: `Your request for access to matter ${accessRequest.matter.referenceNumber} has been rejected.`,
          });
        }
      } catch (notificationError) {
        console.error(
          "MATTER ACCESS REJECTION NOTIFICATION ERROR:",
          notificationError,
        );
      }

      return NextResponse.json({
        message:
          "The matter access request has been rejected.",
        request: result.request,
      });
    }

    // ========================================================
    // APPROVE REQUEST
    // ========================================================

    /*
     * View access is mandatory.
     */
    const canView = body.canView === true;

    if (!canView) {
      return NextResponse.json(
        {
          error:
            "View permission must be granted when approving a matter access request.",
        },
        { status: 400 },
      );
    }

    const canUpload =
      body.canUpload === true;

    const canDownload =
      body.canDownload === true;

    /*
     * SECURITY CONTROL:
     *
     * Candidate Attorneys cannot receive deletion
     * permission through this approval workflow.
     */
    const canDelete = false;

    /*
     * SECURITY CONTROL:
     *
     * Candidate Attorneys cannot receive matter-management
     * permission through this approval workflow.
     */
    const canManage = false;

    // ========================================================
    // APPROVE TRANSACTION
    // ========================================================

    const result =
      await prisma.$transaction(
        async (tx) => {
          // ------------------------------------------------
          // RE-CHECK REQUEST
          // ------------------------------------------------

          const currentRequest =
            await tx.matterAccessRequest.findFirst({
              where: {
                id: accessRequest.id,
                matterId,
                firmId,
              },
              select: {
                id: true,
                status: true,
                requesterId: true,
                matterId: true,
                firmId: true,
              },
            });

          if (
            !currentRequest ||
            currentRequest.status !== "PENDING"
          ) {
            throw new Error(
              "REQUEST_ALREADY_REVIEWED",
            );
          }

          // ------------------------------------------------
          // DEFENSIVE TENANT CHECK
          // ------------------------------------------------

          if (
            currentRequest.firmId !== firmId ||
            currentRequest.matterId !== matterId
          ) {
            throw new Error(
              "REQUEST_NOT_FOUND",
            );
          }

          // ------------------------------------------------
          // RE-CHECK REVIEWER
          // ------------------------------------------------

          const currentReviewer =
            await tx.user.findFirst({
              where: {
                id: reviewerId,
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

          if (
            !currentReviewer ||
            !isReviewerRole(
              currentReviewer.role,
            ) ||
            !hasPermission(
              currentReviewer.role,
              "matters.manage_users",
            )
          ) {
            throw new Error(
              "REVIEWER_NOT_AUTHORISED",
            );
          }

          // ------------------------------------------------
          // RE-CHECK REVIEWER MATTER ACCESS
          // ------------------------------------------------

          const reviewerHasFirmWideAccess =
            canAccessAllFirmMatters(
              currentReviewer.role,
            );

          if (!reviewerHasFirmWideAccess) {
            const reviewerMatterAccess =
              await tx.matterUser.findFirst({
                where: {
                  matterId,
                  userId: reviewerId,
                  canView: true,
                },
                select: {
                  id: true,
                },
              });

            if (!reviewerMatterAccess) {
              throw new Error(
                "REVIEWER_MATTER_ACCESS_REVOKED",
              );
            }
          }

          // ------------------------------------------------
          // RE-CHECK REQUESTER
          // ------------------------------------------------

          const requester =
            await tx.user.findFirst({
              where: {
                id:
                  currentRequest.requesterId,
                firmId,
                status: "ACTIVE",
              },
              select: {
                id: true,
                role: true,
              },
            });

          if (!requester) {
            throw new Error(
              "REQUESTER_NOT_ACTIVE",
            );
          }

          if (
            requester.role !==
            "CANDIDATE_ATTORNEY"
          ) {
            throw new Error(
              "INVALID_REQUESTER_ROLE",
            );
          }

          // ------------------------------------------------
          // RE-CHECK MATTER
          // ------------------------------------------------

          const matter =
            await tx.matter.findFirst({
              where: {
                id: matterId,
                firmId,
              },
              select: {
                id: true,
                status: true,
              },
            });

          if (!matter) {
            throw new Error(
              "MATTER_NOT_FOUND",
            );
          }

          if (
            matter.status === "ARCHIVED"
          ) {
            throw new Error(
              "MATTER_ARCHIVED",
            );
          }

          // ------------------------------------------------
          // CREATE / UPDATE MATTER ACCESS
          // ------------------------------------------------

          const assignment =
            await tx.matterUser.upsert({
              where: {
                matterId_userId: {
                  matterId,
                  userId:
                    currentRequest.requesterId,
                },
              },

              create: {
                matterId,
                userId:
                  currentRequest.requesterId,
                canView,
                canUpload,
                canDownload,
                canDelete,
                canManage,
              },

              update: {
                canView,
                canUpload,
                canDownload,
                canDelete,
                canManage,
              },

              select: {
                id: true,
                canView: true,
                canUpload: true,
                canDownload: true,
                canDelete: true,
                canManage: true,
              },
            });

          // ------------------------------------------------
          // MARK REQUEST APPROVED
          // ------------------------------------------------

          const updatedRequest =
            await tx.matterAccessRequest.update({
              where: {
                id: currentRequest.id,
              },

              data: {
                status: "APPROVED",
                reviewedById: reviewerId,
                reviewerComment:
                  reviewerComment || null,
                reviewedAt: new Date(),
              },

              select: {
                id: true,
                status: true,
                reviewerComment: true,
                reviewedAt: true,
              },
            });

          // ------------------------------------------------
          // AUDIT APPROVAL
          // ------------------------------------------------

          await tx.auditLog.create({
            data: {
              firmId,
              userId: reviewerId,
              action: "UPDATE",
              entityType:
                "MatterAccessRequest",
              entityId:
                currentRequest.id,
              description:
                `Approved access request for matter ${accessRequest.matter.referenceNumber} submitted by ${accessRequest.requester.name}.`,
              metadata: {
                matterId,
                matterReference:
                  accessRequest.matter
                    .referenceNumber,
                requesterId:
                  currentRequest.requesterId,
                requesterRole:
                  requester.role,
                action: "APPROVE",
                reviewerId,
                reviewerRole:
                  currentReviewer.role,
                permissions: {
                  canView,
                  canUpload,
                  canDownload,
                  canDelete,
                  canManage,
                },
                reviewerComment:
                  reviewerComment || null,
              },
            },
          });

          return {
            request: updatedRequest,
            assignment,
            requesterId:
              currentRequest.requesterId,
          };
        },
      );

    // --------------------------------------------------------
    // NOTIFY REQUESTER
    // --------------------------------------------------------
    //
    // Notification is deliberately outside the transaction.
    // Access has already been granted successfully.
    // --------------------------------------------------------

    try {
      if (
        result.requesterId &&
        result.requesterId !== reviewerId
      ) {
        await createNotification({
          firmId,
          userId: result.requesterId,
          type: "MATTER",
          title:
            "Matter access request approved",
          message: `Your request for access to matter ${accessRequest.matter.referenceNumber} has been approved.`,
        });
      }
    } catch (notificationError) {
      console.error(
        "MATTER ACCESS APPROVAL NOTIFICATION ERROR:",
        notificationError,
      );
    }

    return NextResponse.json({
      message:
        "The matter access request has been approved and access has been granted.",
      request: result.request,
      assignment: result.assignment,
    });
  } catch (error) {
    // ========================================================
    // EXPECTED CONCURRENCY FAILURE
    // ========================================================

    if (
      error instanceof Error &&
      error.message ===
        "REQUEST_ALREADY_REVIEWED"
    ) {
      return NextResponse.json(
        {
          error:
            "This access request has already been reviewed.",
        },
        { status: 409 },
      );
    }

    // ========================================================
    // EXPECTED SECURITY FAILURE
    // ========================================================

    if (
      error instanceof Error &&
      error.message ===
        "REVIEWER_NOT_AUTHORISED"
    ) {
      return NextResponse.json(
        {
          error:
            "You are no longer authorised to review this access request.",
        },
        { status: 403 },
      );
    }

    // ========================================================
    // REVIEWER MATTER ACCESS REVOKED
    // ========================================================

    if (
      error instanceof Error &&
      error.message ===
        "REVIEWER_MATTER_ACCESS_REVOKED"
    ) {
      return NextResponse.json(
        {
          error:
            "You no longer have access to review requests for this matter.",
        },
        { status: 403 },
      );
    }

    // ========================================================
    // REQUEST NOT FOUND
    // ========================================================

    if (
      error instanceof Error &&
      error.message ===
        "REQUEST_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          error:
            "Access request not found.",
        },
        { status: 404 },
      );
    }

    // ========================================================
    // REQUESTER NO LONGER ACTIVE
    // ========================================================

    if (
      error instanceof Error &&
      error.message ===
        "REQUESTER_NOT_ACTIVE"
    ) {
      return NextResponse.json(
        {
          error:
            "The requesting user's account is no longer active.",
        },
        { status: 400 },
      );
    }

    // ========================================================
    // INVALID REQUESTER ROLE
    // ========================================================

    if (
      error instanceof Error &&
      error.message ===
        "INVALID_REQUESTER_ROLE"
    ) {
      return NextResponse.json(
        {
          error:
            "This access request is no longer valid.",
        },
        { status: 400 },
      );
    }

    // ========================================================
    // MATTER NOT FOUND
    // ========================================================

    if (
      error instanceof Error &&
      error.message ===
        "MATTER_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          error: "Matter not found.",
        },
        { status: 404 },
      );
    }

    // ========================================================
    // ARCHIVED MATTER
    // ========================================================

    if (
      error instanceof Error &&
      error.message ===
        "MATTER_ARCHIVED"
    ) {
      return NextResponse.json(
        {
          error:
            "Access cannot be granted on an archived matter.",
        },
        { status: 400 },
      );
    }

    // ========================================================
    // GENERIC SERVER ERROR
    // ========================================================

    console.error(
      "PATCH /api/matters/[id]/access-requests/[requestId] error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "An unexpected error occurred while reviewing the access request.",
      },
      { status: 500 },
    );
  }
}