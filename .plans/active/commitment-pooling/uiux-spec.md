# Commitment Pooling: UI/UX Spec (Four Surfaces)

**Feature Slug**: `commitment-pooling`
**Stage**: `active`
**Created**: 2026-07-03
**Scope**: PR-openable UI/UX specification for the August release (client PWA, admin, editorial website) plus the September community interface at wireframe depth. Builds on `reports/corrections-log.md` (verified IA facts), `standing-commitments-spec.md` (Offer once/over-time, internal-series, and instance architecture), and the locked decisions from the 2026-07-03 alignment session and later amendments. Contract-facing names (events, fields, module functions) defer to `contract-spec.md` in this folder; where this spec names a module concept it is a reference, not a definition.
**Grounding rule**: every claim about existing UI carries a repo file path. Everything else is marked NET-NEW.

---

## 0. Component naming and one chrome supersession

This spec names only canonical components per `.claude/skills/design/prompt-contract.md` and `client-prompt-contract.md`. One correction to the session plan's vocabulary: the admin `LeftSheet` / `RightSheet` / `BottomSheet` renderers are **retired**. Every admin overlay is a centered `AdminDialog` (detail/inspection) or an `AdminDialog` `variant="flow"` + `ActionFlowShell` (create/commit flows), per `.claude/skills/design/prompt-contract.md` § Overlays and its Layout shell table (landed in PRs #610/#613). Flow-to-surface mappings below therefore use: **MainSheet route section** vs **AdminDialog detail** vs **flow AdminDialog**. Admin views compose `CanvasRouteFrame` + `CanvasRouteHeader` + `CanvasRouteContent` (mandated by `.claude/rules/frontend-design.md` Rule 1; verified in `packages/admin/src/views/Garden/Vault.tsx:28-31,151-158`).

Admin wrapper palette (15, filesystem is the count of record, `packages/admin/src/components/`): AdminBadge, AdminButton, AdminCard, AdminCheckbox, AdminDialog, AdminFab, AdminFilterChip, AdminLinearProgress, AdminListItem, AdminSearchToolbar, AdminSortSelect, AdminTabRail, AdminTextField, AdminTooltip, AdminViewActions. Client shared primitives per `client-prompt-contract.md`: DialogShell, Card, StatCard, StatusBadge, Alert, Skeleton, Spinner, HydrationFallback, FileUploadField, ListPrimitives, DatePicker, Surface, SyncStatusBar, AddressDisplay, DomainBadge. Missing primitives are flagged in §9, never invented.

---

## 1. Personas and roles recap (hat-based)

Roles are Hats-tree roles, not app accounts (`IHatsModule.GardenRole`: Owner, Operator, Evaluator, Gardener, Funder, Community; corrections-log §6). Canonical personas come from `packages/shared/src/ontology/green-goods-ontology.json`: Gardener, Steward, Evaluator, Funder, and Community Member.

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

**Vocabulary.** Public copy on this surface says **commitment**, never "promise". That was already the decided state — `hifi/validate.ts`'s `RETIRED_VOCABULARY` fails the prototype build on `/\bpromis(?:e|es|ed|ing)\b/i` (C.14, "the record is a commitment") — and this section had simply not been swept. `promiseKeptRate` survives as a code identifier; the gate reads rendered copy, not field names. The rest of this spec still carries the old vocabulary and needs its own pass (see `plan.todo.md` decision log).

### 7.1 `/gardens/:id`: commitments section NET-NEW

The page today: `PublicEditorialHero variant="banner"` (Garden banner image, falling back to `getPublicHeroImage("gardens")`; location kicker, name H1, description lede, `← All Gardens` in the `actions` slot), a four-cell record strip (`dl` grid — Entries / Hands at work / Assessments / Certificates), then three numbered single-column sections: `§ 01 Field notes` (image-led grid, twelve at a time with local paging, tiles opening `PublicSourceDialog`), `§ 02 Impact Certificates`, `§ 03 Operators`. It closes with Support / View public evidence, `PublicInstallCta`, and `PublicFooter variant="soil"` (`packages/client/src/views/Public/GardenDetail.tsx`).

Until 2026-08-19 this route rendered a Radix modal over the `/gardens` grid. That was never an IA decision — the route was switched inside an unrelated homepage-polish commit — and `DESIGN.browser.md` had described a page the whole time. The conversion landed first precisely so this section has stable ground: no nested scroll container, no hand-indexed dialog stagger to push past its `:nth-last-child(n+7)` tier, and a real footer.

The commitments section inserts at **`§ 02`, between field notes and Impact Certificates**, renumbering certificates to `§ 03` and operators to `§ 04`. Field notes stay the first-scroll content (editorial identity untouched) and the commitments narrative flows into certificates ("fulfilled commitments become Impact Certificates"). It reuses the page's `Section` shell — `EditorialKicker` + `EditorialHeading` + helper inside a `useInViewReveal` wrapper — like every other section.

**The section is scoped to the garden's record across seasons and campaigns, not to one live cycle** (2026-08-20, Afo). §4.1 already says so — its Editorial column keeps aggregates through Paused ("neutral quiet-period line, aggregates stay"), Closed ("aggregate story remains") and Composted ("past-cycles aggregate") — and this section had narrowed to a single active cycle, contradicting its own state table. Cycle-scoping also raised two questions it could not answer: a garden between cycles had no legible state, and §4.2 permits one open Season **and** zero or more open Campaigns at once with no rule for which occupies a single slot. A record spanning cycles has neither problem, and it is the more honest object anyway — a garden's standing is what it has kept over years, not what it is midway through.

Section content, in order:

1. **Pool state line**: one sentence per the §4.1 Editorial column. Pre-launch (NotReady/Ready) renders readiness copy only, no numbers. Paused renders a neutral quiet-period line with the record still beneath it, and **never publishes `pauseReasonCID`** — the indexed reason belongs to the client banner and the admin console (§4.1), not to a funder-facing page a garden did not choose to write.
2. **The record**: lifetime commitments made and kept, read straight off `CommitmentPool`'s lifetime counters, with `promiseKeptRate` as the sole cross-commitment percentage, gated per §7.2. Rendered in the page's existing `StatCell` grammar inside the section, not by widening the four-cell strip.
3. **The live cycle**, when one is open: cycle name + type, stage phrase, "runs through {date}", scoped state counts, and separate exact-label unit-summary rows. Never a combined progress band or percentage. No timers. When a Season and one or more Campaigns are open together the Season is the named current chapter and the open Campaigns appear as rows in the record below — §4.2's rule that a Campaign never masquerades as the Season applies here as everywhere else.
4. **The season record**: compact rows, newest first — cycle name, type, window, kept of made. Campaigns sit in the same list beside Seasons, each naming its own scope. Cancelled cycles never appear (§4.2: aggregates count completed cycles only); Reconciled and Composted do. Twelve rows with local paging, the same grammar `§ 01` field notes use, so a garden several years in does not run the page long.
5. **Hypercert reports tie-in**: when fulfilled-commitment bundles exist, one line linking down to the certificates section ("Fulfilled commitments from these seasons are anchored in the certificates below").

Every figure in 2 and 4 is directly available: `CommitmentPool` carries lifetime `commitmentsOffered/Accepted/Fulfilled/Cancelled/Expired/Disputed/Due`, `getCommitmentCycles({chainId, poolId})` returns every seeded cycle with its type, window and state, and `CommitmentUnitSummary` carries pool-scoped exact-label rows alongside the cycle-scoped ones. Nothing here needs a client-side sum across cycles.

**The editorial surface needs its own reader.** `getCommitmentPoolDetail` (`packages/shared/src/modules/commitment-pooling/data-pools.ts`) selects `CommitmentProviderExposure { provider }`, so reusing it would put provider addresses in a signed-out reader's network payload — §7.4 forbids that whether or not they are rendered. Add a public reader beside the existing `packages/shared/src/hooks/public/*` hooks that selects pool, cycle, and unit-summary fields only and never touches the exposure entity.

**The section always renders**, like its three neighbours. A garden with no pool yet gets the pre-launch state rather than a missing section, which is what keeps the ordinals stable between gardens. The four-cell strip does not change in MVP. `/gardens` grid cards (`packages/client/src/views/Public/Gardens.tsx`) are untouched.

**Honest states are already load-bearing on this page.** `usePublicGardenDetail` reports `partialData` and `unavailableSources`, and the strip renders an em dash rather than `0` for a count whose source failed. The commitments section inherits that contract: a failed read says it could not load, and never publishes an unknown as a zero.

### 7.2 Small-community sensitivity (answers the digest's open question)

Recommendation, locked for this spec: `promiseKeptRate` renders publicly only at **at least 5 due commitments and at least 3 distinct providers**. It is the sole cross-commitment percentage. Below threshold, show absolute counts in sentence form and never a percentage; a single lapsed commitment in a three-person pool must not read as a 33 percent failure on a public page. Cancelled and Disputed never appear individually anywhere public (§4.3). The same threshold applies to the WalletDrawer Commitments summary (§5.8); inside the garden (pool tab), gardeners see their own full counts and exact-label unit groups.

**The threshold gates on whatever scope is being published, and the editorial rate is now pool-lifetime** (2026-08-20). §7.1's record spans seasons and campaigns, so the rate it carries is the pool's lifetime figure and the gate reads lifetime due commitments and lifetime distinct providers. The per-cycle rows in §7.1 item 4 stay counts-only — item 3 already forbids a synthetic percentage for a cycle — so this surface never needs a per-cycle rate at all.

**That changes which indexer counter is required.** Decision Log #161 concluded a cycle-scoped distinct-provider counter was needed, because the threshold read per-cycle; it also noted that pool-scoped is nearly free while cycle-scoped needs a new per-(cycle, provider) sentinel entity that does not exist. With the published rate at pool scope, the cheap counter is the one required: a `distinctProviderCount` on `CommitmentPool`, incremented the first time a `CommitmentProviderExposure` key is created for that pool — the same greenWill dedup pattern the other pool counters already use. It publishes a number, never a list, so §7.4 is satisfied. No new entity. If a later surface publishes a per-cycle rate, that surface owns the cycle-scoped counter and its sentinel entity; nothing in the editorial lane does.

