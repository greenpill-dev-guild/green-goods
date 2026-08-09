# Codex session prompt: payer identity, recipient rule, and PR hardening

Date: 2026-08-08

## Your mandate

You are taking ownership of the Green Goods commitment-pooling payer-identity and settlement
implementation **PR-hardening checkpoint** in:

```text
/Users/afo/Code/greenpill/green-goods
```

Work on the current branch. Do not create or switch branches. Read the root
`AGENTS.md`, `packages/contracts/AGENTS.md`, the active plan at
`.plans/active/commitment-pooling/`, and the nearest guidance for every package you
touch. Use Bun wrappers for contracts work and never invoke raw Forge. Do not deploy,
broadcast, or send a transaction.

This prompt is self-contained and supersedes assumptions from earlier sessions. Verify
every claimed property in code or by running its check; do not infer architectural
properties from nearby code.

Your sole goal is to make the current pooling, payer, recipient, and settlement implementation PR
ready for adversarial human review and merge. Stop at a merge-ready handoff. Do not create or
switch branches, merge the PR, implement credit contracts, add deployment/courier tooling, activate
live indexer addresses, or broadcast. Credit implementation and deployment/release are governed by
separate session prompts and are not part of this prompt.

## Why the architecture changed

The protocol pool is Green Goods' own commitment pool and exists to support
two-directional exchange with gardens:

- A protocol **Request** asks for work. A garden-scoped request is claimed by a garden;
  an individual request is claimed by a gardener. The protocol is the payer.
- A protocol **Offer** provides support, onboarding, or technical help. A garden claims
  the offer and pays for it with G$ it earned. The claiming garden is the payer.

The original design bound payment to `providerGarden`, the party that delivered the
commitment. That happens to work in a single-garden pool, where asker and doer share one
garden account, but it reverses both protocol-pool flows. The frozen correction is an
immutable `payerGarden` beside `providerGarden`:

- Request: store `pools[poolId].garden` as `payerGarden` at creation.
- Offer: store the accepting `gardenContext` as `payerGarden` at acceptance.
- Settlement source, executor garden, and payout authority come from
  `settlementAccounts[payerGarden]`.
- `providerGarden` remains the EAS recipient and roster boundary; it is not implicitly
  the payer.
- In valid garden-internal commitments, `payerGarden == providerGarden`. That equality
  is the backward-compatibility guard.

Recipient identity follows the claimant:

- Request + `ClaimType.Garden`: one recipient, the claiming garden's registered Celo
  Safe.
- Request + `ClaimType.Individual`: contributor accounts.
- Offer, either claim kind: contributor accounts, because the claimant garden pays.

Consequences already accepted by the plan include a garden-beneficiary settlement
shape, zero retained value for cross-garden plans, rejecting institutional Garden claims
in garden pools, allowing exchanges only when both sides have free consideration, and
renaming promise-side `Reward*` ABI/read-model vocabulary to `Consideration*`.

## Reliability warning: two prior reviews overturned confident claims

Do not trust prior green summaries without execution evidence.

Review round 1 returned `REQUEST_CHANGES` with six findings. It disproved that the
priced-exchange gap was deliberate (a priced Offer x Offer trade assigned one garden as
payer for both people), that `payerGarden` could always be derived from `poolId` (reverse
delivery has no ordering guarantee or bounded reverse index), that `check:ontology` had
been run, and that two large test diffs were formatting-only.

Review round 2 returned `REQUEST_CHANGES` with seven findings. It disproved that
`ClaimType.Garden` was already protocol-only, that no new disbursement kind was required,
and that the first recipient-rule amendment had repaired all retention cases. In
particular, a 100%-retained plan had no payable child and could complete locally while
leaving funds in the payer Safe.

The closure validator also passed while `status.json` still described the superseded
provider-pays architecture. Passing syntax and cross-reference checks is not semantic
closure.

## Built versus specified boundary at handoff

### Built and covered in the pooling module

- `ICommitmentPoolingModule.Commitment` stores immutable `payerGarden`.
- `CommitmentCreated` and `CommitmentAccepted` include trailing `payerGarden`.
- Request creation and Offer acceptance populate the payer at their respective stable
  lifecycle boundaries.
