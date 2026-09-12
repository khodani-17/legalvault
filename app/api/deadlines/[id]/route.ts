import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { requirePermission } from "@/lib/permissions-server";

const DEADLINE_TYPES = [
  "COURT_DATE",
  "FILING_DEADLINE",
  "PRESCRIPTION_DATE",
  "NOTICE_PERIOD",
  "CONSULTATION",
  "DISCOVERY_DEADLINE",
  "OPPOSING_PARTY_DEADLINE",
  "INTERNAL_REVIEW",
] as const;

const DEADLINE_PRIORITIES = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
] as const;

const DEADLINE_STATUSES = [
  "PENDING",
  "COMPLETED",
  "CANCELLED",
  "OVERDUE",
] as const;

type DeadlineType = (typeof DEADLINE_TYPES)[number];

type DeadlinePriority =
  (typeof DEADLINE_PRIORITIES)[number];

type DeadlineStatus =
  (typeof DEADLINE_STATUSES)[number];

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function isValidDeadlineType(
  value: unknown,
): value is DeadlineType {
  return (
    typeof value === "string" &&
    DEADLINE_TYPES.includes(
      value as DeadlineType,
    )
  );
}

function isValidDeadlinePriority(
  value: unknown,
): value is DeadlinePriority {
  return (
    typeof value === "string" &&
    DEADLINE_PRIORITIES.includes(
      value as DeadlinePriority,
    )
  );
}

function isValidDeadlineStatus(
  value: unknown,
): value is DeadlineStatus {
  return (
    typeof value === "string" &&
    DEADLINE_STATUSES.includes(
      value as DeadlineStatus,
    )
  );
}

