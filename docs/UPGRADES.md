# Contract Upgrade Guide

## Deploy vs Upgrade

**This guide covers UUPS proxy upgrades only.**

For fresh deployments with new addresses, see [DEPLOYMENT.md](./DEPLOYMENT.md).

| Action | Command | Creates New Addresses? |
|--------|---------|----------------------|
| Deploy | `pnpm deploy:testnet` | ✅ Yes |
| Upgrade | `pnpm upgrade:testnet` | ❌ No (same addresses) |

If you're unsure which to use, see the [Deploy vs Upgrade Decision Matrix](./DEPLOYMENT.md#deploy-vs-upgrade-workflows).

## Overview

All Green Goods contracts use the UUPS (Universal Upgradeable Proxy Standard) pattern, allowing contract logic to be upgraded while preserving state and addresses.

## Storage Safety

All upgradeable contracts include storage gaps (`__gap`) to ensure safe upgrades:
- **ActionRegistry**: 47 slots reserved
- **GardenToken**: 47 slots reserved
- **WorkResolver**: 49 slots reserved
- **WorkApprovalResolver**: 49 slots reserved
- **DeploymentRegistry**: 46 slots reserved

Storage gaps allow new state variables to be added in future upgrades without breaking the storage layout.

## Upgrade Process

### Prerequisites

1. **Foundry keystore** with owner/multisig access
2. **Sufficient gas** on target network
3. **Verified deployment addresses** in `deployments/{chainId}-latest.json`

### Quick Upgrade

```bash
# Upgrade all contracts on testnet
pnpm upgrade:testnet

# Upgrade all contracts on mainnet
pnpm upgrade:celo
pnpm upgrade:arbitrum
```

### Individual Contract Upgrades

```bash
# Upgrade specific contract
node script/upgrade.js action-registry --network baseSepolia --broadcast
node script/upgrade.js garden-token --network baseSepolia --broadcast
node script/upgrade.js work-resolver --network baseSepolia --broadcast
node script/upgrade.js assessment-resolver --network baseSepolia --broadcast
```

### Verify Upgrade

After upgrading, verify the new implementation:

```bash
# Check implementation address (ERC1967 storage slot)
cast call <PROXY_ADDRESS> \
  "0x5c60da1b" \
  --rpc-url $BASE_SEPOLIA_RPC_URL

# Verify contract still works
cast call <PROXY_ADDRESS> "owner()(address)" \
  --rpc-url $BASE_SEPOLIA_RPC_URL
```

## Multisig Upgrades

If contract ownership has been transferred to a multisig (Safe):

### 1. Deploy New Implementation

```bash
# Deploy new implementation only (no upgrade)
forge create src/registries/Action.sol:ActionRegistry \
  --account green-goods-deployer \
  --rpc-url baseSepolia
```

### 2. Generate Upgrade Transaction Data

```bash
cast calldata "upgradeTo(address)" <NEW_IMPL_ADDRESS>
```

### 3. Create Safe Transaction

1. Go to Safe web interface
2. Create new transaction:
   - **To**: Proxy contract address
   - **Value**: 0
   - **Data**: Calldata from step 2
3. Submit and collect required signatures
4. Execute when threshold reached

## Upgrade Safety Checklist

Before executing any upgrade:

- [ ] All tests pass on new implementation (`forge test`)
- [ ] Storage layout validated (no conflicts)
- [ ] Dry run successful on target network
- [ ] New implementation deployed and verified on explorer
- [ ] Multisig coordination complete (if applicable)
- [ ] Backup of current implementation address
- [ ] Rollback plan documented

## Rollback

If an upgrade introduces issues, you can rollback to the previous implementation:

```bash
# Get previous implementation address from deployment history
cast call <PROXY_ADDRESS> \
  "0x5c60da1b" \
  --rpc-url $RPC_URL

# Upgrade back to previous implementation
# (requires modifying Upgrade.s.sol to specify address)
```

For multisig-owned contracts, create a Safe transaction with the previous implementation address.

## Common Issues

### "Ownable: caller is not the owner"

**Cause**: Current deployer doesn't have upgrade rights.

**Solution**:
- Verify correct keystore account is being used
- If ownership transferred to multisig, use multisig upgrade process
- Check proxy owner: `cast call <PROXY> "owner()(address)"`

### "ERC1967Upgrade: new implementation is not UUPS"

**Cause**: New implementation missing UUPS functions.

**Solution**:
- Verify contract inherits from `UUPSUpgradeable`
- Check `_authorizeUpgrade` function exists
- Ensure constructor calls `_disableInitializers()`

