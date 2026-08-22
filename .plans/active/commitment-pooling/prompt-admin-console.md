# Build the Commitment Pooling admin console: run the season (D1), then close it (D2)

Dispatch prompt for a fresh Claude Code session. Written 2026-08-21 from
`reports/build-review-2026-08-21.md`, the 2026-08-21 hub and code analysis recorded in
`handoffs/claude-ui-admin.md` § Narrowed dispatch option, a read of the tree at
`develop@bcf6adfc2` plus the PR #749 branch, and the live Linear state of PRD-725; refreshed the
same evening after the client-loop branch was fast-forwarded into the worktree below. Read it
whole; the facts under "Present state" were verified that day and should be re-verified cheaply
before they are trusted.

You are working in the Green Goods monorepo. Read `CLAUDE.md`, `AGENTS.md`, and
`packages/admin/AGENTS.md` first; they bind you. This repo runs concurrent Claude/Codex sessions
on the same tree: stay inside the paths named below, treat any working-tree change you did not
make as another agent's work (stash, never revert), never `git add -A`, never switch the primary
tree's branch except as instructed here.

## Why this scope

The build review rated the admin console "Not started": zero pooling files against a 16-screen /
196-state prototype. Every local pool is NOT_READY with no commitments and no cycles, so nothing
the client lane built can render live until a steward can set a charter and cap, mark the pool
ready, open it, seed a Season and open it with its allocation. The steward half is the critical
path for everyone's rendered QA. D1 therefore builds exactly the loop Cycle 1 needs (journeys
sb9a, sb20, sb3b, sb17, sb47, sb9b, sb6b, sb21 in `hifi/journeys.ts`) on the screens W7, W11, W8,
W10, W13, W12. Settlement, Operations, the close-season certificate ceremony, analog capture,
assessment additions, and the phone layout are D2 or stay behind their own gates.

## Worktree

You are in the worktree
`/Users/afo/Code/greenpill/green-goods/.claude/worktrees/pr-631-review-ci-5afb23` (the directory
name predates the branch) on `feature/commitment-pooling-admin-console`. The hub's recorded
signal for this sub-lane is still the lane-shaped `feature/commitment-pooling-admin-ui`; the
branch takes the outcome-shaped name the convention asks for, exactly as the client lane ran on
`feature/commitment-pooling-client-loop` against a `…-client-ui` signal. On 2026-08-21 that branch was fast-forwarded from `origin/develop@bcf6adfc2` onto the
client-loop branch at `faf05338e` (the head of the open PR #749), so every shared piece the client
lane built is already in this tree; nothing from that branch is yours to redo, and PR #749 stays
open against `develop` as the client lane's PR. The planning commit
`docs(claude): prepare the commitment pooling admin console dispatch` (this prompt plus the hub
gap closures) sits on top. The
primary checkout at `/Users/afo/Code/greenpill/green-goods` and every other `.claude/worktrees/*`
directory belong to other sessions: never read their uncommitted files, never symlink, copy,
install into, or clean them, never run `git` against them. Do not remove this worktree at the end;
Afo does.

- The branch has no upstream on purpose. Publish with
  `git push -u origin feature/commitment-pooling-admin-console` after the dispatch-gate commit
  below.
- **Syncing with `develop`.** When PR #749 merges, `git merge origin/develop` here is expected to
  be trivial (same commits). If Afo squash-merges it instead, the identical hunks still resolve
  without conflict; only genuine divergence conflicts. Do the sync before opening the D1 PR, and
  open D1 only after #749 is on `develop` (a stacked PR against `develop` would carry the whole
  client diff and trip this repo's CI Gate base-branch filter). D1's PR diff must then contain
  admin-lane commits only.
- At session start this worktree has no uncommitted changes. Any uncommitted change you find is
  another session's work: leave it alone and report it.
- **`.env` is not in this worktree yet** (only `.env.schema` and `.env.template` are; verified
  2026-08-21). Tests, lint, typecheck, and the Ship Gate's build run without it, but the dev stack
  and every secret-backed step need it. The command guard denies any shell command that names
  `.env`, even `ls` or `ln`, so the link is Afo's step, with absolute paths (a relative one once
  landed a stray symlink inside `hifi/screens/`):
  `ln -s /Users/afo/Code/greenpill/green-goods/.env /Users/afo/Code/greenpill/green-goods/.claude/worktrees/pr-631-review-ci-5afb23/.env`.
  Until it exists, report the dev stack and any secret-backed step as env-gated rather than
  routing around the guard; once it exists, treat it as read-only and never edit env.
- Dependencies are installed (`node_modules` present). Do not run any install. The pinned
  toolchain (Node 22.22.1, Bun 1.3.14) is available through mise, which is **not** activated in
  Claude Code tool shells: a bare `node` resolves to v18 and the husky hook then dies with a
  misleading `toSorted` error. Prefix every repo command with `mise exec --`
  (`mise exec -- bun run test`, `mise exec -- bun format`), or check `node --version` prints
  `v22.22.1` before trusting a result. Verified on 2026-08-21:
  `cd packages/shared && mise exec -- bun run test -- commitments-to-confirm commitment-reasons commitment-pooling-hooks`
  → 3 files / 42 tests pass in this worktree.
- Never `git add -A`: stage explicit paths. Before each commit, `git status --short` from the
  worktree root and confirm no `node_modules`, `.env`, `tmp/`, or `.generated` stray is staged.
- The D2 branch, `feature/commitment-pooling-admin-season-close`, is created from this worktree
  with `git switch -c` off the updated `develop` only after the D1 PR has merged; do not create a
  second worktree and do not open D2 against `develop` while D1 is still open.

### The dev stack

`bun run dev` (Anvil Arbitrum fork on 3009, client 3001, admin 3002, docs, Storybook, agent, Docker
indexer on 3006, tunnel) is one PM2 daemon for the whole machine with shared app names, and
`scripts/dev/stack.js` deletes the same-named apps before starting, so any `bun run dev` from
another checkout silently takes the stack. On 2026-08-21 at 19:48 the stack was owned by the
client-loop worktree (`lsof` cwd = `.claude/worktrees/client-loop`).

- Before any browser QA, prove ownership:
  `lsof -a -p "$(lsof -nP -iTCP:3002 -sTCP:LISTEN -t | head -1)" -d cwd -Fn | grep '^n'` must print
  this worktree's path. If it prints another checkout, ask Afo whether that session is finished
  before taking the stack; do not start a takeover loop.
- `stack.js` never returns: it tails PM2 logs and **deletes every app on SIGINT/SIGTERM**. Never run
  `bun run dev` as a foreground tool call or as a harness-tracked background task. Launch it
  detached from the worktree root with the log outside the repo, then wait on the ports:
  `( nohup mise exec -- bun run dev > "$TMPDIR/gg-stack.log" 2>&1 < /dev/null & )`, then
  `npx wait-port -t 240000 localhost:3002` and `npx wait-port -t 300000 localhost:3006` (the
  indexer leg rebuilds a Docker image). `bun run dev:stop` stops the stack wherever it was started.
