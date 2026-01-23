#!/bin/bash
# Green Goods Dev Container Firewall
# Adapted from Claude Code reference implementation
# https://github.com/anthropics/claude-code/blob/main/.devcontainer/init-firewall.sh
#
# This script implements network isolation for secure development.
# Only whitelisted domains can be accessed from within the container.
#
# Note: Requires NET_ADMIN and NET_RAW capabilities, plus kernel support
# for iptables/ipset. Works best on native Linux or cloud devcontainers.

set -euo pipefail
IFS=$'\n\t'

echo "🔒 Initializing Green Goods devcontainer firewall..."

# Check if iptables is available and working
check_iptables_support() {
    if ! command -v iptables &> /dev/null; then
        echo "   ⚠️  iptables not found"
        return 1
    fi

    # Try a simple iptables command to verify kernel support
    if ! iptables -L -n &> /dev/null; then
        echo "   ⚠️  iptables kernel support not available"
        echo "      This is normal on Docker Desktop (macOS/Windows)"
        return 1
    fi

    if ! command -v ipset &> /dev/null; then
        echo "   ⚠️  ipset not found"
        return 1
    fi

    # Try creating a test ipset
    if ! ipset create _firewall_test hash:net 2>/dev/null; then
        echo "   ⚠️  ipset kernel support not available"
        return 1
    fi
    ipset destroy _firewall_test 2>/dev/null || true

    return 0
}

if ! check_iptables_support; then
    echo ""
    echo "   ╔══════════════════════════════════════════════════════════════╗"
    echo "   ║  Firewall disabled - running without network isolation       ║"
    echo "   ║                                                              ║"
    echo "   ║  This environment doesn't support iptables/ipset.            ║"
    echo "   ║  The devcontainer will work normally but without the         ║"
    echo "   ║  security isolation provided by the firewall.                ║"
    echo "   ║                                                              ║"
    echo "   ║  For full security isolation, use:                           ║"
    echo "   ║  • GitHub Codespaces                                         ║"
    echo "   ║  • Native Linux host                                         ║"
    echo "   ║  • Cloud-based devcontainer                                  ║"
    echo "   ╚══════════════════════════════════════════════════════════════╝"
    echo ""
    exit 0
fi

echo "   ✅ iptables/ipset support verified"

# 1. Extract Docker DNS info BEFORE any flushing
DOCKER_DNS_RULES=$(iptables-save -t nat | grep "127\.0\.0\.11" || true)

# Flush existing rules and delete existing ipsets
iptables -F
iptables -X
iptables -t nat -F
iptables -t nat -X
iptables -t mangle -F
iptables -t mangle -X
ipset destroy allowed-domains 2>/dev/null || true

# 2. Selectively restore ONLY internal Docker DNS resolution
if [ -n "$DOCKER_DNS_RULES" ]; then
    echo "   Restoring Docker DNS rules..."
    iptables -t nat -N DOCKER_OUTPUT 2>/dev/null || true
    iptables -t nat -N DOCKER_POSTROUTING 2>/dev/null || true
    echo "$DOCKER_DNS_RULES" | xargs -L 1 iptables -t nat
else
    echo "   No Docker DNS rules to restore"
fi

# First allow DNS and localhost before any restrictions
# Allow outbound DNS
iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
# Allow inbound DNS responses
iptables -A INPUT -p udp --sport 53 -j ACCEPT
# Allow outbound SSH
iptables -A OUTPUT -p tcp --dport 22 -j ACCEPT
# Allow inbound SSH responses
iptables -A INPUT -p tcp --sport 22 -m state --state ESTABLISHED -j ACCEPT
# Allow localhost
iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT

# Create ipset with CIDR support
ipset create allowed-domains hash:net