- `Reward*` promise-side ABI was renamed to `Consideration*`.
- `GardenClaimRequiresProtocolPool` rejects institutional Garden claims in garden pools
  at creation and acceptance.
- `ExchangeConsiderationUnsupported` makes exchange acceptance barter-only.
- `recordConsiderationPaid` applies the claimant-based beneficiary rule.
- `CommitmentPoolingPayer.t.sol` and the exchange tests cover the current pooling slice.

Fresh evidence on 2026-08-08 before the review edits:

```text
packages/contracts: 1,816 Solidity tests and 100 script tests passed
CommitmentPoolingModule deployed size: 21,205 bytes; margin: 3,371 bytes
```

### Specified but not built at handoff

No `SettlementModule` or `CeloSettlementExecutor` implementation exists under
`packages/contracts/src/`. The payer binding, beneficiary child, retention rules,
recipient derivation, acknowledgement lifecycle, and executor semantics in
`settlement-spec.md` are target behavior until their contracts and tests exist. Do not
describe them as implemented merely because the specification is detailed.

### Current implementation state after Codex implementation

The built-versus-specified boundary above records the state received from Claude Code. It is not
the current tree state. Codex subsequently implemented and tested the following pre-deploy slice:

- the Arbitrum `SettlementModule`, its public delegatecall libraries, immutable contributor-versus-
  beneficiary payout shapes, conservation and retention constraints, preparation, homogeneous
  batching, dispatch/retry/cancel, authenticated acknowledgments, aggregate counters, and the
  domain-separated execution key;
- the Celo `CeloSettlementExecutor`, exact-net G$ transfers through the registered Safe route,
  caps and fee controls, idempotency, result persistence, malformed-command failure handling, and
  acknowledgment retry;
- the beneficiary lifecycle, including active-account rechecks at plan creation/finalization,
  preparation, batching, and dispatch while keeping `gardenerDeliveryEnabled` irrelevant;
- the final acceptance-boundary Garden-claim checks, so a stale or backfilled approval record
  cannot bypass the creation/request guards;
- Envio entities and handlers for payer identity, payout plans, disbursements, and derived
  settlement flow, including reverse-order protocol-configuration reconciliation; and
- shared read-model types plus live ontology representations for the implemented enums.

This remains pre-deploy. No address was added to `42161-latest.json`, no transaction was sent, and
no broadcast occurred. The broader state/API/UI settlement lane and actual Celo-side circulation
observation remain outside this implementation slice. A later audit found that the contract
implementations exist but their deployment path, complete read model, and security-proof matrix do
not. Do not call the settlement lane complete.

## Earlier adversarial findings and their implemented disposition

The first 2026-08-08 Codex review returned `REQUEST_CHANGES`. The seven findings below were
implemented before the later whole-increment audit; keep them as regression requirements, not as
the remaining-work list.

1. **P1: `GardenBeneficiary` cannot be represented or paid.** The plan and child
   structures are contributor-only, the interface omits
   `prepareGardenBeneficiaryPayout`, and a no-contributor plan derives `Complete`.
   Implement an immutable payout-shape discriminator, explicit beneficiary garden/Safe,
   amount and child ID, the missing preparation selector, and shared child lifecycle
   accounting. A beneficiary plan must never complete without acknowledged payment.
2. **P1: retention and conservation are incomplete.** Enforce
   `gardenRetainedAmount == 0` whenever payer and provider differ or the plan has the
   beneficiary shape. Contributor-plan conservation is `declared = retained + sum of
   contributor amounts`; beneficiary-plan conservation is `declared = beneficiary
   amount` with zero retention and no contributor rows. Shape is immutable, so editing
   cannot convert one form into another. Keep `gardenRetainedAmount`: it remains coherent
   for garden-internal individual Requests and Offers.
3. **P1: the protocol root can claim its own Garden-scoped Request.** Add an explicit
   external-garden acceptance guard and regression coverage. This is a scoped ABI-freeze
   exception in addition to the previously recorded payer/consideration/beneficiary
   changes.
