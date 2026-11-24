# Voucher acceptance, setup and final settlement reconciliation

**Later continuation, 22 October UTC:** the user dispatched member-signing and issuer-readiness
proof and now requests local signed commits, superseding the uncommitted-only instruction in the
historical reconciliation record below. [The new handoff](codex-member-issuer-readiness.md) records
the fresh Gnosis validator/deployment blocker, separate account facets and issuer evidence gaps.
The safeguards runtime is unchanged and matches its earlier receipt. Required signing, terminal
custody of the keyring, unrelated work and all broader/live gates remain preserved.

**Implementation resumed after human signing:** checkpoint
`e7cd49d6df2b0fdf0ece8ac5dd994d2ebb2effd5` contains exactly the reviewed 71-path patch
(`caefae72ffe67de5efe186ce18512aa257bc9a4c91bcb2f8fe72aba0f3814154`). The index was empty
and contract working files clean at resume. Its PGP signature header is present; this session
does not read the keyring or independently verify that signature. The user explicitly dispatched
the reconciliation below and requires every new change to stay local and uncommitted.
The checkpoint preservation barrier is resolved. The preparation chat confirms no newer human
conflict and has made no checkout/index edit. Its separate UI design prompt targets these same
requirements and grants no runtime or tracker authority to that design session.

Execution used three disjoint contract owners: core/earned acceptance, source protocol and
codec, destination custody/final legs. The core and destination capture assertion-based baseline
RED before the old runtime changes. The source owner freezes the shared v2 wire seam first;
compilation/tests are serialized. Source/ABI/storage proof precedes affected Indexer, Shared and
member migration. Existing consumer work and unrelated changes remain preserved.
New commands, hashes and proof are retained under
`/private/tmp/green-goods-voucher-safeguards-20261021/`; `resume-baseline.json` records 130
public source identities and the signed checkpoint boundary. Earlier results below remain dated
checkpoint evidence; none is recertified as proof of the new safeguards.

### Bounded local reconciliation proof

All results here are working-tree evidence after `e7cd49d6`, not a receipt attributed to that
checkpoint. The three meaningful RED runs compiled successfully before their behavior assertions
failed: direct earned acceptance lacked counterparty consent (`core/red-consent.log`, 0/1);
preacceptance setup still required accepted-service terms (`source/source-red.log`, 0/1);
legacy authorization and incremental release bypassed the new safeguards
(`destination/red-bypass.log`, 0/2). The source fixture's earlier compiler failure is recorded
separately and is not RED evidence.

Observed focused GREEN before production-size repair: core 82/82 (two fuzz cases at 1,000 runs),
earned integration 4/4, source 38/38, destination 45/45, two original destination regressions 2/2
and real-core service integration 5/5. Source and destination each include a 1,000-run fuzz case.
The destination's 24 prior linear entries and recursively referenced stored types are
identical before/after. All eight registered ERC-7201 namespace checks pass, including the three
new namespaces; the previous five entries are preserved. The source's recursive 24-entry storage
comparison also passes, with exact checkpoint declaration/base/codec preservation and explicit
older-artifact provenance in `source/source-storage-comparison.json`.

The first production size check failed: source setup was 28,886 bytes (4,310 over EIP-170),
escrow 25,013 (437 over). Those failed artifacts and the intermediate source result remain in
the evidence directory. After the fixed-library extraction below, the fresh whole-production
size gate passes: core 23,541 bytes, earned source 18,899, service source 23,672 and escrow
24,139. The source and escrow retain 904 and 437 bytes of EIP-170 margin respectively.
Source linked-library checks are 6,366 and 5,583 bytes; destination transfer checks are 2,154.
No size limit, authority check or receipt check was weakened.

Linked-build GREEN repeats source 38/38 and real-core integration 5/5, and destination 45/45,
the two original bypass regressions 2/2 and real-core integration 5/5. Source ABI/method IDs
and destination ABI/method IDs are unchanged by extraction; recursive linear layouts also
match their recorded comparison artifacts. The final default build and ABI export pass.
`conditional-production-sizes.log` records the successful whole-production gate at
2026-10-22 01:12:40–01:12:41 UTC. These are working-tree results, not checkpoint receipts.

The exact storage-layout wrapper then failed during compilation with its compiler stderr hidden.
An exposed-error reproduction traced the failure to its trailing source target being consumed by
variadic `--skip`: it compiled unintended tests, including a fixture that fails outside the test
IR profile. The bounded repair terminates options with `--` before the target and preserves compiler
stderr. It retains the forced build, source/test exclusions and every layout check. Three
process-level regressions fail before the repair and pass afterward; the 31 CLI tests also pass.
The exact full wrapper passes at 2026-10-22 01:30:22–01:32:24 UTC: all 16 protected linear layouts
and all eight namespaces match. The nonfatal Foundry signature-cache permission warning remains
recorded; no permission or compiler-profile change was made. See `storage-wrapper-fixed.json`.
This storage-only pass preceded the final critical selector below; it did not certify other checks.

Fresh pinned forks pass at 2026-10-22 01:38:37–01:39:25 UTC: Gnosis 41/41 (nine earned reserve,
22 direct purchase and ten reconciled service cases) at chain 100/block 48,848,261, and Celo
12/12 at chain 42,220/block 75,178,393. Gnosis block hash is
`0x03be75732ad238a0c04d6044a42d2fd7baec4b48f89afed9670886ca0477b60d`;
Celo is `0xf225ecd4643bced3b267819f0d8f99bc5e39cc4b6baf25b3bbdaa4e8d63b5f4f`.
`pinned-fork-repair-proof.json` records exact commands, environments, logs and zero source
mismatches. The first run's 40 passes and one RPC timeout remain in `pinned-fork-proof.json`:
the new fictional guardian required three previously uncached account reads. The approved
Green Goods Alchemy app supplied those actual pinned responses before the unchanged full rerun.
No zero response was fabricated. The read-only relays allowed no write methods and were stopped.

Fork transport and Safe signers remain explicit local stand-ins. These results prove selected
pinned CLC bytecode behavior and the scoped existing Celo paths, not live DON delivery, real
issuer capacity, account signing or rollout readiness. The recorded Gnosis WebAuthn validator
still has no code at the pin and at the separately checked head; member passkeys remain unproved.
An additional read-only cross-contract review path-traces acceptance/Abort ordering, old-claim
recovery, replay/sequences, fixed legs, liabilities, acknowledgment budgets and linked context;
it reports no findings. That review adds no newly executed test or commit-attributed receipt.

