import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const rpName = "Privacy Auth";
const rpID = "localhost";

export async function POST() {
  try {
    // Create a pseudonymous user.
    // No email, password, name, or other personal information is required.
    const user = await prisma.user.create({
      data: {},
    });

    // Generate WebAuthn registration options.
    const options = await generateRegistrationOptions({
      rpName,
      rpID,

      // Use our random internal user ID rather than personal information.
      userName: user.id,

      attestationType: "none",

      authenticatorSelection: {
        residentKey: "required",
        userVerification: "required",
      },
    });

    // Store the challenge temporarily so we can verify
    // the authenticator response in the next step.
    await prisma.webAuthnChallenge.create({
      data: {
        challenge: options.challenge,
        webauthnUserID: options.user.id,
        type: "REGISTRATION",
        userId: user.id,

        // Challenge expires after 5 minutes.
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    return NextResponse.json({
      options,
      userId: user.id,
    });
  } catch (error) {
    console.error("Registration options error:", error);

    return NextResponse.json(
      {
        error: "Unable to create registration options",
      },
      {
        status: 500,
      },
    );
  }
}