4. **P1: beneficiary rechecks and recovery are underspecified.** Every
   commitment-bound child must participate in batching, dispatch, acknowledgement,
   cancellation, retry, counters, and plan status. Recheck both the payer and beneficiary
   settlement accounts at finalization, preparation, batch creation, and dispatch.
   `gardenerDeliveryEnabled` is irrelevant to a Safe beneficiary.
5. **P2: invalid identities remain reachable in the target specification.** Reject a
   fulfilled record with `payerGarden == address(0)` before creating a plan. Require an
   active registered beneficiary account when a beneficiary-shaped plan is created,
   freeze its Safe address, and recheck active status at later authorization boundaries.
6. **P2: indexer and semantic coverage are incomplete.** Index `payerGardenId`; add
   beneficiary-plan and child fields; include the beneficiary enum member; correct
   diagrams/status that still call the provider the payer; and derive
   `CommitmentSettlementFlow` as `INTERNAL`, `PROTOCOL_TO_GARDEN`,
   `GARDEN_TO_PROTOCOL`, or reserved `GARDEN_TO_GARDEN` from immutable payer/provider
   gardens plus the write-once protocol garden.
7. **P2: disbursement naming should finish now.** Because settlement is not deployed,
   rename ordinal-zero `ContributorReward` to `ContributorConsideration`. Preserve human
   interface copy such as “reward” and “support”; only ABI, specification, ontology, and
   read-model identifiers move.

All seven dispositions are present at the pinned audit HEAD and have focused regression tests.
Reopen one only if fresh code or execution evidence disproves it.

Verified non-findings after disposition:

- Creation and request-time checks alone did not cover every institutional Garden-claim path: an
  approval-gated or backfilled pending claim could reach the final acceptance mutation directly.
  The disposition adds the same pool-type and external-garden checks to
  `AcceptanceLib.acceptCommitment`, which is now the shared final boundary. Exchange and series
  continue to force individual claims.
- The existing execution-key tuple is domain-separated sufficiently once child shape is
  immutable. It need not add the disbursement kind.
- `gardenerDeliveryEnabled` should not gate a beneficiary Safe transfer.

## Latest whole-increment audit: pinned result and open findings

The subsequent validity/bloat audit reviewed the clean committed range
`4769211dc013026013d8e9cd4fc8a569289257cf..68a8d0301686e18611d7e8abb38400f5f84778c4`
on `feature/build-commitment-pooling-contracts`. It returned **`REQUEST_CHANGES`**. Treat that exact
HEAD as the evidence snapshot; refresh the range and rerun every failing gate if the branch moves.

The increment is large but not broadly bloated: 198 files, 32,267 additions, and 1,043 deletions.
The additions break down as follows:

| Category | Added lines | Share |
|---|---:|---:|
| Contract production | 11,035 | 34.2% |
| Contract tests | 9,053 | 28.1% |
| Contract tooling | 3,773 | 11.7% |
| Generated contract artifacts | 3,077 | 9.5% |
| Plans and documentation | 3,164 | 9.8% |
| Ontology/generated docs | 1,108 | 3.4% |
| Indexer/shared production | 738 | 2.3% |
| Indexer tests and other | 319 | 1.0% |

Only about 36.5% is production contract/indexer/shared source. The test volume, storage-layout
baselines, ABI artifacts, and frozen plan records are legitimate review and upgrade-safety material.
Do not use total line count alone as evidence of bloat. The audit found four demonstrably dead
lines, not a redundant subsystem:

- unused `CommitmentPoolingCreditLib` import in
  `packages/contracts/src/lib/CommitmentPooling/ProofLib.sol`;
- unused default exports at the ends of `script/deploy/commitment-schemas.ts`,
  `script/deploy/pooling-configure.ts`, and `script/deploy/pooling.ts`; every consumer uses the
  named class export.

The two initially oversized settlement entry contracts were split by a concurrent session while
the audit was running. At the pinned HEAD, `SettlementModule.sol` and
`CeloSettlementExecutor.sol` are 75- and 74-line entry shells, implementation files stay below the
new-file ceiling, and `check-source-structure` passes when invoked with the pinned base. The split
is closed, not an open finding.

