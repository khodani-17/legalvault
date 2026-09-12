import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { notFound } from "next/navigation";

export default async function MattersPage() {
  const session = await auth();

  if (!session?.user?.id || !session.user.firmId) {
    notFound();
  }

  const canCreateMatter = hasPermission(
    session.user.role,
    "matters.create"
  );

  const matters = await prisma.matter.findMany({
    where: {
      firmId: session.user.firmId,
    },
    include: {
      client: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">
              Matter Management
            </p>

            <h1 className="mt-1 text-3xl font-bold text-slate-900">
              Matters
            </h1>

            <p className="mt-2 text-slate-600">
              Manage your firm's legal matters and cases.
            </p>
          </div>

          {canCreateMatter && (
            <Link
              href="/dashboard/matters/new"
              className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-5 py-3 font-medium text-white transition hover:bg-slate-800"
            >
              + Create Matter
            </Link>
          )}
        </div>

        {/* Matters */}
        {matters.length === 0 ? (
          <section className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200">
            <div className="text-5xl">⚖️</div>

            <h2 className="mt-4 text-xl font-bold text-slate-900">
              No matters yet
            </h2>

            <p className="mx-auto mt-2 max-w-md text-slate-500">
              {canCreateMatter
                ? "Create your first legal matter to start managing cases, documents, tasks and clients."
                : "No legal matters have been created for your firm yet."}
            </p>

            {canCreateMatter && (
              <Link
                href="/dashboard/matters/new"
                className="mt-6 inline-flex rounded-lg bg-blue-700 px-5 py-3 font-medium text-white hover:bg-blue-800"
              >
                Create your first matter
              </Link>
            )}
          </section>
        ) : (
          <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">

            {/* Table Header */}
            <div className="border-b border-slate-200 px-6 py-5">
              <h2 className="text-lg font-bold text-slate-900">
                All Matters
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {matters.length}{" "}
                {matters.length === 1
                  ? "matter"
                  : "matters"}{" "}
                in your firm.
              </p>
            </div>

            {/* Desktop Table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Matter
                    </th>

                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Client
                    </th>

                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Practice Area
                    </th>

                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Status
                    </th>

                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {matters.map((matter) => (
                    <tr
                      key={matter.id}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="px-6 py-5">
                        <Link
                          href={`/dashboard/matters/${matter.id}`}
                          className="block"
                        >
                          <p className="font-semibold text-slate-900 hover:text-blue-700">
                            {matter.title}
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            {matter.referenceNumber}
                          </p>
                        </Link>
                      </td>

                      <td className="px-6 py-5">
                        <p className="font-medium text-slate-900">
                          {matter.client.name}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {matter.client.referenceNumber}
                        </p>
                      </td>

                      <td className="px-6 py-5 text-sm text-slate-600">
                        {matter.practiceArea || "—"}
                      </td>

                      <td className="px-6 py-5">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            matter.status === "OPEN"
                              ? "bg-green-100 text-green-700"
                              : matter.status === "PENDING"
                              ? "bg-yellow-100 text-yellow-700"
                              : matter.status === "CLOSED"
                              ? "bg-slate-200 text-slate-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {matter.status}
                        </span>
                      </td>

                      <td className="px-6 py-5 text-right">
                        <Link
                          href={`/dashboard/matters/${matter.id}`}
                          className="font-medium text-blue-700 hover:text-blue-900"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="divide-y divide-slate-200 md:hidden">
              {matters.map((matter) => (
                <Link
                  key={matter.id}
                  href={`/dashboard/matters/${matter.id}`}
                  className="block p-5 transition hover:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        {matter.title}
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        {matter.referenceNumber}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                        matter.status === "OPEN"
                          ? "bg-green-100 text-green-700"
                          : matter.status === "PENDING"
                          ? "bg-yellow-100 text-yellow-700"
                          : matter.status === "CLOSED"
                          ? "bg-slate-200 text-slate-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {matter.status}
                    </span>
                  </div>

                  <div className="mt-4">
                    <p className="text-sm font-medium text-slate-700">
                      {matter.client.name}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      {matter.practiceArea || "No practice area"}
                    </p>
                  </div>

                  <p className="mt-4 text-sm font-medium text-blue-700">
                    View matter →
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}