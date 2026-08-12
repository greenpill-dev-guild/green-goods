# Member-Funded Release Re-Review — 2026-08-12

## Verdict

**Review verdict: COMMENT_ONLY. The implementation and re-freeze gates pass, but this report does
not authorize broadcast.**

The complete reopened increment is pinned at
`21454603967370e98a61df70d399cfa7c11ce63d..50a2c29d3d9f08ed97d9b0e8b8de95d07f6fcb63`.
The range adds member-funded priced Offers and mechanically eligible refunds, restores the full
per-pool pause freeze, permits the reviewed pool-registration backfill while the module remains
paused, and regenerates the deterministic release graph. The range contains eight commits across
69 files, with 6,017 insertions and 1,021 deletions.

No unresolved Critical or High implementation defect remains in the increment after the internal
adversarial contract, funding, and paused-backfill reviews. The release is still not authorized:
the four unchanged release-lane blockers listed below remain outside this dispatch, and Afo must
explicitly confirm that the August 10 internal committed-range review substitution extends to this
increment now that member funds transit the recoverable Garden Safe with a recorded refund
obligation.

No deployment, broadcast, ownership or authority mutation, Safe transaction, value movement,
indexer activation, message-only ping, canary, unpause, or cap change occurred.

## Pinned scope

- Branch: `feature/commitment-pooling-contracts-deployment`
- Canonical design brief and excluded range base:
  `21454603967370e98a61df70d399cfa7c11ce63d`
- Specification reopen: `e4d3d530ea12cd552c7bf54dee072ce543ee4859`
- Narrow specification re-close authorized by Afo:
  `288773b4f149f2e84b950aa8314bade6bad54ddc`
- Reviewed contracts implementation:
  `49fc62cc0e665de929baca02c1228a43d681ad68`
- Reviewed release re-freeze:
  `50a2c29d3d9f08ed97d9b0e8b8de95d07f6fcb63`
- Release manifest hash:
  `0x13114a1e8f9be34b340c154c208645c3e00346016fd2a346c87f139a3f7b6168`
- Indexer configuration hash, recomputed and unchanged:
  `0xb3cfc35d0ff1152a7543c5209032ac4b118b08cbd2c916f6d62fdef0bb3b82b0`
- Manifest identity set: 21 libraries, five implementations, and five proxies
- Source-acknowledgment gas budget: 300,000
- Re-frozen batch-size limit: three; activation remains excluded

The manifest source commit intentionally identifies the reviewed contracts implementation. The
release-engineering code that consumes and verifies the manifest is pinned separately by the
re-freeze commit above.

## Coverage ledger

| Review batch | Files and boundaries reviewed | Disposition |
|---|---|---|
| Specification and ABI closure | Funding events and withdrawal event, funding storage/state machine, appended Refund kind, pause matrix, paused registration, ontology representation, acceptance families | Pass; Afo authorized and reviewed the narrow withdrawal-event and consumed-pointer reopen before implementation resumed |
| Pooling authorization and freeze | Priced Offer request/acceptance boundary, claims, exchange, Ready/submit/confirm gates, explicit wind-down survivors, module pause, paused `registerPool` | Pass; unchanged root-steward registration poisoning risk was explicitly accepted and the executable plan remains exact-root Protocol first |
| Funding and refund state | Pledge, deposit, consume, close, withdraw, refund queue/requeue/confirm, one-child persistence, Safe-below-obligation failure, source-Safe recipient rejection, storage namespace order | Pass |
| Fixed-gas acknowledgment | Local `consumedFundingOfCommitment` pointer, no pooling read in the source receiver, three/four/hard-max cold funded-plan measurements | Pass; three used 250,326 gas, while four required 304,689 against the fixed 300,000 limit |
| Backfill and paused registration | Exact 18-registration root-first plan, live inventory binding, implementation/runtime binding, Safe nonce and receipt correlation, resumable checkpoint integrity, final separate unpause | Pass; backfill runs while paused and unpause remains a distinct later authorization |
| Deterministic release graph | New Funding library identity, changed linked implementations, initializer-dependent proxy predictions, manifest validation, batching evidence, release operator handoff | Pass; proxy target count remains five, so no new proxy surface was added |
| Internal adversarial review | Refutation-focused pooling, funding/security, and backfill/tooling reviews with focused regression reruns | Pass; all reported implementation defects were closed before the re-freeze |
| Visual and closure surfaces | D2, D24, and D26 release truth; gallery build and frozen-SVG verification; architecture closure validator | Local gallery candidate passes; live republish is unverified because another session owns an uncommitted gallery-builder edit. The validator retains four pre-existing prototype-lane failures and introduces no release-lane failure |

## Re-frozen identities

These are CREATE2 predictions from the reviewed manifest. They are not deployment evidence. The
five proxy targets are the same five target identities as the prior candidate; their predictions
change because implementation bytecode and initializer dependencies changed.

| Identity | Predicted address |
|---|---|
| CommitmentPoolingModule proxy | `0x6BB5b0fd70b6771B0E955Fef37f8Bd2ce911470a` |
| CommitmentRegistry proxy | `0x66300dA4d3749bFc9F7326DB94e0DEb47A7a3959` |
| SettlementModule proxy | `0x19465De2C8acBF477A525FCe180f95445c015917` |
| CreditRegistry proxy | `0x94063C4Aa82916a901D973673C2cd0D01BbB6E0c` |
| CeloSettlementExecutor proxy | `0x276E64f72e8F5F0C346EE1dfde09356b96ca2A67` |
| SettlementFundingLib | `0x8cC05D2443AE960c4CB98F462D87D619774B2bfA` |

