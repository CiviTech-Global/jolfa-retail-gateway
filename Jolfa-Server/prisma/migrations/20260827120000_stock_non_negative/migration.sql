-- Defence in depth for the oversell race fixed in order.service.ts.
-- The application now checks the post-decrement value returned by UPDATE, but a
-- future caller that forgets to would silently drive stock negative. Postgres
-- refuses instead, turning a data-corruption bug into a failed transaction.
ALTER TABLE "products"
  ADD CONSTRAINT "products_stock_quantity_non_negative"
  CHECK ("stock_quantity" >= 0);
