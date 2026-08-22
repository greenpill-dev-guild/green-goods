# Commitment Pooling - Claude Admin UI Handoff

## Status

- Execution sub-lane: ui_admin
- Machine lane: ui
- Owner: Claude
- Branch signal: feature/commitment-pooling-admin-ui
- Current state: prototype/journey review may continue; feature implementation waits for core
  state_api, verified non-value deployment/indexer output, and completion of the scoped existing
  admin-console fixes and polish led by PRD-737; settlement controls wait for settlement selectors
- Linear context: PRD-725 (admin UI lane) under parent PRD-650; PRD-682 is Community context

Concurrent agents share this repository. Stay inside the admin lane's named paths, preserve
unrelated working-tree changes, and do not switch the primary tree's branch.

## Inputs

- GREEN shared hooks/selectors and indexer query contract
- Corrected admin contract: CanvasLayout, /hub reference, and /community route
- uiux-spec.md Appendix E, W28–W31 pair/template frames, admin frames, and the settlement
  batch/CCIP command-ack state contract
- acceptance-matrix.md for exact role/permission, copy/state, payout, and final-proof contracts
- Existing Admin wrappers, Storybook-backed shared primitives, and authenticated Brave access

## Outputs

- Garden pool console with one-open-Season plus concurrent-Campaign management, scoped seeding/state counts/exact-label summaries, analog capture, gated claims, confirmations, disputes, assessment v3, allocation, and settlement controls.
- Pair oversight distinguishes proposed, atomically matched, and counterpart-lapsed derivations.
  Claims choose one accountable lead; contributor team formation remains a separate roster action.
  Admin copy follows Appendix E.3 while retaining the full operational settlement states.
- Protocol-pool plus current-garden Pools mode inside admin `/community`; no new top-level Pools
  route. Alphabetical all-garden oversight and batch/CCIP operations live in the capability-gated
  Operations workspace. `showOperations = isDeployer || canQueueFunding || canOperateSettlement`;
  W21/W22 remain garden-scoped detail/recovery exceptions.
- Fulfilled priced `CeloSettlement` commitments use payer-garden payout-plan actions. Shape is
  immutable: contributor plans allow Draft vector edits, then finalize and idempotently prepare
  non-zero rows; Garden-claimed Requests freeze one external garden Safe, allow no contributor
  edit, then finalize and idempotently prepare that beneficiary child.
  There is no sixth offline settlement job or per-device arrangement state. Operations Flows
  separately provides **Seed / top up garden** only when onchain `canQueueFunding` resolves to
  protocol steward or SettlementModule owner; deployer alone cannot submit. The review states
  that it does not fulfill, consideration, or alter a commitment, cancel creates no queue entity, and
  success renders a typed `Funding` / `ProtocolToGarden` Queued row with no commitment ID.
- Immutable batch-membership view with the measured configured 0–24 limit and hard ceiling of 24, whole-batch cancellation while Queued, per-member retry/cancel only after authenticated failure, command/execution/acknowledgment states, native ETH/CELO fee floors and low-balance state, active/previous peer expiry, Safe/Roles/cap health, and disabled-member-delivery disclosure.
- Operator-visible reasons, blast-radius confirmation, accessible dialogs, and en/es/pt copy.
- Core seeding emits the full creation payload, including the explicit consideration rail. `None` clears
  consideration fields, `ArbitrumExternal` explains the later record-only payout action, and
  `CeloSettlement` requires payer-garden Safe/canonical-G$ readiness and, for beneficiary shape,
  the active external receiving Safe, without exposing
  `recordConsiderationPaid`. It also enforces cycle/pool and repeatable DomainImpact requirements, shows
  the app-preflight Baseline alongside the onchain charter/provider-open-commitment-cap blockers,
  supports evidence/Work/Assessment v3 attachment, and exposes explicit Ready
  submission/authorized override.
- DomainImpact creation uses 1–`MAX_REQUIREMENTS` ordered `{ actionUID, requiredCount }` rows,
  derives domain tags through ActionRegistry, permits actions in the same domain, and renders
  `approvedCount / requiredCount` plus canonical per-commitment `approvedUnits`. The UI starts
  with four rows and adds more; it never presents four as the product maximum.
- Pool/cycle overview rows use state counts and `openCommitmentCount`; exact-label unit groups remain separate and case-sensitive, and `promiseKeptRate` is the only cross-commitment percentage.
- Pool close reads indexed `Pool.liveCommitmentCount` and `Pool.nonTerminalCycleCount`. The action
  is enabled only when both are zero; otherwise W7 names that live promises must be wound down and
  links to commitment/cycle recovery. Open and Paused pools retain cancel/expire/resolve plus
  cycle cancel/compost controls until the guard passes.