`selectPromiseKeptRate` (`packages/shared/src/modules/commitment-pooling/disclosure.ts`) still applies no gate at all — it returns `{fulfilled, due}` whenever `due > 0`, with no provider input. The shared threshold helper in §9 is what both editorial and the WalletDrawer must call, so the two cannot drift apart on the same rule.

Check whether the hosted Envio indexer has already shipped PRD-722 before starting the counter; merge is not deploy.

This is a product-display floor, not the pilot's research publication threshold or evidence that
pooling strengthened settlement capacity. `pilot-evidence-spec.md` owns the stronger privacy,
linkability, consent, baseline, safeguard, and outcome-claim gates. When its publication rule is
stricter, the stricter rule controls.

### 7.3 `/impact`: protocol-wide pool aggregates NET-NEW

Add one editorial band to `packages/client/src/views/Public/Impact.tsx` using its section grammar (EditorialKicker + EditorialHeading + reveal wrapper, verified at lines 290-296 and 367-380), **placed between §01 proof markers and §02 "The cycle"** (decision 2026-07-18): kicker "Commitments", heading on aggregate mutual-aid framing (Document B relay vocabulary: commitments offered, commitments kept, gardens with live pools). Content: stat tiles in the §01 proof-marker grammar (gardens with open pools, commitments fulfilled this season, CCIP-confirmed G$ support; protocol-wide `promiseKeptRate` subject to §7.2 thresholds), one line explaining the commitment lifecycle in relay terms, and a link to `/gardens`. **Pipeline delta**: §02's `PublicEvidencePipeline` gains the commitment stages — Assessment → Commitment → Work → Confirmation → Impact Certificate — so the cycle section tells the story the band introduces. No per-garden table on this page (that is the Operations overview's job, and public per-garden comparison drifts toward ranking).

**Where the band's three figures come from.** Gardens with live pools = pools whose `CommitmentPool.state` is Open. Commitments fulfilled = the sum of lifetime `commitmentsFulfilled` across every registered pool, including Closed and Composted pools, so closing a pool never removes its history from the protocol record; **lifetime, not "this season"** — a season is per-garden, so there is no protocol-wide season to scope to, and §7.1's record framing makes the lifetime figure the consistent one across both surfaces. CCIP-confirmed G$ support is the aggregate returned by `getConfirmedSettlementAggregate` in `packages/shared/src/modules/commitment-pooling/data-public-impact.ts`; it counts only acknowledged deliveries (§7.4, settlement-spec §3.0).

**The pipeline gains two narrative stages; the evidence ledger's record kinds do not change.** `PublicEvidencePipeline` owns a local `EvidenceNodeKind` union and `PublicImpactEvidenceRecord` owns `PublicImpactEvidenceKind` in `packages/shared/src/public-contracts/`. The two are identical today and share one `EVIDENCE_KIND_LABELS` map, which `PublicEvidenceCard` and `PublicEvidenceDialog` both index — so the natural way to add Commitment and Confirmation widens both and lands commitment records in the `§ 03` ledger. It must not: a ledger record names a garden and a title, and a commitment record would attach people to commitment outcomes against §7.4. Split the pipeline's node kinds from the ledger's record kinds explicitly when the five-node layout lands.

**The pipeline needs work before it can take two more stages.** `PublicEvidencePipeline.tsx` passes **literal English** node titles and descriptions — only the closing caption goes through `formatMessage` — against an acceptance that requires en/es/pt. It is also `md:grid-cols-3` with three hardcoded domain tones (education / agro / solar). Internationalising the component, choosing a five-node layout, and assigning two more tones are prerequisites, not part of the band.

### 7.4 Boundaries

Read-only, aggregate-only. No leaderboards, no ranked lists, no participant-level data, no wallet addresses tied to commitment outcomes, no dispute or cancellation stories. All pool stats flow from module events via the indexer (EAS is not indexed; corrections-log §2 boundary), so the public surfaces need no easscan reads.

Note the boundary is about **commitment outcomes**, not identity as such: the page already shows field-note authors and operators through `AddressDisplay`, which is authorship of published Work and predates this feature. Nothing in the commitments section may attach a person to a commitment outcome.


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
| Five-node evidence pipeline | §7.3 | `PublicEvidencePipeline` (`packages/client/src/components/Public/PublicEvidencePipeline.tsx`) is a three-node `md:grid-cols-3` figure with three hardcoded domain tones, and its node titles and descriptions are literal English rather than `formatMessage` calls. Adding Commitment and Confirmation needs the component internationalised, a five-node layout, and two more tones assigned — do that first, as its own change |
| Public rate threshold helper | §7.2 | **Implemented:** `selectPublicPromiseKeptRate` in `packages/shared/src/modules/commitment-pooling/disclosure.ts` takes fulfilled, due, and pool-scoped distinct-provider counts and returns either the publishable rate or a counts-only shape. The authenticated `selectPromiseKeptRate` remains ungated. |
| Public pool reader | §7.1 | **Implemented:** `usePublicGardenPool` in `packages/shared/src/hooks/public/usePublicGardenPool.ts` reads only pool, included cycle, and exact-label unit-summary fields. It never selects or returns `CommitmentProviderExposure` rows or provider addresses. |
| Public settlement aggregate | §7.3 | **Implemented:** `selectConfirmedDisbursementTotal` in `packages/shared/src/modules/commitment-pooling/settlement.ts` filters exact `CONFIRMED` rows, while `getConfirmedSettlementAggregate` in `data-public-impact.ts` performs the public aggregate-only GraphQL read with the same state boundary. |
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
| `public.pool.*` | Garden page commitments section (`§ 02`) + `/impact` commitments band |
| `community.*` | `packages/community` (new package, same shared i18n pipeline) |
| `app.pool.exchange.*` / `cockpit.garden.pool.exchange.*` | pair picker, pair status, pool exchange feed, and acceptance summary |
| `app.pool.templates.*` / `cockpit.garden.pool.templates.*` | offer-template names, one-line explanations, defaults, and locale naming notes |
| `app.pool.terms.*` / `cockpit.garden.pool.terms.*` / `public.pool.terms.*` | first-exposure plain meanings and recognition/settlement explanations |

The garden page's own keys moved from `public.gardenDialog.*` to `public.gardenDetail.*` when the modal became a page (2026-08-19); dialog-only chrome keys (`close`, `loading`) and the old placeholder sections' keys were dropped. `public.pool.*` is still unallocated — zero keys exist today.

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
- **Admin rail and tabs** inherit roving tabindex from `AdminTabRail` (`packages/admin/src/components/AdminTabRail.tsx`); the new Confirm stage and Pool tab add no custom key handling.
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
| Editorial garden page | `packages/client/src/views/Public/GardenDetail.tsx` |
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

### C.26 Value over time, and the denominator rule (2026-08-17, round 26)

Afo, asked what Maria is making when she offers workshops all season: *"one thing she's able
to offer multiple times, and the key reason is how do we show the value of a commitment over
time. This is a tension I feel we need to solve well."*

**The two units are different objects, and that is the whole problem.** A commitment is the
unit of ACCOUNTABILITY: it opens, someone takes it up, evidence lands, it is confirmed, it
ends. Atomic and complete. An ongoing offer is the unit of VALUE, and its worth is the
pattern — twelve sessions across five seasons — which no single commitment can express. The
prototype had been treating the accountability unit as the star and the value unit as a
settings screen, which is why W34 read as a management console and why an earlier proposal to
shrink it to "saved terms plus Open more" would have deleted the point of the object.

**The denominator is what makes a record dangerous, not the record.** Appendix D.3 forbids
per-person rates, grades and comparisons on public surfaces. What enables all three is a
total: "4 kept · 1 lapsed" lets anyone compute 80%, while "12 sessions given" cannot be
turned into a score however it is arranged. So the public record counts only things that
HAPPENED and never states a total —

> Running since March · 12 sessions given · 9 neighbours took one up

Every figure is a numerator. The cost is deliberate and was accepted: this never
distinguishes twelve of twelve from twelve of thirty. The full kept-and-lapsed record stays
where D.3 puts it, with the member and their stewards. Pool-level figures such as a cycle's
"22 of 26 kept" are untouched: D.3 permits aggregates and only forbids the per-person case.

**Something I had introduced a round earlier was exactly the forbidden shape.** W34's
identity card carried `progressBlock({ rows: [{ label: "Taken up", done: 12, of: 14 }] })` —
a per-person denominator with a progress bar, on the offer's own screen. It is gone.

**The record leads the screen and rides the card.** W34 is now identity, then *What this
offer has given*, then what is open, then manage; the story stopped being a sub-screen you
reached from a ghost button at the bottom. The compact form sits on the pool card, because
that is where the decision is made: a neighbour scanning the pool sees this has been running
and giving before they tap, which is also the first visible reason an ongoing offer is worth
more than the same twelve offers made separately.

**A repeat can become a practice, but history cannot be back-filled.** `commitmentSeriesId`
is set at creation and commitments are immutable, so past one-offs can never be pulled into a
series. `W3@repeat-noticed` is the honest version: the composer recognises a title you have
offered before and asks whether to make it ongoing from here on, saying plainly that the ones
already made stay as they are. Without it, accumulating a record depends on a choice made at
step 1 before you knew it mattered.

### C.27 Stopping is one act (2026-08-17, round 27)

Afo, on whether operators rest and resume an ongoing offer or just stop: *"They just stop,
make rest and retire one control for now."*

**Sixteen of W34's states served a two-verb lifecycle nobody uses** — three Resting, three
Retired, six retire confirmations, three Resting edits, and a succession preview whose entry
point had already been deleted. Four remain: `stopped`, `stopped-none`, `stop-confirm`,
`edit-stopped`. The screen went from 35 states to 23, and W34 stopped being the largest
screen in the feature.

**The control calls `restCommitmentSeries`, not `retireCommitmentSeries`.** "They just stop"
describes what people do, not a demand for irreversibility, and rest is the call that
destroys nothing. This matters more since C.26: the record is now the centre of this screen,
and retiring would force anyone returning next season to start a new series with an empty
one. Stopping blocks new commitments, leaves open ones takeable, and keeps the record whole.
`retireCommitmentSeries` stays in the contract, unused by the UI for now, so nothing is
foreclosed if a real need for a terminal state appears.

