#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# Green Goods — Cloud Environment Setup for Claude Code
# ═══════════════════════════════════════════════════════════════════════════════
#
# Usage:
#   curl -fsSL <raw-url>/scripts/cloud-setup.sh | bash
#   — or —
#   chmod +x scripts/cloud-setup.sh && ./scripts/cloud-setup.sh
#
# Tested on: Ubuntu 22.04/24.04, Debian 12, Amazon Linux 2023
# Requires: Root or sudo access for system package installation
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
DIM='\033[2m'
RESET='\033[0m'

info()    { echo -e "${CYAN}ℹ${RESET}  $1"; }
success() { echo -e "${GREEN}✓${RESET}  $1"; }
warn()    { echo -e "${YELLOW}⚠${RESET}  $1"; }
fail()    { echo -e "${RED}✗${RESET}  $1"; exit 1; }

# ─── Configuration ────────────────────────────────────────────────────────────
REPO_URL="${REPO_URL:-https://github.com/greenpill-dev-guild/green-goods.git}"
REPO_DIR="${REPO_DIR:-$(pwd)/green-goods}"
NODE_MAJOR=20
SKIP_DOCKER="${SKIP_DOCKER:-false}"
SKIP_CLONE="${SKIP_CLONE:-false}"

echo ""
echo -e "${GREEN}🌱 Green Goods — Cloud Setup${RESET}"
echo -e "${DIM}Setting up development environment for Claude Code${RESET}"
echo ""

# ─── Detect OS ────────────────────────────────────────────────────────────────
detect_os() {
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS_ID="${ID}"
    OS_VERSION="${VERSION_ID:-unknown}"
  elif [ "$(uname)" = "Darwin" ]; then
    OS_ID="macos"
    OS_VERSION="$(sw_vers -productVersion)"
  else
    OS_ID="unknown"
    OS_VERSION="unknown"
  fi
  info "Detected OS: ${OS_ID} ${OS_VERSION}"
}

# ─── Sudo helper ──────────────────────────────────────────────────────────────
SUDO=""
setup_sudo() {
  if [ "$(id -u)" -ne 0 ]; then
    if command -v sudo &>/dev/null; then
      SUDO="sudo"
    else
      fail "Not running as root and sudo is not available. Run as root or install sudo."
    fi
  fi
}

# ─── Step 1: System packages ─────────────────────────────────────────────────
install_system_packages() {
  info "Installing system packages..."

  case "${OS_ID}" in
    ubuntu|debian|pop)
      $SUDO apt-get update -qq
      $SUDO apt-get install -y -qq \
        curl wget git build-essential pkg-config libssl-dev \
        ca-certificates gnupg unzip jq
      ;;
    fedora|rhel|centos|amzn|rocky|alma)
      $SUDO dnf install -y \
        curl wget git gcc gcc-c++ make openssl-devel \
        ca-certificates unzip jq
      ;;
    alpine)
      $SUDO apk add --no-cache \
        curl wget git build-base openssl-dev bash \
        ca-certificates unzip jq
      ;;
    macos)
      if ! command -v brew &>/dev/null; then
        warn "Homebrew not found. Install from https://brew.sh"
      fi
      # macOS ships with most tools, just ensure jq
      brew install jq 2>/dev/null || true
      ;;
    *)
      warn "Unknown OS '${OS_ID}'. Assuming packages are pre-installed."
      ;;
  esac

  success "System packages ready"
}

