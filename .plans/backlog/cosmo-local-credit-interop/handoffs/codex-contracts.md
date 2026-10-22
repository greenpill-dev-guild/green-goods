# Earned-voucher contracts slice

**Status:** earned-voucher slice implemented and locally verified, left uncommitted for testing. No commit-attributed
validation receipt, release readiness or full voucher lifecycle completion is claimed.
**Branch:** `feature/cosmo-local-contracts`, reconciled and fast-forwarded to `origin/develop`
at `4a6b2f2e519b3e4cc675ed7bd738ab12b18bd4a2`.
**Scope authority:** user's 21 October 2026 earned-voucher dispatch and checkout-reconciliation follow-up.
The [current spec](../spec.md) supersedes older core-upgrade, adapter mint-writer and optional-ack proposals.

**Later continuation:** the user subsequently authorized cohesive local commits and the
[service integration sequence](codex-service-access-integration.md). Signing remains required;
the user makes signed commits from their terminal. This handoff's original tests remain dated
working-tree evidence. A commit alone does not recertify them or clear live gates.

## Checkout preservation

The prior `codex/cosmo-local-planning` checkout was at `06a31dbf5`. Reconciled its uncommitted work
with `origin/develop`, preserving byte-for-byte originals, the original index, patch and SHA-256
manifest at `/private/tmp/green-goods-reconcile-20261021-0901`. All 241 original changed/untracked
files were verified after applying the reconciliation; no stash, reset, commit, worktree or discard
was used. Of those files, 88 already existed in upstream history, 108 remained local additions,
11 merged cleanly and 34 overlaps were reviewed and resolved. Newer upstream PWA design decisions
and app funding-limit fixes were preserved alongside newer local Cosmo-Local planning. All pending
work remains unstaged. Reconciliation reports and original bytes remain in that backup directory.
A follow-up audit caught one clean textual merge that would have replaced newer Commitment Pooling
release evidence with an older local snapshot. The full upstream release record was retained and
the local snapshot was preserved separately as `release-essential-docs-local-snapshot.md`, with a
canonical link. The other ten automatically merged paths preserved both sets of meaningful changes.

During validation `origin/develop` advanced from `2bc66c12a` to `4a6b2f2e51` (app/shared ownership
refactor). After checks finished, verified zero overlap between its 70 paths and 147 pending local
files, saved another complete snapshot, then ran `git merge --ff-only origin/develop`. All 147 local
files remained byte-identical. There is no baseline-to-baseline change in `packages/contracts`,
`scripts/contracts`, `scripts/dev`, root dependencies or lockfile. The updated selector retains
the same five contract checks. This fast-forward created no commit.

Sensitive pre-existing work: `.claude/settings.json` retains the local code-simplifier plugin entry
alongside upstream hooks. No permission, CI, manifest, lockfile, dependency or release gate was weakened.

## Authoritative context and limits

Read root/package guides; the hub's spec, tasks, evaluation, status, architecture candidates and
review/conformance evidence; ontology/product, architecture, testing and validation guidance.
Applied pragmatic-programming, domain-driven-design, research, plan and humanize-writing.
The plan skill explicitly routes independent new-module work to parallel agents; preflight passed.
Work ownership separated source/codec/governance, destination, and pinned-token fork proof.

Read current RESR-73, PRD-1315–PRD-1319, PRD-1096 and COM-46 plus all returned comments on 21 October.
No newer human architecture decision conflicts with the accepted dispatch. Stale tracker paragraphs
about writer minting, automatic caps, ordinary-only confirmation and first-slice service escrow
are superseded; no Linear record was changed. The sync manifest was read-only `preserve`.
Real prices, service capacity, responsible issuer approval and signer identities remain COM-46 gates.

Preserved the independent review and conformance handoffs verbatim from commit `5cc358fa44`.
The review's preacceptance edit-window argument alone does not prove revision consent; explicit
preacceptance consent and freeze are required. Its optional acknowledgment lane is superseded by
mandatory authenticated v1 acknowledgments.