The facts still say `Resting`, because the on-chain state is unchanged — only the vocabulary
and the number of controls collapsed. `resumeCommitmentSeries` therefore stays legal from a
stopped offer, which is what makes *Start offering again* honest.

Two smaller corrections found while verifying: the stopped state's chip read **Withdrawn**,
because the identity card's mapping had no branch for the new word and fell through to its
default; and the record block's *See every one* left the old *See the whole story* button
beneath it on four states, two paths to one screen.

### C.28 The lead is already on the team (2026-08-17, round 28)

**`leadProvider` is the offer creator** (contract-spec:520), and solo is a one-contributor
roster. So you are on the team from the moment the commitment exists, and the section's
"Nobody yet" empty state said the opposite. It starts with your card, marked Lead, beside the
add tile. There is no empty state, because there is never an empty team, and you cannot
remove yourself: someone has to be accountable.

The helper line drops to one fact tied to the act you are about to take —
*"Anyone you add can add evidence and submit work."* The lead rule moved onto the lead's own
card, where it is shown rather than explained, and the sending rule waits until sending
matters.

**Who confirms names the act, not the role.** *"The person you help"* described a category and
never said what confirming does. It reads *"Whoever you help says it was done"*, so the field
teaches the concept.

**Reviews gate on reading.** The act arrives disabled with its reason and enables at the end
of the scroll. Drawn as two states on the offer review, because the artifact is static and
both need to be visible; the rule is the same on all six.

**The ongoing view extends the offer view.** It was reading as a second product. It now runs
the commitment view's anatomy and adds only what a repeating offer has: what it has given,
what is open now, **how it repeats** (how much in each, how many at a time, which cycle, what
happens at season end — previously scattered through Details), and **who has taken it up**, as
people rather than a count.

### C.29 Section labels are headings (2026-08-17, round 29)

Measured first: client section titles were already uniform at 11px, 600, uppercase, grey,
across ten screens. There was no drift. What read as inconsistent was two different things
sharing a screen — the step card's heading (15px, 650, sentence case, inside a filled card
behind a 48px icon badge) and the section labels beneath it.

Afo prefers the heading style, so sections take it: **15px, 650, sentence case, ink**.

**This is a deliberate divergence from shipped**, recorded as such. `WorkView` renders an
`<h6>` for its sections and `Media.tsx:527` labels its Needed and Optional groups with
`text-xs uppercase`, which is why round 19 unified the client down to that metric in the first
place. The pooling flows will read differently from the shipped work flow until shipped
follows. The step card does not compete at the same size, because it is inside a filled card
and the sections sit on the canvas.

### C.30 Four corrections (2026-08-17, round 30)

**The repeat explainer is gone.** *"Offered this before? See what changes"* was a prototype
navigation affordance dressed as product copy. In the app the composer recognises the title
itself, so the title field carries the hotspot and no button asks the question.

**One plus on the team, not two.** The section title's plus and the rail's Add tile both did
the same job. The title keeps it, which is where Afo asked for it in round 19.

**Button labels are Title Case** on the client, 153 of them. Small words stay lower unless
they lead or close the label: *Read to the End*, *Make This Offer*, *Start Offering Again*.
Admin already used Title Case acts, so this is the client catching up rather than a new rule.

**The ongoing view is a full-screen read surface.** It carried the bottom nav while the
commitment view does not, and its acts sat at the end of the content. It now has no nav and a
fixed bar: the primary act per state, with Edit Details and Stop Offering in the bar's
secondary row.

### C.31 Units, one number, and a real extension (2026-08-17, round 31)

**Garden work does not choose a unit. It is hours.** Afo asked how one unit encapsulates work
spanning domains, and the answer is that it is not meant to: `requirements[]` carries what is
done and which domains, `unitLabel`/`targetUnits` carries how much of you went in. The UI was
still asking users to pick, and none of *beds / plants / barrows* fits a two-domain
commitment. There is also a systems argument: unit groups are keccak256 buckets that are
never summed and never converted (uiux-spec:1113), so a free choice fragments *what this pool
holds* into rows nobody can compare. Fixed to hours, the pool can say "48 hours of garden
work" and mean it.

Service offers keep the choice, because a ride genuinely is not an hour: **hours · sessions ·
rides · meals · repairs · other**, six chips that fill the row and belong to a service rather
than to a garden bed.

**One number, not two.** *How much in each* and *How many to open now* asked about a structure
the user had not been shown; "each" had no antecedent at that point in the flow. The composer
asks only how big one is and opens a single commitment. Opening more happens on the offer
screen, where the act has an obvious meaning because you can see what is already open. Six
amount options rather than three, so the row fills.

**The confirmer is whoever takes it up.** *"Whoever you help says it was done"* was
semantically right and read badly; *"whoever helps"* would have been the opposite of right,
because on an offer YOU are the helper and self-confirmation is forbidden. It reads
**"Whoever takes it up confirms it"**, and becomes their name and photo once someone does.

**The ongoing view is now actually an extension.** Last round it shared exactly one section
with the commitment view and I still described it as building on it. It renders the ongoing
blocks first, so the repeating nature is clear immediately, then the standard sections in the
commitment view's own order: Garden, Media, Details, People, Timeline. *Who has taken it up*
folded into People rather than duplicating it.

**Three defects, all introduced by me:** the section title's 6px bottom margin stacked on the
pagepad's 12px flex gap, which does not collapse with margins, giving an 18px gap under every
heading; the action bar's "secondary row" was never a row, so three labelled buttons shared
one 390px line and the primary wrapped two lines tall at 70px wide; and a solo team card sat
at 216px with dead space beside it instead of filling the width.

### C.32 The em-dash sweep, finished (2026-08-17, round 32)

The remaining client copy, on top of the 35 strings the offer flows got in C.25. Roughly 160
more across `client.ts`, `client-wallet.ts` and `kit.ts`.

The rule: a full stop where an independent clause follows, a comma where a trailing phrase
does. Applied by pattern and then read back, because the two cases are not mechanically
separable. One result needed correcting by hand, where a proper noun opened the second clause
and the pattern took it for a phrase: *"Add evidence as it happens, Ana asked for this"*
became *"Add evidence as it happens. Ana asked for this."*

**What keeps its dash**, deliberately:

- **Photo names.** *"North beds — before"* uses the dash to name a variant, not to punctuate.
- **Screen-library state labels.** *"1 · Intro — from a commitment"* is the prototype's own
  index, not product copy.
- **Prototype documentation.** Flow descriptions, scene notes and component-gallery rules are
  written for whoever is reading the artifact, and they are a different register from the UI.

Verified by walking 22 client states in the browser and reading the rendered text: zero
em-dashes in product copy.

### C.33 The request-flow pass (2026-08-17, round 33)

The same walk the three Offer flows got, across all eleven request states. Three defects, and
two of the three were mine: changes made for offers had been applied globally without asking
whether a request works the same way.

**A garden-work ASK still picked a unit.** `request-work-howmuch` offered *hours · sessions ·
beds · other*, while the equivalent offer path had been fixed to hours-only in C.31. It is the
same commitment kind, so it is counted the same way. The picker is gone and the step reads
*How many hours*.

**Every review said "What you're committing to".** On a request you are asking, not
committing. `w3Review` had one label for all six casts; it now takes `asking` and the three
request reviews say *What you're asking for*.

**The details step contradicted its own review.** The C.31 sweep replaced the confirm default
everywhere, so a request's details step said *"Whoever takes it up confirms it"* while the
same flow's review said *"You, because it was your request"*. On a request YOU confirm: it now
reads *"You confirm it, because you asked"*, and on a garden-work ask *"You confirm it once
the stewards have approved the work"*.

**A request has no team.** The section showed your card marked Lead and said *"Anyone you add
can add evidence and submit work"*, neither of which is true when you are asking. `leadProvider`
for an Individual Request is the **counterparty** (contract-spec:520), and whoever takes it up
brings their own people, on their side, after acceptance. The three request details steps are
**Who confirms** and **Media**, and their step card names two things rather than three. The
ask composer is now shorter than the offer composer, which is honest: you are asking for less
setup, not doing less.
### C.34 The request-flow second pass (2026-08-17, round 34)

**The review is one card shape.** It had three: Garden was a section card, the details were
FormCards, and Who confirms and Media were flush sections. Everything is a FormCard now,
including Garden and Who confirms. Media stays a section, and that is the one justified
exception: it holds a thumbnail strip rather than a value. *What you're asking for* and *How
much* had also shared `hand-heart-line`; each card now carries its own icon.

**Amount pickers fill the row.** Four options left a ragged half-row on every path. Six now,
which is what fits a 390px phone at two lines.

**The claim-mode options are the same length.** *"approved work is the gate. Help that is not
approved never reaches Ready"* wrapped to two lines while its sibling ran to one, so the two
cards were different heights. Both read *"the first neighbour to say yes takes it on"* and
*"your stewards choose who takes it on"*. The service ask also said *neighbor* where the rest
of the client says *neighbour*.

**The steward G$ banner is gone.** It sat at the bottom of the how-much step explaining that
nothing moves until the commitment is confirmed, which the review already states at the point
someone is checking terms.

**An open request is the pool tab, not a landing page.** `W1@request-work-open` had no section
header, no filters, one card, and a screen-level *I can help* — the one place in the feature
where an act sat on a browse surface. It is the ordinary pool tab now, with the request among
everything else; taking it up happens in the commitment, where that act already lives in the
fixed bar. `w1.take-up-work-request` retires with it.

### C.35 Offer another (2026-08-17, round 35)

*"Open More"* was doing two wrong things: it borrowed **open** from the retired *places*
vocabulary, and it hid what the act does.

**The architecture it names.** `CommitmentSeries` is the ongoing offer and is **never
takeable**; only the `Commitment` rows it produces are, each carrying `commitmentSeriesId`.
Starting an ongoing offer is `createCommitmentSeries` followed by one `createCommitment`.
Making another is the second call again, with the same terms: a new, independent, takeable
commitment. So the series is a template plus a ledger — it holds the terms so you do not
retype them, and it groups the commitments so the record accumulates.

