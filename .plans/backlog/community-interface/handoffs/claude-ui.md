# Community UI coordination handoff

**Status:** BLOCKED — umbrella lane waits for state/API and all UI sublane handoffs.

## Inputs

- Community/admin/funder handoffs, final shared state contract, visual artifacts, design/accessibility guidance.

## Outputs

- Cross-surface route/state/copy ownership, integration order, shared visual QA checklist, and consolidated UI evidence.

## Acceptance

- Community owns Needs/Create/Profile and Support / Do not support / Clear with separate counts; admin `/community/needs` owns triage, moderation, gathering, seed-from-Need, and Need lineage/export; `/community/coordination` retains pool/cycle operations; `/community/members` retains membership management; existing public client owns funder discovery; every loading/empty/offline/pending/waiting/declined/merged/hidden/retracted/failed/retry state has one owner.

## RED / GREEN

- RED: cross-surface route/state coverage test or review matrix identifies every missing owner.
- GREEN: sublane targeted tests/builds and authenticated visual proof pass; en/es/pt and accessibility coverage is complete.

## Exact commands

```sh
bun run agentic:check
bun run lint:vocab
bun run check:design-tokens
node scripts/dev/ci-local.js --quick
```

## Out of scope

Implementing data contracts in UI, new admin roots, membership transport, or route duplication.

## Unblock evidence

State/API GREEN evidence and all three UI sublane handoffs marked dispatchable with named visual-proof routes.
