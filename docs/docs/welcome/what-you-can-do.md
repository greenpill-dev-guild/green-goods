# What You Can Do with Green Goods

Green Goods enables diverse regenerative workflows across four key user types. Whether you're documenting conservation work, managing a community hub, analyzing impact data, or building regenerative infrastructure—here's what you can accomplish.

---

## 🌱 For Gardeners: Document & Prove Your Impact

### Submit Work with the MDR Workflow

**Media → Details → Review**

The fastest way to create verifiable impact records:

1. **Capture Media** 📸
   - Take before/after photos in the field
   - Record video documentation
   - Works offline, syncs when online

2. **Fill Details** ✍️
   - Select the action you completed
   - Add metrics (trees planted, area covered, etc.)
   - Provide context and notes

3. **Review & Submit** ✅
   - Preview your submission
   - Confirm and create attestation
   - Track approval status

<!-- TODO: Add animated GIF showing 3-step flow -->
<!-- TODO: Add image - MDR Workflow Animation -->
<!-- ![MDR Workflow Animation](../.gitbook/assets/mdr-animation.gif) -->
*Complete a submission in under 2 minutes*

[Detailed Guide: Logging Work →](../guides/gardeners/logging-work)

### Track Your Contributions

**View Your Impact Portfolio**:
- See all submitted work
- Check approval status (pending, approved, rejected)
- Read operator feedback
- Access on-chain attestation links

**Build Reputation**:
- Accumulate verified work across gardens
- Showcase your impact to funders
- Unlock future opportunities

[Guide: Tracking Contributions →](../guides/gardeners/tracking-contributions)

### Work Across Multiple Gardens

- Join gardens in different bioregions
- Contribute to diverse actions
- Earn recognition in each community

### Example Gardener Workflows

**Scenario 1: Tree Planting Event**
```
1. Arrive at planting site
2. Take "before" photo of area
3. Plant 25 native oak seedlings
4. Take "after" photo showing planted trees
5. Open Green Goods app (works offline)
6. Submit work: "Planted 25 oak trees"
7. Add photos and location
8. Submit → Attestation created when approved
```

**Scenario 2: Biodiversity Survey**
```
1. Conduct wildlife monitoring
2. Document species observed
3. Take photos of habitat
4. Record metrics (species count, habitat quality)
5. Submit work via app
6. Operator reviews and approves
7. Data becomes part of garden's impact record
```

**Scenario 3: Community Cleanup**
```
1. Join community cleanup day
2. Document litter collection (before/after)
3. Record area covered and waste removed
4. Submit work immediately after event
5. Get approval within 24 hours
6. Share attestation on social media
```

[Best Practices Guide →](../guides/gardeners/best-practices)

---

## 🧑‍🌾 For Garden Operators: Coordinate & Validate Impact

### Create and Manage Gardens

