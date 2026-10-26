# Green Goods Indexer

The Green Goods indexer uses Envio HyperIndex `3.6.1` to process protocol events into PostgreSQL
and expose them through Hasura GraphQL. It indexes protocol state, not EAS attestations.

See the [Indexer package guide](https://docs.greengoods.app/builders/packages/indexer) for the
architecture and builder contract.

## Prerequisites

- Node.js and Bun versions pinned in the root [`.mise.toml`](../../.mise.toml)
- OrbStack or Docker Desktop for a local runtime
- Completed [repository onboarding](../../ONBOARDING.md)

Use the root `.env` only. `ENVIO_API_TOKEN` is required for reliable live Arbitrum catch-up.

## Development

```bash

# Generate Envio v3 declarations in .envio/
bun run --cwd packages/indexer codegen

# Typecheck handlers and tests
bun run --cwd packages/indexer build

# Run the real Envio v3 test indexer
bun run --cwd packages/indexer test

# Start Envio with its local database preserved
bun run --cwd packages/indexer dev
```

Native `envio dev` exposes GraphQL at `http://localhost:8080/v1/graphql` with local admin secret
`testing`. The package Docker Compose profile exposes the same API on port `3006`. Press Ctrl-C
to stop the attached development process while preserving the database.

`envio dev` no longer resets the local database automatically. A destructive local replay must be
intentional:

```bash
bun run --cwd packages/indexer dev --restart
```

`bun run --cwd packages/indexer db:down` stops the Envio-managed PostgreSQL and Hasura containers
without removing them, so the `envio-postgres-data` volume and the indexed state survive. It
selects the containers by Envio's `dev.envio.config-hash` label, which leaves the separate
`docker-compose.indexer.yaml` stack untouched. `bun run --cwd packages/indexer clean` removes TypeScript build metadata
only. `dev --restart` and `reset` are destructive to the local Envio database and require explicit
intent. Hosted deployment and reindexing are separate release operations and are not performed by
local validation.

> Do not implement `db:down` with `envio local docker down`. Despite its help text naming
> only containers, it also removes the `envio-postgres-data` volume, which discards the local
> indexed state and forces a full replay from the configured start blocks.

## Docker-backed runtime

For the full package-local stack:

```bash
bun run --cwd packages/indexer docker up
bun run --cwd packages/indexer docker logs
bun run --cwd packages/indexer docker down
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
bun run --cwd packages/indexer check:indexing-boundary  # verify chain, contract, address, and block invariants
bun run --cwd packages/indexer codegen                  # regenerate .envio/ declarations
bun run --cwd packages/indexer build                    # codegen plus strict TypeScript validation
bun run --cwd packages/indexer test                     # codegen plus Mocha handler tests
bun run --cwd packages/indexer test --scope handlers --coverage            # coverage over the v3 test indexer
bun run --cwd packages/indexer lint                     # indexer source and test lint
(cd packages/indexer && bun run dev:health -- --profile full)                   # full local-stack readiness checks
bun run --cwd packages/indexer db:up                    # start Envio-managed local containers
bun run --cwd packages/indexer db:down                  # stop (not remove) those containers; keeps the database volume
bun run --cwd packages/indexer reset                    # destructive: delete the local database and stop Envio
```

## Dynamic discovery

Garden accounts are discovered from `GardenToken.GardenMinted`, and vaults are discovered from
`OctantModule.VaultCreated`. The corresponding contract entries intentionally omit an address
where registration is fully dynamic. Keep both the runtime registration and focused tests when
changing either factory path.

## Entities

Entity families include the following; `schema.graphql` owns the complete field and entity inventory:

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

### Service-access projections

`VoucherIssuerAuthority` records the latest source issuer/token authority binding, including
revocation. On Arbitrum, the earned-voucher and redemption source proxies are registered
statically from `42161-pilot-downstream.json`. Each initializer emits `VoucherEndpointPinned` and
the first `VoucherPauseChanged` before the core pins the module, and Envio drops a dynamic
contract's events from before its registration block. The core's `EarnedVoucherModulePinned` and
`VoucherServiceSetupModulePinned` events still register the modules, which Envio skips as
duplicates. Discovery registers nothing on another chain and never changes previously
snapshotted terms approvals.

`VoucherReserveAsset` records issuer-owned adapter configuration. `VoucherPoolExchange` preserves
the exact amounts and fees emitted by `SwapSettlement`, identified by chain, pool, transaction
and log index. The event omits the output recipient, so this projection does not infer one.
Neither record establishes issuance, service delivery or renewed capacity. Individual/collective
identity, service units and approval provenance remain explicit reviewed metadata in Shared;
these facts are not emitted by the configuration events.

Gnosis (chain 100) indexing starts at block 48,925,690, the first deployment receipt in
`packages/contracts/deployments/100-pilot-downstream.json`. It pins the adapter, escrow, shared
pool and steward Safe receiver addresses from that record; the boundary check requires all four.
Local projection tests claim no hosted deployment.

The additive service data contract contains `ServiceOfferRevision`, `ServiceClaimConsent`,
`PersonalServicePurchase`, `PersonalServiceDepositReceipt`, `VoucherEndpointConfiguration`,
`VoucherRedemption`, `VoucherRedemptionCustody`, `VoucherRedemptionAction`,
`VoucherRedemptionActionResult` and `VoucherRedemptionAcknowledgment`.

Their IDs include the chain and lowercased emitting module. A purchase uses its funding ID within
that module; a consent uses its exact claim hash; a revision uses commitment ID and revision.
Source redemption and destination custody have independent chain/module identities. Never join
by a bare commitment, funding or redemption ID. Large contract integers, including revisions,
nonces, result sequences and canonical receipt log indices, use GraphQL `BigInt` decimal strings.
The `Int` discriminants retain the contract's numeric enum values.

Service events contain partial terms. Revision rows carry the hash, route and G$ price; they do
not contain the issuer, asset, service/remedy references or total units. Consent observation flags
do not establish that a request remains active. Before any action, Shared must read the supported
protocol version and authoritative current/accepted service views. An absent projection does not
establish a legacy route. Redemption command/execution/pending-action views supply fields omitted
from its events; endpoint rows preserve the separately observed peer identity.

`PersonalServiceDepositReceipt` records a privileged steward attestation. Its source transaction
position is separate from the claimed Celo receipt's chain, transaction, global log index and
block/hash. Gross debit, received net and their arithmetic difference stay separate. The indexed
event does not cryptographically verify that receipt. Selected and completed commercial outcomes
also remain separate, including a late-deposit refund selected before its child is queued.

Historical v1 destination approvals persist through failed token transfers. Unique successful action hashes
update actual voucher custody counters once; service units and voucher atomic units never share
a conversion formula. Each action result and acknowledgment attempt retains its own provenance.
The custody `latestResultSequence` is the largest observed `RedemptionActionResult` sequence;
issuer approval and return-permission events omit their internal result sequence. Source pending
stays pending until its authenticated result event arrives. `Active` does not prove presentation
or external access; `Closed` describes financial resolution. Existing core `confirmationPath`,
confirmer and dispute facts remain independent from explicit holder approval.

The registered-event tests use a temporary configuration with explicitly fictional local
Arbitrum/Gnosis accounts and remove it afterward. They prove no deployment, live CCIP transport,
member signing or external membership activation.

### Earned-voucher delivery and steward Safe mirroring

On Arbitrum, `EarnedVoucherTerms` and `EarnedVoucherConsent` mirror the earned-voucher module's
terms, issuer approval and first consent per participant and exact revision. The core's binding
still decides acceptance. `EarnedVoucherDistribution` records preparation, the latest dispatch
and the newest authenticated result. `EarnedVoucherDispatch` keeps one row per CCIP send, because
retries resend the same authorized bytes under a new message.

On Gnosis, `VoucherDistributionCommand`, `VoucherDistributionAttempt` and
`VoucherDistributionAcknowledgment` record the adapter's intake, each execution attempt and each
acknowledgment send or failure. A successful attempt is terminal on the adapter, but the source
learns it only from an authenticated acknowledgment, so the two sides stay separate rows.

`StewardRoleSource` records what the Arbitrum publisher queued, sent or deferred for each account;
a deferred revision above the dispatched one still awaits a send. `StewardRoleMirror` records the
revision the Gnosis receiver applied and its latest signer reconciliation, and
`StewardSafeReceiverState` records a one-way bootstrap finalization. None of these rows proves
current Safe ownership; read the Safe and its signer gate for that.


### Voucher acceptance and service v2

Core voucher facts add `VoucherCoreConfiguration`, `EarnedVoucherRevision` and
`VoucherServiceAcceptance`. The acceptance row records the permanent setup, authorization and
deposit-receipt hashes selected by the core; it does not infer work fulfillment or personal
confirmation. Its source setup key includes the source chain and setup module, while its claim
key includes the core module and exact claim hash.

Service v2 adds `VoucherServiceSetup`, `VoucherServiceCustody`, `VoucherServiceSetupResult`,
`VoucherServiceSetupAction`, `VoucherServiceFinalAllocation`, `VoucherServiceFinalLegResult`,
`VoucherServiceFinalResult` and `VoucherServiceAcknowledgment`. Source setup and destination
custody retain distinct emitting chain/module identities. Full authorization fields stay absent
until their typed v2 authorization event arrives; result-before-authorization records remain
explicitly incomplete. Setup results use a sequence domain independent of final results. Each
immutable result key includes the emitting chain, module, setup ID and sequence.

A frozen allocation records one holder-approved delivered service quantity and one complete
voucher release/refund split. Leg attempt keys add the decision, leg and attempt. Replaying an
attempt never adds another allocation or successful transfer. Financial closure describes voucher
custody; it never fulfills the existing core promise. Acknowledgment rows record sends/failures
by transaction and log position, with setup and final lanes kept separate. A late or missing
source result remains unknown rather than authorizing replacement value.

`VoucherPresented` is shared by v1 and v2. Before a typed v1 authorization, the legacy placeholder
stores `presentedUnitsObserved` and leaves `escrowedUnits` unchanged. A later genuine v1
authorization promotes that observation. V2 custody uses its typed full setup result instead;
shared issuer, presentment and return events never classify a record as v2. Partial placeholders
must not be aggregated as authorized legacy custody.

These routes run against the pilot addresses above. Tests exercise actual registered Envio v3
routes under a disposable fictional configuration, plus duplicate/reordered facts, incompatible
same-sequence results and late authorization checks.
These projections provide observations for review. Mutations still require supported canonical
contract views and separately approved deployment/account configuration.