The contract/ABI seam is frozen for consumer migration. Indexer adds typed, chain/module-qualified
acceptance, setup, custody, final-allocation, leg and acknowledgment observations without any
live endpoint registration. Its final full suite passes 361 tests, with one pre-existing opt-in
local contract-event integration pending. Codegen/build, lint, format and indexing-boundary checks
pass, and all 21 new routes are exercised through registered Envio v3 handlers with fictional
endpoints. Late authorization and cross-sequence consistency have their own RED/GREEN evidence;
all 26 owned paths match the final manifest. See `indexer/indexer-proof-receipt.json`.
Shared now reads exact current/prior setup authorization, permanent core acceptance, source
clock/decision and separate destination custody, final-allocation legs and both acknowledgment
lanes. Discovery uses chain/module/buyer-qualified indexed observations; the permanent accepted
receipt also recovers independently of current claim discovery. Generated-ABI tests caught and
repaired the actual `resultSequence` field mapping. Malformed later acknowledgment evidence
cannot publish a partial destination projection. Earned consent reads remain independent of the
payment route and do not suppress existing personal G$ recovery when their proof is unavailable.
Only DEV fictional rehearsal mutates state; production actions remain unavailable pending reviewed
deployment and signing. Latest source block time is explicitly unfinalized and does not establish
an atomic block-hash-pinned set of RPC views. See `source/shared-proof-receipt.json` and its
37-path SHA manifest.

Shared focused proof covers 68 unique cases across recorded runs, not a single 68/68 run. The
retained 65/66 run timed out on its first cold-import hook under diagnosed CPU contention; an
unchanged 4/4 hook rerun and the latest affected 20/20 cases pass, with full source/test types
passing. No timeout was raised. The full current package critical gate is recorded separately.

Client replaces incremental approval with one holder-reviewed immutable full allocation and
independent fixed-leg review/execution. Current and prior setups preserve exact identities and
recovery; sent acknowledgments remain distinct from source observations. Modal context changes
reset consent; unknown evidence cannot become a positive authorization. Personal G$ remains
separate. All service copy has matching English/Spanish/Portuguese keys; the unrelated Portuguese
edit remains preserved. Final focused proof passes 88/88, full source/test/story types, lint,
format and story coverage pass. A subsequent test-only addition passes four explicit fee-network
cases: both acknowledgment lanes use Gnosis 100 and source commands use 42161. The other 22
Client/locale hashes remain identical. See `client/client-proof-receipt.json` and its 23-path
manifest. Happy-dom tests are component proof, not browser, signing or live activation proof.

These consumer migrations do not certify member signing, live deployment or actual provision of
service access. Full critical validation and final frozen-source rendered proof are pending below.

Shared consumes the generated `VoucherEntitlementModule` ABI for earned terms/consent reads;
`build-abis.ts` now exports that compiled artifact alongside the additive acceptance interface.
The generator passes with only the new earned ABI written and all earlier ABI exports unchanged.
This avoids a duplicate hand-maintained description of our own contract views; the CLC interfaces
remain hand-written under their separate clean-room boundary.

The fee safeguard addresses a new service-escrow retry path: automatic acknowledgments with a
nonzero quote must not consume prefunded native balance on repeated permissionless failures.
Such results remain durable with visible acknowledgment failure; fee-bearing sends require exact
caller payment. Zero-fee sends may still be attempted automatically. The earned adapter already
limits sponsored acknowledgment to initial authenticated intake and preserves its reserve during
execution retries; its runtime remains unchanged.

Size repair uses existing cohesive helpers as fixed linked libraries. Source delegates its
current-core reads to `VoucherServiceConsentLib` and pure result checks to
`VoucherServiceResultLib`; it retains transport authentication, histories, decisions and writes.
Destination delegates issuer/transfer checks to `VoucherRedemptionTransfers`; the escrow retains
all authority, phase, liability and leg-consumption checks around the atomic self-call. The
library calls preserve the calling module's address and static context. They add no mutable peer,
storage namespace, mint writer, pool authority or owner bypass.

These three library bytecodes and their linked addresses are new deployment/upgrade identity
prerequisites. The existing core linker inventory is unchanged. Local compiler linking does not
establish live library deployment or release readiness. Retain explicit Safe/timelock/audit and
reviewed artifact gates, and do not use retained v1 views as evidence that a funded live v1 escrow
can be upgraded to v2 safely; no such migration is implemented or certified.

### Full consumer and build-wrapper continuation, 22 October UTC

Full Shared proof now passes **7,502 tests, 16 existing skips**. Its first run retained one
unchanged language-provider catalogue wait failure (7,501 passes); the unchanged four-case file
and then the entire Shared suite pass without changing a timeout or assertion. Client's first
full run caught a new acknowledgment heading without its own size class. Adding `text-xs`
passes the existing typography guard and 44 service tests (48/48), followed by a fresh complete
Client run: **1,774/1,774**. The two new public-shell cases in that total belong to another chat;
this slice preserves that work and claims no authorship of it.

Admin's first full run retained seven Hypercert-dialog failures (1,300 passes); the unchanged
18-case file passes alone. A later full run retained three different ten-second timeouts
(1,304 passes). The sandbox cannot write the machine coordination lease under `.git`, so the
wrapper uses its conservative worker fallback. The supported `--maxWorkers 1` mode then passes
**all 1,307 Admin tests**, keeping every test and timeout unchanged. This is a complete serial
component proof, not a relabeled default-concurrency pass. Agent typecheck and both full test
phases pass: **558 tests/one existing skip**, then **218 SQLite tests**. Selected registered
Indexer handlers pass **42 cases**, alongside the earlier full 361/one optional pending result.

Exact commands, UTC bounds and retained failures are in `final-checkpoint-shared-red.*`,
`remaining-checkpoint-client-red.*`, `completion-checkpoint-admin-red.*`, `full-consumers.json`,
`admin-serial.json` and `independent-checkpoint.*` under the current evidence directory. Full
Client uses `bun --no-env-file run --cwd packages/client test`; serial Admin uses
`bun --no-env-file run --cwd packages/admin test --maxWorkers 1`, both through the task's existing
Bun no-env PATH shim. No dependency, assertion, timeout, profile or permission was weakened.

The selected default contract build exposed the same variadic `--skip` target defect as the
storage wrapper: `build-adaptive.ts` accidentally compiled the non-IR-incompatible voucher test
helper despite selecting only source. Its two-line repair inserts `--` before positional targets.
Three process assertions fail before the repair; all six cases and the existing 31 wrapper tests
pass afterward. Full/no-target mode, target broadening, explicit/default profiles, quiet mode and
compiler diagnostics retain their behavior. The exact selected contract build now passes in
2.74 seconds. See `adaptive-build/adaptive-build-receipt.json` and its two-path SHA manifest.
This sensitive tooling change fixes invocation boundaries; it does not remove full package tests.

