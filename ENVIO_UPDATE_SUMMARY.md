# Envio Configuration Update - Summary

## Overview

Updated Green Goods indexer configuration to match official Envio v2.x documentation standards.

## Files Modified

### 1. `packages/indexer/config.yaml`

**Changes:**
- ✅ Added YAML schema comment for IDE validation
- ✅ Converted from `abi_file_path` to inline event signatures
- ✅ Added full event signatures with parameter types and `indexed` modifiers
- ✅ Set `start_block: 0` for HyperSync auto-detection
- ✅ Removed RPC configuration (now via environment variables)

**Before:**
```yaml
contracts:
  - name: ActionRegistry
    abi_file_path: abis/ActionRegistry.json
    events:
      - event: ActionRegistered
```

**After:**
```yaml
# yaml-language-server: $schema=./node_modules/envio/evm.schema.json
contracts:
  - name: ActionRegistry
    handler: src/EventHandlers.ts
    events:
      - event: ActionRegistered(address owner, uint256 indexed actionUID, ...)
```

### 2. `packages/contracts/script/utils/envio-integration.js`

**Removed Methods:**
- ❌ `updateRpcConfig()` - RPC now via env vars
- ❌ `enableLocalChainConfig()` - No longer needed
- ❌ `disableLocalChainConfig()` - No longer needed
- ❌ `updateLocalChainAddresses()` - No longer needed

**Updated Methods:**
- ✅ `updateEnvioConfig(chainId)` - Removed `useLocalhost` parameter
- ✅ `getStartBlock(chainId)` - Returns 0 for HyperSync auto-detection
- ✅ CLI - Removed obsolete commands

### 3. `packages/contracts/script/deploy.js`

**Changes:**
- ✅ Updated `updateEnvioConfig()` call to remove second parameter
- ✅ Removed local chain cleanup logic
- ✅ Simplified deployment flow

**Before:**
```javascript
await envioIntegration.updateEnvioConfig(chainId, options.network === "localhost");
// ... cleanup handlers for local chain config
```

**After:**
```javascript
await envioIntegration.updateEnvioConfig(chainId);
// No cleanup needed
```

## New Features

### 1. HyperSync Auto-Detection

Setting `start_block: 0` lets Envio's HyperSync automatically find the optimal starting block for indexing, reducing configuration overhead.

### 2. Full Event Signatures

Event signatures now include complete parameter types:
```yaml
- event: GardenMinted(uint256 indexed tokenId, address indexed account, string name, string description, string location, string bannerImage, address[] gardeners, address[] gardenOperators)
```

This eliminates the need for separate ABI files in config.

### 3. Environment-Based RPC

RPC URLs are now configured via environment variables:
```bash
ENVIO_RPC_URL_84532=https://base-sepolia.g.alchemy.com/v2/YOUR_KEY
ENVIO_RPC_URL_42220=https://celo-mainnet.g.alchemy.com/v2/YOUR_KEY
ENVIO_RPC_URL_42161=https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY
```

## Usage

### After Deployment

The deployment script automatically updates the indexer config:
```bash
cd packages/contracts
bun deploy:testnet  # Auto-updates config
```

### Manual Config Update

```bash
# Update specific chain
node packages/contracts/script/utils/envio-integration.js update 84532

# Watch for changes
node packages/contracts/script/utils/envio-integration.js watch
```

### Regenerate Indexer Code

After any config changes:
```bash
cd packages/indexer
pnpm codegen
```

### Start Indexer

```bash
cd packages/indexer
pnpm dev
```

## Testing

### Syntax Validation

Both JavaScript files pass syntax checks:
```bash
✅ node --check envio-integration.js
✅ node --check deploy.js
```

### YAML Schema

The config.yaml includes schema validation:
```yaml
# yaml-language-server: $schema=./node_modules/envio/evm.schema.json
```

IDEs with YAML language server support will provide:
- Autocomplete
- Validation
- Inline documentation

## Benefits

1. **Standard Envio Format**: Matches official v2.x documentation exactly
2. **Automatic Block Detection**: No need to manually find start blocks
3. **Simpler Configuration**: Fewer files, clearer structure
4. **Better IDE Support**: Schema validation and autocomplete
5. **Environment-Based RPC**: Secure, flexible RPC configuration
6. **Reduced Maintenance**: No local chain config management needed

## Migration Notes

### For Existing Deployments

The Arbitrum One (42161) deployment is preserved:
```yaml
- id: 42161
  start_block: 200000000
  contracts:
    - name: ActionRegistry
      address: 0xd94a6ef8A3f685dEdc7d69304564F8497e32cB1c
```

### For New Deployments

New chains will use `start_block: 0` by default:
```yaml
- id: 84532
  start_block: 0  # Auto-detected by HyperSync
```

## References

- **Detailed Migration Guide**: `/packages/indexer/ENVIO_CONFIG_UPDATE.md`
- **Envio Docs**: https://docs.envio.dev/docs/HyperIndex/configuration-file
- **Config Schema**: https://docs.envio.dev/docs/HyperIndex/config-schema-reference

## Next Steps

1. ✅ Configuration files updated
2. ✅ Integration script simplified
3. ✅ Deployment script updated
4. ⏭️ Test with `pnpm codegen` in indexer package
5. ⏭️ Test with new deployment on testnet

## Verification

To verify the changes work:

```bash
# 1. Regenerate indexer code
cd packages/indexer
pnpm codegen

# 2. Start indexer
pnpm dev

# 3. Visit GraphQL playground
open http://localhost:8080
```

If successful, you should see:
- ✅ No codegen errors
- ✅ Indexer starts without errors
- ✅ GraphQL schema matches expected entities
- ✅ Events are being indexed properly

## Rollback

If issues arise, restore from backup:
```bash
cd packages/indexer
cp config.yaml.backup config.yaml
```

The `envio-integration.js` automatically creates backups before modifications.

