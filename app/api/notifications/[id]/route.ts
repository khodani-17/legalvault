import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(
  request: Request,
  context: RouteContext,
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 },
      );
    }

    const sessionUser = await prisma.user.findFirst({
      where: {
        id: session.user.id,
        status: "ACTIVE",
      },
      select: {
        id: true,
        firmId: true,
      },
    });

    if (!sessionUser?.firmId) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 },
      );
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "Notification ID is required.",
        },
        { status: 400 },
      );
    }

    const notification =
      await prisma.notification.findFirst({
        where: {
          id,
          userId: sessionUser.id,
          firmId: sessionUser.firmId,
        },
        select: {
          id: true,
          isRead: true,
        },
      });

    if (!notification) {
      return NextResponse.json(
        {
          success: false,
          error: "Notification not found.",
        },
        { status: 404 },
      );
    }

    if (!notification.isRead) {
      await prisma.notification.update({
        where: {
          id: notification.id,
        },
        data: {
          isRead: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      notification: {
        id: notification.id,
        isRead: true,
      },
    });
  } catch (error) {
    console.error(
      "Failed to mark notification as read:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error: "Unable to update notification.",
      },
      { status: 500 },
    );
  }
}