Published CLC sources: [SPEC at v1.1.0](https://github.com/cosmo-local-credit/protocol/blob/ce090fd3d5a7493c726fb939da39af15ef1c9d7c/docs/SPEC.md),
[deployment documentation](https://github.com/cosmo-local-credit/protocol/blob/ce090fd3d5a7493c726fb939da39af15ef1c9d7c/docs/DEPLOY.md),
[protocol overview](https://docs.cosmolocal.credit/protocol/overview/) and
[smart-contract documentation](https://docs.cosmolocal.credit/protocol/smart-contracts/).
Only published docs/metadata/build artifacts and chain bytecode were inspected; no AGPL implementation
source was read, imported or vendored. Existing conformance is documentation, not an existing test suite.

Read-only conformance was refreshed against Gnosis block **48,848,261**, chain **100**:
GiftableToken implementation `0x34445d13F112A11f72C1d353a7dcdc407F3df2d8`, 5543 runtime bytes,
codehash `0x074980d5e0e6bfb3afd2faa9f828cf65d65ae7ed568f65b2623fa61190e95d91`;
factory `0xB286994c648F98fD3a3BA6C43934828a5b88162b`, 1887 runtime bytes,
codehash `0x2e06e9a024d7bd35356833e6fcb9f34c1fbdae8bbd91da3bc55e4cc2ba4d1230`.
Both match again at block **48,865,004**, hash
`0x41911565d659480a725d5e5b3cd2d98bc0c6668b9f1cfb35695832fc80a115e8`.
The published v1.0.0 build artifacts match the historical SHA-256 and contain the exact deployed
runtime suffix. Embedded compiler version is 0.8.34; README's 0.8.36 line is stale.

At block 48,865,004 the recorded WebAuthn validator
`0xbA45a2BFb8De3D24cA9D7F1B551E14dFF5d690Fd` still has zero code. A local Safe/ECDSA stand-in
is a distinct custody model and does not prove member passkey signing. CCIP router/fee-quote evidence
is not live DON delivery. No signing, broadcast, live deployment, funds movement or external write
is authorized or performed.

## Implemented contract and interface inventory

All nine new Solidity files are local, untracked additions. Existing contracts, tests, manifests,
dependency versions, ABI/deployment configuration, Hats, commitment registry/core and G$ contracts
remain unchanged. Nothing depends on this Plan Hub at runtime.

| File under `packages/contracts/` | Responsibility and integration entrypoints |
|---|---|
| `src/modules/VoucherEntitlementModule.sol` | `registerTerms`, `approveTerms`, `consentTerms`, `prepareDistribution`, `dispatch`; issuer identity registry and terms/distribution/command views |
| `src/modules/GnosisVoucherAdapter.sol` | Issuer `configureAsset`; authenticated intake; `retry`, issuer-only `safeRetry`, `quoteAcknowledgment`, caller-funded `retryAcknowledgment`; durable command/result/failure views |
| `src/modules/VoucherEndpoint.sol` | Fixed chain-qualified CCIP peer, paused initialization, owner/guardian pause, owner resume and codehash-bound 48-hour scheduled UUPS upgrades |
| `src/libraries/VoucherMessageCodec.sol` | Distinct command/acknowledgment domains and v1; retry-stable entitlement derivation and canonical economic payload hash |
| `src/interfaces/ICLCGiftableToken.sol` | Hand-written published GiftableToken/factory interface for pinned conformance and fictional issuer inventory |
| `test/unit/VoucherEntitlement.t.sol` | 20 tests using real core recognition, including 1,000 conservation fuzz cases |
| `test/unit/GnosisVoucherAdapter.t.sol` | 32 tests, including 1,000 exact-transfer fuzz cases and fee-grief regressions |
| `test/integration/CosmoLocalVoucher.t.sol` | Four real-core/account/G$ integration cases with mock CCIP transport |
| `test/fork/GnosisVoucherReserve.t.sol` | Nine fail-closed pinned Gnosis cases using the actual GiftableToken implementation and factory |

The creator freezes the issuer-approved expected revision before acceptance. The actual eventual
counterparty must consent to that same revision before acceptance; a human `requestedBy` cannot
substitute for a GardenAccount. Existing account execution is used, with no core acceptance upgrade.
An independent core acceptance that bypasses voucher consent yields no voucher entitlement.
Authorized fallback/dispute `Fulfilled` states qualify without inventing personal confirmation.

Complete recognition comes from the real `validateRecognitionSnapshot`. Largest fractional
remainders, with ascending-address tie breaks, conserve every agreed base unit and retain zero
rows. The v1 bound is 40 contributors. Terms reject zero and `uint256.max` totals: the latter is
the ERC20 unlimited-allowance sentinel and cannot fit the required finite allowance. This bound
is a distribution-budget rule, not a supply, service-capacity or outstanding-obligation cap.

The destination reserve authorizes its token/source-issuer identity independently. Every attempt
uses the stored payload and checks finite allowance, exact allowance decrement and exact balance
changes. An issuer that is itself a legitimate recipient still consumes the entire delegated
allowance; its reserve debit is net of its own share. Any later transfer/check failure rolls back
the entire transfer batch and allowance consumption, while retaining the outer failed result.

Only first authenticated intake sponsors one acknowledgment attempt. Duplicate messages and
execution retries cannot drain that native fee reserve. After repair, explicitly retry execution,
then call `quoteAcknowledgment` and `retryAcknowledgment` with exactly that native fee. Quote/send
failure reverts only the paid retry, returning its value; it cannot undo or repeat distribution.
`acknowledgmentSequence` identifies which durable result was actually dispatched. Lost delivery
of an already-sent acknowledgment is repaired by the same independent paid resend. The source
remains pending/unknown until an authenticated result arrives; no timeout replacement exists.

The integration test completes 100 fictional G$ units for the same real commitment, fails its
19-unit voucher reward on allowance, records a failure acknowledgment, retries after issuer
repair, loses the success acknowledgment and then reconciles it. G$ balances and the original
settlement receipt hash remain unchanged throughout. Real GardenToken/GardenAccount execution
proves the account consent boundary. CCIP, test ERC20, Safe signers and Zodiac execution are
explicit local stand-ins; changing chain IDs inside one EVM does not prove a real DON journey.

## RED/GREEN and validation evidence

Source RED compiled successfully and failed because an unauthorized protocol owner could register
terms without the garden's hat:
`bun run --cwd packages/contracts test --suite solidity --profile match -- test/unit/VoucherEntitlement.t.sol`.
Observed: 0 passed, 1 failed, `next call did not revert as expected`, against the local functional
pre-guard skeleton. A temporary destination no-transfer mutation produced 18 failures and six
passes, then was restored. Three real fee-budget regressions failed before the acknowledgment
funding repair and now pass. Compile/import failures are not counted as RED evidence.

The root `bun run check --plan -- --intent qa` selector was inspected for the whole preserved
checkout. Its broader app/docs checks reflect unrelated retained work. Scoped selection includes
all nine new Solidity files plus every owning-hub file (38 paths); it retains every financial
critical override: `abi-artifacts`, `contracts-build`, `contracts-test`, `contracts-verify-fast`,
plus `format`. The exact scoped argv and selector result are retained in the preservation directory
as `critical-validation-argv.json` and `validation-plan-slice.json`.

The exact invoked wrapper was
`python3 /private/tmp/green-goods-reconcile-20261021-0901/run-critical-validation.py`.
Its complete subprocess command is retained verbatim in `critical-validation-argv.json`:
`node scripts/dev/ci-local.js --intent qa --reuse-passing-receipts --changed <38 comma-joined paths>`.
The critical QA plan ignores receipt reuse and runs every check
fresh. The first sandbox run failed only because its dual-chain lifecycle fixtures could not bind
loopback port 3012 (`EPERM`); the rerun was granted local-process/network capability for the same
checks. The owned Anvil fixtures use ports 3012/3013. No test selected a live write or deployment.
Logs are `critical-validation-sandbox.log` and `critical-validation.log` in the preservation directory.

The critical runner exited 0 at 16:36 UTC on 21 October 2026: **five fresh passes, zero reused,
zero unrun**. `contracts-test` passed and `contracts-verify-fast` independently repeated the full
package checks: **2,003 Solidity tests, three production G$ cold-gas boundary fixtures, 31 Node CLI
tests and 319 Vitest/script tests**, all passing. The verifier also passed full compilation,
pinned Foundry and repository static lint. Its selected `--skip-e2e --skip-dry-run` flags are the
policy's fast override, not waived release gates. No browser E2E or live deployment is claimed.

| Additional exact command (repository root) | Observed result, 21 October 2026 UTC |
|---|---|
| `FOUNDRY_PROFILE=fork bun run --cwd packages/contracts test --suite solidity --profile match -- test/fork/GnosisVoucherReserve.t.sol` | Final code: nine passed, zero failed/skipped at Gnosis chain 100, block 48,848,261; observed by 16:38 |
| `bun run --cwd packages/contracts check:sizes` | Production profile: all deployable sources fit EIP-170; entitlement module 17,940 bytes, adapter 14,749 bytes; observed by 16:39 |
| `bun run --cwd packages/contracts check:storage-layout` | All 16 existing protected contract layouts and three ERC-7201 namespaces match baselines; observed by 16:42 |

Logs are `fork-final.log`, `sizes-final.log` and `storage-final.log` in the preservation directory.
The new endpoints have reserved storage gaps and upgrade/replay tests. They are not registered in
the existing deployed-contract layout baseline list; a future upgrade release must establish their
initial layout receipts and compare its proposed implementation. Existing baseline checks prove
preservation of the existing contracts, not every future voucher upgrade.

Other observed checks:

- `bun run --cwd packages/contracts format`: passed; only new Solidity files changed.
- `node scripts/contracts/check-solidity-test-names.mjs`: passed, 65 new test names.
- `node scripts/harness/plan-hub.mjs validate --feature cosmo-local-credit-interop`: passed, 34 hubs.
- `node scripts/quality/check-guidance-links.mjs`: passed, 94 guidance files.
- `node scripts/docs/generate.mjs --check`: passed, 17 projections.
- `bun run --cwd packages/client test src/__tests__/bootFallback.test.tsx`: passed, 35 tests for preserved checkout work. No new voucher UI was implemented; rendered proof is **none**.
- `git diff --check`: passed.

An additional non-required strict Solhint probe with `--max-warnings 0` exited 1 with zero errors
and 11 gas-advisory warnings (storage/memory packing and event indexing). No warning suppression,
lint-policy change or runtime wire-layout churn was introduced to make that probe pass. The
repository's actual lint gate is retained in `contracts-verify-fast`.

Working-tree evidence is bound to the nine-file SHA-256 manifest `validated-contracts.json`:
bundle digest `21c73def997daeeb1ec88b548cc4f24da7ee822b5f350157b3ca9b87f564a907`.
These files are absent from committed HEAD. No passing command, TDD state or fork receipt is
represented as validation of a commit containing the implementation.
Final verification boundary: **2026-10-21 16:44:21 UTC**; tested implementation commit: **none**.
The branch's upstream baseline is `4a6b2f2e519b3e4cc675ed7bd738ab12b18bd4a2`; it is not an
implementation receipt. Final checks reconfirmed all 241 original backup hashes, all nine tested
code hashes, unchanged unrelated lane objects, no staged/unmerged entries and unchanged existing
contract files. TDD was recorded through `plan-hub.mjs record-tdd`; the contracts lane remains
`in_progress`, and the overall hub remains backlog.

## Transport configuration and proof limits

Fictional fixtures use Arbitrum 42161 / selector `4949039107694359620`, Gnosis 100 / selector
`465200170687744372`, and existing G$ Celo 42220 / selector `1346049177634351622`.
Endpoint peers are fixed during proxy initialization, and every intake authenticates router,
selector, EVM chain, peer, wire domain/version and absence of attached tokens. No peer/address
configuration is a live deployment artifact. All initial execution is paused.

The command gas limit is 6,000,000, acknowledgment limit 400,000, maximum 40 contributors (3,200
encoded command bytes). The cold
40-recipient mocked intake measured about 3,974,536 gas in the production-oriented rehearsal and
passes the authorized 6M boundary test. This includes stored payload, exact-transfer checks and
the first acknowledgment attempt; mock router/token gas is not a live upper bound.

A read-only Arbitrum CCIP quote at block **516,872,681**, router
`0x141fa059441E0ca23ce184B6A78bafD2A517DdE8`, accepted a 3,072-byte, token-free, native-fee command
with V2 out-of-order flag and gas limits through 6M to Gnosis selector `465200170687744372`.
The observed fee was 44,678,471,556,345 wei; an 8M quote was rejected. Historical Arbitrum block
516,507,430 was unavailable from the tested public archives, so no new historical quote is claimed.
The same fresh pin also accepted 3,200-byte V2 payloads at 6,000,001 gas and 7M; these are separate
shape probes, not a real encoded-command delivery receipt. The recorded live Gnosis router is
`0x4aAD6071085df840abD9Baf1697d5D5992bDadce`.
Quotes/configuration are destination-specific and must be refreshed before release; they prove
neither message execution, real gas headroom, fee sponsorship nor live transport reliability.

The community owner may configure source issuer identities while paused, pause/resume, transfer
ownership and schedule upgrades. A guardian can pause immediately but cannot resume or bypass
the codehash-bound delay. A later authorized implementation could change spending rules; the
Safe's finite revocable allowance is therefore still a real delegated trust boundary. Issuer
inventory minting, allowance, token/factory proxy administration and future cap decisions remain
privileged issuer/governance powers, not automatic reputation outcomes. The adapter exposes no
mint, limiter, pool ownership, withdrawal or token-recovery authority.

Fork fixtures use an actual 48-hour TimelockController for CLC token proxy administration and clearly
labeled local Safe stand-ins. Test initialization is not proof that live Safes, thresholds,
signers, timelocks or token administrators have been installed. Package-owned live deploy/init,
artifact persistence and downstream configuration paths still need a separate release slice;
no safe broadcast command for these new endpoints is claimed here.

## Remaining scope

Purchases use a later bounded direct Gnosis swap to the named learner with minimum output/deadline;
WXDAI is rehearsal-only and the swap receipt must not produce a duplicate Arbitrum entitlement.
Service presentment later links escrow to an existing Green Goods promise; explicit holder approval
releases only delivered units to the issuer reserve, with partial outcomes and agreed remedies.
Neither timeout nor token return proves service delivery. No automatic burn or competing registry.

This slice does not clear COM-46, member passkeys, app/indexer lanes, audit, Safe ownership, testnet
soak, rollback, release or live-transport gates. Leave all code local and uncommitted for testing.

Task record: Cosmo-Local earned-voucher slice | Type: feature | Outcome: complete for the dispatched local slice; broader lifecycle incomplete
Agent/model: Codex / model unknown | Coverage: reconciliation and implementation segment after first blocked attempt

| Phase | Start → end (UTC, 21 October 2026) | Result / evidence |
|---|---|---|
| Investigate | 09:01:38 → 09:12:36 | Checkout snapshots, 241-file backup, three-way review, live records and pinned protocol evidence |
| Implement | 09:12:36 → 16:17:30 | Reconciled checkout, new contracts, meaningful RED/GREEN and integration proof |
| Verify | 16:17:30 → 16:44:21 | Five fresh critical passes, pinned fork, size/layout gates, final hashes and consistency checks |

Human corrections: 0 in this segment; attention: unknown. Times measure observed elapsed boundaries,
not active effort. The 09:35–16:04 clock gap has no reliable active-work coverage. Earlier blocked
branch-switch attempt is recorded in the chat. No publish phase was entered.
