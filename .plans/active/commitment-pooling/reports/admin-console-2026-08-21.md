# Admin console, D1 session report — 2026-08-21

Branch `feature/commitment-pooling-admin-console`, stacked on the client-loop branch
(PR #749 @ `faf05338e`) plus the planning commit `fee7b734f`. Dispatch prompt:
`prompt-admin-console.md`. Phase 0 and Phase 1 (D1) are on the branch (17 commits, head
`f36e222de`); Phase 2 (D2) waits for D1 to merge, per the prompt. The D1 PR is not open: PR #749
is still open against `develop` (its CI Gate and Design Guardrails are red on the same stale token
audit named under decision 7), and the prompt forbids a stacked PR.

## What the branch does

Phase 0 gave the steward the shared surface the console needed, one commit each:
`useCommitmentPoolMutation` over the fourteen pool and cycle lifecycle calls, with a sender check,
module resolution, reason pinning for pause and cancel, and key invalidation mirroring
`useCommitmentMutation`; versioned charter and cycle-name documents pinned before
`setPoolCharter` / `seedCycle`; a resumable write chain (`useCommitmentPoolSetupSequence` over
`pool-setup.ts` presets) that judges each step against chain reads before and after sending, keeps
the seeded cycle id from the `CycleSeeded` receipt log, and retries only the unlanded call; the
readers (`useProtocolPool`, `usePoolClaimRequests`, `selectDueLiveCommitments`,
`selectOrdinaryConfirmationReachable`, `isPoolSteward`, and the fallback group on
`useCommitmentsToConfirm`); the declineClaim reason pinned like every other reasoned act; and the
composer's steward extras (kind, confirmers, threshold, consideration rail and amount).

Phase 1 placed the console (`garden/pool`, `garden/pool/seed`, `garden/pool/:commitmentId`,
`community/pools`, `hub/confirm`) and built it: the W7 pool console over
`usePoolConsoleController` + `selectPoolConsoleModel`; the W11 first-run, open-season and campaign
flows over the write chain; the W8 seeding console as a cast of the corrected composer; the W10
commitment dialog over `useCommitmentDialogController`; the W13 Hub Confirm stage over
`useHubConfirmQueueController`; the W12 Community → Pools mode; the `AdminReasonDialog` primitive
every reasoned act uses; 486 `cockpit.*` strings in en / es / pt; and stories for every new
component plus the three workspace-route stories.

## Built / not built

Keyed to every state id the prompt names and to the narrowed option's D1 scope and shared
deliverables in `handoffs/claude-ui-admin.md`. "Rendered" means the authenticated Brave QA profile
(Claude-in-Chrome extension, `navigator.brave` present) against this worktree's admin dev server
on :3102 reading the local Envio mirror through the client-loop stack's proxy; "tests" means
vitest; "Storybook" means the static build.

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

## Evidence

All commands prefixed `mise exec --`, run on this branch at the head named in each line.

- `node scripts/dev/ci-local.js --quick --base faf05338e` (head `8cb94189b`): format, lint
  (oxlint 0 errors; 260 pre-existing solhint warnings), shared typecheck, shared tests 339 files /
  3886 passed, client 91 / 813, admin 93 / 638, agent typecheck + 24 / 265 all green; the
  harness's 10-minute cap cut the run before `source-structure`, `design-guardrails` and
  `supply-chain`, which then ran through `--intent diagnose --check …`: `source-structure` green,
  `supply-chain` green, `design-guardrails` red on `check:design-generated` only (decision 7);
  `check:design-md`, `check:design-tokens`, `lint:vocab` green individually. A second full
  `--quick --no-fail-fast` run on the final head `f36e222de` is recorded in the handoff appendix.
- `node scripts/dev/ci-local.js --quick --base faf05338e --no-fail-fast` (head `f36e222de`, 2026-08-22
  UTC): format, lint, shared-typecheck, shared-test 339 / 3886, client-test 91 / 813, admin-test
  93 / 638, agent-typecheck, agent-test 24 / 265, source-structure, supply-chain all green;
  design-guardrails red on `check:design-generated` only (decision 7).
- Selector limit: `scripts/quality/select-validation.mjs` reads the patch with `execFileSync`'s
  default 1 MiB buffer; the committed patch against `origin/develop` on this stacked branch is
  1.53 MB, so `--quick` without `--base` fails with `spawnSync git ENOBUFS`. `--base faf05338e`
  (877 KB) is the workaround; the selector is not weakened.
- Targeted: `cd packages/admin && bun run test -- GardenPool PoolSetupFlow SeedCommitment
  CommitmentDialog HubConfirm CommunityPools garden-pool-route community-pools-route
  hub-confirm-route` → 9 files / 55 tests; `bun run test -- Standard.guard` → 2 / 8;
  `cd packages/shared && bun run test -- commitment-pool commitments-to-confirm commitment i18n`
  → 34 files / 353 tests (head `42116ecd1`).
- Types: `bun run --filter @green-goods/shared typecheck` clean. Real admin check
  (`tsc --noEmit -p tsconfig.app.json`): 611 pre-existing errors; zero in touched non-story files
  after `42116ecd1`. The remaining errors in the new stories are the repo-wide pattern
  (`@storybook/react` / `storybook/test` unresolved under the admin tsconfig, 162 files). Two
  findings fixed on the way: the controllers' `pool` type claimed non-null (`pools[0] ?? null`
  under no `noUncheckedIndexedAccess`), now `.at(0)`; and the admin tsconfig resolves the shared
  `Address` alias to `string`, so the story fixture types the steward as a literal.
