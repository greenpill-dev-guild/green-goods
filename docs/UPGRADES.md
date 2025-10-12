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
- **GardenAccount**: 35 slots reserved
- **WorkResolver**: 49 slots reserved
- **WorkApprovalResolver**: 49 slots reserved
- **AssessmentResolver**: 49 slots reserved
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

## Resolver-Specific Upgrades

### Immutable Resolver Addresses

GardenAccount contracts use **immutable resolver addresses** for security and gas efficiency. When resolvers are upgraded (e.g., WorkApprovalResolver or AssessmentResolver), a new GardenAccount implementation must be deployed with the updated addresses.

### Why Immutable Resolvers?

**Benefits:**
- Gas savings: ~2100 gas per `createProjectImpact()` call (no SLOAD)
- Security: Addresses cannot be changed after deployment
- Transparency: Resolver addresses are verifiable on-chain

**Trade-off:**
- Resolver upgrades require deploying new GardenAccount implementation
- Gardens must individually opt-in to upgrade their proxies

### When to Upgrade GardenAccount

Deploy a new GardenAccount implementation when:

1. **Resolver Logic Changes**: WorkApprovalResolver or AssessmentResolver contracts are upgraded
2. **Security Patches**: Critical fixes to resolver contracts
3. **Feature Additions**: New resolver functionality that gardens should adopt

**Note:** Gardens can continue using old resolvers indefinitely. Upgrades are opt-in.

### Resolver Upgrade Process

#### Step 1: Deploy New Resolvers (if needed)

```bash
# Example: Upgrade WorkApprovalResolver
cd packages/contracts
node script/upgrade.js work-approval-resolver --network arbitrum --broadcast
```

#### Step 2: Deploy New GardenAccount Implementation

```bash
# Deploy with new resolver addresses
forge script script/Upgrade.s.sol:Upgrade \
  --sig "deployNewGardenAccountImplementation(address,address)" \
  <NEW_WORK_APPROVAL_RESOLVER> \
  <NEW_ASSESSMENT_RESOLVER> \
  --rpc-url $ARBITRUM_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast
```

This deploys a **new** GardenAccount implementation. Existing gardens are unaffected.

#### Step 3: Verify New Implementation

```bash
# Check resolver addresses in new implementation
cast call <NEW_GARDEN_ACCOUNT_IMPL> "WORK_APPROVAL_RESOLVER()(address)" --rpc-url $ARBITRUM_RPC_URL
cast call <NEW_GARDEN_ACCOUNT_IMPL> "ASSESSMENT_RESOLVER()(address)" --rpc-url $ARBITRUM_RPC_URL
```

#### Step 4: Gardens Opt-In to Upgrade

**Option A: Single Garden Upgrade**

Each garden owner can upgrade their proxy:

```bash
forge script script/Upgrade.s.sol:Upgrade \
  --sig "upgradeGardenProxy(address,address)" \
  <GARDEN_PROXY_ADDRESS> \
  <NEW_IMPLEMENTATION> \
  --rpc-url $ARBITRUM_RPC_URL \
  --private-key $GARDEN_OWNER_KEY \
  --broadcast
```

**Option B: Batch Upgrade (Governance)**

If Green Goods governance controls multiple gardens:

```bash
forge script script/Upgrade.s.sol:Upgrade \
  --sig "batchUpgradeGardens(address[],address)" \
  "[<GARDEN1>,<GARDEN2>,<GARDEN3>]" \
  <NEW_IMPLEMENTATION> \
  --rpc-url $ARBITRUM_RPC_URL \
  --private-key $GOVERNANCE_KEY \
  --broadcast
```

### Backward Compatibility

**Old Resolvers Continue Working:**

Gardens using old GardenAccount implementations will:
- ✅ Continue creating work approvals with old resolvers
- ✅ Continue creating GAP attestations (if old resolvers support it)
- ✅ Function normally without any disruption

**Migration Timeline:**

Recommended approach:

1. **Month 1-2**: Deploy new implementation, announce upgrade
2. **Month 3-6**: Gardens gradually opt-in to upgrade
3. **Month 6+**: Monitor adoption, old resolvers eventually deprecated

**Checking Garden Implementation:**

```bash
# Check which implementation a garden is using
forge script script/Upgrade.s.sol:Upgrade \
  --sig "checkGardenImplementation(address)" \
  <GARDEN_PROXY> \
  --rpc-url $ARBITRUM_RPC_URL
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

## Upgrade Scenarios

### Scenario 1: Security Patch in Resolver

**Problem:** Critical vulnerability in WorkApprovalResolver

**Solution:**
1. Deploy patched WorkApprovalResolver
2. Deploy new GardenAccount implementation with patched resolver
3. Coordinate with garden operators to upgrade within 48 hours
4. Disable old resolver (if possible) to force migration

### Scenario 2: Feature Addition

**Problem:** Adding milestone support via AssessmentResolver

**Solution:**
1. Deploy enhanced AssessmentResolver
2. Deploy new GardenAccount implementation
3. Gardens upgrade at their own pace to gain new features
4. Old gardens continue functioning without milestones

### Scenario 3: Multi-Chain Deployment

**Problem:** Deploying to new chain with updated resolvers

**Solution:**
1. Deploy all contracts with latest resolver versions
2. No migration needed - clean deployment

## Upgrade Safety Checklist

Before executing any upgrade:

- [ ] All tests pass on new implementation (`forge test`)
- [ ] Storage layout validated (no conflicts)
- [ ] Dry run successful on target network
- [ ] New implementation deployed and verified on explorer
- [ ] Multisig coordination complete (if applicable)
- [ ] Backup of current implementation address
- [ ] Rollback plan documented
- [ ] Resolver addresses verified (for GardenAccount upgrades)
- [ ] Storage gap properly maintained

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

### "Only owner can upgrade" (Garden-specific)

**Cause:** Attempting to upgrade garden from non-owner address

**Solution:** Use garden owner's private key or multisig

### "Implementation address mismatch"

**Cause:** Trying to use implementation from different chain

**Solution:** Deploy chain-specific implementation

### "GAP attestations failing after upgrade"

**Cause:** New resolver addresses incorrect

**Solution:** Verify resolver addresses match deployed contracts

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

### GardenAccount Storage Safety

✅ **What's Safe:**
- **Immutables don't affect storage**: Resolver addresses stored in bytecode
- **Storage layout unchanged**: All state variables remain in same slots
- **UUPS pattern preserved**: Upgrade mechanism works identically

✅ **Verify Before Upgrading:**

```solidity
// Storage gap is maintained
uint256[35] private __gap;

