# Integration Snippets

Short, copy/pasteable examples for consuming Green Goods data from different environments.

## Node.js (fetch)

```ts
import fetch from "node-fetch";

const query = `
  query Gardens {
    Garden {
      id
      name
      location
    }
  }
`;

const response = await fetch("https://indexer.hyperindex.xyz/0bf0e0f/v1/graphql", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ query }),
});

const { data } = await response.json();
console.log(data.Garden);
```

## Python (requests)

```python
import requests

query = """
query ApprovedWork($limit: Int!) {
  Work(
    where: {approvals: {approved: {_eq: true}}}
    limit: $limit
    order_by: {createdAt: desc}
  ) {
    id
    title
    gardener
    createdAt
  }
}
"""

response = requests.post(
    "https://indexer.hyperindex.xyz/0bf0e0f/v1/graphql",
    json={"query": query, "variables": {"limit": 10}},
)

print(response.json()["data"]["Work"])
```

## React (urql)

```tsx
import { useQuery } from "urql";

const GARDEN_QUERY = `
  query Garden($id: String!) {
    Garden(where: {id: {_eq: $id}}) {
      id
      name
      location
      gardeners
    }
  }
`;

export function GardenCard({ gardenId }: { gardenId: string }) {
  const [{ data, fetching, error }] = useQuery({
    query: GARDEN_QUERY,
    variables: { id: gardenId },
  });

  if (fetching) return <p>Loading…</p>;
  if (error) return <p>Error: {error.message}</p>;

  const garden = data?.Garden?.[0];
  if (!garden) return <p>Garden not found.</p>;

  return (
    <article className="rounded-lg border p-4">
      <h2 className="text-lg font-semibold">{garden.name}</h2>
      <p className="text-sm text-text-sub">{garden.location}</p>
      <p className="text-xs text-text-soft">
        Gardeners: {garden.gardeners.length}
      </p>
    </article>
  );
}
```

## viem + EAS Attestation Lookup

```ts
import { createPublicClient, http } from "viem";
import { arbitrum } from "viem/chains";
import { EAS } from "@ethereum-attestation-service/eas-sdk";

const client = createPublicClient({
  chain: arbitrum,
  transport: http(),
});

const eas = new EAS("0xbD75f629A22Dc1ceD33dDA0b68c546A1c035c458", { client });

const attestationUID = "0xb4318a3d228cb57828e9c56d96f88756beb71be540140226b8fc31ca97099f26";
const attestation = await eas.getAttestation(attestationUID);

console.log(attestation);
```

## GraphQL Client Helpers

- Use [graphql-request](https://github.com/jasonkuhrt/graphql-request) for minimal clients.
- Showcase these recipes in CLI scripts to export CSV via `json2csv`.

---

Looking for more? Open a PR with additional snippets and link them here. See [Contributing to Documentation](../../reference/docs-contributing.md).

