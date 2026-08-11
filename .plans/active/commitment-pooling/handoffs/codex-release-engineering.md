# Commitment Pooling — Codex Release Engineering

## Status

- Execution sub-lane: `release_engineering`
- Machine lane: none; this is a bounded Phase A engineering lane
- Owner: Codex
- Branch: `feature/commitment-pooling-contracts-deployment`
- Pinned base and starting HEAD: `7a9c7eeef96b17c96d5a5f7e15d3e181223bbe6b`
- Reviewed implementation commit: `f5cc0eca3f06063b4c7b83c91c3dca03cd0324d9`
- Review record: `../reports/phase-a-release-engineering-review-2026-08-11.md`
- Current state: approved Phase A follow-up in progress; broadcast remains blocked
- Linear context: none; Linear writes are not authorized in Phase A
- Authority: the August 10 deployment/release session prompt and its recorded owner decisions

PR #694 (`c60b38dea`) and PR #695 (`bff3b274d`) are merged ancestors of the pinned base. This lane
may implement, mutate local files, simulate, inspect chains read-only, and prepare a PR. It may not
deploy, broadcast, grant Safe or Zodiac authority, transfer ownership, move value, activate an
indexer, send a message-only ping, run a value canary, or write Linear.

## Inputs

- `../reports/codex-deployment-release-session-prompt-2026-08-10.md` — current execution prompt;
  supersedes the August 8 prompt where they conflict.
- `../contract-spec.md`, `../settlement-spec.md`, and
  `../../commitment-credit-follow-on/spec.md` — frozen implementation and release contracts,
  amended only by the explicit August 10 conflict resolutions.
- `human-release-ops.md` — Phase B authorization and evidence boundary.
- Merged pooling/settlement and CreditRegistry implementations. Their frozen ABI and storage may
  be consumed but not silently repaired or reopened here.

## Outputs

1. One declarative combined release manifest with exact code, ownership, chain, CCIP, Safe/Zodiac,
   cap, fee, indexer, rollback, and artifact dependencies.
2. Help-documented selective Bun deployment, configuration, verification, and recovery targets for
   Arbitrum core, SettlementModule, CeloSettlementExecutor, CreditRegistry, Safe prediction and
   Roles planning, peer wiring, and indexer handoff.
3. Real-entrypoint proof for first run, replay, partial/conflicting artifacts, interrupted writes,
   successful-chain/failed-local persistence recovery, ownership/nonce races, and every explicit
   transaction boundary.
4. The exact two-process local settlement courier and lifecycle fixture, with distinct processes
   and local chain identities and only serialized tuples/receipts crossing the boundary.
5. Post-deploy verification plus an inert PRD-722 address/start-block handoff. Hosted indexer
   deployment/reindex/cutover/read-back is outside this release-engineering lane.
6. Fresh internal and Fable 5 committed-range adversarial release reviews of the final combined
   candidate, with no unresolved Critical or High finding.

## Implemented Phase A surface

- Combined release manifest and immutable identity lock, including 20 linked libraries, five
  implementations, five proxies, exact CREATE2 identities, schema records, existing-proxy upgrade
  inputs, ownership, chain selectors, routers, paused state, and indexer config hash.
- Selective Bun targets for manifest, protocol-core plan, schemas, pooling, upgrades, ownership,
  SettlementModule, CreditRegistry, Celo executor, Safe plan, peer plan, recovery, verification,
  indexer handoff, and pool backfill. Every release-owned broadcast form is one reviewed
  transaction boundary and remains Phase B only.
- Atomic side-artifact merge and recovery, nonce/owner/code-hash rechecks, on-chain-success/local-
  write-failure recovery, exact old/new key preservation, and receipt-bound checkpoint handling.
- Two isolated Anvil processes and worker processes for the settlement lifecycle. Only serialized
  messages and receipts cross the boundary; command and acknowledgment origin binding, replay,
  retry, reorder, duplication, cancellation, peer rotation, malformed payload, and idempotent
  execution are covered.
- Post-deploy verification for code/proxy/owner/initializer/pause/wiring/route/caps/indexer hashes,
  plus an inert PRD-722 handoff carrying only exact contract addresses and receipt start blocks.
- A Bun-only operator session verifies the pinned clean candidate and frozen deployer keystore,
  prompts for its password once per session, and then permits only the documented deployment
  wrappers. Each wrapper still executes one reviewed boundary and verifies it before another.

## Current blockers

The tooling fails closed on all of the following. None is authorization to alter the merged ABI,
rewrite frozen history, or mutate production state.

1. `registerPool` is gated by `whenOperational`, but the authoritative August 10 release order
   requires verified pool registration/backfill before the separately gated pooling unpause. A
   separate, ABI/storage-neutral contracts increment (`5e70654c3`) now permits only owner pool
   registration while paused and is green in its isolated worktree. The release branch must not
   absorb it before human review and merge into the target base; until then the backfill entrypoint
   intentionally emits no executable plan.
2. The accountable owner approved the finalized 18-account GardenToken inventory (token IDs 0–17)
   and protocol root token 0. The manifest and live backfill inventory now match that decision.
