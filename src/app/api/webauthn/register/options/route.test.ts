
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  createUser: vi.fn(),
  createChallenge: vi.fn(),
  deleteAbandonedUsers: vi.fn(),
  generateOptions: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      create: mocks.createUser,
      deleteMany: mocks.deleteAbandonedUsers,
    },
    webAuthnChallenge: {
      create: mocks.createChallenge,
    },
  },
}));

vi.mock("@simplewebauthn/server", () => ({
  generateRegistrationOptions: mocks.generateOptions,
}));

import { POST } from "./route";

const URL =
  "http://localhost:3000/api/webauthn/register/options";

function makeRequest(origin?: string) {
  const headers = new Headers();

  if (origin) {
    headers.set("Origin", origin);
  }

  return new NextRequest(URL, {
    method: "POST",
    headers,
  });
}

describe("Registration Options API Security", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    mocks.deleteAbandonedUsers.mockResolvedValue({
      count: 0,
    });

    mocks.createUser.mockResolvedValue({
      id: "user-test-1",
    });

    mocks.generateOptions.mockResolvedValue({
      challenge: "challenge-test-1",
      user: {
        id: "webauthn-user-test-1",
      },
    });

    mocks.createChallenge.mockResolvedValue({
      id: "challenge-record-1",
    });
  });

  it("1. Rejects cross-origin requests", async () => {
    const result = await POST(
      makeRequest("https://attacker.example"),
    );

    expect(result.status).toBe(403);
    expect(mocks.deleteAbandonedUsers).not.toHaveBeenCalled();
    expect(mocks.createUser).not.toHaveBeenCalled();
    expect(mocks.createChallenge).not.toHaveBeenCalled();
  });

  it("2. Rejects missing Origin headers", async () => {
    const result = await POST(makeRequest());

    expect(result.status).toBe(403);
    expect(mocks.deleteAbandonedUsers).not.toHaveBeenCalled();
    expect(mocks.createUser).not.toHaveBeenCalled();
    expect(mocks.createChallenge).not.toHaveBeenCalled();
  });

  it("3. Generates secure registration options", async () => {
    const result = await POST(
      makeRequest("http://localhost:3000"),
    );

    expect(result.status).toBe(200);
    expect(mocks.createUser).toHaveBeenCalledOnce();

    expect(mocks.generateOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        rpID: "localhost",
        userName: "user-test-1",
        attestationType: "none",
        authenticatorSelection: {
          residentKey: "required",
          userVerification: "required",
        },
      }),
    );

    expect(mocks.createChallenge).toHaveBeenCalledWith({
      data: expect.objectContaining({
        challenge: "challenge-test-1",
        type: "REGISTRATION",
        userId: "user-test-1",
      }),
    });

    expect(result.headers.get("Cache-Control"))
      .toBe("no-store");
  });

  it("4. Handles registration generation failures", async () => {
    mocks.generateOptions.mockRejectedValue(
      new Error("Registration options failed"),
    );

    const result = await POST(
      makeRequest("http://localhost:3000"),
    );

    expect(result.status).toBe(500);
    expect(mocks.createChallenge).not.toHaveBeenCalled();
  });

  it("5. Uses conservative abandoned-account cleanup filters", async () => {
    const result = await POST(
      makeRequest("http://localhost:3000"),
    );

    expect(result.status).toBe(200);

    expect(mocks.deleteAbandonedUsers).toHaveBeenCalledWith({
      where: {
        createdAt: {
          lt: expect.any(Date),
        },
        updatedAt: {
          lt: expect.any(Date),
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
              gt: expect.any(Date),
            },
          },
        },
      },
    });

    const cleanupFilter =
      mocks.deleteAbandonedUsers.mock.calls[0][0];

    const cutoff = cleanupFilter.where.createdAt.lt;

    expect(cutoff.getTime()).toBeLessThan(
      Date.now() - 23 * 60 * 60 * 1000,
    );

    expect(cutoff.getTime()).toBeGreaterThan(
      Date.now() - 25 * 60 * 60 * 1000,
    );
  });

  it("6. Allows registration when cleanup fails", async () => {
    mocks.deleteAbandonedUsers.mockRejectedValue(
      new Error("Cleanup unavailable"),
    );

    const result = await POST(
      makeRequest("http://localhost:3000"),
    );

    expect(result.status).toBe(200);
    expect(mocks.createUser).toHaveBeenCalledOnce();
    expect(mocks.createChallenge).toHaveBeenCalledOnce();
  });
});