The following findings remain open, severity ordered. The first is a deferred release blocker;
findings 2–5 are current-PR hardening work:

1. **Deferred release blocker — no settlement deployment/release path.** The contracts exist, but
   there is no
   dedicated `settlement-executor` deploy target, no `packages/contracts/script/settlement/**`
   courier/lifecycle implementation, no role-aware artifact persistence/merge path, and no
   post-deploy Safe/Roles/peer verification path. `packages/contracts/package.json` exposes the
   read-only `test:fork:settlement-lane` proof only. This is a pre-broadcast deployment-path blocker
   under the repository contract, but it is outside this PR-hardening checkpoint. Do not implement,
   partially scaffold, deploy, or broadcast that path here. The current PR may be approved only as
   dormant pre-deploy implementation, never as value-tier release readiness.
2. **High — the settlement read model is partial and its boundary gate fails.**
   `packages/indexer/config.yaml` registers only six Arbitrum `SettlementModule` events, no Celo
   executor block, and the boundary allowlist does not know `SettlementModule`. The handler returns
   immediately for every batch acknowledgment, and no `BatchCreated`, dispatch/retry, or
   `BatchCancelled` handler exists. Batched rows and queued/dispatched/executed-ack-pending state
   therefore cannot be truthful. Implement the 28 Arbitrum plus 14 Celo event contract from
   `settlement-spec.md` §6, update the boundary allowlist, regenerate Envio, and add reverse-order,
   duplicate, batch, retry, cancellation, configuration, and Celo acknowledgment fixtures.
3. **High — value-moving settlement proof is too narrow.** The source and executor interfaces expose
   88 functions, but only 18 focused settlement behavior tests exist. Direct proof is absent for
   peer rotation/grace expiry, recovery-owner changes, dispatcher authority, source command retry,
   batch cancellation, caller-funded and sponsored acknowledgment retries, fee withdrawals, UUPS
   authorization/rollback, and most cap/period boundaries. Build a selector/requirement coverage
   matrix, then add unit, adversarial, fuzz/invariant, upgrade, and two-process lifecycle tests.
4. **Medium — the coverage audit cannot instrument the branch.** `bun run test:audit:full` reaches
   the coverage phase but both unit and integration coverage compilation fail with a Yul stack-depth
   exception rooted at `src/lib/CommitmentPooling/CreationLib.sol`. The reported `0/0` is a tooling
   failure, not zero measured coverage. Repair the coverage-compatible build or refactor the ABI
   pressure, then meet the repository thresholds; do not waive the gate or report coverage from the
   ordinary green suite.
5. **Low — remove the four dead lines listed above.** Run Knip again and distinguish branch-local
   signals from its unrelated repository-wide findings.

Separate hygiene evidence: `git diff --check <base>` reports three trailing-space Markdown hard
breaks in `reports/google-doc-payer-change-list-2026-08-08.md`. Normalize them unless the renderer
requires those exact hard breaks. The realism audit also flags three `vm.mockCall` uses in
`test/fork/ArbitrumCommitmentPooling.t.sol`; that file was explicitly another session's work and was
outside this payer-change commit boundary, so inspect ownership before changing it.

## Required current-PR hardening after restoring this session

Execute in this order:

1. Pin the current `origin/develop` merge base and HEAD, inspect `git status`, recent commits, and
   other worktrees, and preserve concurrent ownership. If HEAD differs from the audit snapshot,
   revalidate the findings before editing.
2. Remove only the four confirmed dead lines and the Google Doc report whitespace if still present.
   Do not use this as an excuse for broad cleanup.
3. Expand the settlement security and lifecycle test matrix. Prove the current implementation's
   value-moving, retry, peer, cap, pause, withdrawal, cancellation, acknowledgment, and upgrade
   boundaries against the frozen specification. Tests may surface implementation defects; fix only
   defects inside the current pooling/settlement implementation scope.
4. Complete the code-level Arbitrum and Celo settlement read model already introduced by this
   branch, regenerate Envio types, repair the boundary allowlist, and prove batch, intermediate,
   duplicate, cancellation, retry, and reverse-order behavior. Keep live addresses, deployment
   artifacts, production start blocks, and live Celo observation activation out of this PR.
