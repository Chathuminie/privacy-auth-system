
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
  verify: vi.fn(),
  challengeFindFirst: vi.fn(),
  passkeyFindFirst: vi.fn(),
  sessionFindFirst: vi.fn(),
  consumeChallenge: vi.fn(),
  updateCounter: vi.fn(),
  deleteUser: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  SESSION_COOKIE_NAME: "privacy_auth_session",
  getSessionFromToken: mocks.getSessionFromToken,
}));

vi.mock("@simplewebauthn/server", () => ({
  verifyAuthenticationResponse: mocks.verify,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    webAuthnChallenge: {
      findFirst: mocks.challengeFindFirst,
    },
    passkey: {
      findFirst: mocks.passkeyFindFirst,
    },
    $transaction: mocks.transaction,
  },
}));

import { POST } from "./route";

const API_URL =
  "http://localhost:3000/api/privacy/delete";

function makeRequest({
  authenticated = true,
  origin = "http://localhost:3000",
  body = {
    challengeId: "challenge-1",
    response: {
      id: "passkey-1",
    },
  } as unknown,
}: {
  authenticated?: boolean;
  origin?: string;
  body?: unknown;
} = {}) {
  return new NextRequest(API_URL, {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(authenticated
        ? {
            Cookie:
              "privacy_auth_session=test-token",
          }
        : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("Secure Account Deletion API", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    mocks.getSessionFromToken.mockResolvedValue({
      id: "session-1",
      user: {
        id: "user-1",
      },
    });

    mocks.challengeFindFirst.mockResolvedValue({
      id: "challenge-1",
      challenge: "signed-challenge",
    });

    mocks.passkeyFindFirst.mockResolvedValue({
      id: "passkey-1",
      publicKey: new Uint8Array([1, 2, 3]),
      counter: BigInt(1),
    });

    mocks.verify.mockResolvedValue({
      verified: true,
      authenticationInfo: {
        newCounter: 2,
      },
    });

    mocks.sessionFindFirst.mockResolvedValue({
      id: "session-1",
    });

    mocks.consumeChallenge.mockResolvedValue({
      count: 1,
    });

    mocks.updateCounter.mockResolvedValue({
      count: 1,
    });

    mocks.deleteUser.mockResolvedValue({
      count: 1,
    });

    const tx = {
      session: {
        findFirst: mocks.sessionFindFirst,
      },
      webAuthnChallenge: {
        deleteMany: mocks.consumeChallenge,
      },
      passkey: {
        updateMany: mocks.updateCounter,
      },
      user: {
        deleteMany: mocks.deleteUser,
      },
    };

    mocks.transaction.mockImplementation(
      async (
        callback: (client: typeof tx) => Promise<unknown>
      ) => callback(tx)
    );
  });

  it("rejects cross-origin requests", async () => {
    const response = await POST(
      makeRequest({
        origin: "https://attacker.example",
      })
    );

    expect(response.status).toBe(403);
    expect(mocks.getSessionFromToken)
      .not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated requests", async () => {
    const response = await POST(
      makeRequest({ authenticated: false })
    );

    expect(response.status).toBe(401);
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("rejects invalid sessions", async () => {
    mocks.getSessionFromToken.mockResolvedValue(null);

    const response = await POST(makeRequest());

    expect(response.status).toBe(401);
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("requires fresh passkey verification", async () => {
    const response = await POST(
      makeRequest({ body: {} })
    );

    expect(response.status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects expired deletion challenges", async () => {
    mocks.challengeFindFirst.mockResolvedValue(null);

    const response = await POST(makeRequest());

    expect(response.status).toBe(403);

    expect(mocks.challengeFindFirst)
      .toHaveBeenCalledWith({
        where: {
          id: "challenge-1",
          type: "ACCOUNT_DELETION",
          userId: "user-1",
          sessionId: "session-1",
          expiresAt: {
            gt: expect.any(Date),
          },
        },
        select: {
          id: true,
          challenge: true,
        },
      });

    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("rejects another user's passkey", async () => {
    mocks.passkeyFindFirst.mockResolvedValue(null);

    const response = await POST(makeRequest());

    expect(response.status).toBe(403);

    expect(mocks.passkeyFindFirst)
      .toHaveBeenCalledWith({
        where: {
          id: "passkey-1",
          userId: "user-1",
        },
        select: {
          id: true,
          publicKey: true,
          counter: true,
        },
      });

    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("rejects invalid WebAuthn signatures", async () => {
    mocks.verify.mockRejectedValue(
      new Error("Invalid signature")
    );

    const response = await POST(makeRequest());

    expect(response.status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("rejects failed WebAuthn verification", async () => {
    mocks.verify.mockResolvedValue({
      verified: false,
    });

    const response = await POST(makeRequest());

    expect(response.status).toBe(403);
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("rejects expired sessions inside the transaction", async () => {
    mocks.sessionFindFirst.mockResolvedValue(null);

    const response = await POST(makeRequest());

    expect(response.status).toBe(401);
    expect(mocks.consumeChallenge)
      .not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("rejects already-consumed challenges", async () => {
    mocks.consumeChallenge.mockResolvedValue({
      count: 0,
    });

    const response = await POST(makeRequest());

    expect(response.status).toBe(403);
    expect(mocks.updateCounter)
      .not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("rejects concurrent credential changes", async () => {
    mocks.updateCounter.mockResolvedValue({
      count: 0,
    });

    const response = await POST(makeRequest());

    expect(response.status).toBe(409);
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("rejects concurrent account changes", async () => {
    mocks.deleteUser.mockResolvedValue({
      count: 0,
    });

    const response = await POST(makeRequest());

    expect(response.status).toBe(409);
  });

  it("handles serializable transaction conflicts", async () => {
    mocks.transaction.mockRejectedValue({
      code: "P2034",
    });

    const response = await POST(makeRequest());

    expect(response.status).toBe(409);
  });

  it("deletes the authenticated account after verification", async () => {
    const response = await POST(makeRequest());

    expect(response.status).toBe(200);

    expect(await response.json()).toEqual({
      success: true,
      message: "Account deleted successfully",
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
          type: "ACCOUNT_DELETION",
          userId: "user-1",
          sessionId: "session-1",
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

    expect(mocks.deleteUser)
      .toHaveBeenCalledWith({
        where: {
          id: "user-1",
        },
      });

    expect(mocks.transaction)
      .toHaveBeenCalledWith(
        expect.any(Function),
        {
          isolationLevel: "Serializable",
        }
      );

    const cookie = response.headers.get("set-cookie");

    expect(cookie).toContain(
      "privacy_auth_session="
    );

    expect(cookie).toContain("Max-Age=0");

    expect(response.headers.get("Cache-Control"))
      .toBe("no-store");
  });
});
