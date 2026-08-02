# Commitment Credit — August Companion - Claude UI Handoff

## Status

- Machine lane: ui
- Owner: Claude
- Branch signal: claude/ui/commitment-credit-follow-on
- Current state: blocked on state_api GREEN
- Linear context: PRD-697 is the parent tracker; no separate lane issue is required before dispatch

## Inputs

- GREEN shared types, viewer-aware selectors, hooks, mutations, and query keys from `codex-state-api.md`.
- GREEN credit indexer and implemented contract/settlement interfaces.
- `../spec.md` section 7, the Green Goods admin/client package guides, and authenticated Brave access.

## Outputs

- Admin Garden Pool credit console for steward-authorized request review, approval, disbursement, repayment recording, default, and recovery.
- Client wallet “your credit” row with advance received, amount outstanding, next repayment, and explicit online repayment action.
- Aggregate-only editorial framing with no participant rows or comparative presentation.
- Loading, empty, offline, pending, delayed, failed, recovered-default, and completed states with clear exits.
- en/es/pt copy using advance, repayment, and mutual-aid language.

## Acceptance

- Per-borrower operational rows render only through the shared viewer-aware selector for current stewards; personal rows render only to that member.
- Raw Envio participant entities are never bound directly in client, admin, or editorial components.
- No score, percentage-as-personal-standing, rank, leaderboard, shaming copy, or public default story appears.
- Loan status and reward status remain visibly distinct.
- G$ repayment is an explicit online action; the UI never implies custody, bridging, or automatic collection.
- Semantic controls, persistent labels, keyboard operation, visible focus, accessible status announcements, 44px targets, reduced motion, and responsive layout are verified in authenticated Brave.

## RED / GREEN

- RED: add focused component/journey fixtures for steward, self, unauthorized viewer, aggregate editorial, offline, failure, and recovery states.
- GREEN: pass the same fixtures plus package-local typecheck/build where route wiring or exported types changed, then capture authenticated Brave proof.

## Exact Bun commands

- `bun run --filter @green-goods/client test`
- `bun run --filter @green-goods/admin test`
- `bun run --filter @green-goods/client build`
- `bun run --filter @green-goods/admin build`
- `bun run lint:vocab`
- `bun run agentic:check`

## Out of scope

- Contract, indexer, or shared behavior changes; a public borrower directory; personal creditworthiness claims; transferable vouchers; swap execution; direct contract calls; or release operations.

## Unblock evidence

- state_api is GREEN and its viewer-aware disclosure tests pass.
- Required routes and authenticated Brave session are available.
- `status.json` dependency state is updated before dispatch.
