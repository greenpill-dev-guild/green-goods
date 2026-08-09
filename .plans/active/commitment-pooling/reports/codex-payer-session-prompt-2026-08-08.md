# Codex session prompt: payer identity, recipient rule, and completion

Date: 2026-08-08

## Your mandate

You are taking ownership of the Green Goods commitment-pooling payer-identity and
settlement-completion workstream in:

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

### Current completion state after Codex implementation

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
observation remain outside this completed implementation slice.

## Adversarial review findings and required disposition

The 2026-08-08 Codex review returned `REQUEST_CHANGES`.

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

Verified non-findings after disposition:

- Creation and request-time checks alone did not cover every institutional Garden-claim path: an
  approval-gated or backfilled pending claim could reach the final acceptance mutation directly.
  The disposition adds the same pool-type and external-garden checks to
  `AcceptanceLib.acceptCommitment`, which is now the shared final boundary. Exchange and series
  continue to force individual claims.
- The existing execution-key tuple is domain-separated sufficiently once child shape is
  immutable. It need not add the disbursement kind.
- `gardenerDeliveryEnabled` should not gate a beneficiary Safe transfer.

## Required work after restoring this session

1. Re-read the exact dirty-tree state and preserve concurrent work.
2. Implement the review dispositions in pooling code/tests and the canonical active-plan
   artifacts.
3. Implement the settlement and Celo executor contracts plus their unit/script tests to
   the frozen specification. Put selector weight in libraries, not the module shell.
4. Complete the Envio schema/config/handler/test updates for payer identity, beneficiary
   disbursements, and derived flow direction. Do not claim Celo transfer observation from
   Envio; that leg remains outside its chain boundary.
5. Synchronize live Linear only after inspecting the current issue state:
   - create a Product successor issue that supersedes Done issue PRD-759, and comment on
     PRD-759 rather than rewriting its Done description;
   - comment on PRD-796 with the scoped ABI-freeze exceptions;
   - append an amendment block to PRD-686 and reset its overdue 2026-08-04 due date;
   - record GoodDollar's confirmation/circulation interest and close PRD-734;
   - add precise notes to PRD-721 through PRD-725 for `payerGarden`, the consideration
     rename, `GardenBeneficiary`/`ContributorConsideration`, and recipient semantics.
6. Produce a human-applied Google Doc change list. Do not edit the Google Doc. A live read-only
   check confirmed that the embedded `synthesis-circular-gd` image is already the current
   five-relationship triangle. Preserve it and correct its stale generic caption and adjacent
   GoodDollar/protocol-flow prose.
7. Update this prompt's disposition/status section with what was actually completed and
   what remains, then run every required gate.

## Scope boundaries and concurrent-work hazards

- Do not deploy, broadcast, or perform live onchain mutations.
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
- **Fork suite:** independently confirm the reported missing
  `HATS_MODULE_UPGRADE_FORK_BLOCK_NUMBER`; the fresh wrapper run also requires
  `HATS_MODULE_UPGRADE_GARDEN_COUNT`. Record both as pre-existing environment blockers and do not
  invent values or conflate them with payer changes.
- **Circulation metrics:** derive protocol-to-garden and garden-to-protocol settlement
  intent in the indexer, but state plainly that actual Celo transfer observation remains
  outside Envio's Arbitrum boundary.
- **Partner document image:** closed by live read-only verification. Tab 02 already embeds the
  current five-relationship triangle. Do not replace it; correct the stale caption and adjacent
  GoodDollar/protocol-flow prose through the human change list.

## Fresh completion evidence and live-state disposition

The implementing session ran the following proof after the final edits:

```text
contracts full suite:       1,842 Solidity + 100 script tests passed
pooling payer suite:        16 passed
settlement lifecycle:       11 passed
Celo executor:               5 passed
CCIP integration:            1 passed
dual-chain integration:      2 passed
indexer full suite:         193 passed
Repo Quick Gate:            passed
  shared:                 3,398 passed, 1 skipped
  client:                   658 passed
  admin:                    102 passed
  agent:                    245 passed, 1 skipped
full contracts build:        passed
contract lint:               0 errors
storage layouts:             all 14 matched
SettlementModule size:      23,346 bytes; 1,230-byte margin
CommitmentPooling size:     21,205 bytes; 3,371-byte margin
Celo executor size:         18,689 bytes; 5,887-byte margin
architecture closure:       passed (57 executable calls)
ontology, format, diff, hifi: passed
```

The fork wrapper stopped before running because fresh reviewed positive integers were absent for
both `HATS_MODULE_UPGRADE_FORK_BLOCK_NUMBER` and `HATS_MODULE_UPGRADE_GARDEN_COUNT`. This is an
environment prerequisite, not a payer-identity regression.

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
bun .plans/active/commitment-pooling/architecture-closure.validate.ts
bun run check:ontology
bun run format:check
git diff --check
bun .plans/active/commitment-pooling/hifi/validate.ts
```

For the fork blocker, run the repository's Bun fork-test wrapper after inspecting its
`--help` or package-script definition. Do not invoke Forge directly and do not invent an
environment value. For indexer and cross-package implementation, also run the exact
package-local tests/typecheck and the Repo Quick Gate:

```bash
node scripts/dev/ci-local.js --quick
```

Do not claim completion from inherited output. Capture fresh results in the same session,
including exact test counts and any environment-only blocker.
