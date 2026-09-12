import { prisma } from "@/lib/prisma";

export type IntelligenceSeverity =
  | "CRITICAL"
  | "WARNING"
  | "INFO"
  | "POSITIVE";

export type IntelligenceCategory =
  | "DEADLINE"
  | "MATTER"
  | "TASK"
  | "WORKLOAD"
  | "DOCUMENT"
  | "CLIENT"
  | "ACTIVITY"
  | "SYSTEM";

export type IntelligenceInsight = {
  id: string;
  severity: IntelligenceSeverity;
  category: IntelligenceCategory;
  title: string;
  message: string;
  recommendation: string;
  entityType?: string;
  entityId?: string;
  createdAt: string;
};

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function daysBetween(from: Date, to: Date) {
  const millisecondsPerDay =
    1000 * 60 * 60 * 24;

  return Math.ceil(
    (startOfDay(to).getTime() -
      startOfDay(from).getTime()) /
      millisecondsPerDay,
  );
}

function createInsight(
  data: Omit<
    IntelligenceInsight,
    "createdAt"
  >,
): IntelligenceInsight {
  return {
    ...data,
    createdAt:
      new Date().toISOString(),
  };
}

function formatList(
  values: string[],
  maximum = 8,
) {
  const visible =
    values.slice(0, maximum);

  const remaining =
    values.length -
    visible.length;

  if (remaining <= 0) {
    return visible.join(", ");
  }

  return `${visible.join(
    ", ",
  )} and ${remaining} more`;
}

