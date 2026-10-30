# Service-access execution continuation

**Later continuation, 23:18 UTC:** Indexer projections, Shared state/actions and member journeys
are now authorized in that order, with cohesive local commits. The signed validator commit is
`a19a0b0d46996a269c840592764a798c69234ffd`; fresh post-commit QA validation passes 3/3 checks,
including all 399 harness tests. The three validated paths are clean. Contract files
still match the final 68-file manifest below and remain uncommitted pending the user's signed
commit. The [integration record](codex-service-access-integration.md) owns this next stage,
signing boundary and new evidence. The dated contract results below remain working-tree proof.

**Current outcome, 22:52 UTC:** the approved validator repair and local service-access contracts
are implemented and verified. Final package and verifier each pass 2,119 Solidity tests, three
production G$ gas fixtures, 31 CLI checks and 322 script tests. Focused service proof covers
42 core, 35 personal-funding, 34 voucher unit and five real-core voucher integration cases,
following meaningful RED assertions and the API/storage/event record made before source edits.
Final size, 16 protected layouts, five namespaces, Gnosis 39/39, Celo 12/12, ABI regeneration,
lint, source structure, ontology and supply chain pass. Forced ABI-consumer suites passed in the
broader run. Component coverage spans the eight-pass final critical run and the successful
naming-only follow-up; no single nine- or fifteen-check aggregate pass is claimed. Failed logs
and the bounded release-test, complexity and naming corrections remain recorded below.

The accepted scope is the [prepared service-access prompt](codex-service-access.md), with the
[canonical architecture](../spec.md) owning meaning. The prompt-preparation session confirmed no
newer human architecture decision or conflict, and will leave the shared plan/contracts untouched.
The current branch remains `feature/cosmo-local-contracts`, HEAD
`4a6b2f2e519b3e4cc675ed7bd738ab12b18bd4a2`; the index is empty. All work stays local and
uncommitted. Runtime, tests and ABI exports are frozen at the final working-tree manifest.
The prompt-preparation chat reconfirmed alignment at this checkpoint and leaves
the shared checkout untouched. No newer conflicting human decision was reported.

## Implemented boundary

- **Core consent:** opt-in approval-gated Individual Offers support buyers from another garden
  and the protocol pool. Exact terms revision/hash and request nonce bind request and acceptance;
  old claim, acceptance, terms and bilateral exchange paths cannot bypass that consent. Existing
  provider authority, recognition, lifecycle and legacy defaults remain authoritative.
- **Personal G$ funding:** `ISettlementPersonalServicePurchases` binds the buyer, both gardens,
  Celo asset, price, custody Safe, depositor, refund account and disclosed gross/net bounds.
  Buyer-garden stewards attest actual receipts offchain; source contracts validate the frozen
  facts and unique chain/transaction/global-log-index key. Every payout path requires exact
  consumed funding. Full payout and exact recorded-net refund are exclusive, including retries,
  batches, stale results, renewed claims and late incoming deposits. Safe earmarks remain
  accounting; Safe owners retain custody powers.
- **Voucher service use:** `VoucherRedemptionModule` authorizes an accepted voucher service
  promise; `GnosisVoucherEscrow` holds the holder's explicitly presented vouchers. Service units
  and voucher atomic units have separate counters. Explicit holder approval authorizes release
  to the bound issuer reserve; explicit mutual remedy authorization permits returns. Atomic
  action failure, durable destination results and independent authenticated acknowledgments
  preserve quantities across repair. Financial `Closed` does not fulfill the core promise,
  prove non-delivery, burn tokens or activate an external membership.
- **Compatibility:** two additive interfaces and ERC-7201 namespaces preserve old interface ABI
  bytes and linear storage. Existing public libraries own the added core/funding behavior;
  protected read forwarding keeps Settlement within EIP-170. Registry, Hats and the Celo executor
  are unchanged. New voucher endpoints reuse the unchanged community/guardian and 48-hour
  scheduled-upgrade boundary. Existing core/settlement ownership and release policy are preserved.

## Proof gaps rechecked

- **Resolved — formatting.** Formatted only `.claude/settings.json` and the PWA-simplification,
  Stripe/thirdweb-pilot and Green Goods OS status JSON files. Every parsed JSON value is identical
  before/after, including all settings, states and blockers. Exact original bytes are backed up in
  `/private/tmp/green-goods-service-access-20261021/format-backup/`; before/after hashes and equality
  checks are in `format-only-manifest.json`. This is a sensitive settings-file whitespace change,
  not a permissions or policy change. Existing edits were preserved.
- **Resolved — pinned Gnosis proof.** The user enabled Gnosis on the Green Goods Alchemy app.
  Fresh RPC returned chain 100 and block 48,848,261 (`0x2e95d85`), hash
  `0x03be75732ad238a0c04d6044a42d2fd7baec4b48f89afed9670886ca0477b60d`.
  All eight CLC runtime hashes and WXDAI match the existing pin. The connector truncates large
  `eth_getCode` responses, so read-only creation-context `eth_call` with `EXTCODECOPY` retrieved
  complete 3,000-byte chunks. No implementation source, credential or broadcast was involved.
  Historical `eth_getProof` is unsupported; no Merkle proof is claimed. Raw responses, chunks
  and hashes are in `gnosis-fresh-rpc.json`, `gnosis-codechunks.json`, `gnosis-runtime-hashes.json`.
  The fresh fork rerun passed **31/31** (22 purchase, nine reserve, 32 fuzz runs). Its temporary
  loopback relay admitted only read methods at the pinned block and retained actual Alchemy
  responses. Foundry's existing pinned-state cache also remained in use. This is distinct from
  the earlier synthetic replay. The first run passed nine reserve cases but timed out in purchase
  setup waiting for relay responses; its failed exit is preserved. With the relay serviced,
  unchanged tests passed. The relay has been stopped. Transport remains mocked and local Safe
  stand-ins do not prove member signing or live CLC/CCIP operation.
- **Fixed — unconditional validator fingerprint.** After user approval, `executePlan` now computes
  the ignored-configuration digest only when receipt reuse is both requested and allowed. Fresh
  checks execute normally with no reusable receipt inputs or store entry. Reuse still requires
  complete configuration and fails closed if it cannot be read. No denied secret read, substitute
  real-run fingerprint, permission change or check suppression is needed. Unit tests use explicit
  fictional configuration; the hashing test reads only its own temporary fixtures. The selected
  broader test suite exposed a separate Node-version test launching the real doctor in the real
  checkout; its test-only fix executes identical doctor source with public pins in a temporary
  workspace. Production doctor behavior and environment-readiness obligations remain unchanged.