- `W7@due-live` renders every past-due commitment that is still live with **Expire now** and calls
  permissionless `expireCommitment`. It routes to `W7@expiry-queue` only after indexed Expired
  success; failure keeps the due-live row and never claims capacity or live-count release. The
  later keeper is only a backstop.
- Offered/Requested W7 rows may open `W10@edit-declared-value`; the complete value/basis pair uses
  the shared `setDeclaredValue` mutation. Accepted/terminal rows have no edit and historical
  instance snapshots are unchanged.
- Cycle seeding carries no allocation or recognition policy. The open-cycle step accepts the six
  allocation percentages plus equal/verified recognition percentages, converts both groups to
  basis points, requires each group to total exactly 10,000, and submits both snapshots atomically
  through `openCycle(cycleId, allocation, recognitionPolicy)`.
- Hypercert allocation consumes the shared metadata composer and indexer `bundleKind`/`commitmentIds`/ascending-unique-`needUIDs` outputs.
- `W10@accepted` uses one locked action row: “Send for confirmation” is available only when required evidence is complete; “Cancel promise” opens the reason-required `W10@cancel` steward dialog; “Mark ready” opens the authorized reason-required `W10@mark-ready-override` flow and is visually distinct from ordinary evidence completion. The row never implies that acceptance alone made the commitment Ready.
- `W10@attach-assessment` is the only assessment-attachment placement. It filters to eligible Assessment v3 records for the commitment’s accepted `providerGarden`, records the selected assessment before Ready submission, and exposes an empty/ineligible state instead of attaching an unrelated garden’s assessment.
- Core seeding exposes a protocol-fallback choice before acceptance — on by default for the pilot (register #94, opt-out per promise). W10 and W13
  render indexed `Ordinary`, `PoolFallback`, and `ProtocolFallback` paths with the confirming actor
  and reason; cross-garden protocol-fallback rows are visually and textually distinct from local
  garden confirmations. A fallback action or queue row appears only when indexed eligibility proves
  the ordinary named/default path cannot reach threshold; ordinary-reachable W10 detail never
  offers a transaction that would revert `OrdinaryConfirmationStillReachable`.

## Acceptance

- All writes use shared mutation hooks; no view calls contracts directly.
- `/community/pools` follows CanvasRouteFrame/CanvasRouteHeader and restrained command-surface grammar, and never exposes another garden's pool.
- Request rows expose indexed canonical claimant, authenticated `requestedBy`, `claimType`, `gardenContext`, requestedAt/state/reason/resolution fields and the accepted result exposes derived `providerGarden`. Decline changes only that row; acceptance consumes the matching contract-stored terms and supersedes every other pending indexed row; claimant re-request and direction-aware confirmation are visible.
- Pool pause requires a reason and disables only new commitments, claims, Ready submissions, and confirmations; evidence/linkage and safe recovery remain available. Provider open-commitment caps are steward-gated and class quotas are not editable.
- `closePool` can never be submitted from a state with live commitments or a Seeded/Open/
  Reconciled cycle. The confirmation carries zero-count facts; non-zero states expose no call.
- Past due alone never renders Expired. `W7@due-live` submits `expireCommitment`, preserves the
  live row on failure, and exposes re-seed/history only from the indexed post-success queue.
- The pre-acceptance declared-value editor is reachable only from Offered/Requested facts and
  emits `setDeclaredValue`; it never rewrites an Accepted or historical instance.
- In `W10@accepted`, steward cancellation and the authorized Ready override both require a captured reason; confirmation remains unavailable until the normal evidence gate or the explicit override has produced Ready. The three actions retain separate permissions, labels, and audit outcomes.
- `W10@attach-assessment` accepts only the eligible Assessment v3 set scoped to the accepted `providerGarden`; no assessment from another provider or garden can be selected, and a required-but-empty set blocks normal Ready submission with a recovery explanation.
- Opening a second Season is blocked with the existing Season identified; multiple Campaigns remain independently operable and every count or exact-label summary names its cycle scope.
- A Queued batch exposes one blast-radius-confirmed whole-batch cancel action and never a per-member cancel. A rejected batch cannot be edited or requeued wholesale; only Failed members can be requeued or terminally cancelled. The UI preserves the failed attempt/failure code and distinguishes that closeout from an atomic Queued pre-send batch withdrawal or an unbatched Queued cancellation.
- Dispatch or Celo execution never marks settlement Confirmed. Same-key command retry, stored acknowledgment retry, authenticated failure/new-attempt, derived delivery delay, CCIP manual-execution guidance, command/destination/acknowledgment IDs with Explorer links, and ignored stale/duplicate acknowledgment behavior are legible.
- When member delivery is disabled, the fulfilled commitment, payer-garden payout plan,
  retention, unprepared rows, and historical child states remain visible. First contributor-child
  preparation and member sends are unavailable, while GardenBeneficiary Safe preparation remains
  available when both accounts are active. An unprepared row exposes no retry. Separate
  ProtocolToGarden treasury funding may continue; it is not a GardenBeneficiary alias.
- Operations route/nav access and every action are tested independently: a protocol steward or
  module owner can reach and submit funding without deployer role; a deployer with neither
  funding authority cannot submit it; settlement operators see only their authorized controls.
- Safe view shows 2-of-3 recovery and separates owners from scoped executors.
- Account setup never claims to deploy a Safe: it explains the Release-gated Safe/Roles prerequisites and registers only an already-deployed, live-verified route.
- Loading, empty, offline, waiting, declined, failed, retry, queued, dispatched, executed/acknowledgment-pending, delayed, and Confirmed states have accessible recovery.
- Authenticated Brave verifies operator-critical desktop and mobile composition.

## RED / GREEN

- RED: route, workspace-model, component, and mutation tests fail for /community placement, full seeding payload/cycle checks, readiness/cap/pause behavior, due-live expiry success/failure truth, pre-acceptance declared-value editing, assessment/Ready/override flow, canonical request identity, Hypercert allocation, Season uniqueness plus concurrent Campaigns, batch bounds/recovery, atomic Queued-batch cancellation with no partial-entry control, CCIP command/ack states, fee health, and Safe role separation.
- GREEN: the same tests pass; admin build passes; authenticated Brave proves the live operator flow.

## Exact Bun commands

The three named admin test files do not exist yet; they are intentional to-be-created RED-first deliverables of this lane.

- bun run --filter @green-goods/admin test -- src/__tests__/views/CommunityPools.test.tsx
- bun run --filter @green-goods/admin test -- src/__tests__/routing/community-pools-route.test.tsx
- bun run --filter @green-goods/admin test -- src/__tests__/settlement-ccip-flow.test.tsx
- bun run --filter @green-goods/admin build
- bun run lint:vocab
- bun run agentic:check
- bun run check:design-md
- bun run check:design-generated
- bun run check:design-tokens

## Out of scope

- A top-level Pools route, legacy DashboardLayout/Sidebar/Header, direct contract/RPC writes, in-app arbitrary Safe execution, manual settlement confirmation, garden-held member claims, rankings, credit, or client hero moments.

## Unblock evidence

- Core admin dispatch requires core state_api GREEN, verified non-value deployment and live
  indexer read-back, and completion of the scoped existing-admin fixes/polish. Settlement
  batching/CCIP/Safe controls remain blocked until settlement selectors are GREEN; core GREEN is
  not full settlement GREEN.
- /community placement and corrected admin wireframes are recorded.
- RED proof precedes implementation.
- GREEN includes targeted tests, build, and authenticated Brave proof for seeding, claims, dispute recovery, batching, command dispatch, execution/acknowledgment status, failure, fee/delivery delay, and each distinct retry action.

## Binding architecture amendment — 2026-07-28

- Seeding and detail surfaces expose the accountable lead, contributor policy/roster, repeatable requirements, and roster freeze.
- Ready and direct dispute-fulfillment controls expose the non-zero verified-contributor gate and
  either the opened cycle policy or immutable cycle-less 20/80 default. A direct Fulfilled
  dispute result shows the roster as frozen before recognition or payment becomes available.
- Recognition review shows the canonical equal-commitment then policy-defined gardener formula.
  The payment editor starts from those weights, makes garden retention explicit, and requires a
  reason only when a steward changes the contributor weights.
- Hypercert commitment-bundle selection includes only fulfilled commitments from the selected
  non-zero cycle. Cycle-less rows remain visible for recognition/payment history but are disabled
  with “No cycle allocation · not certificate eligible”; they never reach allowlist or metadata
  construction.
- Settlement separates Save draft, Finalize payout plan, and per-contributor Prepare payout.
  Finalization creates no child; preparation is visibly idempotent and creates one Queued child
  from a frozen non-zero row. Any non-zero retained amount is a divergence and requires visible
  non-empty reason input even when contributor payment weights still mirror recognition. The
  surface shows recognition/payment hashes, amount-derived weights, reasoned divergence,
  all-retained zero-child completion, and Draft / Pending / Partial / Complete / Failed without
  rewriting fulfillment. Recovery acts on the failed child and never clears the stable parent
  pointer.
- Protocol Safe to garden Safe value appears only as Funding / ProtocolToGarden created through
  `queueFunding`; the admin queue never labels or routes it as a garden-beneficiary commitment
  consideration.
- Payout-plan draft actions render only when the provider-garden settlement account is Active;
  external-record and Celo allocation actions remain mutually exclusive by consideration rail.
- W10 filters dispute-resolution outcomes against the connected steward. When that steward is an
  active contributor, Fulfilled is hidden or disabled with a `SelfConfirmation` explanation; only
  an eligible non-contributor steward may submit the separately policy/credit-gated outcome.
- W26 requires every commitment terminal and `liveCommitmentCount == 0`, calls `closeCycle` first,
  and only then exposes share review and certificate minting from the locked Reconciled bundle.
  The count comes from `CommitmentCycle.liveCommitmentCount`, not provider-capacity exposure.
  The shared composer independently requires exact on-chain Reconciled state for both W26 and
  `/hub/certify/create`; route entry cannot bypass close. `compostCycle` is the final post-mint
  action; mint-before-close is never offered.
- Use the W10/W11/W21/W22/W26 states and SB-33 in the hi-fi artifact as the accepted surface contract.

## Binding confirmation amendment — 2026-08-02

- W8 persists the `protocolFallbackEnabled` choice — on by default for the pilot (register #94,
  2026-08-10, superseding this amendment's earlier off default; opt-out per promise) — in the full
  creation payload and repeats it at review. Missing registered protocol-pool identity disables the
  choice with an operator-facing repair path.
- W10 local fallback requires current steward/owner authority in the commitment's own garden.
  W10 protocol fallback requires explicit opt-in plus current steward/owner authority in the
  registered Green Goods protocol garden. A wallet holding both authorities uses and renders
  `PoolFallback`; module ownership alone provides no confirmation action.
- W10 and W13 consume the indexed ordinary-reachability result before rendering either fallback
  entry. The ordinary-reachable detail keeps only its valid ordinary/dispute actions; the separate
  fallback-eligible state names why the ordinary threshold is unreachable and requires a reason.
- Every reasoned confirmation review names the garden whose authority is being used. Confirmation
  history and W13 queue rows render indexed actor, `confirmationPath`, and `fallbackReason`, with
  explicit “your garden steward — fallback” versus “Green Goods team — fallback” labels.
- RED fixtures include an opted-in promise from a garden with no eligible local confirmer,
  an unselected promise that remains structurally blocked, contributor exclusion on all paths,
  local-path precedence, stale/lost protocol authority, and a Green Goods protocol-steward
  confirmation visible in both queue and history.

## Binding ongoing-Offer amendment — 2026-08-02

- Consume the completed canonical ongoing-Offer artifacts and `uiux-spec.md` Appendix F.
- Group linked instances by series and expose holder, state, exact outcome counts, capacity-backed
  available places, and viewer-authorized Story context.
- A steward does not gain authority to edit another holder's metadata or rest/resume/retire their
  series. Saved Offer metadata and person-level Story never enter cross-garden Operations or
  public surfaces.

## Narrowed dispatch option — 2026-08-21

Recorded from `reports/build-review-2026-08-21.md` (admin "Not started": zero pooling files
against 16 screens / 196 states) and a same-day read of the tree at `develop@bcf6adfc2` plus the
open PR #749 branch. Mirrors the client lane's narrowed option above: the core steward loop may be
dispatched by an explicit narrowed handoff stacked on the client-loop branch (PR #749, fast-forwarded
into the prepared worktree on 2026-08-21 at `faf05338e`), without waiting for hosted read-back, the
ledger flip, or settlement; the D1 PR opens only after PR #749 is on `develop`. The dispatch prompt is
`prompt-client-loop.md`'s sibling, `../prompt-admin-console.md`; its "Present state" section is
the verified gap record and must be re-verified cheaply before use.

**Why now.** Every local pool is NOT_READY with no commitments and no cycles
(`reports/client-loop-2026-08-21.md` § Rendered proof), so nothing the client lane built can
render live until a steward sets the charter and cap, marks the pool ready, opens it, and seeds and
opens a Season. The steward console is the critical path for every lane's rendered QA, and Cycle 1
is a steward act.

**Scope split.**

- **D1 — run the season** (branch `feature/commitment-pooling-admin-console`; the Status block's
  `feature/commitment-pooling-admin-ui` signal above is lane-shaped, and the branch takes the
  outcome-shaped name the convention asks for, as the client lane did): W7 pool console, W11
  setup / open-season / campaign flows, W8 seeding console, W10 commitment dialog (detail,
  accepted action row, cancel, mark-ready override, attach assessment, raise / resolve dispute,
  garden and protocol fallback confirmation, fallback-eligible detail, not-found), W13 Hub Confirm
  stage, W12 Community → Pools (Protocol pool + This garden). Journeys sb9a, sb20, sb3b, sb17,
  sb47, sb9b, sb6b, sb21.
- **D2 — close the season** (branch `feature/commitment-pooling-admin-season-close`, after D1
  merges): W7C cycle view, W26 close → certificate → compost ceremony with per-step failure
  states, W9 analog capture (+ `W8@captured-for`), W14 assessment additions, W7M phone layout,
  `W10@edit-declared-value`, `W10@external-fulfilled` + `record-payout`, `W7@series-view`,
  `W13@context-chip`. Journeys sb9c, sb9d, sb9e, sb32, sb8, sb8b, sb22, sb50, sb60, sb10.
- **D3 — stays gated with settlement**: the Operations workspace, `queueFunding`, W21 / W22 /
  W24 / W37, payout plans, batches, CCIP, the W12 funding view and delivery-gate row. The
  acceptance bullets above that name these surfaces belong to D3, and so does
  `src/__tests__/settlement-ccip-flow.test.tsx` under § Exact Bun commands; the other two test
  files named there are D1 and appear in the list below.

**Shared deliverables owned by this lane (Phase 0 of the prompt).** The aggregate
`claude-ui.md` lists "shared behavior changes" as out of scope; that line predates the repo rule
that every hook lives in `@green-goods/shared`, and the client dispatch already allowed shared
additions in named paths. The admin dispatch allows the same, limited to
`packages/shared/src/{hooks/commitment-pooling,hooks/admin-ui,modules/commitment-pooling,config/query-keys,utils/navigation,i18n}/**`:

- `useCommitmentPoolMutation` over the 14 pool / cycle lifecycle functions
  (`ICommitmentPoolingModule.sol:643-685,742`), which have no shared wrapper today although
  `useCommitmentMutation` already covers every commitment-level steward act.
- Versioned charter and cycle-name documents pinned before `setPoolCharter` / `seedCycle`.
- A resumable write-chain helper for the six-write first-run setup and the two-write open, which
  derives "what landed" from on-chain reads and retries only the unlanded call (`uiux-spec.md`
  C.51).
- Readers: protocol pool (`protocolPoolId()` / `rootGarden()`), pending claims by pool,
  past-due-and-live commitments, typed `confirmationPath` / `fallbackReason`, an `isPoolSteward`
  predicate, and a fallback group on `useCommitmentsToConfirm` derived from indexed `confirmers` +
  `protocolFallbackEnabled` + the frozen roster (no indexed reachability field exists;
  `schema.graphql:970-971`).
- `cockpit.garden.pool.*`, `cockpit.community.pools.*`, `cockpit.hub.confirm.*` in en / es / pt.

**D1 RED-first test files** (replacing the three names under § Exact Bun commands for this
dispatch):

- bun run --filter @green-goods/admin test -- src/__tests__/routing/garden-pool-route.test.tsx
- bun run --filter @green-goods/admin test -- src/__tests__/routing/community-pools-route.test.tsx
- bun run --filter @green-goods/admin test -- src/__tests__/routing/hub-confirm-route.test.tsx
- bun run --filter @green-goods/admin test -- src/__tests__/views/GardenPool.test.tsx
- bun run --filter @green-goods/admin test -- src/__tests__/views/PoolSetupFlow.test.tsx
- bun run --filter @green-goods/admin test -- src/__tests__/views/SeedCommitment.test.tsx
- bun run --filter @green-goods/admin test -- src/__tests__/views/CommitmentDialog.test.tsx
- bun run --filter @green-goods/admin test -- src/__tests__/views/HubConfirm.test.tsx
- bun run --filter @green-goods/admin test -- src/__tests__/views/CommunityPools.test.tsx
- bun run --filter @green-goods/shared test -- commitment-pool-mutations commitments-to-confirm
- cd packages/admin && node ../../scripts/dev/node-cli.js tsc --noEmit -p tsconfig.app.json
  (the `bun run build` typecheck step checks zero admin files; `tsconfig.json` is solution-style
  with `files: []`)

**Proof limits carried into the dispatch.** `?mockAuth=operator` changes UI auth state only and
cannot sign (`docs/docs/builders/getting-started.mdx:189-207`); write-side rendered proof on the
Anvil fork needs a real wallet that stewards a local garden, which no disposable Anvil account
does today (prompt decision 5). The local stack runs chain 42161, so the ledger flip rule of the
client prompt applies to rendered QA here as well. Live authenticated proof stays pending the
hosted Envio deployment.

**Record.** The dispatch gate, branch, and narrowed scope are recorded in `status.json`
`execution_sub_lanes.ui_admin` by the dispatched session as its first commit, Afo's dispatch being
the authorization (the client precedent is `a549877d1`); this handoff's Status block above stays as
written until then. Linear on 2026-08-21: PRD-725 In Progress since 2026-08-19, blockers PRD-789 /
PRD-760 / PRD-723 Done, PRD-737 Done since 2026-07-31. The session appends
its built / not-built table under a dated heading here and writes
`reports/admin-console-<date>.md`.


## D1 built / not built — 2026-08-21

Session report: `reports/admin-console-2026-08-21.md` (evidence, rendered proof, decisions 1–8
with file:line, flags). Branch `feature/commitment-pooling-admin-console`, 17 commits
`534abef04..f36e222de` on top of the client-loop branch at `faf05338e` + `fee7b734f`; the D1
PR waits for PR #749 to reach `develop`. Write-side rendered proof is BLOCKED on decision 5;
read-side states rendered through the authenticated Brave profile against this worktree's admin
on :3102 over the local Envio mirror (ledger flipped for the session, then reverted).

| Surface / state | Status | Proof | Note |
|---|---|---|---|
| Placement: `garden/pool`, `garden/pool/seed`, `garden/pool/:commitmentId`, `community/pools`, `hub/confirm`; Pool tab, Pools mode, Confirm stage + count | built | routing tests (9), rendered | `hub.workbenchModel` counts `confirmCount`; the Garden rail shows Pool only to `canManage`. |
| W7 `not-ready` | built | tests, rendered (root garden, pool 1) | Checklist rows: charter and cap. |
| W7 Baseline readiness row | **not built** | — | No shared selector for the qualifying Baseline exists; two rows render, as the prompt allows. |
| W7 `preflight-complete` | built | tests | Checklist rows turn done; a retry of the flow skips the steps the chain reads as landed (`pool-setup.ts:244-258`). |
| W7 `ready`, `open-no-cycle` | built | tests, Storybook | "No season running" with Start season. |
| W7 `seeded` | built | tests, Storybook | Season row with "Open to the garden" (two-write open). |
| W7 `open` | built | tests, Storybook | Season, campaigns, rules, groups. |
| W7 `paused`, `pause-confirm` | built | tests | Reason dialog; paused hides create / claim / accept / decline / Ready / override / confirm, keeps evidence, cancel, expire, resolve. |
| W7 `edit-pool` | built | tests, Storybook | `PoolSettingsDialog`; charter re-pinned before `setPoolCharter`. |
| W7 `claims`, `decline-claim-confirm` | built | tests | Keyed to the stored claimant; decline reason pinned. |
| W7 `claim-declined`, `claim-outcomes` | built as timeline | tests | Outcomes read as W10 timeline events (requested / declined / taken up); no separate outcomes panel on W7. |
| W7 `due-live` | built | tests | Expire now → `expireCommitment`; the row stays live until indexed Expired. |
| W7 `expiry-queue` | built as group | tests | Expired rows live in the Past group; no dedicated queue view. |
| W7 `close-blocked-live`, `close-pool-confirm`, `pool-closed` | built | tests | Close only when `selectPoolClosureEligibility` passes; otherwise the live count and a link to the rows. |
| W7 `compost-pool-confirm`, `pool-composted`, `reopen-confirm` | built | tests | "Archive pool…", "Reopen pool…" with zero-count facts. |
| W7 `cancel-cycle-confirm`, `paused-cancel-cycle-confirm` | built | tests | Reason dialog; cancel stays while paused. |
| W7 `paused-cycle-cancelled`, `paused-cycle-composted`, `cycle-composted`, `reconciled` | built as display | Storybook | Finished cycles render with their state; `closeCycle` / `compostCycle` acts are D2. |
| W7 `loading`, `read-error`, `empty` (no pool registered) | built | tests, rendered (unavailable cast) | Unavailable renders only when no cached pool exists. |
| W7 summary row with jump links, Open · Confirmed · Past chips | built | tests | Rows open in the left inspector (route-backed) or a dialog (protocol context). |
| W11 `setup-how`, `setup-how-blocked`, `setup-season`, `setup-split`, `setup-open`, `setup-discard`, `setup-failed` | built | tests, rendered (steps 1–4 walked; the write was not sent) | Offline blocks Continue; failure names what landed; retry sends one call. |
| W11 `details`, `presets`, `invalid-sum`, `recognition-policy`, `guard`, `discard`, `open-failed` | built | tests, Storybook | Second season blocked with the running one named. |
| W11 `campaign-details`, `campaign-allocation`, `campaign-open`, `campaign-discard` | built | tests | Seed + open in two writes; campaigns run beside the season. |
| W8 `step1`–`step4`, `step3-no-protocol`, `discard` | built | tests, Storybook | Cycle binding grouped Season → Campaigns → cycle-less; rails exclusive; Celo disabled with its explanation; team-fallback checkbox on by default, disabled with a repair path when unregistered. |
| W8 `captured-for` | **not built** | — | D2 (W9). |
| W10 `detail`, `detail-fallback-eligible` | built | tests, Storybook | Fallback banner and act only when the ordinary path is unreachable, naming the garden's authority. |
| W10 `accepted` (three separate acts), `cancel`, `mark-ready-override` | built | tests | Each through its own reason dialog. |
| W10 `attach-assessment` | built | tests | Non-revoked attestations under the configured Assessment schema whose recipient is the stored `providerGarden` (`modules/data/eas.ts:279-283`); empty state otherwise. |
| W10 `raise-dispute`, `resolve-dispute` | built | tests | Four resolutions; Kept hidden for a roster steward and a formerly Expired record. |
| W10 `fallback-confirm`, `protocol-fallback-confirm` | built | tests | Reason required; names the garden / the Green Goods team. |
| W10 `garden-ready`, `garden-fulfilled` | built as display | tests | State chips and the fulfilled path; garden claims labelled by `claimType`. |
| W10 `not-found` | built | tests | Retry and a way back to the pool. |
| W10 `external-fulfilled`, `record-payout`, `fulfilled` acts, `contributor-allocation`, `queue-settlement-garden`, `edit-declared-value` | **not built** | — | D2 or settlement-gated, per the prompt. |
| W13 `queue`, `empty`, `loading`, `read-error` | built | tests, rendered (empty stage) | Confirm enqueues on ordinary rows, opens W10 on fallback rows; Not yet raises a reasoned dispute; disputed rows carry Resolve. |
| W13 `context-chip`, `assess` | **not built** | — | D2 cross-links. |
| W12 `protocol`, `current-garden`, `loading`, `read-error` | built | tests, rendered (protocol tab) | Exactly two tabs; never another garden's pool. |
| W12 `seed-protocol` | built | tests | Seed opens W8 with `protocolContext`. |
| Stories: one per new component + `/garden/pool`, `/community/pools`, `/hub/confirm` route stories | built | `check:stories`, `check:story-quality`, `build-storybook` | Loading / empty / read-error casts included. |
| Shared: `useCommitmentPoolMutation` (14 calls) | built | 13 tests | |
| Shared: charter + cycle-name documents | built | 12 + 3 tests | |
| Shared: resumable write chain | built | 8 + 5 tests | |
| Shared: readers (protocol pool, claims by pool, due-live, reachability, `isPoolSteward`, fallback group) | built | 10 + 7 + 10 tests | `confirmationPath` / `fallbackReason` surface as `ConfirmQueueEligibility` on the queue rows. |
| Shared: `cockpit.garden.pool.*`, `cockpit.community.pools.*`, `cockpit.hub.confirm.*` in en / es / pt | built | locale-coverage, `lint:vocab` | 486 keys per catalog. |
| Acceptance: all writes through shared hooks | built | tests | No view imports a contract client. |
| Acceptance: pause reason-required, disables only the named acts | built | tests | |
| Acceptance: `closePool` never from a live state; zero-count facts | built | tests | |
| Acceptance: past due never renders Expired; `W7@due-live` submits `expireCommitment` | built | tests | |
| Acceptance: `W10@accepted` three separate reasoned acts | built | tests | |
| Acceptance: `W10@attach-assessment` scoped to `providerGarden` | built | tests | |
| Acceptance: second Season blocked, Campaigns independent | built | tests | |
| Acceptance: pre-acceptance declared-value editor | **not built** | — | D2 (`W10@edit-declared-value`). |
| Acceptance: batches, CCIP, settlement, Operations, Safe, funding | **not built** | — | D3, gated with settlement. |
| Acceptance: authenticated Brave proves the live operator flow | partial | rendered read-side only | Write-side proof BLOCKED (decision 5). |

### Validation receipt

- Tested commit: `42116ecd1` (targeted) and `f36e222de` (head; the last commit adds a required
  marker only, re-proven by `PoolSetupFlow` + `GardenPool`, 2 files / 19 tests).
- `git status --porcelain=v1 --untracked-files=all -- packages/admin/src packages/shared/src`:
  empty at both commits.
- 2026-08-22 (UTC), `mise exec -- node scripts/dev/ci-local.js --quick --base faf05338e` @ `8cb94189b`:
  format, lint, shared-typecheck, shared-test (339 / 3886), client-test (91 / 813), admin-test
  (93 / 638), agent-typecheck, agent-test (24 / 265) green; `source-structure` and
  `supply-chain` green via `--intent diagnose --check`; `design-guardrails` red on
  `check:design-generated` only (PR #749's client token audit; decision 7), with
  `check:design-md`, `check:design-tokens`, `lint:vocab` green individually.
- 2026-08-22 (UTC), `cd packages/admin && mise exec -- bun run test -- GardenPool PoolSetupFlow SeedCommitment CommitmentDialog HubConfirm CommunityPools garden-pool-route community-pools-route hub-confirm-route` @ `42116ecd1`: 9 files / 55 tests passed; `-- Standard.guard`: 2 / 8.
- 2026-08-22 (UTC), `cd packages/shared && mise exec -- bun run test -- commitment-pool commitments-to-confirm commitment i18n` @ `42116ecd1`: 34 files / 353 tests passed.
- Shared `bun run typecheck` clean; admin `tsc --noEmit -p tsconfig.app.json`: zero errors in
  touched non-story files (611 pre-existing elsewhere).
- 2026-08-22 (UTC), `mise exec -- node scripts/dev/ci-local.js --quick --base faf05338e --no-fail-fast` @ `f36e222de`: every check green (shared 339 / 3886, client 91 / 813, admin 93 / 638, agent 24 / 265, source-structure, supply-chain) except `design-guardrails`, red on `check:design-generated` only (decision 7).
- `build-storybook` @ `8cb94189b` green; `bun .plans/active/commitment-pooling/prototypes-artifact.build.ts`:
  44 screens / 523 states / 0 warnings.


### Addendum — 2026-08-22, parent merge and the D1 PR

The D1 PR opens against `feature/commitment-pooling-client-loop` (#749) rather than `develop`,
at Afo's direction, so the diff stays admin + shared + plans. The parent was merged in first
(`e7afb8844`); four things needed hands, recorded in that commit message: the `cycle-metadata.ts`
import block, a `counterpartyKind` both lanes added (kept once), the two steward readers dropped
by the client lane's newly demo-gated `data.ts` barrel (re-exported unwrapped, like activity —
the console is an operator surface, not a member screen `?mockPooling=1` stands in for), and a
story fixture whose trailing `...overrides` put the raw pool record back over the derived one.

Two facts in `reports/admin-console-2026-08-21.md` are superseded by the merge, and the report
stays as written:

- **The admin typecheck is now real and clean.** `packages/admin` gained a `typecheck:source`
  script (`tsc --noEmit -p tsconfig.app.json`) and the client lane cleared the pre-existing
  errors, so the report's "611 pre-existing errors, zero in touched non-story files" is now
  **0 errors in the package**, once the story-fixture bug above was fixed. That bug was real, not
  a type nit: it only became visible because CI now type-checks admin.
- **A new architecture gate arrived from `develop`**, `node scripts/quality/check-react-patterns.js`,
  wired into the CI Gate by #750. It reports 0 violations across this lane's 100 files.

Still open: decision 7. `check:design-generated` remains red on
`docs/docs/builders/packages/client-pwa-token-audit.generated.md`; regenerating changes 95 rows,
every one of them a `packages/client` path, so it is the client lane's artifact and this branch
did not regenerate it.

Proof on the merged tree (`e7afb8844`): shared 340 files / 3892 tests, admin 93 / 638, client
92 / 814, root lint 0 errors, shared typecheck clean, admin `typecheck:source` clean,
`check-react-patterns` clean.
