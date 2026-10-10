
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  deleteSessionByToken: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  SESSION_COOKIE_NAME: "privacy_auth_session",
  deleteSessionByToken: mocks.deleteSessionByToken,
}));

import { POST } from "./route";

const URL = "http://localhost:3000/api/auth/logout";

function makeRequest(
  origin: string | null = "http://localhost:3000",
  token: string | null = "test-session-token",
) {
  const headers = new Headers();

  if (origin !== null) {
    headers.set("Origin", origin);
  }

  if (token !== null) {
    headers.set(
      "Cookie",
      `privacy_auth_session=${token}`,
    );
  }

  return new NextRequest(URL, {
    method: "POST",
    headers,
  });
}

describe("Logout API Security", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    mocks.deleteSessionByToken.mockResolvedValue(undefined);
  });

  it("1. Rejects cross-origin logout requests", async () => {
    const result = await POST(
      makeRequest("https://attacker.example"),
    );

    expect(result.status).toBe(403);
    expect(mocks.deleteSessionByToken)
      .not.toHaveBeenCalled();
  });

  it("2. Rejects missing Origin headers", async () => {
    const result = await POST(makeRequest(null));

    expect(result.status).toBe(403);
    expect(mocks.deleteSessionByToken)
      .not.toHaveBeenCalled();
  });

  it("3. Invalidates the existing session", async () => {
    const result = await POST(makeRequest());

    expect(result.status).toBe(303);

    expect(mocks.deleteSessionByToken)
      .toHaveBeenCalledExactlyOnceWith(
        "test-session-token",
      );
  });

  it("4. Redirects to login after logout", async () => {
    const result = await POST(makeRequest());

    expect(result.status).toBe(303);

    expect(result.headers.get("location"))
      .toBe("http://localhost:3000/login");
  });

  it("5. Removes the browser session cookie", async () => {
    const result = await POST(makeRequest());

    const cookie = result.headers.get("set-cookie");

    expect(cookie).toContain("privacy_auth_session=");
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=lax");
    expect(cookie).toContain("Path=/");
  });

  it("6. Handles logout without a session cookie", async () => {
    const result = await POST(
      makeRequest("http://localhost:3000", null),
    );

    expect(result.status).toBe(303);

    expect(mocks.deleteSessionByToken)
      .not.toHaveBeenCalled();

    expect(result.headers.get("set-cookie"))
      .toContain("Max-Age=0");
  });

  it("7. Disables caching of logout responses", async () => {
    const result = await POST(makeRequest());

    expect(result.headers.get("Cache-Control"))
      .toBe("no-store");
  });
});
