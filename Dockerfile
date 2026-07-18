# ============================================
# DG STOK V5.0 - Production Docker Build
# ============================================

FROM node:20-bookworm-slim

WORKDIR /app

# Install runtime system dependencies
RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends \
    curl \
    python3 \
    make \
    g++ \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json package-lock.json ./
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/
COPY prisma/ ./prisma/

# Install ALL dependencies
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Create non-root user
RUN groupadd -r appgroup && \
    useradd -r -g appgroup -d /app -s /sbin/nologin appuser && \
    chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:4000/health || exit 1

# Expose ports
EXPOSE 4000

# Start with tsx for ESM/TypeScript support
CMD ["npx", "tsx", "apps/server/src/index.ts"]
