-- AlterTable
-- IF NOT EXISTS: safe when column was added earlier via `prisma db push`.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "personalKycApprovedAt" TIMESTAMP(3);
