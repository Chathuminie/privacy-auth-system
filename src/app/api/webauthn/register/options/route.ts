
import { NextRequest, NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const rpName = "Privacy Auth";
const rpID = "localhost";
const expectedOrigin = "http://localhost:3000";

const ABANDONED_REGISTRATION_AGE_MS =
  24 * 60 * 60 * 1000;

const RATE_LIMIT_WINDOW_MS = 60 * 1000;

// Shared database-wide limit for the local portfolio demo.
const MAX_REGISTRATIONS_PER_MINUTE = 10;

async function cleanupAbandonedRegistrations() {
  const now = new Date();
  const cutoff = new Date(
    now.getTime() - ABANDONED_REGISTRATION_AGE_MS,
  );

  await prisma.user.deleteMany({
    where: {
      createdAt: {
        lt: cutoff,
      },
      updatedAt: {
        lt: cutoff,
      },
      passkeys: {
        none: {},
      },
      sessions: {
        none: {},
      },
      challenges: {
        none: {
          expiresAt: {
            gt: now,
          },
        },
      },
    },
  });
}

export async function POST(request: NextRequest) {
  // Validate the requesting application's origin.
  if (request.headers.get("origin") !== expectedOrigin) {
    return NextResponse.json(
      { error: "Invalid request origin" },
      {
        status: 403,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  try {
    const now = Date.now();

    // Rate-limit and persist the registration atomically.
    const result = await prisma.$transaction(
      async (tx) => {
        const recentRegistrations = await tx.user.count({
          where: {
            createdAt: {
              gte: new Date(now - RATE_LIMIT_WINDOW_MS),
            },
          },
        });

        if (
          recentRegistrations >=
          MAX_REGISTRATIONS_PER_MINUTE
        ) {
          return null;
        }

        const user = await tx.user.create({
          data: {},
        });

        const options = await generateRegistrationOptions({
          rpName,
          rpID,
          userName: user.id,
          attestationType: "none",
          authenticatorSelection: {
            residentKey: "required",
            userVerification: "required",
          },
        });

        await tx.webAuthnChallenge.create({
          data: {
            challenge: options.challenge,
            webauthnUserID: options.user.id,
            type: "REGISTRATION",
            userId: user.id,
            expiresAt: new Date(
              Date.now() + 5 * 60 * 1000,
            ),
          },
        });

        return {
          options,
          userId: user.id,
        };
      },
      {
        isolationLevel: "Serializable",
      },
    );

    if (!result) {
      return NextResponse.json(
        {
          error:
            "Too many registration requests. Please try again shortly.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": "60",
            "Cache-Control": "no-store",
          },
        },
      );
    }

    // Housekeeping is best-effort.
    // Failure must not block a successful registration.
    try {
      await cleanupAbandonedRegistrations();
    } catch (error) {
      console.warn(
        "Abandoned registration cleanup skipped:",
        error,
      );
    }

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2034"
    ) {
      return NextResponse.json(
        {
          error:
            "Registration service is busy. Please try again.",
        },
        {
          status: 503,
          headers: {
            "Retry-After": "1",
            "Cache-Control": "no-store",
          },
        },
      );
    }

    console.error("Registration options error:", error);

    return NextResponse.json(
      { error: "Unable to create registration options" },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