// State variables in same order
address public communityToken;     // Slot 0
string public name;                // Slot 1
string public description;         // Slot 2
// ... etc
bytes32 public gapProjectUID;      // Slot 12
```

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

**Garden-Specific Testing:**

```bash
# 1. Deploy to Base Sepolia
pnpm deploy:testnet

# 2. Create test garden
node script/deploy.js garden --network baseSepolia --broadcast

# 3. Deploy new implementation with test resolvers
forge script script/Upgrade.s.sol:Upgrade \
  --sig "deployNewGardenAccountImplementation(address,address)" \
  <TEST_RESOLVER_1> <TEST_RESOLVER_2> \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --broadcast

# 4. Upgrade test garden
forge script script/Upgrade.s.sol:Upgrade \
  --sig "upgradeGardenProxy(address,address)" \
  <TEST_GARDEN> <NEW_IMPL> \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --broadcast

# 5. Verify work approval flow still works
# Submit work, approve work, check GAP attestation
```

### Fork Testing

```bash
# Test upgrade on Arbitrum fork
pnpm test:gap:fork:arbitrum

# Verify:
# - Old gardens continue working
# - Upgraded gardens use new resolvers
# - GAP attestations created correctly
```

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

## Governance Considerations

### Who Can Upgrade?

**Contract Owner:** Can upgrade ActionRegistry, GardenToken, etc.

**Garden Owner:** Can upgrade their own garden proxy at any time

**Governance/Multisig:** Can upgrade gardens they control (e.g., root garden)

**Individual Operators:** Cannot upgrade (requires owner signature)

### Governance Proposal Template

```markdown
# Proposal: Upgrade GardenAccount Implementation

## Summary
Deploy new GardenAccount implementation with updated resolver addresses.

## Motivation
- [Security patch / new feature / bug fix]
- Affects: WorkApprovalResolver and/or AssessmentResolver

## Specification
- New WorkApprovalResolver: 0x...
- New AssessmentResolver: 0x...
- New GardenAccount Implementation: 0x...

## Timeline
- Week 1: Deploy new implementation
- Week 2-4: Gardens opt-in to upgrade
- Week 5+: Monitor adoption

## Backward Compatibility
- Old gardens continue functioning
- No forced migration
- Opt-in upgrade process

## Risks
- Low: Storage layout unchanged
- Low: UUPS pattern preserved
- Medium: Coordination needed for security patches
```

## Monitoring

### Track Adoption

Query adoption rate:

```javascript
// Check how many gardens use new implementation
const gardens = await getAllGardens();
const newImplCount = 0;
for (const garden of gardens) {
  const impl = await getImplementation(garden);
  if (impl === newImplementation) newImplCount++;
}
console.log(`Adoption: ${newImplCount}/${gardens.length} (${(newImplCount/gardens.length*100).toFixed(1)}%)`);
```

### Event Monitoring

Monitor upgrade events:

```solidity
event Upgraded(address indexed implementation);
```

Set up alerts for:
- New GardenAccount implementations deployed
- Garden proxies upgraded
- Resolver-related failures
- Failed attestations after upgrade

## Network-Specific Notes

### Base Sepolia

- RPC: `https://sepolia.base.org`
- Explorer: `https://sepolia.basescan.org`
- Chain ID: 84532

### Celo

- RPC: `https://forno.celo.org`
- Explorer: `https://explorer.celo.org`
- Chain ID: 42220

### Arbitrum

- RPC: `https://arb1.arbitrum.io/rpc`
- Explorer: `https://arbiscan.io`
- Chain ID: 42161

## Best Practices

1. **Always dry-run first**: Test upgrade without broadcasting
2. **Verify on explorer**: Check implementation address after upgrade
3. **Monitor after upgrade**: Watch for unusual activity or errors
4. **Document changes**: Keep changelog of what changed in each upgrade
5. **Incremental upgrades**: Don't change too much at once
6. **Test thoroughly**: Comprehensive testing before production upgrades
7. **Have rollback plan**: Know how to revert if issues arise
8. **Verify resolver addresses**: For GardenAccount upgrades, double-check resolver addresses
9. **Coordinate migrations**: For critical security patches, coordinate with garden operators
10. **Track adoption**: Monitor which gardens have upgraded to new implementations

## Resources

- [OpenZeppelin UUPS Documentation](https://docs.openzeppelin.com/contracts/4.x/api/proxy#UUPSUpgradeable)
- [EIP-1967: Proxy Storage Slots](https://eips.ethereum.org/EIPS/eip-1967)
- [Foundry Book: Scripting](https://book.getfoundry.sh/tutorials/solidity-scripting)
- [EAS Schema Registry](https://docs.attest.sh/docs/core--concepts/schemas)
- [Karma GAP Implementation](./KARMA_GAP_IMPLEMENTATION.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [Production Readiness](./PRODUCTION_READINESS.md)
