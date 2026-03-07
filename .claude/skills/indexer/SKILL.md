---
name: indexer
user-invocable: false
description: Envio blockchain indexer development. Use for event handlers, schema.graphql design, Docker workflow, and GraphQL patterns.
---

# Indexer Skill

Envio-based blockchain indexer development guide for the Green Goods protocol.

---

## Activation

When invoked:
- Check `packages/indexer/` for existing event handlers and schema patterns.
- Load `.claude/context/indexer.md` for full package-specific patterns.
- On macOS, always use Docker-based commands (`dev:docker`).

## Part 1: Entity Design

### Project Structure

```
packages/indexer/
├── schema.graphql      # Entity definitions
├── config.yaml         # Network + contract config
├── src/
│   └── EventHandlers.ts  # Event processing
├── test/               # Tests
└── generated/          # Envio-generated code
```

### MANDATORY: chainId Field

All entities must include chainId for multi-chain support:

```graphql
type Garden @entity {
  id: ID!
  chainId: Int!  # REQUIRED on every entity
  tokenAddress: String!
}
```

### Composite ID Pattern (MANDATORY)

Prevent ID collisions across chains:

```typescript
// Format: chainId-identifier
const gardenId = `${event.chainId}-${tokenId}`;
const actionId = `${event.chainId}-${actionUID}`;
const gardenerId = `${event.chainId}-${address}`;
```

### Bidirectional Relationships (MANDATORY)

When updating relationships, update BOTH sides:

```typescript
// 1. Update Garden.gardeners
const garden = await context.Garden.get(gardenId);
if (garden) {
  const gardeners = garden.gardeners || [];
  if (!gardeners.includes(gardenerAddress)) {
    context.Garden.set({ ...garden, gardeners: [...gardeners, gardenerAddress] });
  }
}

// 2. Update Gardener.gardens
const existingGardener = await context.Gardener.get(gardenerId);
const gardens = existingGardener?.gardens || [];
context.Gardener.set({
  id: gardenerId,
  chainId,
  address: gardenerAddress,
  gardens: gardens.includes(gardenId) ? gardens : [...gardens, gardenId],
});
```

## Part 2: Event Handler Patterns

### Standard Handler Template

```typescript
ContractName.EventName.handler(async ({ event, context }) => {
  const chainId = event.chainId;

  try {
    // 1. Extract event data
    const tokenId = event.params.tokenId.toString();

    // 2. Create composite ID
    const entityId = `${chainId}-${tokenId}`;

    // 3. Fetch additional data if needed
    const metadata = await context.ContractName.method(tokenId);

    // 4. Set entity
    context.EntityName.set({
      id: entityId,
      chainId: chainId,
      createdAt: event.block.timestamp,
    });
  } catch (error) {
    console.error(`[EventName] Error processing event:`, error);
    // Graceful degradation — create with minimal data
  }
});
```

### Create-If-Not-Exists Pattern

For update events that may arrive before creation events:

```typescript
const existing = await context.Garden.get(gardenId);

context.Garden.set({
  id: gardenId,
  chainId: chainId,
  tokenAddress: existing?.tokenAddress ?? "",
  tokenID: existing?.tokenID ?? BigInt(0),
  name: event.params.name,  // Apply the update
  description: existing?.description ?? "",
});
```

## Part 3: Development Workflow

### Starting the Indexer

**macOS (Docker-Based, Recommended):**
```bash
bun run dev:docker          # Start full stack (PG + Hasura + Indexer)
bun run dev:docker:logs     # View logs
bun run dev:docker:down     # Stop
```

**Linux/Dev Container (Native):**
```bash
bun dev   # Start native indexer
bun stop  # Stop
```

### Docker Compose Files

| File | Purpose |
|------|---------|
| `docker-compose.indexer.yaml` | Full stack (PG + Hasura + Indexer) |
| `generated/docker-compose.yaml` | PostgreSQL + Hasura only (native indexer) |

Port 5433 and 8080 are shared — stop one before starting the other.

### When to Run Codegen

Run `bun codegen` after:
- Changing `schema.graphql`
- Updating `config.yaml`
- Adding new contract events
- When generated types are missing

```bash
bun codegen
bun run setup-generated  # Rebuild ReScript after codegen
```

### When to Reset

Run `bun reset` for:
- Docker overlay filesystem errors
- Database schema migrations
- "Failed to mount" errors
- Starting fresh after testing

## Part 4: Testing

### Basic Test Structure

```typescript
import { TestHelpers, ActionRegistry, GardenToken, GardenAccount } from "generated";
const { MockDb, Addresses } = TestHelpers;

it("example test", async () => {
  // 1. Create mock database
  let mockDb = MockDb.createMockDb();

  // 2. Pre-seed entities if needed
  mockDb = mockDb.entities.Garden.set({
    id: "0x123...",
    chainId: 42161,
  });

  // 3. Create mock event
  const mockEvent = GardenAccount.GardenerAdded.createMockEvent({
    updater: "0x...",
    gardener: "0x...",
    mockEventData: {
      chainId: 42161,
      block: { timestamp: 12345 },
      srcAddress: "0x123...",
    },
  });

  // 4. Process event
  const result = await GardenAccount.GardenerAdded.processEvent({
    event: mockEvent,
    mockDb,
  });

  // 5. Assert results
  const garden = result.entities.Garden.get("0x123...");
  assert.ok(garden.gardeners.includes("0x..."));
});
```

### Test Categories

- **Capital Mapping:** All 8 capital types + UNKNOWN fallback
- **Multi-Chain ID Collision:** Same IDs on different chains stay separate
- **Bidirectional Updates:** Both sides of relationships update correctly
- **Create-If-Not-Exists:** Update events work without prior creation

## Part 5: Troubleshooting

### Docker Not Running

```bash
open -a Docker
# Wait 30 seconds
docker ps  # Verify working
bun dev
```

### Docker Overlay/Mount Errors

```bash
bun reset  # Quick fix

# Or manual cleanup
docker compose down -v
docker ps -a --filter "name=generated-envio" --format "{{.ID}}" | xargs docker rm -f
docker volume ls --filter "name=generated" --format "{{.Name}}" | xargs docker volume rm
rm -rf generated/persisted_state.envio.json .envio
docker system prune -f
```

### ReScript Compilation Errors

```bash
bun reset
bun run setup-generated
bun run dev:manual
```

### Port Conflicts

```bash
lsof -i :8080
kill -9 <PID>
# Or: bun stop
```

### GraphQL Playground

- **URL:** http://localhost:8080
- **Password:** `testing`
- **Health check:** http://localhost:8080/healthz

## Anti-Patterns

- **Never omit chainId** — breaks multi-chain support
- **Never use simple IDs** — always composite `chainId-identifier`
- **Never update one side of a relationship** — always bidirectional
- **Never assume creation order** — use create-if-not-exists pattern

## Related Skills

- `contracts` — When contract events change, update schema.graphql and handlers
- `testing` — For TDD workflow applied to indexer tests
- `tanstack-query` — For querying indexed data from the frontend

## Reference Files

- Schema: `schema.graphql`
- Handlers: `src/EventHandlers.ts`
- Config: `config.yaml`
- Tests: `test/test.ts`
- Full context: `.claude/context/indexer.md`
