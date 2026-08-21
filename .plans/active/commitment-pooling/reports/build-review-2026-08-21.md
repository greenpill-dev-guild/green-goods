# Commitment Pooling build review — 2026-08-21

Read-only review of how well Commitment Pooling is implemented in code and design, layer by
layer, taken from the PRD-650 issue tree. Baseline: `develop@665e8a573` plus the then-uncommitted
editorial backend on `feature/commitment-pooling-editorial@dea1aa7f6` (merged the same day as
PR #745 and PR #746). Three scoped review lanes (contracts; indexer + shared; client + design) plus
direct verification of every High and Medium finding quoted here. Published copy:
https://claude.ai/code/artifact/bfc7968a-a2dd-4d2c-9af8-c5b9c45b21a8

Every claim was checked against the tree, a test run, or an artifact; items marked *suspected*
were inferred from code paths without rendered proof.

## Status board

The short version: the backend is real and live, the read model that would make it visible is not
deployed, the member-facing client shipped a narrowed slice, and the steward-facing admin surface
does not exist yet.

| Layer | State | One fact |
| --- | --- | --- |
| Contracts | Live | 86 functions / 48 events / 20 libraries; deployed and unpaused on Arbitrum with 18 pools; 361 unit + 94 fuzz/invariant/integration tests pass; no Critical/High code defect; three Medium ops risks |
| Settlement & Celo | Built, paused | `SettlementModule` + `CeloSettlementExecutor` deployed, both paused, no Safe/Zodiac value authority; credit registry deployed; `SettlementModule` has 81 bytes of EIP-170 headroom |
| Indexer | Source complete, not deployed | 119/119 events handled, 28 pooling records, replay and out-of-order proofs, boundary check passes; the hosted Envio still serves the old schema without `CommitmentPool` |
| Shared state & API | Complete, fail-closed | Types, hooks, mutations, six offline job kinds, Saved Offers; 186/186 tests pass; the capability ledger reads `deployed-not-available`, so every pooling read and write is disabled in production by design |
| Client PWA | Partial | 4 of 19 prototype screens shipped in PR #740; 104/104 tests pass; three High findings, one of them on-chain data hygiene |
| Admin | Not started | 0 files against a 16-screen / 196-state prototype; the steward flows Cycle 1 needs have no UI; Linear PRD-725 shows In Progress |
| Editorial | Backend only | Public readers with the privacy gates intact (8/8 tests); no § 02 section on `/gardens/:id`, no `/impact` band; `PublicEvidencePipeline` i18n is a prerequisite |
| Docs, QA, videos | Deferred by design | PRD-727/728/729/730 wait for runtime UI and QA; docs carry one status line; the ontology has 9 pooling entities; no Storybook story exists for any pooling component |

## Outline of the work

**What is being built.** A garden names a Need. Members answer it with an Offer or a Request,
once or over time (an ongoing Offer is backed internally by a `CommitmentSeries` with finite,
pre-created places). Someone claims it, work and evidence attach, the person who received the work
confirms, and recognition follows what actually happened: 20% equal among contributors, 80% by
verified credit. Units live in a non-transferable register. No scores, ranks, or inferred
participant counts; the default at cycle end is "Ask me again next cycle"; a holder can rest,
resume, or retire an ongoing Offer. Two companion tiers sit on the same base: G$ split-state
settlement (Arbitrum `SettlementModule` sends message-only CCIP commands to a Celo executor that
moves G$ from per-garden Safes under Zodiac Roles caps) and a records-only credit register. Both
are deployed and paused.

**Architecture in one line.** `CommitmentPoolingModule` (control plane, 6 facets + 20 libraries) +
`CommitmentRegistry` (units) + `TestimonyResolver` (EAS) + `SettlementModule` /
`CeloSettlementExecutor` + `CreditRegistry` → Envio read model (28 pooling records plus settlement
and credit entities) → `@green-goods/shared` types, hooks, mutations, offline jobs → client PWA,
admin console, editorial site.

### The issue tree under PRD-650

| Issue | Lane | Linear | Code says | Verdict |
| --- | --- | --- | --- | --- |
| PRD-796 Freeze compatibility boundary | architecture | Done | `exchange-architecture-brief.md`, registers #86–#89 | accurate |
| PRD-788 Offer once / over time | architecture | Done | `SeriesLib.sol`, `CommitmentSeries` entity, `commitmentSeries` job kind | accurate |
| PRD-789 Prototype + gallery | design | Done | `hifi/` kit builds 37 screens / 516 states | accurate |
| PRD-721 Contracts | contracts | Done | Merged via #694/#705; 86 ABI functions resolve; deployed | accurate |
| PRD-686 Settlement | settlement | Done | Source + tests complete; proxies paused | accurate (value tier not activated) |
| PRD-800 Payer identity | settlement | Done | `payerGarden`, beneficiary shapes in PlanLib + schema | accurate |
| PRD-799 Resolver wiring | contracts | Done | `testimonyResolver` 0x2897… in artifact | accurate |
| PRD-814 Member-funded claims | contracts | Done | `FundingLib.sol` pledge → deposit → consume → refund; 21 + 9 tests | accurate |
| PRD-722 Indexer | indexer | Done | Source complete; hosted deployment not performed | accurate for source; release step open |
| PRD-723 Shared state/API | state_api | Done | Complete; ledger fail-closed pending read-back | accurate |
| PRD-724 Client UI | ui_client | Done (20 Aug) | W1/W2/W3/W5 shipped; 15 prototype screens and most acceptance items not built | **narrowed** — Done reflects the W1–W5 dispatch, not the acceptance list |
| PRD-725 Admin UI | ui_admin | In Progress (since 19 Aug) | No admin pooling code; hub says `blocked` | **mismatch** |
| PRD-726 Editorial | editorial | In Progress | Backend readers (merged as #745/#746 the same day); no UI | accurate |
| PRD-729 QA pass 1 | qa | Todo | Blocked on runtime UI | accurate |
| PRD-727 Docs · PRD-730 QA 2 · PRD-728 Videos | docs / qa | Todo | Sequenced after QA 1 by design | accurate |
| PRD-731 Release ops (spine, parentless) | release_ops | In Progress | Pooling unpaused 13 Aug; PRD-819 Celo Garden Safes open; PRD-733/821 done | accurate |
| COM-11 Settlement evidence | human | Backlog | Operational-assignment gate, due 30 Sep | accurate |
| PRD-697 Credit companion (related) | credit | In Progress | `CreditRegistry` deployed; PRD-786 state/API done | accurate |

Against the parent's own delivery order: steps 1–3 are done; step 4 is half done (contracts
activated and receipt-verified, hosted reindex and live read-back pending); steps 5–6 (PRD-737,
PRD-760) are done; step 7 is one-third done (client only).

## Contracts

**Verdict: Live.** Complete against the frozen spec, well tested, and deployed. The risks are
operational, not in the Solidity.

Evidence: `ICommitmentPoolingModule.sol` declares 86 functions, 48 events, 108 errors; with 6
registry and 4 funding events this reconciles the hub's "58 events". Targeted run: 25 suites / 361
unit tests and 94 fuzz + invariant + integration tests pass; 1,885 test declarations in the lane
(the hub's "1,754" predates the library split). Bounds frozen at 40 with the cold 8/16/24/32/40
matrix (`CommonLib.sol:35-39`, `CommitmentPoolingBounds.t.sol:421-541`). Deployed on Arbitrum:
module 0x6BB5…470a (unpaused), registry 0x6630…3959, settlement 0x15c8…935D (paused), credit
0xcfF1…6A34, testimony 0x2897…2329. Celo executor 0xB8a7…a84F (paused, `authorityEnabled: false`).
Unpause tx 0x6912…27a4 at block 493,999,183.

| Capability | Where | Tests | State |
| --- | --- | --- | --- |
| Pools: register, charter, ready/open/pause/resume/close/compost, provider cap | `PoolsLib`, `Admin.sol` | 19 + 7 | done |
| Cycles: Season/Campaign, one-open-Season guard, allocation + recognition policy at open | `CyclesLib` | 11 | done |
| Create Offer/Request, idempotent `creationRequestKey`, frozen payload hash, derived requirements | `CreationLib`, `CreationChecksLib` | 19 + 12 | done |
| Claim (open / approval-gated × individual / garden), priced-Offer steward gate | `ClaimsLib`, `AcceptanceLib` | 5+ | done |
| Roster + atomic freeze at ReadyForConfirmation | `RosterLib`, `CreditLib.sol:53-81` | 10 + 2 invariants | done |
| Evidence, assessment v3 attachment, Work-credit bridge | `ProofLib`, `WorkCreditLib`, `SyncLib` | 17 | done |
| Confirmation: named/default, pool and protocol fallback | `ConfirmLib` | — | done |
| Recognition 20/80 canonical validator | `RecognitionLib` | 13 + 7 fuzz | done |
| Series: rest/resume/retire, holder-only, idempotent | `SeriesLib` | 17 | done (places are ordinary Offer instances) |
| Bilateral `acceptExchange` | `ExchangeLib` | 15 | done, free Offers only by design |
| Terminal: cancel / expire / dispute / resolve | `TerminalLib` | 11 | done |
| Terms: consideration, declared value, confirmer rule | `TermsLib` | 13 | done |
| Member-funded claims with refund | `Settlement/FundingLib` | 21 + 9 invariants | done, value tier paused |
| Payout plans, disbursements, batches, CCIP dispatch + ack | `Settlement/*Lib` | 21 + 22 + 5 + 9 | done, paused in prod |
| Celo executor: Zodiac Roles transfer, caps, balance-delta proof | `CeloSettlement/Execution.sol` | 9 + 27 | done, no authority |
| Credit register | `registries/Credit.sol` | 31 + 25 | done |

Findings:

- **Medium.** One EOA is upgrade authority, dependency admin, and steward of every pool.
  `GuardLib.sol:47,64` and `CreationChecksLib.sol:24-25` treat `env.owner` as steward of all 18
  pools; `_authorizeUpgrade` is bare `onlyOwner` on the module, registry, and resolver. With the
  `markReadyForConfirmation` and `resolveDispute(Fulfilled)` overrides, one key can fulfil any
  commitment that carries a single credit. Spec-intended for the pilot; the Safe transfer is
  deferred and this wave replaced the external audit with internal review. A known ops decision,
  to be written down where the value tier is gated.
- **Medium.** Storage-layout and ERC-7201 gates are manual only. Baselines exist and match
  (`storage-layouts/*.json`, 38 slots + `__gap[12]`), but `.github/workflows/contracts.yml:148` runs
  only `check:sizes`; `check:storage-layout` and `check-erc7201-layout.ts` are in neither CI nor
  any deploy/upgrade wrapper, and `script/upgrade.ts` has no named target for the six new proxies.
  Pooling upgrades also do not require pause, unlike Settlement and Celo.
- **Medium.** `SettlementModule` has 81 bytes of EIP-170 headroom
  (`check-contract-sizes.ts --skip-build`: 24,495 bytes; CreditRegistry 22,055;
  CommitmentPoolingModule 21,217; CeloSettlementExecutor 20,243).
- **Medium (product).** Permissionless, irreversible expiry of a ReadyForConfirmation commitment:
  `expireCommitment` accepts it with no auth (`TerminalLib.sol:64-72`) and a formerly-expired record
  can never resolve to Fulfilled (`:147-150`). Spec-accepted (`contract-spec.md:250`); the product
  copy and confirmation window should make this visible.
- **Low.** Error reuse hides the failing condition (`SourceMustBePaused` in both directions,
  `ReasonRequired` for empty series metadata, `InvalidAllocation` 7×); confirmer rules that can
  never reach threshold pass creation and edit (`CreationChecksLib.sol:297-312`) and fail at claim
  time; recognition fuzz depth pinned to 96 inline; NatSpec names retired facets; the artifact
  records no paused flag for settlement/executor and no unpause receipt; `deployments/README.md`
  never mentions pooling.

What is right: the module, its 20 libraries, the registry, and the resolver contain no
token-moving primitive; G$ moves only from a garden Safe through Zodiac Roles with pre-flight caps
and post-transfer balance proof; every `catch` converts to a named error or deferral code with
state; no string reverts, no TODOs; the facet-plus-library structure is a clean answer to the size
wall.

## Indexer

**Verdict: Source complete, not deployed.** The read model is thorough and honest; it is simply
not serving production yet.

Evidence: interface events, `config.yaml`, and handler registrations agree at 119 events across
five contracts (48 module, 6 registry, 36 settlement, 15 Celo, 14 credit); `routeEvent` throws on
anything unrouted. 26 pooling records (plus one handler-internal index) + `CommitmentFunding` /
`CommitmentFundingIndex` = the 28 records. `node scripts/check-indexing-boundary.mjs` → "15
contracts validated, 3 chains validated". Addresses match the deployment artifacts.

Design holds up: every pooling event passes an audit row keyed `chainId-txHash-logIndex` before it
mutates anything, so replay is idempotent; eight lifecycle events that arrive before
`CommitmentCreated` park in `CommitmentPendingLifecycleProjection` and drain in order; no pooling
handler deletes, fetches, catches, or logs; no `score`, `rank`, or `rate` field exists in the
pooling block; `distinctProviderCount` is monotonic and publishes a number, never a list.

- **Release.** The hosted Envio serves the old schema; the production indexer has no
  `CommitmentPool`. Order is forced: merge the editorial readers (done, #745/#746) → deploy hosted
  Envio → full reindex → live read-back → flip the ontology projection.
- **Medium.** `CreditRegistry` is not statically pinned on 42161 (`config.yaml:232-234` discovers
  it from `SettlementModule.CreditRegistryUpdated`, which misses `CreditRegistryInitialized`).
- **Low.** `codex-indexer.md` promises 421614/11142220 chains the config does not carry. Event
  signatures were matched by name and count and spot-checked structurally for three events, not
  byte-compared against the compiled ABI for all 119.

## Shared state & API

**Verdict: Complete, fail-closed.** The offline-first contract is met and the mutation surface is
disciplined.

Evidence: `bun run test -- commitment` → 17 files / 186 tests pass; disclosure, saved-offers,
settlement selectors → 5 files / 63 pass; editorial readers → 3 files / 8 pass.

In place: six offline job kinds gated and prepared in `addJob` and routed to
`executeCommitmentQueueJob`; request keys derive deterministically at enqueue and recovery reads
the on-chain id-by-request-key before any send; offline enqueue is network-free; all five
contract-mutation hooks use `createMutationErrorHandler`; no `console.*`, no log-only catch;
invalidation through `queryKeys.commitmentPooling.*`; `PoolMemberHistory` has exactly one consumer
and a test that walks `client/src` and `admin/src`; the public kept-rate selector gates at 5 due /
3 distinct providers and returns a pair, never a float; Saved Offers are AES-256-GCM in the agent
with `SAVED_OFFERS_ENCRYPTION_KEY` + `SAVED_OFFERS_AUDIENCE` required in production.

How availability works: `useCommitmentPoolingAvailability` reads the generated ontology manifest,
where `entity:commitment-pool` on 42161 is `integration: partial, availability:
deployed-not-available` (verified 2026-08-16). That makes `addJob` throw for every commitment
kind, disables authenticated queries, and makes online mutations throw. It is a build-time ledger
flipped by editing the projection JSON and regenerating, not a runtime read-back probe.

- **Medium (editorial readers).** The `/impact` "support arrived" sum counts every disbursement
  kind and token: `data-public-impact.ts:73` filters only on `state: CONFIRMED`; `DisbursementKind`
  includes `FUNDING`, `LOAN_PRINCIPAL`, and `REFUND`, and `token` is per row. Filter to
  consideration kinds and one token before the band ships. Still open on `origin/develop` after
  PR #746 (`data-public-impact.ts:77`); #746 fixed the separate open-pools-only scope of the
  lifetime totals.
- **Medium.** No cross-package vector for the creation payload hash
  (`hashCommitmentCreationPayload` in `job-identity.ts:159-252` vs
  `CreationChecksLib.creationPayloadHash`); silent drift surfaces as a terminal `identity-conflict`
  on the first exact replay.
- **Low.** `useCommitmentQueueState` builds an ad-hoc query key; `usePublicGardenPool` borrows the
  `gardenDetail` key namespace; `modules/commitment-pooling/index.ts` re-exports two hooks; public
  readers skip the ledger and warn on every public garden page until the deploy; the pool reader
  awaits every IPFS cycle-name resolution before returning counts; confirm/claim jobs carry no
  identity key; the `/impact` lifetime totals filtered `state: OPEN` pools only at review time
  (fixed in PR #746).

## Client PWA

**Verdict: Partial.** A clean, token-true slice of the member journey that stops short of the
acceptance list, with three High findings that should land before anyone deep-links into a live
pool.

Evidence: PR #740 shipped W5 (commitments sheet), W1 (pool tab), W2 (detail), W3 (composer) and
the shared seat/inbox/queue layer; it touched no shared component. Targeted run: 12 files / 104
tests pass. Five adversarial review rounds closed (sampled six round-3 findings: five closed, one
open on the detail bar).

| Prototype | States | Shipped | Status |
| --- | ---: | --- | --- |
| W5 Commitments sheet | 19 | `Home/CommitmentsDrawer/*` | shipped (Live, Over time); no steward "To confirm" tab; rows do not open anything |
| W1 Pool tab | 33 | `Garden/Pool/*` | partial: lifecycle notices, rail, direction chips, list; no cycle names/dates, no claim-request panels, no queued/sync-failed rows, single entry button instead of two doors |
| W2 Commitment detail | 85 | `Garden/Commitment/*` | partial: seat band, one act, requirement rows, withdraw; no support rows, dispute states, timeline, linked work, evidence preview |
| W3 Composer | 34 | `Garden/Compose/*` | partial: four beats, service-only; no templates, saved offers, once/ongoing, DomainImpact rows, declared value, named confirmers |
| W2b Team | 13 | `CommitmentPeople.tsx` | lead + helper count only |
| W4 Confirmation | 29 | bar button | no sheet, no "Not yet" → `raiseDispute` |
| W1C · W2a · W23 · W25 · W28–W31 · W32 · W34 · W35 · W36 · WFLOW | 96 | — | not started |

Findings:

- **High.** On a deployed-but-unavailable chain, every deep link says "commitment not found".
  `useCommitment` disables its query unless available, returning `detail = null, isLoading =
  false, isError = false`; `GardenCommitment.tsx:91` tests that shape as "not found" before the
  availability branch at `:103`. This is the exact production state today. The test passes only
  because its fixture keeps `detail` populated while unavailable.
- **High.** The withdraw reason goes on-chain as a fake CID. `WithdrawDialog.tsx:62` emits the raw
  textarea text; `GardenCommitment.tsx:285-291` forwards it as `reasonCID`;
  `useCommitmentMutations.ts:103-105` passes it unchanged to
  `cancelCommitment(uint256, string reasonCID)`.
- **High.** The inbox has no door. Neither tab passes `onOpen` (`LiveTab.tsx:152-161`,
  `OverTimeTab.tsx:160-168`); `needsYou` is hard-coded `false` (`GardenPool.tsx:75`).
- **Medium.** "Add proof" and "Offer it again" both navigate back to the garden
  (`GardenCommitment.tsx:216-218`); `band.provider.active.b` copy points at sections that do not
  render.
- **Medium (suspected).** A failed queue read re-arms the action bar (`GardenCommitment.tsx:76`
  reads only `pendingCommitmentIds`); confirm/claim jobs carry no identity key
  (`job-identity.ts:90-130`).
- **Medium.** The composer diverges from the locked spec: `uiux-spec.md:685-687` forbids an
  in-form Direction control; `ComposeKind.tsx:17-69` is one, entered from a single button
  (`GardenPool.tsx:135-142`).
- **Low.** `tap-target` is not a defined utility (five chip sites below 44 px); the bottom nav
  stays under the action bars (`AppBar.tsx:22,35`); the commitments drawer is missing from
  `isAnyDrawerOpen`; untranslated "Other" (`grouping.ts:21`) and "Pool" in es/pt; progress bars
  without accessible names; duplicated heading; block content inside `<button>` rows; duplicated
  chip group; `CycleRail` omits names and dates; requirement rows read "Requirement N".

What is right: zero hardcoded easings, durations, colors, or `--m3-*`; one primary CTA per screen
and no green flooding; reduced motion covered by the global clamp; `lint:vocab` clean; 225 pooling
keys with full es/pt parity; no hooks defined in the client; no effects or timers; presentation
split into `presentation.ts` / `statusBand.ts` / `commitmentActions.ts`; the ladder handles
unavailable → loading → error → offline → empty with the right roles.

## Admin console

**Verdict: Not started.** The steward half of the product exists only as a prototype, and it is
the half Cycle 1 cannot run without.

`packages/admin/src` contains no pooling view, hook consumer, or test; the only "pool" file
(`views/Garden/SignalPool.tsx`) is Community Needs. The three RED-first test files named in
`claude-ui-admin.md` do not exist. The hub lane is `blocked`; Linear PRD-725 moved to In Progress
on 19 Aug. The prototype covers the whole scope (W7, W7C, W7M, W8, W9, W10, W11, W12, W13, W14,
W37, W21, W22, W24, W26, HUBWORK); `reports/admin-prototype-follow-up-2026-08-11.md` lists seven
unapplied corrections. Opening Cycle 1 requires a steward to seed a pool, open a cycle with an
allocation, accept or decline claims, and confirm or resolve; none of those acts has a UI. The
admin needs the same kind of narrowed dispatch the client got (W7 + W10 + W13 + W11).

## Editorial website

**Verdict: Backend only.** The privacy-preserving readers are done and well tested (merged in
#745/#746); the two public surfaces that consume them are not started, and one prerequisite is
open. `views/Public/GardenDetailSections.tsx` renders § 02 Certificates and § 03 Operators; no
commitments section and no client consumer of either hook. `PublicEvidencePipeline.tsx:125` is
still `md:grid-cols-3` with only the caption internationalised.

## Design

The prototype system is unusually rigorous: `hifi/` builds 37 presentation-visible screens / 516
states, 55 flows / 323 scenes, 743 hotspots, a Components tab with 101 entries, and validates
itself (`RETIRED_VOCABULARY`, `ALLOWED_ENTRY`, echo pairing, the generated
`commitment-view-state-reference.md`). PRD-760 is closed. Thin spots: the two editorial screens
carry 11 states; the admin follow-up list is open.

| Lens | Result | Evidence |
| --- | --- | --- |
| Tokens (motion, color, radius) | Clean | No `cubic-bezier`, ms durations, hex, `rgba(`, or `--m3-*` in pooling views |
| Volume hierarchy | Clean | `bg-primary-action` ×4 (one CTA per screen); `success-*` only on the kept band |
| Concentricity | Nit | Uniform 16 px on cards, buttons, inputs, notices; inner icon tile 8 px where the formula gives 4 px |
| Component palette | Mostly | Built from `Alert`, `StatusBadge`, `DialogShell`, `ModalDrawer`, `EmptyState`, `FormProgress`; form fields hand-rolled without `aria-invalid` / `aria-describedby` |
| Storybook | Missing | No story for `CommitmentRow`, `CommitmentStateLadder`, `CycleRail`, or any pooling view |
| PWA vs browser chrome | Suspected | Bottom nav remains under in-flow action bars |
| Accessibility | Mostly | Dialog/tab roles, focus trap, `role="status"` queue notes, labelled inputs; gaps: undefined `tap-target`, unnamed progress bars, block content in buttons, no `aria-labelledby` on the inherited drawer |
| Copy & vocabulary | Clean | `lint:vocab` passes; no promise/score/rank/reputation; es/pt parity complete; two untranslated labels |
| Prototype fidelity | Diverges | In-form direction control and single entry button vs the spec's two doors; inbox rows inert; cycle rail without names/dates |

## Tracking drift

- PRD-650's body still says "The product has not been implemented or deployed yet" and names
  PRD-721 as the next lane; four build lanes are Done and the contracts are live.
- PRD-725 is In Progress with no admin code; the hub lane is `blocked` (the hub is right).
- PRD-724 Done covers the narrowed W1–W5 dispatch while the issue body's acceptance list is largely
  unbuilt.
- `plan.todo.md` Requirements Coverage still shows ⏳ for PRD-721, PRD-686, and PRD-724; Track B
  step 8 is unchecked although the unpause is receipt-verified.
- `codex-state-api.md:9` calls the seat amendment open (it landed); `codex-indexer.md` names chains
  the config does not have; `handoffs/README.md` still lists client/admin/editorial as blocked
  behind state/API.
- The deployment JSON records no paused flag for settlement/executor and no unpause receipt; the
  hub's "1,754 tests / 135 suites" predates the library split.

## Ranked risks

1. The product is dark in production: live contracts, no hosted read model, ledger fail-closed.
2. One EOA owns every proxy and is steward of every pool; Safe transfer deferred; no external
   audit this wave.
3. Client Highs on the live path (not-found ordering, raw reason as CID, inert inbox).
4. Upgrade safety unwired (storage-layout / ERC-7201 manual; no named upgrade targets).
5. Admin surface does not exist, and Cycle 1 is a steward act.
6. `SettlementModule` at 81 bytes of headroom.
7. Public totals can overstate (`/impact` kinds/tokens; pool reader blocks on IPFS).
8. `CreditRegistry` not statically pinned in the indexer.
9. Permissionless expiry of ready commitments.
10. Hygiene: no Storybook stories, stale handoffs and tables, error reuse, NatSpec, no
    cross-package payload-hash vector.

## Suggested next moves

1. Deploy the hosted Envio with the pooling schema, full reindex, live read-back, then flip the
   ontology projection; pin `CreditRegistry` in `config.yaml` at the same time.
2. Land the three client Highs before the flip (`prompt-client-loop.md`, Phase 0).
3. Scope a narrowed admin dispatch: W7 pool console, W10 detail, W13 confirmation queue, W11 cycle
   open.
4. Wire `check:storage-layout` and the ERC-7201 check into CI and the upgrade wrapper; add named
   upgrade targets for the six proxies.
5. Reconcile the record: PRD-650 body, PRD-725 state, PRD-724 scope comment, the hub's coverage
   table and Track B step 8, the three stale handoffs.
6. Date the ownership and audit decisions before the value tier unpauses.
7. Add stories for the pooling components and a Storybook pass on the composer's two-door entry.

## Evidence

Commands run (all read-only):

```
packages/contracts  bun run test:solidity -- --match-path 'test/unit/{CommitmentPooling*,…}.t.sol'
                    → 25 suites · 361 passed · 0 failed (0.83 s, test profile, no recompile)
packages/contracts  fuzz / invariant / integration / bounds set
                    → 94 passed · 0 failed (7.06 s; invariants 16 runs × 96 depth)
packages/contracts  bun script/utils/check-contract-sizes.ts --skip-build
                    → all fit; WARN SettlementModule 24495 B (margin 81)
packages/indexer    node scripts/check-indexing-boundary.mjs
                    → passed: 15 contracts, 3 chains
packages/shared     bun run test -- commitment
                    → 17 files · 186 passed (8.53 s)
packages/shared     bun run test -- pool-member-history-disclosure saved-offers settlement-selectors settlement-aa-profile
                    → 5 files · 63 passed
packages/shared     bun run test -- usePublicCommitmentImpact usePublicGardenPool cycle-metadata
                    → 3 files · 8 passed
packages/client     bun run test -- Commitment GardenPool PublicGardenDetail commitmentActions commitmentGrouping HomeGarden Home.test
                    → 12 files · 104 passed (27.8 s)
root                bun run lint:vocab
                    → no banned vocabulary found in 3 i18n file(s)
```

Not verified here: the hosted Envio schema (taken from the editorial handoff and the ontology
ledger); fork suites (`ArbitrumCommitmentPooling.t.sol` 36 tests, `CrossChainSettlementLane.t.sol`
7) need RPC; event signatures matched by name and count; no rendered browser proof; no chain state
queried.
