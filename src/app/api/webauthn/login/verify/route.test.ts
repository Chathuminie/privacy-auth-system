
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
  passkeyFindUnique: vi.fn(),
  verify: vi.fn(),
  consumeChallenge: vi.fn(),
  updateCounter: vi.fn(),
  transaction: vi.fn(),
  createSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    webAuthnChallenge: {
      findFirst: mocks.challengeFindFirst,
    },
    passkey: {
      findUnique: mocks.passkeyFindUnique,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@simplewebauthn/server", () => ({
  verifyAuthenticationResponse: mocks.verify,
}));

vi.mock("@/lib/session", () => ({
  SESSION_COOKIE_NAME: "privacy_auth_session",
  createSession: mocks.createSession,
}));

import { POST } from "./route";

const URL =
  "http://localhost:3000/api/webauthn/login/verify";

function makeRequest(
  body: unknown = {
    challengeId: "challenge-1",
    response: {
      id: "passkey-1",
    },
  },
  origin = "http://localhost:3000"
) {
  return new NextRequest(URL, {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("Login Verification API Security", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    mocks.challengeFindFirst.mockResolvedValue({
      id: "challenge-1",
      challenge: "signed-challenge",
    });

    mocks.passkeyFindUnique.mockResolvedValue({
      id: "passkey-1",
      userId: "user-1",
      publicKey: new Uint8Array([1, 2, 3]),
      counter: BigInt(1),
    });

    mocks.verify.mockResolvedValue({
      verified: true,
      authenticationInfo: {
        newCounter: 2,
      },
    });

    mocks.consumeChallenge.mockResolvedValue({
      count: 1,
    });

    mocks.updateCounter.mockResolvedValue({
      count: 1,
    });

    mocks.createSession.mockResolvedValue({
      token: "test-session-token",
      expiresAt: new Date(
        Date.now() + 60 * 60 * 1000
      ),
    });

    const tx = {
      webAuthnChallenge: {
        deleteMany: mocks.consumeChallenge,
      },
      passkey: {
        updateMany: mocks.updateCounter,
      },
    };

    mocks.transaction.mockImplementation(
      async (
        callback: (client: typeof tx) => Promise<boolean>
      ) => callback(tx)
    );
  });

  it("1. Rejects cross-origin login attempts", async () => {
    const result = await POST(
      makeRequest(undefined, "https://attacker.example")
    );

    expect(result.status).toBe(403);

    expect(mocks.challengeFindFirst)
      .not.toHaveBeenCalled();

    expect(mocks.createSession)
      .not.toHaveBeenCalled();
  });

  it("2. Rejects missing authentication data", async () => {
    const result = await POST(makeRequest({}));

    expect(result.status).toBe(400);

    expect(mocks.verify).not.toHaveBeenCalled();

    expect(mocks.createSession)
      .not.toHaveBeenCalled();
  });

  it("3. Rejects expired or unknown challenges", async () => {
    mocks.challengeFindFirst.mockResolvedValue(null);

    const result = await POST(makeRequest());

    expect(result.status).toBe(400);

    expect(mocks.challengeFindFirst)
      .toHaveBeenCalledWith({
        where: {
          id: "challenge-1",
          type: "AUTHENTICATION",
          expiresAt: {
            gt: expect.any(Date),
          },
        },
        select: {
          id: true,
          challenge: true,
        },
      });

    expect(mocks.createSession)
      .not.toHaveBeenCalled();
  });

  it("4. Rejects an unknown passkey", async () => {
    mocks.passkeyFindUnique.mockResolvedValue(null);

    const result = await POST(makeRequest());

    expect(result.status).toBe(400);

    expect(mocks.verify).not.toHaveBeenCalled();

    expect(mocks.createSession)
      .not.toHaveBeenCalled();
  });

  it("5. Rejects invalid signatures", async () => {
    mocks.verify.mockRejectedValue(
      new Error("Invalid WebAuthn signature")
    );

    const result = await POST(makeRequest());

    expect(result.status).toBe(400);

    expect(mocks.transaction)
      .not.toHaveBeenCalled();

    expect(mocks.createSession)
      .not.toHaveBeenCalled();
  });

  it("6. Rejects reused challenges", async () => {
    mocks.consumeChallenge.mockResolvedValue({
      count: 0,
    });

    const result = await POST(makeRequest());

    expect(result.status).toBe(409);

    expect(mocks.updateCounter)
      .not.toHaveBeenCalled();

    expect(mocks.createSession)
      .not.toHaveBeenCalled();
  });

  it("7. Rejects concurrent credential changes", async () => {
    mocks.updateCounter.mockResolvedValue({
      count: 0,
    });

    const result = await POST(makeRequest());

    expect(result.status).toBe(409);

    expect(mocks.createSession)
      .not.toHaveBeenCalled();
  });

  it("8. Creates a session after verified authentication", async () => {
    const result = await POST(makeRequest());

    expect(result.status).toBe(200);

    expect(await result.json()).toEqual({
      verified: true,
      userId: "user-1",
    });

    expect(mocks.verify).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedChallenge: "signed-challenge",
        expectedOrigin: "http://localhost:3000",
        expectedRPID: "localhost",
        requireUserVerification: true,
        credential: expect.objectContaining({
          id: "passkey-1",
          counter: 1,
        }),
      })
    );

    expect(mocks.consumeChallenge)
      .toHaveBeenCalledWith({
        where: {
          id: "challenge-1",
          challenge: "signed-challenge",
          type: "AUTHENTICATION",
          expiresAt: {
            gt: expect.any(Date),
          },
        },
      });

    expect(mocks.updateCounter)
      .toHaveBeenCalledWith({
        where: {
          id: "passkey-1",
          userId: "user-1",
          counter: BigInt(1),
        },
        data: {
          counter: BigInt(2),
        },
      });

    expect(mocks.transaction)
      .toHaveBeenCalledWith(
        expect.any(Function),
        {
          isolationLevel: "Serializable",
        }
      );

    expect(mocks.createSession)
      .toHaveBeenCalledWith("user-1");

    expect(result.headers.get("set-cookie"))
      .toContain("privacy_auth_session=");

    expect(result.headers.get("Cache-Control"))
      .toBe("no-store");
  });
});
