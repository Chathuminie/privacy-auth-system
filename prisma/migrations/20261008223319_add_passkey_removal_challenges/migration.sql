-- AlterEnum
ALTER TYPE "WebAuthnChallengeType" ADD VALUE 'PASSKEY_REMOVAL';

-- AlterTable
ALTER TABLE "WebAuthnChallenge" ADD COLUMN     "sessionId" TEXT,
ADD COLUMN     "targetPasskeyId" TEXT;

-- CreateIndex
CREATE INDEX "WebAuthnChallenge_sessionId_idx" ON "WebAuthnChallenge"("sessionId");
