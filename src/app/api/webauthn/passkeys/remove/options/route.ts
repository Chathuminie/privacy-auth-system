
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
  try {
    // Only allow requests from our application.
    const origin = request.headers.get("origin");

    if (origin !== request.nextUrl.origin) {
      return NextResponse.json(
        { error: "Invalid request origin" },
        { status: 403 }
      );
    }

    // Require a valid authenticated session.
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

    const userId = session.user.id;

    // Only allow removal of a passkey owned by this user.
    const passkeys = await prisma.passkey.findMany({
      where: { userId },
      select: { id: true },
    });

    if (!passkeys.some((key) => key.id === passkeyId)) {
      return NextResponse.json(
        { error: "Passkey not found" },
        { status: 404 }
      );
    }

    // Never allow removal of the final passkey.
    if (passkeys.length <= 1) {
      return NextResponse.json(
        {
          error:
            "You cannot remove your last passkey.",
        },
        { status: 409 }
      );
    }

    // Ask the user to authenticate with an existing passkey.
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "required",
      allowCredentials: passkeys.map((key) => ({
        id: key.id,
      })),
      timeout: 60_000,
    });

    // Store a fresh, purpose-specific challenge.
    const challenge = await prisma.webAuthnChallenge.create({
      data: {
        challenge: options.challenge,
        type: "PASSKEY_REMOVAL",
        userId,
        sessionId: session.id,
        targetPasskeyId: passkeyId,
        expiresAt: new Date(
          Date.now() + CHALLENGE_DURATION_MS
        ),
      },
    });

    return NextResponse.json(
      {
        options,
        challengeId: challenge.id,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "Passkey removal options error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to create passkey removal challenge",
      },
      { status: 500 }
    );
  }
}
