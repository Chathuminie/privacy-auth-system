
import { NextRequest, NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const rpName = "Privacy Auth";
const rpID = "localhost";
const expectedOrigin = "http://localhost:3000";

export async function POST(request: NextRequest) {
  // Reject cross-origin and missing-Origin requests before
  // creating any database records.
  if (request.headers.get("origin") !== expectedOrigin) {
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403 },
    );
  }

  try {
    // Create a pseudonymous account.
    const user = await prisma.user.create({
      data: {},
    });

    // Generate WebAuthn registration options.
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

    // Store the temporary registration challenge.
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
