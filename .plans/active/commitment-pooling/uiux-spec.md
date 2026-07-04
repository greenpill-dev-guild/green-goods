# Commitment Pooling: UI/UX Spec (Four Surfaces)

**Feature Slug**: `commitment-pooling`
**Stage**: `active`
**Created**: 2026-07-03
**Scope**: PR-openable UI/UX specification for the August release (client PWA, admin, editorial website) plus the September community interface at wireframe depth. Builds on `corrections-log.md` (verified IA facts) and the 27 locked decisions from the 2026-07-03 alignment session. Contract-facing names (events, fields, module functions) defer to `contract-spec.md` in this folder; where this spec names a module concept it is a reference, not a definition.
**Grounding rule**: every claim about existing UI carries a repo file path. Everything else is marked NET-NEW.

---

## 0. Component naming and one chrome supersession

This spec names only canonical components per `.claude/skills/design/prompt-contract.md` and `client-prompt-contract.md`. One correction to the session plan's vocabulary: the admin `LeftSheet` / `RightSheet` / `BottomSheet` renderers are **retired**. Every admin overlay is a centered `AdminDialog` (detail/inspection) or an `AdminDialog` `variant="flow"` + `ActionFlowShell` (create/commit flows), per `.claude/skills/design/prompt-contract.md` Layout shell table and `.claude/skills/design/quick-reference.md § Sheet Slot Anatomy` (landed in PRs #610/#613). Flow-to-surface mappings below therefore use: **MainSheet route section** vs **AdminDialog detail** vs **flow AdminDialog**. Admin views compose `CanvasRouteFrame` + `CanvasRouteHeader` + `CanvasRouteContent` (mandated by `.claude/rules/frontend-design.md` Rule 1; verified in `packages/admin/src/views/Garden/Vault.tsx:28-31,151-158`).

Admin wrapper palette (15, filesystem is the count of record, `packages/admin/src/components/`): AdminBadge, AdminButton, AdminCard, AdminCheckbox, AdminDialog, AdminFab, AdminFilterChip, AdminLinearProgress, AdminListItem, AdminSearchToolbar, AdminSortSelect, AdminTabRail, AdminTextField, AdminTooltip, AdminViewActions. Client shared primitives per `client-prompt-contract.md`: DialogShell, Card, StatCard, StatusBadge, Alert, Skeleton, Spinner, HydrationFallback, FileUploadField, ListPrimitives, DatePicker, Surface, SyncStatusBar, AddressDisplay, DomainBadge. Missing primitives are flagged in §9, never invented.

---

## 1. Personas and roles recap (hat-based)

Roles are Hats-tree roles, not app accounts (`IHatsModule.GardenRole`: Owner, Operator, Evaluator, Gardener, Funder, Community; corrections-log §6). Canonical personas per `docs/docs/builders/specs/v1-0.mdx § 3.1`: Gardener, Operator, Evaluator, Funder, Community.