The label is **Offer Another** (**Offer One** when nothing is open), which is the flow's own
verb: you are making another offer on the same terms.

**Open survives as an adjective, not a verb.** A commitment that is takeable is *open*, so
*Open now* and *2 open* stay. What changed is every use of open as the act — *"Opening one
creates a real commitment"* became *"Offering one makes a real commitment"*, and W35's own
title is *Offer another*.

Three facts the label has to carry, all of them contract truths: creating one **reserves your
capacity immediately**, which is why it is a real act rather than a display toggle; each
commitment is **independent**, with its own confirmer, evidence and outcome; and terms are
**prospective only**, since `updateCommitmentSeriesMetadata` never rewrites a commitment
already made.

### C.36 The admin-console pass (2026-08-17, round 36)

Walked all twelve console screens. **Admin was already clean on the two things the client
kept failing**: every section title measures 13.5px/700 with no drift, and every act is Title
Case. The cockpit dialect held.

What it was carrying instead was **stale vocabulary**, in three layers:

**Verb breakage from the promise→commitment rename.** Three sentences read *"before neighbors
can commitment"*, *"nobody can commitment yet"*, and *"a season it can commitment into"*. That
sweep was recorded as fixed at the time; it was fixed in the client and never checked here.
`commitment` is the record, `commit` is what you do with it.

**"Places" survived here after the client retired it.** W7's ongoing-offer rows said *"3
places made · 1 open now"*. With C.35's verb settled they read *"3 offered · 1 open now"*, and
the resting row now says *stopped*, matching C.27.

**"neighbor" against the client's "neighbour".** Ten in the console, thirteen more in the
kit, the components gallery, the journeys, the editorial screens and the lo-fi frames. The
kit one mattered most: `poolHoldings` defaulted to `{ one: "neighbor", many: "neighbors" }`,
so the holdings block rendered American in both dialects.

**Em-dashes, 71 rewritten**, by the same rule as C.32. A few list separators read better as a
colon: *"Units stay in their own bases: hours, rides and sessions"*.

Verified across all twelve screens: zero em-dashes, zero stale vocabulary, one title metric.

### C.37 The retired-vocabulary gate (2026-08-17, round 37)

Every vocabulary decision in this feature leaked a dialect. Places was retired in the client
and survived in the console. The promise→commitment rename was **recorded as done** and left
*"nobody can commitment yet"* standing for three weeks. Neighbour was fixed in the client
while `poolHoldings` kept defaulting to the American spelling, so both dialects rendered it.
The build gates catch structure well and copy not at all. This closes that.

`RETIRED_VOCABULARY` in `validate.ts` guards the retired SENSE, not the word, so *"in place"*
and *"an open request"* stay legal:

| guarded | decision |
|---|---|
| `promise` as the record | C.14 |
| `commitment` used as a verb, and `commitmentd`/`commitmenting` | C.14 |
| `place` as a countable commitment | C.23 |
| `open more` / `open another` as the act | C.35 |
| `neighbor` | C.36 |
| `rest`/`retire` on an ongoing offer | C.27 |

Each entry names the decision that retired it, so whoever trips the gate reads the reason
rather than guessing. It runs on every rendered state, the components gallery, journey prose
and hotspot notes, and it is an error everywhere including the ascii frames: a word a decision
removed is removed everywhere, or it is not removed.

A second rule, `DASH`, keeps em-dashes out of **product** copy. Hotspot notes and journey prose
are exempt by C.32's own boundary, and names that use a dash rather than punctuation are
listed rather than pattern-matched, so adding one is deliberate.

**The gate found 338 on its first run**, including thirteen vocabulary leaks in screens no
manual pass had reached: `promised` and `promising` in hotspot notes, `open more` on the
wallet's series row, `Resting`/`Retired` still on W7's ongoing rows, `to commitment` in a
journey and in W21, and four surviving *places*. Two forms my sweeps had structurally missed
also surfaced: dashes followed by a digit or a quote, which a letter-only pattern skipped.

Reporting is per occurrence rather than per surface, because one-at-a-time reporting turns a
copy sweep into a dozen rebuild cycles. Verified by reintroducing all three retired words at
once and watching the build fail with the decision named beside each.

### C.38 Proof, equal halves, one radius (2026-08-17, round 38)

**Evidence becomes proof** in everything a gardener reads. The word borrows from legal and
forensic register and implies you are answering a doubt, which is the opposite of what a
mutual-aid pool is. `attachEvidence` and `EvidenceAttached` stay: they are contract
identifiers, and hotspot notes name them the same way `leadProvider` renders as "Lead". 375
strings changed. The gate learned it as `RETIRED_IN_UI`, a **product-copy-only** list, so a
note that names the contract call does not trip.

That rename is also where hotspot ids, state ids and journey targets nearly went with it: a
blind sweep renamed `w2.add-evidence` and `W2@support-evidence-queued`, which are deep-link
addresses. The build caught all 104 through its own EMITTED/ORPHAN/DESTINATION rules, and the
lo-fi frame's `[Review evidence]` marker had to move together with the frame text it matches.

**Two acts in a bar are equal halves.** Sized to their own text they came out at 131 and 124
in a 358px bar, so the pair looked ragged and the target position moved between screens.
`barPair` makes them one element, which is also what keeps the capture bar's icon run out of
the rule: that is a run, not a pair. 16 bars converted; both now measure 174.

**A review is one radius.** 24px section cards sat above 14px FormCards, so every review was
rounder at the top than the bottom. 24px is the BROWSE card radius, and a review is a list of
facts rather than a set of cards you tap, so the review stack is 14px throughout. Applied
through a `.revw` wrapper rather than by changing `sectionCard` globally, since read surfaces
keep the browse radius.

**Work can be untied at review.** The Fulfills row gains *Not for a Commitment*, which clears
the tie so the work submits as ordinary garden work. Nothing on chain has happened yet, so it
is a local edit to the draft. Going back to the intro already did this; nothing told the
reviewer the choice was reversible.

**Two answers, recorded because they are contract facts rather than design choices.** Take
This Up is a separate act because `claimCommitment` moves Offered → Accepted and is what
records you as the provider — `linkWork` verifies the attester is the lead or an active
contributor, so there is nobody to submit work as before it lands, and an open offer is
takeable by one person, so taking it up reserves it. And proof asks who helped because
`creditedContributors` is an **argument to the call**, written on chain with the proof: the
roster says who may participate, the credit vector says who actually did on this occasion.

**One push-back accepted.** The Submit Work media step already mirrors `Media.tsx` — count
badge, Needed and Optional pill groups, real thumbnails, the on-device line. The inconsistency
is that the POOLING proof step draws one list instead, so the same act has two shapes. Not
changed this round.

### C.39 The composer and the read surface are different (2026-08-17, round 39)

Afo: *"go take a look at the actual client code for submit work media step. And we are not
using a grid."* Correct, and my C.25 note claiming the step already mirrored `Media.tsx` was
wrong. So was the round-23 work under it.

**`Media.tsx:690` is `flex flex-col gap-3`.** The two-column grid is `md:` only, and the
prototype's phone frame is 390px, so the grid **never applies**. What a gardener actually sees
is full-width photos at `aspect-4/3`, stacked vertically, each large enough to check before
sending, with a remove control pinned over the image at `top-2 right-2`.

**The read surface is a different component.** `WorkView.tsx:102` renders a `Carousel` of
`max-w-40 aspect-3/4 rounded-2xl` items: narrow, portrait, scrolled sideways. Composing you
manage the photos; reading you glance at them.

I had built ONE builder for both and got both wrong: 60×78 landscape tiles at a 10px radius,
which is neither shape.

| | shipped | was | now |
|---|---|---|---|
| composer | 358 × 268, 4:3, stacked | 60 × 78 strip | `mediaStack`, **358 × 269, 4:3** |
| read surface | ~160 wide, 3:4, 16px radius | 60 × 78, 10px | `mediaStrip`, **150 × 200, 3:4, 16px** |

Applied to all three composer steps: Submit Work's media step, the proof flow's, and
creation's details step. A voice note, link or written note stays a row in the stack, because
it has no picture to draw.

**The lesson is the one worth keeping.** Two surfaces showing the same object are not
necessarily the same component, and "mirrors the shipped step" is a claim that needs the file
open, not a memory of having read it. I made that claim twice about this step.

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

### C.40 Commitments get their own sheet (2026-08-17, round 40)

Afo: *"I would like to explore giving commitments for a user it's own sheet and remove it as a
tab from wallet and add to the header enabling us to have tabs specific to commitments."*

**What made this cheap.** The shipping Commitments tab renders `ComingSoonStub`
(`views/Home/WalletDrawer/index.tsx:69`). Nothing had to be migrated, and `ModalDrawer` already
takes a header, tabs, per-tab counts and a 95vh max height, so the new sheet is the same
component with different children.

**Why a tab was the wrong container.** The wallet's other two tabs are BALANCES: one fungible
number each, no lifecycle, nothing waiting on you. A commitment is a relationship with a
lifecycle. W5 already carried scope chips, per-garden sections, an attention inbox, retry and
discard recovery, and a nav row into private drafts. It was a screen wearing a tab, and the
wallet now holds the two things that really are balances.

**The header control, and why it is badged.** `WalletDrawer/Icon.tsx` carries no count at all,
so four things needing an act from you were invisible until you opened the drawer and read a
pill. `WorkDashboard/Icon.tsx:73` already badges a header control, so the pattern is shipped.
The commitments control sits between Wallet and Work, which puts the two badged surfaces
adjacent. Four 44px controls plus `gap-2` take 200px of the 358px content row, leaving 158px for
the title — measured, not assumed. The glyph is `hand-heart-line`: the sprite has no
`hand-coin-line`, and seedling or plant next to Work would read as a second Garden control.

**Tabs are the three objects, not three filters.**

| tab | object | why it is its own plane |
|---|---|---|
| Commitments | `Commitment` | the ledger, grouped by garden; scope chips stay INSIDE it |
| Ongoing | `CommitmentSeries` | the machine that opens commitments, not one of them |
| Saved | signed offchain details | no garden, no pool, not a commitment until offered |

