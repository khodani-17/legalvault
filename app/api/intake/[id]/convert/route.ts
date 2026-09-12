import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  AuditAction,
  ClientType,
  IntakeStatus,
  MatterStatus,
} from "@/src/generated/prisma/client";

const CONVERT_ROLES = [
  "SUPER_ADMIN",
  "MANAGING_PARTNER",
  "PARTNER",
  "DIRECTOR",
  "ATTORNEY",
  "CANDIDATE_ATTORNEY",
  "PARALEGAL",
 ];

function generateReference(prefix: string) {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random()
    .toString(36)
    .substring(2, 8)
    .toUpperCase();

  return `${prefix}-${timestamp}-${random}`;
}

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

    if (!CONVERT_ROLES.includes(user.role)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You are not authorised to convert legal intakes into matters.",
        },
        { status: 403 }
      );
    }

    const intake = await prisma.matterIntake.findFirst({
      where: {
        id,
        firmId: user.firmId,
      },
      include: {
        client: true,
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
            "This legal intake has already been converted into a matter.",
        },
        { status: 409 }
      );
    }

    if (intake.status !== IntakeStatus.APPROVED) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Only an approved legal intake can be converted into a matter.",
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
            "A conflict check is required before this intake can be converted.",
        },
        { status: 409 }
      );
    }

    if (
      intake.conflictCheckRequired &&
      latestConflictCheck &&
      !latestConflictCheck.reviewedAt
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "The conflict check must be reviewed before the intake can be converted.",
        },
        { status: 409 }
      );
    }

    const result = await prisma.$transaction(
      async (tx) => {
        /*
         * Re-check the intake inside the transaction.
         * This protects against another conversion happening
         * between the initial validation and this transaction.
         */
        const currentIntake = await tx.matterIntake.findFirst({
          where: {
            id: intake.id,
            firmId: user.firmId,
          },
          include: {
            client: true,
          },
        });

        if (!currentIntake) {
          throw new Error("Legal intake no longer exists.");
        }

        if (currentIntake.status === IntakeStatus.CONVERTED) {
          throw new Error(
            "This legal intake has already been converted."
          );
        }

        if (currentIntake.status !== IntakeStatus.APPROVED) {
          throw new Error(
            "Only an approved intake can be converted."
          );
        }

        let client = currentIntake.client;

        /*
         * If there is no linked client, create one from
         * the intake information.
         */
        if (!client) {
          let clientReference = generateReference("CLI");

          let existingClient = await tx.client.findUnique({
            where: {
              firmId_referenceNumber: {
                firmId: user.firmId,
                referenceNumber: clientReference,
              },
            },
          });

          while (existingClient) {
            clientReference = generateReference("CLI");

            existingClient = await tx.client.findUnique({
              where: {
                firmId_referenceNumber: {
                  firmId: user.firmId,
                  referenceNumber: clientReference,
                },
              },
            });
          }

          client = await tx.client.create({
            data: {
              firmId: user.firmId,
              referenceNumber: clientReference,
              type: ClientType.INDIVIDUAL,
              name: currentIntake.prospectiveClientName,
              email: currentIntake.email,
              phone: currentIntake.phone,
              notes:
                "Client created automatically from Legal Intake.",
            },
          });
        }

        /*
         * Generate a unique matter reference.
         */
        let matterReference = generateReference("MAT");

        let existingMatter = await tx.matter.findUnique({
          where: {
            firmId_referenceNumber: {
              firmId: user.firmId,
              referenceNumber: matterReference,
            },
          },
        });

        while (existingMatter) {
          matterReference = generateReference("MAT");

          existingMatter = await tx.matter.findUnique({
            where: {
              firmId_referenceNumber: {
                firmId: user.firmId,
                referenceNumber: matterReference,
              },
            },
          });
        }

        const matterTitle = `${currentIntake.prospectiveClientName} - ${
          currentIntake.practiceArea || "Legal Matter"
        }`;

        const matter = await tx.matter.create({
          data: {
            firmId: user.firmId,
            clientId: client.id,
            intakeId: currentIntake.id,
            referenceNumber: matterReference,
            title: matterTitle,
            description: currentIntake.description,
            practiceArea: currentIntake.practiceArea,
            status: MatterStatus.OPEN,
          },
        });

        const updatedIntake = await tx.matterIntake.update({
          where: {
            id: currentIntake.id,
          },
          data: {
            status: IntakeStatus.CONVERTED,
          },
        });

        await tx.auditLog.create({
          data: {
            firmId: user.firmId,
            userId: user.id,
            action: AuditAction.CREATE,
            entityType: "Matter",
            entityId: matter.id,
            metadata: JSON.parse(
              JSON.stringify({
                action: "INTAKE_CONVERTED_TO_MATTER",
                intakeId: currentIntake.id,
                clientId: client.id,
                matterId: matter.id,
                matterReference: matter.referenceNumber,
              })
            ),
          },
        });

        await tx.auditLog.create({
          data: {
            firmId: user.firmId,
            userId: user.id,
            action: AuditAction.UPDATE,
            entityType: "MatterIntake",
            entityId: currentIntake.id,
            metadata: JSON.parse(
              JSON.stringify({
                action: "CONVERTED",
                previousStatus: currentIntake.status,
                newStatus: IntakeStatus.CONVERTED,
                clientId: client.id,
                matterId: matter.id,
              })
            ),
          },
        });

        return {
          intake: updatedIntake,
          client,
          matter,
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
        "Legal intake successfully converted into a matter.",
      data: result,
    });
  } catch (error) {
    console.error(
      "POST /api/intake/[id]/convert error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to convert the legal intake into a matter.",
      },
      { status: 500 }
    );
  }
}