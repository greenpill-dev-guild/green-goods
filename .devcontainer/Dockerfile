# Green Goods Dev Container
# Node 22 + Bun + Foundry + pnpm for full-stack development

FROM mcr.microsoft.com/devcontainers/javascript-node:22-bookworm

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    curl \
    git \
    jq \
    lsof \
    openssl \
    procps \
    && rm -rf /var/lib/apt/lists/*

# Enable pnpm via corepack (needed for indexer generated/ folder)
RUN corepack enable && corepack prepare pnpm@latest --activate

# Switch to non-root user for remaining installs
USER vscode

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/home/vscode/.bun/bin:${PATH}"

# Install Foundry (forge, cast, anvil) for contract development
RUN curl -L https://foundry.paradigm.xyz | bash \
    && /home/vscode/.foundry/bin/foundryup
ENV PATH="/home/vscode/.foundry/bin:${PATH}"

# Back to root for any final setup
USER root

# Set working directory
WORKDIR /workspaces/green-goods
