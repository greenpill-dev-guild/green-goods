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

**Extract Carbon Data**:
```graphql
query CarbonWork {
  Work(where: {title: {_ilike: "%tree%"}}) {
    title
    metadata
    actionUID
    approvals(where: {approved: {_eq: true}}) {
      timestamp
    }
  }
}
```

**Calculate**:
- Trees planted × average CO2 sequestered per tree
- Area restored × carbon per hectare
- Long-term monitoring via attestation chain

---

## Biodiversity Indices

**Species Documentation**:
```graphql
query BiodiversityWork {
  Work(where: {
    actionUID: {_in: [2, 5, 8]}  # Monitoring/survey actions
  }) {
    metadata  # Contains species lists
    media     # Photo evidence
  }
}
```

**Metrics**:
- Species count
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

[Technical Details →](../../developer/karma-gap.md)

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

- [Accessing Data](accessing-data.md)
- [API Reference](../../developer/api-reference.md)
- [Evaluator Quickstart](../../welcome/quickstart-evaluator.md)

