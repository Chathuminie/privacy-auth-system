
import { NextRequest, NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";

import { prisma } from "@/lib/prisma";
import {
  getSessionFromToken,
  SESSION_COOKIE_NAME,
} from "@/lib/session";

export const runtime = "nodejs";

const rpID = "localhost";
const origin = "http://localhost:3000";

// For this milestone, require a recently created
// session from a successful passkey login.
const MAX_SESSION_AGE_MS = 5 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    // Reject requests from other origins.
    const requestOrigin = request.headers.get("origin");

    if (requestOrigin !== new URL(request.url).origin) {
      return NextResponse.json(
        { error: "Invalid request origin" },
        { status: 403 }
      );
    }

    // Identify the logged-in user.
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

    // Require a fresh passkey login.
    const sessionAge =
      Date.now() - session.createdAt.getTime();

    if (
      sessionAge < 0 ||
      sessionAge > MAX_SESSION_AGE_MS
    ) {
      return NextResponse.json(
        {
          error: "Please log out and sign in again before adding a passkey",
        },
        { status: 403 }
      );
    }

    const userId = session.user.id;

    const body = await request.json();
    const { response, challengeId } = body;

    if (
      !response ||
      typeof challengeId !== "string" ||
      !challengeId
    ) {
      return NextResponse.json(
        { error: "Missing registration response or challenge ID" },
        { status: 400 }
      );
    }

    // Find the challenge belonging to THIS user.
    const challengeRecord =
      await prisma.webAuthnChallenge.findFirst({
        where: {
          id: challengeId,
          userId,
          type: "REGISTRATION",
          expiresAt: {
            gt: new Date(),
          },
        },
      });

    if (!challengeRecord) {
      return NextResponse.json(
        { error: "Registration challenge not found or expired" },
        { status: 400 }
      );
    }

    // Verify the authenticator's cryptographic response.
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challengeRecord.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json(
        {
          verified: false,
          error: "Passkey verification failed",
        },
        { status: 400 }
      );
    }

    const {
      credential,
      credentialDeviceType,
      credentialBackedUp,
    } = verification.registrationInfo;


const webauthnUserID = challengeRecord.webauthnUserID;

if (!webauthnUserID) {
  return NextResponse.json(
    { error: "WebAuthn user ID is missing" },
    { status: 400 }
  );
}


    // Prevent an existing credential from being added again.
    const existingCredential = await prisma.passkey.findUnique({
      where: {
        id: credential.id,
      },
    });

    if (existingCredential) {
      return NextResponse.json(
        {
          verified: false,
          error: "This passkey is already registered",
        },
        { status: 409 }
      );
    }

    // Consume the challenge and save the credential atomically.
    await prisma.$transaction(async (tx) => {
      const consumed = await tx.webAuthnChallenge.deleteMany({
        where: {
          id: challengeRecord.id,
          userId,
          type: "REGISTRATION",
          expiresAt: {
            gt: new Date(),
          },
        },
      });

      if (consumed.count !== 1) {
        throw new Error("Challenge already used or expired");
      }

      // Save the new passkey under the EXISTING user.
      await tx.passkey.create({
        data: {
          id: credential.id,
          publicKey: credential.publicKey,
          webauthnUserID: webauthnUserID,
          counter: BigInt(credential.counter),
          deviceType: credentialDeviceType,
          backedUp: credentialBackedUp,
          transports: credential.transports ?? [],
          userId,
        },
      });
    });

    return NextResponse.json({
      verified: true,
      userId,
      message: "Passkey added successfully",
    });
  } catch (error) {
    console.error("Add passkey verification error:", error);

    return NextResponse.json(
      {
        verified: false,
        error: "Unable to verify additional passkey",
      },
      { status: 500 }
    );
  }
}
