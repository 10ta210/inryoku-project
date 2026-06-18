# inryokü — production image
# Stage 1: install prod deps in a clean layer so the runtime image stays small.
FROM node:20-alpine AS deps
WORKDIR /app

# Install only production deps. devDependencies (canvas, jsdom, qrcode) are
# build/test-only and not needed at runtime.
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund

# Stage 2: runtime
FROM node:20-alpine AS runtime
WORKDIR /app

# Tini gives us proper PID 1 / signal handling without needing --init.
RUN apk add --no-cache tini && addgroup -S app && adduser -S app -G app

ENV NODE_ENV=production \
    PORT=3000 \
    NPM_CONFIG_LOGLEVEL=warn

# Pull deps from the deps stage.
COPY --from=deps /app/node_modules ./node_modules

# Copy the rest of the app. .dockerignore should exclude:
#   node_modules/ .git/ tests/ .env .release-backup/ backups/ docs/
COPY . .

# Drop to non-root.
RUN chown -R app:app /app
USER app

EXPOSE 3000

# Container-level healthcheck — hits the same path as scripts/healthcheck.sh.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/robots.txt" >/dev/null 2>&1 || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
