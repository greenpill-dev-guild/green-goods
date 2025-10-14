# Karma GAP Integration

## Overview

Green Goods integrates with the **Karma Grantee Accountability Protocol (GAP)** to automatically create impact attestations compliant with the **Common Impact Data Standard (CIDS)**. This integration provides transparent, verifiable records of conservation work on public blockchains.

### What is Karma GAP?

Karma GAP is a grantee accountability protocol that provides:
- Standardized impact attestation schemas
- Multi-chain support across 8 EVM networks
- Integration with Ethereum Attestation Service (EAS)
- CIDS-compliant data structure

**Resources:**
- Documentation: https://docs.gap.karmahq.xyz/
- Platform: https://gap.karmahq.xyz/
- SDK: https://github.com/show-karma/karma-gap-sdk

### Why Impact Standards Matter

**Credibility:**
- Third-party verification of impact claims
- Tamper-proof on-chain records
- Complete audit trail with evidence

**Interoperability:**
- Platform-agnostic data access
- Standard schema ensures consistent structure
- Cross-project analysis and aggregation

**Transparency:**
- Public attestations viewable on EAS Explorer
- Open verification of claims
- Cryptographic linking of operators to approvals

## Multi-Chain Support

The integration works seamlessly across 8 networks:

| Network | Chain ID | Type | Status |
|---------|----------|------|--------|
| Optimism | 10 | Mainnet | ✅ Production |
| Optimism Sepolia | 11155420 | Testnet | ✅ Production |
| Arbitrum | 42161 | Mainnet | ✅ Production |
| Sepolia | 11155111 | Testnet | ✅ Production |
| Base Sepolia | 84532 | Testnet | ✅ Production |
| Celo | 42220 | Mainnet | ✅ Production |
| Sei | 1329 | Mainnet | ✅ Production |
| Sei Testnet | 1328 | Testnet | ✅ Production |

All schema UIDs and contract addresses are centralized in `packages/contracts/src/lib/Karma.sol`.

## Data Mapping

### Three-Level Hierarchy

Green Goods maps to Karma GAP's three-level structure:

```
GAP Project (Garden)
  ├── GAP Milestone (Assessment) - NOT IMPLEMENTED
  └── GAP Impact (Approved Work)
      └── Activities, verification, evidence
```

### Garden → GAP Project

| GAP Field | Green Goods Source | Notes |
|-----------|-------------------|-------|
| Project Name | Garden.name | Required |
| Project Description | Garden.description | Required |
| Project Location | Garden.location | Geographic data |
| Project Owner | GardenAccount address | Contract is owner |
| Banner Image | Garden.bannerImage | IPFS CID |
| Community Token | Garden.communityToken | Token economics |

**When Created:** Garden minting (GardenToken.mintGarden)

**Who Creates:** Automatically via GardenAccount.initialize

### Approved Work → GAP Impact

| GAP Field | Green Goods Source | Notes |
|-----------|-------------------|-------|
| Project Reference | Garden.gapProjectUID | Links to project |
| Activity UID | Work.uid | Work attestation UID |
| Activity Title (title) | Action.title | Action type |
| Activity Text (text) | Work.feedback | Gardener description |
| Impact Date | WorkApproval timestamp | Approval time |
| Impact Metrics | Work.metadata | JSON (plantCount, species) |
| Evidence | Work.media | Photo IPFS CIDs |
| Verified By | Operator address | Approving operator |
| Approval Status | WorkApproval.approved | Always true for GAP |

**When Created:** Work approval (WorkApprovalResolver.onAttest)

**Who Creates:** Garden operator approving work

### Assessment Status

**Note:** Assessment-to-milestone mapping is **not currently implemented**. Assessments create EAS attestations but do not create GAP milestones. This is a planned future enhancement.

## Integration Flows

### 1. Garden Creation → GAP Project

When a garden is created via `GardenToken.mintGarden()`:

```
GardenAccount.initialize()
  └─> if (KarmaLib.isSupported())
      └─> _createGAPProject()
          ├─> Create project attestation
          ├─> Store gapProjectUID
          └─> Create details attestation
      └─> Add all operators as project admins
          └─> _addGAPProjectAdmin(operator)
```

