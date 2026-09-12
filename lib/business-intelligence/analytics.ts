import { prisma } from "@/lib/prisma";

export type BusinessIntelligenceOverview = {
  clients: {
    total: number;
    individual: number;
    company: number;
    trust: number;
    government: number;
    other: number;
  };

  matters: {
    total: number;
    open: number;
    pending: number;
    closed: number;
    archived: number;
  };

  tasks: {
    total: number;
    todo: number;
    inProgress: number;
    completed: number;
    cancelled: number;
    overdue: number;
    urgent: number;
  };

  deadlines: {
    total: number;
    pending: number;
    completed: number;
    cancelled: number;
    overdue: number;
    dueToday: number;
    dueNext7Days: number;
    critical: number;
  };

  documents: {
    total: number;
    active: number;
    archived: number;
    deleted: number;
    versions: number;
  };

  users: {
    total: number;
    active: number;
    inactive: number;
    suspended: number;
  };

  workload: {
    usersWithMatters: number;
    usersWithTasks: number;
    usersWithDeadlines: number;
  };

  activity: {
    today: number;
    last7Days: number;
    last30Days: number;
  };

  charts: {
    matterStatus: Array<{
      status: string;
      count: number;
    }>;

    clientType: Array<{
      type: string;
      count: number;
    }>;

    activityTrend: Array<{
      date: string;
      count: number;
    }>;
  };

  generatedAt: string;
};

function startOfDay(date: Date) {
  const result = new Date(date);

  result.setHours(0, 0, 0, 0);

  return result;
}

function endOfDay(date: Date) {
  const result = new Date(date);

  result.setHours(23, 59, 59, 999);

  return result;
}

function startOfMonth(date: Date) {
  const result = new Date(date);

  result.setDate(1);
  result.setHours(0, 0, 0, 0);

  return result;
}

function addMonths(date: Date, months: number) {
  const result = new Date(date);

  result.setMonth(result.getMonth() + months);

  return result;
}