# Fetch GitHub meta information and aggregate + add their IP ranges
echo "📡 Fetching GitHub IP ranges..."
gh_ranges=$(curl -s https://api.github.com/meta)
if [ -z "$gh_ranges" ]; then
    echo "ERROR: Failed to fetch GitHub IP ranges"
    exit 1
fi

if ! echo "$gh_ranges" | jq -e '.web and .api and .git' >/dev/null; then
    echo "ERROR: GitHub API response missing required fields"
    exit 1
fi

echo "   Processing GitHub IPs..."
while read -r cidr; do
    if [[ ! "$cidr" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/[0-9]{1,2}$ ]]; then
        echo "ERROR: Invalid CIDR range from GitHub meta: $cidr"
        exit 1
    fi
    ipset add allowed-domains "$cidr"
done < <(echo "$gh_ranges" | jq -r '(.web + .api + .git)[]' | aggregate -q)
echo "   ✅ GitHub ranges added"

# === Core Development Infrastructure ===
CORE_DOMAINS=(
    # Package registries
    "registry.npmjs.org"
    "registry.yarnpkg.com"

    # Claude Code / Anthropic
    "api.anthropic.com"
    "statsig.anthropic.com"
    "statsig.com"
    "sentry.io"

    # VS Code
    "marketplace.visualstudio.com"
    "vscode.blob.core.windows.net"
    "update.code.visualstudio.com"

    # Foundry/Forge
    "raw.githubusercontent.com"
    "crates.io"
    "static.crates.io"
)

# === Green Goods Specific Domains ===
PROJECT_DOMAINS=(
    # Storacha (IPFS storage)
    "storacha.link"
    "up.storacha.network"
    "w3s.link"

    # Pimlico (passkey smart accounts)
    "api.pimlico.io"

    # Reown/WalletConnect
    "cloud.reown.com"
    "relay.walletconnect.com"
    "relay.walletconnect.org"
    "verify.walletconnect.com"
    "verify.walletconnect.org"
    "explorer-api.walletconnect.com"
    "pulse.walletconnect.org"

    # PostHog (analytics)
    "app.posthog.com"
    "us.i.posthog.com"
    "eu.i.posthog.com"

    # Envio (indexer)
    "envio.dev"
    "api.envio.dev"

    # Blockchain RPCs
    "sepolia.base.org"
    "mainnet.base.org"
    "arb1.arbitrum.io"
    "forno.celo.org"
    "mainnet.optimism.io"
    "ethereum-sepolia.publicnode.com"
    "rpc.ankr.com"
    "cloudflare-eth.com"

    # Telegram (agent)
    "api.telegram.org"

    # Etherscan-family APIs (contract verification, explorers)
    # NOTE:
    #   - These endpoints (Etherscan, Basescan, Arbiscan, Celoscan, etc.)
    #     normally require API keys and enforce rate limits.
    #   - This firewall script only whitelists network access; it does NOT
    #     validate API keys or configure rate limiting.
    #   - For production use, ensure API keys are provided via environment
    #     variables (for example in a .env file) and never hard-coded in
    #     source code or this script.
    "api.etherscan.io"
    "api-sepolia.basescan.org"
    "api.arbiscan.io"
    "api.celoscan.io"

    # Bun
    "bun.sh"
    "registry.npmmirror.com"
)

# Combine all domains
ALL_DOMAINS=("${CORE_DOMAINS[@]}" "${PROJECT_DOMAINS[@]}")

# Resolve and add all allowed domains
echo "📡 Resolving allowed domains..."
for domain in "${ALL_DOMAINS[@]}"; do
    echo -n "   $domain: "
    # Use timeout to prevent hanging on unresponsive DNS
    ips=$(timeout 5 dig +noall +answer +time=2 +tries=2 A "$domain" 2>/dev/null | awk '$4 == "A" {print $5}')
    if [ -z "$ips" ]; then
        echo "⚠️  no A record (skipping)"
        continue
    fi

    count=0
    while read -r ip; do
        if [[ "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
            ipset add allowed-domains "$ip" 2>/dev/null || true
            count=$((count + 1))
        fi
    done < <(echo "$ips")
    echo "✅ ($count IPs)"
done

# Get host IP from default route
HOST_IP=$(ip route | grep default | cut -d" " -f3)
if [ -z "$HOST_IP" ]; then
    echo "ERROR: Failed to detect host IP"
    exit 1
fi

HOST_NETWORK=$(echo "$HOST_IP" | sed "s/\.[0-9]*$/.0\/24/")
echo "   Host network detected as: $HOST_NETWORK"

# Set up remaining iptables rules
iptables -A INPUT -s "$HOST_NETWORK" -j ACCEPT
iptables -A OUTPUT -d "$HOST_NETWORK" -j ACCEPT

# Set default policies to DROP first
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT DROP

# First allow established connections for already approved traffic
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Then allow only specific outbound traffic to allowed domains
iptables -A OUTPUT -m set --match-set allowed-domains dst -j ACCEPT

# Explicitly REJECT all other outbound traffic for immediate feedback
iptables -A OUTPUT -j REJECT --reject-with icmp-admin-prohibited

echo ""
echo "🔍 Verifying firewall configuration..."

# Test that blocked domains are actually blocked
if curl --connect-timeout 5 https://example.com >/dev/null 2>&1; then
    echo "   ❌ ERROR: Firewall verification failed - was able to reach example.com"
    exit 1
else
    echo "   ✅ Blocked: example.com (as expected)"
fi

# Verify GitHub API access (should be allowed)
if ! curl --connect-timeout 5 https://api.github.com/zen >/dev/null 2>&1; then
    echo "   ❌ ERROR: Firewall verification failed - unable to reach api.github.com"
    exit 1
else
    echo "   ✅ Allowed: api.github.com"
fi

# Verify npm registry access (should be allowed)
if ! curl --connect-timeout 5 https://registry.npmjs.org/ >/dev/null 2>&1; then
    echo "   ⚠️  Warning: Unable to reach registry.npmjs.org"
else
    echo "   ✅ Allowed: registry.npmjs.org"
fi

echo ""
echo "🔒 Firewall configuration complete!"
echo "   Only whitelisted domains are accessible."
echo "   Run 'claude --dangerously-skip-permissions' for unattended operation."
echo ""
