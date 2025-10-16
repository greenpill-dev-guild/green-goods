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
  ├── GAP Milestone (Assessment) ✅
  │   └── Periodic assessments with capitals and metrics
  └── GAP Impact (Approved Work) ✅
      └── Individual work submissions with evidence
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

### Assessment → GAP Milestone

| GAP Field | Green Goods Source | Notes |
|-----------|-------------------|-------|
| Project Reference | Garden.gapProjectUID | Links to project |
| Milestone Title (title) | Assessment.title | Assessment name |
| Milestone Text (text) | Assessment.description | Assessment description |
| Milestone Date | Assessment timestamp | Assessment creation time |
| Milestone Metadata | Assessment.capitals, assessmentType, metricsJSON | JSON metadata |
| Assessment Type | Assessment.assessmentType | biodiversity, soil, water, etc. |
| Capitals Measured | Assessment.capitals | Array of 8 capital types |
| Metrics | Assessment.metricsJSON | Custom metrics IPFS CID |
| Evidence | Assessment.evidenceMedia | Photo/video IPFS CIDs |
| Verified By | Operator address | Assessing operator |

**When Created:** Assessment submission (AssessmentResolver.onAttest)

**Who Creates:** Garden operator creating assessment

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

### 4. Assessment Creation → Milestone Attestation

When an assessment is submitted via `AssessmentResolver.onAttest()`:

```
AssessmentResolver.onAttest()
  ├─> Decode assessment schema
  ├─> Verify operator identity
  ├─> Validate required fields (title, assessmentType, capitals)
  ├─> Validate capital types (8 forms of capital)
  └─> _createGAPProjectMilestone()
      ├─> Skip if GAP not supported or no project
      ├─> Build milestone metadata JSON
      │   ├─> capitals array
      │   ├─> assessmentType
      │   └─> metricsJSON
      └─> GardenAccount.createProjectMilestone()
          └─> Create milestone attestation
```

**Result:** Milestone attestation recorded on Karma GAP with assessment data.

## Testing

All testing is done via fork tests against live networks. Set RPC URLs in `.env` and run:

```bash
# Test all networks
bun test:gap

# Test specific network
bun test:gap:fork:arbitrum
```

**Coverage:** Garden creation, operator admin assignment, full work approval workflow, assessment milestones.  
**Details:** See `test/E2EKarmaGAPFork.t.sol` and [KARMA_GAP_IMPLEMENTATION.md](./KARMA_GAP_IMPLEMENTATION.md)

## Deployment

**The integration is fully automatic.** When deploying to a GAP-supported chain:

1. Gardens automatically create GAP projects during initialization
2. Operators automatically become project admins
3. Work approvals automatically create impact attestations
4. Assessments automatically create milestone attestations

No additional configuration required.

## Querying Impact Data

### Via Karma GAP Platform
- https://gap.karmahq.xyz/ - View project profiles and aggregated metrics

### Via EAS Explorer
Direct on-chain verification at:
- https://arbitrum.easscan.org/ (Arbitrum)
- https://celo.easscan.org/ (Celo)  
- https://base-sepolia.easscan.org/ (Base Sepolia)

### Via Karma GAP SDK
```typescript
import { KarmaGAP } from '@show-karma/karma-gap-sdk';
const gap = new KarmaGAP(chainId);
const project = await gap.getProjectByOwner(gardenAddress);
const impacts = await project.getUpdates();
```

### Via Green Goods Indexer
The indexer stores `gapProjectUID` for each garden. Query the garden, then use the UID with Karma GAP SDK.  
**Details:** See [KARMA_GAP_QUERIES.md](../indexer/KARMA_GAP_QUERIES.md)

## Implemented Features

The following Karma GAP features are **fully implemented and working**:

1. **Gardens → GAP Projects** ✅
   - Gardens automatically create GAP projects during initialization
   - Project details stored on-chain with garden metadata
   - Operators automatically added as project admins

2. **Work Approvals → GAP Impacts** ✅
   - Approved work submissions automatically create GAP impact attestations
   - Includes action title, approval feedback, and media evidence
   - Linked to garden's GAP project via refUID

3. **Assessments → GAP Milestones** ✅
   - Assessment submissions automatically create GAP milestone attestations
   - Includes assessment title, description, capitals, and metrics
   - Linked to garden's GAP project via refUID
   - Milestone metadata includes assessment type and measured capitals

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

