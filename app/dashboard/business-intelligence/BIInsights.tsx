"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Activity,
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  Info,
  Lightbulb,
  Loader2,
  ShieldAlert,
  Target,
  Users,
} from "lucide-react";

type IntelligenceSeverity =
  | "CRITICAL"
  | "WARNING"
  | "INFO"
  | "POSITIVE";

type IntelligenceInsight = {
  id: string;
  severity: IntelligenceSeverity;
  category: string;
  title: string;
  message: string;
  recommendation: string;
  entityType?: string;
  entityId?: string;
  createdAt: string;
};

function getSeverityConfig(
  severity: IntelligenceSeverity,
) {
  switch (severity) {
    case "CRITICAL":
      return {
        label: "Critical",
        icon: AlertCircle,
        container:
          "border-red-200 bg-red-50/70",
        iconContainer:
          "bg-red-100 text-red-600",
        title: "text-red-950",
        badge:
          "bg-red-100 text-red-700",
        accent: "border-l-red-500",
      };

    case "WARNING":
      return {
        label: "Warning",
        icon: ShieldAlert,
        container:
          "border-amber-200 bg-amber-50/70",
        iconContainer:
          "bg-amber-100 text-amber-600",
        title: "text-amber-950",
        badge:
          "bg-amber-100 text-amber-700",
        accent: "border-l-amber-500",
      };

    case "POSITIVE":
      return {
        label: "Positive",
        icon: CheckCircle2,
        container:
          "border-emerald-200 bg-emerald-50/70",
        iconContainer:
          "bg-emerald-100 text-emerald-600",
        title: "text-emerald-950",
        badge:
          "bg-emerald-100 text-emerald-700",
        accent: "border-l-emerald-500",
      };

    default:
      return {
        label: "Information",
        icon: Info,
        container:
          "border-blue-200 bg-blue-50/70",
        iconContainer:
          "bg-blue-100 text-blue-600",
        title: "text-blue-950",
        badge:
          "bg-blue-100 text-blue-700",
        accent: "border-l-blue-500",
      };
  }
}

function getCategoryConfig(category: string) {
  switch (category) {
    case "WORKLOAD":
    case "TASK":
      return {
        label: "Staff & Workload",
        icon: Users,
      };

    case "DEADLINE":
      return {
        label: "Deadline",
        icon: CalendarClock,
      };

    case "MATTER":
      return {
        label: "Matter",
        icon: BriefcaseBusiness,
      };

    case "DOCUMENT":
      return {
        label: "Document",
        icon: FileText,
      };

    case "CLIENT":
      return {
        label: "Client",
        icon: Users,
      };

    case "ACTIVITY":
      return {
        label: "Activity",
        icon: Activity,
      };

    case "SYSTEM":
      return {
        label: "System",
        icon: Target,
      };

    default:
      return {
        label: category,
        icon: Info,
      };
  }
}

function getEntityUrl(
  entityType?: string,
  entityId?: string,
) {
  if (!entityType || !entityId) {
    return null;
  }

  switch (entityType) {
    case "Matter":
      return `/dashboard/matters/${entityId}`;

    case "Client":
      return `/dashboard/clients/${entityId}`;

    case "Task":
      return `/dashboard/tasks/${entityId}`;

    case "Deadline":
      return `/dashboard/deadlines/${entityId}`;

    case "User":
      return `/dashboard/users/${entityId}`;

    default:
      return null;
  }
}

