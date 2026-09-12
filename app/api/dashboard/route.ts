import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions-server";

export async function GET(request: Request) {
  try {
    const authorization =
      await requirePermission("dashboard.view");

    if (!authorization.authorized) {
      return authorization.response;
    }

    const session = authorization.session;

    const firmId = session.user.firmId;

    const [
      clients,
      matters,
      documents,
      tasks,
      recentDocuments,
      recentMatters,
    ] = await Promise.all([
      prisma.client.count({
        where: {
          firmId,
        },
      }),

      prisma.matter.count({
        where: {
          firmId,
        },
      }),

      prisma.document.count({
        where: {
          firmId,
          status: "ACTIVE",
        },
      }),

      prisma.task.count({
        where: {
          firmId,
          status: {
            not: "COMPLETED",
          },
        },
      }),

      prisma.document.findMany({
        where: {
          firmId,
          status: "ACTIVE",
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 5,
        select: {
          id: true,
          referenceNumber: true,
          name: true,
          originalName: true,
          createdAt: true,
        },
      }),

      prisma.matter.findMany({
        where: {
          firmId,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 5,
        select: {
          id: true,
          referenceNumber: true,
          title: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);

    // ----------------------------------------------------------
    // AUDIT LOG
    // ----------------------------------------------------------

    await createAuditLog({
      request,
      firmId,
      userId: session.user.id,
      action: "READ",
      entityType: "Dashboard",
      description: "Viewed firm dashboard.",
      metadata: {
        clientCount: clients,
        matterCount: matters,
        activeDocumentCount: documents,
        outstandingTaskCount: tasks,
        recentDocumentCount:
          recentDocuments.length,
        recentMatterCount:
          recentMatters.length,
      },
    });

    return NextResponse.json({
      statistics: {
        clients,
        matters,
        documents,
        tasks,
      },
      recentDocuments,
      recentMatters,
    });
  } catch (error) {
    console.error("Dashboard error:", error);

    return NextResponse.json(
      {
        error: "Failed to load dashboard",
      },
      {
        status: 500,
      }
    );
  }
}