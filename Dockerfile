# syntax=docker/dockerfile:1

# ---- Build stage: install, build web + server ----
FROM node:22-alpine AS build
WORKDIR /app

# Install with workspaces (copy manifests first for layer caching).
COPY package.json package-lock.json* ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY web/package.json ./web/
RUN npm install

# Copy sources and build both the SPA and the server bundle.
COPY . .
RUN npm run build

# ---- Runtime stage: just the server bundle + built SPA ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8787 \
    DATA_DIR=/data \
    WEB_DIST=/app/web

# The server bundle is self-contained (shared + seed inlined by tsup), so no
# node_modules are needed at runtime.
COPY --from=build /app/server/dist/index.js ./index.js
COPY --from=build /app/web/dist ./web

VOLUME ["/data"]
EXPOSE 8787
CMD ["node", "index.js"]
