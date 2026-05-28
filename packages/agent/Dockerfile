# syntax=docker/dockerfile:1

FROM oven/bun:1 AS base
WORKDIR /app

# Workspace manifests (root) and source
COPY package.json bun.lock ./
COPY packages ./packages
COPY docs/package.json ./docs/package.json
COPY scripts ./scripts

# Install all workspace deps
RUN bun install --frozen-lockfile

# Build the agent (outputs to packages/agent/dist)
RUN bun run build:agent

# Upload Sentry source maps when the deploy provides a BuildKit secret, then
# remove maps so they are not copied into the runtime image.
RUN --mount=type=secret,id=SENTRY_AUTH_TOKEN \
    if [ -s /run/secrets/SENTRY_AUTH_TOKEN ]; then \
      export SENTRY_AUTH_TOKEN="$(cat /run/secrets/SENTRY_AUTH_TOKEN)" && \
      (cd packages/agent && bun run sentry:sourcemaps); \
    else \
      echo "SENTRY_AUTH_TOKEN build secret not set; skipping agent Sentry source-map upload"; \
    fi && \
    find packages/agent/dist -name '*.map' -delete

FROM oven/bun:1-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy built workspace. Env vars are injected by the runtime platform (Railway, etc.);
# bun's --env-file=../../.env in the start script is a no-op when the file is absent.
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/packages ./packages

# Default DB path points to mounted volume on Railway
ENV DB_PATH=/data/agent.db

WORKDIR /app/packages/agent
CMD ["bun", "run", "start"]
