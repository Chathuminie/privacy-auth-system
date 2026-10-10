
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  challengeFindFirst: vi.fn(),
  verify: vi.fn(),
  consumeChallenge: vi.fn(),
  createPasskey: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    webAuthnChallenge: {
      findFirst: mocks.challengeFindFirst,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@simplewebauthn/server", () => ({
  verifyRegistrationResponse: mocks.verify,
}));

import { POST } from "./route";

const URL =
  "http://localhost:3000/api/webauthn/register/verify";

function makeRequest(
  body: unknown = {
    userId: "user-1",
    response: {
      id: "passkey-1",
    },
  },
) {
  return new NextRequest(URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("Registration Verification API Security", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    mocks.challengeFindFirst.mockResolvedValue({
      id: "challenge-1",
      challenge: "registration-challenge",
      webauthnUserID: "webauthn-user-1",
      userId: "user-1",
    });

    mocks.verify.mockResolvedValue({
      verified: true,
      registrationInfo: {
        credential: {
          id: "passkey-1",
          publicKey: new Uint8Array([1, 2, 3]),
          counter: 0,
          transports: ["internal"],
        },
        credentialDeviceType: "singleDevice",
        credentialBackedUp: false,
      },
    });

    mocks.consumeChallenge.mockResolvedValue({
      count: 1,
    });

    mocks.createPasskey.mockResolvedValue({
      id: "passkey-1",
    });

    const tx = {
      webAuthnChallenge: {
        deleteMany: mocks.consumeChallenge,
      },
      passkey: {
        create: mocks.createPasskey,
      },
    };

    mocks.transaction.mockImplementation(
      async (
        callback: (client: typeof tx) => Promise<boolean>,
      ) => callback(tx),
    );
  });

  it("1. Rejects missing registration data", async () => {
    const result = await POST(makeRequest({}));

    expect(result.status).toBe(400);
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("2. Rejects malformed JSON", async () => {
    const request = new NextRequest(URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: "{invalid-json",
    });

    const result = await POST(request);

    expect(result.status).toBe(400);
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it("3. Rejects missing or expired challenges", async () => {
    mocks.challengeFindFirst.mockResolvedValue(null);

    const result = await POST(makeRequest());

    expect(result.status).toBe(400);
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.createPasskey).not.toHaveBeenCalled();

    expect(mocks.challengeFindFirst).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        type: "REGISTRATION",
        expiresAt: {
          gt: expect.any(Date),
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  });

  it("4. Rejects missing WebAuthn user identifiers", async () => {
    mocks.challengeFindFirst.mockResolvedValue({
      id: "challenge-1",
      challenge: "registration-challenge",
      webauthnUserID: null,
    });

    const result = await POST(makeRequest());

    expect(result.status).toBe(400);
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.createPasskey).not.toHaveBeenCalled();
  });

  it("5. Rejects invalid WebAuthn verification", async () => {
    mocks.verify.mockRejectedValue(
      new Error("Invalid attestation"),
    );

    const result = await POST(makeRequest());

    expect(result.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.createPasskey).not.toHaveBeenCalled();
  });

  it("6. Rejects unverified credentials", async () => {
    mocks.verify.mockResolvedValue({
      verified: false,
    });

    const result = await POST(makeRequest());

    expect(result.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.createPasskey).not.toHaveBeenCalled();
  });

  it("7. Rejects consumed registration challenges", async () => {
    mocks.consumeChallenge.mockResolvedValue({
      count: 0,
    });

    const result = await POST(makeRequest());

    expect(result.status).toBe(409);
    expect(mocks.createPasskey).not.toHaveBeenCalled();
  });

  it("8. Rejects failed credential storage", async () => {
    mocks.createPasskey.mockRejectedValue(
      new Error("Database insertion failed"),
    );

    const result = await POST(makeRequest());

    expect(result.status).toBe(500);
    expect(mocks.consumeChallenge).toHaveBeenCalledOnce();
    expect(mocks.transaction).toHaveBeenCalledOnce();
  });

  it("9. Registers a successfully verified passkey", async () => {
    const result = await POST(makeRequest());

    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({
      verified: true,
      userId: "user-1",
    });

    expect(mocks.verify).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedChallenge: "registration-challenge",
        expectedOrigin: "http://localhost:3000",
        expectedRPID: "localhost",
        requireUserVerification: true,
      }),
    );

    expect(mocks.consumeChallenge).toHaveBeenCalledWith({
      where: {
        id: "challenge-1",
        userId: "user-1",
        type: "REGISTRATION",
        expiresAt: {
          gt: expect.any(Date),
        },
      },
    });

    expect(mocks.createPasskey).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: "passkey-1",
        userId: "user-1",
        webauthnUserID: "webauthn-user-1",
        counter: BigInt(0),
      }),
    });

    expect(mocks.transaction).toHaveBeenCalledOnce();
  });

  it("10. Simulates two attempts using the same challenge", async () => {
    mocks.consumeChallenge
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const [first, second] = await Promise.all([
      POST(makeRequest()),
      POST(makeRequest()),
    ]);

    expect([first.status, second.status].sort())
      .toEqual([200, 409]);

    expect(mocks.createPasskey).toHaveBeenCalledOnce();
  });
});
