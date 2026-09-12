import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions-server";

const PRIVILEGED_ROLES = [
  "SUPER_ADMIN",
  "MANAGING_PARTNER",
  "PARTNER",
  "DIRECTOR",
  "ADMIN",
];

export async function GET(request: Request) {
  try {
    // =====================================================
    // 1. CENTRAL RBAC PERMISSION
    // =====================================================

    const authorization =
      await requirePermission("documents.view");

    if (!authorization.authorized) {
      return authorization.response;
    }

    const session = authorization.session;

    // =====================================================
    // 2. AUTHENTICATION
    // =====================================================

    if (
      !session.user.id ||
      !session.user.firmId
    ) {
      return NextResponse.json(
        {
          error: "Unauthorized.",
        },
        {
          status: 401,
        }
      );
    }

    const userId = session.user.id;
    const firmId = session.user.firmId;

    // =====================================================
    // 3. VERIFY USER
    // =====================================================

    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        firmId,
        status: "ACTIVE",
      },

      select: {
        id: true,
        role: true,
        name: true,
        email: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          error:
            "Your user account could not be verified.",
        },
        {
          status: 403,
        }
      );
    }

    // =====================================================
    // 4. QUERY PARAMETERS
    // =====================================================

    const { searchParams } = new URL(
      request.url
    );

    const matterId =
      searchParams.get("matterId");

    // =====================================================
    // 5. VERIFY MATTER IF SPECIFIED
    // =====================================================

    if (matterId) {
      const matter =
        await prisma.matter.findFirst({
          where: {
            id: matterId,
            firmId,
          },

          select: {
            id: true,
          },
        });

      if (!matter) {
        return NextResponse.json(
          {
            error:
              "Matter not found or does not belong to your firm.",
          },
          {
            status: 403,
          }
        );
      }
    }

    // =====================================================
    // 6. MATTER-LEVEL ACCESS CONTROL
    // =====================================================

    const isPrivileged =
      PRIVILEGED_ROLES.includes(
        user.role
      );

    /*
     * Privileged users:
     *
     * SUPER_ADMIN
     * MANAGING_PARTNER
     * PARTNER
     * DIRECTOR
     * ADMIN
     *
     * can see all documents belonging
     * to their firm.
     *
     * Ordinary users can only see documents
     * belonging to matters where they have
     * canView permission.
     */

    let allowedMatterIds:
      | string[]
      | undefined;

    if (!isPrivileged) {
      const matterAccess =
        await prisma.matterUser.findMany({
          where: {
            userId,
            canView: true,
            matter: {
              firmId,
            },
          },

          select: {
            matterId: true,
          },
        });

      allowedMatterIds =
        matterAccess.map(
          (access) =>
            access.matterId
        );

      /*
       * If the user has no matter access,
       * return an empty repository.
       */

      if (
        allowedMatterIds.length === 0
      ) {
        await createAuditLog({
          request,
          firmId,
          userId,
          action: "READ",
          entityType: "Document",
          description:
            "Viewed document repository with no accessible matters.",
          metadata: {
            matterId,
            resultCount: 0,
            accessLevel: "RESTRICTED",
            privileged: false,
          },
        });

        return NextResponse.json(
          {
            documents: [],
            count: 0,
          },
          {
            status: 200,
          }
        );
      }

      /*
       * If a specific matter was requested,
       * make sure the user can view it.
       */

      if (
        matterId &&
        !allowedMatterIds.includes(
          matterId
        )
      ) {
        return NextResponse.json(
          {
            error:
              "You do not have permission to view documents for this matter.",
          },
          {
            status: 403,
          }
        );
      }
    }

    // =====================================================
    // 7. BUILD DOCUMENT FILTER
    // =====================================================

    const documentWhere = {
      firmId,

      status: {
        not: "DELETED" as const,
      },

      ...(matterId
        ? {
            matterId,
          }
        : isPrivileged
        ? {}
        : {
            matterId: {
              in:
                allowedMatterIds ?? [],
            },
          }),
    };

    // =====================================================
    // 8. FETCH DOCUMENTS
    // =====================================================

    const documents =
      await prisma.document.findMany({
        where: documentWhere,

        include: {
          // =================================================
          // MATTER
          // =================================================

          matter: {
            select: {
              id: true,
              referenceNumber: true,
              title: true,
            },
          },

          // =================================================
          // FOLDER
          // =================================================

          folder: {
            select: {
              id: true,
              name: true,
            },
          },

          // =================================================
          // UPLOADED BY
          // =================================================

          uploadedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },

        orderBy: {
          createdAt: "desc",
        },
      });

    // =====================================================
    // 9. SERIALIZE BIGINT
    // =====================================================

    const serializedDocuments =
      documents.map(
        (document) => ({
          ...document,

          size:
            document.size.toString(),

          tags:
            document.tags ?? [],
        })
      );

    // =====================================================
    // 10. AUDIT LOG
    // =====================================================

    await createAuditLog({
      request,
      firmId,
      userId,
      action: "READ",
      entityType: "Document",
      description:
        "Viewed document repository.",
      metadata: {
        matterId,
        resultCount:
          serializedDocuments.length,
        accessLevel: isPrivileged
          ? "FULL_FIRM_ACCESS"
          : "MATTER_ACCESS",
        privileged: isPrivileged,
        role: user.role,
      },
    });

    // =====================================================
    // 11. RESPONSE
    // =====================================================

    return NextResponse.json(
      {
        documents:
          serializedDocuments,

        count:
          serializedDocuments.length,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "GET /api/documents error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load documents.",
      },
      {
        status: 500,
      }
    );
  }
}