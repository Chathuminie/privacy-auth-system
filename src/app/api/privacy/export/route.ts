
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  getSessionFromToken,
  SESSION_COOKIE_NAME,
} from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(request: NextRequest) {
  try {
    // Authenticate using the secure session cookie.
    const token =
      request.cookies.get(SESSION_COOKIE_NAME)?.value;

    if (!token) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401, headers: privateHeaders }
      );
    }

    const session = await getSessionFromToken(token);

    if (!session) {
      return NextResponse.json(
        { error: "Invalid or expired session" },
        { status: 401, headers: privateHeaders }
      );
    }

    // Never accept another user's ID from the browser.
    const user = await prisma.user.findUnique({
      where: {
        id: session.user.id,
      },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,

        passkeys: {
          orderBy: {
            createdAt: "asc",
          },
          select: {
            id: true,
            webauthnUserID: true,
            counter: true,
            deviceType: true,
            backedUp: true,
            transports: true,
            createdAt: true,
          },
        },

        sessions: {
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
            createdAt: true,
            expiresAt: true,
          },
        },

        challenges: {
          orderBy: {
            createdAt: "desc",
          },
          select: {
            type: true,
            createdAt: true,
            expiresAt: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404, headers: privateHeaders }
      );
    }

    // Export only intentionally selected metadata.
    // Never expose token hashes, session cookie values,
    // raw challenges, or cryptographic public-key bytes.
    const exportData = {
      format: "privacy-auth-account-export",
      version: 1,
      exportedAt: new Date().toISOString(),

      account: {
        id: user.id,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },

      passkeys: user.passkeys.map((passkey) => ({
        id: passkey.id,
        webauthnUserID: passkey.webauthnUserID,
        counter: passkey.counter.toString(),
        deviceType: passkey.deviceType,
        backedUp: passkey.backedUp,
        transports: passkey.transports,
        createdAt: passkey.createdAt.toISOString(),
      })),

      sessions: user.sessions.map((record) => ({
        id: record.id,
        createdAt: record.createdAt.toISOString(),
        expiresAt: record.expiresAt.toISOString(),
      })),

      temporaryChallenges: user.challenges.map(
        (record) => ({
          type: record.type,
          createdAt: record.createdAt.toISOString(),
          expiresAt: record.expiresAt.toISOString(),
        })
      ),

      note:
        "This metadata export intentionally excludes session tokens, token hashes, raw WebAuthn challenges, and cryptographic key material.",
    };

    return NextResponse.json(exportData, {
      headers: {
        ...privateHeaders,
        "Content-Disposition":
          'attachment; filename="privacy-auth-data.json"',
      },
    });
  } catch (error) {
    console.error("Account data export error:", error);

    return NextResponse.json(
      { error: "Unable to export account data" },
      { status: 500, headers: privateHeaders }
    );
  }
}
