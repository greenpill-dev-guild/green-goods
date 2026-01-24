# Indexer Package (Envio GraphQL)

> **Audience:** Engineers working on `packages/indexer` or consuming Envio artifacts.
> **Related docs:** [Monorepo Structure](monorepo-structure), [packages/indexer/README.md](https://github.com/greenpill-dev-guild/green-goods/tree/main/packages/indexer#readme)
> **Networks:** Arbitrum One (42161), Celo (42220), Base Sepolia (84532). Deployment data: `packages/contracts/deployments/*.json`. Updated November 2024.
> **External references:** Review the [Envio documentation](https://docs.envio.dev/) when modifying handlers, and align GraphQL schemas with the official Envio guidance.

Blockchain event indexer exposing Green Goods data via GraphQL.

---

## Quick Reference

**Path**: `packages/indexer/`
**Port**: http://localhost:8080
**Password**: `testing` (local)
**Stack**: Envio HyperIndex + PostgreSQL

**Commands**:
```bash
bun --filter indexer dev     # Start indexer (checks Docker)
bun --filter indexer stop    # Stop indexer
bun --filter indexer reset   # Reset completely
bun --filter indexer codegen # Regenerate after schema changes
```

---

## What It Indexes

**Events**:
- Garden creation (`GardenMinted`)
- Action registration (`ActionRegistered`)
- Garden updates (`NameUpdated`, `DescriptionUpdated`, `LocationUpdated`, etc.)
- Member changes (`GardenerAdded`, `GardenerRemoved`, `GardenOperatorAdded`, `GardenOperatorRemoved`)
- GAP project tracking (`GAPProjectCreated`)

**Note**: Work submissions and approvals are **not** indexed by Envio. Query them from EAS GraphQL instead.

**Entities**:
- Gardens (garden metadata, members, GAP projects)
- Actions (task registry)
- Gardeners (member profiles)

---

## GraphQL API

**Public Endpoint**: https://indexer.hyperindex.xyz/0bf0e0f/v1/graphql

**Query Example**:
```graphql
query Gardens {
  Garden {
    id
    name
    location
    gardeners
  }
}
```

**Subscription Example**:
```graphql
subscription NewWork {
  Work {
    id
    title
    gardener
  }
}
```

---

## Architecture

```
Blockchain Events
  ↓
Envio Event Handlers (ReScript)
  ↓
PostgreSQL Database
  ↓
GraphQL API (Hasura)
```

**Files**:
- `config.yaml`: Networks and contracts
- `schema.graphql`: Entity definitions
- `src/EventHandlers.ts`: Event processing logic
- `abis/`: Contract ABIs

---

## Development

**Schema Changes**:
1. Edit `schema.graphql`
2. Run `bun codegen`
3. Run `bun run setup-generated`
4. Restart: `bun dev`

**Docker Management**:
```bash
docker compose down     # Stop
docker compose up -d    # Start
docker compose logs -f  # View logs
```

---

## Conventions

### Entity IDs

**Composite format**: `chainId-identifier`

```typescript
const gardenId = `${chainId}-${tokenId}`;
// Example: "42161-1" (Arbitrum garden #1)
```

### Always Include chainId

```graphql
type Garden @entity {
  id: ID!
  chainId: Int!  # Required for multi-chain
  # ...
}
```

---

## Complete Documentation

**📖 Full details**: [packages/indexer/README.md](https://github.com/greenpill-dev-guild/green-goods/tree/main/packages/indexer#readme)

**Key Files**:
- Patterns and conventions: `.claude/context/indexer.md`

