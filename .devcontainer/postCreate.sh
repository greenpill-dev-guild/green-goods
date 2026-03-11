#!/usr/bin/env bash
# Green Goods Dev Container Bootstrap
# Runs once after container creation to set up the development environment
#
# Note: The firewall (init-firewall.sh) runs via postStartCommand BEFORE this script,
# so all network calls here must go to whitelisted domains.

set -euo pipefail

echo ""
echo "🌱 Setting up Green Goods development environment..."
echo ""

# Fix ownership of Docker volume mounts
# Docker volumes are created as root, but we run as 'node' user
echo "🔧 Fixing volume permissions..."
sudo chown -R node:node /workspaces/green-goods/node_modules 2>/dev/null || true
sudo chown -R node:node /workspaces/green-goods/packages/indexer/generated/node_modules 2>/dev/null || true
sudo chown -R node:node /workspaces/green-goods/packages/contracts/lib 2>/dev/null || true
sudo chown -R node:node /workspaces/green-goods/docs/node_modules 2>/dev/null || true

# Initialize git submodules (contracts dependencies)
echo "📦 Initializing git submodules..."
git submodule update --init --recursive || echo "   ⚠️  Submodule init skipped (may already be initialized)"

# Install all workspace dependencies
echo "📦 Installing dependencies with bun..."
bun install

# Create .env from schema if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env from .env.schema defaults..."
    APP_ENV=development bunx varlock load --path .env.schema --format env --compact > .env
    echo "   ⚠️  Edit .env for local overrides and set OP_ENVIRONMENT for 1Password injection"
else
    echo "✅ .env already exists"
fi

# Install docs dependencies (Docusaurus site)
echo "📚 Installing docs dependencies..."
cd docs && bun install && cd .. || echo "   ⚠️  Docs install skipped (run 'cd docs && bun install' manually)"

# Generate indexer types (so 'bun dev' works out of the box)
echo "🔧 Generating indexer types..."
bun --filter indexer codegen || echo "   ⚠️  Indexer codegen skipped (run manually if needed)"

# Setup ReScript dependencies for indexer
echo "🔧 Setting up indexer ReScript dependencies..."
bun --filter indexer setup-generated || echo "   ⚠️  Indexer setup skipped (run 'bun --filter indexer setup-generated' manually)"

# Build contracts (generates ABIs needed by other packages)
echo "🔨 Building contracts..."
bun --filter contracts build || echo "   ⚠️  Contract build skipped (run 'bun --filter contracts build' manually)"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ Setup complete!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "🚀 Quick start:"
echo "   bun dev          - Start all services (client, admin, docs, indexer, agent)"
echo "   bun dev:client   - Start client only (http://localhost:3001)"
echo "   bun dev:admin    - Start admin only (http://localhost:3002)"
echo "   bun dev:docs     - Start docs only (http://localhost:3003)"
echo "   bun run test     - Run all tests"
echo ""
echo "📝 Configure OP_ENVIRONMENT and any local overrides in .env"
echo "   Required: VITE_WALLETCONNECT_PROJECT_ID, VITE_PIMLICO_API_KEY"
echo ""

# === GPG Signing Setup ===
echo "═══════════════════════════════════════════════════════════"
echo "🔐 GPG Signing"
echo "═══════════════════════════════════════════════════════════"

# 1. Ensure Git uses the container's GPG program
git config --global gpg.program gpg

# 2. If GPG_KEY_ID is available, configure automatic signing
if [ -n "${GPG_KEY_ID:-}" ]; then
    echo "   ✅ Found GPG Key ID: $GPG_KEY_ID"
    git config --global user.signingkey "$GPG_KEY_ID"
    git config --global commit.gpgsign true
    git config --global tag.gpgsign true
    
    # 3. Fix pinentry issues (prevents 'failed to sign' errors)
    mkdir -p "$HOME/.gnupg"
    if [ -d "$HOME/.gnupg" ]; then
        if chmod 700 "$HOME/.gnupg"; then
            if [ -w "$HOME/.gnupg" ]; then
                if ! grep -q "pinentry-mode loopback" "$HOME/.gnupg/gpg.conf" 2>/dev/null; then
                    echo "pinentry-mode loopback" >> "$HOME/.gnupg/gpg.conf"
                fi
            else
                echo "   ⚠️  ~/.gnupg is not writable; skipping GPG pinentry configuration"
            fi
        else
            echo "   ⚠️  Failed to set permissions on ~/.gnupg; skipping GPG pinentry configuration"
        fi
    else
        echo "   ⚠️  Failed to create ~/.gnupg directory; skipping GPG pinentry configuration"
    fi
    echo "   ✅ GPG signing enabled for commits and tags"
