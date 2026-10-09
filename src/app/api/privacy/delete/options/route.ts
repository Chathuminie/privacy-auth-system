
import { NextRequest, NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";

import { prisma } from "@/lib/prisma";
import {
  getSessionFromToken,
  SESSION_COOKIE_NAME,
} from "@/lib/session";

export const runtime = "nodejs";

const rpID = "localhost";
const CHALLENGE_DURATION_MS = 2 * 60 * 1000;

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403 }
    );
  }

  try {
    const token =
      request.cookies.get(SESSION_COOKIE_NAME)?.value;

    if (!token) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const session = await getSessionFromToken(token);

    if (!session) {
      return NextResponse.json(
        { error: "Invalid or expired session" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Only this user's registered passkeys may
    // authorize account deletion.
    const passkeys = await prisma.passkey.findMany({
      where: { userId },
      select: { id: true },
    });

    if (passkeys.length === 0) {
      return NextResponse.json(
        { error: "No passkey available for verification" },
        { status: 409 }
      );
    }

    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "required",
      allowCredentials: passkeys.map((passkey) => ({
        id: passkey.id,
      })),
      timeout: 60_000,
    });

    // Bind this challenge to the current user
    // and authenticated session.
    const challengeRecord =
      await prisma.webAuthnChallenge.create({
        data: {
          challenge: options.challenge,
          type: "ACCOUNT_DELETION",
          userId,
          sessionId: session.id,
          expiresAt: new Date(
            Date.now() + CHALLENGE_DURATION_MS
          ),
        },
      });

    return NextResponse.json(
      {
        options,
        challengeId: challengeRecord.id,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "Account deletion options error:",
      error
    );

    return NextResponse.json(
      { error: "Unable to prepare account deletion" },
      { status: 500 }
    );
  }
}
