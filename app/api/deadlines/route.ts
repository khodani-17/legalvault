import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions-server";
import { createNotification } from "@/lib/notifications";
import {
  calculateDeadline,
  type DeadlineCalculationUnit,
} from "@/lib/deadlines/calculator";

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

const CALCULATION_UNITS = [
  "DAYS",
  "WEEKS",
  "MONTHS",
  "YEARS",
] as const;

type DeadlineType =
  (typeof DEADLINE_TYPES)[number];

type DeadlinePriority =
  (typeof DEADLINE_PRIORITIES)[number];

type CalculationUnit =
  (typeof CALCULATION_UNITS)[number];

type DeadlineWhere = {
  firmId: string;
  matterId?: string;
  status?:
    | "PENDING"
    | "COMPLETED"
    | "CANCELLED"
    | "OVERDUE";
  assignedToId?: string;
  matter?: {
    users: {
      some: {
        userId: string;
        canView: boolean;
      };
    };
  };
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

function isValidCalculationUnit(
  value: unknown,
): value is CalculationUnit {
  return (
    typeof value === "string" &&
    CALCULATION_UNITS.includes(
      value as CalculationUnit,
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
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const user =
    await prisma.user.findFirst({
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

  return user;
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

  const activeStatuses = [
    "TRIAL",
    "ACTIVE",
  ] as const;

  if (
    !activeStatuses.includes(
      subscription.status as
        | "TRIAL"
        | "ACTIVE",
    )
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

/**
 * Checks whether a user can access a matter.
 *
 * Ordinary users:
 * - must have a MatterUser record
 * - must have canView=true for viewing
 * - must have canManage=true for management
 *
 * Privileged users:
 * - may be granted firm-wide access by passing
 *   allowFirmWideAccess=true
 *
 * The matter is always restricted to the
 * authenticated user's firm.
 */
async function canAccessMatter(
  userId: string,
  firmId: string,
  matterId: string,
  requireManage = false,
  allowFirmWideAccess = false,
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

  /*
   * Privileged users with firm-wide access
   * do not require a MatterUser record.
   *
   * The matter is already restricted by
   * firmId above.
   */
  if (allowFirmWideAccess) {
    return matter;
  }

  const matterAccess =
    matter.users[0];

  if (!matterAccess) {
    return null;
  }

  if (
    requireManage &&
    !matterAccess.canManage
  ) {
    return null;
  }

  if (
    !requireManage &&
    !matterAccess.canView
  ) {
    return null;
  }

  return matter;
}

/**
 * GET /api/deadlines
 *
 * Users must have the centralized
 * deadlines.view permission.
 *
 * Users without firm-wide deadline access
 * can only retrieve deadlines belonging to
 * matters where they have explicit canView
 * access.
 */
export async function GET(
  request: Request,
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

    const url = new URL(
      request.url,
    );

    const matterId =
      url.searchParams.get(
        "matterId",
      );

    const status =
      url.searchParams.get(
        "status",
      );

    const assignedToId =
      url.searchParams.get(
        "assignedToId",
      );

    /*
     * The centralized permission system
     * controls whether the user can access
     * deadline functionality.
     *
     * Matter-level authorization below
     * determines whether the user can access
     * a particular matter.
     *
     * Users with deadlines.view are not
     * automatically granted firm-wide access.
     *
     * Firm-wide access remains restricted
     * to the existing privileged legal roles.
     */
    const firmWideAccess = [
      "SUPER_ADMIN",
      "MANAGING_PARTNER",
      "PARTNER",
      "DIRECTOR",
      "ATTORNEY",
      "ADMIN",
    ].includes(user.role);

    /*
     * firmId always comes from the
     * authenticated database user.
     *
     * The browser cannot choose another firm.
     */
    const where: DeadlineWhere = {
      firmId: user.firmId,
    };

    /*
     * --------------------------------------------------
     * SPECIFIC MATTER FILTER
     * --------------------------------------------------
     */
    if (matterId) {
      if (firmWideAccess) {
        /*
         * Privileged users may access any matter
         * belonging to their own firm.
         */
        const matter =
          await prisma.matter.findFirst({
            where: {
              id: matterId,
              firmId: user.firmId,
            },
            select: {
              id: true,
            },
          });

        if (!matter) {
          return NextResponse.json(
            {
              error:
                "Matter not found or access denied.",
            },
            { status: 404 },
          );
        }
      } else {
        /*
         * Ordinary users require explicit
         * canView access.
         */
        const matter =
          await canAccessMatter(
            user.id,
            user.firmId,
            matterId,
          );

        if (!matter) {
          return NextResponse.json(
            {
              error:
                "Matter not found or access denied.",
            },
            { status: 404 },
          );
        }
      }

      where.matterId =
        matterId;
    } else if (!firmWideAccess) {
      /*
       * ------------------------------------------------
       * CRITICAL SECURITY CONTROL
       * ------------------------------------------------
       *
       * Users without firm-wide access must
       * only receive deadlines belonging to
       * matters they can view.
       *
       * This prevents:
       *
       * /api/deadlines
       *
       * from exposing every deadline in the firm.
       */
      where.matter = {
        users: {
          some: {
            userId: user.id,
            canView: true,
          },
        },
      };
    }

    /*
     * --------------------------------------------------
     * STATUS FILTER
     * --------------------------------------------------
     */
    if (
      status === "PENDING" ||
      status === "COMPLETED" ||
      status === "CANCELLED" ||
      status === "OVERDUE"
    ) {
      where.status = status;
    }

    /*
     * --------------------------------------------------
     * ASSIGNED USER FILTER
     * --------------------------------------------------
     *
     * The assigned user must belong to the
     * authenticated user's firm.
     */
    if (assignedToId) {
      const assignedUser =
        await prisma.user.findFirst({
          where: {
            id: assignedToId,
            firmId: user.firmId,
            status: "ACTIVE",
          },
          select: {
            id: true,
          },
        });

      if (!assignedUser) {
        return NextResponse.json(
          {
            error:
              "Assigned user not found.",
          },
          { status: 404 },
        );
      }

      where.assignedToId =
        assignedToId;
    }

    /*
     * --------------------------------------------------
     * FETCH DEADLINES
     * --------------------------------------------------
     */
    const deadlines =
      await prisma.deadline.findMany({
        where,
        orderBy: {
          dueDate: "asc",
        },
        include: {
          matter: {
            select: {
              id: true,
              referenceNumber: true,
              title: true,
              firmId: true,
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

    /*
     * --------------------------------------------------
     * DEFENSIVE FIRM ISOLATION
     * --------------------------------------------------
     */
    const firmDeadlines =
      deadlines.filter(
        (deadline) =>
          deadline.firmId ===
            user.firmId &&
          deadline.matter.firmId ===
            user.firmId,
      );

    /*
     * --------------------------------------------------
     * AUDIT LOG
     * --------------------------------------------------
     */
    try {
      await createAuditLog({
        request,
        firmId: user.firmId,
        userId: user.id,
        action: "READ",
        entityType: "Deadline",
        description:
          "Deadlines were listed.",
        metadata: {
          event:
            "DEADLINES_LISTED",
          matterId:
            matterId || null,
          status:
            status || null,
          assignedToId:
            assignedToId || null,
          deadlineCount:
            firmDeadlines.length,
        },
      });
    } catch (auditError) {
      console.error(
        "Deadline listing audit log error:",
        auditError,
      );
    }

    return NextResponse.json(
      {
        success: true,
        deadlines:
          firmDeadlines,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(
      "Get deadlines error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to retrieve deadlines right now.",
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/deadlines
 *
 * Creates:
 *
 * 1. A manual deadline, or
 * 2. An assisted/calculated deadline.
 *
 * The centralized deadlines.create
 * permission is required.
 */
export async function POST(
  request: Request,
) {
  try {
    const authorization =
      await requirePermission(
        "deadlines.create",
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

    const body =
      await request.json();

    const matterId =
      typeof body.matterId ===
      "string"
        ? body.matterId.trim()
        : "";

    const title =
      typeof body.title ===
      "string"
        ? body.title.trim()
        : "";

    const description =
      typeof body.description ===
      "string"
        ? body.description.trim()
        : null;

    const type =
      body.type;

    const priority =
      body.priority ??
      "MEDIUM";

    /*
     * Assigned user.
     */
    const assignedToId =
      typeof body.assignedToId ===
        "string" &&
      body.assignedToId.trim()
        ? body.assignedToId.trim()
        : null;

    /*
     * Manual deadline date.
     */
    let dueDate =
      parseDate(
        body.dueDate,
      );

    /*
     * Calculation fields.
     */
    const calculationRequested =
      body.calculationAmount !==
        undefined ||
      body.calculationUnit !==
        undefined;

    const sourceDate =
      body.sourceDate
        ? parseDate(
            body.sourceDate,
          )
        : null;

    const calculationAmount =
      body.calculationAmount;

    const calculationUnit =
      body.calculationUnit;

    let isCalculated =
      body.isCalculated ===
      true;

    let calculationNote =
      typeof body.calculationNote ===
      "string"
        ? body.calculationNote.trim()
        : null;

    /*
     * --------------------------------------------------
     * BASIC VALIDATION
     * --------------------------------------------------
     */

    if (!matterId) {
      return NextResponse.json(
        {
          error:
            "Matter ID is required.",
        },
        { status: 400 },
      );
    }

    if (!title) {
      return NextResponse.json(
        {
          error:
            "Deadline title is required.",
        },
        { status: 400 },
      );
    }

    if (title.length > 255) {
      return NextResponse.json(
        {
          error:
            "Deadline title is too long.",
        },
        { status: 400 },
      );
    }

    if (
      !isValidDeadlineType(
        type,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "A valid deadline type is required.",
        },
        { status: 400 },
      );
    }

    if (
      !isValidDeadlinePriority(
        priority,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "A valid deadline priority is required.",
        },
        { status: 400 },
      );
    }

    /*
     * --------------------------------------------------
     * CALCULATED DEADLINE
     * --------------------------------------------------
     */

    if (calculationRequested) {
      if (!sourceDate) {
        return NextResponse.json(
          {
            error:
              "A valid source date is required for a calculated deadline.",
          },
          { status: 400 },
        );
      }

      if (
        !Number.isInteger(
          calculationAmount,
        ) ||
        calculationAmount <= 0
      ) {
        return NextResponse.json(
          {
            error:
              "Calculation amount must be a positive whole number.",
          },
          { status: 400 },
        );
      }

      if (
        calculationAmount >
        10000
      ) {
        return NextResponse.json(
          {
            error:
              "Calculation amount is too large.",
          },
          { status: 400 },
        );
      }

      if (
        !isValidCalculationUnit(
          calculationUnit,
        )
      ) {
        return NextResponse.json(
          {
            error:
              "A valid calculation unit is required.",
          },
          { status: 400 },
        );
      }

      try {
        const calculation =
          calculateDeadline({
            sourceDate,
            amount:
              calculationAmount,
            unit:
              calculationUnit as DeadlineCalculationUnit,
          });

        dueDate =
          calculation.dueDate;

        isCalculated = true;

        calculationNote =
          calculation.calculationNote;
      } catch (error) {
        console.error(
          "Deadline calculation error:",
          error,
        );

        return NextResponse.json(
          {
            error:
              "Unable to calculate the deadline.",
          },
          { status: 400 },
        );
      }
    } else {
      /*
       * --------------------------------------------------
       * MANUAL DEADLINE
       * --------------------------------------------------
       */

      if (!dueDate) {
        return NextResponse.json(
          {
            error:
              "A valid due date is required.",
          },
          { status: 400 },
        );
      }

      if (
        body.sourceDate &&
        !sourceDate
      ) {
        return NextResponse.json(
          {
            error:
              "Source date must be a valid date.",
          },
          { status: 400 },
        );
      }

      /*
       * If explicitly marked calculated without
       * using the calculation service, require
       * supporting information.
       */
      if (isCalculated) {
        if (!sourceDate) {
          return NextResponse.json(
            {
              error:
                "A source date is required for a calculated deadline.",
            },
            { status: 400 },
          );
        }

        if (!calculationNote) {
          return NextResponse.json(
            {
              error:
                "A calculation note is required for a calculated deadline.",
            },
            { status: 400 },
          );
        }
      }
    }

    /*
     * --------------------------------------------------
     * MATTER ACCESS
     * --------------------------------------------------
     */
    const firmWideAccess = [
      "SUPER_ADMIN",
      "MANAGING_PARTNER",
      "PARTNER",
      "DIRECTOR",
      "ATTORNEY",
      "ADMIN",
    ].includes(user.role);

    const matter =
      await canAccessMatter(
        user.id,
        user.firmId,
        matterId,
        true,
        firmWideAccess,
      );

    if (!matter) {
      return NextResponse.json(
        {
          error:
            "Matter not found or you do not have permission to manage it.",
        },
        { status: 404 },
      );
    }

    /*
     * --------------------------------------------------
     * ASSIGNED USER VALIDATION
     * --------------------------------------------------
     */
    let assignedUserId:
      string | null = null;

    if (assignedToId) {
      const assignedUser =
        await prisma.user.findFirst({
          where: {
            id: assignedToId,
            firmId: user.firmId,
            status: "ACTIVE",
          },
          select: {
            id: true,
          },
        });

      if (!assignedUser) {
        return NextResponse.json(
          {
            error:
              "Assigned user not found in your firm.",
          },
          { status: 400 },
        );
      }

      assignedUserId =
        assignedUser.id;
    }

    /*
     * --------------------------------------------------
     * CREATE DEADLINE
     * --------------------------------------------------
     */
    const deadline =
      await prisma.deadline.create({
        data: {
          firmId: user.firmId,
          matterId,
          title,
          description:
            description || null,
          type,
          priority,
          status: "PENDING",
          dueDate: dueDate!,
          assignedToId:
            assignedUserId,
          createdById: user.id,
          isCalculated,
          sourceDate,
          calculationNote:
            calculationNote || null,
        },
        include: {
          matter: {
            select: {
              id: true,
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
        },
      });

    /*
     * --------------------------------------------------
     * AUDIT LOG
     * --------------------------------------------------
     */
    await createAuditLog({
      request,
      firmId: user.firmId,
      userId: user.id,
      action: "CREATE",
      entityType: "Deadline",
      entityId: deadline.id,
      description:
        `Deadline "${deadline.title}" was created for matter ${matter.referenceNumber}.`,
      metadata: {
        matterId,
        deadlineType:
          deadline.type,
        priority:
          deadline.priority,
        dueDate:
          deadline.dueDate.toISOString(),
        assignedToId:
          assignedUserId,
        isCalculated,
        sourceDate:
          sourceDate?.toISOString() ??
          null,
        calculationAmount:
          calculationRequested
            ? calculationAmount
            : null,
        calculationUnit:
          calculationRequested
            ? calculationUnit
            : null,
        calculationNote:
          calculationNote ||
          null,
      },
    });

    // =====================================================
    // NOTIFICATION
    // =====================================================
    //
    // Notify the assigned user when a new deadline is
    // assigned to them.
    //
    // Do not notify the creator if they assigned the
    // deadline to themselves.
    //
    // Notification failure must NEVER cause the deadline
    // creation itself to fail.
    // =====================================================

    try {
      if (
        deadline.assignedTo?.id &&
        deadline.assignedTo.id !== user.id
      ) {
        await createNotification({
          firmId: user.firmId,
          userId: deadline.assignedTo.id,
          type: "DEADLINE",
          title: "New deadline assigned",
          message:
            `You have been assigned the deadline "${deadline.title}" for matter ${deadline.matter.referenceNumber}.`,
        });
      }
    } catch (notificationError) {
      console.error(
        "DEADLINE NOTIFICATION ERROR:",
        notificationError,
      );
    }

    return NextResponse.json(
      {
        success: true,
        message:
          isCalculated
            ? "Calculated deadline created successfully. Attorney verification is required before reliance."
            : "Deadline created successfully.",
        deadline,
        verificationRequired:
          isCalculated,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(
      "Create deadline error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to create the deadline right now.",
      },
      { status: 500 },
    );
  }
}