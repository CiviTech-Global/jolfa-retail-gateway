-- AlterTable
ALTER TABLE "addresses" ADD COLUMN     "is_saved" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "addresses_user_id_is_saved_idx" ON "addresses"("user_id", "is_saved");
