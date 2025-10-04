# Garden Contract Redeployment Guide

## Overview
The Garden Token contract has been updated to support allowlist-based minting via the Deployment Registry, enabling broader access to garden creation beyond just the contract owner.

## Changes Made

### 1. GardenToken Contract Updates (`src/tokens/Garden.sol`)

**Key Changes:**
- Added `DeploymentRegistry` import and integration
- Added `deploymentRegistry` state variable
- Modified `initialize()` to accept deployment registry address
- Added `setDeploymentRegistry()` function for updates
- Replaced `onlyOwner` modifier with `onlyAuthorizedMinter` modifier
- New modifier checks both owner and deployment registry allowlist

**New Authorization Flow:**
```solidity
modifier onlyAuthorizedMinter() {
    if (owner() != msg.sender) {
        if (deploymentRegistry == address(0)) {
            revert DeploymentRegistryNotConfigured();
        }
        
        try DeploymentRegistry(deploymentRegistry).isInAllowlist(msg.sender) returns (bool isAllowed) {
            if (!isAllowed) {
                revert UnauthorizedMinter();
            }
        } catch {
            revert UnauthorizedMinter();
        }
    }
    _;
}
```

### 2. Deploy Script Updates (`script/Deploy.s.sol`)

- Updated `deployGardenToken()` to accept deployment registry parameter
- Modified initialization to connect garden token with deployment registry

### 3. Indexer Dynamic Contract Registration (`packages/indexer/`)

**EventHandlers.ts:**
- Added `contractRegister` handler for `GardenMinted` events
- Automatically registers new garden account contracts when gardens are created
- Enables proper event listening for dynamically created garden accounts

**config.yaml:**
- Updated GardenAccount contract configuration to support dynamic registration
- Removed static address requirement (addresses registered at runtime)

## Deployment Instructions

### Step 1: Deploy Updated Contracts

For each target network (Celo, Base Sepolia, etc.):

```bash
cd packages/contracts

# Deploy to Celo mainnet
node script/deploy.js core --network celo --broadcast --verify

# Deploy to Base Sepolia testnet  
node script/deploy.js core --network baseSepolia --broadcast --verify
```

### Step 2: Update Deployment Registry Allowlist

After deployment, add authorized addresses to the deployment registry allowlist:

```bash
# Using the deployment registry via admin interface
# Or via script with owner key
```

### Step 3: Restart Indexer

```bash
cd packages/indexer
# Restart the indexer to pick up dynamic contract registration
envio start
```

## Permission Model

### Before (Owner Only)
- Only the GardenToken contract owner could mint gardens
- Typically the multisig address

### After (Allowlist Based)
- Contract owner can still mint gardens
- Anyone in the deployment registry allowlist can mint gardens
- Deployment registry owner controls the allowlist
- More decentralized and flexible access control

## Admin Dashboard Integration

The admin dashboard now includes:
- ✅ Left-aligned chain selector in header
- ✅ Garden creation available to all users (not just deployers)
- ✅ Fixed loading skeleton padding
- ✅ New Deployment page for contract management
- ✅ Improved theme toggle functionality
- ✅ Fixed deployment registry error handling

## Benefits

1. **Decentralized Garden Creation**: Multiple trusted parties can create gardens
2. **Flexible Permission Management**: Easy to add/remove authorized minters
3. **Better UX**: Users don't need to be contract owners to create gardens
4. **Scalability**: Supports growth without requiring multisig approval for each garden
5. **Dynamic Indexing**: Proper event listening for all garden account contracts

## Verification

After deployment:

1. Verify deployment registry has correct owner
2. Test garden creation with allowlisted addresses
3. Confirm indexer picks up garden events
4. Check admin dashboard functionality
5. Validate permissions work as expected

## Rollback Plan

If issues occur:
1. Deploy previous version of GardenToken
2. Update deployment addresses
3. Revert to owner-only minting temporarily
4. Investigate and fix issues before re-deploying

## Next Steps

1. Deploy contracts to target networks
2. Configure deployment registry allowlists
3. Update admin dashboard deployment addresses
4. Test full flow end-to-end
5. Monitor indexer for proper event capture
