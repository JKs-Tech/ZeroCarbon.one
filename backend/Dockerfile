# -----------------------------------------------------------------------------
# ZeroCarbon.one — Backend production image (API + Worker)
# Multi-stage: TypeScript compile → slim runtime with Poppler for OCR.
# -----------------------------------------------------------------------------

FROM node:20-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build \
  && npm prune --omit=dev

# -----------------------------------------------------------------------------

FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    STORAGE_LOCAL_PATH=/app/uploads \
    TEMP_DIRECTORY=/app/tmp/ocr

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    poppler-utils \
    curl \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /app/uploads /app/tmp/ocr \
  && chown -R node:node /app

COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/package.json ./package.json

USER node

EXPOSE 3000

# Health checks are defined per-service in docker-compose.yml (API vs worker).
# Default command is the API. Compose overrides for the worker service.
CMD ["node", "dist/server.js"]
