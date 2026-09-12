import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import {
  AuditAction,
  ConflictCheckStatus,
  IntakeStatus,
  Prisma,
} from "@/src/generated/prisma/client";

const ALLOWED_ROLES = [
  "SUPER_ADMIN",
  "MANAGING_PARTNER",
  "PARTNER",
  "DIRECTOR",
  "ATTORNEY",
  "CANDIDATE_ATTORNEY",
  "PARALEGAL",
  "LEGAL_SECRETARY",
  "ADMIN",
] as const;

type AllowedRole = (typeof ALLOWED_ROLES)[number];

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type ConflictCheckBody = {
  additionalTerms?: unknown;
};

function normalizeTerm(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function uniqueTerms(values: unknown[]): string[] {
  const seen = new Set<string>();

  for (const value of values) {
    const term = normalizeTerm(value);

    if (!term) {
      continue;
    }

    const key = term.toLowerCase();

    if (!seen.has(key)) {
      seen.add(key);
    }
  }

  return Array.from(seen);
}

function isAllowedRole(role: string): role is AllowedRole {
  return ALLOWED_ROLES.includes(role as AllowedRole);
}

async function getAuthenticatedUser() {
  const session = await auth();

  if (!session?.user?.id || !session.user.email) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: "Unauthorized.",
        },
        { status: 401 }
      ),
    };
  }

  const user = await prisma.user.findFirst({
    where: {
      id: session.user.id,
      email: session.user.email,
      status: "ACTIVE",
    },
    select: {
      id: true,
      firmId: true,
      role: true,
      name: true,
      email: true,
    },
  });

  if (!user) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: "Active user account could not be found.",
        },
        { status: 401 }
      ),
    };
  }

  if (!user.firmId) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: "User is not associated with a firm.",
        },
        { status: 403 }
      ),
    };
  }

  if (!isAllowedRole(user.role)) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error:
            "You do not have permission to perform conflict checks.",
        },
        { status: 403 }
      ),
    };
  }

  return {
    user,
  };
}