function InsightCard({
  insight,
}: {
  insight: IntelligenceInsight;
}) {
  const router = useRouter();

  const severityConfig =
    getSeverityConfig(
      insight.severity,
    );

  const SeverityIcon =
    severityConfig.icon;

  const categoryConfig =
    getCategoryConfig(
      insight.category,
    );

  const CategoryIcon =
    categoryConfig.icon;

  const entityUrl = getEntityUrl(
    insight.entityType,
    insight.entityId,
  );

  return (
    <article
      className={`rounded-2xl border border-l-4 p-5 shadow-sm transition hover:shadow-md ${severityConfig.container} ${severityConfig.accent}`}
    >
      <div className="flex items-start gap-4">
        {/* Severity */}
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${severityConfig.iconContainer}`}
        >
          <SeverityIcon className="h-5 w-5" />
        </div>

        {/* Main content */}
        <div className="min-w-0 flex-1">
          {/* Title */}
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className={`text-base font-semibold ${severityConfig.title}`}
            >
              {insight.title}
            </h3>

            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${severityConfig.badge}`}
            >
              {severityConfig.label}
            </span>

            <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-xs font-medium text-slate-600">
              <CategoryIcon className="h-3 w-3" />
              {categoryConfig.label}
            </span>
          </div>

          {/* Message */}
          <p className="mt-2 text-sm leading-6 text-slate-700">
            {insight.message}
          </p>

          {/* Recommendation */}
          <div className="mt-4 rounded-xl border border-white/80 bg-white/80 p-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-slate-500" />

              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Recommended action
              </p>
            </div>

            <p className="mt-1 text-sm leading-6 text-slate-700">
              {insight.recommendation}
            </p>
          </div>

          {/* Entity */}
          {insight.entityType &&
            insight.entityId && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>
                  {insight.entityType} reference:
                </span>

                <span className="rounded-md bg-white/70 px-2 py-1 font-mono">
                  {insight.entityId}
                </span>
              </div>
            )}

          {/* Entity action */}
          {entityUrl && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() =>
                  router.push(entityUrl)
                }
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                View {insight.entityType}

                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Users;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-xl bg-slate-900 p-3">
        <Icon className="h-5 w-5 text-white" />
      </div>

      <div>
        <h3 className="text-lg font-semibold text-slate-900">
          {title}
        </h3>

        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
          {description}
        </p>
      </div>
    </div>
  );
}

function InsightSection({
  icon,
  title,
  description,
  insights,
}: {
  icon: typeof Users;
  title: string;
  description: string;
  insights: IntelligenceInsight[];
}) {
  if (insights.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <SectionHeader
        icon={icon}
        title={title}
        description={description}
      />

      <div className="space-y-4">
        {insights.map((insight) => (
          <InsightCard
            key={insight.id}
            insight={insight}
          />
        ))}
      </div>
    </section>
  );
}

