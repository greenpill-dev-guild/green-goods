# Integrating with External Frameworks

Map Green Goods data to existing impact measurement standards and frameworks.

---

## Sustainable Development Goals (SDGs)

**Green Goods Actions Map To**:
- SDG 13: Climate Action (tree planting, carbon sequestration)
- SDG 14: Life Below Water (waterway restoration)
- SDG 15: Life on Land (biodiversity, reforestation)

**Query actions by SDG alignment** (future tagging system).

---

## Carbon Credit Frameworks

**Extract Carbon Data from Actions**:
```graphql
query CarbonActions($chainId: Int!) {
  Action(where: {
    chainId: {_eq: $chainId}
    title: {_ilike: "%tree%"}
  }) {
    id
    title
    instructions
    capitals
    ownerAddress
  }
}
```

**Then query work attestations** for those actions from **EAS GraphQL API**.

**Calculate**:
- Parse work attestation metadata for tree counts
- Trees planted × average CO2 sequestered per tree
- Area restored × carbon per hectare
- Long-term monitoring via attestation chain

---

## Biodiversity Indices

**Species Documentation**:
```graphql
# Step 1: Find biodiversity-related actions
query BiodiversityActions($chainId: Int!) {
  Action(where: {
    chainId: {_eq: $chainId}
    capitals: {_contains: "LIVING"}
  }) {
    id
    title
    instructions
  }
}
```

**Step 2**: Query work attestations for these actions from **EAS GraphQL** to get:
- `metadata` field (contains species lists)
- `media` field (photo evidence)
- `decodedDataJson` (structured data)

**Metrics**:
- Species count (from metadata)
- Habitat quality indicators
- Population trends over time

---

## Karma GAP Standard

**Automatic Integration**:
- All gardens = GAP projects
- All approved work = GAP impacts
- Query via Karma GAP API

**Benefits**:
- Standardized across protocols
- Multi-chain reporting
- Funder-friendly format

[Technical Details →](../../developer/karma-gap)

---

## Custom Frameworks

**Build Your Own Mappings**:
1. Query Green Goods GraphQL API
2. Extract relevant metrics
3. Transform to your format
4. Import to your system

**Example: Custom Dashboard**
```typescript
import { createClient } from 'urql';

const client = createClient({
  url: 'https://indexer.hyperindex.xyz/0bf0e0f/v1/graphql',
});

// Fetch and transform data
const { data } = await client.query(GARDENS_QUERY).toPromise();
const transformed = data.Garden.map(transformToOurFormat);
// Use in your dashboard
```

---

## Export Formats

**CSV**: Spreadsheets and basic analysis
**JSON**: Databases and programmatic access
**GraphQL**: Real-time integrations

---

## Learn More

- [Accessing Data](accessing-data)
- [API Reference](../../developer/api-reference)
- [Evaluator Quickstart](../../welcome/quickstart-evaluator)

