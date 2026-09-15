import { prisma } from "@/lib/prisma";
import type { UserRole } from "@/src/generated/prisma/enums";

// ============================================================
// TASK AUTHORIZATION
// ============================================================
//
// This file contains task-specific authorization rules.
//
// IMPORTANT:
// - General permissions remain in lib/permissions.ts.
// - Matter access remains separate from task access.
// - A task linked to a matter does NOT automatically grant
//   MatterUser access.
// - Database state is authoritative.
// - Firm boundaries are always enforced.
//
// ============================================================

// ============================================================
// ROLE GROUPS
// ============================================================

const MANAGEMENT_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "MANAGING_PARTNER",
  "PARTNER",
  "DIRECTOR",
];

const REPORT_REVIEW_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "MANAGING_PARTNER",
  "DIRECTOR",
];

const ON_BEHALF_DELEGATION_ROLES: UserRole[] = [
  "ADMIN",
  "LEGAL_SECRETARY",
];

const DIRECTOR_ROLES: UserRole[] = [
  "DIRECTOR",
  "MANAGING_PARTNER",
];

// ============================================================
// TYPES
// ============================================================

export type TaskAuthorizationUser = {
  id: string;
  firmId: string;
  role: UserRole;
  status: string;
};

export type TaskAuthorizationResult = {
  allowed: boolean;
  reason?: string;
};

// ============================================================
// GET ACTIVE DATABASE USER
// ============================================================
//
// Never trust role information supplied by the client.
//
// The database is authoritative.
// ============================================================

export async function getActiveTaskUser(
  userId: string,
  firmId: string,
): Promise<TaskAuthorizationUser | null> {
  if (!userId || !firmId) {
    return null;
  }

  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      firmId,
      status: "ACTIVE",
    },
    select: {
      id: true,
      firmId: true,
      role: true,
      status: true,
    },
  });

  return user;
}

// ============================================================
// ROLE HELPERS
// ============================================================

export function isManagementRole(
  role: UserRole,
): boolean {
  return MANAGEMENT_ROLES.includes(role);
}

export function isReportReviewerRole(
  role: UserRole,
): boolean {
  return REPORT_REVIEW_ROLES.includes(role);
}

export function canDelegateOnBehalfOfDirectorRole(
  role: UserRole,
): boolean {
  return ON_BEHALF_DELEGATION_ROLES.includes(role);
}

export function isDirectorRole(
  role: UserRole,
): boolean {
  return DIRECTOR_ROLES.includes(role);
}

// ============================================================
// CAN DELEGATE
// ============================================================
//
// Director / Managing Partner can delegate directly.
//
// ADMIN / LEGAL_SECRETARY can also create/delegate tasks,
// including tasks on behalf of a Director.
//
// Other roles may retain tasks.create for the existing
// task functionality, but they cannot use the Director
// delegation workflow.
// ============================================================

export function canDelegateTaskRole(
  role: UserRole,
): boolean {
  return [
    "SUPER_ADMIN",
    "MANAGING_PARTNER",
    "DIRECTOR",
    "ADMIN",
    "LEGAL_SECRETARY",
  ].includes(role);
}

// ============================================================
// VALIDATE "ON BEHALF OF"
// ============================================================
//
// Only ADMIN and LEGAL_SECRETARY may physically delegate
// on behalf of a Director/Managing Partner.
//
// The represented user must be active and belong to the
// same firm.
// ============================================================

