
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  getSessionFromToken,
  SESSION_COOKIE_NAME,
} from "@/lib/session";

export const runtime = "nodejs";

const MAX_SESSION_AGE_MS = 5 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    // Step 1: Validate the request origin.
    const requestOrigin = request.headers.get("origin");

    if (requestOrigin !== request.nextUrl.origin) {
      return NextResponse.json(
        { error: "Invalid request origin" },
        { status: 403 }
      );
    }

    // Step 2: Read the session cookie.
    const token =
      request.cookies.get(SESSION_COOKIE_NAME)?.value;

    if (!token) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Step 3: Validate the authenticated session.
    const session = await getSessionFromToken(token);

    if (!session) {
      return NextResponse.json(
        { error: "Invalid or expired session" },
        { status: 401 }
      );
    }

    // Step 4: Require a recently created login session.
    const sessionAge =
      Date.now() - session.createdAt.getTime();

    if (
      sessionAge < 0 ||
      sessionAge > MAX_SESSION_AGE_MS
    ) {
      return NextResponse.json(
        {
          error:
            "Please sign in again before removing a passkey",
        },
        { status: 403 }
      );
    }

    // Step 5: Validate the requested credential ID.
    const body = await request.json().catch(() => null);
    const passkeyId = body?.passkeyId;

    if (
      typeof passkeyId !== "string" ||
      passkeyId.length === 0 ||
      passkeyId.length > 2048
    ) {
      return NextResponse.json(
        { error: "Invalid passkey ID" },
        { status: 400 }
      );
    }

    // Never trust a user ID from the browser.
    const userId = session.user.id;

    // Step 6: Perform ownership verification,
    // last-passkey protection and deletion together.
    const result = await prisma.$transaction(
      async (tx) => {
        const passkey = await tx.passkey.findFirst({
          where: {
            id: passkeyId,
            userId,
          },
          select: {
            id: true,
          },
        });

        if (!passkey) {
          return "NOT_FOUND" as const;
        }

        const passkeyCount = await tx.passkey.count({
          where: {
            userId,
          },
        });

        // Never remove the user's final passkey.
        if (passkeyCount <= 1) {
          return "LAST_PASSKEY" as const;
        }

        const deleted = await tx.passkey.deleteMany({
          where: {
            id: passkeyId,
            userId,
          },
        });

        if (deleted.count !== 1) {
          return "NOT_FOUND" as const;
        }

        return "DELETED" as const;
      },
      {
        isolationLevel: "Serializable",
      }
    );

    if (result === "NOT_FOUND") {
      return NextResponse.json(
        { error: "Passkey not found" },
        { status: 404 }
      );
    }

    if (result === "LAST_PASSKEY") {
      return NextResponse.json(
        {
          error:
            "You cannot remove your last passkey. Add another passkey first.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Passkey removed successfully",
    });
  } catch (error) {
    // Serializable transactions may detect a
    // concurrent credential modification.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2034"
    ) {
      return NextResponse.json(
        {
          error:
            "Passkey list changed. Refresh and try again.",
        },
        { status: 409 }
      );
    }

    console.error("Remove passkey error:", error);

    return NextResponse.json(
      { error: "Unable to remove passkey" },
      { status: 500 }
    );
  }
}
