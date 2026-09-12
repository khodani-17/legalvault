import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  AuditAction,
  IntakeStatus,
} from "@/src/generated/prisma/client";

const REVIEW_ROLES = [
  "SUPER_ADMIN",
  "MANAGING_PARTNER",
  "PARTNER",
  "DIRECTOR",
  "ATTORNEY",
];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json(
        {
          success: false,
          message: "Authentication required.",
        },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: {
        email: session.user.email,
      },
    });

    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json(
        {
          success: false,
          message: "Active user account required.",
        },
        { status: 403 }
      );
    }

    if (!REVIEW_ROLES.includes(user.role)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You are not authorised to review legal intake conflict checks.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    const action =
      typeof body.action === "string"
        ? body.action.trim().toUpperCase()
        : "";

    const notes =
      typeof body.notes === "string"
        ? body.notes.trim()
        : null;

    if (action !== "APPROVE" && action !== "REJECT") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid review action. Use APPROVE or REJECT.",
        },
        { status: 400 }
      );
    }

    const intake = await prisma.matterIntake.findFirst({
      where: {
        id,
        firmId: user.firmId,
      },
      include: {
        conflictChecks: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
    });

    if (!intake) {
      return NextResponse.json(
        {
          success: false,
          message: "Legal intake not found.",
        },
        { status: 404 }
      );
    }

    if (intake.status === IntakeStatus.CONVERTED) {
      return NextResponse.json(
        {
          success: false,
          message:
            "A converted intake cannot be reviewed again.",
        },
        { status: 409 }
      );
    }

    if (intake.status === IntakeStatus.CLOSED) {
      return NextResponse.json(
        {
          success: false,
          message:
            "A closed intake cannot be reviewed.",
        },
        { status: 409 }
      );
    }

    const latestConflictCheck = intake.conflictChecks[0];

    if (intake.conflictCheckRequired && !latestConflictCheck) {
      return NextResponse.json(
        {
          success: false,
          message:
            "A conflict check must be completed before the intake can be reviewed.",
        },
        { status: 409 }
      );
    }

    if (
      intake.conflictCheckRequired &&
      latestConflictCheck &&
      latestConflictCheck.status === "NOT_CHECKED"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "The conflict check has not been completed.",
        },
        { status: 409 }
      );
    }

    const newStatus =
      action === "APPROVE"
        ? IntakeStatus.APPROVED
        : IntakeStatus.REJECTED;

    const result = await prisma.$transaction(
      async (tx) => {
        let updatedConflictCheck = null;

        if (latestConflictCheck) {
          updatedConflictCheck =
            await tx.conflictCheck.update({
              where: {
                id: latestConflictCheck.id,
              },
              data: {
                reviewedById: user.id,
                reviewedAt: new Date(),
                notes: notes || null,
              },
              include: {
                checkedBy: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
                reviewedBy: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            });
        }

        const updatedIntake =
          await tx.matterIntake.update({
            where: {
              id: intake.id,
            },
            data: {
              status: newStatus,
            },
            include: {
              client: true,
              assignedTo: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
              conflictCheckedBy: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
              conflictChecks: {
                orderBy: {
                  createdAt: "desc",
                },
                take: 5,
                include: {
                  checkedBy: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                  reviewedBy: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                },
              },
            },
          });

        await tx.auditLog.create({
          data: {
            firmId: user.firmId,
            userId: user.id,
            action: AuditAction.UPDATE,
            entityType: "MatterIntake",
            entityId: intake.id,
            metadata: JSON.parse(
              JSON.stringify({
                action:
                  action === "APPROVE"
                    ? "CONFLICT_REVIEW_APPROVED"
                    : "CONFLICT_REVIEW_REJECTED",
                previousStatus: intake.status,
                newStatus,
                conflictCheckId:
                  latestConflictCheck?.id || null,
                notes: notes || null,
              })
            ),
          },
        });

        return {
          intake: updatedIntake,
          conflictCheck: updatedConflictCheck,
        };
      },
      {
        maxWait: 10000,
        timeout: 15000,
      }
    );

    return NextResponse.json({
      success: true,
      message:
        action === "APPROVE"
          ? "Legal intake approved successfully."
          : "Legal intake rejected successfully.",
      data: result,
    });
  } catch (error) {
    console.error(
      "POST /api/intake/[id]/review error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to complete the conflict review.",
      },
      { status: 500 }
    );
  }
}