# GreenWill Phase 0 Deployment Readiness - 2026-04-20

Scope: planning-only. No broadcast. No deployment JSON writes. No UI edits.

## Status

**Lane explicitly downgraded to planning-only.** `badge-locks` and `badge-schemas` CLI targets are wired into `bun script/deploy.ts`, produce real dry-run plans, and hard-fail on both `--broadcast` and on dry-run when required inputs are missing. Arbitrum Phase 0 broadcast remains **blocked** on the four factual pre-conditions listed at the bottom of this document.

## CLI Surface — Shipped

`bun script/deploy.ts --help` now exposes:

```text
Commands:
  core                     Deploy core contracts
  goods                    Deploy GOODS Juicebox project (requires env vars)
  juicebox                 Alias for 'goods' deployment
  octant-factory           Deploy Octant vault factory (auto-updates deployment JSON)
  garden <config.json>     Deploy garden from config file
  actions <config.json>    Deploy actions from config file
  hats-tree                Create and configure the Hats protocol tree
  badge-locks              Plan GreenWill reputation badge Unlock locks (planning only; broadcast blocked)
  badge-schemas            Plan GreenWill reputation badge EAS schema registration (planning only; broadcast blocked)
  status [network]         Check deployment status
  fork <network>           Start Anvil fork for network
```

Wiring lives in:

- `packages/contracts/script/deploy/cli.ts` — help text, constructor, switch dispatch.
- `packages/contracts/script/deploy/badge-locks.ts` — `BadgeLocksDeployer` + `deployBadgeLocks` export.
- `packages/contracts/script/deploy/badge-schemas.ts` — `BadgeSchemasDeployer` + `deployBadgeSchemas` export.

Current observed exit behavior (verified in-tree):

| Command | Exit | Observed stdout (last line) |
|---|---|---|
| `bun script/deploy.ts --help` | `0` | (help table above) |
| `bun script/deploy.ts badge-locks --network arbitrum --dry-run` | `1` | `❌ Error: badge-locks dry-run cannot plan without a resolvable Unlock factory address. …` |
| `bun script/deploy.ts badge-locks --network arbitrum --broadcast` | `1` | `❌ Error: badge-locks broadcast is blocked: this target is dry-run planning only. …` |
| `bun script/deploy.ts badge-schemas --network arbitrum --dry-run` | `0` | `[planning-only] Badge schema dry-run plan complete. Broadcast is blocked; see --help.` |
| `bun script/deploy.ts badge-schemas --network arbitrum --broadcast` | `1` | `❌ Error: badge-schemas broadcast is blocked: this target is dry-run planning only. …` |

`badge-schemas` dry-run succeeds today because Arbitrum `networks.arbitrum.contracts.easSchemaRegistry` is already recorded (`0xA310da9c5B885E7fb3fbA9D66E9Ba6Df512b78eB`). `badge-locks` dry-run fails today because `networks.arbitrum.contracts.unlockFactory` is absent.

## Deployment File Persistence Shape — Locked

The deployment JSON convention in this repo (see `packages/contracts/deployments/42161-latest.json`, writers in `packages/contracts/script/Deploy.s.sol:1272-1274`, readers in `packages/shared/src/config/blockchain.ts:143-157`) uses **top-level `schemas.*`** with sibling keys per schema:

```text
schemas: {
  workSchema, workSchemaUID, workName, workDescription,
  workApprovalSchema, workApprovalSchemaUID, workApprovalName, workApprovalDescription,
  assessmentSchema, assessmentSchemaUID, assessmentName, assessmentDescription,
  …
}
```

The `eas` block is only `{ address, schemaRegistry }` — contract addresses, not schema metadata.

GreenWill badge persistence adopts that convention:

```text
schemas: {
  …existing…,
  greenGoodsBadgeSchema:        "string badgeType, address recipient, uint40 earnedAt, string evidenceUri, uint8 tier",
  greenGoodsBadgeSchemaUID:     "<UID returned by SchemaRegistry.register on broadcast>",
  greenGoodsBadgeName:          "GreenGoodsBadge",
  greenGoodsBadgeDescription:   "Shared EAS schema for GreenWill reputation badges"
}
```

**One shared UID for all 6 badges, distinguished by the `badgeType` field inside each attestation** — reputation-badging Decision 11. No per-badge UID. No `eas.schemas.*` key.

Unlock-lock address persistence is a separate open question: the current repo convention uses flat top-level module keys (`gardenToken`, `actionRegistry`, `octantModule`), and `octant-factory.ts` persists a single `octantFactory` address. The six GreenWill locks need to be resolved to either (a) six flat keys such as `greenWillLockVerifiedGardener`, `greenWillLockActiveContributor`, … or (b) a grouped `greenWillLocks: { verifiedGardener, activeContributor, … }` object mirroring the `eas: { address, schemaRegistry }` grouping pattern. This decision is **deferred** to whoever adds the Unlock factory address; the CLI will hard-fail the dry-run until that happens, which guarantees persistence wiring is revisited at the same time.

## Badge Policy

All Phase 0 Unlock locks `transferrable=false`.

