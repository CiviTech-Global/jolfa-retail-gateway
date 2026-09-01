-- CreateTable
CREATE TABLE "request_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "method" VARCHAR(10) NOT NULL,
    "path" VARCHAR(500) NOT NULL,
    "query" JSONB,
    "status_code" INTEGER NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "user_id" UUID,
    "ip_address" VARCHAR(100),
    "user_agent" TEXT,
    "request_id" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" VARCHAR(50) NOT NULL,
    "user_id" UUID,
    "email_or_phone" VARCHAR(255),
    "ip_address" VARCHAR(100),
    "user_agent" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_gateway_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID,
    "payment_id" UUID,
    "gateway" VARCHAR(50) NOT NULL,
    "direction" VARCHAR(10) NOT NULL,
    "endpoint" VARCHAR(500),
    "payload" JSONB,
    "response_status" VARCHAR(50),
    "response_body" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_gateway_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletter_subscribers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "request_logs_created_at_idx" ON "request_logs"("created_at");

-- CreateIndex
CREATE INDEX "request_logs_status_code_idx" ON "request_logs"("status_code");

-- CreateIndex
CREATE INDEX "request_logs_path_idx" ON "request_logs"("path");

-- CreateIndex
CREATE INDEX "request_logs_user_id_idx" ON "request_logs"("user_id");

-- CreateIndex
CREATE INDEX "security_events_type_idx" ON "security_events"("type");

-- CreateIndex
CREATE INDEX "security_events_created_at_idx" ON "security_events"("created_at");

-- CreateIndex
CREATE INDEX "security_events_user_id_idx" ON "security_events"("user_id");

-- CreateIndex
CREATE INDEX "payment_gateway_logs_order_id_idx" ON "payment_gateway_logs"("order_id");

-- CreateIndex
CREATE INDEX "payment_gateway_logs_payment_id_idx" ON "payment_gateway_logs"("payment_id");

-- CreateIndex
CREATE INDEX "payment_gateway_logs_created_at_idx" ON "payment_gateway_logs"("created_at");

-- CreateIndex
CREATE INDEX "newsletter_subscribers_is_active_idx" ON "newsletter_subscribers"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscribers_email_key" ON "newsletter_subscribers"("email");
