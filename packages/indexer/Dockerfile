# Dockerfile for Green Goods Indexer
# This allows running the indexer in Docker on macOS to avoid system-configuration crate panics

FROM node:20-slim

# Install dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN npm install -g pnpm@latest

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
COPY package.json ./
COPY generated/package.json ./generated/

# Install root dependencies
RUN pnpm install --ignore-scripts

# Copy the rest of the source
COPY . .

# Make entrypoint executable
RUN chmod +x docker-entrypoint.sh

# Install generated dependencies
WORKDIR /app/generated
RUN pnpm install

# Build ReScript code
RUN pnpm exec rescript build

# Back to root
WORKDIR /app

# Expose ports
# 9898: Envio dev server
EXPOSE 9898

# Health check with longer start period for ReScript fixes
HEALTHCHECK --interval=30s --timeout=10s --start-period=180s --retries=5 \
    CMD curl -f http://localhost:9898/health || exit 1

# Use entrypoint to fix ReScript module paths at runtime
ENTRYPOINT ["/app/docker-entrypoint.sh"]

# Use start instead of dev to avoid Docker-in-Docker issues
# The external docker-compose provides postgres and hasura
CMD ["pnpm", "exec", "envio", "start"]
