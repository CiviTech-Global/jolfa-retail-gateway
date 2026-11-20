-- Discount codes: defined by the shop owner, typed by customers at checkout.
-- Additive only. Existing orders keep discount_code NULL.
CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'FIXED');

CREATE TABLE "discount_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(50) NOT NULL,
    "description" VARCHAR(200),
    "type" "DiscountType" NOT NULL,
    "value" INTEGER NOT NULL,
    "max_discount_amount" INTEGER,
    "min_order_amount" INTEGER NOT NULL DEFAULT 0,
    "starts_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "usage_limit" INTEGER,
    "per_user_limit" INTEGER DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "discount_codes_pkey" PRIMARY KEY ("id"),
    -- The service validates these too; the database is the last line, so a
    -- direct edit cannot produce a code that adds money to an order.
    CONSTRAINT "discount_codes_value_positive" CHECK ("value" > 0),
    CONSTRAINT "discount_codes_percent_range" CHECK ("type" <> 'PERCENT' OR "value" <= 100)
);

CREATE UNIQUE INDEX "discount_codes_code_key" ON "discount_codes"("code");
CREATE INDEX "discount_codes_is_active_idx" ON "discount_codes"("is_active");

ALTER TABLE "orders" ADD COLUMN "discount_code" VARCHAR(50),
ADD COLUMN "discount_code_id" UUID;

CREATE INDEX "orders_discount_code_id_idx" ON "orders"("discount_code_id");

ALTER TABLE "orders" ADD CONSTRAINT "orders_discount_code_id_fkey" FOREIGN KEY ("discount_code_id") REFERENCES "discount_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
