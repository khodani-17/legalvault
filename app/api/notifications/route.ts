import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function getAuthenticatedUser() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const user = await prisma.user.findFirst({
    where: {
      id: session.user.id,
      status: "ACTIVE",
    },
    select: {
      id: true,
      firmId: true,
    },
  });

  if (!user?.firmId) {
    return null;
  }

  return user;
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 },
      );
    }

    const notifications =
      await prisma.notification.findMany({
        where: {
          userId: user.id,
          firmId: user.firmId,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 50,
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          isRead: true,
          createdAt: true,
          updatedAt: true,
        },
      });

    const unreadCount = notifications.filter(
      (notification) => !notification.isRead,
    ).length;

    return NextResponse.json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error(
      "Failed to retrieve notifications:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error: "Unable to retrieve notifications.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH() {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 },
      );
    }

    const result =
      await prisma.notification.updateMany({
        where: {
          userId: user.id,
          firmId: user.firmId,
          isRead: false,
        },
        data: {
          isRead: true,
        },
      });

    return NextResponse.json({
      success: true,
      updatedCount: result.count,
    });
  } catch (error) {
    console.error(
      "Failed to mark notifications as read:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error: "Unable to update notifications.",
      },
      { status: 500 },
    );
  }
}