The full unoptimized contract package then passes 2,189 tests and fails the existing ordinary
claim gas benchmark. Exact-profile diagnosis measures 140,329 against its unchanged 135,000
ceiling; creation, link, decision, confirmation and the 1,409,411 lifecycle total meet their
budgets. All opted-in voucher tests pass, including the configured acknowledgment gas bound.
`contracts-final-checkpoint-gas-red.*` and `core/gas-benchmark-diagnostic.*` retain the failed run
and step measurements. Historical optimized artifacts are not used to invent a baseline delta.
The bounded repair uses an empty-or-one typed receipt container, allocating and validating only
for authoritative earned bindings or Voucher service terms. Its presence predicate is owned by
the voucher library; callers cannot supply a guard-skip flag. A zero-consideration early return
preserves the priced-offer predicate, and extracting the existing Garden recipient invariant
preserves error order while meeting the unchanged complexity limit. No opaque pointer or new
assembly remains. Final claim cost is **134,797 < 135,000**; lifecycle is **1,403,879 < 1,540,000**.
All 140 targeted cases and package format/lint pass (zero errors, 286 existing warnings), including
the combined earned/payment opt-in case requiring both guards and recording both receipts.
`core/gas-proof-receipt.json` retains exact commands, hashes, superseded experiments and the
uncompleted disposable baseline diagnostic, which establishes no baseline comparison.

The global source-structure check caught a rehearsal helper exported only within its own file.
Removing that export passes structure proof and all 11 affected rehearsal cases. Six existing
cases from small new files are consolidated by subject: the four affected files pass 34/34,
retain every assertion and pass full source/test typechecks. The obsolete v2-only file is removed;
its historical RED snapshots remain. No test-quality exception or extra filler case is added.
The adaptive build test now declares its actual child-process command subject; all six cases
pass again. The only copy repair changes the prior-setup label's em dash to a colon in en/es/pt,
preserving the unrelated Portuguese edit. Earlier failures remain recorded. All eight selected
global components now pass across fresh commands: staged boundaries, source structure, design,
ontology, supply chain (34 hubs/69 harness tests), story quality, Storybook and em-dash checks.
See `selected-globals.*`, `final-supply-chain.*` and `final-story-style.*`; their earlier failed
files remain separately identifiable. No aggregate 24-check pass is claimed.

Final rendered style proof is **Brave, Storybook**, separate from the stateful mock-auth walk.
The fresh static build renders the frozen 3/10, 40/60 fixture and separate leg/acknowledgment
observations; both acknowledgment headings compute to 12px/500 with `text-xs font-medium`.
`voucher-final-style-storybook.png`, `browser-final-style-storybook.txt` and `browser-proof.json`
record this exact class and final label punctuation. The task tab and loopback static server are
closed. Static mock handlers establish no signing, token movement or authenticated member proof.

### Final critical and conditional proof, 22 October UTC

The final selector passes **6/6 fresh**, zero reused/unrun and zero changed inputs, from
**04:03:56 to 04:22:34 UTC**. It retains all four mandatory contract overrides: ABI artifacts,
source build, full package and production verifier, plus format/lint. Each package/verifier test
phase passes **2,191 Solidity, three production G$ gas fixtures, 31 CLI and 331 script tests**.
The verifier also performs its full explicit build and static lint. The original 24-check scope
is covered by the separately identified fresh consumer, harness, global and final critical runs;
there was no single aggregate 24-check pass. Earlier failed commands remain recorded.

`critical-recheck-command.json`, `critical-recheck-plan.json`, `critical-recheck.json` and
`critical-recheck.log` retain the complete argument vector, `selectedBy` reasons, all 140 input
hashes and observed results under the current evidence directory. `final-selector-plan.json`
retains the full original selection. The observed critical component commands are `bun run build`
and `bun run test` from `packages/contracts`, and
`./scripts/contracts/verify-production.sh --skip-e2e --skip-dry-run` from the repository root.
They use the existing no-env PATH shim, `FOUNDRY_OFFLINE=true`, `TURBO_FORCE=true`,
`VITEST_MAX_WORKERS=1` and `FOUNDRY_EXTRA_OUTPUT='["storageLayout"]'`, with no global profile
override. Solidity is 0.8.28/Cancun: test uses IR without optimization and 1,000 fuzz runs;
production sizes/G$ boundaries use IR/optimizer runs 1; fork uses IR/default optimizer runs 200
and 32 fuzz runs. No profile, ceiling, assertion, timeout, dependency or permission was weakened.

Fresh final conditionals pass **04:02:00–04:03:56 UTC**, with zero source mismatches:

- `bun --no-env-file run --cwd packages/contracts check:sizes`
- `bun --no-env-file run --cwd packages/contracts check:storage-layout`
- `FOUNDRY_PROFILE=fork GNOSIS_RPC_URL=http://127.0.0.1:18545 bun --no-env-file run --cwd packages/contracts test --suite solidity --profile match 'test/fork/GnosisVoucher*.t.sol' --threads 1 -vvv`
- `FOUNDRY_PROFILE=fork CELO_RPC_URL=http://127.0.0.1:18546 bun --no-env-file run --cwd packages/contracts test --suite solidity --profile match 'test/fork/Celo{PersonalServiceDeposit,GardenRolesPermission}.t.sol' --threads 1 -vvv`

These share the no-env PATH, offline and storage-layout settings above. All production sizes,
16 protected linear layouts and eight namespaces pass. Gnosis is **41/41** at chain 100/block
48,848,261; Celo is **12/12** at chain 42,220/block 75,178,393, with the exact block hashes above.
`final-conditional-proof.json` retains commands, times, hashes and limits. The final execution
uses the approved app's actual cached pinned responses, not synthetic state or live DON delivery.
The read-only relays were stopped after proof; no task server or browser tab remains open.

The bounded local safeguards reconciliation is complete. New work remains unstaged/uncommitted
on `feature/cosmo-local-contracts` at the human checkpoint; it has no commit-attributed receipt.
Next is the bounded member-account/signing and issuer-readiness proof: COM-46 terms, capacity,
approval and signer identities, plus decisions on broader issuer identity/caps/suspension.
Safe/timelock, audit, testnet, rollback and human release gates remain open. No funded live v1
migration, full voucher lifecycle completion, external activation or unrelated lane unblock is claimed.

Plan closeout passes **2/2 fresh** at **04:27:11–04:27:44 UTC**: scoped format and supply chain,
including guidance links, immutable reports, test quality, all 34 hubs and 69 harness tests.
The recorder's first expanded-JSON formatting failure is retained as
`plan-closeout-validation-format-red.*`; formatting only the owning `status.json` repairs it.
`plan-tdd-closeout.json` proves the unrelated lanes, Linear metadata and overall backlog state
were preserved. Final state confirms the same branch/HEAD, empty index and zero non-plan source
changes after the frozen critical proof. Preparation chat confirms continued prompt/diagram
alignment. No live account, capacity, issuer-governance or release gate is cleared by this closeout.

The preparation chat's visual review confirms the same flow and no newer human conflict. Its
fictional 3-of-10 service units / 40-release / 60-refund example is not a conversion rule. It
distinguishes accepted source promise, destination activation, authorized financial return and
service fulfillment, and has made no checkout/index or tracker changes.