5. Repair the coverage build and rerun the contract audit gate until it produces real line and
   branch measurements rather than `0/0`.
6. Re-read live Linear only if tracker updates are still requested. The payer correction notes were
   already written; do not duplicate them or rewrite Done issue descriptions.
7. Rerun the full gate set below, then adversarially review the exact committed PR range rather than
   trusting the implementation session's own green summary. Resolve every Critical or High finding
   inside the current PR scope.
8. Update this prompt with the exact fresh evidence and stop for human review. Do not deploy,
   broadcast, create the credit branch, create the deployment branch, merge, or mark the value tier
   release-ready.

## Scope boundaries and concurrent-work hazards

- Do not deploy, broadcast, or perform live onchain mutations.
- Do not add settlement, credit, courier, or release deployment tooling in this checkpoint.
- Do not create or switch branches.
- Stay on the current branch. Never reset or revert unknown work.
- Do not stage or include these other-session files in this workstream's commit boundary:
  - `packages/contracts/test/fork/ArbitrumCommitmentPooling.t.sol`
  - `packages/contracts/test/unit/CommitmentSchemaRecovery.t.sol`
  - `packages/contracts/script/deploy/commitment-schemas.test.ts`
  - `packages/contracts/test/unit/NetworkSelectors.t.sol`
- Other dirty schema/deployment files may also belong to concurrent sessions. Inspect
  ancestry and content before touching or staging them.
- `reports/linear/**` are immutable records of what was written to Linear. Dated reports
  are records; do not rewrite prior ones. Put corrections in
  `reports/corrections-log.md`.
- Keep `CommitmentPoolingModule` selector weight in libraries. The measured pre-change
  margin is 3,371 bytes.
- Do not rename intentional human-facing “reward” or “support” copy in hifi artifacts.
- Do not install or upgrade dependencies.

## Open questions and closure decisions

- **Retained amount:** keep it, but only for garden-internal individual settlement. It is
  not dead merely because cross-garden flows force it to zero.
- **Disbursement enum:** rename `ContributorReward` to `ContributorConsideration` now,
  preserving ordinal zero, because the settlement ABI has not shipped.
- **Fork suite:** the dedicated read-only Arbitrum One ↔ Celo Mainnet settlement-lane wrapper is
  certified at the audit snapshot: 6/6 tests passed against pinned forks. The broader Hats upgrade
  fork wrapper still requires reviewed positive integers for `HATS_MODULE_UPGRADE_FORK_BLOCK_NUMBER`
  and `HATS_MODULE_UPGRADE_GARDEN_COUNT`. Record those as pre-existing environment prerequisites;
  do not invent values or conflate them with payer changes.
- **Circulation metrics:** derive protocol-to-garden and garden-to-protocol settlement
  intent in the indexer, but state plainly that actual Celo transfer observation remains
  outside Envio's Arbitrum boundary.
- **Partner document image:** closed by live read-only verification. Tab 02 already embeds the
  current five-relationship triangle. Do not replace it; correct the stale caption and adjacent
  GoodDollar/protocol-flow prose through the human change list.

## Last verified evidence and live-state disposition

At audit snapshot `68a8d0301686e18611d7e8abb38400f5f84778c4`, the following checks passed:

```text
contracts full suite:       1,842 Solidity + 100 script tests passed
indexer full suite:         193 passed
indexer TypeScript build:     passed
settlement lane fork proof:   6 passed
contract lint:               0 errors (warnings remain)
storage layouts:             all 14 matched
SettlementModule size:      23,346 bytes; 1,230-byte margin
CommitmentPooling size:     21,205 bytes; 3,371-byte margin
Celo executor size:         18,689 bytes; 5,887-byte margin
source-structure gate:       passed with pinned base
architecture closure:       passed (86 functions, 57 executable calls)
```

The following checks did not pass or do not exist yet:

