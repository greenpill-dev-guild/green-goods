# syntax=docker/dockerfile:1

FROM oven/bun:1 AS base
WORKDIR /app

# Workspace manifests, runtime package sources, and postinstall helper.
COPY package.json bun.lock ./
COPY packages/agent ./packages/agent
COPY packages/shared ./packages/shared
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY packages/contracts/deployments ./packages/contracts/deployments
COPY packages/contracts/abis ./packages/contracts/abis
COPY docs/package.json ./docs/package.json
COPY scripts ./scripts

# Install the agent workspace dependency graph instead of every app workspace.
RUN bun install --frozen-lockfile --filter @green-goods/agent

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

FROM oven/bun:1 AS prod-deps
WORKDIR /app

COPY package.json bun.lock ./
COPY packages/agent/package.json ./packages/agent/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY docs/package.json ./docs/package.json
COPY scripts ./scripts

RUN bun install --frozen-lockfile --production --filter @green-goods/agent

FROM oven/bun:1-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy production dependencies and runtime workspace files only.
# Env vars are injected by the runtime platform;
# bun's --env-file=../../.env in the start script is a no-op when the file is absent.
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/package.json ./package.json
COPY --from=base /app/packages/agent/package.json ./packages/agent/package.json
COPY --from=base /app/packages/agent/dist ./packages/agent/dist
COPY --from=base /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=base /app/packages/shared/src ./packages/shared/src
COPY --from=base /app/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=base /app/packages/contracts/deployments ./packages/contracts/deployments
COPY --from=base /app/packages/contracts/abis ./packages/contracts/abis

# Default DB path points to the mounted Fly volume.
ENV DB_PATH=/data/agent.db

WORKDIR /app/packages/agent
CMD ["bun", "run", "start"]