**Result:** Garden account becomes owner of a Karma GAP project.

### 2. Operator Addition → Project Admin

When an operator is added via `GardenAccount.addGardenOperator()`:

```
addGardenOperator(operator)
  └─> if (KarmaLib.isSupported() && gapProjectUID != 0)
      └─> _addGAPProjectAdmin(operator)
          └─> IProjectResolver.addAdmin(gapProjectUID, operator)
```

**Result:** Operator gains admin permissions on the Karma GAP project.

### 3. Work Approval → Impact Attestation

When work is approved via `WorkApprovalResolver.onAttest()`:

```
WorkApprovalResolver.onAttest()
  ├─> Validate work relationship
  ├─> Verify operator identity
  ├─> Validate action exists
  └─> if (approved && KarmaLib.isSupported())
      └─> _createGAPProjectImpact()
          ├─> Get work and action data
          ├─> Build impact JSON
          └─> GardenAccount.createProjectImpact()
              └─> Create project update attestation
```

**Result:** Impact attestation recorded on Karma GAP.

## Testing

### Fork Test Commands

All testing is done via fork tests against live networks:

```bash
# Test all networks
pnpm test:gap

# Test specific networks
pnpm test:gap:fork:arbitrum
pnpm test:gap:fork:celo
pnpm test:gap:fork:base
pnpm test:gap:fork:optimism
pnpm test:gap:fork:sepolia
pnpm test:gap:fork:sei
```

### Test Coverage

- ✅ Garden creation with GAP project
- ✅ Operator becomes GAP project admin
- ✅ Full workflow (garden → work → approval → impact)

### Running Fork Tests

Set RPC URLs in `.env`:

```bash
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
CELO_RPC_URL=https://forno.celo.org
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
OPTIMISM_RPC_URL=https://mainnet.optimism.io
SEPOLIA_RPC_URL=https://rpc.sepolia.org
SEI_RPC_URL=https://evm-rpc.sei-apis.com
```

Then run:

```bash
pnpm test:gap:fork:all
```

## Deployment

When deploying to a GAP-supported chain:

1. Deploy core contracts
2. Gardens automatically create GAP projects
3. Operators automatically become project admins
4. Approved work automatically creates impact attestations

**No additional configuration needed** - the integration is automatic!

### Automatic Integration

- GAP projects are created during garden initialization
- Operators are added as project admins when added to gardens
- Impact attestations are created when work is approved
- All handled automatically by smart contracts

## Querying Impact Data

### Via Karma GAP Platform

Green Goods impact attestations are visible on:
- https://gap.karmahq.xyz/ (project profile pages)
- View by project UID (garden address)
- Aggregated impact metrics

### Via EAS Explorer

Direct blockchain verification:
- https://arbitrum.easscan.org/ (Arbitrum)
- https://celo.easscan.org/ (Celo)
- https://base-sepolia.easscan.org/ (Base Sepolia)
- Search by attestation UID
- View raw attestation data
- Verify on-chain integrity

### Via Karma GAP SDK

```typescript
import { KarmaGAP } from '@show-karma/karma-gap-sdk';

// Initialize SDK
const gap = new KarmaGAP(chainId);

// Get project by garden address
const project = await gap.getProjectByOwner(gardenAddress);

// Get project impacts
const impacts = await gap.getProjectUpdates(project.uid, {
  type: 'project-impact'
});
```

### Via EAS GraphQL

```graphql
query KarmaGAPImpacts($projectUID: String!) {
  attestations(
    where: {
      schemaId: {_eq: $GAP_PROJECT_UPDATE_SCHEMA_UID}
      decodedDataJson: {_contains: {type: "project-impact"}}
      refUID: {_eq: $projectUID}
    }
  ) {
    id
    attester
    decodedDataJson
    time
  }
}
```

### Via Green Goods Indexer

**Note:** Green Goods indexer tracks gardens and work but does not index GAP attestations. Use Karma GAP SDK or EAS directly for impact data.

