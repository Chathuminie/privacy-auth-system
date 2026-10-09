
import { NextRequest, NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";

import { prisma } from "@/lib/prisma";
import {
  getSessionFromToken,
  SESSION_COOKIE_NAME,
} from "@/lib/session";

export const runtime = "nodejs";

const rpID = "localhost";
const origin = "http://localhost:3000";

export async function POST(request: NextRequest) {
  try {
    // 1. Protect against cross-origin requests.
    if (request.headers.get("origin") !== request.nextUrl.origin) {
      return NextResponse.json(
        { error: "Invalid request origin" },
        { status: 403 }
      );
    }

    // 2. Require a valid authenticated session.
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

    // 3. Validate the removal request.
    const body = await request.json().catch(() => null);

    const passkeyId = body?.passkeyId;
    const challengeId = body?.challengeId;
    const authenticationResponse = body?.response;

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

    if (
      typeof challengeId !== "string" ||
      challengeId.length === 0 ||
      challengeId.length > 2048 ||
      typeof authenticationResponse?.id !== "string"
    ) {
      return NextResponse.json(
        { error: "Fresh passkey verification is required" },
        { status: 403 }
      );
    }

    // Never accept a user ID from the browser.
    const userId = session.user.id;

    // 4. Find the challenge bound to this user,
    // session and exact passkey removal request.
    const challenge = await prisma.webAuthnChallenge.findFirst({
      where: {
        id: challengeId,
        type: "PASSKEY_REMOVAL",
        userId,
        sessionId: session.id,
        targetPasskeyId: passkeyId,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!challenge) {
      return NextResponse.json(
        { error: "Removal challenge invalid or expired" },
        { status: 403 }
      );
    }

    // 5. Find a credential belonging to this user.
    const verifyingPasskey = await prisma.passkey.findFirst({
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

    if (!verifyingPasskey) {
      return NextResponse.json(
        { error: "Verification passkey not found" },
        { status: 403 }
      );
    }

    // 6. Cryptographically verify the signed
    // WebAuthn authentication response.
    let verification;

    try {
      verification = await verifyAuthenticationResponse({
        response: authenticationResponse,
        expectedChallenge: challenge.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: true,
        credential: {
          id: verifyingPasskey.id,
          publicKey: new Uint8Array(verifyingPasskey.publicKey),
          counter: Number(verifyingPasskey.counter),
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

    const newCounter = verification.authenticationInfo.newCounter;

    if (!Number.isSafeInteger(newCounter) || newCounter < 0) {
      return NextResponse.json(
        { error: "Invalid authenticator counter" },
        { status: 403 }
      );
    }

    // 7. Recheck ownership and last-passkey protection.
    // Consume the challenge, update the authenticator
    // counter, and delete the selected credential in
    // one serializable database transaction.
    const result = await prisma.$transaction(
      async (tx) => {
        const target = await tx.passkey.findFirst({
          where: {
            id: passkeyId,
            userId,
          },
          select: {
            id: true,
          },
        });

        if (!target) {
          return "NOT_FOUND" as const;
        }

        const count = await tx.passkey.count({
          where: {
            userId,
          },
        });

        if (count <= 1) {
          return "LAST_PASSKEY" as const;
        }

        // Delete the challenge exactly once.
        const consumed = await tx.webAuthnChallenge.deleteMany({
          where: {
            id: challenge.id,
            challenge: challenge.challenge,
            type: "PASSKEY_REMOVAL",
            userId,
            sessionId: session.id,
            targetPasskeyId: passkeyId,
            expiresAt: {
              gt: new Date(),
            },
          },
        });

        if (consumed.count !== 1) {
          return "CHALLENGE_USED" as const;
        }

        // Prevent stale authenticator counters from
        // being accepted after concurrent changes.
        const updated = await tx.passkey.updateMany({
          where: {
            id: verifyingPasskey.id,
            userId,
            counter: verifyingPasskey.counter,
          },
          data: {
            counter: BigInt(newCounter),
          },
        });

        if (updated.count !== 1) {
          // Throwing rolls back challenge consumption.
          throw new Error("CREDENTIAL_CHANGED");
        }

        const deleted = await tx.passkey.deleteMany({
          where: {
            id: passkeyId,
            userId,
          },
        });

        if (deleted.count !== 1) {
          throw new Error("TARGET_CHANGED");
        }

        return "DELETED" as const;
      },
      {
        isolationLevel: "Serializable",
      }
    );

    if (result === "NOT_FOUND") {
      return NextResponse.json(
        { error: "Passkey not found" },
        { status: 404 }
      );
    }

    if (result === "LAST_PASSKEY") {
      return NextResponse.json(
        {
          error:
            "You cannot remove your last passkey. Add another passkey first.",
        },
        { status: 409 }
      );
    }

    if (result === "CHALLENGE_USED") {
      return NextResponse.json(
        { error: "Removal challenge expired or already used" },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Passkey removed successfully",
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2034"
    ) {
      return NextResponse.json(
        { error: "Passkey list changed. Refresh and try again." },
        { status: 409 }
      );
    }

    if (
      error instanceof Error &&
      (error.message === "CREDENTIAL_CHANGED" ||
        error.message === "TARGET_CHANGED")
    ) {
      return NextResponse.json(
        { error: "Passkey state changed. Please try again." },
        { status: 409 }
      );
    }

    console.error("Remove passkey error:", error);

    return NextResponse.json(
      { error: "Unable to remove passkey" },
      { status: 500 }
    );
  }
}