```text
indexer boundary:            failed; SettlementModule is not allowlisted
contract coverage audit:     failed; coverage compilation Yul stack-depth error
git diff --check:            three Markdown trailing-space findings
settlement deployment path:  absent; outside this PR-hardening checkpoint
two-process courier proof:   absent; outside this PR-hardening checkpoint
full Celo executor indexer:  absent
```

The ordinary contract and indexer suites being green do not close the current-PR indexer, coverage,
or security-proof failures. The absent deployment and courier paths are expected at this checkpoint
and belong to a separate deployment/release prompt. The value tier remains dormant, pre-deploy, and
unapproved for broadcast.

Live Linear is converged for this correction: successor PRD-800 exists and is **In Review** with
the proof above; Done PRD-759 has a supersession comment rather than a rewritten description;
PRD-796 records the scoped ABI-freeze exception; PRD-686 carries the amendment and a 2026-08-14 due
date; PRD-734 is Done with GoodDollar's circulation confirmation; and PRD-721 through PRD-725 carry
the payer/consideration/beneficiary/recipient notes. The complete PRD-722 indexer lane and PRD-723
state/API lane are not being declared complete by this checkpoint.

The human-only Google Doc instructions are in
`reports/google-doc-payer-change-list-2026-08-08.md`. Codex did not edit the document. The human
must preserve the live-verified current triangle image and correct its stale generic caption and
adjacent GoodDollar/protocol-flow prose before the next partner read.

## Exact validation commands

Run from the repository root unless a subshell is shown. Use the exact Bun wrappers.

```bash
cd packages/contracts && bun run test
cd packages/contracts && bun run check:sizes
cd packages/contracts && bun run check:storage-layout
cd packages/contracts && bun run lint
cd packages/contracts && bun run test:audit:full
cd packages/contracts && bun run test:fork:settlement-lane
cd packages/indexer && bun run codegen
cd packages/indexer && bun run check:indexing-boundary
cd packages/indexer && bun run test
cd packages/indexer && bun run build
node scripts/quality/check-source-structure.js --base 4769211dc013026013d8e9cd4fc8a569289257cf
bun .plans/active/commitment-pooling/architecture-closure.validate.ts
bun run check:ontology
bun run format:check
git diff --check 4769211dc013026013d8e9cd4fc8a569289257cf
bun .plans/active/commitment-pooling/hifi/validate.ts
```

The source-structure base above is the audit base, not a permanent magic value. Replace it with the
fresh `origin/develop` merge base when the branch changes. Run the settlement fork through the Bun
wrapper only; a sandboxed macOS Foundry run may crash in SystemConfiguration, in which case rerun
the same wrapper through the approved execution path rather than classifying the crash as a product
failure. Do not invoke Forge directly and do not invent environment values.

After cross-package changes, run the Repo Quick Gate:

```bash
node scripts/dev/ci-local.js --quick
```

Do not claim completion from inherited output. Capture fresh results in the same session,
including exact test counts, measured coverage, and any environment-only blocker. Current-PR
completion requires the indexer boundary and coverage gates to pass, the current implementation's
security/lifecycle proof matrix to be reviewable, and no unresolved Critical or High finding inside
the pooling, payer, recipient, settlement-contract, or code-level read-model scope. It does not
require the later deployment/courier path to exist. Report that deferred path prominently, call the
current result merge-ready implementation only, and never call it deployed or release-ready.

## Fresh PR-hardening execution: 2026-08-08

### Pinned review boundary

- Branch: `feature/build-commitment-pooling-contracts`
- Fresh `origin/develop` merge base: `4769211dc013026013d8e9cd4fc8a569289257cf`
- Committed HEAD reviewed: `a0066c08a4902da65203257313cac52de992bb23`
- Committed range: 199 files, 32,279 additions, 1,043 deletions
- The hardening changes below remain in the working tree for human review. No branch change,
  staging, commit, push, deployment, broadcast, or transaction occurred.

### Implemented hardening

- Removed the unused `CommitmentPoolingCreditLib` import, the three unused deployment-script
  default exports, and the stale Markdown trailing whitespace. Knip no longer reports those three
  duplicate deployment exports; its remaining failure is broad existing repository debt.
