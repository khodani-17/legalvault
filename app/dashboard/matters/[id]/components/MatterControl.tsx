import type {
  MatterControlHealth,
  MatterControlIssue,
  MatterControlResult,
} from "@/lib/matter-control/engine";

type MatterControlProps = {
  control: MatterControlResult;
};

function getHealthClasses(
  health: MatterControlHealth,
) {
  switch (health) {
    case "HEALTHY":
      return {
        container: "border-green-200 bg-green-50",
        badge: "bg-green-100 text-green-800 ring-green-200",
        dot: "bg-green-500",
      };

    case "NEEDS_ATTENTION":
      return {
        container: "border-yellow-200 bg-yellow-50",
        badge: "bg-yellow-100 text-yellow-800 ring-yellow-200",
        dot: "bg-yellow-500",
      };

    case "AT_RISK":
      return {
        container: "border-orange-200 bg-orange-50",
        badge: "bg-orange-100 text-orange-800 ring-orange-200",
        dot: "bg-orange-500",
      };

    case "CRITICAL":
      return {
        container: "border-red-200 bg-red-50",
        badge: "bg-red-100 text-red-800 ring-red-200",
        dot: "bg-red-500",
      };

    default:
      return {
        container: "border-slate-200 bg-slate-50",
        badge: "bg-slate-100 text-slate-700 ring-slate-200",
        dot: "bg-slate-500",
      };
  }
}

