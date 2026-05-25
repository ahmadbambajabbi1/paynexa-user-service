-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "countryCode" TEXT;
ALTER TABLE "User" ADD COLUMN "fullName" TEXT;
