
import { NextRequest, NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";

import { prisma } from "@/lib/prisma";
import {
  getSessionFromToken,
  SESSION_COOKIE_NAME,
} from "@/lib/session";

export const runtime = "nodejs";

const rpID = "localhost";
const expectedOrigin = "http://localhost:3000";

export async function POST(request: NextRequest) {
  // Reject cross-origin requests before performing
  // any authentication or database operations.
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

    const body = await request.json().catch(() => null);

    const challengeId = body?.challengeId;
    const authenticationResponse = body?.response;

    if (
      typeof challengeId !== "string" ||
      challengeId.length === 0 ||
      challengeId.length > 2048 ||
      typeof authenticationResponse?.id !== "string" ||
      authenticationResponse.id.length === 0 ||
      authenticationResponse.id.length > 2048
    ) {
      return NextResponse.json(
        { error: "Fresh passkey verification is required" },
        { status: 403 }
      );
    }

    const userId = session.user.id;

    // Find an unexpired challenge created by
    // this user in this exact login session.
    const challenge =
      await prisma.webAuthnChallenge.findFirst({
        where: {
          id: challengeId,
          type: "ACCOUNT_DELETION",
          userId,
          sessionId: session.id,
          expiresAt: {
            gt: new Date(),
          },
        },
        select: {
          id: true,
          challenge: true,
        },
      });

    if (!challenge) {
      return NextResponse.json(
        { error: "Deletion challenge invalid or expired" },
        { status: 403 }
      );
    }

    const passkey = await prisma.passkey.findFirst({
      where: {
        id: authenticationResponse.id,
        userId,
      },
      select: {
        id: true,
        publicKey: true,
        counter: true,
      },
    });

    if (!passkey) {
      return NextResponse.json(
        { error: "Verification passkey not found" },
        { status: 403 }
      );
    }

    const storedCounter = Number(passkey.counter);

    if (
      !Number.isSafeInteger(storedCounter) ||
      storedCounter < 0
    ) {
      return NextResponse.json(
        { error: "Invalid authenticator counter" },
        { status: 403 }
      );
    }

    // Verify the authenticator's cryptographic
    // response, including required user verification.
    let verification;

    try {
      verification = await verifyAuthenticationResponse({
        response: authenticationResponse,
        expectedChallenge: challenge.challenge,
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
        { error: "Passkey verification failed" },
        { status: 403 }
      );
    }

    if (!verification.verified) {
      return NextResponse.json(
        { error: "Passkey verification failed" },
        { status: 403 }
      );
    }

    const newCounter =
      verification.authenticationInfo.newCounter;

    if (
      !Number.isSafeInteger(newCounter) ||
      newCounter < 0
    ) {
      return NextResponse.json(
        { error: "Invalid authenticator counter" },
        { status: 403 }
      );
    }

    // All authorization and deletion checks
    // occur in one serializable transaction.
    const result = await prisma.$transaction(
      async (tx) => {
        // Recheck that the session is still active.
        const activeSession = await tx.session.findFirst({
          where: {
            id: session.id,
            userId,
            expiresAt: {
              gt: new Date(),
            },
          },
          select: {
            id: true,
          },
        });

        if (!activeSession) {
          return "SESSION_EXPIRED" as const;
        }

        // Consume the challenge exactly once.
        const consumed =
          await tx.webAuthnChallenge.deleteMany({
            where: {
              id: challenge.id,
              challenge: challenge.challenge,
              type: "ACCOUNT_DELETION",
              userId,
              sessionId: session.id,
              expiresAt: {
                gt: new Date(),
              },
            },
          });

        if (consumed.count !== 1) {
          return "CHALLENGE_USED" as const;
        }

        // Ensure the verifying credential has
        // not changed since verification.
        const updated = await tx.passkey.updateMany({
          where: {
            id: passkey.id,
            userId,
            counter: passkey.counter,
          },
          data: {
            counter: BigInt(newCounter),
          },
        });

        if (updated.count !== 1) {
          throw new Error("CREDENTIAL_CHANGED");
        }

        // The schema uses onDelete: Cascade for
        // passkeys, sessions, and user challenges.
        const deleted = await tx.user.deleteMany({
          where: {
            id: userId,
          },
        });

        if (deleted.count !== 1) {
          throw new Error("ACCOUNT_CHANGED");
        }

        return "DELETED" as const;
      },
      {
        isolationLevel: "Serializable",
      }
    );

    if (result === "SESSION_EXPIRED") {
      return NextResponse.json(
        { error: "Session expired. Please sign in again." },
        { status: 401 }
      );
    }

    if (result === "CHALLENGE_USED") {
      return NextResponse.json(
        { error: "Deletion challenge expired or already used" },
        { status: 403 }
      );
    }

    // Delete the browser's session cookie only
    // after the database transaction succeeds.
    const browserResponse = NextResponse.json(
      {
        success: true,
        message: "Account deleted successfully",
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );

    browserResponse.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
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
        { error: "Account state changed. Please try again." },
        { status: 409 }
      );
    }

    if (
      error instanceof Error &&
      (
        error.message === "CREDENTIAL_CHANGED" ||
        error.message === "ACCOUNT_CHANGED"
      )
    ) {
      return NextResponse.json(
        { error: "Account state changed. Please try again." },
        { status: 409 }
      );
    }

    console.error("Account deletion error:", error);

    return NextResponse.json(
      { error: "Unable to delete account" },
      { status: 500 }
    );
  }
}
