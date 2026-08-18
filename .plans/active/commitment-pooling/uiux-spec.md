# Commitment Pooling: UI/UX Spec (Four Surfaces)

**Feature Slug**: `commitment-pooling`
**Stage**: `active`
**Created**: 2026-07-03
**Scope**: PR-openable UI/UX specification for the August release (client PWA, admin, editorial website) plus the September community interface at wireframe depth. Builds on `reports/corrections-log.md` (verified IA facts), `standing-commitments-spec.md` (Offer once/over-time, internal-series, and instance architecture), and the locked decisions from the 2026-07-03 alignment session and later amendments. Contract-facing names (events, fields, module functions) defer to `contract-spec.md` in this folder; where this spec names a module concept it is a reference, not a definition.
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
| Operator / Owner | Everything gardeners do, plus: seed campaign commitments, analog capture on behalf of gardeners, cycle management, claims review (approval-gated mode), dispute/override with reason, `ArbitrumExternal` payout recording, `CeloSettlement` queueing when separately gated, steward fallback confirmation with reason when the operator is not a contributor |
| Evaluator | Delta/re-assessment + technical assessment authorship (assessment v3, register #7); reviews flow through existing WorkApproval rails |
| Funder | Seed/match garden campaign considerations (consideration-source reference only, custody stays with pool owner); read pool story |
| Community | View pool story, provide priority signal, confirm when named, community testimony attestation (Community Hat) when a commitment is aimed at the community |
| Protocol team | Current steward/owner Hat wearers of the registered root-garden protocol pool (tokenId 0, register #8); while the ordinary named/default path is unreachable after contributor exclusion, they may confirm an explicitly opted-in commitment in any pool through the reasoned protocol fallback. `deployer`/module-owner status alone is never confirmation authority |

Contributor self-confirmation is blocked everywhere, including both fallback paths. With no explicit confirmer group, an Offer defaults to its recipient and a Request defaults to its creator/requester. A named group is evaluated after excluding every contributor. If the ordinary rule would be unreachable, creation/acceptance fails unless the person explicitly selected **Green Goods team fallback** before acceptance and the registered protocol pool exists. The selection never adds protocol stewards to the named threshold; it supplies a separate structural path. Confirmation is the review for SupportService/StewardCaptured; DomainImpact keeps the full Work then WorkApproval path (register #20).

## 2. The one-pool UX invariant

One pool UX across capability levels (UX Brief, locked). The base surface every gardener sees: name **Things I can offer**, choose **Offer once** or **Offer over time**, create finite available Offer instances for the ongoing path, offer or request one-shot support, **offer something in exchange**, submit evidence, confirm promise kept, see open and fulfilled commitments, and see readiness plus season/campaign progress. The template picker remains a fast path into editable Offer metadata; it never substitutes for the one-time/ongoing choice or the internal pool-scoped `CommitmentSeries`. A plain blank path always remains. August G$ settlement status and operator queue surfaces are additive through `SettlementModule` and `settlementAccounts[garden].active`; app lanes must not flip the pooling module's reserved `settlementEnabled` flag. Transferable-voucher controls are progressively disclosed later behind `settlementEnabled`; they are never a separate product, tab, or app. Every screen in this spec is designed so a settlement row can be added without moving anything.

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
| Paused | Banner “This pool is paused” with indexed reason; browse, evidence/linkage, roster-safe wind-down, cancellation/expiry, and dispute recovery remain available. Register #103 makes the hidden create/claim/decline/accept/exchange/Ready-submit/override/confirm controls match on-chain enforcement rather than a product-only quiet period | Pause reason + resume action; the same participation/progress controls are disabled with an explanation, while safe-wind-down controls remain | Neutral quiet-period line, aggregates stay | View-only plus evidence, recovery, and allowed wind-down |
| Closed | View-only history | Compost action available | Aggregate story remains | View-only |
| Composted | History + "ready for the next season" line | Reopen or new-cycle actions | Past-cycles aggregate | History |

### 4.2 Cycle states (types: season, campaign)

Cycle cardinality is part of the UI contract: a pool may have **at most one open Season and zero or more open Campaigns at the same time**. The Season is the primary long-running context; Campaigns are separate, concurrently active contexts and never replace, overwrite, or masquerade as the Season. Every selector and aggregate names its scope (`All current work`, the Season name, or one Campaign name). Opening another Season is blocked with a link to the existing open Season; opening another Campaign is allowed without enumerating every cycle on-chain.

| State | Client PWA | Admin | Editorial | Community |
|---|---|---|---|---|
| Draft | Not surfaced | Cycle card, Draft chip, edit + seed actions | Not surfaced | Not surfaced |
| Seeded | Pool banner "opens soon"; seeded commitments browsable read-only | Seeded list + open-cycle flow (includes allocation policy, §6.10) | Readiness copy ("promises are being prepared") | Read-only preview |
| Open | Browse + claim + create enabled | Full cycle console | Active cycle stage, counts, and exact-label summaries | View + signal |
| InProgress | Same chrome as Open, with scoped state counts emphasized (gardeners see one continuous "live" period; only the stage label differs) | Distinct stage on cycle stepper | Cycle stage and counts | View |
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
| ReadyForConfirmation | Confirm CTA for eligible stored-rule confirmers; default Offer recipient or Request creator when no group is stored; pending-confirmations inbox item (§5.8) | Hub Confirm stage (§6.9) distinguishes ordinary, local fallback, and opted-in protocol fallback rows | Not distinct | Confirm CTA when eligible |
| Fulfilled | Fulfilled hero moment (§5.10), chip, declared-consideration row; timeline names ordinary confirmer, “garden steward — fallback,” or “Green Goods team — fallback” only from indexed path provenance | Consideration row + "record payout" action; exact confirmer/path/reason shown | Fulfilled counts + promiseKeptRate | Testimony CTA when aimed at community |
| Reconciled | Terminal timeline entry, rolled into cycle summary | Cycle reports | Aggregates | View |
| Cancelled | Quiet chip + reason on detail, excluded from browse | List with reason | Aggregate counters only, never a public list | Not listed |
| Expired | Chip + "offer again" CTA for owner (per-cycle renewal, deep-dive L1) | Expiry queue + re-seed | Aggregate only | Not listed |
| Disputed | Detail banner "under review by stewards", CTAs frozen | Dispute resolution actions with mandatory reason, resolution visible in detail | Never surfaced individually; aggregates unchanged until resolved | Frozen view |

### 4.4 Approval-gated claim-request states

Claim requests are records with their own lifecycle; they are not a pending boolean on the commitment. The contract stores canonical `claimant`, authenticated `requestedBy`, `kind`, `gardenContext`, `requestedAt`, and `active`; the indexed view exposes those fields plus `state`, `reasonCID`, and `resolutionCode`, with active derived only as `state == PENDING`. Individual claims use caller for both identities. Garden claims use the GardenAccount as `claimant` and its authenticated operator/owner as `requestedBy`. The UI labels `gardenContext` as “provider garden context” and `requestedBy` as “requested by”; accepted commitments separately expose `providerGarden`.

A claim chooses the **one accountable lead provider**, whether that lead is a person or a garden-as-provider. Contributors never claim. They join the accepted commitment through its `Open` or `LeadManaged` roster policy. When two requests exist, they represent two would-be leads, such as two gardens with their own teams. The steward accepts one and explicitly Declines the other with a stored reason, or the indexer marks it Superseded after the commitment is taken. **Choosing the lead is the claim flow; forming the team is the roster flow.**

| Request state | Claimant treatment | Operator treatment | Recovery / exit |
|---|---|---|---|
| Pending | “Waiting for steward” row with request time and provider context; the commitment remains browseable to other eligible claimants | Active queue row shows the exact stored terms; Accept and Decline act on this row only | The frozen interface has no claimant-cancel action: wait for Accept/Decline, another acceptance, or commitment cancellation/expiry |
| Accepted | Request row becomes “Accepted”; commitment detail names the accepted counterparty/provider garden | Accepted row moves to history; acceptance consumes the stored terms | Continue to work/evidence; caller-supplied replacement terms are never accepted |
| Declined | Rationale is visible to that claimant; commitment remains browseable and “Ask again” creates a fresh request if it is still open | Only the selected row becomes Declined; every other pending request remains Pending | Edit provider context where allowed and submit a fresh request; never retry the declined request record |
| Superseded | “Taken up by another provider” or “No longer available,” according to the indexed resolution code; no false failure or retry action | Acceptance, pre-acceptance cancellation, or pre-acceptance expiry marks every still-pending indexed request Superseded | Exit to browse; a new request is possible only if the commitment later becomes claimable again |

Network/queue failure before `ClaimRequested` exists is not Declined: the optimistic row reverts and offers the ordinary offline Retry/Discard path. Declined comes from the indexed on-chain `ClaimDeclined` event; Superseded is written by the indexer during its bounded sweep — no per-row chain event exists — and both survive refresh.

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
3. **Browse: open offers and requests** *(chip set + card anatomy superseded 2026-08-14 — see the §5.2 third-pass and second-pass addenda: the row is All / Offers / Requests + a Mine toggle, cards follow the chips-lead ①–⑧ anatomy with direction edges and the equal-weight domain row, and the whole card opens the detail)*: filter chips All / Offers / Requests / Matched / Mine (client-local chips; admin `AdminFilterChip` is admin-only). Cards show: type chip (DomainImpact with `DomainBadge`; SupportService plain), title, unit label + target quantity, due date, state chip (`StatusBadge`), claim CTA.
   - Claim CTA per claim mode (register #19): OPEN mode renders "Take this up" and enqueues immediately (optimistic Accepted). APPROVAL_GATED renders "Ask to take this up" and enqueues a claim request (optimistic "requested, waiting for steward"), then renders the exact request lifecycle in §4.4. *(Mode-helper clause superseded 2026-08-14: the claim mode reads from the act's own label — the separate helper line left browse cards; garden-work asks additionally gained a gardener-set mode in the Advanced detour.)* Mode is visible on the card as helper text, not a mode toggle; gardeners never choose the mode.
   - Protocol-pool commitments surfaced in a garden context open the locked `W25@context-chooser` pre-claim sheet for eligible operators only (register #51): take this up as myself vs take this up for this garden. The claim stores `ClaimType` plus `gardenContext`; acceptance derives and stores `providerGarden`. This does not transfer token, commitment, or consideration custody and is not a gardener-delivery fallback. The choice is instrumented (§11).
4. ~~My commitments strip~~ — **removed 2026-07-18** (client-minimalism audit): the WalletDrawer Commitments tab (§5.8) is the single cross-garden "mine" surface; the `Mine` filter chip in the browse section covers in-garden self-filtering. No horizontal strip renders on this tab.

Empty pool (Open but zero commitments): planted-seed illustration slot + two primary CTAs "Offer support" / "Request help" and operator-seeded hint text. *(Persistent-entry clause superseded 2026-08-14, first-pass addendum (d): in non-empty states creation lives in the floating create entry above the AppBar; only the empty pool keeps the inline CTAs.)*

### 5.3 Commitment detail NET-NEW (`/home/:id/pool/:commitmentId`)

- Header: title, type chip, state chip, unit label + quantity, due date, claim-mode helper line.
- **State timeline**: vertical history of state transitions with actor and timestamp (module events via indexer). Uses the NET-NEW shared `StateTimeline` primitive (§9). Overrides and dispute resolutions render here with their reason text (lifecycle rule: overrides visible in gardener detail).
- **Evidence list**: rows of lightweight evidence (photo/link/note, IPFS CID) with attach button while Active/EvidenceSubmitted/PartiallyApproved. `ListPrimitives` rows + `FileUploadField` in the attach sheet (`DialogShell`).
- **Work linkage** (DomainImpact): linked work submissions with their `WorkDisplayStatus` chips (type `packages/shared/src/types/domain.ts:350-358`); "Submit work for this promise" CTA deep-links into the AppBar Garden tab flow with commitment context (§5.7); "Link existing work" opens a picker of the gardener's approved/pending works (enqueues `workLink`, §5.11).
- **Ready submission**: SupportService, StewardCaptured, and evidence-only SeasonCampaign details show “Send for confirmation” after at least one evidence item and any declared assessment are attached. It enqueues the `confirmation` job with `action: "submit"`. DomainImpact never shows this control; work approvals drive its Ready transition.
- **Confirm CTA**: visible only when state is ReadyForConfirmation and the signed-in user is eligible under the stored rule: a named-group member, the Offer recipient default, the Request creator default, a current local-garden steward/owner, or a current protocol-garden steward/owner when `protocolFallbackEnabled` is indexed true. The accountable lead and every contributor are always excluded, even when an address also holds a relevant Hat or is in the named group. Local authority wins for dual-role callers. The CTA and dialog name the exact path before signing; module-owner/deployer status never creates a confirmation CTA. Opens the confirmation flow (§5.6).
- **Confirmation provenance**: after fulfillment, the timeline reads the indexed `fulfilledBy`, `confirmationPath`, and `fallbackReason`. `ORDINARY` names the confirmer without fallback language; `POOL_FALLBACK` says “confirmed by garden steward — fallback”; `PROTOCOL_FALLBACK` says “confirmed by Green Goods team — fallback.” A dispute resolution to Fulfilled is shown as steward resolution, never fabricated as a confirmation.
- **Declared consideration row**: always names the stored consideration rail. `ArbitrumExternal` shows source (jar or treasury reference), token, amount, and after Fulfilled a "consideration released" or "consideration pending" line fed by the module's `ConsiderationPaid` record. `CeloSettlement` collapses transport detail to “on its way” until the authenticated success acknowledgment permits “arrived”; an authenticated failure switches the row to “being rearranged” until stewards reconcile or cancel it; when action is needed, the same row adds a calm explanation without exposing the operational state noun. `None` renders no consideration row. No custody or transfer controls live on the gardener surface.
- **Withdraw / steward cancel**: while Offered/Requested the creator sees "Withdraw this offer/request…" with a required reason — the creator path of `cancelCommitment` (register #34b; `prototypes.md` MF-2a). The Accepted steward path is locked at `W10@cancel` with its own required-reason confirmation (register #51/MF-2b). Both are online contract actions, not queue kinds.
- Analog-captured commitments carry a "recorded by your steward on your behalf" chip; the gardener remains the named promise source (§13 question 2).

### 5.4 Offer/request creation flow NET-NEW (`/home/:id/pool/new`)

Full-screen flow reusing the work-flow chrome pattern (`TopNav` + `FormProgress`, verified in `packages/client/src/views/Garden/index.tsx:41-44`). Appendix E.2 adds an offer-template picker before this form; choosing **Start blank** enters the same flow with no hidden defaults. Direction (offer vs request) comes from the entry CTA or selected template and stays editable in step 1. Steps:

1. **What and cycle scope** *(amended 2026-08-10, register #94)*: direction (from the entry CTA, editable), commitment type (DomainImpact or SupportService for gardener creation; SeasonCampaign and StewardCaptured are console-seeded only), title, note, and one binding: an Open Season, one Open Campaign, or cycle-less where allowed. When exactly one legal target is open the form binds it and shows it as an editable field with helper copy — binding the unique legal target is not guessing; the chooser appears only when more than one target is legal. Seeded cycles are operator-only. Entry from a scoped pool filter prefills that cycle but keeps it visible and editable. Claim type stays Individual for gardener creation and claim mode keeps the context default — neither renders as a gardener-facing control. The immutable contributor policy (`Open` or `LeadManaged`, `Open` default) moved to the Advanced detour (step 4).
2. **How much and proof**: unit label, target quantity, `requiresAssessment`, due date or cycle deadline default. DomainImpact requires a positive approved-work count per bound action (set beside each action in step 3); SupportService may explicitly carry no work requirement and then requires evidence before Ready.
3. **Requirements** (DomainImpact only): add repeatable `{ actionUID, requiredCount }` rows reading "This promise needs: [Action] × [count]." The flow validates at least one row, registry existence, and a non-zero count; action UID `0` is valid and actions may share a domain. Domains are derived from ActionRegistry. The UI never presents four as a product maximum; the eventual `MAX_REQUIREMENTS` follows the 8/16/24/32 gas/indexer benchmark. It uses the action-selection card grammar the work flow intro already renders (`views/Garden/index.tsx:54-96`). SupportService skips Work requirements and uses lightweight evidence + confirmation (register #20).
4. **Review and promise** *(amended 2026-08-10, register #94 — the separate Who-confirms step is retired from the default path)*: summary repeats the title, amount, due rule, cycle binding, every ordered requirement/count row, the direction-aware confirmer default, the pilot-default Green Goods fallback line, and the team policy, then "Make this offer" / "Ask for this help". Submission enqueues the `commitment` job kind (§5.11) and returns to the pool tab with the optimistic card visible.
5. **Advanced detour** *(register #94; reached from review, never a numbered wizard step)*: the named confirmer group picker, the labeled native checkbox **“Let the Green Goods team confirm if nobody local is eligible”** writing `protocolFallbackEnabled` — **on by default for the pilot** (supersedes the 2026-08-02 off-by-default closure's default while keeping its guard: usable only while the ordinary path is unreachable after contributor exclusion, reason always required, never a contributor), switchable off per promise, and disabled with the named prerequisite when the registered protocol pool is unavailable — plus the immutable contributor policy (`Open` default) and `requiresAssessment` (off default). If the ordinary rule is unreachable and the fallback has been switched off, the review blocks until the rule is repaired or the fallback is re-selected.

Drafts persist locally per the existing draft pattern (mirror `WorkDraftRecord` semantics, `packages/shared/src/types/job-queue.ts:194-209`); resume prompt on re-entry (client `DraftDialog` precedent, `views/Garden/index.tsx:42`).

### 5.5 Evidence capture NET-NEW

From commitment detail: attach photo (camera or roll, `FileUploadField` with compression per the work flow's `imageCompressor` precedent in `packages/admin/src/views/Garden/SubmitWork.tsx:12`), a link, or a text note. The form also requires **Credit contributors**, a labelled bounded multi-select containing only active roster contributors; the signed-in active contributor may be preselected visibly, but no invisible attribution fallback exists. All become one evidence object uploaded to IPFS at sync time (CID recorded via module event). One evidence object per enqueue; repeatable. A contributor's first evidence attribution supplies one participation credit for recognition; later distinct evidence stays visible as provenance but cannot multiply their share. Works fully offline: files serialize into IndexedDB (`SerializedFileData` pattern, `packages/shared/src/types/job-queue.ts:114-129`) and the exact ordered unique `creditedContributors` address vector is serialized beside them. Retry reuses that immutable vector instead of reading the later roster.

### 5.6 Fulfillment confirmation flow NET-NEW

Entry points: commitment detail confirm CTA, and the pending-confirmations inbox (§5.8). Flow is a `DialogShell` sheet:

1. Summary of the promise (title, promiser, units, evidence count, linked-work approval status).
2. Any-N-of-group progress: "2 of 3 confirmations recorded" with the confirmer list (`AddressDisplay` rows; self highlighted). Progress meter needs the shared progress primitive (§9) with a text equivalent for screen readers.
3. The dialog announces the indexed eligibility path before the action. Ordinary confirmation uses **Promise kept** with no reason field. Only while that named/default path is unreachable after contributor exclusion may local fallback use **Confirm as garden fallback** or protocol fallback use **Confirm for Green Goods team**; both reveal and require a persistent reason field, and the protocol variant repeats “confirmed by Green Goods team — fallback.” A dual-role caller sees the local variant because the contract classifies local authority first.
4. **Not yet** reveals a separate required reason and calls `raiseDispute`; it does not enqueue a negative confirmation or cancel the commitment.
5. Ordinary confirm enqueues the positive-only `confirmation` job; local/protocol fallback remains an online admin mutation because its reason and current Hat scope must be reviewed at signing time. If this was the terminal action, optimistic state shows Fulfilled pending sync and the hero fires only on indexed sync completion (§5.10). Failure leaves ReadyForConfirmation and preserves the entered fallback/dispute reason for explicit retry.

### 5.7 Work linkage through the existing flow

Work submission itself reuses the existing `work` job kind unchanged (task requirement; kinds today are exactly `work` and `approval`, `packages/shared/src/types/job-queue.ts:89-92`). Linkage:

- Deep link from commitment detail sets a commitment context in the work flow store (`useWorkFlowStore` import, `views/Garden/index.tsx:23`), NET-NEW field. Register #51 locks the read-only "fulfills: {commitment title}" row at `WFLOW@review`. On submit, the `work` job's `meta` carries `commitmentId` (meta is an open record, `packages/shared/src/types/job-queue.ts:26`); the queue enqueues a dependent `workLink` job after the work syncs.
- Post-hoc linking from commitment detail enqueues `workLink` directly with an existing workUID.
- The link is module-native (commitment record references work UIDs); WorkApproval rails are untouched.

### 5.8 Wallet dashboard panel: my commitments + pending confirmations

**Found component**: the wallet dashboard is `packages/client/src/views/Home/WalletDrawer/index.tsx`, a `ModalDrawer` opened from the Home header icon (`views/Home/index.tsx:268,302`). It already declares a third tab `id: "pools"` labeled with the existing i18n key `app.wallet.tab.commitments`, currently rendering `ComingSoonStub` (`WalletDrawer/index.tsx:42-47,68-74`).

Decision register #9 said "Profile-tab wallet dashboard" with an explicit verify-in-execution clause. Execution verification: the wallet dashboard lives on the Home header, not the Profile tab (Profile is Account/Badges/Help sub-tabs, `packages/client/src/views/Profile/index.tsx:65-127`, with account panels in `views/Profile/Account.tsx`). The personal panel therefore lands in the already-reserved WalletDrawer pools tab; no Profile change ships in MVP (one panel, no duplication). Flagged as a verified deviation from the decision's wording, not its substance.

Panel content (replaces `ComingSoonStub`):
1. **Header summary line** (absorbed §5.9's retired home card, decision 2026-07-18): "Promises kept this cycle: X of Y due" — absolute numbers, cross-garden, rendered only when a garden the gardener belongs to has a live cycle. This tab is the **single** cross-garden promises summary in the client.
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

Queue substrate (verified): IndexedDB + XState, exactly two kinds today (`work`, `approval`; `packages/shared/src/types/job-queue.ts:89-92`), `MAX_RETRIES = 5` (`packages/shared/src/modules/job-queue/index.ts:88,247-248`), kind dispatch is a branch in `processJob` (`index.ts:277-288`), executors in `modules/job-queue/job-executors.ts`. New offline kinds (`commitmentSeries`, `commitment`, `claim`, `evidence`, `workLink`, `confirmation`) extend `JobKindMap` and the dispatch branch; `transfer` is a shared online wallet action kind that bypasses the offline field queue. Naming follows the existing single-noun convention.

Membership wait (register #34c): all six pool job kinds run a pre-flight membership check before their first send attempt; a job whose account holds no garden hat enters `waiting_for_hat` — consuming no retries — and resumes automatically when the membership event lands (the join-request approval of register #35 is the canonical trigger). The ≥99% offline-sync metric excludes time in this state (`acceptance-matrix.md` §6).

Submission recovery: before sending any `commitmentSeries` job, the runner persists a deterministic
`creationRequestKey` derived from chain, module, holder, and the private `clientSeriesId`. Restart
recovery first reads the contract's holder/key mapping. A non-zero series ID closes the job without
another write; zero permits a fresh sender call using the same key. The contract returns the
original ID for exact replay and rejects key reuse with a different payload, so a process stop
after wallet/UserOperation broadcast cannot create a second ongoing Offer. Only the derived key,
never `clientSeriesId`, enters calldata.

Before any `commitment` send, the runner likewise persists a private `clientCommitmentId` and its
deterministic creator-scoped `creationRequestKey`. Recovery calls
`getCommitmentIdByCreationRequest`, then binds only after the complete immutable creation payload
matches; exact replay returns the first ID with no second Offer, class reservation, or pool-live
count. A visible retry always reuses the same key. The `workLink` payload persists a caller-scoped
`operationKey`; recovery reads the stored operation payload hash, treats an exact link or a later
unlink as complete, and never re-links from an old job. Conflicting key reuse stops for explicit
review.

NET-NEW job kinds and per-action behavior:

| Action | Kind | Payload sketch (all addresses `Address`) | Optimistic UI | Queued chrome | Retry/failure (MAX_RETRIES 5) | Sync-complete invalidation |
|---|---|---|---|---|---|---|
| Create ongoing Offer series | `commitmentSeries` | `{ clientSeriesId, creationRequestKey, poolId, gardenAddress, metadataCID }`; stable private `clientSeriesId` is the dependency key and deterministically derives the public-safe request key before the first send | Ongoing Offer card appears in pending state; no available places exist until their own Offer jobs are queued | Queued or sending badge; dependent Commitment drafts explain “waiting for your ongoing offer to sync” | Recovery reads holder + request key first. An existing ID binds only after its canonical series/pool matches the queued pool, initial metadata hash, holder, and garden; mismatch stops locally, while an absent ID permits an ordinary retry with the same key. Contract replay is idempotent across wallet, embedded, and passkey senders; failed series remains retryable/discardable while dependent drafts wait without consuming retry budget | series, series list, saved Offer links |
| Create offer / request | `commitment` | Common fields begin `{ clientCommitmentId, creationRequestKey, poolId, cycleId, gardenAddress, direction, claimType, claimMode, contributorPolicy, onBehalfOf, title, note, unitLabel, targetUnits, requiresAssessment, dueDate, metadataCID, needUID, confirmers: Address[], confirmationThreshold, protocolFallbackEnabled, consideration }`. The private stable ID and public-safe key are persisted before the first send. The authoritative direction/claim union permits series linkage only on an Offer + Individual + zero-`onBehalfOf` variant: one-shot `{ commitmentSeriesId: 0 }`, resolved ongoing Offer `{ commitmentSeriesId: bigint }` where the ID is non-zero, or pending local dependency `{ commitmentSeriesId: 0, clientSeriesId: string }`. Every Request, Garden claim, and analog/steward capture variant requires `{ commitmentSeriesId: 0 }` and forbids `clientSeriesId`. Before serialization the builder verifies the selected non-zero series is Active, same-pool, and held by the direct creator; the executor repeats that check against current indexed/onchain state and rejects stale or invalid combinations before broadcast. `clientSeriesId` is local dependency state only; the executor submits the receipt-materialized onchain ID. The commitment-kind union is separate: DomainImpact adds `{ commitmentType: "DomainImpact", requirements: Array<{ actionUID: bigint, requiredCount: number }> }` and accepts no caller-authored `domainTags`; the builder omits them and the executor rejects/ignores any stale value because the contract derives domains from ActionRegistry. Evidence-only kinds add `{ commitmentType: "SupportService"\|"SeasonCampaign"\|"StewardCaptured", requirements: [], domainTags: number[] }`, preserving their optional validated tags. The queue builder and executor preserve every requirement row in order, including valid action UID `0`, and preserve the explicit false/true fallback selection without inferring it from pool or user role. `cycleId=0`, `commitmentSeriesId=0`, zero address, empty arrays, zero UID, false fallback, and zero consideration are explicit sentinels, never omitted defaults. Builder/executor tests assert exact round-trip equality, invalid series-variant rejection before queueing and broadcast, series dependency materialization, DomainImpact rejection of caller tags, evidence-only tag preservation, and fallback opt-in preservation. | Card appears in selected cycle scope + mine with Offered/Requested chip; an Offer counts as available only after its own creation sync reserves capacity | Queued badge; SyncStatusBar count | Failed chip + retry/discard after 5 attempts. Retry first reads creator/key and reuses the same `creationRequestKey`; a matching onchain commitment completes, a payload mismatch stops, and zero permits the same-key send. `parseContractError` names conflicts. | pool commitments/mine/stats/series |
| Claim commitment | `claim` | `{ commitmentId, poolId, kind: "garden"\|"individual", gardenContext }`. Executor rejects `kind != stored claimType`. Individual derives `claimant=requestedBy=userAddress`; Garden derives `claimant=gardenContext`, `requestedBy=userAddress` after operator authorization. Neither identity may equal the commitment creator; the builder disables/rejects creator-operated Garden requests, and ApprovalGated acceptance rechecks the stored requester. Accept/decline are separate online admin mutations keyed by canonical claimant. | OPEN: Accepted locally. APPROVAL_GATED: Pending row with canonical claimant + requestedBy | Queued badge; indexed outcome replaces optimistic state | Pre-event failure reverts row; Declined/Superseded are event outcomes, not queue failures | commitment, requests, requestsByClaimant |
| Attach lightweight evidence | `evidence` | `{ commitmentId, gardenAddress, creditedContributors: Address[], note?, link?, media?: File[] }` (files serialized per `SerializedFileData`). Builder validates 1–`MAX_EVIDENCE_CONTRIBUTORS_PER_ATTACHMENT` unique active roster addresses and persists their exact order. After upload, the executor calls `attachEvidence(commitmentId, cid, creditedContributors)`; retries reuse the serialized vector and never infer recipients from the current roster. | Evidence row appears with uploading state and named credited contributors | Row-level spinner + queued badge; media and attribution held in IndexedDB | Row failed state, retry per row; media/attribution never silently dropped | `queryKeys.pools.commitment(commitmentId)` |
| Link work to commitment | `workLink` | `{ operationKey, commitmentId, workUID, requirementIndex, gardenAddress }` (or deferred: `meta.{ commitmentId, requirementIndex }` on a `work` job spawns this after work syncs). The caller-scoped key is persisted before send. The builder resolves the selected requirement row and the executor forwards that exact index; repeated action UIDs never use first-match behavior. | Linked-work row appears with pending chip | Chip "linking" | Row failed state + same-key retry; recovery reads the operation result/hash and treats an exact link or later unlink as complete. Work itself is unaffected. | `queryKeys.pools.commitment(commitmentId)`, `queryKeys.works.*` (existing family) |
| Submit ready / confirm fulfillment | `confirmation` | discriminated union `{ action: "submit", commitmentId, gardenAddress }` or `{ action: "confirm", commitmentId, gardenAddress }`. Submit is limited to evidence-only SupportService/StewardCaptured/SeasonCampaign and checks evidence + assessment. Queued confirmation is ordinary only and stays contributor-excluding. Local/protocol fallback is an online admin mutation with mandatory reason and current Hat revalidation; it never enters this queue. | Submit shows “waiting for confirmation”; ordinary confirm advances meter | Detail/inbox queued chip; hero waits for sync | Optimism reverts on failure; dedupe by action + commitmentId + userAddress | commitment, pendingConfirmations, stats |
| Not yet / raise dispute | online contract action, not a queue kind | `{ commitmentId, reason }` | No optimistic state transition; control shows wallet pending | No offline queue chrome | Failure leaves ReadyForConfirmation and shows inline retry; success invalidates to Disputed | `queryKeys.pools.commitment(commitmentId)`, `queryKeys.pools.pendingConfirmations(userAddress)` |
| Accept/decline claim; attach assessment; steward Ready override | online shared mutation hooks | canonical claimant key for accept/decline; `{ commitmentId, assessmentUID }` for attach; `{ commitmentId, reason }` for override | No offline optimism beyond wallet-pending row | No field-queue chrome | Failure preserves current indexed state and exposes inline retry | commitment, claim requests, pending confirmations |
| Join/add/remove/leave/assign contributor | online shared mutation hooks, never queue kinds | discriminated payloads call `joinCommitment(commitmentId)`, `leaveCommitment(commitmentId)`, `addContributor(commitmentId, contributor)`, `removeContributor(commitmentId, contributor)`, or `setContributorRequirement(commitmentId, contributor, requirementIndex, assigned)`. “Invite” is the gardener picker that resolves an address before `addContributor`; it is not an on-chain invitation state. | Wallet-pending control only; indexed roster remains authoritative until confirmation | No offline queued badge; disabled offline with “Connect to update the team” | Failure preserves the roster/assignment and keeps the selected gardener for explicit retry; cap, freeze, lead, and credited-removal errors use inline copy | commitment, contributors, pending confirmations |
| Send G$ | `transfer` | `{ chainId: 42220, token, to, amount }` | Wallet row shows wallet-pending state after submit; balance refresh waits for tx confirmation | Online-only wallet action; never enters the offline field queue and never shows queued badge | Wallet rejection / tx failure surfaces inline with retry CTA; no MAX_RETRIES job replay | `queryKeys.settlement.gardenerBalance(userAddress)`, `queryKeys.settlement.disbursements(userAddress)` |
| Submit work | `work` (existing, unchanged) | Existing `WorkJobPayload` (`job-queue.ts:57-68`) + optional `meta.commitmentId` | Existing behavior | Existing SyncStatusBar behavior (`packages/shared/src/components/SyncStatusBar.tsx`) | Existing | Existing `worksKeys` + `queryKeys.pools.commitment` when meta carries linkage |

Query-key family: NET-NEW `poolsKeys` module at `packages/shared/src/config/query-keys/pools.ts` (pool, cycles, commitments, commitment, mine, claimRequests, claimRequestsByClaimant, pendingConfirmations, stats), registered in `packages/shared/src/config/query-keys/registry.ts:11-39` as `queryKeys.pools`.

View-only offline (no queueing, cached reads render with staleness note): pool/cycle stats, browse lists refresh, claim-mode metadata, consideration status, dispute state. Console-side actions (seeding, cycle management, disputes, curation, considerationPaid) use the same queue plumbing but are online-expected admin actions (deep-dive offline split); the PWA never exposes them.

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
| Fulfilled | Chip + hero moment once (§5.10); consideration row updates |
| Failed/retry | Failed chip after 5 attempts with retry/discard; error text via `parseContractError` + `USER_FRIENDLY_ERRORS` |
| Disabled | Paused pool banner, controls disabled with explanation (never silently missing) |
| Settlement status | Before an authenticated outcome = “support on its way”; only authenticated CCIP success acknowledgment = “support arrived”; authenticated failure = “support is being rearranged” plus a calm explanation — never a success phrase and never the seven-state operational vocabulary; AA-gated gardener delivery stays unavailable with an explanation |

---

## 6. Surface 2: Admin (full depth)

### 6.1 Flow-to-surface map (register #10)

| Flow | Workspace | Surface |
|---|---|---|
| Pool overview + cycle management | Garden | NET-NEW Pool tab on the Garden workspace MainSheet route (`/garden/pool`); tab rail precedent `packages/admin/src/views/Garden/index.tsx:81-98` (overview/activity/settings via `AdminTabRail`) |
| Operator seeding console | Garden | Flow AdminDialog (`variant="flow"` + `ActionFlowShell`), route `/garden/pool/seed`; precedent `packages/admin/src/views/Hub/CreateAssessment.tsx:12-22` |
| Claims/review queue (approval-gated) | Garden | Queue list inside Pool tab; row opens AdminDialog detail |
| Analog capture | Garden | Flow AdminDialog, route `/garden/pool/capture`; extends the Submit Work flow grammar (`packages/admin/src/views/Garden/SubmitWork.tsx:44-52`, route registration `packages/admin/src/routes/views.tsx:114-120`) |
| Commitment detail, dispute/override, considerationPaid | Garden (and Community Pools mode for protocol pool) | AdminDialog detail with workspace `tone` prop |
| Assessment v3 creation | Hub | Extend the existing flow AdminDialog at `/hub/assess/create` (`packages/admin/src/routes/views.tsx:124-135`, view `packages/admin/src/views/Hub/CreateAssessment.tsx`) |
| Confirmation queue | Hub | NET-NEW Confirm stage on the existing stage rail (§6.9) |
| Protocol pool console + current-garden pool | Community workspace, NET-NEW Pools mode | Nested route `/community/pools` with the Community mode rail (§6.8) |
| Cycle-open allocation policy | Garden (and Community Pools mode) | Step inside the open-cycle flow AdminDialog (§6.10) |

All admin copy stays restrained (no hero language, no gallery moments); celebration is a checkmark row in the cycle report.

### 6.2 Garden workspace: Pool tab + cycle management NET-NEW

Route `/garden/pool` added to the garden branch (`packages/admin/src/routes/views.tsx:168-215`) and to the Garden view's `AdminTabRail` (`packages/admin/src/views/Garden/index.tsx:81-98`). Composition: `CanvasRouteFrame` + `CanvasRouteHeader` (title "Pool", actions via `AdminViewActions`) + `CanvasRouteContent`.

Sections (AdminCard blocks):
1. **Pool status card**: pool state chip, capability flags, charter/policy CID, provider open-commitment cap, and latest qualifying Baseline assessment. The app keeps the Ready action disabled until all three preflight inputs are present; the submitted contract write itself enforces charter plus a non-zero concurrent-commitment cap only. Once Ready, the card's primary action is **Open pool**. **Close pool** is enabled only when indexed `liveCommitmentCount == 0` and `nonTerminalCycleCount == 0`; every cycle must be Cancelled or Composted, and every cycle-less or cycle-scoped commitment must be Fulfilled, Cancelled, or Expired. Otherwise the card says the remaining live promises must be wound down and links to those rows/cycles instead of opening a reverting confirmation. A past-due but still-live row renders in `W7@due-live` with **Expire now**; only a successful permissionless `expireCommitment` routes to the Expired `W7@expiry-queue` result and exposes re-seed/history. Failure keeps the row live and never claims its capacity or pool/cycle count was released. A later keeper is only an operational backstop. Then Compost/Reopen follows §4.1 (register #34a — the card owns the pool lifecycle; the open-cycle flow adds only a "pool is Ready — open it now?" guard prompt). Pause requires a reason CID; resume clears the indexed reason. The card disables create/claim/decline/accept/exchange/Ready-submit/override/confirm while paused and keeps evidence/linkage, roster-safe wind-down, cancel/expire/resolve, plus cycle cancel/compost wind-down controls available.
2. **Cycles console**: a dedicated Season slot shows the one open Season or an empty “No open Season” state, followed by a Campaigns list that may contain any number of concurrently open Campaigns. Every row has its own locked-state stepper (Draft, Seeded, Open, InProgress, Reviewing, Reconciled, Composted), scoped counts, and guarded actions; opening a second Season is blocked and points to the existing one, while opening another Campaign remains available. Cancelled is destructive behind a reason field, Reviewing/InProgress interchange is scoped to one row, and open-cycle runs §6.10 for the selected cycle. Reconciled/Composted/Cancelled history appears below with type and report scope preserved.
3. **Commitments table**: `AdminSearchToolbar` + `AdminFilterChip` row (state, type, direction) + `AdminSortSelect`; rows are `AdminListItem` with `AdminBadge` state chips; row opens the commitment AdminDialog detail (state timeline, evidence, linked work, confirmer rule, consideration row, dispute/override actions §6.7).
4. **Claims queue** (visible when any approval-gated requests exist): each row shows canonical `claimant`, authenticated `requestedBy`, `claimType`, `gardenContext`, `requestedAt`, and `state`. For a Garden claim the claimant is the GardenAccount and requestedBy is its operator; for Individual they match. The creator cannot request a Garden claim through a GardenAccount they operate; the claim control is disabled with the self-claim explanation, and acceptance rechecks stored legacy/pending rows before mutation. Accept/decline key the exact stored claimant. Accept shows derived `providerGarden` and supersedes other pending rows; decline requires a reason and affects only the selected row. History exposes reason/resolution without presenting event outcomes as queue failures.

**Layout addendum (audit 2026-07-18)**: the Pool card carries an above-the-fold summary row (awaiting-confirmation / claims-waiting / failed-payout counts with jump links); the commitments table uses segmented state chips **Open · Confirmed · Past** instead of any history sub-view — composted cycles and settled records surface under Past (the Garden `OverviewTab` chip precedent) and the old cycle-console "History:" row is retired; commitment rows open in the **left inspector** (`AdminDialog` via the Garden sheet descriptor), never a right rail (the right sheet stays account chrome). W7 draws all of this.

### 6.3 Steward seeding console NET-NEW (`/garden/pool/seed`)

Flow AdminDialog + `ActionFlowShell` steps (stepper precedent `CreateAssessment.tsx:171-177`):

1. **Type and scope**: commitment type (SeasonCampaign, SupportService, DomainImpact, StewardCaptured), direction (offer or request the pool is seeding), cycle binding, title, note. The cycle selector groups the one open Season separately from every open Campaign, labels type on every option, and permits an explicit cycle-less choice where the contract allows it. `AdminTextField` + type cards.
2. **Requirements and team policy**: unit label + target quantity; repeatable `{ actionUID, requiredCount }` rows; immutable `ContributorPolicy` (`Open` or `LeadManaged`); optional assessment requirement; due date or cycle-deadline default. DomainImpact requires at least one registered row and a positive count per action. SupportService, StewardCaptured, and SeasonCampaign may explicitly choose evidence-only with no Work requirements. The review step shows per-requirement progress and the single commitment's `approvedUnits` use `floor(targetUnits × Σ min(approved[i], required[i]) / Σ required[i])`. No assessment UID is attached at creation because `providerGarden` is not frozen until acceptance.
3. **Who confirms** *(amended 2026-08-10, register #94)*: direction-aware default preview (Offer recipient; Request creator) or explicit any-N named group. The address group picker excludes the accountable lead and every contributor before threshold validation. A labeled checkbox, **“Let the Green Goods team confirm if nobody local is eligible,”** writes `protocolFallbackEnabled` and is **on by default for the pilot** (register #94), switchable off per promise; the guard is unchanged — usable only while the ordinary path is unreachable, reason required, never a contributor. When the ordinary threshold is unreachable and the fallback is switched off, the flow requires either a repaired rule or re-selecting the fallback; the protocol option is disabled with an explanation while `protocolPoolId` is unavailable. Claim mode (open-claim vs approval-gated) is prefilled by context default (protocol pool approval-gated, garden campaign open-claim; register #19).
4. **Consideration** (optional; the default is free): select exactly one rail: `None`, `ArbitrumExternal`, or `CeloSettlement`. `None` requires zero source/token/amount. `ArbitrumExternal` captures the external source reference, token, and amount for later payout recording. `CeloSettlement` captures only the amount and serializes zero source/token sentinels; SettlementModule derives its canonical G$ token and immutable payer Safe from direction plus acceptance context. The preview says a Request is paid by the pool garden and an Offer by the claiming garden. After fulfillment it shows the immutable result: a Garden-claimed Request pays the external claiming garden Safe in full; individual Requests and all Offers use a conserved contributor plan; retention appears only for garden-internal contributor plans. It never enables `Record payout`.
5. **Review and seed**: summary repeats the immutable contributor policy, who may join/manage the roster, ordinary confirmer reachability, and whether Green Goods team fallback is selected, then exposes the seed action. Console actions are online-expected but ride the same queue plumbing (§5.11 note).

### 6.4 Claims/review queue

Covered in §6.2 section 4. Work-approval review for DomainImpact commitments stays on the existing Hub Work stage and `approval` job rails; the commitment detail simply reflects approved-work counts (gates from the Lifecycle doc: attached, approved, assessment-complete when declared, then ReadyForConfirmation; operator waivers surface as visible overrides).

After acceptance, an assessment-required commitment exposes **Attach assessment** at the locked `W10@attach-assessment` placement (register #51). The picker includes only non-revoked v2/v3 attestations whose recipient equals the stored `providerGarden`; submission calls the shared `attachAssessment` mutation. Evidence-only records use the realized W10 Accepted action row: **Cancel promise**, **Mark ready with override**, and **Send for confirmation**. DomainImpact never shows Send for confirmation. Override and cancellation remain separate, steward-only, reason-required actions.

### 6.5 Analog capture NET-NEW (`/garden/pool/capture`)

Extends the Submit Work on-console pattern (flow AdminDialog + `ActionFlowShell`, `SubmitWork.tsx:44-52`). Differences from gardener creation (§5.4): step 0 selects the gardener (the social source; `capturedFor` in the `commitment` payload) and the capture kind (offer, request, or confirmation on the gardener's behalf). Non-custodial phrasing is fixed in the flow header: the record names the gardener as the promise source and the recorder as metadata — the recorder holds the `operator`/`owner` Hats role, and the rendered copy always calls them the **steward** ("Recorded by {steward} on your behalf.", §13 question 2). Captured fallback confirmations require a non-contributor caller with current local-garden Hat authority, or current protocol-garden Hat authority when the commitment opted in; the form names the resolved local/protocol path and always requires a reason. Writes use the shared mutation/job boundary from §5.11; fallback confirmation remains online.

### 6.6 Assessment v3 creation (extend, not fork)

Extend `packages/admin/src/views/Hub/CreateAssessment.tsx` (steps today: DomainContextStep, StrategyKernelStep, ActionsHarvestStep, lines 15-17,44-59; orchestrated by shared `useCreateAssessmentWorkflow`, direct EAS attest, online-only, corrections-log §2). NET-NEW in step 1 (domain context): cycle selector (garden's cycles), assessment kind toggle **baseline vs re-assessment (delta)**, and, when delta, a baseline-reference picker listing the garden's prior baseline assessments for the same domain. Per garden per cycle per domain: the form validates one baseline per (garden, cycle, domain) and points duplicates at the existing record. Authorship gating per register #7: baseline allows evaluator or operator (current resolver behavior, corrections-log §2); delta/re-assessment renders only for Evaluator-hat holders and the resolver enforces it. Remains a direct attest (no offline queue); failure surfaces inline per the existing flow.

### 6.7 Dispute/override and consideration settlement

On the commitment AdminDialog detail:
- **Pre-acceptance declared value**: Offered/Requested rows may open
  `W10@edit-declared-value`; the steward submits `setDeclaredValue` for the complete records-only
  value/basis pair. Accepted or terminal rows expose no edit. The current instance snapshot and
  every historical instance remain unchanged.
- **Dispute**: "Raise dispute" (allowed from Accepted through Expired per §4.3) with mandatory reason; resolution actions are `RestorePrevious`, `Fulfill`, `Cancel`, or `Expire`, each with required reason. The module stores the pre-dispute state; `RestorePrevious` returns to it. An Expired commitment cannot resolve Fulfilled. All reasons render in the state timeline for gardeners too.
- **Override**: requirement waivers (for example waive a rejected work's replacement) carry reason and a visible "override" marker in both admin and gardener detail (Lifecycle rule).
- **ArbitrumExternal payout record**: on Fulfilled, this rail alone gains "Record payout" (`AdminButton`); `AdminConfirmDialog` captures the executed rail reference (jar withdrawal or treasury tx) and records the module's `ConsiderationPaid` event (register #18). The row then shows paid status + reference. No value moves through this UI.
- **CeloSettlement queue**: on Fulfilled, this rail instead gains "Set recognition and payment"
  after pooling, settlement-account, and provider-garden authority gates are GREEN. The
  gardener-delivery gate does not block local plan bookkeeping. The editor names canonical G$,
  provider garden, canonically recomputed recognition default, explicit retention, and contributor
  payout amounts. Saving creates an editable parent draft and atomically derives payment weights
  from the complete amount vector. A separate **Finalize payout plan** action verifies
  conservation and freezes it without creating children. Only **Prepare payout** for a non-zero
  row requires `gardenerDeliveryEnabled` and the live route; the first action creates one immutable
  Queued child and an exact repeat returns the same child. An all-retained zero-child plan
  completes on finalization without CCIP even while delivery is disabled. `Record payout` is
  unavailable and the parent/child settlement rows own all later delivery status.

### 6.8 Community workspace: Pools mode NET-NEW

Registration path (all verified anchor points):
1. Add `"pools"` to `AdminCommunityMode` and use the existing `adminRoutes.communityMode("pools")` helper in `packages/shared/src/utils/navigation/admin-routes.ts`; do not add an `AdminWorkspaceId` or top-level root.
2. Add `/community/pools` inside the existing Community route branch in `packages/admin/src/routes/views.tsx`, using the same Community authorization boundary. It renders the Protocol pool plus the current garden only. Protocol-only actions retain their exact capability gates inside the mode; cross-garden inspection belongs exclusively to the capability-gated Operations workspace.
3. Add Pools to the existing Community mode rail. The NavigationBar and command palette continue to target the canonical `/community` workspace; no fifth workspace tab or top-level command route is introduced.
4. Pools inherits the Community workspace tone through `data-tone="community"`; dialogs pass that same tone.

View at `/community/pools` — **rescoped 2026-07-18**: the admin stays garden-focused, so this mode shows exactly **the Protocol pool + this garden's pool**; other gardens' pools never render here (the cross-garden overview moved to the Operations workspace, §6.11). The inner `AdminTabRail` carries two focused views:
- **Protocol pool tab** *(audience amended 2026-08-10, register #97 — this is the protocol-steward operations home)*: the root-garden pool console (tokenId 0, `rootGarden 0xf401f34378384713222d1d21f63359cc4E8a858a`, corrections-log §6) carries the protocol stewards' own queues — cross-garden claim accept/decline, the protocol confirmations queue mirroring the Hub Confirm grammar (§6.9), protocol seeding (register #96), the read-only member-delivery gate status row (register #34f), and the **funding view** (declared consideration references only; co-funded references name the owning garden). Garden stewards claim protocol commitments in the client (W25, the sb13 journey) — that path is not duplicated here. Protocol-only actions keep their exact capability gates; deployer status never substitutes for `queueFunding` authority.
- **This garden tab**: one tap into the same §6.2 pool console (W7) — no duplicated grammar, with the Open · Confirmed · Past chips carrying history in place.

### 6.9 Hub: Confirm stage on the existing rail NET-NEW

The Hub pipeline rail is `AdminTabRail` fed by `PIPELINE_STAGE_CONFIG` with stages work, assess, certify, history (`packages/shared/src/hooks/admin-ui/hub/hub.utils.ts:21,121`; counts and visibility built in `packages/shared/src/hooks/admin-ui/hub/hub.workbenchModel.ts:146-166`; rendered in `packages/admin/src/views/Hub/index.tsx:128-139`). Add stage `confirm` between certify and history: queue of commitments in ReadyForConfirmation where the signed-in account is eligible as an ordinary confirmer, a current local-garden fallback steward, or a current protocol-garden steward for an indexed `protocolFallbackEnabled` commitment. The local queue spans the operator's gardens; the protocol queue may include opted-in commitments from any pool without granting full other-garden pool browsing. Row: promiser, commitment title, garden, N-of-group progress (`AdminLinearProgress` + text), a visible eligibility badge (**ordinary**, **garden fallback**, or **Green Goods team fallback**), and confirm / Not yet actions opening the AdminDialog detail. Fallback dialogs require a reason; Not yet calls `raiseDispute` with a separate reason. Stage count = queue length (stageCounts pattern, `hub.workbenchModel.ts:146-152`). Route `/hub/confirm` added beside the existing hub children (`packages/admin/src/routes/views.tsx:96-166`); stage content branch added to `HubStageContent` (`packages/admin/src/views/Hub/components/HubStageContent.tsx`).

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

### 6.11 Operations workspace NET-NEW (decision 2026-07-18; authority amended 2026-07-30)

A NEW capability-gated admin workspace tab. The nav and route use
`showOperations = isDeployer || canQueueFunding || canOperateSettlement`; route visibility does
not confer write authority. `canQueueFunding` resolves from current protocol-steward or
SettlementModule-owner authority, and deployer alone cannot submit funding. Settlement dispatch,
retry, requeue, cancellation, and configuration retain their own contract-specific capabilities.
Stage rail: **Queue · CCIP · Flows** (W24 draws it).

- **Queue**: every emitted Queued/Failed disbursement and funding hop across all gardens, with batch composition and the W22 command/ack console. An unsubmitted funding form never appears as a Draft queue row. Source controls are dispatch, same-key command retry, authenticated-failure requeue, and queued-only cancel; the protocol executor is an automated Celo contract, not a human role or report control.
- **CCIP**: command/destination/acknowledgment message IDs and Explorer links, immutable-router plus active/previous-peer health, native ETH/CELO reserves, acknowledgment deferrals, derived delivery delay, same-key retry, stored-outcome acknowledgment retry, and manual-execution guidance only when CCIP Explorer marks the command eligible. No row or control manually marks delay, execution, receipt, or confirmation.
- **Flows**: the cross-chain funds board — GoodDollar pool → GG protocol Safe (a **Celo balance read**, since HoA→protocol is an upstream fact the module never records, corrections-log §9) → garden Safes → gardeners, each downstream figure distinguishing queued, dispatched, Celo-executed/ack-pending, confirmed, failed, and delayed. `canQueueFunding` exposes **Seed / top up garden**, with persistent labels for garden and amount plus derived source/recipient review. Submit calls `queueFunding` and lands on a typed `Funding` / `ProtocolToGarden` Queued result with no commitment ID; cancel returns without creating state. A viewer who reaches Operations through another capability sees a calm funding-unavailable state instead of a reverting control. The cross-garden pool oversight rows (formerly §6.8's Gardens tab) live here: alphabetical, `promiseKeptRate` + `openCommitmentCount`, never ranked.

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

Recommendation, locked for this spec: `promiseKeptRate` renders publicly only when the cycle has **at least 5 due commitments and at least 3 distinct promisers**. It is the sole cross-commitment percentage. Below threshold, show absolute counts in sentence form and never a percentage; a single lapsed promise in a three-person pool must not read as a 33 percent failure on a public page. Cancelled and Disputed never appear individually anywhere public (§4.3). The same threshold applies to the WalletDrawer Commitments summary (§5.8); inside the garden (pool tab), gardeners see their own full counts and exact-label unit groups.

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
| `app.pool.exchange.*` / `cockpit.garden.pool.exchange.*` | pair picker, pair status, pool exchange feed, and acceptance summary |
| `app.pool.templates.*` / `cockpit.garden.pool.templates.*` | offer-template names, one-line explanations, defaults, and locale naming notes |
| `app.pool.terms.*` / `cockpit.garden.pool.terms.*` / `public.pool.terms.*` | first-exposure plain meanings and recognition/settlement explanations |

All copy in these families passes `bun run lint:vocab` (§3).

## 11. Analytics and instrumentation

PostHog project routing per repo rule: client PWA + editorial + community events go to App (163591); admin events to Admin (262122). Event family proposal (snake_case, one family so funnels stay queryable):

- `commitment_created` {direction, commitment_type, pool_type, captured_by_operator: bool, protocol_fallback_enabled: bool}
- `commitment_claimed` {claim_mode, claimant_kind: "garden"|"individual", pool_type} : **the garden-vs-individual claim custody ratio required by the locked register is the claimant_kind property on this event; dashboard = ratio over time per pool_type**
- `commitment_evidence_attached` {media_kind}
- `commitment_work_linked` {via: "deep_link"|"post_hoc"}
- `commitment_confirmed` {nth_of_group, is_final, confirmation_path: "ordinary"|"pool_fallback"|"protocol_fallback"}
- `commitment_fulfilled_viewed` {surface} (hero exposure)
- `cycle_opened` / `cycle_closed` / `cycle_composted` {cycle_type, allocation_preset}
- `consideration_paid_recorded` {rail: "cookie_jar"|"treasury"}
- Community-interface events are owned by `.plans/active/community-interface/spec.md` §12 (`need_created`, `need_signal_created`, `need_status_set`, `seeded_from_need`, and related events); this spec does not define a second signal vocabulary.
- Offline queue health rides the existing job analytics (`packages/shared/src/modules/job-queue/job-analytics.ts`): the six offline queue kinds inherit job_added/completed/failed tracking automatically. Those events exclude raw wallet and garden addresses, local job/session IDs, transaction hashes, raw errors, and address-bearing breadcrumbs; only non-identifying queue kind/state, bounded counts, timing, chain, action UID, and local health metadata may leave the device. Online wallet `transfer` uses transaction lifecycle analytics, not job replay analytics.

Privacy boundary: no counterparty addresses, commitment titles, or reason texts in event properties; counts, enums, and booleans only (matches the Linear/PostHog privacy rule in CLAUDE.md).

## 12. Accessibility notes

- **Global acceptance for every surface**: pool, cycle, commitment, claim-request, confirmation, dispute, settlement, creation, and admin flows use semantic landmarks/headings, native controls where possible, persistent visible labels and accessible names, logical reading/focus order, visible focus, and WCAG AA contrast. All interactive targets are at least 44px, not only claim/confirm. Loading preserves layout; empty states name the scope; failed submissions focus a concise error summary and retain entered data; dialogs restore focus to the trigger or its replacement. Screen-reader output names direction, cycle type/scope, claim-request state, settlement evidence state, and available recovery without relying on surrounding visuals. These rules apply in en/es/pt and to public browser, installed PWA, and admin variants.
- **Confirmation flow focus order**: opening the confirm sheet moves focus to the sheet title; tab order is summary, progress meter (focusable, labeled "2 of 3 confirmations recorded"), Not yet, confirm. Choosing Not yet reveals and focuses the required dispute-reason field before submission. On close, focus returns to the invoking CTA or its replacement state chip. `DialogShell` and `AdminDialog` own the focus trap; do not hand-roll.
- **Fallback selection and provenance**: the Green Goods team option is a native checkbox with a
  persistent visible label and programmatic description; its disabled state remains focusable
  through adjacent explanatory text naming the missing registered-protocol-pool prerequisite.
  Confirmation path is always written in text beside the actor and never conveyed only by badge
  color. Opening a fallback confirm dialog focuses the title, then summary, path explanation,
  required reason, Not yet, and confirm; validation returns focus to the reason field.
- **Offline status announcements**: enqueue and sync-complete events get an `aria-live="polite"` announcement region colocated with `SyncStatusBar` (`packages/shared/src/components/SyncStatusBar.tsx`): "Saved on this device, will sync when connected" on job_added while offline; "N promises synced" on completion. Retryable failures remain polite. Assertive announcements are reserved for an unrecoverable result or an outcome that makes the next action unsafe, and fire once rather than per retry.
- **State never by color alone**: all state chips use `StatusBadge` (icon + color, `.claude/rules/frontend-design.md` Rule 12); the state timeline pairs icons with text labels.
- **Progress meters** always carry text equivalents (for one commitment, units approved of target; confirmations recorded of required). Pool/cycle summaries use state counts and separate exact-label rows rather than a mixed-unit meter.
- **Hero moments** respect `prefers-reduced-motion` (static celebratory frame) and never trap focus; dismissible by any input.
- **Admin rail and tabs** inherit roving tabindex from `AdminTabRail` (quick-reference Tabs table); the new Confirm stage and Pool tab add no custom key handling.
- **Touch targets**: claim/confirm CTAs and every other interactive control meet the 44px minimum on touch surfaces; queued/failed badges are not the tap target, the card or adjacent named action is.

## 13. Open UX questions from the brief, answered

1. **Readiness-only vs live/onchain explicitness**: state it in banner copy at the glance layer ("warming up" vs live cycle language, §4.1/§5.2); reserve chain-explicit phrasing ("recorded on Arbitrum") for the engage layer (commitment detail timeline footer). Do not put chain vocabulary on browse cards.
2. **Non-custodial phrasing for steward-assisted capture**: fixed pattern "Recorded by {steward} on your behalf. The promise stays yours." on both the admin capture flow header (§6.5) and the gardener's commitment detail chip (§5.3). The gardener is always the named source on the record; the recorder is metadata. The `operator`/`owner` Hats role does the recording, but gardener-facing copy always says **steward** (rename locked 2026-07-26).
3. **Public stats for small communities**: threshold rule in §7.2 (rates only at >= 5 due commitments and >= 3 distinct promisers; counts-only sentences below). Applies to editorial and the WalletDrawer Commitments summary; in-garden gardeners always see full numbers. There is no Home card.
4. **Which commitment types may live outside a domain action**: SupportService, SeasonCampaign, and StewardCaptured may have no Work requirements. DomainImpact carries repeatable action/count requirements; each action is registry-validated and its domain is derived, so no second positional domain array can drift. UID `0` is valid. The eventual `MAX_REQUIREMENTS` is a benchmarked implementation bound, never a four-action product rule.
5. **Where settlement controls sit**: G$ settlement uses `SettlementModule` + bounded Celo executor events, not the reserved pool `settlementEnabled` flag. Admin Garden Pool gains the settlement status section; PWA commitment detail gains settlement-status rows only after the canonical contract/indexer interfaces are GREEN; `/community/pools` shows the Protocol pool plus the current garden only. Cross-garden command/ack health and funding controls live in the capability-gated Operations workspace, with each write independently authorized. Later transferable-voucher controls sit behind `settlementEnabled` when PRD-651 unblocks. There is no top-level `/pools` route (§2).

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
condenses already-confirmed confirmers into one summary row below the meter, with
the reader's own row kept distinct; the WalletDrawer's "My commitments" group
sits behind a count-carrying disclosure while the pending-confirmations inbox
stays open. W4/W5 draw it.

**§6.3 step count — five, not four (2026-07-24; confirmation choice expanded
2026-08-02).** The seeding console draws **five** steps: *Who confirms* carries
confirmers, threshold, claim mode, and the explicit Green Goods team fallback
checkbox; *Consideration* carries the declared rail and amount. Five is the locked
presentation — `W8` draws it and `sb6`/`sb9a`/`sb10` walk it.

**§5.4/§6.3 pilot fallback default + wizard compression (2026-08-10, register
#93–#94).** `protocolFallbackEnabled` defaults **on** at both creation surfaces,
switchable off per promise; the unreachable-path guard, required reason, Hats
check at signing, and contributor exclusion are unchanged, and the queue builder
still round-trips the explicit boolean without inference. The client wizard's
default path is four steps for garden work (What → How much → Proof → Review)
and three for service/requests: the separate Who-confirms step retired into an
Advanced detour off review, which also carries the named-group picker, the
contributor policy (`Open` default), and `requiresAssessment` (off default).
The cycle field binds the unique legal open target and stays editable; the
chooser renders only when more than one target is legal. The seeding console
keeps its five steps (the 2026-07-24 lock above) with the fallback checkbox now
pre-checked. Guided flows were re-cut the same day so each is one person's
action to completion: echoes are read-only (the build rejects an echo carrying
a control), continuations hand off via end-of-flow links, and `sb42`–`sb48`
carry the split-out segments. Section-body edits for this amendment were
line-count-neutral, so `UX:NNN` citations below §5.4 did not shift.

**§5.4 request wizard, fixed chrome, and tap-first inputs (2026-08-10, register
#95–#96).** Request creation is the same wizard at full fidelity — three steps
(What → How much → Review), never a single compressed screen. Every creation
step uses the Submit Work chrome this section already cites: the close +
progress header and the bottom action bar are fixed; only the form content
scrolls. Unit and amount are chip picks with a typed escape, due is a radio
defaulting to the cycle end on every path, titles offer tap-to-fill suggestions
from the garden's actions and common asks, and reason-taking dialogs lead with
common-reason chips that fill the still-required stored reason. §6.9's admin
chapters resolve as Decide on promises / Work review / Assessments; the
baseline assessment is its own flow ending at §6.2's readiness checklist; and
the protocol pool seeds its own asks and offers to gardens from §6.8's
Community workspace with steward-reviewed claims (register #19).

**§5.4 DomainImpact request variant (2026-08-10 night, register #97a).** An
ask may be garden work: choosing Garden work on the ask's first step adds the
Requirements proof step, so a garden-work ask runs four steps (What → How much
→ Proof → Review) while a service ask keeps three. Requirement rows,
validation, and the action-card grammar are §5.4 step 3 unchanged; who-confirms
stays the asker with the pilot fallback behind them; and review reaches the same
Advanced detour as the offer path — per-promise fallback opt-out and a declarable
assessment included, drawn once in the offer cast. The drawn ask keeps every Advanced default, so approved work alone carries it to Ready per the contract's conditional gate; choosing Garden work re-renders the wizard as its own four-step cast, so the dot row never grows mid-flow.

**§3 promise vs offer/ask vocabulary (2026-08-11, correction pass D3).** "Promise"
names the *record* — detail surfaces, counts, and timeline copy ("Open the
promise", "8 promises · 5 kept"). The *acts* always use direction verbs: "Offer
support", "Ask for help", "Make this offer", "Ask for this help". No creation
surface, template picker, or wizard header may read "Create a promise" or "Make
a promise"; the template picker header is "Start from a template".

**§5.2 card contract + steward-authority copy (2026-08-11, D5/D8b).** Browse
cards additionally carry a **creator by-line** (avatar + name; "for {garden}"
when garden-claimed) and real progress where one exists (places left on an
ongoing Offer, approved n/m on garden work); the state chip renders only when
the state is not plainly open; the footer carries **exactly one** context
action ("Take this up" / "I can help" / "Ask to take this up" / "Open promise")
or one plain reason line when no action is available; a small roster indicator
appears when a team has formed; notes, eligibility prose, and declared value
live in detail, never on cards. Ongoing-Offer places render with an "Ongoing"
chip + places-left count. The §5.2 empty-Season slot also names authority
plainly: Seasons and Campaigns are opened by stewards.

**§5.4 composer correction (2026-08-11, D2/D4/D5/D7/D9 — supersedes §5.4's
"stays editable in step 1").** Direction is **fixed by the entry CTA** ("Offer
support" / "Ask for help") and never renders as an in-form Direction control;
changing direction means leaving the flow. Step 1 carries the kind choice as
plain words (garden work vs a service or support) plus an optional **Add
details** capture — photo / audio note / written note / links — using the
work-flow media interaction (camera/gallery/mic one-tap from the fixed action
bar); its payload is pinned as the commitment-metadata JSON v1 document
(contract-spec §6 addendum 2026-08-11) whose CID rides `metadataCID`. Step 2
gains **How often — Just once / Ongoing** on offer casts; Ongoing folds the
former separate ongoing wizard (Appendix F.2 item 2) into this composer: review
shows the series line and submission runs `createCommitmentSeries` plus the
first place creations as one ordered queue sequence. The optional "Offer this
in exchange for…" row (Appendix E.1) is a labeled detour from step 2. The
template picker (Appendix E.2) is a **prefill layer reached from step 1**
("Start from a template"), never a gate before the form. The review step
renders the **work-flow review anatomy** — sectioned `WorkView` grammar (What
you're offering/asking · How much · Proof · Who confirms & team), each section
with an edit link back to its step — instead of a single label/value card. The
Advanced detour additionally offers **Invite contributors** (LeadManaged roster
picker, `addContributor` semantics, online-only) so a team can exist from
creation. Flow chrome: the fixed bottom action bar lays its actions in **one
row** — an icon or short-text secondary beside one full-width primary, matching
the shipping Submit Work bar — and detour affordances render in page content,
never as a second stacked bar button.

**§5.5 evidence-capture parity (2026-08-11, D4 — supersedes the pick-one-kind
form).** The capture interaction follows the work-flow media step: camera,
gallery, and **audio note** are one-tap from the fixed action bar; link and
written note are additional kinds; multiple items compose into a visible list
before submitting, and each item still enqueues one evidence object with its
immutable `creditedContributors` vector. The roster-chip contributor picker is
unchanged. Audio serializes like work-flow audio notes (`SerializedFileData`).

**§5.7 work-first linkage (2026-08-11, D6).** The Submit Work flow itself
carries an optional **"Fulfills a promise"** field on the details step — a
picker over the gardener's Accepted/Active DomainImpact commitments in the
selected garden (prefilled and locked when the flow was deep-linked from a
commitment; pickable when the gardener started from the Garden tab). Selection
writes the same `meta.commitmentId` + dependent `workLink` path; the review
step keeps the locked read-only "fulfills: {commitment title}" row. The "Link
existing work" picker on commitment detail is a **client** surface listing the
gardener's approved/pending works with an exact requirement-row choice — never
an admin screen.

**§5.8 Things I can offer panel section (2026-08-11, D8a — realizes Appendix
F.2 item 1).** The private saved-details list and the gardener's ongoing Offers
(with rest / resume / retire entry) render as a section of the WalletDrawer
Commitments panel — this is the drawn entry for W32. The pool tab shows only
the public life of ongoing Offers (place cards with the "Ongoing" chip, §5.2
addendum above).

**Appendix E.1 exchange entry + pair CTA chrome (2026-08-11, D2/D7).** The
exchange row lives on composer step 2 as a labeled detour; the pair-detail
primary action ("Start both promises…") renders in the fixed bottom action bar,
never inline in scroll content; the "Exchange circle" template routes into the
same detour.

**Appendix F.2 ongoing path folded into the composer (2026-08-11, D2/D8a).**
F.2 item 2's separate ongoing wizard is retired: garden and terms are the
composer's existing fields, "Offer over time" is the composer's How-often
choice, and the series + first places submit as one ordered queue sequence.
F.2 item 1's "Things I can offer" is realized as the WalletDrawer section
(§5.8 addendum above). W33 as a separate wizard screen retires with it.

**Iteration 2 (2026-08-11 evening, register #102 — Afo's artifact review;
supersedes parts of the same-day addenda above).** (a) Wizard chrome mirrors
the shipping Submit Work exactly: the real `FormProgress` numbered-step
stepper in the top nav, close on step 1 and BACK on later steps, one-row
fixed bar. (b) The kind choice renders as equal 2-up tappable cards, and
choice rows are equal-height. (c) Ongoing is an INLINE expansion of the
composer's amount step — places-to-start and scope appear under the How-often
choice, and the review gains a Places section; no ongoing detour screens
exist. (d) **Exchange is parked**: the §5.4/E.1 composer detour and the
template-picker exchange row are withdrawn from the client; W28–W30 remain
Screen-library reference until exchange gets its own design session. (e)
**"Request" is the single asking word** — entry "Make a request", chapter
"Requests" — refining the D3 rule ("ask" leaves product copy). (f) Stewards
declare G$ support in a real wizard step ("Support", after How much; the
progress count grows only for stewards) using existing declared-consideration
semantics; the review repeats it in its own section and the promise detail
carries a support row. (g) Evidence (§5.5) is a full MDR variant — Media →
Details (contributor chips + note/link) → Review — with a tap-to-add capture
area, replacing the single-sheet composer. (h) The promise detail (§5.3)
carries the E5 anatomy: creator→counterparty avatars and the team strip above
the fold, and its ONE contextual primary action in a fixed bottom bar. (i)
The confirmation walk ends once on the promise — no duplicate full-screen
kept moment, no editorial echo inside the member flow. (j) The team surface
is entered through the promise detail, and the lead's add-people act is a
first-class walk.

**§5.1/§5.2/§5.8 pool-tab polish (2026-08-14 — Afo's prototype review).**
(a) **Pool leads the GardenTab row** and is the garden-detail landing whenever
the pool exists; §4.1 NotReady is unchanged (tab absent, Work leads). §5.1's
"net-new fourth GardenTab" reads as "net-new GardenTab, first in order".
(b) §5.2 item 2's Season card + Campaigns list render as **one horizontal
snap rail**: the Season slide first and wider, campaign slides after with a
peek of the next. Presentation only — slides open their cycle, and the item-2
scope select still owns list scoping, so swiping never silently refilters.
(c) §5.2 item 3's chip set becomes **All / Offers / Requests plus a
right-aligned Mine toggle** (personal scope is orthogonal to direction). The
exchange-pair filter (formerly "Matched") leaves the row until the exchange
wave ships; paired cards keep their "In exchange" chip meanwhile.
(d) The two persistent creation CTAs leave the browse header for **one
floating create entry above the AppBar** (shared `FabButton`, the admin
mobile precedent) that opens the two one-word doors (D3) over a scrim;
direction stays fixed by the door. The empty-pool state keeps its big inline
CTAs and draws no floating entry.
(e) Browse cards carry a **direction edge** — a 3px inset stripe, green for
offers, sky for requests — beside the existing chips; status/claim panels
stay neutral.
(f) §5.8: the Commitments tab **draws its promised count badge** (item 2's
cookie-jar pattern), counting the attention inbox so it reads from any drawer
tab; and the pending-confirmations inbox widens into an **attention inbox**
that also surfaces the member's newly accepted asks. Queued/failed sends keep
their item-4 chrome at the top of their own group.

**§5.2/§5.8 second pass (2026-08-14 evening — Afo's card review).**
(g) **Card grammar = the shipping WorkCard grammar**: the whole browse card is
tappable and opens the promise detail; the footer button exists **only** for a
claim act available from browse ("Take this up" / "I can help" / "Ask to take
this up" / "Ask to fund this" — register #19 stays satisfied). Navigation-only
buttons ("Open promise", "See open places", "Review confirmation") are
retired; those cards are plain tappable cards and the act lives in detail.
This refines D5's "exactly one context action": the footer carries one claim
act or nothing; plain reason lines stay. *(The pre-claim browse casts landed
the same day — third-pass item (e) — including the steward-reviewed variant
`W2@browse-requested-gated` from the PR #710 review, so card-taps open true
pre-claim details in every claim mode.)*
(h) **Domains leave the top chip row for their own equal-weight domain row**
(all involved domains listed, none privileged as primary — a promise pairing
AGRO with EDU is both). The row renders `DomainBadge` per domain, wraps at
four worst-case, and its absence marks an evidence-only service promise; every
service promise consistently carries the "Support / service" kind chip
(fixing plain request cards that showed no kind). The top chip row keeps
direction + lifecycle chips only.
(i) §5.8: **failed sends are actionable from the wallet** — the Commitments
tab surfaces exhausted sends with the same retry/discard contract as the pool
tab (§5.12), so recovery does not require finding the right garden first. A
wallet creation entry was considered and **rejected**: creation stays
garden-scoped; the wallet remains ledger + inbox + reusable-assets.

**§5.2 third pass (2026-08-14 night — card-studies picks).** Cycle cards adopt
the **chips-lead layout** (option B of the Pool Card Studies artifact):
[Season] / [Campaign] + stage chips lead the card, title → calm date → counts
stack on one left axis, and nothing floats right — campaign counts read
"6 of 16 kept" in the stack, not as a trailing chip. The same layout carries
the campaign detail headers and cancelled-cycle cards. Promise-card anatomy is
confirmed as **chips-lead (P1)** per the master anatomy rows ①–⑧;
queued/waiting/failed casts additionally drop the self by-line (your own send
needs no "by you"). Kicker-lead and person-lead anatomies were explored and
not chosen; the studies artifact records them. **Mode-helper trim** (amends
item 3's "mode is visible on the card as helper text"): the claim mode now
reads from the act's own label — "Take this up" / "I can help" are open,
"Ask to take this up" / "Ask to fund this" are steward-reviewed — and the
separate mode helper line leaves browse cards; the request lifecycle panels
(§4.4) keep their fuller review copy.

**§5.4/§5.7 workflows round (2026-08-14 late — Afo's workflow review).**
(a) **Step 3 is the protection step**, named as doctrine: a service ask spends
it choosing who can take it up (claim time is its only gate), a garden-work
ask spends it naming required proof rows (the Work-approval rails are its
gate) — both ask paths stay four steps and the dots never grow mid-flow.
(b) **Garden-work asks gain a gardener-set claim mode in the Advanced
detour** (`W3@advanced-work-ask`, default open) — amending step 1's "claim
mode keeps the context default — not a gardener-facing control" for work asks
only; service asks keep their step-3 choice, and steward seeding (§6.3)
retains fuller control. The work-ask review's Who-confirms section summarizes
the choice.
(c) §5.7 **promise-first entry scopes the intro**: a fulfilling strip names
the promise and its still-needed rows, the intro's action grid shows only the
promise's requirement actions (pre-chosen when there is one), and the garden
is the promise's. Media → details → review are untouched; the commitment
context remains pure metadata.
(d) §5.7 **standing attribution** *(supersedes the same-evening reactive tie
suggestion — Afo: promise context must never feel like a popup)*. Principle:
promise context is **standing furniture keyed to who the member is, never an
event keyed to what they just tapped** — present from first paint when it
applies, absent entirely when it does not. Three layers:
(d0) *policy (locked 2026-08-14)*: **work never requires a commitment** —
free + led + recoverable. Free-standing work is the architectural substrate:
`linkWork` (ProofLib.sol) attaches any existing non-revoked same-garden work
by an active contributor to an Accepted, unfrozen commitment — at its exact
requirement row for DomainImpact (evidence-only kinds carry no requirement
rows and ignore that argument), one commitment per work. Approvals reconcile
in either order, with the precision that a Work decision landing **before**
linkage is not retained by the resolver hook and is caught up by steward
`syncWorkDecisions` (contract-spec register #5). Late attachment is
first-class, pools stay optional per garden, and a mandatory tie was
considered and rejected.
(d1) *flow entrance*: a promise-holder's Submit Work intro **opens with a
"Work toward a promise" rail** — compact promise cards riding the same
horizontal card-rail grammar as the intro's action and garden rails (nearest
due first, pool-tab direction edges), so holding many promises costs swipes,
never vertical space. Tapping a card enters the scoped promise-first intro;
"or choose plain garden work below" keeps the shipping sections untouched.
Members without promises see the shipping intro byte-identical. The
details-step fulfills picker stays the mid-flow catch-all.
(d2) *ambient*: §5.8's attention inbox gains **"your promise needs work"
rows** ("1 of 2 Prune approved · add work"), counted in the Commitments
badge — the cross-garden leading indicator.
(d3) *recovery*: the promise detail's work section shows a **standing
not-yet-linked row** whenever the member has approved work matching a
requirement row ("Approved · Jul 8 — not yet linked · Link it"), feeding the
existing exact-row link picker — missed attribution is recoverable, never
silently lost.
Motivation: unattributed work stalls a kept-in-reality promise toward expiry
and undercounts the pool story.
(e) §5.3 **pre-claim browse casts**: the commitment detail gains
`W2@browse-offered` and `W2@browse-requested` — the detail as a would-be
claimant sees it before anyone has taken the promise up. Only the creator sits
on the people row, and the fixed bottom bar carries the one claim act ("Take
this up" / "I can help"), mirroring the card button. Browse card-taps land
here, completing the card grammar.
(f) **Domain-row propagation**: the detail header and the composer reviews'
Proof sections carry the §5.2 equal-weight domain row; the amber domain chip
retires from W2's chip row (the chip row keeps direction + state).

**§6.2/§6.3/§6.5/§6.6/§6.9/§6.10 admin console round (2026-08-16 — Afo's
prototype review, four decisions aligned in session).**
(a) **Admin action placement follows the shipping console contract**: view
actions live in the page header's right-aligned action row (one fixed primary
rightmost — Seed on the pool tab); consequential acts open `AdminDialog`;
below 1024px the same `ViewAction` set rides the `FabButton` speed dial and
dialogs present as bottom sheets below 620px. Prototypes must not embed
view-level actions in tab content; per-row acts keep the row anatomy (who ·
what · state · one primary act).
(b) **Two doors replace steward-visible "Open cycle" / "Seed a cycle"
vocabulary**: header actions **"Start a season"** ("the pool's main rhythm —
one at a time") and **"Start a campaign"** ("a focused push — any number may
run beside the season"), the same `seedCycle` → allocation → open flow with
the cycle type preselected. "Cycle" remains umbrella vocabulary for docs and
the glossary only. The season door renders only while no Season is open —
teaching the one-open-Season invariant by construction.
(c) **Pool lifecycle demotes to a settings-style dialog** ("Pool settings",
a header action): the pool tab itself leads with triage, then the Season
slot and its **peer** Campaign rows (never a disclosure nested under the
Season — the §5.2 snap-rail decision's admin analog), then the commitment
list.
(d) **Season↔campaign attribution stays exclusive** (a commitment binds to
one cycle); the season's story includes overlapping campaigns as a
**time-window roll-up at the reporting layer only**, clearly labeled. No
contract change; Decision Log #11/#32 stand.
(e) **Assessments present timing-first**: the capture form asks "For
[season / campaign cycle / this garden overall]" and "at the start / at the
close"; the wire kind (Baseline / Delta) and the `baselineUID` comparison
pointer **derive** underneath (first measurement per garden+domain →
Baseline; later → Delta with the pointer auto-picked), and the existing
`cycleId` field is populated and read. Authorship still rides on the derived
kind (Decision 8); the schema is untouched. "Baseline / re-assessment"
leaves steward-facing surfaces except as derived fine print.
(f) **Flow-dialog rail stability is a validator rule**: a flow's step rail is
declared once and never changes mid-flow (detours render inside their step);
the close-season wizard joins the flow-dialog shell (it was the lone
full-page wizard), and the end-season journey splits at its act seams (end
the season / close-and-compost the pool / cancel a season).
(g) **Prototype echo rule**: admin journeys interleave a client frame only
where the admin act's meaning completes on the member surface (device-free
capture and confirmation, dispute recovery, claim decline). Lifecycle
confirmations link the member view as a branch instead of walking it.
(h) **Steward-fallback capture is labeled as the steward's own act**: the
analog-capture third kind reads "a confirmation of their promise — recorded
as your own steward fallback", routes into the standard fallback dialog, and
the capture review names who the record names (source / recorded by /
confirmer). The member picker's empty state says plainly that capture needs
membership first — a phone never. The address-less-member gap is logged as a
contract-spec §12 open question.

**§6 admin round 2 (2026-08-16 late — Afo's second review + the canonical
admin UX brief; Decision Log #67).** The design skill gained
`admin-ux-brief.md` (NN/g · GOV.UK · USWDS · Laws of UX · web.dev responsive
· Refactoring UI, applied not copied) and `interaction-patterns.md` (the
codified admin contract, every rule cited to shipped code); review-checklist
Lens 5 makes the contract a mandatory pass on every admin design round.
Amendments over round 1:
(i) **The Garden view header carries the SHIPPED stable trio on every tab and
state** — View public (ghost) · Seed (secondary; disabled when the pool
can't take a promise) · Edit garden (primary) — availability by disabling,
never by removing (garden.utils.ts ignores the active tab). Round 1's
state-dependent header doors are superseded.
(j) **The pool tab is a two-column split**: left column = triage summary, the
Season and its peer Campaign rows, the promise list (row anatomy: who · what
· state chips · calm meta · one trailing act — state in chips, banners teach
once); right rail = the "Pool — the container" card (status, charter,
lifecycle; destructive close separated), Quick actions (the two cycle
doors), and the activity feed. Collapses to one column narrow. The pool
STAYS a visible container with its lifecycle managed on its card — clearly
separated from the cycles, never dissolved (decision 3).
(k) **One flow, one shell**: "Start a season / Start a campaign" is a single
three-step flow dialog (Details → Allocation → Open) with seedCycle on the
details advance; round 1's small-details-dialog→wizard hop is retired, and
the capture flow's fallback confirmation completes inside the capture shell.
Journey entries tightened to true console homes (W8/W9/W10/W14 out of the
allowed entry set; every flow shows the surface and control that opened it).
(l) **The seeding console is the client composer's cast** (What → How much →
Proof & confirmation with the declared reward as its Advanced detour →
sectioned Review) — same steps as the PWA, denser fields.
(m) **The protocol pool wears the garden pool's anatomy** — same two-column
split scoped to the protocol garden; protocol seeding is a dialog, never an
in-content form card.
(n) **Assessments stay Hub/evaluator-side for v1** (decision 4): the
attach-an-assessment steward journey is retired; the per-promise gate's
state stays in the Screen library for on-chain coverage only.
(o) **Component parity**: the artifact's Components tab lists the shipped
admin palette 1:1 (shipping names lead titles, `packages/…` citations
attached); prototypes compose only from that inventory.

**§6.2/§6.10 first-run setup (2026-08-16 round 3 — Afo: "ready the pool and
open a season is still convoluted").** Getting a garden to its first season is
**one flow, four steps, one write moment** — not four console acts in
state-machine vocabulary. The pool's on-chain readiness sequence
(`setPoolCharter` → `setProviderOpenCommitmentCap` → `markPoolReady` →
`seedCycle` → `openPool` → `openCycle`) is submitted in order by the flow's
final step; the steward never performs, names, or waits on an intermediate
pool state. Retired from steward-facing surfaces: "Edit readiness", "Mark pool
ready", "Open pool" as a separate act, "readiness checklist", "preflight",
"charter", "provider open-commitment cap", "qualifying baseline", and the
NotReady/Ready state names.
Their replacements: the tab reads **"This garden isn't taking promises yet"**
with ONE primary, **"Set up promises"**; the flow's steps are **How it works ·
The season · The split · Open**; the pool card states **Not taking promises
yet / Taking promises / Set up — no season yet / Paused**; the agreement is
**"What this pool is for"**, the cap is **"How many promises one person can
hold at once"** defaulted to 24 behind Advanced, and the baseline is **"the
garden's starting assessment"**. A missing starting assessment is named on
step one with its route out, never discovered at submit (error prevention
before error messaging). Nothing is recorded until the last step, and its
banner says in plain words what opens. Subsequent seasons use the shorter
three-step flow (The season · The split · Open), which is a separate flow with
its own stable rail.

This appendix supersedes every singular-provider, max-four requirement, and single-beneficiary
placement in §§5–6 while preserving their route and component anchors.

### C.1 One lead, many contributors

- Every commitment shows three separate rows when relevant: **Accountable lead**,
  **Contributors**, and **Confirmation**. Never collapse these into “provider.”
- Solo is presented as “You are leading this promise” with one contributor. Team mode adds an
  explicit roster without making the lead less accountable.
- Contributor policy is chosen during creation/seeding: **Open team** (eligible gardeners
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
  frozen on-chain credits and policy for contributor shape. A Garden-claimed Request instead shows
  one immutable “Garden receives” row with the external garden and registered Celo Safe; it has no
  contributor comparison editor. Contributor tables have Contributor, Recognition, Payment,
  Amount, and Status columns.
- A steward may atomically replace the complete amount vector while the plan is Draft. Payment
  weights derive from those amounts with deterministic rounding; no control accepts an
  independently authored payment weight. The canonical full-consideration base-unit allocation is
  labeled “Matches recognition (token rounding)” and requires no reason; every noncanonical amount
  or retention divergence requires a reason shown to the contributor. The screen always says
  recognition is not being rewritten.
- `gardenRetainedAmount` is an explicit field only on garden-internal contributor plans. The
  invariant is “Declared support = kept in the garden + sent to contributors.” Cross-garden plans
  force it to zero. Garden-beneficiary shape instead says “Declared support = sent to {garden}”
  and never presents retention or a fake self-transfer.
- W21 shows funding readiness separately from payout-plan readiness. ProtocolToGarden top-up is a
  treasury flow; it does not choose contributors or silently mark their payouts complete. W24 is
  the explicit authority-gated form; after submission W21 shows the emitted Queued Funding row
  with no commitment identity. The queue never fabricates a local Draft funding entity.
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
- Garden-beneficiary setup has no edit step: creation freezes the active external Safe and full
  amount, finalization rechecks both payer and beneficiary accounts, and preparation remains
  available even when gardener delivery is disabled. It cannot show Complete until its child is
  Confirmed.
- W22 groups child disbursements by payout plan, supports measured multi-batch teams, and preserves
  per-child retry/cancel outcomes for contributor and beneficiary kinds. The parent status is
  derived and has no retry button of its own. Child and batch cancellation never clear or replace
  the stable parent or beneficiary/contributor child pointer.
- W23 shows each contributor only their receipt plus the transparent plan summary: their
  recognition weight, payment weight, amount, garden-retained amount, and partial/complete state.
  The recipient is their same-address counterfactual smart account on Celo (plan register #16).
  Receipt and Send controls are gated by `gardenerDeliveryEnabled`, which flips only after the
  recorded Celo AA/paymaster exit evidence and Kernel-version proof in `settlement-spec.md`
  Appendix A. If that spike fails, ProtocolToGarden remains available while member delivery stays blocked.
- `gardenerDeliveryEnabled == false` blocks only first preparation of a non-zero contributor child
  and gardener sends. The fulfilled commitment, provider-garden payout plan, retention, unprepared
  rows, and any historical child states remain visible; no retry appears for an unprepared row.
  ProtocolToGarden funding remains independently available because it is treasury funding, not a
  Garden-beneficiary consideration bypass.

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

### C.6 The pool's contents, its opening, and who is in it (2026-08-16, round 7)

Source-model coherence pass against Will Ruddick / Grassroots Economics' Chama pools. The values
translated; the central object did not. Four additions, all inside locked decisions — no decision
above is superseded.

**1. What the pool holds (`W7` rail, `W12` both scopes, `W1` top).** Every pool surface described
how the pool was *configured* — charter, provider cap, Baseline assessment — and none described
what was *in* it, so neither a steward nor a member could answer "what can our pool actually do
right now?". A holdings block now leads each pool surface in two parts: **what we can do for each
other** (exact-label unit groups off `CommitmentUnitSummary`) and **what's in the reserve** (the
settlement side, D.5's framing).

Unit groups are **never summed and never converted**. D.1 bans cross-basis aggregation, and the
`CommitmentUnitSummary` identity is keccak256 of the stored UTF-8 `unitLabel` bytes, so "hours"
and "Hours" stay separate rows by construction. The source model's single-figure ring is a
price-like abstraction this system deliberately does not have; rendering the groups is the honest
form of it. The phone variant keeps every unit group and demotes the reserve to one line — at
375px the full block filled the entire first screen and pushed every promise below the fold. A
reserve reading zero renders calm: a pool whose members can do a great deal for each other while
holding no money is the normal case, not a broken one.

Two cross-basis sums were removed on the way: `W12`'s "18 units promised" added hours to rides,
and W1's `@ready` card was titled "What this pool holds" while listing the charter and the
assessment.

**2. Opening is the event, not seeding.** The source model's founding ritual is a collective
seeding day. In this system that moment cannot sit where it first appears to: `createCommitment`
rejects any cycle that is not `Open` (`CreationChecksLib.sol:72`), and `cancelCycle`'s zero-live
guard assumes the same, so **a Seeded cycle holds no promises at all** — not the steward's, not a
member's. The pool fills the instant the season opens.

So `W7` gains the Seeded state it never had (prepared season, honest empty holdings, one act:
**Open to the Garden**), the `W11` final step leads with what opening means for the garden rather
than with the allocation percentages it commits, and `W1@seeded` stops promising a preview of
promises that cannot exist and instead tells a member when it starts and invites them to decide
what to bring. Discarding the start flow after step 1 now lands on that Seeded season rather than
on a running pool — step 1 calls `seedCycle`, so the season is real. Admin gets a quiet activity
row ("Ana offered 4 hours of weeding"), which is what the feed was missing; hero moments stay
client-only (register #27).

**3. Who's in this pool (`W7` list, `W1` list).** The entire member-facing relational surface was
one D.3 history line inside the steward claims queue, which answered neither "who else offers what
I need" nor "who have I given to and received from". Both surfaces now carry a roster: the people
and what each currently offers. D.3 and decision #21 bind unchanged and the two surfaces differ
because of them — the steward's rows carry the give-and-take counts, the member's list shows only
what neighbours offer plus the signed-in member's own counts. Counts never percentages, no grade,
no rank, no comparison, no cross-pool merge; `promiseKeptRate` stays pool-level. Deliberately a
list, not a network graph: the graph is the source author's medium, and a list answers the same
question without decoration. The roster names how many members it is not showing, so four rows
never read as a 23-gardener pool.

**4. Frames, not states.** `W2` carries 75 states, `W1` 33, `W7` 31, and the prototype drew them
as one flat row of chips — which is what made the surface feel unholdable. They are one promise
lifecycle replayed across six kinds of promise, one setup ladder a pool climbs once, and a row of
confirmations. States are now grouped by **frame**: 75 → 11, 33 → 9, 31 → 8. Presentations merge;
**the ledger does not move** — every state keeps its entry, §17 coverage still accounts for all of
them, and each screen's default state is unchanged. The `support-` prefix was found to cover two
unrelated things (a service offer's lifecycle and the G$ transport chain); the grouping uses
explicit sets rather than the prefix, and the collision is recorded here as a naming defect rather
than worked around silently. Three member-visible lines that named the paying Celo account now
read "the pool's reserve" per D.5.

### C.8 Read surfaces are sections, and text has limits (2026-08-16, round 10)

**Sections, not drawers.** The promise detail (§5.3) opened with five closed disclosures — Timeline,
People, Evidence, Work, Details — so nothing about a promise was legible without tapping. The
shipped work view never does this: `WorkView.tsx:78` renders `FormInfo`, then `<h6>` + content,
open, section after section. The promise view now follows it exactly: a quiet label on the canvas
with its content in a card beneath, for Garden · Media · Details · Support · Work · People. Only
Timeline stays folded — long, secondary, read once — and it is a card now rather than a bare
disclosure. Evidence renders as real media tiles instead of text rows carrying an image icon.

**The status card is `FormInfo`, and it does not carry the title.** `WorkViewSection.getTitle()`
returns "Saved on your device", "Evaluate Work", "Work Approved" — the record's *state* and what it
means, never its name. The promise's name is the screen header (`hdr`, with the back control) and
is not repeated. The amount line left the header when Details gained its Amount row; saying it in
both was the clearest symptom of a screen carrying a header and a drawer for the same facts.

**Text limits (net-new — none existed).** `title` is not in `CreateCommitmentParams`; it lives in
the metadata JSON, so no contract bound applies. `unitLabel` **is** an on-chain `string` with no
length guard. Nothing in this spec, and no `maxLength` in the shipping client, bounded either.
Adopted: **title 60 characters, unit label 24, note 280**, enforced at the client composer and the
admin seeding form. Measured against the promise card, a title ellipsises at roughly 34 characters,
so 60 leaves room for a real sentence while degrading predictably.

The `unitLabel` bound is app-side only and therefore **incomplete**: a direct contract call can
still store an arbitrarily long label, which the indexer keys a `CommitmentUnitSummary` row on and
every holdings block renders. Gas makes it self-limiting in practice. A real bound requires a
contract-side check and is raised here as a proposal, not an assumed change.

**Where else the same treatment applied.** Measured by disclosures per state across every screen,
not chosen by eye. `W36` (member-funded claim) was the worst in the prototype at **1.00** — all
seven states hid the garden Safe, refund account, funding record and promise reference behind a
"Funding details" drawer, which is the last place money identifiers belong; it is now a status card
plus Details and Funding record sections. `W5` (wallet commitments) hid the member's entire
cross-garden ledger behind "My commitments · 3 across 2 gardens" while the attention inbox above it
sat open — and the two overlapped, listing the same promises twice, which the drawer concealed. It
is now one ledger grouped by garden with **scope filters** (All · Waiting on you · Active · Kept),
so each promise appears exactly once and "waiting on you" is a filter rather than a second copy.

Deliberately left folded: `W22`'s route datasheet (its own note records why — every state used to
open with four rows of route data above the answer), `W1`'s secondary browse affordance, and the
Advanced detours inside the `W8`/`W11` wizards, which are the flow pattern working as intended.

### C.9 Every flow step opens the same way; sheets are bounded (2026-08-16, round 11)

**One step grammar.** Each step of the shipped Submit Work flow opens with a `FormInfo` card naming
the step and why it exists — `formInfo("camera-line", "Upload Media", "Photos, video, or a voice
note")`. The creation, evidence and confirmation flows opened with a bare `sectionTitle` instead:
the same job in two grammars, across 70 states. Measured before the change, `FormInfo` appeared
**11 times in WFLOW and zero times in W3 (32 states), W2a (9) and W4 (29)**.

All three now carry it, derived from the step *kind* rather than enumerated per state — the way
WFLOW writes one card per step and reuses it across casts. States that are not steps (draft resume,
validation, queued outcomes) get none: they carry their own banner and would otherwise say the same
thing twice.

**The confirmation sheet joins through its header, not a card.** `W4` is a sheet and already owns a
title, so a `FormInfo` card inside it would state the title twice. `sheetOver` instead takes an
optional icon and info line and renders its header in FormInfo's anatomy — badge, title, meaning.
A sheet joins the flow grammar without repeating itself.

**Sheets are bounded and scroll.** `.sheet` had no `max-height` and no overflow, so it was
content-sized (never a consistent height) and long content grew past the top of the frame with no
way to reach it. Worse, `.sh-body` is a column flex container, so its children were **compressed**
rather than overflowing — the wallet's natural 965px of content was being squashed into 634px, not
merely clipped. Fixed with `flex: 0 0 auto` on the children, a `max-height`, and a scrolling body
with the handle and title pinned.

The two shells now size differently, matching what they are: a **tabbed drawer** (`ModalDrawer` /
`WalletDrawer`, no handle) is a fixed 88% panel, because moving between its tabs must not resize the
surface under the reader's thumb; a **gesture sheet** (`PwaSheet`, with the handle) stays
content-sized under the same ceiling.

**Recovery-state parity (round 12).** `W36` was the only client read surface without loading /
not-found / read-error, while `W1`, `W2`, `W5`, `W28`, `W32` and `W34` all carried the three — so a
member opening a funding claim on a bad connection got a blank page. It now carries them in the
promise view's shape (skeleton; `search-line` not-found; `wifi-off-line` read-error), with copy that
says what a funder needs to hear: nothing has moved, and the deposit and refund account are
unaffected.

**`W34` detail cards (round 12).** The Ongoing Offer detail carried 22 bare cards holding nothing
but `kv` stacks — the same shape the promise view replaced. They are Details sections now, plus one
status message moved to a `FormInfo` card. `W32` was reviewed and deliberately left alone: it is a
sheet of rows, not a read surface, it already carries its three recovery states, and its single card
holds content rather than hidden detail.

### C.10 Creation runs Submit Work's four beats (2026-08-16, round 12)

Round 11 gave every flow step the same opening card. This round gives creation the same *shape* as
the flow it borrows that card from. `W3` now runs **What · How much · Details · Review** on every
path — the beats of `views/Garden/` — and three structural moves get it there.

**1. Scope stops wandering.** One promise names one cycle, but the control that named it moved
between paths: `field("Season")` on step 1 for garden work, `field("Campaign")` on step 2 for a
service, `field("Scope")` on step 2 for an ongoing offer. One thing, three names, two locations —
which is what "we have people select season and then campaign in another view" describes. It is now
one step-1 field on every path, labelled **Where it runs**, with the copy saying what is true: this
pool runs a season *and* campaigns, both hold promises, and the choice is real rather than a bound
value dressed as a select.

**2. The protection step folds into step 2.** Step 3 was the protection slot expressed differently
per path — action requirements for garden work (`step-anchors`, `request-anchors`), who-can-take-it
for a service ask (`request-variant`, `request-variant-steward`). Both answer step 2's question:
*on what terms is this kept?* All four states are retired and their content sits under the amount.
Step 2 for a garden-work offer runs 842px against a 659px viewport — one thumb-scroll, which the
step scrolls exactly as the phone does.

**3. Details becomes a numbered step.** It was an unnumbered detour reached from a row on step 1,
drawn with `w3Head(…, 0)` — so the progress bar highlighted **step 1** while you were on it, the
flow never promised the step, and it was easy to miss that evidence was possible at all. It is step
3 of four now, drawn per path (`step-details`, `support-details`, `support-details-ongoing`,
`request-details`, `request-details-steward`, `request-work-details`) because each continues to its
own review, from one shared body that is the shipped media step verbatim: the dashed tap-to-add
surface, the item list, the link/note adders, the camera / gallery / mic bar.

**How often moved to step 1.** As a field at the bottom of step 2, the once-or-ongoing fork was
discovered only after everything had been filled in for a one-off. It sits beside the kind cards as
tap-first chips — both are shape questions.

**Review follows `views/Garden/Review.tsx` literally.** The shipped review is `FormInfo` over
**one flat card of rows**, with a single hot row where there is somewhere else to go (its "Fulfills
a promise" line). Creation drew **four separate cards**, each with a header row and a ghost `Edit`
button — a different component. All six reviews now draw the shipped anatomy, the thirteen
`w3.edit-*` links are retired, and **the back arrow is the edit path**. The one interactive row is
the Advanced detour, mirroring `wflow.fulfills` exactly.

**What step 1 lost.** Seven blocks became three. The `Note` field moved into the details step —
there were two places to write a note. The *Start from a template* row became the tail chip of the
title suggestions: chips and the template picker were two mechanisms for one intent, and the row
made the first screen heavier for it. `W31` keeps its inbound link from that chip.

**RESOLVED 2026-08-17 (Afo): they are two different questions, so they say so.** Both
figures are real on chain and neither derives from the other — `unitLabel`/`targetUnits` is
what the member puts in and is what the pool counts in its holdings; the requirement rows
are what stewards must approve before it counts as kept. The fix is therefore naming, not
structure: step 2's amount says it is "what you are putting in, and what the pool counts in
its hours", the rows are titled **"What has to be approved"** and say outright that they are
a different measure from the amount above, and the review carries both under labels that
distinguish them. The progress block already separated them structurally — bars gate, no
bar credits (C.20) — so the copy now matches the layout. Original framing follows.

**The question as first posed.** A garden-work promise is quantified twice — `6 hours` on step 2 *and*
`Prune × 2 · Plant × 12` beneath it. Both are real on chain (`unitLabel`/`amount` and the
requirement rows are separate fields), but a member is measuring one promise in two incommensurable
ways, and folding proof into step 2 puts them side by side where the redundancy is visible. This is
a spec question, not prototype polish; it is raised here and not acted on.

### C.11 "Things I can offer" splits by what its halves are (2026-08-16, round 12)

The wallet's Commitments tab held four section cards: three gardens and *Things I can offer*. That
fourth section was a category error — the three above it are places, it is a personal noun-phrase —
and it held a single nav row where every other section holds content. It also sat outside the scope
chips' jurisdiction (*All · Waiting on you · Active · Kept* filter promises; saved details are not
promises), and it merged two unlike things behind one row reading "1 saved · 1 ongoing":

- a **private saved draft** — nothing on chain, invisible to anyone, not a promise;
- an **ongoing Offer** — `createCommitmentSeries`, with live places in a real pool.

They split by what they are. The draft is a tool, so it is a quiet row **above** the ledger. The
ongoing Offer has a garden, so its **parent card stands in that garden's section** like everything
else, tagged `Ongoing` and counting places (one basis — never a unit sum, Appendix D.1). Its places
stay public on the pool tab; the parent is what only the member rests, resumes or retires, which is
why the wallet holds it. `W32` remains the drawn destination for the private half, and its §5.8
claim to be "a section of your wallet's Commitments tab" stays true.

### C.12 Three wizards, one grammar (2026-08-17, round 13)

The client has exactly **three** wizards. Everything else a member does is a tap
or a read. Naming them settles the recurring "how many steps should this be"
question, because the answer is a property of the wizard, not of the flow.

| Wizard | Steps | Flows it serves |
|---|---|---|
| `WFLOW` — work submission (shipped) | Intro · Media · Details · Review | prove it with work |
| `W3` — creation | What · How much · Details · Review | make an offer · offer a service · make an ongoing offer · make a request · request garden work |
| `W2a` — evidence | Media · Details · Review | provide a service with evidence · help with what was requested |

**Creation is four steps on every path, with no exception left.** The steward's
ask was the last one at five: declaring G$ support had its own step. Support is a
term the ask is kept on, exactly like who-can-take-it beside it, so it folds into
step 2 and `request-support` retires. A steward's ask now runs the same four
beats as a gardener's; the difference is the content of step 2, not its shape.

**Evidence is three steps, and that is correct, not a shortfall.** Work
submission's step 1 exists to pick an action and a garden. Evidence is entered
from a promise that already fixed both, so a step 1 there would confirm a choice
already made. Padding it to four to match a number would be worse than the
asymmetry.

What evidence owed was the **grammar**, not the step count, and this round pays it:

- Its review drew **three carded sections** with their own headers — the anatomy
  retired from creation's six reviews in C.10 — and named no subject, so nothing
  on screen said which promise the evidence belonged to. It is now one flat card
  led by the promise, the shipped `views/Garden/Review.tsx` shape.
- **Note and link stopped being form fields.** They were two inputs on step 2
  while photos and voice notes were a list on step 1, so the same act had two
  shapes depending on what you attached. They are items in the step-1 list now,
  added by the same adders creation uses: everything attached composes into ONE
  set.
- That leaves step 2 asking a single question, so it is **named for it** — "Who
  helped" rather than "Evidence details".
- The **queued and failed outcomes** stopped rendering the review step's progress
  bar. They are outcomes, not steps; a progress bar on a screen you cannot
  advance from is a false promise.
- The capture step gained the **offline banner** its two siblings carry.

Creation and evidence now share one `captureBody` and one `captureBar`; the
shared body is why the adders and the banner arrived together.

**RESOLVED 2026-08-17 (Afo): keep two acts, make the pending one unmissable.** The
asymmetry is structural, not sloppy — garden work has stewards whose approvals flip the
state, a service has no approver, so somebody must declare it done. Two things closed the
risk rather than a structural change: `Send for confirmation` now opens a confirmation
step naming the roster freeze it causes (C.21), and the evidence-attached states say
plainly whose move it is — *"Not sent yet — this is waiting on you. Your evidence is
attached, but João cannot confirm until you send it."* A provider can no longer attach
evidence and believe they are finished. Original framing follows.

**The question as first posed.** Proving with work ends in
one act (`Submit work`); proving a service ends in two — `Attach evidence`, then
`Send for confirmation` from the promise's bar. The cause is real: work has
steward approvals to advance it, and a service has no approver, so the provider
must declare it done. Whether that declaration should be the default outcome of
the evidence wizard or stay its own decision is undecided, and nothing here
presumes an answer.

### C.13 The record is a Commitment (2026-08-17, AMENDS §3)

**This supersedes §3's "Promise names the record" for every surface.** §3 (2026-08-11,
correction pass D3) chose "promise" as the community-facing name for the record and
"commitment" as the technical one. The canonical glossary says the opposite:

> **Commitment** | entity | audiences: **admin · client · community · docs** |
> *"A module-native promise record (offer or request) with one accountable lead, an
> optional contributor roster…"*

`Commitment` is the entity name, addressed to the client among its four audiences;
"promise" survives there only as the plain-language gloss inside the definition. §3
introduced a second name for the same thing on the surface that most needed the first
one, in a feature called commitment pooling. This corrects that drift rather than
overturning a considered call: **the record is a Commitment everywhere.**

**What did NOT change.** §3's other half stands unamended: the *acts* are direction
verbs — "Offer support", "Ask for help", "Make this offer", "Ask for this help". No
creation surface may read "Create a commitment" any more than it could read "Create a
promise". None of those strings contain the swept word.

**The verb is "commit", not "commitment".** Three rendered strings had used "promise"
as a verb and needed the verb form, not the noun: "nobody can **commit** until then",
"Nobody has **committed** to anything yet", and the review step card "Review & **commit**".
A blind noun sweep produces "nobody can commitment", which is how this was caught.

**Scope.** 843 replacements across the prototype source plus five builder renames
(`commitmentCard`, `commitmentRow`, `commitmentSlide`, `CommitmentCast`, `w7Commitments`).
Zero occurrences of "promise" remain in rendered artifact text. Deliberately untouched:
`promiseKeptRate`, which is a contract and indexer field name carried by contract-spec
and the ontology; and the seven hotspot ids plus two state keys that contain the old
word, which are stable deep-link addresses rather than copy.

**A latent validator bug surfaced by the sweep.** The Appendix D.1 tripwire read
`/promised units|% of promised/i` — a phrasing no surface had ever rendered, because
every surface already said "committed units". The rule was **blind from the day it was
written**. Making the guarded phrase real exposed two hits on `W10`, both legitimate:
a single commitment's own reserved units are one basis, so "cancelling releases the
committed units" is not an aggregation. The tripwire now guards the invariant's two
real rendered shapes — a percentage over units (`% of committed`) and a bare
cross-commitment total (`N units committed`) — and keeps the historical spellings so a
reintroduced old phrasing still trips.

### C.14 Team is one surface (2026-08-17, round 15)

Team lived in two places that never referenced each other: creation's Advanced detour
owned the **policy** (Open vs Lead-managed) and an invite step, and `W2b` owned the
**roster** afterwards. It is one screen now, with two lifecycle states that match what
the contract allows — the policy is immutable once someone accepts, and a roster exists
only after acceptance. Creation reaches it from a single `Team` row; the commitment
reaches it from its People section. `W3@step-invite` retires.

**Adding people is a sheet over the team, built from the shipped garden Gardeners list**
(`packages/client/src/components/Features/Garden/Gardeners.tsx:74`): a full-width tappable
row with a 40px avatar, name, subline, a joined line with a calendar glyph, and a badge
pinned top-right — scrolled and tapped, not one address typed into a field. The new kit
builder is `memberRow`.

**Names, then addresses.** That component resolves its display name as `username || email
|| phone || formatAddress(…)`, so a wallet address becomes the primary line exactly when
nothing better is on file. The prototype now follows the same order and renders the
address case in monospace, so it reads as an identifier rather than as a person's name.
`W2b` previously showed `Kwame · 0x5b…19` beside every roster entry.

**The kind gate was wrong.** Every drawn contributor action declared
`kind: "DomainImpact"`, so a service commitment could choose a team policy at creation
and then had nowhere to see or manage that team. contract-spec: *"Every accepted
commitment stores one accountable `leadProvider` and an event-indexed contributor roster
governed by an immutable Open or LeadManaged policy."* `addContributor`,
`removeContributor`, `joinCommitment` and `leaveCommitment` are now available on every
accepted commitment; **only `setContributorRequirement` stays garden-work-only**, because
requirement rows exist nowhere else. `W2b@forming-service` draws the case that had no
surface at all.

**Recognition states the policy, never a per-person split.** The old preview ranked
teammates — "Maria 40% · Ana 35% · Kwame 25%" — on a member surface. That is what D.3's
copy rule forbids ("counts, never percentages, never a grade, never a comparison against
another member") and what the round-7 no-per-person-rates rule forbids. The team screen
now says how credit is shared — 35% equally, 65% by verified contribution — and
`W2b@recognition` explains what "verified" means rather than scoring anyone.

`W2b` was also the last client screen with no `FormInfo` step cards and no fixed action
bar; it has both now.

### C.15 The review IS a WorkView (2026-08-17, round 16, CORRECTS C.10 and C.12)

**C.10 and C.12 described the review wrongly, and both reviews were built on that
description.** They said `views/Garden/Review.tsx` is "FormInfo over ONE flat card of
rows". It is not. Line 192 renders **`<WorkView>`** — the same component the commitment
view uses — and WorkView is `FormInfo`, then an `h6` per section (Garden, Media,
Details), with **one `FormCard` per detail** beneath the last of them
(`WorkView.tsx:140-176`, `FormCard.tsx:19`). The earlier passes read the prototype's own
WFLOW cast rather than the shipped file.

Every review in the feature — six in creation, five in evidence — now draws that anatomy.
The consequence worth having is that reviewing a commitment and reading one afterwards
look alike, because they are the same component.

**Four changes land with it (Afo, reviewing the flows):**

- **Team moved to the details step.** Who is on a commitment is a detail of it the same
  way its photos and notes are; it had been reachable only by going forward to review and
  then sideways into Advanced. The Advanced detour keeps confirmation alone.
- **The action picker is a rail, not a grid.** A 2×2 grid caps at four actions before it
  grows downward; the rail is the same `selCard` carousel the Submit Work intro uses to
  choose an action, so choosing one here reads as the same act.
- **Counts are anchored at each card's foot.** A description that wrapped to two lines
  pushed its count down, so a row of cards showed quantities at different heights. The
  description now has a fixed two-line box. Verified: five cards, one of them deliberately
  wrapping, all counts at the same offset.
- **Every adder sits in the fixed bar.** Link and note were labelled buttons in the
  content while camera, gallery and mic were in the bar — two rows of adders on one step
  for a single kind of act. The bar now carries all five.

**A dead computation surfaced.** `W2`'s `chips` — the commitment's kind, its state, and
its impact domains — was built on every render and **never rendered**. So the one screen
whose job is to say what a commitment *is* showed none of those. It was invisible because
`domainRow`'s only other consumer was the review markup this round replaced; retiring that
markup left the builder with zero screens and the gallery's coverage gate caught it. The
row now sits above the fold beside the people.

### C.16 A season is a place you can go (2026-08-17, round 17)

The pool tab answers *what is live*. Nothing answered *what is this season* — a finished
one rendered as `W1@cycle-summary`, a pool-tab **state** showing a summary card, so a
garden's memory was a mode of the current screen rather than somewhere to navigate. That
state retires into **`W1C`**, reached by tapping any cycle card.

**The pool tab keeps its scope and widens its list.** It shows cycles that are running or
being planned, and every commitment belonging to them **whatever state it reached** — a
kept commitment is part of the live season's record, not something that vanishes from it.
Ended cycles trail the live ones in the carousel, so swiping right walks back through the
garden's memory, with an **All seasons** card after them once the history outgrows the
rail. The list keeps the filter row it already had rather than gaining a second axis:
`All` means everything in scope, open and finished alike.

**`W1C` is details on top, then three tabs.** The head names the cycle, its dates and its
stage; beneath it sits what the season holds — or grew — per unit basis, plus the reserve.

- **Commitments** — the cycle's list, the same records the pool tab shows under a
  different scope.
- **People** — who took part and the role they played here. **D.3 bounds this precisely:**
  the roster and the role are public garden membership, but a per-person record — kept,
  lapsed, received — renders only for a steward or for that member themself, and never as
  a percentage, a grade, or a comparison. The tab says so in its own words: shared memory,
  context, not a score.
- **Insights** — the assessments lead it. What a season changed is read from the
  assessment that opened it against the one that closed it, and the tab names the markers
  that moved *and the one that did not*. Figures beneath are aggregate and per unit basis;
  hours, rides and sessions never add up to a total (Appendix D.1), and nothing here is
  attributed to a person.

### C.17 The console's cycle view (2026-08-17, round 18)

`W7C` is the steward half of C.16's `W1C`: the same three questions — this cycle's
commitments, who took part, what it changed — in the console dialect. The season card's
header becomes a door, while the acts in its header row keep acting on the season in
place.

**What the dialect changes.** The two-column workspace split, with the cycle's own
holdings and its acts in the right rail rather than after the answer; `AdminCard` heads in
Title Case; dotted status chips; `Close Season…` and `Start Campaign` reachable from the
cycle they act on rather than from the pool tab two levels up. No hero anywhere — a
finished season is a quiet status chip, not a celebration (register #27).

**One deliberate divergence, and it is D.3 doing exactly what it was written for.** The
console's People tab carries a **Pool History** card — "Maria · 4 kept · 1 lapsed · 2
received · carrying 1 open" — which the client's People tab does not. That is D.3's
steward placement verbatim: sourced from counts only, never a percentage, never a grade,
never one member ranked against another, and visible to a steward or to that member
themself. The client tab shows who took part and their role; the console adds the history
a steward needs to steward with. Neither is ever published.

### C.18 The details step, and one section-title style (2026-08-17, round 19)

**Team over media.** Who is on a commitment is a decision; what you attach to it is a
list. The step leads with the decision. An empty team is a **full-width button** — the one
thing to do on that half of the screen — and once anyone is on it the roster becomes a
**carousel** with the add demoted to a plus in the section title, so the roster can never
push the media list off the step. New kit builders: `memberTile`, `memberTrail`.

**The dashed tap-to-add surface retires.** It was a second way to do what the fixed bar
already does, and it sat where the attached items should be. An empty list is answered by
the bar, not by a placeholder in the canvas.

**The primary loses its label.** Five adders plus a labelled Continue squeezed the word to
nothing. The button keeps its end position and its accent; only the text goes.

**One section-title style.** The flow's early steps used `.t-sec` — 16.5px sentence case —
while its later steps and every read surface used `.h6s`, the 11px uppercase label that
mirrors `WorkView`'s `<h6>`. Two styles for one job, four steps apart. The shipped
component decides it: inside the client dialect `.t-sec` takes the `.h6s` metric, so
*What you're offering*, *How much*, *Add details* and *Review & commit* all label their
sections the same way. Verified across all four steps at 11px / uppercase / 600. Admin
keeps its own `.t-sec`, where it is a genuine card heading rather than a section label.

### C.19 Submit Work, drawn as it actually is (2026-08-17, round 20)

The prototype's `WFLOW` is meant to be a faithful drawing of the **shipped** work flow, and
it was wrong in three places. The flow does not change; its drawing does.

**Media** (`views/Garden/Media.tsx:500-556`) is `FormInfo`, a self-start **count badge**,
then the **Needed** and **Optional** pill groups the chosen action declares, then the
uploaded images as a **tile grid** with audio notes beneath. The prototype drew a dashed
capture card over a list of rows — neither exists in the shipped step.

**Details** (`views/Garden/Details.tsx:113-180`) is `FormInfo`, **Time Spent** as a default
field, then **the inputs the chosen action declares**, then feedback. The prototype drew a
"Fulfills a commitment" row instead of the action's inputs. That row asked a question the
intro had already settled — the commitment is chosen there — and pushed the step's actual
content out of view. It retires, and `WFLOW@fulfills-pick` and `WFLOW@details-linked`
retire with it: a picker for a choice already made, and a twin distinguished only by
carrying it.

**Review** was the last review in the feature still drawing a single flat card of rows.
It takes the `WorkView` anatomy C.15 established: `FormInfo`, an `h6` per section, one
`FormCard` per detail. The fulfills line survives here as one card — a review states what
was chosen, which is different from asking again.

Verified rendered: media shows the Needed and Optional groups over two image tiles;
details carries the action's own inputs and no fulfills row; review stacks six FormCards
under Garden, Media and Details.

### C.20 The commitment's identity card (2026-08-17, round 21)

The top of the commitment view was four bare rows stacked on the canvas — header, a
chips row, a lone domain row, a dense people line — each with its own ad-hoc padding and
no grouping. It is one card now: the card someone tapped in the pool, expanded.

**Terms are deliberately NOT in it.** Amount, due and cycle stay in Details. What the
card carries instead is the thing that exists nowhere else on the screen: where this
commitment stands and what has been done.

**The progress block is where the two readiness paths become legible**, and this is the
substantive part. `attachEvidence` carries **no kind gate** — a garden-work commitment
can hold evidence, and every credited contributor earns a recognition credit from it. But
`submitForConfirmation` **rejects DomainImpact**, so on garden work evidence never
advances readiness; only approved work reaching every requirement count does. The
opposite holds for a service, which has no requirement rows and whose evidence *is* its
readiness path.

The block says that structurally rather than in prose:

- **Requirement counts carry bars.** A bar means this gates readiness.
- **Everything below the hairline carries no bar** — the evidence tally, the assessment
  line. The absence of a bar is the signal.
- **The explaining line appears only where both are present** — a garden-work commitment
  with evidence attached, the one case where the distinction genuinely confuses. A
  service, or garden work with no evidence yet, needs no explanation.
- **A browse view omits the block entirely.** Nothing has been done, and that screen is
  about deciding whether to take the commitment up rather than tracking it.

This also settles what the status band is for. Progress is structural and lives in the
card; the band keeps what is transient — an evidence job queued on this device, who is
acting right now, why a confirmation is blocked. The `Work approvals · 1 of 2` meter
moves into the card, where it is always in the same place.

**A regression found and fixed.** Round 15's `memberRow` took the `.mrow` class the
`meter` builder already used, so since then every meter caption — "approved works · 1 of
2" — had been rendering inside a bordered, padded, rounded card. Renamed to `.mbrow`.

### C.21 Actions by state and by seat (2026-08-17, round 22)

Roles flip between the two directions, which is why the same state shows different acts to
different people: on an **Offer** the creator is the provider and whoever takes it up
confirms; on a **Request** the creator confirms and whoever takes it up provides. The two
seats that matter are therefore **provider** and **confirmer**, never "creator" — and the
contract keeps them apart, excluding every contributor from every confirmation path.

Measured before the change: **22 of 75 states carried an action; 53 were read surfaces.**
That ratio is the design — most of the time there is nothing for you to do, and the screen
says so rather than offering a button you cannot use. Four corrections:

**Garden work takes both.** `attachEvidence` has no kind gate, so a DomainImpact
commitment can carry evidence as well as approved work. The bar offers `Submit work` as
the primary and `Add evidence` beside it, weighted so the emphasis matches what the
progress block establishes: work advances readiness, evidence credits the people who
helped.

**A contributor's seat exists, and it is wider than first drawn.** `W2@contributor` shows
someone on the team who is not the lead. The first pass gave them evidence only, on a guess
that submitting work against someone else's commitment was the lead's act. The contract says
otherwise: `linkWork`'s permitted callers are *"active contributor, lead provider, or
steward"*, and it **verifies the Work attester is an active contributor** — so a
contributor's own approved work is exactly what counts toward the requirement rows, and
`setContributorRequirement` exists to point them at one. The rule is therefore simple: **a
contributor does everything the provider does except send and confirm.** `submitForConfirmation`
stays the lead's, and confirmation excludes every contributor absolutely.

**The active stage splits by viewer.** `ready` already had `ready-pending` for the
provider waiting and `ready-confirmer` for the person who can act. `active` had neither —
one state carrying the provider's button, so a confirmer reading an in-progress commitment
was offered `Submit work`. `W2@active-waiting` is the confirmer's read of that stage.

**Sending names what it does.** `submitForConfirmation` is the act a service needs because
it has no approver — garden work reaches readiness automatically when the last approval
lands, a service cannot. It also **freezes the contributor roster and credit accounting**,
emitting `ContributorRosterFrozen`, so nobody can join and no further evidence counts
afterwards. That is now a confirmation step naming the consequence, not a single tap.
Submitting is still not confirming; the lead stays blocked from every confirmation path.

**How it can end is now a term, stated on the screen.** `Withdraw` sits on `offered` and
`requested` only; after acceptance, cancellation is a steward act in the console. Rather
than leave that silent, Details carries the rule alongside the other terms and changes with
the state: *"If you change your mind — you can withdraw it while nobody has taken it up"*
before acceptance, *"If it needs to end — now that it's been taken up, a steward cancels
it, ask in the garden"* after. The provider learns where the exit is without being given a
control they do not have.

### C.22 The unitLabel guard lives in the render (2026-08-17)

`unitLabel` is an **unbounded on-chain string**, and no contract bound is being added for
now (Afo: *"avoid contract work for now and make sure the UI has a good guard that will
work with future contract deployments"*).

That decision moves where the guard has to live. A cap on the composer's input is not a
cap: anything writing directly to the module can store a label of any length, and every
surface that renders one has to survive it. So the guard is **render-side** —
`unitLabel(raw)` cuts past 24 characters with an ellipsis and keeps the full text in the
element's title, so nothing overflows and nothing is silently lost.

It is deliberately independent of whatever the composer allows, which is what makes it
future-proof: if a contract bound lands later, the truncation simply stops firing and no
code changes. The composer's own 24-character limit stays as a courtesy to the person
typing, not as the thing being relied on.

Drawn rather than only asserted: `W1C`'s "What this season holds" runs its rows through the
guard and carries a deliberately long fixture — a garden really can name a unit "full-day
accompanied market transport runs" — so the truncation is visible in a drawn state, with
three gallery specimens covering short, at-cap and past-cap.

### C.23 A person is a photograph, and so is a photo (2026-08-17, round 23)

Two surfaces were drawing a *description of* a thing where the thing itself belongs.

**The team card.** The added-team carousel held a 96px tile carrying an initial and two
truncated lines. It never even drew that: `memberTile` and `mediaStrip` both emitted
`class="mtile"`, and because `.hf.s-client .mtile` (three classes) outweighs `.hf .mtile`
(two), every member card on a client screen rendered at the *media tile's* 60×78 in the
media tile's green — 40px avatar plus 20px padding plus gaps consuming 72 of 78px, leaving
the name and account boxes computing to **2px tall each**. What reached the screen was a
green square with one letter in it (Afo: *"they don't give any context as to who you added
or anything"*).

The carousel was never the problem — it is the right call for space, since a vertical roster
pushes the media list off a 700px phone at three people. What it held was. Each card is now
**GardenMemberItem's own layout at 216px**: photo, name, account, role, with the remove
control absolutely placed and the text column padded to clear it — the same move
`GardenMemberItem` makes with `pr-14` to clear its Operator badge. 216px shows one and a
half cards, which is the peek that says *this scrolls*.

Registered-date is deliberately dropped. Gardeners.tsx carries it because that list is a
membership record; this list is a team being assembled, and when someone joined the garden
has no bearing on whether they belong on this commitment. **Role does**: exactly one member
is the accountable `leadProvider`, the roster freezes at readiness, and this is the last
cheap moment to correct which one it is. Lead carries weight; Contributor is a quiet line,
because five filled pills in a row would out-shout the names they describe.

**The avatar.** `Gardeners.tsx:72` resolves `member.avatar`, then `ensAvatar`, then
`/images/avatar.png`, and `AvatarFallback` is an empty muted disc. A gardener is a
**photograph** in the product and never an initial; the letter discs in this kit were an
invention with no shipped analog, which is how a member card could collapse to one letter
and still look deliberate. `avatar()` draws a photo, or the generic-person glyph when
nothing is on file.

**Media.** The capture step drew text rows — *"North beds — before · Photo · just now"* —
beside a generic `image-line` glyph, and `mediaStrip` put the **word** "photo" inside a
tinted box. No image appeared anywhere in the feature. `Media.tsx:688-818` renders every
photo as an `<img>` at `aspect-4/3`, opens `ImagePreviewDialog` on tap, and puts its remove
control in a 44px target at `top-2 right-2`.

Media stays **one list** — a photo, a voice note, a link and a written note are all things
you attached (Afo, against the shipped two-zone grid) — and the photo rows carry the
picture: a 44px thumbnail, the shipped minimum touch target, tappable into the preview. The
read-only strip carries real thumbnails too, on every review and on the commitment view,
because whoever is deciding — a neighbour weighing an offer, a confirmer weighing whether it
was kept — is deciding on the photograph. A voice note, link or written note has no picture
to draw, so it keeps a dashed tile carrying its **kind as a glyph** rather than pretending to
be one.

**The preview is a dialog, not a route.** `W2@evidence-preview` renders `evidence-submitted`
verbatim and adds an overlay; the surface underneath keeps its scroll and its state. Only
photos are in the sequence, because the dialog is fed `photoOnlyData` (`Media.tsx:165`) — a
voice note in the same list is skipped and the counter never counts it. Arrows appear only
where there IS a neighbour, and the zoom trio is hidden below the `sm` breakpoint in the
shipped component (pinch is native on touch), which is what keeps close on-screen at 375px.

The photographs themselves are layered gradients: the artifact is one self-contained file
and cannot fetch an image. Each fill carries a bright source, a shadowed corner and a body
ramp, because two flat layers read as a colour swatch at 44px and a photograph has light
coming from somewhere.

### C.24 The three Offer flows (2026-08-17, round 24)

Afo reviewed all three Offer paths and named eight things. Six were confirmed; two were
worse than reported.

**Cycles had no tag on the client and the wrong one in admin.** The client carried the
cycle as prose in the meta line — *"Tool library campaign"*, *"runs with the season"* — so
there was nothing to colour. Admin drew `chip("Campaign", "request")`, the Request tone
exactly, which made a campaign tag and a request tag the same colour. Cycles now have their
own hue at two weights: **season filled, campaign outlined**, because the season is the
pool's ground rhythm and campaigns run on top of it, any number at a time. They needed their
own class because a cycle is a different KIND of tag from the ones that existed —
offer/request is direction, domain is subject matter, and a cycle is the container both sit
in. The chip gets a dedicated slot on the card rather than competing for the three tag
places, and it is justified beside a carousel that already names a cycle because **the pool
list mixes cycles**: the season and its campaigns appear together under "All current", which
is frontend-design Rule 17's stated exception.

**Who confirms moved into step 3.** It had been the last card of the review, reachable only
through the Advanced detour — so the one question about another person, and the one thing
that decides whether a commitment can ever be closed, was discovered after scrolling past
six details you had already answered. Step 3 now asks three things in order: **who confirms,
the team, the media** (Afo). The review follows, and the rule that makes it follow is worth
stating on its own: **the review reads in the order you filled it in** — Garden and Details
carry steps 1–2, then step 3's three sections in step 3's order. Team appears in a review
for the first time; it had been chosen on step 3 and never shown again before sending.

**Five queued outcomes had five compositions.** `queued` had filters but no section header
and grew a disclosure drawer that exists in no other pool state; `support-queued` swapped the
carousel for a bare `seasonCard` and dropped the filters entirely; three carried an offline
banner and two did not. They are one screen now — the pool tab you were already on, with the
commitment you just made at the top of it. The banner is gone **everywhere** rather than
added everywhere: the card carries a dashed Queued chip, the status bar carries the offline
glyph, and the card's own note says what happens next, so it was a third statement of one
fact costing ~60px above the fold. Landing back where the thing lives, with the thing
visible, is the confirmation.

**Pickers are controls, not chips.** `.ch`'s box reset deliberately defeats the 44px
minimum — right for a chip that labels a card, an accessibility defect for the unit, amount
and count pickers on the how-much step, which were built from the same function and rendered
at a 24px box. `pickRow` is the control form: same shape and rhythm, a real target, a pressed
state a label has no use for, and honestly disabled when it is preview-only.

**"Places" is retired.** The word was a second name for something that already had one:
`standing-commitments-spec.md:224` says *"two available workshop places are two ordinary
Offer instances"*, and it appears in neither the community glossary nor the contract, which
knows only `Commitment` and `CommitmentSeries`. It was also introduced before it was defined —
step 2 read *Unit · How many each place · Open places to start*, with the sentence explaining
what a place is arriving after all three. The noun is gone; the verb is **open**, which is
what the act does. State keys and hotspot ids keep the old word, as they did through the
promise→commitment rename: they are deep-link addresses, not prose.

**An ongoing offer lives with the season, and that needs no contract change.**
`CommitmentSeries` is `{poolId, createdBy, currentHolder, state, metadataCID,
creationPayloadHash}` — pool-scoped, with **no `cycleId`**. But `Commitment` carries both
`cycleId` and `commitmentSeriesId`, so **every commitment the series opens already names a
cycle on chain**. "This offer runs in the Season of First Rains" is therefore a true
statement about all of them, made with fields that exist today. Two consequences follow and
are now drawn: the Things-I-can-offer entry, which jumped straight to the amount step and was
the one path that never picked a cycle, enters at step 1 like every other; and when a season
ends the offer stays yours — the commitments it opened finish where they are, and it opens
nothing new until the next cycle starts. The honest limit: the series record itself stores no
cycle, so a series spanning two seasons will have commitments naming different ones, which is
also the correct behaviour.

**The ongoing offer is a commitment view.** W34 had its own header, its own sections and its
own vocabulary across 35 states, while each thing it opens is an ordinary commitment that
opens W2. A series is a container of commitments, so it reads as one: the same identity card
W2 leads with — title, kind/state/**cycle** chips, the provider — then the completion picture,
then sections. That identity card is also where the season binding becomes visible.

### C.25 Offer-flow corrections (2026-08-17, round 25 — PARTIAL)

Afo's walk-through of the three Offer flows. Everything below is built. **The ongoing
offer's detail screen is NOT settled** and is deliberately not rebuilt: Afo asked to talk the
model through first, and drawing it before that is what produced the last round's partial job.

**The carousel lost its left padding to scroll-snap.** The rail's math was right (a negative
margin cancelled by equal padding), but a snap container snaps the first slide to the
*scrollport* edge and ignores the padding box, so it loaded at `scrollLeft: 16` with the
first card flush at 0 while every other card on the page sat at 16.
`scroll-padding-inline: 16px` moves the snapport itself.

**Step 3's two people sections share one shape.** A full-width button when nothing is
chosen, a row you tap when something is. Who confirms is never truly empty, since there is
always a default, so it is always the row: you tap the person to change them rather than
reading them and hunting for a button underneath. Who confirms fell from 133px to 89px and
Team from 146px to 127px, which gives Media back 63px. The helper line now sits in the same
place in both team states, under the section title, at two lines of similar length; it used
to jump from above the button to below the cards as soon as someone was added.

**The step-3 info card describes the step.** It still said *"Photos, a voice note, or a
link"*, written when the step held only media, so it named one of three things.

**The list header says "Commitments", not "Open commitments".** The header was asserting a
filter state that the control beside it changes.

**An ongoing offer lands on the pool tab.** It was the one creation flow that finished in
Things I can offer, the wallet's private section, while the other four now end on the pool
tab with the new card on top. `W1@ongoing-queued` is that outcome.

**A card with no media draws no square, and a card with media draws a photograph.** The empty
square was transparent rather than grey, so it was only stealing width; the real miss was
that `commitmentCard`'s media square still rendered the *word* "photo" in a tinted box.
`mediaStrip` became real thumbnails in round 23 and the card was never converted with it.

**Em-dashes are leaving the copy.** Afo asked for plainer language that translates well. The
composer, its outcomes and the ongoing screens are done, 35 strings; the rest of the client
is a follow-up pass and is not claimed as finished. Titles and labels that use a dash as a
name rather than as punctuation ("North beds — before") keep it.

### C.7 PARKED — reciprocity from the claim side (2026-08-16, register #103)

> **Parked 2026-08-17 (Afo): "park it for now and we stabilize and polish the UI."** The
> proposal below stands as written and needs no rework when it is picked up — it requires
> no contract change, and `validateCounterCommitment` already implements the pair. It is
> parked because it is the only genuinely NEW capability in the backlog while every other
> lane is stabilising, not because anything in it was found wanting. Nothing in the
> prototype draws it; register #102(d)'s exchange parking is unchanged.

**Status: proposed, awaiting Afo. Nothing in this section is drawn as shipped design, and no
screen implements it.** Register #102(d) parked exchange "until exchange gets its own design
session"; this is a proposal for that session, deliberately narrower than what was parked.

**The problem.** Appendix E.1 exchange is bilateral: A↔B, same-pool Offer picker, A's creator must
accept, both start together. That needs a double coincidence of wants — the exact thing pooling
exists to remove. Taken with the fact that a claim is a request to one named promise, what is
built today is a commitment registry with bilateral matching, and "pool" is doing work the
mechanism does not yet do.

**What is missing, expressed non-transferably.** When you take up someone's offer, the same step
asks what you can bring, and creates your offer as part of the claim. You draw on what the pool
holds and put your own capacity back in; no matching partner is required.

**Why this is small.** The primitive already exists and needs **no contract change**. E.1's "Offer
this in exchange for…" picker sets `counterCommitmentId` on creation, and
`validateCounterCommitment` already enforces the pair predicates. The proposal only adds the
*other entry point* — the claim flow — over the same two existing calls.

**The ordering constraint, which is the real design content.**
`CreationChecksLib.sol:137-139` requires the counter offer to be `direction == Offer` **and**
`state == Offered`. Claiming A moves it out of `Offered`. So the combined step must enqueue
`createCommitment(B, counterCommitmentId = A)` **before** `claimCommitment(A)`, never after, and
the job queue must preserve that order across a retry. A naive "claim, then ask what you bring"
reads better as a sentence and cannot work.

**Surfaces.** Client-primary: one added, **skippable** step in the claim flow (`W25`, and the claim
paths off `W1`/`W2`). Admin: claims-queue rows on `W7@claims` show what the claimant is bringing
beside the existing claimant / requestedBy / gardenContext fields. It links two commitments and
moves no bearer instrument, so it stays inside the non-transferable-first staging.

**Bindings that do not move.** Vocabulary stays "in exchange for" — `swap`, `trade`, `traded`, and
`price` are banned in member copy (D.1, E.1) and the artifact build scans rendered text for them.
No ratio, chart, rate, or relative-advantage rendering (E.1). Lifecycle independence per decision
17: a lapsed counterpart never acts on its pair. Steward-captured and non-zero-`onBehalfOf`
creation is excluded, because a steward cannot consent for the represented gardener.

**If the answer is no**, the alternative is to drop pooled-liquidity implications from member copy
and let "in exchange for" read plainly as two people linking two promises — which is what it is
today.

## Appendix D: CPP-alignment additions (2026-08-01, plan registers #71–#74)

Append-only per Appendix B's citation rule. Five deltas from the Grassroots Economics review
session (contract authority: contract-spec amendment 2026-08-01, decisions 16–17; app-lane
authority: plan registers #73–#74). This is staged Commitment Pooling: "commitment coordination"
names the first functional layer, not a product rename. The deltas below are approved August
app-roadmap work even where hi-fi or implementation is still pending. The 2026-08-03 closure pass
realizes the steward `W10@edit-declared-value` mutation; the remaining Appendix D placements keep
their stated staged status. Later-roadmap capabilities
such as garden-to-garden routing, transferable exchange execution, and relative-pricing
enforcement stay visibly connected to the same architecture without being presented as shipped.
Wireframe updates are an explicit follow-up deliverable; frames named here cite the current W-set.

### D.1 Declared value input and display

The seeding console's *Consideration* step (Appendix B's five-step lock, `W8`) gains an **optional
"Declared value" field pair above the consideration rail**: value-per-unit plus a basis picker
(free-text with `G$` and `USD` presets; exact-label discipline — the input never case-normalizes).
Copy: "What reference value does one {unitLabel} carry here? Optional — a shared term, never a settlement amount or conversion rule."
When a consideration rail is then selected, the amount field pre-fills `declaredUnitValue × targetUnits`
with helper text "Suggested from the declared value — adjust freely"; the module never enforces
the identity. A commitment may declare value with no consideration (mutual-aid valuation without pay).
Client creation flow (§5.4) exposes the same optional pair on the terms step for gardener-created
commitments. Commitment detail (§5.3, `W2`) and admin review surfaces render a terms row
"Declared value: {value} {basis} per {unitLabel}" only when declared; pre-acceptance steward
edit rides the existing `setDeclaredConsideration` edit affordance as a sibling `setDeclaredValue`
action. **Aggregation boundary (decision 16)**: surfaces may sum declared value only within one
exact basis and only as informational read-model sums ("Declared value in this cycle: 340 G$
across 6 promises"); never across bases, never as a per-person figure, never as a ranking key.

### D.2 Counter-commitment linking ("in exchange for")

Creation flows (§5.4 client, §6.3 admin seeding) gain an optional **"In exchange for" picker**
listing the pool's open Offered/Requested commitments (search by title/unit; excludes self and
other pools by construction). Commitment detail renders a reciprocal pair strip when
`counterCommitmentId != 0` or when the reverse index names this commitment: "In exchange for →
{counterpart title, state chip}", tappable to the counterpart. Lifecycle independence is explicit
in copy: when the counterpart reaches Cancelled or Expired, the strip shows a quiet
"counterpart lapsed" state — "The exchanged promise ended ({state}). This one continues on its
own terms." — with no automatic action, matching decision 17's no-coupling rule. The pair strip
never implies an atomic swap; vocabulary is "exchanged promises", never "swap", "trade", or
"traded".

### D.3 Pool participation history (relational memory, never a score)

Consumes `PoolMemberHistory` through the viewer-aware shared selector (contract-spec §8.2), never through a raw entity query. The underlying row is derived from public onchain events, so steward + self visibility is a product-disclosure rule rather than a confidentiality claim: the selector requires the signed-in viewer plus current steward capability, participant rows render only for that steward or the member themself, and editorial surfaces receive aggregate selectors only. Two placements:

- **Admin claims/review queue (§6.4)**: when a steward reviews an ApprovalGated claim, the
  claimant row gains a compact history line — "In this pool: 4 kept · 1 lapsed · 2 received ·
  carrying 1 open" — sourced from counts only. Copy rule: state counts, never percentages,
  never a grade, never a comparison against another member. Purpose copy (tooltip): "Shared
  memory of this pool's give and take — context for stewarding, not a score."
- **Client wallet panel (§5.8)**: the member's own "My part in this pool" summary with the same
  count vocabulary plus their confirmations given.

Visibility follows the credit-console precedent (decision #21 privacy rules): per-member rows
render only for pool stewards and the member themself; editorial/public surfaces consume
pool-level aggregates only. No cross-pool merge of member-history rows. `promiseKeptRate` remains a
pool-level figure and is never displayed per person.

### D.4 Rotation Campaign template (ROLA pattern)

The admin cycle-seeding flow (§6.2/§6.3) gains a **"Rotation" Campaign template**: the steward
picks an ordered recipient roster; the template pre-drafts one Request per member in roster
order (each member in turn is the Request creator/recipient; everyone else may offer), with the
turn order stored in cycle `metadataCID` — **no new chain state; each turn is an ordinary
commitment**. The cycle detail view derives a "turns" strip from indexed history: who has
received a fulfilled turn, whose turn is open, who is next. Copy: "Each member takes a turn
receiving the pool's help." Skipping or reordering a turn is an ordinary steward edit of the
next draft, never a penalty state; the turns strip shows history, not obligation debt. Client
pool home (§5.2) renders the turns strip read-only on rotation campaigns. Offered/derived only
when a garden opts in — the pilot-evidence reciprocity question (pilot-evidence-spec §3)
consumes this signal.

### D.5 Reserve and redemption framing

Where settlement surfaces name the paying account (§6.7 consideration settlement, §5.8 consideration rows,
editorial §7.1), the garden Safe is presented as **"the pool's reserve"** and a paid declared
consideration as **"redeemed from the pool's reserve"** — framing only; every settlement-state rule
(Queued/Dispatched/Confirmed distinctions, no human override) binds unchanged, and "redeemed"
never appears before the authenticated success acknowledgment. The pool → settlement-account
linkage arrives as a derived read-model field (settlement-spec garden-route entities); no new
contract state. i18n: extend `app.pool.*` / `cockpit.*` with `value.*`, `exchange.*`,
`standing.*`, `rotation.*`, `reserve.*` key families (en/es/pt, same coverage gate);
banned-vocabulary rules apply throughout — no "price", "trade", "score", "rank", "leaderboard".

## Appendix E: bilateral exchange, offer templates, and plain language (2026-08-01)

This appendix implements plan Decision Log #43 / register #77. It extends the existing Tier 1
text/voice and Tier 2 screen surfaces; it does not define a new app, component system, or market
surface. Native controls, persistent labels, programmatic descriptions, keyboard order, visible
focus, and confirmation-sheet focus return follow the Baseline Widely Available accessibility
contract. Every pair state has text in addition to color or icon treatment.

### E.1 Exchange-pair UX

**Creation, step 1.** The existing creation form gains an optional row labelled **“Offer this in
exchange for…”**. It opens a picker over contract-eligible same-pool **Offer** commitments only:
each row is still Offered, uses Individual claim type, has its provider capacity reserved, and is
owned by someone other than the signed-in direct creator of B. This control is absent from
`StewardCaptured` / non-zero-`onBehalfOf` creation because a steward cannot consent for the
represented gardener. Accepted, cancelled, expired, self-owned, non-Individual, and
capacity-inconsistent records are excluded. Search and filters reuse the
creation/list patterns already specified; each result uses existing list rows, `StatusBadge`,
title, exact unit label, calm date, and creator identity. Selecting A sets B's
`counterCommitmentId = A`. Clearing the row returns it to zero. The selection remains visible and
editable through review.

Immediately before B is enqueued or broadcast, the executor re-reads A and repeats the
Offered×Offered, same-pool, Individual, distinct-creator, and reserved-capacity predicates. If A
became ineligible, the executor returns early to the picker with a clear-or-replace message.
That preflight improves feedback but is not the safety boundary: `createCommitment` repeats the
same A predicates plus direct-B consent atomically before allocating/storing B, registering its
class, reserving B's capacity, or emitting `CommitmentCreated`. If A changes between the re-read
and transaction execution, the transaction reverts with no B and the same clear-or-replace
recovery. It never creates an unstartable B and waits for `acceptExchange` to expose the stale
selection.

The review step renders one mirrored sentence before submission:

> You give [B title · quantity and exact unit label] · You receive [A title · quantity and exact unit label]

This is a summary of two promises, never a price comparison. No ratio, chart, rate, or relative
advantage appears.

**Commitment detail.** The existing terms area gains a pair chip treatment using the existing
`StatusBadge` plus a linked two-row summary. Status vocabulary:

| Pair status | Derivation | Detail treatment |
|---|---|---|
| Proposed | B references A and no `ExchangeAccepted` pair row exists | “Proposed in exchange for [A]” with the two promise summaries |
| Matched | `ExchangeAccepted(A,B,…)` exists | “Both promises started together” plus independent per-promise state rows |
| Counterpart lapsed | one paired commitment is Cancelled or Expired while the other is not | Calm context line: “The other promise ended. This promise keeps its own state.” No automatic action or blame treatment |

The pair status never overrides the commitment's ordinary lifecycle chip. Fulfillment,
confirmation, cancellation, expiry, and dispute remain direction-aware per promise. Each Offer's
recipient, which is the counterpart creator after atomic acceptance, confirms that side; every
contributor exclusion still applies.

**Pool exchange feed.** The Pool tab gains a neutral, time-ordered feed built from creation
references plus `CommitmentExchange` / `ExchangeAccepted`. It reuses the existing scoped list,
filter-chip, `ListPrimitives`, status, empty, loading, and read-error treatments. Proposed rows say
“offered in exchange for”; matched rows say “both promises started”; lapsed context stays on the
pair detail. The feed is never sorted by value, volume, person, or success.

**Accept-exchange confirmation sheet.** Only A's creator sees the action when direct-created B
references A and both sides remain eligible. A `StewardCaptured` / on-behalf B never exposes the
action. The existing confirmation-sheet pattern (`DialogShell`) names both
people, both promises, and the atomic effect before calling `acceptExchange(B)`:

> You'll receive [B]. [B's creator] will receive [A]. Both promises start together; each is kept on its own.

The action label is **“Start both promises”**. The sheet uses a visible heading, returns focus to
its trigger when dismissed, and exposes named non-retry recovery for each contract error. A
successful result routes to the matched pair detail. No optimistic Accepted state survives a
revert; both rows return to their indexed state together.

Copy rules: use “in exchange for”; use calm dates; never frame the feed as a venue or compare one
person with another. The word chosen by implementation for the GE protocol's architecture does
not enter gardener copy: the literal tokens “swap”, “trade”, and “traded” never appear in
gardener-facing strings (the same ban as Appendix D §D.1), and “in exchange for” is the only
exchange phrasing.

### E.2 Offer-template library

Creation becomes offer-first. Before the blank offer/request form, the existing full-screen
flow renders a template picker built from `Surface`, `ListPrimitives`, existing direction/type
chips, and a **Start blank** action. Templates are content/config only: they prefill existing
fields, requirements, contributor policy, cycles, and exchange references. They add no chain
state, contract type, module call, or custom lifecycle.

| Template | What this is | Existing primitives prefilled | Per-locale naming note |
|---|---|---|---|
| Rotation | Each member takes a turn receiving the pool's help | Campaign cycle, ordered recipient roster in `metadataCID`, ordinary Requests, existing rotation turns derivation | en uses “Rotation”; es/pt translators choose the locally understood rotating-savings name and may include ROLA/ajo/esusu/susu/tanda lineage in helper copy, never as one universal label |
| Work party | A group gathers around one shared piece of work | DomainImpact or SupportService commitment type, group commitment, contributor policy Open, ordinary roster and evidence fields | use the common local phrase for a shared work day; avoid a literal party translation when it implies entertainment |
| Harvest share | People promise part of a harvest and how it will be received | Offer direction, exact produce unit label, target quantity, recipient/confirmation rule, calm season date | translators use the local crop-share or harvest-sharing phrase and keep the unit literal |
| Tool lending | A tool is offered for a named period and purpose | SupportService Offer, item note, quantity, recipient confirmation, calm return date in terms | distinguish lending a tool from giving it away; use the familiar local noun for the tool library practice |
| Mentorship circle | People offer time to learn and practice together | SupportService Offer or Request, group commitment, Open roster, time unit label, evidence/confirmation rule | use a local peer-learning phrase; avoid language that implies one permanent expert over others |
| Exchange circle | Two people prepare mirrored offers that can start together | Offer direction, Individual claim type, same-pool Offer picker, mirrored review, `counterCommitmentId`, `acceptExchange` path | translate the ordinary phrase “in exchange for”; do not import financial-venue vocabulary |

Every template row carries its one-line explanation as visible text and accessible description;
the title alone is not expected to explain the Offer. Template defaults remain editable before
submission, and validation names the exact field the person must complete.

### E.3 Plain-language pass: fewer nouns, meaning on first exposure

Every surface gives the following one-line meaning the first time the noun appears in that flow.
Later repetitions may use the short noun alone.

| Noun | First-exposure plain meaning |
|---|---|
| Need | Something people here want to change, plus the outcome they want instead. |
| Commitment | A promise someone has offered or requested in this pool. |
| Offer | A promise of support someone is ready to provide. |
| Request | A promise naming help someone is asking the pool to take up. |
| Cycle | The shared period that gathers related promises and closes them together. |
| Season | The pool's main, longer cycle. |
| Campaign | A focused cycle that can run beside the season. |
| Declared value | What one unit is worth to us, in [basis]. It is a shared term, not a universal price. |
| Exchange | Two linked offers that can start together and are kept separately. |
| Confirmation | The receiving side records whether the promise was kept. |

Declared-value copy never presents the record as a price or computes cross-basis totals. The
preferred input hint is **“what one unit is worth to us, in [basis]”**. Any basis conversion must
remain absent from August surfaces.

Wherever the default 20/80 recognition split renders, add: **“20% is shared equally among active
contributors; 80% follows verified contribution to this promise.”** If a cycle uses another
policy, render its exact two parts with the same plain structure.

Gardener settlement surfaces collapse the transport detail to three truthful phrases —
**“on its way”** (including delivery delay), **“arrived”** (authenticated success only), and
**“being rearranged”** (authenticated failure, until stewards reconcile or cancel it;
cancellation then uses its own withdrawn/closed copy) — adding a calm action explanation only
when action is needed. A failed state never renders a success phrase. Steward and operations
surfaces keep the full seven-state operational set and its named recovery paths. Gardener copy
never exposes router, acknowledgment, execution-key, or queue-state nouns before a person asks
for technical detail.

## Appendix F: Offer once and Offer over time (2026-08-02)

This appendix consumes `standing-commitments-spec.md`. It removes `Practice` as a defined product
or domain noun. The interface presents one familiar noun, Offer, with a choice to use it once or
over time. `CommitmentSeries` remains the internal durable identity for an Offer used over time in
one pool.

### F.1 One Offer, two ways to use it

| Choice or layer | Gardener-facing treatment | Never imply |
|---|---|---|
| Offer once | One ordinary Offer created from blank or saved metadata | a durable series or automatic recurrence |
| Offer over time | A pool-scoped Offer detail headed by the Offer name and garden, with Active/Resting/Retired treatment | that the internal series is global across gardens |
| Saved Offer metadata | Private reusable input that survives device change when signed and saved | a separate product object, onchain obligation, credential, score, or public portfolio |
| Available place | One already-created Offered instance with reserved provider capacity | that claiming will create the place or that more capacity exists |
| Story | Linked instance timeline and exact absolute counts | reliability percentage, ranking, participant count, or impact claim |

The first exposure says: **“Offer once makes one promise. Offer over time lets you make the same
offer available again in this garden.”** Product copy does not need to expose
`CommitmentSeries`; technical diagnostics and data contracts may use it.

Saved Offer metadata follows one visible persistence truth state at a time:

| State | Required treatment |
|---|---|
| `LOCAL_DRAFT` | “Draft on this device”; Save is available. |
| `SAVING_REMOTE` | “Saving privately…”; keep the local draft and disable duplicate submit. |
| `SAVED_REMOTE` | “Saved privately to your account”; this is the only cross-device state. |
| `SAVE_FAILED` | “Save failed. Still a draft on this device”; Retry and keep editing remain. |
| `OFFLINE_LOCAL` | “No signal; this stays on this device”; do not queue or imply a remote save. |
| `VERSION_CONFLICT` | “A newer saved version exists”; offer reload, copy-local, or explicit overwrite. |

Every save action first enters `SAVING_REMOTE`; only a confirmed authenticated Agent-store
response enters `SAVED_REMOTE`. Timeout, app closure, offline status, auth failure, or unknown
result preserves the draft outside Saved. The no-signal storyboard must therefore end in
`OFFLINE_LOCAL`, not in a cross-device success state.

### F.2 Client journey and routes

The canonical artifact and implementation cover these placements:

1. **Things I can offer** inside the existing wallet/profile-adjacent personal surface: private
   saved Offer metadata and any Offers currently used over time. Saving survives device changes;
   unsaved edits may remain local. “I’m learning this” is outside this Commitment Pooling flow.
2. **Offer once / Offer over time** follows description or saved-metadata selection. The ongoing
   choice opens a garden picker and creates the pool-scoped series before any available instances.
3. **Ongoing Offer detail** at
   `/home/:id/pool/standing/:seriesId`: title, garden, lifecycle state, current terms summary,
   available-place count, **Add places**, **Rest**, **Resume**, **Retire**, and Story.
4. **Add places** creates a finite batch of ordinary Offer instances. Each place repeats the
   exact current terms and may choose a current Open cycle or cycle-less scope where allowed.
   The UI does not display a place as available until its creation has synced and reserved the
   provider slot.
5. **Claim** accepts one existing Offered instance and routes to its ordinary Commitment detail.
   The series detail remains the grouping surface; it never replaces the instance lifecycle.
6. **Next cycle** defaults to **Ask me again next cycle**. The reminder proposes a new finite
   batch; the protocol never auto-creates obligations. An explicit carry-forward preference may
   prepare a draft, but current consent is required before queue submission.

On a terminal one-time instance, **Offer again** copies terms to a new one-time draft. On a
series-linked instance, it returns to the ongoing Offer detail and opens **Add places**.

### F.3 Story and truthful evidence

The Story leads with exact phrases such as:

- “Kept 12 times across 5 cycles”
- “2 places available now”
- “Resting since August 2”

“Kept” means Fulfilled Commitment instances, not verified impact. The timeline retains cancelled,
expired, disputed, and repaired records without penalty styling. Participant counts appear only
when labelled **Reported participants** and backed by evidence/assessment data; protocol history
does not derive them. Story rows remain instance-level for the holder and current pool stewards,
while other members see available Offers and approved pool-level context only. No cross-pool merge
or public personal history is introduced.

### F.4 Rest, resume, retire, and future succession

- **Rest** stops new place creation and pool discovery for the ongoing Offer; it does not cancel
  Offered or Accepted instances and does not hide the Story.
- **Resume** returns the series to Active; it does not create availability.
- **Retire** is terminal and requires a confirmation dialog that explicitly says existing
  instances keep their state and history.
- Co-holding, apprenticeship, handover, fork/adoption, and community-held stewardship appear only
  as a labelled future-succession preview in the artifact. No interactive control or implied
  initial ABI exists.

### F.5 Admin and editorial boundaries

Admin pool detail may group instances by internal series and show the ongoing Offer, holder, state,
exact outcome
counts, available places, and pool participation history. Stewards cannot edit holder metadata,
rest/resume/retire another person's series, or manufacture a series on their behalf in v1.
Editorial surfaces receive separately approved pool-level aggregates only; they do not expose a
person's series Story, saved Offer metadata, or cross-pool identity.

### F.6 Canonical artifact states

Claude Code's prototype and visual-gallery pass must render, at minimum:

- empty and signed private saved-Offer states;
- Offer once and Offer over time choice states;
- pending/offline, Active, Resting, and Retired series states;
- zero, one, and multiple available places;
- a claim against one pre-created place;
- mixed Story outcomes across multiple cycles;
- next-cycle ask-again;
- signed saved-Offer persistence explanation;
- later-succession preview clearly outside initial implementation;
- light, dark, mobile, loading, empty, error, and reduced-motion treatments.

The artifact must not invent a separate `Practice` object, claim-spawned instances, device-only
saved Offer metadata, unreserved
availability, indexed participant counts, automatic renewal, cross-pool reputation, or a personal
score.
