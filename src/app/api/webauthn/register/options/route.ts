
import { NextRequest, NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const rpName = "Privacy Auth";
const rpID = "localhost";
const expectedOrigin = "http://localhost:3000";

const ABANDONED_REGISTRATION_AGE_MS =
  24 * 60 * 60 * 1000;

async function cleanupAbandonedRegistrations() {
  const now = new Date();
  const cutoff = new Date(
    now.getTime() - ABANDONED_REGISTRATION_AGE_MS,
  );

  // Only remove old accounts that have no passkeys,
  // no sessions, and no active challenges.
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
  if (request.headers.get("origin") !== expectedOrigin) {
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403 },
    );
  }

  try {
    // Cleanup is best-effort and must not block registration.
    try {
      await cleanupAbandonedRegistrations();
    } catch (error) {
      console.warn(
        "Abandoned registration cleanup skipped:",
        error,
      );
    }

    const user = await prisma.user.create({
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

    await prisma.webAuthnChallenge.create({
      data: {
        challenge: options.challenge,
        webauthnUserID: options.user.id,
        type: "REGISTRATION",
        userId: user.id,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    return NextResponse.json(
      {
        options,
        userId: user.id,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Registration options error:", error);

    return NextResponse.json(
      { error: "Unable to create registration options" },
      { status: 500 },
    );
  }
}
