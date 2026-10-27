-- Optional warranty text per product, shown on the storefront and sent to Torob.
ALTER TABLE "products" ADD COLUMN "guarantee" VARCHAR(200);
