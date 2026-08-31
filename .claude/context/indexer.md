# Indexer Package Context

Loaded when working in `packages/indexer/`. Extends `CLAUDE.md` and
`packages/indexer/AGENTS.md`.

## Quick Reference

| Command | Purpose |
| --- | --- |
| `bun run codegen` | Regenerate Envio v3 declarations in `.envio/` |
| `bun run build` | Codegen, then strict TypeScript validation |
| `bun run test` | Codegen, then Envio v3 handler tests |
| `bun run check:indexing-boundary` | Verify contracts, chains, addresses, and block boundaries |
| `bun run dev` | Start Envio with the local database preserved |
| `bun run stop` / `bun run db:down` | Stop (not remove) Envio-managed containers; keeps `envio-postgres-data` |
| `bun run dev:restart` | Destructive local replay from configured start blocks |
| `bun run reset` | Delete the local database and stop Envio |
| `bun run dev:docker` | Validate the package's self-contained Docker image |

Prerequisites are Node.js 22.12+, Bun, and OrbStack or Docker Desktop. Runtime scripts read the
repository-root `.env`; never add a package-level `.env`.

## Architecture

```text
packages/indexer/
├── config.yaml
├── schema.graphql
├── src/
│   ├── EventHandlers.ts
│   └── handlers/
├── test/
├── .envio/                 # ephemeral Envio v3 declarations
└── docker-compose.indexer.yaml
```

The indexer uses Envio HyperIndex `3.2.1`. `config.yaml` uses the v3 `chains` structure. Handlers
import `indexer` and entity types from `envio`; do not restore generated-v2 imports, ReScript
build steps, `MockDb`, package-local pnpm workflows, or package-local Envio skills.

## Data Boundary

The Envio indexer owns Green Goods protocol-event entities, including:

- Actions and Garden domain assignments
- Gardens and dynamically discovered GardenAccount updates
- Hats-based Garden roles
- Octant vaults, deposits, withdrawals, governance events, and dynamic vault registrations
- Yield allocations
- Hypercert linkage and claims
- Campaign Cookie Jar registrations and metadata
- GreenWill badge definitions and issues

It does not index EAS attestations. Assessments, work approvals, and work submissions are queried
from EAS GraphQL through `packages/shared/src/modules/data/eas.ts`.

## Preserved Runtime Invariants

- Preserve existing entity IDs and relationships during migrations. Most multichain entities use
  chain-composite IDs; Garden IDs intentionally remain their GardenAccount address for GraphQL
  compatibility.
- Every persisted entity retains its existing `chainId`.
- Keep relationship updates symmetric where the schema stores both sides.
- Normalize addresses only where the existing ID or field contract already requires it.
- Preserve configured start and end blocks exactly.
- GardenAccount discovery stays attached to `GardenToken.GardenMinted`.
- OctantVault discovery stays attached to `OctantModule.VaultCreated`; configured OctantVault
  entries intentionally have no static address.

## Envio v3 Handler Patterns

Register an event handler with `indexer.onEvent`:

```typescript
import { indexer, type Action } from "envio";

indexer.onEvent(
  { contract: "ActionRegistry", event: "ActionTitleUpdated" },
  async ({ event, context }) => {
    const id = `${event.chainId}-${event.params.actionUID.toString()}`;
    const existing = await context.Action.get(id);
    if (!existing) return;

    const updated: Action = {
      ...existing,
      title: event.params.title,
    };
    context.Action.set(updated);
  }
);
```

Register a dynamically discovered contract with `indexer.contractRegister`:

```typescript
indexer.contractRegister(
  { contract: "OctantModule", event: "VaultCreated" },
  async ({ event, context }) => {
    context.chain.OctantVault.add(event.params.vault);
    context.log.info(`Registered new OctantVault at ${event.params.vault}`);
  }
);
```

Use `context.log`; do not add `console.log`. Create defaults only where existing behavior requires
update-before-create handling, and preserve every unaffected entity field when updating.

## Development Workflow

```bash
cd packages/indexer
bun run codegen
bun run build
bun run test
bun run dev
```

`bun run dev` is the repository's Bun-first entry point, loads `../../.env`, and launches Envio
through the supported system Node 22 runtime selected by `scripts/dev/node-cli.js`. Envio manages
PostgreSQL and Hasura through Docker and preserves the named database volume across normal
shutdowns. Press Ctrl-C to stop an attached development process.

Use the package Docker profile only when validating the containerized image:

```bash
bun run dev:docker
bun run dev:docker:logs
bun run dev:docker:down
```

The package Docker profile exposes PostgreSQL on `3008`, Hasura GraphQL on `3006`, and the Envio
service on `3007`. The standard Envio runtime exposes GraphQL at
`http://localhost:8080/v1/graphql`.

## Database Safety

Safe commands:

```bash
bun run clean     # remove TypeScript build metadata only
bun run stop      # stop (not remove) Envio-managed containers; keeps envio-postgres-data
bun run db:down   # same database-preserving container shutdown
```

Both stop commands select containers by Envio's `dev.envio.config-hash` label, so they never touch
the separate `docker-compose.indexer.yaml` stack.

Destructive commands:

```bash
bun run dev:restart  # clear local state, then replay
bun run reset        # delete local database and stop Envio
```

`envio local docker down` is also destructive despite help text that names only containers: it
removes `envio-postgres-data` too. Do not wire it into `stop` or `db:down`.

Never use a destructive command merely to resolve a port conflict. Identify the process with
`lsof`, stop the owning attached process with Ctrl-C, or use the matching database-preserving
Docker-down command. Hosted deployment and reindex remain separately authorized release actions.

## Testing

Tests import the v3 adapter from `test/v3.ts`:

```typescript
import { ActionRegistry, createTestIndexer } from "./v3";

const indexer = createTestIndexer();
const event = ActionRegistry.ActionTitleUpdated.createMockEvent({
  owner,
  actionUID: 1n,
  title: "Updated",
  mockEventData,
});

await ActionRegistry.ActionTitleUpdated.processEvent({ event, mockDb: indexer });
const action = await indexer.Action.get(`${chainId}-1`);
```

When a test needs several events but does not assert intermediate state, batch them through
`processEvents` so Envio runs one indexer cycle. Keep distinct blocks and `logIndex` values when
order is material.

Required migration checks:

```bash
bun run check:indexing-boundary
bun run codegen
bun run build
bun run test
```

Focused migration proof also covers dynamic GardenAccount/OctantVault registration, representative
retained handlers, clean replay determinism, and the same-store repeated-range guard.

## GraphQL

- Standard Envio runtime: `http://localhost:8080/v1/graphql`
- Package Docker profile: `http://localhost:3006/v1/graphql`
- Local Hasura admin secret: `testing`

Before claiming runtime readiness, verify `/healthz`, `_meta` chain progress and start blocks,
dynamic registrations, and a representative non-empty Green Goods query.

## Reference Files

- Schema: `packages/indexer/schema.graphql`
- Configuration: `packages/indexer/config.yaml`
- Registration entry point: `packages/indexer/src/EventHandlers.ts`
- Handler modules: `packages/indexer/src/handlers/`
- V3 test adapter: `packages/indexer/test/v3.ts`
- Boundary guard: `packages/indexer/scripts/check-indexing-boundary.mjs`
- Builder documentation: `docs/docs/builders/packages/indexer.mdx`
- Deployment and local-runtime runbook: `packages/indexer/README.md`