- **Baseline checked through GitHub.** `git fetch origin develop` first failed on read-only
  `.git/FETCH_HEAD`, then the authorized fetch attempt failed through the SOCKS connection. The
  connected GitHub comparison of HEAD against `develop` returned `identical`, zero commits ahead
  or behind and no files. This is fresh remote API evidence, not a successful command-line fetch.

At the original proof-gap closure, all four purchase and nine earned-voucher files matched the
prior manifests. The later source-structure correction below extracts only the earned module's
unchanged allocation function: final inventory is twelve byte-identical files and one documented
extraction, with compiled ABI/storage equality. Prior receipts retain their dates and limitations;
they are not new service-access or commit-attributed proof. See
[purchase evidence](codex-contracts-purchases.md) and [earned evidence](codex-contracts.md).

## Available validation observed

Evidence directory: `/private/tmp/green-goods-service-access-20261021/`.

| Command / boundary | Observed result |
|---|---|
| Installed Biome `format --stdin-file-path <path>` for the four named JSON files; compare parsed values before writing | Exit 0 for all four; JSON equality true; exact backups retained |
| `./node_modules/.bin/biome format .` | Exit 0; 3,959 files checked, no fixes applied |
| `node scripts/dev/ci-local.js --plan --json --intent qa --changed .claude/settings.json,.plans/backlog/pwa-interface-simplification/status.json,.plans/backlog/stripe-thirdweb-endowment-pilot/status.json,.plans/ideas/green-goods-os/status.json` | Exit 0; sensitive; format and review-guardrails-test selected |
| Direct `runCommandCheck` for the selector's unchanged `review-guardrails-test` command | Exit 0; 256 tests passed, 0 failed; 110.637 seconds |
| `node scripts/harness/plan-hub.mjs linear-sync --feature cosmo-local-credit-interop --json` | Exit 0; parent preserve, no lane actions, preserve-existing states; no external write |
| Connected Linear RESR-73 read | Existing In Progress record read-only; older architecture prose does not override the later user dispatch |
| Connected Linear shared field-notes read | Server reported `Tool get_agent_context not found`; no notes were invented or written |
| `node scripts/harness/plan-hub.mjs validate --feature cosmo-local-credit-interop` | Exit 0; 34 hubs validated |
| `git diff --check` | Exit 0 at final local handoff |

The direct guardrail command used the selector's existing Node wrapper and exact test list through
`runCommandCheck`, without executing the denied root-secret fingerprint path. Its full result is
`format-guardrails-result.json`; the selector is `format-validation-plan.json`. This produces
command-level evidence, not a complete default-runner receipt. That earlier formatting stage changed no dependency, timeout, concurrency setting, harness source
or release gate. The subsequent approved harness fix is recorded below.

## Approved validator repair and fresh fork evidence

Evidence below belongs to the dirty working tree at HEAD `4a6b2f2e519b3e4cc675ed7bd738ab12b18bd4a2`,
not that commit. Contract source and test contents remain unchanged from the two prior manifests.
The sensitive harness delta is four added/changed execution lines in `scripts/dev/ci-local.js`,
regression coverage in its test file, and isolation of the Node-version doctor test in
`scripts/dev/setup-env.test.mjs`. No policy, selected check, permission or release gate was relaxed.

| Command / boundary | Observed result |
|---|---|
| Disposable original/candidate runner tests (`validator-proposal/{red,green}.log`) | Original: 2 pass/2 fail for the intended fingerprint boundary; candidate: 4/4 pass |
| Repository four focused regression tests | 4/4 pass after fixing a test-port local-variable shadowing error; initial output preserved |
| `PATH=/private/tmp/green-goods-purchases-20261021/bin:$PATH node scripts/dev/node-cli.js node --test scripts/dev/ci-local.test.mjs` | 59/59 pass, 0 skipped |
| `PATH=/private/tmp/green-goods-purchases-20261021/bin:$PATH node scripts/dev/ci-local.js --intent qa --changed scripts/dev/ci-local.js,scripts/dev/ci-local.test.mjs` | Fresh runner executes all checks: format/lint exit 0 (0 matching files); broader suite 398/399; unchanged doctor test cannot return JSON from real checkout |
| `PATH=/private/tmp/green-goods-purchases-20261021/bin:$PATH node scripts/dev/node-cli.js node --test scripts/dev/setup-env.test.mjs` | 3/3 pass after temporary-workspace isolation; no production doctor change |
| `PATH=/private/tmp/green-goods-purchases-20261021/bin:$PATH node scripts/dev/ci-local.js --intent qa --changed scripts/dev/ci-local.js,scripts/dev/ci-local.test.mjs,scripts/dev/setup-env.test.mjs` | Exit 0; 399/399 tests, three fresh selected passes, zero reused or unrun; 34.417s suite |
| `PATH=/private/tmp/green-goods-purchases-20261021/bin:$PATH GNOSIS_RPC_URL=http://127.0.0.1:18545 FOUNDRY_PROFILE=fork FOUNDRY_OFFLINE=true bun --no-env-file run --cwd packages/contracts test --suite solidity --profile match 'test/fork/GnosisVoucher*.t.sol' --threads 1 -vvv` | Repaired relay: 31/31 pass, no skips, 202.31s; first run exit 1 on relay timeout retained |
| Complete contracts critical selector, five checks including all four mandatory overrides | Exit 0; format, ABI artifacts, source build, full package tests and contracts-verify-fast all pass fresh; zero reused/unrun |

The full contracts package and `contracts-verify-fast` each passed 2,003 Solidity tests, three
production G$ gas fixtures, 31 Node CLI tests and 319 Vitest script tests. The nested verifier also
passed full compilation, pinned Foundry 1.7.1, static lint, Solhint and formatting. It took 272.035s;
the earlier package check took 228.898s. These are component and command observations for the
unchanged voucher files, not service-access proof. All five selected checks passed fresh.
`contracts-selected-checks.log` retains complete output. `validator-tested-files.json` fingerprints
the three changed harness files; `implementation-integrity-after-proof.json` confirms all thirteen
voucher files match their original manifests, with an empty Git index and unchanged HEAD.

