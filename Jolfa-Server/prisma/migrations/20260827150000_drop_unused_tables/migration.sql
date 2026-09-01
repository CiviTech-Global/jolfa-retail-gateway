-- Remove five tables that were defined but never written to by any code path.
--
--   carts / cart_items      the cart is client-side (localStorage); no server
--                           route ever read or wrote these
--   request_logs            superseded by structured Pino request logging
--   security_events         never implemented
--   newsletter_subscribers  the newsletter signup was removed from the UI
--
-- They were misleading: a reader of the schema would reasonably conclude the
-- application had server-side carts and security auditing when it has neither.
-- Verified empty before dropping; taken pre-launch, so no production data is at
-- risk. cart_items is dropped first because it references carts.
DROP TABLE IF EXISTS "cart_items";
DROP TABLE IF EXISTS "carts";
DROP TABLE IF EXISTS "request_logs";
DROP TABLE IF EXISTS "security_events";
DROP TABLE IF EXISTS "newsletter_subscribers";
