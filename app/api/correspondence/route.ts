import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions-server";
import { createNotification } from "@/lib/notifications";

import {
  CorrespondenceDirection,
  CorrespondenceStatus,
  CorrespondenceType,
  UserStatus,
  NotificationType,
} from "@/src/generated/prisma/enums";

// ============================================================
// CONSTANTS
// ============================================================

const MAX_SENDER_LENGTH = 300;
const MAX_RECIPIENT_LENGTH = 300;
const MAX_SUBJECT_LENGTH = 500;
const MAX_NOTES_LENGTH = 10000;

// ============================================================
// HELPERS
// ============================================================

function isValidEnumValue<T extends Record<string, string>>(
  enumObject: T,
  value: unknown,
): value is T[keyof T] {
  return (
    typeof value === "string" &&
    Object.values(enumObject).includes(
      value,
    )
  );
}

function parseOptionalString(
  value: unknown,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0
    ? trimmed
    : null;
}

function parseOptionalDate(
  value: unknown,
): Date | null {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

// ============================================================
// GET CORRESPONDENCE
// ============================================================
//
// GET /api/correspondence
//
// Supports:
//
// ?status=RECEIVED
// ?direction=INCOMING
// ?matterId=...
// ?clientId=...
// ?responsibleUserId=...
// ?responseRequired=true
// ?overdue=true
//
// ============================================================

export async function GET(
  request: Request,
) {
  // ==========================================================
  // PERMISSION
  // ==========================================================

  const permission =
    await requirePermission(
      "correspondence.view",
    );

  if (!permission.authorized) {
    return permission.response;
  }

  const session =
    permission.session;

  const userId =
    session.user?.id;

  const firmId =
    session.user?.firmId;

  if (
    typeof userId !== "string" ||
    typeof firmId !== "string"
  ) {
    return NextResponse.json(
      {
        error: "Unauthorized.",
      },
      {
        status: 401,
      },
    );
  }

  // ==========================================================
  // QUERY PARAMETERS
  // ==========================================================

  const { searchParams } =
    new URL(request.url);

  const statusParam =
    searchParams.get("status");

  const directionParam =
    searchParams.get("direction");

  const matterId =
    searchParams.get("matterId");

  const clientId =
    searchParams.get("clientId");

  const responsibleUserId =
    searchParams.get(
      "responsibleUserId",
    );

  const responseRequiredParam =
    searchParams.get(
      "responseRequired",
    );

  const overdueParam =
    searchParams.get("overdue");

  // ==========================================================
  // VALIDATE ENUM FILTERS
  // ==========================================================

  if (
    statusParam &&
    !isValidEnumValue(
      CorrespondenceStatus,
      statusParam,
    )
  ) {
    return NextResponse.json(
      {
        error: "Invalid correspondence status.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    directionParam &&
    !isValidEnumValue(
      CorrespondenceDirection,
      directionParam,
    )
  ) {
    return NextResponse.json(
      {
        error: "Invalid correspondence direction.",
      },
      {
        status: 400,
      },
    );
  }

  // ==========================================================
  // BUILD FIRM-SCOPED QUERY
  // ==========================================================

  const where: {
    firmId: string;
    status?: CorrespondenceStatus;
    direction?: CorrespondenceDirection;
    matterId?: string;
    clientId?: string;
    responsibleUserId?: string;
    responseRequired?: boolean;
    responseDeadline?: {
      lt: Date;
      not: null;
    };
  } = {
    firmId,
  };

  if (statusParam) {
    where.status =
      statusParam as CorrespondenceStatus;
  }

  if (directionParam) {
    where.direction =
      directionParam as CorrespondenceDirection;
  }

  if (matterId) {
    where.matterId =
      matterId;
  }

  if (clientId) {
    where.clientId =
      clientId;
  }

  if (responsibleUserId) {
    where.responsibleUserId =
      responsibleUserId;
  }

  if (
    responseRequiredParam ===
    "true"
  ) {
    where.responseRequired = true;
  }

  if (
    overdueParam === "true"
  ) {
    where.responseDeadline = {
      lt: new Date(),
      not: null,
    };
  }

  // ==========================================================
  // FETCH
  // ==========================================================

  const correspondences =
    await prisma.correspondence.findMany(
      {
        where,

        orderBy: [
          {
            responseDeadline:
              "asc",
          },
          {
            correspondenceDate:
              "desc",
          },
        ],

        select: {
          id: true,
          direction: true,
          correspondenceDate: true,
          sender: true,
          recipient: true,
          subject: true,
          type: true,
          status: true,
          responseRequired: true,
          responseDeadline: true,
          notes: true,
          createdAt: true,
          updatedAt: true,

          client: {
            select: {
              id: true,
              name: true,
            },
          },

          matter: {
            select: {
              id: true,
              title: true,
            },
          },

          responsibleUser: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },

          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },

          _count: {
            select: {
              attachments: true,
            },
          },
        },
      },
    );

  // ==========================================================
  // AUDIT READ
  // ==========================================================

  await createAuditLog({
    request,
    firmId,
    userId,
    action: "READ",
    entityType: "Correspondence",
    description:
      "Viewed legal correspondence.",
    metadata: {
      filters: {
        status:
          statusParam,
        direction:
          directionParam,
        matterId,
        clientId,
        responsibleUserId,
        responseRequired:
          responseRequiredParam,
        overdue:
          overdueParam,
      },
      resultCount:
        correspondences.length,
    },
  });

  return NextResponse.json(
    {
      correspondences,
    },
    {
      status: 200,
    },
  );
}

// ============================================================
// CREATE CORRESPONDENCE
// ============================================================
//
// POST /api/correspondence
//
// ============================================================

export async function POST(
  request: Request,
) {
  // ==========================================================
  // PERMISSION
  // ==========================================================

  const permission =
    await requirePermission(
      "correspondence.create",
    );

  if (!permission.authorized) {
    return permission.response;
  }

  const session =
    permission.session;

  const userId =
    session.user?.id;

  const firmId =
    session.user?.firmId;

  if (
    typeof userId !== "string" ||
    typeof firmId !== "string"
  ) {
    return NextResponse.json(
      {
        error: "Unauthorized.",
      },
      {
        status: 401,
      },
    );
  }

  // ==========================================================
  // PARSE BODY
  // ==========================================================

  let body: unknown;

  try {
    body =
      await request.json();
  } catch {
    return NextResponse.json(
      {
        error:
          "Invalid JSON request body.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    return NextResponse.json(
      {
        error:
          "Request body must be a JSON object.",
      },
      {
        status: 400,
      },
    );
  }

  const data =
    body as Record<
      string,
      unknown
    >;

  // ==========================================================
  // REQUIRED FIELDS
  // ==========================================================

  const sender =
    parseOptionalString(
      data.sender,
    );

  const recipient =
    parseOptionalString(
      data.recipient,
    );

  const subject =
    parseOptionalString(
      data.subject,
    );

  if (!sender) {
    return NextResponse.json(
      {
        error:
          "Sender is required.",
      },
      {
        status: 400,
      },
    );
  }

  if (!recipient) {
    return NextResponse.json(
      {
        error:
          "Recipient is required.",
      },
      {
        status: 400,
      },
    );
  }

  if (!subject) {
    return NextResponse.json(
      {
        error:
          "Subject is required.",
      },
      {
        status: 400,
      },
    );
  }

  // ==========================================================
  // LENGTH VALIDATION
  // ==========================================================

  if (
    sender.length >
    MAX_SENDER_LENGTH
  ) {
    return NextResponse.json(
      {
        error:
          `Sender must not exceed ${MAX_SENDER_LENGTH} characters.`,
      },
      {
        status: 400,
      },
    );
  }

  if (
    recipient.length >
    MAX_RECIPIENT_LENGTH
  ) {
    return NextResponse.json(
      {
        error:
          `Recipient must not exceed ${MAX_RECIPIENT_LENGTH} characters.`,
      },
      {
        status: 400,
      },
    );
  }

  if (
    subject.length >
    MAX_SUBJECT_LENGTH
  ) {
    return NextResponse.json(
      {
        error:
          `Subject must not exceed ${MAX_SUBJECT_LENGTH} characters.`,
      },
      {
        status: 400,
      },
    );
  }

  // ==========================================================
  // ENUM FIELDS
  // ==========================================================

  const direction =
    data.direction;

  const type =
    data.type;

  const status =
    data.status ??
    CorrespondenceStatus.RECEIVED;

  if (
    !isValidEnumValue(
      CorrespondenceDirection,
      direction,
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid correspondence direction.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    !isValidEnumValue(
      CorrespondenceType,
      type,
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid correspondence type.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    !isValidEnumValue(
      CorrespondenceStatus,
      status,
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid correspondence status.",
      },
      {
        status: 400,
      },
    );
  }

  // ==========================================================
  // OPTIONAL FIELDS
  // ==========================================================

  const matterId =
    parseOptionalString(
      data.matterId,
    );

  const clientId =
    parseOptionalString(
      data.clientId,
    );

  const responsibleUserId =
    parseOptionalString(
      data.responsibleUserId,
    );

  const notes =
    parseOptionalString(
      data.notes,
    );

  const responseRequired =
    data.responseRequired ===
    true;

  const responseDeadline =
    parseOptionalDate(
      data.responseDeadline,
    );

  // ==========================================================
  // NOTES LENGTH
  // ==========================================================

  if (
    notes &&
    notes.length >
      MAX_NOTES_LENGTH
  ) {
    return NextResponse.json(
      {
        error:
          `Notes must not exceed ${MAX_NOTES_LENGTH} characters.`,
      },
      {
        status: 400,
      },
    );
  }

  // ==========================================================
  // RESPONSE DEADLINE VALIDATION
  // ==========================================================

  if (
    responseRequired &&
    !responseDeadline
  ) {
    return NextResponse.json(
      {
        error:
          "A response deadline is required when a response is required.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    !responseRequired &&
    responseDeadline
  ) {
    return NextResponse.json(
      {
        error:
          "A response deadline cannot be supplied when a response is not required.",
      },
      {
        status: 400,
      },
    );
  }

  // ==========================================================
  // CLIENT VALIDATION
  // ==========================================================

  if (clientId) {
    const client =
      await prisma.client.findFirst({
        where: {
          id: clientId,
          firmId,
        },
        select: {
          id: true,
        },
      });

    if (!client) {
      return NextResponse.json(
        {
          error:
            "Client not found.",
        },
        {
          status: 404,
        },
      );
    }
  }

  // ==========================================================
  // MATTER VALIDATION
  // ==========================================================

  if (matterId) {
    const matter =
      await prisma.matter.findFirst({
        where: {
          id: matterId,
          firmId,
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
            "Matter not found.",
        },
        {
          status: 404,
        },
      );
    }

    // --------------------------------------------------------
    // If both a client and matter are supplied, ensure they
    // belong together.
    // --------------------------------------------------------

    if (
      clientId &&
      matter.clientId !==
        clientId
    ) {
      return NextResponse.json(
        {
          error:
            "The selected matter does not belong to the selected client.",
        },
        {
          status: 400,
        },
      );
    }
  }

  // ==========================================================
  // RESPONSIBLE USER VALIDATION
  // ==========================================================

  if (responsibleUserId) {
    const responsibleUser =
      await prisma.user.findFirst({
        where: {
          id: responsibleUserId,
          firmId,
          status:
            UserStatus.ACTIVE,
        },
        select: {
          id: true,
          name: true,
        },
      });

    if (!responsibleUser) {
      return NextResponse.json(
        {
          error:
            "Responsible employee not found or inactive.",
        },
        {
          status: 404,
        },
      );
    }
  }

  // ==========================================================
  // CREATE CORRESPONDENCE
  // ==========================================================

  const correspondence =
    await prisma.$transaction(
      async (tx) => {
        const created =
          await tx.correspondence.create(
            {
              data: {
                firmId,

                matterId:
                  matterId ??
                  null,

                clientId:
                  clientId ??
                  null,

                direction:
                  direction as CorrespondenceDirection,

                correspondenceDate:
                  parseOptionalDate(
                    data.correspondenceDate,
                  ) ??
                  new Date(),

                sender,

                recipient,

                subject,

                type:
                  type as CorrespondenceType,

                status:
                  status as CorrespondenceStatus,

                responsibleUserId:
                  responsibleUserId ??
                  null,

                responseRequired,

                responseDeadline:
                  responseDeadline ??
                  null,

                notes:
                  notes ??
                  null,

                createdById:
                  userId,
              },

              select: {
                id: true,
                firmId: true,
                matterId: true,
                clientId: true,
                direction: true,
                correspondenceDate:
                  true,
                sender: true,
                recipient: true,
                subject: true,
                type: true,
                status: true,
                responsibleUserId:
                  true,
                responseRequired:
                  true,
                responseDeadline:
                  true,
                notes: true,
                createdById: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          );

        return created;
      },
    );

  // ==========================================================
  // AUDIT CREATE
  // ==========================================================

  await createAuditLog({
    request,
    firmId,
    userId,
    action: "CREATE",
    entityType:
      "Correspondence",
    entityId:
      correspondence.id,
    description:
      "Created legal correspondence.",
    metadata: {
      direction:
        correspondence.direction,
      type:
        correspondence.type,
      status:
        correspondence.status,
      matterId:
        correspondence.matterId,
      clientId:
        correspondence.clientId,
      responsibleUserId:
        correspondence.responsibleUserId,
      responseRequired:
        correspondence.responseRequired,
      responseDeadline:
        correspondence.responseDeadline,
    },
  });

  // ==========================================================
  // NOTIFY RESPONSIBLE EMPLOYEE
  // ==========================================================

  if (
    correspondence.responsibleUserId &&
    correspondence.responsibleUserId !==
      userId
  ) {
    await createNotification({
      firmId,
      userId:
        correspondence.responsibleUserId,
      type:
        NotificationType.SYSTEM,
      title:
        "Correspondence Assigned",
      message:
        `You have been assigned correspondence: "${correspondence.subject}".`,
    });
  }

  // ==========================================================
  // RESPONSE
  // ==========================================================

  return NextResponse.json(
    {
      correspondence,
    },
    {
      status: 201,
    },
  );
}