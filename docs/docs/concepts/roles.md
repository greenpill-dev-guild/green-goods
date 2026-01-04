# Roles & Responsibilities

Green Goods defines three core user roles, each with specific permissions and responsibilities. Understanding these roles is essential for effective platform participation.

---

## Role Overview

| Role | Primary Function | Access Level | Authentication |
|------|-----------------|--------------|----------------|
| **Gardener** | Document and submit work | Basic | Passkey (biometric) |
| **Operator** | Validate work and manage gardens | Elevated | Wallet-based |
| **Evaluator** | Analyze and verify impact data | Read-only | No auth required for public data |

---

## 🌱 Gardener

**On-the-ground workers documenting regenerative impact.**

### Capabilities

✅ **Submit Work**
- Document completed tasks using MDR workflow
- Upload photos and metrics
- Provide context and notes

✅ **Join Gardens**
- Request membership in gardens
- Participate in multiple communities
- Accept operator invitations

✅ **Track Contributions**
- View submission history
- Check approval status
- Access on-chain attestations

✅ **Work Offline**
- Submit work without internet
- Queue syncs when back online
- Never lose documented work

### Permissions

**Can**:
- Create work submissions
- View their own submission history
- View public garden information
- Request garden membership

**Cannot**:
- Approve/reject work
- Create gardens
- Manage garden members
- Edit approved attestations

### Authentication

**Passkey-Based (Biometric)**:
- Face ID, Touch ID, or fingerprint
- No seed phrases or private keys
- Pimlico smart account (account abstraction)
- Gasless transactions (sponsored)

[Gardener Quickstart →](../welcome/quickstart-gardener)

---

## 🧑‍🌾 Garden Operator

**Trusted coordinators who validate work and manage communities.**

### Capabilities

✅ **Review Work**
- Validate gardener submissions
- Approve or reject with feedback
- Create on-chain attestations

✅ **Manage Gardens**
- Edit garden metadata
- Coordinate multiple gardens
- Oversee garden health

✅ **Design Actions**
- Create tasks for gardeners
- Define metrics and requirements
- Activate/deactivate actions

✅ **Manage Members**
- Add/remove gardeners
- Add/remove co-operators
- Build trusted communities

✅ **Generate Reports**
- Export garden data
- Track cumulative metrics
- Share impact with funders

### Permissions

**Can** (within assigned gardens):
- Approve and reject work submissions
- Add/remove gardeners
- Add/remove other operators
- Create and manage actions
- Edit garden metadata

**Cannot**:
- Create new gardens (admin-only)
- Modify other gardens' settings
- Edit approved attestations
- Override smart contract logic

### Permission Model

Operators have elevated permissions **only** in gardens where they are explicitly assigned:

```
Operator A → Garden 1: ✅ Can manage
Operator A → Garden 2: ❌ No access

Operator B → Garden 1: ❌ No access
Operator B → Garden 2: ✅ Can manage
```

### Authentication

**Wallet-Based (Traditional Web3)**:
- MetaMask, WalletConnect, Coinbase Wallet
- EOA (Externally Owned Account)
- User pays gas fees
- Direct blockchain transactions

### Operator Best Practices

**Fairness**:
- Apply consistent review standards
- Provide constructive feedback
- Recognize quality work publicly

**Responsiveness**:
- Review submissions within 24-48 hours
- Communicate expectations clearly
- Keep gardeners informed

**Collaboration**:
- Coordinate with co-operators
- Share review guidelines
- Discuss edge cases as team

[Operator Quickstart →](../welcome/quickstart-operator)

---

## 📊 Impact Evaluator

**Researchers, funders, and analysts who assess verifiable impact.**

### Capabilities

✅ **Query Data**
- Access GraphQL API
- Filter by garden, time, location
- Real-time subscriptions

✅ **Verify Attestations**
- Check on-chain records via EAS
- Validate cryptographic signatures
- Trace work → approval chain

✅ **Explore Gardens**
- Browse garden profiles
- View cumulative metrics
- Analyze member activity

✅ **Export for Analysis**
- CSV for spreadsheets
- JSON for databases
- Custom integrations

