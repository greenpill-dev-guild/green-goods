# syntax=docker/dockerfile:1

ARG BUN_VERSION=1.3.14

FROM oven/bun:${BUN_VERSION} AS base
WORKDIR /app

# Workspace manifests and runtime package sources.
COPY package.json bun.lock ./
COPY patches ./patches
COPY packages/admin/package.json ./packages/admin/package.json
COPY packages/agent ./packages/agent
COPY packages/client/package.json ./packages/client/package.json
COPY packages/shared ./packages/shared
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY packages/contracts/deployments ./packages/contracts/deployments
COPY packages/contracts/abis ./packages/contracts/abis
COPY packages/indexer/package.json ./packages/indexer/package.json
COPY packages/qa/package.json ./packages/qa/package.json
COPY docs/package.json ./docs/package.json
COPY scripts ./scripts

# The build image needs the root dev type graph.
RUN bun install --frozen-lockfile

# Build the agent (outputs to packages/agent/dist). The Bun image does not ship
# a compatible Node runtime, so invoke TypeScript directly instead of the
# Node-only dev CLI wrapper used by the host development script.
RUN bun --bun tsc -p packages/agent/tsconfig.json

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

FROM oven/bun:${BUN_VERSION} AS prod-deps
WORKDIR /app

COPY package.json bun.lock ./
COPY patches ./patches
COPY packages/admin/package.json ./packages/admin/package.json
COPY packages/agent/package.json ./packages/agent/package.json
COPY packages/client/package.json ./packages/client/package.json
COPY packages/shared ./packages/shared
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY packages/contracts/deployments ./packages/contracts/deployments
COPY packages/contracts/abis ./packages/contracts/abis
COPY packages/indexer/package.json ./packages/indexer/package.json
COPY packages/qa/package.json ./packages/qa/package.json
COPY docs/package.json ./docs/package.json
COPY scripts ./scripts

# Install production dependencies only. This preserves shared runtime peer
# coverage without copying the full dev dependency graph into the Fly image.
RUN bun install --frozen-lockfile --production --ignore-scripts && \
    node scripts/postinstall/fix-multiformats.js

FROM oven/bun:${BUN_VERSION}-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Document and audio tools, pinned to the Debian trixie base of this image. Poppler backs
# agent-reporting PDF inspection (the `documents` operator control) and ffmpeg/ffprobe back
# voice-note normalization (the `voice` control); each control starts off and stays off until its
# fixtures pass in this image.
# LibreOffice is not installed: conversion needs the Writer and Calc components, not only
# libreoffice-core. Without it, Word files are read as native text, pending that package decision.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      poppler-utils=25.03.0-5+deb13u4 \
      ffmpeg=7:7.1.5-0+deb13u1 \
    && rm -rf /var/lib/apt/lists/* \
    && pdfinfo -v \
    && ffmpeg -hide_banner -version | head -n 1 \
    && ffprobe -hide_banner -version | head -n 1

# Copy production dependencies and runtime workspace files only.
# Env vars are injected by the runtime platform;
# bun's --env-file=../../.env in the start script is a no-op when the file is absent.
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/packages/agent/node_modules ./packages/agent/node_modules
COPY --from=prod-deps /app/package.json ./package.json
COPY --from=base /app/packages/agent/package.json ./packages/agent/package.json
COPY --from=base /app/packages/agent/dist ./packages/agent/dist
COPY --from=base /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=base /app/packages/shared/src ./packages/shared/src
COPY --from=base /app/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=base /app/packages/contracts/deployments ./packages/contracts/deployments
COPY --from=base /app/packages/contracts/abis ./packages/contracts/abis

# Bun's workspace links can be fragile after copying a pruned runtime graph
# between stages. Materialize the small contracts package at the package
# resolver path so shared config JSON imports resolve in the slim image.
RUN test -f packages/contracts/deployments/31337-latest.json && \
    rm -rf node_modules/@green-goods/contracts && \
    mkdir -p node_modules/@green-goods && \
    cp -R packages/contracts node_modules/@green-goods/contracts

# Fail the image build if Bun cannot resolve the runtime imports used by the
# compiled agent from the production image layout.
RUN cd packages/agent && bun -e "await import('./dist/config.js'); await import('./dist/api/server.js'); await import('./dist/services/agent-rpc.js'); await import('./dist/services/blockchain.js'); await import('@green-goods/shared/public-contracts'); await import('@green-goods/shared/sentry-redaction')"

# Default DB path points to the mounted Fly volume.
ENV DB_PATH=/data/agent.db

WORKDIR /app/packages/agent
CMD ["bun", "run", "start"]