function formatHealth(
  health: MatterControlHealth,
) {
  return health
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

function getIssueClasses(
  severity: MatterControlIssue["severity"],
) {
  switch (severity) {
    case "CRITICAL":
      return {
        container: "border-red-200 bg-red-50",
        icon: "bg-red-100 text-red-700",
        label: "text-red-700",
      };

    case "WARNING":
      return {
        container: "border-yellow-200 bg-yellow-50",
        icon: "bg-yellow-100 text-yellow-700",
        label: "text-yellow-700",
      };

    case "INFO":
      return {
        container: "border-blue-200 bg-blue-50",
        icon: "bg-blue-100 text-blue-700",
        label: "text-blue-700",
      };

    case "POSITIVE":
      return {
        container: "border-green-200 bg-green-50",
        icon: "bg-green-100 text-green-700",
        label: "text-green-700",
      };

    default:
      return {
        container: "border-slate-200 bg-slate-50",
        icon: "bg-slate-100 text-slate-700",
        label: "text-slate-700",
      };
  }
}

function formatIssueSeverity(
  severity: MatterControlIssue["severity"],
) {
  return severity
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

function formatDaysSinceActivity(
  days: number | null,
) {
  if (days === null) {
    return "No activity";
  }

  if (days === 0) {
    return "Today";
  }

  if (days === 1) {
    return "1 day ago";
  }

  return `${days} days ago`;
}

type StatCardProps = {
  label: string;
  value: number | string;
  description?: string;
};

function StatCard({
  label,
  value,
  description,
}: StatCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold text-slate-900">
        {value}
      </p>

      {description && (
        <p className="mt-1 text-xs text-slate-500">
          {description}
        </p>
      )}
    </div>
  );
}

export default function MatterControl({
  control,
}: MatterControlProps) {
  const healthClasses =
    getHealthClasses(control.health);

  const criticalIssues =
    control.issues.filter(
      (issue) =>
        issue.severity === "CRITICAL",
    ).length;

  const warningIssues =
    control.issues.filter(
      (issue) =>
        issue.severity === "WARNING",
    ).length;

  return (
    <section className="mb-8 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">

      {/* ===================================================== */}
      {/* HEADER */}
      {/* ===================================================== */}

      <div className="border-b border-slate-200 p-6 sm:p-8">

        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

          <div>
            <div className="flex items-center gap-3">

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-lg text-white">
                ✓
              </div>

              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Matter Control
                </h2>

                <p className="text-sm text-slate-500">
                  Operational monitoring for this matter.
                </p>
              </div>

            </div>
          </div>

          <div
            className={`inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ring-1 ${healthClasses.badge}`}
          >
            <span
              className={`h-2.5 w-2.5 rounded-full ${healthClasses.dot}`}
            />

            {formatHealth(control.health)}
          </div>

        </div>

      </div>

      {/* ===================================================== */}
      {/* HEALTH SUMMARY */}
      {/* ===================================================== */}

      <div className="p-6 sm:p-8">

        <div
          className={`rounded-xl border p-5 ${healthClasses.container}`}
        >

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div>

              <p className="text-sm font-semibold text-slate-700">
                Matter health
              </p>

              <p className="mt-1 text-sm text-slate-600">
                This status is based on actual matter-control
                conditions, not a numerical score.
              </p>

            </div>

            <div className="flex flex-wrap gap-3">

              {criticalIssues > 0 && (
                <span className="rounded-lg bg-red-100 px-3 py-2 text-xs font-bold text-red-700">
                  {criticalIssues} Critical
                </span>
              )}

              {warningIssues > 0 && (
                <span className="rounded-lg bg-yellow-100 px-3 py-2 text-xs font-bold text-yellow-700">
                  {warningIssues} Warning
                  {warningIssues === 1 ? "" : "s"}
                </span>
              )}

              {criticalIssues === 0 &&
                warningIssues === 0 && (
                  <span className="rounded-lg bg-green-100 px-3 py-2 text-xs font-bold text-green-700">
                    No active issues
                  </span>
                )}

            </div>

          </div>

        </div>

        {/* =================================================== */}
        {/* STATISTICS */}
        {/* =================================================== */}

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">

          <StatCard
            label="Documents"
            value={control.statistics.documents}
            description={`${control.statistics.activeDocuments} active`}
          />

          <StatCard
            label="Active Tasks"
            value={control.statistics.activeTasks}
            description={`${control.statistics.completedTasks} completed`}
          />

          <StatCard
            label="Overdue Tasks"
            value={control.statistics.overdueTasks}
            description={
              control.statistics.overdueTasks > 0
                ? "Requires attention"
                : "None overdue"
            }
          />

          <StatCard
            label="Deadlines"
            value={control.statistics.deadlines}
            description={`${control.statistics.upcomingDeadlines} upcoming`}
          />

          <StatCard
            label="Assigned Staff"
            value={control.statistics.assignedStaff}
            description="Active staff"
          />

          <StatCard
            label="Overdue Deadlines"
            value={control.statistics.overdueDeadlines}
            description={
              control.statistics.overdueDeadlines > 0
                ? "Immediate attention"
                : "None overdue"
            }
          />

          <StatCard
            label="Critical Deadlines"
            value={control.statistics.criticalDeadlines}
            description="Active critical deadlines"
          />

          <StatCard
            label="Upcoming Deadlines"
            value={control.statistics.upcomingDeadlines}
            description="Within 7 days"
          />

          <StatCard
            label="Activity"
            value={control.statistics.activityCount}
            description="Recorded events"
          />

          <StatCard
            label="Last Activity"
            value={formatDaysSinceActivity(
              control.statistics.daysSinceActivity,
            )}
            description="Matter activity"
          />

        </div>

      </div>

      {/* ===================================================== */}
      {/* ISSUES */}
      {/* ===================================================== */}

      {control.issues.length > 0 && (
        <div className="border-t border-slate-200 p-6 sm:p-8">

          <div className="mb-5">

            <h3 className="text-lg font-bold text-slate-900">
              Issues Requiring Attention
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Actions identified from the current state of
              this matter.
            </p>

          </div>

          <div className="space-y-4">

            {control.issues.map((issue) => {

              const issueClasses =
                getIssueClasses(issue.severity);

              return (
                <div
                  key={issue.id}
                  className={`rounded-xl border p-5 ${issueClasses.container}`}
                >

                  <div className="flex gap-4">

                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${issueClasses.icon}`}
                    >
                      {issue.severity === "CRITICAL"
                        ? "!"
                        : issue.severity === "WARNING"
                          ? "!"
                          : issue.severity === "INFO"
                            ? "i"
                            : "✓"}
                    </div>

                    <div className="min-w-0 flex-1">

                      <div className="flex flex-wrap items-center gap-2">

                        <h4 className="font-bold text-slate-900">
                          {issue.title}
                        </h4>

                        <span
                          className={`text-xs font-bold uppercase tracking-wide ${issueClasses.label}`}
                        >
                          {formatIssueSeverity(
                            issue.severity,
                          )}
                        </span>

                      </div>

                      <p className="mt-2 text-sm leading-6 text-slate-700">
                        {issue.message}
                      </p>

                      <div className="mt-4 rounded-lg bg-white/70 p-3 ring-1 ring-black/5">

                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Recommended action
                        </p>

                        <p className="mt-1 text-sm font-medium text-slate-700">
                          {issue.recommendation}
                        </p>

                      </div>

                    </div>

                  </div>

                </div>
              );
            })}

          </div>

        </div>
      )}

      {/* ===================================================== */}
      {/* ALL CLEAR */}
      {/* ===================================================== */}

      {control.issues.length === 0 && (
        <div className="border-t border-slate-200 p-6 sm:p-8">

          <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">

            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-xl text-green-700">
              ✓
            </div>

            <h3 className="mt-4 font-bold text-green-900">
              Matter is under control
            </h3>

            <p className="mt-1 text-sm text-green-700">
              No critical or warning control issues have
              been identified.
            </p>

          </div>

        </div>
      )}

      {/* ===================================================== */}
      {/* TIMELINE */}
      {/* ===================================================== */}

      {control.timeline.length > 0 && (
        <div className="border-t border-slate-200 p-6 sm:p-8">

          <div className="mb-5">

            <h3 className="text-lg font-bold text-slate-900">
              Recent Matter Activity
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Recent recorded activity associated with this
              matter.
            </p>

          </div>

          <div className="space-y-4">

            {control.timeline
              .slice(0, 10)
              .map((entry) => (
                <div
                  key={entry.id}
                  className="flex gap-4"
                >

                  <div className="mt-1 flex h-2.5 w-2.5 shrink-0 rounded-full bg-slate-400" />

                  <div className="min-w-0 flex-1">

                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">

                      <p className="text-sm font-semibold text-slate-900">
                        {entry.action}
                      </p>

                      <time className="text-xs text-slate-400">
                        {new Intl.DateTimeFormat(
                          "en-ZA",
                          {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        ).format(
                          new Date(entry.createdAt),
                        )}
                      </time>

                    </div>

                    <p className="mt-1 text-xs text-slate-500">
                      {entry.entityType}
                    </p>

                    {entry.description && (
                      <p className="mt-1 text-sm text-slate-600">
                        {entry.description}
                      </p>
                    )}

                  </div>

                </div>
              ))}

          </div>

        </div>
      )}

    </section>
  );
}