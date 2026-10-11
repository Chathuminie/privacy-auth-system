
import "dotenv/config";

import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import { prisma } from "../../lib/prisma";

// Only run this test when explicitly requested.
// Normal unit-test runs will skip it.
const runDatabaseTests =
  process.env.RUN_DB_INTEGRATION_TESTS === "1";

describe.skipIf(!runDatabaseTests)(
  "PostgreSQL Registration Transaction Integration",
  () => {
    it(
      "rolls back both user and challenge after failure",
      async () => {
        // Refuse to run against remote or production databases.
        const databaseUrl = process.env.DATABASE_URL;

        if (!databaseUrl) {
          throw new Error("DATABASE_URL is missing");
        }

        const parsedUrl = new URL(databaseUrl);

        const allowedHosts = [
          "localhost",
          "127.0.0.1",
          "[::1]",
        ];

        if (
          !allowedHosts.includes(parsedUrl.hostname) ||
          process.env.NODE_ENV === "production"
        ) {
          throw new Error(
            "Integration tests require a local development database",
          );
        }

        const testChallenge =
          `rollback-test-${randomUUID()}`;

        let createdUserId: string | undefined;

        try {
          // Use an actual PostgreSQL transaction.
          await expect(
            prisma.$transaction(
              async (tx) => {
                // Create a temporary user.
                const user = await tx.user.create({
                  data: {},
                });

                createdUserId = user.id;

                // Create a registration challenge.
                await tx.webAuthnChallenge.create({
                  data: {
                    challenge: testChallenge,
                    type: "REGISTRATION",
                    userId: user.id,
                    expiresAt: new Date(
                      Date.now() + 5 * 60 * 1000,
                    ),
                  },
                });

                // Simulate a failure after both writes.
                throw new Error(
                  "INTENTIONAL_REGISTRATION_FAILURE",
                );
              },
              {
                isolationLevel: "Serializable",
              },
            ),
          ).rejects.toThrow(
            "INTENTIONAL_REGISTRATION_FAILURE",
          );

          expect(createdUserId).toBeDefined();

          // Neither record should exist after rollback.
          const [user, challenge] = await Promise.all([
            prisma.user.findUnique({
              where: {
                id: createdUserId!,
              },
            }),
            prisma.webAuthnChallenge.findUnique({
              where: {
                challenge: testChallenge,
              },
            }),
          ]);

          expect(user).toBeNull();
          expect(challenge).toBeNull();
        } finally {
          // Defensive cleanup:
          // Only target the disposable user created
          // by this test, never existing accounts.
          if (createdUserId) {
            await prisma.user.deleteMany({
              where: {
                id: createdUserId,
              },
            });
          }
        }
      },
    );
  },
);
