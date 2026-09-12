import { prisma } from "@/lib/prisma";
import {
  NotificationType,
  UserRole,
  UserStatus,
} from "@/src/generated/prisma/enums";

type CreateNotificationInput = {
  firmId: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
};

type CreateNotificationsInput = {
  firmId: string;
  userIds: string[];
  type: NotificationType;
  title: string;
  message: string;
};

/**
 * Creates a notification for one active user belonging
 * to the specified firm.
 *
 * Security:
 * - Verifies the user exists.
 * - Verifies the user belongs to the firm.
 * - Verifies the user is active.
 */
export async function createNotification(
  input: CreateNotificationInput,
) {
  const {
    firmId,
    userId,
    type,
    title,
    message,
  } = input;

  if (!firmId || !userId) {
    return null;
  }

  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      firmId,
      status: UserStatus.ACTIVE,
    },
    select: {
      id: true,
    },
  });

  if (!user) {
    return null;
  }

  return prisma.notification.create({
    data: {
      firmId,
      userId: user.id,
      type,
      title: title.trim(),
      message: message.trim(),
    },
  });
}

/**
 * Creates the same notification for multiple active users
 * belonging to the specified firm.
 *
 * Security:
 * - Removes duplicate user IDs.
 * - Verifies recipients belong to the firm.
 * - Verifies recipients are active.
 */
export async function createNotifications(
  input: CreateNotificationsInput,
) {
  const {
    firmId,
    userIds,
    type,
    title,
    message,
  } = input;

  if (!firmId || userIds.length === 0) {
    return {
      count: 0,
    };
  }

  const uniqueUserIds = Array.from(
    new Set(userIds.filter(Boolean)),
  );

  if (uniqueUserIds.length === 0) {
    return {
      count: 0,
    };
  }

  const users = await prisma.user.findMany({
    where: {
      id: {
        in: uniqueUserIds,
      },
      firmId,
      status: UserStatus.ACTIVE,
    },
    select: {
      id: true,
    },
  });

  if (users.length === 0) {
    return {
      count: 0,
    };
  }

  return prisma.notification.createMany({
    data: users.map((user) => ({
      firmId,
      userId: user.id,
      type,
      title: title.trim(),
      message: message.trim(),
    })),
  });
}

/**
 * Creates a notification for all active users in a firm,
 * optionally excluding specific users.
 */
export async function notifyFirmUsers({
  firmId,
  type,
  title,
  message,
  excludeUserIds = [],
}: {
  firmId: string;
  type: NotificationType;
  title: string;
  message: string;
  excludeUserIds?: string[];
}) {
  if (!firmId) {
    return {
      count: 0,
    };
  }

  const excluded = new Set(
    excludeUserIds.filter(Boolean),
  );

  const users = await prisma.user.findMany({
    where: {
      firmId,
      status: UserStatus.ACTIVE,
    },
    select: {
      id: true,
    },
  });

  const recipientIds = users
    .map((user) => user.id)
    .filter(
      (userId) => !excluded.has(userId),
    );

  return createNotifications({
    firmId,
    userIds: recipientIds,
    type,
    title,
    message,
  });
}

/**
 * Creates notifications for specific roles within a firm.
 *
 * Supports either:
 * - One role
 * - Multiple roles
 *
 * Security:
 * - Uses Prisma's UserRole enum.
 * - Firm scoped.
 * - Active users only.
 * - Optional recipient exclusions.
 */
export async function notifyFirmRoles({
  firmId,
  roles,
  type,
  title,
  message,
  excludeUserIds = [],
}: {
  firmId: string;
  roles: UserRole | UserRole[];
  type: NotificationType;
  title: string;
  message: string;
  excludeUserIds?: string[];
}) {
  if (!firmId) {
    return {
      count: 0,
    };
  }

  const excluded = new Set(
    excludeUserIds.filter(Boolean),
  );

  const roleFilter = Array.isArray(roles)
    ? {
        in: roles,
      }
    : roles;

  const users = await prisma.user.findMany({
    where: {
      firmId,
      status: UserStatus.ACTIVE,
      role: roleFilter,
    },
    select: {
      id: true,
    },
  });

  const recipientIds = users
    .map((user) => user.id)
    .filter(
      (userId) => !excluded.has(userId),
    );

  return createNotifications({
    firmId,
    userIds: recipientIds,
    type,
    title,
    message,
  });
}