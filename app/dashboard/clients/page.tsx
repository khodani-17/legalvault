import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";

export default async function ClientsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const canCreateClients = hasPermission(
    session.user.role,
    "clients.create"
  );

  const clients = await prisma.client.findMany({
    where: {
      firmId: session.user.firmId,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      referenceNumber: true,
      name: true,
      type: true,
      email: true,
      phone: true,
      _count: {
        select: {
          matters: true,
        },
      },
    },
  });

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <Link
              href="/dashboard"
              className="text-2xl font-bold tracking-tight text-slate-900"
            >
              LEGALVAULT
            </Link>

            <p className="text-sm text-slate-500">
              Legal Document Management System
            </p>
          </div>

          <div className="text-right">
            <p className="font-medium text-slate-900">
              {session.user.name}
            </p>

            <p className="text-sm text-slate-500">
              {session.user.role}
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">
              Client Management
            </p>

            <h1 className="mt-1 text-3xl font-bold text-slate-900">
              Clients
            </h1>

            <p className="mt-2 text-slate-600">
              Manage your firm's clients and their legal matters.
            </p>
          </div>

          {canCreateClients && (
            <Link
              href="/dashboard/clients/new"
              className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
            >
              + Add Client
            </Link>
          )}
        </div>

        <div className="mt-8 overflow-hidden rounded-xl border bg-white shadow-sm">
          {clients.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <h2 className="text-lg font-semibold text-slate-900">
                No clients yet
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                {canCreateClients
                  ? "Create your first client to start managing legal matters."
                  : "No clients have been created for your firm yet."}
              </p>

              {canCreateClients && (
                <Link
                  href="/dashboard/clients/new"
                  className="mt-6 inline-block rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
                >
                  Add your first client
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="border-b bg-slate-50">
                  <tr>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-700">
                      Reference
                    </th>

                    <th className="px-6 py-4 text-sm font-semibold text-slate-700">
                      Client
                    </th>

                    <th className="px-6 py-4 text-sm font-semibold text-slate-700">
                      Type
                    </th>

                    <th className="px-6 py-4 text-sm font-semibold text-slate-700">
                      Contact
                    </th>

                    <th className="px-6 py-4 text-sm font-semibold text-slate-700">
                      Matters
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {clients.map((client) => (
                    <tr
                      key={client.id}
                      className="hover:bg-slate-50"
                    >
                      <td className="px-6 py-4">
                        <Link
                          href={`/dashboard/clients/${client.id}`}
                          className="font-medium text-slate-900 hover:underline"
                        >
                          {client.referenceNumber}
                        </Link>
                      </td>

                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-900">
                          {client.name}
                        </p>

                        <p className="text-sm text-slate-500">
                          {client.email || "No email"}
                        </p>
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-600">
                        {client.type}
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-600">
                        {client.phone || "No phone"}
                      </td>

                      <td className="px-6 py-4 text-sm font-medium text-slate-900">
                        {client._count.matters}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}