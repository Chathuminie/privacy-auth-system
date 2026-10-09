
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  deleteMany: vi.fn(),
  count: vi.fn(),
  create: vi.fn(),
  transaction: vi.fn(),
  generateAuthenticationOptions: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    webAuthnChallenge: {
      deleteMany: mocks.deleteMany,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@simplewebauthn/server", () => ({
  generateAuthenticationOptions:
    mocks.generateAuthenticationOptions,
}));

import { POST } from "./route";

function makeRequest(
  origin = "http://localhost:3000"
) {
  return new NextRequest(
    "http://localhost:3000/api/webauthn/login/options",
    {
      method: "POST",
      headers: {
        Origin: origin,
      },
    }
  );
}

describe("Login Options API Security", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    mocks.deleteMany.mockResolvedValue({
      count: 0,
    });

    mocks.count.mockResolvedValue(0);

    mocks.generateAuthenticationOptions.mockResolvedValue({
      challenge: "test-challenge",
      rpId: "localhost",
    });

    mocks.create.mockResolvedValue({
      id: "challenge-record-1",
    });

    mocks.transaction.mockImplementation(
      async (callback) =>
        callback({
          webAuthnChallenge: {
            count: mocks.count,
            create: mocks.create,
          },
        })
    );
  });

  it("1. Rejects cross-origin requests", async () => {
    const response = await POST(
      makeRequest("https://attacker.example")
    );

    expect(response.status).toBe(403);

    expect(mocks.deleteMany).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("2. Generates a valid login challenge", async () => {
    const response = await POST(makeRequest());

    expect(response.status).toBe(200);

    expect(await response.json()).toEqual({
      options: {
        challenge: "test-challenge",
        rpId: "localhost",
      },
      challengeId: "challenge-record-1",
    });

    expect(
      mocks.generateAuthenticationOptions
    ).toHaveBeenCalledWith({
      rpID: "localhost",
      allowCredentials: [],
      userVerification: "required",
    });

    expect(mocks.create).toHaveBeenCalledWith({
      data: {
        challenge: "test-challenge",
        type: "AUTHENTICATION",
        expiresAt: expect.any(Date),
      },
    });

    expect(response.headers.get("Cache-Control"))
      .toBe("no-store");
  });

  it("3. Rejects requests when the challenge limit is reached", async () => {
    mocks.count.mockResolvedValue(60);

    const response = await POST(makeRequest());

    expect(response.status).toBe(429);

    expect(response.headers.get("Retry-After"))
      .toBe("60");

    expect(
      mocks.generateAuthenticationOptions
    ).not.toHaveBeenCalled();

    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("4. Uses a serializable database transaction", async () => {
    await POST(makeRequest());

    expect(mocks.transaction).toHaveBeenCalledWith(
      expect.any(Function),
      {
        isolationLevel: "Serializable",
      }
    );
  });

  it("5. Handles database transaction conflicts", async () => {
    mocks.transaction.mockRejectedValue({
      code: "P2034",
    });

    const response = await POST(makeRequest());

    expect(response.status).toBe(503);

    expect(response.headers.get("Retry-After"))
      .toBe("1");
  });
});
