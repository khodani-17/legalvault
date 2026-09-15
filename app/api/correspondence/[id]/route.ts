import { NextResponse } from "next/server";
import {
  CorrespondenceDirection,
  CorrespondenceStatus,
  CorrespondenceType,
  NotificationType,
  UserStatus,
} from "@/src/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions-server";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseOptionalDate(value: unknown): Date | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function cleanString(
  value: unknown,
  maxLength = 5000,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const valueString = String(value).trim();

  if (!valueString) {
    return null;
  }

  return valueString.slice(0, maxLength);
}

function isEnumValue<T extends Record<string, string>>(
  enumObject: T,
  value: unknown,
): value is T[keyof T] {
  return (
    typeof value === "string" &&
    Object.values(enumObject).includes(value as T[keyof T])
  );
}

/**
 * GET /api/correspondence/[id]
 *
 * View one correspondence record.
 */
export async function GET(
  request: Request,
  { params }: RouteContext,
) {
  const permission = await requirePermission(
    "correspondence.view",
  );

  if (!permission.authorized) {
    return permission.response;
  }

  const sessionUser = permission.session.user;

  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { error: "Correspondence ID is required." },
      { status: 400 },
    );
  }

  try {
    const correspondence =
      await prisma.correspondence.findFirst({
        where: {
          id,
          firmId: sessionUser.firmId,
        },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              referenceNumber: true,
            },
          },

          matter: {
            select: {
              id: true,
              title: true,
              status: true,
              referenceNumber: true,
              clientId: true,
            },
          },

          responsibleUser: {
            select: {
              id: true,
              email: true,
              role: true,
              status: true,
            },
          },

          createdBy: {
            select: {
              id: true,
              email: true,
              role: true,
            },
          },

          attachments: {
            include: {
              document: {
                select: {
                  id: true,
                  name: true,
                  originalName: true,
                  mimeType: true,
                  size: true,
                  extension: true,
                  currentVersion: true,
                  createdAt: true,
                },
              },

              addedBy: {
                select: {
                  id: true,
                  email: true,
                  role: true,
                },
              },
            },

            orderBy: {
              createdAt: "desc",
            },
          },
        },
      });

    if (!correspondence) {
      return NextResponse.json(
        { error: "Correspondence not found." },
        { status: 404 },
      );
    }

    await createAuditLog({
      request,
      firmId: sessionUser.firmId,
      userId: sessionUser.id,
      action: "READ",
      entityType: "Correspondence",
      entityId: correspondence.id,
      description: `Viewed correspondence: ${correspondence.subject}`,
    });

    return NextResponse.json({
      correspondence,
    });
  } catch (error) {
    console.error(
      "GET correspondence error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Failed to load correspondence.",
      },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/correspondence/[id]
 *
 * Update correspondence.
 */
export async function PATCH(
  request: Request,
  { params }: RouteContext,
) {
  const permission = await requirePermission(
    "correspondence.update",
  );

  if (!permission.authorized) {
    return permission.response;
  }

  const sessionUser = permission.session.user;

  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { error: "Correspondence ID is required." },
      { status: 400 },
    );
  }

  try {
    const existing =
      await prisma.correspondence.findFirst({
        where: {
          id,
          firmId: sessionUser.firmId,
        },
        include: {
          responsibleUser: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      });

    if (!existing) {
      return NextResponse.json(
        { error: "Correspondence not found." },
        { status: 404 },
      );
    }

    const body = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 },
      );
    }

    const updateData: Record<string, unknown> =
      {};

    /*
     * Sender
     */
    if (body.sender !== undefined) {
      const sender = String(body.sender).trim();

      if (!sender) {
        return NextResponse.json(
          {
            error:
              "Sender cannot be empty.",
          },
          { status: 400 },
        );
      }

      updateData.sender = sender.slice(0, 500);
    }

    /*
     * Recipient
     */
    if (body.recipient !== undefined) {
      const recipient =
        String(body.recipient).trim();

      if (!recipient) {
        return NextResponse.json(
          {
            error:
              "Recipient cannot be empty.",
          },
          { status: 400 },
        );
      }

      updateData.recipient =
        recipient.slice(0, 500);
    }

    /*
     * Subject
     */
    if (body.subject !== undefined) {
      const subject =
        String(body.subject).trim();

      if (!subject) {
        return NextResponse.json(
          {
            error:
              "Subject cannot be empty.",
          },
          { status: 400 },
        );
      }

      updateData.subject =
        subject.slice(0, 1000);
    }

    /*
     * Direction
     */
    if (body.direction !== undefined) {
      if (
        !isEnumValue(
          CorrespondenceDirection,
          body.direction,
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Invalid correspondence direction.",
          },
          { status: 400 },
        );
      }

      updateData.direction =
        body.direction;
    }

    /*
     * Type
     */
    if (body.type !== undefined) {
      if (
        !isEnumValue(
          CorrespondenceType,
          body.type,
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Invalid correspondence type.",
          },
          { status: 400 },
        );
      }

      updateData.type = body.type;
    }

    /*
     * Status
     */
    if (body.status !== undefined) {
      if (
        !isEnumValue(
          CorrespondenceStatus,
          body.status,
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Invalid correspondence status.",
          },
          { status: 400 },
        );
      }

      updateData.status =
        body.status;
    }

    /*
     * Correspondence date
     */
    if (
      body.correspondenceDate !==
      undefined
    ) {
      const date =
        parseOptionalDate(
          body.correspondenceDate,
        );

      if (date === null) {
        return NextResponse.json(
          {
            error:
              "Invalid correspondence date.",
          },
          { status: 400 },
        );
      }

      updateData.correspondenceDate =
        date;
    }

    /*
     * Response required
     */
    if (
      body.responseRequired !==
      undefined
    ) {
      if (
        typeof body.responseRequired !==
        "boolean"
      ) {
        return NextResponse.json(
          {
            error:
              "responseRequired must be true or false.",
          },
          { status: 400 },
        );
      }

      updateData.responseRequired =
        body.responseRequired;

      if (
        body.responseRequired ===
        false
      ) {
        updateData.responseDeadline =
          null;
      }
    }

    /*
     * Response deadline
     */
    if (
      body.responseDeadline !==
        undefined &&
      body.responseRequired !==
        false
    ) {
      const deadline =
        parseOptionalDate(
          body.responseDeadline,
        );

      if (deadline === null) {
        return NextResponse.json(
          {
            error:
              "Invalid response deadline.",
          },
          { status: 400 },
        );
      }

      updateData.responseDeadline =
        deadline;
    }

    /*
     * Notes
     */
    if (body.notes !== undefined) {
      updateData.notes =
        cleanString(
          body.notes,
          10000,
        );
    }

    /*
     * Client
     */
    if (body.clientId !== undefined) {
      if (
        body.clientId === null ||
        body.clientId === ""
      ) {
        updateData.clientId =
          null;
      } else {
        const client =
          await prisma.client.findFirst({
            where: {
              id: String(
                body.clientId,
              ),
              firmId:
                sessionUser.firmId,
            },
            select: {
              id: true,
            },
          });

        if (!client) {
          return NextResponse.json(
            {
              error:
                "Client not found in this firm.",
            },
            { status: 404 },
          );
        }

        updateData.clientId =
          client.id;
      }
    }

    /*
     * Matter
     */
    if (body.matterId !== undefined) {
      if (
        body.matterId === null ||
        body.matterId === ""
      ) {
        updateData.matterId =
          null;
      } else {
        const matter =
          await prisma.matter.findFirst({
            where: {
              id: String(
                body.matterId,
              ),
              firmId:
                sessionUser.firmId,
            },
            select: {
              id: true,
              clientId: true,
            },
          });

        if (!matter) {
          return NextResponse.json(
            {
              error:
                "Matter not found in this firm.",
            },
            { status: 404 },
          );
        }

        const requestedClientId =
          body.clientId !== undefined
            ? body.clientId
            : existing.clientId;

        if (
          requestedClientId &&
          matter.clientId &&
          matter.clientId !==
            String(
              requestedClientId,
            )
        ) {
          return NextResponse.json(
            {
              error:
                "The selected matter does not belong to the selected client.",
            },
            { status: 400 },
          );
        }

        updateData.matterId =
          matter.id;
      }
    }

    /*
     * Responsible employee
     */
    let responsibleUserChanged =
      false;

    let newResponsibleUserId:
      | string
      | null = null;

    if (
      body.responsibleUserId !==
      undefined
    ) {
      if (
        body.responsibleUserId ===
          null ||
        body.responsibleUserId ===
          ""
      ) {
        updateData.responsibleUserId =
          null;

        responsibleUserChanged =
          existing.responsibleUserId !==
          null;

        newResponsibleUserId = null;
      } else {
        const responsibleUser =
          await prisma.user.findFirst({
            where: {
              id: String(
                body.responsibleUserId,
              ),
              firmId:
                sessionUser.firmId,
              status:
                UserStatus.ACTIVE,
            },
            select: {
              id: true,
              email: true,
            },
          });

        if (!responsibleUser) {
          return NextResponse.json(
            {
              error:
                "Responsible employee not found or inactive.",
            },
            { status: 404 },
          );
        }

        updateData.responsibleUserId =
          responsibleUser.id;

        responsibleUserChanged =
          existing.responsibleUserId !==
          responsibleUser.id;

        newResponsibleUserId =
          responsibleUser.id;
      }
    }

    /*
     * Nothing to update.
     */
    if (
      Object.keys(updateData)
        .length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "No valid fields were supplied for the update.",
        },
        { status: 400 },
      );
    }

    const updated =
      await prisma.correspondence.update({
        where: {
          id: existing.id,
        },

        data: updateData,

        include: {
          client: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              referenceNumber: true,
            },
          },

          matter: {
            select: {
              id: true,
              title: true,
              status: true,
              referenceNumber: true,
              clientId: true,
            },
          },

          responsibleUser: {
            select: {
              id: true,
              email: true,
              role: true,
              status: true,
            },
          },
        },
      });

    /*
     * Audit update.
     */
    await createAuditLog({
      request,
      firmId: sessionUser.firmId,
      userId: sessionUser.id,
      action: "UPDATE",
      entityType: "Correspondence",
      entityId: updated.id,
      description:
        `Updated correspondence: ${updated.subject}`,
      metadata: {
        changedFields:
          Object.keys(updateData),

        previousStatus:
          existing.status,

        newStatus:
          updated.status,

        previousResponsibleUserId:
          existing.responsibleUserId,

        newResponsibleUserId:
          updated.responsibleUserId,
      },
    });

    /*
     * Notify newly assigned employee.
     */
    if (
      responsibleUserChanged &&
      newResponsibleUserId &&
      newResponsibleUserId !==
        sessionUser.id
    ) {
      await createNotification({
        firmId:
          sessionUser.firmId,

        userId:
          newResponsibleUserId,

        type:
          NotificationType.SYSTEM,

        title:
          "Correspondence assigned",

        message:
          `You have been assigned correspondence: "${updated.subject}".`,
      });
    }

    /*
     * Notify employee when response
     * requirement or deadline changes.
     */
    if (
      updated.responsibleUserId &&
      updated.responsibleUserId !==
        sessionUser.id &&
      (
        body.responseRequired !==
          undefined ||
        body.responseDeadline !==
          undefined
      )
    ) {
      await createNotification({
        firmId:
          sessionUser.firmId,

        userId:
          updated.responsibleUserId,

        type:
          NotificationType.SYSTEM,

        title:
          "Correspondence response updated",

        message:
          `The response requirement for "${updated.subject}" has been updated.`,
      });
    }

    return NextResponse.json({
      message:
        "Correspondence updated successfully.",

      correspondence:
        updated,
    });
  } catch (error) {
    console.error(
      "PATCH correspondence error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Failed to update correspondence.",
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/correspondence/[id]
 *
 * Delete correspondence.
 */
export async function DELETE(
  request: Request,
  { params }: RouteContext,
) {
  const permission =
    await requirePermission(
      "correspondence.delete",
    );

  if (!permission.authorized) {
    return permission.response;
  }

  const sessionUser =
    permission.session.user;

  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      {
        error:
          "Correspondence ID is required.",
      },
      { status: 400 },
    );
  }

  try {
    const existing =
      await prisma.correspondence.findFirst({
        where: {
          id,
          firmId:
            sessionUser.firmId,
        },

        select: {
          id: true,
          subject: true,
          matterId: true,
          clientId: true,
        },
      });

    if (!existing) {
      return NextResponse.json(
        {
          error:
            "Correspondence not found.",
        },
        { status: 404 },
      );
    }

    /*
     * Delete only the correspondence.
     *
     * CorrespondenceAttachment records
     * are removed through Cascade.
     *
     * The underlying Document records
     * remain untouched.
     */
    await prisma.correspondence.delete({
      where: {
        id: existing.id,
      },
    });

    await createAuditLog({
      request,
      firmId:
        sessionUser.firmId,

      userId:
        sessionUser.id,

      action: "DELETE",

      entityType:
        "Correspondence",

      entityId:
        existing.id,

      description:
        `Deleted correspondence: ${existing.subject}`,

      metadata: {
        matterId:
          existing.matterId,

        clientId:
          existing.clientId,
      },
    });

    return NextResponse.json({
      message:
        "Correspondence deleted successfully.",
    });
  } catch (error) {
    console.error(
      "DELETE correspondence error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Failed to delete correspondence.",
      },
      { status: 500 },
    );
  }
}