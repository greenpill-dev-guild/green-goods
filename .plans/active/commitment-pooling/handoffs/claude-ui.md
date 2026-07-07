# Commitment Pooling - Claude UI Handoff

## Status

- Machine lane: `ui`
- Owner: Claude
- Branch: `claude/ui/commitment-pooling`
- Current state: blocked on `state_api`

## Scope

- Aggregate UI client, admin, editorial, docs, docs-guides, and community sub-lanes.
- Use `uiux-spec.md`, `wireframes.md`, and `diagrams.md` as the UI source specs.
- Record detailed proof in the sub-lane handoffs before this machine lane turns GREEN.

## Acceptance

- Admin, client PWA, public/editorial, and docs surfaces consume shared substrate and indexer-backed aggregates.
- Client-only hero moments stay out of admin.
- All new user-facing strings land in en/es/pt.
- Browser-visible behavior receives authenticated Brave proof when implementation begins.

## Blockers

- Shared state/API substrate and settlement status selectors are not ready.
