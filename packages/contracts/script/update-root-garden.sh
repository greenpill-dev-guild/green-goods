#!/bin/bash
# Update the root garden reference to the new "Open Garden" with tokenId 1
# Run this AFTER successfully minting the new garden

set -e

GARDEN_TOKEN="0x3DEc3c42C5872a86Fb0e60A4AaDD7aD51CaF076a"
RPC_URL="https://arb1.arbitrum.io/rpc"
CHAIN_ID="42161"

echo "🔍 Checking for new garden with tokenId 1..."

# Check if tokenId 1 exists
OWNER=$(cast call "$GARDEN_TOKEN" "ownerOf(uint256)(address)" 1 --rpc-url "$RPC_URL" 2>/dev/null || echo "")

if [ -z "$OWNER" ] || [ "$OWNER" = "0x0000000000000000000000000000000000000000" ]; then
  echo "❌ Garden with tokenId 1 not found. Please mint the garden first."
  echo ""
  echo "Run the mint command provided earlier, then run this script again."
  exit 1
fi

echo "✅ Found garden with tokenId 1, owned by: $OWNER"

# Get the garden account address for tokenId 1
echo "🔍 Getting garden account address..."

# The garden account is derived from the TBA registry
# We'll use cast to call the garden token to get the account
GARDEN_ACCOUNT=$(cast call "$GARDEN_TOKEN" "token()(uint256,address,uint256)" --rpc-url "$RPC_URL" | head -1)

# Actually, we need to compute it or get it from events. Let me get it from the last GardenMinted event
echo "🔍 Fetching GardenMinted event for tokenId 1..."

# Get the latest block
LATEST_BLOCK=$(cast block-number --rpc-url "$RPC_URL")
FROM_BLOCK=$((LATEST_BLOCK - 10000))  # Search last 10k blocks

# Get GardenMinted event for tokenId 1
# Event signature: GardenMinted(uint256 indexed tokenId, address indexed account, string name, ...)
EVENT_SIG="0x" # GardenMinted event topic
GARDEN_ACCOUNT=$(cast logs \
  --from-block "$FROM_BLOCK" \
  --to-block latest \
  --address "$GARDEN_TOKEN" \
  --rpc-url "$RPC_URL" \
  | grep -A 20 "tokenId: 1" | grep "account:" | awk '{print $2}' | head -1)

if [ -z "$GARDEN_ACCOUNT" ]; then
  echo "⚠️  Could not automatically find garden account address from events."
  echo "Please provide it manually or check the transaction receipt."
  read -p "Enter the garden account address: " GARDEN_ACCOUNT
fi

echo "📍 Garden Account Address: $GARDEN_ACCOUNT"

# Verify openJoining is true
echo "🔍 Verifying openJoining status..."
OPEN_JOINING=$(cast call "$GARDEN_ACCOUNT" "openJoining()(bool)" --rpc-url "$RPC_URL")

if [ "$OPEN_JOINING" = "true" ]; then
  echo "✅ openJoining is TRUE - Perfect!"
else
  echo "❌ openJoining is FALSE - This shouldn't happen for tokenId 1!"
  echo "Contract logic should auto-enable for tokenId 1."
  exit 1
fi

# Update the deployment file
echo "📝 Updating deployments/${CHAIN_ID}-latest.json..."

DEPLOYMENT_FILE="deployments/${CHAIN_ID}-latest.json"

# Use jq to update the rootGarden section
TMP_FILE=$(mktemp)
jq ".rootGarden.address = \"$GARDEN_ACCOUNT\" | .rootGarden.tokenId = 1" "$DEPLOYMENT_FILE" > "$TMP_FILE"
mv "$TMP_FILE" "$DEPLOYMENT_FILE"

echo "✅ Updated deployment file!"
echo ""
echo "📋 New Root Garden Configuration:"
echo "   Address: $GARDEN_ACCOUNT"
echo "   TokenId: 1"
echo "   Open Joining: true"
echo ""
echo "🎉 Root garden update complete!"
echo ""
echo "Next steps:"
echo "1. Commit the updated deployment file"
echo "2. Test that new users can auto-join the root garden"
echo "3. Test that work submission now succeeds"

