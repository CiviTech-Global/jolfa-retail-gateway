-- Session revocation for stateless JWTs.
-- Tokens embed the version they were issued at; bumping this column invalidates
-- every outstanding token for that user (logout, password change).
ALTER TABLE "users" ADD COLUMN "token_version" INTEGER NOT NULL DEFAULT 0;
