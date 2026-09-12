import { prisma } from "@/lib/prisma";

import {
  DeadlinePriority,
  DeadlineStatus,
  MatterStatus,
  TaskStatus,
} from "@/src/generated/prisma/enums";

export type MatterControlSeverity =
  | "CRITICAL"
  | "WARNING"
  | "INFO"
  | "POSITIVE";

export type MatterControlHealth =
  | "HEALTHY"
  | "NEEDS_ATTENTION"
  | "AT_RISK"
  | "CRITICAL";

export type MatterControlIssue = {
  id: string;
  severity: MatterControlSeverity;
  category:
    | "STAFF"
    | "DOCUMENT"
    | "TASK"
    | "DEADLINE"
    | "ACTIVITY"
    | "MATTER";
  title: string;
  message: string;
  recommendation: string;
};

export type MatterControlResult = {
  matter: {
    id: string;
    referenceNumber: string;
    title: string;
    status: MatterStatus;
    practiceArea: string | null;
    client: {
      id: string;
      name: string;
      referenceNumber: string;
    };
  };

  health: MatterControlHealth;

  statistics: {
    documents: number;
    activeDocuments: number;
    tasks: number;
    activeTasks: number;
    completedTasks: number;
    overdueTasks: number;
    deadlines: number;
    upcomingDeadlines: number;
    overdueDeadlines: number;
    criticalDeadlines: number;
    assignedStaff: number;
    activityCount: number;
    daysSinceActivity: number | null;
  };

  issues: MatterControlIssue[];

  timeline: {
    id: string;
    action: string;
    entityType: string;
    description: string | null;
    createdAt: Date;
  }[];
};

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function differenceInDays(from: Date, to: Date) {
  const milliseconds = to.getTime() - from.getTime();

  return Math.floor(
    milliseconds / (1000 * 60 * 60 * 24),
  );
}

function determineHealth(
  criticalIssues: number,
  warningIssues: number,
): MatterControlHealth {
  if (criticalIssues > 0) {
    return "CRITICAL";
  }

  if (warningIssues >= 3) {
    return "AT_RISK";
  }

  if (warningIssues > 0) {
    return "NEEDS_ATTENTION";
  }

  return "HEALTHY";
}

