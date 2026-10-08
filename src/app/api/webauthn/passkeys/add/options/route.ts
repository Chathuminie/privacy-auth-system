
import { NextRequest, NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";

import { prisma } from "@/lib/prisma";
import {
  getSessionFromToken,
  SESSION_COOKIE_NAME,
} from "@/lib/session";

export const runtime = "nodejs";

const rpName = "Privacy Auth";
const rpID = "localhost";

export async function POST(request: NextRequest) {
  try {
    // Only accept requests from this application.
    const origin = request.headers.get("origin");

    if (origin !== new URL(request.url).origin) {
      return NextResponse.json(
        { error: "Invalid request origin" },
        { status: 403 }
      );
    }

    // Read the authenticated user's session.
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

const sessionAge = Date.now() - session.createdAt.getTime();

if (sessionAge < 0 || sessionAge > 5 * 60 * 1000) {
  return NextResponse.json(
    {
      error: "Please sign in again before adding a passkey",
    },
    { status: 403 }
  );
}

    const userId = session.user.id;

    // Get passkeys already registered to this user.

const existingPasskeys = await prisma.passkey.findMany({
  where: { userId },
  select: {
    id: true,
    webauthnUserID: true,
  },
  orderBy: {
    createdAt: "asc",
  },
});

if (existingPasskeys.length === 0) {
  return NextResponse.json(
    { error: "No existing passkey found" },
    { status: 400 }
  );
}

// Reuse the original WebAuthn user handle.
const originalUserHandle =
  existingPasskeys[0].webauthnUserID;

const webauthnUserID = new Uint8Array(
  Buffer.from(originalUserHandle, "base64url")
);


    // Generate options for the EXISTING user.
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: userId,
      userID: webauthnUserID,
      attestationType: "none",

      excludeCredentials: existingPasskeys.map((passkey) => ({
        id: passkey.id,
      })),

      authenticatorSelection: {
        residentKey: "required",
        userVerification: "required",
      },
    });

    // Store the new registration challenge.
    const challengeRecord =
      await prisma.webAuthnChallenge.create({
        data: {
          challenge: options.challenge,
          webauthnUserID: options.user.id,
          type: "REGISTRATION",
          userId,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      });

    return NextResponse.json({
      options,
      challengeId: challengeRecord.id,
    });

  } catch (error) {
    console.error("Add passkey options error:", error);

    return NextResponse.json(
      { error: "Unable to create passkey options" },
      { status: 500 }
    );
  }
}
