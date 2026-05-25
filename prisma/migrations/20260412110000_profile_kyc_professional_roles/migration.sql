-- CreateEnum
CREATE TYPE "KycKind" AS ENUM ('PERSONAL', 'LAWYER', 'AGENT', 'VERIFIER');

-- CreateEnum
CREATE TYPE "ProfessionalRole" AS ENUM ('LAWYER', 'AGENT', 'VERIFIER');

-- CreateEnum
CREATE TYPE "ProfessionalRoleApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "ProfessionalRoleApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ProfessionalRole" NOT NULL,
    "status" "ProfessionalRoleApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfessionalRoleApplication_pkey" PRIMARY KEY ("id")
);

-- AlterTable User
ALTER TABLE "User" ADD COLUMN     "disabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN     "displayName" TEXT;
ALTER TABLE "User" ADD COLUMN     "profileCompletedAt" TIMESTAMP(3);

-- AlterTable KycDocument
ALTER TABLE "KycDocument" ADD COLUMN     "kind" "KycKind" NOT NULL DEFAULT 'PERSONAL';
ALTER TABLE "KycDocument" ADD COLUMN     "professionalApplicationId" TEXT;

-- AddForeignKey
ALTER TABLE "ProfessionalRoleApplication" ADD CONSTRAINT "ProfessionalRoleApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KycDocument" ADD CONSTRAINT "KycDocument_professionalApplicationId_fkey" FOREIGN KEY ("professionalApplicationId") REFERENCES "ProfessionalRoleApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Migrate existing single-role users into professional applications (buyer/seller rows are dropped with the column)
INSERT INTO "ProfessionalRoleApplication" ("id", "userId", "role", "status", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    u."id",
    CASE u."role"::text
        WHEN 'LAWYER' THEN 'LAWYER'::"ProfessionalRole"
        WHEN 'AGENT' THEN 'AGENT'::"ProfessionalRole"
        WHEN 'VERIFIER' THEN 'VERIFIER'::"ProfessionalRole"
    END,
    'APPROVED'::"ProfessionalRoleApplicationStatus",
    u."createdAt",
    CURRENT_TIMESTAMP
FROM "User" u
WHERE u."role"::text IN ('LAWYER', 'AGENT', 'VERIFIER');

-- Drop old role column and enum
ALTER TABLE "User" DROP COLUMN "role";
DROP TYPE "UserRole";

-- CreateIndex
CREATE INDEX "KycDocument_userId_kind_idx" ON "KycDocument"("userId", "kind");

CREATE INDEX "ProfessionalRoleApplication_userId_role_idx" ON "ProfessionalRoleApplication"("userId", "role");
