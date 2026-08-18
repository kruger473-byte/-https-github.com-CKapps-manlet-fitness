# syntax=docker/dockerfile:1

# Multi-stage build producing a small runtime image. Use this for any host that
# takes a container: Fly.io, Railway, Render, Cloud Run, or your own VPS.

# --- deps --------------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# --- build -------------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app
ENV DOCKER_BUILD=1
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# A DATABASE_URL must parse for `prisma generate` to run; the real one is
# supplied at runtime and nothing connects during the build.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npm run build

# --- runtime -----------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma CLI, schema and engines, so migrations can run from this image.
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/.bin ./node_modules/.bin
COPY --from=builder --chown=nextjs:nodejs /app/scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh

USER nextjs
EXPOSE 3000

CMD ["sh", "./scripts/docker-entrypoint.sh"]
