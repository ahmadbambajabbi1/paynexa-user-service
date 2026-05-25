-- CreateEnum
CREATE TYPE "PersonalKycStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "personalKycStatus" "PersonalKycStatus" NOT NULL DEFAULT 'NONE';
ALTER TABLE "User" ADD COLUMN "personalKycVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "personalKycRejectedReason" TEXT;
ALTER TABLE "User" ADD COLUMN "personalKycPendingSince" TIMESTAMP(3);

-- Anyone already marked approved stays approved (admin workflow uses status + timestamp).
UPDATE "User"
SET
  "personalKycStatus" = 'APPROVED',
  "personalKycVersion" = GREATEST("personalKycVersion", 1)
WHERE
  "personalKycApprovedAt" IS NOT NULL;
