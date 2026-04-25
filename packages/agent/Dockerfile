FROM oven/bun:1 AS base
WORKDIR /app

# Workspace manifests (root) and source
COPY package.json bun.lock ./
COPY packages ./packages
COPY docs/package.json ./docs/package.json
COPY scripts ./scripts

# Varlock schema + generated TypedEnvSchema — tsconfig includes ../../env.d.ts
# and the runtime start script runs varlock against .env.schema.
COPY .env.schema ./
COPY env.d.ts ./

# Install all workspace deps
RUN bun install --frozen-lockfile

# Build the agent (outputs to packages/agent/dist)
RUN bun run build:agent

FROM oven/bun:1-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy built workspace + varlock schema used at runtime (../../.env.schema from agent cwd)
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/packages ./packages
COPY --from=base /app/.env.schema ./.env.schema

# Default DB path points to mounted volume on Railway
ENV DB_PATH=/data/agent.db

WORKDIR /app/packages/agent
CMD ["bun", "run", "start"]

