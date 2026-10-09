
import { NextRequest, NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const rpID = "localhost";

const CHALLENGE_DURATION_MS = 5 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

// Temporary database-wide limit for our local demo.
// This is shared by all visitors.
const MAX_CHALLENGES_PER_MINUTE = 60;

export async function POST(request: NextRequest) {
  // Step 1: Validate request origin.
  const requestOrigin = request.headers.get("origin");

  if (requestOrigin !== request.nextUrl.origin) {
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403 }
    );
  }

  try {
    // Step 2: Remove expired challenges.
    await prisma.webAuthnChallenge.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    const now = Date.now();

    // Step 3: Check the request limit and create
    // the challenge in one serializable transaction.
    const result = await prisma.$transaction(
      async (tx) => {
        const recentChallenges =
          await tx.webAuthnChallenge.count({
            where: {
              type: "AUTHENTICATION",
              createdAt: {
                gte: new Date(
                  now - RATE_LIMIT_WINDOW_MS
                ),
              },
            },
          });

        if (
          recentChallenges >=
          MAX_CHALLENGES_PER_MINUTE
        ) {
          return null;
        }

        // Generate fresh passwordless login options.
        const options =
          await generateAuthenticationOptions({
            rpID,
            allowCredentials: [],
            userVerification: "required",
          });

        // Store the authentication challenge.
        const challengeRecord =
          await tx.webAuthnChallenge.create({
            data: {
              challenge: options.challenge,
              type: "AUTHENTICATION",
              expiresAt: new Date(
                Date.now() + CHALLENGE_DURATION_MS
              ),
            },
          });

        return {
          options,
          challengeId: challengeRecord.id,
        };
      },
      {
        isolationLevel: "Serializable",
      }
    );

    // Step 4: Reject excessive challenge requests.
    if (!result) {
      return NextResponse.json(
        {
          error:
            "Too many login requests. Please try again shortly.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": "60",
            "Cache-Control": "no-store",
          },
        }
      );
    }

    // Step 5: Return fresh authentication options.
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    // Concurrent serializable transactions may
    // conflict. Ask the client to retry.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2034"
    ) {
      return NextResponse.json(
        {
          error:
            "Login service is busy. Please try again.",
        },
        {
          status: 503,
          headers: {
            "Retry-After": "1",
          },
        }
      );
    }

    console.error(
      "Authentication options error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to create authentication options",
      },
      {
        status: 500,
      }
    );
  }
}
