# ==========================================
# Stage 1: Build Frontend Assets
# ==========================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

RUN apk update && apk upgrade --no-cache

COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund

COPY frontend/ ./
RUN npm run build

# ==========================================
# Stage 2: Build Backend TypeScript
# ==========================================
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend

RUN apk update && apk upgrade --no-cache

COPY backend/package*.json ./
RUN npm ci --no-audit --no-fund

COPY backend/ ./
RUN npm run build

# ==========================================
# Stage 3: Prepare Trivy Security Engine & Plugins
# ==========================================
FROM alpine:3.21 AS trivy-builder
WORKDIR /tmp
ARG TARGETARCH

RUN apk update && apk upgrade --no-cache \
    && apk add --no-cache curl git ca-certificates \
    && mkdir -p /usr/local/bin /root/.trivy \
    && if [ "$TARGETARCH" = "arm64" ] || [ "$(uname -m)" = "aarch64" ] || [ "$(uname -m)" = "arm64" ]; then TRIVY_ARCH="ARM64"; else TRIVY_ARCH="64bit"; fi \
    && TRIVY_VERSION="0.74.0" \
    && curl -fSL "https://github.com/aquasecurity/trivy/releases/download/v${TRIVY_VERSION}/trivy_${TRIVY_VERSION}_Linux-${TRIVY_ARCH}.tar.gz" -o trivy.tar.gz \
    && tar -xzf trivy.tar.gz -C /usr/local/bin trivy \
    && chmod +x /usr/local/bin/trivy \
    && rm -f trivy.tar.gz \
    && trivy plugin install github.com/cfculhane/trivy-plugin-teamcity-report || true


# ==========================================
# Stage 4: Lean Production Runtime (Hardened & Upgraded)
# ==========================================
FROM node:20-alpine AS runner
WORKDIR /app/backend

# Upgrade OS packages (fixes libcrypto3/libssl3 CVEs) and install runtime dependencies
RUN apk update && apk upgrade --no-cache \
    && apk add --no-cache ca-certificates tzdata \
    && mkdir -p /root/.trivy /data

# Copy Trivy binary & plugin cache from trivy-builder
COPY --from=trivy-builder /usr/local/bin/trivy /usr/local/bin/trivy
COPY --from=trivy-builder /root/.trivy /root/.trivy

# Install production backend dependencies and purge global npm/corepack CLI
# (eliminating bundled npm vulnerabilities in tar, pacote, sigstore, ip-address, etc.)
COPY backend/package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund \
    && npm cache clean --force \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /root/.npm /tmp/*

# Copy built backend & frontend distributions
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Production Environment Variables
ENV PORT=3000 \
    NODE_ENV=production \
    DOCKER_SOCKET=/var/run/docker.sock \
    DATA_DIR=/data \
    TRIVY_PATH=/usr/local/bin/trivy

EXPOSE 3000
VOLUME ["/data"]

CMD ["node", "dist/index.js"]

