
import { NextRequest, NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";

import { prisma } from "@/lib/prisma";

import {
  createSession,
  SESSION_COOKIE_NAME,
} from "@/lib/session";

export const runtime = "nodejs";

const rpID = "localhost";
const origin = "http://localhost:3000";

function registrationError(message: string, status = 400) {
  return NextResponse.json(
    { verified: false, error: message },
    { status },
  );
}


export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== origin) {
    return registrationError("Invalid request origin", 403);
  }

  try {

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return registrationError("Invalid JSON request body");
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return registrationError("Invalid registration request");
    }

    const { response, userId } = body as Record<string, unknown>;

    if (
      typeof userId !== "string" ||
      userId.length === 0 ||
      !response ||
      typeof response !== "object" ||
      Array.isArray(response)
    ) {
      return registrationError(
        "Missing or invalid registration response or user ID",
      );
    }

    const challengeRecord =
      await prisma.webAuthnChallenge.findFirst({
        where: {
          userId,
          type: "REGISTRATION",
          expiresAt: {
            gt: new Date(),
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

    if (!challengeRecord) {
      return registrationError(
        "Registration challenge not found or expired",
      );
    }

    if (!challengeRecord.webauthnUserID) {
      return registrationError("WebAuthn user ID is missing");
    }

    let verification: Awaited<
      ReturnType<typeof verifyRegistrationResponse>
    >;

    try {
      verification = await verifyRegistrationResponse({
        response: response as Parameters<
          typeof verifyRegistrationResponse
        >[0]["response"],
        expectedChallenge: challengeRecord.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: true,
      });
    } catch {
      return registrationError("Passkey verification failed");
    }

    if (
      !verification.verified ||
      !verification.registrationInfo
    ) {
      return registrationError("Passkey verification failed");
    }

    const {
      credential,
      credentialDeviceType,
      credentialBackedUp,
    } = verification.registrationInfo;

    // Consume the challenge and create the passkey atomically.
    // If either operation fails, the transaction rolls back.
    const saved = await prisma.$transaction(async (tx) => {
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
        return false;
      }

      await tx.passkey.create({
        data: {
          id: credential.id,
          publicKey: credential.publicKey,
          webauthnUserID: challengeRecord.webauthnUserID!,
          counter: BigInt(credential.counter),
          deviceType: credentialDeviceType,
          backedUp: credentialBackedUp,
          transports: credential.transports ?? [],
          userId,
        },
      });

      return true;
    });

    if (!saved) {
      return registrationError(
        "Registration challenge already used or expired",
        409,
      );
    }


    // Registration is complete. Sign in the new account.
    const { token, expiresAt } = await createSession(userId);

    const browserResponse = NextResponse.json(
      {
        verified: true,
        userId,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );

    browserResponse.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });

    return browserResponse;

  } catch (error) {
    console.error("Registration verification error:", error);

    return NextResponse.json(
      {
        verified: false,
        error: "Unable to verify passkey registration",
      },
      { status: 500 },
    );
  }
}
