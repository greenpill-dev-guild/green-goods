# Green Goods Indexer

The Green Goods indexer uses Envio HyperIndex `3.2.1` to process protocol events into PostgreSQL
and expose them through Hasura GraphQL. It indexes protocol state, not EAS attestations.

See the [Indexer package guide](https://docs.greengoods.app/builders/packages/indexer) for the
architecture and builder contract.

## Prerequisites

- Node.js `22.12.x`
- Bun `1.x`
- OrbStack or Docker Desktop for a local runtime
- A completed root `bun install --frozen-lockfile`

Use the root `.env` only. `ENVIO_API_TOKEN` is required for reliable live Arbitrum catch-up.

## Development

```bash
cd packages/indexer

# Generate Envio v3 declarations in .envio/
bun run codegen

# Typecheck handlers and tests
bun run build

# Run the real Envio v3 test indexer
bun run test

# Start Envio with its local database preserved
bun run dev
```

Native `envio dev` exposes GraphQL at `http://localhost:8080/v1/graphql` with local admin secret
`testing`. The package Docker Compose profile exposes the same API on port `3006`. Press Ctrl-C
to stop the attached development process while preserving the database.

`envio dev` no longer resets the local database automatically. A destructive local replay must be
intentional:

```bash
bun run dev:restart
```

`bun run stop` and `bun run db:down` stop the Envio-managed PostgreSQL and Hasura containers
without removing them, so the `envio-postgres-data` volume and the indexed state survive. They
select the containers by Envio's `dev.envio.config-hash` label, which leaves the separate
`docker-compose.indexer.yaml` stack untouched. `bun run clean` removes TypeScript build metadata
only. `dev:restart` and `reset` are destructive to the local Envio database and require explicit
intent. Hosted deployment and reindexing are separate release operations and are not performed by
local validation.

> Do not implement `stop`/`db:down` with `envio local docker down`. Despite its help text naming
> only containers, it also removes the `envio-postgres-data` volume, which discards the local
> indexed state and forces a full replay from the configured start blocks.

## Docker-backed runtime

For the full package-local stack:

```bash
bun run dev:docker
bun run dev:docker:logs
bun run dev:docker:down
```

This exposes PostgreSQL on `3008`, Hasura GraphQL on `3006`, and the Envio service on `3007`.
The Docker build uses the repository root `bun.lock`; there is no nested generated package install.

## Envio v3 contract

- `config.yaml` uses `chains`, with the existing Arbitrum and Sepolia start blocks preserved.
- Handlers register through `indexer.onEvent`.
- Dynamic GardenAccount and OctantVault addresses register through `indexer.contractRegister`.
- Tests use `createTestIndexer` and simulated chain events.
- Generated declarations live in `.envio/` and are ignored.
- `envio-env.d.ts` exposes those declarations to TypeScript.
- Root and package workflows are Bun-first. Do not restore generated-v2 ReScript or package-local
  pnpm setup.

## Commands

```bash
bun run check:indexing-boundary  # verify chain, contract, address, and block invariants
bun run codegen                  # regenerate .envio/ declarations
bun run build                    # codegen plus strict TypeScript validation
bun run test                     # codegen plus Mocha handler tests
bun run test:coverage            # coverage over the v3 test indexer
bun run lint                     # indexer source and test lint
bun run doctor                   # full local-stack readiness checks
bun run db:up                    # start Envio-managed local containers
bun run db:down                  # stop (not remove) those containers; keeps the database volume
bun run stop                     # same volume-preserving stop as db:down
bun run reset                    # destructive: delete the local database and stop Envio
```

## Dynamic discovery

Garden accounts are discovered from `GardenToken.GardenMinted`, and vaults are discovered from
`OctantModule.VaultCreated`. The corresponding contract entries intentionally omit an address
where registration is fully dynamic. Keep both the runtime registration and focused tests when
changing either factory path.

## Entities

The full set defined in `schema.graphql` — this list is exhaustive; nothing else is indexed:

- Gardens and actions: `Garden`, `Gardener`, `Action`, `GardenDomains`
- Vaults and yield: `GardenVault`, `GardenVaultIndex`, `VaultAddressIndex`, `VaultDeposit`,
  `VaultEvent`, `YieldAllocation`
- Hypercerts: `Hypercert`, `HypercertClaim` (minimal linkage only)
- Campaigns: `CampaignCookieJar`
- GreenWill badges: `GreenWillBadgeDefinition`, `GreenWillBadgeGrant`, `GreenWillBadgeOwnership`

Garden governance, signal pools, hat trees, grant-failure records, generic cookie jars, and ENS
registration lifecycle are **not** indexer entities. Hats role membership is folded into `Garden`
role arrays rather than a separate entity.

### Entity ID convention

Most entities use chain-composite IDs (`${chainId}-${identifier}`) so the same address on two
chains cannot collide. **`Garden.id` is a deliberate exception**: it is the bare GardenAccount
address, preserved for GraphQL compatibility with existing consumers. Do not "fix" it to a
composite ID — that is a breaking change to the public query surface.

ENS profile text fields on `Gardener` remain schema fields for client consumption; handlers do not
populate them. The client resolves those values from ENS text records.