- Design: `check:design-tokens`, `check:design-md`, `lint:vocab` green; `agentic:check` red only
  through `check:design-generated` (decision 7). Stories: `check:stories`, `check:story-quality`,
  `build-storybook` green. Prototype build: 44 screens / 523 states / 0 warnings.
- Pre-push hook (root `bun lint`) passed on every push; remote head `f36e222de`.
- Boundary: `git diff --name-only fee7b734f..HEAD` touches only `packages/admin/src/**`,
  `packages/shared/src/{hooks/commitment-pooling,hooks/admin-ui,modules/commitment-pooling,config/query-keys,utils/navigation,i18n}/**`,
  the shared barrel `packages/shared/src/index.ts`, shared `__tests__`, and `.plans/`. No
  ontology, projections, `.env*`, dependency, Linear or settlement change.

## Rendered proof

The PM2 stack on :3002 / :3009 / :3006 is owned by `.claude/worktrees/client-loop` (lsof cwd), so
it was not taken. Instead this worktree's admin ran detached on :3102 (`vite --port 3102` with the
stack's admin env; lsof cwd = this worktree), reading the client-loop stack's Anvil fork and the
local Envio through the same `.env`; the server was stopped and the tab closed afterwards. For the
session only, chain 42161 `entity:commitment-pool` was flipped to available and regenerated, then
all four generated files were reverted (`git status` clean).

The local mirror has 18 pools, all `NOT_READY`, no cycles, no commitments. `?mockAuth=operator`
(`0x04D6…`) stewards no garden in the mirror; `?mockAuth=deployer` (`0x2aa6…`) operates the root
garden `0xf401…` (protocol pool 1). Rendered through Brave as the deployer:

- `/garden/pool?gardenId=0xf401…`: the W7 `not-ready` cast with the two checklist rows and the
  status chip; the Pool tab present for the steward and absent (three tabs) for a non-member.
- "Set up commitments": the W11 flow at steps 1–4 with real validation (Next disabled until the
  purpose is written, which surfaced the missing required marker fixed in `f36e222de`), the split
  presets and the review; "Open season" was not pressed.
- `/community/pools`: the Protocol pool tab with the protocol confirmations empty stage and the
  root garden's console in community tone; This garden tab one tap into W7.
- `/hub/confirm`: the Confirm stage with its search toolbar and the empty cast.
- With the ledger reverted and the persisted query cache dropped: the production-truth cast
  "Commitment pooling is not on this chain yet".

BLOCKED: write-side proof (the six setup writes, a seeded commitment, accept / decline, pause /
resume, expire). The fork fixture is decision 5; no disposable Anvil account stewards a local
garden, and `mockAuth` cannot sign. BLOCKED: every populated read state (open season, rows,
claims, queue rows) until a steward writes on the fork or the hosted Envio serves pooling; those
states are proven by tests and Storybook only. The setup flow did not land on the fork, so the
client lane's screens are not yet renderable locally.

Observed, not changed: `AdminTabRail` does not scroll the active tab into view, so at the QA
viewport (465 px) the Garden rail overflows by 31 px once Pool is added and the Hub rail's Confirm
tab sits off-screen; both rails scroll. A `scrollIntoView` on the active tab is a primitive
change with seven consumers and is left for a follow-up.

## Review-checklist lenses

Applied to W7, W11, W8, W10, W13, W12 and `AdminReasonDialog` (`.claude/skills/design/review-checklist.md`).

