# Commitment Pooling - Claude Docs Guides Handoff

## Status

- Execution sub-lane: docs_guides
- Machine lane: ui
- Owner: Claude
- Branch signal: claude/docs-guides/commitment-pooling
- Current state: blocked
- Linear context: PRD-728 (docs-guides lane) under parent PRD-650

## Inputs

- Shipped client/admin settlement surfaces
- GREEN UI handoffs and `acceptance-matrix.md` §§1, 3-4 final copy/state/public-claim proof
- Authenticated Brave access to the real surfaces
- Operator/gardener task acceptance from uiux-spec.md

## Outputs

- Operator seeding/claims/settlement guide and gardener promise/evidence/confirmation/reward guide.
- Real screenshots with alt text, captions, version/date, and surface provenance.
- Recovery instructions for offline, declined, superseded, failed, checking, oracle-invalid, and member-delivery-disabled states.
- Built/planned/reported/oracle-verified language.

## Acceptance

- Every screenshot comes from the shipped authenticated surface; no low-fi frame is presented as product.
- Guide steps match current accessible names and route placement, including admin /community.
- Reported/checking never reads as arrived.
- Recovery instructions contain no manual verification or garden-custody claim path.
- en/es/pt product labels in screenshots match the shipped translations; guide prose follows the docs localization policy.

## RED / GREEN or proof limit

- RED: the guide replay or screenshot checklist exposes a route, accessible-name, locale, state, recovery, or planned/live mismatch, or a docs command fails.
- GREEN: authenticated Brave capture, alt-text/caption review, step-by-step replay, and every exact docs command pass against the shipped surfaces.
- Proof limit: TDD is not applicable to screenshot-dependent guides. Any unavailable authenticated surface or external settlement state is named and cannot be converted into GREEN.

## Exact Bun commands

- bun run docs:audit
- bun run build:docs
- bun run lint:vocab

## Out of scope

- Speculative screenshots, product code, route changes, test-only browser profiles reported as authenticated evidence, manual receipt verification, garden-held member claims, or new Linear children.

## Unblock evidence

- ui_client, ui_admin, and settlement have GREEN evidence or an explicit approved proof limit.
- Authenticated Brave can reach the real client/admin states.
- Screenshot checklist names route, role, locale, state, capture date, and source handoff.
- Docs commands pass after guide edits.
