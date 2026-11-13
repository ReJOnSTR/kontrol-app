# Stage 1: Build & Dependencies
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Install system dependencies needed for native compilation & Prisma
RUN apt-get update && apt-get install -y openssl ca-certificates python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

ENV USE_POSTGRES="true"

# Generate Prisma Client for PostgreSQL
RUN npx prisma generate --schema=./prisma/schema.pg.prisma

# Build Frontend Vite assets
RUN npx vite build

# Stage 2: Production Runner
FROM node:22-bookworm-slim AS runner

WORKDIR /app

RUN apt-get update && apt-get install -y openssl ca-certificates curl postgresql-client && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3000
ENV USE_POSTGRES="true"

# Copy pre-compiled node_modules from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/electron ./electron
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/package.json ./package.json

RUN mkdir -p /app/data/files /app/backups && chown -R node:node /app

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/api/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

CMD ["node", "server.js"]
