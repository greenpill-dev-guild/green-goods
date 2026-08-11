# Commitment Pooling — Codex Release Engineering

## Status

- Execution sub-lane: `release_engineering`
- Machine lane: none; this is a bounded Phase A engineering lane
- Owner: Codex
- Branch: `feature/commitment-pooling-contracts-deployment`
- Pinned base and starting HEAD: `7a9c7eeef96b17c96d5a5f7e15d3e181223bbe6b`
- Current state: blocked after Phase A implementation and adversarial review
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
5. Post-deploy verification and production activation/reindex/read-back plans that remain inert in
   Phase A.
6. A committed-range adversarial release review with no unresolved Critical or High finding.

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
  plus an inert Envio handoff. The handoff refuses to invent a hosted activation command that the
  installed Envio CLI does not expose.

## Current blockers

The tooling fails closed on all of the following. None is authorization to alter the merged ABI,
rewrite frozen history, or mutate production state.

1. `registerPool` is gated by `whenOperational`, but the authoritative August 10 release order
   requires verified pool registration/backfill before the separately gated pooling unpause. The
   merged ABI cannot execute that order. The backfill target therefore emits no executable plan.
2. A finalized Arbitrum read found 18 GardenToken accounts (token IDs 0–17), while the frozen
   release inventory says 13. The finalized root derivation is token 0; the frozen artifact says
   token 1.
3. The live protocol Safe is 2-of-6. The approved release target is 3-of-5. The Safe preflight
   reports the mismatch; it does not restate the target as live fact.
4. The live `AssessmentResolver` is not v3-capable. Schema planning and every dependent deploy
   dry-run stop before producing an executable transaction sequence. The nonce-pinned resolver
   upgrade and rollback plan exists, but no upgrade was broadcast.
5. `destinationGasLimit` is intentionally frozen as `"0"` until measured. Bidirectional peer
   planning rejects both zero and an environment override that differs from the manifest.
6. Garden Safe owners, recovery tuples, Zodiac Roles modifier/key/conditions, allowances, caps,
   fee policy, and native reserve floors are incomplete. Value authority remains disabled.
7. The installed Envio CLI has no hosted `deploy` command. The inert handoff records the missing
   operator path rather than inventing one.

The release-engineering lane remains blocked until the accountable humans resolve the ABI/order,
garden inventory/root, Safe target, and hosted-indexer operator path and supply the measured gas
and value-authority facts. Assessment v3 preparation additionally needs its own Phase B stage
authorization before downstream dry-runs can become green.

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
6. Prepare indexer activation and read-back commands without activating production addresses.
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

Stop at a pinned, reviewed, dry-run-green release candidate. The next action must be a new explicit
authorization naming the exact commit, target chain, stage, signer/owner, artifact diff, rollback
checkpoint, and broadcast window. Approval of this handoff or its PR is not broadcast authority.
