
import { NextRequest, NextResponse } from "next/server";

import {
  deleteSessionByToken,
  SESSION_COOKIE_NAME,
} from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403 }
    );
  }

  const sessionToken =
    request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (sessionToken) {
    await deleteSessionByToken(sessionToken);
  }

  const response = NextResponse.redirect(
    new URL("/login", request.url),
    { status: 303 }
  );

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
