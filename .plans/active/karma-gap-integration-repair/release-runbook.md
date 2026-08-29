# Karma GAP Arbitrum Release Boundary

This lane does not authorize a deployment, upgrade, reconciliation transaction, or broadcast.

Before any Karma proxy upgrade is planned, reconstruct the complete historical
`GAPImpactCreated` inventory and pair every event's `workUID` with its `impactUID`. Supply those
ordered, comma-separated bytes32 lists as `KARMA_LEGACY_WORK_UIDS` and
`KARMA_LEGACY_PROJECT_UPDATE_UIDS`. The upgrade wrapper consumes both lists in one
`upgradeToAndCall`, seeds `projectUpdateUIDs`, and marks the migration complete before the upgraded
WorkApprovalResolver can create Project Updates. Missing, mismatched, zero, or conflicting entries
must block the upgrade; an unseeded upgraded module fails Project Update creation closed instead of
duplicating an immutable historical update.

Before any release decision, generate a fresh finalized-block inventory with an explicitly supplied
Arbitrum RPC endpoint:

```sh
bun .plans/active/karma-gap-integration-repair/arbitrum-karma-inventory.ts --rpc-url <RPC_URL>
```

The command is deliberately read-only and prints JSON to stdout. It inventories every Garden token,
canonical GardenAccount, current NFT owner, Karma project UID, sync version, and account proxy type.
It puts `aiyeloja-family-garden` first in the proposed release order and exits non-zero whenever a
release blocker is present.

The current deterministic account design is a hard boundary: GardenToken derived existing accounts
directly from the GardenAccount implementation, not from the deployed ERC-1967 AccountProxy. Those
legacy accounts therefore cannot execute UUPS upgrades, even when called by the Garden NFT owner.
Do not supply an implementation target or attempt an account upgrade until a separately reviewed
legacy-compatibility design is approved.

After that design exists, Aiyeloja remains the first canary. Do not expand to the remaining Gardens
until its required sync version, canonical Karma URL, ProjectDetails image and description,
Owner/Steward membership and admin access, revocation behavior, and indexer projections have all
been verified from live post-state. Implementation, review, deployment, reconciliation, and
expansion remain separate authorization boundaries.
