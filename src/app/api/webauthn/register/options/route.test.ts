
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  countUsers: vi.fn(),
  createUser: vi.fn(),
  createChallenge: vi.fn(),
  deleteAbandonedUsers: vi.fn(),
  generateOptions: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      deleteMany: mocks.deleteAbandonedUsers,
    },
    $transaction: mocks.transaction,
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

    mocks.countUsers.mockResolvedValue(0);

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

    mocks.deleteAbandonedUsers.mockResolvedValue({
      count: 0,
    });

    const tx = {
      user: {
        count: mocks.countUsers,
        create: mocks.createUser,
      },
      webAuthnChallenge: {
        create: mocks.createChallenge,
      },
    };

    mocks.transaction.mockImplementation(
      async (
        callback: (client: typeof tx) => Promise<unknown>,
      ) => callback(tx),
    );
  });

  it("1. Rejects cross-origin requests", async () => {
    const result = await POST(
      makeRequest("https://attacker.example"),
    );

    expect(result.status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.createUser).not.toHaveBeenCalled();
  });

  it("2. Rejects missing Origin headers", async () => {
    const result = await POST(makeRequest());

    expect(result.status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.createUser).not.toHaveBeenCalled();
  });

  it("3. Generates secure registration options", async () => {
    const result = await POST(
      makeRequest("http://localhost:3000"),
    );

    expect(result.status).toBe(200);

    expect(mocks.countUsers).toHaveBeenCalledWith({
      where: {
        createdAt: {
          gte: expect.any(Date),
        },
      },
    });

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

    expect(mocks.transaction).toHaveBeenCalledWith(
      expect.any(Function),
      {
        isolationLevel: "Serializable",
      },
    );

    expect(await result.json()).toEqual({
      options: {
        challenge: "challenge-test-1",
        user: {
          id: "webauthn-user-test-1",
        },
      },
      userId: "user-test-1",
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
    expect(mocks.deleteAbandonedUsers).not.toHaveBeenCalled();
  });

  it("5. Uses conservative cleanup filters", async () => {
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

    const filter =
      mocks.deleteAbandonedUsers.mock.calls[0][0];

    const cutoff = filter.where.createdAt.lt;

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

  it("7. Enforces the registration rate limit", async () => {
    mocks.countUsers.mockResolvedValue(10);

    const result = await POST(
      makeRequest("http://localhost:3000"),
    );

    expect(result.status).toBe(429);
    expect(result.headers.get("Retry-After"))
      .toBe("60");

    expect(mocks.createUser).not.toHaveBeenCalled();
    expect(mocks.generateOptions).not.toHaveBeenCalled();
    expect(mocks.createChallenge).not.toHaveBeenCalled();
    expect(mocks.deleteAbandonedUsers).not.toHaveBeenCalled();
  });

  it("8. Allows requests below the rate limit", async () => {
    mocks.countUsers.mockResolvedValue(9);

    const result = await POST(
      makeRequest("http://localhost:3000"),
    );

    expect(result.status).toBe(200);
    expect(mocks.createUser).toHaveBeenCalledOnce();
    expect(mocks.createChallenge).toHaveBeenCalledOnce();
  });

  it("9. Handles transaction serialization conflicts", async () => {
    mocks.transaction.mockRejectedValue({
      code: "P2034",
    });

    const result = await POST(
      makeRequest("http://localhost:3000"),
    );

    expect(result.status).toBe(503);
    expect(result.headers.get("Retry-After"))
      .toBe("1");

    expect(mocks.deleteAbandonedUsers).not.toHaveBeenCalled();
  });
});
