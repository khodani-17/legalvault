import {
  Activity,
  AlertTriangle,
  BarChart3,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  Gauge,
  TrendingUp,
  UserCheck,
  UserX,
  Users,
  XCircle,
} from "lucide-react";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getBusinessIntelligenceOverview } from "@/lib/business-intelligence/analytics";
import { redirect } from "next/navigation";

import BICharts from "./BICharts";
import BIInsights from "./BIInsights";

type StaffPerformance = {
  staff: {
    id: string;
    name: string;
    role: string;
    activeTasks: number;
    overdueTasks: number;
    completedTasks: number;
    highPriorityTasks: number;
    urgentTasks: number;
    upcomingDeadlines: number;
    overdueDeadlines: number;
    criticalDeadlines: number;
    totalDeadlineWorkload: number;
    completionRate: number;
  }[];

  totals: {
    totalActiveTasks: number;
    assignedActiveTasks: number;
    unassignedActiveTasks: number;
    totalCompletedTasks: number;
    totalTrackedTasks: number;
    firmCompletionRate: number;
    averageActiveTasks: number;
    highestActiveTasks: number;
  };

  alerts: {
    overloadedStaff: number;
    highOverdueStaff: number;
    highDeadlineStaff: number;
    urgentStaff: number;
  };
};

function percentage(value: number, total: number) {
  if (!total) return 0;

  return Math.round((value / total) * 100);
}

function formatRole(role: string) {
  return role
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-ZA").format(value);
}

