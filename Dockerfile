# ============================================
# DG STOK V5.0 - Production Docker Build
# ============================================

FROM node:20-alpine

WORKDIR /app

# Install runtime system dependencies
RUN apk add --no-cache tini curl python3 make g++

# Copy package files
COPY package.json package-lock.json ./
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/
COPY prisma/ ./prisma/

# Install ALL dependencies (tsx needed for production runtime)
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build web frontend
RUN cd apps/web && npx vite build

# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup && \
    chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:4000/health || exit 1

# Expose ports
EXPOSE 4000

# Use tini as init
ENTRYPOINT ["/sbin/tini", "--"]

# Start with tsx for ESM/TypeScript support
CMD ["npx", "tsx", "apps/server/src/index.ts"]