# ─── Step 2: Node.js 20+ ─────────────────────────────────────────────────────
install_node() {
  if command -v node &>/dev/null; then
    NODE_VERSION=$(node --version | grep -oP '\d+' | head -1)
    if [ "${NODE_VERSION}" -ge "${NODE_MAJOR}" ]; then
      success "Node.js $(node --version) already installed"
      return
    fi
    warn "Node.js $(node --version) is too old (need ${NODE_MAJOR}+)"
  fi

  info "Installing Node.js ${NODE_MAJOR}..."

  case "${OS_ID}" in
    ubuntu|debian|pop)
      # NodeSource setup
      $SUDO mkdir -p /etc/apt/keyrings
      curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
        | $SUDO gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg 2>/dev/null
      echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" \
        | $SUDO tee /etc/apt/sources.list.d/nodesource.list > /dev/null
      $SUDO apt-get update -qq
      $SUDO apt-get install -y -qq nodejs
      ;;
    fedora|rhel|centos|amzn|rocky|alma)
      curl -fsSL "https://rpm.nodesource.com/setup_${NODE_MAJOR}.x" | $SUDO bash -
      $SUDO dnf install -y nodejs
      ;;
    alpine)
      $SUDO apk add --no-cache nodejs npm
      ;;
    macos)
      brew install "node@${NODE_MAJOR}" 2>/dev/null || true
      ;;
    *)
      curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | $SUDO bash -
      $SUDO apt-get install -y nodejs 2>/dev/null || fail "Cannot auto-install Node.js on ${OS_ID}"
      ;;
  esac

  success "Node.js $(node --version) installed"
}

# ─── Step 3: Bun ─────────────────────────────────────────────────────────────
install_bun() {
  if command -v bun &>/dev/null; then
    success "Bun $(bun --version) already installed"
    return
  fi

  info "Installing Bun..."
  curl -fsSL https://bun.sh/install | bash

  # Add to PATH for current session
  export BUN_INSTALL="${HOME}/.bun"
  export PATH="${BUN_INSTALL}/bin:${PATH}"

  # Persist in profile
  SHELL_RC="${HOME}/.bashrc"
  [ -f "${HOME}/.zshrc" ] && SHELL_RC="${HOME}/.zshrc"

  if ! grep -q 'BUN_INSTALL' "${SHELL_RC}" 2>/dev/null; then
    cat >> "${SHELL_RC}" << 'BUNEOF'

# Bun
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
BUNEOF
  fi

  success "Bun $(bun --version) installed"
}

# ─── Step 4: Foundry (Forge, Cast, Anvil) ────────────────────────────────────
install_foundry() {
  if command -v forge &>/dev/null; then
    success "Foundry $(forge --version | head -1) already installed"
    return
  fi

  info "Installing Foundry toolchain..."
  curl -L https://foundry.paradigm.xyz | bash

  # Add to PATH for current session
  export PATH="${HOME}/.foundry/bin:${PATH}"

  # Persist in profile
  SHELL_RC="${HOME}/.bashrc"
  [ -f "${HOME}/.zshrc" ] && SHELL_RC="${HOME}/.zshrc"

  if ! grep -q '.foundry/bin' "${SHELL_RC}" 2>/dev/null; then
    cat >> "${SHELL_RC}" << 'FOUNDRYEOF'

# Foundry
export PATH="$HOME/.foundry/bin:$PATH"
FOUNDRYEOF
  fi

  # Run foundryup to install forge, cast, anvil, chisel
  "${HOME}/.foundry/bin/foundryup"

  success "Foundry installed: forge $(forge --version | head -1)"
}