async function getStaffPerformanceData(
  firmId: string,
): Promise<StaffPerformance> {
  const [users, activeTasks, completedTasks, deadlines] =
    await Promise.all([
      prisma.user.findMany({
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
      }),

      prisma.task.findMany({
        where: {
          firmId,
          status: {
            in: ["TODO", "IN_PROGRESS"],
          },
        },
        select: {
          id: true,
          assignedToId: true,
          dueDate: true,
          priority: true,
        },
      }),

      prisma.task.findMany({
        where: {
          firmId,
          status: "COMPLETED",
        },
        select: {
          id: true,
          assignedToId: true,
        },
      }),

      prisma.deadline.findMany({
        where: {
          firmId,
          status: {
            notIn: ["COMPLETED", "CANCELLED"],
          },
        },
        select: {
          id: true,
          assignedToId: true,
          dueDate: true,
          priority: true,
          status: true,
        },
      }),
    ]);

  const now = new Date();

  const staff = users.map((user) => {
    const userActiveTasks = activeTasks.filter(
      (task) => task.assignedToId === user.id,
    );

    const userCompletedTasks = completedTasks.filter(
      (task) => task.assignedToId === user.id,
    );

    const userDeadlines = deadlines.filter(
      (deadline) => deadline.assignedToId === user.id,
    );

    const overdueTasks = userActiveTasks.filter(
      (task) =>
        task.dueDate &&
        new Date(task.dueDate) < now,
    ).length;

    const highPriorityTasks = userActiveTasks.filter(
      (task) => task.priority === "HIGH",
    ).length;

    const urgentTasks = userActiveTasks.filter(
      (task) => task.priority === "URGENT",
    ).length;

    const overdueDeadlines = userDeadlines.filter(
      (deadline) =>
        deadline.dueDate &&
        new Date(deadline.dueDate) < now,
    ).length;

    const upcomingDeadlines = userDeadlines.filter(
      (deadline) =>
        deadline.dueDate &&
        new Date(deadline.dueDate) >= now,
    ).length;

    const criticalDeadlines = userDeadlines.filter(
      (deadline) => deadline.priority === "CRITICAL",
    ).length;

    const totalTrackedTasks =
      userActiveTasks.length +
      userCompletedTasks.length;

    const completionRate = totalTrackedTasks
      ? Math.round(
          (userCompletedTasks.length /
            totalTrackedTasks) *
            100,
        )
      : 0;

    return {
      id: user.id,
      name: user.name,
      role: user.role,
      activeTasks: userActiveTasks.length,
      overdueTasks,
      completedTasks: userCompletedTasks.length,
      highPriorityTasks,
      urgentTasks,
      upcomingDeadlines,
      overdueDeadlines,
      criticalDeadlines,
      totalDeadlineWorkload: userDeadlines.length,
      completionRate,
    };
  });

  const totalActiveTasks = activeTasks.length;

  const assignedActiveTasks = activeTasks.filter(
    (task) => task.assignedToId !== null,
  ).length;

  const unassignedActiveTasks = activeTasks.filter(
    (task) => task.assignedToId === null,
  ).length;

  const totalCompletedTasks = completedTasks.length;

  const totalTrackedTasks =
    totalActiveTasks + totalCompletedTasks;

  const firmCompletionRate = totalTrackedTasks
    ? Math.round(
        (totalCompletedTasks /
          totalTrackedTasks) *
          100,
      )
    : 0;

  const averageActiveTasks = users.length
    ? Math.round(
        (totalActiveTasks / users.length) * 10,
      ) / 10
    : 0;

  const highestActiveTasks = staff.length
    ? Math.max(
        ...staff.map(
          (member) => member.activeTasks,
        ),
      )
    : 0;

  const overloadedStaff = staff.filter(
    (member) =>
      member.activeTasks >= 10 ||
      member.activeTasks >
        averageActiveTasks * 2,
  ).length;

  const highOverdueStaff = staff.filter(
    (member) => member.overdueTasks >= 3,
  ).length;

  const highDeadlineStaff = staff.filter(
    (member) =>
      member.totalDeadlineWorkload >= 5,
  ).length;

  const urgentStaff = staff.filter(
    (member) => member.urgentTasks > 0,
  ).length;

  staff.sort((a, b) => {
    if (b.activeTasks !== a.activeTasks) {
      return b.activeTasks - a.activeTasks;
    }

    if (b.overdueTasks !== a.overdueTasks) {
      return b.overdueTasks - a.overdueTasks;
    }

    return b.completedTasks - a.completedTasks;
  });

  return {
    staff,
    totals: {
      totalActiveTasks,
      assignedActiveTasks,
      unassignedActiveTasks,
      totalCompletedTasks,
      totalTrackedTasks,
      firmCompletionRate,
      averageActiveTasks,
      highestActiveTasks,
    },
    alerts: {
      overloadedStaff,
      highOverdueStaff,
      highDeadlineStaff,
      urgentStaff,
    },
  };
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  danger = false,
  positive = false,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: React.ElementType;
  danger?: boolean;
  positive?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border bg-white p-5 shadow-sm ${
        danger
          ? "border-red-200"
          : positive
            ? "border-green-200"
            : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>

          <p
            className={`mt-2 text-3xl font-bold ${
              danger
                ? "text-red-600"
                : positive
                  ? "text-green-600"
                  : "text-slate-900"
            }`}
          >
            {value}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {description}
          </p>
        </div>

        <div
          className={`rounded-xl p-3 ${
            danger
              ? "bg-red-50 text-red-600"
              : positive
                ? "bg-green-50 text-green-600"
                : "bg-slate-100 text-slate-700"
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function ProgressBar({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  const safeValue = Math.min(
    100,
    Math.max(0, value),
  );

  return (
    <div className="mt-3">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-slate-500">
          {label}
        </span>

        <span className="font-semibold text-slate-700">
          {safeValue}%
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-slate-900 transition-all"
          style={{
            width: `${safeValue}%`,
          }}
        />
      </div>
    </div>
  );
}

function StaffRiskBadge({
  overdue,
  urgent,
  deadlines,
}: {
  overdue: number;
  urgent: number;
  deadlines: number;
}) {
  if (urgent > 0 || overdue >= 3) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
        <AlertTriangle className="h-3.5 w-3.5" />
        High Risk
      </span>
    );
  }

  if (deadlines >= 5 || overdue > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
        <CalendarClock className="h-3.5 w-3.5" />
        Attention
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
      <CheckCircle2 className="h-3.5 w-3.5" />
      Stable
    </span>
  );
}

function StaffWorkloadBar({
  active,
  completed,
  overdue,
  highest,
}: {
  active: number;
  completed: number;
  overdue: number;
  highest: number;
}) {
  const activeWidth = highest
    ? Math.max(
        3,
        Math.round((active / highest) * 100),
      )
    : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">
          Active workload
        </span>

        <span className="font-semibold text-slate-700">
          {active}
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-slate-900"
          style={{
            width: `${activeWidth}%`,
          }}
        />
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        <span className="text-slate-500">
          Completed:{" "}
          <strong className="text-slate-700">
            {completed}
          </strong>
        </span>

        <span className="text-red-600">
          Overdue:{" "}
          <strong>{overdue}</strong>
        </span>
      </div>
    </div>
  );
}

export default async function BusinessIntelligencePage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const currentUser =
    await prisma.user.findUnique({
      where: {
        id: session.user.id,
      },
      select: {
        firmId: true,
      },
    });

  if (!currentUser?.firmId) {
    redirect("/dashboard");
  }

  const [analytics, staffPerformance] =
    await Promise.all([
      getBusinessIntelligenceOverview(
        currentUser.firmId,
      ),
      getStaffPerformanceData(
        currentUser.firmId,
      ),
    ]);

  /*
   * BICharts expects:
   *
   * {
   *   name,
   *   active,
   *   completed,
   *   overdue
   * }
   */
  const staffWorkload =
    staffPerformance.staff.map(
      (staff) => ({
        name: staff.name,
        active: staff.activeTasks,
        completed: staff.completedTasks,
        overdue: staff.overdueTasks,
      }),
    );

  const staffPriorities =
    staffPerformance.staff.map(
      (staff) => ({
        name: staff.name,
        highPriority:
          staff.highPriorityTasks,
        urgent: staff.urgentTasks,
      }),
    );

  const staffDeadlines =
    staffPerformance.staff.map(
      (staff) => ({
        name: staff.name,
        upcoming:
          staff.upcomingDeadlines,
        overdue:
          staff.overdueDeadlines,
        critical:
          staff.criticalDeadlines,
      }),
    );

  const highestRiskStaff =
    staffPerformance.staff
      .filter(
        (staff) =>
          staff.overdueTasks > 0 ||
          staff.urgentTasks > 0 ||
          staff.overdueDeadlines > 0,
      )
      .slice(0, 5);

  const positiveStaff =
    staffPerformance.staff
      .filter(
        (staff) =>
          staff.completedTasks > 0 &&
          staff.completionRate >= 70 &&
          staff.overdueTasks === 0,
      )
      .sort(
        (a, b) =>
          b.completionRate -
          a.completionRate,
      )
      .slice(0, 5);

  return (
    <main className="space-y-8 p-6 lg:p-8">
      {/* PAGE HEADER */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-500">
            <BarChart3 className="h-4 w-4" />
            Business Intelligence
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-slate-950">
            Business Intelligence Dashboard
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Firm-wide operational intelligence
            covering matters, clients, tasks,
            deadlines, documents, activity and
            staff performance.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Activity className="h-4 w-4" />
            Intelligence generated
          </div>

          <p className="mt-1 text-sm font-semibold text-slate-900">
            {new Date(
              analytics.generatedAt,
            ).toLocaleString("en-ZA")}
          </p>
        </div>
      </div>

      {/* EXECUTIVE OVERVIEW */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Gauge className="h-5 w-5 text-slate-700" />

          <h2 className="text-xl font-bold text-slate-950">
            Executive Overview
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total Matters"
            value={formatNumber(
              analytics.matters.total,
            )}
            description="All matters recorded for the firm"
            icon={BriefcaseBusiness}
          />

          <StatCard
            title="Open Matters"
            value={formatNumber(
              analytics.matters.open,
            )}
            description="Matters currently open"
            icon={Activity}
          />

          <StatCard
            title="Active Tasks"
            value={formatNumber(
              staffPerformance.totals
                .totalActiveTasks,
            )}
            description="Outstanding operational work"
            icon={ClipboardList}
          />

          <StatCard
            title="Overdue Tasks"
            value={formatNumber(
              analytics.tasks.overdue,
            )}
            description="Tasks requiring attention"
            icon={AlertTriangle}
            danger={
              analytics.tasks.overdue > 0
            }
          />
        </div>
      </section>

      {/* RISK BANNER */}
      {(analytics.tasks.overdue > 0 ||
        analytics.deadlines.overdue > 0 ||
        staffPerformance.totals
          .unassignedActiveTasks > 0) && (
        <section>
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-red-100 p-3 text-red-600">
                <AlertTriangle className="h-6 w-6" />
              </div>

              <div>
                <h2 className="font-bold text-red-900">
                  Management attention required
                </h2>

                <p className="mt-1 text-sm leading-6 text-red-800">
                  The firm currently has{" "}
                  <strong>
                    {formatNumber(
                      analytics.tasks.overdue,
                    )}
                  </strong>{" "}
                  overdue tasks and{" "}
                  <strong>
                    {formatNumber(
                      analytics.deadlines
                        .overdue,
                    )}
                  </strong>{" "}
                  overdue deadlines.

                  {staffPerformance.totals
                    .unassignedActiveTasks >
                    0 && (
                    <>
                      {" "}
                      There are also{" "}
                      <strong>
                        {formatNumber(
                          staffPerformance
                            .totals
                            .unassignedActiveTasks,
                        )}
                      </strong>{" "}
                      active tasks without an
                      assignee.
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ANALYTICS CHARTS */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-slate-700" />

          <h2 className="text-xl font-bold text-slate-950">
            Analytics & Trends
          </h2>
        </div>

        <BICharts
          matterStatus={
            analytics.charts.matterStatus
          }
          clientType={
            analytics.charts.clientType
          }
          activityTrend={
            analytics.charts.activityTrend
          }
          staffWorkload={staffWorkload}
          staffPriorities={staffPriorities}
          staffDeadlines={staffDeadlines}
        />
      </section>

      {/* STAFF PERFORMANCE */}
      <section className="space-y-5">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Users className="h-5 w-5 text-slate-700" />

            <h2 className="text-xl font-bold text-slate-950">
              Staff Performance & Workload
              Intelligence
            </h2>
          </div>

          <p className="max-w-3xl text-sm leading-6 text-slate-600">
            Analyse workload distribution,
            completion performance, overdue work,
            urgent tasks and deadline pressure across
            the firm's active staff.
          </p>
        </div>

        {/* STAFF KPI CARDS */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Active Staff"
            value={formatNumber(
              staffPerformance.staff.length,
            )}
            description="Currently active users"
            icon={Users}
          />

          <StatCard
            title="Assigned Work"
            value={formatNumber(
              staffPerformance.totals
                .assignedActiveTasks,
            )}
            description="Active tasks assigned to staff"
            icon={UserCheck}
          />

          <StatCard
            title="Unassigned Work"
            value={formatNumber(
              staffPerformance.totals
                .unassignedActiveTasks,
            )}
            description="Active tasks needing ownership"
            icon={UserX}
            danger={
              staffPerformance.totals
                .unassignedActiveTasks > 0
            }
          />

          <StatCard
            title="Firm Completion Rate"
            value={`${staffPerformance.totals.firmCompletionRate}%`}
            description="Completed vs tracked tasks"
            icon={TrendingUp}
            positive={
              staffPerformance.totals
                .firmCompletionRate >= 70
            }
          />
        </div>

        {/* MANAGEMENT ALERTS */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600" />

              <div>
                <p className="text-sm font-semibold text-red-900">
                  Overloaded staff
                </p>

                <p className="mt-1 text-2xl font-bold text-red-700">
                  {
                    staffPerformance.alerts
                      .overloadedStaff
                  }
                </p>
              </div>
            </div>

            <p className="mt-3 text-xs leading-5 text-red-800">
              Staff members carrying unusually high
              active workloads.
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-center gap-3">
              <XCircle className="h-5 w-5 text-amber-600" />

              <div>
                <p className="text-sm font-semibold text-amber-900">
                  Overdue workload
                </p>

                <p className="mt-1 text-2xl font-bold text-amber-700">
                  {
                    staffPerformance.alerts
                      .highOverdueStaff
                  }
                </p>
              </div>
            </div>

            <p className="mt-3 text-xs leading-5 text-amber-800">
              Staff members with three or more overdue
              tasks.
            </p>
          </div>

          <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5">
            <div className="flex items-center gap-3">
              <CalendarClock className="h-5 w-5 text-orange-600" />

              <div>
                <p className="text-sm font-semibold text-orange-900">
                  Deadline pressure
                </p>

                <p className="mt-1 text-2xl font-bold text-orange-700">
                  {
                    staffPerformance.alerts
                      .highDeadlineStaff
                  }
                </p>
              </div>
            </div>

            <p className="mt-3 text-xs leading-5 text-orange-800">
              Staff members handling five or more
              active deadlines.
            </p>
          </div>

          <div className="rounded-2xl border border-purple-200 bg-purple-50 p-5">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-purple-600" />

              <div>
                <p className="text-sm font-semibold text-purple-900">
                  Urgent workload
                </p>

                <p className="mt-1 text-2xl font-bold text-purple-700">
                  {
                    staffPerformance.alerts
                      .urgentStaff
                  }
                </p>
              </div>
            </div>

            <p className="mt-3 text-xs leading-5 text-purple-800">
              Staff members with urgent tasks requiring
              immediate attention.
            </p>
          </div>
        </div>

        {/* STAFF TABLE */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-bold text-slate-950">
                  Staff Workload Register
                </h3>

                <p className="text-sm text-slate-500">
                  Operational workload and performance
                  by staff member.
                </p>
              </div>

              <div className="text-xs text-slate-500">
                Average active workload:{" "}
                <strong className="text-slate-800">
                  {
                    staffPerformance.totals
                      .averageActiveTasks
                  }
                </strong>{" "}
                tasks
              </div>
            </div>
          </div>

          {staffPerformance.staff.length ===
          0 ? (
            <div className="p-10 text-center">
              <Users className="mx-auto h-10 w-10 text-slate-300" />

              <p className="mt-3 font-semibold text-slate-800">
                No active staff found
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Staff performance information will
                appear here once active users exist.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Staff Member
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Workload
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Performance
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Priorities
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Deadlines
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Risk
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 bg-white">
                  {staffPerformance.staff.map(
                    (staff) => (
                      <tr
                        key={staff.id}
                        className="hover:bg-slate-50"
                      >
                        <td className="px-5 py-4 align-top">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700">
                              {staff.name
                                .split(" ")
                                .map(
                                  (part) =>
                                    part[0],
                                )
                                .join("")
                                .slice(0, 2)
                                .toUpperCase()}
                            </div>

                            <div>
                              <p className="font-semibold text-slate-900">
                                {staff.name}
                              </p>

                              <p className="text-xs text-slate-500">
                                {formatRole(
                                  staff.role,
                                )}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="min-w-[220px] px-5 py-4 align-top">
                          <StaffWorkloadBar
                            active={
                              staff.activeTasks
                            }
                            completed={
                              staff.completedTasks
                            }
                            overdue={
                              staff.overdueTasks
                            }
                            highest={
                              staffPerformance
                                .totals
                                .highestActiveTasks
                            }
                          />
                        </td>

                        <td className="min-w-[170px] px-5 py-4 align-top">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-slate-900">
                              {
                                staff.completionRate
                              }
                              %
                            </span>

                            <span className="text-xs text-slate-500">
                              {
                                staff.completedTasks
                              }{" "}
                              completed
                            </span>
                          </div>

                          <ProgressBar
                            value={
                              staff.completionRate
                            }
                            label="Completion"
                          />
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="space-y-2 text-xs">
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-slate-500">
                                High priority
                              </span>

                              <span className="font-semibold text-amber-700">
                                {
                                  staff.highPriorityTasks
                                }
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-4">
                              <span className="text-slate-500">
                                Urgent
                              </span>

                              <span className="font-semibold text-red-700">
                                {
                                  staff.urgentTasks
                                }
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="space-y-2 text-xs">
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-slate-500">
                                Upcoming
                              </span>

                              <span className="font-semibold text-slate-800">
                                {
                                  staff.upcomingDeadlines
                                }
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-4">
                              <span className="text-slate-500">
                                Overdue
                              </span>

                              <span className="font-semibold text-red-700">
                                {
                                  staff.overdueDeadlines
                                }
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-4">
                              <span className="text-slate-500">
                                Critical
                              </span>

                              <span className="font-semibold text-orange-700">
                                {
                                  staff.criticalDeadlines
                                }
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <StaffRiskBadge
                            overdue={
                              staff.overdueTasks
                            }
                            urgent={
                              staff.urgentTasks
                            }
                            deadlines={
                              staff.totalDeadlineWorkload
                            }
                          />
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* STAFF INTERPRETATION */}
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600" />

              <h3 className="font-bold text-red-950">
                Staff requiring management attention
              </h3>
            </div>

            <div className="mt-4 space-y-3">
              {highestRiskStaff.length ===
              0 ? (
                <p className="text-sm text-red-800">
                  No significant staff workload
                  risks were identified.
                </p>
              ) : (
                highestRiskStaff.map((staff) => (
                  <div
                    key={staff.id}
                    className="rounded-xl border border-red-200 bg-white p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {staff.name}
                        </p>

                        <p className="text-xs text-slate-500">
                          {formatRole(
                            staff.role,
                          )}
                        </p>
                      </div>

                      <StaffRiskBadge
                        overdue={
                          staff.overdueTasks
                        }
                        urgent={
                          staff.urgentTasks
                        }
                        deadlines={
                          staff.totalDeadlineWorkload
                        }
                      />
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                      <div className="rounded-lg bg-slate-50 p-2">
                        <p className="text-lg font-bold text-slate-900">
                          {staff.activeTasks}
                        </p>

                        <p className="text-[11px] text-slate-500">
                          Active
                        </p>
                      </div>

                      <div className="rounded-lg bg-red-50 p-2">
                        <p className="text-lg font-bold text-red-700">
                          {staff.overdueTasks}
                        </p>

                        <p className="text-[11px] text-red-600">
                          Overdue
                        </p>
                      </div>

                      <div className="rounded-lg bg-orange-50 p-2">
                        <p className="text-lg font-bold text-orange-700">
                          {
                            staff.totalDeadlineWorkload
                          }
                        </p>

                        <p className="text-[11px] text-orange-600">
                          Deadlines
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-green-600" />

              <h3 className="font-bold text-green-950">
                Positive staff performance
              </h3>
            </div>

            <div className="mt-4 space-y-3">
              {positiveStaff.length ===
              0 ? (
                <p className="text-sm text-green-800">
                  There is currently not enough
                  completed work data to identify
                  strong performers.
                </p>
              ) : (
                positiveStaff.map((staff) => (
                  <div
                    key={staff.id}
                    className="rounded-xl border border-green-200 bg-white p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {staff.name}
                        </p>

                        <p className="text-xs text-slate-500">
                          {formatRole(
                            staff.role,
                          )}
                        </p>
                      </div>

                      <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700">
                        {
                          staff.completionRate
                        }
                        % completion
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div className="rounded-lg bg-green-50 p-3">
                        <p className="text-lg font-bold text-green-700">
                          {
                            staff.completedTasks
                          }
                        </p>

                        <p className="text-xs text-green-700">
                          Completed tasks
                        </p>
                      </div>

                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-lg font-bold text-slate-900">
                          {staff.activeTasks}
                        </p>

                        <p className="text-xs text-slate-500">
                          Active tasks
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* WORKLOAD INTERPRETATION */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <Gauge className="h-5 w-5 text-slate-700" />

            <h3 className="font-bold text-slate-950">
              Workload Interpretation
            </h3>
          </div>

          <div className="mt-4 grid gap-5 md:grid-cols-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Average workload
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-950">
                {
                  staffPerformance.totals
                    .averageActiveTasks
                }
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                Average number of active tasks per
                active staff member.
              </p>
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-900">
                Highest individual workload
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-950">
                {
                  staffPerformance.totals
                    .highestActiveTasks
                }
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                Highest number of active tasks
                assigned to one staff member.
              </p>
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-900">
                Assignment coverage
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-950">
                {percentage(
                  staffPerformance.totals
                    .assignedActiveTasks,
                  staffPerformance.totals
                    .totalActiveTasks,
                )}
                %
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                Percentage of active tasks that have
                an assigned staff member.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* INTELLIGENCE INSIGHTS */}
      <section>
        <BIInsights />
      </section>

      {/* MATTER AND CLIENT ANALYTICS */}
      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <BriefcaseBusiness className="h-5 w-5 text-slate-700" />

            <div>
              <h3 className="font-bold text-slate-950">
                Matter Intelligence
              </h3>

              <p className="text-sm text-slate-500">
                Current matter portfolio.
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">
                Total
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-950">
                {analytics.matters.total}
              </p>
            </div>

            <div className="rounded-xl bg-green-50 p-4">
              <p className="text-xs text-green-700">
                Open
              </p>

              <p className="mt-1 text-2xl font-bold text-green-700">
                {analytics.matters.open}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-slate-700" />

            <div>
              <h3 className="font-bold text-slate-950">
                Client Intelligence
              </h3>

              <p className="text-sm text-slate-500">
                Current client portfolio.
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">
                Total clients
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-950">
                {analytics.clients.total}
              </p>
            </div>

            <div className="rounded-xl bg-blue-50 p-4">
              <p className="text-xs text-blue-700">
                Client Portfolio
              </p>

              <p className="mt-1 text-2xl font-bold text-blue-700">
                {analytics.clients.total}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* TASK / DEADLINE OVERVIEW */}
      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Completed Tasks"
          value={formatNumber(
            staffPerformance.totals
              .totalCompletedTasks,
          )}
          description="Tasks completed by staff"
          icon={CheckCircle2}
          positive
        />

        <StatCard
          title="Overdue Deadlines"
          value={formatNumber(
            analytics.deadlines.overdue,
          )}
          description="Deadlines requiring attention"
          icon={CalendarClock}
          danger={
            analytics.deadlines.overdue > 0
          }
        />

        <StatCard
          title="Due Within 7 Days"
          value={formatNumber(
            analytics.deadlines.dueNext7Days,
          )}
          description="Deadlines due within 7 days"
          icon={CalendarClock}
        />

        <StatCard
          title="Documents"
          value={formatNumber(
            analytics.documents.total,
          )}
          description="Documents stored in LegalVault"
          icon={FileText}
        />
      </section>

      {/* DOCUMENT / WORKFORCE */}
      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-slate-700" />

            <div>
              <h3 className="font-bold text-slate-950">
                Document Intelligence
              </h3>

              <p className="text-sm text-slate-500">
                Repository-level document information.
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">
                Total documents
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-950">
                {analytics.documents.total}
              </p>
            </div>

            <div className="rounded-xl bg-green-50 p-4">
              <p className="text-xs text-green-700">
                Active documents
              </p>

              <p className="mt-1 text-2xl font-bold text-green-700">
                {analytics.documents.active}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-slate-700" />

            <div>
              <h3 className="font-bold text-slate-950">
                Workforce Overview
              </h3>

              <p className="text-sm text-slate-500">
                Current firm staffing information.
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">
                Active users
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-950">
                {analytics.users.active}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">
                Total users
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-950">
                {analytics.users.total}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ACTIVITY INTELLIGENCE */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-slate-700" />

          <div>
            <h3 className="font-bold text-slate-950">
              Activity Intelligence
            </h3>

            <p className="text-sm text-slate-500">
              Firm activity indicators across recent
              periods.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs text-slate-500">
              Activity — last 30 days
            </p>

            <p className="mt-1 text-2xl font-bold text-slate-950">
              {analytics.activity.last30Days}
            </p>
          </div>

          <div className="rounded-xl bg-blue-50 p-4">
            <p className="text-xs text-blue-700">
              Activity today
            </p>

            <p className="mt-1 text-2xl font-bold text-blue-700">
              {analytics.activity.today}
            </p>
          </div>

          <div className="rounded-xl bg-green-50 p-4">
            <p className="text-xs text-green-700">
              Active users
            </p>

            <p className="mt-1 text-2xl font-bold text-green-700">
              {analytics.users.active}
            </p>
          </div>
        </div>
      </section>

      {/* MANAGEMENT SUMMARY */}
      <section className="rounded-2xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-white/10 p-3">
            <Gauge className="h-6 w-6" />
          </div>

          <div>
            <h2 className="text-xl font-bold">
              Management Intelligence Summary
            </h2>

            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
              LegalVault's Business Intelligence
              layer brings together operational data
              across matters, tasks, deadlines,
              documents, clients, staff and system
              activity. Management can use these
              indicators to identify bottlenecks,
              workload imbalance, deadline exposure,
              unassigned work and positive performance
              trends before they become larger
              operational problems.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-white/5 p-4">
            <p className="text-xs text-slate-400">
              Active workload
            </p>

            <p className="mt-1 text-2xl font-bold">
              {
                staffPerformance.totals
                  .totalActiveTasks
              }
            </p>
          </div>

          <div className="rounded-xl bg-white/5 p-4">
            <p className="text-xs text-slate-400">
              Completion rate
            </p>

            <p className="mt-1 text-2xl font-bold">
              {
                staffPerformance.totals
                  .firmCompletionRate
              }
              %
            </p>
          </div>

          <div className="rounded-xl bg-white/5 p-4">
            <p className="text-xs text-slate-400">
              Overdue tasks
            </p>

            <p className="mt-1 text-2xl font-bold">
              {analytics.tasks.overdue}
            </p>
          </div>

          <div className="rounded-xl bg-white/5 p-4">
            <p className="text-xs text-slate-400">
              Deadline exposure
            </p>

            <p className="mt-1 text-2xl font-bold">
              {analytics.deadlines.overdue}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}