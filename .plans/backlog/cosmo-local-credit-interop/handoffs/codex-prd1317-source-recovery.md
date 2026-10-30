# PRD-1317 source recovery

User accepted the administrative close-out and actual issuer/cap enforcement wording on
29 October Pacific. Implement locally and show the diff and checks before publication or closure.
PRD-1317 remains In Review, High, 8 points. No other hold is released.

## Scope and authority

Closest implementations: VoucherEndpoint._send pays the quote but retains no minimum;
VoucherEntitlementModule dispatches immutable bytes but has no administrative close-out.
Settlement's stranded-subject retirement depends on a different trust lifecycle and is not copied.
The entitlement module owns these source policies. Its delivery enum and existing structs stay
unchanged; no destination, shared endpoint, wire-version or G$ behavior change is intended.

The indexer's EarnedVoucherDistribution owns the read annotation. Keep closure evidence and its
cursor separate from delivered/resultSequence; delayed/reordered observations must preserve both.
Release preparation selects no production amount automatically and sends no transaction.

## Behavior matrix

| Action/state/actor | Required result and retained history | Proof |
|---|---|---|
| Initial/retry, unset floor | Refuse, no transport or history change | Source unit |
| Initial/retry, below/exact/above remaining floor | Refuse below; allow exact/above; preserve bytes and entitlement | Source unit |
| Router failure / top-up | Atomic rollback; repaired retry keeps identity | Source unit |
| Floor change, nonowner or active endpoint | Reject; owner while paused may set a positive amount | Source unit |
| Close, unknown/prepared/delivered or nonowner | Reject without altering delivery | Source unit |
| Close, dispatched Pending/Failed, owner | Immutable evidence; source dispatch stops; core/G$ remain unchanged | Unit + integration |
| Duplicate same / conflicting closure | No change / reject | Source unit |
| Closure before late success or failure | Authenticate and reconcile normally; never authorize replacement value | Unit + integration |
| Destination repair after closure | Original execution remains valid once; acknowledgment can become Delivered | Integration |
| Projection, closure/result/preparation reordered | Closure and financial observation remain distinct and immutable | Indexer |
| Release floor missing/zero/positive | Missing blocks activation, invalid rejects, positive encodes exact owner call; readback remains gated | Script |

## Proposed acceptance replacements (local review only)

Dispatch is data-only over CCIP with stored payloads and a positive owner-configured retained
fee floor. Initial sends and retries preserve that floor and the same entitlement and bytes.
An evidence-backed owner-only administrative close-out stops further source dispatch of an
already-dispatched Pending or Failed reward. It neither cancels destination authorization nor
proves nonpayment, discharges the obligation or authorizes replacement value. Authenticated late
execution outcomes still reconcile independently of G$ settlement. Keep existing G$ payout and
funding rules.

Bind each issuer/token to its explicit source approval authority and issuer-controlled reserve,
using the member's supported account or the existing collective Safe. Garden affiliation and
admission do not grant issuer spending authority. Isolate onchain authorization and finite
reserve allowance per issuer/token; identify reviewed client/operator capacity ceilings and
pool exposure limits separately. Hard global outstanding-cap enforcement, selective issuer
suspension and actual-member signing remain existing release holds.

These replace only the source-transport/close-out clause and the final issuer/cap sentence of the
consent criterion. All other PRD-1317 acceptance requirements remain intact. No Linear write yet.

## Local validation receipt

Implementation is local and uncommitted, based on `f1e897a42a54661153770f42b5702edae3ee282f`.
The base includes the earlier beta-guide update; this review patch contains only PRD-1317 work.
Package-patch SHA-256: `5d3004fa61485fce99410de68a37b0485505d91321a139fd93adb00d83e70e2b`.
These are working-copy receipts, with no tested-commit, current-head CI or live-activation claim.

| Scope | Command / evidence | Observed result |
|---|---|---|
| Source recovery and G$ independence | `FOUNDRY_PROFILE=test bun run --cwd packages/contracts test --suite solidity --profile match -- 'test/{unit/VoucherEntitlement,integration/CosmoLocalVoucher}.t.sol'`; `/private/tmp/prd1317-contracts-focused-final.log` | 46 passed |
| Full contract package | `bun run --cwd packages/contracts test`; original checkpoint log | 2,220 Solidity, 3 cold-path release-gas boundary and 772 tooling tests passed in the initial full run |
| Complete verifier retry | `VITEST_MAX_WORKERS=1 node scripts/dev/ci-local.js --intent diagnose --base HEAD --only contracts-verify-fast`; `/private/tmp/prd1317-verifier-serial.log` | Passed the complete selected verifier: full compilation, lint, 2,220 Solidity tests, 3 cold gas fixtures and 772 tooling tests; no skipped verifier stage beyond its configured E2E/dry-run exclusions |
| Shared / Client / Admin consumers | Selected checkpoint; `/private/tmp/prd1317-checkpoint.log` | 8,592 / 2,134 / 1,432 passed; Shared retained 16 existing skipped tests |
| Indexer full suite | `bun run --cwd packages/indexer test`; `/private/tmp/prd1317-indexer-tests-verified.log` | 376 passed, 1 existing local-fork integration pending |
| Indexer codegen / type build | `node scripts/dev/ci-local.js --intent diagnose --base HEAD --only indexer-build`; `/private/tmp/prd1317-indexer-repair-receipt.log` | Fresh pass after fixture corrections |
| Pinned voucher rehearsal | `FOUNDRY_PROFILE=test bun run --cwd packages/contracts test --suite solidity --profile match -- test/fork/GnosisVoucherPilot.t.sol`; `/private/tmp/prd1317-voucher-fork-stable.log` | 21 passed; published substrate, synthetic accounts and manually relayed transport |
| Storage | `FOUNDRY_PROFILE=production bun run --cwd packages/contracts check:storage-layout`; `/private/tmp/prd1317-storage.log` | All 16 protected layouts pass; direct baseline/current entitlement comparison also passes |
| Production size | `FOUNDRY_PROFILE=production bun run --cwd packages/contracts check:sizes`; final artifact recheck uses `-- --skip-build` | All deployable contracts fit EIP-170 |
| Structural and guidance guards | Source structure, ontology and supply-chain checks in the original checkpoint; final metadata follow-up | Original gates passed; final evidence-only metadata follow-up is recorded in `/private/tmp/green-goods-prd1317-review/verification.json` |