export default function BIInsights() {
  const [insights, setInsights] =
    useState<IntelligenceInsight[]>(
      [],
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadInsights() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          "/api/business-intelligence/intelligence",
          {
            method: "GET",
            cache: "no-store",
          },
        );

        const result =
          await response.json();

        if (!response.ok) {
          throw new Error(
            result?.error ||
              "Unable to load intelligence.",
          );
        }

        if (mounted) {
          setInsights(
            Array.isArray(result?.data)
              ? result.data
              : [],
          );
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load intelligence.",
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadInsights();

    return () => {
      mounted = false;
    };
  }, []);

  /*
   * ============================================================
   * SUMMARY COUNTS
   * ============================================================
   */

  const criticalInsights =
    useMemo(
      () =>
        insights.filter(
          (insight) =>
            insight.severity ===
            "CRITICAL",
        ),
      [insights],
    );

  const warningInsights =
    useMemo(
      () =>
        insights.filter(
          (insight) =>
            insight.severity ===
            "WARNING",
        ),
      [insights],
    );

  const infoInsights =
    useMemo(
      () =>
        insights.filter(
          (insight) =>
            insight.severity ===
            "INFO",
        ),
      [insights],
    );

  const positiveInsights =
    useMemo(
      () =>
        insights.filter(
          (insight) =>
            insight.severity ===
            "POSITIVE",
        ),
      [insights],
    );

  const criticalCount =
    criticalInsights.length;

  const warningCount =
    warningInsights.length;

  const infoCount =
    infoInsights.length;

  const positiveCount =
    positiveInsights.length;

  /*
   * ============================================================
   * PRIORITY INSIGHTS
   *
   * Critical and warning signals are shown here.
   * They are deliberately excluded from the category sections
   * below so that the same signal cannot appear twice.
   * ============================================================
   */

  const priorityInsights =
    useMemo(
      () =>
        insights.filter(
          (insight) =>
            insight.severity ===
              "CRITICAL" ||
            insight.severity ===
              "WARNING",
        ),
      [insights],
    );

  const priorityInsightIds =
    useMemo(
      () =>
        new Set(
          priorityInsights.map(
            (insight) =>
              insight.id,
          ),
        ),
      [priorityInsights],
    );

  /*
   * ============================================================
   * INFORMATION INSIGHTS
   *
   * Information signals are displayed according to their
   * category. Critical and warning signals are excluded.
   * Positive signals are also excluded.
   * ============================================================
   */

  const informationInsights =
    useMemo(
      () =>
        insights.filter(
          (insight) =>
            insight.severity ===
              "INFO" &&
            !priorityInsightIds.has(
              insight.id,
            ),
        ),
      [insights, priorityInsightIds],
    );

  const informationWorkload =
    useMemo(
      () =>
        informationInsights.filter(
          (insight) =>
            insight.category ===
              "WORKLOAD" ||
            insight.category ===
              "TASK",
        ),
      [informationInsights],
    );

  const informationDeadlines =
    useMemo(
      () =>
        informationInsights.filter(
          (insight) =>
            insight.category ===
            "DEADLINE",
        ),
      [informationInsights],
    );

  const informationMatters =
    useMemo(
      () =>
        informationInsights.filter(
          (insight) =>
            insight.category ===
            "MATTER",
        ),
      [informationInsights],
    );

  const informationDocuments =
    useMemo(
      () =>
        informationInsights.filter(
          (insight) =>
            insight.category ===
            "DOCUMENT",
        ),
      [informationInsights],
    );

  const informationClients =
    useMemo(
      () =>
        informationInsights.filter(
          (insight) =>
            insight.category ===
            "CLIENT",
        ),
      [informationInsights],
    );

  const informationActivity =
    useMemo(
      () =>
        informationInsights.filter(
          (insight) =>
            insight.category ===
            "ACTIVITY",
        ),
      [informationInsights],
    );

  const informationSystem =
    useMemo(
      () =>
        informationInsights.filter(
          (insight) =>
            insight.category ===
            "SYSTEM",
        ),
      [informationInsights],
    );

  /*
   * ============================================================
   * POSITIVE INSIGHTS
   *
   * Positive signals are shown once in a dedicated section.
   * ============================================================
   */

  const positiveCountByCategory =
    useMemo(() => {
      return {
        matter:
          positiveInsights.filter(
            (insight) =>
              insight.category ===
              "MATTER",
          ).length,

        document:
          positiveInsights.filter(
            (insight) =>
              insight.category ===
              "DOCUMENT",
          ).length,

        activity:
          positiveInsights.filter(
            (insight) =>
              insight.category ===
              "ACTIVITY",
          ).length,

        workload:
          positiveInsights.filter(
            (insight) =>
              insight.category ===
                "WORKLOAD" ||
              insight.category ===
                "TASK",
          ).length,
      };
    }, [positiveInsights]);

  /*
   * ============================================================
   * MANAGEMENT STATUS
   * ============================================================
   */

  const managementStatus =
    useMemo(() => {
      if (criticalCount > 0) {
        return {
          title:
            "Immediate operational attention required",
          message:
            "Critical intelligence signals have been detected and should be reviewed by management.",
          container:
            "border-red-200 bg-red-50",
          iconContainer:
            "bg-red-100 text-red-600",
          icon: AlertCircle,
        };
      }

      if (warningCount > 0) {
        return {
          title:
            "Operational matters require review",
          message:
            "Warning-level intelligence signals have been detected. These should be reviewed before they develop into larger operational problems.",
          container:
            "border-amber-200 bg-amber-50",
          iconContainer:
            "bg-amber-100 text-amber-600",
          icon: ShieldAlert,
        };
      }

      return {
        title:
          "No immediate operational risks detected",
        message:
          "The current intelligence rules have not identified any critical or warning-level operational signals.",
        container:
          "border-emerald-200 bg-emerald-50",
        iconContainer:
          "bg-emerald-100 text-emerald-600",
        icon: CheckCircle2,
      };
    }, [
      criticalCount,
      warningCount,
    ]);

  const ManagementIcon =
    managementStatus.icon;

  /*
   * ============================================================
   * INFORMATION TOTAL
   * ============================================================
   */

  const informationCategoryCount =
    informationWorkload.length +
    informationDeadlines.length +
    informationMatters.length +
    informationDocuments.length +
    informationClients.length +
    informationActivity.length +
    informationSystem.length;

  return (
    <section className="space-y-8">
      {/* ======================================================
          HEADER
          ====================================================== */}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <div className="rounded-lg bg-amber-100 p-2">
              <Lightbulb className="h-5 w-5 text-amber-600" />
            </div>

            <span className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Management Intelligence
            </span>
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            What requires attention?
          </h2>

          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-500">
            LegalVault converts the firm's
            operational records into management
            signals covering matters, deadlines,
            tasks, workload, documents, clients
            and activity.
          </p>
        </div>

        {!loading && !error && (
          <div className="rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Intelligence signals
            </p>

            <p className="mt-1 text-xl font-bold text-slate-900">
              {insights.length}
            </p>
          </div>
        )}
      </div>

      {/* ======================================================
          SUMMARY CARDS
          ====================================================== */}

      {!loading && !error && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {/* Critical */}
          <div className="rounded-2xl border border-red-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">
                Critical
              </span>

              <div className="rounded-lg bg-red-100 p-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
              </div>
            </div>

            <p className="mt-3 text-3xl font-bold text-red-600">
              {criticalCount}
            </p>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              Immediate management attention
            </p>
          </div>

          {/* Warnings */}
          <div className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">
                Warnings
              </span>

              <div className="rounded-lg bg-amber-100 p-2">
                <ShieldAlert className="h-4 w-4 text-amber-600" />
              </div>
            </div>

            <p className="mt-3 text-3xl font-bold text-amber-600">
              {warningCount}
            </p>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              Operational issues requiring review
            </p>
          </div>

          {/* Information */}
          <div className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">
                Information
              </span>

              <div className="rounded-lg bg-blue-100 p-2">
                <Info className="h-4 w-4 text-blue-600" />
              </div>
            </div>

            <p className="mt-3 text-3xl font-bold text-blue-600">
              {infoCount}
            </p>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              Recording and management gaps
            </p>
          </div>

          {/* Positive */}
          <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">
                Positive
              </span>

              <div className="rounded-lg bg-emerald-100 p-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
            </div>

            <p className="mt-3 text-3xl font-bold text-emerald-600">
              {positiveCount}
            </p>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              Positive operational signals
            </p>
          </div>
        </div>
      )}

      {/* ======================================================
          MANAGEMENT STATUS
          ====================================================== */}

      {!loading && !error && (
        <div
          className={`rounded-2xl border p-5 ${managementStatus.container}`}
        >
          <div className="flex items-start gap-4">
            <div
              className={`rounded-xl p-3 ${managementStatus.iconContainer}`}
            >
              <ManagementIcon className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Current management status
              </p>

              <h3 className="mt-1 text-lg font-semibold text-slate-900">
                {managementStatus.title}
              </h3>

              <p className="mt-1 text-sm leading-6 text-slate-600">
                {managementStatus.message}
              </p>

              <div className="mt-4 flex flex-wrap gap-3">
                <div className="rounded-lg bg-white/70 px-3 py-2 text-xs">
                  <span className="font-semibold text-slate-500">
                    Priority signals
                  </span>

                  <span className="ml-2 font-bold text-slate-900">
                    {criticalCount +
                      warningCount}
                  </span>
                </div>

                <div className="rounded-lg bg-white/70 px-3 py-2 text-xs">
                  <span className="font-semibold text-slate-500">
                    Information gaps
                  </span>

                  <span className="ml-2 font-bold text-slate-900">
                    {informationCategoryCount}
                  </span>
                </div>

                <div className="rounded-lg bg-white/70 px-3 py-2 text-xs">
                  <span className="font-semibold text-slate-500">
                    Positive signals
                  </span>

                  <span className="ml-2 font-bold text-slate-900">
                    {positiveCount}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================
          LOADING
          ====================================================== */}

      {loading && (
        <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />

            Analysing firm data...
          </div>
        </div>
      )}

      {/* ======================================================
          ERROR
          ====================================================== */}

      {!loading && error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

            <div>
              <h3 className="font-semibold text-red-900">
                Intelligence unavailable
              </h3>

              <p className="mt-1 text-sm leading-6 text-red-700">
                {error}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================
          INTELLIGENCE
          ====================================================== */}

      {!loading &&
        !error &&
        insights.length > 0 && (
          <>
            {/* ==================================================
                PRIORITY ACTIONS
                ================================================== */}

            {priorityInsights.length >
              0 && (
              <section className="space-y-4">
                <SectionHeader
                  icon={ShieldAlert}
                  title="Priority Actions"
                  description="Critical and warning-level intelligence signals requiring management review."
                />

                <div className="space-y-4">
                  {priorityInsights.map(
                    (insight) => (
                      <InsightCard
                        key={insight.id}
                        insight={insight}
                      />
                    ),
                  )}
                </div>
              </section>
            )}

            {/* ==================================================
                INFORMATION & RECORDING GAPS
                ================================================== */}

            {informationInsights.length >
              0 && (
              <section className="space-y-6">
                <SectionHeader
                  icon={Info}
                  title="Information & Recording Gaps"
                  description="These signals do not necessarily indicate legal or operational risk. They identify areas where the firm's records may need to be completed, reviewed or maintained."
                />

                <div className="space-y-6">
                  <InsightSection
                    icon={Users}
                    title="Staff & Workload Records"
                    description="Information relating to task tracking, staff activity and workload records."
                    insights={
                      informationWorkload
                    }
                  />

                  <InsightSection
                    icon={CalendarClock}
                    title="Deadline Records"
                    description="Information relating to the recording and monitoring of matter deadlines."
                    insights={
                      informationDeadlines
                    }
                  />

                  <InsightSection
                    icon={BriefcaseBusiness}
                    title="Matter Records"
                    description="Information relating to matter administration and operational record completeness."
                    insights={
                      informationMatters
                    }
                  />

                  <InsightSection
                    icon={FileText}
                    title="Document Records"
                    description="Information relating to document storage and matter file completeness."
                    insights={
                      informationDocuments
                    }
                  />

                  <InsightSection
                    icon={Users}
                    title="Client Records"
                    description="Information relating to client portfolios and relationship concentration."
                    insights={
                      informationClients
                    }
                  />

                  <InsightSection
                    icon={Activity}
                    title="Activity Records"
                    description="Information relating to system usage and operational activity."
                    insights={
                      informationActivity
                    }
                  />

                  <InsightSection
                    icon={Target}
                    title="System Records"
                    description="Firm-wide operational data quality and system-recording indicators."
                    insights={
                      informationSystem
                    }
                  />
                </div>
              </section>
            )}

            {/* ==================================================
                POSITIVE SIGNALS
                ================================================== */}

            {positiveInsights.length >
              0 && (
              <section className="space-y-4">
                <SectionHeader
                  icon={CheckCircle2}
                  title="Positive Operational Signals"
                  description="Indicators showing where the firm's current operational records are performing well."
                />

                <div className="space-y-4">
                  {positiveInsights.map(
                    (insight) => (
                      <InsightCard
                        key={insight.id}
                        insight={insight}
                      />
                    ),
                  )}
                </div>

                {/* Positive category summary */}
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Matter
                    </p>

                    <p className="mt-1 text-xl font-bold text-emerald-700">
                      {
                        positiveCountByCategory.matter
                      }
                    </p>
                  </div>

                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Documents
                    </p>

                    <p className="mt-1 text-xl font-bold text-emerald-700">
                      {
                        positiveCountByCategory.document
                      }
                    </p>
                  </div>

                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Activity
                    </p>

                    <p className="mt-1 text-xl font-bold text-emerald-700">
                      {
                        positiveCountByCategory.activity
                      }
                    </p>
                  </div>

                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Workload
                    </p>

                    <p className="mt-1 text-xl font-bold text-emerald-700">
                      {
                        positiveCountByCategory.workload
                      }
                    </p>
                  </div>
                </div>
              </section>
            )}
          </>
        )}

      {/* ======================================================
          EMPTY STATE
          ====================================================== */}

      {!loading &&
        !error &&
        insights.length === 0 && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            </div>

            <h3 className="mt-4 text-lg font-semibold text-emerald-950">
              No intelligence signals detected
            </h3>

            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-emerald-700">
              LegalVault did not identify any
              critical, warning, information or
              positive signals using the current
              intelligence rules.
            </p>
          </div>
        )}
    </section>
  );
}