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

cd "$APP_DIR"

echo "📥 Pulling latest code..."
git pull origin main

echo "🔧 Installing backend dependencies..."
cd "$BACKEND_DIR"
npm ci

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