**Set Up a Garden**:
1. Log into [admin.greengoods.app](https://admin.greengoods.app)
2. Create garden with name, description, location
3. Upload banner image (stored in IPFS)
4. Define initial gardeners and operators

**Customize Your Garden**:
- Edit metadata anytime
- Add location tags
- Update member lists
- Manage multiple gardens from one dashboard

[Guide: Managing Gardens →](../guides/operators/managing-gardens)

### Design Actions for Gardeners

**Create Effective Tasks**:
- Clear instructions and requirements
- Specific metrics to track
- Optional time windows
- Eight forms of capital alignment

**Example Actions**:
- "Plant 10+ native trees (Living Capital)"
- "Lead community workshop (Social + Cultural Capital)"
- "Remove invasive species from 500sqm area (Living + Material Capital)"

**Activate/Deactivate Actions**:
- Control which tasks are available
- Seasonal adjustments
- Emergency priorities

[Guide: Managing Actions →](../guides/operators/managing-actions)

### Review and Approve Work

**Validation Workflow**:
1. View submitted work in dashboard
2. Review media evidence
3. Check metrics and details
4. Approve or reject with feedback
5. On-chain attestation created automatically

**Best Practices for Reviews**:
- Provide constructive feedback
- Be consistent in standards
- Respond within 48 hours
- Recognize quality submissions

**What Happens When You Approve**:
- EAS attestation created on-chain
- Karma GAP impact attestation triggered
- Gardener receives confirmation
- Work becomes part of garden's permanent record

[Guide: Reviewing Work →](../guides/operators/reviewing-work)

### Generate Impact Reports

**Garden-Level Analytics**:
- Total work submissions
- Approval rates
- Cumulative metrics (trees planted, area restored, etc.)
- Member participation stats

**Export for Grant Applications**:
- CSV/JSON export
- On-chain attestation links
- Verifiable proof for funders

**Karma GAP Integration**:
- Automatic impact reporting
- Multi-chain standardization
- Transparent accountability

[Guide: Reporting Impact →](../guides/operators/reporting-impact)

### Example Operator Workflows

**Scenario 1: Launching a New Garden**
```
1. Connect wallet to admin dashboard
2. Create "Watershed Restoration Initiative" garden
3. Add 5 initial gardeners
4. Create 3 core actions (planting, monitoring, cleanup)
5. Share garden invite with community
6. Review first work submissions within 24 hours
```

**Scenario 2: Managing Busy Garden**
```
1. Log in to admin dashboard
2. Review 15 pending work submissions
3. Approve 12, reject 3 with feedback
4. Update action priorities for next month
5. Generate monthly report for grant application
6. Add 2 new operators to help with reviews
```

---

## 📊 For Impact Evaluators: Analyze & Verify

### Access Verified Impact Data

**Multiple Access Methods**:

1. **GraphQL API**
   - Query via [Envio Indexer](https://indexer.hyperindex.xyz/0bf0e0f/v1/graphql)
   - Filter by garden, action, time, location
   - Flexible, composable queries

2. **On-Chain Verification**
   - View attestations on EAS explorer
   - Verify on Arbitrum, Celo, or Base Sepolia
   - Check cryptographic signatures

3. **Admin UI**
   - Browse gardens and work
   - Visual dashboards
   - Export functionality

[Guide: Accessing Data →](../guides/evaluators/accessing-data)

### Query Impact Data

**Example GraphQL Queries**:

**All Work in a Garden**:
```graphql
query GardenWork($gardenId: String!) {
  Work(where: {gardenId: {_eq: $gardenId}}) {
    id
    title
    approved
    actionUID
    media
    createdAt
  }
}
```

**Approved Work in a Time Range**:
```graphql
query ApprovedWork($startDate: Int!, $endDate: Int!) {
  WorkApproval(where: {
    approved: {_eq: true}
    timestamp: {_gte: $startDate, _lte: $endDate}
  }) {
    id
    workUID
    feedback
    timestamp
  }
}
```

[API Reference →](../developer/api-reference)

### Explore Gardens and Work

**Browsing Capabilities**:
- View all gardens on chain
- Filter by location or tag
- See garden member lists
- Track cumulative impact metrics

**Drill Down to Work**:
- View individual submissions
- Check before/after photos
- Review operator feedback
- Verify on-chain attestations

[Guide: Exploring Gardens →](../guides/evaluators/exploring-gardens)

### Integrate with External Frameworks

**Map to Impact Standards**:
- Karma GAP attestations
- SDG (Sustainable Development Goals) alignment
- Carbon credit frameworks
- Biodiversity indices

**Export for Analysis**:
- CSV for spreadsheets
- JSON for databases
- GraphQL for dashboards

[Guide: External Frameworks →](../guides/evaluators/external-frameworks)

### Example Evaluator Workflows

**Scenario 1: Grant Allocation Decision**
```
1. Foundation wants to fund watershed restoration
2. Query all "watershed" tagged gardens
3. Filter for last 6 months of activity
4. Analyze approval rates and metrics
5. Verify top gardens' attestations on-chain
6. Export data for board presentation
7. Allocate grant to highest-impact gardens
```

**Scenario 2: Research Study**
```
1. Researcher studying reforestation effectiveness
2. Query all tree-planting work across regions
3. Pull species data, survival rates, locations
4. Correlate with environmental conditions
5. Analyze long-term trends
6. Publish paper with verifiable on-chain sources
```

**Scenario 3: Impact Investor Due Diligence**
```
1. Evaluate garden for retroactive funding
2. Check total work submissions vs approvals
3. Verify operator credibility
4. Review media evidence quality
5. Confirm on-chain attestations
6. Make funding decision based on proven impact
```

---

## 👩‍💻 For Developers: Build & Integrate

### Query the GraphQL API

**Envio Indexer**: https://indexer.hyperindex.xyz/0bf0e0f/v1/graphql

**Indexed Entities**:
- Gardens
- Actions
- Work Submissions
- Work Approvals
- Attestations
- Members (gardeners, operators)

**Real-Time Updates**:
- GraphQL subscriptions
- Event-driven architecture
- Automatic sync with blockchain

[API Documentation →](../developer/api-reference)

### Interact with Smart Contracts

**Deployed Networks**:
- **Arbitrum One** (42161): [Contract Addresses →](https://github.com/greenpill-dev-guild/green-goods/blob/develop/packages/contracts/deployments/42161-latest.json)
- **Celo** (42220): [Contract Addresses →](https://github.com/greenpill-dev-guild/green-goods/blob/develop/packages/contracts/deployments/42220-latest.json)
- **Base Sepolia** (84532): [Contract Addresses →](https://github.com/greenpill-dev-guild/green-goods/blob/develop/packages/contracts/deployments/84532-latest.json)

**Core Contracts**:
- `GardenToken`: NFT registry of gardens
- `ActionRegistry`: Task definitions
- `WorkResolver`: Work submission logic
- `WorkApprovalResolver`: Approval logic
- `AssessmentResolver`: Garden assessments

[Contracts Documentation →](../developer/architecture/contracts-package)

### Build Custom Integrations

**Example: Impact Dashboard**
```typescript
import { request, gql } from 'graphql-request';

const ENDPOINT = 'https://indexer.hyperindex.xyz/0bf0e0f/v1/graphql';

const query = gql`
  query Gardens {
    Garden {
      id
      name
      location
      gardeners
      totalWork: Work_aggregate {
        aggregate { count }
      }
    }
  }
`;

const data = await request(ENDPOINT, query);
// Render custom dashboard with garden data
```

**Example: Polling for New Approvals**
```typescript
// Poll for recent high-quality approved work
import { request, gql } from 'graphql-request';

const RECENT_APPROVALS = gql`
  query RecentApprovals($since: Int!) {
    WorkApproval(where: {approved: {_eq: true}, timestamp: {_gte: $since}}) {
      workUID
      gardenId
      feedback
    }
  }
`;

setInterval(async () => {
  const data = await request(ENDPOINT, RECENT_APPROVALS, { since: lastCheck });
  for (const approval of data.WorkApproval) {
    if (meetsQualityThreshold(approval)) {
      sendFunding(approval.gardenId, calculateReward(approval));
    }
  }
  lastCheck = Date.now();
}, 60000);
```

[Integration Examples →](../developer/api-reference)

### Contribute to the Platform

**Open Source Monorepo**:
- **Client (PWA)**: React + TanStack Query + Viem
- **Admin Dashboard**: React + TanStack Query + graphql-request + XState
- **Indexer**: Envio GraphQL
- **Contracts**: Solidity + Foundry

**Contribution Areas**:
- Frontend features and UX improvements
- Smart contract extensions
- Indexer optimizations
- Documentation
- Bug fixes

[Contributing Guide →](../developer/contributing)

### Example Developer Workflows

**Scenario 1: Build Impact Leaderboard**
```
1. Query total approved work per gardener
2. Aggregate metrics across gardens
3. Build visualization with React + D3
4. Deploy dashboard
5. Share with community
```

**Scenario 2: Create Garden Template**
```
1. Design custom garden type (e.g., "Urban Farm")
2. Define standard actions for this type
3. Create deployment script
4. Test on testnet
5. Submit PR to main repo
```

---

## Cross-Role Use Cases

Many workflows span multiple roles:

### Scenario: Community-Led Conservation Project

**As Operator**:
1. Create "River Valley Restoration" garden
2. Define actions: tree planting, invasive removal, monitoring

**As Gardener**:
3. Join garden and complete tree planting work
4. Submit work with photos and metrics

**As Operator** (again):
5. Review and approve submissions
6. Generate impact report for grant application

**As Evaluator**:
7. Funder queries garden data
8. Verifies on-chain attestations
9. Allocates retroactive funding

**Result**: Full cycle from work → verification → funding, all on-chain and transparent.

---

## What Will You Build?

Green Goods is a platform for regenerative coordination. The possibilities are endless:

- 🌍 **Bioregional DAOs**: Coordinate conservation across entire watersheds
- 💰 **Retroactive Funding**: Reward proven impact, not promises
- 📊 **Impact Marketplaces**: Trade verified impact tokens
- 🏆 **Reputation Systems**: Build credibility through verified work
- 🤝 **Funder Consortiums**: Pool resources for high-impact gardens
- 📚 **Research Networks**: Study regenerative practices with verifiable data

---

## Ready to Start?

<table>
  <tr>
    <td align="center" width="25%">
      <h3>🌱</h3>
      <a href="quickstart-gardener.md"><strong>Document Work</strong></a><br/>
      <small>Start logging impact</small>
    </td>
    <td align="center" width="25%">
      <h3>🧑‍🌾</h3>
      <a href="quickstart-operator.md"><strong>Create Garden</strong></a><br/>
      <small>Coordinate community</small>
    </td>
    <td align="center" width="25%">
      <h3>📊</h3>
      <a href="quickstart-evaluator.md"><strong>Analyze Data</strong></a><br/>
      <small>Make funding decisions</small>
    </td>
    <td align="center" width="25%">
      <h3>👩‍💻</h3>
      <a href="quickstart-developer.md"><strong>Build Integration</strong></a><br/>
      <small>Extend the platform</small>
    </td>
  </tr>
</table>

---

## Learn More

- [Why Green Goods?](why-green-goods) — Understand the problems we solve
- [Who Is It For?](who-is-it-for) — Find your role
- [Core Concepts](../concepts/roles) — Deep dive into how it works
- [How-To Guides](../guides/gardeners/logging-work) — Step-by-step tutorials

