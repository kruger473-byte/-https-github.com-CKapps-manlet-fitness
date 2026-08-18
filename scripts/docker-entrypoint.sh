#!/bin/sh
# Container entrypoint: bring the schema up to date, then serve.
set -e

if [ -d "prisma/migrations" ] && [ -n "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  echo "→ Applying migrations (prisma migrate deploy)"
  # Prisma takes an advisory lock, so parallel instance starts are safe.
  npx prisma migrate deploy
else
  echo "⚠  No committed migrations found in prisma/migrations."
  echo "   Falling back to 'prisma db push', which syncs the schema without a"
  echo "   migration history. Fine for a first run; generate migrations before"
  echo "   you have real members:"
  echo "     npx prisma migrate dev --name init"
  echo "   then commit prisma/migrations/ and redeploy."
  npx prisma db push --skip-generate --accept-data-loss
fi

exec node server.js
