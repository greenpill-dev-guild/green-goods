# GraphQL Recipes

> Copy/paste queries for the Envio indexer (`https://indexer.hyperindex.xyz/0bf0e0f/v1/graphql`). Adapt filters as needed.

## All Gardens

```graphql
query AllGardens {
  Garden {
    id
    name
    location
    chainId
    gardeners
    operators
    createdAt
  }
}
```

## Garden by ID with Stats

```graphql
query GardenWithStats($gardenId: String!) {
  Garden(where: {id: {_eq: $gardenId}}) {
    id
    name
    location
    gapProjectUID
    workAggregate: Work_aggregate {
      aggregate { count }
    }
    approvedAggregate: Work_aggregate(where: {approvals: {approved: {_eq: true}}}) {
      aggregate { count }
    }
  }
}
```

## All Actions for a Garden

```graphql
query GardenActions($gardenId: String!) {
  Action(where: {gardenId: {_eq: $gardenId}}) {
    id
    title
    instructions
    capitals
    startTime
    endTime
  }
}
```

## Pending Work (Awaiting Approval)

```graphql
query PendingWork($gardenId: String!) {
  Work(where: {
    gardenId: {_eq: $gardenId}
    approvals: {approved: {_is_null: true}}
  }) {
    id
    title
    gardener
    actionUID
    media
    metadata
    createdAt
  }
}
```

## Approved Work with Feedback

```graphql
query ApprovedWork($gardenId: String!, $limit: Int = 20) {
  Work(
    where: {gardenId: {_eq: $gardenId}}
    order_by: {createdAt: desc}
    limit: $limit
  ) {
    id
    title
    gardener
    createdAt
    approvals(where: {approved: {_eq: true}}) {
      approved
      feedback
      timestamp
      attestationUID
    }
  }
}
```

## Live Subscription (New Approvals)

```graphql
subscription NewApprovals {
  WorkApproval(where: {approved: {_eq: true}}) {
    id
    workUID
    feedback
    timestamp
    work {
      id
      title
      gardener
      gardenId
    }
  }
}
```

## Filter by Time Range

```graphql
query WorkInRange($start: Int!, $end: Int!) {
  Work(where: {
    createdAt: {_gte: $start, _lte: $end}
  }) {
    id
    title
    gardener
    actionUID
    createdAt
  }
}
```

> ℹ️ Need more? Check the full [API & Integration Reference](../../developer/api-reference.md).

