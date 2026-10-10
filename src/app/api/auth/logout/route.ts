
import { NextRequest, NextResponse } from "next/server";

import {
  deleteSessionByToken,
  SESSION_COOKIE_NAME,
} from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  // Require an explicit matching Origin for logout requests.
  const requestOrigin = request.headers.get("origin");

  if (requestOrigin !== request.nextUrl.origin) {
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403 },
    );
  }

  const sessionToken =
    request.cookies.get(SESSION_COOKIE_NAME)?.value;

  // Invalidate the session in the database first.
  if (sessionToken) {
    await deleteSessionByToken(sessionToken);
  }

  // Redirect the browser to the login page.
  const response = NextResponse.redirect(
    new URL("/login", request.url),
    { status: 303 },
  );

  // Prevent caching of the logout response.
  response.headers.set("Cache-Control", "no-store");

  // Remove the session cookie from the browser.
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