The direct compiled compatibility comparison preserves all 45 existing selectors, all 93 existing
ABI entries and all 27 existing storage entries, including nested types and offsets. The new
minimum and evidence map occupy slots 310 and 311; the gap shrinks from 41 to 39 slots and still
ends at slot 351. Existing terms, distribution structure, delivery enum, peers and wire version
remain intact. Source runtime is 19,777 bytes, leaving 4,799 bytes. Escrow runtime is byte-for-byte
identical to the reviewed baseline at 24,369 bytes, retaining 207 bytes of headroom.

Detailed local artifacts are in `/private/tmp/green-goods-prd1317-review/`: `changes.diff`,
`acceptance.diff`, `compatibility.json`, `current-entitlement-layout.json` and
`validated-files.json`. The full review patch passes `git apply --check` against its clean base.

## Failures and their resolution

The aggregate checkpoint retains its original failures and is not relabeled as passed. Its
indexer route-test fixture had an `unknown` transaction type; explicit typed transaction facts
fixed it, and the independent build receipt passes. Regenerating the ABI also required the
existing conformance test to expect ten selected source events, including `VoucherDispatchClosed`;
it still compares every field and indexed flag to the compiler ABI. The final full indexer suite
passes after that update.

The verifier's repeated tooling run exceeded the existing keystore fixture's 60-second test
budget (about 82 seconds) while executing 23 real Cast decryptions. The unchanged fixture passes
alone, 4/4 in 18.54 seconds. No password, signing, lease, timeout or test-count safeguard changed.
The complete verifier is retried with the supported `VITEST_MAX_WORKERS=1` execution setting;
all tests and the fresh production build remain enabled. The complete one-worker retry passed without changing test contents, timeout values or signing controls.

Initial isolated dependency collection was repaired without installing packages or editing
configuration; those collection errors are not RED evidence. The two new source behavior tests
then failed against the baseline with 29 existing tests passing. Existing fee-exhaustion fixtures
were updated to fund the newly required retained floor. Fork artifact preparation was serialized
after the forced storage rebuild; the subsequent 21-case rehearsal passes. Failed runs are kept
as history and are not reused as passing proof.

## Boundaries retained

- PRD-1317 remains In Review, High priority, 8 points. The proposed description changes above and
  `acceptance.diff` are local review material; no Linear body, comment or status was written.
- The local Arbitrum contract-to-indexer replay was unavailable; it needs the local fork service.
  No live CCIP, actual member signing, sponsorship, service delivery or device acceptance is inferred.
  Rendered proof: none; no UI changed.
- The production fee amount remains `null`. Activation still requires a separately reviewed source
  upgrade/configuration, a positive owner-selected floor, funding, fresh implementation/configuration/
  balance readback and separate activation authorization. The historical one-shot activation batch
  was not rerun. The updated review-only package contains the new configuration and readback stage.
- Finite reserve allowance, client/operator capacity policy and pool exposure caps keep their actual
  scopes. Hard outstanding-cap enforcement and selective issuer suspension retain their existing
  release holds. The earlier writer/mint alternative is marked historical and removed from current
  acceptance wording.
- Live-pilot, broader signing, wording and device holds remain unchanged. Existing hub lane statuses,
  owners, branches, dependencies and manual blockers are preserved. No commit, push, publication,
  broadcast or issue closure occurred.

Task record: PRD-1317 | Type: feature | Outcome: local implementation complete; review delivery complete; publication and issue closure remain separate
Agent/model: Codex / unknown. Coverage: this implementation segment only.

| Phase | Start → end (UTC) | Result |
|---|---|---|
| Investigate | 2026-10-30 03:07:25 → unknown | Accepted scope, direct callers and live preserve-only tracker state verified |
| Implement | unknown → unknown | Source guards, separate projection, release preparation and current wording |
| Verify | unknown → 2026-10-30T05:04:34.317459+00:00 | Exact command/results above; synthetic and manual limits retained |
| Review | 2026-10-30 04:16:06 → 2026-10-30 04:16:39 | Read changed critical paths and compatibility evidence; no remaining code finding |

Human corrections: 0 in this segment; human attention: unknown. Phase intervals are elapsed-time
records and are not added together or treated as active effort.
