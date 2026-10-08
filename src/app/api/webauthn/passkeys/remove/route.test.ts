
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { NextRequest } from "next/server";

// Mock all database and session operations.
const mocks = vi.hoisted(() => ({
  getSessionFromToken: vi.fn(),
  transaction: vi.fn(),
  findFirst: vi.fn(),
  count: vi.fn(),
  deleteMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/session", () => ({
  SESSION_COOKIE_NAME: "privacy_auth_session",
  getSessionFromToken: mocks.getSessionFromToken,
}));

import { POST } from "./route";

// Create a fake API request.
function makeRequest(authenticated = false) {
  return new NextRequest(
    "http://localhost:3000/api/webauthn/passkeys/remove",
    {
      method: "POST",
      headers: {
        Origin: "http://localhost:3000",
        "Content-Type": "application/json",
        ...(authenticated
          ? { Cookie: "privacy_auth_session=fake-token" }
          : {}),
      },
      body: JSON.stringify({
        passkeyId: "fake-passkey-id",
      }),
    }
  );
}

describe("Remove Passkey API", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    // Use an in-memory fake transaction.
    mocks.transaction.mockImplementation(
      async (callback) =>
        callback({
          passkey: {
            findFirst: mocks.findFirst,
            count: mocks.count,
            deleteMany: mocks.deleteMany,
          },
        })
    );
  });

  it("rejects unauthenticated users", async () => {
    const response = await POST(makeRequest());

    expect(response.status).toBe(401);

    expect(await response.json()).toEqual({
      error: "Not authenticated",
    });

    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("protects the last remaining passkey", async () => {
    // Pretend the user recently signed in.
    mocks.getSessionFromToken.mockResolvedValue({
      user: {
        id: "fake-user-id",
      },
      createdAt: new Date(),
    });

    // Pretend the requested passkey belongs to the user.
    mocks.findFirst.mockResolvedValue({
      id: "fake-passkey-id",
    });

    // The user has only ONE passkey.
    mocks.count.mockResolvedValue(1);

    const response = await POST(makeRequest(true));

    expect(response.status).toBe(409);

    const data = await response.json();

    expect(data.error).toContain(
      "You cannot remove your last passkey"
    );

    // Most important security assertion:
    // No deletion should happen.
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it("prevents removal of another user's passkey", async () => {
    mocks.getSessionFromToken.mockResolvedValue({
      user: { id: "fake-user-id" },
      createdAt: new Date(),
    });

    // No matching passkey belongs to this user.
    mocks.findFirst.mockResolvedValue(null);

    const response = await POST(makeRequest(true));

    expect(response.status).toBe(404);

    expect(await response.json()).toEqual({
      error: "Passkey not found",
    });

    expect(mocks.count).not.toHaveBeenCalled();
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it("removes an owned passkey when multiple exist", async () => {
    mocks.getSessionFromToken.mockResolvedValue({
      user: { id: "fake-user-id" },
      createdAt: new Date(),
    });

    mocks.findFirst.mockResolvedValue({
      id: "fake-passkey-id",
    });

    // The user has two registered passkeys.
    mocks.count.mockResolvedValue(2);

    // Simulate successful deletion.
    mocks.deleteMany.mockResolvedValue({
      count: 1,
    });

    const response = await POST(makeRequest(true));

    expect(response.status).toBe(200);

    expect(await response.json()).toEqual({
      success: true,
      message: "Passkey removed successfully",
    });

    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: {
        id: "fake-passkey-id",
        userId: "fake-user-id",
      },
    });
  });

  it("rejects sessions older than 5 minutes", async () => {
    // Simulate a session created 6 minutes ago.
    mocks.getSessionFromToken.mockResolvedValue({
      user: {
        id: "fake-user-id",
      },
      createdAt: new Date(
        Date.now() - 6 * 60 * 1000
      ),
    });

    const response = await POST(makeRequest(true));

    // An old session must not be allowed
    // to remove a passkey.
    expect(response.status).toBe(403);

    expect(await response.json()).toEqual({
      error:
        "Please sign in again before removing a passkey",
    });

    // No database modification should occur.
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it("rejects requests from another origin", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/webauthn/passkeys/remove",
      {
        method: "POST",
        headers: {
          Origin: "https://example.com",
          "Content-Type": "application/json",
          Cookie: "privacy_auth_session=fake-token",
        },
        body: JSON.stringify({
          passkeyId: "fake-passkey-id",
        }),
      }
    );

    const response = await POST(request);

    expect(response.status).toBe(403);

    expect(await response.json()).toEqual({
      error: "Invalid request origin",
    });

    // Reject before session lookup or database access.
    expect(
      mocks.getSessionFromToken
    ).not.toHaveBeenCalled();

    expect(
      mocks.transaction
    ).not.toHaveBeenCalled();

    expect(
      mocks.deleteMany
    ).not.toHaveBeenCalled();
  });

});
