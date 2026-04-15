FROM node:20-alpine AS builder
RUN corepack enable

WORKDIR /app

# Copy workspace manifests first for layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/

# Install backend deps only
RUN pnpm install --frozen-lockfile --filter=backend

# Build
COPY apps/backend ./apps/backend
RUN pnpm --filter backend build

# Create a self-contained deployment bundle (flattens pnpm symlinks)
RUN pnpm --filter backend deploy --prod --legacy /deploy

# ── runner ────────────────────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

COPY --from=builder /deploy/node_modules ./node_modules
COPY --from=builder /app/apps/backend/dist ./dist

EXPOSE 3001
CMD ["node", "dist/main"]
