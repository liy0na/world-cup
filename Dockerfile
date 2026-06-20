# syntax=docker/dockerfile:1

# ---- Build stage: install, build the SPA + the single-file server bundle ----
# node:22-alpine already includes Node + npm; we install no OS packages, so there
# is nothing to `apk add`/`apt-get` (and Alpine uses apk, not apt).
FROM node:22-alpine AS build
WORKDIR /app

# Manifests first for layer caching.
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY web/package.json ./web/
RUN npm ci

# Build both the web SPA and the server bundle.
COPY . .
RUN npm run build

# ---- Runtime stage: just the self-contained server bundle + built SPA ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8787 \
    DATA_DIR=/data \
    WEB_DIST=/app/web

# The server bundle is fully self-contained (Fastify, shared engine and the seed
# data are all inlined by tsup), so no node_modules are needed at runtime.
COPY --from=build /app/server/dist/index.cjs ./index.cjs
COPY --from=build /app/web/dist ./web

# Run as the non-root "node" user; /data must be writable for the snapshot.
RUN mkdir -p /data && chown -R node:node /data /app
USER node

VOLUME ["/data"]
EXPOSE 8787

# wget ships with the Alpine busybox image.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1 || exit 1

CMD ["node", "index.cjs"]