## Validation evidence

All Foundry-backed commands were reached through repository Bun wrappers. Sandbox-denied local
loopback, RPC, browser, or Foundry processes were rerun with the required execution permission.

| Command | Result |
|---|---|
| `cd packages/contracts && bun run test` | Pass: 156 Solidity suites, 2,028/2,028 tests; 13 script files, 144/144 tests |
| `cd packages/contracts && bun run test:script` | Pass: 144/144 tests |
| `cd packages/contracts && bun run build:full` | Pass |
| `cd packages/contracts && bun run check:sizes` | Pass; SettlementModule 24,495 bytes, 81-byte EIP-170 margin; SettlementFundingLib 9,338 bytes |
| `cd packages/contracts && bun run check:storage-layout` | Pass: all 15 baselines plus three ERC-7201 namespaces |
| `cd packages/contracts && bun run test:audit:full` | Pass: realism/tooling and coverage; core line 87.16% (6,042/6,932), branch 66.18% (943/1,425), all critical-contract thresholds pass |
| `cd packages/contracts && bun run test:fork:settlement-lane` | Pass: 8/8, including the live refund quote and fork-local credit round trip |
| `cd packages/contracts && bun run release:manifest:write` | Pass: 31 identities and the pinned manifest hash above |
| `cd packages/contracts && bun run release:manifest` | Pass: regenerated lock matches the manifest |
| `cd packages/contracts && bun run typecheck` | Pass |
| `bun .plans/active/commitment-pooling/architecture-closure.validate.ts` | Expected non-zero: the same four sibling prototype-lane failures remain (`sb38`, `sb39`, saved-Offer offline truth, stale prototype coverage); no release-lane failure was introduced |
| `bun .plans/active/commitment-pooling/visual-assets-artifact.build.ts` | Pass: story 21, architecture 32, reference 5, and 44 Mermaid blocks |
| `bun .plans/active/commitment-pooling/visual-assets-prerender.ts` | Pass: 44 light/dark diagrams rendered, zero failures, 162 SVGs, zero host-rendered Mermaid blocks |
| `bun .plans/active/commitment-pooling/visual-assets-prerender.ts --verify /tmp/cp-visual-shareable.PUBLISH-THIS.html` | Pass: `SAFE TO PUBLISH` |
| `bun format` | Pass: 2,080 files checked, no fixes applied |
| `bun lint` | Pass: zero errors; 255 existing Solhint warnings |
| `bun run test` | Pass across contracts, indexer, shared, client, admin, agent, and docs; package counts recorded in the command output |
| `bun build` | Invalid repo gate spelling: Bun invoked its bundler and returned `Missing entrypoints` |
| `bun run build` | Pass: contracts, shared, indexer, client, and admin built in dependency order |
| `git diff --check` and staged diff checks | Pass |

Coverage instrumentation changes the measured receiver path and therefore cannot prove production
gas. The three gas-boundary tests run in every normal and release test suite and intentionally
return early only when `CONTRACT_COVERAGE_MODE=true`; the normal-mode measurements above are the
release evidence.

## Unchanged release-lane blockers

This dispatch did not inspect, resolve, or mutate the following four Phase A blockers. Ownership
and evidence for them remain with the release lane, and this report makes no claim about their
current external state:

1. Protocol-Safe transfer and target Safe shape.
2. AssessmentResolver v3 Phase B.
3. The final `destinationGasLimit` measurement and freeze.
4. Value authority, including Safe/Zodiac roles, allowances, caps, fee policy, and reserve floors.

## Accepted residuals and deferred work

- The unchanged root-pool authority risk is accepted: a current root-garden steward can consume the
  root's one-pool slot with a Garden registration before the owner registers the exact-root
  Protocol pool. The reviewed operational plan requires the owner-only Protocol registration
  first and verifies the exact inventory at every boundary.
- Moving `src/libraries/SettlementMessageCodec.sol` into `src/lib/Settlement/` is deferred until
  after this release. A source-unit path move can change metadata, bytecode hashes, CREATE2
  identities, and the committed review range, so it must receive its own rebuild and manifest
  regeneration rather than ride this re-freeze.
- Unverified: live Visual Asset Gallery republication. The exact local candidate is safe to
  publish, but another session has an uncommitted responsive-sizing edit in the gallery builder.
  Publishing that combined WIP would exceed this session's ownership boundary.

## Audit disposition and next gate

The August 10 owner decision replaced the external vendor audit for the prior wave with an internal
committed-range review. **Afo's explicit confirmation that this substitution extends to the
member-funded increment is still required.** The added refund obligation raises the release's
custody and liveness stakes even though value remains in the recoverable Garden Safe and the
contracts fail closed.

This report does not request or grant broadcast authority. A future broadcast request is valid only
after the four unchanged release-lane blockers are independently closed, the internal-review
substitution is explicitly confirmed for this increment, the reviewed artifacts are pinned, and
the exact chain, stage, signer/owner, artifact diff, rollback checkpoint, and broadcast window are
presented. Message-only ping, Safe/Zodiac value authority, minimum-value canary, production
unpause, and every cap increase remain separate authorization gates.
