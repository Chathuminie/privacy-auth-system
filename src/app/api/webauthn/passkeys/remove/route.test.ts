
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { NextRequest } from "next/server";

// Mock authentication, database, and transaction operations.
const mocks = vi.hoisted(() => ({
  getSessionFromToken: vi.fn(),
  verifyAuthenticationResponse: vi.fn(),

  challengeFindFirst: vi.fn(),
  challengeDeleteMany: vi.fn(),

  passkeyFindFirst: vi.fn(),
  targetFindFirst: vi.fn(),
  count: vi.fn(),
  updateMany: vi.fn(),
  deleteMany: vi.fn(),

  transaction: vi.fn(),
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

vi.mock("@/lib/session", () => ({
  SESSION_COOKIE_NAME: "privacy_auth_session",
  getSessionFromToken: mocks.getSessionFromToken,
}));

vi.mock("@simplewebauthn/server", () => ({
  verifyAuthenticationResponse:
    mocks.verifyAuthenticationResponse,
}));

import { POST } from "./route";

const API_URL =
  "http://localhost:3000/api/webauthn/passkeys/remove";

const validBody = {
  passkeyId: "target-passkey",
  challengeId: "challenge-1",
  response: {
    id: "verifying-passkey",
    rawId: "verifying-passkey",
    type: "public-key",
    response: {
      authenticatorData: "fake-auth-data",
      clientDataJSON: "fake-client-data",
      signature: "fake-signature",
      userHandle: null,
    },
  },
};

function makeRequest({
  authenticated = true,
  origin = "http://localhost:3000",
  body = validBody,
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
              "privacy_auth_session=fake-token",
          }
        : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("Secure Remove Passkey API", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    // Valid authenticated session.
    mocks.getSessionFromToken.mockResolvedValue({
      id: "session-1",
      user: {
        id: "user-1",
      },
      createdAt: new Date(
        Date.now() - 60 * 60 * 1000
      ),
    });

    // Valid, unexpired removal challenge.
    mocks.challengeFindFirst.mockResolvedValue({
      id: "challenge-1",
      challenge: "signed-challenge",
      type: "PASSKEY_REMOVAL",
      userId: "user-1",
      sessionId: "session-1",
      targetPasskeyId: "target-passkey",
      expiresAt: new Date(
        Date.now() + 60_000
      ),
    });

    // Credential used to prove the user's identity.
    mocks.passkeyFindFirst.mockResolvedValue({
      id: "verifying-passkey",
      userId: "user-1",
      publicKey: new Uint8Array([1, 2, 3]),
      counter: BigInt(1),
    });

    // Mock a successful cryptographic verification.
    mocks.verifyAuthenticationResponse.mockResolvedValue({
      verified: true,
      authenticationInfo: {
        newCounter: 2,
      },
    });

    // Target passkey belongs to this user.
    mocks.targetFindFirst.mockResolvedValue({
      id: "target-passkey",
    });

    // Two passkeys exist, so removal is permitted.
    mocks.count.mockResolvedValue(2);

    // Simulate successful database operations.
    mocks.challengeDeleteMany.mockResolvedValue({
      count: 1,
    });

    mocks.updateMany.mockResolvedValue({
      count: 1,
    });

    mocks.deleteMany.mockResolvedValue({
      count: 1,
    });

    // Fake Prisma transaction client.
    const tx = {
      webAuthnChallenge: {
        deleteMany: mocks.challengeDeleteMany,
      },
      passkey: {
        findFirst: mocks.targetFindFirst,
        count: mocks.count,
        updateMany: mocks.updateMany,
        deleteMany: mocks.deleteMany,
      },
    };

    mocks.transaction.mockImplementation(
      async (
        callback: (client: typeof tx) => Promise<unknown>
      ) => callback(tx)
    );
  });

  it("1. Rejects unauthenticated users", async () => {
    const response = await POST(
      makeRequest({ authenticated: false })
    );

    expect(response.status).toBe(401);

    expect(await response.json()).toEqual({
      error: "Not authenticated",
    });

    expect(
      mocks.verifyAuthenticationResponse
    ).not.toHaveBeenCalled();

    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("2. Rejects invalid or expired sessions", async () => {
    mocks.getSessionFromToken.mockResolvedValue(null);

    const response = await POST(makeRequest());

    expect(response.status).toBe(401);

    expect(
      mocks.verifyAuthenticationResponse
    ).not.toHaveBeenCalled();

    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("3. Rejects requests from another origin", async () => {
    const response = await POST(
      makeRequest({
        origin: "https://example.com",
      })
    );

    expect(response.status).toBe(403);

    expect(await response.json()).toEqual({
      error: "Invalid request origin",
    });

    expect(
      mocks.getSessionFromToken
    ).not.toHaveBeenCalled();

    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("4. Requires fresh WebAuthn authentication", async () => {
    const response = await POST(
      makeRequest({
        body: {
          passkeyId: "target-passkey",
        },
      })
    );

    expect(response.status).toBe(403);

    expect(await response.json()).toEqual({
      error: "Fresh passkey verification is required",
    });

    expect(
      mocks.verifyAuthenticationResponse
    ).not.toHaveBeenCalled();

    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it("5. Rejects invalid or expired removal challenges", async () => {
    mocks.challengeFindFirst.mockResolvedValue(null);

    const response = await POST(makeRequest());

    expect(response.status).toBe(403);

    expect(await response.json()).toEqual({
      error: "Removal challenge invalid or expired",
    });

    // The challenge lookup must bind every identity.
    expect(mocks.challengeFindFirst).toHaveBeenCalledWith({
      where: {
        id: "challenge-1",
        type: "PASSKEY_REMOVAL",
        userId: "user-1",
        sessionId: "session-1",
        targetPasskeyId: "target-passkey",
        expiresAt: {
          gt: expect.any(Date),
        },
      },
    });

    expect(
      mocks.verifyAuthenticationResponse
    ).not.toHaveBeenCalled();

    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it("6. Rejects another user's verification passkey", async () => {
    mocks.passkeyFindFirst.mockResolvedValue(null);

    const response = await POST(makeRequest());

    expect(response.status).toBe(403);

    expect(mocks.passkeyFindFirst).toHaveBeenCalledWith({
      where: {
        id: "verifying-passkey",
        userId: "user-1",
      },
      select: {
        id: true,
        publicKey: true,
        counter: true,
      },
    });

    expect(
      mocks.verifyAuthenticationResponse
    ).not.toHaveBeenCalled();

    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it("7. Rejects failed WebAuthn verification", async () => {
    mocks.verifyAuthenticationResponse.mockResolvedValue({
      verified: false,
    });

    const response = await POST(makeRequest());

    expect(response.status).toBe(403);

    expect(await response.json()).toEqual({
      error: "Passkey verification failed",
    });

    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it("8. Rejects invalid WebAuthn signatures", async () => {
    mocks.verifyAuthenticationResponse.mockRejectedValue(
      new Error("Invalid signature")
    );

    const response = await POST(makeRequest());

    expect(response.status).toBe(403);

    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it("9. Protects the last remaining passkey", async () => {
    mocks.count.mockResolvedValue(1);

    const response = await POST(makeRequest());

    expect(response.status).toBe(409);

    expect((await response.json()).error).toContain(
      "You cannot remove your last passkey"
    );

    expect(
      mocks.challengeDeleteMany
    ).not.toHaveBeenCalled();

    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it("10. Prevents removal of another user's passkey", async () => {
    mocks.targetFindFirst.mockResolvedValue(null);

    const response = await POST(makeRequest());

    expect(response.status).toBe(404);

    expect(await response.json()).toEqual({
      error: "Passkey not found",
    });

    expect(mocks.targetFindFirst).toHaveBeenCalledWith({
      where: {
        id: "target-passkey",
        userId: "user-1",
      },
      select: {
        id: true,
      },
    });

    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it("11. Rejects an already-consumed challenge", async () => {
    mocks.challengeDeleteMany.mockResolvedValue({
      count: 0,
    });

    const response = await POST(makeRequest());

    expect(response.status).toBe(403);

    expect(await response.json()).toEqual({
      error: "Removal challenge expired or already used",
    });

    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it("12. Removes a passkey after fresh verification", async () => {
    const response = await POST(makeRequest());

    expect(response.status).toBe(200);

    expect(await response.json()).toEqual({
      success: true,
      message: "Passkey removed successfully",
    });

    // Ensure the stored challenge and credential
    // were supplied to the verification library.
    expect(
      mocks.verifyAuthenticationResponse
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedChallenge: "signed-challenge",
        expectedOrigin: "http://localhost:3000",
        expectedRPID: "localhost",
        requireUserVerification: true,
        credential: expect.objectContaining({
          id: "verifying-passkey",
          counter: 1,
        }),
      })
    );

    // The challenge must be consumed.
    expect(mocks.challengeDeleteMany).toHaveBeenCalledWith({
      where: {
        id: "challenge-1",
        challenge: "signed-challenge",
        type: "PASSKEY_REMOVAL",
        userId: "user-1",
        sessionId: "session-1",
        targetPasskeyId: "target-passkey",
        expiresAt: {
          gt: expect.any(Date),
        },
      },
    });

    // Persist the updated authenticator counter.
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: {
        id: "verifying-passkey",
        userId: "user-1",
        counter: BigInt(1),
      },
      data: {
        counter: BigInt(2),
      },
    });

    // Delete only the requested, owned passkey.
    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: {
        id: "target-passkey",
        userId: "user-1",
      },
    });

    // All database changes use a serializable transaction.
    expect(mocks.transaction).toHaveBeenCalledWith(
      expect.any(Function),
      {
        isolationLevel: "Serializable",
      }
    );
  });
});
