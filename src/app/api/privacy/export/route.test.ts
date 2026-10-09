
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
  findUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: mocks.findUnique,
    },
  },
}));

vi.mock("@/lib/session", () => ({
  SESSION_COOKIE_NAME: "privacy_auth_session",
  getSessionFromToken: mocks.getSessionFromToken,
}));

import { GET } from "./route";

function makeRequest(authenticated = true) {
  return new NextRequest(
    "http://localhost:3000/api/privacy/export",
    {
      method: "GET",
      headers: authenticated
        ? {
            Cookie:
              "privacy_auth_session=test-session",
          }
        : {},
    }
  );
}

describe("Account Data Export API", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    mocks.getSessionFromToken.mockResolvedValue({
      user: {
        id: "user-1",
      },
    });

    mocks.findUnique.mockResolvedValue({
      id: "user-1",
      createdAt: new Date("2026-10-01T00:00:00Z"),
      updatedAt: new Date("2026-10-02T00:00:00Z"),

      passkeys: [
        {
          id: "passkey-1",
          webauthnUserID: "user-handle",
          counter: BigInt(2),
          deviceType: "multiDevice",
          backedUp: true,
          transports: ["internal"],
          createdAt: new Date("2026-10-01T00:00:00Z"),
          publicKey: "never-export-this-key",
        },
      ],

      sessions: [
        {
          id: "session-1",
          createdAt: new Date("2026-10-01T00:00:00Z"),
          expiresAt: new Date("2026-10-10T00:00:00Z"),
          tokenHash: "secret-token-hash",
        },
      ],

      challenges: [
        {
          type: "REGISTRATION",
          createdAt: new Date("2026-10-01T00:00:00Z"),
          expiresAt: new Date("2026-10-01T00:05:00Z"),
          challenge: "secret-challenge-value",
        },
      ],
    });
  });

  it("rejects unauthenticated requests", async () => {
    const response = await GET(makeRequest(false));

    expect(response.status).toBe(401);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("rejects invalid or expired sessions", async () => {
    mocks.getSessionFromToken.mockResolvedValue(null);

    const response = await GET(makeRequest());

    expect(response.status).toBe(401);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("exports only the authenticated user's data", async () => {
    const response = await GET(makeRequest());

    expect(response.status).toBe(200);

    expect(mocks.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "user-1",
        },
      })
    );

    const data = await response.json();

    expect(data.account.id).toBe("user-1");
    expect(data.passkeys).toHaveLength(1);
    expect(data.passkeys[0].counter).toBe("2");
    expect(data.sessions).toHaveLength(1);
    expect(data.temporaryChallenges).toHaveLength(1);
  });

  it("does not expose authentication secrets", async () => {
    const response = await GET(makeRequest());
    const data = await response.json();
    const exported = JSON.stringify(data);

    expect(exported).not.toContain(
      "never-export-this-key"
    );
    expect(exported).not.toContain(
      "secret-token-hash"
    );
    expect(exported).not.toContain(
      "secret-challenge-value"
    );

    expect(data.passkeys[0]).not.toHaveProperty(
      "publicKey"
    );
    expect(data.sessions[0]).not.toHaveProperty(
      "tokenHash"
    );
  });

  it("returns a non-cacheable JSON download", async () => {
    const response = await GET(makeRequest());

    expect(response.status).toBe(200);

    expect(
      response.headers.get("Content-Disposition")
    ).toContain("privacy-auth-data.json");

    expect(response.headers.get("Cache-Control"))
      .toContain("no-store");
  });

  it("handles deleted or missing accounts", async () => {
    mocks.findUnique.mockResolvedValue(null);

    const response = await GET(makeRequest());

    expect(response.status).toBe(404);
  });
});
