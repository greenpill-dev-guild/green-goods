# Green Goods Multi-Chain Deployment Architecture

## Overview

Green Goods uses a **split deployment architecture** where ENS identity infrastructure lives on mainnet while the full protocol operates on L2 chains.

## Chain-Specific Deployments

### 🌐 Mainnet (Chain ID: 1) & Sepolia (11155111)

**Purpose:** ENS Identity Layer

**Deployed Contracts:**
- ✅ `ENSRegistrar` - Manages `greengoods.eth` subdomains
- ✅ `Gardener` logic - Kernel v3 smart account (with ENS support)

**NOT Deployed:**
- ❌ DeploymentRegistry
- ❌ GardenToken / GardenAccount
- ❌ ActionRegistry
- ❌ Work/Approval/Assessment Resolvers
- ❌ Seed data (gardens, actions)

### 🔗 L2 Chains (Arbitrum, Celo, Base Sepolia)

**Purpose:** Full Protocol Operations

**Deployed Contracts:**
- ✅ `DeploymentRegistry` - Central configuration registry
- ✅ `GardenToken` - ERC-721 for gardens
- ✅ `GardenAccount` - Token-bound accounts (TBA) for gardens
- ✅ `AccountGuardian` - Guardian for TBAs
- ✅ `AccountProxy` - Proxy for TBAs
- ✅ `ActionRegistry` - Registry for work actions
- ✅ `WorkResolver` - EAS resolver for work submissions
- ✅ `WorkApprovalResolver` - EAS resolver for work approvals
- ✅ `AssessmentResolver` - EAS resolver for assessments
- ✅ `Gardener` logic - Kernel v3 smart account (with `ENS_REGISTRAR = address(0)`)
- ✅ Seed data (root garden, initial actions)

**NOT Deployed:**
- ❌ ENSRegistrar (mainnet only)

## How It Works

### User Account Creation Flow

1. **Mainnet:** User claims ENS name via `ENSRegistrar`
   ```solidity
   // On mainnet: Gardener has ENS_REGISTRAR set
   gardener.claimENSName("alice", credentialId);
   // Result: alice.greengoods.eth → user's Gardener address
   ```

2. **L2:** Same Gardener address exists via CREATE2
   ```solidity
   // On L2: Gardener has ENS_REGISTRAR = address(0)
   // ENS operations gracefully revert with ENSNotSupportedOnChain
   ```

3. **Cross-Chain:** Same passkey credential ID works on both chains
   - Mainnet: User claims ENS, stores credential ID
   - L2: User interacts with protocol using same account address

### Indexer Configuration

**Envio watches both mainnet and L2s:**

```yaml
networks:
  - id: 1
    name: mainnet
    contracts:
      - name: ENSRegistrar
        events: [SubdomainRegistered]
      - name: Gardener
        events: [ENSClaimed, AccountDeployed]
  
  - id: 42161
    name: arbitrum
    contracts:
      - name: Garden
        events: [GardenMinted, GardenerAdded, ...]
      - name: Gardener
        events: [AccountDeployed]
      # + all other protocol contracts
```

## Deployment Commands

### Deploy to Mainnet (ENS Only)

```bash
# Deploy ENSRegistrar and Gardener logic to mainnet
bun --filter contracts deploy:mainnet

# What gets deployed:
# - ENSRegistrar at 0x... (CREATE2 deterministic)
# - Gardener logic at 0x... (same bytecode as L2)
```

### Deploy to L2 (Full Protocol)

```bash
# Deploy full protocol to Arbitrum
bun --filter contracts deploy:arbitrum

# What gets deployed:
# - All protocol contracts
# - Gardener logic (with ENS_REGISTRAR = address(0))
# - Root garden + seed actions
```

## Key Design Decisions

### ✅ Why Split Architecture?

1. **Real ENS names** - Users get actual `.eth` names that work everywhere
2. **L2 gas efficiency** - Protocol operations stay cheap on L2
3. **Pimlico sponsorship** - Gasless transactions on both mainnet and L2
4. **Same address everywhere** - CREATE2 ensures Gardener has identical address

### ✅ Why Not Deploy Protocol to Mainnet?

- **Gas costs** - Garden/work operations would be expensive on mainnet
- **Protocol focus** - Core protocol designed for L2 scalability
- **Clear separation** - Identity (mainnet) vs operations (L2)

### ✅ Graceful Degradation on L2

`Gardener.sol` checks ENS availability:

```solidity
function claimENSName(...) external onlyOwner {
    if (ENS_REGISTRAR == address(0)) revert ENSNotSupportedOnChain();
    // ... rest of ENS claiming logic
}
```

L2 deployments:
- Constructor receives `address(0)` for ENS registrar
- ENS functions revert with clear error message
- All other Gardener functionality works normally

## Verification

### Check Mainnet Deployment

```bash
# Verify ENSRegistrar is deployed
cast code <ENSRegistrar_ADDRESS> --rpc-url $MAINNET_RPC_URL

# Verify Gardener has ENS support
cast call <GARDENER_LOGIC> "ENS_REGISTRAR()(address)" --rpc-url $MAINNET_RPC_URL
# Should return: ENSRegistrar address
```

### Check L2 Deployment

```bash
# Verify Gardener has NO ENS
cast call <GARDENER_LOGIC> "ENS_REGISTRAR()(address)" --rpc-url $ARBITRUM_RPC_URL
# Should return: 0x0000000000000000000000000000000000000000

# Verify protocol contracts exist
cast code <GARDEN_TOKEN> --rpc-url $ARBITRUM_RPC_URL
cast code <ACTION_REGISTRY> --rpc-url $ARBITRUM_RPC_URL
```

## Future: Adding New L2 Chains

To add support for a new L2 (e.g., Optimism):

1. **Add network config** to `deployments/networks.json`
2. **Deploy protocol** using existing scripts
3. **Update indexer** `config.yaml` to watch new chain
4. **Client** automatically detects new chain from deployment artifacts

No changes needed to mainnet ENS infrastructure!

## Security Considerations

### ✅ Deterministic Addresses (CREATE2)

- Gardener logic deploys to **same address** on all chains
- Users can predict their account address before deployment
- Recovery works across chains (same credential ID)

### ✅ Independent Deployments

- Mainnet compromise doesn't affect L2 protocol
- L2 compromise doesn't affect ENS registry
- Each chain independently upgradeable

### ✅ Pimlico Sponsorship

- Mainnet: Sponsors ENS name claims
- L2: Sponsors protocol interactions
- Both use same paymaster infrastructure

## Troubleshooting

### "ENSNotSupportedOnChain" Error

**Cause:** Trying to claim ENS name on L2

**Fix:** Use mainnet client for ENS operations:
```typescript
// Create mainnet client for ENS
const mainnetClient = createClient({ chain: mainnet });
await mainnetClient.writeContract({
  address: gardenerAddress,
  abi: GARDENER_ABI,
  functionName: 'claimENSName',
  args: [name, credentialId],
});
```

### Gardener Address Mismatch

**Cause:** Different CREATE2 salts or bytecode between chains

**Fix:** Ensure deployment uses same:
- Salt: `keccak256("greenGoodsCleanDeploy2025:6")`
- Factory: `0x...` (same deterministic factory)
- Bytecode: Identical Gardener constructor params

## References

- [Contracts Handbook](../docs/CONTRACTS_HANDBOOK.md) - Deployment procedures
- [ENS Documentation](https://docs.ens.domains/) - ENS protocol details
- [Kernel v3 Docs](https://docs.zerodev.app/) - Smart account architecture
- [Envio Docs](https://docs.envio.dev/) - Multi-chain indexing