else
    echo "   ⚠️  GPG_KEY_ID not set"
    echo "       To enable signing, set GPG_KEY_ID in devcontainer.json"
    echo "       or export it in your local shell before building"
fi

echo ""

# === Claude Code Status ===
echo "═══════════════════════════════════════════════════════════"
echo "🤖 Claude Code"
echo "═══════════════════════════════════════════════════════════"

# Create claude-auto alias for autonomous mode
ZSHRC="$HOME/.zshrc"
BASHRC="$HOME/.bashrc"
CLAUDE_ALIAS='alias claude-auto="claude --dangerously-skip-permissions"'

# Add alias to shell configs if not present
for rc in "$ZSHRC" "$BASHRC"; do
    # Create file if it doesn't exist
    [ ! -f "$rc" ] && touch "$rc"
    if ! grep -q "claude-auto" "$rc" 2>/dev/null; then
        echo "" >> "$rc"
        echo "# Claude Code autonomous mode (firewall-protected)" >> "$rc"
        echo "$CLAUDE_ALIAS" >> "$rc"
    fi
done

if command -v claude &> /dev/null; then
    echo "   ✅ Installed: $(claude --version 2>/dev/null || echo 'version unknown')"
    echo ""

    # Check authentication status (priority order)
    CLAUDE_AUTH_STATUS=""

    if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
        CLAUDE_AUTH_STATUS="api_key"
        echo "   ✅ Authenticated via API key"
    elif [ "${CLAUDE_CODE_USE_BEDROCK:-}" = "1" ]; then
        CLAUDE_AUTH_STATUS="bedrock"
        echo "   ✅ Authenticated via Amazon Bedrock"
        [ -n "${AWS_REGION:-}" ] && echo "      Region: $AWS_REGION"
    elif [ "${CLAUDE_CODE_USE_VERTEX:-}" = "1" ]; then
        CLAUDE_AUTH_STATUS="vertex"
        echo "   ✅ Authenticated via Google Vertex AI"
        [ -n "${CLOUD_ML_REGION:-}" ] && echo "      Region: $CLOUD_ML_REGION"
    elif [ "${CLAUDE_CODE_USE_FOUNDRY:-}" = "1" ]; then
        CLAUDE_AUTH_STATUS="foundry"
        echo "   ✅ Authenticated via Microsoft Foundry"
        [ -n "${ANTHROPIC_FOUNDRY_RESOURCE:-}" ] && echo "      Resource: $ANTHROPIC_FOUNDRY_RESOURCE"
    elif [ -f "$HOME/.claude/.credentials.json" ]; then
        # Check for OAuth credentials in persistent volume
        if grep -q "accessToken" "$HOME/.claude/.credentials.json" 2>/dev/null; then
            CLAUDE_AUTH_STATUS="oauth"
            # Check if token might be expired (robust JSON parsing with jq fallback)
            if command -v jq &> /dev/null; then
                EXPIRES_AT=$(jq -r '.expiresAt // empty' "$HOME/.claude/.credentials.json" 2>/dev/null)
            else
                # Fallback to grep if jq not available (allow optional whitespace after colon)
                EXPIRES_AT=$(grep -oE '"expiresAt":[[:space:]]*[0-9]+' "$HOME/.claude/.credentials.json" 2>/dev/null | grep -oE '[0-9]+')
            fi
            CURRENT_MS=$(($(date +%s) * 1000))
            if [ -n "$EXPIRES_AT" ] && [[ "$EXPIRES_AT" =~ ^[0-9]+$ ]] && [ "$CURRENT_MS" -lt "$EXPIRES_AT" ]; then
                echo "   ✅ Authenticated via OAuth (persisted in volume)"
                echo "      Credentials will persist across container restarts."
            else
                echo "   ⚠️  OAuth token may be expired"
                echo "      Run 'claude login' to refresh your session."
                CLAUDE_AUTH_STATUS=""
            fi
        fi
    fi

    if [ -z "$CLAUDE_AUTH_STATUS" ]; then
        echo "   📝 To authenticate, run:"
        echo ""
        echo "      claude login"
        echo ""
        echo "      This opens a browser to sign in with your Anthropic account."
        echo "      Your session will persist across container restarts."
    fi

    echo ""
    echo "   🚀 Autonomous mode (with firewall protection):"
    echo ""
    echo "      claude-auto          # Alias for --dangerously-skip-permissions"
    echo "      claude-auto \"task\"   # Run a task autonomously"
    echo ""
else
    echo "   ❌ CLI not found (installation may have failed)"
fi

echo "═══════════════════════════════════════════════════════════"
echo ""