Making the SCOPES the tabs was the alternative and was rejected: round 10 settled that scopes
filter one list rather than drawing separate copies of part of it, and tabs would reverse that.

**Two round-12 workarounds retire.** Round 12 split "Things I can offer" into a tool row above
the ledger (the private draft) and a parent card inside a garden section (the ongoing Offer).
Both existed because the surface had one plane. The draft is now content on the Saved tab; the
series is on the Ongoing tab, because a series is a different object from a commitment even
though it has a garden. The ledger holds exactly one kind of thing again.

**W32 becomes the saving flow it always was.** Its list states moved into the tabs, taking it
from 16 states to 8: compose, choose-path, draft-unsaved, saving, save-failed, offline-local,
version-conflict, persistence. Keeping both would have left two surfaces drawing one list, which
is the duplication the tabs exist to end. Eight state-level aliases keep the old deep links
resolving.

**The empty state changed job.** The control is always in the Home header, so `W5@empty` is now
also the first thing a member of a garden without pooling sees. It has to read as an invitation
with a way in, not as a report of absence.

### C.41 Recovery per tab, and the badge sum rule (2026-08-17, round 41)

Round 40's aliases pointed `W32@loading` and `W32@read-error` at `W5@loading` /
`W5@read-error`, which compute tab 0 — so a saved-details deep link rendered "Couldn't load
your commitments" over the ledger. **Each tab reads from its own source, so each carries its
own recovery in its own words.**

**Badges follow one rule.** A tab pill counts what needs an act *on that tab*; the Home header
control carries their **sum**. The two can never disagree because one is derived from the other.
A pill never counts inventory — "2 ongoing", "1 saved" is engagement counting, which the
regenerative lens rules out (review-checklist Lens 1.5).

The Ongoing tab also gained its creation act in the populated cast, not only the empty one. A
tab that stops helping the moment it holds something is a tab that only works once.

### C.42 The tense split, and the steward's third tab (2026-08-17, round 42)

Afo: *"A and B titles are repeating the name of the sheet."*

**The rule the wallet already states.** "Wallet" is a place; "Cookies · Tokens" are things. The
container word and the object words are never the same. Round 40 broke it: the sheet and its
first tab were both **Commitments**.

**Renaming could not fix it.** Every synonym failed a truth test — "Live" contained Kept,
"One-time" contained series-opened instances, "Agreements" was a second dialect for one object.
The truthful name for that content *was* "Commitments". So the fix was to change what the tab
holds until a different name became true.

**Split by tense, not by object.** Everything is either still moving or it is settled:

| tab | holds | why |
|---|---|---|
| **Live** | in motion, queued, disputed, waiting on someone | Kept leaves, so "Live" is finally true |
| **Over time** | your record, the series you run, kept history | the composer's own phrase (`Offer it over time`) |
| **To confirm** | steward Hats only — authority confirmations | see below |

**Kept leaving Live collapsed the lifecycle chips**, and the freed row took **All · Offers ·
Requests** — the pool tab's own filter words (`client.ts:644`). Direction was Afo's instinct in
round 41; it belonged at chip level, not tab level, because a confirmation duty can sit on
either direction. The garden surface and the personal sheet are now one grammar at two scopes.
What needs you is not a chip: it leads the sort, carries the warn chips, and drives the badge.

**Over time stops being a list.** It opens with your record across gardens — numerator-first,
per garden, per unit basis, never a cross-basis sum (Appendix D.1). Your own lapsed count is
visible because D.3 scopes per-person rows to steward and self, and this is self. That is the
standing purpose, which had no home in any previous arrangement.

**The steward tab, and why it is not a duplicate.** There are two kinds of confirmation duty,
and only one of them is new:

- **Counterparty confirmations** — you asked, someone delivered. That commitment is *already in
  your ledger*. It stays in **Live**; pulling it out would duplicate it or teleport it mid-life.
- **Authority confirmations** — garden claims where the garden itself is the counterparty (its
  steward/owner Hat wearers are the **ordinary** confirmers, `contract-spec.md:1421`), plus
  reasoned fallbacks. These reach you through your **Hat** and were never in your personal
  ledger.

Only the second kind is on **To confirm**, so the tab creates no second copy of anything and
round 10 stands. Its conditional presence is honest because the *content* is role-conditional,
not the chrome. It is the phone twin of the admin Hub's confirm stage (§6.9) for a field-first
product; the Hub stays the desk tool.

**Saved details left the sheet.** They are input material, not a record, which is why no tab
name ever fit them. They live at composer step 1 now — "start from something saved" beside the
template chips, with the save flow (W32) entered from the same row. The sheet's subtitle also
gained the missing third relationship: you *ask for* things here too, not only offer and take up.

### C.43 The sheet is four regions, and acts live in the footer (2026-08-17, round 43)

Afo: *"I'm not able to scroll on the different tabs and the whole tabs right now are scrolling
when they should be fixed."*

**One root cause under three complaints.** The shipped `ModalDrawer` is a four-part panel; the
prototype had collapsed it into two.

| shipped (`ModalDrawer.tsx:113-193`) | | prototype before |
|---|---|---|
| `panel` — `h-modal`, **height 85dvh** | fixed size | `max-height:88%`, content-sized |
| `header` — `flex-shrink-0` | fixed | `.sh-t` title only |
| `tabs` — `flex-shrink-0` | fixed | **inside the scroll body** |
| `content` — `flex-1 min-h-0` | the only scroller | held subtitle + tabs + content |
| `footer` — `flex-shrink-0`, safe-area | fixed | **absent** |

So the tabs scrolled because `commitmentsShell` passed the subtitle and rail as part of `inner`;
the confirmation sheet was a different height because `.sheet` is a max-height while
`.sheet.drawer` is a height; and with no footer, W4 stacked two full-width buttons inline at the
end of its content. That last one is the shape the validator's one-row rule forbids — it escaped
the check only by not being inside an `actionBar` at all.

`sheetOver` now takes `sub`, `tabs`, `footer` and `close`. Only the content scrolls, verified:
body 585px clipped to 542px with the rail moving **0px**. Both sheets measure **574px**.

**The tab rail adopts the shipped anatomy** — full-width equal segments with a 2px indicator and
a rule beneath, not the pill segment control — plus the close button the prototype's sheet never
had. The direction chips stay in the scroller, with the list they filter, which is where the
pool tab already puts them.

### C.44 A hero is a moment, not a state (2026-08-17, round 43)

Measured on `W2@fulfilled` at 390px: the identity card ran **272 → 1318px**, and the status band
sat at **1318px** — two screens below the fold, on *every* state, not just kept. Nothing about a
status message wants to be read after the people and the progress bars.

Status now sits above the identity card (**272px**), and `W2@fulfilled` draws a compact kept row
rather than a hero. `W4@confirmed` keeps the full celebration, because that is when it happens.
Re-firing a hero every time someone opens a finished commitment stops it meaning anything. The
settled states already drew the compact form, so this makes `fulfilled` consistent with them.

### C.45 Every act in the bar, and the sheet's two answers (2026-08-17, round 43)

**Team.** `W2b@forming` rendered **"Add People" twice from the same hotspot** — secondary inside
the roster card, primary in the bar — alongside "Assign Work" and "Remove Someone" also embedded
in the card. That drifted back from round 19's every-adder-in-the-bar rule. All three are in the
bar now, using round 31's `.fbrow` shape: primary on its own row, the two rarer acts on a second
row. Three buttons sharing one line is what failed in round 31; two rows is not that.

`setup`'s primary was **"Save and Go Back"**, which named the navigation rather than the act —
now "Save Team Settings". `recognition` is an explainer that had no way out but the back chevron,
and now dismisses itself.

**The not-yet label.** These sheets ask a question — *"Commitment kept?"*, *"Did the help
arrive?"* — so the two buttons should be its two answers. "Confirm Help Arrived" is an answer;
**"Tell the Stewards Why" named the next screen**. The label was already inconsistent: three
states said it while `not-yet-request-work` said "Not Yet". Standardized on **"Not Yet"**, which
is also the admin Hub's own word for this decision (§6.9).

**Not changed, flagged.** The commitment view renders its title twice — once in `hdr`, once in
the identity card. And the team picker lists nine rows then says *"Rocinha has 23 gardeners,
scroll for the rest"* with no search; the shipped `Gardeners.tsx` has no search either, so adding
one would be invention rather than mirroring.

### C.46 The identity card carries no title (2026-08-17, round 44)

The commitment view printed its name twice — once in `hdr`, once as the identity card's `.idt`.
W34 was worse: `w34Head()` and `w34Identity()` each hardcoded the same literal string.

**The shipped surface settles which one goes.** `WorkView` opens with a `FormInfo`, and that
FormInfo's title is **never the work's name**. `WorkViewSection.tsx:197-246` returns a state
phrase for it: *"Work Approved"*, *"Evaluate Work"*, *"Your Work Submission"*, *"Saved on your
device"*, *"Sending didn't work"*. So identity belongs to the screen header, and the first card
says where the thing stands.

The prototype already had that shape after round 43 moved status above the identity card. The
title on the card was the only thing left duplicating. It is gone, and the chips lead instead —
which is the same rhythm as shipped: an unlabelled first card, then the `h6`-labelled sections.

`title` stays an optional parameter for any surface that has no header of its own.

Reading order at the top of `W2@fulfilled` is now: **Prune the north beds** → *Commitment kept ·
Confirmed by João* → `Offer · Fulfilled · AGRO` → the people → what's been done. Name, then
where it stands, then its facts, each said once.

### C.47 Search in the team picker (2026-08-17, round 45)

I had flagged this as invention, since the shipped `Gardeners.tsx` has no search. It isn't:
`RecipientPicker.tsx` is a person-picker inside the wallet drawer and it has one.

**The control mirrors it** — a plain full-width text input above the results
(`RecipientPicker.tsx:96-103`). The one deliberate difference is a leading glyph: that picker
doubles as a paste-an-address and ENS field, so a magnifier would mislabel it; ours only ever
searches.

**It searches names, which that picker cannot.** `RecipientPicker.tsx:54-56` records why: *"person-name
search is limited to the ENS input path — resolving every member is too costly."* That cost is
a function of its scope, which is every member of every garden. This list is **one garden's
roster**, already rendered with names on screen, so matching them costs nothing more. Address
matching stays, because a member with no name on file *is* an address, and searching "to" should
find Tomás and `0x74…c2` alike — you rarely know which form a person appears in.

