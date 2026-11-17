import MattersDirectory from "./_components/MattersDirectory";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { notFound } from "next/navigation";
import { canAccessAllFirmMatters } from "@/lib/matter-access";

export default async function MattersPage() {
  const session = await auth();

  if (!session?.user?.id || !session.user.firmId) {
    notFound();
  }

  const canCreateMatter = hasPermission(
    session.user.role,
    "matters.create"
  );

  const canViewMatters = hasPermission(
    session.user.role,
    "matters.view"
  );

  if (!canViewMatters) {
    notFound();
  }

  const where = canAccessAllFirmMatters(session.user.role)
    ? {
        firmId: session.user.firmId,
      }
    : {
        firmId: session.user.firmId,
        users: {
          some: {
            userId: session.user.id,
            canView: true,
          },
        },
      };

  const matters = await prisma.matter.findMany({
    where,
    include: {
      client: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <main className="min-h-screen bg-navy p-6">
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">
              Matter Management
            </p>

            <h1 className="mt-1 text-3xl font-bold text-navy">
              Matters
            </h1>

            <p className="mt-2 text-slate-600">
              Manage your firm's legal matters and cases.
            </p>
          </div>

          {canCreateMatter && (
            <Link
              href="/dashboard/matters/new"
              className="inline-flex items-center justify-center rounded-lg bg-navy px-5 py-3 font-medium text-white transition hover:bg-navy-light"
            >
              + Create Matter
            </Link>
          )}
        </div>

        {/* Matter categories and searchable directory */}
        <MattersDirectory matters={matters} />
      </div>
    </main>
  );
}