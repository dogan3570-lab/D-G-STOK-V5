#!/bin/bash
# ============================================
# DG STOK V5.0 - VPS Production Deployment
# ============================================
# This script is meant to be run on the VPS
# after cloning the repository.
# ============================================

set -e

echo "========================================"
echo "  DG STOK V5.0 - VPS Deployment"
echo "========================================"
echo ""

# Configuration
DOMAIN="${DOMAIN:-dgstok.com}"
SSL_EMAIL="${SSL_EMAIL:-admin@dgstok.com}"
DB_PASSWORD="${DB_PASSWORD:-$(openssl rand -hex 32)}"
JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 64)}"
JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET:-$(openssl rand -hex 64)}"
REDIS_PASSWORD="${REDIS_PASSWORD:-$(openssl rand -hex 32)}"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}[1/6] System Update & Docker Installation${NC}"
apt update && apt upgrade -y
apt install -y curl wget git ufw

# Install Docker if not present
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    usermod -aG docker $USER
    echo -e "${GREEN}Docker installed successfully${NC}"
fi

# Install Docker Compose if not present
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null 2>&1; then
    apt install -y docker-compose-plugin
    echo -e "${GREEN}Docker Compose installed successfully${NC}"
fi

echo -e "${YELLOW}[2/6] Firewall Configuration${NC}"
ufw --force enable
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
echo -e "${GREEN}Firewall configured${NC}"

echo -e "${YELLOW}[3/6] Environment Configuration${NC}"
cat > .env << EOF
# Domain Configuration
DOMAIN=${DOMAIN}
SSL_EMAIL=${SSL_EMAIL}
FRONTEND_URL=https://${DOMAIN}

# Database
DB_PASSWORD=${DB_PASSWORD}
DB_USERNAME=postgres
DB_DATABASE=dg_store
DB_SSL=false

# JWT Secrets
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}

# Marketplace
MARKETPLACE_ENCRYPTION_SECRET=$(openssl rand -hex 32)

# Redis
REDIS_PASSWORD=${REDIS_PASSWORD}

# CORS
CORS_ORIGIN=https://${DOMAIN}
EOF

echo -e "${GREEN}Environment configured${NC}"

echo -e "${YELLOW}[4/6] SSL Certificate (Let's Encrypt)${NC}"
# Create ssl directory
mkdir -p ssl

# Check if certbot is installed
if ! command -v certbot &> /dev/null; then
    apt install -y certbot
fi

# Get SSL certificate
certbot certonly --standalone \
    -d ${DOMAIN} -d www.${DOMAIN} \
    --email ${SSL_EMAIL} \
    --agree-tos \
    --non-interactive

# Copy certificates to ssl directory
cp /etc/letsencrypt/live/${DOMAIN}/fullchain.pem ./ssl/
cp /etc/letsencrypt/live/${DOMAIN}/privkey.pem ./ssl/

echo -e "${GREEN}SSL certificates obtained${NC}"

echo -e "${YELLOW}[5/6] Building & Starting Containers${NC}"
docker compose build
docker compose up -d

echo -e "${GREEN}Containers are running${NC}"

echo -e "${YELLOW}[6/6] Running Database Migrations${NC}"
# Wait for backend to be healthy
sleep 10
docker compose exec -T backend npm run migration:run || true

echo ""
echo "========================================"
echo -e "${GREEN}  DG STOK V5.0 DEPLOYMENT COMPLETE${NC}"
echo "========================================"
echo ""
echo "  Website:  https://${DOMAIN}"
echo "  API:      https://${DOMAIN}/api"
echo "  Swagger:  https://${DOMAIN}/docs"
echo ""
echo "  Database: docker compose exec postgres psql -U postgres dg_store"
echo "  Logs:     docker compose logs -f"
echo ""
echo "========================================"