**It rides the sheet's fixed chrome**, not the scroller — the same rule round 43 applied to the
tab rail. A control that filters a list must not leave the screen while you read the list it
filters. `sheetOver` gained a `chrome` slot for this; RecipientPicker leaves its input in flow,
which is defensible for its short list and wrong for twenty-three names.

Three casts: the full roster, a query matching two of twenty-three, and no match. The no-match
state names the real remedy rather than dead-ending — only garden members can join, so someone
missing has to be welcomed into the garden first — and it drops the footer, because there is
nothing to add.

### C.48 The admin-console review (2026-08-18, round 46)

Round 36 swept admin for vocabulary. This is the structural pass, run with the lenses that found
the client's defects.

**Most of it held.** Admin dialogs already have the four-region anatomy the client sheet was
missing — `dlg-head` fixed, `dlg-body` the only scroller, `dlg-foot` a pinned action row. Zero
duplicate dialog titles, zero empty footers, zero full-width buttons stranded in a dialog body.
W10 is the strongest screen in the prototype: 19 states, every one with a proper footer. W12
matches §6.360 in full. **The client sheet was the outlier, not admin.**

**The route header and tab rail now pin as one band.** The header was `position:sticky`; the rail
was not. Scrolling a queue 300px moved the header 12px and took Work · Assess · Certify · Confirm
· History off the screen — the stage navigation vanished exactly when a long queue made it useful.
Shipped pins its rail (`views/Hub/index.tsx:102`). Pinning them together also fixes the header's
`background:transparent`, which would have let rows scroll visibly through the title. Measured
after: the rail moves 12px at 400px of scroll, with zero content bleeding through.

**The confirm queue can now confirm.** §6.9 specifies the row as *"promiser, commitment title,
garden, N-of-group progress, a visible eligibility badge, and confirm / Not yet actions opening
the AdminDialog detail."* W13 had the badge and the progress; the two actions were missing, so
the whole row was a single hotspot into W10 and a steward triaging thirty rows had to open every
one. The Work stage beside it already used `decisionRow`; the Confirm stage never adopted it.

Both acts open a dialog rather than firing: a fallback confirmation takes a mandatory reason
(`contract-spec.md:1422`) and Not yet calls `raiseDispute` with its own, so neither can be a
one-tap act from a list. The disputed row carries **Resolve** instead — a frozen commitment is
not confirmable, and offering Confirm on it would be a dead control.

**Nine recovery states across the four queue surfaces.** W13, W12, HUBWORK and W24 read from the
indexer and had no loading or read-error cast between them, so a failed read rendered as an empty
stage — a steward would read "nothing waiting on you", which is the opposite of the truth. The
client's equivalents have carried these since round 41.

**Two casing outliers fixed, one question recorded.** Admin footers were 55 Title Case against 2
sentence, with two footers mixing both: `W10@cancel` read *"Keep commitment | Cancel Commitment"*,
and the garden-fallback act appeared in both casings. Admin has effectively committed to Title
Case, so the two outliers moved to match. **Open**: review-checklist Lens 4.15 says admin buttons
should be *sentence* case, which would make it 55 wrong rather than 2, and shipped admin is itself
inconsistent ("Add Input" beside "Add members"), so it cannot settle the question. Deferred to
when admin UI is built.

**"Rest the cycle" retired.** C.27 retired "rest" on the client, where an ongoing Offer stops.
Carrying it on the cycle-close wizard left one word meaning two things across two surfaces. The
honest word was already in the contract: a cycle's terminal transition is Reconciled → Composted
via `compostCycle(cycleId)` (`contract-spec.md:206`). Step 4 is **Compost**. The C.27 gate missed
this because its pattern requires "offer" nearby; a second rule now guards rest as a lifecycle
verb against cycle, season, campaign and pool, leaving "the rest of the list" legal.

### C.49 The assessment review (2026-08-18, round 47)

The timing-first rebuild holds: step 1 asks what the assessment is *for* and *when*, and derives
the wire kind from attribution plus history rather than making a steward pick "baseline vs delta".
The rail draws the three shipped steps, honouring §6.6's "extend, not fork". Three gaps.

**The one flow that cannot queue had no failure state.** §6.6: *"Remains a direct attest (no
offline queue); failure surfaces inline per the existing flow."* Every sibling creation flow has
its failure cast — `W32@save-failed`, `W2a@failed`, `W4@not-yet-failed`, W3's queued and failed —
and assessment, the only one that *cannot* fall back to a queue, had none. Failure is therefore
the only thing that can happen to it, and it was the only thing never drawn.
`W14@attest-failed` keeps everything entered on the step and says plainly that there is no queue
holding the attempt.

**And no offline state.** Same root, opposite end: `W14@offline` says so at **step 1**, before
three steps of work, because this form is not a draft and nothing is kept. Every other flow can
promise to send later; this one has to be honest that it cannot.

**No assessment could be read, anywhere.** Across all 44 screens no state rendered a recorded
assessment's contents. The Assess stage listed rows that did not open — on the one stage whose
whole subject is assessments. The sharpest consequence sat inside the flow itself: **writing a
delta means comparing against a baseline, and the baseline could not be opened.** Step 1 asked
you to pick *"Compared with: Starting record, AGRO, Jul 2"* from a dropdown with no way to read
what it said, and W10's attach picker offered the same bare labels while asking you to vouch that
an assessment applies to a commitment.

`W14@record` is that view — domain, kind, who attested and under which hat, what it was for,
reporting period, the strategy kernel, and the actions. Read-only, because a correction is a new
assessment referencing this one. It is an `AdminDialog`, per the cockpit rule that every detail
and inspection flow is a centered dialog, and it is reached from all three places that referenced
an assessment: the Assess stage row, the delta step's comparison, and W10's attach picker. It
offers **Write a Re-assessment**, since reading a baseline and writing its delta belong together.

**A latent trap found while building it.** `w14`'s return read
`next: state === "kernel" || state === "harvest" ? next! : hot("w14.continue", …)` — it named the
two states allowed to set their own advance, so any state added later silently rendered "Continue"
and dropped the button it had built. Both new states hit it. It is `next || <default>` now.

**Not taken this round** (recorded, still open): the duplicate-baseline rule and the
Evaluator-hat gate are both described in prose but never drawn. §6.6 says the form *validates* one
baseline per (garden, cycle, domain) and *points duplicates at the existing record*; today a banner
describes that and no state shows it fire. Delta renders only for Evaluator-hat holders per
`contract-spec.md:760-761`, but the When radio is fully interactive, so a steward without the hat
can walk to step 3 before being refused. W11 draws both of these correctly for its own rules.

### C.50 The two assessment rules, drawn (2026-08-18, round 48)

C.49 left both recorded as prose. They are states now.

**`W14@duplicate` — a starting record already exists.** §6.6: the form *"validates one baseline
per (garden, cycle, domain) and points duplicates at the existing record."* The derived line stops
claiming a kind — *"Records as: Nothing yet"* — an error banner names the collision, and the
existing record appears as a row that **opens** (the read view from C.49 is what makes "points at"
mean anything). Step 1 offers no Continue, because there is nothing it could record.

Its remedy is the delta path: **Measure Again at the Close**. Someone hitting this wanted to
measure the same domain again, and that is exactly what a re-assessment is for, so the block ends
in the flow they actually needed rather than a dead end.

**`W14@no-hat` — the Evaluator gate.** §6.6 and `contract-spec.md:760-761`: baseline allows
evaluator or operator; delta is Evaluator-hat only.

The spec says delta *"renders only for Evaluator-hat holders"*, which read literally means hiding
it. **The timing-first rebuild makes that reading wrong.** That rule was written when a steward
picked the *kind* directly; the flow now asks for *timing* and derives the kind. Hiding a timing
choice for an authorship reason would remove a legitimate option with no explanation, and the
person would never learn the rule.

So "At the close" renders **disabled**, carrying the reason in its own meta — *"records as a
re-assessment, which only an Evaluator Hat can attest"* — with a banner naming which hat the
reader holds and a **Who can** row naming the evaluator who can. The resolver still enforces it;
this only changes what the steward is told. Step 1 keeps its Continue, because a steward recording
a starting record is legitimate and unblocked.

New kit affordance: `radio()` takes `disabled` per option, rendering `.ro.off` — legible label,
inert dot. **An option someone cannot use should still be visible**, so they can see what exists,
why it is closed to them, and who can open it.

### C.51 The run-the-season review (2026-08-18, round 49)

**This is the best-built area in the prototype, and three things I went looking for were not
there.** Worth recording, because each was a plausible claim I would have been wrong to make:
W11's gates already disable Continue on both `invalid-sum` and `setup-how-blocked`, so neither
can be walked past; reason capture matches the contract signatures exactly, with inputs on
`pause-confirm` and `cancel-cycle-confirm` and none on close, compost or reopen, because
`pausePool` takes a `reasonCID` and `closePool`/`compostPool` do not; and W26's four paused
variants are not duplicates, each carrying what staying paused means for that step. Coverage is
31 pool states with a confirm on every destructive act, and seven guided flows from opening the
first season through cancelling one to composting the pool.

**A chain of writes needs per-step failure, and there was none.** Closing a season is
`closeCycle` → mint an **irreversible** certificate → `compostCycle`. Opening one is
`openPool` then `openCycle`. First-run setup submits **six writes in order**: `setPoolCharter`,
`setProviderOpenCommitmentCap`, `markPoolReady`, `seedCycle`, `openPool`, `openCycle`. Not one of
these flows had a failure cast, while W21 beside them carries two and W14 gained one in round 47.

A generic "it failed" is useless on a chain — the steward's question is *what already landed*.
Five states, each answering it:

| state | what landed | what did not |
|---|---|---|
| `W26@close-failed` | nothing; the season is still open | the close |
| `W26@mint-failed` | the season is closed, bundle locked at Reconciled | the certificate |
| `W26@compost-failed` | closed **and** the certificate is minted | composting |
| `W11@setup-failed` | charter, cap, ready-mark, pool open, season seeded | the season's shares and opening |
| `W11@open-failed` | the pool opened | the season's allocation and opening |