# ─── Step 5: Docker (optional, needed for indexer) ────────────────────────────
install_docker() {
  if [ "${SKIP_DOCKER}" = "true" ]; then
    warn "Skipping Docker (SKIP_DOCKER=true). Indexer will not work."
    return
  fi

  if command -v docker &>/dev/null && docker ps &>/dev/null 2>&1; then
    success "Docker $(docker --version) already running"
    return
  fi

  if command -v docker &>/dev/null; then
    warn "Docker installed but not running. Start Docker daemon manually."
    return
  fi

  info "Installing Docker..."

  case "${OS_ID}" in
    ubuntu|debian|pop)
      # Docker official install
      $SUDO install -m 0755 -d /etc/apt/keyrings
      curl -fsSL "https://download.docker.com/linux/${OS_ID}/gpg" \
        | $SUDO gpg --dearmor -o /etc/apt/keyrings/docker.gpg 2>/dev/null
      $SUDO chmod a+r /etc/apt/keyrings/docker.gpg
      echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
        https://download.docker.com/linux/${OS_ID} $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
        | $SUDO tee /etc/apt/sources.list.d/docker.list > /dev/null
      $SUDO apt-get update -qq
      $SUDO apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
      ;;
    fedora|rhel|centos|amzn|rocky|alma)
      $SUDO dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo 2>/dev/null || true
      $SUDO dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
      ;;
    macos)
      warn "Install Docker Desktop from https://www.docker.com/products/docker-desktop/"
      return
      ;;
    *)
      warn "Cannot auto-install Docker on ${OS_ID}. Install manually."
      return
      ;;
  esac

  # Start and enable Docker
  $SUDO systemctl start docker 2>/dev/null || true
  $SUDO systemctl enable docker 2>/dev/null || true

  # Add current user to docker group (avoids sudo for docker commands)
  if [ "$(id -u)" -ne 0 ]; then
    $SUDO usermod -aG docker "$(whoami)" 2>/dev/null || true
    warn "Added $(whoami) to docker group. Log out and back in for effect."
  fi

  success "Docker installed"
}

# ─── Step 6: Claude Code CLI ─────────────────────────────────────────────────
install_claude_code() {
  if command -v claude &>/dev/null; then
    success "Claude Code $(claude --version 2>/dev/null || echo 'installed')"
    return
  fi

  info "Installing Claude Code CLI..."
  npm install -g @anthropic-ai/claude-code

  success "Claude Code CLI installed"
}

# ─── Step 7: Clone and setup repo ────────────────────────────────────────────
setup_repo() {
  if [ "${SKIP_CLONE}" = "true" ]; then
    info "Skipping clone (SKIP_CLONE=true)"
    if [ ! -d "${REPO_DIR}" ]; then
      fail "SKIP_CLONE=true but REPO_DIR=${REPO_DIR} does not exist"
    fi
  else
    if [ -d "${REPO_DIR}/.git" ]; then
      info "Repository already cloned at ${REPO_DIR}"
    else
      info "Cloning repository..."
      git clone "${REPO_URL}" "${REPO_DIR}"
      success "Repository cloned"
    fi
  fi

  cd "${REPO_DIR}"
  info "Working directory: $(pwd)"

  # Install dependencies
  info "Installing project dependencies (bun install)..."
  bun install
  success "Dependencies installed"

  # The postinstall script (fix-multiformats.js) runs automatically via bun install.
  # It patches multiformats/basics, uint8arrays, walletconnect, and Bun cache symlinks.

  # Setup .env if missing
  if [ ! -f .env ]; then
    if [ -f .env.example ]; then
      cp .env.example .env
      success "Created .env from .env.example"
      warn "Edit .env with your API keys before running services"
    else
      warn "No .env.example found — create .env manually"
    fi
  else
    success "Environment file (.env) already exists"
  fi
}

# ─── Step 8: Build the project ───────────────────────────────────────────────
build_project() {
  cd "${REPO_DIR}"

  info "Building project (contracts → shared → indexer → client → admin)..."

  # Build contracts first (generates ABIs needed by other packages)
  info "Building contracts..."
  cd packages/contracts && bun build && cd ../..
  success "Contracts built"

  # Build shared (needed by client/admin)
  info "Building shared..."
  cd packages/shared && bun run build 2>/dev/null && cd ../.. || {
    warn "Shared build skipped (may need .env variables)"
    cd ../..
  }

  # Build indexer
  info "Building indexer..."
  cd packages/indexer && bun run build 2>/dev/null && cd ../.. || {
    warn "Indexer build skipped (may need config)"
    cd ../..
  }

  success "Build complete"
}