- `bun run dev:doctor` cannot see the live stack (its port probe binds `127.0.0.1`, which succeeds
  against Vite's wildcard bind on macOS); use `npx pm2 list` and
  `lsof -nP -iTCP:<port> -sTCP:LISTEN`. `bun run dev:health` and `bun run dev:smoke:full` stay valid
  once the stack is up.
- The local Envio builds from this worktree and mirrors live Arbitrum (18 pools registered);
  writes go to the Anvil fork, which is in-memory and resets on every stack restart. `dev:web`
  serves the UI against the hosted indexer named in `.env`, which has no pooling schema yet; stay
  on the full stack.
- Local pooling data depends on the local index having caught up. Earlier on 2026-08-21 the local
  index sat 60 M blocks behind the head while Envio HyperSync rate-limited the catch-up; later that
  day it was 3 blocks behind and `bun run dev:smoke:full` passed. Run the smoke first and treat a
  failing `local-indexer-lag` check as "no live local proof yet": build and test against fixtures,
  and do not change indexer config, compose, or env to work around it (raising the Envio plan
  limit is Afo's call).
- The tunnel app publishes `trycloudflare.com` URLs for the client and admin
  (`npx pm2 logs tunnel --nostream --lines 40 | grep -i ready`); they change on every restart.
- Host-side `envio codegen` worked in the client-loop worktree under
  `mise exec -- bun run --cwd packages/indexer codegen`; if an indexer leg of `bun run test` /
  `bun run build` fails on codegen here, prove it pre-existing with a stash and report that leg as
  env-gated. Everything else in the Ship Gate must actually pass here. Repo-root `bun build`
  invokes Bun's bundler, not the package script; always `bun run build`. Capture a stage's exit
  code before piping to `tail`.

## Dispatch gate (check before anything else)

The hub records the admin sub-lane as manually blocked: `status.json` has
`execution_sub_lanes.ui_admin.status: "blocked"` with a `blocked_reason` naming hosted indexer
read-back and the admin-foundation fixes. Both named blockers have moved: PRD-737 (the
admin-foundation fix) is Done since 2026-07-31, PRD-789 / PRD-760 / PRD-723 (PRD-725's Linear
blockers) are all Done, and the client lane recorded its own narrowed dispatch before touching
code (`a549877d1`, now in this branch's history, which is why `lanes.ui` already reads
`in_progress`). Do the same here. Afo's dispatch of this prompt is the human authorization; you
record it yourself, as your first action:

1. Hand-edit `.plans/active/commitment-pooling/status.json` (the harness has no sub-lane command;
   `set-lane` edits machine lanes only and would repoint `lanes.ui.branch` at this branch): set
   `execution_sub_lanes.ui_admin` to `status: "in_progress"`, `manual_blocked: false`,
   `branch: "feature/commitment-pooling-admin-console"`, and replace `blocked_reason` with
   `"Narrowed admin dispatch: Phase 0 + D1 + D2 of prompt-admin-console.md, stacked on the client-loop branch (PR #749) and built against fixtures and the local stack before hosted read-back; rendered live proof deferred to the hosted Envio deployment; settlement, Operations, and the Hypercert ceremony stay gated"`;
   append a `history` row with `actor: "human"`, `lane: "ui_admin"`, `status: "in_progress"`, the
   branch, a UTC `timestamp`, and the same sentence as `note`; append the same sentence to
   `lanes.ui.blocked_reason` after the client one (the machine lane aggregates both sub-lanes).
   Then `bunx biome format --write` on `status.json` and
   `node scripts/harness/plan-hub.mjs validate` (must print `Validated … feature hubs.`).
2. Commit as `docs(plans): open the admin console lane` with exactly `status.json` staged.
3. `git log -1 -- .plans/active/commitment-pooling/status.json` on this branch shows that commit.

If the transition cannot be recorded (`validate` rejects the edit, or `status.json` no longer
matches the state described above), stop and report "dispatch gate not recorded"; do not edit
product code. The ledger flip and the hosted Envio deployment stay outside this lane regardless.
Linear PRD-725 is already In Progress (since 2026-08-19, assigned to Afo, past its 2026-08-15 due
date); do not change any Linear state or create Linear records.

## Objective

Make the admin console able to run one real season for a steward: set the pool up (charter,
provider open-commitment cap, ready) and open it with its first Season and allocation in one
flow; start a Campaign beside the Season; seed commitments into the pool; accept or decline
claims; see live rows and expire the ones past due; pause and resume with a reason; recover a
stalled commitment (send for confirmation, mark ready with override, cancel); confirm on a
fallback path or resolve a "not yet" from the Hub's Confirm stage; and reach the protocol pool
and this garden's pool from Community → Pools. Then (D2) close the season: the cycle view, the
close → certificate → compost ceremony, analog capture for a device-free member, the assessment
additions, and the phone layout.

Deliver as **two PRs to `develop`**: D1 from `feature/commitment-pooling-admin-console`, opened only
after PR #749 has merged and this branch has been synced with `develop`; D2 from
`feature/commitment-pooling-admin-season-close`, opened only after the D1 PR has merged and the
D2 branch is rebased onto the updated `develop`. Each PR body links exactly one issue for
resolution: `Refs PRD-725` (partial work), plus `Relates to PRD-650` for context only.

## Present state (verified 2026-08-21; re-verify cheaply before trusting)

### Admin package

- `packages/admin/src` has no pooling view, hook consumer, test, story, or i18n key. Every `pool`
  hit is the conviction signal pool (`views/Garden/SignalPool.tsx`, `GovernancePanel.tsx`) or the
  Aave Pool in the vault details. The three test files named in `handoffs/claude-ui-admin.md`
  § Exact Bun commands do not exist.
- Route table: `packages/admin/src/routes/views.tsx:104-372` (`adminCanvasRoutes`), every view
  through `lazyView` (`:8-10`), role gates through `roleGatedRoute`/`roleGatedBranch` (`:44-56`,
  `RequireRole.tsx`). Garden branch `:181-225` (`health`, `activity`, `impact`, `settings`,
  deployer-gated `create`); Community branch `:231-343` (`members`, `coordination`, `endowment`,
  `payouts` plus legacy aliases); Hub branch `:108-175` (`work`, `assess`, `certify`, `history`).
  Mode unions live in shared: `AdminGardenMode` and `AdminCommunityMode` at
  `packages/shared/src/utils/navigation/admin-routes.ts:15-16`, `adminRoutes.communityMode(mode)`
  at `:203`; the Hub stage union `HubPipelineStage` and `PIPELINE_STAGE_CONFIG` at
  `packages/shared/src/hooks/admin-ui/hub/hub.utils.ts:21,124-150`, path → stage at `:110-113`;
  the admin mode union is duplicated at
  `packages/admin/src/views/Community/components/CommunityTab.tsx:46`.
- Garden tab rail: `packages/admin/src/views/Garden/index.tsx:70-98` (`AdminTabRail`, ids
  `health`, `impact`, `activity`, `settings`). Community rail:
  `views/Community/index.tsx:91-132`. Hub stage rail and content: `views/Hub/index.tsx:128-139`,
  `views/Hub/components/HubStageContent.tsx`; stage counts in
  `packages/shared/src/hooks/admin-ui/hub/hub.workbenchModel.ts:146-166`.
- Shell: `packages/admin/src/components/Layout/index.ts` exports `CanvasLayout`,
  `CanvasRouteFrame`, `CanvasRouteHeader`, `CanvasRouteContent`, `CanvasRouteErrorState`,
  `CanvasWorkspaceLoadingState`, `CanvasWorkspaceSelectionGate`, `PageHeader`,
  `useRouteBackedLeftSheetConfig`. Composition example: `views/Community/index.tsx:60-137`.
  `data-tone` is stamped once on the canvas (`CanvasLayout.tsx:334-337`); `AdminDialog` and
  `AdminSideSheet` portal out of it and must receive `tone` (`AdminDialog.tsx:36-44`; enforced by
  `__tests__/components/AdminDialogStandard.guard.test.ts` and
  `AdminSideSheetStandard.guard.test.ts`, which also lock dialog sizes to `sm|md|lg`, tones to
  `hub|garden|community|actions|home`, forbid ad-hoc `max-w-*`, and allow `AdminSideSheet` only
  inside `CanvasLayout`). Workspace list is `ADMIN_WORKSPACE_VIEWS`
  (`packages/shared/src/hooks/admin-ui/navigation/workspaceViews.ts:20-58`): exactly `hub`,
  `garden`, `community`, `actions`. There is no Operations workspace and `packages/admin/AGENTS.md`
  forbids adding nav slots; Operations is out of scope here.
- Admin palette (`packages/admin/src/components/`): `AdminBadge`, `AdminButton`, `AdminCard`,
  `AdminCheckbox`, `AdminChoiceGroup`, `AdminDialog` + `AdminConfirmDialog` +
  `ADMIN_FLOW_DIALOG_CLASS`, `AdminFab`, `AdminFilterChip`, `AdminInlineField`,
  `AdminLinearProgress`, `AdminListItem`, `AdminSearchToolbar`, `AdminSelectableCard`,
  `AdminSettingRow`, `AdminSideSheet`, `AdminSortSelect`, `AdminTabRail`, `AdminTextField`,
  `AdminTooltip`, `AdminViewActions`. Flow-dialog precedent: `views/Hub/CreateAssessment.tsx`
  (`AdminDialog` + `ActionFlowShell` + `FlowStepHeader` + `useDirtyClose` + `TxInlineFeedback`).
  Queue-with-row-actions precedent: `views/Garden/SignalPool.tsx:314-419` (reserved-height
  error/loading/empty ladder, permission-gated row action, `AdminConfirmDialog` at `:427-444`).
  Locked action row precedent: `views/Garden/WorkDetail/ReviewForm.tsx:33-56,74`. **There is no
  reason-required confirmation dialog anywhere in admin**; the only free-text rationale is the
  review feedback field. One is needed for pause, cancel cycle, decline claim, cancel commitment,
  mark-ready override, fallback confirmation, not-yet, and dispute resolution.
- Tests: `packages/admin/src/__tests__/{components,routes,routing,views,workflows}/`;
  `test-utils.tsx` re-exports `@green-goods/shared/testing` (`renderWithProviders`,
  `createTestQueryClient`, `MOCK_ADDRESSES`); `setup.ts` stubs `matchMedia`, runs MSW with
  `onUnhandledRequest: "error"`, mocks `react-hot-toast` and `@reown/appkit`. Shared hooks are
  mocked with `vi.mock("@green-goods/shared", async (importOriginal) => …)` and `vi.hoisted`
  state (`__tests__/components/CanvasLayout.test.tsx:22,130`). Known gotcha: a Radix
  `AdminConfirmDialog` opened over an already-open host dialog flickers out in jsdom; mock the
  inner dialog to a plain `role="alertdialog"` (`__tests__/components/Garden/AddMembersDialog.test.tsx:49-68`).
  `bun run test` runs `__tests__/views/**` (the line in `packages/admin/AGENTS.md:89` saying it is
  excluded is stale; `vitest.config.ts:112-114` excludes only `node_modules`).
- Storybook: 148 admin stories colocated under `packages/admin/src`, served by
  `packages/shared/.storybook/` (glob `main.ts:60-63`). Workspace-route story pattern:
  `views/Community/Community.stories.tsx:27-60` (`StorybookAdminCanvasRoute`,
  `withAdminIdentity`, `withSeededQueryClient`, `withSelectedAdminGarden`, `withCanvasFrame`).
  Stories for new or changed admin primitives are a hard requirement (`packages/admin/AGENTS.md:82`).
- i18n: admin uses the `cockpit.*` namespace (383 keys; `cockpit.community.*`, `cockpit.hub.*`,
  `cockpit.garden.*`). No `cockpit.*` pooling key exists. The spec reserves
  `cockpit.garden.pool.*`, `cockpit.community.pools.*`, and `cockpit.hub.confirm.*`
  (`uiux-spec.md` §10). The client's `app.pool.cycleState.*` and `app.commitment.*` keys exist
  but are client copy; do not reuse them for steward surfaces.
- Typecheck: `packages/admin/tsconfig.json` is solution-style with `"files": []`, so the
  `tsc --noEmit -p packages/admin/tsconfig.json` step in `bun run build` checks zero files and a
  green build proves nothing about types (documented at
  `__tests__/components/AdminDialogStandard.guard.test.ts:11-13`). The real check is
  `cd packages/admin && node ../../scripts/dev/node-cli.js tsc --noEmit -p tsconfig.app.json`.
- Mock auth: `AuthGate` swaps in `DevAuthProvider` when `?mockAuth=` is present in dev
  (`packages/shared/src/providers/AuthGate.tsx:12-17`). Roles are `deployer | operator | user |
  disconnected` (`DevAuthProvider.tsx:22`; operator `0x04D60647836bcA09c37B379550038BdaaFD82503`,
  deployer `0x2aa64E6d80390F5C017F0313cB908051BE2FD35e`), persisted in `sessionStorage`. **Mock
  auth only changes UI auth state; it cannot sign** (`docs/docs/builders/getting-started.mdx:189-207`).
  Fork writes need a real wallet connected in the authenticated Brave profile with a disposable
  Anvil account from `packages/contracts/.generated/runtime/arbitrum-fork.json`, and pool
  lifecycle calls additionally need that account to be a steward of the pool's garden (or the
  module owner). See decision 5.

### Shared layer (PR #749 is in this tree at `faf05338e`; verify it is still the branch head)

- Hooks: `packages/shared/src/hooks/commitment-pooling/index.ts` exports `useCommitmentPools`,
  `useCommitmentPool` (pool + unit summaries + provider exposures, with `liveCommitmentCount`,
  `nonTerminalCycleCount`, `openCommitmentCount`, the state counters, `providerOpenCommitmentCap`,
  and, from #749, the pause-reason fields), `useCommitmentCycles` / `useCommitmentCycle`
  (`cycleType`, `state`, start/end, `metadataCID`, the six allocation bps, the two recognition
  bps, `liveCommitmentCount`), `useCommitments` (filter by `poolId`, `account`, `state`),
  `useCommitment`, `useCommitmentClaimRequests` (commitment-scoped only), `useCommitmentSeries`,
  `useCommitmentActivity` (event log), `useCommitmentHypercertBundle`, `useCommitmentsInbox`
  (viewer-scoped), `useCommitmentsToConfirm` (#749: garden-as-party ordinary confirmations for
  stewards; no fallback rows), `useCommitmentJobs` (`create | claim | evidence | workLink |
  sendForConfirmation | confirm`), `useCommitmentQueueState`, `useCommitmentMutation`,
  `useCommitmentComposerForm` + `buildCommitmentCreationPayload` (#749: `DOMAIN_IMPACT` rows,
  `cycleId`, `claimMode`, `consideration`; `onBehalfOf` is the creator),
  `useCommitmentReason` + `pinCommitmentReason` (#749: reasons are pinned as versioned documents
  before any `reasonCID` call), `useCommitmentCycleNames` (#749), `useCommitmentPoolingAvailability`,
  `useSettlementAccount`, `useSettlementOperationsCapabilities`.
- `useCommitmentMutation` (`useCommitmentMutations.ts`) dispatches name-identically and covers
  every commitment-level steward act: `acceptClaim`, `declineClaim(reason)`, `attachAssessment`,
  `markReadyForConfirmation(reason)`, `confirmFulfillmentAsFallback(reason)`, `cancelCommitment`,
  `expireCommitment`, `raiseDispute`, `resolveDispute(resolution, reason)`, `setDeclaredValue`,
  `setDeclaredConsideration`, `setConfirmerRule`, roster and series acts. Ordinary
  `confirmFulfillment` and `submitForConfirmation` are the `confirmation` job kind; creation is
  the `commitment` job kind (`modules/job-queue/job-executors.ts:179-229`).
- **Missing, and built by this lane (Phase 0):** no wrapper exists for any pool or cycle
  lifecycle function. `ICommitmentPoolingModule.sol` declares `setPoolCharter(poolId, charterCID)`
  `:643`, `markPoolReady` `:644`, `openPool` `:645`, `pausePool(poolId, reasonCID)` `:646`,
  `resumePool` `:647`, `closePool` `:653`, `compostPool` `:654`, `reopenPool(poolId, toOpen)`
  `:655`, `seedCycle(poolId, CycleType, uint64 startTime, uint64 endTime, metadataCID)` `:663-671`,
  `openCycle(cycleId, AllocationBps, RecognitionPolicy)` `:672-677`, `closeCycle` `:682`,
  `compostCycle` `:683`, `cancelCycle(cycleId, reasonCID)` `:685`,
  `setProviderOpenCommitmentCap(poolId, cap)` `:742`; enums `PoolState` `:13-21`, `CycleType`
  `:23-26`, `CycleState` `:30-37`, `DisputeResolution` `:88-93`, `ConsiderationRail` `:95-99`;
  structs `AllocationBps` (six `uint16`, sum 10 000) `:119-126` and `RecognitionPolicy`
  (`equalParticipationBps`, `verifiedContributionBps`, sum 10 000) `:130-133`. All 86 functions
  are in `packages/contracts/abis/ICommitmentPoolingModule.json`. Also missing: a protocol-pool
  reader (`protocolPoolId()` `:1021` and `rootGarden()` `:1022` are unwrapped), a pool-wide
  pending-claims reader, a past-due-and-live selector (`dueDate` is selected by the query but not
  on `CommitmentReadModel`), typed `confirmationPath` / `fallbackReason` (selected at
  `modules/commitment-pooling/data-core.ts:41-42` but only present through the `...row` spread), a
  steward predicate (`roles.includes("operator") || roles.includes("owner")` is inlined at
  `useCommitmentPooling.ts:278-279` and `useSettlement.ts:178`), and `recordConsiderationPaid`.
- Useful selectors already present (`modules/commitment-pooling/selectors.ts`):
  `selectPoolClosureEligibility` `:350`, `selectCycleDerivedState` `:333`, `selectClaimPreflight`
  `:251-281`, `selectConfirmationEligibility` `:302-331` (its `ordinaryReachable` /
  `localFallbackSteward` / `protocolFallbackSteward` inputs are caller-supplied; **no indexed
  reachability field exists**, `schema.graphql:970-971` carries only `confirmers` and
  `protocolFallbackEnabled`), `selectCommitmentReadiness` `:180-217`, `selectCommitmentSeat`
  `:75-100` (pass the real roster on a browse surface; the inbox's `seatOnOwnList` shortcut is
  documented as unsound there, `useCommitmentsInbox.ts:97-105`), `selectHypercertCycleEligibility`
  `:363`.
- Indexer: `CommitmentPool` `packages/indexer/schema.graphql:721-772` (`state` `:729`,
  `charterCID` `:730`, `pauseReasonCID` `:731`, `providerOpenCommitmentCap` `:742`,
  `liveCommitmentCount` `:743`, `nonTerminalCycleCount` `:744`, `openCommitmentCount` `:767`);
  `CommitmentCycle` `:774-811` (`cycleType` `:783`, allocation snapshot `:789-796`,
  `liveCommitmentCount` `:797`); `CommitmentClaimRequest` `:1167-1186` (`claimant` `:1172`,
  `requestedBy` `:1174`, `claimType` `:1175`, `gardenContext` `:1176`, `state` `:1178`,
  `reasonCID` `:1179`, `resolutionCode` `:1180`); `Commitment.confirmationPath` `:1007`,
  `fallbackReason` `:1008`, `preDisputeState` `:1010`.
- Query keys: `packages/shared/src/config/query-keys/commitment-pooling.ts:27-121`
  (`pools`, `pool`, `cycles`, `cycle`, `commitments`, `claims`, `activity`, …). Mutations
  invalidate `all(chainId)` then the specific key (`useCommitmentMutations.ts:154-166`).
- Availability is a build-time ledger: `packages/shared/src/ontology/agent-manifest.generated.json:505-517`
  → chain 42161 `entity:commitment-pool` = `integration: partial, availability:
  deployed-not-available`, so every gated query is disabled, `addJob` throws for every commitment
  kind, and `useCommitmentMutation` throws, in production **and** in the local stack (also chain
  42161). The hosted Envio does not yet serve the pooling schema. This is release work owned
  elsewhere; do not make it your problem beyond the QA rule below.
- Public export paths: `@green-goods/shared`, `@green-goods/shared/hooks`,
  `@green-goods/shared/modules`, `@green-goods/shared/utils`, `@green-goods/shared/testing`. The
  indexer readers in `modules/commitment-pooling/data*.ts` are not in the modules barrel; admin
  consumes them through hooks only.
- Design: every admin read surface in the prototype carries loading / empty / read-error casts
  (`uiux-spec.md` C.48, C.53); chained writes carry per-step failure states that retry only the
  unlanded call (C.51); the close wizard's last step is Compost (C.48); the admin follow-up
  report `reports/admin-prototype-follow-up-2026-08-11.md` lists seven corrections, of which
  items 1 (W8 is a cast of the corrected composer), 2 (W10 sectioned anatomy, not kv rows), 5
  (one-row trailing dialog actions), 6 (row anatomy: who · what · state · one primary act), and 7
  (vocabulary: commitment is the record, direction verbs for acts) apply to this build; 3 and 4
  were prototype-only and are closed (`hifi/validate.ts:977` now pins the admin entry surfaces).

## Authoritative inputs (read in this order, before editing)

1. `.plans/active/commitment-pooling/handoffs/claude-ui-admin.md` — the lane contract, its three
   binding amendments, and § Narrowed dispatch option (2026-08-21), which is the scope you are
   completing. Its acceptance bullets that name settlement, Operations, or batch/CCIP behavior are
   D3 and not yours.
2. `.plans/active/commitment-pooling/uiux-spec.md` §6 (Admin, all eleven subsections; §6.10 is the
   allocation editor: percent display with a "stored as basis points" helper, Model 1 default
   60/15/10/5/5/5, sum must equal 100 %, soft warning under 15 % treasury) and the admin addenda
   C.16, C.17, C.36, C.48, C.49, C.50, C.51, C.52, C.53. Binding rule from C.51: first-run setup is
   **six ordered writes** (`setPoolCharter`, `setProviderOpenCommitmentCap`, `markPoolReady`,
   `seedCycle`, `openPool`, `openCycle`) behind one flow, and each failure state names what
   landed; opening an existing Seeded season is `openPool` then `openCycle`; a Campaign on an open
   pool is `seedCycle` then `openCycle`.
3. Prototype source of truth: `.plans/active/commitment-pooling/hifi/screens/admin.ts` (W7 at
   `:69-87` for the state table and `:90-100` for the steward-facing pool chip; W8 `:1164-1169`;
   W10 `:1403-1417`; W11 `:1663-1672`; W13 `:1982-1985`; hotspot `calls: […]` name the exact ABI
   function each act submits, e.g. `:1945-1949`), `hifi/screens/settlement.ts:1340` (W12),
   `hifi/journeys.ts` (sb9a setup and open, sb20 campaign, sb3b claims, sb17 stalled commitment,
   sb47 not-yet resolution, sb9b pause/resume, sb6b expire and re-seed, sb21 Community → garden
   pool, sb8/sb8b on-behalf capture for D2), `prototypes-coverage.md` § Screen registry for the
   state ids per screen. Build the click-through locally to look at screens:
   `bun .plans/active/commitment-pooling/prototypes-artifact.build.ts` (or `OUT=/path/out.html bun …`);
   the build fails on any broken state/journey ref.
4. `.plans/active/commitment-pooling/handoffs/commitment-view-state-reference.md` — the generated
   cast / seat / phase / act contract; W10 is the steward dialect of the same record. Never
   hand-edit it.
5. `.plans/active/commitment-pooling/acceptance-matrix.md` rows for `/garden/pool`,
   `/community/pools`, and the Hub Confirm queue (`:189-191`), and the Pool NotReady / Paused /
   confirmation-provenance / past-due expiry rows (`:13-14`, `:22`, `:106`).
6. Design rules: `.claude/skills/design/quick-reference.md`,
   `.claude/skills/design/prompt-contract.md` § Canonical Component Palette (admin),
   `.claude/skills/design/review-checklist.md` (all four lenses for each new view),
   `.claude/skills/design/defect-grammar.md`, `.claude/rules/react-patterns.md`,
   `.claude/rules/frontend-design.md`, `packages/admin/AGENTS.md`, `.claude/context/shared.md`.
   Admin is the restrained operator cockpit: strict M3 anatomy, `Admin*` wrappers, no hero
   moments, tokens only (`--spring-*`, `--color-*`, `--radius-*`); never raw `--m3-*`, easings,
   durations, or colors. Tailwind v4 does not scan `packages/shared/src/**` from the admin build:
   any layout utility a shared component needs goes on the admin wrapper or inline.
7. `packages/contracts/src/interfaces/ICommitmentPoolingModule.sol` for exact signatures and
   gating comments (cycle lifecycle `:657-685`, claims `:772-798`, confirmation `:945-991`);
   `packages/shared/src/modules/commitment-pooling/{types-core,types-vocabulary,selectors,acts,
   reasons,cycle-metadata,job-types}.ts`; `.plans/active/commitment-pooling/contract-spec.md`
   §6.1 permission matrix (grep `setPoolCharter`, `pausePool`, `openCycle`, `acceptClaim`).
8. Precedent: `.plans/active/commitment-pooling/prompt-client-loop.md` and
   `reports/client-loop-2026-08-21.md` for the built / not-built table shape, the evidence bar, and
   the decisions that were returned rather than guessed.

## Boundaries

- Hooks live only in `@green-goods/shared`; admin gets components and views. Import only declared
  `@green-goods/shared` export paths.
- Allowed write paths: `packages/admin/src/**`,
  `packages/shared/src/{hooks/commitment-pooling,hooks/admin-ui,modules/commitment-pooling,config/query-keys,utils/navigation,i18n}/**`
  and their tests, `.plans/active/commitment-pooling/handoffs/claude-ui-admin.md` (append only:
  the built / not-built table), and a new
  `.plans/active/commitment-pooling/reports/admin-console-<date>.md`. A fork-only fixture script,
  if decision 5 approves one, lives under `.plans/active/commitment-pooling/operations/`. No
  contract, indexer, ontology, `.github`, `package.json`, lockfile, or `.env*` changes. Do not
  install dependencies.
- Never commit a change to `packages/shared/src/ontology/green-goods-projections.json` or the
  generated manifest. For rendered QA only, you may flip chain 42161 `entity:commitment-pool` to
  `integration: integrated, availability: available` locally, regenerate
  (`bun run ontology:generate`), QA, then revert both files before staging. State in the PR that
  live authenticated proof is pending the hosted Envio deployment.
- Every user-facing string lands in `en.json`, `es.json`, and `pt.json` in the same change under
  `cockpit.garden.pool.*`, `cockpit.community.pools.*`, or `cockpit.hub.confirm.*`. Copy says
  "commitment", never "promise" (`promiseKeptRate` is a code identifier only); steward copy says
  what is true for members, never the on-chain state name (`hifi/screens/admin.ts:90-100`); no
  score, rank, reputation, reliability, leaderboard, or inferred-participant copy anywhere; the
  on-chain `operator` allocation class renders as "steward". `bun run lint:vocab` is the gate.
- Every write goes through a shared hook: pool and cycle acts through the new Phase 0 hook,
  commitment acts through `useCommitmentMutation`, seeding through `useCommitmentJobs({ act:
  "create" })`, ordinary confirmation through `useCommitmentJobs({ act: "confirm" })`. No view
  calls a contract or the indexer directly. Every reason-taking act pins through
  `pinCommitmentReason` (`cancelCycle`, `pausePool`, `declineClaim`, `cancelCommitment`,
  `raiseDispute`, `resolveDispute`); `markReadyForConfirmation` and
  `confirmFulfillmentAsFallback` take a plain `reason` string on chain and must not be pinned.
- Not in D1 or D2: the Operations workspace, `queueFunding`, W21 / W22 / W24 / W37 and every
  settlement, payout-plan, batch, CCIP, or funding control; the funding view and member-delivery
  gate row on W12; roster add/remove/assign; declared value and exchange (W28–W31); anything
  that adds a fifth workspace or a top-level Pools route; Linear writes. If you believe one of
  these is needed to finish an item, stop and report it as a decision.
- Offline-first stays the top priority in trade-offs, but the console is online-expected: pool,
  cycle, claim, override, fallback, and dispute acts are online mutations and say so offline
  (calm "needs a connection" state, the act disabled, nothing queued); seeding and ordinary
  confirmation ride the queue and render their queued / waiting / failed rows from
  `useCommitmentQueueState`.

## Method

### Phase 0 — shared foundation (one commit per item, RED test first)

1. **Pool and cycle mutations.** New `hooks/commitment-pooling/useCommitmentPoolMutations.ts`
   exporting `useCommitmentPoolMutation` with the same shape as `useCommitmentMutation`
   (availability gate, zero-address module check, `useTransactionSender`, name-identical dispatch,
   `createMutationErrorHandler`, invalidation of `all(chainId)` then `pool` / `cycle`). Actions:
   `setPoolCharter`, `setProviderOpenCommitmentCap`, `markPoolReady`, `openPool`, `pausePool`
   (`reason` → pinned `reasonCID`), `resumePool`, `closePool`, `compostPool`, `reopenPool`,
   `seedCycle` (`cycleType`, `startTime`, `endTime` as `uint64` seconds, `metadataCID`),
   `openCycle` (`allocation`, `recognitionPolicy`; refuse before send unless each group sums to
   exactly 10 000, mirroring the `InvalidSplitRatio` grammar), `closeCycle`, `compostCycle`,
   `cancelCycle` (`reason` → pinned). RED in a new
   `packages/shared/src/__tests__/commitment-pool-mutations.test.tsx`, mirroring the action table
   at `commitment-pooling-hooks.test.tsx:377-496` (every action → exact `functionName` and args;
   unavailable chain refuses; invalidation contract).
2. **Charter and cycle metadata documents.** `setPoolCharter` and `seedCycle` take CIDs. Add the
   write side beside the readers: a versioned charter document (the pool's "what this pool is for"
   sentence, `hifi/screens/admin.ts` W7 pool card) pinned with `uploadJSONToIPFS`, and the cycle
   name document that `cycle-metadata.ts` / `useCommitmentCycleNames` already read. Pin before
   the call; a pin failure keeps the step open with a retry and sends nothing.
3. **Resumable write chains.** `usePoolSetupSequence` (or the name that reads best) that runs an
   ordered list of the calls above, derives "what landed" from **on-chain reads** of the pool and
   cycle after each step (state, cycle id), never from local memory, and on failure exposes
   `{ landed, failedStep, retry }` where `retry` repeats only the unlanded call. Two sequences:
   first-run setup (six writes, `W11@setup-failed`) and open (`openPool` then `openCycle`,
   `W11@open-failed`); the Campaign path is `seedCycle` then `openCycle`. The indexer lags the
   fork by a few blocks, so read the module for the post-write state and invalidate the indexer
   keys afterwards. RED: a fake sender that fails at step N leaves N−1 landed and the retry sends
   exactly one call.
4. **Steward readers.** (a) Protocol pool: read `protocolPoolId()` and `rootGarden()` and expose
   `useProtocolPool`. (b) Pending claims for a pool: a reader over `CommitmentClaimRequest` by
   pool (join through the commitment's `poolId`, or two queries) under a new
   `queryKeys.commitmentPooling.poolClaims` key. (c) Past-due-and-live: surface `dueDate` on
   `CommitmentReadModel` and add `selectDueLiveCommitments` (live on-chain state, `dueDate < now`).
   (d) Typed `confirmationPath` and `fallbackReason` on `CommitmentReadModel`. (e)
   `isPoolSteward(roles)` replacing the two inlined predicates. (f) Fallback eligibility for the
   Confirm stage: extend `useCommitmentsToConfirm` with a `fallback` group built from indexed
   `confirmers`, `protocolFallbackEnabled`, the frozen roster, and the viewer's current
   local-garden or protocol-garden steward roles, feeding `selectConfirmationEligibility`; if the
   threshold is not indexed, read the confirmer rule from the module. Each reader gets its own
   RED test next to `commitments-to-confirm.test.tsx`.
5. **i18n families** `cockpit.garden.pool.*`, `cockpit.community.pools.*`,
   `cockpit.hub.confirm.*` in all three locales as the views need them;
   `packages/shared/src/__tests__/i18n/locale-coverage.test.ts` stays green after every commit.

### Phase 1 — D1, run the season (each item: RED test → implementation → targeted proof)

Build in this order; each item names the prototype states it must render (ids from
`prototypes-coverage.md` § Screen registry) and the shared API it consumes.

1. **Placement.** Add `"pool"` to `AdminGardenMode` and route `garden/pool` (plus
   `garden/pool/seed` and `garden/pool/:commitmentId` as route-backed left-inspector dialogs
   registered in `views/Garden/components/GardenSheetDescriptor.tsx`, the way
   `CommunitySheetDescriptor.tsx:27-50` mounts `signal-pool/:poolType`) in the garden branch of
   `views.tsx`; add the Pool tab to the Garden `AdminTabRail`. Add `"pools"` to
   `AdminCommunityMode`, the `CommunityTab.tsx:46` union, route `community/pools`, and the
   Community rail. Add `"confirm"` to `HubPipelineStage` between `certify` and `history`,
   `PIPELINE_STAGE_CONFIG`, the path mapper, `hub.workbenchModel.ts` stage counts, route
   `hub/confirm`, and a `HubStageContent` branch. RED:
   `packages/admin/src/__tests__/routing/garden-pool-route.test.tsx`,
   `routing/community-pools-route.test.tsx`, `routing/hub-confirm-route.test.tsx` (route exists,
   lazy view resolves, operator reaches it, `user` does not see the Garden tab).
2. **W7 pool console** (`views/Garden/Pool/*`): `CanvasRouteFrame` + `CanvasRouteHeader` + the
   sections in `uiux-spec.md` §6.2 with the 2026-07-18 layout addendum (summary row with jump
   links; Open · Confirmed · Past chips; rows open in the left inspector). States: `not-ready`,
   `preflight-complete`, `ready`, `seeded`, `open`, `open-no-cycle`, `paused`, `pause-confirm`,
   `edit-pool`, `claims`, `decline-claim-confirm`, `claim-declined`, `claim-outcomes`,
   `due-live`, `expiry-queue`, `close-blocked-live`, `close-pool-confirm`, `pool-closed`,
   `compost-pool-confirm`, `pool-composted`, `reopen-confirm`, `cancel-cycle-confirm`,
   `paused-cancel-cycle-confirm`, `paused-cycle-cancelled`, `paused-cycle-composted`,
   `cycle-composted`, `reconciled`, `loading`, `read-error`, `empty`. The readiness checklist
   shows charter, non-zero cap, and the qualifying Baseline; the Baseline row renders only if a
   shared selector for it exists by then (the client lane found none; if still absent, render the
   two rows and record the third as not built). Close pool is enabled only when
   `selectPoolClosureEligibility` passes; otherwise the card names the live count and links to
   the rows. `due-live` rows carry **Expire now** → `expireCommitment`; the row stays live until
   indexed success. Pause needs a reason; resume clears it; while paused the create / claim /
   accept / decline / Ready / override / confirm controls are absent and evidence, wind-down,
   cancel / expire / resolve stay. RED: `__tests__/views/GardenPool.test.tsx`.
3. **W11 setup and open flows** (`views/Garden/Pool/SetupFlow/*`): one `AdminDialog`
   `variant="flow"` + `ActionFlowShell` with states `setup-how`, `setup-how-blocked`,
   `setup-season`, `setup-split`, `setup-open`, `setup-discard`, `setup-failed`; the open-season
   path `details`, `presets`, `invalid-sum`, `recognition-policy`, `guard`, `discard`,
   `open-failed`; the Campaign path `campaign-details`, `campaign-allocation`, `campaign-open`,
   `campaign-discard`. A second Season is blocked with the open one named; Campaigns run
   concurrently. The split editor is §6.10. Submission uses Phase 0 item 3; every failure state
   prints what landed. RED: `__tests__/views/PoolSetupFlow.test.tsx` (sum guard disables
   Continue; the six-call order; step-N failure shows the landed list; retry sends one call).
4. **W8 seeding console** (`/garden/pool/seed`, `views/Garden/Pool/Seed/*`): a cast of the
   corrected composer (follow-up item 1) over `useCommitmentComposerForm` with the steward
   extras: cycle binding grouped as the one Season then Campaigns then cycle-less, claim mode
   prefilled by context (protocol approval-gated, garden campaign open-claim), the consideration
   rail with `None` default and `ArbitrumExternal` fields, `CeloSettlement` shown disabled with its
   readiness explanation unless `useSettlementAccount` reports Active (no payout action either
   way), DomainImpact requirement rows, the "Let the Green Goods team confirm if nobody local is
   eligible" checkbox on by default and disabled with a repair path when the protocol pool is
   unregistered. States `step1`, `step2`, `step3`, `step3-no-protocol`, `step4`, `discard`;
   `captured-for` is W9 (D2). Enqueue through `useCommitmentJobs({ act: "create" })`; the queued
   row appears on W7. RED: `__tests__/views/SeedCommitment.test.tsx` (payload shape, cycle
   grouping, rail exclusivity, fallback default).
5. **W10 commitment dialog** (`views/Garden/Pool/CommitmentDialog/*`, `AdminDialog` size `lg`
   with `tone`): sectioned anatomy (follow-up item 2), the timeline from `useCommitmentActivity`
   with resolved reasons, the roster from the record, the claims panel with accept / decline
   keyed to the stored claimant (decline reason-required; accept shows derived `providerGarden`
   and supersedes peers). States: `detail`, `detail-fallback-eligible`, `accepted` (the locked
   row: Send for confirmation only when evidence is complete · Cancel commitment →
   `cancel` · Mark ready → `mark-ready-override`, visually distinct from ordinary completion),
   `cancel`, `mark-ready-override`, `attach-assessment` (eligible non-revoked v2/v3 attestations
   whose recipient is the stored `providerGarden`, empty state otherwise), `raise-dispute`,
   `resolve-dispute` (four resolutions, reason required, `Fulfilled` hidden or disabled with a
   `SelfConfirmation` explanation when the steward is on the roster, and never offered for a
   formerly Expired record), `fallback-confirm`, `protocol-fallback-confirm` (each names the
   garden whose authority is used, requires a reason, and appears only when the ordinary path is
   unreachable), `garden-ready`, `garden-fulfilled`, `not-found`. `external-fulfilled`,
   `record-payout`, `fulfilled`, `contributor-allocation`, `queue-settlement-garden`, and
   `edit-declared-value` are D2 or gated. The reason dialog is one new admin primitive used by
   every reasoned act here and on W7 (decision 3). RED: `__tests__/views/CommitmentDialog.test.tsx`.
6. **W13 Hub Confirm stage** (`views/Hub/components/HubConfirmQueue.tsx`): rows from
   `useCommitmentsToConfirm` plus the Phase 0 fallback group; each row shows who committed, the
   title, the garden, N-of-group progress (`AdminLinearProgress`), the eligibility badge
   (ordinary · garden fallback · Green Goods team fallback), and the `decisionRow` acts Confirm /
   Not yet; a disputed row carries Resolve instead. Confirm on an ordinary row enqueues the
   `confirm` job; on a fallback row it opens `W10@fallback-confirm` /
   `W10@protocol-fallback-confirm`; Not yet opens the reasoned `raiseDispute` dialog (online).
   States `queue`, `empty`, `loading`, `read-error`; `context-chip` and `assess` are cross-links.
   Stage count = queue length. RED: `__tests__/views/HubConfirm.test.tsx` and a
   `hub.workbenchModel` count test.
7. **W12 Community → Pools** (`views/Community/components/CommunityPools.tsx`, mode `pools`,
   `data-tone="community"`): inner `AdminTabRail` with **Protocol pool** (the root-garden pool
   console for protocol stewards: cross-garden claim accept / decline, the protocol confirmations
   queue in the W13 grammar, **Seed** opening W8 in protocol context; the funding view and the
   delivery-gate row are out of scope and say nothing) and **This garden** (one tap into W7, no
   duplicated grammar). States `protocol`, `current-garden`, `seed-protocol`, `loading`,
   `read-error`. Never renders another garden's pool. RED:
   `__tests__/views/CommunityPools.test.tsx`.
8. **Stories.** One `*.stories.tsx` per new component and a workspace-route story for
   `/garden/pool`, `/community/pools`, and `/hub/confirm` in the `Community.stories.tsx` pattern,
   with the loading / empty / read-error casts; `check:stories` and `check:story-quality` green.

Checkpoint after Phase 1: `node scripts/dev/ci-local.js --quick`, then the built / not-built table
(below), then open the D1 PR.

### Phase 2 — D2, close the season (branch off the merged D1)

1. **W7C cycle view** (`season`, `season-finished`, `campaign`, `people`, `insights`,
   `insights-finished`, `loading`, `read-error`) per C.17: the same three questions as the
   client's W1C in the console dialect; the People tab's Pool History card uses
   `usePoolMemberHistory` counts only, visible to a steward or the member, never published.
2. **W26 close-season ceremony** (`review`, `recognition-blocked`, `shares`, `certificate`,
   `rest`, the four `paused-*` twins, `close-failed`, `mint-failed`, `compost-failed`): require
   `CommitmentCycle.liveCommitmentCount == 0`, call `closeCycle`, read the locked Reconciled
   bundle through `useCommitmentHypercertBundle` and the shared composer (which independently
   rejects anything but Reconciled and excludes cycle-less rows with "No cycle allocation · not
   certificate eligible"), mint, then `compostCycle`; per-step failure states retry only the
   unlanded call. Adds the bundle-source toggle to `views/Hub/CreateHypercert.tsx` (legacy
   approved-work bundle vs fulfilled-commitment bundle).
3. **W9 analog capture** (`pick-member`, `no-member`, `capture-kind`, `capture-fallback`,
   `discard`) and `W8@captured-for`: step 0 picks the member and the capture kind; the record names
   the member as the source and the steward as recorder; requires a `STEWARD_CAPTURED` path in
   `buildCommitmentCreationPayload` (shared change, allowed); captured fallback confirmation stays
   online and reason-required.
4. **W14 assessment additions** (`baseline`, `delta`, `kernel`, `harvest`, `offline`,
   `attest-failed`, `duplicate`, `no-hat`, `record`, `discard`): extend
   `views/Hub/CreateAssessment.tsx`, not fork it; the timing-first step derives kind from
   attribution; one baseline per (garden, cycle, domain) points duplicates at the existing record;
   "At the close" renders disabled with the Evaluator-hat reason; `W14@record` is the read view
   reached from the Assess row, the delta comparison, and `W10@attach-assessment`.
5. **W7M phone layout** (`pool`, `fab-open`, `seed-sheet`): `AdminFab` speed dial carrying the
   view's actions; the seed dialog presents as a bottom sheet.
6. **W10 leftovers:** `edit-declared-value` (Offered / Requested only, `setDeclaredValue`),
   `external-fulfilled` + `record-payout` (adds a `recordConsiderationPaid` wrapper; captures the
   executed rail reference; no value moves), `W7@series-view` (ongoing Offers grouped by series,
   read-only for stewards), and the `W13@context-chip` on the Hub Work card.

Checkpoint after Phase 2 as above, then the D2 PR.

## Evidence required in each PR

- Targeted tests for every touched view and hook:
  `cd packages/admin && mise exec -- bun run test -- GardenPool PoolSetupFlow SeedCommitment CommitmentDialog HubConfirm CommunityPools garden-pool-route community-pools-route hub-confirm-route`
  and `cd packages/shared && mise exec -- bun run test -- commitment-pool commitments-to-confirm commitment i18n`
  (adjust the filters to your files). Tests assert rendered DOM, the exact contract call, and the
  enqueued payload; when you mock a shared hook, the fixture must match a shape the real hook can
  return (the client's unavailable / not-found bug survived because a fixture could not). The two
  `*Standard.guard.test.ts` files must stay green; they scan source for dialog and sheet misuse.
- Locale: `packages/shared/src/__tests__/i18n/locale-coverage.test.ts` green; `bun run lint:vocab`
  green.
- Types: the real admin check is
  `cd packages/admin && mise exec -- node ../../scripts/dev/node-cli.js tsc --noEmit -p tsconfig.app.json 2>&1 | grep -E "views/(Garden/Pool|Community/components/CommunityPools|Hub/components/HubConfirm)|routes/views"`;
  leave zero errors in files you touched and do not try to clear pre-existing ones elsewhere
  (`bun run build` stays green regardless, which is why you run this by hand). Shared:
  `bun run --filter @green-goods/shared typecheck`.
- Design: `bun run check:design-tokens`, `bun run check:design-md`, `bun run agentic:check`
  green; stories per Phase 1 item 8; the prototype build still passes; the four review-checklist
  lenses applied to each new view and recorded in the PR.
- Rendered proof: the dev stack owned by this worktree (see § The dev stack), the local ledger
  flipped for the session,
  then `https://localhost:3002/garden/pool?mockAuth=operator` (and `deployer`) through the
  authenticated Brave QA profile via the Claude-in-Chrome extension. Read-side states (NOT_READY
  checklist, empty console, loading, read-error, the Community Pools mode, the empty Confirm
  stage) are renderable with mock auth. **Write-side proof** (the six setup writes, a seeded
  commitment, accept / decline, pause / resume, expire) needs a real wallet on the fork that
  stewards a local garden; follow decision 5. If the authenticated profile is unavailable, report
  browser QA as BLOCKED; never substitute an isolated Playwright / Browser-pane profile as proof.
  When the setup flow does land on the fork, say so in the report: from that moment the client
  lane's screens become renderable locally for the first time, which Afo will want to know.
- Before each PR, the Ship Gate: `mise exec -- bun format && mise exec -- bun lint && mise exec -- bun run test && mise exec -- bun run build`. Re-run
  Biome on touched files before staging (the PostToolUse formatter may reformat with the wrong
  style). If `bun run check:design-generated` reports the client token audit stale by line
  references only, report it and follow decision 7; do not regenerate silently.
- The PR body carries a **built / not built** table keyed to every state id named above and to the
  acceptance bullets of the narrowed option in `claude-ui-admin.md`, with one line per "not built"
  saying why (deferred, blocked, decision). Append the same table to `claude-ui-admin.md` under a
  dated heading and write the session report to
  `.plans/active/commitment-pooling/reports/admin-console-<date>.md`. A PR without the table is not
  done.

## Decisions that return to Afo (do not guess)

1. PRD-725 is In Progress in Linear since 2026-08-19 with no code behind it, due 2026-08-15, and
   the delivery-hygiene bot has nagged it three times; PRD-724 was reopened to In Progress on
   2026-08-22 for the client D1 work, which is the precedent. Whether a comment records the
   narrowed scope, whether the issue is re-dated, and whether D2 gets its own issue are Afo's
   calls. You link `Refs PRD-725` either way.
2. Button casing for admin acts: the prototype committed to Title Case (C.48: 55 footers, two
   outliers fixed) while `review-checklist.md` Lens 4.15 says sentence case and shipped admin is
   inconsistent ("Add Input" beside "Add members"). Pick one for the pooling surfaces and record it
   in the report; do not change existing admin copy.
3. The reason-required confirmation dialog: a new admin primitive (`AdminReasonDialog`, an
   `AdminConfirmDialog` with a required `AdminTextField` and the blast-radius line) versus a
   `reason` slot on `AdminConfirmDialog`. Either is a shared-primitive change in
   `packages/admin/src/components/` with a story; a standards change to `admin.mdx` is its own PR
   (`packages/admin/AGENTS.md`).
4. Whether the `CeloSettlement` rail appears disabled-with-explanation in the W8 seeding console
   (recommended, so stewards learn the rule) or is hidden until the settlement lane ships.
5. Fork write fixture for rendered proof: the disposable Anvil QA account holds no steward hat on
   any local garden, and the module owner is the real Arbitrum EOA. The cheapest honest path is a
   fork-only Bun script under `.plans/active/commitment-pooling/operations/local-fork-steward-fixture/`
   that uses `anvil_impersonateAccount` against port 3009 to grant the QA account the steward hat
   on one pilot garden (state resets with the fork; no broadcast authority; never run against a
   non-local RPC). Approve that, name the garden, or accept that write-side rendered proof is
   BLOCKED until the hosted stack serves pooling and a real steward wallet is available.
6. The cycle identity colour: the prototype's `--cyc` / `--cyc-bg` (`#6B4A7A`) for Season and
   Campaign chips has no entry in `DESIGN.md` (`handoffs/claude-ui.md` § Token bridge). Either a
   token is added in its own design-token PR first, or the chips use an existing stone / tonal
   role until then.
7. Regenerating the design-generated token audit (`bun run design:generate`, one file under
   `docs/`) on this branch when `check:design-generated` goes stale, or landing it separately.
8. Whether the Hub's Confirm stage also lists protocol-fallback rows from other gardens for a
   protocol steward in D1 (the §6.9 contract) or only local garden rows until the protocol-pool
   console (W12) proves the cross-garden read does not leak other gardens' pool browsing.

## Stop conditions

- Complete: both PRs open against `develop` with green Ship Gate, the built / not-built table
  attached, rendered proof or an explicit BLOCKED line per surface, and no change outside the
  allowed paths.
- Blocked: a required shared API needs a contract or indexer change, the authenticated Brave
  profile is unavailable, the fork fixture (decision 5) is unapproved and a write-side proof is
  the only remaining item, PR #749 is still open when the D1 PR is ready, or a decision above is
  unanswered. Finish everything not dependent on
  it, then report with the exact file and line.
- Out of scope: anything listed under Boundaries. Report it; do not build it.