**Accepted continuation, 2026-10-21 23:42 UTC:** the user adopted the current develop requirements
for escrow before promise activation, consent enforced before core acceptance, and one immutable
final delivered/refundable split. Preserve the cross-garden personal G$ route on Celo. Reconcile
affected voucher contracts, APIs, projections and member controls in a separate reviewable change.
No new architecture approval is needed for those requirements.

At the accepted decision boundary, the signed checkpoint had gaps against the newer decision.
Its passing tests and rendered incremental-release walk did not establish compliance with the new
requirements. PRD-1317/1318 and the full lifecycle remain incomplete. The earlier earned-only
no-core-upgrade choice does not prohibit the narrow core integration now explicitly required to
enforce voucher consent. Ordinary non-voucher promises and legacy defaults must retain their behavior.

## Historical checkpoint and ownership barrier (resolved)

At 23:42 UTC, `feature/cosmo-local-contracts` HEAD was signed validator commit
`a19a0b0d46996a269c840592764a798c69234ffd`. The exact **71-path contract/handoff checkpoint**
remained staged for the user's terminal-signed commit. Contract working files matched that index.
Do not overwrite or restage it, silently rewrite a signed commit, or mix later reconciliation
edits into it. The no-stash lint-staged adapter restages whole formatted files, so edits to staged
paths must wait until the checkpoint is committed. Independent read-only design and unaffected
personal G$ integration can proceed. Check actual HEAD/index again before crossing that boundary.

The checkpoint's detailed source manifest, historical tests and limits remain in
[the contract execution record](codex-service-access-execution.md). The
[local integration record](codex-service-access-integration.md) retains the earlier selected API
and proof. Neither document's older completion wording certifies this subsequent reconciliation.

## Required behavior

1. **Consent at acceptance:** before either direct `claimCommitment` or approval-gated `acceptClaim`
   accepts a voucher-bearing promise, enforce the exact canonical revision and participant consent.
   The current earned module's rejection only at `prepareDistribution` is insufficient. Prove both
   direct-call bypasses, terms-update races, issuer/garden isolation and unchanged non-voucher paths.
   Keep existing recognition and actual confirmation provenance authoritative.
2. **Escrow before activation:** bind Gnosis escrow/deposit evidence to holder/presenter, pending
   offer or promise identity, exact revision/terms, asset and quantities before assigning that
   presenter as an accepted counterparty. A prepared pending identifier may precede deposit;
   accepted/active service cannot imply funded vouchers without authenticated proof. Define actors,
   finality and deadline/clock rules. Idempotent activation and authenticated setup cancellation,
   expiry and refund must converge across delayed/reordered activation and abort. Timeout is unknown.
   Setup refund prevents activation; activation prevents setup-abort refund while preserving normal
   authorized service remedies.
3. **One final settlement:** explicit holder approval freezes one full discharge, full return or
   final partial split before irreversible transfers. Bind decision identity, escrow, amounts and
   recipients; delivered and refundable voucher allocations sum to presented units. Service units
   remain distinct from voucher units. Shared progress and per-leg accounting settle each allocation
   once across retries, replay, reordering and partial transfer failure. Conflicting decisions cannot
   replace the frozen decision or spend another escrow's balance. Ongoing delivery evidence may be
   recorded without changing the final split. Generic `Fulfilled` does not replace holder approval.
4. **Preserved boundaries:** discharged units return to the issuer reserve for reuse; remedy units
   return to the holder. No implicit burn, mixed checkout or G$ to voucher conversion. Personal G$
   custody, typed steward attestations and exclusive payout/refund remain independent.

Gardener issuer identity, supply-cap enforcement and independent steward-controlled issuer
suspension remain unresolved broader design/release requirements. This continuation selects no
mechanism for them. A distribution allowance or owner pause does not prove those requirements.
COM-46 terms, real capacity and identities, Gnosis account signing, Safe custody, live transport,
audit, timelock, testnet, rollback and human release gates remain unchanged.

## Evidence and chronology

