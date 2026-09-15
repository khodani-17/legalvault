import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions-server";
import {
  canAccessTask,
  getActiveTaskUser,
} from "@/lib/task-authorization";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  request: Request,
  context: RouteContext,
) {
  void request;

  const permission = await requirePermission("tasks.view");

  if (!permission.authorized) {
    return permission.response;
  }

  try {
    const session = permission.session;

    if (!session.user?.id || !session.user.firmId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: "Task ID is required" },
        { status: 400 },
      );
    }

    const user = await getActiveTaskUser(
      session.user.id,
      session.user.firmId,
    );

    if (!user) {
      return NextResponse.json(
        { error: "Active user account not found" },
        { status: 403 },
      );
    }

    const authorization = await canAccessTask({
      taskId: id,
      userId: user.id,
      firmId: user.firmId,
    });

    if (!authorization.allowed) {
      return NextResponse.json(
        {
          error:
            authorization.reason ??
            "You are not authorized to view this task history",
        },
        { status: 403 },
      );
    }

    const task = await prisma.task.findFirst({
      where: {
        id,
        firmId: user.firmId,
      },
      select: {
        id: true,
        title: true,
        status: true,
      },
    });

    if (!task) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 },
      );
    }

    const activities = await prisma.taskActivity.findMany({
      where: {
        taskId: task.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        taskId: true,
        userId: true,
        action: true,
        description: true,
        metadata: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      task: {
        id: task.id,
        title: task.title,
        status: task.status,
      },
      activities,
      count: activities.length,
    });
  } catch (error) {
    console.error(
      "GET /api/tasks/[id]/history error:",
      error,
    );

    return NextResponse.json(
      { error: "Failed to load task history" },
      { status: 500 },
    );
  }
}