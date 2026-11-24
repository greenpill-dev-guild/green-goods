# Two-pool voucher implementation

Local implementation and validation are complete for the authorized scope. All contract,
application, storage, indexer and tooling suites, production builds and owned quality checks
passed. The repository-wide gate still reports unrelated plan formatting and an ignored
temporary test. Live deployment and real-account signing proof remain pending.

Publication uses `feature/two-pool-vouchers` based on `develop`. This record describes the earlier
working-tree verification. The isolated branch preserves the later wallet loading and offline
behavior from `develop` and excludes the two unrelated failures described below. See the
[rollout steps](two-pool-rollout.md) and [Claude UI brief](claude-two-pool-ui.md) for follow-up.

User authorization: implement the selected two pools, all three user flows and steward awards
for past contributions. Live deployment/transactions, commits, publication and branch changes
are not part of this execution. The existing checkout and unrelated changes stay untouched.

## Execution

| Lane | Owner | Scope | State |
|---|---|---|---|
| Pool provisioning | Codex contracts agent | P1–P4: adopt existing GG, provision TAS, update member admission, simulation/readback and fork proof | Implemented and verified locally; live activation pending |
| Shared voucher model | Codex Shared agent | P6–P10: canonical issuers, per-pool listings, bounded exchange/recovery, wallet and live configuration | Implemented; full suite and types passed |
| Steward awards | Codex award agent | Agent SQLite award record, exact Safe draft and confirmed receipt | Implemented; consumer and real SQLite proof passed |
| App journeys and indexing | Codex Client/Shared agent and assigned follow-up | P5/P11–P13: index both pools; holdings/services, checkout and steward actions | Implemented locally; indexer identity proof passed; production pins remain gated |
| Connected verification | Codex lead | P14 local proof and exact activation prerequisites | Local proof complete; unrelated repository failures and live gates recorded |

Linear start gate completed: `linear-sync --feature cosmo-local-credit-interop --json` returned
parent-only `preserve_existing`; live RESR-73 read returned Done. The canonical identifier was
recorded with `record-linear`; no external fields changed. Existing canonical lane history is
preserved; this handoff describes the newly authorized scope.

Reuse decisions: keep the existing CLC implementation/ABI/runtime fixtures, reserve adapter and
escrow. Existing issuer operations own voucher actions; existing transaction batches/journals own
transport and recovery. Issuer identity is separate from the pool listing. The old release's
empty-state check cannot adopt the active GG pool, so its owning release entrypoint needs a
separate, explicit adoption mode. Existing mutable transaction-batching files belong to another
ongoing task and are not rewritten by this work.

Award storage choice: extend the existing Agent SQLite owner with a dedicated award table and
signed API. The existing saved-offer CAS and funding-request uniqueness provide concrete reuse
patterns. Freeze `(chain, reserve, award ID)` to one exact Safe envelope/hash/nonce and verify
the Safe execution plus token transfer receipt. Local browser state is only a recovery aid.
This guards the same recorded award through this workflow, not deliberately different awards
or independent manual transfers. No new contract or storage infrastructure is selected.

## Implemented paths and activation boundary

| Person's goal | Voucher path | Exchange used |
|---|---|---|
| Complete a TAS request and use the hub | Verified request fulfillment releases TSV from the existing finite reserve; the gardener books the hub with TSV | Direct booking; no exchange |
| Exchange design help for coding help | Each member approves their own service terms; admitted member vouchers exchange before booking the other service | TAS local pool |
| Use earned rewards for Green Goods services | Earned TSV exchanges for GGV, then the gardener books an available Green Goods offer | Curated Green Goods pool |

Both pools refer to the same canonical TSV token and supply. Green Goods admission is separate
from TAS admission. When a member voucher needs two exchanges to reach GGV, each exchange has
its own review and receipt; the second uses verified output from the first. A completed first
exchange is not repeated when the second fails. Holdings and active bookings remain visible when
an exchange is unavailable, and services offered stay distinct from vouchers available to spend.

Stewards can prepare a separate award for a past contribution, naming the recipient, voucher,
amount and reason. Existing reserve stock funds it. A direct eligible signer or the Safe's
required signers execute the exact reviewed transfer; only confirmed execution and delivery
produce a delivered award receipt.

These are local implementation paths. Production still has the existing Green Goods pool. TAS
requires canonical deployment receipts, reviewed admission/funding, hub service terms and source
reward authority before its local exchange and hub offer activate. The observed two-signature
TAS policy must be reconciled with the earlier recorded one-approval decision. Career calls and
other new Green Goods offers require real terms and capacity; the implementation does not invent
them or replace the currently reviewed service catalog.

## Sensitive configuration changes