- **Lens 1, regenerative.** Every act names its consequence before the write (the setup review
  says what opening records; the reason dialogs carry the blast-radius line; the pause
  description lists what stays available); empty and error casts point at the next step
  ("Set up commitments", retry, the way back to the pool); no countdowns, streaks or ranking;
  copy says "commitment", never "promise"; only the fields the contract needs are asked for.
- **Lens 2, spatial.** Command surfaces throughout (cards, dialogs, a flow); solid admin
  material; one shadow token (`--m3-elevation-1`, once) and radii only from
  `--m3-shape-sm/md` + pill; no hover transforms; glance → scan → engage layering (status chip
  → checklist / summary row → dialog). Not met: row acts use `AdminButton size="sm"`
  (59 uses), the existing admin row convention, which is under 44 px; no reduced-motion
  guard of its own (the skeleton shimmer is the shared utility).
- **Lens 3, ecosystem.** Serves the garden steward, the protocol steward (W12, fallback
  rows), and the member whose record the dialog shows; blast radius stated before pause,
  close, archive, cancel, decline, dispute and fallback; queued rows and refused calls are
  visible (pending creates on W7, "what landed" on the flow); the steward can act for a member
  (mark ready override, fallback confirmation) with a recorded reason; roles come from Hats
  through `isPoolSteward`.
- **Lens 4, compliance.** Every input has a visible label; state is never colour alone (chip
  text, ✓/✗ rows, progress label); dialogs are `AdminDialog` (focus handled); every string
  through `formatMessage` with en / es / pt keys; stories with loading / empty / error
  casts; offline degrades to a named blocked reason; one elevation ladder, admin radius set,
  one `--tone-action` use, sentence-case `AdminButton` only ("Green Goods" is a proper
  noun). Not met: validation errors are not linked through `aria-describedby` (one use; the
  flows disable Continue instead of rendering field errors); dark mode rendered, light mode
  only through the Storybook build; responsive rendered at 465 px only.

## Decisions for Afo

1. PRD-725 scope comment / re-dating / a D2 issue: untouched; the PR will carry `Refs PRD-725`
   and `Relates to PRD-650`.
2. Casing: sentence case, per `.claude/rules/frontend-design.md` Rule 18, on every pooling act
   (`PoolStatusCard.tsx:280` "Close pool…", `SetupFlow/index.tsx:798` "Open season",
   `CommitmentDialog/index.tsx:1029` "Raise dispute"). Existing admin copy untouched.
3. Reason dialog: a new primitive, `packages/admin/src/components/AdminReasonDialog.tsx:35`
   (title, blast-radius description, required textarea with suggestions, blocked reason, tone),
   with a story. No `admin.mdx` change.
4. Celo rail: shown disabled with its readiness explanation
   (`views/Garden/Pool/Seed/index.tsx:867-874`), enabled only when `useSettlementAccount` reports
   Active; no payout action either way.
5. Fork write fixture: not built; write-side rendered proof BLOCKED until approved
   (`.plans/active/commitment-pooling/operations/local-fork-steward-fixture/` would be the path).
6. Cycle colour: Season / Campaign type chips use the stone role (`StatusBadge variant="neutral"`,
   `views/Garden/Pool/PoolCyclesCard.tsx:72`); no new token.
7. `check:design-generated`: `docs/docs/builders/packages/client-pwa-token-audit.generated.md` is
   stale from the client files on PR #749 (41 new token references in `ClaimContextSheet.tsx`,
   `CommitmentClaimPanel.tsx`, …), not from this branch, which touches neither `packages/client`
   nor `docs/`. Not regenerated here; it is the same red on #749's Design Guardrails check.
8. Protocol-fallback rows: behind `includeProtocolFallback`
   (`hooks/commitment-pooling/useCommitmentsToConfirm.ts:116-162`), on by the W12 Protocol pool
   tab (`views/Community/components/CommunityPools.tsx:47`) and off on the Hub stage, so the
   cross-garden read is exercised only where the protocol console proves it does not browse other
   gardens' pools.

## Flags

- PR #749 must merge first; then `git merge origin/develop` here, re-run the Ship Gate, open the
  D1 PR with this table. The `design-generated` red will follow #749 unless decision 7 lands it.
- `.env` now exists in this worktree as a symlink (created 2026-08-21 20:09, not by this
  session); it was read only by Vite, never named in a command.
- The persisted TanStack cache (`gg-admin-react-query`) keeps pool rows after the ledger flips
  back, so a QA machine shows the console instead of the unavailable cast until the cache is
  dropped; production flips the other way and is unaffected.