export async function generateBusinessIntelligence(
  firmId: string,
): Promise<IntelligenceInsight[]> {
  const now = new Date();

  const today =
    startOfDay(now);

  const tomorrow =
    addDays(today, 1);

  const threeDaysFromNow =
    addDays(today, 3);

  const sevenDaysFromNow =
    addDays(today, 7);

  const thirtyDaysFromNow =
    addDays(today, 30);

  const fourteenDaysAgo =
    addDays(today, -14);

  const thirtyDaysAgo =
    addDays(today, -30);

  const [
    deadlines,
    matters,
    tasks,
    users,
    documents,
    clients,
    recentActivities,
  ] = await Promise.all([
    /*
     * ============================================================
     * DEADLINES
     * ============================================================
     */

    prisma.deadline.findMany({
      where: {
        firmId,
        status: {
          in: [
            "PENDING",
            "OVERDUE",
          ],
        },
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        priority: true,
        status: true,
        matterId: true,
        matter: {
          select: {
            id: true,
            title: true,
            referenceNumber: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        dueDate: "asc",
      },
    }),

    /*
     * ============================================================
     * MATTERS
     * ============================================================
     */

    prisma.matter.findMany({
      where: {
        firmId,
        status: {
          in: [
            "OPEN",
            "PENDING",
          ],
        },
      },
      select: {
        id: true,
        title: true,
        referenceNumber: true,
        status: true,
        updatedAt: true,
        createdAt: true,
        client: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        updatedAt: "asc",
      },
    }),

    /*
     * ============================================================
     * ACTIVE TASKS
     * ============================================================
     */

    prisma.task.findMany({
      where: {
        firmId,
        status: {
          in: [
            "TODO",
            "IN_PROGRESS",
          ],
        },
      },
      select: {
        id: true,
        title: true,
        priority: true,
        dueDate: true,
        matterId: true,
        assignedToId: true,
        matter: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        dueDate: "asc",
      },
    }),

    /*
     * ============================================================
     * ACTIVE USERS
     * ============================================================
     */

    prisma.user.findMany({
      where: {
        firmId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
        role: true,
        status: true,
      },
    }),

    /*
     * ============================================================
     * ACTIVE DOCUMENTS
     * ============================================================
     */

    prisma.document.findMany({
      where: {
        firmId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        matterId: true,
        matter: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    }),

    /*
     * ============================================================
     * CLIENTS
     * ============================================================
     */

    prisma.client.findMany({
      where: {
        firmId,
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        matters: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    }),

    /*
     * ============================================================
     * RECENT AUDIT ACTIVITY
     * ============================================================
     */

    prisma.auditLog.findMany({
      where: {
        firmId,
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    }),
  ]);

  const insights: IntelligenceInsight[] =
    [];

  /*
   * ============================================================
   * 1. DEADLINE INTELLIGENCE
   * ============================================================
   */

  const overdueDeadlines =
    deadlines.filter(
      (deadline) =>
        deadline.status ===
          "OVERDUE" ||
        new Date(
          deadline.dueDate,
        ) < today,
    );

  const deadlinesDueToday =
    deadlines.filter(
      (deadline) => {
        const dueDate =
          startOfDay(
            new Date(
              deadline.dueDate,
            ),
          );

        return (
          dueDate.getTime() ===
            today.getTime() &&
          !overdueDeadlines.some(
            (item) =>
              item.id ===
              deadline.id,
          )
        );
      },
    );

  const deadlinesDueWithin3Days =
    deadlines.filter(
      (deadline) => {
        const dueDate =
          startOfDay(
            new Date(
              deadline.dueDate,
            ),
          );

        return (
          dueDate >= tomorrow &&
          dueDate <=
            threeDaysFromNow &&
          deadline.status !==
            "OVERDUE"
        );
      },
    );

  const deadlinesDueWithin7Days =
    deadlines.filter(
      (deadline) => {
        const dueDate =
          startOfDay(
            new Date(
              deadline.dueDate,
            ),
          );

        return (
          dueDate >
            threeDaysFromNow &&
          dueDate <=
            sevenDaysFromNow &&
          deadline.status !==
            "OVERDUE"
        );
      },
    );

  const deadlinesDueWithin30Days =
    deadlines.filter(
      (deadline) => {
        const dueDate =
          startOfDay(
            new Date(
              deadline.dueDate,
            ),
          );

        return (
          dueDate >
            sevenDaysFromNow &&
          dueDate <=
            thirtyDaysFromNow &&
          deadline.status !==
            "OVERDUE"
        );
      },
    );

  const unassignedDeadlines =
    deadlines.filter(
      (deadline) =>
        !deadline.assignedTo,
    );

  if (
    overdueDeadlines.length >
    0
  ) {
    insights.push(
      createInsight({
        id: "deadline-overdue-summary",
        severity: "CRITICAL",
        category: "DEADLINE",
        title:
          "Overdue deadlines require immediate attention",
        message: `${overdueDeadlines.length} active deadline${
          overdueDeadlines.length ===
          1
            ? ""
            : "s"
        } ${
          overdueDeadlines.length ===
          1
            ? "is"
            : "are"
        } currently overdue.`,
        recommendation:
          "Review the affected matters immediately, confirm responsibility and record the required recovery action.",
      }),
    );
  }

  if (
    deadlinesDueToday.length >
    0
  ) {
    insights.push(
      createInsight({
        id: "deadline-due-today-summary",
        severity: "CRITICAL",
        category: "DEADLINE",
        title:
          "Deadlines due today",
        message: `${deadlinesDueToday.length} active deadline${
          deadlinesDueToday.length ===
          1
            ? ""
            : "s"
        } ${
          deadlinesDueToday.length ===
          1
            ? "is"
            : "are"
        } due today.`,
        recommendation:
          "Confirm that the responsible staff member has completed or is actively handling the required work.",
      }),
    );
  }

  if (
    deadlinesDueWithin3Days.length >
    0
  ) {
    insights.push(
      createInsight({
        id: "deadline-three-day-exposure",
        severity: "WARNING",
        category: "DEADLINE",
        title:
          "Deadline exposure within three days",
        message: `${deadlinesDueWithin3Days.length} active deadline${
          deadlinesDueWithin3Days.length ===
          1
            ? ""
            : "s"
        } ${
          deadlinesDueWithin3Days.length ===
          1
            ? "is"
            : "are"
        } due within the next three days.`,
        recommendation:
          "Review these deadlines and confirm that each has an assigned owner and active supporting work.",
      }),
    );
  }

  if (
    deadlinesDueWithin7Days.length >
    0
  ) {
    insights.push(
      createInsight({
        id: "deadline-seven-day-exposure",
        severity: "WARNING",
        category: "DEADLINE",
        title:
          "Deadline exposure within seven days",
        message: `${deadlinesDueWithin7Days.length} additional active deadline${
          deadlinesDueWithin7Days.length ===
          1
            ? ""
            : "s"
        } ${
          deadlinesDueWithin7Days.length ===
          1
            ? "is"
            : "are"
        } due within the next seven days.`,
        recommendation:
          "Review the affected matters and ensure the required work is progressing before the deadlines become urgent.",
      }),
    );
  }

  if (
    deadlinesDueWithin30Days.length >
    0
  ) {
    insights.push(
      createInsight({
        id: "deadline-thirty-day-exposure",
        severity: "INFO",
        category: "DEADLINE",
        title:
          "Upcoming deadline pipeline",
        message: `${deadlinesDueWithin30Days.length} active deadline${
          deadlinesDueWithin30Days.length ===
          1
            ? ""
            : "s"
        } ${
          deadlinesDueWithin30Days.length ===
          1
            ? "is"
            : "are"
        } due within the next 30 days.`,
        recommendation:
          "Use the upcoming deadline pipeline to plan staff capacity and matter activity in advance.",
      }),
    );
  }

  if (
    unassignedDeadlines.length >
    0
  ) {
    insights.push(
      createInsight({
        id: "deadline-unassigned-summary",
        severity: "WARNING",
        category: "DEADLINE",
        title:
          "Unassigned deadlines require attention",
        message: `${unassignedDeadlines.length} active deadline${
          unassignedDeadlines.length ===
          1
            ? ""
            : "s"
        } currently have no responsible staff member.`,
        recommendation:
          "Assign each deadline to a responsible attorney or staff member and confirm the due dates.",
      }),
    );
  }

  /*
   * Group deadlines by matter.
   */

  const deadlinesByMatter =
    new Map<
      string,
      typeof deadlines
    >();

  for (const deadline of deadlines) {
    const existing =
      deadlinesByMatter.get(
        deadline.matterId,
      ) ?? [];

    existing.push(
      deadline,
    );

    deadlinesByMatter.set(
      deadline.matterId,
      existing,
    );
  }

  const deadlineClusterMatters: string[] =
    [];

  for (const [
    matterId,
    matterDeadlines,
  ] of deadlinesByMatter.entries()) {
    if (
      matterDeadlines.length >=
      3
    ) {
      deadlineClusterMatters.push(
        matterId,
      );
    }
  }

  if (
    deadlineClusterMatters.length >
    0
  ) {
    insights.push(
      createInsight({
        id: "deadline-cluster-summary",
        severity: "WARNING",
        category: "DEADLINE",
        title:
          "Multiple deadlines concentrated on matters",
        message: `${deadlineClusterMatters.length} matter${
          deadlineClusterMatters.length ===
          1
            ? ""
            : "s"
        } currently have three or more active deadlines.`,
        recommendation:
          "Review the affected matter timelines and ensure deadlines are sequenced correctly and supported by tasks.",
      }),
    );
  }

  /*
   * ============================================================
   * 2. MATTER INTELLIGENCE
   * ============================================================
   *
   * IMPORTANT:
   *
   * Missing tasks, missing deadlines and missing documents are
   * INFORMATION signals.
   *
   * They are deliberately NOT inserted into matterRiskMap.
   *
   * Genuine matter risk is based on:
   * - overdue deadlines
   * - overdue tasks
   * - critical deadlines
   * - imminent deadlines without supporting tasks
   * - extended inactivity
   *
   * This prevents an ordinary information gap from becoming a
   * false "high risk" matter.
   * ============================================================
   */

  const activeTaskMatterIds =
    new Set(
      tasks
        .map(
          (task) =>
            task.matterId,
        )
        .filter(
          (
            matterId,
          ): matterId is string =>
            matterId !== null,
        ),
    );

  const documentsByMatter =
    new Map<
      string,
      number
    >();

  for (const document of documents) {
    if (!document.matterId) {
      continue;
    }

    documentsByMatter.set(
      document.matterId,
      (documentsByMatter.get(
        document.matterId,
      ) ?? 0) + 1,
    );
  }

  /*
   * ------------------------------------------------------------
   * TRUE MATTER RISK REGISTER
   * ------------------------------------------------------------
   */

  const matterRiskMap =
    new Map<
      string,
      {
        referenceNumber: string;
        title: string;
        clientName: string;
        risks: string[];
      }
    >();

  for (const matter of matters) {
    const risks: string[] =
      [];

    const daysSinceUpdate =
      daysBetween(
        new Date(
          matter.updatedAt,
        ),
        today,
      );

    const matterDeadlines =
      deadlinesByMatter.get(
        matter.id,
      ) ?? [];

    const matterActiveTasks =
      tasks.filter(
        (task) =>
          task.matterId ===
          matter.id,
      );

    const matterOverdueDeadlines =
      matterDeadlines.filter(
        (deadline) =>
          deadline.status ===
            "OVERDUE" ||
          new Date(
            deadline.dueDate,
          ) < today,
      );

    const matterOverdueTasks =
      matterActiveTasks.filter(
        (task) =>
          task.dueDate &&
          new Date(
            task.dueDate,
          ) < today,
      );

    const matterCriticalDeadlines =
      matterDeadlines.filter(
        (deadline) =>
          deadline.priority ===
          "CRITICAL",
      );

    const matterImminentDeadlines =
      matterDeadlines.filter(
        (deadline) => {
          const dueDate =
            startOfDay(
              new Date(
                deadline.dueDate,
              ),
            );

          const daysUntilDue =
            daysBetween(
              today,
              dueDate,
            );

          return (
            daysUntilDue >= 0 &&
            daysUntilDue <= 7 &&
            deadline.status !==
              "OVERDUE"
          );
        },
      );

    /*
     * ----------------------------------------------------------
     * TRUE CRITICAL RISK
     * ----------------------------------------------------------
     */

    if (
      matterOverdueDeadlines.length >
      0
    ) {
      risks.push(
        "overdue deadlines",
      );
    }

    if (
      matterOverdueTasks.length >
      0
    ) {
      risks.push(
        "overdue tasks",
      );
    }

    if (
      matterCriticalDeadlines.length >
      0
    ) {
      risks.push(
        "critical deadlines",
      );
    }

    /*
     * ----------------------------------------------------------
     * SIGNIFICANT BUT NON-CRITICAL RISK
     * ----------------------------------------------------------
     */

    if (
      matterImminentDeadlines.length >
        0 &&
      matterActiveTasks.length ===
        0
    ) {
      risks.push(
        "imminent deadlines without active tasks",
      );
    }

    if (
      daysSinceUpdate >= 30
    ) {
      risks.push(
        "extended inactivity",
      );
    }

    /*
     * IMPORTANT:
     *
     * We deliberately DO NOT add:
     *
     * - "no active deadlines"
     * - "no active tasks"
     * - "no active documents"
     * - 14-day inactivity
     *
     * to the true risk register.
     *
     * Those are handled as information/attention
     * signals separately.
     */

    if (
      risks.length > 0
    ) {
      matterRiskMap.set(
        matter.id,
        {
          referenceNumber:
            matter.referenceNumber,
          title:
            matter.title,
          clientName:
            matter.client.name,
          risks,
        },
      );
    }

    /*
     * ----------------------------------------------------------
     * MATTER INACTIVITY
     * ----------------------------------------------------------
     */

    if (
      daysSinceUpdate >= 30
    ) {
      insights.push(
        createInsight({
          id: `matter-aging-${matter.id}`,
          severity: "WARNING",
          category: "MATTER",
          title:
            "Matter has been inactive for an extended period",
          message: `Matter ${matter.referenceNumber} has not been updated for approximately ${daysSinceUpdate} days.`,
          recommendation:
            "Review the matter status, client position, pending work and next required action.",
          entityType:
            "Matter",
          entityId:
            matter.id,
        }),
      );
    } else if (
      daysSinceUpdate >= 14
    ) {
      insights.push(
        createInsight({
          id: `matter-inactive-${matter.id}`,
          severity: "WARNING",
          category: "MATTER",
          title:
            "Matter appears inactive",
          message: `Matter ${matter.referenceNumber} has had no recorded update for approximately ${daysSinceUpdate} days.`,
          recommendation:
            "Review the matter and create a follow-up task if work is still required.",
          entityType:
            "Matter",
          entityId:
            matter.id,
        }),
      );
    }
  }

  /*
   * ------------------------------------------------------------
   * MATTERS WITHOUT DEADLINES
   * ------------------------------------------------------------
   *
   * INFORMATION ONLY.
   */

  const mattersWithoutDeadlines =
    matters.filter(
      (matter) =>
        !deadlinesByMatter.has(
          matter.id,
        ),
    );

  if (
    mattersWithoutDeadlines.length >
    0
  ) {
    insights.push(
      createInsight({
        id: "matter-no-deadlines-grouped",
        severity: "INFO",
        category: "MATTER",
        title: `${mattersWithoutDeadlines.length} ${
          mattersWithoutDeadlines.length ===
          1
            ? "matter has"
            : "matters have"
        } no active deadlines`,
        message: `${mattersWithoutDeadlines.length} active matter${
          mattersWithoutDeadlines.length ===
          1
            ? ""
            : "s"
        } currently have no active deadlines recorded. Affected matters: ${formatList(
          mattersWithoutDeadlines.map(
            (matter) =>
              matter.referenceNumber,
          ),
        )}.`,
        recommendation:
          "Review each affected matter and record applicable court, regulatory, contractual or internal deadlines where appropriate.",
      }),
    );
  }

  /*
   * ------------------------------------------------------------
   * MATTERS WITHOUT ACTIVE TASKS
   * ------------------------------------------------------------
   *
   * INFORMATION ONLY.
   */

  const mattersWithoutTasks =
    matters.filter(
      (matter) =>
        !activeTaskMatterIds.has(
          matter.id,
        ),
    );

  if (
    mattersWithoutTasks.length >
    0
  ) {
    insights.push(
      createInsight({
        id: "matter-no-active-task-summary",
        severity: "INFO",
        category: "MATTER",
        title: `${mattersWithoutTasks.length} ${
          mattersWithoutTasks.length ===
          1
            ? "active matter has"
            : "active matters have"
        } no current tasks`,
        message: `${mattersWithoutTasks.length} active matter${
          mattersWithoutTasks.length ===
          1
            ? ""
            : "s"
        } currently have no active task. Affected matters: ${formatList(
          mattersWithoutTasks.map(
            (matter) =>
              matter.referenceNumber,
          ),
        )}.`,
        recommendation:
          "Confirm whether the matters are awaiting external action or create next-action tasks where appropriate.",
      }),
    );
  }

  /*
   * ============================================================
   * 3. MATTER RISK REGISTER
   * ============================================================
   *
   * This section now uses ONLY genuine matter-risk indicators.
   *
   * A matter with:
   * - no documents
   * - no tasks
   * - no deadlines
   *
   * will NOT appear here as a risky matter.
   * ============================================================
   */

  const criticalRiskMatters =
    Array.from(
      matterRiskMap.entries(),
    ).filter(
      ([, risk]) =>
        risk.risks.includes(
          "overdue deadlines",
        ) ||
        risk.risks.includes(
          "overdue tasks",
        ) ||
        risk.risks.includes(
          "critical deadlines",
        ),
    );

  const warningRiskMatters =
    Array.from(
      matterRiskMap.entries(),
    ).filter(
      ([matterId, risk]) => {
        const isCritical =
          criticalRiskMatters.some(
            ([
              criticalMatterId,
            ]) =>
              criticalMatterId ===
              matterId,
          );

        if (isCritical) {
          return false;
        }

        return (
          risk.risks.includes(
            "imminent deadlines without active tasks",
          ) ||
          risk.risks.includes(
            "extended inactivity",
          )
        );
      },
    );

  if (
    criticalRiskMatters.length >
    0
  ) {
    insights.push(
      createInsight({
        id: "matter-critical-risk-register",
        severity: "CRITICAL",
        category: "MATTER",
        title:
          "Critical matter risk exposure detected",
        message: `${criticalRiskMatters.length} active matter${
          criticalRiskMatters.length ===
          1
            ? ""
            : "s"
        } have genuine critical operational risk indicators. Affected matters: ${formatList(
          criticalRiskMatters.map(
            ([, risk]) =>
              `${risk.referenceNumber} (${risk.risks.join(
                ", ",
              )})`,
          ),
        )}.`,
        recommendation:
          "Review the affected matters immediately. Prioritise overdue deadlines, overdue tasks and critical deadlines, and escalate or reassign work where necessary.",
      }),
    );
  }

  if (
    warningRiskMatters.length >
    0
  ) {
    insights.push(
      createInsight({
        id: "matter-warning-risk-register",
        severity: "WARNING",
        category: "MATTER",
        title:
          "Matter requires operational attention",
        message: `${warningRiskMatters.length} active matter${
          warningRiskMatters.length ===
          1
            ? ""
            : "s"
        } have significant but non-critical operational indicators. Affected matters: ${formatList(
          warningRiskMatters.map(
            ([, risk]) =>
              `${risk.referenceNumber} (${risk.risks.join(
                ", ",
              )})`,
          ),
        )}.`,
        recommendation:
          "Review the affected matters and create or confirm the next required actions before the issues become urgent.",
      }),
    );
  }

  /*
   * Only show this positive signal when there are genuinely
   * no critical or warning-level matter risks.
   */

  if (
    criticalRiskMatters.length ===
      0 &&
    warningRiskMatters.length ===
      0
  ) {
    insights.push(
      createInsight({
        id: "matter-risk-healthy",
        severity: "POSITIVE",
        category: "MATTER",
        title:
          "No immediate matter risk detected",
        message:
          "No active matter currently has overdue deadlines, overdue tasks, critical deadlines, imminent deadlines without supporting tasks or extended inactivity.",
        recommendation:
          "Continue monitoring matter activity, deadlines and task ownership as new work is recorded.",
      }),
    );
  }

  /*
   * ============================================================
   * 4. TASK INTELLIGENCE
   * ============================================================
   */

  const unassignedTasks =
    tasks.filter(
      (task) =>
        !task.assignedToId,
    );

  const overdueTasks =
    tasks.filter(
      (task) =>
        task.dueDate &&
        new Date(
          task.dueDate,
        ) < today,
    );

  const urgentTasks =
    tasks.filter(
      (task) =>
        task.priority ===
        "URGENT",
    );

  const highPriorityTasks =
    tasks.filter(
      (task) =>
        task.priority ===
          "HIGH" ||
        task.priority ===
          "URGENT",
    );

  if (
    unassignedTasks.length >
    0
  ) {
    insights.push(
      createInsight({
        id: "task-unassigned-summary",
        severity: "WARNING",
        category: "TASK",
        title:
          "Unassigned work exists",
        message: `${unassignedTasks.length} active task${
          unassignedTasks.length ===
          1
            ? ""
            : "s"
        } currently have no assigned staff member.`,
        recommendation:
          "Allocate the tasks to responsible staff and establish clear ownership.",
      }),
    );
  }

  if (
    overdueTasks.length >
    0
  ) {
    insights.push(
      createInsight({
        id: "task-overdue-summary",
        severity: "CRITICAL",
        category: "TASK",
        title:
          "Overdue task workload detected",
        message: `${overdueTasks.length} active task${
          overdueTasks.length ===
          1
            ? ""
            : "s"
        } ${
          overdueTasks.length ===
          1
            ? "is"
            : "are"
        } currently overdue.`,
        recommendation:
          "Review overdue work immediately, identify blockers and either complete, reassign or revise the affected tasks.",
      }),
    );
  }

  if (
    urgentTasks.length >
    0
  ) {
    insights.push(
      createInsight({
        id: "task-urgent-pressure",
        severity:
          urgentTasks.length >=
          3
            ? "WARNING"
            : "INFO",
        category: "TASK",
        title:
          "Urgent task workload",
        message: `There ${
          urgentTasks.length ===
          1
            ? "is"
            : "are"
        } ${urgentTasks.length} active urgent-priority task${
          urgentTasks.length ===
          1
            ? ""
            : "s"
        }.`,
        recommendation:
          "Review urgent work and confirm that the responsible staff members have sufficient capacity.",
      }),
    );
  }

  if (
    highPriorityTasks.length >=
    5
  ) {
    insights.push(
      createInsight({
        id: "task-high-priority-pressure",
        severity: "WARNING",
        category: "TASK",
        title:
          "High-priority workload is elevated",
        message: `${highPriorityTasks.length} active tasks have high or urgent priority.`,
        recommendation:
          "Review priorities across matters and redistribute work where appropriate.",
      }),
    );
  }

  /*
   * Upcoming deadline without supporting task.
   *
   * This is a genuine warning because a deadline exists and
   * there is no active work supporting it.
   */

  const deadlineWithoutTask =
    deadlines.filter(
      (deadline) =>
        new Date(
          deadline.dueDate,
        ) >= today &&
        new Date(
          deadline.dueDate,
        ) <=
          sevenDaysFromNow &&
        !activeTaskMatterIds.has(
          deadline.matterId,
        ),
    );

  if (
    deadlineWithoutTask.length >
    0
  ) {
    insights.push(
      createInsight({
        id: "deadline-no-task-summary",
        severity: "WARNING",
        category: "DEADLINE",
        title:
          "Upcoming deadlines lack active supporting tasks",
        message: `${deadlineWithoutTask.length} deadline${
          deadlineWithoutTask.length ===
          1
            ? ""
            : "s"
        } due within seven days ${
          deadlineWithoutTask.length ===
          1
            ? "has"
            : "have"
        } no active task on the associated matter.`,
        recommendation:
          "Create and assign tasks covering the work required to meet these deadlines.",
      }),
    );
  }

  /*
   * ============================================================
   * 5. WORKLOAD INTELLIGENCE
   * ============================================================
   */

  const workloadByUser =
    new Map<
      string,
      {
        name: string;
        role: string;
        activeTasks: number;
        overdueTasks: number;
        urgentTasks: number;
        highPriorityTasks: number;
        deadlines: number;
        overdueDeadlines: number;
      }
    >();

  for (const user of users) {
    workloadByUser.set(
      user.id,
      {
        name: user.name,
        role: user.role,
        activeTasks: 0,
        overdueTasks: 0,
        urgentTasks: 0,
        highPriorityTasks: 0,
        deadlines: 0,
        overdueDeadlines: 0,
      },
    );
  }

  for (const task of tasks) {
    if (
      !task.assignedToId
    ) {
      continue;
    }

    const workload =
      workloadByUser.get(
        task.assignedToId,
      );

    if (!workload) {
      continue;
    }

    workload.activeTasks +=
      1;

    if (
      task.dueDate &&
      new Date(
        task.dueDate,
      ) < today
    ) {
      workload.overdueTasks +=
        1;
    }

    if (
      task.priority ===
      "URGENT"
    ) {
      workload.urgentTasks +=
        1;
    }

    if (
      task.priority ===
        "HIGH" ||
      task.priority ===
        "URGENT"
    ) {
      workload.highPriorityTasks +=
        1;
    }
  }

  for (const deadline of deadlines) {
    if (
      !deadline.assignedTo
    ) {
      continue;
    }

    const workload =
      workloadByUser.get(
        deadline.assignedTo.id,
      );

    if (!workload) {
      continue;
    }

    workload.deadlines +=
      1;

    if (
      deadline.status ===
        "OVERDUE" ||
      new Date(
        deadline.dueDate,
      ) < today
    ) {
      workload.overdueDeadlines +=
        1;
    }
  }

  const workloadEntries =
    Array.from(
      workloadByUser.entries(),
    );

  for (const [
    userId,
    workload,
  ] of workloadEntries) {
    if (
      workload.activeTasks >=
      15
    ) {
      insights.push(
        createInsight({
          id: `workload-very-high-${userId}`,
          severity: "CRITICAL",
          category: "WORKLOAD",
          title:
            "Very high individual workload",
          message: `${workload.name} currently has ${workload.activeTasks} active tasks.`,
          recommendation:
            "Review the staff member's workload and redistribute tasks where possible.",
          entityType:
            "User",
          entityId:
            userId,
        }),
      );
    } else if (
      workload.activeTasks >=
      10
    ) {
      insights.push(
        createInsight({
          id: `workload-high-${userId}`,
          severity: "WARNING",
          category: "WORKLOAD",
          title:
            "High individual workload",
          message: `${workload.name} currently has ${workload.activeTasks} active tasks.`,
          recommendation:
            "Review task allocation and consider redistributing lower-priority work.",
          entityType:
            "User",
          entityId:
            userId,
        }),
      );
    }

    if (
      workload.overdueTasks >=
      3
    ) {
      insights.push(
        createInsight({
          id: `workload-overdue-${userId}`,
          severity: "WARNING",
          category: "WORKLOAD",
          title:
            "Staff member has multiple overdue tasks",
          message: `${workload.name} has ${workload.overdueTasks} overdue active tasks.`,
          recommendation:
            "Review the staff member's overdue workload and identify blockers or tasks that can be reassigned.",
          entityType:
            "User",
          entityId:
            userId,
        }),
      );
    }

    if (
      workload.urgentTasks >=
      3
    ) {
      insights.push(
        createInsight({
          id: `workload-urgent-${userId}`,
          severity: "WARNING",
          category: "WORKLOAD",
          title:
            "Concentrated urgent workload",
          message: `${workload.name} has ${workload.urgentTasks} urgent active tasks.`,
          recommendation:
            "Review whether urgent matters are appropriately distributed across the team.",
          entityType:
            "User",
          entityId:
            userId,
        }),
      );
    }

    if (
      workload.overdueDeadlines >=
      2
    ) {
      insights.push(
        createInsight({
          id: `workload-deadline-overdue-${userId}`,
          severity: "CRITICAL",
          category: "WORKLOAD",
          title:
            "Staff member has multiple overdue deadlines",
          message: `${workload.name} is responsible for ${workload.overdueDeadlines} overdue deadlines.`,
          recommendation:
            "Review the affected matters immediately and consider reassignment or escalation where appropriate.",
          entityType:
            "User",
          entityId:
            userId,
        }),
      );
    }
  }

  /*
   * Workload concentration.
   */

  if (
    users.length > 0 &&
    tasks.length >= 5
  ) {
    const sortedWorkload =
      [
        ...workloadEntries,
      ].sort(
        (a, b) =>
          b[1].activeTasks -
          a[1].activeTasks,
      );

    const highest =
      sortedWorkload[0];

    if (
      highest &&
      highest[1].activeTasks >=
        5 &&
      highest[1].activeTasks /
        tasks.length >=
        0.5
    ) {
      insights.push(
        createInsight({
          id: "workload-concentration",
          severity: "WARNING",
          category: "WORKLOAD",
          title:
            "Workload concentration detected",
          message: `${highest[1].name} is currently carrying a large proportion of the firm's active task workload.`,
          recommendation:
            "Review task distribution across the team and consider reallocating appropriate work.",
          entityType:
            "User",
          entityId:
            highest[0],
        }),
      );
    }
  }

  /*
   * No active tasks.
   *
   * INFORMATION ONLY.
   */

  if (
    tasks.length === 0 &&
    matters.length > 0
  ) {
    insights.push(
      createInsight({
        id: "workload-no-active-tasks",
        severity: "INFO",
        category: "WORKLOAD",
        title:
          "No active tasks recorded",
        message: `The firm currently has ${matters.length} active matter${
          matters.length ===
          1
            ? ""
            : "s"
        } but no active tasks.`,
        recommendation:
          "Confirm whether work is being tracked elsewhere or create tasks for current matter activities.",
      }),
    );
  }

  if (
    overdueTasks.length >
    0
  ) {
    insights.push(
      createInsight({
        id: "workload-overdue-summary",
        severity: "WARNING",
        category: "WORKLOAD",
        title:
          "Overdue workload exists",
        message: `${overdueTasks.length} active task${
          overdueTasks.length ===
          1
            ? ""
            : "s"
        } are currently overdue.`,
        recommendation:
          "Review overdue work across the firm and address blockers or reassignment requirements.",
      }),
    );
  }

  /*
   * ============================================================
   * 6. DOCUMENT INTELLIGENCE
   * ============================================================
   */

  const mattersWithoutDocuments =
    matters.filter(
      (matter) =>
        !documentsByMatter.has(
          matter.id,
        ),
    );

  if (
    mattersWithoutDocuments.length >
    0
  ) {
    insights.push(
      createInsight({
        id: "documents-missing-summary",
        severity: "INFO",
        category: "DOCUMENT",
        title:
          "Active matters are missing documents",
        message: `${mattersWithoutDocuments.length} active matter${
          mattersWithoutDocuments.length ===
          1
            ? ""
            : "s"
        } currently have no active documents recorded. Affected matters: ${formatList(
          mattersWithoutDocuments.map(
            (matter) =>
              matter.referenceNumber,
          ),
        )}.`,
        recommendation:
          "Confirm whether supporting documents have been uploaded and correctly linked to the relevant matters.",
      }),
    );
  }

  /*
   * ============================================================
   * 7. CLIENT INTELLIGENCE
   * ============================================================
   */

  const clientsWithActiveMatters =
    clients
      .map(
        (client) => {
          const activeMatters =
            client.matters.filter(
              (matter) =>
                matter.status ===
                  "OPEN" ||
                matter.status ===
                  "PENDING",
            );

          return {
            ...client,
            activeMatters,
          };
        },
      )
      .filter(
        (client) =>
          client.activeMatters
            .length > 0,
      );

  for (const client of clientsWithActiveMatters) {
    if (
      client.activeMatters
        .length >= 5
    ) {
      insights.push(
        createInsight({
          id: `client-high-volume-${client.id}`,
          severity: "INFO",
          category: "CLIENT",
          title:
            "High-volume client relationship",
          message: `${client.name} has ${client.activeMatters.length} active matters.`,
          recommendation:
            "Review the client relationship, matter allocation and overall workload associated with this client.",
          entityType:
            "Client",
          entityId:
            client.id,
        }),
      );
    }
  }

  const totalActiveClientMatters =
    clientsWithActiveMatters.reduce(
      (
        total,
        client,
      ) =>
        total +
        client.activeMatters
          .length,
      0,
    );

  const topClient =
    [
      ...clientsWithActiveMatters,
    ].sort(
      (a, b) =>
        b.activeMatters
          .length -
        a.activeMatters
          .length,
    )[0];

  if (
    topClient &&
    totalActiveClientMatters >=
      10 &&
    topClient.activeMatters
      .length /
      totalActiveClientMatters >=
      0.5
  ) {
    insights.push(
      createInsight({
        id: "client-concentration",
        severity: "WARNING",
        category: "CLIENT",
        title:
          "Client concentration detected",
        message: `${topClient.name} accounts for a significant proportion of the firm's active matter portfolio.`,
        recommendation:
          "Monitor workload and commercial exposure associated with this client.",
        entityType:
          "Client",
        entityId:
          topClient.id,
      }),
    );
  }

  /*
   * ============================================================
   * 8. ACTIVITY INTELLIGENCE
   * ============================================================
   */

  const activityCount =
    recentActivities.length;

  const todayActivityCount =
    recentActivities.filter(
      (activity) =>
        new Date(
          activity.createdAt,
        ) >= today,
    ).length;

  const activeUsersWithActivity =
    new Set(
      recentActivities
        .map(
          (activity) =>
            activity.user?.id,
        )
        .filter(
          (
            id,
          ): id is string =>
            Boolean(id),
        ),
    );

  if (
    activityCount === 0 &&
    matters.length > 0
  ) {
    insights.push(
      createInsight({
        id: "activity-none",
        severity: "WARNING",
        category: "ACTIVITY",
        title:
          "No recent firm activity recorded",
        message:
          "No audit activity has been recorded for the firm during the last 30 days.",
        recommendation:
          "Confirm that users are actively working through LegalVault and that audit logging is functioning correctly.",
      }),
    );
  } else if (
    activityCount > 0 &&
    activeUsersWithActivity.size <
      users.length
  ) {
    const inactiveUsers =
      users.filter(
        (user) =>
          !activeUsersWithActivity.has(
            user.id,
          ),
      );

    if (
      inactiveUsers.length >
      0
    ) {
      insights.push(
        createInsight({
          id: "activity-low-user-participation",
          severity: "INFO",
          category: "ACTIVITY",
          title:
            "Low staff activity participation",
          message: `${inactiveUsers.length} active staff member${
            inactiveUsers.length ===
            1
              ? ""
              : "s"
          } have no recorded audit activity during the last 30 days.`,
          recommendation:
            "Review whether these users require system access, training or workload allocation.",
        }),
      );
    }
  }

  if (
    todayActivityCount ===
      0 &&
    matters.length > 0
  ) {
    insights.push(
      createInsight({
        id: "activity-none-today",
        severity: "INFO",
        category: "ACTIVITY",
        title:
          "No activity recorded today",
        message:
          "No LegalVault activity has been recorded today.",
        recommendation:
          "Confirm whether this reflects normal operating patterns or whether users are working outside the system.",
      }),
    );
  } else if (
    todayActivityCount > 0
  ) {
    insights.push(
      createInsight({
        id: "activity-positive-today",
        severity: "POSITIVE",
        category: "ACTIVITY",
        title:
          "Firm activity recorded today",
        message: `${todayActivityCount} audit activit${
          todayActivityCount ===
          1
            ? "y has"
            : "ies have"
        } been recorded today.`,
        recommendation:
          "Continue using LegalVault as the central system for matter and document activity.",
      }),
    );
  }

  /*
   * ============================================================
   * 9. POSITIVE PORTFOLIO INTELLIGENCE
   * ============================================================
   */

  if (
    matters.length > 0 &&
    overdueTasks.length ===
      0 &&
    overdueDeadlines.length ===
      0
  ) {
    insights.push(
      createInsight({
        id: "portfolio-no-overdue-items",
        severity: "POSITIVE",
        category: "MATTER",
        title:
          "No overdue tasks or deadlines detected",
        message:
          "The current portfolio does not contain overdue active tasks or deadlines.",
        recommendation:
          "Maintain the current monitoring and task-management discipline.",
      }),
    );
  }

  if (
    matters.length > 0 &&
    documents.length > 0
  ) {
    insights.push(
      createInsight({
        id: "portfolio-document-coverage",
        severity: "POSITIVE",
        category: "DOCUMENT",
        title:
          "Document management is active",
        message: `${documents.length} active document${
          documents.length ===
          1
            ? ""
            : "s"
        } are currently stored in LegalVault.`,
        recommendation:
          "Continue linking documents to matters and maintaining accurate document records.",
      }),
    );
  }

  /*
   * ============================================================
   * 10. SYSTEM HEALTH / OPERATIONAL SNAPSHOT
   * ============================================================
   */

  const totalActiveMatters =
    matters.length;

  const totalActiveTasks =
    tasks.length;

  const totalActiveDeadlines =
    deadlines.length;

  const totalActiveDocuments =
    documents.length;

  insights.push(
    createInsight({
      id: "system-operational-snapshot",
      severity: "INFO",
      category: "SYSTEM",
      title:
        "Operational workload snapshot",
      message: `${totalActiveMatters} active matters, ${totalActiveTasks} active tasks, ${totalActiveDeadlines} active deadlines and ${totalActiveDocuments} active documents are currently recorded.`,
      recommendation:
        "Use this snapshot together with the detailed intelligence sections to monitor operational performance.",
    }),
  );

  /*
   * ============================================================
   * 11. GLOBAL HEALTH SIGNAL
   * ============================================================
   *
   * If there are no CRITICAL or WARNING insights at all,
   * provide a firm-wide positive operational signal.
   *
   * This does NOT replace information insights.
   * Information gaps can still be displayed alongside it.
   * ============================================================
   */

  const hasCriticalOrWarning =
    insights.some(
      (insight) =>
        insight.severity ===
          "CRITICAL" ||
        insight.severity ===
          "WARNING",
    );

  if (
    !hasCriticalOrWarning
  ) {
    insights.push(
      createInsight({
        id: "system-no-immediate-risks",
        severity: "POSITIVE",
        category: "SYSTEM",
        title:
          "No immediate operational risks detected",
        message:
          "LegalVault has not identified any critical or warning-level operational risks using the current intelligence rules.",
        recommendation:
          "Continue monitoring deadlines, tasks, matter activity, workload and document records.",
      }),
    );
  }

  /*
   * ============================================================
   * 12. DUPLICATE SAFEGUARD
   * ============================================================
   *
   * Prevents the same intelligence signal from being returned
   * more than once.
   * ============================================================
   */

  const uniqueInsights: IntelligenceInsight[] =
    [];

  const seen =
    new Set<string>();

  for (const insight of insights) {
    const key = [
      insight.category,
      insight.severity,
      insight.title,
      insight.entityType ??
        "",
      insight.entityId ??
        "",
    ].join("|");

    if (
      seen.has(key)
    ) {
      continue;
    }

    seen.add(key);
    uniqueInsights.push(
      insight,
    );
  }

  /*
   * ============================================================
   * 13. SORTING
   * ============================================================
   */

  const severityOrder: Record<
    IntelligenceSeverity,
    number
  > = {
    CRITICAL: 1,
    WARNING: 2,
    INFO: 3,
    POSITIVE: 4,
  };

  const categoryOrder: Record<
    IntelligenceCategory,
    number
  > = {
    DEADLINE: 1,
    MATTER: 2,
    TASK: 3,
    WORKLOAD: 4,
    DOCUMENT: 5,
    CLIENT: 6,
    ACTIVITY: 7,
    SYSTEM: 8,
  };

  uniqueInsights.sort(
    (a, b) => {
      const severityDifference =
        severityOrder[
          a.severity
        ] -
        severityOrder[
          b.severity
        ];

      if (
        severityDifference !==
        0
      ) {
        return severityDifference;
      }

      const categoryDifference =
        categoryOrder[
          a.category
        ] -
        categoryOrder[
          b.category
        ];

      if (
        categoryDifference !==
        0
      ) {
        return categoryDifference;
      }

      return a.title.localeCompare(
        b.title,
      );
    },
  );

  return uniqueInsights;
}