Each retry repeats **only the unlanded call** and says so, because a retry that re-ran the earlier
writes would either revert or double-record.

**`w11Facts` had to be corrected with them.** It declared every `setup-*` state `pool: NotReady`,
which is true right up until five writes land — `setup-failed` and `open-failed` are `pool: Open,
cycle: Seeded`. Leaving that wrong would have fed a false fact to the validator's call-legality
checks.

**Two round-46 leftovers.** The close wizard's step 4 was renamed to **Compost** but its button
still said *"Archive Season"* — one word for one act now, the contract's own. And the paused twin's
label still read *"Paused · 4 · Rest the cycle"*: the round-46 rename matched only the unpaused
string, and the vocabulary gate did not catch it because screen-library state labels are exempt
from the product-copy scan.

**`W7@read-error`.** The pool tab is the garden's main read surface and had loading but no read
error, while its own child `W7C` carried both.

### C.52 The Green Goods operations review (2026-08-18, round 50)

**The money path holds its own invariants better than anything else in the prototype.** `requeue`
is gated on an authenticated failure — `W21@failed-recovery` states it: *"An authenticated route
failure permits an explicit next attempt. Delivery delay alone never does."* `delivery-delayed`
refuses to be a failure, calling itself *"a derived operational condition, not a contract mutation
or payment failure"*. `acknowledgment-pending` carries *"A delayed acknowledgment never invokes
the Safe route again."* `outcome` states that duplicate terminal acknowledgments *"are emitted,
ignored, and remain observable; they never mutate the settled source state."* W24's two capability
gates are both drawn.

**And the one exit for stuck money did not exist.** The settlement machine reaches `Failed` two
ways: an authenticated failure acknowledgment, or the owner-only `failStrandedSubject`
(`FailureCode.SourceStranded == 12`). The first was drawn everywhere. The second appeared nowhere
in 44 screens — no mention of stranded, the grace window, or the retired peer.

Decision Log #60 exists because without it the funds are trapped: *"requeue requires `Failed` and
`cancelDisbursement` accepts only `Queued|Failed`, so a `Dispatched` child would be
unrecoverable."* The prototype had drawn the security half of that decision (authentication
against the live peer) and not the liveness half.

**It is a choice, never an outcome.** Grace is *"a liveness window, not a timeout-based failure
oracle"*, and the module *"never silently requeues, cancels, overwrites, or pays a replacement
command merely because grace elapsed"* (settlement-spec §3.1.2). So `W24@stranded` presents both
of the owner's roads — extend the bounded grace after re-verification, or escalate the disposition
— and says outright that grace expiring proves nothing about the payment.
`W24@stranded-failed` then shows what it bought: the attempt is over, no G$ moved, nothing was
confirmed, and requeue or cancel is finally legal.

**Two things the build caught while it went in, both worth keeping.**

The CONFIRM rule rejected the reason field I first drew: `REASON_CONFIRMS` is an allow-list built
from the contract, and inventing a reason teaches a signature that does not exist. Checking it
surfaced a **spec gap** — `failStrandedSubject` is named in §3.1.2 and in the `FailureCode` enum
but has **no entry in that spec's own permission matrix**, where every other source-side call is
listed with its signature and caller. Every reason-taking call declares `reasonCID` explicitly, so
the artifact draws this one bare and says so on the surface. The signature needs settling in the
spec, not in the prototype.

Then `CALL_RULES` had no entry for it and the validator crashed rather than passing it through —
the right failure. It is now `{ key: "disbursement", allowed: ["Dispatched"], next: "Failed" }`:
the only call that may fail a Dispatched subject, and one that can never produce Confirmed.

**Not taken this round** (recorded, still open): W21 and W22 have no loading or read-error, though
they are the two biggest queue surfaces and round 46 gave those casts to every other queue. And
W37 has no recovery at all while its client twin W36 carries loading, not-found and read-error for
the same object.

### C.53 Recovery on the money surfaces (2026-08-18, round 51)

C.52 left these recorded. Seven states close them, and every admin read surface now carries its
casts: W7, W7C, W12, W13, W21, W22, W24, W37 and HUBWORK.

**W21 — the garden's settlement queue.** An unreadable money queue must never render like an
empty one; a steward would read *"nothing waiting, nothing dispatched"* and act on it. The error
says what did **not** happen: *"Nothing was queued, dispatched, cancelled, or paid while this was
unreachable, and every recorded attempt is unchanged."*

**W22 — the transport console, and the most dangerous of the three to misread.** This is where a
steward learns whether a command is in flight, so silence here means neither "nothing dispatched"
nor "failed". It says so directly — *"a command already dispatched is still in flight, and no
acknowledgment is lost by a failed read"* — and carries a second warning that follows from the
settlement machine's own rule: **do not requeue or cancel from an unreadable console**, because a
new attempt is legal only after an authenticated failure acknowledgment, which is exactly what
this screen currently cannot show.

**W37 — parity with its own twin.** W36 has carried loading, not-found and read-error for a
member-funded claim; W37 is the steward's side of the same object and had none. Its error states
that any pledge, deposit or refund already recorded is safe, and that nothing can be accepted or
refunded until it reads.

**Facts stay undefined on every read cast.** A screen that draws no record asserts no funding,
commitment or disbursement state — `w37Facts` returns `undefined` for its three, rather than
claiming a lifecycle position for a record it could not load.

