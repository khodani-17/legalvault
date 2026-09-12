import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import {
  AuditAction,
  IntakePriority,
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
];

function getString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isValidPriority(value: unknown): value is IntakePriority {
  return (
    value === "LOW" ||
    value === "MEDIUM" ||
    value === "HIGH" ||
    value === "URGENT"
  );
}

function isValidStatus(value: unknown): value is IntakeStatus {
  return (
    value === "NEW" ||
    value === "CONFLICT_CHECK_PENDING" ||
    value === "CONFLICT_REVIEW" ||
    value === "APPROVED" ||
    value === "REJECTED" ||
    value === "CONVERTED" ||
    value === "CLOSED"
  );
}

async function getAuthenticatedUser() {
  const session = await auth();

  if (!session?.user?.email) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: {
      email: session.user.email,
    },
    select: {
      id: true,
      firmId: true,
      name: true,
      email: true,
      role: true,
      status: true,
    },
  });

  if (!user) {
    return null;
  }

  if (user.status !== "ACTIVE") {
    return null;
  }

  if (!ALLOWED_ROLES.includes(user.role)) {
    return null;
  }

  return user;
}

// ============================================================
// GET /api/intake
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);

    const search = getString(searchParams.get("search"));
    const statusParam = getString(searchParams.get("status"));
    const priorityParam = getString(searchParams.get("priority"));
    const assignedToId = getString(searchParams.get("assignedToId"));

    const pageParam = Number(searchParams.get("page") || "1");
    const pageSizeParam = Number(searchParams.get("pageSize") || "20");

    const page =
      Number.isFinite(pageParam) && pageParam > 0
        ? Math.floor(pageParam)
        : 1;

    const pageSize =
      Number.isFinite(pageSizeParam) &&
      pageSizeParam > 0 &&
      pageSizeParam <= 100
        ? Math.floor(pageSizeParam)
        : 20;

    const where: Prisma.MatterIntakeWhereInput = {
      firmId: user.firmId,
    };

    if (search) {
      where.OR = [
        {
          prospectiveClientName: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          email: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          phone: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          description: {
            contains: search,
            mode: "insensitive",
          },
        },
      ];
    }

    if (statusParam && isValidStatus(statusParam)) {
      where.status = statusParam;
    }

    if (priorityParam && isValidPriority(priorityParam)) {
      where.priority = priorityParam;
    }

    if (assignedToId) {
      where.assignedToId = assignedToId;
    }

    const skip = (page - 1) * pageSize;

    const [intakes, total] = await Promise.all([
      prisma.matterIntake.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: pageSize,
        include: {
          client: {
            select: {
              id: true,
              referenceNumber: true,
              name: true,
              type: true,
            },
          },
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
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
          conflictChecks: {
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
            select: {
              id: true,
              status: true,
              matchedMatterIds: true,
              matchedClientIds: true,
              notes: true,
              reviewedAt: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.matterIntake.count({
        where,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: intakes,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("GET /api/intake error:", error);

    return NextResponse.json(
      {
        error: "Failed to retrieve legal intakes",
      },
      { status: 500 },
    );
  }
}

// ============================================================
// POST /api/intake
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await request.json();

    const prospectiveClientName = getString(
      body.prospectiveClientName,
    );

    const email = getString(body.email);
    const phone = getString(body.phone);
    const practiceArea = getString(body.practiceArea);
    const description = getString(body.description);
    const source = getString(body.source);
    const clientId = getString(body.clientId);
    const assignedToId = getString(body.assignedToId);

    const opposingParties = getStringArray(body.opposingParties);
    const relatedParties = getStringArray(body.relatedParties);

    const priority = isValidPriority(body.priority)
      ? body.priority
      : IntakePriority.MEDIUM;

    const conflictCheckRequired =
      typeof body.conflictCheckRequired === "boolean"
        ? body.conflictCheckRequired
        : true;

    if (!prospectiveClientName) {
      return NextResponse.json(
        {
          error: "Prospective client name is required",
        },
        { status: 400 },
      );
    }

    if (prospectiveClientName.length > 255) {
      return NextResponse.json(
        {
          error: "Prospective client name is too long",
        },
        { status: 400 },
      );
    }

    // ----------------------------------------------------------
    // Validate optional client
    // ----------------------------------------------------------

    if (clientId) {
      const client = await prisma.client.findFirst({
        where: {
          id: clientId,
          firmId: user.firmId,
        },
        select: {
          id: true,
        },
      });

      if (!client) {
        return NextResponse.json(
          {
            error: "Client not found in your firm",
          },
          { status: 400 },
        );
      }
    }

    // ----------------------------------------------------------
    // Validate assigned staff member
    // ----------------------------------------------------------

    if (assignedToId) {
      const assignedUser = await prisma.user.findFirst({
        where: {
          id: assignedToId,
          firmId: user.firmId,
          status: "ACTIVE",
        },
        select: {
          id: true,
        },
      });

      if (!assignedUser) {
        return NextResponse.json(
          {
            error: "Assigned staff member not found in your firm",
          },
          { status: 400 },
        );
      }
    }

    // ----------------------------------------------------------
    // Create intake
    // ----------------------------------------------------------

    const intake = await prisma.matterIntake.create({
      data: {
        firmId: user.firmId,
        prospectiveClientName,
        clientId: clientId || null,
        email: email || null,
        phone: phone || null,
        practiceArea: practiceArea || null,
        description: description || null,
        opposingParties,
        relatedParties,
        source: source || null,
        priority,
        conflictCheckRequired,
        status: conflictCheckRequired
          ? IntakeStatus.CONFLICT_CHECK_PENDING
          : IntakeStatus.NEW,
        assignedToId: assignedToId || null,
        createdById: user.id,
      },
      include: {
        client: {
          select: {
            id: true,
            referenceNumber: true,
            name: true,
            type: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // ----------------------------------------------------------
    // Audit log
    // ----------------------------------------------------------

    await prisma.auditLog.create({
      data: {
        firmId: user.firmId,
        userId: user.id,
        action: AuditAction.CREATE,
        entityType: "MATTER_INTAKE",
        entityId: intake.id,
        description: `Created legal intake for ${prospectiveClientName}`,
        metadata: {
          prospectiveClientName,
          practiceArea: practiceArea || null,
          priority,
          conflictCheckRequired,
          opposingPartiesCount: opposingParties.length,
          relatedPartiesCount: relatedParties.length,
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Legal intake created successfully",
        data: intake,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/intake error:", error);

    return NextResponse.json(
      {
        error: "Failed to create legal intake",
      },
      { status: 500 },
    );
  }
}