export async function validateDelegationAuthority({
  actorId,
  firmId,
  onBehalfOfId,
}: {
  actorId: string;
  firmId: string;
  onBehalfOfId?: string | null;
}): Promise<TaskAuthorizationResult> {
  const actor = await getActiveTaskUser(
    actorId,
    firmId,
  );

  if (!actor) {
    return {
      allowed: false,
      reason:
        "The authenticated user is inactive or does not belong to this firm.",
    };
  }

  // ----------------------------------------------------------
  // Direct delegation
  // ----------------------------------------------------------

  if (!onBehalfOfId) {
    if (!canDelegateTaskRole(actor.role)) {
      return {
        allowed: false,
        reason:
          "You do not have authority to delegate tasks.",
      };
    }

    return {
      allowed: true,
    };
  }

  // ----------------------------------------------------------
  // On-behalf delegation
  // ----------------------------------------------------------

  if (
    !canDelegateOnBehalfOfDirectorRole(
      actor.role,
    )
  ) {
    return {
      allowed: false,
      reason:
        "Only a Legal Administrator or Legal Secretary may delegate a task on behalf of a Director.",
    };
  }

  if (onBehalfOfId === actor.id) {
    return {
      allowed: false,
      reason:
        "A user cannot delegate on behalf of themselves.",
    };
  }

  const representedUser =
    await getActiveTaskUser(
      onBehalfOfId,
      firmId,
    );

  if (!representedUser) {
    return {
      allowed: false,
      reason:
        "The selected Director is inactive or does not belong to this firm.",
    };
  }

  if (
    !isDirectorRole(
      representedUser.role,
    )
  ) {
    return {
      allowed: false,
      reason:
        "Tasks may only be delegated on behalf of a Director or Managing Partner.",
    };
  }

  return {
    allowed: true,
  };
}

// ============================================================
// CAN ACCESS TASK
// ============================================================
//
// Task access is separate from MatterUser access.
//
// A user can access a task when they are:
// - the assignee
// - the creator
// - the physical delegator
// - the person the task was delegated on behalf of
// - an authorized management user
//
// ============================================================

export async function canAccessTask({
  taskId,
  userId,
  firmId,
}: {
  taskId: string;
  userId: string;
  firmId: string;
}): Promise<TaskAuthorizationResult> {
  const user = await getActiveTaskUser(
    userId,
    firmId,
  );

  if (!user) {
    return {
      allowed: false,
      reason: "Active firm user required.",
    };
  }

  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      firmId,
    },
    select: {
      id: true,
      assignedToId: true,
      createdById: true,
      delegatedById: true,
      delegatedOnBehalfOfId: true,
    },
  });

  if (!task) {
    return {
      allowed: false,
      reason: "Task not found.",
    };
  }

  // ----------------------------------------------------------
  // Management access
  // ----------------------------------------------------------

  if (isManagementRole(user.role)) {
    return {
      allowed: true,
    };
  }

  // ----------------------------------------------------------
  // Direct task relationship
  // ----------------------------------------------------------

  const hasRelationship =
    task.assignedToId === user.id ||
    task.createdById === user.id ||
    task.delegatedById === user.id ||
    task.delegatedOnBehalfOfId === user.id;

  if (hasRelationship) {
    return {
      allowed: true,
    };
  }

  return {
    allowed: false,
    reason:
      "You are not authorized to access this task.",
  };
}

// ============================================================
// CAN UPDATE TASK
// ============================================================
//
// General task updating remains available to users with the
// tasks.update permission.
//
// This helper adds task-level ownership/relationship rules.
//
// Management can update team tasks.
//
// Assigned users can update their own tasks.
//
// Task creators/delegators can update tasks they created or
// delegated.
//
// ============================================================

export async function canUpdateTask({
  taskId,
  userId,
  firmId,
}: {
  taskId: string;
  userId: string;
  firmId: string;
}): Promise<TaskAuthorizationResult> {
  const access = await canAccessTask({
    taskId,
    userId,
    firmId,
  });

  if (!access.allowed) {
    return access;
  }

  return {
    allowed: true,
  };
}

// ============================================================
// CAN SUBMIT REPORT
// ============================================================
//
// Normally the assigned employee submits the report.
//
// Management may also submit a report when they are the
// assigned employee.
//
// ============================================================

export async function canSubmitTaskReport({
  taskId,
  userId,
  firmId,
}: {
  taskId: string;
  userId: string;
  firmId: string;
}): Promise<TaskAuthorizationResult> {
  const user = await getActiveTaskUser(
    userId,
    firmId,
  );

  if (!user) {
    return {
      allowed: false,
      reason: "Active firm user required.",
    };
  }

  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      firmId,
    },
    select: {
      assignedToId: true,
      requiresReport: true,
    },
  });

  if (!task) {
    return {
      allowed: false,
      reason: "Task not found.",
    };
  }

  if (!task.requiresReport) {
    return {
      allowed: false,
      reason:
        "This task does not require a report.",
    };
  }

  if (task.assignedToId !== user.id) {
    return {
      allowed: false,
      reason:
        "Only the employee assigned to this task may submit the report.",
    };
  }

  return {
    allowed: true,
  };
}

