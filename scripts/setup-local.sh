#!/usr/bin/env bash
set -euo pipefail

# Jolfa Retail Gateway — local setup script

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "🛠️  Setting up Jolfa Retail Gateway locally..."

cd "$ROOT_DIR"

echo "📦 Installing backend dependencies..."
cd "$ROOT_DIR/Jolfa-Server"
npm install

echo "🔑 Make sure Jolfa-Server/.env is configured with your DATABASE_URL"
if [ ! -f "$ROOT_DIR/Jolfa-Server/.env" ]; then
  cp "$ROOT_DIR/Jolfa-Server/.env.example" "$ROOT_DIR/Jolfa-Server/.env"
  echo "⚠️  Created .env from example. Please edit it with your database password."
fi

echo "🗄️  Running database migrations..."
npx prisma migrate dev

echo "🌱 Seeding database..."
npx prisma db seed

echo "📦 Installing frontend dependencies..."
cd "$ROOT_DIR/Jolfa-web"
npm install

echo "✅ Setup complete. Run the servers with:"
echo "  cd Jolfa-Server && npm run dev"
echo "  cd Jolfa-web && npm run dev"
