
import { NextRequest, NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";

import { prisma } from "@/lib/prisma";
import {
  createSession,
  SESSION_COOKIE_NAME,
} from "@/lib/session";

export const runtime = "nodejs";

const rpID = "localhost";
const expectedOrigin = "http://localhost:3000";

export async function POST(request: NextRequest) {
  // 1. Reject cross-origin requests.
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json(
      { verified: false, error: "Invalid request origin" },
      { status: 403 }
    );
  }

  try {
    // 2. Validate the authentication request.
    const body = await request.json().catch(() => null);
    const response = body?.response;
    const challengeId = body?.challengeId;

    if (
      typeof challengeId !== "string" ||
      challengeId.length === 0 ||
      challengeId.length > 2048 ||
      typeof response?.id !== "string" ||
      response.id.length === 0 ||
      response.id.length > 2048
    ) {
      return NextResponse.json(
        {
          verified: false,
          error: "Invalid authentication request",
        },
        { status: 400 }
      );
    }

    // 3. Find an unexpired login challenge.
    const challengeRecord =
      await prisma.webAuthnChallenge.findFirst({
        where: {
          id: challengeId,
          type: "AUTHENTICATION",
          expiresAt: {
            gt: new Date(),
          },
        },
        select: {
          id: true,
          challenge: true,
        },
      });

    if (!challengeRecord) {
      return NextResponse.json(
        {
          verified: false,
          error: "Authentication challenge invalid or expired",
        },
        { status: 400 }
      );
    }

    // 4. Find the credential identified by the browser.
    const passkey = await prisma.passkey.findUnique({
      where: {
        id: response.id,
      },
      select: {
        id: true,
        userId: true,
        publicKey: true,
        counter: true,
      },
    });

    if (!passkey) {
      return NextResponse.json(
        {
          verified: false,
          error: "Passkey not found",
        },
        { status: 400 }
      );
    }

    const storedCounter = Number(passkey.counter);

    if (
      !Number.isSafeInteger(storedCounter) ||
      storedCounter < 0
    ) {
      return NextResponse.json(
        {
          verified: false,
          error: "Invalid authenticator counter",
        },
        { status: 400 }
      );
    }

    // 5. Cryptographically verify the WebAuthn assertion.
    let verification;

    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: challengeRecord.challenge,
        expectedOrigin,
        expectedRPID: rpID,
        requireUserVerification: true,
        credential: {
          id: passkey.id,
          publicKey: new Uint8Array(passkey.publicKey),
          counter: storedCounter,
        },
      });
    } catch {
      return NextResponse.json(
        {
          verified: false,
          error: "Passkey authentication failed",
        },
        { status: 400 }
      );
    }

    if (!verification.verified) {
      return NextResponse.json(
        {
          verified: false,
          error: "Passkey authentication failed",
        },
        { status: 400 }
      );
    }

    const newCounter =
      verification.authenticationInfo.newCounter;

    if (
      !Number.isSafeInteger(newCounter) ||
      newCounter < 0
    ) {
      return NextResponse.json(
        {
          verified: false,
          error: "Invalid authenticator counter",
        },
        { status: 400 }
      );
    }

    // 6. Consume the challenge and update the counter
    // atomically, preventing successful replay.
    const committed = await prisma.$transaction(
      async (tx) => {
        const consumed =
          await tx.webAuthnChallenge.deleteMany({
            where: {
              id: challengeRecord.id,
              challenge: challengeRecord.challenge,
              type: "AUTHENTICATION",
              expiresAt: {
                gt: new Date(),
              },
            },
          });

        if (consumed.count !== 1) {
          return false;
        }

        const updated = await tx.passkey.updateMany({
          where: {
            id: passkey.id,
            userId: passkey.userId,
            counter: passkey.counter,
          },
          data: {
            counter: BigInt(newCounter),
          },
        });

        if (updated.count !== 1) {
          // Roll back challenge consumption too.
          throw new Error("CREDENTIAL_CHANGED");
        }

        return true;
      },
      {
        isolationLevel: "Serializable",
      }
    );

    if (!committed) {
      return NextResponse.json(
        {
          verified: false,
          error: "Authentication challenge already used or expired",
        },
        { status: 409 }
      );
    }

    // 7. Create the session only after successful
    // verification and database transaction.
    const { token, expiresAt } = await createSession(
      passkey.userId
    );

    const browserResponse = NextResponse.json(
      {
        verified: true,
        userId: passkey.userId,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
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
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2034"
    ) {
      return NextResponse.json(
        {
          verified: false,
          error: "Authentication state changed. Please try again.",
        },
        { status: 409 }
      );
    }

    if (
      error instanceof Error &&
      error.message === "CREDENTIAL_CHANGED"
    ) {
      return NextResponse.json(
        {
          verified: false,
          error: "Passkey state changed. Please try again.",
        },
        { status: 409 }
      );
    }

    console.error("Authentication verification error:", error);

    return NextResponse.json(
      {
        verified: false,
        error: "Unable to verify passkey authentication",
      },
      { status: 500 }
    );
  }
}
