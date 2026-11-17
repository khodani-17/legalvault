import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions-server";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type SearchType = "all" | "matters" | "clients" | "documents";

// SECURITY: This first release requires explicit MatterUser.canView for every
// matter, document, and client result. It does not assume that a senior role
// automatically bypasses matter-level restrictions.
export async function GET(request: NextRequest) {
  const permission = await requirePermission("dashboard.view");
  if (!permission.authorized) return permission.response;

  const session = permission.session;
  const userId = session?.user?.id;
  const firmId = session?.user?.firmId;
  const role = session?.user?.role ?? "";
  if (!userId || !firmId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const rawType = url.searchParams.get("type") ?? "all";
  const type: SearchType = ["all", "matters", "clients", "documents"].includes(rawType)
    ? (rawType as SearchType)
    : "all";

  if (query.length < 2) return NextResponse.json({ results: [] });

  const visibleMatter = {
    firmId,
    users: { some: { userId, canView: true } },
  };
  const match = (value: string) => ({ contains: value, mode: "insensitive" as const });

  const terms = query.split(/\s+/).filter(Boolean);

  const amountVariants = (term: string) => {
    const variants = [term];

    if (/^\d{4,}$/.test(term)) {
      variants.push(
        term.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
      );
    }

    return variants;
  };

  const matterSearch = (term: string) => ({
    OR: amountVariants(term).flatMap((value) => [
      { referenceNumber: match(value) },
      { title: match(value) },
      { description: match(value) },
      { practiceArea: match(value) },
      { client: { name: match(value) } },
    ]),
  });

  const clientSearch = (term: string) => ({
    OR: [
      { name: match(term) },
      { referenceNumber: match(term) },
    ],
  });

  const documentSearch = (term: string) => ({
    OR: [
      { name: match(term) },
      { originalName: match(term) },
      { referenceNumber: match(term) },
      { category: match(term) },
      { tags: { has: term } },
      { matter: { title: match(term) } },
      { matter: { referenceNumber: match(term) } },
    ],
  });

  try {
    const [matters, clients, documents] = await Promise.all([
      (type === "all" || type === "matters") && hasPermission(role, "matters.view")
        ? prisma.matter.findMany({
            where: {
              ...visibleMatter,
              AND: terms.map(matterSearch),
            },
            select: { id: true, title: true, referenceNumber: true, practiceArea: true, client: { select: { name: true } } },
            take: 8,
            orderBy: { updatedAt: "desc" },
          })
        : Promise.resolve([]),
      (type === "all" || type === "clients") && hasPermission(role, "clients.view")
        ? prisma.client.findMany({
            where: {
              firmId,
              AND: terms.map(clientSearch),
            },
            select: { id: true, name: true, referenceNumber: true },
            take: 8,
            orderBy: { updatedAt: "desc" },
          })
        : Promise.resolve([]),
      (type === "all" || type === "documents") && hasPermission(role, "documents.view")
        ? prisma.document.findMany({
            where: {
              firmId,
              status: "ACTIVE",
              matter: visibleMatter,
              AND: terms.map(documentSearch),
            },
            select: { id: true, name: true, referenceNumber: true, category: true, matter: { select: { referenceNumber: true } } },
            take: 8,
            orderBy: { updatedAt: "desc" },
          })
        : Promise.resolve([]),
    ]);

    const results = [
      ...matters.map((m) => ({
        id: m.id, type: "matter" as const, title: m.title,
        subtitle: [m.referenceNumber, m.client.name, m.practiceArea].filter(Boolean).join("  ·  "),
        href: `/dashboard/matters/${encodeURIComponent(m.id)}`,
      })),
      ...clients.map((c) => ({
        id: c.id, type: "client" as const, title: c.name,
        subtitle: c.referenceNumber,
        href: `/dashboard/clients/${encodeURIComponent(c.id)}`,
      })),
      ...documents.map((d) => ({
        id: d.id, type: "document" as const, title: d.name,
        subtitle: [d.referenceNumber, d.matter.referenceNumber, d.category].filter(Boolean).join("  ·  "),
        href: `/dashboard/documents/${encodeURIComponent(d.id)}`,
      })),
    ];

    return NextResponse.json({ results }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("SmartAccess search failed", error);
    return NextResponse.json({ error: "Search unavailable" }, { status: 500 });
  }
}
