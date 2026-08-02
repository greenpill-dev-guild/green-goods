# Commitment Pooling - Claude QA Pass 1 Handoff

## Status

- Machine lane: qa_pass_1
- Owner: Claude
- Branch signal: claude/qa-pass-1/commitment-pooling
- Current state: manually blocked
- Linear context: PRD-729 (QA pass 1 lane) under parent PRD-650. Register #37 reversed the earlier no-QA-child rule.

## Inputs

- GREEN contracts, indexer, shared, and runtime UI handoffs (`ui_client`, `ui_admin`, `editorial`);
  post-QA documentation and walkthrough videos are intentionally excluded
- Verified `develop` source SHA and exact staging deployment URLs
- Settlement external-gate evidence or an explicit proof-limit record
- Authenticated Brave access, real-device PWA access, and `acceptance-matrix.md`

## Outputs

- Human-flow QA record across member, gardener/provider, operator, evaluator, funder, and collaborator/steward roles.
- Confirmed pass/visible defect/external blocker separation.
- Evidence for direction-aware ordinary confirmation, local and Green Goods protocol fallback
  provenance, claims recovery, offline sync, dispute recovery, batching/CCIP states, public
  claims, accessibility, and locales.
- Defect list routed back to the owning lane; no implementation in the QA handoff.

## Acceptance

- Member/client and admin flows are exercised through authenticated Brave; installed PWA/offline/restart/member-delivery behavior is exercised on a real device.
- Every loading, empty, offline, pending, waiting, declined, superseded, failed, retry, queued, dispatched, executed/acknowledgment-pending, delayed, Confirmed, and delivery-disabled state in scope has an exit.
- Offer receiver and Request creator confirmation are correct. The opted-in Green Goods protocol
  fallback rescues a small garden with no eligible ordinary/local confirmer; an unselected
  commitment never silently escalates. Local fallback wins for a dual-role wallet, module
  ownership alone never confirms, every contributor is excluded, and actor/path/reason are
  distinct in both admin and client history.
- Batching starts disabled, uses a measured matching 0–24 limit on both chains, and retains a
  hard ceiling of 24. Immutable failed batches, unbatched per-member recovery, same-key command
  retry, independent acknowledgment retry, and authenticated-only confirmation are visible and
  coherent.
- Public/editorial claims distinguish planned, dispatched, confirming, and confirmed behavior;
  documentation mismatches become inputs to the post-QA PRD-727 polish lane.
- Accessible names, focus order, touch targets, contrast, screen-reader announcements, reduced motion, and en/es/pt are checked.

## RED / GREEN or proof limit

- RED: a named role/state path fails its acceptance fixture, a required lane command fails, or rendered/authenticated evidence disagrees with the spec.
- GREEN: every in-scope role/state path has current evidence, all owning-lane commands pass, and defects are dispositioned without hiding external blockers.
- Proof limit: QA adds no product behavior. Missing live CCIP peers/fee reserves, Celo, Safe, AA, authenticated-browser, or real-device path is an external blocker, never a pass; record the exact unavailable evidence once.

## Exact Bun commands

Run the targeted commands named in each GREEN handoff, then:

- bun run --filter @green-goods/contracts test
- bun run --filter @green-goods/indexer test
- bun run --filter @green-goods/shared typecheck
- bun run --filter @green-goods/client test
- bun run --filter @green-goods/admin test
- bun run docs:audit
- bun run lint:vocab
- bun run agentic:check
- bun run check:design-md
- bun run check:design-generated
- bun run check:design-tokens

## Out of scope

- Fixing defects, changing specs, isolated Playwright/DevTools profiles as authenticated proof, manual settlement confirmation, garden-held member claims, broad ship-readiness claims, or Linear issue creation.

## Unblock evidence

- Required runtime implementation handoffs are GREEN; post-QA docs, walkthrough videos, and the
  independent September Community handoff are not QA Pass 1 dependencies.
- Settlement gate record names official direct-lane availability, CCIP peers/fees,
  exact-net GoodDollar behavior, Safe/Zodiac bounds, AA, separate Arbitrum/Celo
  local/fork/testnet proof, and any proof limits. Celo Sepolia executor/Safe/roles/surrogate
  evidence is not CCIP endpoint evidence; a live endpoint claim requires a fresh official
  lane/router and still must not be reported as a direct Arbitrum Sepolia↔Celo Sepolia lifecycle.
- Authenticated Brave and real-device access are confirmed.
- QA result separates passes, defects, and external blockers with route/role/state evidence.

## 2026-07-28 amendment coverage

- Add acceptance proof for solo and team commitments, repeatable requirements beyond four in a benchmark-safe fixture, contributor add/remove/freeze, all-team confirmation exclusion, and contribution attribution.
- Prove gardener recognition totals exactly, including exact-CID evidence de-duplication,
  explicit credited-contributor job replay, one countable credit per Work UID, fulfillment-gated
  eligibility, opened cycle policy or the immutable cycle-less default, roster freeze on Ready
  and direct dispute fulfillment, zero-eligible W26 inconsistent-state blocking with no lead or
  metadata fallback, and deterministic rounding; prove recognition-vector/hash binding,
  amount-derived payment weights, reasoned correction, no-child finalization, idempotent one-child
  preparation, all-retained zero-child completion, exact garden-retention conservation, stable
  parent pointers after cancellation, partial child failure/retry, and complete receipts.
- A passed commitment lifecycle does not waive settlement gates; runtime/deploy/broadcast remain blocked until their existing lane gates clear.