/**
 * GET
 *
 * Retrieves the latest saved conflict check for an intake.
 *
 * This is used by the Review Conflict page.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const authResult = await getAuthenticatedUser();

    if (authResult.error) {
      return authResult.error;
    }

    const user = authResult.user;

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "Intake ID is required.",
        },
        { status: 400 }
      );
    }

    const intake = await prisma.matterIntake.findFirst({
      where: {
        id,
        firmId: user.firmId,
      },
      select: {
        id: true,
        prospectiveClientName: true,
        conflictCheckRequired: true,
        conflictStatus: true,
        status: true,
      },
    });

    if (!intake) {
      return NextResponse.json(
        {
          success: false,
          error: "Legal intake not found.",
        },
        { status: 404 }
      );
    }

    const latestCheck = await prisma.conflictCheck.findFirst({
      where: {
        firmId: user.firmId,
        intakeId: intake.id,
      },
      orderBy: {
        createdAt: "desc",
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

    if (!latestCheck) {
      return NextResponse.json({
        success: true,
        message: "No conflict check has been completed yet.",
        data: {
          conflictCheck: null,
          clients: [],
          matters: [],
          clientMatchCount: 0,
          matterMatchCount: 0,
          requiresHumanReview: false,
        },
      });
    }

    const [clients, matters] = await Promise.all([
      latestCheck.matchedClientIds.length > 0
        ? prisma.client.findMany({
            where: {
              firmId: user.firmId,
              id: {
                in: latestCheck.matchedClientIds,
              },
            },
            select: {
              id: true,
              name: true,
              referenceNumber: true,
              email: true,
              phone: true,
            },
            orderBy: {
              name: "asc",
            },
          })
        : Promise.resolve([]),

      latestCheck.matchedMatterIds.length > 0
        ? prisma.matter.findMany({
            where: {
              firmId: user.firmId,
              id: {
                in: latestCheck.matchedMatterIds,
              },
            },
            select: {
              id: true,
              referenceNumber: true,
              title: true,
              status: true,
              client: {
                select: {
                  id: true,
                  name: true,
                  referenceNumber: true,
                },
              },
            },
            orderBy: {
              updatedAt: "desc",
            },
          })
        : Promise.resolve([]),
    ]);

    return NextResponse.json({
      success: true,
      message: "Latest conflict check retrieved successfully.",
      data: {
        conflictCheck: latestCheck,
        clients,
        matters,
        searchTerms: latestCheck.searchTerms,
        matchedClientIds: latestCheck.matchedClientIds,
        matchedMatterIds: latestCheck.matchedMatterIds,
        clientMatchCount: clients.length,
        matterMatchCount: matters.length,
        requiresHumanReview:
          latestCheck.status !== ConflictCheckStatus.CLEAR,
        disclaimer:
          "A potential match does not by itself constitute a legal conflict. The results must be reviewed by an authorised member of the firm.",
      },
    });
  } catch (error) {
    console.error(
      "GET /api/intake/[id]/conflict-check error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Failed to retrieve conflict check.",
        message:
          "The conflict-check results could not be loaded.",
      },
      { status: 500 }
    );
  }
}

/**
 * POST
 *
 * Runs a new conflict check.
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const authResult = await getAuthenticatedUser();

    if (authResult.error) {
      return authResult.error;
    }

    const user = authResult.user;

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "Intake ID is required.",
        },
        { status: 400 }
      );
    }

    let body: ConflictCheckBody = {};

    try {
      body = (await request.json()) as ConflictCheckBody;
    } catch {
      body = {};
    }

    const intake = await prisma.matterIntake.findFirst({
      where: {
        id,
        firmId: user.firmId,
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            referenceNumber: true,
            email: true,
            phone: true,
            idNumber: true,
          },
        },
      },
    });

    if (!intake) {
      return NextResponse.json(
        {
          success: false,
          error: "Legal intake not found.",
        },
        { status: 404 }
      );
    }

    if (intake.status === IntakeStatus.CONVERTED) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This legal intake has already been converted into a matter and cannot be conflict checked again.",
        },
        { status: 409 }
      );
    }

    const additionalTerms = Array.isArray(body.additionalTerms)
      ? body.additionalTerms
      : [];

    const searchTerms = uniqueTerms([
      intake.prospectiveClientName,
      ...intake.opposingParties,
      ...intake.relatedParties,
      intake.client?.name,
      intake.client?.referenceNumber,
      intake.client?.email,
      intake.client?.phone,
      intake.client?.idNumber,
      ...additionalTerms,
    ]);

    if (searchTerms.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "There are no valid names or identifiers available for the conflict check.",
        },
        { status: 400 }
      );
    }

    const clientConditions: Prisma.ClientWhereInput[] = [];

    for (const term of searchTerms) {
      clientConditions.push(
        {
          name: {
            contains: term,
            mode: "insensitive",
          },
        },
        {
          referenceNumber: {
            contains: term,
            mode: "insensitive",
          },
        },
        {
          email: {
            contains: term,
            mode: "insensitive",
          },
        },
        {
          phone: {
            contains: term,
            mode: "insensitive",
          },
        },
        {
          idNumber: {
            contains: term,
            mode: "insensitive",
          },
        }
      );
    }

    const matterConditions: Prisma.MatterWhereInput[] = [];

    for (const term of searchTerms) {
      matterConditions.push(
        {
          referenceNumber: {
            contains: term,
            mode: "insensitive",
          },
        },
        {
          title: {
            contains: term,
            mode: "insensitive",
          },
        },
        {
          description: {
            contains: term,
            mode: "insensitive",
          },
        },
        {
          practiceArea: {
            contains: term,
            mode: "insensitive",
          },
        },
        {
          client: {
            name: {
              contains: term,
              mode: "insensitive",
            },
          },
        }
      );
    }

    const [clientMatches, matterMatches] = await Promise.all([
      prisma.client.findMany({
        where: {
          firmId: user.firmId,
          OR: clientConditions,
        },
        select: {
          id: true,
          name: true,
          referenceNumber: true,
          email: true,
          phone: true,
          idNumber: true,
        },
        orderBy: {
          name: "asc",
        },
        take: 100,
      }),

      prisma.matter.findMany({
        where: {
          firmId: user.firmId,
          OR: matterConditions,
        },
        select: {
          id: true,
          referenceNumber: true,
          title: true,
          description: true,
          practiceArea: true,
          status: true,
          client: {
            select: {
              id: true,
              name: true,
              referenceNumber: true,
            },
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
        take: 100,
      }),
    ]);

    const uniqueClientMatches = Array.from(
      new Map(
        clientMatches.map((client) => [client.id, client])
      ).values()
    );

    const uniqueMatterMatches = Array.from(
      new Map(
        matterMatches.map((matter) => [matter.id, matter])
      ).values()
    );

    const conflictStatus =
      uniqueClientMatches.length === 0 &&
      uniqueMatterMatches.length === 0
        ? ConflictCheckStatus.CLEAR
        : ConflictCheckStatus.POTENTIAL_CONFLICT;

    const matchedClientIds = uniqueClientMatches.map(
      (client) => client.id
    );

    const matchedMatterIds = uniqueMatterMatches.map(
      (matter) => matter.id
    );

    const result = await prisma.$transaction(
      async (tx) => {
        const conflictCheck = await tx.conflictCheck.create({
          data: {
            firmId: user.firmId,
            intakeId: intake.id,
            clientId: intake.clientId ?? null,
            checkedById: user.id,
            status: conflictStatus,
            searchTerms,
            matchedMatterIds,
            matchedClientIds,
          },
          include: {
            checkedBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        });

        const updatedIntake = await tx.matterIntake.update({
          where: {
            id: intake.id,
          },
          data: {
            conflictStatus,
            conflictCheckedAt: new Date(),
            conflictCheckedById: user.id,
            status: IntakeStatus.CONFLICT_REVIEW,
          },
          include: {
            client: {
              select: {
                id: true,
                name: true,
                referenceNumber: true,
              },
            },
            assignedTo: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            createdBy: {
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
          },
        });

        await tx.auditLog.create({
          data: {
            firmId: user.firmId,
            userId: user.id,
            action: AuditAction.CREATE,
            entityType: "ConflictCheck",
            entityId: conflictCheck.id,
            description: `Conflict check performed for legal intake ${intake.id}. Result: ${conflictStatus}.`,
            metadata: JSON.parse(
              JSON.stringify({
                intakeId: intake.id,
                prospectiveClientName:
                  intake.prospectiveClientName,
                conflictStatus,
                searchTerms,
                matchedClientIds,
                matchedMatterIds,
                clientMatchCount:
                  uniqueClientMatches.length,
                matterMatchCount:
                  uniqueMatterMatches.length,
              })
            ),
          },
        });

        return {
          conflictCheck,
          updatedIntake,
        };
      },
      {
        maxWait: 10000,
        timeout: 15000,
      }
    );

    return NextResponse.json(
      {
        success: true,
        message:
          conflictStatus === ConflictCheckStatus.CLEAR
            ? "Conflict check completed. No matching records were found in this firm's records."
            : "Conflict check completed. Potential matching records were found and require human review.",
        data: {
          conflictCheck: result.conflictCheck,
          intake: result.updatedIntake,
          status: conflictStatus,
          searchTerms,
          matchedClients: uniqueClientMatches,
          matchedMatters: uniqueMatterMatches,
          matchedClientIds,
          matchedMatterIds,
          clientMatchCount: uniqueClientMatches.length,
          matterMatchCount: uniqueMatterMatches.length,
          requiresHumanReview:
            conflictStatus !== ConflictCheckStatus.CLEAR,
          disclaimer:
            "A potential match does not by itself constitute a legal conflict. The results must be reviewed by an authorised member of the firm.",
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "POST /api/intake/[id]/conflict-check error:",
      error
    );

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("Prisma error code:", error.code);
      console.error("Prisma error meta:", error.meta);
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to run conflict check.",
        message:
          "The conflict check could not be completed. Please try again.",
      },
      { status: 500 }
    );
  }
}