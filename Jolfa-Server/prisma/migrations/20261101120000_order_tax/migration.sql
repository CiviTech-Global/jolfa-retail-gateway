-- The tax charged on each order, kept with the order: the shop can change or
-- switch off its VAT later without rewriting what past customers were charged.
ALTER TABLE "orders"
  ADD COLUMN "tax_amount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "tax_label" VARCHAR(100),
  ADD COLUMN "tax_basis_points" INTEGER NOT NULL DEFAULT 0;
