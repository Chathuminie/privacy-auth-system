import { NextRequest, NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const rpID = "localhost";
const origin = "http://localhost:3000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { response, userId } = body;

    if (!response || !userId) {
      return NextResponse.json(
        {
          error: "Missing registration response or user ID",
        },
        {
          status: 400,
        },
      );
    }

    // Find the registration challenge created for this user.
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
      return NextResponse.json(
        {
          error: "Registration challenge not found or expired",
        },
        {
          status: 400,
        },
      );
    }

    // Verify the response from Touch ID / passkey authenticator.
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
        {
          status: 400,
        },
      );
    }

    const {
      credential,
      credentialDeviceType,
      credentialBackedUp,
    } = verification.registrationInfo;

    if (!challengeRecord.webauthnUserID) {
      return NextResponse.json(
        {
          error: "WebAuthn user ID is missing",
        },
        {
          status: 400,
        },
      );
    }

    // Store only the PUBLIC credential information.
    await prisma.passkey.create({
      data: {
        id: credential.id,
        publicKey: credential.publicKey,
        webauthnUserID: challengeRecord.webauthnUserID,
        counter: BigInt(credential.counter),
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        transports: credential.transports ?? [],
        userId,
      },
    });

    // The challenge has now been used, so delete it.
    await prisma.webAuthnChallenge.delete({
      where: {
        id: challengeRecord.id,
      },
    });

    return NextResponse.json({
      verified: true,
      userId,
    });
  } catch (error) {
    console.error("Registration verification error:", error);

    return NextResponse.json(
      {
        verified: false,
        error: "Unable to verify passkey registration",
      },
      {
        status: 500,
      },
    );
  }
}