#!/usr/bin/env bash
set -euo pipefail

# Jolfa Retail Gateway — VPS deployment script
# Usage: ./scripts/deploy.sh [environment]
# Default environment: production

ENV=${1:-production}
APP_DIR="/var/www/jolfa-retail-gateway"
BACKEND_DIR="$APP_DIR/Jolfa-Server"
FRONTEND_DIR="$APP_DIR/Jolfa-web"

echo "🚀 Deploying Jolfa Retail Gateway ($ENV)..."

# The frontend's API URL is inlined into the bundle at build time, so a missing
# value is not a runtime misconfiguration that can be corrected later — it
# produces a build that is permanently pointed at localhost and fails in every
# visitor's browser. Vite reads it from .env.production or the environment;
# check for both before doing any work.
if [ ! -f "$FRONTEND_DIR/.env.production" ] && [ -z "${VITE_API_BASE_URL:-}" ]; then
  echo "❌ No $FRONTEND_DIR/.env.production and VITE_API_BASE_URL is unset." >&2
  echo "   The frontend would be built against its localhost fallback and would" >&2
  echo "   fail for every visitor. Create the file (see Jolfa-web/.env.example):" >&2
  echo "     echo 'VITE_API_BASE_URL=https://your-domain.ir/api/v1' > $FRONTEND_DIR/.env.production" >&2
  exit 1
fi

cd "$APP_DIR"

echo "📥 Pulling latest code..."
git pull origin main

echo "🔧 Installing backend dependencies..."
cd "$BACKEND_DIR"
npm ci

# Regenerate the Prisma client before compiling: `tsc` typechecks against it,
# so a schema change would otherwise fail the build against a stale client.
echo "⚙️  Generating Prisma client..."
npx prisma generate

# Compile before migrating. A TypeScript error must abort the deploy while the
# database is still untouched — migrating first would leave the schema advanced
# past the code that is actually running.
echo "🏗️  Building backend..."
npm run build

echo "🗄️  Applying database migrations..."
npx prisma migrate deploy

echo "🏗️  Building frontend..."
cd "$FRONTEND_DIR"
npm ci
npm run build

echo "🔄 Restarting backend via PM2..."
cd "$BACKEND_DIR"
pm2 reload jolfa-api --update-env || pm2 start dist/index.js --name jolfa-api
pm2 save

echo "🌐 Reloading Nginx..."
sudo nginx -t && sudo systemctl reload nginx

echo "✅ Deployment complete."
