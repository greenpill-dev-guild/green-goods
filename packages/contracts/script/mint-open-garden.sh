#!/bin/bash
# Mint the "Green Goods Open Garden" to Arbitrum
# This garden will have tokenId 1 and therefore openJoining = true

set -e

echo "🌱 Minting Green Goods Open Garden to Arbitrum..."

# Determine the script directory and navigate to contracts directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
CONTRACTS_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_DIR="$(dirname "$(dirname "$CONTRACTS_DIR")")"
ENV_FILE="$ROOT_DIR/.env"

# Navigate to contracts directory
cd "$CONTRACTS_DIR"
echo "Working directory: $(pwd)"

# Load environment variables from .env file
# Properly handle comments and special characters
if [ -f "$ENV_FILE" ]; then
  set -a  # Automatically export all variables
  source <(grep -v '^#' "$ENV_FILE" | sed 's/#.*//' | sed '/^$/d')
  set +a
  echo "✅ Loaded environment variables from $ENV_FILE"
else
  echo "❌ Error: .env file not found at $ENV_FILE"
  exit 1
fi

# Garden configuration from gardens.json (index 1)
export GARDEN_NAME="Green Goods Open Garden"
export GARDEN_DESCRIPTION="The open garden for all Green Goods participants. This is the open garden that serves as the entry point for new users and community activities. All participants can join this garden and engage with the platform."
export GARDEN_LOCATION="Mama Earth"
export GARDEN_BANNER="QmS8mL4x9fnNutV63pSfwRhhVgoVpw4gaDCCGaTpv6oMGW"

# Contract addresses from deployment
export GARDEN_TOKEN="0x3DEc3c42C5872a86Fb0e60A4AaDD7aD51CaF076a"
export COMMUNITY_TOKEN="0xaf88d065e77c8cC2239327C5EDb3A432268e5831" # USDC on Arbitrum

# Gardeners array (JSON format)
export GARDENERS='["0xa9d20b435A85fAAa002f32d66F7D21564130E9cf","0x6166E1964447E0959bC7c8d543DB3ab82dB65044","0x476E2651BF97dE8a26e4A05a9c8e00A6EFa1390c","0x23fBb98BBa894b2de086350bD60ef39860e92e43","0x3f649DbFAFBE454940B8a82c5058b8d176dD3871"]'

# Operators array (JSON format)
export OPERATORS='["0x2aa64E6d80390F5C017F0313cB908051BE2FD35e","0xAcD59e854adf632d2322404198624F757C868C97","0xED47B5f719eA74405Eb96ff700C11D1685b953B1","0x5c79d252F458b3720f7f230f8490fd1eE81d32FB","0xbaD8bcc9Eb5749829cF12189fDD5c1230D6C85e8","0x5F56E995e8D3bd05a70a63f0d7531437e873772e","0x560F876431dfA6eFe1aaf9fAa0D3A4512782DD8c"]'

echo ""
echo "📋 Garden Configuration:"
echo "  Name: $GARDEN_NAME"
echo "  Location: $GARDEN_LOCATION"
echo "  Community Token: $COMMUNITY_TOKEN"
echo "  Garden Token Contract: $GARDEN_TOKEN"
echo ""

# Run the deployment script
forge script script/DeployGarden.s.sol:DeployGarden \
  --rpc-url https://arb1.arbitrum.io/rpc \
  --account green-goods-deployer \
  --broadcast \
  --verify \
  -vvv

echo ""
echo "✅ Garden minted successfully!"
echo ""
echo "⚠️  IMPORTANT: Update deployments/42161-latest.json with the new root garden address"
echo "   Run: cast call $GARDEN_TOKEN 'ownerOf(uint256)(address)' 1 --rpc-url https://arb1.arbitrum.io/rpc"
echo "   to verify the new garden was created"

