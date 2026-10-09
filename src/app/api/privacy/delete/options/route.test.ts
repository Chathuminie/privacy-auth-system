
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSessionFromToken: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  generateOptions: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  SESSION_COOKIE_NAME: "privacy_auth_session",
  getSessionFromToken: mocks.getSessionFromToken,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    passkey: {
      findMany: mocks.findMany,
    },
    webAuthnChallenge: {
      create: mocks.create,
    },
  },
}));

vi.mock("@simplewebauthn/server", () => ({
  generateAuthenticationOptions:
    mocks.generateOptions,
}));

import { POST } from "./route";

function makeRequest(
  authenticated = true,
  origin = "http://localhost:3000"
) {
  return new NextRequest(
    "http://localhost:3000/api/privacy/delete/options",
    {
      method: "POST",
      headers: {
        Origin: origin,
        ...(authenticated
          ? {
              Cookie:
                "privacy_auth_session=test-token",
            }
          : {}),
      },
    }
  );
}

describe("Account Deletion Options API", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    mocks.getSessionFromToken.mockResolvedValue({
      id: "session-1",
      user: {
        id: "user-1",
      },
    });

    mocks.findMany.mockResolvedValue([
      { id: "passkey-1" },
    ]);

    mocks.generateOptions.mockResolvedValue({
      challenge: "fresh-challenge",
      rpId: "localhost",
    });

    mocks.create.mockResolvedValue({
      id: "challenge-1",
    });
  });

  it("rejects cross-origin requests", async () => {
    const response = await POST(
      makeRequest(true, "https://attacker.example")
    );

    expect(response.status).toBe(403);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated requests", async () => {
    const response = await POST(
      makeRequest(false)
    );

    expect(response.status).toBe(401);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects invalid sessions", async () => {
    mocks.getSessionFromToken.mockResolvedValue(null);

    const response = await POST(makeRequest());

    expect(response.status).toBe(401);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("requires an existing passkey", async () => {
    mocks.findMany.mockResolvedValue([]);

    const response = await POST(makeRequest());

    expect(response.status).toBe(409);
    expect(mocks.generateOptions)
      .not.toHaveBeenCalled();
  });

  it("binds the deletion challenge to the user and session", async () => {
    const response = await POST(makeRequest());

    expect(response.status).toBe(200);

    expect(await response.json()).toEqual({
      options: {
        challenge: "fresh-challenge",
        rpId: "localhost",
      },
      challengeId: "challenge-1",
    });

    expect(mocks.findMany)
      .toHaveBeenCalledWith({
        where: {
          userId: "user-1",
        },
        select: {
          id: true,
        },
      });

    expect(mocks.generateOptions)
      .toHaveBeenCalledWith({
        rpID: "localhost",
        userVerification: "required",
        allowCredentials: [
          {
            id: "passkey-1",
          },
        ],
        timeout: 60_000,
      });

    expect(mocks.create)
      .toHaveBeenCalledWith({
        data: {
          challenge: "fresh-challenge",
          type: "ACCOUNT_DELETION",
          userId: "user-1",
          sessionId: "session-1",
          expiresAt: expect.any(Date),
        },
      });

    expect(response.headers.get("Cache-Control"))
      .toBe("no-store");
  });
});
