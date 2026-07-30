# Commitment Pooling: UI/UX Spec (Four Surfaces)

**Feature Slug**: `commitment-pooling`
**Stage**: `active`
**Created**: 2026-07-03
**Scope**: PR-openable UI/UX specification for the August release (client PWA, admin, editorial website) plus the September community interface at wireframe depth. Builds on `reports/corrections-log.md` (verified IA facts) and the 27 locked decisions from the 2026-07-03 alignment session. Contract-facing names (events, fields, module functions) defer to `contract-spec.md` in this folder; where this spec names a module concept it is a reference, not a definition.
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
| Gardener | Create own offers/requests, claim, attach work + evidence, confirm when eligible under the stored rule |
| Operator / Owner | Everything gardeners do, plus: seed campaign commitments, analog capture on behalf of members, cycle management, claims review (approval-gated mode), dispute/override with reason, `ArbitrumExternal` payout recording, `CeloSettlement` queueing when separately gated, steward fallback confirmation with reason when the operator is not the accepted provider |
| Evaluator | Delta/re-assessment + technical assessment authorship (assessment v3, register #7); reviews flow through existing WorkApproval rails |
| Funder | Seed/match garden campaign rewards (reward-source reference only, custody stays with pool owner); read pool story |
| Community | View pool story, provide priority signal, confirm when named, community testimony attestation (Community Hat) when a commitment is aimed at the community |
| Protocol team | Operator-equivalent on the root garden's protocol pool (tokenId 1, register #8); today this maps to the admin `deployer` role gate (`packages/admin/src/routes/views.tsx:270-276`) |

Provider self-confirmation is blocked everywhere, including steward fallback. With no explicit confirmer group, an Offer defaults to its recipient and a Request defaults to its creator/requester. A named group is evaluated after excluding the accepted provider; creation/acceptance fails when its threshold would become unreachable. Confirmation is the review for SupportService/StewardCaptured; DomainImpact keeps the full Work then WorkApproval path (register #20).

## 2. The one-pool UX invariant

One pool UX across capability levels (UX Brief, locked). The base surface every member sees: offer support, request help, submit evidence, confirm promise kept, see open and fulfilled commitments, see readiness plus season/campaign progress. August G$ settlement status and operator queue surfaces are additive through `SettlementModule` and `settlementAccounts[garden].active`; app lanes must not flip the pooling module's reserved `settlementEnabled` flag. Transferable-voucher controls are progressively disclosed later behind `settlementEnabled`; they are never a separate product, tab, or app. Every screen in this spec is designed so a settlement row can be added without moving anything.

## 3. Copy system

**Use**: offer, request, promise, promise kept, fulfilled, steward, season, campaign, readiness, confirmation, "take this up", "recorded on your behalf".
**Avoid** (UX Brief): debt, owed, leaderboard, balance-shaming, market-first or swap-first framing.
**Banned-vocab lint** (`bun run lint:vocab`, canonical list `docs/docs/reference/glossary-community.md § Banned Vocabulary`): no streak, countdown, leaderboard, FOMO anywhere; admin copy additionally bans hero language; client user copy bans dashboard/KPI/operator-cockpit words.
Practical consequences baked into this spec: due dates render as calm dates ("runs through March 12"), never ticking timers; per-garden stats never render as ranked lists (cross-garden overview sorts alphabetically, §6.8); small-community rate suppression (§7.2); admin celebration is a quiet confirmation row, only the client PWA gets hero moments (register #27).

i18n: every new user-facing string ships as en + es + pt keys in `packages/shared/src/i18n/` (en.json verified; a 4-part locale coverage gate enforces parity). This spec proposes key families in §10 and writes no literal strings into code sections.

## 4. State-to-UI mapping tables

Locked state machines from the Lifecycle doc (digest §Locked state machines). Hybrid weight per register #6: hard states on-chain, Draft and review-soft states app/indexer-derived. "Not surfaced" is an explicit decision, not an omission.

`None` / `UNKNOWN` enum sentinels are never user-visible states. They mean the record is absent, not registered yet, or an out-of-order indexer placeholder. Reads render loading/not-found/recovery chrome until a creation event replaces the sentinel; they never display a “None” chip.

### 4.1 Pool states

| State | Client PWA | Admin | Editorial | Community |
|---|---|---|---|---|
| NotReady | Pool tab absent from garden detail | Garden Pool tab setup checklist requires charter CID, non-zero provider open-commitment cap, and one current non-revoked Baseline assessment (v2/v3, recipient = pool garden, resolver-validated Baseline kind); capability flags remain visible | Readiness copy, no stats | Readiness copy |
| Ready | Pool tab present, readiness banner ("warming up, promises open when the first cycle is seeded"), browse/create disabled | Open-pool action on the pool status card + seed-first-cycle CTA (register #34a) | Readiness copy | Readiness copy |
| Open | Full base surface live | Full console | Live pool story | Live view + signal |
| Paused | Banner “new participation paused by stewards” with indexed reason; browse, evidence/linkage, cancellation/expiry, and dispute recovery remain available; create/claim/Ready-submit/confirm are disabled | Pause reason + resume action; safe-wind-down controls remain | Neutral quiet-period line, aggregates stay | View-only plus allowed recovery |
| Closed | View-only history | Compost action available | Aggregate story remains | View-only |
| Composted | History + "ready for the next season" line | Reopen or new-cycle actions | Past-cycles aggregate | History |

### 4.2 Cycle states (types: season, campaign)

Cycle cardinality is part of the UI contract: a pool may have **at most one open Season and zero or more open Campaigns at the same time**. The Season is the primary long-running context; Campaigns are separate, concurrently active contexts and never replace, overwrite, or masquerade as the Season. Every selector and aggregate names its scope (`All current work`, the Season name, or one Campaign name). Opening another Season is blocked with a link to the existing open Season; opening another Campaign is allowed without enumerating every cycle on-chain.

| State | Client PWA | Admin | Editorial | Community |
|---|---|---|---|---|
| Draft | Not surfaced | Cycle card, Draft chip, edit + seed actions | Not surfaced | Not surfaced |
| Seeded | Pool banner "opens soon"; seeded commitments browsable read-only | Seeded list + open-cycle flow (includes allocation policy, §6.10) | Readiness copy ("promises are being prepared") | Read-only preview |
| Open | Browse + claim + create enabled | Full cycle console | Active cycle stage, counts, and exact-label summaries | View + signal |
| InProgress | Same chrome as Open, with scoped state counts emphasized (members see one continuous "live" period; only the stage label differs) | Distinct stage on cycle stepper | Cycle stage and counts | View |
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
| Active | Work/evidence attach enabled, per-commitment `approvedUnits / targetUnits` progress | Monitor list | Counted in active aggregate | View |
| EvidenceSubmitted | Evidence rows on detail, chip | Review queue (work approval rails for DomainImpact) | Not distinct from Active | View |
| PartiallyApproved | Partial progress bar + chip | Review queue | Not distinct | Not distinct |
| ReadyForConfirmation | Confirm CTA for eligible stored-rule members; default Offer recipient or Request creator when no group is stored; pending-confirmations inbox item (§5.8) | Hub Confirm stage (§6.9) + eligible operator fallback | Not distinct | Confirm CTA when eligible |
| Fulfilled | Fulfilled hero moment (§5.10), chip, declared-reward row | Reward row + "record payout" action | Fulfilled counts + promiseKeptRate | Testimony CTA when aimed at community |
| Reconciled | Terminal timeline entry, rolled into cycle summary | Cycle reports | Aggregates | View |
| Cancelled | Quiet chip + reason on detail, excluded from browse | List with reason | Aggregate counters only, never a public list | Not listed |
| Expired | Chip + "offer again" CTA for owner (per-cycle renewal, deep-dive L1) | Expiry queue + re-seed | Aggregate only | Not listed |
| Disputed | Detail banner "under review by stewards", CTAs frozen | Dispute resolution actions with mandatory reason, resolution visible in detail | Never surfaced individually; aggregates unchanged until resolved | Frozen view |

### 4.4 Approval-gated claim-request states

Claim requests are records with their own lifecycle; they are not a pending boolean on the commitment. The contract stores canonical `claimant`, authenticated `requestedBy`, `kind`, `gardenContext`, `requestedAt`, and `active`; the indexed view exposes those fields plus `state`, `reasonCID`, and `resolutionCode`, with active derived only as `state == PENDING`. Individual claims use caller for both identities. Garden claims use the GardenAccount as `claimant` and its authenticated operator/owner as `requestedBy`. The UI labels `gardenContext` as “provider garden context” and `requestedBy` as “requested by”; accepted commitments separately expose `providerGarden`.

| Request state | Claimant treatment | Operator treatment | Recovery / exit |
|---|---|---|---|
| Pending | “Waiting for steward” row with request time and provider context; the commitment remains browseable to other eligible claimants | Active queue row shows the exact stored terms; Accept and Decline act on this row only | The frozen interface has no claimant-cancel action: wait for Accept/Decline, another acceptance, or commitment cancellation/expiry |
| Accepted | Request row becomes “Accepted”; commitment detail names the accepted counterparty/provider garden | Accepted row moves to history; acceptance consumes the stored terms | Continue to work/evidence; caller-supplied replacement terms are never accepted |
| Declined | Rationale is visible to that claimant; commitment remains browseable and “Ask again” creates a fresh request if it is still open | Only the selected row becomes Declined; every other pending request remains Pending | Edit provider context where allowed and submit a fresh request; never retry the declined request record |
| Superseded | “Taken up by another provider” or “No longer available,” according to the indexed resolution code; no false failure or retry action | Acceptance, pre-acceptance cancellation, or pre-acceptance expiry marks every still-pending indexed request Superseded | Exit to browse; a new request is possible only if the commitment later becomes claimable again |

Network/queue failure before `ClaimRequested` exists is not Declined: the optimistic row reverts and offers the ordinary offline Retry/Discard path. Contract-level Declined and Superseded states come from indexed events and survive refresh.

---

## 5. Surface 1: Client PWA (full depth)

### 5.1 Verified IA and placement resolution (register #9)

Verified IA: bottom `AppBar` has exactly three tabs, Home `/home`, Garden `/home/garden`, Profile `/home/profile` (`packages/client/src/components/Layout/AppBar.tsx:35-59`, routes `packages/client/src/config/pwa-routing.ts:12-16`). The AppBar "Garden" tab is the work submission flow (Intro, Media, Details, Review steps; `packages/client/src/views/Garden/index.tsx` renders the `Work` component with `WorkIntro`/`WorkMedia`/`WorkDetails`/`WorkReview`, lines 46-49). Garden browsing and per-garden life happen in the Home tab: `GardenList` on `/home` (`packages/client/src/views/Home/index.tsx:28,273`) opens the garden detail at `/home/:id` (`packages/client/src/views/Home/Garden/index.tsx`), which carries `StandardTabs` with Work / Insights / Gardeners (`packages/shared/src/hooks/garden/useGardenTabs.ts:3-7`) plus the endowment and conviction drawers (`views/Home/Garden/index.tsx:41,476-478`).

Resolution: register #9 puts pool/cycle/browse/claim/confirm "inside the Garden tab". The per-garden surface in the verified IA is the garden detail at `/home/:id`, so the pool experience lands there as a NET-NEW fourth `GardenTab` value `Pool` (extend the enum in `packages/shared/src/hooks/garden/useGardenTabs.ts:3-7`; hook stays in shared per the hook boundary). The AppBar Garden tab remains the work flow, gaining only the commitment-linkage context (§5.7). This honors the decision's intent (pool life inside the garden experience, no fourth AppBar tab) with the surface the IA actually has.

NET-NEW routes (client router): `/home/:id/pool` (tab deep link), `/home/:id/pool/:commitmentId` (commitment detail), `/home/:id/pool/new?direction=offer|request` (creation flow). AppBar hide rules extend the existing pattern (AppBar already hides on `/home/garden` and work detail, `AppBar.tsx:17-33`): hide on `/pool/new` (full-screen flow), keep visible on the pool tab and detail.

### 5.2 Pool home (garden detail Pool tab) NET-NEW

Content top to bottom:

1. **Pool state banner**: renders the pool-state row from §4.1. Readiness-only vs live is stated plainly in the banner copy, not implied by chrome (open question 1, §13). Component: shared `Alert` for paused/cancelled tones; a quiet `Surface` band otherwise.
2. **Current cycles**: the open Season, when present, renders as the primary card with its stage stepper, calm end date, scoped state counts, and exact-label unit groups (for example, `hours` and `Hours` remain separate). There is no synthetic cross-commitment progress percentage. A **Campaigns** rail/list follows with zero or more concurrently open Campaign cards; each shows its type, stage, date, counts, and same-label unit groups. A scope control (`All current work` / Season name / Campaign name) filters the commitment list and always labels aggregate scope. If no Season is open but Campaigns are, the Campaigns remain fully usable; an empty Season slot explains that no Season is active rather than hiding Campaigns.
3. **Browse: open offers and requests**: filter chips All / Offers / Requests / Matched / Mine (client-local chips; admin `AdminFilterChip` is admin-only). Cards show: type chip (DomainImpact with `DomainBadge`; SupportService plain), title, unit label + target quantity, due date, state chip (`StatusBadge`), claim CTA.
   - Claim CTA per claim mode (register #19): OPEN mode renders "Take this up" and enqueues immediately (optimistic Accepted). APPROVAL_GATED renders "Ask to take this up" and enqueues a claim request (optimistic "requested, waiting for steward"), then renders the exact request lifecycle in §4.4. Mode is visible on the card as helper text, not a mode toggle; members never choose the mode.
   - Protocol-pool commitments surfaced in a garden context open the locked `W25@context-chooser` pre-claim sheet for eligible operators only (register #51): take this up as myself vs take this up for this garden. The claim stores `ClaimType` plus `gardenContext`; acceptance derives and stores `providerGarden`. This does not transfer token, commitment, or reward custody and is not a member-delivery fallback. The choice is instrumented (§11).
4. ~~My commitments strip~~ — **removed 2026-07-18** (client-minimalism audit): the WalletDrawer Commitments tab (§5.8) is the single cross-garden "mine" surface; the `Mine` filter chip in the browse section covers in-garden self-filtering. No horizontal strip renders on this tab.

Empty pool (Open but zero commitments): planted-seed illustration slot + two primary CTAs "Offer support" / "Request help" and operator-seeded hint text. The two CTAs are the persistent creation entry at the top of the browse section in all non-empty states too (base surface, §2).

### 5.3 Commitment detail NET-NEW (`/home/:id/pool/:commitmentId`)

- Header: title, type chip, state chip, unit label + quantity, due date, claim-mode helper line.
- **State timeline**: vertical history of state transitions with actor and timestamp (module events via indexer). Uses the NET-NEW shared `StateTimeline` primitive (§9). Overrides and dispute resolutions render here with their reason text (lifecycle rule: overrides visible in member detail).
- **Evidence list**: rows of lightweight evidence (photo/link/note, IPFS CID) with attach button while Active/EvidenceSubmitted/PartiallyApproved. `ListPrimitives` rows + `FileUploadField` in the attach sheet (`DialogShell`).
- **Work linkage** (DomainImpact): linked work submissions with their `WorkDisplayStatus` chips (type `packages/shared/src/types/domain.ts:350-358`); "Submit work for this promise" CTA deep-links into the AppBar Garden tab flow with commitment context (§5.7); "Link existing work" opens a picker of the member's approved/pending works (enqueues `workLink`, §5.11).
- **Ready submission**: SupportService, StewardCaptured, and evidence-only SeasonCampaign details show “Send for confirmation” after at least one evidence item and any declared assessment are attached. It enqueues the `confirmation` job with `action: "submit"`. DomainImpact never shows this control; work approvals drive its Ready transition.
- **Confirm CTA**: visible only when state is ReadyForConfirmation and the signed-in user is eligible under the stored rule: a named-group member, the Offer recipient default, the Request creator default, or an eligible steward fallback. The accountable lead and every contributor are always excluded, even when an address is also a steward or named-group member. Opens the confirmation flow (§5.6).
- **Declared reward row**: always names the stored reward rail. `ArbitrumExternal` shows source (jar or treasury reference), token, amount, and after Fulfilled a "reward released" or "reward pending" line fed by the module's `RewardPaid` record. `CeloSettlement` shows the G$ settlement state with settlement-record-first precedence: queued, on its way, confirming arrival, arrived, failed, or origin-specific cancellation. `None` renders no reward row. No custody or transfer controls live on the member surface.
- **Withdraw / steward cancel**: while Offered/Requested the creator sees "Withdraw this offer/request…" with a required reason — the creator path of `cancelCommitment` (register #34b; `prototypes.md` MF-2a). The Accepted steward path is locked at `W10@cancel` with its own required-reason confirmation (register #51/MF-2b). Both are online contract actions, not queue kinds.
- Analog-captured commitments carry a "recorded by your operator on your behalf" chip; the member remains the named promise source (§13 question 2).

### 5.4 Offer/request creation flow NET-NEW (`/home/:id/pool/new`)

Full-screen flow reusing the work-flow chrome pattern (`TopNav` + `FormProgress`, verified in `packages/client/src/views/Garden/index.tsx:41-44`). Direction (offer vs request) comes from the entry CTA and stays editable in step 1. Steps:

1. **What, team, and cycle scope**: direction, commitment type (DomainImpact or SupportService for member creation; SeasonCampaign and StewardCaptured are console-seeded only), immutable contributor policy (`Open` or `LeadManaged`) with its join-rule explanation, claim type (Individual for member creation), claim mode from the context default, title, note, and one explicit binding: an Open Season, one Open Campaign, or cycle-less where allowed. Seeded cycles are operator-only. Entry from a scoped pool filter prefills that cycle but keeps it visible and editable; the form never guesses from “current cycle.”
2. **How much and proof**: unit label, target quantity, `requiresAssessment`, due date or cycle deadline default. DomainImpact requires a positive approved-work count per bound action (set beside each action in step 3); SupportService may explicitly carry no work requirement and then requires evidence before Ready.
3. **Requirements** (DomainImpact only): add repeatable `{ actionUID, requiredCount }` rows reading "This promise needs: [Action] × [count]." The flow validates at least one row, registry existence, and a non-zero count; action UID `0` is valid and actions may share a domain. Domains are derived from ActionRegistry. The UI never presents four as a product maximum; the eventual `MAX_REQUIREMENTS` follows the 8/16/24/32 gas/indexer benchmark. It uses the action-selection card grammar the work flow intro already renders (`views/Garden/index.tsx:54-96`). SupportService skips Work requirements and uses lightweight evidence + confirmation (register #20).
4. **Review and promise**: summary repeats the immutable contributor policy and its join rule plus every ordered requirement/count row, then "Make this offer" / "Ask for this help". Submission enqueues the `commitment` job kind (§5.11) and returns to the pool tab with the optimistic card visible.

Drafts persist locally per the existing draft pattern (mirror `WorkDraftRecord` semantics, `packages/shared/src/types/job-queue.ts:194-209`); resume prompt on re-entry (client `DraftDialog` precedent, `views/Garden/index.tsx:42`).

### 5.5 Evidence capture NET-NEW

From commitment detail: attach photo (camera or roll, `FileUploadField` with compression per the work flow's `imageCompressor` precedent in `packages/admin/src/views/Garden/SubmitWork.tsx:12`), a link, or a text note. The form also requires **Credit contributors**, a labelled bounded multi-select containing only active roster members; the signed-in active contributor may be preselected visibly, but no invisible attribution fallback exists. All become one evidence object uploaded to IPFS at sync time (CID recorded via module event). One evidence object per enqueue; repeatable. A contributor's first evidence attribution supplies one participation credit for recognition; later distinct evidence stays visible as provenance but cannot multiply their share. Works fully offline: files serialize into IndexedDB (`SerializedFileData` pattern, `packages/shared/src/types/job-queue.ts:114-129`) and the exact ordered unique `creditedContributors` address vector is serialized beside them. Retry reuses that immutable vector instead of reading the later roster.

### 5.6 Fulfillment confirmation flow NET-NEW

Entry points: commitment detail confirm CTA, and the pending-confirmations inbox (§5.8). Flow is a `DialogShell` sheet:

1. Summary of the promise (title, promiser, units, evidence count, linked-work approval status).
2. Any-N-of-group progress: "2 of 3 confirmations recorded" with the confirmer list (`AddressDisplay` rows; self highlighted). Progress meter needs the shared progress primitive (§9) with a text equivalent for screen readers.
3. Confirm ("Promise kept") or choose **Not yet** with a required reason. Not yet calls `raiseDispute`; it does not enqueue a negative confirmation or cancel the commitment.
4. Confirm enqueues a positive-only `confirmation` job; optimistic tick on the progress meter; if this was the Nth required confirmation, the optimistic state shows Fulfilled pending sync and the hero fires on sync completion (§5.10). Not yet is online-only because dispute creation is not an offline queue kind; failure leaves ReadyForConfirmation and exposes retry.

### 5.7 Work linkage through the existing flow

Work submission itself reuses the existing `work` job kind unchanged (task requirement; kinds today are exactly `work` and `approval`, `packages/shared/src/types/job-queue.ts:89-92`). Linkage:

- Deep link from commitment detail sets a commitment context in the work flow store (`useWorkFlowStore` import, `views/Garden/index.tsx:23`), NET-NEW field. Register #51 locks the read-only "fulfills: {commitment title}" row at `WFLOW@review`. On submit, the `work` job's `meta` carries `commitmentId` (meta is an open record, `packages/shared/src/types/job-queue.ts:26`); the queue enqueues a dependent `workLink` job after the work syncs.
- Post-hoc linking from commitment detail enqueues `workLink` directly with an existing workUID.
- The link is module-native (commitment record references work UIDs); WorkApproval rails are untouched.

### 5.8 Wallet dashboard panel: my commitments + pending confirmations

**Found component**: the wallet dashboard is `packages/client/src/views/Home/WalletDrawer/index.tsx`, a `ModalDrawer` opened from the Home header icon (`views/Home/index.tsx:268,302`). It already declares a third tab `id: "pools"` labeled with the existing i18n key `app.wallet.tab.commitments`, currently rendering `ComingSoonStub` (`WalletDrawer/index.tsx:42-47,68-74`).

Decision register #9 said "Profile-tab wallet dashboard" with an explicit verify-in-execution clause. Execution verification: the wallet dashboard lives on the Home header, not the Profile tab (Profile is Account/Badges/Help sub-tabs, `packages/client/src/views/Profile/index.tsx:65-127`, with account panels in `views/Profile/Account.tsx`). The personal panel therefore lands in the already-reserved WalletDrawer pools tab; no Profile change ships in MVP (one panel, no duplication). Flagged as a verified deviation from the decision's wording, not its substance.

Panel content (replaces `ComingSoonStub`):
1. **Header summary line** (absorbed §5.9's retired home card, decision 2026-07-18): "Promises kept this cycle: X of Y due" — absolute numbers, cross-garden, rendered only when a member garden has a live cycle. This tab is the **single** cross-garden promises summary in the client.
2. **My pending confirmations** (inbox, top): commitments where I am eligible under the stored confirmer rule and state is ReadyForConfirmation, across all my gardens. Row: promiser, title, garden, "review" chevron into §5.6. Badge count on the drawer tab mirrors the cookie-jar tab's count pattern (`WalletDrawer/index.tsx:24-36`).
3. **My commitments**: all my offers/requests across gardens with state chips (`StatusBadge`), grouped by garden, linking into `/home/:id/pool/:commitmentId`.
4. Queued/unsynced items render with the queued chrome (§5.12) at the top of their group.

### 5.9 Home summary card — RETIRED (decision 2026-07-18)

Removed by user decision during the visual-asset audit: Home stays garden-first with **no** promises card above `GardenList`. The cross-garden summary lives solely as the WalletDrawer Commitments-tab header line (§5.8 item 1). Supersedes register #9's "at most one card" — the count is now zero; wireframes W6 carries the matching tombstone.

### 5.10 Hero moments (client only, register #27)

Registered against the canonical hero vocabulary (`.claude/skills/design/language.md § Hero Moments`; reference scaffold `packages/client/src/views/HeroMoments.stories.tsx`):

| Moment | Level | Fires where |
|---|---|---|
| Commitment Fulfilled | High | (a) confirmation success sheet when the viewer's confirmation was the Nth required (fires on sync completion, not enqueue); (b) once for the promiser on next mount of commitment detail or pool tab after the state flips, tracked by a local seen-marker |
| Cycle close (Reconciled) and compost | Medium (maps to the existing "seasonal transitions" slot) | Pool tab banner morph + cycle summary card reveal on first view of the Reconciled/Composted cycle |

Full Warm Earth amplification per the scaffold's grammar; `prefers-reduced-motion` collapses to a static celebratory frame. Admin surfaces get a quiet confirmation row for the same events, never hero treatment (`prompt-contract.md § Hero Moments Live in the Client, Not the Cockpit`). Editorial is read-only and celebrates nothing.

### 5.11 Per-action offline behavior (core deliverable)

Queue substrate (verified): IndexedDB + XState, exactly two kinds today (`work`, `approval`; `packages/shared/src/types/job-queue.ts:89-92`), `MAX_RETRIES = 5` (`packages/shared/src/modules/job-queue/index.ts:88,247-248`), kind dispatch is a branch in `processJob` (`index.ts:277-288`), executors in `modules/job-queue/job-executors.ts`. New offline kinds (`commitment`, `claim`, `evidence`, `workLink`, `confirmation`) extend `JobKindMap` and the dispatch branch; `transfer` is a shared online wallet action kind that bypasses the offline field queue. Naming follows the existing single-noun convention.

Membership wait (register #34c): all five pool job kinds run a pre-flight membership check before their first send attempt; a job whose account holds no garden hat enters `waiting_for_hat` — consuming no retries — and resumes automatically when the membership event lands (the join-request approval of register #35 is the canonical trigger). The ≥99% offline-sync metric excludes time in this state (`acceptance-matrix.md` §6).

NET-NEW job kinds and per-action behavior:

| Action | Kind | Payload sketch (all addresses `Address`) | Optimistic UI | Queued chrome | Retry/failure (MAX_RETRIES 5) | Sync-complete invalidation |
|---|---|---|---|---|---|---|
| Create offer / request | `commitment` | Common fields are `{ poolId, cycleId, gardenAddress, direction, claimType, claimMode, contributorPolicy, onBehalfOf, title, note, unitLabel, targetUnits, requiresAssessment, dueDate, metadataCID, needUID, confirmers: Address[], confirmationThreshold, reward }`. The authoritative shape is a discriminated union: DomainImpact adds `{ commitmentType: "DomainImpact", requirements: Array<{ actionUID: bigint, requiredCount: number }> }` and accepts no caller-authored `domainTags`; the builder omits them and the executor rejects/ignores any stale value because the contract derives domains from ActionRegistry. Evidence-only kinds add `{ commitmentType: "SupportService"\|"SeasonCampaign"\|"StewardCaptured", requirements: [], domainTags: number[] }`, preserving their optional validated tags. The queue builder and executor preserve every requirement row in order, including valid action UID `0`; they never reconstruct retired positional arrays. `cycleId=0`, zero address, empty arrays, zero UID, and zero reward are explicit sentinels, never omitted defaults. Builder/executor tests assert exact round-trip equality, DomainImpact rejection of caller tags, and evidence-only tag preservation. | Card appears in selected cycle scope + mine with Offered/Requested chip | Queued badge; SyncStatusBar count | Failed chip + retry/discard after 5 attempts; `parseContractError` | pool commitments/mine/stats |
| Claim commitment | `claim` | `{ commitmentId, poolId, kind: "garden"\|"individual", gardenContext }`. Executor rejects `kind != stored claimType`. Individual derives `claimant=requestedBy=userAddress`; Garden derives `claimant=gardenContext`, `requestedBy=userAddress` after operator authorization. Neither identity may equal the commitment creator; the builder disables/rejects creator-operated Garden requests, and ApprovalGated acceptance rechecks the stored requester. Accept/decline are separate online admin mutations keyed by canonical claimant. | OPEN: Accepted locally. APPROVAL_GATED: Pending row with canonical claimant + requestedBy | Queued badge; indexed outcome replaces optimistic state | Pre-event failure reverts row; Declined/Superseded are event outcomes, not queue failures | commitment, requests, requestsByClaimant |
| Attach lightweight evidence | `evidence` | `{ commitmentId, gardenAddress, creditedContributors: Address[], note?, link?, media?: File[] }` (files serialized per `SerializedFileData`). Builder validates 1–`MAX_EVIDENCE_CONTRIBUTORS_PER_ATTACHMENT` unique active roster addresses and persists their exact order. After upload, the executor calls `attachEvidence(commitmentId, cid, creditedContributors)`; retries reuse the serialized vector and never infer recipients from the current roster. | Evidence row appears with uploading state and named credited contributors | Row-level spinner + queued badge; media and attribution held in IndexedDB | Row failed state, retry per row; media/attribution never silently dropped | `queryKeys.pools.commitment(commitmentId)` |
| Link work to commitment | `workLink` | `{ commitmentId, workUID, requirementIndex, gardenAddress }` (or deferred: `meta.{ commitmentId, requirementIndex }` on a `work` job spawns this after work syncs). The builder resolves the selected requirement row and the executor forwards that exact index; repeated action UIDs never use first-match behavior. | Linked-work row appears with pending chip | Chip "linking" | Row failed state + retry; work itself is unaffected | `queryKeys.pools.commitment(commitmentId)`, `queryKeys.works.*` (existing family) |
| Submit ready / confirm fulfillment | `confirmation` | discriminated union `{ action: "submit", commitmentId, gardenAddress }` or `{ action: "confirm", commitmentId, gardenAddress }`. Submit is limited to evidence-only SupportService/StewardCaptured/SeasonCampaign and checks evidence + assessment. Positive confirmation stays provider-excluding. Steward fallback is an online admin mutation with mandatory reason. | Submit shows “waiting for confirmation”; confirm advances meter | Detail/inbox queued chip; hero waits for sync | Optimism reverts on failure; dedupe by action + commitmentId + userAddress | commitment, pendingConfirmations, stats |
| Not yet / raise dispute | online contract action, not a queue kind | `{ commitmentId, reason }` | No optimistic state transition; control shows wallet pending | No offline queue chrome | Failure leaves ReadyForConfirmation and shows inline retry; success invalidates to Disputed | `queryKeys.pools.commitment(commitmentId)`, `queryKeys.pools.pendingConfirmations(userAddress)` |
| Accept/decline claim; attach assessment; steward Ready override | online shared mutation hooks | canonical claimant key for accept/decline; `{ commitmentId, assessmentUID }` for attach; `{ commitmentId, reason }` for override | No offline optimism beyond wallet-pending row | No field-queue chrome | Failure preserves current indexed state and exposes inline retry | commitment, claim requests, pending confirmations |
| Join/add/remove/leave/assign contributor | online shared mutation hooks, never queue kinds | discriminated payloads call `joinCommitment(commitmentId)`, `leaveCommitment(commitmentId)`, `addContributor(commitmentId, contributor)`, `removeContributor(commitmentId, contributor)`, or `setContributorRequirement(commitmentId, contributor, requirementIndex, assigned)`. “Invite” is the member picker that resolves an address before `addContributor`; it is not an on-chain invitation state. | Wallet-pending control only; indexed roster remains authoritative until confirmation | No offline queued badge; disabled offline with “Connect to update the team” | Failure preserves the roster/assignment and keeps the selected member for explicit retry; cap, freeze, lead, and credited-removal errors use inline copy | commitment, contributors, pending confirmations |
| Send G$ | `transfer` | `{ chainId: 42220, token, to, amount }` | Wallet row shows wallet-pending state after submit; balance refresh waits for tx confirmation | Online-only wallet action; never enters the offline field queue and never shows queued badge | Wallet rejection / tx failure surfaces inline with retry CTA; no MAX_RETRIES job replay | `queryKeys.settlement.memberBalance(userAddress)`, `queryKeys.settlement.disbursements(userAddress)` |
| Submit work | `work` (existing, unchanged) | Existing `WorkJobPayload` (`job-queue.ts:57-68`) + optional `meta.commitmentId` | Existing behavior | Existing SyncStatusBar behavior (`packages/shared/src/components/SyncStatusBar.tsx`) | Existing | Existing `worksKeys` + `queryKeys.pools.commitment` when meta carries linkage |

Query-key family: NET-NEW `poolsKeys` module at `packages/shared/src/config/query-keys/pools.ts` (pool, cycles, commitments, commitment, mine, claimRequests, claimRequestsByClaimant, pendingConfirmations, stats), registered in `packages/shared/src/config/query-keys/registry.ts:11-39` as `queryKeys.pools`.

View-only offline (no queueing, cached reads render with staleness note): pool/cycle stats, browse lists refresh, claim-mode metadata, reward status, dispute state. Console-side actions (seeding, cycle management, disputes, curation, rewardPaid) use the same queue plumbing but are online-expected admin actions (deep-dive offline split); the PWA never exposes them.

### 5.12 PWA state list to screen treatment (UX Brief list)

| Brief state | Treatment |
|---|---|
| Not ready | Pool tab absent (§4.1 NotReady); garden detail otherwise unchanged |
| Readiness-only | Pool tab with readiness banner, browse/create disabled, cycle stepper empty (§4.1 Ready) |
| Empty pool | Offer/Request CTAs + seeded-hint empty state (§5.2) |
| Active offers/requests | Full browse + claim surface (§5.2) |
| Claim request Pending | Request row shows stored kind/provider garden/request time and “waiting for steward”; commitment remains available to other eligible claimants (§4.4) |
| Claim request Declined | Claimant sees reason + “Ask again” when still open; only the selected request is cleared (§4.4) |
| Claim request Superseded | “Taken up by another provider”; exit to browse, never a failed-job Retry (§4.4) |
| Queued offline job | Queued badge on the affected card/row + `SyncStatusBar` count above the AppBar (`packages/client/src/components/Layout/AppBar.tsx:63-68`); aria-live announcement (§12) |
| Waiting for membership | Amber queued-variant row — "waiting for your garden membership — no retries used"; resumes automatically when the hat lands (register #34c; drawing `prototypes.md` MF-5) |
| Pending confirmation | Inbox row (§5.8) + detail CTA (§5.3); confirmer sees progress meter |
| Fulfilled | Chip + hero moment once (§5.10); reward row updates |
| Failed/retry | Failed chip after 5 attempts with retry/discard; error text via `parseContractError` + `USER_FRIENDLY_ERRORS` |
| Disabled | Paused pool banner, controls disabled with explanation (never silently missing) |
| Settlement status | Queued = “support is queued”; Dispatched = “support on its way”; Celo-executed/ack-pending = “confirming arrival”; only authenticated CCIP success acknowledgment = “support arrived”; AA-gated member delivery stays unavailable with an explanation |

---

## 6. Surface 2: Admin (full depth)

### 6.1 Flow-to-surface map (register #10)

| Flow | Workspace | Surface |
|---|---|---|
| Pool overview + cycle management | Garden | NET-NEW Pool tab on the Garden workspace MainSheet route (`/garden/pool`); tab rail precedent `packages/admin/src/views/Garden/index.tsx:81-98` (overview/activity/settings via `AdminTabRail`) |
| Operator seeding console | Garden | Flow AdminDialog (`variant="flow"` + `ActionFlowShell`), route `/garden/pool/seed`; precedent `packages/admin/src/views/Hub/CreateAssessment.tsx:12-22` |
| Claims/review queue (approval-gated) | Garden | Queue list inside Pool tab; row opens AdminDialog detail |
| Analog capture | Garden | Flow AdminDialog, route `/garden/pool/capture`; extends the Submit Work flow grammar (`packages/admin/src/views/Garden/SubmitWork.tsx:44-52`, route registration `packages/admin/src/routes/views.tsx:114-120`) |
| Commitment detail, dispute/override, rewardPaid | Garden (and Community Pools mode for protocol pool) | AdminDialog detail with workspace `tone` prop |
| Assessment v3 creation | Hub | Extend the existing flow AdminDialog at `/hub/assess/create` (`packages/admin/src/routes/views.tsx:124-135`, view `packages/admin/src/views/Hub/CreateAssessment.tsx`) |
| Confirmation queue | Hub | NET-NEW Confirm stage on the existing stage rail (§6.9) |
| Protocol pool console + current-garden pool | Community workspace, NET-NEW Pools mode | Nested route `/community/pools` with the Community mode rail (§6.8) |
| Cycle-open allocation policy | Garden (and Community Pools mode) | Step inside the open-cycle flow AdminDialog (§6.10) |

All admin copy stays restrained (no hero language, no gallery moments); celebration is a checkmark row in the cycle report.

### 6.2 Garden workspace: Pool tab + cycle management NET-NEW

Route `/garden/pool` added to the garden branch (`packages/admin/src/routes/views.tsx:168-215`) and to the Garden view's `AdminTabRail` (`packages/admin/src/views/Garden/index.tsx:81-98`). Composition: `CanvasRouteFrame` + `CanvasRouteHeader` (title "Pool", actions via `AdminViewActions`) + `CanvasRouteContent`.

Sections (AdminCard blocks):
1. **Pool status card**: pool state chip, capability flags, charter/policy CID, provider open-commitment cap, and latest qualifying Baseline assessment. The app keeps the Ready action disabled until all three preflight inputs are present; the submitted contract write itself enforces charter plus a non-zero concurrent-commitment cap only. Once Ready, the card's primary action is **Open pool**; **Close pool** appears after the last cycle composts, then Compost/Reopen per §4.1 (register #34a — the card owns the pool lifecycle; the open-cycle flow adds only a "pool is Ready — open it now?" guard prompt). Pause requires a reason CID; resume clears the indexed reason. The card disables only create/claim/Ready-submit/confirm while paused and keeps safe-wind-down controls available.
2. **Cycles console**: a dedicated Season slot shows the one open Season or an empty “No open Season” state, followed by a Campaigns list that may contain any number of concurrently open Campaigns. Every row has its own locked-state stepper (Draft, Seeded, Open, InProgress, Reviewing, Reconciled, Composted), scoped counts, and guarded actions; opening a second Season is blocked and points to the existing one, while opening another Campaign remains available. Cancelled is destructive behind a reason field, Reviewing/InProgress interchange is scoped to one row, and open-cycle runs §6.10 for the selected cycle. Reconciled/Composted/Cancelled history appears below with type and report scope preserved.
3. **Commitments table**: `AdminSearchToolbar` + `AdminFilterChip` row (state, type, direction) + `AdminSortSelect`; rows are `AdminListItem` with `AdminBadge` state chips; row opens the commitment AdminDialog detail (state timeline, evidence, linked work, confirmer rule, reward row, dispute/override actions §6.7).
4. **Claims queue** (visible when any approval-gated requests exist): each row shows canonical `claimant`, authenticated `requestedBy`, `claimType`, `gardenContext`, `requestedAt`, and `state`. For a Garden claim the claimant is the GardenAccount and requestedBy is its operator; for Individual they match. The creator cannot request a Garden claim through a GardenAccount they operate; the claim control is disabled with the self-claim explanation, and acceptance rechecks stored legacy/pending rows before mutation. Accept/decline key the exact stored claimant. Accept shows derived `providerGarden` and supersedes other pending rows; decline requires a reason and affects only the selected row. History exposes reason/resolution without presenting event outcomes as queue failures.

**Layout addendum (audit 2026-07-18)**: the Pool card carries an above-the-fold summary row (awaiting-confirmation / claims-waiting / failed-payout counts with jump links); the commitments table uses segmented state chips **Open · Confirmed · Past** instead of any history sub-view — composted cycles and settled records surface under Past (the Garden `OverviewTab` chip precedent) and the old cycle-console "History:" row is retired; commitment rows open in the **left inspector** (`AdminDialog` via the Garden sheet descriptor), never a right rail (the right sheet stays account chrome). W7 draws all of this.

### 6.3 Steward seeding console NET-NEW (`/garden/pool/seed`)

Flow AdminDialog + `ActionFlowShell` steps (stepper precedent `CreateAssessment.tsx:171-177`):

1. **Type and scope**: commitment type (SeasonCampaign, SupportService, DomainImpact, StewardCaptured), direction (offer or request the pool is seeding), cycle binding, title, note. The cycle selector groups the one open Season separately from every open Campaign, labels type on every option, and permits an explicit cycle-less choice where the contract allows it. `AdminTextField` + type cards.
2. **Requirements and team policy**: unit label + target quantity; repeatable `{ actionUID, requiredCount }` rows; immutable `ContributorPolicy` (`Open` or `LeadManaged`); optional assessment requirement; due date or cycle-deadline default. DomainImpact requires at least one registered row and a positive count per action. SupportService, StewardCaptured, and SeasonCampaign may explicitly choose evidence-only with no Work requirements. The review step shows per-requirement progress and the single commitment's `approvedUnits` use `floor(targetUnits × Σ min(approved[i], required[i]) / Σ required[i])`. No assessment UID is attached at creation because `providerGarden` is not frozen until acceptance.
3. **Confirmation rule and reward**: direction-aware default preview (Offer recipient; Request creator) or explicit any-N named group. The address group picker excludes the accountable lead and every contributor before threshold validation, and the flow blocks an unreachable threshold. Claim mode toggle (open-claim vs approval-gated) is prefilled by context default (protocol pool approval-gated, garden campaign open-claim; register #19). The reward section first selects exactly one rail: `None`, `ArbitrumExternal`, or `CeloSettlement`. `None` requires zero source/token/amount. `ArbitrumExternal` captures the external source reference, token, and amount for later payout recording. `CeloSettlement` stores source zero and canonical G$ at seeding because a protocol Request has no provider garden yet; acceptance resolves that garden and SettlementModule stores its active Safe as plan payer. The preview labels this as “payer selected with the provider garden,” then shows the conserved contributor plan with explicit retention after fulfillment. It never enables `Record payout`.
4. **Review and seed**: summary repeats the immutable contributor policy and who may join/manage the roster, then exposes the seed action. Console actions are online-expected but ride the same queue plumbing (§5.11 note). See Appendix B for the dated five-step amendment to this list.

### 6.4 Claims/review queue

Covered in §6.2 section 4. Work-approval review for DomainImpact commitments stays on the existing Hub Work stage and `approval` job rails; the commitment detail simply reflects approved-work counts (gates from the Lifecycle doc: attached, approved, assessment-complete when declared, then ReadyForConfirmation; operator waivers surface as visible overrides).

After acceptance, an assessment-required commitment exposes **Attach assessment** at the locked `W10@attach-assessment` placement (register #51). The picker includes only non-revoked v2/v3 attestations whose recipient equals the stored `providerGarden`; submission calls the shared `attachAssessment` mutation. Evidence-only records use the realized W10 Accepted action row: **Cancel promise**, **Mark ready with override**, and **Send for confirmation**. DomainImpact never shows Send for confirmation. Override and cancellation remain separate, steward-only, reason-required actions.

### 6.5 Analog capture NET-NEW (`/garden/pool/capture`)

Extends the Submit Work on-console pattern (flow AdminDialog + `ActionFlowShell`, `SubmitWork.tsx:44-52`). Differences from member creation (§5.4): step 0 selects the member (the social source; `capturedFor` in the `commitment` payload) and the capture kind (offer, request, or confirmation on the member's behalf). Non-custodial phrasing is fixed in the flow header: the record names the member as the promise source and the operator as recorder (§13 question 2). Captured confirmations require the operator to be fallback-eligible and always carry a reason. Writes go through the same job kinds, never direct contract writes from the form (digest analog-capture rule).

### 6.6 Assessment v3 creation (extend, not fork)

Extend `packages/admin/src/views/Hub/CreateAssessment.tsx` (steps today: DomainContextStep, StrategyKernelStep, ActionsHarvestStep, lines 15-17,44-59; orchestrated by shared `useCreateAssessmentWorkflow`, direct EAS attest, online-only, corrections-log §2). NET-NEW in step 1 (domain context): cycle selector (garden's cycles), assessment kind toggle **baseline vs re-assessment (delta)**, and, when delta, a baseline-reference picker listing the garden's prior baseline assessments for the same domain. Per garden per cycle per domain: the form validates one baseline per (garden, cycle, domain) and points duplicates at the existing record. Authorship gating per register #7: baseline allows evaluator or operator (current resolver behavior, corrections-log §2); delta/re-assessment renders only for Evaluator-hat holders and the resolver enforces it. Remains a direct attest (no offline queue); failure surfaces inline per the existing flow.

### 6.7 Dispute/override and reward settlement

On the commitment AdminDialog detail:
- **Dispute**: "Raise dispute" (allowed from Accepted through Expired per §4.3) with mandatory reason; resolution actions are `RestorePrevious`, `Fulfill`, `Cancel`, or `Expire`, each with required reason. The module stores the pre-dispute state; `RestorePrevious` returns to it. An Expired commitment cannot resolve Fulfilled. All reasons render in the state timeline for members too.
- **Override**: requirement waivers (for example waive a rejected work's replacement) carry reason and a visible "override" marker in both admin and member detail (Lifecycle rule).
- **ArbitrumExternal payout record**: on Fulfilled, this rail alone gains "Record payout" (`AdminButton`); `AdminConfirmDialog` captures the executed rail reference (jar withdrawal or treasury tx) and records the module's `RewardPaid` event (register #18). The row then shows paid status + reference. No value moves through this UI.
- **CeloSettlement queue**: on Fulfilled, this rail instead gains "Set recognition and payment"
  after pooling, settlement-account, and provider-garden authority gates are GREEN. The
  member-delivery gate does not block local plan bookkeeping. The editor names canonical G$,
  provider garden, canonically recomputed recognition default, explicit retention, and contributor
  payout amounts. Saving creates an editable parent draft and atomically derives payment weights
  from the complete amount vector. A separate **Finalize payout plan** action verifies
  conservation and freezes it without creating children. Only **Prepare payout** for a non-zero
  row requires `memberDeliveryEnabled` and the live route; the first action creates one immutable
  Queued child and an exact repeat returns the same child. An all-retained zero-child plan
  completes on finalization without CCIP even while delivery is disabled. `Record payout` is
  unavailable and the parent/child settlement rows own all later delivery status.

### 6.8 Community workspace: Pools mode NET-NEW

Registration path (all verified anchor points):
1. Add `"pools"` to `AdminCommunityMode` and use the existing `adminRoutes.communityMode("pools")` helper in `packages/shared/src/utils/navigation/admin-routes.ts`; do not add an `AdminWorkspaceId` or top-level root.
2. Add `/community/pools` inside the existing Community route branch in `packages/admin/src/routes/views.tsx`, using the same Community authorization boundary. It renders the Protocol pool plus the current garden only. Protocol-only actions remain deployer-gated inside the mode; cross-garden inspection belongs exclusively to the deployer-gated Operations workspace.
3. Add Pools to the existing Community mode rail. The NavigationBar and command palette continue to target the canonical `/community` workspace; no fifth workspace tab or top-level command route is introduced.
4. Pools inherits the Community workspace tone through `data-tone="community"`; dialogs pass that same tone.

View at `/community/pools` — **rescoped 2026-07-18**: the admin stays garden-focused, so this mode shows exactly **the Protocol pool + this garden's pool**; other gardens' pools never render here (the cross-garden overview moved to the Operations workspace, §6.11). The inner `AdminTabRail` carries two focused views:
- **Protocol pool tab**: the root-garden pool console (tokenId 1, `rootGarden 0xf401f34378384713222d1d21f63359cc4E8a858a`, corrections-log §6), framed for the garden steward: **claimable by your gardeners** (open protocol commitments — surveys, community activations — with the W25 claim journey), **your garden's involvement** (this garden's claims/accepted rows + confirmations queue, mirroring the Hub Confirm grammar §6.9 scoped to the protocol pool), and the **funding view** (declared reward references only; co-funded references name the owning garden). Protocol-only *actions* stay deployer-gated inline.
- **This garden tab**: one tap into the same §6.2 pool console (W7) — no duplicated grammar, with the Open · Confirmed · Past chips carrying history in place.

### 6.9 Hub: Confirm stage on the existing rail NET-NEW

The Hub pipeline rail is `AdminTabRail` fed by `PIPELINE_STAGE_CONFIG` with stages work, assess, certify, history (`packages/shared/src/hooks/admin-ui/hub/hub.utils.ts:21,121`; counts and visibility built in `packages/shared/src/hooks/admin-ui/hub/hub.workbenchModel.ts:146-166`; rendered in `packages/admin/src/views/Hub/index.tsx:128-139`). Add stage `confirm` between certify and history: queue of commitments in ReadyForConfirmation where the signed-in account is eligible under the stored rule or steward-fallback rule, across the operator's gardens. Row: promiser, commitment title, garden, N-of-group progress (`AdminLinearProgress` + text), confirm and Not yet actions opening the AdminDialog detail. Not yet calls `raiseDispute` with a reason. Stage count = queue length (stageCounts pattern, `hub.workbenchModel.ts:146-152`). Route `/hub/confirm` added beside the existing hub children (`packages/admin/src/routes/views.tsx:96-166`); stage content branch added to `HubStageContent` (`packages/admin/src/views/Hub/components/HubStageContent.tsx`).

### 6.10 Hypercert allocation policy at cycle open NET-NEW

A step inside the open-cycle flow (§6.2 section 2): allocation-class percentage editor plus a
within-gardeners recognition policy preset. The UI converts the six allocation fields and the
equal/verified recognition fields to bps and submits both immutable structs atomically in
`openCycle(cycleId, allocation, recognitionPolicy)`; neither snapshot is stored during
`seedCycle`, and each group must total 10,000 bps.

| Preset | gardeners | treasury | operator | evaluator | community | funder |
|---|---|---|---|---|---|---|
| Model 1 (default) | 6000 | 1500 | 1000 | 500 | 500 | 500 |
| Model 2 | 3000 | 4500 | editable remainder split across the four remaining classes | | | |
| Model 3 | 4000 | 2000 | 2000 | 1000 | editable remainder | |

Presets prefill the custom editor (`AdminTextField` numeric row per class); every field stays editable. **Display unit is percent** (audit 2026-07-18): the editor renders % values (Model 1 = 60 / 15 / 10 / 5 / 5 / 5) with a "stored on-chain as basis points (×100)" helper line — bare "bps" labels proved unreadable; bps remains the on-chain/spec unit, and the on-chain `operator` allocation class renders as "steward" in UI copy. Validation: sum must equal 100% / 10000 bps (mirror the `InvalidSplitRatio` guard grammar from `packages/contracts/src/resolvers/Yield.sol`, corrections-log §2); soft warning when treasury < 15% (the guidance floor is 15 to 20 percent). The chosen classes snapshot onto the cycle (emitted at cycle open; indexer stores the bps snapshot) and drive the fulfilled-commitment Hypercert allowlist computation at mint time (allowlist/merkle pipeline stays app-side, corrections-log §2). The `CreateHypercert` flow (`packages/admin/src/views/Hub/CreateHypercert.tsx`) gains a bundle-source toggle at cut-over: legacy approved-work bundle vs fulfilled-commitment bundle (work nested as evidence), per contract-spec. The full cycle-close ritual is choreographed by the W26 `ActionFlowShell` wizard launched from the cycle console: first read exact indexed `CommitmentCycle.liveCommitmentCount` and require zero, then call `closeCycle` to lock the exact fulfilled set as Reconciled, render read-only shares and mint the certificate from that closed bundle, and finally call `compostCycle`. The shared composer used here and by the independently reachable `/hub/certify/create` route re-reads the cycle and rejects anything other than exact on-chain Reconciled before metadata or allowlist work. Minting while the cycle is still Open is therefore impossible even outside W26; no new contract surface is introduced.

The fulfilled-commitment bundle option accepts only fulfilled commitments from the selected
non-zero cycle. Cycle-less commitments keep their immutable 20/80 contributor recognition and
payment-default preview, but have no six-role `CycleOpened` allocation snapshot. They remain
visible in history and are disabled in certificate selection with “No cycle allocation · not
certificate eligible”; the composer rejects them before allowlist or metadata construction.

### 6.11 Operations workspace NET-NEW (decision 2026-07-18)

A NEW deployer-gated admin workspace tab — gating pattern copied exactly from Actions: a conditional nav slot (`showOperations: isDeployer` beside `showActions` in `useEffectiveToolbarPermissions`) plus a `RequireRole ["deployer"]` route branch. Stage rail: **Queue · CCIP · Flows** (W24 draws it).

- **Queue**: every queued/failed disbursement and funding hop across all gardens, with batch composition and the W22 command/ack console. Source controls are dispatch, same-key command retry, authenticated-failure requeue, and queued-only cancel; the protocol executor is an automated Celo contract, not a human role or report control.
- **CCIP**: command/destination/acknowledgment message IDs and Explorer links, immutable-router plus active/previous-peer health, native ETH/CELO reserves, acknowledgment deferrals, derived delivery delay, same-key retry, stored-outcome acknowledgment retry, and manual-execution guidance only when CCIP Explorer marks the command eligible. No row or control manually marks delay, execution, receipt, or confirmation.
- **Flows**: the cross-chain funds board — GoodDollar pool → GG protocol Safe (a **Celo balance read**, since HoA→protocol is an upstream fact the module never records, corrections-log §9) → garden Safes → members, each downstream figure distinguishing queued, dispatched, Celo-executed/ack-pending, confirmed, failed, and delayed. The cross-garden pool oversight rows (formerly §6.8's Gardens tab) live here: alphabetical, `promiseKeptRate` + `openCommitmentCount`, never ranked.

---

## 7. Surface 3: Editorial website (full depth, register #21)

### 7.1 `/gardens/:id` GardenDialog: pool story section NET-NEW

The dialog today: hero banner, header, four-cell stats strip (`dl` grid, Entries / Hands at work / Assessments / Certificates, `packages/client/src/views/Public/GardenDialog.tsx:249-278`), `FieldNotesSection` (line 280), Impact Certificates section (282-332), operators section (336-360). The pool story inserts **after `FieldNotesSection` and before the Impact Certificates section**: field notes stay the first-scroll content (editorial identity untouched) and the promises narrative flows into certificates ("fulfilled promises become Impact Certificates"), reusing the local `SectionHeading` grammar (`GardenDialog.tsx:404`).

Section content:
1. **Pool state copy**: one sentence per §4.1 column. Pre-launch (NotReady/Ready) renders readiness copy only, no numbers ("This garden is preparing its first season of promises").
2. **Active cycle progress**: cycle name + type, stage phrase, "runs through {date}", scoped state counts, and separate exact-label unit-summary rows. Never combine labels into one progress band or percentage. No timers.
3. **Promises kept aggregate**: offered and fulfilled counts, with `promiseKeptRate` as the sole cross-commitment percentage **only above the small-community threshold** (§7.2); otherwise use a counts-only sentence ("9 promises made, 7 kept so far"). Active-cycle progress uses state counts and exact-label unit groups, never a synthetic percentage. Rendered with the existing `StatCell` grammar (`GardenDialog.tsx:250-277`) inside the section, not by widening the four-cell strip.
4. **Hypercert reports tie-in**: when fulfilled-commitment bundles exist, one line linking down to the certificates section ("Fulfilled promises from this cycle are anchored in the certificates below").

The four-cell stats strip itself does not change in MVP. `/gardens` grid cards (`packages/client/src/views/Public/Gardens.tsx`) are untouched.

### 7.2 Small-community sensitivity (answers the digest's open question)

Recommendation, locked for this spec: `promiseKeptRate` renders publicly only when the cycle has **at least 5 due commitments and at least 3 distinct promisers**. It is the sole cross-commitment percentage. Below threshold, show absolute counts in sentence form and never a percentage; a single lapsed promise in a three-person pool must not read as a 33 percent failure on a public page. Cancelled and Disputed never appear individually anywhere public (§4.3). The same threshold applies to the WalletDrawer Commitments summary (§5.8); inside the garden (pool tab), members see their own full counts and exact-label unit groups.

This is a product-display floor, not the pilot's research publication threshold or evidence that
pooling strengthened settlement capacity. `pilot-evidence-spec.md` owns the stronger privacy,
linkability, consent, baseline, safeguard, and outcome-claim gates. When its publication rule is
stricter, the stricter rule controls.

### 7.3 `/impact`: protocol-wide pool aggregates NET-NEW

Add one editorial band to `packages/client/src/views/Public/Impact.tsx` using its section grammar (EditorialKicker + EditorialHeading + reveal wrapper, verified at lines 290-296 and 367-380), **placed between §01 proof markers and §02 "The cycle"** (decision 2026-07-18): kicker "Promises", heading on aggregate mutual-aid framing (Document B relay vocabulary: promises offered, promises kept, gardens with live pools). Content: stat tiles in the §01 proof-marker grammar (gardens with open pools, commitments fulfilled this season, CCIP-confirmed G$ support; protocol-wide promiseKeptRate subject to §7.2 thresholds), one line explaining the commitment lifecycle in relay terms, and a link to `/gardens`. **Pipeline delta**: §02's `PublicEvidencePipeline` gains the promise stages — Assessment → Promise → Work → Confirmation → Impact Certificate — so the cycle section tells the story the band introduces. No per-garden table on this page (that is the Operations overview's job, and public per-garden comparison drifts toward ranking).

### 7.4 Boundaries

Read-only, aggregate-only. No leaderboards, no ranked lists, no participant-level data, no wallet addresses tied to promise outcomes, no dispute or cancellation stories. All pool stats flow from module events via the indexer (EAS is not indexed; corrections-log §2 boundary), so the public surfaces need no easscan reads.

---

## 8. Surface 4: Community interface (September)

The 2026-07-04 Home/Signals/problem/upvote sketch is removed from the build contract. The canonical community interface is the **Needs / Create / Profile** PWA defined in `.plans/active/community-interface/`:

`packages/community` remains an independent PWA at `community.greengoods.app` and local port 3010. Before scaffolding it, the shared-foundation lane extracts generic runtime, auth/passkey, offline status, install/update, error, and shell primitives for both client and Community. The apps do not share routes, navigation items, manifests, service-worker scopes, telemetry identities, or application copy.

- `spec.md` — contract, read-model, onboarding, IA, funding, and accessibility rules
- `wireframes.md` — problem-first Need creation, commitment Request / Offer direction, and admin/funder frames
- `diagrams.md` — context, ERD, sequences, and the join-request decision boundary
- `journeys.md` — personas, journeys, and service blueprint
- `research-plan.md` — operator research, consent, cohort readiness, and Linear-aligned schedule

The commitment-pooling UX owns the shared commitment detail, evidence, confirmation, testimony, and settlement primitives. The community surface consumes them through `needUID`; it does not add claiming, work submission, a wallet drawer, solution-proposal objects, or ActionSignalPool wiring in v1. Join-request persistence is explicitly unresolved and gates only the membership-queue slice, not the rest of the PWA.

---

## 9. Missing primitives (flag, do not invent)

| Primitive | Needed by | Closest existing thing and the gap |
|---|---|---|
| Shared linear progress meter (client-legal) | §4.3/§5.3 per-commitment unit progress, §5.6 N-of-group meter | `AdminLinearProgress` exists but is admin-only M3 (`packages/admin/src/components/AdminLinearProgress.tsx`); client has `FormProgress` (step dots, `packages/client/src/views/Garden/index.tsx:41`) which is not a quantity meter. Propose shared `ProgressMeter` in `packages/shared/src/components/`; never use it to combine pool/cycle unit labels |
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
| `cockpit.garden.pool.*` | Admin Garden Pool tab, seeding, capture, claims queue |
| `cockpit.community.pools.*` | Community workspace Pools mode |
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
- Community-interface events are owned by `.plans/active/community-interface/spec.md` §12 (`need_created`, `need_signal_created`, `need_status_set`, `seeded_from_need`, and related events); this spec does not define a second signal vocabulary.
- Offline queue health rides the existing job analytics (`packages/shared/src/modules/job-queue/job-analytics.ts`): the five offline queue kinds inherit job_added/completed/failed tracking automatically. Online wallet `transfer` uses transaction lifecycle analytics, not job replay analytics.

Privacy boundary: no counterparty addresses, commitment titles, or reason texts in event properties; counts, enums, and booleans only (matches the Linear/PostHog privacy rule in CLAUDE.md).

## 12. Accessibility notes

- **Global acceptance for every surface**: pool, cycle, commitment, claim-request, confirmation, dispute, settlement, creation, and admin flows use semantic landmarks/headings, native controls where possible, persistent visible labels and accessible names, logical reading/focus order, visible focus, and WCAG AA contrast. All interactive targets are at least 44px, not only claim/confirm. Loading preserves layout; empty states name the scope; failed submissions focus a concise error summary and retain entered data; dialogs restore focus to the trigger or its replacement. Screen-reader output names direction, cycle type/scope, claim-request state, settlement evidence state, and available recovery without relying on surrounding visuals. These rules apply in en/es/pt and to public browser, installed PWA, and admin variants.
- **Confirmation flow focus order**: opening the confirm sheet moves focus to the sheet title; tab order is summary, progress meter (focusable, labeled "2 of 3 confirmations recorded"), Not yet, confirm. Choosing Not yet reveals and focuses the required dispute-reason field before submission. On close, focus returns to the invoking CTA or its replacement state chip. `DialogShell` and `AdminDialog` own the focus trap; do not hand-roll.
- **Offline status announcements**: enqueue and sync-complete events get an `aria-live="polite"` announcement region colocated with `SyncStatusBar` (`packages/shared/src/components/SyncStatusBar.tsx`): "Saved on this device, will sync when connected" on job_added while offline; "N promises synced" on completion. Retryable failures remain polite. Assertive announcements are reserved for an unrecoverable result or an outcome that makes the next action unsafe, and fire once rather than per retry.
- **State never by color alone**: all state chips use `StatusBadge` (icon + color, `.claude/rules/frontend-design.md` Rule 12); the state timeline pairs icons with text labels.
- **Progress meters** always carry text equivalents (for one commitment, units approved of target; confirmations recorded of required). Pool/cycle summaries use state counts and separate exact-label rows rather than a mixed-unit meter.
- **Hero moments** respect `prefers-reduced-motion` (static celebratory frame) and never trap focus; dismissible by any input.
- **Admin rail and tabs** inherit roving tabindex from `AdminTabRail` (quick-reference Tabs table); the new Confirm stage and Pool tab add no custom key handling.
- **Touch targets**: claim/confirm CTAs and every other interactive control meet the 44px minimum on touch surfaces; queued/failed badges are not the tap target, the card or adjacent named action is.

## 13. Open UX questions from the brief, answered

1. **Readiness-only vs live/onchain explicitness**: state it in banner copy at the glance layer ("warming up" vs live cycle language, §4.1/§5.2); reserve chain-explicit phrasing ("recorded on Arbitrum") for the engage layer (commitment detail timeline footer). Do not put chain vocabulary on browse cards.
2. **Non-custodial phrasing for operator-assisted capture**: fixed pattern "Recorded by {operator} on your behalf. The promise stays yours." on both the admin capture flow header (§6.5) and the member's commitment detail chip (§5.3). The member is always the named source on the record; the recorder is metadata.
3. **Public stats for small communities**: threshold rule in §7.2 (rates only at >= 5 due commitments and >= 3 distinct promisers; counts-only sentences below). Applies to editorial and the WalletDrawer Commitments summary; in-garden members always see full numbers. There is no Home card.
4. **Which commitment types may live outside a domain action**: SupportService, SeasonCampaign, and StewardCaptured may have no Work requirements. DomainImpact carries repeatable action/count requirements; each action is registry-validated and its domain is derived, so no second positional domain array can drift. UID `0` is valid. The eventual `MAX_REQUIREMENTS` is a benchmarked implementation bound, never a four-action product rule.
5. **Where settlement controls sit**: G$ settlement uses `SettlementModule` + bounded Celo executor events, not the reserved pool `settlementEnabled` flag. Admin Garden Pool gains the settlement status section; PWA commitment detail gains settlement-status rows only after the canonical contract/indexer interfaces are GREEN; `/community/pools` shows the Protocol pool plus the current garden only. Cross-garden command/ack health and funding controls live in the deployer-gated Operations workspace. Later transferable-voucher controls sit behind `settlementEnabled` when PRD-651 unblocks. There is no top-level `/pools` route (§2).

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

---

## Appendix B: post-lock addenda (dated)

Amendments to locked sections live here, never inline. Sibling documents and the
hi-fi prototype cite this file by **line number** (`UX:NNN`), so inserting text
mid-document silently shifts every citation below it — an in-place §6.3 addendum
moved 76 of them by two lines. Append here instead; nothing cites past `UX:439`.

**§5.1 AppBar on commitment detail — hidden (2026-07-25).** The commitment
detail (`/home/:id/pool/:commitmentId`), the evidence sheet, the confirmation
sheet, the protocol-claim card, and the work flow follow the shipping
work-detail precedent (`AppBar.tsx:17-33`) and hide the bottom AppBar; the back
header is their chrome. §5.1's "keep visible on the pool tab and detail" now
binds the pool tab only — W1 still draws it. W2/W2a/W4/W25/WFLOW draw it hidden.

**§5.2 scope control form (2026-07-25).** §5.2 item 2's scope control renders as
a labelled select docked in the browse section's header, not a second chip row
above the filter chips: two adjacent segmented rows put nine pills between the
cycle cards and the first promise. The filter chip set (All / Offers / Requests
/ Matched / Mine) is unchanged and remains the only chip row. W1 draws it.

**§5.3 work linkage placement (2026-07-25).** Submit-work and link-work move
from the commitment-detail action band into the "Work for this promise"
disclosure — §5.3 lists work linkage as its own concern, and three primaries in
one band left no act reading as the next one. Adding evidence stays the band's
single primary. W2 draws it.

**§5.6/§5.8 progressive disclosure (2026-07-25).** The confirmation sheet
condenses already-confirmed members into one summary row below the meter, with
the reader's own row kept distinct; the WalletDrawer's "My commitments" group
sits behind a count-carrying disclosure while the pending-confirmations inbox
stays open. W4/W5 draw it.

**§6.3 step count — five, not four (2026-07-24).** The seeding console draws
**five** steps: §6.3's step 3 splits into *Who confirms* (confirmers, threshold,
claim mode) and *Reward* (declared rail and amount). One step was carrying four
decisions. Five is the locked presentation — `W8` draws it and `sb6`/`sb9a`/`sb10`
walk it.

## Appendix C: group commitments, recognition, and payout plans (2026-07-28)

This appendix supersedes every singular-provider, max-four requirement, and single-beneficiary
placement in §§5–6 while preserving their route and component anchors.

### C.1 One lead, many contributors

- Every commitment shows three separate rows when relevant: **Accountable lead**,
  **Contributors**, and **Confirmation**. Never collapse these into “provider.”
- Solo is presented as “You are leading this promise” with one contributor. Team mode adds an
  explicit roster without making the lead less accountable.
- Contributor policy is chosen during creation/seeding: **Open team** (eligible garden members
  may join) or **Lead-managed team** (lead/steward approval). The summary explains who may join.
- W2 shows team membership, each contributor's linked Work/evidence credit, optional requirement
  assignments, and whether the roster is still editable. W2b is the focused team sheet for
  join/invite/add/remove/leave/assign actions. These are online-only shared mutations with
  wallet-pending, success, inline-error, and explicit-retry states; they never enter the offline
  field queue. Open rosters use self-join/self-leave and never expose managed expulsion.
  `addContributor` and `removeContributor` are Lead-managed-only; removal is available only for an
  active non-lead contributor with zero pending linked Work and zero Work/evidence credit. Lead or
  credited removal is blocked with attribution-preserving copy.
  Add/join surface the measured roster-cap error before wallet submission.
- Assignment is visually labeled “planned responsibility,” not “credit.” Recognition credit comes
  only from approved Work or evidence attribution on the Fulfilled commitment.
- When the commitment becomes ReadyForConfirmation, the roster visibly locks. W4 lists all
  contributors as ineligible confirmers and explains why. A contributor-steward never receives
  the fallback action.

### C.2 Repeatable requirements

- W3 and W8 render a repeatable requirement builder: Action + required count per row. Four rows
  are visible initially for a comfortable first view; **Add requirement** continues beyond four.
- Domains appear as derived tags on the selected actions. Multiple requirements may share a
  domain. No copy says “one action per domain” or “up to four actions.”
- A quiet implementation note may say the first contract release has a measured technical limit;
  the product never presents the provisional value as a conceptual limit.
- Each progress row in W2/W10/WFLOW names the action, approved/required count, assigned
  contributors, and credited contributors. Repeated-domain rows remain separate.

### C.3 Recognition fixed at cycle open

- W11 adds **How gardener recognition is shared** beneath the six class percentages. The protocol
  preset is “20% shared equally among eligible contributors · 80% based on verified
  contributions.” The policy is editable only before cycle open and snapshots with the cycle.
- The explanatory copy says fulfilled commitments receive equal gardeners-class budgets by
  default because hours, tasks, meals, and other units are not comparable across promises.
- W26 reviews the computed contributor split read-only. Recognition has no close-time slider or
  metadata-only correction: source attribution must be valid before the commitment reaches Ready.
  Stable bps remain on the commitment contributor, while integer units are read from the selected
  Hypercert's certificate-scoped allocation rows. Reusing a fulfilled commitment in a later
  certificate never overwrites the earlier certificate's allocation.
- Every Ready path and direct Fulfilled dispute resolution requires at least one verified
  contributor and an available recognition policy, so new protocol state cannot produce a
  zero-eligible Fulfilled commitment. W26 still blocks certificate expansion if legacy or
  inconsistent indexed data presents that impossible state, says explicitly that there is no
  automatic lead fallback, and routes the steward back to governed data correction rather than
  claiming mint metadata changed on-chain credit.

### C.4 Payment begins from recognition, then remains distinct

- W10 adds a **Recognition and payment** section after fulfillment. Plan creation uses the
  CommitmentPooling validator to recompute the complete sorted recognition vector and hash from
  frozen on-chain credits and policy. The comparison table has
  Contributor, Recognition, Payment, Amount, and Status columns.
- A steward may atomically replace the complete amount vector while the plan is Draft. Payment
  weights derive from those amounts with deterministic rounding; no control accepts an
  independently authored payment weight. The canonical full-reward base-unit allocation is
  labeled “Matches recognition (token rounding)” and requires no reason; every noncanonical amount
  or retention divergence requires a reason shown to the contributor. The screen always says
  recognition is not being rewritten.
- `gardenRetainedAmount` is an explicit field and summary row. The invariant is displayed in plain
  language: “Declared support = kept in the garden + sent to contributors.” Retention never
  renders as a payment to the garden itself.
- W21 shows funding readiness separately from payout-plan readiness. ProtocolToGarden top-up is a
  treasury flow; it does not choose contributors or silently mark their payouts complete.
- W21 separates **Save draft** from **Finalize payout plan**. Finalization verifies recognition
  and payment hashes, canonical recipients, and exact conservation, then makes every row
  immutable before dispatch. Initial setup is also two recoverable wallet steps:
  `createCommitmentPayoutPlan` first persists the stable parent and canonical default, then
  `setContributorPayouts` saves a custom complete vector. If the second write is rejected or
  fails, the indexed Draft resumes directly in the editor and retries only that second write;
  the client never calls creation again for an existing parent. Until finalization, **Edit draft** reopens the complete ordered vector,
  retained amount, and reason and resubmits them atomically through `setContributorPayouts`;
  editing never replaces the stable parent pointer. The finalized screen exposes preparation for
  every non-zero unprepared row and retains those controls after earlier rows are prepared. If
  every amount is zero and the garden retains the full declaration, the plan becomes Complete
  immediately and no CCIP message or self-transfer exists.
- W22 groups child disbursements by payout plan, supports measured multi-batch teams, and preserves
  per-contributor retry/cancel outcomes. The parent status is derived and has no retry button of
  its own. Child and batch cancellation never clear or replace the stable parent plan pointer.
- W23 shows each contributor only their receipt plus the transparent plan summary: their
  recognition weight, payment weight, amount, garden-retained amount, and partial/complete state.

### C.5 Cross-surface cascade and accessibility

- Before freezing a roster, correcting recognition, editing payment, or starting dispatch, the
  confirmation names how many contributors are affected and what becomes immutable.
- Roster rows and payout rows are semantic lists/tables with unique accessible action names
  (“Remove Maria from this promise,” “Retry Kwame's payout”). Status uses text/icon/shape, never
  color alone. Dynamic save/queue outcomes use the existing polite announcer.
- The client keeps evidence, work-link, readiness, and confirmation actions offline-queueable
  only where their underlying commitment action is queueable. Roster mutations—join, invite/add,
  remove, leave, and assignment—always remain online-only shared writes outside the field queue.
  Settlement dispatch/edit remains an online steward operation.
- Public/editorial copy may show the lead and contributor count, but individual recognition or
  payment details follow the existing privacy threshold and consent rules.
