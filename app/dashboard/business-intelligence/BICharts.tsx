"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type BIChartsProps = {
  matterStatus: {
    status: string;
    count: number;
  }[];

  clientType: {
    type: string;
    count: number;
  }[];

  activityTrend: {
    date: string;
    count: number;
  }[];

  staffWorkload: {
    name: string;
    active: number;
    completed: number;
    overdue: number;
  }[];

  staffPriorities: {
    name: string;
    highPriority: number;
    urgent: number;
  }[];

  staffDeadlines: {
    name: string;
    upcoming: number;
    overdue: number;
    critical: number;
  }[];
};

const COLORS = [
  "#2563eb",
  "#f59e0b",
  "#16a34a",
  "#dc2626",
  "#7c3aed",
];

function formatMonth(value: string | number) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString("en-ZA", {
    month: "short",
    year: "numeric",
  });
}

function formatFullMonth(value: string | number) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString("en-ZA", {
    month: "long",
    year: "numeric",
  });
}

function shortenName(name: string) {
  if (name.length <= 16) {
    return name;
  }

  return `${name.slice(0, 15)}…`;
}

export default function BICharts({
  matterStatus,
  clientType,
  activityTrend,
  staffWorkload,
  staffPriorities,
  staffDeadlines,
}: BIChartsProps) {
  return (
    <section className="space-y-6">
      {/* Existing BI charts */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Matter Status */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-slate-900">
              Matter Status
            </h2>

            <p className="text-sm text-slate-500">
              Distribution of matters by current status.
            </p>
          </div>

          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={matterStatus}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={3}
                  label
                >
                  {matterStatus.map((entry, index) => (
                    <Cell
                      key={`matter-${entry.status}`}
                      fill={
                        COLORS[index % COLORS.length]
                      }
                    />
                  ))}
                </Pie>

                <Tooltip />

                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Client Distribution */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-slate-900">
              Client Distribution
            </h2>

            <p className="text-sm text-slate-500">
              Distribution of clients by client type.
            </p>
          </div>

          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={clientType}
                  dataKey="count"
                  nameKey="type"
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={3}
                  label
                >
                  {clientType.map((entry, index) => (
                    <Cell
                      key={`client-${entry.type}`}
                      fill={
                        COLORS[index % COLORS.length]
                      }
                    />
                  ))}
                </Pie>

                <Tooltip />

                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Six-Month Firm Activity */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
          <div className="mb-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Firm Activity
                </h2>

                <p className="text-sm text-slate-500">
                  Rolling six-month view of system
                  activity.
                </p>
              </div>

              <div className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                6-Month Rolling
              </div>
            </div>
          </div>

          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={activityTrend}
                margin={{
                  top: 10,
                  right: 20,
                  left: 0,
                  bottom: 10,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />

                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => {
                    if (
                      typeof value !== "string" &&
                      typeof value !== "number"
                    ) {
                      return "";
                    }

                    return formatMonth(value);
                  }}
                />

                <YAxis allowDecimals={false} />

                <Tooltip
                  labelFormatter={(value) => {
                    if (
                      typeof value !== "string" &&
                      typeof value !== "number"
                    ) {
                      return "";
                    }

                    return formatFullMonth(value);
                  }}
                  formatter={(value) => [
                    value,
                    "Activity",
                  ]}
                />

                <Line
                  type="monotone"
                  dataKey="count"
                  name="Activity"
                  stroke="#2563eb"
                  strokeWidth={3}
                  dot={{ r: 5 }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-500">
              The chart automatically moves forward
              each month.
            </p>

            <p className="text-xs font-medium text-slate-600">
              {activityTrend.length} months displayed
            </p>
          </div>
        </div>
      </div>

      {/* Staff Performance */}
      <div>
        <div className="mb-4">
          <h2 className="text-xl font-bold text-slate-900">
            Staff Performance &amp; Workload
          </h2>

          <p className="text-sm text-slate-500">
            Compare staff workload, completed work,
            overdue tasks and operational pressure.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* Staff workload */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h3 className="text-lg font-semibold text-slate-900">
                Staff Workload
              </h3>

              <p className="text-sm text-slate-500">
                Active, completed and overdue tasks by
                staff member.
              </p>
            </div>

            {staffWorkload.length === 0 ? (
              <div className="flex h-[350px] items-center justify-center rounded-xl bg-slate-50">
                <p className="text-sm text-slate-500">
                  No assigned task activity available.
                </p>
              </div>
            ) : (
              <div className="h-[350px]">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <BarChart
                    data={staffWorkload}
                    margin={{
                      top: 10,
                      right: 10,
                      left: 0,
                      bottom: 50,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />

                    <XAxis
                      dataKey="name"
                      angle={-35}
                      textAnchor="end"
                      interval={0}
                      height={70}
                      tickFormatter={shortenName}
                    />

                    <YAxis allowDecimals={false} />

                    <Tooltip />

                    <Legend />

                    <Bar
                      dataKey="active"
                      name="Active"
                      fill="#2563eb"
                      radius={[4, 4, 0, 0]}
                    />

                    <Bar
                      dataKey="completed"
                      name="Completed"
                      fill="#16a34a"
                      radius={[4, 4, 0, 0]}
                    />

                    <Bar
                      dataKey="overdue"
                      name="Overdue"
                      fill="#dc2626"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Priority workload */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h3 className="text-lg font-semibold text-slate-900">
                Priority Workload
              </h3>

              <p className="text-sm text-slate-500">
                High-priority and urgent work currently
                assigned to staff.
              </p>
            </div>

            {staffPriorities.length === 0 ? (
              <div className="flex h-[350px] items-center justify-center rounded-xl bg-slate-50">
                <p className="text-sm text-slate-500">
                  No high-priority or urgent workload.
                </p>
              </div>
            ) : (
              <div className="h-[350px]">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <BarChart
                    data={staffPriorities}
                    margin={{
                      top: 10,
                      right: 10,
                      left: 0,
                      bottom: 50,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />

                    <XAxis
                      dataKey="name"
                      angle={-35}
                      textAnchor="end"
                      interval={0}
                      height={70}
                      tickFormatter={shortenName}
                    />

                    <YAxis allowDecimals={false} />

                    <Tooltip />

                    <Legend />

                    <Bar
                      dataKey="highPriority"
                      name="High Priority"
                      fill="#f59e0b"
                      radius={[4, 4, 0, 0]}
                    />

                    <Bar
                      dataKey="urgent"
                      name="Urgent"
                      fill="#dc2626"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Deadline workload */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
            <div className="mb-5">
              <h3 className="text-lg font-semibold text-slate-900">
                Staff Deadline Workload
              </h3>

              <p className="text-sm text-slate-500">
                Upcoming, overdue and high/critical
                deadlines by staff member.
              </p>
            </div>

            {staffDeadlines.length === 0 ? (
              <div className="flex h-[320px] items-center justify-center rounded-xl bg-slate-50">
                <p className="text-sm text-slate-500">
                  No assigned deadline workload detected.
                </p>
              </div>
            ) : (
              <div className="h-[320px]">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <BarChart
                    data={staffDeadlines}
                    margin={{
                      top: 10,
                      right: 10,
                      left: 0,
                      bottom: 50,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />

                    <XAxis
                      dataKey="name"
                      angle={-35}
                      textAnchor="end"
                      interval={0}
                      height={70}
                      tickFormatter={shortenName}
                    />

                    <YAxis allowDecimals={false} />

                    <Tooltip />

                    <Legend />

                    <Bar
                      dataKey="upcoming"
                      name="Upcoming"
                      fill="#2563eb"
                      radius={[4, 4, 0, 0]}
                    />

                    <Bar
                      dataKey="overdue"
                      name="Overdue"
                      fill="#dc2626"
                      radius={[4, 4, 0, 0]}
                    />

                    <Bar
                      dataKey="critical"
                      name="High/Critical"
                      fill="#7c3aed"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}