export async function getMatterControl(
  matterId: string,
  firmId: string,
): Promise<MatterControlResult | null> {
  const now = new Date();
  const today = startOfDay(now);

  const matter = await prisma.matter.findFirst({
    where: {
      id: matterId,
      firmId,
    },

    include: {
      client: true,

      users: {
        include: {
          user: true,
        },
      },

      documents: {
        where: {
          status: {
            not: "DELETED",
          },
        },
      },

      tasks: true,

      deadlines: true,
    },
  });

  if (!matter) {
    return null;
  }

  const timeline = await prisma.auditLog.findMany({
    where: {
      firmId,
      entityId: matterId,
    },

    orderBy: {
      createdAt: "desc",
    },

    take: 50,
  });

  /*
   * ------------------------------------------------------------
   * STAFF CONTROL
   * ------------------------------------------------------------
   */

  const assignedStaff = matter.users.filter(
    (matterUser) =>
      matterUser.canView &&
      matterUser.user.status === "ACTIVE",
  );

  /*
   * ------------------------------------------------------------
   * TASK CONTROL
   * ------------------------------------------------------------
   */

  const activeTasks = matter.tasks.filter(
    (task) =>
      task.status === TaskStatus.TODO ||
      task.status === TaskStatus.IN_PROGRESS,
  );

  const completedTasks = matter.tasks.filter(
    (task) =>
      task.status === TaskStatus.COMPLETED,
  );

  const overdueTasks = activeTasks.filter(
    (task) =>
      task.dueDate !== null &&
      task.dueDate < now,
  );

  /*
   * ------------------------------------------------------------
   * DEADLINE CONTROL
   * ------------------------------------------------------------
   */

  const activeDeadlines = matter.deadlines.filter(
    (deadline) =>
      deadline.status !== DeadlineStatus.COMPLETED &&
      deadline.status !== DeadlineStatus.CANCELLED,
  );

  const overdueDeadlines = activeDeadlines.filter(
    (deadline) =>
      deadline.dueDate < today,
  );

  const upcomingDeadlineLimit = new Date(
    today.getTime() +
      7 * 24 * 60 * 60 * 1000,
  );

  const upcomingDeadlines = activeDeadlines.filter(
    (deadline) =>
      deadline.dueDate >= today &&
      deadline.dueDate <= upcomingDeadlineLimit,
  );

  const criticalDeadlines = activeDeadlines.filter(
    (deadline) =>
      deadline.priority === DeadlinePriority.CRITICAL,
  );

  /*
   * ------------------------------------------------------------
   * ACTIVITY CONTROL
   * ------------------------------------------------------------
   */

  const lastActivity =
    timeline.length > 0
      ? timeline[0].createdAt
      : null;

  const daysSinceActivity = lastActivity
    ? differenceInDays(lastActivity, now)
    : null;

  const issues: MatterControlIssue[] = [];

  /*
   * ------------------------------------------------------------
   * STAFF CONTROL
   * ------------------------------------------------------------
   */

  if (assignedStaff.length === 0) {
    issues.push({
      id: "no-responsible-staff",
      severity: "CRITICAL",
      category: "STAFF",
      title: "No responsible staff member",
      message:
        "This matter does not currently have an active staff member assigned to it.",
      recommendation:
        "Assign the responsible attorney, candidate attorney, paralegal or other authorised staff member.",
    });
  }

  /*
   * ------------------------------------------------------------
   * DOCUMENT CONTROL
   * ------------------------------------------------------------
   */

  if (matter.documents.length === 0) {
    issues.push({
      id: "no-documents",
      severity: "WARNING",
      category: "DOCUMENT",
      title: "No matter documents",
      message:
        "No active documents are currently linked to this matter.",
      recommendation:
        "Upload or link the documents required for the matter.",
    });
  }

  /*
   * ------------------------------------------------------------
   * TASK CONTROL
   * ------------------------------------------------------------
   */

  if (
    matter.status !== MatterStatus.CLOSED &&
    matter.status !== MatterStatus.ARCHIVED &&
    activeTasks.length === 0
  ) {
    issues.push({
      id: "no-active-tasks",
      severity: "WARNING",
      category: "TASK",
      title: "No active matter tasks",
      message:
        "There are currently no active tasks associated with this matter.",
      recommendation:
        "Review the matter and create the next required action.",
    });
  }

  if (overdueTasks.length > 0) {
    issues.push({
      id: "overdue-tasks",
      severity: "CRITICAL",
      category: "TASK",
      title: "Overdue tasks",
      message: `${overdueTasks.length} active task${
        overdueTasks.length === 1 ? "" : "s"
      } ${
        overdueTasks.length === 1 ? "is" : "are"
      } overdue.`,
      recommendation:
        "Review the overdue work and update, complete or reassign the affected tasks.",
    });
  }

  /*
   * ------------------------------------------------------------
   * DEADLINE CONTROL
   * ------------------------------------------------------------
   */

  if (overdueDeadlines.length > 0) {
    issues.push({
      id: "overdue-deadlines",
      severity: "CRITICAL",
      category: "DEADLINE",
      title: "Overdue deadlines",
      message: `${overdueDeadlines.length} matter deadline${
        overdueDeadlines.length === 1 ? "" : "s"
      } ${
        overdueDeadlines.length === 1 ? "is" : "are"
      } overdue.`,
      recommendation:
        "Immediately review the affected deadlines and record the required action.",
    });
  }

  if (criticalDeadlines.length > 0) {
    issues.push({
      id: "critical-deadlines",
      severity: "CRITICAL",
      category: "DEADLINE",
      title: "Critical deadline exposure",
      message: `This matter has ${criticalDeadlines.length} critical deadline${
        criticalDeadlines.length === 1 ? "" : "s"
      }.`,
      recommendation:
        "Review the critical deadlines and confirm that responsible staff and actions are in place.",
    });
  }

  if (
    upcomingDeadlines.length > 0 &&
    activeTasks.length === 0
  ) {
    issues.push({
      id: "deadline-without-task",
      severity: "WARNING",
      category: "DEADLINE",
      title: "Upcoming deadline without active task",
      message:
        "The matter has an upcoming deadline but no active task linked to the matter.",
      recommendation:
        "Create an action task for the upcoming deadline.",
    });
  }

  /*
   * ------------------------------------------------------------
   * ACTIVITY CONTROL
   * ------------------------------------------------------------
   */

  if (
    matter.status !== MatterStatus.CLOSED &&
    matter.status !== MatterStatus.ARCHIVED &&
    daysSinceActivity !== null &&
    daysSinceActivity >= 14
  ) {
    issues.push({
      id: "inactive-matter",
      severity: "WARNING",
      category: "ACTIVITY",
      title: "Matter appears inactive",
      message: `No recorded matter activity has occurred for ${daysSinceActivity} days.`,
      recommendation:
        "Review the matter and record the next action or update the matter status.",
    });
  }

  if (
    matter.status !== MatterStatus.CLOSED &&
    matter.status !== MatterStatus.ARCHIVED &&
    timeline.length === 0
  ) {
    issues.push({
      id: "no-activity",
      severity: "INFO",
      category: "ACTIVITY",
      title: "No recorded matter activity",
      message:
        "No audit activity is currently associated with this matter.",
      recommendation:
        "Ensure important matter actions are recorded in LegalVault.",
    });
  }

  /*
   * ------------------------------------------------------------
   * HEALTH
   * ------------------------------------------------------------
   *
   * No numerical scoring is used.
   *
   * Health is determined directly from the actual
   * control issues identified on the matter.
   */

  const criticalIssues = issues.filter(
    (issue) =>
      issue.severity === "CRITICAL",
  ).length;

  const warningIssues = issues.filter(
    (issue) =>
      issue.severity === "WARNING",
  ).length;

  const health = determineHealth(
    criticalIssues,
    warningIssues,
  );

  /*
   * ------------------------------------------------------------
   * FINAL RESULT
   * ------------------------------------------------------------
   */

  return {
    matter: {
      id: matter.id,
      referenceNumber: matter.referenceNumber,
      title: matter.title,
      status: matter.status,
      practiceArea: matter.practiceArea,

      client: {
        id: matter.client.id,
        name: matter.client.name,
        referenceNumber:
          matter.client.referenceNumber,
      },
    },

    health,

    statistics: {
      documents:
        matter.documents.length,

      activeDocuments:
        matter.documents.filter(
          (document) =>
            document.status === "ACTIVE",
        ).length,

      tasks:
        matter.tasks.length,

      activeTasks:
        activeTasks.length,

      completedTasks:
        completedTasks.length,

      overdueTasks:
        overdueTasks.length,

      deadlines:
        matter.deadlines.length,

      upcomingDeadlines:
        upcomingDeadlines.length,

      overdueDeadlines:
        overdueDeadlines.length,

      criticalDeadlines:
        criticalDeadlines.length,

      assignedStaff:
        assignedStaff.length,

      activityCount:
        timeline.length,

      daysSinceActivity,
    },

    issues,

    timeline: timeline.map(
      (entry) => ({
        id: entry.id,
        action: entry.action,
        entityType: entry.entityType,
        description: entry.description,
        createdAt: entry.createdAt,
      }),
    ),
  };
}