The fork uses local Solc 0.8.28/Cancun, via-IR optimizer 200 and 32 fuzz runs. Selected CLC binaries
remain pinned to the existing published-artifact hashes. WXDAI is only a local rehearsal payment
asset. The receipt does not certify service prices/capacity, live issuer approval, real Safe signing,
Gnosis WebAuthn support or live cross-chain transport. Existing compile/cache warnings remain in logs.
The read-only relay's 90 unique additional RPC requests and raw results are retained under
`rpc-queue/`; no RPC key was read or written. Bun automatic dotenv loading was disabled throughout.

## Source compatibility review completed before runtime edits

| Owning boundary | Observed current implementation | Required service-access delta |
|---|---|---|
| `CommitmentPoolingAcceptanceLib.resolveClaimant` | Ordinary garden-pool Individual claims require the pool's own garden context and membership | Narrow explicit opt-in for approval-gated Individual Offers; recheck buyer-garden membership at request and acceptance; retain provider and legacy claim rules |
| `ClaimsLib` and `Lifecycle` | Pending claim records contain claimant, requester, kind and garden context; no expected service-terms revision | Add exact-revision consent at the owning claim/acceptance boundary; cover old entry-point, exchange and terms-update bypasses |
| `CommitmentPooling/Storage.sol` | Frozen 38 named entries and gap[12]; nested commitment and pending-claim tuples already consumed by callers | Preserve existing tuple layouts/selectors/events; choose and document additive versioned storage and views before coding |
| `SettlementFundingLib.recordFunding` / `_validatePledge` | Funding garden is the offer pool's garden; pending claim must use that garden | New opt-in personal funding must use the buyer garden's registered Celo Safe, with immutable buyer, refund, price, mode and terms binding; legacy records retain their rules |
| Funding ERC-7201 state | Existing funding namespace owns pledge, deposit references, consumption and refund linkage | Preserve existing fields and meanings; add explicit versioned personal-purchase records, canonical receipt facts and stable purchase identity at this owner |
| `SettlementPlanLib` | Plan creation requires Fulfilled/consideration and derives the payer Safe; cross-garden retained amount must be zero | Matching consumed personal funding must be required at every relevant create/finalize/prepare boundary; no legacy treasury fallback |
| `SettlementLifecycleLib._recheckDisbursement` | Contributor/beneficiary dispatch checks frozen accounts; refunds use FundingLib recheck | Revalidate personal funding and exclusive outcome at single/batch dispatch and retry, including delayed/refunded/unconsumed cases |
| `VoucherEndpoint` | Existing base already authenticates fixed peer/chain, rejects bridged tokens and enforces 48-hour upgrades | New service endpoints may reuse this unchanged base with separate typed service messages/identities; earned distribution authority stays separate |

The exact additive ABI/storage/event delta was selected at 2026-10-21T20:26:26.018241+00:00, before any service runtime
edit, in [the API and compatibility record](codex-service-access-api.md). It records the separate
core and funding interfaces, field order, namespace slots, new redemption codec/endpoints,
indexed events and recovery boundaries. Core uses internal helpers through existing deployed
libraries, preserving library names and leaving the historical release lock unchanged. Changed
library bytecode requires fresh candidate addresses and release artifacts; the old lock cannot
attest this source. Implementation follows
core consent/eligibility, then personal funding and independent Gnosis escrow, then integrated
proof. Settlement reads pooling; no reverse dependency or new Celo custody vault is introduced.

Steward-verified deposits remain a privileged attestation model. Any implementation must distinguish
offchain canonical receipt verification from onchain validation of the bound receipt facts; a
supplied transaction hash alone proves neither a transfer nor funding. Voucher escrow must retain
holder approval independently of generic core Fulfilled, purchase receipts and timeout. Do not
claim passkey signing, service capacity or external membership activation from local stand-ins.

## Sequence selected at proof closure

1. Preserve the closed proof identities and both initially failed commands; no failed exit is relabeled.
2. Record exact service ABI/storage/events before any implementation, then proceed in the accepted scope.
3. Implement the recorded service-access scope with
   meaningful RED/GREEN and upgrade/legacy compatibility proof through Bun contract wrappers.
4. Retain every critical selector override, source identities, actual results and proof limits.

No worktree, branch switch, stash, reset, commit, push, PR, dependency change, live transaction,
provider configuration change or external tracker write occurred. Indexer/Shared/apps and live
release remain outside this dispatch. Existing unrelated lane blockers are preserved.

Task record: Cosmo-Local service access | Type: feature | Outcome: partial, proof gaps closed and service design underway
Agent/model: Codex / exact model unknown | Coverage: this continuation's proof closure and preparation

| Phase | Start → end (UTC, 21 October 2026) | Result / evidence or blocker |
|---|---|---|
| Investigate | unknown → 19:30:48 | Current guides, prepared prompt, owning source, live mirror and prompt-preparation alignment |
| Implement | unknown → before 19:24:30 | Four formatting-only fixes; JSON values and existing edits preserved |
| Verify | 19:24:30 first observed → 19:30:22 | Formatting pass, 256 guardrails passed, thirteen source/test hashes unchanged |
| Wait | unknown → before 20:04 | User enabled Gnosis and approved the bounded validator repair |
| Investigate | 19:54 first observed → 20:12 | Fresh runtime conformance, cache-only fingerprint diagnosis and doctor fixture dependency |
| Implement | unknown → 20:12:31 | Approved lazy fingerprinting, four regressions and hermetic doctor fixture |
| Verify | unknown → 20:21:52 | 31 fork, 59 runner, three doctor and 399 full harness tests pass; all five critical contract checks pass |
| Investigate | 20:15 first observed → 20:26:26 | Three read-only service design lanes; exact compatibility, funding outcome and escrow API selected before implementation |

Human corrections: 0 observed in this segment; attention: unknown. No service runtime implementation or publish phase had entered at proof closure; the following
selected implementation phase starts only after this API record.

## Service core implementation started

At 20:28–20:29 UTC the new interface and three tests compiled against the existing real pooling
fixture. Legacy control passed; the exact-term external-buyer and stale-revision cases failed
because service selectors were absent (1 pass/2 fail). This is `core-red.log`, not a compiler or
setup failure. Approved internal-only service implementation then passed the same three cases
(`core-green-initial.log`); the expanded matrix remains running. Its exact wrapper command is
`PATH=/private/tmp/green-goods-purchases-20261021/bin:$PATH FOUNDRY_OFFLINE=true bun --no-env-file run --cwd packages/contracts test --suite solidity --profile match test/unit/CommitmentPoolingServiceOffers.t.sol -vv`.
Full service-slice proof is still pending and prior base receipts do not certify these changes.

