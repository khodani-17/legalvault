import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getMatterControl } from "@/lib/matter-control/engine";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  request: Request,
  context: RouteContext,
) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 },
      );
    }

    const user = await prisma.user.findUnique({
      where: {
        email: session.user.email,
      },
      select: {
        id: true,
        firmId: true,
        status: true,
      },
    });

    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json(
        {
          success: false,
          error: "User account is not active.",
        },
        { status: 403 },
      );
    }

    const { id } = await context.params;

    const result = await getMatterControl(
      id,
      user.firmId,
    );

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          error: "Matter not found.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error(
      "Matter Control error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load Matter Control.",
      },
      { status: 500 },
    );
  }
}