New remote `origin/develop` at `b738ad1731b556e56518276e57fcb5a7528f8c90` includes
[PR #1170](https://github.com/greenpill-dev-guild/green-goods/pull/1170), merged as
`7f952491cb506f62aa4507d462c3217ebd44b913`. Its immutable spec and voucher-direction handoff
record approved criteria added after the earlier broad voucher direction. The prompt-preparation
session investigated those records and received the user's explicit adoption of the three
requirements above. Recorded application/read-back times are evidence of record updates, not
independently recovered timestamps of every human approval.

That session's read-only live check reports PRD-1315 **In Review**, updated 23:11:16 UTC;
PRD-1317/1318 remain **Backlog**, updated 23:00:27/34 UTC. No tracker change was made by this task.
The newer upstream docs have not been merged or rebased into this checkout. The current checkpoint
regression explicitly pins its original `4a6b2f2e519b3e4cc675ed7bd738ab12b18bd4a2` comparison base;
it does not claim the branch is current with develop.

Three read-only design lanes now cover acceptance enforcement, activation/abort convergence and
final split settlement. Record exact selected API, storage, events, authority and recovery before
runtime edits. Retain meaningful RED/GREEN and all contract/storage/size/fork/consumer overrides.
Downstream affected voucher runtime follows the reconciled contract; do not relabel the current
incremental-release UI as compliant. Mock-auth browser evidence remains a public-file fixture with
simulated observations, no actual signatures, service activation or fund transfers.

## Selected acceptance boundary, before implementation

The selected change puts one typed voucher guard in `CommitmentPoolingAcceptanceLib.acceptCommitment`,
before registry calls, confirmer normalization and accepted-state mutation. Place it outside
`enforceClaimAuthority`: exchange deliberately skips that authority branch but accepts both legs
through the same function. Existing membership, requested-by, lead-provider, recognition and
confirmation rules retain their owners. No voucher opt-in means no new external guard call.

Add `ICommitmentVoucherAcceptance`, leaving `ICommitmentPoolingModule`, old tuples and old event
selectors unchanged:

```solidity
struct EarnedVoucherBinding {
    address module;
    uint64 revision;
    bytes32 termsHash;
    uint64 acceptedRevision;
    bytes32 acceptedTermsHash;
    address acceptedCounterparty;
}
struct VoucherServiceAcceptance {
    address setupModule;
    bytes32 claimHash;
    uint64 termsRevision;
    uint64 requestNonce;
    bytes32 setupId;
    bytes32 authorizationHash;
    bytes32 depositReceiptHash;
}
function voucherAcceptanceProtocolVersion() external pure returns (uint16);
function pinEarnedVoucherModule(address module) external;
function pinVoucherServiceSetupModule(address module) external;
function voucherServiceSetupModule() external view returns (address);
function bindEarnedVoucherTerms(uint256 commitmentId, uint64 revision, bytes32 termsHash) external;
function getEarnedVoucherBinding(uint256 commitmentId) external view returns (EarnedVoucherBinding memory);
function getVoucherServiceAcceptance(uint256 commitmentId) external view returns (VoucherServiceAcceptance memory);
```

Each named peer is pinned once by the existing core owner while paused. Require nonzero deployed
code, the exact configured core and supported protocol version. There is no per-commitment owner
bypass, arbitrary callback selector, repin or clear path. Any later rotation requires an explicitly
reviewed core upgrade preserving accepted snapshots. Pinning is a privileged trust decision;
it does not establish issuer capacity or honesty. New voucher registration/setup rejects without
its pinned peer. Local tests use labeled stand-ins, not live configuration changes.

The setup module checks `voucherServiceSetupModule()` before preparing a setup. This scalar view
proves the core pinned that exact peer without adding another authority or changing the existing
commitment tuples.

`VoucherEntitlementModule.registerTerms` must atomically call `bindEarnedVoucherTerms` after its
existing garden authority and issuer/asset checks. Core requires the pinned module, pre-acceptance
state, the next sequential revision and a nonzero hash; failure rolls back both sides. Registration
remains distinct from the responsible issuer's approval. Creator consent freezes the approved
revision; the actual resolved counterparty separately consents to it.

The earned guard calls only this named view through `STATICCALL`:

```solidity
function validateEarnedVoucherAcceptance(
    uint256 commitmentId,
    uint64 expectedRevision,
    bytes32 expectedTermsHash,
    address creator,
    address counterparty
) external view returns (bytes4 magic);
```

Require the caller to be the exact configured core. Verify the current source terms match the core
binding, issuer approval and freeze are present, and creator and actual counterparty consent to
that revision. A GardenAccount claim requires that account's consent; its steward's EOA consent
does not substitute. Core records accepted revision/hash/counterparty atomically. Distribution
later requires that accepted fact alongside legitimate core `Fulfilled`, the source terms and
canonical recognition. Legacy accepted promises acquire no implicit entitlement.

For exchange, A requires A.creator's creator consent and B.creator's explicit consent to A;
B requires the converse. Creating a counteroffer or accepting an exchange is not substitute
voucher consent. Failure on either leg rolls back both. Service offers retain their exchange ban.
No new issuer-reserve/lead-provider or contributor restriction is selected in this reconciliation.

Use the new independent ERC-7201 namespace `green.goods.commitment.voucher-acceptance.v1`, slot
`0x2a0cd18ddd2b7d150ef77dca59e4be43f0f695a2fe45d7eb95c5e91d734cdf00`:

```solidity
struct State {
    address earnedVoucherModule;
    address voucherServiceSetupModule;
    mapping(uint256 => EarnedVoucherBinding) earned;
    mapping(uint256 => VoucherServiceAcceptance) acceptedService;
}
```

Internal-only helpers compose through existing deployed Claims/Terms/Views behavior libraries;
do not add a deployed linker merely to expose this guard. Additive events are
`EarnedVoucherModulePinned`, `VoucherServiceSetupModulePinned`, `EarnedVoucherTermsBound`,
`EarnedVoucherAcceptanceRecorded` and `VoucherServiceAcceptanceRecorded`. Their accepted records
must carry exact revision/hash/claim/setup proof identifiers. Frozen linear storage and the
existing service namespace stay unchanged. Migration proof must reject silently unbound pending
old source terms; no live voucher deployment or populated upgrade migration is claimed here.

## Selected pre-acceptance setup protocol, before implementation

Use the existing source coordinator and Gnosis escrow with a distinct v2 setup wire domain.
Do not change the personal G$ protocol/version. One setup belongs to one exact pending claim:

```solidity
setupId = keccak256(abi.encode(
    SETUP_DOMAIN_V2, sourceChainId, sourceModule, coreModule,
    commitmentId, termsRevision, claimHash, requestNonce
));
```

`setupOfClaim[commitmentId][claimHash]` is immutable. A renewed claim nonce produces a different
setup; its predecessor may still owe its original holder a refund. Retries preserve the full
authorization, including its acceptance deadline. The source buyer prepares from authoritative
pending-consent/Offered views; the named Gnosis holder approves and presents against the exact
authorization hash. The issuer separately approves that authorization. Deposit does not itself
accept a promise.

The exact authorization tuple is:

```solidity
struct SetupAuthorization {
    uint8 version;
    uint256 sourceChainId;
    address sourceModule;
    address coreModule;
    uint256 commitmentId;
    uint64 termsRevision;
    bytes32 termsHash;
    bytes32 claimHash;
    uint64 requestNonce;
    address buyer;
    address holder;
    address buyerGarden;
    address providerGarden;
    uint256 destinationChainId;
    address destinationEscrow;
    address issuer;
    address token;
    uint256 voucherUnits;
    uint256 serviceUnits;
    bytes32 unitLabelHash;
    bytes32 serviceTermsRef;
    bytes32 remedyTermsRef;
    uint64 acceptanceDeadline;
    uint8 remedyPolicy;
}
```

Version is 2. The deadline is a source Arbitrum-clock acceptance cutoff chosen in setup and
explicitly disclosed to the approving holder; do not imply it was already a field of core terms.
Acceptance allows equality; expiry requires a strictly later source time and selection of Abort.
Gnosis never refunds from its local clock, a late acknowledgment or an inferred service outcome.

The exact service readiness view is called only by core:

```solidity
function validateVoucherServiceAcceptance(
    uint256 commitmentId, address buyer, uint64 revision, bytes32 termsHash,
    bytes32 claimHash, uint64 requestNonce, address holder
) external view returns (
    bytes32 setupId, bytes32 authorizationHash, bytes32 depositReceiptHash
);
```

Require exact consent, canonical terms, the authenticated full deposit with issuer approval,
no Abort and an unexpired source deadline. The shared guard receives authoritative validated
core consent. Keep all existing local consent/terms/membership validation, then move both
`acceptedConsent` assignment and pending-claim deletion until after `AcceptanceLib` returns.
The guard reads current `claimConsent` and terms while the exact pending claim is active and
core remains Offered. Source readiness reads those ordinary views, never accepted-service terms
during acceptance. Store the permanent setup receipt after ordinary accepted/provider/roster
mutations, with no external call afterward. The caller then records accepted consent, deletes
pending and emits its consent event. The non-reentrant transaction is atomic: any rejection
restores every prior core/pending/namespace fact. No mutating consume callback or token/transport
operation runs inside acceptance.
Reverting, malformed or wrong-version peer reads fail closed for that voucher opt-in.

Successful exact `transferFrom(holder, escrow, voucherUnits)` creates the destination receipt:

```solidity
depositReceiptHash = keccak256(abi.encode(
    DEPOSIT_DOMAIN_V2, destinationChainId, destinationEscrow,
    setupId, authorizationHash, holder, token, voucherUnits, uint64(1)
));
```

The hash is computable beforehand; it is not proof on its own. Source readiness requires an
authenticated Gnosis result reporting the stored successful deposit. Neither ambient balance,
a supplied transaction hash nor a personal G$ steward attestation substitutes for it.

Use independent monotonic setup facts: decision `None/Activate/Abort`, destination phase
`None/Authorized/Deposited/Active/AbortRefundPending/Aborted`, and setup action
`None/Deposit/AbortRefund`. Core's permanent exact `VoucherServiceAcceptance` is the single-use
activation choice:

- Abort selected first makes readiness reject acceptance.
- Exact core acceptance first permanently prevents setup Abort, including after cancellation,
  expiry, dispute or fulfillment and before the source activation outbox has been materialized.
- Permissionless `finalizeActivation` later derives immutable Activate from that accepted fact.
  A later deadline or lifecycle change cannot retroactively undo acceptance.
- Acceptance of another claim/nonce does not strand an older setup refund. Compare exact tuples.

Source `abortSetup` allows the buyer, anyone demonstrating invalidity/source-clock expiry, or an
authenticated named-holder abort request, only if that exact accepted tuple is absent. Destination
holder abort remains pending until the source orders it against acceptance. Destination refunds
only from authenticated source Abort. Store Abort before attempting its fixed full refund; a
failed refund stays retryable and activation remains forbidden. Abort before Authorization creates
a tombstone, so late authorization or presentation cannot resurrect the setup. Setup refund is
financial return, not a service-delivery approval.

Source APIs are `prepareVoucherSetup(commitmentId,expectedRevision,expectedTermsHash,expectedClaimHash,
expectedRequestNonce,acceptanceDeadline)`, `abortSetup`, `finalizeActivation`, command quote/dispatch,
and setup/authorization views. Destination APIs are exact issuer `approveSetupAuthorization`,
holder `presentSetup` and `requestSetupAbort`, permissionless `retrySetupAction`, acknowledgment
quote/retry and execution views. Economic identities/hash parameters are immutable across retries.
Authenticate router, source selector, peer, protocol and payload; reject attached tokens and
conflicting transport or sequence reuse. Typed Authorization, Decision, Result and HolderAbortRequest
messages have distinct kinds. Decision identifiers hash the complete command; later final
allocation binds the activation decision. Failed acknowledgments retain durable destination
results and retry independently. Sending an acknowledgment does not prove source receipt.

The v2 Decision envelope includes the complete immutable `SetupAuthorization` alongside the
`SetupDecisionCommand`. This allows an authenticated Abort to create its tombstone before the
Authorization transport arrives. Both records must agree on setup identity and authorization hash.
The fixed wire sizes are Authorization 800 bytes, Decision 1,024 bytes, SetupResult 448 bytes,
HolderAbortRequest 160 bytes and FinalResult 544 bytes, each including its distinct kind word.

The selected setup wire records use these field orders:

```solidity
enum SetupDecision { None, Activate, Abort }
enum SetupPhase { None, Authorized, Deposited, Active, AbortRefundPending, Aborted }
enum AbortReason { None, BuyerRequest, HolderRequest, ClaimInvalid, Deadline }
struct SetupDecisionCommand {
    uint8 version;
    bytes32 setupId;
    bytes32 authorizationHash;
    SetupDecision decision;
    bytes32 expectedDepositReceiptHash;
    bytes32 coreAcceptanceHash;
    AbortReason abortReason;
}
struct SetupResult {
    uint8 version;
    bytes32 setupId;
    bytes32 authorizationHash;
    uint64 resultSequence;
    SetupPhase phase;
    SetupDecision decision;
    bool issuerApproved;
    bytes32 depositReceiptHash;
    uint256 depositedUnits;
    uint256 setupRefundedUnits;
    bytes32 appliedDecisionId;
    bool actionSucceeded;
    bytes32 failureHash;
}
```

Activation requires its exact successful receipt and nonzero core acceptance hash. Abort has no
core acceptance hash and returns any durable local deposit even if the source has not yet received
its deposit acknowledgment. A missing source receipt cannot erase a real escrow liability.
Only the exact authenticated source Abort certificate, not the missing acknowledgment, authorizes
that return. Test deposit success → lost acknowledgment → source Abort → exact refund, and the
late deposit result after the refund result. Setup and final-result message kinds retain their
own authenticated sequence/hash reconciliation; neither lane may overwrite the other's facts.

Use separate `green.goods.voucher.service-setup.source.v2` and
`green.goods.voucher.service-setup.destination.v2` namespaces. Preserve the old storage layout,
including nested v1 result and acknowledgment fields; append new mappings in independent storage.
Source stores immutable authorization/decision bytes, setup-of-claim, latest authenticated
sequence/hash and transport replay records. Destination stores authorization, durable deposit,
fixed decision, action failure/retry and separate acknowledgment status. Events must expose the
full typed authorization and authenticated result, setup decision/dispatch, destination deposit,
holder abort request, applied decision, action result and acknowledgment success/failure.

Source keeps latest setup/final results and separate per-setup sequence-to-hash histories after
the five selected setup/outbox/replay mappings. A reused sequence with different data rejects even
when stale; the setup and final lanes cannot overwrite each other. Deposited, Active and Aborted
results require successful action status. AbortRefundPending requires a full outstanding deposit
and a stored failure. Authorized may report either authorization progress or a failed deposit.

Transport finality remains a CCIP/release assumption requiring separate evidence. Reserve
allowance, holder deposit allowance, outstanding service obligations, available capacity, escrow
liabilities, token supply and native transport fees remain distinct. No timeout issues replacement
value or proves service delivery.

## Selected final allocation and leg API, before implementation

Replace v2 incremental releases with one final allocation frozen before either outgoing leg.
The holder approves the delivered service quantity and full financial split explicitly:

```solidity
enum FinalLeg { ReleaseToIssuer, RefundToHolder }
enum LegState { NotRequired, Pending, Failed, Succeeded }
struct FinalAllocation {
    uint256 approvedDeliveredServiceUnits;
    uint256 releaseVoucherUnits;
    uint256 refundVoucherUnits;
}
struct LegProgress {
    LegState state;
    uint64 attempts;
    bytes32 failureHash;
}
struct FinalAllocationRecord {
    bytes32 decisionId;
    bytes32 activationDecisionId;
    uint256 issuerReturnApprovalAtFreeze;
    FinalAllocation allocation;
    LegProgress release;
    LegProgress refund;
}
function finalizeAllocation(
    bytes32 setupId, bytes32 expectedPayloadHash, FinalAllocation calldata allocation
) external returns (bytes32 decisionId);
function executeFinalLeg(bytes32 setupId, bytes32 expectedDecisionId, FinalLeg leg) external;
function getFinalAllocation(bytes32 setupId) external view returns (FinalAllocationRecord memory);
```

Only the bound Gnosis holder freezes a decision, after exact payload verification, full durable
deposit and destination Active under the source activation decision. Freeze makes no token call.
For deposited voucher total E, require release <= E and refund == E - release. Approved service
units cannot exceed the canonical total; a positive release requires positive explicit approval
of delivered service units. Refund fits the issuer's existing mutual-remedy ceiling; snapshot that
ceiling at freeze. Service and voucher units have no inferred conversion rate. The fictional
partial case approves 3 of 10 lessons, releases 40 vouchers and refunds 60.

Derive decision identity internally from the v2 domain, destination chain/escrow, setup,
authorization hash, activation decision, three allocation quantities and snapshotted remedy
ceiling. Derive each leg identity from that decision, leg kind, token, fixed recipient and amount.
Release always goes to the bound issuer reserve; refund always goes to the bound holder. Exact
repeat freezes return the original decision without transfers, including if the current remedy
ceiling has since changed. Conflicting allocations permanently reject, including after a leg
succeeds. Existing service evidence cannot revise the frozen financial split.

Anyone may execute or retry either stored leg. A nonzero leg starts Pending; a zero leg is
NotRequired and performs no token call. Isolate each transfer and its successful state/liability
consumption in a reverting self-call, then store caught failure outside it. Check exact token
balance deltas. A partial/inexact transfer rolls back that whole leg; an earlier successful other
leg stays successful. Either order works, one failure cannot block the other, and a successful
leg cannot transfer twice. Pause blocks economic execution with visible recoverable state;
reads and acknowledgment repair remain available.

Financial closure requires a nonzero frozen decision and both legs Succeeded or NotRequired.
It never sets core Fulfilled, proves non-delivery or infers beneficiary confirmation. Setup Abort
is a separate full-return branch before activation, with no holder-delivery event.

Maintain one shared per-token unspent custody-liability ledger across setup deposits, setup-abort
refunds and final legs. Exact deposit increases it; only a successful authorized outgoing leg
decreases it. Before outgoing transfer, require actual token balance to cover outstanding
liabilities, so an unexpected deficit cannot let one setup spend another setup's backing. This is
custody accounting, not an inventory, service-capacity, global supply or delegated allowance cap.
Choose one storage owner for this ledger; do not duplicate it in setup and final-settlement code.

The cumulative v2 final result has this exact order:

```solidity
struct FinalResultV2 {
    uint8 protocolVersion;
    bytes32 setupId;
    bytes32 payloadHash;
    uint64 sequence;
    bytes32 activationDecisionId;
    bytes32 decisionId;
    uint256 issuerReturnApprovalAtFreeze;
    FinalAllocation allocation;
    LegProgress release;
    LegProgress refund;
}
```

Authenticate transport/chain/peer/version and reject attached tokens and malformed data. Source
validates against its exact accepted-ever core receipt and canonical Activate decision, accepting
final results before an older activation acknowledgment. Same sequence/different bytes rejects;
old sequences cannot overwrite newer facts. New sequences cannot revise the tuple, reduce
attempt counts, downgrade a successful leg or reopen closure. Acknowledgment retries resend stored
facts without executing either leg. Late acknowledgments stay pending/unknown, with no replacement
value. Source and destination evidence remain distinguishable.

Add `FinalAllocationFrozen` with setup/decision/holder, payload, activation and all approved
quantities/ceiling; `FinalLegResult` with setup/decision/leg identity, fixed recipient/units and
progress/failure; and `VoucherEscrowFinanciallyClosed` with exact setup/decision. Add separate v2
final-allocation mapping and the single custody-liability mapping in independent storage. Do not
enlarge v1 `Codec.Result` nested inside `Execution` or source records: following acknowledgment
fields would shift. Old local v1 state is not automatically migrated or recertified.

## Implementation and proof sequence

This is the preserved dispatch sequence. The bounded implementation and local proof above are
complete; broader lane and live prerequisites remain open.

1. After the human checkpoint commit, freeze the exact selected API and implement meaningful RED
   cases for direct core bypass/races, setup ordering/recovery and immutable final allocation.
   Keep contract owners disjoint and compose the agreed consent ordering before parallel edits.
2. Implement the guarded core, source setup and destination custody/final legs in dependency order.
   Regenerate interfaces/ABIs and compare compiled storage/bytecode size before downstream changes.
3. Migrate Indexer to project setup/activation, immutable allocation and independent leg progress,
   with separate source acknowledgments and chain-qualified identities. Preserve confirmation path.
4. Migrate Shared and member v2 flow to exact request → finite escrow → authenticated deposit →
   guarded acceptance → destination activation → service evidence → final review/freeze → fixed-leg
   progress/retry. After freeze, amounts are read-only. Replace the fictional incremental 20+20+60
   walk with one 40/60 final decision approving three lessons. Keep live actions disabled.
5. Run real-core integration and pinned GiftableToken forks for the new behavior, every selected
   critical override, storage/size/ABI/consumer checks and labeled rendered proof. Record working-tree
   identities separately from signed commit receipts and retain all prior failures.

New RED/GREEN must cover direct Open/ApprovalGated acceptance without exact creator/counterparty/
issuer consent, old revisions, GardenAccount consent, atomic registration/acceptance race, each
exchange leg and complete rollback; malformed/paused peers; readiness pre-state visibility;
Abort-first/Accept-first, expiry equality, delayed finalization, all later core terminal/dispute
states, old-claim refund after a different claim wins, Abort before Authorization, late/reordered
deposit/activation/final results and lost acknowledgments; full and partial final conservation,
freeze-without-transfer, exact repeats/conflicts, both leg orders, one-leg failure/repair, inexact
transfer rollback, pause between legs, cross-setup isolation and custody deficit; unchanged legacy
commitments, personal G$ deposit/payout/refund and actual confirmation provenance.

## Historical checkpoint proof continuation

The broad checkpoint beginning 23:41:57 UTC passed format, lint, 399 harness tests, ABI artifacts,
Shared source/test typechecks and all 7,466 Shared tests (16 existing skips), then failed Client
test typecheck. Its personal-payment fixture omitted the newly required terms revision/hash.
The bounded test-only repair adds those exact canonical offer values; Client test typecheck now
passes. The corrected scoped contract/global checkpoint now passes 12/12 fresh; the earlier
failed 24-check run is not relabeled as an aggregate pass. Logs and source manifests are retained under the task's local temporary evidence
directory. None of this old-boundary proof certifies the new voucher requirements.

The diagnostic continuation passed Client 67/67, Admin 1,307/1,307, Agent typecheck/tests,
Indexer 31 selected cases and contract build, then stopped at a matched fork fixture without
`CELO_RPC_URL`. Its `--only` compatibility invocation selected diagnose intent and narrowed
contract proof, including two TypeScript script paths with no Solidity tests. Retain this
command failure; it establishes neither full contract coverage nor a conformance regression.
The corrected contract checkpoint explicitly selects `--intent checkpoint` and retains all four
mandatory critical checks, with full package tests/production verifier plus the remaining global
guardrails. No selector or runner code was changed for this command correction. Separate fresh
full Indexer proof now passes **350 tests, one existing optional pending**. Client source and
test typechecks both pass; Agent's selected test command passes 218 tests.

The final scoped checkpoint ran from **2026-10-21 23:58:14 UTC to 2026-10-22 00:12:02 UTC**:
**12 fresh passes, zero reused, zero unrun, zero source mismatches**. Its four mandatory contract
overrides are ABI artifacts, source build, the full package and production verifier. Both test
phases pass 2,119 Solidity tests, three production G$ gas fixtures, 31 CLI tests and 322 script
tests. The eight remaining checks pass: staged boundaries, source structure, design guardrails,
ontology, supply chain, story quality, Storybook build and em-dash checks. Supply chain includes
all 34 plan hubs and 69 harness tests. Existing warnings remain recorded in the output; no lint,
size, permission or release rule was weakened.

Sensitive configuration change: `scripts/data/validation-policy.json` adds only
`packages/shared/src/hooks/commitment-pooling/useServiceAccess.ts` to the existing critical
mutation-hook exact list. The original drift test failed before that registration; its targeted
regression and all 399 validation-system tests pass afterward. This adds critical coverage.
The only subsequent source edit in this segment is the Client test fixture's canonical terms
revision/hash; no staged contract or handoff was edited.

Exact commands and output are retained locally:

- `integration-quick-policy-run.json` and `integration-quick-policy.log`: 130-path checkpoint,
  seven passes then Client fixture type failure; zero source mismatches.
- `client-test-typecheck-repair.log`: `bun --no-env-file run --cwd packages/client typecheck --scope tests`, exit 0.
- `client-final-source-typecheck.log`: `bun --no-env-file run --cwd packages/client typecheck --scope source`, exit 0.
- `integration-remaining-run.json` and `integration-remaining.log`: six diagnostic component
  passes, one missing-fork-environment failure and nine unrun; zero source mismatches.
- `indexer-final-full.log`: `bun --no-env-file run --cwd packages/indexer test`, exit 0,
  350 passing/one pending.
- `integration-critical-completion-run.json` and `integration-critical-completion.log`: exact
  65 contract paths, explicit checkpoint intent, four mandatory contract overrides and eight
  global checks; 12 fresh passes, zero reused/unrun, exit 0 and zero source mismatches.
  The record contains every argument and source hash.

These files are under `/private/tmp/green-goods-local-integration-20261021/`. All commands use
the existing task-local Bun no-env wrapper; critical commands set `TURBO_FORCE=true` and
`FOUNDRY_OFFLINE=true`. Optional receipt reuse is off. Fresh execution does not read cache-only
secret fingerprints. Signed validator HEAD does not attribute the staged/untracked implementation.
The final index still contains exactly 71 paths and cached patch SHA-256
`caefae72ffe67de5efe186ce18512aa257bc9a4c91bcb2f8fe72aba0f3814154` at HEAD `a19a0b0d`.
No agent commit was attempted after the user chose terminal signing. At this historical boundary,
runtime reconciliation and downstream voucher migration awaited the human checkpoint commit;
the resumed implementation and its separate evidence are recorded at the start of this handoff.

Rendered proof: Brave, **mock-auth localhost** on a public-source fixture, 390×844 viewport.
The personal G$ walk reviews exact terms and frozen local accounts, requests the fictional service,
pledges 100 TEST-G$ and records a simulated payment. It stops at “Payment observed; waiting for
steward verification,” with core still Offered and no acceptance/service activation. Body/main
widths are 390 pixels. This is no signature, actual deposit, source attestation or passkey proof.
History and unrelated public configuration requests remain unavailable in this credential-free
fixture; they are not silently reported as passing.

Portuguese mobile review was also rendered: Enter opens review, Space checks explicit consent,
Escape closes it and restores focus to the invoking button. Service controls/copy translate;
fictional user-authored service titles and unit labels retain their fixture text. Language was
restored to English and the viewport override reset. Screenshots are
`personal-awaiting-steward-context-brave.jpg`, `personal-awaiting-steward-mobile-brave.jpg` and
`personal-review-portuguese-mobile-brave.jpg` in the same local evidence directory. The task tab
is closed and its task-owned fixture server was stopped through its existing exec session.
`browser-proof.json` retains screenshot hashes and source identity: all 2,873 copied public
files still match their fixture manifest. The real checkout differs from that serving snapshot
only in the later test-fixture revision/hash repair and critical-policy hook registration;
no rendered runtime or locale source differs. No secret environment file was copied or loaded.

Future integration staging must preserve the unrelated Portuguese `isso` → `isto` edit outside
`app.serviceAccess.*`. Whole-file lint-staged auto-add would include it even after exact hunk
staging. Do not stage that file wholesale or reuse the pending-contract hook blindly for it.
Prepare a separately reviewed partial-index-preserving hook strategy before that later commit;
retain formatter, identity and signing requirements, and leave canonical hooks/config unchanged.

Task record: cosmo-local-credit-interop | Type: feature | Outcome: partial
Agent/model: Codex / unknown | Coverage: voucher-reconciliation decision and implementation continuations

| Phase | Start → end (UTC) | Result / evidence or blocker |
|---|---|---|
| Investigate | Start unknown → 2026-10-21 23:42 | New upstream criteria and decision chronology investigated; explicit human adoption received |
| Review | 2026-10-21 23:42 → 2026-10-22 00:12:28 | Selected typed guard, setup ordering and final allocation; exact staged checkpoint preserved |
| Implement | Start unknown → 2026-10-21 23:51 | Canonical revision/hash added to the Client test fixture; staged contract paths untouched |
| Verify | 2026-10-21 23:41:57 → 2026-10-22 00:12:02 | Preserved failures; fresh consumer proof and final 12/12 mandatory-contract/global checkpoint |
| Wait | 2026-10-21 23:42 → 2026-10-22 00:20:44 | Resolved: user's signed checkpoint verified; exact patch and empty index |
| Investigate | Start unknown → 2026-10-22 00:20:44 | Resume source/ownership snapshot; preparation chat confirms alignment |
| Implement | Start unknown → 2026-10-22 04:01:27 | Accepted safeguards and affected consumers implemented; final gas/lint repair frozen |
| Review | unknown → unknown | Cross-contract and final guard/hook review; no unresolved finding recorded |
| Verify | 2026-10-22 04:02:00 → 04:22:34 | Final size/storage/forks and 6/6 critical selector; consumer/global and failed-run receipts above |
| Implement | 2026-10-22 04:25:18 → 04:26:17 | Owning plan/TDD closeout; unrelated lane and tracker state preserved |
| Verify | 2026-10-22 04:27:11 → 04:27:44 | Fresh plan-only format/supply-chain 2/2 after retained JSON formatting failure |

Human corrections: 0 observed in this segment; one new scope decision; attention: unknown.