The separate service/voucher-unit and responsible-issuer refinements were recorded before escrow
implementation in [the selected API record](codex-service-access-api.md). Service quantities come
from canonical core terms; their explicit approval is independent of voucher custody/release.
Returning vouchers does not assert nondelivery or erase service approval. Core lifecycle remains
a separate authority.

## Funding RED and receipt isolation

The stable core now passes **40/40**, including 1,000 price fuzz cases; final lint/format and
whitespace checks pass. Exact 12-file identities and default Solc 0.8.28/Cancun/non-IR optimizer 200
configuration are in `core-files-manifest.json` and `core-implementation-evidence.md`. No new
deployed library, frozen-layout change, old interface edit or release-lock rewrite occurred.
Production sizes, upgrade/storage and broad regression remain pending for the new service code.

Funding RED ran 20:39:03–20:40:14 UTC using the real core, real recognition and the existing
Settlement payout API, with no consumed personal funding. Compilation/setup succeeded; the next
call wrongly created a plan instead of reverting. Result: 0pass/1fail, exit 1, `funding-red.log`.
Exact command: `PATH=/private/tmp/green-goods-purchases-20261021/bin:$PATH FOUNDRY_OFFLINE=true bun --no-env-file run --cwd packages/contracts test --suite solidity --profile match -- test/integration/PersonalServicePurchase.t.sol`.
The initial test bytes and hash are preserved in `funding-initial-red-manifest.json` and
`funding-initial-red.t.sol`; this remains working-tree evidence. Funding runtime has not changed yet.

Before implementation, the selected funding namespace was refined to separate normalized verified
receipt facts from legacy free-form assertions. Sharing one index would let another garden's
steward block a legitimate deposit by supplying its hash through the legacy API. The revised
[exact API/storage record](codex-service-access-api.md) has three mappings and a new isolation
regression, preserves legacy deposit/refund wind-down, and rejects legacy consumption into a new
service promise. No historical opaque reference is relabeled as verified receipt proof.


## Escrow RED and parallel implementation

The first redemption attempt failed compilation on a fixture's dynamic-struct assignment
(`redemption-red.log`); that setup failure is not RED evidence. After field-wise fixture copying,
the unchanged two behavior assertions compiled successfully at 20:43:35–20:44:51 UTC and failed
as intended: source returned zero instead of its canonical redemption ID, and escrow held zero
instead of 100. `redemption-red-runtime.log` and its cached verbose rerun preserve 0pass/2fail.
Full implementation began after this proof, alongside the separate Settlement funding lane.
Neither endpoint shell is treated as implemented evidence.

The Celo conformance addition is bounded to a new fork test at chain 42220, block 75,178,393.
It will observe canonical G$ gross debit/net credit and existing Safe ownership/threshold, without
changing production Celo contracts. Fork log arrays have no mined transaction hash or RPC-global
log index; they cannot populate a purportedly verified real receipt. Steward receipt attestation
remains a separate privileged trust boundary.


## Earlier earned-module structure correction

At 20:58 UTC, `node scripts/quality/check-source-structure.js --base HEAD` exited1 on the
previously untracked VoucherEntitlementModule:369lines against the new-source350limit. The
earlier five-check critical selector did not include this separate conditional source-policy
proof. No policy or baseline change is selected. The bounded correction moves the existing
pure canonical-weight largest-remainder allocation into an internal-only VoucherRecognitionAllocation
helper. Core recognition remains the complete-set/weight authority; arithmetic, tie order, emitted
payloads, external ABI and storage remain unchanged. Original bytes are preserved and a new
working-tree manifest plus fresh earned regression will supersede the original source hash.
The prior31fork receipt retains its historical identity; it is not recertified by this refactor.


## Shared compile and Celo proof checkpoint, 21:08 UTC

The initial shared compile failed on a reserved local identifier in the new source endpoint;
the next failed on unnecessary `view` modifiers around Foundry assertions in the new Celo test.
Both setup failures are retained as such, not RED evidence. After repair,
`core-green-upgrade-shared-compile-final.log` passed42/42, including1000fuzz cases and two
same-artifact authorized/unauthorized upgrade persistence tests. This is working-tree proof at
HEAD4a6b2f2e519b3e4cc675ed7bd738ab12b18bd4a2, not historical deployed-version upgrade evidence.

The generated old pooling/settlement interface ABI bytes, both frozen linear storage manifests,
both frozen Storage.sol files, Registry interface and Celo executor source all match the captured
compatibility input hashes(10/10). New service interfaces and redemption endpoints have additive
ABI exports. All five registered ERC-7201 namespace checks pass; the two new entries register
exact slots and stored nested structs. ABI/storage artifact surfaces changed only as documented;
production size, full storage gate, full regression and final ABI regeneration remain pending.

Celo chain 42220/block 75,178,393 hash
`0xf225ecd4643bced3b267819f0d8f99bc5e39cc4b6baf25b3bbdaa4e8d63b5f4f` returned through the
read-only connector. Combined new deposit/old Roles fork:10pass/2fail/0skip, exit 1
(`celo-deposit-roles-fork.log`). All nine unchanged Roles cases and the existing Safe conformance
passed. Both incoming-deposit cases failed because the reviewed Safe has zero actual pinned
G$ inventory. Their subsequent zero-transfer traces are not accepted deposit evidence. The fixture
is being repaired to use a publicly evidenced funded holder for fork-only fictional seeding.
No balance was fabricated or live transfer performed. The Roles suite configures its planned
modifier locally; it does not prove that modifier was enabled live.

Alchemy truncates large Celo code results and rejects creation-context calls on this network.
The real24,401-byte Roles runtime was recovered from the existing exact-pin Foundry cache,
independently rehashed and matched to fresh `eth_getProof.codeHash`; no independently verified
Merkle inclusion proof is claimed. Four smaller runtime reads were fresh. The test run also used
existing pinned state cache and additional connector reads; final request count will be recorded
from the relay. No key, root secret, upstream CLC implementation source or broadcast was involved.


The current actual-path selector(55contract paths at21:10UTC) selects11checks: format, lint, ABI
artifacts, Shared typecheck/tests, Client/Admin/Indexer tests, contract build/tests and mandatory
contracts-verify-fast. New additive ABI exports account for consumer checks. They remain pending
until focused behavior is stable and all will be retained; the earlier five-check baseline is not
substituted for this broader final plan. Source-structure is also required as the separate
changed-source conditional proof. The first personal funding focused run passed7/13; six failures
are retained while expected-error argument/helper-call assertions are corrected. No full-slice
GREEN is claimed from partial or unrun proof.


