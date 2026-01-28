# Indexer Package (Envio GraphQL)

> **Audience:** Engineers working on `packages/indexer` or consuming Envio artifacts.
> **Related docs:** [Monorepo Structure](./architecture), [packages/indexer/README.md](https://github.com/greenpill-dev-guild/green-goods/tree/main/packages/indexer#readme)
> **Networks:** Arbitrum One (42161), Celo (42220), Base Sepolia (84532). Deployment data: `packages/contracts/deployments/*.json`. Updated November 2024.
> **External references:** Review the [Envio documentation](https://docs.envio.dev/) when modifying handlers, and align GraphQL schemas with the official Envio guidance.

Blockchain event indexer exposing Green Goods data via GraphQL.

---

## Quick Reference

**Path**: `packages/indexer/`
**Ports**:
- GraphQL API: http://localhost:8080 (password: `testing`)
- Indexer: http://localhost:9898
**Stack**: Envio HyperIndex + PostgreSQL + Hasura

**Commands**:
```bash
# Docker-based (recommended for macOS)
cd packages/indexer
bun run dev:docker           # Start full Docker stack
bun run dev:docker:logs      # View logs
bun run dev:docker:down      # Stop containers

# Native (Linux/Dev Container)
bun --filter indexer dev     # Start indexer (checks Docker)
bun --filter indexer stop    # Stop indexer
bun --filter indexer reset   # Reset completely
bun --filter indexer codegen # Regenerate after schema changes
```

> **macOS Note**: The native Envio indexer may crash due to a Rust `system-configuration` crate panic. Use the Docker-based approach (`dev:docker`) which containerizes everything.

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
4. Restart: `bun run dev:docker` (macOS) or `bun dev` (Linux)

**Docker Management**:

There are two Docker Compose configurations:

| File | Purpose |
|------|---------|
| `generated/docker-compose.yaml` | PostgreSQL + Hasura only (for native indexer) |
| `docker-compose.indexer.yaml` | Full stack including containerized indexer |

```bash
# Full Docker stack (recommended for macOS)
cd packages/indexer
bun run dev:docker        # Start
bun run dev:docker:logs   # View logs
bun run dev:docker:down   # Stop

# Native stack (Linux/Dev Container)
cd packages/indexer/generated
docker compose up -d      # Start PostgreSQL + Hasura
docker compose down       # Stop
docker compose logs -f    # View logs
```

⚠️ **Port Conflict**: Both stacks use ports 5433 and 8080. Stop one before starting the other.

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

