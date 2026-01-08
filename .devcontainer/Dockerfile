# Green Goods Dev Container
# Node 22 + Bun + Foundry + pnpm + Claude Code with security firewall
#
# Based on Claude Code reference implementation:
# https://github.com/anthropics/claude-code/blob/main/.devcontainer/Dockerfile

FROM mcr.microsoft.com/devcontainers/javascript-node:22-bookworm

ARG TZ
ENV TZ="${TZ:-UTC}"
ARG CLAUDE_CODE_VERSION=latest
ARG GIT_DELTA_VERSION=0.18.2

# Install system dependencies including firewall tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Core tools
    bash \
    ca-certificates \
    curl \
    git \
    jq \
    lsof \
    openssl \
    procps \
    unzip \
    gnupg2 \
    gh \
    # Shell enhancements
    zsh \
    fzf \
    nano \
    vim \
    man-db \
    # Firewall tools (for security isolation)
    iptables \
    ipset \
    iproute2 \
    dnsutils \
    aggregate \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Enable pnpm via corepack (needed for indexer generated/ folder)
RUN corepack enable && corepack prepare pnpm@latest --activate

# Persist command history across container restarts
ARG USERNAME=node
RUN SNIPPET="export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" \
    && mkdir -p /commandhistory \
    && touch /commandhistory/.bash_history \
    && chown -R $USERNAME /commandhistory

# Create workspace and config directories
RUN mkdir -p /workspaces/green-goods /home/node/.claude \
    && chown -R node:node /workspaces/green-goods /home/node/.claude

# Install git-delta for enhanced diff viewing
RUN ARCH=$(dpkg --print-architecture) && \
    wget -q "https://github.com/dandavison/delta/releases/download/${GIT_DELTA_VERSION}/git-delta_${GIT_DELTA_VERSION}_${ARCH}.deb" && \
    dpkg -i "git-delta_${GIT_DELTA_VERSION}_${ARCH}.deb" && \
    rm "git-delta_${GIT_DELTA_VERSION}_${ARCH}.deb"

# Install Claude Code globally
RUN npm install -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}

# Copy and set up firewall script with passwordless sudo
COPY init-firewall.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/init-firewall.sh && \
    echo "node ALL=(root) NOPASSWD: /usr/local/bin/init-firewall.sh" > /etc/sudoers.d/node-firewall && \
    chmod 0440 /etc/sudoers.d/node-firewall

# Switch to non-root user for remaining installs
USER node

# Set environment variables
ENV DEVCONTAINER=true
ENV SHELL=/bin/zsh
ENV EDITOR=nano
ENV VISUAL=nano

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/home/node/.bun/bin:${PATH}"

# Install Foundry (forge, cast, anvil) for contract development
RUN curl -L https://foundry.paradigm.xyz | bash \
    && /home/node/.foundry/bin/foundryup
ENV PATH="/home/node/.foundry/bin:${PATH}"

# Set working directory
WORKDIR /workspaces/green-goods
