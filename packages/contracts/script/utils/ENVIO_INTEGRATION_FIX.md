# Envio Integration Fix — Address Corruption Issue

## Problem

When deploying to a single chain (e.g., Celo/42220), the `envio-integration.js` script was corrupting contract addresses on **other chains** (e.g., Arbitrum/42161) by converting them to scientific notation:

```yaml
# Before (corrupted):
- id: 42161
  start_block: 0
  contracts:
    - name: ActionRegistry
      address: 1.2405109193728882e+48  # ❌ Scientific notation!
```

This happened because:
1. `js-yaml` was loading hex addresses and interpreting them as numbers
2. When writing back the YAML, numbers were converted to scientific notation
3. The script was rewriting the **entire** config, not just the updated chain

## Solution

Fixed in `envio-integration.js`:

### 1. Use CORE_SCHEMA for YAML Loading
```javascript
const envioConfig = yaml.load(fs.readFileSync(this.envioConfigPath, "utf8"), {
  schema: yaml.CORE_SCHEMA,
});
```

### 2. Ensure Addresses Are Strings
```javascript
const networkConfig = {
  id: targetChainId,
  start_block: this.getStartBlock(chainId),
  contracts: [
    {
      name: "ActionRegistry",
      address: String(deployment.actionRegistry), // Ensure string
    },
    // ...
  ],
};
```

### 3. Detect and Warn About Corrupted Data
```javascript
envioConfig.networks.forEach((network) => {
  if (network.contracts) {
    network.contracts.forEach((contract) => {
      if (contract.address !== undefined && typeof contract.address !== 'string') {
        console.warn(`⚠️  Converting corrupted address for ${contract.name} on chain ${network.id}`);
        contract.address = String(contract.address);
      }
    });
  }
});
```

### 4. Use Proper YAML Dump Options
```javascript
yaml.dump(envioConfig, {
  lineWidth: -1,
  sortKeys: false,
  quotingType: '"',
  noRefs: true,
  replacer: (key, value) => {
    if (key === 'address' && typeof value === 'string') {
      return value; // Keep as string
    }
    return value;
  },
});
```

## Fixed Files

1. **`packages/indexer/config.yaml`** — Restored correct Arbitrum addresses
2. **`packages/indexer/config.yaml.backup`** — Added quotes to prevent future corruption
3. **`packages/contracts/script/utils/envio-integration.js`** — Fixed YAML handling

## Verification

After the fix, running deployment should:
- ✅ Only update the deployed chain's addresses
- ✅ Preserve other chains' addresses as quoted hex strings
- ✅ Warn if corrupted data is detected
- ✅ Maintain proper YAML formatting

## Prevention

**Always ensure** in `config.yaml`:
```yaml
contracts:
  - name: ActionRegistry
    address: "0x..." # ✅ Quoted hex string
```

**Never:**
```yaml
contracts:
  - name: ActionRegistry
    address: 0x...     # ❌ Unquoted (can be interpreted as number)
    address: 1.23e+48  # ❌ Scientific notation (corrupted)
```

## Testing

Test the fix with:
```bash
# Deploy to a chain (e.g., Celo)
bun deploy:celo

# Verify config.yaml maintains proper formatting
cat packages/indexer/config.yaml | grep "address:"

# All addresses should be quoted: address: "0x..."
```

## Recovery from Corrupted Addresses

If addresses get corrupted again:

1. Check deployment JSON for correct addresses:
   ```bash
   cat packages/contracts/deployments/42161-latest.json
   ```

2. Manually restore in `config.yaml`:
   ```yaml
   - id: 42161
     start_block: 0
     contracts:
       - name: ActionRegistry
         address: "0xd94a6ef8A3f685dEdc7d69304564F8497e32cB1c"
       - name: GardenToken
         address: "0x89Cc1aB4dE7b9e837E4935EAa1f170eF46E0A6A7"
       - name: GardenAccount
         address: "0x62aae8bfAeC3a3e858ad05c21096f47dF16D9668"
   ```

3. Run indexer codegen:
   ```bash
   cd packages/indexer
   bun codegen
   ```

---

**Date:** 2025-10-15  
**Fixed by:** AI Agent (Cursor)  
**Affected Deployments:** Celo (42220), Arbitrum (42161)