### "Address: low-level delegate call failed"

**Cause**: Implementation has initialization issues.

**Solution**:
- Verify constructor properly disables initializers
- Check no `initialize()` call during deployment
- Review constructor parameters match expected values

### "Function selector was not recognized"

**Cause**: Trying to call implementation directly instead of through proxy.

**Solution**:
- Always interact with proxy address, not implementation
- Use addresses from `deployments/{chainId}-latest.json`

## Storage Gap Usage

When adding new state variables in an upgrade:

```solidity
contract ActionRegistry is UUPSUpgradeable, OwnableUpgradeable {
    // Existing variables
    uint256 private _nextActionUID;
    mapping(uint256 => address) public actionToOwner;
    mapping(uint256 => Action) public idToAction;
    
    // NEW: Add your new variable
    mapping(uint256 => bool) public actionPaused;
    
    // Reduce gap by 1 (was 47, now 46)
    uint256[46] private __gap;
}
```

**Important**: Always reduce gap size to compensate for new variables!

## Testing Upgrades

### Local Testing

```bash
# Start local node
anvil

# Deploy contracts
npm run deploy:local

# Make changes to contract
# ... edit src/registries/Action.sol ...

# Test upgrade
npm run upgrade:action-registry -- --network localhost --broadcast

# Verify upgrade worked
cast call <PROXY> "owner()(address)" --rpc-url http://localhost:8545
```

### Testnet Testing

Always test on testnet before mainnet:

1. Deploy to Base Sepolia
2. Use contracts for a few days
3. Perform upgrade on testnet
4. Verify all functionality works
5. Only then proceed to mainnet

## Network-Specific Notes

### Base Sepolia

- RPC: `https://sepolia.base.org`
- Explorer: `https://sepolia.basescan.org`
- Chain ID: 84532

### Celo

- RPC: `https://forno.celo.org`
- Explorer: `https://explorer.celo.org`
- Chain ID: 42220

## Best Practices

1. **Always dry-run first**: Test upgrade without broadcasting
2. **Verify on explorer**: Check implementation address after upgrade
3. **Monitor after upgrade**: Watch for unusual activity or errors
4. **Document changes**: Keep changelog of what changed in each upgrade
5. **Incremental upgrades**: Don't change too much at once
6. **Test thoroughly**: Comprehensive testing before production upgrades
7. **Have rollback plan**: Know how to revert if issues arise

## Schema Evolution Strategy

### Overview

Green Goods uses EAS (Ethereum Attestation Service) schemas for on-chain attestations. The current implementation provides a solid foundation that can be extended in future versions.

### Current Schema Implementations

**Current Schemas (see src/Schemas.sol):**
```solidity
struct WorkSchema {
    uint256 actionUID;
    string title;
    string feedback;
    string metadata;
    string[] media;
}

struct WorkApprovalSchema {
    uint256 actionUID;
    bytes32 workUID;
    bool approved;
    string feedback;
}

struct AssessmentSchema {
    string title;
    string description;
    string assessmentType;
    string[] capitals;
    string metricsJSON;
    string[] evidenceMedia;
    string[] reportDocuments;
    bytes32[] impactAttestations;
    uint256 startDate;
    uint256 endDate;
    string location;
    string[] tags;
}
```

### Future Schema Evolution

When schemas need to evolve:

1. **Deploy new schema** with additional fields to EAS registry
2. **Deploy new resolver** (or upgrade existing via UUPS proxy)
3. **Update frontend/indexer** to handle new schema format
4. **Maintain backward compatibility** by supporting old schema UIDs

**Example future extension:**
```solidity
// Extended schema with additional field
struct WorkSchemaV2 {
    uint8 version;  // Add version field for future tracking
    uint256 actionUID;
    string title;
    string feedback;
    string metadata;
    string[] media;
    uint256 estimatedHours;  // NEW field
}
```

### Proxy Resolver Benefits

All resolvers are deployed as UUPS proxies, enabling:

- **Logic updates** without schema redeployment
- **Bug fixes** in validation logic
- **Feature additions** to resolver functionality
- **Consistent addresses** for client integrations

## Resources

- [OpenZeppelin UUPS Documentation](https://docs.openzeppelin.com/contracts/4.x/api/proxy#UUPSUpgradeable)
- [EIP-1967: Proxy Storage Slots](https://eips.ethereum.org/EIPS/eip-1967)
- [Foundry Book: Scripting](https://book.getfoundry.sh/tutorials/solidity-scripting)
- [EAS Schema Registry](https://docs.attest.sh/docs/core--concepts/schemas)