| Persona (hat) | Pool powers (per locked layer permissions) |
|---|---|
| Gardener | Create own offers/requests, claim, attach work + evidence, confirm when named counterparty |
| Operator / Owner | Everything gardeners do, plus: seed campaign commitments, analog capture on behalf of members, cycle management, claims review (approval-gated mode), dispute/override with reason, rewardPaid recording, fallback confirmation with reason |
| Evaluator | Delta/re-assessment + technical assessment authorship (assessment v3, decision #7); reviews flow through existing WorkApproval rails |
| Funder | Seed/match garden campaign rewards (reward-source reference only, custody stays with pool owner); read pool story |
| Community | View pool story, provide priority signal, confirm when named, community testimony attestation (Community Hat) when a commitment is aimed at the community |
| Protocol team | Operator-equivalent on the root garden's protocol pool (tokenId 1, decision #8); today this maps to the admin `deployer` role gate (`packages/admin/src/routes/views.tsx:270-276`) |

Self-confirmation is blocked everywhere. Counterparty confirmation is the review for SupportService/OperatorCaptured; DomainImpact keeps the full Work then WorkApproval path (decision #20).

## 2. The one-pool UX invariant

One pool UX across capability levels (UX Brief, locked). The base surface every member sees: offer support, request help, submit evidence, confirm promise kept, see open and fulfilled commitments, see readiness plus season/campaign progress. Settlement controls are additive and progressively disclosed later behind the pool's `settlementEnabled` capability flag; they are never a separate product, tab, or app. Every screen in this spec is designed so a settlement row can be added without moving anything.

## 3. Copy system

**Use**: offer, request, promise, promise kept, fulfilled, steward, season, campaign, readiness, confirmation, "take this up", "recorded on your behalf".
**Avoid** (UX Brief): debt, owed, leaderboard, balance-shaming, market-first or swap-first framing.
**Banned-vocab lint** (`bun run lint:vocab`, canonical list `docs/docs/reference/glossary-community.md § Banned Vocabulary`): no streak, countdown, leaderboard, FOMO anywhere; admin copy additionally bans hero language; client user copy bans dashboard/KPI/operator-cockpit words.
Practical consequences baked into this spec: due dates render as calm dates ("runs through March 12"), never ticking timers; per-garden stats never render as ranked lists (cross-garden overview sorts alphabetically, §6.8); small-community rate suppression (§7.2); admin celebration is a quiet confirmation row, only the client PWA gets hero moments (decision #27).

i18n: every new user-facing string ships as en + es + pt keys in `packages/shared/src/i18n/` (en.json verified; a 4-part locale coverage gate enforces parity). This spec proposes key families in §10 and writes no literal strings into code sections.

## 4. State-to-UI mapping tables

Locked state machines from the Lifecycle doc (digest §Locked state machines). Hybrid weight per decision #6: hard states on-chain, Draft and review-soft states app/indexer-derived. "Not surfaced" is an explicit decision, not an omission.

### 4.1 Pool states

| State | Client PWA | Admin | Editorial | Community |
|---|---|---|---|---|
| NotReady | Pool tab absent from garden detail | Garden Pool tab shows setup checklist (charter CID, capability flags) | Readiness copy, no stats | Readiness copy |
| Ready | Pool tab present, readiness banner ("warming up, promises open when the first cycle is seeded"), browse/create disabled | Seed-first-cycle CTA enabled | Readiness copy | Readiness copy |
| Open | Full base surface live | Full console | Live pool story | Live view + signal |
| Paused | Banner "paused by stewards" with reason, all writes disabled, browse view-only | Pause reason + resume action | Neutral quiet-period line, aggregates stay | View-only |
| Closed | View-only history | Compost action available | Aggregate story remains | View-only |
| Composted | History + "ready for the next season" line | Reopen or new-cycle actions | Past-cycles aggregate | History |

### 4.2 Cycle states (types: season, campaign)

| State | Client PWA | Admin | Editorial | Community |
|---|---|---|---|---|
| Draft | Not surfaced | Cycle card, Draft chip, edit + seed actions | Not surfaced | Not surfaced |
| Seeded | Pool banner "opens soon"; seeded commitments browsable read-only | Seeded list + open-cycle flow (includes allocation policy, §6.10) | Readiness copy ("promises are being prepared") | Read-only preview |
| Open | Browse + claim + create enabled | Full cycle console | Active cycle progress | View + signal |
| InProgress | Same chrome as Open, progress bar emphasized (members see one continuous "live" period; only the stage label differs) | Distinct stage on cycle stepper | Cycle progress | View |
| Reviewing | Banner "stewards are reviewing"; evidence + confirmations still allowed (Reviewing and InProgress interchange) | Review queue emphasized | "In review" line | View |
| Reconciled | Cycle summary card with promises-kept stats; cycle-close hero fires here (§5.10) | Reconciliation report + compost action | Cycle results in pool story | Results view |
| Composted | Archived under pool history; next-cycle banner | Archived + start-next-cycle | Rolled into past cycles | Archived |
| Cancelled | Quiet banner with reason | Cancelled chip + reason | Not surfaced (aggregates count completed cycles only) | Quiet banner |

### 4.3 Commitment states

| State | Client PWA | Admin | Editorial | Community |
|---|---|---|---|---|
| Draft | Author-only resume card in creation flow (local IndexedDB, `WorkDraftRecord` precedent `packages/shared/src/types/job-queue.ts:194-209`) | Operator drafts inside seeding console | Never | Never |
| Offered | Browse card, "Offer" chip, claim CTA per claim mode; owner sees waiting state | Pool list | Counts only | View |
| Requested | Browse card, "Request" chip, "I can help" CTA | Pool list | Counts only | View |
| Accepted | Counterparty named on detail; card moves to "matched" filter | Pool list | Counts only | View |
| Active | Work/evidence attach enabled, unit progress bar | Monitor list | Counted in active aggregate | View |
| EvidenceSubmitted | Evidence rows on detail, chip | Review queue (work approval rails for DomainImpact) | Not distinct from Active | View |
| PartiallyApproved | Partial progress bar + chip | Review queue | Not distinct | Not distinct |
| ReadyForConfirmation | Confirm CTA for named counterparties; pending-confirmations inbox item (§5.8) | Hub Confirm stage (§6.9) + operator fallback | Not distinct | Confirm CTA when named |
| Fulfilled | Fulfilled hero moment (§5.10), chip, declared-reward row | Reward row + "record payout" action | Fulfilled counts + promiseKeptRate | Testimony CTA when aimed at community |
| Reconciled | Terminal timeline entry, rolled into cycle summary | Cycle reports | Aggregates | View |
| Cancelled | Quiet chip + reason on detail, excluded from browse | List with reason | Aggregate counters only, never a public list | Not listed |
| Expired | Chip + "offer again" CTA for owner (per-cycle renewal, deep-dive L1) | Expiry queue + re-seed | Aggregate only | Not listed |
| Disputed | Detail banner "under review by stewards", CTAs frozen | Dispute resolution actions with mandatory reason, resolution visible in detail | Never surfaced individually; aggregates unchanged until resolved | Frozen view |

---

## 5. Surface 1: Client PWA (full depth)

### 5.1 Verified IA and placement resolution (decision #9)

Verified IA: bottom `AppBar` has exactly three tabs, Home `/home`, Garden `/home/garden`, Profile `/home/profile` (`packages/client/src/components/Layout/AppBar.tsx:35-59`, routes `packages/client/src/config/pwa-routing.ts:12-16`). The AppBar "Garden" tab is the work submission flow (Intro, Media, Details, Review steps; `packages/client/src/views/Garden/index.tsx` renders the `Work` component with `WorkIntro`/`WorkMedia`/`WorkDetails`/`WorkReview`, lines 46-49). Garden browsing and per-garden life happen in the Home tab: `GardenList` on `/home` (`packages/client/src/views/Home/index.tsx:28,273`) opens the garden detail at `/home/:id` (`packages/client/src/views/Home/Garden/index.tsx`), which carries `StandardTabs` with Work / Insights / Gardeners (`packages/shared/src/hooks/garden/useGardenTabs.ts:3-7`) plus the endowment and conviction drawers (`views/Home/Garden/index.tsx:41,476-478`).

Resolution: decision #9 puts pool/cycle/browse/claim/confirm "inside the Garden tab". The per-garden surface in the verified IA is the garden detail at `/home/:id`, so the pool experience lands there as a NET-NEW fourth `GardenTab` value `Pool` (extend the enum in `packages/shared/src/hooks/garden/useGardenTabs.ts:3-7`; hook stays in shared per the hook boundary). The AppBar Garden tab remains the work flow, gaining only the commitment-linkage context (§5.7). This honors the decision's intent (pool life inside the garden experience, no fourth AppBar tab) with the surface the IA actually has.

NET-NEW routes (client router): `/home/:id/pool` (tab deep link), `/home/:id/pool/:commitmentId` (commitment detail), `/home/:id/pool/new?direction=offer|request` (creation flow). AppBar hide rules extend the existing pattern (AppBar already hides on `/home/garden` and work detail, `AppBar.tsx:17-33`): hide on `/pool/new` (full-screen flow), keep visible on the pool tab and detail.

### 5.2 Pool home (garden detail Pool tab) NET-NEW

Content top to bottom:

1. **Pool state banner**: renders the pool-state row from §4.1. Readiness-only vs live is stated plainly in the banner copy, not implied by chrome (open question 1, §13). Component: shared `Alert` for paused/cancelled tones; a quiet `Surface` band otherwise.
2. **Cycle progress**: cycle name + type chip (season or campaign), stage stepper (Seeded, Open, InProgress, Reviewing, Reconciled), unit progress (workApprovalProgress = approvedUnits/expectedUnits) via the shared progress primitive (§9), and "runs through {date}" (never a ticking countdown). Cycle-level stats row: offered, accepted, fulfilled counts (`StatCard` grid, two per row).
3. **Browse: open offers and requests**: filter chips All / Offers / Requests / Matched / Mine (client-local chips; admin `AdminFilterChip` is admin-only). Cards show: type chip (DomainImpact with `DomainBadge`; SupportService plain), title, unit label + target quantity, due date, state chip (`StatusBadge`), claim CTA.
   - Claim CTA per claim mode (decision #19): OPEN mode renders "Take this up" and enqueues immediately (optimistic Accepted). APPROVAL_GATED renders "Ask to take this up" and enqueues a claim request (optimistic "requested, waiting for steward"). Mode is visible on the card as helper text, not a mode toggle; members never choose the mode.
   - Protocol-pool commitments surfaced in a garden context show a claim-custody choice for operators only: claim as myself vs claim for this garden (GardenAccount custody; deep-dive L1). Gardeners always claim as themselves. The choice is instrumented (§11).
4. **My commitments strip**: horizontal cards of the viewer's own offers/requests in this pool with state chips, linking to detail.

Empty pool (Open but zero commitments): planted-seed illustration slot + two primary CTAs "Offer support" / "Request help" and operator-seeded hint text. The two CTAs are the persistent creation entry at the top of the browse section in all non-empty states too (base surface, §2).

### 5.3 Commitment detail NET-NEW (`/home/:id/pool/:commitmentId`)

- Header: title, type chip, state chip, unit label + quantity, due date, claim-mode helper line.
- **State timeline**: vertical history of state transitions with actor and timestamp (module events via indexer). Uses the NET-NEW shared `StateTimeline` primitive (§9). Overrides and dispute resolutions render here with their reason text (lifecycle rule: overrides visible in member detail).
- **Evidence list**: rows of lightweight evidence (photo/link/note, IPFS CID) with attach button while Active/EvidenceSubmitted/PartiallyApproved. `ListPrimitives` rows + `FileUploadField` in the attach sheet (`DialogShell`).
- **Work linkage** (DomainImpact): linked work submissions with their `WorkDisplayStatus` chips (type `packages/shared/src/types/domain.ts:350-358`); "Submit work for this promise" CTA deep-links into the AppBar Garden tab flow with commitment context (§5.7); "Link existing work" opens a picker of the member's approved/pending works (enqueues `workLink`, §5.11).
- **Confirm CTA**: visible only when the signed-in user is a named counterparty in the confirmer group and state is ReadyForConfirmation. Opens the confirmation flow (§5.6). Self-confirmation never renders the CTA (blocked on-chain; UI mirrors it).
- **Declared reward row**: reward source (jar or treasury reference) + token + amount, and after Fulfilled a "reward released" or "reward pending" line fed by the module's rewardPaid record (decision #18). No custody or transfer controls on this surface in MVP.
- Analog-captured commitments carry a "recorded by your operator on your behalf" chip; the member remains the named promise source (§13 question 2).

### 5.4 Offer/request creation flow NET-NEW (`/home/:id/pool/new`)

Full-screen flow reusing the work-flow chrome pattern (`TopNav` + `FormProgress`, verified in `packages/client/src/views/Garden/index.tsx:41-44`). Direction (offer vs request) comes from the entry CTA and stays editable in step 1. Steps:

1. **What**: direction, commitment type (DomainImpact or SupportService for member creation; SeasonCampaign and OperatorCaptured are console-seeded only, §13 question 4), title, note.
2. **How much**: unit label (free text with suggestions: hours, tasks, meals, rides, plants), target quantity, due date (`DatePicker`) or cycle deadline default.
3. **Anchors** (DomainImpact only): pick the garden action(s) this promise fulfills through, using the action-selection card grammar the work flow intro already renders (`views/Garden/index.tsx:54-96` skeleton shows the action/garden card rails). SupportService skips this step entirely; its proof is lightweight evidence + confirmation (decision #20).
4. **Review and promise**: summary + "Make this offer" / "Ask for this help". Submission enqueues the `commitment` job kind (§5.11) and returns to the pool tab with the optimistic card visible.

Drafts persist locally per the existing draft pattern (mirror `WorkDraftRecord` semantics, `packages/shared/src/types/job-queue.ts:194-209`); resume prompt on re-entry (client `DraftDialog` precedent, `views/Garden/index.tsx:42`).

### 5.5 Evidence capture NET-NEW

From commitment detail: attach photo (camera or roll, `FileUploadField` with compression per the work flow's `imageCompressor` precedent in `packages/admin/src/views/Garden/SubmitWork.tsx:12`), a link, or a text note. All become one evidence object uploaded to IPFS at sync time (CID recorded via module event). One evidence object per enqueue; repeatable. Works fully offline: files serialize into IndexedDB (`SerializedFileData` pattern, `packages/shared/src/types/job-queue.ts:114-129`).

### 5.6 Counterparty confirmation flow NET-NEW

Entry points: commitment detail confirm CTA, and the pending-confirmations inbox (§5.8). Flow is a `DialogShell` sheet:

1. Summary of the promise (title, promiser, units, evidence count, linked-work approval status).
2. Any-N-of-group progress: "2 of 3 confirmations recorded" with the confirmer list (`AddressDisplay` rows; self highlighted). Progress meter needs the shared progress primitive (§9) with a text equivalent for screen readers.
3. Confirm ("Promise kept") or decline with reason (declining routes to steward attention, it does not cancel; lifecycle keeps rejection non-permanent).
4. Enqueue `confirmation` job; optimistic tick on the progress meter; if this was the Nth required confirmation, the optimistic state shows Fulfilled pending sync and the hero fires on sync completion (§5.10).

### 5.7 Work linkage through the existing flow

Work submission itself reuses the existing `work` job kind unchanged (task requirement; kinds today are exactly `work` and `approval`, `packages/shared/src/types/job-queue.ts:89-92`). Linkage:

- Deep link from commitment detail sets a commitment context in the work flow store (`useWorkFlowStore` import, `views/Garden/index.tsx:23`), NET-NEW field. The Review step shows a "fulfills: {commitment title}" row. On submit, the `work` job's `meta` carries `commitmentId` (meta is an open record, `packages/shared/src/types/job-queue.ts:26`); the queue enqueues a dependent `workLink` job after the work syncs.
- Post-hoc linking from commitment detail enqueues `workLink` directly with an existing workUID.
- The link is module-native (commitment record references work UIDs); WorkApproval rails are untouched.

### 5.8 Wallet dashboard panel: my commitments + pending confirmations

**Found component**: the wallet dashboard is `packages/client/src/views/Home/WalletDrawer/index.tsx`, a `ModalDrawer` opened from the Home header icon (`views/Home/index.tsx:268,302`). It already declares a third tab `id: "pools"` labeled with the existing i18n key `app.wallet.tab.commitments`, currently rendering `ComingSoonStub` (`WalletDrawer/index.tsx:42-47,68-74`).

Decision #9 said "Profile-tab wallet dashboard" with an explicit verify-in-execution clause. Execution verification: the wallet dashboard lives on the Home header, not the Profile tab (Profile is Account/Badges/Help sub-tabs, `packages/client/src/views/Profile/index.tsx:65-127`, with account panels in `views/Profile/Account.tsx`). The personal panel therefore lands in the already-reserved WalletDrawer pools tab; no Profile change ships in MVP (one panel, no duplication). Flagged as a verified deviation from the decision's wording, not its substance.

Panel content (replaces `ComingSoonStub`):
1. **My pending confirmations** (inbox, top): commitments where I am a named counterparty and state is ReadyForConfirmation, across all my gardens. Row: promiser, title, garden, "confirm" chevron into §5.6. Badge count on the drawer tab mirrors the cookie-jar tab's count pattern (`WalletDrawer/index.tsx:24-36`).
2. **My commitments**: all my offers/requests across gardens with state chips (`StatusBadge`), grouped by garden, linking into `/home/:id/pool/:commitmentId`.
3. Queued/unsynced items render with the queued chrome (§5.12) at the top of their group.

### 5.9 Home summary card NET-NEW

At most one card (decision #9): "Promises kept this cycle" on `/home` above `GardenList` (`views/Home/index.tsx:273`), shown only when at least one of the member's gardens has an Open/InProgress/Reviewing cycle. Content: fulfilled count vs due count across my gardens (absolute numbers, no percentage below the small-community threshold, §7.2) + tap-through to the busiest garden's pool tab. `Card` + `StatCard` composition. Not shown when empty; never a second pool card on Home.

### 5.10 Hero moments (client only, decision #27)

Registered against the canonical hero vocabulary (`.claude/skills/design/language.md § Hero Moments`; reference scaffold `packages/client/src/views/HeroMoments.stories.tsx`):

| Moment | Level | Fires where |
|---|---|---|
| Commitment Fulfilled | High | (a) confirmation success sheet when the viewer's confirmation was the Nth required (fires on sync completion, not enqueue); (b) once for the promiser on next mount of commitment detail or pool tab after the state flips, tracked by a local seen-marker |
| Cycle close (Reconciled) and compost | Medium (maps to the existing "seasonal transitions" slot) | Pool tab banner morph + cycle summary card reveal on first view of the Reconciled/Composted cycle |

Full Warm Earth amplification per the scaffold's grammar; `prefers-reduced-motion` collapses to a static celebratory frame. Admin surfaces get a quiet confirmation row for the same events, never hero treatment (`prompt-contract.md § Hero Moments Live in the Client, Not the Cockpit`). Editorial is read-only and celebrates nothing.

### 5.11 Per-action offline behavior (core deliverable)

Queue substrate (verified): IndexedDB + XState, exactly two kinds today (`work`, `approval`; `packages/shared/src/types/job-queue.ts:89-92`), `MAX_RETRIES = 5` (`packages/shared/src/modules/job-queue/index.ts:88,247-248`), kind dispatch is a branch in `processJob` (`index.ts:277-288`), executors in `modules/job-queue/job-executors.ts`. New kinds extend `JobKindMap` and the dispatch branch; naming follows the existing single-noun convention.

NET-NEW job kinds and per-action behavior:

| Action | Kind | Payload sketch (all addresses `Address`) | Optimistic UI | Queued chrome | Retry/failure (MAX_RETRIES 5) | Sync-complete invalidation |
|---|---|---|---|---|---|---|
| Create offer / request | `commitment` | `{ poolId, gardenAddress, direction: "offer"\|"request", commitmentType, title, note, unitLabel, targetQuantity, actionUIDs?, assessmentUID?, dueDate?, capturedFor? }` (`capturedFor` = analog capture member source) | Card appears in browse + my-commitments with Offered/Requested chip and queued badge | Queued badge on card; SyncStatusBar count includes it | Failed chip + retry/discard on card after 5 attempts; tap shows lastError parsed via `parseContractError` | `queryKeys.pools.commitments(poolId)`, `queryKeys.pools.mine(userAddress)`, `queryKeys.pools.stats(poolId)` |
| Claim / accept | `claim` | `{ commitmentId, poolId, gardenAddress, claimantKind: "garden"\|"individual", claimantAccount }` | OPEN mode: card flips to Accepted (matched) locally. APPROVAL_GATED: "waiting for steward" chip | Same queued badge grammar | Optimistic Accepted reverts to Offered/Requested with failed banner on permanent failure | `queryKeys.pools.commitment(commitmentId)`, `queryKeys.pools.commitments(poolId)` |
| Attach lightweight evidence | `evidence` | `{ commitmentId, gardenAddress, note?, link?, media?: File[] }` (files serialized per `SerializedFileData`) | Evidence row appears with uploading state | Row-level spinner + queued badge; media held in IndexedDB | Row failed state, retry per row; media never silently dropped | `queryKeys.pools.commitment(commitmentId)` |
| Link work to commitment | `workLink` | `{ commitmentId, workUID, gardenAddress }` (or deferred: `meta.commitmentId` on a `work` job spawns this after work syncs) | Linked-work row appears with pending chip | Chip "linking" | Row failed state + retry; work itself is unaffected | `queryKeys.pools.commitment(commitmentId)`, `queryKeys.works.*` (existing family) |
| Confirm fulfillment | `confirmation` | `{ commitmentId, gardenAddress, confirmed: boolean, reason?, fallbackByOperator?: boolean }` | Progress meter ticks; inbox row shows "confirmation queued" | Inbox + detail show queued chip; Fulfilled hero deferred to sync completion | Tick reverts + failed banner with retry; never double-enqueue for same commitment (dedupe by commitmentId + userAddress) | `queryKeys.pools.commitment(commitmentId)`, `queryKeys.pools.pendingConfirmations(userAddress)`, `queryKeys.pools.stats(poolId)` |
| Submit work | `work` (existing, unchanged) | Existing `WorkJobPayload` (`job-queue.ts:57-68`) + optional `meta.commitmentId` | Existing behavior | Existing SyncStatusBar behavior (`packages/shared/src/components/SyncStatusBar.tsx`) | Existing | Existing `worksKeys` + `queryKeys.pools.commitment` when meta carries linkage |

Query-key family: NET-NEW `poolsKeys` module at `packages/shared/src/config/query-keys/pools.ts` (pool, cycles, commitments, commitment, mine, pendingConfirmations, stats), registered in `packages/shared/src/config/query-keys/registry.ts:11-39` as `queryKeys.pools`.

View-only offline (no queueing, cached reads render with staleness note): pool/cycle stats, browse lists refresh, claim-mode metadata, reward status, dispute state. Console-side actions (seeding, cycle management, disputes, curation, rewardPaid) use the same queue plumbing but are online-expected admin actions (deep-dive offline split); the PWA never exposes them.

### 5.12 PWA state list to screen treatment (UX Brief list)

| Brief state | Treatment |
|---|---|
| Not ready | Pool tab absent (§4.1 NotReady); garden detail otherwise unchanged |
| Readiness-only | Pool tab with readiness banner, browse/create disabled, cycle stepper empty (§4.1 Ready) |
| Empty pool | Offer/Request CTAs + seeded-hint empty state (§5.2) |
| Active offers/requests | Full browse + claim surface (§5.2) |
| Queued offline job | Queued badge on the affected card/row + `SyncStatusBar` count above the AppBar (`packages/client/src/components/Layout/AppBar.tsx:63-68`); aria-live announcement (§12) |
| Pending confirmation | Inbox row (§5.8) + detail CTA (§5.3); confirmer sees progress meter |
| Fulfilled | Chip + hero moment once (§5.10); reward row updates |
| Failed/retry | Failed chip after 5 attempts with retry/discard; error text via `parseContractError` + `USER_FRIENDLY_ERRORS` |
| Disabled | Paused pool banner, controls disabled with explanation (never silently missing) |
| Settlement-enabled (later) | Reserved rows only; no MVP UI (§2) |

---

## 6. Surface 2: Admin (full depth)

### 6.1 Flow-to-surface map (decision #10)

| Flow | Workspace | Surface |
|---|---|---|
| Pool overview + cycle management | Garden | NET-NEW Pool tab on the Garden workspace MainSheet route (`/garden/pool`); tab rail precedent `packages/admin/src/views/Garden/index.tsx:81-98` (overview/activity/settings via `AdminTabRail`) |
| Operator seeding console | Garden | Flow AdminDialog (`variant="flow"` + `ActionFlowShell`), route `/garden/pool/seed`; precedent `packages/admin/src/views/Hub/CreateAssessment.tsx:12-22` |
| Claims/review queue (approval-gated) | Garden | Queue list inside Pool tab; row opens AdminDialog detail |
| Analog capture | Garden | Flow AdminDialog, route `/garden/pool/capture`; extends the Submit Work flow grammar (`packages/admin/src/views/Garden/SubmitWork.tsx:44-52`, route registration `packages/admin/src/routes/views.tsx:114-120`) |
| Commitment detail, dispute/override, rewardPaid | Garden (and Pools for protocol pool) | AdminDialog detail with workspace `tone` prop |
| Assessment v3 creation | Hub | Extend the existing flow AdminDialog at `/hub/assess/create` (`packages/admin/src/routes/views.tsx:124-135`, view `packages/admin/src/views/Hub/CreateAssessment.tsx`) |
| Confirmation queue | Hub | NET-NEW Confirm stage on the existing stage rail (§6.9) |
| Protocol pool console + cross-garden overview | NET-NEW Pools workspace | MainSheet route `/pools` with `AdminTabRail` (§6.8) |
| Cycle-open allocation policy | Garden (and Pools) | Step inside the open-cycle flow AdminDialog (§6.10) |

All admin copy stays restrained (no hero language, no gallery moments); celebration is a checkmark row in the cycle report.

### 6.2 Garden workspace: Pool tab + cycle management NET-NEW

Route `/garden/pool` added to the garden branch (`packages/admin/src/routes/views.tsx:168-215`) and to the Garden view's `AdminTabRail` (`packages/admin/src/views/Garden/index.tsx:81-98`). Composition: `CanvasRouteFrame` + `CanvasRouteHeader` (title "Pool", actions via `AdminViewActions`) + `CanvasRouteContent`.

Sections (AdminCard blocks):
1. **Pool status card**: pool state chip, capability flags (proofEnabled, paused), charter/policy CID link, pause/resume (`AdminButton` + `AdminConfirmDialog`).
2. **Cycle console**: current cycle card with the full locked state machine as a horizontal stepper (Draft, Seeded, Open, InProgress, Reviewing, Reconciled, Composted). Each transition is a guarded `AdminButton` opening `AdminConfirmDialog` with consequence copy; Cancelled is a destructive action behind a reason field. Reviewing and InProgress interchange renders as a toggle pair. Open-cycle runs the flow in §6.10. Past cycles list below (`AdminListItem` rows, Reconciled/Composted chips, each opening an AdminDialog cycle report: counts, units, workApprovalProgress, promiseKeptRate, cycleCompletionRate).
3. **Commitments table**: `AdminSearchToolbar` + `AdminFilterChip` row (state, type, direction) + `AdminSortSelect`; rows are `AdminListItem` with `AdminBadge` state chips; row opens the commitment AdminDialog detail (state timeline, evidence, linked work, confirmer rule, reward row, dispute/override actions §6.7).
4. **Claims queue** (visible when any approval-gated commitments exist): pending claim requests with claimant (`AddressDisplay`), claimantKind chip (garden vs individual), approve/decline with reason. Approving enqueues the accept; declining returns the commitment to browse.

### 6.3 Operator seeding console NET-NEW (`/garden/pool/seed`)

Flow AdminDialog + `ActionFlowShell` steps (stepper precedent `CreateAssessment.tsx:171-177`):

1. **Type and scope**: commitment type (SeasonCampaign, SupportService, DomainImpact, OperatorCaptured), direction (offer or request the pool is seeding), cycle binding, title, note. `AdminTextField` + type cards.
2. **Requirements**: unit label + target quantity, required approved-work count, required domains/actions where relevant (DomainImpact), optional assessment requirement toggle + assessment picker, due date or cycle-deadline default.
3. **Confirmation rule and reward**: confirmer rule builder, any N of a named group: address group picker (NET-NEW primitive, §9) + N stepper with validation N <= group size; claim mode toggle (open-claim vs approval-gated) prefilled by context default (protocol pool approval-gated, garden campaign open-claim; decision #19); declared reward: source reference (cookie jar address or treasury ref picker), token, amount (reference only, no custody move; decision #18).
4. **Review and seed**: summary + seed action. Console actions are online-expected but ride the same queue plumbing (§5.11 note).

### 6.4 Claims/review queue

Covered in §6.2 section 4. Work-approval review for DomainImpact commitments stays on the existing Hub Work stage and `approval` job rails; the commitment detail simply reflects approved-work counts (gates from the Lifecycle doc: attached, approved, assessment-complete when declared, then ReadyForConfirmation; operator waivers surface as visible overrides).

### 6.5 Analog capture NET-NEW (`/garden/pool/capture`)

Extends the Submit Work on-console pattern (flow AdminDialog + `ActionFlowShell`, `SubmitWork.tsx:44-52`). Differences from member creation (§5.4): step 0 selects the member (the social source; `capturedFor` in the `commitment` payload) and the capture kind (offer, request, or confirmation on the member's behalf). Non-custodial phrasing is fixed in the flow header: the record names the member as the promise source and the operator as recorder (§13 question 2). Captured confirmations require the operator to be fallback-eligible and always carry a reason. Writes go through the same job kinds, never direct contract writes from the form (digest analog-capture rule).

### 6.6 Assessment v3 creation (extend, not fork)

Extend `packages/admin/src/views/Hub/CreateAssessment.tsx` (steps today: DomainContextStep, StrategyKernelStep, ActionsHarvestStep, lines 15-17,44-59; orchestrated by shared `useCreateAssessmentWorkflow`, direct EAS attest, online-only, corrections-log §2). NET-NEW in step 1 (domain context): cycle selector (garden's cycles), assessment kind toggle **baseline vs re-assessment (delta)**, and, when delta, a baseline-reference picker listing the garden's prior baseline assessments for the same domain. Per garden per cycle per domain: the form validates one baseline per (garden, cycle, domain) and points duplicates at the existing record. Authorship gating per decision #7: baseline allows evaluator or operator (current resolver behavior, corrections-log §2); delta/re-assessment renders only for Evaluator-hat holders and the resolver enforces it. Remains a direct attest (no offline queue); failure surfaces inline per the existing flow.

### 6.7 Dispute/override and rewardPaid

On the commitment AdminDialog detail:
- **Dispute**: "Raise dispute" (allowed from Accepted through Expired per §4.3) with mandatory reason; resolution actions (to ReadyForConfirmation, Fulfilled, Cancelled, Expired, or Reconciled) each require reason text. All reasons render in the state timeline for members too.
- **Override**: requirement waivers (for example waive a rejected work's replacement) carry reason and a visible "override" marker in both admin and member detail (Lifecycle rule).
- **rewardPaid**: on Fulfilled, the declared-reward row gains "Record payout" (`AdminButton`); `AdminConfirmDialog` captures the executed rail reference (jar withdrawal or treasury tx) and records the module's rewardPaid event (decision #18). The row then shows paid status + reference. No value moves through this UI.

### 6.8 NEW Pools workspace NET-NEW

Registration path (all verified anchor points):
1. Add `"pools"` to `AdminWorkspaceId` and `ADMIN_WORKSPACE_ROOTS` plus `adminRoutes.pools()` helpers in `packages/shared/src/utils/navigation/admin-routes.ts:3-10,48-56`.
2. Add the route branch in `packages/admin/src/routes/views.tsx` using the deployer-gated Cookies precedent (`roleGatedBranch(["deployer"], ...)`, lines 269-277). Protocol team maps to the `deployer` role today.
3. Reach it via the command palette, not a fifth NavigationBar tab: add to `ADMIN_TEAM_COMMAND_ROUTES` (`packages/shared/src/hooks/admin-ui/navigation/workspaceViews.ts:60-68`, Cookies precedent). The NavigationBar keeps its four workspace tabs (`workspaceViews.ts:20-58`; `prompt-contract.md` NavigationBar row).
4. Tone: workspace tone scoping flows through `data-tone={workspaceId}` on the canvas (`packages/admin/src/components/Layout/CanvasLayout.tsx:453`); non-tone ids fall back to the neutral hub accent (`CanvasLayout.tsx:321-332`). MVP ships Pools on the hub fallback tone; a dedicated tone triple is a later polish item, avoiding an `AdminDialog` tone-union change now.

View at `/pools`: `CanvasRouteFrame` + `AdminTabRail` with two tabs.
- **Protocol pool tab**: the root-garden pool console (tokenId 1, `rootGarden 0xf401f34378384713222d1d21f63359cc4E8a858a`, corrections-log §6). Same section grammar as §6.2 (pool status, cycle console, commitments table, claims queue) plus: **funding view** (declared reward sources across protocol commitments, co-funded references with owning garden named; ownership stays with the garden pool, deep-dive L2), **claims across gardens** (claimant garden/individual column), and **confirmations queue** (protocol commitments awaiting confirmation, mirroring the Hub Confirm stage grammar §6.9 but scoped to the protocol pool).
- **Gardens tab (cross-garden overview)**: one `AdminListItem` row per garden with pool state chip, active cycle stage, promiseKeptRate, openExposureUnits (the safety gauge, deep-dive L3). **Sorted alphabetically by garden name, no ranking order by default and no rank column ever** (no-leaderboard invariant). `AdminSortSelect` offers alphabetical and "recently active" only. Row opens that garden's pool detail in an AdminDialog (read-only cross-garden inspection; management stays in the garden's own workspace).

### 6.9 Hub: Confirm stage on the existing rail NET-NEW

The Hub pipeline rail is `AdminTabRail` fed by `PIPELINE_STAGE_CONFIG` with stages work, assess, certify, history (`packages/shared/src/hooks/admin-ui/hub/hub.utils.ts:21,121`; counts and visibility built in `packages/shared/src/hooks/admin-ui/hub/hub.workbenchModel.ts:146-166`; rendered in `packages/admin/src/views/Hub/index.tsx:128-139`). Add stage `confirm` between certify and history: queue of commitments in ReadyForConfirmation where the signed-in account is in the confirmer group or fallback-eligible, across the operator's gardens. Row: promiser, commitment title, garden, N-of-group progress (`AdminLinearProgress` + text), confirm/decline actions opening the AdminDialog detail. Stage count = queue length (stageCounts pattern, `hub.workbenchModel.ts:146-152`). Route `/hub/confirm` added beside the existing hub children (`packages/admin/src/routes/views.tsx:96-166`); stage content branch added to `HubStageContent` (`packages/admin/src/views/Hub/components/HubStageContent.tsx`).

### 6.10 Hypercert allocation policy at cycle open NET-NEW

A step inside the open-cycle flow (§6.2 section 2): allocation-class bps editor with preset picker.

| Preset | gardeners | treasury | operator | evaluator | community | funder |
|---|---|---|---|---|---|---|
| Model 1 (default) | 6000 | 1500 | 1000 | 500 | 500 | 500 |
| Model 2 | 3000 | 4500 | editable remainder split across the four remaining classes | | | |
| Model 3 | 4000 | 2000 | 2000 | 1000 | editable remainder | |

Presets prefill the custom bps editor (`AdminTextField` numeric row per class); every field stays editable. Validation: sum must equal 10000 (mirror the `InvalidSplitRatio` guard grammar from `packages/contracts/src/resolvers/Yield.sol`, corrections-log §2); soft warning when treasury < 1500 bps (the guidance floor is 15 to 20 percent). The chosen classes snapshot onto the cycle (emitted at cycle open; indexer stores the bps snapshot) and drive the fulfilled-commitment Hypercert allowlist computation at mint time (allowlist/merkle pipeline stays app-side, corrections-log §2). The `CreateHypercert` flow (`packages/admin/src/views/Hub/CreateHypercert.tsx`) gains a bundle-source toggle at cut-over: legacy approved-work bundle vs fulfilled-commitment bundle (work nested as evidence), per contract-spec.

---

## 7. Surface 3: Editorial website (full depth, decision #21)

### 7.1 `/gardens/:id` GardenDialog: pool story section NET-NEW

The dialog today: hero banner, header, four-cell stats strip (`dl` grid, Entries / Hands at work / Assessments / Certificates, `packages/client/src/views/Public/GardenDialog.tsx:249-278`), `FieldNotesSection` (line 280), Impact Certificates section (282-332), operators section (336-360). The pool story inserts **after `FieldNotesSection` and before the Impact Certificates section**: field notes stay the first-scroll content (editorial identity untouched) and the promises narrative flows into certificates ("fulfilled promises become Impact Certificates"), reusing the local `SectionHeading` grammar (`GardenDialog.tsx:404`).

Section content:
1. **Pool state copy**: one sentence per §4.1 column. Pre-launch (NotReady/Ready) renders readiness copy only, no numbers ("This garden is preparing its first season of promises").
2. **Active cycle progress**: cycle name + type, stage phrase, "runs through {date}", one thin progress band (units approved vs expected). No timers.
3. **Promises kept aggregate**: offered and fulfilled counts, promiseKeptRate and cycleCompletionRate as percentages **only above the small-community threshold** (§7.2), otherwise a counts-only sentence ("9 promises made, 7 kept so far"). Rendered with the existing `StatCell` grammar (`GardenDialog.tsx:250-277`) inside the section, not by widening the four-cell strip.
4. **Hypercert reports tie-in**: when fulfilled-commitment bundles exist, one line linking down to the certificates section ("Fulfilled promises from this cycle are anchored in the certificates below").

The four-cell stats strip itself does not change in MVP. `/gardens` grid cards (`packages/client/src/views/Public/Gardens.tsx`) are untouched.

### 7.2 Small-community sensitivity (answers the digest's open question)

Recommendation, locked for this spec: percentage rates (promiseKeptRate, cycleCompletionRate) render publicly only when the cycle has **at least 5 due commitments and at least 3 distinct promisers**. Below threshold, show absolute counts in sentence form and never a percentage; a single lapsed promise in a three-person pool must not read as a 33 percent failure on a public page. Cancelled and Disputed never appear individually anywhere public (§4.3). The threshold applies to the PWA Home summary card percentage too (§5.9); inside the garden (pool tab), members see their own full numbers.

### 7.3 `/impact`: protocol-wide pool aggregates NET-NEW

Add one editorial section to `packages/client/src/views/Public/Impact.tsx` using its section grammar (EditorialKicker + EditorialHeading + reveal wrapper, verified at lines 290-296 and 367-380): kicker "Promises", heading on aggregate mutual-aid framing (Document B relay vocabulary: promises offered, promises kept, gardens with live pools). Content: protocol totals (gardens with open pools, commitments fulfilled this season, protocol-wide promiseKeptRate subject to §7.2 thresholds aggregated at protocol scale), one line explaining the commitment lifecycle in relay terms, and a link to `/gardens`. No per-garden table on this page (that is the admin overview's job, and public per-garden comparison drifts toward ranking).

### 7.4 Boundaries

Read-only, aggregate-only. No leaderboards, no ranked lists, no participant-level data, no wallet addresses tied to promise outcomes, no dispute or cancellation stories. All pool stats flow from module events via the indexer (EAS is not indexed; corrections-log §2 boundary), so the public surfaces need no easscan reads.

---

## 8. Surface 4: Community interface (September, wireframe + view alignment, decision #3)

### 8.1 Package and shell

NET-NEW package `packages/community`: its own PWA, consumes `@green-goods/shared` (hooks, tokens, primitives), Passkey auth reusing the client login flow pattern (`packages/client/src/views/Login/`). Three-tab bottom navigation mirroring the client AppBar convention (`packages/client/src/components/Layout/AppBar.tsx:35-59`) so shared auth, shell, and sync scaffolding transfer directly.

Proposed tabs and justification:
- **Home** (garden/community home): the community member belongs to a garden's community; home is that garden's public-plus story. Mirrors the client Home-as-landing convention.
- **Signals**: the one thing this interface adds to the world (propose and upvote); it earns a dedicated tab rather than hiding under Home.
- **Profile**: passkey account, my confirmations when named, my testimony history. Mirrors the client Profile tab, letting shared account components reuse.

No work submission, no claiming, no wallet drawer in September scope.

### 8.2 Views (purpose, content blocks, primary actions)

| View | Purpose | Content blocks | Primary actions |
|---|---|---|---|
| Home | See the garden pool story + readiness | Pool state banner (§4.1 community column); cycle progress band; aggregate stats (counts, thresholded rates per §7.2); recent fulfilled promises (aggregate cards, no member call-outs) | Tap-through to Signals; "confirm" shortcut appears only when named (badge) |
| Signals | Provide priority signal feeding the cycle-2 seeding gate | Problem list (open community-raised needs); solution proposals nested under problems; upvote counts; "surfaced to stewards" chip when a signal crosses the surfacing bar | Propose problem; propose solution; upvote where action is needed |
| Signal detail | One problem and its proposals | Problem statement; proposals with upvotes; status (open, surfaced, seeded as commitment with link) | Upvote; add proposal |
| Confirmations (inbox in Profile) | Confirm when named counterparty | Pending confirmations list (same grammar as §5.8); commitment summary; N-of-group progress | Confirm promise kept; decline with reason |
| Testimony (from a fulfilled commitment aimed at the community) | Community testimony attestation (Community Hat, EAS testimony schema) | Commitment summary; short testimony text field; prior testimonies (never averaged, digest rule) | Attest testimony |
| Profile | Account + history | Passkey account block; my confirmations history; my testimonies; language settings | Sign out; manage passkey |

Signal flow into admin: surfaced signals appear in the operator seeding console (§6.3 step 1) as a "from community signals" picker rail, closing the loop propose, upvote, surface, seed. The priority-signal rail exists at contract level only today (ActionSignalPool, corrections-log H5); the September UX writes signals through it or an app-level store, decided in the contract spec's cycle-2 gate section.

### 8.3 Open claim-flow question (flagged, with recommendation)

Open question: should community members claim commitments directly? **Document A's recommendation stands: stay view/signal/confirm for September.** Claiming implies work rails, evidence custody, and reward exposure the community interface deliberately lacks. Mitigation for real demand: operators capture community offers via analog capture (§6.5), keeping the member the named source. Revisit after one full cycle of signal data.

### 8.4 greenpill-commons divergence table (facts: corrections-log §5)

| Aspect | Reuse or discard | Why |
|---|---|---|
| Propose problem then propose solution flow | **Reuse (pattern)** | Verified repo description: "propose problems and solution onchain and upvote where action is needed"; matches the seeding gate's need for structured signal |
| Upvote where action is needed | **Reuse (pattern)** | Simple, legible priority signal for non-operator members |
| Signal-to-decision surfacing | **Reuse (pattern)** | Maps to signals surfacing in the operator seeding console (§8.2) |
| Next.js + Supabase + Privy stack | **Discard** | Green Goods is a Vite + shared-package monorepo with Passkey auth; corrections-log §5 verifies the stack difference |
| EAS integration | **Discard (nothing to reuse)** | Zero `eas` hits in the repo; the `eas`/`attestations` topics were aspirational |
| Contract-facing architecture | **Discard** | Predates the current protocol (last commit 2024-03-28; archived 2026-05-08); commitment state is module-native here |

---

## 9. Missing primitives (flag, do not invent)

| Primitive | Needed by | Closest existing thing and the gap |
|---|---|---|
| Shared linear progress meter (client-legal) | §5.2 cycle progress, §5.6 N-of-group meter, §7.1 progress band | `AdminLinearProgress` exists but is admin-only M3 (`packages/admin/src/components/AdminLinearProgress.tsx`); client has `FormProgress` (step dots, `packages/client/src/views/Garden/index.tsx:41`) which is not a quantity meter. Propose shared `ProgressMeter` in `packages/shared/src/components/` |
| State timeline | §5.3, §6.2 commitment detail history | No vertical event-history primitive exists in shared or client; propose shared `StateTimeline` (rows: state, actor, timestamp, reason) |
| Address group picker with N-of-group stepper | §6.3 confirmer rule builder | `ManageMembers` handles role membership (`packages/admin/src/views/Garden/ManageMembers.tsx`) but there is no reusable multi-address picker + threshold control; propose admin-side `AddressGroupField` composed from `AdminTextField` + `AddressDisplay` rows |
| Unit quantity field (number + unit label pair) | §5.4 step 2, §6.3 step 2 | Composable from `FormField` + `AdminTextField`/inputs today; flag as a candidate shared field if the composition repeats more than twice |

Tailwind gotcha applies to all new shared components: layout utilities authored in `packages/shared/src/` do not reach admin/client builds; use inline styles for layout in shared components or restate classes in the consumer (CLAUDE.md Known Gotchas; precedent `packages/shared/src/components/Canvas/MainSheet.tsx`).

## 10. i18n key families (requirement, not strings)

Every key ships en + es + pt (`packages/shared/src/i18n/en.json` + sibling locales; 4-part coverage gate). Existing family prefixes verified: `app.*` (client), `public.*` (editorial), `cockpit.*` and `app.admin.*` (admin). The wallet drawer already owns `app.wallet.tab.commitments` and `app.wallet.commitments.comingSoon` (`packages/client/src/views/Home/WalletDrawer/index.tsx:44,71`); the comingSoon key retires when §5.8 ships.

| Family | Surface |
|---|---|
| `app.pool.*` | PWA pool tab, creation flow, commitment detail, confirmation flow |
| `app.wallet.commitments.*` | Wallet drawer panel (§5.8) |
| `app.home.poolSummary.*` | Home summary card |
| `cockpit.garden.pool.*` | Admin Garden Pool tab, seeding, capture, claims queue |
| `cockpit.pools.*` | Pools workspace |
| `cockpit.hub.confirm.*` | Hub Confirm stage |
| `public.pool.*` | GardenDialog pool story + `/impact` promises section |
| `community.*` | `packages/community` (new package, same shared i18n pipeline) |

All copy in these families passes `bun run lint:vocab` (§3).

## 11. Analytics and instrumentation

PostHog project routing per repo rule: client PWA + editorial + community events go to App (163591); admin events to Admin (262122). Event family proposal (snake_case, one family so funnels stay queryable):

- `commitment_created` {direction, commitment_type, pool_type, captured_by_operator: bool}
- `commitment_claimed` {claim_mode, claimant_kind: "garden"|"individual", pool_type} : **the garden-vs-individual claim custody ratio required by the locked register is the claimant_kind property on this event; dashboard = ratio over time per pool_type**
- `commitment_evidence_attached` {media_kind}
- `commitment_work_linked` {via: "deep_link"|"post_hoc"}
- `commitment_confirmed` {nth_of_group, is_final, fallback_by_operator: bool}
- `commitment_fulfilled_viewed` {surface} (hero exposure)
- `cycle_opened` / `cycle_closed` / `cycle_composted` {cycle_type, allocation_preset}
- `reward_paid_recorded` {rail: "cookie_jar"|"treasury"}
- `pool_signal_created` / `pool_signal_upvoted` (community interface, September)
- Offline queue health rides the existing job analytics (`packages/shared/src/modules/job-queue/job-analytics.ts`): new kinds inherit job_added/completed/failed tracking automatically.

Privacy boundary: no counterparty addresses, commitment titles, or reason texts in event properties; counts, enums, and booleans only (matches the Linear/PostHog privacy rule in CLAUDE.md).

## 12. Accessibility notes

- **Confirmation flow focus order**: opening the confirm sheet moves focus to the sheet title; tab order is summary, progress meter (focusable, labeled "2 of 3 confirmations recorded"), reason field, decline, confirm; on close, focus returns to the invoking CTA or its replacement state chip. `DialogShell` and `AdminDialog` own the focus trap; do not hand-roll.
- **Offline status announcements**: enqueue and sync-complete events get an `aria-live="polite"` announcement region colocated with `SyncStatusBar` (`packages/shared/src/components/SyncStatusBar.tsx`): "Saved on this device, will sync when connected" on job_added while offline; "N promises synced" on completion. Failed jobs use an assertive announcement once, not per retry.
- **State never by color alone**: all state chips use `StatusBadge` (icon + color, `.claude/rules/frontend-design.md` Rule 12); the state timeline pairs icons with text labels.
- **Progress meters** always carry text equivalents (units approved of expected; confirmations recorded of required).
- **Hero moments** respect `prefers-reduced-motion` (static celebratory frame) and never trap focus; dismissible by any input.
- **Admin rail and tabs** inherit roving tabindex from `AdminTabRail` (quick-reference Tabs table); the new Confirm stage and Pool tab add no custom key handling.
- **Touch targets**: claim/confirm CTAs meet the 44px minimum on PWA cards; queued/failed badges are not the tap target, the card is.

## 13. Open UX questions from the brief, answered

1. **Readiness-only vs live/onchain explicitness**: state it in banner copy at the glance layer ("warming up" vs live cycle language, §4.1/§5.2); reserve chain-explicit phrasing ("recorded on Arbitrum") for the engage layer (commitment detail timeline footer). Do not put chain vocabulary on browse cards.
2. **Non-custodial phrasing for operator-assisted capture**: fixed pattern "Recorded by {operator} on your behalf. The promise stays yours." on both the admin capture flow header (§6.5) and the member's commitment detail chip (§5.3). The member is always the named source on the record; the recorder is metadata.
3. **Public stats for small communities**: threshold rule in §7.2 (rates only at >= 5 due commitments and >= 3 distinct promisers; counts-only sentences below). Applies to editorial and the PWA Home card; in-garden members always see full numbers.
4. **Which commitment types may live outside a domain action**: SupportService and OperatorCaptured always may (evidence + confirmation is their proof); SeasonCampaign may when seeded as non-impact (deferrable assessment per the Lifecycle gates); DomainImpact never (action linkage is enforced by the creation flow, §5.4 step 3, and the seeding console, §6.3 step 2).
5. **Where settlement controls will later sit**: behind the pool's `settlementEnabled` flag, additively: admin Garden Pool tab gains a Settlement section (curation/limits/valuing per the GE grammar) below the cycle console; PWA commitment detail's declared-reward row grows settlement rows; the Pools workspace funding view becomes the protocol settlement console. No new tabs, routes stay, one pool UX (§2).

---

## Appendix: verified anchor index (quick lookup)

| Anchor | Path |
|---|---|
| PWA tabs + sync bar | `packages/client/src/components/Layout/AppBar.tsx:35-59,63-68` |
| Work flow (Garden tab) | `packages/client/src/views/Garden/index.tsx` |
| Garden detail + tabs | `packages/client/src/views/Home/Garden/index.tsx`; `packages/shared/src/hooks/garden/useGardenTabs.ts:3-7` |
| Wallet dashboard (found) | `packages/client/src/views/Home/WalletDrawer/index.tsx:42-74` |
| Profile tab | `packages/client/src/views/Profile/index.tsx:65-127` |
| Job queue kinds + retries | `packages/shared/src/types/job-queue.ts:89-95`; `packages/shared/src/modules/job-queue/index.ts:88,247-288` |
| Query keys registry | `packages/shared/src/config/query-keys/registry.ts:11-39` |
| Admin workspace registry | `packages/shared/src/utils/navigation/admin-routes.ts:3-10,48-56`; `packages/shared/src/hooks/admin-ui/navigation/workspaceViews.ts:20-68` |
| Admin routes | `packages/admin/src/routes/views.tsx` |
| Hub stage rail | `packages/shared/src/hooks/admin-ui/hub/hub.utils.ts:21,121`; `packages/admin/src/views/Hub/index.tsx:128-139` |
| Flow dialog precedents | `packages/admin/src/views/Hub/CreateAssessment.tsx:12-22`; `packages/admin/src/views/Garden/SubmitWork.tsx:44-52` |
| Editorial dialog | `packages/client/src/views/Public/GardenDialog.tsx:249-360` |
| Editorial impact page | `packages/client/src/views/Public/Impact.tsx:290-296,367-380` |
| Bps sum guard precedent | `packages/contracts/src/resolvers/Yield.sol` (InvalidSplitRatio, corrections-log §2) |