function parseDate(
  value: unknown,
): Date | null {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

async function getAuthenticatedUser() {
  const { auth } = await import("@/auth");

  const session = await auth();

  if (
    !session?.user?.id ||
    !session.user.firmId
  ) {
    return null;
  }

  return prisma.user.findFirst({
    where: {
      id: session.user.id,
      firmId: session.user.firmId,
      status: "ACTIVE",
    },
    select: {
      id: true,
      firmId: true,
      name: true,
      email: true,
      role: true,
    },
  });
}

async function hasFirmAccess(
  firmId: string,
) {
  const subscription =
    await prisma.subscription.findUnique({
      where: {
        firmId,
      },
      select: {
        status: true,
        currentPeriodEnd: true,
      },
    });

  if (!subscription) {
    return false;
  }

  if (
    subscription.status !== "ACTIVE" &&
    subscription.status !== "TRIAL"
  ) {
    return false;
  }

  if (
    subscription.currentPeriodEnd &&
    subscription.currentPeriodEnd < new Date()
  ) {
    return false;
  }

  return true;
}

async function getMatterAccess(
  userId: string,
  firmId: string,
  matterId: string,
) {
  const matter =
    await prisma.matter.findFirst({
      where: {
        id: matterId,
        firmId,
      },
      select: {
        id: true,
        firmId: true,
        referenceNumber: true,
        title: true,
        users: {
          where: {
            userId,
          },
          select: {
            canView: true,
            canManage: true,
          },
        },
      },
    });

  if (!matter) {
    return null;
  }

  return {
    matter,
    access: matter.users[0] ?? null,
  };
}

async function getDeadlineForFirm(
  deadlineId: string,
  firmId: string,
) {
  return prisma.deadline.findFirst({
    where: {
      id: deadlineId,
      firmId,
    },
    include: {
      matter: {
        select: {
          id: true,
          firmId: true,
          referenceNumber: true,
          title: true,
        },
      },
      assignedTo: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      completedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}

/**
 * Existing privileged legal roles retain
 * firm-wide matter access.
 *
 * This is intentionally separate from the
 * centralized RBAC permission check.
 */
function hasFirmWideMatterAccess(
  role: string,
): boolean {
  return [
    "SUPER_ADMIN",
    "MANAGING_PARTNER",
    "PARTNER",
    "DIRECTOR",
    "ATTORNEY",
    "ADMIN",
  ].includes(role);
}

/**
 * GET /api/deadlines/[id]
 *
 * Required centralized permission:
 * deadlines.view
 *
 * After RBAC permission is confirmed,
 * matter-level access is still enforced.
 */
export async function GET(
  request: Request,
  context: RouteContext,
) {
  try {
    const authorization =
      await requirePermission(
        "deadlines.view",
      );

    if (!authorization.authorized) {
      return authorization.response;
    }

    const user =
      await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        {
          error:
            "Authentication is required.",
        },
        { status: 401 },
      );
    }

    const subscriptionActive =
      await hasFirmAccess(
        user.firmId,
      );

    if (!subscriptionActive) {
      return NextResponse.json(
        {
          error:
            "Your firm's LegalVault subscription is not active.",
        },
        { status: 402 },
      );
    }

    const { id } =
      await context.params;

    if (!id) {
      return NextResponse.json(
        {
          error:
            "Deadline ID is required.",
        },
        { status: 400 },
      );
    }

    const deadline =
      await getDeadlineForFirm(
        id,
        user.firmId,
      );

    if (!deadline) {
      return NextResponse.json(
        {
          error:
            "Deadline not found.",
        },
        { status: 404 },
      );
    }

    /*
     * Defensive firm-isolation check.
     */
    if (
      deadline.firmId !==
        user.firmId ||
      deadline.matter.firmId !==
        user.firmId
    ) {
      return NextResponse.json(
        {
          error:
            "Deadline not found.",
        },
        { status: 404 },
      );
    }

    /*
     * Privileged legal roles may access
     * deadlines for matters within their
     * own firm.
     */
    const firmWideAccess =
      hasFirmWideMatterAccess(
        user.role,
      );

    if (!firmWideAccess) {
      const matterAccess =
        await getMatterAccess(
          user.id,
          user.firmId,
          deadline.matterId,
        );

      if (
        !matterAccess ||
        !matterAccess.access?.canView
      ) {
        return NextResponse.json(
          {
            error:
              "You do not have access to this deadline.",
          },
          { status: 403 },
        );
      }
    }

    /*
     * Audit successful individual deadline
     * access.
     */
    try {
      await createAuditLog({
        request,
        firmId: user.firmId,
        userId: user.id,
        action: "READ",
        entityType: "Deadline",
        entityId: deadline.id,
        description:
          `Deadline "${deadline.title}" was viewed.`,
        metadata: {
          event:
            "DEADLINE_VIEWED",
          matterId:
            deadline.matterId,
          deadlineType:
            deadline.type,
          status:
            deadline.status,
        },
      });
    } catch (auditError) {
      console.error(
        "Deadline view audit log error:",
        auditError,
      );
    }

    return NextResponse.json(
      {
        success: true,
        deadline,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(
      "Get deadline error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to retrieve the deadline right now.",
      },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/deadlines/[id]
 *
 * Required centralized permission:
 * deadlines.update
 *
 * The centralized permission does not replace
 * matter-level authorization.
 */
export async function PATCH(
  request: Request,
  context: RouteContext,
) {
  try {
    const authorization =
      await requirePermission(
        "deadlines.update",
      );

    if (!authorization.authorized) {
      return authorization.response;
    }

    const user =
      await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        {
          error:
            "Authentication is required.",
        },
        { status: 401 },
      );
    }

    const subscriptionActive =
      await hasFirmAccess(
        user.firmId,
      );

    if (!subscriptionActive) {
      return NextResponse.json(
        {
          error:
            "Your firm's LegalVault subscription is not active.",
        },
        { status: 402 },
      );
    }

    const { id } =
      await context.params;

    if (!id) {
      return NextResponse.json(
        {
          error:
            "Deadline ID is required.",
        },
        { status: 400 },
      );
    }

    const existingDeadline =
      await getDeadlineForFirm(
        id,
        user.firmId,
      );

    if (!existingDeadline) {
      return NextResponse.json(
        {
          error:
            "Deadline not found.",
        },
        { status: 404 },
      );
    }

    /*
     * Ensure the deadline and its matter
     * belong to the authenticated firm.
     */
    if (
      existingDeadline.firmId !==
        user.firmId ||
      existingDeadline.matter.firmId !==
        user.firmId
    ) {
      return NextResponse.json(
        {
          error:
            "Deadline not found.",
        },
        { status: 404 },
      );
    }

    const firmWideAccess =
      hasFirmWideMatterAccess(
        user.role,
      );

    const matterAccess =
      await getMatterAccess(
        user.id,
        user.firmId,
        existingDeadline.matterId,
      );

    /*
     * Centralized RBAC permission has already
     * been checked above.
     *
     * Ordinary users still require explicit
     * matter-level canManage access.
     */
    if (!firmWideAccess) {
      if (
        !matterAccess ||
        !matterAccess.access?.canManage
      ) {
        return NextResponse.json(
          {
            error:
              "You do not have permission to manage this deadline.",
          },
          { status: 403 },
        );
      }
    }

    const body =
      await request.json();

    const data: {
      title?: string;
      description?: string | null;
      type?: DeadlineType;
      priority?: DeadlinePriority;
      status?: DeadlineStatus;
      dueDate?: Date;
      assignedToId?: string | null;
      isCalculated?: boolean;
      sourceDate?: Date | null;
      calculationNote?: string | null;
      completedAt?: Date | null;
      completedById?: string | null;
    } = {};

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "title",
      )
    ) {
      if (
        typeof body.title !==
          "string" ||
        !body.title.trim()
      ) {
        return NextResponse.json(
          {
            error:
              "Deadline title cannot be empty.",
          },
          { status: 400 },
        );
      }

      const title =
        body.title.trim();

      if (title.length > 255) {
        return NextResponse.json(
          {
            error:
              "Deadline title is too long.",
          },
          { status: 400 },
        );
      }

      data.title = title;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "description",
      )
    ) {
      if (
        body.description !==
          null &&
        typeof body.description !==
          "string"
      ) {
        return NextResponse.json(
          {
            error:
              "Description must be text or null.",
          },
          { status: 400 },
        );
      }

      data.description =
        typeof body.description ===
        "string"
          ? body.description.trim() ||
            null
          : null;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "type",
      )
    ) {
      if (
        !isValidDeadlineType(
          body.type,
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Invalid deadline type.",
          },
          { status: 400 },
        );
      }

      data.type = body.type;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "priority",
      )
    ) {
      if (
        !isValidDeadlinePriority(
          body.priority,
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Invalid deadline priority.",
          },
          { status: 400 },
        );
      }

      data.priority =
        body.priority;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "status",
      )
    ) {
      if (
        !isValidDeadlineStatus(
          body.status,
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Invalid deadline status.",
          },
          { status: 400 },
        );
      }

      data.status =
        body.status;

      if (
        body.status ===
        "COMPLETED"
      ) {
        data.completedAt =
          existingDeadline.completedAt ??
          new Date();

        data.completedById =
          existingDeadline.completedById ??
          user.id;
      }

      if (
        body.status ===
          "PENDING" ||
        body.status ===
          "OVERDUE"
      ) {
        data.completedAt =
          null;
        data.completedById =
          null;
      }
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "dueDate",
      )
    ) {
      const dueDate =
        parseDate(
          body.dueDate,
        );

      if (!dueDate) {
        return NextResponse.json(
          {
            error:
              "Due date must be a valid date.",
          },
          { status: 400 },
        );
      }

      data.dueDate =
        dueDate;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "assignedToId",
      )
    ) {
      if (
        body.assignedToId !==
          null &&
        typeof body.assignedToId !==
          "string"
      ) {
        return NextResponse.json(
          {
            error:
              "Assigned user ID must be text or null.",
          },
          { status: 400 },
        );
      }

      const assignedToId =
        typeof body.assignedToId ===
        "string"
          ? body.assignedToId.trim()
          : null;

      if (assignedToId) {
        const assignedUser =
          await prisma.user.findFirst(
            {
              where: {
                id: assignedToId,
                firmId:
                  user.firmId,
                status:
                  "ACTIVE",
              },
              select: {
                id: true,
              },
            },
          );

        if (!assignedUser) {
          return NextResponse.json(
            {
              error:
                "Assigned user not found in your firm.",
            },
            { status: 400 },
          );
        }

        data.assignedToId =
          assignedUser.id;
      } else {
        data.assignedToId =
          null;
      }
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "isCalculated",
      )
    ) {
      if (
        typeof body.isCalculated !==
        "boolean"
      ) {
        return NextResponse.json(
          {
            error:
              "isCalculated must be true or false.",
          },
          { status: 400 },
        );
      }

      data.isCalculated =
        body.isCalculated;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "sourceDate",
      )
    ) {
      if (
        body.sourceDate ===
        null
      ) {
        data.sourceDate =
          null;
      } else {
        const sourceDate =
          parseDate(
            body.sourceDate,
          );

        if (!sourceDate) {
          return NextResponse.json(
            {
              error:
                "Source date must be a valid date.",
            },
            { status: 400 },
          );
        }

        data.sourceDate =
          sourceDate;
      }
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "calculationNote",
      )
    ) {
      if (
        body.calculationNote !==
          null &&
        typeof body.calculationNote !==
          "string"
      ) {
        return NextResponse.json(
          {
            error:
              "Calculation note must be text or null.",
          },
          { status: 400 },
        );
      }

      data.calculationNote =
        typeof body.calculationNote ===
        "string"
          ? body.calculationNote.trim() ||
            null
          : null;
    }

    /*
     * Explicit completion request.
     */
    if (
      body.complete ===
      true
    ) {
      data.status =
        "COMPLETED";

      data.completedAt =
        existingDeadline.completedAt ??
        new Date();

      data.completedById =
        existingDeadline.completedById ??
        user.id;
    }

    if (
      body.complete ===
      false
    ) {
      data.status =
        "PENDING";

      data.completedAt =
        null;

      data.completedById =
        null;
    }

    if (
      Object.keys(data)
        .length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "No valid fields were provided for update.",
        },
        { status: 400 },
      );
    }

    const updatedDeadline =
      await prisma.deadline.update({
        where: {
          id:
            existingDeadline.id,
        },
        data,
        include: {
          matter: {
            select: {
              id: true,
              referenceNumber:
                true,
              title: true,
            },
          },
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          completedBy: {
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
      firmId:
        user.firmId,
      userId:
        user.id,
      action: "UPDATE",
      entityType:
        "Deadline",
      entityId:
        updatedDeadline.id,
      description:
        updatedDeadline.status ===
        "COMPLETED"
          ? `Deadline "${updatedDeadline.title}" was marked as completed.`
          : `Deadline "${updatedDeadline.title}" was updated.`,
      metadata: {
        matterId:
          updatedDeadline.matterId,
        previousStatus:
          existingDeadline.status,
        newStatus:
          updatedDeadline.status,
        changes:
          Object.keys(data),
        completedById:
          updatedDeadline.completedById,
        completedAt:
          updatedDeadline.completedAt
            ?.toISOString() ??
          null,
      },
    });

    /*
     * Deadline notifications are intentionally
     * limited to meaningful workflow events.
     *
     * Ordinary edits such as title,
     * description, priority, due date, or
     * calculation changes do not create
     * notifications.
     */
    try {
      const assignmentChanged =
        data.assignedToId !== undefined &&
        existingDeadline.assignedToId !==
          updatedDeadline.assignedToId;

      const completedNow =
        existingDeadline.status !==
          "COMPLETED" &&
        updatedDeadline.status ===
          "COMPLETED";

      const reopenedNow =
        existingDeadline.status ===
          "COMPLETED" &&
        (updatedDeadline.status ===
          "PENDING" ||
          updatedDeadline.status ===
            "OVERDUE");

      /*
       * Notify the new assignee when a
       * deadline is assigned or reassigned.
       */
      if (
        assignmentChanged &&
        updatedDeadline.assignedTo?.id &&
        updatedDeadline.assignedTo.id !==
          user.id
      ) {
        await createNotification({
          firmId:
            user.firmId,
          userId:
            updatedDeadline.assignedTo.id,
          type: "DEADLINE",
          title:
            existingDeadline.assignedToId
              ? "Deadline reassigned"
              : "New deadline assigned",
          message:
            existingDeadline.assignedToId
              ? `The deadline "${updatedDeadline.title}" has been reassigned to you for matter ${updatedDeadline.matter.referenceNumber}.`
              : `You have been assigned the deadline "${updatedDeadline.title}" for matter ${updatedDeadline.matter.referenceNumber}.`,
        });
      }

      /*
       * Notify relevant users when the
       * deadline becomes completed.
       */
      if (completedNow) {
        const notifiedUserIds =
          new Set<string>();

        if (
          updatedDeadline.assignedTo?.id &&
          updatedDeadline.assignedTo.id !==
            user.id
        ) {
          await createNotification({
            firmId:
              user.firmId,
            userId:
              updatedDeadline.assignedTo.id,
            type: "DEADLINE",
            title:
              "Deadline completed",
            message:
              `The deadline "${updatedDeadline.title}" has been marked as completed for matter ${updatedDeadline.matter.referenceNumber}.`,
          });

          notifiedUserIds.add(
            updatedDeadline.assignedTo.id,
          );
        }

        /*
         * Notify the creator unless the creator
         * is already the assignee notification
         * recipient.
         */
        if (
          updatedDeadline.createdBy?.id &&
          updatedDeadline.createdBy.id !==
            user.id &&
          !notifiedUserIds.has(
            updatedDeadline.createdBy.id,
          )
        ) {
          await createNotification({
            firmId:
              user.firmId,
            userId:
              updatedDeadline.createdBy.id,
            type: "DEADLINE",
            title:
              "Deadline completed",
            message:
              `The deadline "${updatedDeadline.title}" that you created has been completed for matter ${updatedDeadline.matter.referenceNumber}.`,
          });
        }
      }

      /*
       * Notify the current assignee when a
       * completed deadline is reopened.
       */
      if (
        reopenedNow &&
        updatedDeadline.assignedTo?.id &&
        updatedDeadline.assignedTo.id !==
          user.id
      ) {
        await createNotification({
          firmId:
            user.firmId,
          userId:
            updatedDeadline.assignedTo.id,
          type: "DEADLINE",
          title:
            "Deadline reopened",
          message:
            `The deadline "${updatedDeadline.title}" has been reopened for matter ${updatedDeadline.matter.referenceNumber}.`,
        });
      }
    } catch (notificationError) {
      /*
       * Notification failure must never cause
       * a successful deadline update to fail.
       */
      console.error(
        "DEADLINE NOTIFICATION ERROR:",
        notificationError,
      );
    }

    return NextResponse.json(
      {
        success: true,
        message:
          updatedDeadline.status ===
          "COMPLETED"
            ? "Deadline completed successfully."
            : "Deadline updated successfully.",
        deadline:
          updatedDeadline,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(
      "Update deadline error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to update the deadline right now.",
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/deadlines/[id]
 *
 * Required centralized permission:
 * deadlines.delete
 *
 * The database record is not physically
 * deleted. It is marked CANCELLED so the
 * legal audit history is preserved.
 */
export async function DELETE(
  request: Request,
  context: RouteContext,
) {
  try {
    const authorization =
      await requirePermission(
        "deadlines.delete",
      );

    if (!authorization.authorized) {
      return authorization.response;
    }

    const user =
      await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        {
          error:
            "Authentication is required.",
        },
        { status: 401 },
      );
    }

    const subscriptionActive =
      await hasFirmAccess(
        user.firmId,
      );

    if (!subscriptionActive) {
      return NextResponse.json(
        {
          error:
            "Your firm's LegalVault subscription is not active.",
        },
        { status: 402 },
      );
    }

    const { id } =
      await context.params;

    if (!id) {
      return NextResponse.json(
        {
          error:
            "Deadline ID is required.",
        },
        { status: 400 },
      );
    }

    const existingDeadline =
      await getDeadlineForFirm(
        id,
        user.firmId,
      );

    if (!existingDeadline) {
      return NextResponse.json(
        {
          error:
            "Deadline not found.",
        },
        { status: 404 },
      );
    }

    /*
     * Never allow a deadline from another
     * firm to be accessed by ID.
     */
    if (
      existingDeadline.firmId !==
        user.firmId ||
      existingDeadline.matter.firmId !==
        user.firmId
    ) {
      return NextResponse.json(
        {
          error:
            "Deadline not found.",
        },
        { status: 404 },
      );
    }

    const firmWideAccess =
      hasFirmWideMatterAccess(
        user.role,
      );

    if (!firmWideAccess) {
      const matterAccess =
        await getMatterAccess(
          user.id,
          user.firmId,
          existingDeadline.matterId,
        );

      if (
        !matterAccess ||
        !matterAccess.access?.canManage
      ) {
        return NextResponse.json(
          {
            error:
              "You do not have permission to cancel this deadline.",
          },
          { status: 403 },
        );
      }
    }

    /*
     * Soft cancellation preserves the
     * legal record and audit history.
     */
    const cancelledDeadline =
      await prisma.deadline.update({
        where: {
          id:
            existingDeadline.id,
        },
        data: {
          status:
            "CANCELLED",
        },
        include: {
          matter: {
            select: {
              id: true,
              referenceNumber:
                true,
              title: true,
            },
          },
        },
      });

    await createAuditLog({
      request,
      firmId:
        user.firmId,
      userId:
        user.id,
      action: "DELETE",
      entityType:
        "Deadline",
      entityId:
        cancelledDeadline.id,
      description:
        `Deadline "${cancelledDeadline.title}" was cancelled.`,
      metadata: {
        matterId:
          cancelledDeadline.matterId,
        previousStatus:
          existingDeadline.status,
        newStatus:
          "CANCELLED",
      },
    });

    /*
     * Notify the previous assignee when a
     * deadline is cancelled.
     */
    try {
      if (
        existingDeadline.assignedTo?.id &&
        existingDeadline.assignedTo.id !==
          user.id
      ) {
        await createNotification({
          firmId:
            user.firmId,
          userId:
            existingDeadline.assignedTo.id,
          type: "DEADLINE",
          title:
            "Deadline cancelled",
          message:
            `The deadline "${cancelledDeadline.title}" has been cancelled for matter ${cancelledDeadline.matter.referenceNumber}.`,
        });
      }
    } catch (notificationError) {
      /*
       * Notification failure must never cause
       * a successful cancellation to fail.
       */
      console.error(
        "DEADLINE NOTIFICATION ERROR:",
        notificationError,
      );
    }

    return NextResponse.json(
      {
        success: true,
        message:
          "Deadline cancelled successfully.",
        deadline:
          cancelledDeadline,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(
      "Cancel deadline error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to cancel the deadline right now.",
      },
      { status: 500 },
    );
  }
}