3. The live protocol Safe is exactly 2-of-6, and the accountable owner approved that exact set.
   Repository policy is now threshold >= 2 with at least 3 owners, so the guide conflict is closed.
   The manifest and verifier still require the exact six-owner set and threshold to match live.
4. The live `AssessmentResolver` is not v3-capable. The nonce-pinned three-boundary plan now
   upgrades the proxy, pins the canonical v2 UID if live v2 is zero, and preserves v3 zero before
   schema finalization. A single pinned Arbitrum fork proves that sequence through dependent schema
   preparation/finalization, but no upgrade was broadcast.
5. The local hard-max 24-member executor fixture measured 1,383,897 gas including the
   acknowledgment attempt. `destinationGasLimit` remains `"0"` until the same atomic path is
   measured with the final live Safe/Zodiac policy; peer planning remains blocked.
6. Garden Safe owners, recovery tuples, Zodiac Roles modifier/key/conditions, allowances, caps,
   fee policy, and native reserve floors are incomplete. Value authority remains disabled.
7. The hosted production indexer is an older deployment and is intentionally outside this lane.
   PRD-722 receives only the verified address/start-block diff and separately owns codegen,
   configuration, deployment/reindex, cutover/rollback, and live read-back.

The release-engineering lane remains blocked until the paused-registration increment merges and the
final Safe/Zodiac/cap/fee facts plus live-authority gas measurement are frozen. After the new
combined base is pinned, regenerate the identity lock, rerun every gate, and conduct a fresh
internal plus Fable 5 exact-range review before asking for any Phase B authorization.

## Approved owner decisions

- Release owner: Afolabi Aiyeloja.
- Protocol Safe: `0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19`.
- Rollback owner before ownership transfer: deployment EOA `green-goods-deployer`.
- Rollback execution after ownership transfer: protocol Safe; the deployment EOA remains the
  proposer/coordinator.
- Garden-Safe recovery owner to verify on Celo: network council Safe
  `0x49fa954B6C2Cd14B4b3604EF1Cc17cED20a9E42C`.
- External-audit gate for this wave: internal committed-range review; no unresolved Critical or
  High finding.
- The 48-hour timelock is waived for this wave; Safe multisig approval remains required.
- Approved GardenToken release inventory: all 18 finalized accounts (token IDs 0–17), with protocol
  root token 0.
- Approved protocol Safe target: the exact live 2-of-6 owner set; it satisfies the repository
  threshold >= 2 and owner count >= 3 minimum.
- Rehearsal ladder: local/fork confidence, Ethereum Sepolia endpoint rehearsal where useful,
  Arbitrum One, then Celo. The former two-week soak is withdrawn.
- Credit deployment binds SettlementModule and CreditRegistry in both directions. G$ credit stays
  disabled by having no enabled G$ pool credit configuration, and G$ repayment still reverts
  `GDollarRepaymentDisabled` until a separately approved authenticated receipt policy exists.

## RED / GREEN

- TDD mode: required for behavior-changing release tooling.
- RED: exercise the real missing or unsafe operator entrypoint first. Helper-only tests do not
  qualify when the package script, artifact merge, recovery, or post-action verifier is the
  behavior under test.
- GREEN: the same Bun entrypoint produces an exact, resumable transaction plan, drives the same
  persistence/merge path as broadcast without changing canonical artifacts or live state, and
  passes its recovery and post-action verifier cases.
- Proof limit: dry-run, fork, and read-only lane checks are not deployment evidence and grant no
  broadcast authority.

## Batch order

1. Reconcile the Plan Hub and handoffs to the approved merge and owner facts.
2. Audit actual wrappers, scripts, artifacts, recovery paths, verifiers, and indexer configuration.
3. Add manifest and shared persistence/recovery primitives with adversarial entrypoint tests.
4. Add selective deployment/configuration/verification targets.
5. Add the exact dual-process courier fixture.
6. Produce only the PRD-722 contract-address/start-block handoff; do not add or run hosted indexer
   deployment, reindex, cutover, or read-back commands in this lane.
7. Run full repository gates and the committed-range adversarial review.

## Out of scope

- Any external transaction or state mutation.
- Product architecture, frozen ABI/storage changes, new repayment behavior, raw G$ indexing, or
  unrelated product work.
- Re-adding configured Arbitrum Sepolia/Celo Sepolia network records or testnet deployment
  artifacts. The local courier may use chain IDs `421614` and `11142220` only as isolated local
  process identities.
- Phase B execution, PR merge, production unpause, cap increases, message-only ping, Safe/Zodiac
  grants, value canary, and value movement.

## Stop point

The current stop is earlier than a release candidate because the blockers above prevent a green
dry-run. After they are resolved, stop again at a pinned, reviewed, dry-run-green release candidate.
The next Phase B action must be a new explicit authorization naming the exact commit, target chain,
stage, signer/owner, artifact diff, rollback checkpoint, and broadcast window. Approval of this
handoff or its PR is not broadcast authority.