Escrow pre-split focused proof at21:21UTC: `redemption-green-presplit-fresh.log` passes30/30
including1000fuzz cases and both original RED assertions. The first run's one fixture payload-cache
error remains recorded separately. Actual compiler storageLayout is captured in
`redemption-escrow-presplit-artifact.json`(SHA256
`4a240c7bf621ce7dc0e5d909e38483310b2167ba38702a8b2b5392ba1a6ecfea`):24entries, own mappings
at301–305 and gap45at306. There are41function selectors. Local mocked-transport gas was1,021,797
for authorization intake including mock acknowledgment, and430,163 for cumulative-result
reconciliation, under the proposed2,000,000/750,000 allowances. This does not certify live CCIP
gas. Receiver extraction, real-core composition, real Giftable conformance and final broad proof
remain pending.


## Production size and repaired Celo conformance, 21:25 UTC

Exact fresh command:
`PATH=/private/tmp/green-goods-purchases-20261021/bin:$PATH FOUNDRY_OFFLINE=true bun --no-env-file run --cwd packages/contracts check:sizes`.
`service-production-sizes-first.log` exits1: SettlementModule28,391bytes(3,815over EIP-170),
FundingLib25,024(448over). Core 22,781/source redemption 17,875/escrow 17,888 fit. No known-oversize
allowance or compiler limit was introduced. The measured owner/read-forwarding correction was
recorded before code in the API handoff; size remains a blocker until the fresh rerun passes.

Exact repaired Celo command:
`PATH=/private/tmp/green-goods-purchases-20261021/bin:$PATH CELO_RPC_URL=http://127.0.0.1:18546 FOUNDRY_PROFILE=fork FOUNDRY_OFFLINE=true bun --no-env-file run --cwd packages/contracts test --suite solidity --profile match test/fork/CeloPersonalServiceDeposit.t.sol --threads 1 -vvv`.
Final`celo-deposit-fork-final.log`:3pass/0fail/0skip, exit 0. Combined with the earlier nine
unchanged Roles passes, this proves the selected12cases across two commands at the same pin,
not a newly run12-case aggregate. The first inventory-repaired attempt passed2/3 and timed out
on one unserviced relay request; its failure remains in`celo-deposit-fork-inventory-repaired.log`.
With that real response retained, unchanged source passed.

The seed came from the publicly configured protocol Safe's actual pinned inventory into a
fictional depositor via fork-only impersonation; the reviewed garden Safe is only the recipient.
Observed incoming transfer amount/gross debit/net receipt each100000000000000000000baseunits,
fee 0. This proves the pinned zero-fee configuration; nonzero fees/caps require deterministic
coverage and fresh live quotes. No mined transaction hash/global receipt logIndex, actual member
signature, steward receipt verification or live funds movement is proved.24additional connector
responses were retained, alongside the existing pinned cache. The Celo relay is stopped.

Independent source review found no confirmed economic bypass across the scoped funding/outcome
and redemption paths. Evidence level is path/dependency inspection only, no tests, RPC or audit
certification. Full critical and consumer gates remain pending.

## Final conditional and pinned-fork proof, 22:20 UTC

All results below are dirty-working-tree evidence at the recorded HEAD, not commit-attributed
receipts. Bun automatic environment loading was disabled. Evidence remains under
`/private/tmp/green-goods-service-access-20261021/`.

| Exact command, with `PATH=/private/tmp/green-goods-purchases-20261021/bin:$PATH FOUNDRY_OFFLINE=true` | Observed result |
|---|---|
| `bun --no-env-file run --cwd packages/contracts check:sizes` | Exit 0, all deployable artifacts fit; `service-production-sizes-repaired.log` |
| `bun --no-env-file run --cwd packages/contracts check:storage-layout` | Exit 0; all 16 protected linear layouts and five ERC-7201 namespaces; `service-storage-layout-final.log`; no baseline update |
| `node scripts/quality/check-source-structure.js --base HEAD` | Exit 0;21 changed non-test source files, seven existing shrinking baseline violations, no new violation or debt growth; `service-source-structure-final.log` |
| `GNOSIS_RPC_URL=http://127.0.0.1:18545 FOUNDRY_PROFILE=fork bun --no-env-file run --cwd packages/contracts test --suite solidity --profile match 'test/fork/GnosisVoucher*.t.sol' --threads 1 -vvv` | Exit 0;39 pass/0 fail/0 skip:22 purchase, nine reserve, eight redemption; `gnosis-service-fork-final.log` |
| `CELO_RPC_URL=http://127.0.0.1:18546 FOUNDRY_PROFILE=fork bun --no-env-file run --cwd packages/contracts test --suite solidity --profile match 'test/fork/Celo{PersonalServiceDeposit,GardenRolesPermission}.t.sol' --threads 1 -vvv` | Exit 0;12 pass/0 fail/0 skip in one final command: three deposits and nine Roles; `celo-service-fork-formatted-final.log` |

Production profile: Solc 0.8.28/Cancun, viaIR, optimizer 1. Final runtime sizes include Settlement
23,728 bytes (848 bytes below EIP-170), Funding 22,217, Lifecycle 22,284, Plan 20,467, Core 22,781,
source redemption 17,875 and escrow 17,888. The first size failure remains recorded above. The
repair moved funding guards to their existing owners and introduced a self-only, fixed-selector
read forwarder (`0x2e74d824`). Differential tests cover all four forwarded reads, nested arrays,
long strings, exact revert bytes, caller isolation and selector rejection. No arbitrary target,
size exemption, compiler-profile change or release-lock rewrite was introduced.

Default tests use optimizer 200, top-level non-IR, existing per-file profiles and 1,000 fuzz cases.
Fork tests use the existing viaIR optimizer 200 profile and 32 fuzz cases. No dependencies were
installed or upgraded.

Gnosis chain 100/block 48,848,261 hash
`0x03be75732ad238a0c04d6044a42d2fd7baec4b48f89afed9670886ca0477b60d` remains the selected
CLC implementation pin. Complete runtime retrieval used read-only connector responses, not
AGPL implementation source. The serviced relay retained 99 unique additional actual RPC responses
in total (nine new beyond the earlier90), alongside Foundry's existing exact-pin state cache.
The WebAuthn validator `0xbA45a2BFb8De3D24cA9D7F1B551E14dFF5d690Fd` has no code at this pin.
That historical observation does not establish present-day member passkey support. No member
signing proof is claimed.

