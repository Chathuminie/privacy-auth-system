import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const rpID = "localhost";

export async function POST() {
  try {
    // Delete expired challenges
    await prisma.webAuthnChallenge.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    // Generate passwordless login options
    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: [],
      userVerification: "required",
    });

    // Store challenge temporarily
    const challengeRecord =
      await prisma.webAuthnChallenge.create({
        data: {
          challenge: options.challenge,
          type: "AUTHENTICATION",
          expiresAt: new Date(
            Date.now() + 5 * 60 * 1000
          ),
        },
      });

    return NextResponse.json({
      options,
      challengeId: challengeRecord.id,
    });
  } catch (error) {
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