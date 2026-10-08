import { NextRequest, NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";

import { prisma } from "@/lib/prisma";
import {
  createSession,
  SESSION_COOKIE_NAME,
} from "@/lib/session";

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

    await prisma.webAuthnChallenge.delete({
      where: {
        id: challengeRecord.id,
      },
    });

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

    // Create a secure session after successful authentication.
    const { token, expiresAt } = await createSession(
      passkey.userId
    );

    const responseToBrowser = NextResponse.json({
      verified: true,
      userId: passkey.userId,
    });

    responseToBrowser.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });

    return responseToBrowser;
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