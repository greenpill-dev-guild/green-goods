# Garden membership dates plan

**Feature Slug**: `garden-membership-dates`
**Stage**: `active`
**Status**: `ACTIVE`
**Created**: 2026-11-11
**Last Updated**: 2026-11-11

## Decision log

| Decision | Rationale |
| --- | --- |
| Retain immutable role events | Existing roster arrays discard dates; facts support replay and independent reduction |
| Separate garden join and role dates | They answer distinct user questions |
| Keep first join after departure | Rejoining must not erase tenure history |
| Reuse existing fact lists and member views | No new navigation or visual surface is needed |
| Show unknown history explicitly | Global gardener dates are not a fallback for garden membership |

## Execution

- [x] Lock scope with the user and inspect owning code and callers.
- [x] Add immutable indexer facts and regression proof.
- [x] Complete Shared reader, hook, date facts, locale strings and focused proof.
- [x] Integrate PWA, profile and Admin consumers and prove wiring.
- [x] Run selected checks, inspect rendered states and record limits.

## Boundaries

No account removal, contracts, permissions, signing flows, dependencies, deployment or external records. Shared package exports and Storybook mock registration change only to expose and prove the new capability. Preserve unrelated changes in this shared checkout.

## Local implementation outcome

Implemented and verified locally. See [validation evidence](handoffs/codex-state-api.md) and [rendered proof](handoffs/claude-ui.md). Broader source-structure and ontology checks report unrelated working-tree issues. Publication, historical replay and committed lane certification remain pending; this hub stays active.

## Accepted Admin member polish

The user approved all three bounded improvements on 2026-11-11:

- [x] Visible labeled address copying, with success and failure feedback.
- [x] Per-person Add role, with a fixed member, explicit role choice, and the existing signing path.
- [x] Clearer Add Members staging and submission controls.

Local implementation and focused proof are recorded in the [UI handoff](handoffs/claude-ui.md#admin-member-polish). Underlying permission and signing rules remain authoritative. No account removal, transaction, publication, or branch action was performed.
