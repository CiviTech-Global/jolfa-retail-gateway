-- Packaging and پس‌کرایه fees charged on each order, kept with the order: the
-- shop can rename, change or switch off a fee later without rewriting what past
-- customers were charged.
ALTER TABLE "orders"
  ADD COLUMN "packaging_fee" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "packaging_fee_label" VARCHAR(100),
  ADD COLUMN "collect_freight_fee" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "collect_freight_fee_label" VARCHAR(100);