The task adds six narrow Shared public export leaves and two Storybook hook spies, extends the
Agent's existing SQLite/schema/startup composition, and adds exact API/ontology paths to CI and
local validation routing. Signing paths remain classified critical. The retired onboarding hook
is now a read-only listing query; its obsolete critical entry was removed. The concurrently
authored wallet batch sender was added to the critical list based on its sending behavior, without
editing that implementation. Four seam fingerprints were refreshed after their registered proofs
passed. Dependencies, lockfiles, permissions and debt baselines were not changed by this task.

## Implementation findings

- An award's direct Safe signature must bind its reviewed nonce. A prevalidated owner signature
  does not provide that guarantee, so the direct path uses an exact Safe typed-data signature;
  unsupported contract owners use the explicit Safe handoff. A prepared record is not delivery.
- The existing member draft hook returned an unavailable placeholder and kept signed approvals
  only in browser cache. The same existing Agent storage owner now persists a separate draft
  record with exact pool context, member approval and revision checks.
- Shared issuer identity now stays separate from pool listings. A missing exchange does not
  hide a holding or block direct redemption and recovery. A sequential second swap requires a
  fresh review and is capped by the first swap's verified output.
- Read-only Gnosis evidence at block 49168127 (2026-11-08 05:13 UTC) shows the TAS Safe has
  threshold 2, five owners, and a locked guard with configuration `[0,2,2]`. This differs from
  the previously recorded one-approval policy. The new release preflight names that mismatch;
  this task changes no live Safe policy. The existing GG timelock has a 24-hour delay, which
  adoption must preserve rather than reset to a historical zero-delay assumption.
- The new deployment executor keeps a resumable journal and separate deployment artifact;
  it never overwrites the historical pilot deployment. Explicit receipt recovery can adopt an
  exact same-intent replacement transaction. Changing reserve balances belong in current
  readback evidence, not the immutable deployment identity.
- The live GG pool is owned by its configured AccessManager. Preparing offchain issuer drafts
  requires the named Safe's current manager role and eligible Safe signer; it does not execute
  governance or bypass the manager's 24-hour execution delay.

The final checkpoint selector selects the critical contract and consumer checks. Working-tree
behavior, whole-consumer, type/build and rendered Storybook proof are complete. Exact lane
commands and results are recorded in the lane handoffs and the consolidated results below.

Current working-tree checkpoints: [Shared model and recovery](two-pool-shared.md),
[contracts/indexer](two-pool-contracts.md), [durable awards](voucher-awards.md) and
[member service drafts](service-issuer-desk.md). Contracts
records 24 passing fork tests and 89 script tests plus 39 CLI checks for the deployment
extension. The consolidated final runs below supersede those intermediate checkpoints for
local integration proof; none is a live activation or commit-attributed receipt.

Rendered proof completed through 2026-11-08 06:34 UTC: Chromium IAB, Storybook with synthetic
fixtures. The holder review names the exact pool, finite quantity and signing account. Service
checkout renders the selected pool and voucher shortfall, and its input and review button remain
usable at 390px width. The steward award review names recipient, token, reserve, amount and
reason; a two-signature Safe exposes handoff/reconciliation rather than a direct send. Unknown
submission reads as unconfirmed delivery and offers pending-transaction recovery. The draft
review includes the pool, capacity, issuance, exchange value, fee and document reference before
saving. Revised member terms require a new approval and explain relative exchange value.
Storybook callback-reset and missing-context errors found during this walk were corrected and
the affected previews rerendered successfully. No real account signed or sent a transaction.
Authenticated-session evidence remains pending because the browser extension did not open the
task tab; clean-room rendered proof does not substitute for it.

Consolidated checks: full Shared and Agent source/test typechecks passed; Client and Admin
production builds also checked their full source/test project graphs. Focused Client voucher tests passed 57 tests; the
steward draft/award tests passed 22. A later bounded review added the exact pool to the final
member approval dialog, with its regression passing in the final full Client suite. Source
structure, lint, story coverage/quality, QA IDs, staged modules and copy checks passed.
The first full Agent run had 635 passing tests and four timeout failures in three
existing avatar/media files under heavy host contention. Those three files then passed all
30 tests unchanged in an isolated rerun. That rerun is separate evidence, not a claim that the
earlier full command passed. The later full Agent run passed both its runtime and real SQLite stages.

The first full contract wrapper passed 2,233 Solidity tests, three production gas fixtures and
39 CLI checks. Its script stage passed 803 tests and timed out one existing keystore case;
that file then passed all four cases unchanged in isolation. The required production verifier
then passed the whole scope with two workers, preserving assertions and timeout budgets:
full compilation, static lint, 2,233 Solidity tests, three gas fixtures, 39 CLI checks and all
804 script tests. The final-artifact fork proof passed all 24 tests at 07:21 UTC.

