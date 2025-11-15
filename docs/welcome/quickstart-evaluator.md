# Evaluator Quickstart

> **Want all evaluator/funder resources in one place?** Head to the [Evaluator & Funder Hub](../reference/for-evaluators.md).

Access and analyze verifiable regenerative impact data in 10 minutes. Perfect for funders, researchers, and impact analysts.

---

## What You'll Need

- 🌐 Internet connection
- 💻 Web browser or API client (Postman, GraphQL Playground, etc.)
- 📊 (Optional) Data analysis tools (Excel, Python, R, etc.)

No wallet or blockchain experience required to query data!

---

## Understanding Green Goods Data

Green Goods tracks regenerative work across multiple dimensions:

**Gardens**: Community hubs coordinating local work
**Actions**: Specific tasks available for gardeners
**Work Submissions**: Documented regenerative activities
**Work Approvals**: Operator validation of submissions
**Attestations**: Immutable on-chain records

All data is:
- ✅ **Verifiable**: Cryptographically signed on-chain
- ✅ **Transparent**: Publicly queryable
- ✅ **Permanent**: Immutable blockchain storage
- ✅ **Standardized**: Karma GAP integration

---

## Step 1: Query the GraphQL API

The fastest way to access Green Goods data.

### 1.1 Access the API

**GraphQL Endpoint**: https://indexer.hyperindex.xyz/0bf0e0f/v1/graphql

1. **Open in browser**: Visit the URL above
2. **Or use GraphQL client**: Postman, Insomnia, or your preferred tool

<!-- TODO: Add screenshot of GraphQL playground -->
![GraphQL Playground](../.gitbook/assets/graphql-playground.png)
*The Envio GraphQL playground for exploring data*

### 1.2 Your First Query: List All Gardens

```graphql
query AllGardens {
  Garden {
    id
    name
    location
    gardeners
    operators
    createdAt
  }
}
```

**Click "Play" to execute**. You'll see all gardens deployed on the network.

<!-- TODO: Add screenshot of query results -->
![Query Results](../.gitbook/assets/query-results.png)
*Gardens returned with all metadata*

### 1.3 Query Approved Work in a Garden

Want to see verified work for a specific garden?

```graphql
query GardenWork($gardenId: String!) {
  Work(where: {gardenId: {_eq: $gardenId}}) {
    id
    title
    gardener
    actionUID
    media
    metadata
    createdAt
    approvals: WorkApproval {
      approved
      feedback
      timestamp
    }
  }
}
```

**Variables**:
```json
{
  "gardenId": "42161-1"
}
```

Replace `42161-1` with any garden ID (format: `chainId-tokenId`).

### 1.4 Filter by Date Range

Only want recent work?

```graphql
query RecentApprovals($startDate: Int!) {
  WorkApproval(where: {
    approved: {_eq: true}
    timestamp: {_gte: $startDate}
  }) {
    id
    workUID
    approved
    feedback
    timestamp
    work: Work {
      title
      gardener
      media
    }
  }
}
```

**Variables**:
```json
{
  "startDate": 1704067200
}
```