Celo chain 42220/block 75,178,393 hash
`0xf225ecd4643bced3b267819f0d8f99bc5e39cc4b6baf25b3bbdaa4e8d63b5f4f` proves the selected
canonical G$ zero-fee configuration: 100e18 requested, gross-debited and net-received units,
`senderPays=false`. The reviewed garden Safe had zero pinned inventory; a public protocol Safe's
actual pinned inventory seeded a fictional depositor through fork-only impersonation. The final
rerun used 24 retained actual responses plus exact-pin cache, with no new requests. Its test-source
SHA256 is `fcc4b6df2ca2f1ddb0ade97263e1033c2959bee21f64866518753a17ae84cc44`.
Nonzero fee/cap behavior is deterministic mock proof, not this fork's observed fee state. No real
signature, mined transfer receipt/global RPC log index or steward truthfulness is established.
Both temporary relays are stopped; no live transaction was broadcast.

Receiver extraction preserves 24 recursive storage entries, 41 selectors and canonical ABI/events
when nominal Solidity `internalType` names are ignored; the inherited nominal names changed and
the additive ABI export was regenerated. `redemption-receiver-compatibility-final.json` records
the actual artifacts. Earned allocation extraction preserves the actual compiled ABI and 28
recursive storage entries; `earned-allocation-extraction/compiled-compatibility-final.json` records
that comparison. Ten frozen compatibility inputs still match, including old interfaces, old
linear layouts, both Storage.sol files and Celo executor. Registry and Hats source are unchanged.

The link graph retains 14 core and seven Settlement library names. This is an inventory check,
not permission to reuse previous library addresses. Future release preparation must derive and
review new candidate identities, links and artifacts. The production historical lock deliberately
continues rejecting this changed source. Existing audit, Safe threshold, 48-hour mainnet timelock,
testnet operation, human authorization and rollback/readback gates remain intact. Admission and
upgrade sequencing need a coordinated rehearsal (Settlement guard before, or atomically with,
core opt-in). Same-artifact local persistence tests are not proof of an upgrade from historical
deployed bytecode.

## Broad selector run and release-test fixture repair

`service-repo-quick-plan.json` selected 15 checks for 76 explicit owned paths, including all four
mandatory contract overrides and all ABI consumer suites. Exact arguments are retained in
`service-repo-quick-argv.json`; environment/start/exit are separately recorded. The command was
`PATH=/private/tmp/green-goods-purchases-20261021/bin:$PATH FOUNDRY_OFFLINE=true TURBO_FORCE=true node scripts/dev/ci-local.js --quick --checkpoint-scope lane --changed <the 76 paths>`.
It did not select unrelated dirty-checkout lanes. No passing receipt or Turbo test cache was reused.

`service-repo-quick-final.log` is the original exit 1 result: ten fresh checks passed, one failed,
four unrun. Passed: format, lint,399 validation-system tests, ABI artifacts, Shared typecheck,
Shared 7,434 pass/16 skip, Client 1,725 pass, Admin 1,307 pass, Indexer 327 pass/one pending, contracts build.
Contract package internals passed 2,119 Solidity tests, three production cold-acknowledgment G$ gas
fixtures and 31 Node CLI tests, but Vitest scripts passed 307/319. Eleven CLI tests rejected current
artifacts against the historical lock before reaching their nonce/sender/network assertions;
one manifest test assumed the old candidate hash. The production rejection is correct. The four
unrun checks were verifier, source structure, ontology and supply chain; none was relabeled passed.

The bounded repair changes only `script/deploy/release.test.ts` and
`script/utils/release-manifest.test.ts`. Real unchanged CLI/scripts, public manifest/deployment
records and current production artifact JSON are physically copied into a disposable workspace.
Only installed dependencies are linked. Existing lock generation derives a matching local fixture,
whose release-owned deployment identities are aligned locally. The fixture contains no `.env` and
cannot overwrite canonical scripts, configuration, lock, artifacts or output. Tests preserve the
exact operational guard assertions and add actual-CLI stale-lock/conflicting-record rejection,
with before/after canonical byte comparisons and cleanup. Current link/CREATE2/UUPS materialization
is checked independently from artifact offsets; historical hashes remain labeled as historical.
No production code, lock, release permission or check was weakened. Focused passing evidence and
final selected follow-up will be recorded below after the formatted source completes verification.

The final formatted focused command was
`PATH=/private/tmp/green-goods-purchases-20261021/bin:$PATH bun --no-env-file run --cwd packages/contracts test --suite script -- script/deploy/release.test.ts script/utils/release-manifest.test.ts`.
It exited0 with 42/42 Vitest and 31/31 Node CLI checks. The first isolated iteration passed 38/41:
three copied deployment identities still reflected the old candidate; only disposable records
were aligned before the passing reruns. No failure was discarded. Exact test hashes, canonical
byte comparisons and cleanup are in `service-release-fixture-evidence.json` (SHA256
`af7bdf867d70796a0580d9b8eb38c994477d40b16348b7b8e6415a4581596a59`); final focused log SHA256
`3832397763b9fc493c925f2e4b35d44390f4cb0e99dbda113fd5cc744e5bad78`.
The parent read every added/changed line before running the full package again.

The follow-up selector explicitly covers 78 owned paths and nine checks: format, lint, all four
mandatory contract overrides, source structure, ontology and supply chain. Exact arguments are
`service-repo-followup-argv.json`, selection reasons are `service-repo-followup-plan.json`.
This follow-up does not rerun unchanged successful consumer/harness suites. All 66 previously
tested runtime/ABI/test/harness paths remain byte-identical; only two release-test files were
added, giving 68 fingerprinted files with aggregate digest
`437fc9a6f37c80118665fc113f3fa91e2dfdf2992a99e28243effb041d6fdb79`.
`service-tested-source-manifest-followup.json` preserves this before-run identity, alongside
the original66-file manifest. No stored receipt is reused and no single aggregate15-check pass
will be inferred from separate commands.

At 22:26 UTC the complete current package passed:2,119 Solidity, three production G$ gas fixtures,
31 Node CLI and 322/322 Vitest scripts across 30 files; `contracts-test` 251.547s. The production
verifier is running next. `record-tdd --feature cosmo-local-credit-interop --lane contracts --actor codex`
now records the real-core RED/GREEN pair, with independent funding/escrow proof linked here.
Its exact arguments and observed exit 0 are in `service-record-tdd-{argv,result}.json`. This
changes TDD orchestration state only: contracts remains `in_progress`, the hub remains backlog,
and other lane/manual/live gates are unchanged. It is not a commit-attributed validation receipt.