# ─── Step 9: Validate installation ───────────────────────────────────────────
validate() {
  echo ""
  info "Validating installation..."
  echo ""

  local all_ok=true

  # Check each tool
  for cmd in node bun git forge cast; do
    if command -v "$cmd" &>/dev/null; then
      local ver
      case "$cmd" in
        node)  ver="$(node --version)" ;;
        bun)   ver="$(bun --version)" ;;
        git)   ver="$(git --version | awk '{print $3}')" ;;
        forge) ver="$(forge --version 2>/dev/null | head -1 | awk '{print $2}')" ;;
        cast)  ver="$(cast --version 2>/dev/null | head -1 | awk '{print $2}')" ;;
      esac
      success "$cmd $ver"
    else
      fail "$cmd — NOT FOUND"
      all_ok=false
    fi
  done

  # Docker (optional)
  if command -v docker &>/dev/null; then
    if docker ps &>/dev/null 2>&1; then
      success "docker $(docker --version | awk '{print $3}' | tr -d ',')"
    else
      warn "docker installed but daemon not running"
    fi
  else
    warn "docker — not installed (indexer requires it)"
  fi

  # Claude Code
  if command -v claude &>/dev/null; then
    success "claude $(claude --version 2>/dev/null || echo 'cli')"
  else
    warn "claude — not installed (install with: npm i -g @anthropic-ai/claude-code)"
  fi

  echo ""

  if [ "${all_ok}" = true ]; then
    success "All core tools installed"
  fi
}

# ─── Step 10: Print next steps ────────────────────────────────────────────────
print_next_steps() {
  echo ""
  echo -e "${GREEN}═══════════════════════════════════════════════════════════════${RESET}"
  echo -e "${GREEN}  ✓ Green Goods cloud environment ready!${RESET}"
  echo -e "${GREEN}═══════════════════════════════════════════════════════════════${RESET}"
  echo ""
  echo -e "${CYAN}Next steps:${RESET}"
  echo ""
  echo "  1. Configure environment variables:"
  echo -e "     ${DIM}cd ${REPO_DIR} && nano .env${RESET}"
  echo ""
  echo "     Required keys:"
  echo "     • VITE_CHAIN_ID          (11155111 for Sepolia testnet)"
  echo "     • VITE_PIMLICO_API_KEY   (passkey auth — pimlico.io)"
  echo "     • VITE_WALLETCONNECT_PROJECT_ID (wallets — cloud.walletconnect.com)"
  echo ""
  echo "  2. Start Claude Code:"
  echo -e "     ${DIM}cd ${REPO_DIR} && claude${RESET}"
  echo ""
  echo "  3. Or start services directly:"
  echo -e "     ${DIM}bun dev              # All services via PM2${RESET}"
  echo -e "     ${DIM}bun dev:client       # Just the PWA (port 3001)${RESET}"
  echo -e "     ${DIM}bun dev:admin        # Just the dashboard (port 3002)${RESET}"
  echo ""
  echo "  4. Run tests:"
  echo -e "     ${DIM}bun run test         # All packages${RESET}"
  echo -e "     ${DIM}bun format && bun lint  # Code quality${RESET}"
  echo ""
  echo -e "${CYAN}Useful Claude Code commands:${RESET}"
  echo -e "     ${DIM}/plan    — Create implementation plans${RESET}"
  echo -e "     ${DIM}/review  — 6-pass code review${RESET}"
  echo -e "     ${DIM}/debug   — Systematic debugging${RESET}"
  echo -e "     ${DIM}/audit   — Codebase health analysis${RESET}"
  echo ""
}

# ═══════════════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════════════
main() {
  detect_os
  setup_sudo

  echo ""
  info "Phase 1/4 — System dependencies"
  echo ""
  install_system_packages
  install_node
  install_bun
  install_foundry
  install_docker

  echo ""
  info "Phase 2/4 — Claude Code CLI"
  echo ""
  install_claude_code

  echo ""
  info "Phase 3/4 — Repository setup"
  echo ""
  setup_repo

  echo ""
  info "Phase 4/4 — Build & validate"
  echo ""
  build_project
  validate
  print_next_steps
}

main "$@"
