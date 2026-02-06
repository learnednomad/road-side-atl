# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# Stage 2: Build the application
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js bakes NEXT_PUBLIC_* vars at build time.
# Provide defaults so the build succeeds; override at runtime via docker-compose.
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=""
ARG NEXT_PUBLIC_CASHAPP_TAG=""
ARG NEXT_PUBLIC_ZELLE_INFO=""
ARG NEXT_PUBLIC_BUSINESS_PHONE=""
ARG NEXT_PUBLIC_BUSINESS_NAME=""
ARG NEXT_PUBLIC_MAGIC_LINK_ENABLED=""
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=""

# Dummy DATABASE_URL so drizzle schema import doesn't crash during build
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"

# Build Next.js application
RUN npm run build

# Compile the custom server for production
RUN npx tsc server-custom.ts --outDir dist --esModuleInterop --module commonjs --target ES2020 --skipLibCheck || true

# Stage 3: Production runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install production dependencies only
RUN apk add --no-cache libc6-compat

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy Next.js standalone output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy database schema, migrations, and seed for drizzle-kit
COPY --from=builder --chown=nextjs:nodejs /app/db ./db
COPY --from=builder --chown=nextjs:nodejs /app/drizzle.config.ts ./drizzle.config.ts

# Copy WebSocket server files
COPY --from=builder --chown=nextjs:nodejs /app/server ./server
COPY --from=builder --chown=nextjs:nodejs /app/lib ./lib

# Copy package files for runtime dependencies
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json

# Copy node_modules for runtime (needed for drizzle-kit and tsx)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

# Copy and setup entrypoint script
COPY --from=builder --chown=nextjs:nodejs /app/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/services || exit 1

CMD ["./docker-entrypoint.sh"]
