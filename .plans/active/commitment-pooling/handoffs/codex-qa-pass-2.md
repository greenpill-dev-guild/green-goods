# Commitment Pooling - Codex QA Pass 2 Handoff

## Status

- Machine lane: qa_pass_2
- Owner: Codex
- Branch signal: test/commitment-pooling-qa-pass-2
- Branch trigger: test/commitment-pooling-qa-pass-1
- Current state: manually blocked on QA Pass 1 defect disposition and completed PRD-727
  post-QA documentation polish
- Linear context: PRD-730 (QA pass 2 lane) under parent PRD-650. Register #37 reversed the earlier no-QA-child rule.

## Inputs

- QA Pass 1 evidence and defect disposition
- Final contracts/indexer/shared/UI handoffs and completed PRD-727 documentation-polish handoff
- Updated status.json and plan-hub proof
- Authenticated Brave/real-device evidence references

## Outputs

- Regression review of contracts -> indexer -> shared -> app boundaries.
- Re-run evidence for corrected defects and unchanged guardrails.
- Status/handoff/dispatch consistency report and final remaining-blocker list.
- Repo Quick Gate only after targeted lane proofs are green.

## Acceptance

- Exact ABI/event/config signatures match across specs, generated types, handlers, and shared types.
- Composite Garden IDs, nullable actors, claim supersession, command/ack message states, same-key idempotency, acknowledgment retry, and member-delivery gating retain coverage.
- QA Pass 1 defects are fixed and re-proven or explicitly accepted by the user.
- PRD-727 documentation, screenshots, accessible names, translations, recovery instructions, and
  planned/live claims are re-read against the QA-tested product and pass their exact commands.
- Execution sub-lane mirrors replace aggregate implementation issues without duplicates; QA stays on canonical QA issues; blocked, human, and follow-on lanes carry no `agent:*` label and cannot dispatch.
- Browser evidence remains authenticated Brave and real device where required.
- No result collapses visible defects or external blockers into a pass.

## RED / GREEN or proof limit

- RED: a fixed QA1 defect still reproduces, any boundary/signature/dispatch invariant differs, or an exact regression command fails.
- GREEN: every accepted QA1 fix is re-proven, all exact commands pass, and status/dispatch/lane-issue evidence agrees with the final artifacts.
- Proof limit: QA Pass 2 introduces no behavior. If an external path cannot be rerun, preserve the earlier evidence and record staleness; do not substitute isolated browser or test-only proof or call the path GREEN.

## Exact Bun commands

- bun run --filter @green-goods/contracts test
- bun run --filter @green-goods/indexer test
- bun run --filter @green-goods/shared typecheck
- bun run --filter @green-goods/client test
- bun run --filter @green-goods/admin test
- bun run docs:audit
- bun run build:docs
- bun run lint:vocab
- node scripts/dev/ci-local.js --quick
- node scripts/harness/plan-hub.mjs validate
- node scripts/harness/plan-hub.mjs list --agent codex --lane qa_pass_2 --stage active --json

## Out of scope

- New features, scope expansion, contract broadcasts, defect fixes inside the QA lane, isolated browser proof labeled authenticated, manual settlement confirmation, garden-held member claims, or branch ship/merge claims without the explicit Ship Gate.

## Unblock evidence

- qa_pass_1 is GREEN with defects dispositioned.
- PRD-727 is complete and its live Linear mirror plus source handoff are re-read.
- All retested lane commands pass.
- Authenticated Brave/real-device evidence is current or its proof limit is explicit.
- Plan-hub validation and dispatch listing agree with status.json before QA Pass 2 can turn GREEN.

## 2026-07-28 amendment regression set

- Re-run the group-commitment and contributor-payout matrix from QA Pass 1 against the exact reviewed SHA.
- Verify the indexer, shared selectors, client/admin screens, Hypercert output, parent payout status,
  and contributor receipts agree on the same Ready/direct-dispute-frozen roster, exact-CID
  evidence de-duplication, one countable credit per Work UID, fulfillment-gated eligibility,
  opened cycle policy or cycle-less default, zero-eligible inconsistent-state block with no
  metadata repair, recognition/payment snapshot hashes, amount-derived payment weights,
  garden-retained amount, no-child finalization, idempotent per-contributor preparation, stable
  parent pointer, child amounts, and reasons.