## Verifier findings and bounded corrections, 22:29 UTC

The first nine-check follow-up exited1: five fresh passes, no reused receipt, verifier failed,
three checks unrun. Its full compile passed. Static lint first stopped on a wrapped constant in
`CommitmentPoolingServiceOffers.t.sol`; the one-line whitespace correction is proven by equal
non-whitespace bytes in `core-final-format-proof.json`. The subsequent canonical package lint
reached Solhint and found four complexity10 functions against the unchanged limit9:
FundingRefundLib.queue, LifecycleLib.retry, PersonalPurchaseOutcomeLib.requireRefundEligible and
VoucherRedemptionCodec.validateResult. `service-postfix-lint.log` retains4 errors/277 warnings.

The selected repair extracts small cohesive internal guards, preserving validation order, errors,
economic payloads, public ABI, storage and deployed library inventory. No suppression or lint
configuration change is authorized. The successful22:26 package and earlier size/fork results
remain evidence of their original sources; fresh final-source size/storage/fork/critical proof is
required after these corrections. The failed command remains `service-repo-followup-final.log`.

The four private extractions are frozen and reviewed. `funding-lint-refactor.patch` preserves the
three complete Settlement diffs; `redemption-codec-lint-fix.diff` preserves the codec move.
Refund eligibility still reads at the same point, retry message IDs are still recorded after the
transport returns, and action accounting still follows the canonical action-hash checks.
`service-post-extraction-lint.log` exits 0: Foundry 1.7.1 format/version checks and Solhint pass,
0 errors/277 warnings. Warnings include event/struct gas suggestions and inline-assembly notices;
they are retained, not suppressed. The unavailable npm update check does not install anything.

The final selector is `service-repo-final-plan.json`, with exact arguments/start/exit in
`service-repo-final-{argv,start,exit}.json` and output in `service-repo-final.log`. It retains the
same nine checks and all four mandatory overrides. Source manifest
`service-tested-source-manifest-final.json` contains 68 files, digest
`d7dcba3a19c22651e7b86e4d1e69705a4da657ace51bbce45b8097566163a471`.
Exactly five entries changed from the preceding manifest: four private-helper extractions and
one whitespace-only test constant; the other 63 are identical. No public interface, generated ABI,
configuration, lockfile, dependency, selected check or release policy changed.

Fresh read-only Green Goods Alchemy chain/header reads at 22:31:12 UTC reconfirm both chain IDs and
pinned block hashes (`service-post-lint-pin-readback.json`). The subsequent fork reruns will use
retained actual responses at those exact pins and Foundry's existing cache. The connector evidence
is not synthetic state, member signing, live transport or cryptographic receipt verification.

## Next bounded integration objective

The next separately dispatched slice is Indexer projection, then Shared state/actions, then
member/steward journeys and external service activation. No runtime work on those surfaces is
included here. Consume the additive interfaces and endpoint ABI exports alongside the existing
core and settlement ABI; do not replace their frozen interfaces or invent deployed addresses.

Preserve these meanings in the projection and later app prompts:

- Keep source chain/module identity, canonical terms revision, accepted claim hash and request
  nonce. A legacy offer or an observed acceptance alone does not imply a service entitlement.
- Project `PersonalServicePurchasePledged`, `PersonalServiceDepositVerified` and the selected /
  completed outcome independently. `verifiedBy` identifies the privileged steward attestation;
  the event is not a cryptographic Celo receipt proof. Keep the canonical chain/transaction/global
  log index and exact Safe/depositor/refund facts, plus actual gross/net fees and limits.
- Project destination `VoucherPresented`, `HolderDeliveryApproved`, return authorization and
  `RedemptionActionResult` separately from source `RedemptionResultRecorded`. Service units and
  voucher atomic units have separate cumulative fields. Source `Active` means the destination
  authorization was observed, not token presentation or external service activation. `Closed`
  means financial resolution, not core fulfillment or proved non-delivery.
- Keep durable destination results when acknowledgment delivery fails; source pending/unknown
  does not permit replacement value. Transport IDs and acknowledgment sequence are observations,
  not replacements for entitlement, purchase, redemption or action identity.
- Preserve `CommitmentFulfilled.confirmationPath`, its confirmer/reason and dispute events.
  Generic Fulfilled includes legitimate fallback/dispute resolution; never relabel it as personal
  beneficiary confirmation. `HolderDeliveryApproved` records its own explicit approval instead.
- Keep earned delivery, direct Gnosis swap receipts, G$ purchases and voucher redemption distinct.
  A direct swap receipt does not create an Arbitrum earned entitlement. No displayed universal
  voucher/G$ price, mixed checkout, automatic burn or membership-provisioning claim is supported.

Prompt-preparation alignment remains confirmed with no newer conflicting human decision. Its
chat leaves this shared checkout untouched. Local accounts, mocked transport and fictional
service fixtures remain labeled; COM-46 actual prices, capacity, remedies, issuer approval,
signer/account proof and separately authorized release remain prerequisites for live use.

## Final critical gate and naming-only repair, 22:45 UTC

`service-repo-final.log` completed with eight fresh passes, zero reused and zero unrun of nine
checks. All four mandatory overrides passed. Both complete package invocations (direct and nested
verifier) passed 2,119 Solidity tests, three production G$ gas fixtures, 31 CLI checks and 322 script
tests. Direct package264.456s; verifier258.653s. Source structure passed with no new debt; ontology
passed 73 tests and its seven existing baselined findings. No runtime, lint threshold or release
lock changed during this run.

The ninth check, supply chain, correctly rejected three new Celo fork names using `testFork_`.
Only those function names changed to `testCeloPersonalServiceDeposit_`; assertions, data and code
bodies are identical. `celo-fork-test-name-fix.json` preserves the exact before/after identity.
All 67 other manifested files, including every runtime/ABI/harness input, remain byte-identical to
the eight-pass run. The new 68-file digest is
`553ce412ed31f09529e4ed7e99b54551e6edbfba389507c0ff560017d530c6c4`, in
`service-tested-source-manifest-after-test-names.json`.

