import { NextRequest, NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const rpID = "localhost";
const origin = "http://localhost:3000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { response, challengeId } = body;

    if (!response || !challengeId) {
      return NextResponse.json(
        {
          verified: false,
          error: "Missing authentication response or challenge ID",
        },
        {
          status: 400,
        }
      );
    }

    // Find the temporary authentication challenge.
    const challengeRecord =
      await prisma.webAuthnChallenge.findFirst({
        where: {
          id: challengeId,
          type: "AUTHENTICATION",
          expiresAt: {
            gt: new Date(),
          },
        },
      });

    if (!challengeRecord) {
      return NextResponse.json(
        {
          verified: false,
          error: "Authentication challenge not found or expired",
        },
        {
          status: 400,
        }
      );
    }

    // Find the passkey chosen by the authenticator.
    const passkey = await prisma.passkey.findUnique({
      where: {
        id: response.id,
      },
      include: {
        user: true,
      },
    });

    if (!passkey) {
      return NextResponse.json(
        {
          verified: false,
          error: "Passkey not found",
        },
        {
          status: 400,
        }
      );
    }

    // A challenge should only be usable once.
    await prisma.webAuthnChallenge.delete({
      where: {
        id: challengeRecord.id,
      },
    });

    // Verify the cryptographic authentication response.
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challengeRecord.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,

      credential: {
        id: passkey.id,
        publicKey: new Uint8Array(passkey.publicKey),
        counter: Number(passkey.counter),
      },
    });

    if (!verification.verified) {
      return NextResponse.json(
        {
          verified: false,
          error: "Passkey authentication failed",
        },
        {
          status: 400,
        }
      );
    }

    // Update the WebAuthn signature counter.
    await prisma.passkey.update({
      where: {
        id: passkey.id,
      },
      data: {
        counter: BigInt(
          verification.authenticationInfo.newCounter
        ),
      },
    });

    return NextResponse.json({
      verified: true,
      userId: passkey.userId,
    });
  } catch (error) {
    console.error(
      "Authentication verification error:",
      error
    );

    return NextResponse.json(
      {
        verified: false,
        error: "Unable to verify passkey authentication",
      },
      {
        status: 500,
      }
    );
  }
}