Convert dates to Unix timestamp: [Epoch Converter](https://www.epochconverter.com/)

[Full API Reference →](../developer/api-reference.md)

---

## Step 2: Explore Gardens via UI

Prefer a visual interface? Use the client and admin apps.

### 2.1 Browse the Client App

1. **Visit**: [greengoods.app](https://greengoods.app)
2. **Login with passkey** (or skip login to browse publicly)
3. **Explore gardens**:
   - View garden profiles
   - See available actions
   - Browse completed work

<!-- TODO: Add screenshot of garden exploration -->
![Garden Exploration](../.gitbook/assets/garden-exploration.png)
*Browse gardens and their impact visually*

### 2.2 Use the Admin Dashboard

More detailed analytics:

1. **Visit**: [admin.greengoods.app](https://admin.greengoods.app)
2. **Connect wallet** (read-only access works)
3. **View garden dashboards**:
   - Cumulative metrics
   - Approval rates
   - Member activity

<!-- TODO: Add screenshot of admin dashboard analytics -->
![Admin Analytics](../.gitbook/assets/admin-analytics.png)
*Detailed garden-level analytics*

---

## Step 3: Verify On-Chain Attestations

Every approved work is permanently recorded on-chain via EAS (Ethereum Attestation Service).

### 3.1 Get Attestation UID

From your GraphQL query results, note the attestation UID.

Example: `0xb4318a3d228cb57828e9c56d96f88756beb71be540140226b8fc31ca97099f26`

### 3.2 View on EAS Explorer

**Arbitrum One**: https://arbitrum.easscan.org/attestation/view/[UID]
**Celo**: https://celo.easscan.org/attestation/view/[UID]
**Base Sepolia**: https://base-sepolia.easscan.org/attestation/view/[UID]

<!-- TODO: Add screenshot of EAS explorer page -->
![EAS Attestation](../.gitbook/assets/eas-attestation.png)
*Verify attestation details on EAS explorer*

**What You Can Verify**:
- ✅ Attester (who created the record)
- ✅ Schema (data structure)
- ✅ Timestamp (when it was created)
- ✅ Data (all encoded information)
- ✅ Referenced attestations (work → approval chain)

### 3.3 Verify Karma GAP Integration

Green Goods automatically creates Karma GAP attestations for:
- Garden creation (GAP Project)
- Work approval (GAP Impact)

View on Karma GAP platform: [karma-gap.io](https://gap.karmahq.xyz/)

---

## Step 4: Export Data for Analysis

### 4.1 Export from GraphQL

**Using GraphQL Playground**:
1. Run your query
2. Copy results (JSON format)
3. Paste into your analysis tool

**Using Code**:

```javascript
// Node.js example
import fetch from 'node-fetch';

const query = `
  query AllGardens {
    Garden {
      id
      name
      location
    }
  }
`;

const response = await fetch('https://indexer.hyperindex.xyz/0bf0e0f/v1/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query }),
});

const { data } = await response.json();
console.log(data.Garden);
```

**Python example**:

```python
import requests

query = """
query AllGardens {
  Garden {
    id
    name
    location
  }
}
"""

response = requests.post(
    'https://indexer.hyperindex.xyz/0bf0e0f/v1/graphql',
    json={'query': query}
)

gardens = response.json()['data']['Garden']
print(gardens)
```

### 4.2 Export from Admin Dashboard

1. Navigate to garden dashboard
2. Click "Export Data"
3. Choose format:
   - **CSV**: For Excel/spreadsheets
   - **JSON**: For programming/databases
4. Select date range
5. Download

---

## Common Evaluation Workflows

### Use Case 1: Grant Allocation Decision

**Scenario**: Foundation wants to fund top-performing gardens

**Workflow**:
1. Query all gardens with approval rates
   ```graphql
   query GardenStats {
     Garden {
       id
       name
       location
       workCount: Work_aggregate { aggregate { count } }
       approvedCount: Work_aggregate(where: {approvals: {approved: {_eq: true}}}) {
         aggregate { count }
       }
     }
   }
   ```

2. Calculate approval rates
3. Filter gardens with >80% approval rate
4. Verify attestations for top candidates
5. Make funding decision based on proven impact

### Use Case 2: Research Study

**Scenario**: Academic studying reforestation effectiveness

**Workflow**:
1. Query all tree-planting work across regions
   ```graphql
   query TreePlantingWork {
     Work(where: {title: {_ilike: "%tree%"}}) {
       id
       title
       metadata
       createdAt
       garden: Garden {
         location
       }
       approvals: WorkApproval(where: {approved: {_eq: true}}) {
         timestamp
       }
     }
   }
   ```

2. Parse metadata for species, survival rates
3. Correlate with geographic/environmental data
4. Analyze trends and effectiveness
5. Publish with verifiable on-chain sources

### Use Case 3: Impact Investor Due Diligence

**Scenario**: Evaluating garden for retroactive funding

**Workflow**:
1. Query garden's complete work history
2. Check approval consistency (same operator patterns?)
3. Review media evidence quality
4. Verify all attestations on-chain
5. Calculate total impact value
6. Make investment decision

[More Examples →](../guides/evaluators/exploring-gardens.md)

---

## Advanced: Integrate with Your Systems

### Pull Data into Dashboards

Use GraphQL subscriptions for real-time updates:

```graphql
subscription NewApprovals {
  WorkApproval(where: {approved: {_eq: true}}) {
    id
    workUID
    timestamp
    work: Work {
      title
      gardener
    }
  }
}
```

### Map to Impact Frameworks

Green Goods data maps to:
- **SDGs**: Tag actions by SDG alignment
- **Carbon Credits**: Extract emissions reduction metrics
- **Biodiversity**: Parse species and habitat data
- **Karma GAP**: Direct integration for standardized reporting

[Integration Guide →](../guides/evaluators/external-frameworks.md)

### Build Custom Analytics

Example: Impact leaderboard

```typescript
// Fetch and rank gardeners by approved work
const gardenerStats = await fetchGardenerStats();
const leaderboard = gardenerStats
  .map(g => ({
    address: g.address,
    approvedWork: g.workApprovals.length,
    totalImpact: calculateImpact(g.workApprovals)
  }))
  .sort((a, b) => b.totalImpact - a.totalImpact);
```

---

## Data Quality Considerations

### Verification Levels

**Level 1: Operator-Approved** ✅
- Validated by trusted community operators
- Suitable for most analyses

**Level 2: On-Chain Verified** ⛓️
- Cryptographically signed attestations
- Immutable record
- Suitable for high-stakes decisions

**Level 3: Multi-Garden Validated** 🌍
- Cross-referenced across gardens
- Consistent patterns
- Suitable for research publications

### Handling Rejections

Not all work is approved. Query both approved and rejected work:

```graphql
query ApprovalBreakdown($gardenId: String!) {
  approved: WorkApproval_aggregate(where: {
    work: {gardenId: {_eq: $gardenId}}
    approved: {_eq: true}
  }) {
    aggregate { count }
  }
  rejected: WorkApproval_aggregate(where: {
    work: {gardenId: {_eq: $gardenId}}
    approved: {_eq: false}
  }) {
    aggregate { count }
  }
}
```

**Rejection rate** can indicate:
- Learning curve for new gardeners
- Quality control rigor
- Action clarity issues

---

## Troubleshooting

### "GraphQL query fails"

- Check endpoint URL is correct
- Verify query syntax (use playground to test)
- Check for rate limits (contact support if hitting limits)

### "Attestation not found on-chain"

- Verify correct chain (Arbitrum vs Celo vs Base Sepolia)
- Check attestation UID is correct
- Ensure transaction was confirmed (may take 15-30 seconds)

### "Data seems outdated"

- Indexer may be syncing (usually < 1 minute lag)
- Refresh query
- Check indexer status

---

## Learn More

### Detailed Evaluator Guides

- [Accessing Data](../guides/evaluators/accessing-data.md)
- [Exploring Gardens & Work](../guides/evaluators/exploring-gardens.md)
- [Using Attestation Data](../guides/evaluators/using-attestation-data.md)
- [External Framework Integration](../guides/evaluators/external-frameworks.md)

### Understanding the System

- [Attestations & On-Chain Records](../concepts/attestations.md)
- [Gardens & Work](../concepts/gardens-and-work.md)
- [Karma GAP Integration](../developer/karma-gap.md)

### Developer Resources

- [API Reference](../developer/api-reference.md)
- [GraphQL Schema](../developer/architecture/indexer-package.md)

### Get Help

- 💬 **Community**: [Telegram](https://t.me/+N3o3_43iRec1Y2Jh)
- 📧 **Data Questions**: [GitHub Discussions](https://github.com/greenpill-dev-guild/green-goods/discussions)
- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/greenpill-dev-guild/green-goods/issues)

---

## What's Next?

You can now access and analyze verifiable regenerative impact data! 🎉

**Your evaluator toolkit**:
- ✅ Query flexible GraphQL API
- ✅ Verify on-chain attestations
- ✅ Export data for analysis
- ✅ Integrate with existing systems
- ✅ Make data-driven funding decisions

**Keep exploring**:
- Build custom dashboards
- Conduct research studies
- Map to impact frameworks
- Share insights with community

---

<p align="center">
  <strong>Ready to explore impact data?</strong><br>
  <a href="https://indexer.hyperindex.xyz/0bf0e0f/v1/graphql">Open GraphQL Playground →</a>
</p>