Repository-wide formatting found four owned files, now corrected, plus the unrelated
`garden-cookie-jars-vnext/status.json`, which remains untouched. Test quality found an unrelated
temporary signer-server test and registry fingerprints affected by the Shared export additions.
All four registered seams had only the Shared manifest changed among their fingerprint inputs;
their registered direct, conformance and integration tests passed in the full Shared run. The
fingerprints and review dates were refreshed without changing lifecycle, proof paths or baselines.
The checker now reports no registry violations; the temporary signer test remains the sole
direct-test seam failure.

The first full Shared run passed 724 files / 9,538 tests and failed five old wallet integration
expectations in one file. The migrated fixture now proves a valid listing before injecting pool
failures, preserves canonical holdings/bookings while clearing failed exchange observations,
and adds token/escrow proxy rejection coverage. The focused file passed all 37 tests. This is
separate from the final full run, which passed 725 files / 9,545 tests (14 existing governed
skips) with four workers after the contract compiler completed.

The first full Client run passed 2,349 tests and failed one wallet-sheet host test because its
external-hook fixture did not include the new award hook. The six-test file now passes and
asserts explicit award loading. The first full Admin run passed 1,657 tests and failed three
community host cases missing the desk-hook fixture plus the existing explicit-button-type guard.
Nine owned non-submit award controls now declare `type="button"`; the guard is unchanged. The
two affected Admin files passed all 18 tests. Final whole Client and Admin reruns then passed
all 2,350 and 1,661 tests respectively. Both production builds passed, including the client's
PWA precache/startup budgets.

Design token checks passed; the vocabulary check caught four untranslated steward terms in
Spanish/Portuguese. Those values now use the established locale terms, and the vocabulary check
passes. The first full validation-system run passed 429 tests and identified exact routing lists
that needed the new ontology/API/signing paths. Those lists now match the sources and all three
focused selector tests pass. The retired read-only hook and concurrent sending leaf are classified
by their current behavior, as described above. The final full validation-system run passed all
432 tests. The final full Agent run passed 639 runtime tests and 256 real SQLite tests; the
Indexer suite passed all 375 tests.

Final build/type/documentation closeout also passed: Client and Admin production builds with
`VITE_CHAIN_ID=11155111`, Shared Storybook build, Shared/Agent `typecheck --scope full`, Agent
build, Docs build and 142 Docs tests, and 260 agent-tool tests. Shared is consumed as source and
has no separate compilation build; the Indexer build/typecheck is recorded in the contracts lane.
The final source-structure check accepted 111 changed non-test files without new baseline debt.
Lint, design/vocabulary, story coverage/quality, documentation authority, guidance contracts and
links, all 17 generated projections, and all 31 Plan Hubs passed. The 69 Plan Hub regression tests,
QA ID ledger, staged-module and copy guards also passed. `git diff --check` passed; the branch
remains `fix/work-approval-feedback` at `a0d503abcb40d835ef95992e91e78b7a7305f16f`.

Final repository-wide exceptions, confirmed at 08:00 UTC:

- `bun run format --check` reports only the unrelated
  `.plans/active/garden-cookie-jars-vnext/status.json`.
- The supply-chain/test-quality command reports only `missing-direct-import` in an ignored
  temporary signer-server test. Registry violations are resolved. The private evidence path
  stays out of this public handoff.

Those files remain untouched. This is passing local feature proof with two unrelated global
check failures, not a clean full-repository gate, deployment claim or CI/merge-readiness verdict.

## Task record

Task: `cosmo-local-credit-interop` two-pool implementation | Type: feature | Outcome: complete for authorized local implementation; live rollout remains pending
Agent: Codex; exact model unknown | Coverage: this implementation segment, starting 2026-11-08.

| Phase | Start → end (UTC) | Evidence / blocker |
|---|---|---|
| Investigate | 2026-11-08 04:41:55 → unknown | Scope, current dirty checkout, owner modules, authority/storage boundaries and Linear preservation verified. Exact transition time was not retained. |
| Implement | unknown → 2026-11-08 07:06:47 | Runtime implementation and bounded review corrections complete; focused proof recorded in the lane handoffs. Verification metadata continues in the review phase. |
| Implement | unknown → 2026-11-08 07:23:34 | Whole-suite feedback corrected host-test fixtures and explicit non-submit button types; focused Client and Admin regression files pass. |
| Review / verify | 2026-11-08 05:43:03 → 2026-11-08 08:00:37 | Contract, consumer, storage, type/build, rendered Storybook and policy proof completed; final unrelated global failures and live activation gates recorded above. |

Runtime proof is working-tree evidence, not a commit-attributed receipt or deployment claim.
Proof-gated machine lanes remain nonterminal until their separate receipt/live requirements are
met. Human corrections observed: 0 in this segment; attention unknown. No publish phase entered.
