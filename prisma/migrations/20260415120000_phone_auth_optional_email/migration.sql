-- Phone-first auth: email optional; enforce unique phone when set.
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_key" ON "User"("phone");

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "pinHash" TEXT;
