## Green Goods Indexer (Envio)

This package contains the Envio indexer for Green Goods contracts. It exposes a GraphQL API used by the client for gardens, actions, work, approvals, and attestations.

### Run

```bash
pnpm dev
```

Visit http://localhost:8080 to see the GraphQL Playground, local password is `testing`.

### Generate files from `config.yaml` or `schema.graphql`

```bash
pnpm codegen
```

### Pre-requisites

- [Node.js (use v18 or newer)](https://nodejs.org/en/download/current)
- [pnpm (use v9 or newer)](https://pnpm.io/installation)
- [Docker desktop](https://www.docker.com/products/docker-desktop/)

### Entities (from `schema.graphql`)

- Gardens and Actions
- Work Submissions and Approvals
- EAS Attestations

### Client Configuration

- Default dev endpoint: `http://localhost:8080/v1/graphql`
- Override in client via `VITE_ENVIO_INDEXER_URL`
