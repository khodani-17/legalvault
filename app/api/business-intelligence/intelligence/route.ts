import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateBusinessIntelligence } from "@/lib/business-intelligence/intelligence";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 },
      );
    }

    const user = await prisma.user.findUnique({
      where: {
        id: session.user.id,
      },
      select: {
        id: true,
        firmId: true,
        status: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found." },
        { status: 404 },
      );
    }

    if (user.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "User account is not active." },
        { status: 403 },
      );
    }

    if (!user.firmId) {
      return NextResponse.json(
        { error: "User is not associated with a firm." },
        { status: 403 },
      );
    }

    const insights = await generateBusinessIntelligence(
      user.firmId,
    );

    return NextResponse.json({
      success: true,
      data: insights,
    });
  } catch (error) {
    console.error(
      "Business Intelligence intelligence error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error: "Unable to generate business intelligence.",
      },
      { status: 500 },
    );
  }
}