function formatMonth(date: Date) {
  return date.toLocaleDateString("en-ZA", {
    month: "short",
    year: "numeric",
  });
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(
    date.getMonth() + 1,
  ).padStart(2, "0")}`;
}

export async function getBusinessIntelligenceOverview(
  firmId: string,
): Promise<BusinessIntelligenceOverview> {
  if (!firmId) {
    throw new Error("Firm ID is required.");
  }

  const now = new Date();

  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const sevenDaysAgo = new Date(
    now.getTime() - 7 * 24 * 60 * 60 * 1000,
  );

  const thirtyDaysAgo = new Date(
    now.getTime() - 30 * 24 * 60 * 60 * 1000,
  );

  const next7Days = new Date(
    now.getTime() + 7 * 24 * 60 * 60 * 1000,
  );

  /*
   * ---------------------------------------------------------
   * CLIENTS
   * ---------------------------------------------------------
   */

  const [
    totalClients,
    individualClients,
    companyClients,
    trustClients,
    governmentClients,
    otherClients,
  ] = await Promise.all([
    prisma.client.count({
      where: { firmId },
    }),

    prisma.client.count({
      where: {
        firmId,
        type: "INDIVIDUAL",
      },
    }),

    prisma.client.count({
      where: {
        firmId,
        type: "COMPANY",
      },
    }),

    prisma.client.count({
      where: {
        firmId,
        type: "TRUST",
      },
    }),

    prisma.client.count({
      where: {
        firmId,
        type: "GOVERNMENT",
      },
    }),

    prisma.client.count({
      where: {
        firmId,
        type: "OTHER",
      },
    }),
  ]);

  /*
   * ---------------------------------------------------------
   * MATTERS
   * ---------------------------------------------------------
   */

  const [
    totalMatters,
    openMatters,
    pendingMatters,
    closedMatters,
    archivedMatters,
  ] = await Promise.all([
    prisma.matter.count({
      where: { firmId },
    }),

    prisma.matter.count({
      where: {
        firmId,
        status: "OPEN",
      },
    }),

    prisma.matter.count({
      where: {
        firmId,
        status: "PENDING",
      },
    }),

    prisma.matter.count({
      where: {
        firmId,
        status: "CLOSED",
      },
    }),

    prisma.matter.count({
      where: {
        firmId,
        status: "ARCHIVED",
      },
    }),
  ]);

  /*
   * ---------------------------------------------------------
   * TASKS
   * ---------------------------------------------------------
   */

  const [
    totalTasks,
    todoTasks,
    inProgressTasks,
    completedTasks,
    cancelledTasks,
    urgentTasks,
    overdueTasks,
  ] = await Promise.all([
    prisma.task.count({
      where: { firmId },
    }),

    prisma.task.count({
      where: {
        firmId,
        status: "TODO",
      },
    }),

    prisma.task.count({
      where: {
        firmId,
        status: "IN_PROGRESS",
      },
    }),

    prisma.task.count({
      where: {
        firmId,
        status: "COMPLETED",
      },
    }),

    prisma.task.count({
      where: {
        firmId,
        status: "CANCELLED",
      },
    }),

    prisma.task.count({
      where: {
        firmId,
        priority: "URGENT",
        status: {
          not: "COMPLETED",
        },
      },
    }),

    prisma.task.count({
      where: {
        firmId,
        dueDate: {
          lt: now,
        },
        status: {
          not: "COMPLETED",
        },
      },
    }),
  ]);

  /*
   * ---------------------------------------------------------
   * DEADLINES
   * ---------------------------------------------------------
   */

  const [
    totalDeadlines,
    pendingDeadlines,
    completedDeadlines,
    cancelledDeadlines,
    overdueDeadlines,
    deadlinesToday,
    deadlinesNext7Days,
    criticalDeadlines,
  ] = await Promise.all([
    prisma.deadline.count({
      where: { firmId },
    }),

    prisma.deadline.count({
      where: {
        firmId,
        status: "PENDING",
      },
    }),

    prisma.deadline.count({
      where: {
        firmId,
        status: "COMPLETED",
      },
    }),

    prisma.deadline.count({
      where: {
        firmId,
        status: "CANCELLED",
      },
    }),

    prisma.deadline.count({
      where: {
        firmId,
        OR: [
          {
            status: "OVERDUE",
          },
          {
            dueDate: {
              lt: now,
            },
            status: "PENDING",
          },
        ],
      },
    }),

    prisma.deadline.count({
      where: {
        firmId,
        dueDate: {
          gte: todayStart,
          lte: todayEnd,
        },
        status: {
          not: "CANCELLED",
        },
      },
    }),

    prisma.deadline.count({
      where: {
        firmId,
        dueDate: {
          gte: now,
          lte: next7Days,
        },
        status: {
          not: "CANCELLED",
        },
      },
    }),

    prisma.deadline.count({
      where: {
        firmId,
        priority: "CRITICAL",
        status: {
          not: "COMPLETED",
        },
      },
    }),
  ]);

  /*
   * ---------------------------------------------------------
   * DOCUMENTS
   * ---------------------------------------------------------
   */

  const [
    totalDocuments,
    activeDocuments,
    archivedDocuments,
    deletedDocuments,
    totalDocumentVersions,
  ] = await Promise.all([
    prisma.document.count({
      where: { firmId },
    }),

    prisma.document.count({
      where: {
        firmId,
        status: "ACTIVE",
      },
    }),

    prisma.document.count({
      where: {
        firmId,
        status: "ARCHIVED",
      },
    }),

    prisma.document.count({
      where: {
        firmId,
        status: "DELETED",
      },
    }),

    prisma.documentVersion.count({
      where: {
        document: {
          firmId,
        },
      },
    }),
  ]);

  /*
   * ---------------------------------------------------------
   * USERS
   * ---------------------------------------------------------
   */

  const [
    totalUsers,
    activeUsers,
    inactiveUsers,
    suspendedUsers,
  ] = await Promise.all([
    prisma.user.count({
      where: { firmId },
    }),

    prisma.user.count({
      where: {
        firmId,
        status: "ACTIVE",
      },
    }),

    prisma.user.count({
      where: {
        firmId,
        status: "INACTIVE",
      },
    }),

    prisma.user.count({
      where: {
        firmId,
        status: "SUSPENDED",
      },
    }),
  ]);

  /*
   * ---------------------------------------------------------
   * WORKLOAD
   * ---------------------------------------------------------
   */

  const [
    usersWithMatters,
    usersWithTasks,
    usersWithDeadlines,
  ] = await Promise.all([
    prisma.matterUser.findMany({
      where: {
        user: {
          firmId,
        },
      },
      select: {
        userId: true,
      },
      distinct: ["userId"],
    }),

    prisma.task.findMany({
      where: {
        firmId,
        assignedToId: {
          not: null,
        },
      },
      select: {
        assignedToId: true,
      },
      distinct: ["assignedToId"],
    }),

    prisma.deadline.findMany({
      where: {
        firmId,
        assignedToId: {
          not: null,
        },
      },
      select: {
        assignedToId: true,
      },
      distinct: ["assignedToId"],
    }),
  ]);

  /*
   * ---------------------------------------------------------
   * AUDIT ACTIVITY
   * ---------------------------------------------------------
   */

  const [
    activityToday,
    activityLast7Days,
    activityLast30Days,
  ] = await Promise.all([
    prisma.auditLog.count({
      where: {
        firmId,
        createdAt: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    }),

    prisma.auditLog.count({
      where: {
        firmId,
        createdAt: {
          gte: sevenDaysAgo,
        },
      },
    }),

    prisma.auditLog.count({
      where: {
        firmId,
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
    }),
  ]);

  /*
   * ---------------------------------------------------------
   * MATTER STATUS CHART
   * ---------------------------------------------------------
   */

  const matterStatus = [
    {
      status: "Open",
      count: openMatters,
    },
    {
      status: "Pending",
      count: pendingMatters,
    },
    {
      status: "Closed",
      count: closedMatters,
    },
    {
      status: "Archived",
      count: archivedMatters,
    },
  ];

  /*
   * ---------------------------------------------------------
   * CLIENT TYPE CHART
   * ---------------------------------------------------------
   */

  const clientType = [
    {
      type: "Individual",
      count: individualClients,
    },
    {
      type: "Company",
      count: companyClients,
    },
    {
      type: "Trust",
      count: trustClients,
    },
    {
      type: "Government",
      count: governmentClients,
    },
    {
      type: "Other",
      count: otherClients,
    },
  ];

  /*
   * ---------------------------------------------------------
   * SIX-MONTH ROLLING ACTIVITY TREND
   * ---------------------------------------------------------
   *
   * Always displays exactly six calendar months:
   *
   *   current month
   *   previous month
   *   previous 2 months
   *   previous 3 months
   *   previous 4 months
   *   previous 5 months
   *
   * When a new month starts, the oldest month automatically
   * drops off and the new month is added.
   *
   * Example:
   *
   * September 2026:
   * April 2026 -> September 2026
   *
   * October 2026:
   * May 2026 -> October 2026
   *
   * No manual code changes are required.
   */

  const currentMonthStart = startOfMonth(now);

  const sixMonthsAgo = addMonths(
    currentMonthStart,
    -5,
  );

  const nextMonthStart = addMonths(
    currentMonthStart,
    1,
  );

  const activityLogs = await prisma.auditLog.findMany({
    where: {
      firmId,
      createdAt: {
        gte: sixMonthsAgo,
        lt: nextMonthStart,
      },
    },
    select: {
      createdAt: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  /*
   * Create all six months first so months with zero
   * activity still appear on the chart.
   */

  const activityMap = new Map<
    string,
    {
      date: string;
      count: number;
    }
  >();

  for (let index = 0; index < 6; index++) {
    const month = addMonths(
      sixMonthsAgo,
      index,
    );

    activityMap.set(monthKey(month), {
      date: month.toISOString(),
      count: 0,
    });
  }

  /*
   * Add audit activity to the appropriate month.
   */

  for (const log of activityLogs) {
    const key = monthKey(log.createdAt);

    const existing = activityMap.get(key);

    if (existing) {
      existing.count += 1;
    }
  }

  const activityTrend = Array.from(
    activityMap.values(),
  );

  /*
   * ---------------------------------------------------------
   * RETURN BUSINESS INTELLIGENCE
   * ---------------------------------------------------------
   */

  return {
    clients: {
      total: totalClients,
      individual: individualClients,
      company: companyClients,
      trust: trustClients,
      government: governmentClients,
      other: otherClients,
    },

    matters: {
      total: totalMatters,
      open: openMatters,
      pending: pendingMatters,
      closed: closedMatters,
      archived: archivedMatters,
    },

    tasks: {
      total: totalTasks,
      todo: todoTasks,
      inProgress: inProgressTasks,
      completed: completedTasks,
      cancelled: cancelledTasks,
      overdue: overdueTasks,
      urgent: urgentTasks,
    },

    deadlines: {
      total: totalDeadlines,
      pending: pendingDeadlines,
      completed: completedDeadlines,
      cancelled: cancelledDeadlines,
      overdue: overdueDeadlines,
      dueToday: deadlinesToday,
      dueNext7Days: deadlinesNext7Days,
      critical: criticalDeadlines,
    },

    documents: {
      total: totalDocuments,
      active: activeDocuments,
      archived: archivedDocuments,
      deleted: deletedDocuments,
      versions: totalDocumentVersions,
    },

    users: {
      total: totalUsers,
      active: activeUsers,
      inactive: inactiveUsers,
      suspended: suspendedUsers,
    },

    workload: {
      usersWithMatters: usersWithMatters.length,
      usersWithTasks: usersWithTasks.length,
      usersWithDeadlines: usersWithDeadlines.length,
    },

    activity: {
      today: activityToday,
      last7Days: activityLast7Days,
      last30Days: activityLast30Days,
    },

    charts: {
      matterStatus,
      clientType,
      activityTrend,
    },

    generatedAt: now.toISOString(),
  };
}