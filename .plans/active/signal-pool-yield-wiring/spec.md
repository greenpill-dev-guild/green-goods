# Signal Pool → Yield Wiring Supplement Spec

## Summary

This hub closes the last protocol gap between signal pool creation and yield routing. It auto-wires hypercert pools into `YieldResolver`, widens repair access to trusted system and operator paths, adds safe treasury fallbacks, and gives the shared/admin layers enough feedback to confirm whether a pool creation flow actually connected yield routing.

## Users

- Primary: protocol owners and operators responsible for garden setup
- Secondary: engineers working on yield flow, conviction pools, and admin recovery tooling

## Functional Requirements

1. `GardensModule` must store a `yieldResolver` reference and auto-call `setGardenHypercertPool(garden, hypercertPool)` during pool creation.
2. `YieldResolver` must accept trusted calls from `GardensModule`, support validated operator/owner repair calls, and emit wiring events.
3. Yield routes that currently strand funds when no treasury is configured must fall back to the garden TBA.
4. Existing gardens must have a migration/backfill path for module references, pool wiring, and any treasury defaults needed to avoid stranded yield.
5. Shared/admin follow-up work must verify whether `createGardenPools()` successfully connected yield and expose a manual reconnect path only when auto-wiring fails.

## Non-Functional Constraints

- Package boundaries: contracts own the primary change; shared/admin only verify status and expose fallback recovery
- Upgrade safety: maintain storage gap discipline and UUPS compatibility
- Validation: operator repair paths must validate the supplied pool address before accepting it
- Data layer: do not add indexer dependencies for wiring status in this phase
- Dependency: this hub is the contract prerequisite for `yield-split-ui`

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| Contract auto-wiring, access control, treasury fallback, migration | `contracts` | Primary lane |
| Post-create verification and fallback hooks | `state_api` | Shared hook + mutation support |
| Admin wiring status and repair affordance | `ui` | Fallback/recovery surface only |
| QA | `qa_pass_1`, `qa_pass_2` | Sequential protocol + UI validation |

## Risks

- Upgrade storage mistakes can brick the resolver/module pair; keep storage-gap accounting explicit.
- Partial live gardens may already have inconsistent pools or treasury mappings; require a migration/backfill checklist before activation.
- Operator repair access can be abused if validation is weak; validate CVStrategy-compatible pools on manual paths.
