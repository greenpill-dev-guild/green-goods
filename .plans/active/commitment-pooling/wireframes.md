# Commitment Pooling: Low-Fi Wireframes (Four Surfaces)

**Feature Slug**: `commitment-pooling`
**Stage**: `active`
**Created**: 2026-07-04
**Companions**: `uiux-spec.md` (canonical flows — every frame here implements a section of it, referenced per frame), `contract-spec.md` (module vocabulary), `settlement-spec.md` (settlement surfaces, §6 deltas here), `diagrams.md` (state machines these screens render).
**Fidelity**: deliberately low. Boxes, labels, and navigation only — structure and flow, not visual design. Warm Earth expression, spacing, and component polish happen at implementation time per the `design`/`ui` skills; admin frames stay restrained per the prompt contract. All copy shown is placeholder English; every string ships as en/es/pt keys per uiux-spec §10.
**Grounding rule**: component names in `{braces}` are canonical (shared primitives, `Admin*` wrappers, or NET-NEW primitives flagged in uiux-spec §9). Routes are the NET-NEW routes uiux-spec §5.1/§6.1 defines. Nothing here invents a component, route, or term the specs don't already carry.
**Role vocabulary (decision 2026-07-18)**: member-facing and steward-facing copy says **steward** (= holder of the garden's operator/owner Hats); the shipped app still says "Operator" until the recorded app-wide rename lands.

## 0. Legend

```text
┌─┐ └─┘   screen / dialog / card boundary        [ Label ]   button / CTA
(chip)    status or filter chip                  ▸           tap-through / link
▓▓▓░░░    progress meter                         ◉ ○         selected / unselected
≡         list row                               ⚠           warning / notice band
··queued··  offline-queued chrome                +N          badge count
```

## 1. Cross-surface flow map

How one Need and its resulting commitment travels across the deliberately separate surfaces. Nodes stay thin (≤2 lines); each surface's detail lives in the list below the map, not inside the boxes.

```mermaid
flowchart LR
  classDef planned stroke-dasharray: 6 4
  COM["Community PWA (Sept)<br/>needs · signals · testimony"]
  ADM["Admin<br/>steward pools · Operations"]
  PWA["Client — installed PWA<br/>promises · work · wallet"]
  PUB["Client — editorial website<br/>garden + impact stories"]
  READ["Shared read model<br/>Envio + EAS joined reads"]

  COM -->|"Need selected for gathering"| ADM
  ADM -->|"needUID seeds a commitment"| PWA
  PWA -->|"work · confirmation · oracle-verified settlement"| READ
  READ -->|"progress on Needs"| COM
  READ -->|"queues + consoles"| ADM
  READ -->|"aggregate stories"| PUB
  class COM planned
```

What each surface owns:

- **Community PWA** (independent app at `community.greengoods.app` — own manifest, service-worker scope, telemetry, routes): Needs · Create · Profile; offline need/signal/testimony.
- **Admin**: steward triage, pool/cycle consoles, seeding, evaluator lineage + CSV/JSON export, and the deployer-gated Operations workspace (W24).
- **Client installed PWA**: commitment claim, work, evidence, confirmation, member settlement status, WalletDrawer.
- **Client editorial website**: garden and impact stories, funder discovery — aggregates only, never rankings.
- **Shared read model**: auth/passkey, offline status, install/update, EAS Needs + Envio protocol progress joined in shared query composition.

---

## 2. Surface 1: Client PWA

### W1 — Pool tab on garden detail (uiux-spec §5.2)

Route `/home/:id/pool` — NET-NEW fourth `GardenTab` on the existing garden detail. `{AppBar}` stays visible.

```text
┌──────────────────────────────────────────────┐
│ ←  Rocinha Community Garden                  │  existing garden detail header
│  Work · Insights · Gardeners · ◉Pool         │  {StandardTabs} + NET-NEW Pool
├──────────────────────────────────────────────┤
│ Season of First Rains is open                │  pool state banner (§4.1 copy)
│ ┌──────────────────────────────────────────┐ │
│ │ Season of First Rains        (season)    │ │  cycle card
│ │ Seeded ─ ◉Open ─ In progress ─ Reviewing │ │  stage stepper
│ │ ▓▓▓▓▓▓▓▓▓░░░░░  62% of promised units    │ │  {ProgressMeter} NET-NEW
│ │ runs through Aug 30                      │ │  calm date, never a timer
│ └──────────────────────────────────────────┘ │
│ Campaigns (2 open)                           │  concurrent; never replaces Season
│ ≡ Market rides (campaign) · Open · 6/16     │
│ ≡ Tool library (campaign) · Reviewing · 8/8 │
│ Scope: [All current] [Season] [Market rides] │  labels every aggregate/list
│ ┌───────────────────┐ ┌───────────────────┐  │
│ │ 12 offered        │ │ 7 fulfilled       │  │  scoped {StatCard} ×2 per row
│ └───────────────────┘ └───────────────────┘  │
│                                              │
│ [ Offer support ]      [ Request help ]      │  persistent creation CTAs → W3
│                                              │
│ (All)(Offers)(Requests)(Matched)(Mine)       │  client-local filter chips
│ ┌──────────────────────────────────────────┐ │
│ │ (Offer)(AGRO)  Prune the north beds      │ │  {DomainBadge} {StatusBadge}
│ │ 6 hours · due Aug 12                     │ │
│ │ anyone in this garden may take this up   │ │  claim-mode helper text
│ │                       [ Take this up ]   │ │  Open mode → optimistic accept
│ └──────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────┐ │
│ │ (Request)  Ride to the market on Sat     │ │
│ │ 1 ride · runs with the season            │ │
│ │ stewards review who takes this up        │ │
│ │                 [ Ask to take this up ]  │ │  ApprovalGated → "waiting" chip
│ └──────────────────────────────────────────┘ │
├──────────────────────────────────────────────┤
│    Home         Garden         Profile       │  {AppBar} (unchanged)
└──────────────────────────────────────────────┘
```

- Variants (same frame, swapped bands): **NotReady** = checklist naming the missing charter, qualifying baseline, and/or exposure cap; browse/create disabled. **Paused** = `{Alert}` with steward reason; new commitments, claims, Ready submissions, and confirmations are disabled while evidence/work linkage, cancellation/expiry, and dispute recovery remain available. **Empty open pool** = planted-seed illustration slot + the two CTAs + steward-seeded hint.
- Cycle variants: **no open Season + open Campaigns** leaves the Campaign list and scoped work fully active while the Season slot says “No open Season”; **one Season + zero Campaigns** omits the empty Campaign list after a quiet “No open Campaigns” line; history stays separate from current scope.
- Protocol-pool commitments shown in a garden context add, for eligible stewards only, a provider-context choice ("take this up as myself" / "take this up for this garden"). The request stores `ClaimType` plus `gardenContext`; acceptance derives `providerGarden`. It does not create token custody or a member-delivery fallback. Full protocol-pool claim journey: W25.
- **No "My commitments" strip on this tab** (trimmed 2026-07-18 for client minimalism): the WalletDrawer Commitments tab (W5) is the single cross-garden "mine" surface. The `(Mine)` filter chip stays for in-garden browsing.
- Membership-wait variant (register #34c): a new member's queued rows render an amber `··waiting··` chrome — "waiting for your garden membership — no retries used" — and resume when the hat lands. Applies to W1 cards and W5 groups. Drawing: prototypes.md MF-5.
- Tap card ▸ W2. Offer/Request CTAs ▸ W3 with direction preset.

Cycle-banner and read-recovery states use the same W1 shell (`hifi/screens/client.ts:163-194`):

```text
SEEDED / OPENS SOON                 REVIEWING
┌──────────────────────────────┐    ┌────────────────────────────────┐
│ Your steward is preparing    │    │ Your stewards are reviewing   │
│ this season's promises.      │    │ this season. Evidence and     │
│ Browse only until it opens.  │    │ confirmations stay available. │
└──────────────────────────────┘    └────────────────────────────────┘

CYCLE CANCELLED                    READ RECOVERY
┌──────────────────────────────┐    ┌────────────────────────────────┐
│ This season was cancelled.   │    │ Loading: preserve shell       │
│ Its history stays here.      │    │ Not found: No pool here yet   │
│ 8 made · 5 kept              │    │ Read error: saved last view   │
└──────────────────────────────┘    │                    [ Try again ]│
                                    └────────────────────────────────┘
```

`loading`, `not-found`, and `read-error` are presentation states, never a synthetic “None” pool state. The read-error view keeps the last saved view legible and offers an explicit retry.

Approval-gated request variants reuse the same card/detail grammar and survive refresh:

```text
PENDING                              DECLINED
┌──────────────────────────────┐     ┌────────────────────────────────┐
│ Waiting for steward          │     │ Steward declined this request │
│ Individual · requested Jul 9 │     │ Reason: provider context …     │
│ Provider: myself             │     │ [Ask again] [Back to browse]   │
└──────────────────────────────┘     └────────────────────────────────┘

SUPERSEDED                           ACCEPTED
┌──────────────────────────────┐     ┌────────────────────────────────┐
│ Taken up by someone else     │     │ Your request was accepted      │
│ Nothing you did went wrong.  │     │ Provider garden: Rocinha       │
│ [Back to browse]             │     │ [Open commitment]              │
└──────────────────────────────┘     └────────────────────────────────┘
```

Declined creates no automatic retry: “Ask again” creates a fresh request only while the commitment remains claimable. Superseded copy names, in plain words, whether another request was accepted ("Taken up by someone else") or the commitment was cancelled/expired ("This one was closed before a match") — driven by `resolutionCode` — and never shows a failed-job Retry or any sync/technical language. The frozen interface has no claimant-cancel control for a Pending request.

### W2 — Commitment detail (uiux-spec §5.3)

Route `/home/:id/pool/:commitmentId`.

```text
┌──────────────────────────────────────────────┐
│ ←  Prune the north beds                      │
│ (Offer)(AGRO)(Accepted)  6 hours · due Aug 12│  chips + units + due
│ anyone in this garden may take this up       │  claim-mode helper line
│ (recorded by your steward on your behalf)    │  OperatorCaptured chip only
├──────────────────────────────────────────────┤
│ Timeline                                     │  {StateTimeline} NET-NEW
│ ● Offered      — Maria · Jul 2               │
│ ● Accepted     — João took this up · Jul 3   │
│ ● Work linked  — pruning session · Jul 8     │
│ ● Ready        — steward note: "confirmed    │  overrides + reasons always
│                  on site visit" (override)   │  visible to members
├──────────────────────────────────────────────┤
│ Evidence                          [ + Add ]  │  ▸ W2a attach sheet
│ ≡ photo — north beds after (Jul 8)           │  {ListPrimitives} rows
│ ≡ note — "two beds left for next week"       │
├──────────────────────────────────────────────┤
│ Work for this promise                        │  DomainImpact only
│ ≡ Pruning session       (Approved)           │  {WorkDisplayStatus} chip
│ [ Submit work for this promise ]             │  deep-link → Garden work flow
│ [ Link existing work ]                       │  picker → workLink job
├──────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────┐ │
│ │ [ Confirm: promise kept ]                │ │  only for named confirmers
│ └──────────────────────────────────────────┘ │  while ReadyForConfirmation → W4
│ Reward: 20 DAI from the garden jar · pending │  declared-reward row (§18)
│ recorded on Arbitrum                         │  chain phrasing lives here only
└──────────────────────────────────────────────┘
```

- W2 opens the dedicated W2a attach sheet (`{DialogShell}` + `{FileUploadField}`) for evidence capture.
- Fulfilled state: hero moment fires once (§5.10), reward row flips to "reward released" when `RewardPaid` lands.
- Disputed state: banner "under review by stewards", CTAs frozen.
- Expired state (register #34d): the confirm block gives way to a calm expired band + `[ Offer again ]` re-entry into W3. Drawing: prototypes.md MF-3.
- Owner withdraw (register #34b): while Offered/Requested the creator sees `[ Withdraw this offer… ]` with a required reason (creator path of `cancelCommitment`). Drawing: prototypes.md MF-2a. Steward cancel placement remains open.
- Hi-fi guidance (audit 2026-07-18): this is a gardener-facing surface — keep the visible viewport to state + next action. Timeline, Evidence, and Work bands collapse behind progressive disclosure (accordion / carousel / sheet) so all five bands never stack at once, and technical identifiers (UIDs, addresses, chain names) live behind a single "Details" disclosure. No dispute/legal vocabulary in primary copy — "under review by stewards" is the ceiling.
- Read states match the prototype (`hifi/screens/client.ts:323-327`): **Loading** preserves the detail shell, **Not found** explains the promise is unavailable, and **Read error** keeps the saved view while `[ Try again ]` retries the read. None renders a commitment status chip.

### W2a — Evidence sheet (uiux-spec §5.5)

`{DialogShell}` over W2. Photo / link / note creates one `evidence` job per submit and works fully offline. Canonical prototype states: `hifi/screens/client.ts:418-449`.

```text
COMPOSE                              QUEUED
┌──────────────────────────────┐     ┌────────────────────────────────┐
│ Add evidence                 │     │ Evidence queued                │
│ ◉ Photo  ○ Link  ○ Note      │     │ ≡ North beds after   (Queued) │
│ Saved on this device until   │     │ It will send when you're back │
│ it sends.                    │     │ online.              [ Done ] │
│          [ Attach evidence ] │     └────────────────────────────────┘
└──────────────────────────────┘

UPLOAD FAILED — PER-ROW RECOVERY
┌────────────────────────────────────────────────┐
│ One item needs another try                     │
│ ≡ North beds after  (Couldn't send) [ Retry ] │
│ ≡ Two beds left…     (Sent)                    │
│ Nothing is dropped; retry only the failed row. │
│                                       [ Done ] │
└────────────────────────────────────────────────┘
```

### W3 — Offer / request creation flow (uiux-spec §5.4)

Route `/home/:id/pool/new?direction=offer|request`. Full-screen (AppBar hidden), existing work-flow chrome: `{TopNav}` + `{FormProgress}`.

```text
┌──────────────────────────────────────────────┐   Step 2 — How much
│ ✕  Make an offer              ● ● ○ ○        │   ┌────────────────────────┐
├──────────────────────────────────────────────┤   │ Unit  [ hours        ▾ ]│
│ Step 1 — What                                │   │ suggestions: hours,     │
│ direction   ◉ Offer support  ○ Request help  │   │ tasks, meals, rides,    │
│ type        ◉ Garden work (impact)           │   │ plants                  │
│             ○ Support / service              │   │ How many  [ 6 ]         │
│   (season/campaign + on-behalf capture are   │   │ Due  {DatePicker}       │
│    console-seeded only — not shown here)     │   │  or ◉ selected deadline │
│ cycle scope [Season: First Rains ▾]          │   │                        │
│   Season · each open Campaign · no cycle     │   │                        │
│ title  [ Prune the north beds            ]   │   └────────────────────────┘
│ note   [ optional                        ]   │   Step 3 — What this needs
├──────────────────────────────────────────────┤   (DomainImpact only)
│                        [ Continue ]          │   ┌────────────────────────┐
└──────────────────────────────────────────────┘   │ This promise needs:    │
                                                   │ ≡ Prune  × [ 2 ]  ✕    │
Step 4 — Review and promise                        │ ≡ Plant  × [ 1 ]  ✕    │
┌──────────────────────────────────────────────┐   │ [ + Add an action ]    │
│ summary card (all fields, incl. the line     │   │ action-card picker from│
│  "needs: Prune × 2 · Plant × 1")             │   │ the work-flow intro;   │
│ [ Make this offer ]                          │   │ each row = one action  │
│  → enqueues `commitment` job, returns to W1  │   │ × approved-work count  │
│    with optimistic card + queued badge       │   └────────────────────────┘
└──────────────────────────────────────────────┘
```

- Step 3 is the **requirements builder** (amendment 2026-07-18): each row binds one registered action to a per-action approved-work count — `requiredActionUIDs[]` × `requiredApprovedWorkCounts[]`, max 4 rows, every count ≥ 1, running summary chip in the header. The review step reads the whole requirement in one line ("needs: Prune × 2 · Plant × 1").
- SupportService skips step 3 entirely (evidence + confirmation is its proof).
- Draft persists in IndexedDB (`WorkDraftRecord` semantics); re-entry offers resume via the existing `DraftDialog` pattern.

### WFLOW — Existing work flow, review step (+ fulfills row)

Deep-link from W2 into the existing Garden work-submission flow. Only the commitment-context row is new; the approval rails and the rest of the submission remain unchanged (`hifi/screens/client-wallet.ts:200-221`, uiux-spec §5.7).

```text
┌──────────────────────────────────────────────┐
│ ✕  Submit work                    ● ● ●       │
├──────────────────────────────────────────────┤
│ Review                                       │
│ ≡ 2 photos · pruning session                 │
│ ≡ Fulfills: Prune the north beds             │
│   Offer · AGRO · (Promise)                   │
│                                              │
│ Everything else is the existing work flow.  │
│                              [ Submit work ] │
└──────────────────────────────────────────────┘
```

Submitting carries `meta.commitmentId`; after sync, the work links back to W2 and advances only the matched requirement row.

### W4 — Counterparty confirmation sheet (uiux-spec §5.6)

`{DialogShell}` over W2 or W5. Focus order per §12: title → summary → meter → reason → decline → confirm.

```text
┌──────────────────────────────────────────────┐
│ Promise kept?                                │
│ Prune the north beds — Maria · 6 hours       │
│ Offer · provider Maria · recipient confirms  │  direction-aware responsibility
│ evidence: 2 items · linked work: 1 approved  │
├──────────────────────────────────────────────┤
│ Confirmations   ▓▓▓▓▓▓▓░░░  2 of 3           │  {ProgressMeter} + text equiv
│ ≡ João ✓        ≡ Ana ✓       ≡ you ○        │  {AddressDisplay} rows
│ Provider Maria cannot confirm this delivery. │  ordinary + fallback protection
├──────────────────────────────────────────────┤
│ [ Confirm — promise kept ]                   │  enqueues `confirmation` job
│ [ Not yet — tell the stewards why ]          │  decline → reason field;
│                                              │  routes to steward attention,
│                                              │  never cancels the promise
└──────────────────────────────────────────────┘
```

Confirmation outcomes and the online-only “Not yet” retry match the canonical prototype (`hifi/screens/client.ts:577-587`):

```text
FULFILLED — PENDING SYNC          FULFILLED — SYNCED
┌────────────────────────────┐    ┌────────────────────────────┐
│ Promise kept               │    │ Promise kept               │
│ Confirmations 3 of 3       │    │ Confirmed — the season's   │
│ Saved here; fulfillment    │    │ count just grew.           │
│ appears after sync.        │    │        [ Back to the pool ]│
│                    [ Done ]│    └────────────────────────────┘
└────────────────────────────┘

NOT YET — SEND FAILED
┌──────────────────────────────────────────────┐
│ Tell the stewards                            │
│ Your note is kept. The promise stays ready   │
│ to confirm until the online send succeeds.   │
│                                [ Try again ] │
└──────────────────────────────────────────────┘
```

Evidence band variants — the two delivery styles read differently (audit 2026-07-18):

```text
DomainImpact — the approved work IS the evidence   SupportService / OperatorCaptured
┌──────────────────────────────────────────────┐   ┌──────────────────────────────┐
│ Delivery so far                              │   │ Evidence                     │
│ ≡ Pruning session   (Approved ✓)             │   │ ≡ photo — after the workshop │
│ ≡ Planting day      (Approved ✓)             │   │ ≡ note — "met on Saturday"   │
│ every needed action met — Prune 2/2 ·        │   │ No separate approval step —  │
│ Plant 1/1 · approved by your steward         │   │ your confirmation closes it. │
└──────────────────────────────────────────────┘   └──────────────────────────────┘
```

- The two paths compose, they don't compete: DomainImpact reaches this sheet only after every per-action approved-work count is met (the approved-work chips carry that proof into the confirmation moment); no-work-requirement kinds reach it on evidence alone, and here the confirmation IS the review (register #10/register #20).
- For a Request, the helper instead reads “claimant provides · request creator confirms.” Named groups never include the accepted provider; an acceptance that would make `N` unreachable fails before any units commit.
- Optimistic tick on the meter; if this was the Nth confirmation, Fulfilled hero fires on **sync completion**, not enqueue.

### W5 — WalletDrawer pools panel (uiux-spec §5.8)

Existing `{ModalDrawer}` from the Home header — the real drawer's three tabs are **Cookies | Tokens | Commitments**; this fills the reserved Commitments stub (`app.wallet.tab.commitments`, replaces `ComingSoonStub`). This tab is the **single cross-garden promises surface** — it absorbed the former W6 home card as its header summary (decision 2026-07-18).

```text
┌──────────────────────────────────────────────┐
│ Wallet   ○ cookies  ○ tokens  ◉ commitments+2│  tab badge = pending count
├──────────────────────────────────────────────┤
│ Promises kept this cycle: 7 of 9 due         │  header summary (absorbed W6);
├──────────────────────────────────────────────┤  absolute numbers only
│ Waiting on you                               │  inbox, cross-garden
│ ≡ Maria — Prune the north beds   (Rocinha) ▸ │  ▸ W4
│ ≡ TAS Hub — Field survey ride    (Awka)    ▸ │
├──────────────────────────────────────────────┤
│ My commitments                               │
│ Rocinha Community Garden                     │  grouped by garden
│ ≡ ··queued·· Compost workshop    (Offered)   │  queued rows at group top
│ ≡ Ride to market                 (Accepted) ▸│  ▸ W2 in that garden
│ Muizenberg                                   │
│ ≡ Beach cleanup Saturday         (Fulfilled)▸│
└──────────────────────────────────────────────┘
```

W5 also carries `queued`, `waiting-membership`, `empty`, `loading`, `not-found`, and `read-error` states (`hifi/screens/client-wallet.ts:21-83`). Empty and not-found explain the absence in member language; read error preserves the saved cross-garden view and exposes `[ Try again ]`. The retired W6 home card does not remain as a standalone frame: Home stays garden-first, while W5 owns its absorbed summary line.

---

## 3. Surface 2: Admin

All admin frames: `{CanvasRouteFrame}` + `{CanvasRouteHeader}` + `{CanvasRouteContent}`; overlays are centered `{AdminDialog}` or flow `{AdminDialog variant="flow"}` + `{ActionFlowShell}`. Restrained copy, no hero moments.

### W7 — Garden workspace: Pool tab (uiux-spec §6.2)

Route `/garden/pool` on the existing Garden `{AdminTabRail}`.

```text
┌────────────────────────────────────────────────────────────────────────┐
│ Garden ▸ Rocinha        overview · activity · ◉pool · settings         │
├────────────────────────────────────────────────────────────────────────┤
│ ┌─ Pool ─────────────────────────────────────────────────────────────┐ │
│ │ (Open) charter ✓ baseline ✓ cap 24     [ Pause… ] [ Edit charter ] │ │  {AdminCard}
│ │ 3 awaiting confirmation · 2 claims waiting · 1 failed payout  ▸jump│ │  above-the-fold summary row
│ └────────────────────────────────────────────────────────────────────┘ │
│ ┌─ Cycles console ───────────────────────────────────────────────────┐ │
│ │ SEASON · First Rains · Open                                        │ │  exactly one open Season
│ │ Seeded ─ ◉Open ─ InProgress ─ Reviewing ─ Reconciled ─ Composted   │ │
│ │ [ Close Season ▸ W26 ] [ Cancel… ] [ Open Season disabled: one ]  │ │
│ │ CAMPAIGNS (2 open)                                  [ New Campaign ]│ │  concurrent rows
│ │ ≡ Market rides · Open · 6/16                [ Close ] [ Cancel… ] │ │
│ │ ≡ Tool library · Reviewing · 8/8            [ Review ] [ Cancel… ]│ │
│ └────────────────────────────────────────────────────────────────────┘ │
│ ┌─ Commitments ──────────────────────────────────────────────────────┐ │
│ │ [search………] (◉Open)(Confirmed)(Past) (type ▾)(direction ▾) newest ▾│ │  segmented state chips
│ │ ≡ Prune the north beds   (Offer)(Accepted)   6h    Maria         ▸ │ │  {AdminFilterChip}
│ │ ≡ Market ride            (Request)(Ready)    1     João          ▸ │ │  {AdminSortSelect}
│ │ ≡ Compost workshop       (Offer)(Disputed)   3h    Ana           ▸ │ │  row ▸ W10 (left inspector)
│ └────────────────────────────────────────────────────────────────────┘ │
│ ┌─ Claims waiting (approval-gated) ──────────────────────────────────┐ │
│ │ Field survey · request terms                                       │ │
│ │ ≡ claimant 0x12…9a · requested by same · individual · Jul 9       │ │
│ │                                      [ Accept ] [ Decline… ]       │ │
│ │ ≡ claimant Awka Hub · requested by 0x45…2b · garden · Jul 10      │ │
│ │                                      [ Accept ] [ Decline… ]       │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│                                                        (+) seed        │  {AdminFab} ▸ W8
└────────────────────────────────────────────────────────────────────────┘
```

Claim-row outcomes are independently visible in queue history:

```text
DECLINE A                            ACCEPT B
┌──────────────────────────────┐     ┌────────────────────────────────┐
│ A · Declined · reason…       │     │ B · Accepted · stored terms   │
│ B · Pending (unchanged)      │     │ A · Superseded                │
└──────────────────────────────┘     │ other pending · Superseded    │
                                     └────────────────────────────────┘
```

Decline never says the commitment “returns” to browse; it was already available to other eligible claimants. Accept uses the selected row’s stored claimant/requestedBy/kind/gardenContext/requestedAt and never editable replacement terms; the accepted result then shows the derived `providerGarden`. Individual rows show claimant=requestedBy. Garden rows show the GardenAccount as claimant and the authenticated steward as requestedBy.

Layout decisions (audit 2026-07-18): the pool card gains an **above-the-fold summary row** (counts + jump links) so the most actionable queues are visible without scrolling a flat list; **history is not a sub-view** — composted cycles and settled records appear under the `(Past)` segmented chip in place (Garden `OverviewTab` chip precedent), and the old "History:" console row is retired; commitment rows open in the **left inspector** (`{AdminDialog}` via the Garden sheet descriptor) like every other garden workspace detail — the right sheet remains account chrome only.

Adopted 2026-07-11 (register #34; lo-fi drawings in `prototypes.md` pending a redraw pass here):
- **Pool-card lifecycle actions** (register #34a): a Ready pool's primary card action is `[ Open pool ]`; `[ Close pool… ]` appears once the last cycle composts (then Compost/Reopen per uiux-spec §4.1). The open-cycle flow adds only a "pool is Ready — open it now?" guard prompt. Drawing: prototypes.md MF-1.
- **Lapsed this cycle** (register #34d): a queue section below Claims waiting lists Expired seeded promises with `[ Re-seed… ]` into W8. Drawing: prototypes.md MF-4.
- **Waiting to join** (register #35): the Garden workspace gains a join-request queue beside ManageMembers — pending / welcomed / declined-with-reason rows executing the existing operator add path; the canonical service design is `../community-interface/join-queue-spec.md`, while this workspace consumes its membership outcome.
- Recovery states follow the canonical prototype (`hifi/screens/admin.ts:217-259`): **Loading** keeps the Pool card and cycle-console skeleton in place; **No commitments yet** keeps the seeding FAB and an empty-state explanation instead of showing a blank table.

### W8 — Steward seeding console (uiux-spec §6.3)

Flow `{AdminDialog variant="flow"}` + `{ActionFlowShell}`, route `/garden/pool/seed`.

```text
┌── Seed a commitment ── ● ● ● ○ ──────────────────────────┐
│ Step 1 — Type and scope                                  │
│ type   ◉ Season/campaign  ○ Support  ○ Impact  ○ Capture │
│ direction  ◉ the pool offers   ○ the pool requests       │
│ cycle  [ Season: First Rains ▾ ]                         │
│         options: Season · each open Campaign · no cycle  │
│ title  [                              ]  note [        ] │
├──────────────────────────────────────────────────────────┤
│ Step 2 — Requirements                                    │
│ unit [ hours ▾ ]  target [ 12 ]                          │
│ This promise needs:            (impact: 1–4 rows)        │
│ ≡ Prune the north beds   × [ 2 ]  ✕                      │
│ ≡ Plant native seedlings × [ 1 ]  ✕                      │
│ [ + Add an action ]     (per-action approved-work counts)│
│ assessment required  ○ yes ◉ no   due [ cycle deadline ] │
├──────────────────────────────────────────────────────────┤
│ Step 3 — Confirmation rule and reward                    │
│ confirmers  [ + add address ]  ≡ Maria ✕  ≡ João ✕       │  {AddressGroupField} NET-NEW
│ threshold   N = [ 2 ] of 2                               │  validates N ≤ group size
│ Accepted provider is excluded at claim acceptance.       │
│ Claim acceptance fails if N then becomes unreachable.    │
│ claim mode  ◉ open   ○ steward-reviewed                  │  prefilled by context (§19)
│ reward      source [ garden jar ▾ ] token [DAI] amt [20] │  reference only, no custody
├──────────────────────────────────────────────────────────┤
│ Step 4 — Review              [ Seed this commitment ]    │
└──────────────────────────────────────────────────────────┘
```

### W9 — Analog capture (uiux-spec §6.5)

Flow `{AdminDialog}` at `/garden/pool/capture`. Steps 2–4 reuse W8's; the differences are step 0 and the fixed header.

```text
┌── Record on a member's behalf ───────────────────────────┐
│ "Recorded by {steward} on your behalf.                   │  fixed non-custodial
│  The promise stays yours."                               │  phrasing (§13 Q2)
├──────────────────────────────────────────────────────────┤
│ Step 0 — Who and what kind                               │
│ member   [ search members… ▾ ]                           │  the social source
│ capture  ◉ their offer  ○ their request  ○ confirmation  │
│          (captured confirmations always carry a reason)  │
├──────────────────────────────────────────────────────────┤
│ … steps continue as W8 steps 2–4 …                       │
└──────────────────────────────────────────────────────────┘
```

### W10 — Commitment detail dialog (uiux-spec §6.2/§6.7)

Centered `{AdminDialog}` with workspace `tone`; opened from W7/W12/W13 rows.

```text
┌── Prune the north beds ──────────────── (Offer)(Ready) ──┐
│ Maria → João · 6 hours · due Aug 12 · open claim         │
│ Timeline: Offered → Accepted → Work linked → Ready       │  {StateTimeline}
│           (override by steward: "confirmed on site")     │  override marker visible
│ Evidence (2)  ≡ photo  ≡ note                            │
│ Linked work (1)  ≡ Pruning session (Approved)            │
│ Provider: Maria (cannot confirm)                          │
│ Eligible: João ✓ · Ana ○ · you ○   (1 of 2 required)     │  {AdminLinearProgress}
├──────────────────────────────────────────────────────────┤
│ Reward: 20 DAI · garden jar · unpaid   [ Record payout ] │  → {AdminConfirmDialog}
│                                                          │    captures rail reference
│ [ Confirm as fallback… ]  [ Raise dispute… ]             │  reason required; fallback
│ Provider address can never use fallback confirmation.    │  enforces self-action guard
│ Resolve dispute → ( Restore previous / Fulfilled /       │  steward-only; exact enum;
│                     Cancelled / Expired ) + reason        │  Expired cannot become Fulfilled
└──────────────────────────────────────────────────────────┘
```

- Review additions (audit 2026-07-18): for steward-reviewed (approval-gated) commitments the dialog shows the pending-claims queue inline with per-row Accept / Decline (the W7 grammar), so triage never requires leaving the dialog; the requirement rows render per-action progress ("Prune 2/2 · Plant 0/1"); the reward row follows settlement-record-first precedence (settlement-spec §3.3) and shows the confirmation threshold with named-confirmer status.

The latest hi-fi remediation adds this **proposed** accepted/evidence-in state and its two follow-on dialogs (`hifi/screens/admin.ts:422-438`):

```text
ACCEPTED · EVIDENCE IN — PROPOSED
┌──────────────────────────────────────────────────────────┐
│ Support · evidence-only · 2 items                        │
│ Evidence is in. Send it to the recipient, or mark it     │
│ ready with a recorded steward reason.                    │
├──────────────────────────────────────────────────────────┤
│ [ Cancel promise… ] [ Mark ready with override… ]        │
│                              [ Send for confirmation ]   │
└──────────────────────────────────────────────────────────┘

MARK READY WITH OVERRIDE           STEWARD CANCEL (MF-2b)
┌────────────────────────────┐     ┌────────────────────────────┐
│ Reason (required)          │     │ Reason (required)          │
│ [ field visit confirmed ]  │     │ [ agreement at gathering ]│
│              [ Mark ready ]│     │          [ Cancel promise ]│
└────────────────────────────┘     └────────────────────────────┘
```

**For human decision:** the hi-fi deliberately marks the accepted twin, override, and steward-cancel states as proposed. This wireframe records their current prototype placement and copy for coverage, but does not promote that placement into a locked design decision. W10's **Not found** state also stays explicit: stale or mid-sync links explain the failure and offer `[ Retry ]` plus `[ Back to pool ]`.

### W11 — Open-cycle allocation step (uiux-spec §6.10)

One step inside the open-cycle flow launched from W7's cycle console.

```text
┌── Open cycle: allocation policy ─────────────────────────┐
│ Who shares in this cycle's impact certificate            │  plain-language framing
│ preset  ◉ Garden-led (default)  ○ Balanced  ○ Custom     │
│ gardeners [ 60% ] treasury [ 15% ] steward [ 10% ]       │  % fields, all editable
│ evaluator [  5% ] community [  5% ] funder  [  5% ]      │  after a preset
│ sum: 100% ✓        stored on-chain as basis points (×100)│  hard rule: must equal 100%
│ ⚠ shows if treasury < 15% (garden-regeneration floor)    │  soft warning only
│ At close these shares become the certificate allowlist   │  → W26 wizard
│                          [ Open cycle ]                  │  snapshot emitted on-chain
└──────────────────────────────────────────────────────────┘
```

- Display unit is **percent**; "bps" appears only in the stored-as helper line (10000 bps = 100%) — the audit found bare "allocation BPS" labels unreadable.

### W12 — Pools mode inside admin `/community` (uiux-spec §6.8)

Pools view inside the existing admin `/community` workspace, reached through that workspace's tab rail/command palette. **Rescoped 2026-07-18**: the admin stays garden-focused — this mode shows exactly **your garden's pools + the Protocol pool**, never other gardens' pools. (The cross-garden oversight table that used to sit here moved to the deployer-gated Operations workspace, W24.) The Protocol pool is visible to garden stewards because their gardeners claim and fulfill its commitments — surveys, community activations, methodology work.

```text
┌────────────────────────────────────────────────────────────────────────┐
│ Community ▸ Pools        ◉ Protocol pool · ○ This garden               │  `/community` workspace tab
├────────────────────────────────────────────────────────────────────────┤
│ PROTOCOL POOL (root garden)                                            │
│ ┌─ claimable by your gardeners ──────────────────────────────────────┐ │
│ │ ≡ Methodology survey   (Request)(steward-reviewed)   1 survey    ▸ │ │  what your people can
│ │ ≡ Community activation (Request)(open)               3 events    ▸ │ │  take up — ▸ W25 flow
│ ├─ your garden's involvement ────────────────────────────────────────┤ │
│ │ ≡ Awka Hub (garden claim) → Methodology survey (Accepted)          │ │  claimant-kind column
│ │ ≡ Field survey — 1 of 2 confirmed                              ▸   │ │  ▸ W10
│ ├─ Funding view (references only) ───────────────────────────────────┤ │
│ │ ≡ 20 DAI · protocol treasury → Field survey (co-funded w/ Awka)    │ │  reward references
│ └────────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│ THIS GARDEN tab: the same W7 pool console, one tap away                │
│ (state chips Open · Confirmed · Past — no separate history view)       │
└────────────────────────────────────────────────────────────────────────┘
```

### W13 — Hub: Confirm stage (uiux-spec §6.9)

NET-NEW stage on the existing Hub pipeline rail, route `/hub/confirm`.

```text
┌────────────────────────────────────────────────────────────────────────┐
│ Hub      work (3) · assess (1) · certify (2) · ◉confirm (2) · history  │  stage rail + counts
├────────────────────────────────────────────────────────────────────────┤
│ Ready for confirmation — where you are named or fallback-eligible      │
│ ≡ Maria — Prune the north beds   (Rocinha)   ▓▓▓░░ 2 of 3          ▸   │  {AdminLinearProgress}
│ ≡ TAS — Field survey ride        (Awka)      ░░░░░ 0 of 1          ▸   │  row ▸ W10
└────────────────────────────────────────────────────────────────────────┘
```

Empty state: keep the Hub stage rail and show “No promises need confirmation” with a quiet route back to Work; never collapse the whole route into a blank canvas.

### W13b — Commitment-context chip on Hub work cards (delta to the existing work stage)

Where steward approval intersects promises — the D2 touchpoint the sequence diagram annotates — without any new surface:

```text
┌────────────────────────────────────────────────────────────────────────┐
│ Hub ▸ work                                                             │
│ ≡ Pruning session — Maria          (⚘ promise: Prune 1/2)          ▸   │  chip only when the work
│   approving this work advances the linked promise                      │  is linked to a commitment
└────────────────────────────────────────────────────────────────────────┘
```

- The chip names the matched requirement's per-action progress (approved/required) and deep-links to W10. Approval itself is untouched — the existing WorkApproval flow simply becomes legible as promise progress.

### HUBWORK — Existing Hub Work stage

The canonical hi-fi includes the underlying approval screen as its own entry (`hifi/screens/admin.ts:612-631`). Pooling adds context to the title and promise chip; approval and rejection remain the existing Work-stage rails.

```text
┌────────────────────────────────────────────────────────────────────────┐
│ Hub      ◉work · assess · certify · confirm · history                  │
├────────────────────────────────────────────────────────────────────────┤
│ Pruning session — Prune the north beds                                │
│ 2 photos · submitted by João · Jul 8                                  │
│                                              [ Approve ] [ Reject ]    │
│ Existing Work stage — approval rails untouched.                       │
└────────────────────────────────────────────────────────────────────────┘
```

### W14 — Assessment v3 additions to Create Assessment (uiux-spec §6.6)

Extends the existing `/hub/assess/create` flow's step 1 (domain context) — nothing else in the flow changes.

```text
┌── Create assessment — step 1 additions ──────────────────┐
│ cycle    [ Season of First Rains ▾ ]        NET-NEW      │
│ kind     ◉ Baseline   ○ Re-assessment (delta)            │  delta renders only for
│                                                          │  Evaluator-hat holders
│ baseline [ pick prior baseline… ▾ ]   (delta only)       │  same garden + domain
│ ⚠ one baseline per garden/cycle/domain — duplicate       │
│   attempts point at the existing record                  │
└──────────────────────────────────────────────────────────┘
```

---

## 4. Surface 3: Editorial website

### W15 — GardenDialog pool story section (uiux-spec §7.1)

Inserted **after `FieldNotesSection`, before Impact Certificates** in the existing `/gardens/:id` dialog. Read-only, aggregate-only.

```text
│ … field notes (existing, untouched) …        │
├──────────────────────────────────────────────┤
│ PROMISES                                     │  local SectionHeading grammar
│ This garden is midway through its Season     │  one state sentence (§4.1)
│ of First Rains.                              │
│ ▓▓▓▓▓▓▓▓▓░░░░  runs through Aug 30           │  one thin progress band
│ 9 promises made, 7 kept so far               │  counts-only sentence below the
│                                              │  threshold (≥5 due, ≥3 promisers
│ Recently kept: a pruning session ·           │  → percentages may render)
│ market rides · a tool library                │  fulfillment montage — outcome
│                                              │  titles only, never member names
│ Fulfilled promises from this cycle are       │  tie-in line down to the
│ anchored in the certificates below.          │  certificates section
├──────────────────────────────────────────────┤
│ … impact certificates (existing) …           │
```

- Pre-launch variant: readiness copy only, zero numbers ("This garden is preparing its first season of promises").
- Never rendered: cancelled/disputed items, per-person lists, wallet addresses.

### W16 — /impact promises section (uiux-spec §7.3)

One NET-NEW editorial band using the page's existing kicker/heading/reveal grammar, placed **between §01 proof markers and §02 "The cycle"** (decision 2026-07-18: promises get their own section AND the cycle pipeline learns the new stages).

```text
├──────────────────────────────────────────────┤
│ PROMISES                                     │  EditorialKicker — own band,
│ Work that starts as a promise kept           │  EditorialHeading  §01.5
│ ┌────────────┐ ┌────────────┐ ┌────────────┐ │
│ │ 43 promises│ │ 11 gardens │ │ G$ support │ │  stat tiles in the §01
│ │ fulfilled  │ │ live pools │ │ oracle-    │ │  proof-marker grammar
│ └────────────┘ └────────────┘ │ verified ✓ │ │
│                               └────────────┘ │
│                                              │  (thresholded per §7.2)
│ A promise is offered, taken up, worked,      │  one lifecycle sentence in
│ witnessed, and confirmed by the person it    │  relay vocabulary
│ was made to.                                 │
│ [ See the gardens ▸ ]                        │  → /gardens; no per-garden
└──────────────────────────────────────────────┘  table on this page, ever
```

- **§02 pipeline delta**: `PublicEvidencePipeline` gains the promise stages — Assessment → **Promise** → Work → **Confirmation** → Impact Certificate — so "The cycle" tells the whole story the band introduces. G$ tiles render only oracle-verified totals.

---

## 5. Surface 4: Community interface (September, `packages/community`)

The earlier Home / Signals / Profile and problem/upvote frames were superseded on 2026-07-04 and are removed to prevent accidental implementation. The current information architecture, flows, and low-fidelity screens are canonical in:

- `.plans/active/community-interface/spec.md`
- `.plans/active/community-interface/wireframes.md` (Needs / Create / Profile; problem-first Needs with Request / Offer only at commitment seeding)
- `.plans/active/community-interface/journeys.md`
- `.plans/active/community-interface/diagrams.md`

This commitment-pooling file retains only the shared commitment, confirmation, testimony, and settlement primitives those community screens consume.

---

## 6. Settlement deltas (August, settlement-spec §7)

G$ split-state settlement surfaces per `settlement-spec.md`. W21–W23 are new frames; W2 and W10 take copy/action deltas only (noted, not redrawn).

**W2 delta (PWA commitment detail, reward row)** — settlement record beats pooling `rewardPaid` when a disbursement exists: “support on its way” (Queued/Executing) · “transfer reported; awaiting receipt check” (Reported without an active request) · “transfer reported; checking receipt” (Reported with an active request) · “support arrived · oracle-verified ↗” with Celo reference · “still arranging support — your promise is recorded” (Failed). **W10 delta (admin commitment dialog)** — for G$-rewarded commitments, “Record payout” becomes “Queue disbursement” feeding W21's queue.

### W21 — Garden Pool tab: Settlement section (delta to W7)

New `{AdminCard}` on `/garden/pool`, below the cycle console.

```text
┌─ Settlement (Celo) ────────────────────────────────────────────────────┐
│ no settlement account yet   [ Set up settlement account ]              │  admin trigger → deterministic
│                                                                        │  Safe deploy + register (script
│  — once registered —                                                   │  path exists for batch rollout)
│ Safe celo:0x9a…4f (active) · balance 1,240 G$ · allowance 500 G$/wk    │
│ recovery: 2-of-3 · scoped executors: 2 · no owner/executor overlap     │
│ Functions: subscription funded · DON healthy · last callback 4m ago    │
│ Disbursements                                                          │
│ ≡ Maria — 20 G$    (Queued)                        [ add to batch ]    │
│ ≡ João — 15 G$     (Failed: reason ▸) [ Requeue ] [ Cancel… ]          │  reasons always visible
│ ≡ Ana — 20 G$      (Reported · checking receipt) [ request details ]   │
│ ≡ Kofi — 20 G$     (Oracle-verified ↗ Celo tx)                         │
│ [ Create batch (2) ]                                                   │  ▸ W22
└────────────────────────────────────────────────────────────────────────┘
```

- Gate status row (register #34f): the settlement card adds a read-only line — `member delivery: enabled · changed by 0x9a…4f · Jul 30 · evidence ↗` (or `disabled` + reason). The flip itself stays owner-only ops (`setMemberDeliveryEnabled`); this row only makes the gate legible.

### W22 — Batch execution and oracle console (Operations workspace + per-garden)

`{AdminDialog}` opened from W21 and from the NEW deployer-gated **Operations** workspace (W24) — relocated out of `/community` Pools by decision 2026-07-18.

```text
┌── Execute batch #12 — Rocinha ───────────────────────────────────┐
│ 2 of max 24 immutable members · 35 G$ · Safe 0x9a…4f     │
│ ≡ Maria — 20 G$ → 0x12…9a                                │
│ ≡ João — 15 G$ → 0x77…3c                                 │
│ [ Open in Safe app ↗ ]                                   │  August: signing happens in the
│ [ Mark executing ]                                       │  Safe app; in-app Safe SDK is
│ then [ Report Celo transaction hash… ]                   │  stores Reported + reportedBy;
│      [ Request receipt verification ]                    │  stores requestId; still Reported
│ or   [ Record failed — reason… ]                         │
├──────────────────────────────────────────────────────────┤
│ Reported · checking finalized Celo receipt               │
│ request 0x71…c2 · Chainlink Functions                    │
│ Infrastructure timeout: [ Request again ]                │  new request ID; no state loss
│ Receipt invalid: batch stays immutable; for each member  │
│                   [ Requeue ] [ Cancel with reason… ]     │  requeue clears old batchId
└──────────────────────────────────────────────────────────┘
```

- Role guard (register #34e): pilot executors hold the executor role (never a Safe owner, never a recovery owner). An account without the role sees "this account doesn't hold the executor role" on Mark executing / Report — a visible guard state, never a silent failure. No role-split UI.

### W23 — WalletDrawer: G$ section + member send (delta to W5)

```text
├──────────────────────────────────────────────┤
│ Support received (G$ · Celo)          128 G$ │
│ ≡ +20 G$ — Prune the north beds  (arrived ↗) │
│ [ Send G$ ]                                  │  shown only after AA gate
├──────────────────────────────────────────────┤
│ Send G$                                      │  {DialogShell}; explicit online
│ to [ address or member… ]  amount [    ] G$  │  action — never enters the
│ "Sent from your account on Celo.             │  offline field queue; gas is
│  No gas needed."                             │  sponsored (members hold no CELO)
│ [ Send ]                                     │
└──────────────────────────────────────────────┘
```

Gate-failed variant (same frame, no substitute custody flow):

```text
┌─ G$ member delivery ─────────────────────────┐
│ Planned · not available yet                  │
│ The Celo account and sponsored-send path has │
│ not passed its round-trip check. Safe-to-Safe│
│ garden funding may continue, but member      │
│ delivery and Send G$ stay unavailable.       │
│ [ View technical status ]                    │
└──────────────────────────────────────────────┘
```

### W24 — Operations workspace (NET-NEW, deployer-gated)

New admin workspace tab gated exactly like Actions (`showOperations: isDeployer` nav slot + `RequireRole ["deployer"]` route branch). Stage rail: **Queue · Oracle · Flows**. This is the protocol-admin execution home — everything cross-garden and cross-chain lives here, keeping the garden workspaces garden-focused.

```text
┌────────────────────────────────────────────────────────────────────────┐
│ Operations        ◉ queue (4) · oracle · flows                         │  deployer-gated tab
├────────────────────────────────────────────────────────────────────────┤
│ QUEUE — all gardens                                                    │
│ ≡ Rocinha  batch #12 · 2 members · 35 G$    (Queued)    [ Execute ▸ ]  │  ▸ W22
│ ≡ Awka     Maria — 20 G$                    (Failed ▸)  [ Requeue ]    │
│ ≡ protocol funding → Muizenberg · 200 G$    (Queued)    [ Execute ▸ ]  │  queueFunding rows too
├────────────────────────────────────────────────────────────────────────┤
│ ORACLE — verification health                                           │
│ subscription funded ✓ · DON ok ✓ · last callback 4m · 0 stale ignored  │
│ ≡ batch #11 · Reported · checking receipt · request 0x71…c2        ▸   │
├────────────────────────────────────────────────────────────────────────┤
│ FLOWS — cross-chain funds board                                        │
│ GoodDollar pool → GG protocol Safe    balance 4,120 G$  (Celo read)    │
│ GG protocol Safe → garden Safes       3 oracle-verified · 1 reported   │
│ garden Safes → members                42 oracle-verified · 2 failed    │
│ Gardens: ≡ Awka kept 8/9 · ≡ Muizenberg kept 5/6   (alphabetical)      │  oversight rows moved
└────────────────────────────────────────────────────────────────────────┘  from old W12; never ranked
```

- The **Flows board** is where protocol-Safe *inflow* (the HoA stream) becomes legible — a Celo balance read, since the module no longer records an upstream hop (corrections-log §9). Every downstream figure distinguishes Reported from oracle-verified.
- Executor-role guard (register #34e) applies to every execute/report control here, same as W22.

### W25 — Protocol-pool claim flow (client PWA)

The gardener journey the protocol pool exists for: claiming and fulfilling a protocol-seeded commitment (a survey, a community activation) from the client. Entry: the protocol-pool card surfaced in W1's garden context, or the WalletDrawer (W5).

```text
┌──────────────────────────────────────────────┐
│ (Protocol)(Request)  Methodology survey      │  (Protocol) chip is the only
│ 1 survey · stewards review who takes this up │  new mark on the W1 card
│ take this up as   ◉ myself   ○ this garden   │  garden option: eligible
│ [ Ask to take this up ]                      │  stewards only
├──────────────────────────────────────────────┤
│ → (waiting for review) chip                  │  W1 pending/declined/superseded
│ → accepted: deliver like any promise         │  grammar applies unchanged
│   work + evidence anchor to YOUR garden      │  providerGarden = your garden
│ → confirm via W4 when ready                  │
└──────────────────────────────────────────────┘
```

- No new grammar: the protocol pool reuses W1's cards and wait states, W2's delivery, W4's confirmation. Only the `(Protocol)` chip and the provider-context choice are new — and Work/assessments anchor to the claiming garden even though the commitment lives in the root pool (D2's providerGarden rule).

### W26 — Cycle close → allocation → certificate wizard (admin)

`{ActionFlowShell}` flow launched from W7's cycle console `[ Close Season ]` — makes the previously undefined cycle→hypercert linkage concrete by sequencing three things the specs already define: `closeCycle` (the reconcile act), the six-role allocation snapshot (W11 set it at open), and the commitment-bundled certificate cut-over (contract-spec §9).

```text
┌── Close cycle: Season of First Rains ── ● ● ● ○ ─────────┐
│ Step 1 — Review        9 promises · 7 kept · 62% units   │
│   unresolved first: 1 expired [ Re-seed… ]               │
│                     1 disputed [ Resolve… ]              │
│ Step 2 — Shares (read-only; locked at open, W11)         │
│   gardeners 60% · treasury 15% · steward 10%             │
│   evaluator 5% · community 5% · funder 5%                │
│ Step 3 — Impact certificate                              │
│   bundle: 7 fulfilled promises + their work, evidence,   │
│   and need lineage → allowlist from the shares above     │
│   [ Mint impact certificate ]   (existing Hypercert      │
│   pipeline; the garden account holds the certificate)    │
│ Step 4 — Rest the cycle    [ Reconcile + compost ]       │
│   aggregates roll into pool history; the next season     │
│   seeds fresh on this pool (D5)                          │
└──────────────────────────────────────────────────────────┘
```

- The wizard invents no contract surface — it choreographs `closeCycle` → certificate mint → `compostCycle` so stewards experience cycle close as one coherent ritual instead of three consoles.

## 7. Coverage check

| uiux-spec section | Frame |
|---|---|
| §5.2 pool home | W1 |
| §5.3 commitment detail | W2 |
| §5.4 creation flow | W3 |
| §5.5 evidence capture | W2a |
| §5.7 existing work submission + commitment context | WFLOW |
| §5.6 confirmation flow | W4 |
| §5.8 wallet panel | W5 (incl. the absorbed cross-garden summary header) |
| §5.10 hero moments | noted on W2/W4 (motion, not a screen) |
| §6.2 garden pool tab | W7 |
| §6.3 seeding console | W8 |
| §6.5 analog capture | W9 |
| §6.2.3/§6.7 commitment dialog, disputes, rewardPaid | W10 |
| §6.10 allocation step | W11 |
| §6.8 Pools view inside admin `/community` | W12 (rescoped 2026-07-18: your garden + protocol pool) |
| §6.9 Hub confirm stage | W13 + W13b commitment-context chip |
| Existing Hub Work approval stage | HUBWORK |
| §6.6 assessment v3 | W14 |
| Operations workspace (NET-NEW, deployer-gated) | W24 |
| Protocol-pool claim journey (client) | W25 |
| Cycle close → allocation → certificate | W26 |
| §7.1 garden pool story | W15 |
| §7.3 /impact section | W16 |
| Community member/public/admin/evaluator/funder views | canonical Community `wireframes.md` |
| settlement-spec §7 reward-status copy (PWA) | W2 delta note (§6) |
| settlement-spec §7 admin settlement card + disbursement queue | W21 |
| settlement-spec §7 batch execution console | W22 |
| settlement-spec §7 wallet G$ + member send | W23 |
| settlement-spec §5 AA-gate failure | W23 gate-failed variant |
| 2026-07-11 review adoptions (plan.todo.md register #34–register #35) | states folded into W1/W2/W7/W10/W21/W22; no standalone MF frames |
