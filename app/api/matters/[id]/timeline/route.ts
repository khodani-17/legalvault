import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions-server";

const FIRM_WIDE_ROLES = new Set([
  "SUPER_ADMIN",
  "MANAGING_PARTNER",
  "PARTNER",
  "DIRECTOR",
  "ATTORNEY",
  "ADMIN",
]);

const PAGE_SIZE = 50;

function serializeValue(value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(serializeValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(
        ([key, val]) => [key, serializeValue(val)],
      ),
    );
  }

  return value;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        },
      );
    }

    const userId = session.user.id;
    const { id: matterId } = await params;

    if (!matterId) {
      return NextResponse.json(
        {
          error: "Matter ID is required",
        },
        {
          status: 400,
        },
      );
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        firmId: true,
        role: true,
        status: true,
      },
    });

    if (!user || user.status !== "ACTIVE" || !user.firmId) {
      return NextResponse.json(
        {
          error: "Active user or firm not found",
        },
        {
          status: 403,
        },
      );
    }

    await requirePermission("matters.view");

    const matter = await prisma.matter.findFirst({
      where: {
        id: matterId,
        firmId: user.firmId,
      },
      select: {
        id: true,
        firmId: true,
        referenceNumber: true,
        title: true,
      },
    });

    if (!matter) {
      return NextResponse.json(
        {
          error: "Matter not found",
        },
        {
          status: 404,
        },
      );
    }

    const isFirmWideRole = FIRM_WIDE_ROLES.has(user.role);

    if (!isFirmWideRole) {
      const membership = await prisma.matterUser.findFirst({
        where: {
          matterId: matter.id,
          userId,
          canView: true,
        },
        select: {
          id: true,
        },
      });

      if (!membership) {
        return NextResponse.json(
          {
            error: "You do not have access to this matter",
          },
          {
            status: 403,
          },
        );
      }
    }

    const { searchParams } = new URL(request.url);

    const pageParam = Number(
      searchParams.get("page") || "1",
    );

    const page =
      Number.isFinite(pageParam) && pageParam > 0
        ? Math.floor(pageParam)
        : 1;

    const [
      documentIds,
      taskIds,
      deadlineIds,
      folderIds,
      accessRequestIds,
      matterUserIds,
      intake,
    ] = await Promise.all([
      prisma.document.findMany({
        where: {
          matterId: matter.id,
          firmId: user.firmId,
        },
        select: {
          id: true,
        },
      }),

      prisma.task.findMany({
        where: {
          matterId: matter.id,
          firmId: user.firmId,
        },
        select: {
          id: true,
        },
      }),

      prisma.deadline.findMany({
        where: {
          matterId: matter.id,
          firmId: user.firmId,
        },
        select: {
          id: true,
        },
      }),

      prisma.folder.findMany({
        where: {
          matterId: matter.id,
          firmId: user.firmId,
        },
        select: {
          id: true,
        },
      }),

      prisma.matterAccessRequest.findMany({
        where: {
          matterId: matter.id,
          firmId: user.firmId,
        },
        select: {
          id: true,
        },
      }),

      prisma.matterUser.findMany({
        where: {
          matterId: matter.id,
        },
        select: {
          id: true,
        },
      }),

      prisma.matterIntake.findFirst({
        where: {
          convertedMatter: {
            id: matter.id,
          },
          firmId: user.firmId,
        },
        select: {
          id: true,
        },
      }),
    ]);

    const relatedEntityIds = [
      matter.id,
      ...documentIds.map((item) => item.id),
      ...taskIds.map((item) => item.id),
      ...deadlineIds.map((item) => item.id),
      ...folderIds.map((item) => item.id),
      ...accessRequestIds.map((item) => item.id),
      ...matterUserIds.map((item) => item.id),
      ...(intake ? [intake.id] : []),
    ];

    const allowedEntityTypes = [
      "Matter",
      "Document",
      "DocumentVersion",
      "Task",
      "Deadline",
      "Folder",
      "MatterUser",
      "MatterAccessRequest",
      "MatterIntake",
    ];

    const where = {
      firmId: user.firmId,

      entityType: {
        in: allowedEntityTypes,
      },

      entityId: {
        in: relatedEntityIds,
      },
    };

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({
        where,
      }),

      prisma.auditLog.findMany({
        where,

        orderBy: {
          createdAt: "desc",
        },

        skip: (page - 1) * PAGE_SIZE,

        take: PAGE_SIZE,

        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          description: true,
          metadata: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,

          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.max(
      1,
      Math.ceil(total / PAGE_SIZE),
    );

    return NextResponse.json({
      matter: {
        id: matter.id,
        referenceNumber: matter.referenceNumber,
        title: matter.title,
      },

      timeline: logs.map((log) => ({
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        description: log.description,
        metadata: serializeValue(log.metadata),
        createdAt: log.createdAt.toISOString(),

        user: log.user,
      })),

      pagination: {
        page,
        pageSize: PAGE_SIZE,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    console.error(
      "Matter timeline GET error:",
      error,
    );

    return NextResponse.json(
      {
        error: "Failed to load matter timeline",
      },
      {
        status: 500,
      },
    );
  }
}