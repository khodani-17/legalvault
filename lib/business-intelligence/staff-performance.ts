import { prisma } from "@/lib/prisma";

export type StaffPerformanceMetric = {
  userId: string;
  name: string;
  role: string;

  activeTasks: number;
  completedTasks: number;
  overdueTasks: number;

  highPriorityTasks: number;
  urgentTasks: number;

  upcomingDeadlines: number;
  overdueDeadlines: number;
  criticalDeadlines: number;

  totalTrackedTasks: number;
  completionRate: number;

  workloadStatus:
    | "NO_ACTIVITY"
    | "LOW"
    | "BALANCED"
    | "HIGH"
    | "OVERLOADED";
};

export type StaffPerformanceOverview = {
  staff: StaffPerformanceMetric[];

  firm: {
    totalStaff: number;

    totalActiveTasks: number;
    assignedActiveTasks: number;
    unassignedActiveTasks: number;

    totalCompletedTasks: number;
    totalTrackedTasks: number;

    averageActiveTasks: number;
    completionRate: number;

    staffWithActiveTasks: number;
    staffWithOverdueTasks: number;
    staffWithUrgentTasks: number;
    staffWithUpcomingDeadlines: number;
    staffWithOverdueDeadlines: number;

    overloadedStaff: number;
    highWorkloadStaff: number;
  };

  charts: {
    workload: {
      name: string;
      active: number;
      completed: number;
      overdue: number;
    }[];

    priorities: {
      name: string;
      highPriority: number;
      urgent: number;
    }[];

    deadlines: {
      name: string;
      upcoming: number;
      overdue: number;
      critical: number;
    }[];
  };

  generatedAt: string;
};

function percentage(value: number, total: number) {
  if (!total) {
    return 0;
  }

  return Math.round((value / total) * 100);
}