| Badge ID            | Expiration Policy          | Transfer |
|---------------------|---------------------------|----------|
| `verified-gardener` | `0` - lifetime            | `false`  |
| `active-contributor`| `1y`                      | `false`  |
| `stewardship`       | `0` - lifetime            | `false`  |
| `garden-operator`   | `0` - manager-revoked     | `false`  |
| `community-builder` | `0` - lifetime            | `false`  |
| `impact-verified`   | `0` - lifetime            | `false`  |

## EAS Schema Policy

Single shared `GreenGoodsBadge` schema, registered once.

- Contract: Arbitrum EAS SchemaRegistry `0xA310da9c5B885E7fb3fbA9D66E9Ba6Df512b78eB` (already in `networks.arbitrum.contracts.easSchemaRegistry`).
- Method: `register(string schema, address resolver, bool revocable)`.
- `schema`: `string badgeType, address recipient, uint40 earnedAt, string evidenceUri, uint8 tier`.
- `resolver`: `0x0000000000000000000000000000000000000000`.
- `revocable`: `true`.
- Persistence on broadcast: `schemas.greenGoodsBadgeSchemaUID` (+ sibling metadata keys above).

## Dry-run Preview — What the CLI Prints Today

### `badge-schemas --network arbitrum --dry-run`

Resolves the real Arbitrum SchemaRegistry, prints the `register` calldata, and lists the 6 badge IDs that will share the resulting UID. No chain writes, no deployment-file writes.

### `badge-locks --network arbitrum --dry-run`

Hard-fails with the explicit remediation message referenced above. Dry-run will begin planning Unlock `createLock` calldata for each of the 6 badges (using the policy table) as soon as a verified `networks.arbitrum.contracts.unlockFactory` is recorded.

## Pre-broadcast Blockers

1. **Arbitrum Unlock factory address.** Add a verified address under `networks.arbitrum.contracts.unlockFactory` in `packages/contracts/deployments/networks.json`. The `badge-locks` dry-run is gated on this.
2. **Lock persistence shape decision.** Resolve to either flat `greenWillLock*` keys or a grouped `greenWillLocks` object; wire the writer in the broadcast path; update the reader in `packages/shared` if badges become client-visible.
3. **Attester wallet + gas.** Confirm the Green Goods trusted attester wallet that will sign the `SchemaRegistry.register` call and, later, each badge attestation. Ensure it is funded on Arbitrum.
4. **Per-badge expiration support in `GreenWillUnlockModule`.** The module currently holds a single `defaultDuration`; the six badges have mixed expirations (`active-contributor` 1 year, `garden-operator` manager-revoked, others lifetime). Either extend the module to accept a per-badge duration on issuance, or deploy the six locks standalone outside the module and accept that issuance through the registry will not enforce mixed durations until the module is extended.

All four blockers must be resolved before broadcast is unblocked. The CLI already refuses the broadcast path; it will continue to refuse until the broadcast-path code is explicitly re-enabled after blockers close.

## Live-data Render Path Gaps (retained)

Read-only inspection only; no UI files were changed.

### `packages/admin/src/views/Actions/GreenWillPanel.tsx`

- The panel reads `useGreenWillBadgeDefinitions`, `useGreenWillBadges`, and `useGreenWillRecentGrants` against `DEFAULT_CHAIN_ID`.
- Definitions and recent grants have loading/error messages, but zero definitions or zero grants render as an empty list under a nonzero-looking shell. Day 2 should add explicit empty states if Arbitrum has no indexed GreenWill data yet.
- Invalid-address and lookup-error surfacing was fixed in Day 2 Lane B (tests cover all three failure paths). Empty-but-valid stays distinct from error.
- Badge titles only special-case `genesis`, `first-work`, and `first-support`. The six Phase 0 badge IDs will display as raw slugs unless metadata/copy is added.
- The hooks are imported from `@green-goods/shared/hooks` rather than the shared root barrel, because the root barrel still marks hooks as WIP. Not blocking; cleanup signal.

### `packages/client/src/views/Profile/Badges.tsx`

- `BADGE_ORDER`, icon/title/description/action copy only cover `genesis`, `first-work`, and `first-support`.
- Unknown badge slugs fall back to a generic award icon, raw slug title, and empty description.
- Earned/claimable empty states exist and should be acceptable for initial no-data states.
- The action model is still GreenWill claim/support oriented. Six Phase 0 reputation badges backed by EAS/Unlock will need copy and action rules before they look intentional in profile.

### Shared Data Path

- `packages/shared/src/utils/blockchain/contracts.ts` already reads `greenWillRegistry`, `greenWillUnlockModule`, and `greenWillSupportRouter` keys from deployment JSON, but the Arbitrum deployment file does not contain those keys today, so claim/support hooks resolve them to zero addresses.
- The displayed GreenWill admin/profile data comes from Envio `GreenWillBadgeDefinition`, `GreenWillBadgeOwnership`, and `GreenWillBadgeGrant` entities. Reputation plan D10 says EAS/Unlock are not indexed, so standalone Phase 0 EAS/Unlock deployment will not automatically populate these GreenWill lists unless the Day 2 plan either registers/uses GreenWill registry events or switches the six-badge UI path to direct EAS/Unlock reads.
