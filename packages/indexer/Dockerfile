# Dockerfile for the Green Goods Envio v3 indexer.
# The build context is the repository root so the checked-in Bun lockfile is authoritative.

FROM oven/bun:1.3.14-slim

# Install dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .

RUN bun install --frozen-lockfile
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