export async function getStaffPerformanceOverview(
  firmId: string,
): Promise<StaffPerformanceOverview> {
  if (!firmId) {
    throw new Error("Firm ID is required.");
  }

  const now = new Date();

  const next7Days = new Date(
    now.getTime() + 7 * 24 * 60 * 60 * 1000,
  );

  /*
   * ---------------------------------------------------------
   * ACTIVE STAFF
   * ---------------------------------------------------------
   */

  const users = await prisma.user.findMany({
    where: {
      firmId,
      status: "ACTIVE",
    },
    select: {
      id: true,
      name: true,
      role: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  /*
   * ---------------------------------------------------------
   * TASKS
   * ---------------------------------------------------------
   */

  const [activeTasks, completedTasks, overdueTasks] =
    await Promise.all([
      prisma.task.findMany({
        where: {
          firmId,
          status: {
            in: ["TODO", "IN_PROGRESS"],
          },
        },
        select: {
          assignedToId: true,
          priority: true,
        },
      }),

      prisma.task.findMany({
        where: {
          firmId,
          status: "COMPLETED",
        },
        select: {
          assignedToId: true,
        },
      }),

      prisma.task.findMany({
        where: {
          firmId,
          dueDate: {
            lt: now,
          },
          status: {
            not: "COMPLETED",
          },
        },
        select: {
          assignedToId: true,
        },
      }),
    ]);

  /*
   * ---------------------------------------------------------
   * DEADLINES
   * ---------------------------------------------------------
   */

  const [upcomingDeadlines, overdueDeadlines] =
    await Promise.all([
      prisma.deadline.findMany({
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
        select: {
          assignedToId: true,
          priority: true,
        },
      }),

      prisma.deadline.findMany({
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
        select: {
          assignedToId: true,
          priority: true,
        },
      }),
    ]);

  /*
   * ---------------------------------------------------------
   * METRIC MAP
   * ---------------------------------------------------------
   */

  const metrics = new Map<
    string,
    StaffPerformanceMetric
  >();

  for (const user of users) {
    metrics.set(user.id, {
      userId: user.id,
      name: user.name || "Unnamed User",
      role: String(user.role),

      activeTasks: 0,
      completedTasks: 0,
      overdueTasks: 0,

      highPriorityTasks: 0,
      urgentTasks: 0,

      upcomingDeadlines: 0,
      overdueDeadlines: 0,
      criticalDeadlines: 0,

      totalTrackedTasks: 0,
      completionRate: 0,

      workloadStatus: "NO_ACTIVITY",
    });
  }

  /*
   * ---------------------------------------------------------
   * ACTIVE TASK METRICS
   * ---------------------------------------------------------
   */

  let unassignedActiveTasks = 0;

  for (const task of activeTasks) {
    if (!task.assignedToId) {
      unassignedActiveTasks += 1;
      continue;
    }

    const metric = metrics.get(task.assignedToId);

    if (!metric) {
      continue;
    }

    metric.activeTasks += 1;

    if (task.priority === "URGENT") {
      metric.urgentTasks += 1;
    }

    if (
      task.priority === "HIGH" ||
      task.priority === "URGENT"
    ) {
      metric.highPriorityTasks += 1;
    }
  }

  /*
   * ---------------------------------------------------------
   * COMPLETED TASK METRICS
   * ---------------------------------------------------------
   */

  for (const task of completedTasks) {
    if (!task.assignedToId) {
      continue;
    }

    const metric = metrics.get(task.assignedToId);

    if (!metric) {
      continue;
    }

    metric.completedTasks += 1;
  }

  /*
   * ---------------------------------------------------------
   * OVERDUE TASK METRICS
   * ---------------------------------------------------------
   */

  for (const task of overdueTasks) {
    if (!task.assignedToId) {
      continue;
    }

    const metric = metrics.get(task.assignedToId);

    if (!metric) {
      continue;
    }

    metric.overdueTasks += 1;
  }

  /*
   * ---------------------------------------------------------
   * UPCOMING DEADLINE METRICS
   * ---------------------------------------------------------
   */

  for (const deadline of upcomingDeadlines) {
    if (!deadline.assignedToId) {
      continue;
    }

    const metric = metrics.get(deadline.assignedToId);

    if (!metric) {
      continue;
    }

    metric.upcomingDeadlines += 1;

    if (
      deadline.priority === "HIGH" ||
      deadline.priority === "CRITICAL"
    ) {
      metric.criticalDeadlines += 1;
    }
  }

  /*
   * ---------------------------------------------------------
   * OVERDUE DEADLINE METRICS
   * ---------------------------------------------------------
   */

  for (const deadline of overdueDeadlines) {
    if (!deadline.assignedToId) {
      continue;
    }

    const metric = metrics.get(deadline.assignedToId);

    if (!metric) {
      continue;
    }

    metric.overdueDeadlines += 1;

    if (
      deadline.priority === "HIGH" ||
      deadline.priority === "CRITICAL"
    ) {
      metric.criticalDeadlines += 1;
    }
  }

  /*
   * ---------------------------------------------------------
   * CALCULATE PERFORMANCE
   * ---------------------------------------------------------
   */

  const staff = Array.from(metrics.values());

  for (const metric of staff) {
    metric.totalTrackedTasks =
      metric.activeTasks + metric.completedTasks;

    metric.completionRate = percentage(
      metric.completedTasks,
      metric.totalTrackedTasks,
    );

    if (
      metric.activeTasks === 0 &&
      metric.completedTasks === 0
    ) {
      metric.workloadStatus = "NO_ACTIVITY";
    } else if (metric.activeTasks <= 2) {
      metric.workloadStatus = "LOW";
    } else if (metric.activeTasks <= 8) {
      metric.workloadStatus = "BALANCED";
    } else if (metric.activeTasks <= 14) {
      metric.workloadStatus = "HIGH";
    } else {
      metric.workloadStatus = "OVERLOADED";
    }
  }

  /*
   * ---------------------------------------------------------
   * FIRM WORKLOAD
   * ---------------------------------------------------------
   */

  const totalActiveTasks = activeTasks.length;

  const assignedActiveTasks =
    totalActiveTasks - unassignedActiveTasks;

  const totalCompletedTasks = completedTasks.length;

  const totalTrackedTasks =
    assignedActiveTasks + totalCompletedTasks;

  const averageActiveTasks =
    users.length > 0
      ? Math.round(
          (assignedActiveTasks / users.length) * 10,
        ) / 10
      : 0;

  const firmCompletionRate = percentage(
    totalCompletedTasks,
    totalTrackedTasks,
  );

  const staffWithActiveTasks = staff.filter(
    (person) => person.activeTasks > 0,
  ).length;

  const staffWithOverdueTasks = staff.filter(
    (person) => person.overdueTasks > 0,
  ).length;

  const staffWithUrgentTasks = staff.filter(
    (person) => person.urgentTasks > 0,
  ).length;

  const staffWithUpcomingDeadlines = staff.filter(
    (person) => person.upcomingDeadlines > 0,
  ).length;

  const staffWithOverdueDeadlines = staff.filter(
    (person) => person.overdueDeadlines > 0,
  ).length;

  const overloadedStaff = staff.filter(
    (person) =>
      person.workloadStatus === "OVERLOADED",
  ).length;

  const highWorkloadStaff = staff.filter(
    (person) =>
      person.workloadStatus === "HIGH" ||
      person.workloadStatus === "OVERLOADED",
  ).length;

  /*
   * ---------------------------------------------------------
   * CHART DATA
   * ---------------------------------------------------------
   */

  const workload = staff
    .filter(
      (person) =>
        person.activeTasks > 0 ||
        person.completedTasks > 0 ||
        person.overdueTasks > 0,
    )
    .map((person) => ({
      name: person.name,
      active: person.activeTasks,
      completed: person.completedTasks,
      overdue: person.overdueTasks,
    }));

  const priorities = staff
    .filter(
      (person) =>
        person.highPriorityTasks > 0 ||
        person.urgentTasks > 0,
    )
    .map((person) => ({
      name: person.name,
      highPriority: person.highPriorityTasks,
      urgent: person.urgentTasks,
    }));

  const deadlines = staff
    .filter(
      (person) =>
        person.upcomingDeadlines > 0 ||
        person.overdueDeadlines > 0 ||
        person.criticalDeadlines > 0,
    )
    .map((person) => ({
      name: person.name,
      upcoming: person.upcomingDeadlines,
      overdue: person.overdueDeadlines,
      critical: person.criticalDeadlines,
    }));

  return {
    staff,
    firm: {
      totalStaff: users.length,

      totalActiveTasks,
      assignedActiveTasks,
      unassignedActiveTasks,

      totalCompletedTasks,
      totalTrackedTasks,

      averageActiveTasks,
      completionRate: firmCompletionRate,

      staffWithActiveTasks,
      staffWithOverdueTasks,
      staffWithUrgentTasks,
      staffWithUpcomingDeadlines,
      staffWithOverdueDeadlines,

      overloadedStaff,
      highWorkloadStaff,
    },

    charts: {
      workload,
      priorities,
      deadlines,
    },

    generatedAt: now.toISOString(),
  };
}