- Closed a fresh UUPS defect: a paused owner could previously upgrade either settlement contract to
  an implementation compiled with different immutable router or chain identity. Source upgrades
  now require identical router, source selector, and destination EVM chain ID; executor upgrades
  require the identical router. Upgrade and rollback tests prove state preservation and rejection.
- Added the reviewable 88-function source/executor coverage matrix in
  `settlement-security-coverage-matrix-2026-08-08.md`. New adversarial, boundary, fuzz, invariant,
  upgrade, retry, reserve, cancellation, peer-rotation, duplicate, and acknowledgment tests cover
  the in-scope contract security requirements. The explicit two-process courier remains deferred.
- Completed the code-level read model for all 28 `SettlementModule` events and all 14
  `CeloSettlementExecutor` events. It now projects source configuration, accounts, payout snapshot
  replacement, batches and memberships, commands, retries, duplicate/stale acknowledgments,
  cancellations, executor policy/routes/executions, deferrals, messages, and reserve state.
- Cross-chain entity relationships fail closed until verified chain metadata exists. No Celo
  address, start block, deployment artifact, or live observation activation was added. The Envio
  boundary remains two configured chains and 12 contracts; Celo settlement handling is code-level
  and dormant until the later deployment/release lane supplies live facts.
- Split the settlement handlers by responsibility. Every new handler source is below 350 lines;
  the largest is 272 lines. The source-structure gate passes.
- Flipped only the now-implemented `settlement-execution-status` ontology entry from spec to live,
  declared its GraphQL representation, and regenerated the deterministic ontology docs.

### Fresh execution evidence

```text
contracts full suite:       1,881 Solidity + 100 script tests passed
source security suite:         17 passed (including 1 invariant)
executor security suite:       18 passed (including 1 invariant)
CCIP settlement integration:    3 passed
contract sizes:                passed
  SettlementModule:          23,980 bytes; 596-byte margin
  CeloSettlementExecutor:    19,061 bytes; 5,515-byte margin
  CommitmentPoolingModule:   21,205 bytes; 3,371-byte margin
storage layouts:               all 14 matched
contract lint:                 0 errors; existing warnings only
settlement fork lane:           6 passed, read-only

indexer full suite:           199 passed
indexer codegen/build/lint:    passed
indexer boundary:              passed; 12 contracts, 2 chains

source-structure gate:         passed
architecture closure:          passed; 54 events, 26 entities, 86 functions,
                               57 executable calls, 6 offline kinds
ontology:                      11 guards passed; 9 existing findings baselined
format check:                  passed; 2,058 files checked
git diff check:                passed
hifi validator:                passed
repo quick gate:               passed
  shared:                    3,398 passed, 1 skipped
  client:                      658 passed
  admin hub:                   102 passed
  agent:                       245 passed, 1 skipped
```

### Remaining blocker and verdict

`bun run test:audit:full` still fails only at the coverage phase. Both unit and integration
instrumentation compile 454 files and fail with the same Yul stack-depth exception rooted at
`src/lib/CommitmentPooling/CreationLib.sol`; the generated report correctly marks `0/0` as command
error, not measured coverage. Narrow refactors and compiler-profile experiments were tested, but
none produced real LCOV within the repository audit contract; all unsuccessful production and
compiler changes were reverted. The coverage threshold is not waived.

The realism tooling self-tests pass. Its advisory scan has one must-fix finding: three
`vm.mockCall` uses in `test/fork/ArbitrumCommitmentPooling.t.sol`. That protected concurrent-session
file was not edited or included in this workstream. Knip continues to fail on existing repo-wide
unlisted binaries, unresolved imports, and unused-export debt; the settlement handler entrypoints
are registered and do not appear as new unused files.

Fresh adversarial review found no unresolved Critical or High defect in the current pooling,
payer, recipient, settlement-contract, or code-level read-model scope after the immutable-upgrade
and indexing fixes. Nevertheless, this checkpoint remains **`REQUEST_CHANGES` and not merge-ready**
because the prompt explicitly requires real coverage measurements. Deployment/courier tooling and
live Celo activation remain intentionally deferred release blockers. This implementation is
dormant, pre-deploy, and not authorized for broadcast.
