-- TorobPay credit gateway (CPG).
-- Additive only: a new gateway value, and a nullable lookup column that
-- existing payments simply leave empty.
ALTER TYPE "PaymentGateway" ADD VALUE IF NOT EXISTS 'TOROBPAY';

ALTER TABLE "payments" ADD COLUMN "gateway_transaction_id" VARCHAR(100);

CREATE UNIQUE INDEX "payments_gateway_transaction_id_key" ON "payments"("gateway_transaction_id");