- Treat any single-provider fallback, four-item product cap, equal-by-presence allocation, garden-retention omission, or fulfillment reversal after child failure as a release blocker.

## 2026-09-04 staging/beta QA unblock

This pass is limited to the staging admin and beta client. Production rollout, contract changes,
indexer schema changes, general PWA cache work, a custom payout editor, and TAS settlement remain
out of scope. Pool configuration is an intentional part of the walkthrough and is not a blocker.

### Implemented candidate

- The Zodiac allowance read now decodes `refill, maxRefill, period, balance, timestamp` and displays
  the current `balance`. A timestamp-shaped regression fixture protects the tuple position.
- Settlement authority is action-specific: protocol steward or module owner may queue funding; the
  executor-garden steward or exact dispatcher may dispatch and retry; only the executor-garden
  steward may requeue or cancel. Deployer status and module ownership alone do not expose payout
  operations.
- A Safe proposal remains `submitted` until `gardenerDeliveryEnabled()` reads back the requested
  value. The admin shows that Safe execution is pending and provides **Check on chain**; a rejected
  or failed submission does not change the displayed chain state.
- The protocol-funding card derives receiving-garden choices from registered commitment pools, so
  a stale persisted garden catalogue no longer hides Aiyeloja, TAS, or another registered pool.
- Existing boot recovery, query-persistence recovery, settlement controllers, and settlement UI
  remain intact.

### Evidence

- Initial RED: 10 focused failures covered the allowance tuple, role matrix, and Safe submission
  readback behavior before the implementation was corrected.
- Targeted GREEN: shared funding, settlement hooks, workflow, selectors, and controllers passed;
  admin boot recovery, commitment settlement, protocol funding, and settlement operation tests
  passed. The final targeted runs passed 99/99 shared tests and 55/55 admin tests.
- Build GREEN: shared and admin full typechecks passed. The production admin build passed and its
  artifact contains the boot marker, protocol-funding surface, and submitted-Safe copy.
- Guard GREEN: formatting, vocabulary, Storybook coverage, Storybook quality, design, ontology,
  documentation generation, and source-structure checks passed during this pass.
- Repo Quick Gate: every runnable check passed. Its browser-proof entry remained
  `manual-proof-required`; the authenticated Brave evidence below is the corresponding manual
  proof.
- Authenticated Brave GREEN on the local staging-configured build: the admin root, `/hub/confirm`,
  Community, Garden, Pool, and Protocol pool surfaces rendered without an application crash. The
  Protocol pool displayed a 999,999 G$ Safe balance, 14,999,999 G$ remaining allowance, a
  7,000,000 G$ transfer cap, and the indexed confirmed Community-to-Aiyeloja row. The recipient
  selector included Aiyeloja and TAS, and selecting Aiyeloja resolved its Safe with a 2 G$ amount.
  A rendered settlement story showed **Submitted. Awaiting Safe execution and on-chain
  confirmation.** and **Check on chain**.
- Direct staging-indexer read at `95c2129` returned 18 registered pools. Community, Aiyeloja, and
  TAS are present and currently `NOT_READY`, which is the expected starting state for the paired
  UI setup.

### Remaining human-observed acceptance

The code and local authenticated-browser candidate are ready for deployment proof. This handoff is
not the record of completed value movement: after current-head CI and both staging deployments are
green, a human must approve the Safe and wallet transactions used to enable delivery, configure the
three pools, complete the 2 G$ Community-to-Aiyeloja transfer, and complete the 0.5 G$ Aiyeloja
contributor payout. Both flows must converge to indexed `Confirmed` before the end-to-end QA pass is
called complete.

The reviewed tree is the commit containing this section. Resolve its exact SHA with
`git rev-parse HEAD`; the working tree is expected to be clean after that commit.
