# -----------------------------------------------------------------------------
# ZeroCarbon.one — Frontend production image
# Multi-stage: Vite build → nginx static serve (+ /api reverse proxy)
# -----------------------------------------------------------------------------

FROM node:20-alpine AS builder

WORKDIR /app

ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.ts tsconfig.json ./
COPY src ./src
COPY public ./public

RUN npm run build

# -----------------------------------------------------------------------------

FROM nginx:1.27-alpine AS runner

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
  CMD wget -qO- http://127.0.0.1/health >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
