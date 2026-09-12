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

function parseDate(value: string | null) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const userId = session.user.id;

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
        { error: "Active user or firm not found" },
        { status: 403 },
      );
    }

    await requirePermission("matters.view");

    const { searchParams } = new URL(request.url);

    const start = parseDate(searchParams.get("start"));
    const end = parseDate(searchParams.get("end"));

    if (!start || !end) {
      return NextResponse.json(
        {
          error:
            "Valid start and end dates are required.",
        },
        { status: 400 },
      );
    }

    if (end <= start) {
      return NextResponse.json(
        {
          error:
            "The end date must be after the start date.",
        },
        { status: 400 },
      );
    }

    const isFirmWideRole = FIRM_WIDE_ROLES.has(user.role);

    const taskWhere = {
      firmId: user.firmId,
      dueDate: {
        gte: start,
        lt: end,
      },
      ...(isFirmWideRole
        ? {}
        : {
            OR: [
              {
                assignedToId: userId,
              },
              {
                createdById: userId,
              },
              {
                matter: {
                  users: {
                    some: {
                      userId,
                      canView: true,
                    },
                  },
                },
              },
            ],
          }),
    };

    const deadlineWhere = {
      firmId: user.firmId,
      dueDate: {
        gte: start,
        lt: end,
      },
      ...(isFirmWideRole
        ? {}
        : {
            OR: [
              {
                assignedToId: userId,
              },
              {
                createdById: userId,
              },
              {
                matter: {
                  users: {
                    some: {
                      userId,
                      canView: true,
                    },
                  },
                },
              },
            ],
          }),
    };

    const [tasks, deadlines] = await Promise.all([
      prisma.task.findMany({
        where: taskWhere,
        orderBy: {
          dueDate: "asc",
        },
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          dueDate: true,
          completedAt: true,
          matter: {
            select: {
              id: true,
              referenceNumber: true,
              title: true,
            },
          },
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),

      prisma.deadline.findMany({
        where: deadlineWhere,
        orderBy: {
          dueDate: "asc",
        },
        select: {
          id: true,
          title: true,
          description: true,
          type: true,
          priority: true,
          status: true,
          dueDate: true,
          completedAt: true,
          isCalculated: true,
          calculationNote: true,
          matter: {
            select: {
              id: true,
              referenceNumber: true,
              title: true,
            },
          },
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
    ]);

    const events = [
      ...tasks.map((task) => ({
        id: `task-${task.id}`,
        sourceId: task.id,
        type: "TASK" as const,
        title: task.title,
        description: task.description,
        date: task.dueDate?.toISOString() ?? null,
        status: task.status,
        priority: task.priority,
        completedAt: task.completedAt?.toISOString() ?? null,
        matter: task.matter,
        assignedTo: task.assignedTo,
        href: `/dashboard/tasks/${task.id}`,
      })),

      ...deadlines.map((deadline) => ({
        id: `deadline-${deadline.id}`,
        sourceId: deadline.id,
        type: "DEADLINE" as const,
        title: deadline.title,
        description: deadline.description,
        date: deadline.dueDate.toISOString(),
        status: deadline.status,
        priority: deadline.priority,
        completedAt:
          deadline.completedAt?.toISOString() ?? null,
        isCalculated: deadline.isCalculated,
        calculationNote: deadline.calculationNote,
        matter: deadline.matter,
        assignedTo: deadline.assignedTo,
        href: `/dashboard/deadlines/${deadline.id}`,
      })),
    ].sort(
      (a, b) =>
        new Date(a.date ?? 0).getTime() -
        new Date(b.date ?? 0).getTime(),
    );

    return NextResponse.json({
      events,
      range: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      totals: {
        events: events.length,
        tasks: tasks.length,
        deadlines: deadlines.length,
      },
    });
  } catch (error) {
    console.error("Calendar GET error:", error);

    return NextResponse.json(
      {
        error: "Failed to load calendar events.",
      },
      {
        status: 500,
      },
    );
  }
}