-- AlterTable
ALTER TABLE "UserDevice" ADD COLUMN "fcmToken" TEXT;
ALTER TABLE "UserDevice" ADD COLUMN "fcmPlatform" TEXT;

-- CreateIndex
CREATE INDEX "UserDevice_userId_fcmToken_idx" ON "UserDevice"("userId", "fcmToken");
