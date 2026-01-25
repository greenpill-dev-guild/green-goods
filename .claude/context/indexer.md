# Indexer Package Context

Loaded when working in `packages/indexer/`. Extends CLAUDE.md.

## Quick Reference

| Command | Purpose |
|---------|---------|
| `bun run dev:docker` | Start Docker-based indexer (recommended for macOS) |
| `bun run dev:docker:logs` | View Docker indexer logs |
| `bun run dev:docker:down` | Stop Docker containers |
| `bun dev` | Start native indexer (Linux/Dev Container) |
| `bun stop` | Stop native indexer |
| `bun reset` | Reset state completely |
| `bun codegen` | Regenerate after schema/config changes |
| `bun test` | Run tests |

**Prerequisite:** Docker Desktop must be running.

> **macOS Note:** Use Docker-based commands (`dev:docker`) to avoid Rust `system-configuration` crate panic. PM2 uses Docker automatically when running `bun dev` from monorepo root.

## Architecture

```
packages/indexer/
├── schema.graphql      # Entity definitions
├── config.yaml         # Network + contract config
├── src/
│   └── EventHandlers.ts  # Event processing
├── test/               # Tests
└── generated/          # Envio-generated code
```

## Critical Patterns

### MANDATORY: chainId Field

**All entities must include chainId for multi-chain support:**

```graphql
type Garden @entity {
  id: ID!
  chainId: Int!  # ← REQUIRED
  tokenAddress: String!
  # ...
}

type Action @entity {
  id: ID!
  chainId: Int!  # ← REQUIRED
  actionUID: String!
  # ...
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

**Why:** Same actionUID on Base Sepolia vs Arbitrum creates separate entities.

### Event Handler Pattern

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
      // ... fields
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
GardenAccount.NameUpdated.handler(async ({ event, context }) => {
  const gardenId = event.srcAddress;  // Garden TBA address
  const chainId = event.chainId;

  // Get existing or create minimal entity
  const existingGarden = await context.Garden.get(gardenId);

  context.Garden.set({
    // Preserve existing fields or use defaults
    id: gardenId,
    chainId: chainId,
    tokenAddress: existingGarden?.tokenAddress ?? "",
    tokenID: existingGarden?.tokenID ?? BigInt(0),
    // Apply update
    name: event.params.name,
    // Keep other fields
    description: existingGarden?.description ?? "",
  });
});
```

### Bidirectional Relationships (MANDATORY)

When updating relationships, update BOTH sides:

```typescript
GardenAccount.GardenerAdded.handler(async ({ event, context }) => {
  const chainId = event.chainId;
  const gardenId = event.srcAddress;
  const gardenerAddress = event.params.gardener.toLowerCase();
  const gardenerId = `${chainId}-${gardenerAddress}`;

  // 1. Update Garden.gardeners
  const garden = await context.Garden.get(gardenId);
  if (garden) {
    const gardeners = garden.gardeners || [];
    if (!gardeners.includes(gardenerAddress)) {
      context.Garden.set({
        ...garden,
        gardeners: [...gardeners, gardenerAddress],
      });
    }
  }

  // 2. Update Gardener.gardens
  const existingGardener = await context.Gardener.get(gardenerId);
  const gardens = existingGardener?.gardens || [];

  context.Gardener.set({
    id: gardenerId,
    chainId: chainId,
    address: gardenerAddress,
    gardens: gardens.includes(gardenId) ? gardens : [...gardens, gardenId],
  });
});
```

## Development Workflow

### Starting the Indexer

**Option A: Docker-Based (Recommended for macOS)**
```bash
# Start full Docker stack (PostgreSQL + Hasura + Indexer)
bun run dev:docker

# View logs
bun run dev:docker:logs

# Stop
bun run dev:docker:down
```

**Option B: Native (Linux/Dev Container)**
```bash
# Ensure Docker is running
open -a Docker  # macOS
# Wait 30 seconds

# Start native indexer
bun dev
```

### Docker Compose Files

| File | Purpose |
|------|---------|
| `docker-compose.indexer.yaml` | Full stack (PG + Hasura + Indexer) |
| `generated/docker-compose.yaml` | PostgreSQL + Hasura only (for native indexer) |

⚠️ **Port Conflict:** Both use ports 5433 and 8080. Stop one before starting the other.

### When to Run Codegen

- After changing `schema.graphql`
- After updating `config.yaml`
- After adding new contract events
- When generated types are missing

```bash
bun codegen
bun run setup-generated  # Rebuild ReScript after codegen
```

### When to Reset

- Docker overlay filesystem errors
- Database schema migrations
- "Failed to mount" errors
- Starting fresh after testing

```bash
bun reset
```

## Troubleshooting

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
# Port 8080 (GraphQL Playground)
lsof -i :8080
kill -9 <PID>

# Or use bun stop
bun stop
```

## Testing

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
    // ...
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

## GraphQL Playground

- **URL:** http://localhost:8080
- **Password:** `testing`
- **Health check:** http://localhost:8080/healthz

## Reference Files

- Schema: `schema.graphql`
- Handlers: `src/EventHandlers.ts`
- Config: `config.yaml`
- Tests: `test/test.ts`
