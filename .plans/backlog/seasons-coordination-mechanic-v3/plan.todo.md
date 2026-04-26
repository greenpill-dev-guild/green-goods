# Seasons — Coordination Mechanic (v3, backlog)

**Slug**: `seasons-coordination-mechanic-v3`
**Status**: `BACKLOG` — do not start without a named trigger
**Created**: `2026-04-25`
**Priority**: `p3` (only when a concrete coordination need names itself)

## Why this exists

Promote Seasons to on-chain primitive **only when a concrete coordination need names itself**. Examples of triggers that justify this work:

- "We want Hypercerts grouped per Season per Garden — one bundle at harvest, not arbitrary timing."
- "Vault distributions should execute at Season harvest, not arbitrary times."
- "Cross-garden coordination on a shared theme needs on-chain enforcement (e.g., a Pollinator Networks Season where contributing gardens form a coordinated cohort)."
- "Funder reporting (Karma GAP) needs Season-bound impact bundles, not running totals."

If none of these surface, `seasons-operator-managed-v2` is enough — do not build this on speculation. Coordination heaviness without earned need is the failure mode flagged repeatedly in `project_principles_audits`.

## Depends on

- `seasons-operator-managed-v2` must ship first — off-chain Season records and lifecycle exist.
- **A concrete coordination trigger must be named** — see triggers above.
- Audit budget exists (~$30-50k cycle, likely bundled with next contract audit; precedent: `agent-messaging-channels` bundles `SessionKeyValidator.sol` with the RWA epic).

## Scope (revisit when promoted)

- `SeasonRegistry` contract or extension to existing coordination contract — open question on shape.
- Hypercert minting bound to Season at harvest.
- Vault distribution lifecycle gated by Season state (close-on-harvest pattern).
- Cross-garden coordination on shared theme — what does this actually mean on-chain (shared registry, shared hat, shared escrow)?
- Indexer events + GraphQL schema for Season state.
- Audit gate before mainnet deploy.

## Trigger criteria — do not start until ALL true

- A specific use case names a concrete failure mode of off-chain Seasons (not "it would be nice").
- The coordination concern is shared by ≥2 stakeholder groups (e.g., operators + funders, or evaluators + funders).
- Audit budget identified (line item or bundled epic).
- `seasons-operator-managed-v2` has run through ≥1 full Season cycle.

## Open

- Contract shape: standalone `SeasonRegistry` vs extension of existing coordination contract.
- Audit bundling (likely with the next contract epic).
- Migration path for off-chain Season records into the on-chain registry.
- Indexer schema additions and re-index plan.
