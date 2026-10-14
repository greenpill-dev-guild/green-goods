# Dockerfile for the Green Goods Envio v3 indexer.
# The build context is the repository root so the checked-in Bun lockfile is authoritative.
#
# The image needs BOTH runtimes:
#   - Bun runs the repository's package scripts (Bun-first workflow, frozen lockfile install).
#   - Real Node 22 runs Envio, because the package scripts delegate the Envio CLI through
#     scripts/dev/node-cli.js, which refuses to run under Bun.
# A bun-only base fails the image codegen stage with
# "node-cli.js is still running under Bun", because `bun run` substitutes Bun for `node`.
# Node is therefore the base and the pinned Bun binary is copied in from the official image.

FROM oven/bun:1.3.14-slim AS bun

FROM node:22-slim

# Keep this pin aligned with the Bun version used by CI and the root workflows.
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun

# Install dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json bun.lock bunfig.toml ./
COPY patches ./patches
COPY packages/admin/package.json ./packages/admin/package.json
COPY packages/agent/package.json ./packages/agent/package.json
COPY packages/client/package.json ./packages/client/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY packages/indexer/package.json ./packages/indexer/package.json
COPY packages/qa/package.json ./packages/qa/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY docs/package.json ./docs/package.json
COPY scripts/postinstall ./scripts/postinstall
# Handler and config edits keep this expensive layer cached.
RUN bun install --frozen-lockfile --filter @green-goods/indexer
COPY . .
RUN bun run --cwd packages/indexer codegen

WORKDIR /app/packages/indexer

# Expose ports
# 9898: Envio dev server
EXPOSE 9898

# Health check — Envio exposes /healthz (not /health)
HEALTHCHECK --interval=15s --timeout=10s --start-period=60s --retries=10 \
    CMD curl -f http://localhost:9898/healthz || exit 1

# The external docker-compose provides Postgres and Hasura.
CMD ["bun", "run", "start"]