## What's NOT Implemented

The following features are **not currently implemented** but may be added in future versions:

1. **Assessments → Milestones**
   - Assessment submissions do NOT create GAP milestone attestations
   - Assessments create standard EAS attestations only
   - This is a planned future enhancement

2. **Green Goods Indexer GAP Entities**
   - The indexer does NOT track GAPProject, GAPMilestone, or GAPImpact entities
   - Query GAP data directly via Karma GAP SDK or EAS
   - Indexer tracks gardens and work only

3. **Admin Dashboard Impact Reports**
   - Impact Reports view queries Karma GAP directly (future implementation)
   - Not querying Green Goods indexer for GAP data

4. **Localhost GAP Testing**
   - GAP integration not supported on localhost
   - Use fork tests to test GAP integration

## Troubleshooting

### GAP Project Not Created

**Issue:** `gapProjectUID` is zero after garden creation

**Debug:**
1. Check `KarmaLib.isSupported()` returns `true` for your chain
2. Verify GAP contract address for your network in `src/lib/Karma.sol`
3. Check initialization transaction for revert
4. Verify garden has operators (operators trigger project creation)

### Impact Attestation Failed

**Issue:** Work approved but no impact attestation created

**Debug:**
1. Check if GAP project exists (`gapProjectUID != 0`)
2. Verify caller is an operator
3. Look for try/catch failure in transaction logs
4. Confirm GAP contract is accessible on-chain
5. Check WorkApprovalResolver is in trusted resolver list

### Operator Not Project Admin

**Issue:** Operator added but not GAP project admin

**Debug:**
1. Check if `_addGAPProjectAdmin()` was called
2. Verify Project Resolver address in `src/lib/Karma.sol`
3. Look for try/catch failure in transaction logs
4. Confirm operator was added AFTER garden creation (must have GAP project first)

### Schema Field Format Issues

**Issue:** Attestations created but not displaying in Karma GAP UI

**Solution:**
Verify JSON format matches Karma GAP SDK:
- Milestones use `text` (not `description`) and `type: "project-milestone"`
- Impacts use `title` and `text` (not `work` and `impact`)
- See `docs/archive/CHANGELOG_KARMA_GAP.md` for field name fix history

### Resolver Authorization Errors

**Issue:** `NotAuthorizedCaller` error when creating impact attestations

**Debug:**
1. Verify WorkApprovalResolver address matches GardenAccount.WORK_APPROVAL_RESOLVER
2. Check if caller is an operator (for direct calls)
3. Confirm resolver addresses set correctly at deployment

## Benefits

### For Gardeners

- **Verified Impact**: Your work is cryptographically verified on-chain
- **Portable Credentials**: Impact attestations follow you across platforms
- **Transparency**: Anyone can view your contributions

### For Operators

- **Accountability**: All approvals are publicly linked to your address
- **Reporting**: Export impact data for grants, reporting, compliance
- **Dashboard**: Centralized view of all impact attestations

### For Gardens

- **Project Profile**: Each garden has a Karma GAP project page
- **Impact Tracking**: Activities automatically recorded
- **Interoperability**: Data accessible to external platforms and tools

### For Ecosystem

- **Standardization**: Common data format enables ecosystem-wide analysis
- **Aggregation**: Impact data can be aggregated across gardens
- **Credibility**: Compliance with CIDS enhances legitimacy

## References

- **Karma GAP SDK:** https://github.com/show-karma/karma-gap-sdk
- **Karma GAP Contracts:** https://github.com/show-karma/gap-contracts
- **EAS Documentation:** https://docs.attest.sh/
- **CIDS Standard:** https://commonsimpact.org/
- **Technical Implementation:** [KARMA_GAP_IMPLEMENTATION.md](./KARMA_GAP_IMPLEMENTATION.md)
- **Contract Upgrades:** [UPGRADES.md](./UPGRADES.md)
- **Change History:** [archive/CHANGELOG_KARMA_GAP.md](./archive/CHANGELOG_KARMA_GAP.md)