✅ **Integrate Frameworks**
- Map to SDGs
- Pull Karma GAP attestations
- Connect to external systems

### Permissions

**Can**:
- Query all public data via API
- View on-chain attestations
- Export data for analysis
- Build custom dashboards

**Cannot**:
- Submit work
- Approve work
- Edit garden data
- Access private gardens (if implemented)

### Authentication

**No authentication required** for public data access.

Optional wallet connection for:
- Enhanced UI features
- Private garden access (future)
- Direct blockchain queries

### Evaluator Use Cases

**Grant Making**:
- Query gardens by impact metrics
- Verify attestations before funding
- Track funded project outcomes

**Research**:
- Study regenerative practice effectiveness
- Analyze geographic trends
- Publish with verifiable sources

**Investment Due Diligence**:
- Assess garden credibility
- Verify historical performance
- Calculate retroactive funding value

[Evaluator Quickstart →](../welcome/quickstart-evaluator)

---

## Role Transitions

Users can hold multiple roles simultaneously:

### Gardener → Operator

**Path**:
1. Build reputation as active gardener
2. Demonstrate quality submissions
3. Get assigned as operator by garden admin
4. Connect wallet for operator functions

**Hybrid Usage**:
- Submit work as gardener (passkey)
- Review work as operator (wallet)
- Switch contexts seamlessly

### Operator → Evaluator

**Path**:
Operators already have access to their garden data as evaluators.

**Hybrid Usage**:
- Manage gardens as operator
- Query data across gardens as evaluator
- Build inter-garden analytics

### Developer → Any Role

**Path**:
Developers can participate as gardeners, operators, or evaluators while building integrations.

**Hybrid Usage**:
- Submit test work as gardener
- Review in test garden as operator
- Query API as evaluator
- Contribute code as developer

---

## Permission Architecture

### On-Chain Enforcement

All roles are enforced at the smart contract level:

```solidity
// Example: WorkResolver checks gardener membership
modifier onlyGardener(uint256 gardenId, address submitter) {
    require(isGardener(gardenId, submitter), "Not a gardener");
    _;
}

// Example: WorkApprovalResolver checks operator status
modifier onlyOperator(uint256 gardenId, address validator) {
    require(isOperator(gardenId, validator), "Not an operator");
    _;
}
```

### Off-Chain Validation

UI enforces roles for better UX:
- Hides features users can't access
- Shows appropriate dashboards
- Provides clear permission errors

---

## Role-Based UIs

### Gardener Interface (Client PWA)

- Mobile-first design
- Simple MDR workflow
- Offline capabilities
- Work dashboard

**Access**: [greengoods.app](https://greengoods.app)

### Operator Interface (Admin Dashboard)

- Desktop-optimized
- Garden management tools
- Work review interface
- Analytics and exports

**Access**: [admin.greengoods.app](https://admin.greengoods.app)

### Evaluator Interface (API + Explorers)

- GraphQL playground
- EAS explorer links
- Block explorer access
- Custom dashboards (build your own)

**Access**: [GraphQL API](https://indexer.hyperindex.xyz/0bf0e0f/v1/graphql)

---

## Summary

| Feature | Gardener | Operator | Evaluator |
|---------|----------|----------|-----------|
| Submit work | ✅ | ✅ (as gardener) | ❌ |
| Approve work | ❌ | ✅ | ❌ |
| Create gardens | ❌ | ❌ (admin only) | ❌ |
| Manage members | ❌ | ✅ | ❌ |
| Create actions | ❌ | ✅ | ❌ |
| Query data | Limited | ✅ | ✅ |
| Verify attestations | ✅ | ✅ | ✅ |
| Export data | Personal only | Garden-level | All public |
| Gas fees | None (sponsored) | Yes (pays own) | None |
| Authentication | Passkey | Wallet | Optional |

---

## Learn More

- [Gardens & Work](gardens-and-work) — How roles interact with gardens
- [MDR Workflow](mdr-workflow) — Gardener submission process
- [Attestations](attestations) — How approvals become permanent records
- [Gardener Quickstart](../welcome/quickstart-gardener)
- [Operator Quickstart](../welcome/quickstart-operator)
- [Evaluator Quickstart](../welcome/quickstart-evaluator)

