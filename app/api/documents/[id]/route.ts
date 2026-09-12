import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions-server";
import { userCanAccessMatter } from "@/lib/matter-access";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const PRIVILEGED_ROLES = [
  "SUPER_ADMIN",
  "MANAGING_PARTNER",
  "PARTNER",
  "DIRECTOR",
  "ADMIN",
];

// =====================================================
// GET DOCUMENT
// =====================================================

export async function GET(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const authorization =
      await requirePermission("documents.view");

    if (!authorization.authorized) {
      return authorization.response;
    }

    const session = authorization.session;

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

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        {
          error: "Document ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // VERIFY ACTIVE USER
    // =================================================

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

    // =================================================
    // FIND DOCUMENT
    // =================================================

    const document =
      await prisma.document.findFirst({
        where: {
          id,
          firmId,
          status: {
            not: "DELETED",
          },
        },

        include: {
          matter: {
            select: {
              id: true,
              referenceNumber: true,
              title: true,
            },
          },

          folder: {
            select: {
              id: true,
              name: true,
            },
          },

          uploadedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

    if (!document) {
      return NextResponse.json(
        {
          error: "Document not found.",
        },
        {
          status: 404,
        }
      );
    }

    // =================================================
    // MATTER-LEVEL ACCESS
    // =================================================

    const canAccess =
      await userCanAccessMatter({
        matterId: document.matterId,
        userId,
        firmId,
        role: user.role,
      });

    if (!canAccess) {
      return NextResponse.json(
        {
          error: "Document not found.",
        },
        {
          status: 404,
        }
      );
    }

    // =================================================
    // AUDIT
    // =================================================

    await createAuditLog({
      request,
      firmId,
      userId: user.id,
      action: "READ",
      entityType: "Document",
      entityId: document.id,
      description:
        `Viewed document ${document.referenceNumber}: ${document.name}.`,
      metadata: {
        documentId: document.id,
        documentReference:
          document.referenceNumber,
        documentName: document.name,
        matterId: document.matterId,
        matterReference:
          document.matter?.referenceNumber ?? null,
        folderId: document.folderId,
        permission: "documents.view",
      },
    });

    return NextResponse.json({
      document: {
        ...document,

        size:
          document.size.toString(),

        tags:
          document.tags ?? [],
      },
    });
  } catch (error) {
    console.error(
      "GET /api/documents/[id] error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load document.",
      },
      {
        status: 500,
      }
    );
  }
}

// =====================================================
// UPDATE DOCUMENT METADATA
// =====================================================

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const authorization =
      await requirePermission("documents.update");

    if (!authorization.authorized) {
      return authorization.response;
    }

    const session = authorization.session;

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

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        {
          error: "Document ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // VERIFY ACTIVE USER
    // =================================================

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

    // =================================================
    // FIND DOCUMENT
    // =================================================

    const document =
      await prisma.document.findFirst({
        where: {
          id,
          firmId,
          status: {
            not: "DELETED",
          },
        },

        select: {
          id: true,
          firmId: true,
          matterId: true,
          name: true,
          category: true,
          tags: true,
          folderId: true,
          referenceNumber: true,
          status: true,
        },
      });

    if (!document) {
      return NextResponse.json(
        {
          error: "Document not found.",
        },
        {
          status: 404,
        }
      );
    }

    // =================================================
    // MATTER-LEVEL MANAGEMENT ACCESS
    // =================================================

    const isPrivileged =
      PRIVILEGED_ROLES.includes(
        user.role
      );

    let canEdit = isPrivileged;

    if (!isPrivileged) {
      const matterAccess =
        await prisma.matterUser.findFirst({
          where: {
            matterId: document.matterId,
            userId,
            canView: true,
          },

          select: {
            canManage: true,
          },
        });

      canEdit =
        matterAccess?.canManage === true;
    }

    if (!canEdit) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to edit this document.",
        },
        {
          status: 403,
        }
      );
    }

    // =================================================
    // REQUEST BODY
    // =================================================

    let body: {
      documentName?: unknown;
      category?: unknown;
      folderId?: unknown;
      tags?: unknown;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          error: "Invalid JSON request.",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // NORMALISE
    // =================================================

    const documentName =
      typeof body.documentName === "string"
        ? body.documentName.trim()
        : undefined;

    const category =
      typeof body.category === "string"
        ? body.category.trim()
        : undefined;

    const folderId =
      body.folderId === null ||
      body.folderId === ""
        ? null
        : typeof body.folderId === "string"
        ? body.folderId.trim()
        : undefined;

    let tags: string[] | undefined;

    if (Array.isArray(body.tags)) {
      tags = body.tags
        .filter(
          (tag: unknown): tag is string =>
            typeof tag === "string"
        )
        .map((tag: string) =>
          tag.trim()
        )
        .filter(
          (tag: string): boolean =>
            Boolean(tag)
        )
        .filter(
          (
            tag: string,
            index: number,
            array: string[]
          ): boolean =>
            array.indexOf(tag) === index
        );
    } else if (
      typeof body.tags === "string"
    ) {
      tags = body.tags
        .split(",")
        .map((tag: string) =>
          tag.trim()
        )
        .filter(
          (tag: string): boolean =>
            Boolean(tag)
        )
        .filter(
          (
            tag: string,
            index: number,
            array: string[]
          ): boolean =>
            array.indexOf(tag) === index
        );
    }

    // =================================================
    // VALIDATION
    // =================================================

    if (
      documentName !== undefined &&
      !documentName
    ) {
      return NextResponse.json(
        {
          error:
            "Document name cannot be empty.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      documentName !== undefined &&
      documentName.length > 200
    ) {
      return NextResponse.json(
        {
          error:
            "Document name cannot exceed 200 characters.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      category !== undefined &&
      category.length > 100
    ) {
      return NextResponse.json(
        {
          error:
            "Category cannot exceed 100 characters.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      tags !== undefined &&
      tags.length > 50
    ) {
      return NextResponse.json(
        {
          error:
            "A maximum of 50 tags is allowed.",
        },
        {
          status: 400,
        }
      );
    }

    for (const tag of tags ?? []) {
      if (tag.length > 100) {
        return NextResponse.json(
          {
            error:
              "Each tag cannot exceed 100 characters.",
          },
          {
            status: 400,
          }
        );
      }
    }

    // =================================================
    // VERIFY FOLDER
    // =================================================

    if (
      folderId !== undefined &&
      folderId !== null
    ) {
      const folder =
        await prisma.folder.findFirst({
          where: {
            id: folderId,
            firmId,
            matterId: document.matterId,
          },

          select: {
            id: true,
          },
        });

      if (!folder) {
        return NextResponse.json(
          {
            error:
              "The selected folder does not belong to this matter.",
          },
          {
            status: 400,
          }
        );
      }
    }

    // =================================================
    // BUILD UPDATE DATA
    // =================================================

    const updateData: {
      name?: string;
      category?: string | null;
      folderId?: string | null;
      tags?: string[];
    } = {};

    if (
      documentName !== undefined
    ) {
      updateData.name =
        documentName;
    }

    if (
      category !== undefined
    ) {
      updateData.category =
        category || null;
    }

    if (
      folderId !== undefined
    ) {
      updateData.folderId =
        folderId;
    }

    if (
      tags !== undefined
    ) {
      updateData.tags =
        tags;
    }

    // =================================================
    // DETERMINE CHANGES
    // =================================================

    const changes: string[] = [];

    if (
      documentName !== undefined &&
      documentName !== document.name
    ) {
      changes.push(
        `name from "${document.name}" to "${documentName}"`
      );
    }

    if (
      category !== undefined &&
      category !== document.category
    ) {
      changes.push(
        `category from "${document.category || "None"}" to "${category || "None"}"`
      );
    }

    if (
      folderId !== undefined &&
      folderId !== document.folderId
    ) {
      changes.push("folder");
    }

    if (
      tags !== undefined &&
      JSON.stringify(tags) !==
        JSON.stringify(
          document.tags ?? []
        )
    ) {
      changes.push("tags");
    }

    // =================================================
    // UPDATE
    // =================================================

    const result =
      await prisma.$transaction(
        async (tx) => {
          const updatedDocument =
            await tx.document.update({
              where: {
                id: document.id,
              },

              data: updateData,

              include: {
                matter: {
                  select: {
                    id: true,
                    referenceNumber: true,
                    title: true,
                  },
                },

                folder: {
                  select: {
                    id: true,
                    name: true,
                  },
                },

                uploadedBy: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            });

          await createAuditLog({
            request,
            firmId,
            userId: user.id,
            action: "UPDATE",
            entityType: "Document",
            entityId: document.id,
            description:
              changes.length > 0
                ? `Updated document ${document.referenceNumber}: ${changes.join(
                    ", "
                  )}.`
                : `Updated document ${document.referenceNumber}.`,
            metadata: {
              documentId: document.id,
              documentReference:
                document.referenceNumber,
              permission:
                "documents.update",
              changes,

              previousValues: {
                name: document.name,
                category:
                  document.category,
                folderId:
                  document.folderId,
                tags:
                  document.tags ?? [],
              },

              newValues: {
                name:
                  documentName !== undefined
                    ? documentName
                    : document.name,

                category:
                  category !== undefined
                    ? category || null
                    : document.category,

                folderId:
                  folderId !== undefined
                    ? folderId
                    : document.folderId,

                tags:
                  tags !== undefined
                    ? tags
                    : document.tags ?? [],
              },
            },
          });

          return updatedDocument;
        }
      );

    return NextResponse.json({
      success: true,

      message:
        "Document updated successfully.",

      document: {
        ...result,

        size:
          result.size.toString(),

        tags:
          result.tags ?? [],
      },
    });
  } catch (error) {
    console.error(
      "PATCH /api/documents/[id] error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update document.",
      },
      {
        status: 500,
      }
    );
  }
}

// =====================================================
// ARCHIVE / RESTORE DOCUMENT
// =====================================================

export async function POST(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const sessionAuthorization =
      await requirePermission("documents.view");

    if (!sessionAuthorization.authorized) {
      return sessionAuthorization.response;
    }

    const session =
      sessionAuthorization.session;

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

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        {
          error: "Document ID is required.",
        },
        {
          status: 400,
        }
      );
    }

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

    // =================================================
    // REQUEST BODY
    // =================================================

    let body: {
      action?: unknown;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          error: "Invalid JSON request.",
        },
        {
          status: 400,
        }
      );
    }

    const action =
      typeof body.action === "string"
        ? body.action.trim().toUpperCase()
        : "";

    if (
      action !== "ARCHIVE" &&
      action !== "RESTORE"
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid action. Use ARCHIVE or RESTORE.",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // ACTION-SPECIFIC RBAC
    // =================================================

    const requiredPermission =
      action === "ARCHIVE"
        ? "documents.archive"
        : "documents.restore";

    const authorization =
      await requirePermission(
        requiredPermission
      );

    if (!authorization.authorized) {
      return authorization.response;
    }

    // =================================================
    // FIND DOCUMENT
    // =================================================

    const document =
      await prisma.document.findFirst({
        where: {
          id,
          firmId,
        },

        select: {
          id: true,
          firmId: true,
          matterId: true,
          referenceNumber: true,
          name: true,
          status: true,
          deletedAt: true,
        },
      });

    if (!document) {
      return NextResponse.json(
        {
          error: "Document not found.",
        },
        {
          status: 404,
        }
      );
    }

    if (document.status === "DELETED") {
      return NextResponse.json(
        {
          error:
            "Deleted documents cannot be archived or restored.",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // MATTER-LEVEL MANAGEMENT ACCESS
    // =================================================

    const isPrivileged =
      PRIVILEGED_ROLES.includes(
        user.role
      );

    let canManage = isPrivileged;

    if (!isPrivileged) {
      const matterAccess =
        await prisma.matterUser.findFirst({
          where: {
            matterId: document.matterId,
            userId,
          },

          select: {
            canManage: true,
          },
        });

      canManage =
        matterAccess?.canManage === true;
    }

    if (!canManage) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to manage this document.",
        },
        {
          status: 403,
        }
      );
    }

    // =================================================
    // STATUS VALIDATION
    // =================================================

    if (
      action === "ARCHIVE" &&
      document.status === "ARCHIVED"
    ) {
      return NextResponse.json(
        {
          error:
            "Document is already archived.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      action === "RESTORE" &&
      document.status === "ACTIVE"
    ) {
      return NextResponse.json(
        {
          error:
            "Document is already active.",
        },
        {
          status: 400,
        }
      );
    }

    const newStatus =
      action === "ARCHIVE"
        ? "ARCHIVED"
        : "ACTIVE";

    // =================================================
    // UPDATE STATUS
    // =================================================

    const result =
      await prisma.$transaction(
        async (tx) => {
          const updatedDocument =
            await tx.document.update({
              where: {
                id: document.id,
              },

              data: {
                status: newStatus,
              },
            });

          await createAuditLog({
            request,
            firmId,
            userId: user.id,
            action:
              action === "ARCHIVE"
                ? "ARCHIVE"
                : "RESTORE",
            entityType: "Document",
            entityId: document.id,
            description:
              action === "ARCHIVE"
                ? `Archived document ${document.referenceNumber}: ${document.name}.`
                : `Restored document ${document.referenceNumber}: ${document.name}.`,
            metadata: {
              documentId: document.id,
              documentReference:
                document.referenceNumber,
              permission:
                requiredPermission,
              previousStatus:
                document.status,
              newStatus,
              action,
            },
          });

          return updatedDocument;
        }
      );

    return NextResponse.json({
      success: true,

      message:
        action === "ARCHIVE"
          ? "Document archived successfully."
          : "Document restored successfully.",

      document: {
        ...result,

        size:
          result.size.toString(),

        tags:
          result.tags ?? [],
      },
    });
  } catch (error) {
    console.error(
      "POST /api/documents/[id] error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update document status.",
      },
      {
        status: 500,
      }
    );
  }
}

// =====================================================
// SOFT DELETE DOCUMENT
// =====================================================

export async function DELETE(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const authorization =
      await requirePermission("documents.delete");

    if (!authorization.authorized) {
      return authorization.response;
    }

    const session = authorization.session;

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

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        {
          error: "Document ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // VERIFY ACTIVE USER
    // =================================================

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

    // =================================================
    // FIND DOCUMENT
    // =================================================

    const document =
      await prisma.document.findFirst({
        where: {
          id,
          firmId,
        },

        select: {
          id: true,
          firmId: true,
          matterId: true,
          referenceNumber: true,
          name: true,
          status: true,
        },
      });

    if (!document) {
      return NextResponse.json(
        {
          error: "Document not found.",
        },
        {
          status: 404,
        }
      );
    }

    if (document.status === "DELETED") {
      return NextResponse.json(
        {
          error:
            "Document has already been deleted.",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // MATTER-LEVEL DELETE ACCESS
    // =================================================

    const isPrivileged =
      PRIVILEGED_ROLES.includes(
        user.role
      );

    let canDelete = isPrivileged;

    if (!isPrivileged) {
      const matterAccess =
        await prisma.matterUser.findFirst({
          where: {
            matterId: document.matterId,
            userId,
          },

          select: {
            canDelete: true,
          },
        });

      canDelete =
        matterAccess?.canDelete === true;
    }

    if (!canDelete) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to delete this document.",
        },
        {
          status: 403,
        }
      );
    }

    // =================================================
    // SOFT DELETE
    // =================================================

    const result =
      await prisma.$transaction(
        async (tx) => {
          const deletedDocument =
            await tx.document.update({
              where: {
                id: document.id,
              },

              data: {
                status: "DELETED",
                deletedAt: new Date(),
              },
            });

          await createAuditLog({
            request,
            firmId,
            userId: user.id,
            action: "DELETE",
            entityType: "Document",
            entityId: document.id,
            description:
              `Soft-deleted document ${document.referenceNumber}: ${document.name}.`,
            metadata: {
              documentId: document.id,
              documentReference:
                document.referenceNumber,
              permission:
                "documents.delete",
              previousStatus:
                document.status,
              newStatus: "DELETED",
            },
          });

          return deletedDocument;
        }
      );

    return NextResponse.json({
      success: true,

      message:
        "Document deleted successfully.",

      document: {
        ...result,

        size:
          result.size.toString(),

        tags:
          result.tags ?? [],
      },
    });
  } catch (error) {
    console.error(
      "DELETE /api/documents/[id] error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete document.",
      },
      {
        status: 500,
      }
    );
  }
}