// ============================================================
// CAN REVIEW REPORT
// ============================================================
//
// Reports should normally return to the Director/Managing
// Partner responsible for the delegation.
//
// If a task was delegated on behalf of a Director, that
// Director reviews it.
//
// Otherwise the physical delegator or management may review.
// ============================================================

export async function canReviewTaskReport({
  taskId,
  userId,
  firmId,
}: {
  taskId: string;
  userId: string;
  firmId: string;
}): Promise<TaskAuthorizationResult> {
  const user = await getActiveTaskUser(
    userId,
    firmId,
  );

  if (!user) {
    return {
      allowed: false,
      reason: "Active firm user required.",
    };
  }

  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      firmId,
    },
    select: {
      delegatedById: true,
      delegatedOnBehalfOfId: true,
      createdById: true,
    },
  });

  if (!task) {
    return {
      allowed: false,
      reason: "Task not found.",
    };
  }

  // ----------------------------------------------------------
  // Person represented takes priority.
  // ----------------------------------------------------------

  if (
    task.delegatedOnBehalfOfId === user.id
  ) {
    return {
      allowed: true,
    };
  }

  // ----------------------------------------------------------
  // Management can review.
  // ----------------------------------------------------------

  if (
    isReportReviewerRole(user.role)
  ) {
    return {
      allowed: true,
    };
  }

  // ----------------------------------------------------------
  // If the physical delegator is a Director/MP, allow them.
  // ----------------------------------------------------------

  if (
    task.delegatedById === user.id
  ) {
    return {
      allowed: true,
    };
  }

  // ----------------------------------------------------------
  // Existing creator relationship.
  // ----------------------------------------------------------

  if (
    task.createdById === user.id &&
    isReportReviewerRole(user.role)
  ) {
    return {
      allowed: true,
    };
  }

  return {
    allowed: false,
    reason:
      "You are not authorized to review this task report.",
  };
}

// ============================================================
// CAN REQUEST ASSISTANCE
// ============================================================
//
// Assistance belongs to the employee responsible for the
// task.
//
// ============================================================

export async function canRequestTaskAssistance({
  taskId,
  userId,
  firmId,
}: {
  taskId: string;
  userId: string;
  firmId: string;
}): Promise<TaskAuthorizationResult> {
  const user = await getActiveTaskUser(
    userId,
    firmId,
  );

  if (!user) {
    return {
      allowed: false,
      reason: "Active firm user required.",
    };
  }

  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      firmId,
    },
    select: {
      assignedToId: true,
    },
  });

  if (!task) {
    return {
      allowed: false,
      reason: "Task not found.",
    };
  }

  if (task.assignedToId !== user.id) {
    return {
      allowed: false,
      reason:
        "Only the employee assigned to this task may request assistance.",
    };
  }

  return {
    allowed: true,
  };
}

// ============================================================
// CAN RESPOND TO ASSISTANCE
// ============================================================
//
// Assistance should be handled by the responsible manager,
// Director, Managing Partner, or person who delegated the task.
//
// ============================================================

export async function canRespondToTaskAssistance({
  taskId,
  userId,
  firmId,
}: {
  taskId: string;
  userId: string;
  firmId: string;
}): Promise<TaskAuthorizationResult> {
  const user = await getActiveTaskUser(
    userId,
    firmId,
  );

  if (!user) {
    return {
      allowed: false,
      reason: "Active firm user required.",
    };
  }

  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      firmId,
    },
    select: {
      delegatedById: true,
      delegatedOnBehalfOfId: true,
      createdById: true,
    },
  });

  if (!task) {
    return {
      allowed: false,
      reason: "Task not found.",
    };
  }

  // The represented Director gets first authority.
  if (
    task.delegatedOnBehalfOfId === user.id
  ) {
    return {
      allowed: true,
    };
  }

  // Management may respond.
  if (isReportReviewerRole(user.role)) {
    return {
      allowed: true,
    };
  }

  // Physical delegator may respond.
  if (task.delegatedById === user.id) {
    return {
      allowed: true,
    };
  }

  // Existing creator relationship.
  if (task.createdById === user.id) {
    return {
      allowed: true,
    };
  }

  return {
    allowed: false,
    reason:
      "You are not authorized to respond to this assistance request.",
  };
}