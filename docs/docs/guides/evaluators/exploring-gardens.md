# Exploring Gardens & Work

Browse gardens, analyze impact metrics, and track community progress.

---

## Browsing Gardens

**Via GraphQL**:
```graphql
query Gardens($location: String) {
  Garden(where: {location: {_ilike: $location}}) {
    id
    name
    location
    gardeners
    operators
    workCount: Work_aggregate {
      aggregate { count }
    }
  }
}
```

**Filter By**:
- Location (city, region)
- Tags (future)
- Capital focus
- Activity level

---

## Garden-Level Analytics

**Key Metrics**:
- Total work submissions
- Approval rate
- Active gardeners
- Cumulative impact (trees planted, area restored, etc.)

**Query Example**:
```graphql
query GardenStats($gardenId: String!) {
  Garden(where: {id: {_eq: $gardenId}}) {
    name
    totalWork: Work_aggregate { aggregate { count } }
    approvedWork: Work_aggregate(
      where: {approvals: {approved: {_eq: true}}}
    ) {
      aggregate { count }
    }
    activeGardeners: gardeners
  }
}
```

---

## Viewing Work Details

**All work for a garden**:
```graphql
query AllGardenWork($gardenId: String!) {
  Work(where: {gardenId: {_eq: $gardenId}}) {
    id
    title
    gardener
    actionUID
    metadata
    media
    createdAt
    approvals: WorkApproval {
      approved
      feedback
      timestamp
    }
  }
}
```

**Photos/Media**: IPFS CIDs in `media` array. Fetch via `https://ipfs.io/ipfs/{CID}` or Pinata gateway.

---

## Learn More

- [Accessing Data](accessing-data.md)
- [Using Attestation Data](using-attestation-data.md)
- [External Frameworks](external-frameworks.md)