**Two vocabulary catches on the way in**, both from hotspot prose rather than screen copy: *owed*
is banned, and *operator* is the word the steward rename retired (Decision Log #28c). The gate
scans hotspot `info` for banned vocabulary even though it exempts them from the dash and
product-copy rules, which is why these surfaced at all.

### C.54 The commitment view learns who is looking at it (2026-08-18, round 52)

**W2 knew what kind of commitment it was rendering and never who was reading it.** It had a cast —
offer, request, request-work, campaign-request, service, recorded, garden — derived from six set
tests with a silent `: "offer"` fallthrough, and no equivalent notion of *seat*. Everything
viewer-dependent was therefore derived from the state id: the people row, the consequence copy, the
progress bars, the action bar, the team affordance. The flow audit found six visible consequences of
that, and each was the same defect wearing different clothes.

**A member's own request wore another commitment's identity.** `requested` was absent from
`W2_REQUEST`, so it fell through the cast ternary to the offer default and rendered "Prune the north
beds", the Offer chip, AGRO, "6 hours · due Aug 12", the people row "Maria offers / João takes it
up", and a progress block reading "Prune 2 of 2 · Plant 8 of 12" on a commitment nobody had taken
up. The band, the timeline verb and the button correctly said request throughout. `w2Group` had
already special-cased the id at its own `id === "requested"` test; `w2Cast` had not, and the
fallthrough hid the omission.

**Two membership tests named states that do not exist.** `browse` tested for
`browse-requested-steward` (the real id is `browse-requested-gated`), so the steward-reviewed browse
view took the non-browse path and showed a neighbour a provider who had not taken it up and proof
nobody had submitted. `evidenceStates` contained `ready-pending`, which has never been a state; the
real ones are all cast-prefixed. Both were `Set<string>`, and nothing above `.plans/` runs `tsc`, so
neither typechecked nor failed at runtime. They simply rendered the wrong screen.

**Creator is not a seat, which is what keeps this to four.** Direction already names the creator: on
an Offer they are the provider, on a Request they are the confirmer. So `offered` is a provider's
screen and `requested` is a confirmer's, and the withdraw affordance gates on phase — nobody has
taken it up yet — while seat only decides the person of the sentence. `W2_DIRECTION` and
`creatorRole` state that in code rather than leaving it as prose.

**Five parallel derivations of the same fact collapse into one.** `w2Cast`, `w2Group`,
`w2StateChip`, `w2Facts` and the presentation layer each worked out where a commitment stood, and
they disagreed. `w2Facts` was a forty-line ternary ladder ending `: "Accepted"`, and five states
reached that arm by omission: `active-waiting` and `contributor` reported Accepted while Active, and
`request-work-fulfilled` and `request-work-confirmation-pending` reported Accepted while Fulfilled
and ReadyForConfirmation. `W2_PHASE` is now the single declaration of contract lifecycle, and
pre-acceptance, terminal and roster-frozen derive from it instead of being hand-listed three times.

**One exception is named rather than derived.** `withdrawn` and `cancelled` are both Cancelled
on-chain, but a withdrawn commitment never left the pool while a cancelled one had been accepted and
worked on before a steward ended it. The screen shows a team, proof and requirement bars for the
second and none of them for the first, so `w2NeverClaimed` carries that distinction explicitly.

**Four states existed as gaps before they existed as screens.** `ready-provider`: "Prove it with
work" ended on the confirmer's ready view, so the person who had just done six hours of pruning read
*"You were named to confirm this commitment"* above a button they are forbidden from pressing.
`support-accepted-confirmer`: taking up a service offer landed the claimant on the provider's
screen, telling them to add proof for a repair they are not doing. `accepted-joinable`: the team
walk sent a would-be joiner through the provider's screen to reach the roster. `fulfilled-confirmer`
gives the confirmer their own kept view, which is what lets `W2@fulfilled` belong to the provider.
Each follows `W4@provider-view`: same stage, same cast, a second state id, and no bar where the seat
has no act.

**The three seat states that already existed rendered almost nothing.** `active-waiting`,
`contributor` and `send-confirm` returned before `w2Disclosures` ran, so they drew no Garden, Media,
Details, Support, People or Timeline at all. The contributor — the seat that most needs to see who
else is on this and how credit is shared — could not reach the team from their own screen. They are
ordinary band cases now.

**The guards matter more than the fixes.** Three checks run at build time through a new
`HifiDef.errors` channel, which joins the ordinary error list rather than throwing: every membership
set's ids must exist; every state must declare a cast, a lifecycle and a seat; every action bar must
name the seat its act belongs to, and that seat must match the state's. The last one is the
important one. `W2_BARS` was already the de-facto seat model — `active` versus `active-waiting`
exists only because a confirmer was being offered the provider's button — but it had no way to say
so, so the next such mistake went unnoticed until someone walked the flow and read it. Both guards
were tested by breaking them: reintroducing `browse-requested-steward` and mis-seating
`ready-confirmer` each fail the build with a named error.

**Nine bands were speaking about the reader in the third person.** `request-ready-confirmer` read
*"Ana asked for this help and is the named confirmer"* on Ana's own screen, while `ready-confirmer`
one stage over was already second-person. That asymmetry is what a seat axis makes visible: the
states whose id happens to name their seat never drifted, and the ones that did not, did.

**Six bands explained idempotency to somebody who had not asked.** *"cannot be confirmed twice while
it syncs"* is a machine concern surfaced as reassurance. They now say whose confirmation it is, that
it is held, and when it lands.

Build: 44 screens / 517 states / 730 hotspots / 53 flows / 317 scenes, 0 warnings. The closure
validator passes for the first time in three rounds — its coverage pins were three generations
stale, its `failStrandedSubject` row was never added when that call joined the union, and one of its
assertions was checking for the word *promises*, which the vocabulary sweep had already retired
everywhere else.

### C.55 The ceremony, the sheet, and three ways in (2026-08-18, round 53)

**The moment the product exists for was given to the wrong person.** There were nine hero moments in
513 states. Six sat on W4, the *confirmer's* sheet, and fired every time somebody tapped Confirm.
Three sat on W2 fulfilled states, and they were the edge casts: a service, a Campaign request, and a
commitment a steward had recorded. The two main paths — an ordinary offer kept, an ordinary request
met — gave the person who did the work a grey band above a details list. So the ceremony went to the
two-tap act and not the six-hour one, and inconsistently even then.

**Fixing the destination lie is what freed the screen.** All six `w4.done-*` hotspots were labelled
"Back to the pool" and targeted `W2@*-fulfilled` — the commitment detail. The reason `W2@fulfilled`
had been kept quiet is recorded on `sb42`'s own last scene: *"kept, once … no duplicate full-screen
repeat"*. That was true only because the confirmer was being sent there. Once Done goes to the pool,
which is what the button says, the fulfilled view is only ever the provider's, and can carry the
celebration the hotspot registry had documented for it all along.

**Seven provider states now name what is true rather than what went up.** "Confirmed · the season's
count just grew" was the payoff line of the whole product, and it was a counter. It reads "The north
beds are pruned · You did the work. João confirmed it on Jul 12." W4 keeps its hero and says
something different: the provider's says *you did this*, the confirmer's says *you vouched for it*.
Both people did something; the two heroes now say which. The three that already had a hero were
wrapped in `bandCard`, so they rendered an information badge and a celebration halo 130px apart.

**Two fulfilled states deliberately keep their band.** A fallback-confirmed commitment's news is who
confirmed it and why, and a hero's message is capped at 30 characters, so a halo cannot carry a
reason. The timeline can, and does.

**The settled band stopped claiming to be the celebration.** Ten states short-circuited to
"Commitment kept · the season's count already grew" while their money was still moving. That is the
third statement of a fact the state chip and the timeline's last moment already carry, and it
re-fires a celebration the person had days ago. "Kept" survives as the first word, because somebody
arriving from a payment notification still needs it; the rest of each band says where the support
has got to.

**The missing beat cost one band and one early return.** When João takes up Maria's offer, that
reached her as a row inside a folded `Timeline · 4 moments`, under a band that opened with an
instruction. The screen also said four different things about when it was: the band said add proof,
the progress block said "Prune 2 of 2", the Work section said an approval dated five days after
acceptance was *not linked*, and the timeline's last row said "Ready to confirm · waiting on João".
`W2@accepted` now leads with **João took this up**, the instruction second; the offer cast's timeline
tail no longer asserts work that has not happened; requirement rows read `0 of 2` until something is
approved; and the Media section appears when there is proof rather than whenever the commitment has
been claimed.

**The commitments sheet had no row for two of the things that happen most.** No state of W5
mentioned money at all, and none carried a commitment frozen for steward review — which is where
three flows handed off. `sb11` and `sb53` opened on this sheet and then moved on with no control
between them, and `sb5` ended by handing a commitment to somebody else and leaving the person who
raised it nowhere to follow it. Both rows reuse `commitmentCard`, take the `queued` tone rather than
`warn`, and add nothing to the badge: neither needs an act, and the badge counts acts, not inventory.

**Nothing in the artifact reached the wallet.** W23's five hotspots all originated inside W23, and
the Home header's four controls were inert preview chrome, so the G$ balance was drawn and
unreachable — and `sb53` could not legally begin anywhere else, because a client flow must enter at
W1, W5 or WFLOW. `homeHeader` takes an opt-in `walletHot`; only the commitments sheet passes it, so
the wallet's own shell and the gallery specimen stay inert.

**The catalog had no beginning and no end.** It opened at "Make an offer", which assumes you are
already a member of a garden whose pool is already open and that you already know what a commitment
is, and closed at "Change of plans". Two chapters bookend it now. *Find your way in* holds the
arrival walk and `sb18`, which is the commitments-sheet orientation flow and was filed under money.
*See how the season went* holds the ending, which uses three cycle-carousel hotspots that were
already drawn and wired and led nowhere. Neither flow needed a new screen.

**The sentence that explains the whole idea reached one state in thirty-three.** "Offer something
you can give, or ask for help you need" lived on `W1@empty-open` alone — the state almost nobody sees
twice — while the steward's console carried a plain-language description of the pool every day. The
garden's charter is now the commitments list's subtitle, on all nine states where that list renders.
It is a line under a section header, not the 236px summary card round 8 removed from that same gap.

**Withdrawing a request had a button and no sheet.** `W2_BARS.requested` drew "Withdraw This
Request…" and routed it into the offer's confirmation, which asked *"Withdraw this offer?"* over an
ask. Two states close it, and `request-withdraw-confirm` joins `REASON_CONFIRMS` because
`cancelCommitment` stores a `reasonCID` and the gate checks that in both directions.

**Every machine word left the client surface.** *on-chain*, *fulfillment*, *indexed*, *transaction*
and *threshold* are at zero; *syncs* went from nineteen to zero, *roster* from fifteen, *cycle* from
four. The two worth naming: "Fulfillment appears only after it syncs on-chain" was the sentence a
person read immediately after confirming a commitment, which is plausibly the highest moment in the
product; and `W2b@join-submitted` answered "am I on the team?" with a paragraph about indexer
freshness. Six bands explained idempotency — *"cannot be confirmed twice while it syncs"* — to
somebody who had not asked. What survives is the consequence: joining on its own still earns no
credit, and the screen still says so.

**Composer step 3 was the only step whose next action had no word on it.** An unlabelled arrow, on
the one step that is entirely optional. The icon-only decision was a real measurement — five capture
adders plus a labelled primary left about 78px — so the adders move to their own row through the
`.fbar:has(.fbrow)` mechanism the flow already uses elsewhere, and the primary gets the full width.
Step 2's amount-versus-actions distinction is explained once now instead of four times.

**The steward's roster keeps its counts and loses its disclaimer** (Afo's call, against the
recommendation). A steward needs to see who is over-committing; the caption arguing that the list was
"never a score or a ranking" was the dishonest half.

Build: 44 screens / 519 states / 736 hotspots / 56 flows / 329 scenes, 0 warnings; closure validator
green. (Receipt as taken. The state count is 517 from 2026-08-19: `WFLOW@details-linked` and
`WFLOW@fulfills-pick` retired, both of which this section had already ordered retired.)

## Appendix G: editorial record and cycle supersessions (2026-08-25, experience audit AD-8…AD-11)

Afo's Wave-2 decisions from the 2026-08-25 experience audit, built in
`feat/editorial-record-and-cycle`. Each entry supersedes the cited earlier text;
nothing above this appendix was edited in place.

**§7 editorial § 02 leaves the panel (AD-8, supersedes the PR-748 `EditorialPanel`
body and §7.1/§7.3's "one `EditorialPanel`" sentences).** On `/gardens/:id` and the
`/impact` band the commitments record composes directly on the canvas in the page's
own grammar — headers on linen, hairline dividers, § 01-style stat rows. § 02 had
been the only card-wrapped section on either page. Every §1/§3 copy rule and honest
state survives unchanged: em-dash-not-zero, the kept-rate threshold and its
definitional sentence, absence copy, no providers/addresses/rankings. The
`EditorialPanel` atom is retired (no consumers remain); with the panel gone, the
dark-mode panel-darker-than-canvas deviation retires with it — the record renders
on the canvas tokens in both modes.

**§7.3 the cycle becomes four steps (AD-9, supersedes the five-node
`PublicEvidencePipeline`).** Needs · Commitment · Work · Learnings, heading "From
need to learning, season after season.", using the audit § 10 draft as the
shipping copy. Confirmation fuses into Work ("The person it was for, or another
eligible confirmer, records that it was kept."); the certificate step becomes
Learnings with "Impact Certificate" surviving inside the step's body (term-tooltip,
shared `public.pool.terms.certificate` definition), never as a stage name. The
loop-line is a full-width footer under all four columns. Four equal columns level
at every width; descriptions in one length band; number chips aligned with their
titles. New `public.impact.pipeline.step.*` key family en/es/pt; the fresh es/pt
translations use "el fondo común del Jardín" / "o fundo comum do Jardim" (no new
"el pool"/"o pool" instances — that noun stays an open Wave-2 call). "Learnings"
and the loop-line wording are Afo's naming to confirm at PR review.

**§7 imagery loses the hover zoom (AD-10).** `group-hover:scale-[1.03]` and its
now-dead `transition-transform` classes are removed at all six sites — the four
the audit recorded (`PublicGardenCard`, `PublicActionCard`, `PublicEvidenceCard`,
`PublicGardenRow`) plus `GardenDetailNoteRecord` and `GardenDetailFieldNotes`,
honoring the decision's "across the editorial site" scope.

**§7 empty and error sections hold their space (AD-11).** `SectionEmpty`, the
section-level `SectionNotice` default, the § 02 record bodies, and `/impact`'s
evidence-ledger empty and error casts carry a minimum body height (`min-h-40`),
so absence reads as a kept place in the record rather than a footnote under the
header. Inline asides that pass their own className opt out.