The selector for this test-only follow-up reports routine risk and two checks, with no mandatory
contract override. Exact command:
`PATH=/private/tmp/green-goods-purchases-20261021/bin:$PATH node scripts/dev/ci-local.js --intent qa --changed packages/contracts/test/fork/CeloPersonalServiceDeposit.t.sol --only format --only supply-chain`.
`service-name-fix-validation.log` exits 0: two fresh passes, zero reused/unrun; supply chain 33.765s.
All test-quality checks, 94 guidance files checked, immutable-report checks, 34 Plan Hubs and 69
Plan Hub tests pass. Existing governed skips and independent blockers remain unchanged. The new
Celo names will receive their fresh 12-case fork run in the conditional sequence.

This is complete component coverage across commands, not a fabricated single nine- or 15-check
aggregate pass. Failed logs remain intact. The separate size/storage/fork/ABI commands and their
UTC start/end/exit/log hashes are recorded in `service-final-conditionals.json`.

## Final local closure, 22:49 UTC

The local contracts slice and its required proof are complete. All changes remain uncommitted;
contracts stays `in_progress`, the owning hub stays backlog and other manual lane states are
unchanged. `service-final-record-tdd-{argv,result}.json` records the final local TDD update.
Its GREEN command is the actual successful package component `bun run test`, run from
`packages/contracts` with the recorded offline environment and Bun no-env shim; the containing
selector's supply-chain failure is independently retained and repaired, not called a passed run.

| Final command evidence | Observed result |
|---|---|
| `service-repo-final.log` / exact argv and environment in `service-repo-final-{argv,start}.json` | Eight fresh passes; all four mandatory contract overrides, source structure and ontology pass. Package and nested verifier each 2,119 Solidity / three production gas / 31 CLI / 322 script passes. Ninth check failed only on three fork-test names. |
| `service-name-fix-validation.log` / `service-name-fix-plan.json` | Two fresh passes, zero reused/unrun; supply chain passes all quality checks, 34 hubs and 69 hub tests after names-only correction. |
| `service-final-production-sizes.log` | All deployable artifacts fit. Settlement 23,728; Funding 22,196; Lifecycle 22,284; Plan 20,467; Core 22,781; source redemption 17,875; escrow 17,888 bytes. No exemption or profile change. |
| `service-final-storage-layout.log` | All 16 protected layouts and five ERC-7201 namespaces match; no baseline update. |
| `service-final-gnosis-fork.log` | 39 pass/0 fail/0 skip at chain 100/block 48,848,261; same actual CLC binaries and block hash recorded above. |
| `service-final-celo-fork.log` | 12 pass/0 fail/0 skip in one command at chain 42220/block 75,178,393; renamed test file SHA256 `52ea2416c76ee4125ae4c7633aa8b26cb8d6935a5e6837f17a7637e027a9ac52`. |
| `service-final-abi-exports.log` | All 14 exports unchanged by regeneration, including the two frozen interfaces and four additive service exports. |
| `service-final-lint.log` | Exit 0, Foundry 1.7.1 format/version and Solhint 0 errors/277 retained warnings, including the renamed Celo tests. |

The five conditional commands ran sequentially from 22:43:28 to 22:46:46 UTC. Their exact argv,
environment overrides, timestamps, exits and log SHA256 values are in
`service-final-conditionals.json`. Final source mismatch list is empty. Gnosis used 99 retained
actual queued state responses; Celo used 24; neither needed a new state response in this rerun.
Request-log observations increased 220→332 and 101→129 respectively. Four fresh chain/header
connector reads separately reconfirmed both pins at 22:31:12 UTC. Exact-pin Foundry caches remained
in use. Both read-only loopback relays are stopped; no live write, transfer or broadcast occurred.

Fresh final-artifact compatibility checks also pass: `service-final-receiver-compatibility.json`
preserves 24 absolute recursive storage entries, 41 selectors and canonical ABI/events, with only
the previously disclosed nominal `internalType` difference. `service-final-earned-compatibility.json`
preserves the exact earned ABI and 28 recursive entries. All ten frozen input hashes still match.
`service-final-link-graph.json` matches the previous library-name inventory and confirms unchanged
historical lock bytes. These observations do not certify historical deployed-version upgrades or
permit reuse of historical library addresses.

Remaining work is the separately dispatched Indexer/Shared/app integration described above and
actual service activation. COM-46 terms, capacity, issuer approval, signer identities and account
proof remain open. Celo receipt truth remains a privileged steward attestation; mocked transport,
local Safe/EOA stand-ins and fork-only impersonation do not establish member signing, live CCIP or
external membership provisioning. Existing audit, timelock, testnet, Safe and human-release gates
are preserved. Rendered proof: **none**, because this dispatch changes no UI; existing app work
was preserved and is not service-access UI proof.

Task record: Cosmo-Local service access | Type: feature | Outcome: local contracts/proof complete; later integration/live gates open
Agent/model: Codex / exact model unknown | Coverage: service implementation after the preparation segment above

| Phase | Start → end (UTC, 21 October 2026) | Result / evidence |
|---|---|---|
| Implement | 20:28 first observed → 21:44:09 | Core consent, personal funding and voucher escrow; independent meaningful RED/GREEN in the owning logs |
| Verify | 21:08 first observed → 22:28 | Focused, compatibility, conditional and broad consumer/package proof; initial size, fixture and lint failures retained |
| Review / implement | 22:17 first observed → 22:32:03 | Disposable CLI fixtures and four cohesive complexity extractions; parent inspected every changed line |
| Verify | 22:33 first observed → 22:46:46 | All critical component checks, naming-only supply-chain repair and final conditional sequence |
| Review | 22:47:43 → 22:50:20 | Final compiler compatibility, source/lane preservation and evidence reconciliation |
| Verify | unknown → 22:52:16 | Final eight-path handoff selector: format/supply chain pass, 69 hub tests; no reused or unrun check |

Intervals include tools and overlap; they are not summed as active effort. No publish phase was
entered. Human corrections: 0 observed in this covered segment; attention: unknown.

Final handoff selector at 22:52 UTC: two fresh passes, zero reused/unrun, 69 hub tests pass.
`service-handoff-final-{plan,result}.json` records exact scope/argv/result; full output is
`service-handoff-final-validation.log`. Final integrity (`service-final-integrity.json`) confirms
68 source hashes and ten frozen inputs match, six canonical release inputs remain unchanged,
HEAD/branch/index are preserved, no owned fixture directory remains and both relay ports are closed.
Prompt-preparation alignment was reconfirmed after proof closure; next scope and live gates are unchanged.
