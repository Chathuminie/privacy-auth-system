import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    const users = await prisma.user.count();
    const passkeys = await prisma.passkey.count();
    const challenges = await prisma.webAuthnChallenge.count();

    return NextResponse.json({
      users,
      passkeys,
      challenges,
    });
  } catch (error) {
    console.error("Database check error:", error);

    return NextResponse.json(
      {
        error: "Unable to check database",
      },
      {
        status: 500,
      },
    );
  }
}