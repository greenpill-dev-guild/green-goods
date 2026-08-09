// Legacy lo-fi data — verbatim ASCII frames, titles, and hotspot registry,
// moved from prototypes-artifact.build.ts during the hi-fi re-plumb (B0).
// September C-frames stay ASCII permanently; W-frames retire from here as
// they go hi-fi in hifi/screens/*. W6 is RETIRED (Decision Log #28f) — kept in
// data for reference, excluded from the screen registry by screens/index.ts.
//
// Season totals interpolate from ../fixtures so these ASCII frames cannot drift
// away from the hi-fi screens describing the same moment (PRD-760). Substituted
// values are the same width as the literals they replaced, so the box rules and
// column alignment below are unchanged.
import { SEASON_CLOSED, SEASON_LIVE } from "./fixtures";

export const F: Record<string, string> = {
W1: `┌──────────────────────────────────────────────┐
│ ←  Rocinha Community Garden                  │
│  Work · Insights · Gardeners · ◉Pool         │
├──────────────────────────────────────────────┤
│ Season of First Rains is open                │
│ ┌──────────────────────────────────────────┐ │
│ │ Season of First Rains        (season)    │ │
│ │ Seeded ─ ◉Open ─ In progress ─ Reviewing │ │
│ │ ▓▓▓▓▓▓▓▓▓░░░░░  62% of promised units    │ │
│ │ runs through Aug 30                      │ │
│ └──────────────────────────────────────────┘ │
│ Campaigns (2 open)                           │
│ ≡ Market rides (campaign) · Open · 6/16     │
│ ≡ Tool library (campaign) · Reviewing · 8/8 │
│ Scope: [All current] [Season] [Market rides] │
│ ┌───────────────────┐ ┌───────────────────┐  │
│ │ 12 offered        │ │ 7 fulfilled       │  │
│ └───────────────────┘ └───────────────────┘  │
│                                              │
│ [ Offer support ]      [ Request help ]      │
│                                              │
│ (All)(Offers)(Requests)(Matched)(Mine)       │
│ ┌──────────────────────────────────────────┐ │
│ │ (Offer)(AGRO)  Prune the north beds      │ │
│ │ 6 hours · due Aug 12                     │ │
│ │ anyone in this garden may take this up   │ │
│ │                       [ Take this up ]   │ │
│ └──────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────┐ │
│ │ (Request)  Ride to the market on Sat     │ │
│ │ 1 ride · runs with the season            │ │
│ │ stewards review who takes this up        │ │
│ │                 [ Ask to take this up ]  │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ My commitments                            ▸  │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│ │(Offered) │ │(Accepted)│ │··queued··│       │
│ └──────────┘ └──────────┘ └──────────┘       │
├──────────────────────────────────────────────┤
│    Home         Garden         Profile       │
└──────────────────────────────────────────────┘`,
W1P: `PENDING                              DECLINED
┌──────────────────────────────┐     ┌────────────────────────────────┐
│ Waiting for steward          │     │ Steward declined this request │
│ Individual · requested Jul 9 │     │ Reason: provider context …     │
│ Provider: myself             │     │ [Ask again] [Back to browse]   │
└──────────────────────────────┘     └────────────────────────────────┘`,
W1S: `SUPERSEDED                           ACCEPTED
┌──────────────────────────────┐     ┌────────────────────────────────┐
│ No longer available          │     │ Your request was accepted      │
│ This is not a sync failure.  │     │ Provider garden: Rocinha       │
│ [Back to browse]             │     │ [Open commitment]              │
└──────────────────────────────┘     └────────────────────────────────┘`,
W2: `┌──────────────────────────────────────────────┐
│ ←  Prune the north beds                      │
│ (Offer)(AGRO)(Accepted)  6 hours · due Aug 12│
│ anyone in this garden may take this up       │
│ (recorded by your steward on your behalf)    │
├──────────────────────────────────────────────┤
│ Timeline                                     │
│ ● Offered      — Maria · Jul 2               │
│ ● Accepted     — João took this up · Jul 3   │
│ ● Work linked  — pruning session · Jul 8     │
│ ● Ready        — steward note: "confirmed    │
│                  on site visit" (override)   │
├──────────────────────────────────────────────┤
│ Evidence                          [ + Add ]  │
│ ≡ photo — north beds after (Jul 8)           │
│ ≡ note — "two beds left for next week"       │
├──────────────────────────────────────────────┤
│ Work for this promise                        │
│ ≡ Pruning session       (Approved)           │
│ [ Submit work for this promise ]             │
│ [ Link existing work ]                       │
├──────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────┐ │
│ │ [ Confirm: promise kept ]                │ │
│ └──────────────────────────────────────────┘ │
│ Reward: 20 DAI from the garden jar · pending │
│ recorded on Arbitrum                         │
└──────────────────────────────────────────────┘`,
W3: `┌──────────────────────────────────────────────┐   Step 2 — How much
│ ✕  Make an offer              ● ● ○ ○        │   ┌────────────────────────┐
├──────────────────────────────────────────────┤   │ Unit  [ hours        ▾ ]│
│ Step 1 — What                                │   │ suggestions: hours,     │
│ direction   ◉ Offer support  ○ Request help  │   │ tasks, meals, rides,    │
│ type        ◉ Garden work (impact)           │   │ plants                  │
│             ○ Support / service              │   │ How many  [ 6 ]         │
│   (season/campaign + on-behalf capture are   │   │ Due  {DatePicker}       │
│    console-seeded only — not shown here)     │   │  or ◉ selected deadline │
│ cycle scope [Season: First Rains ▾]          │   └────────────────────────┘
│ title  [ Prune the north beds            ]   │   Step 3 — Anchors
│ note   [ optional                        ]   │   (DomainImpact only)
├──────────────────────────────────────────────┤   action cards: ◉Prune ○Plant
│                        [ Continue ]          │
└──────────────────────────────────────────────┘
Step 4 — Review and promise
┌──────────────────────────────────────────────┐
│ summary card (all fields)                    │
│ [ Make this offer ]                          │
│  → enqueues commitment job, returns to the   │
│    pool tab with optimistic card + queued    │
└──────────────────────────────────────────────┘`,
W4: `┌──────────────────────────────────────────────┐
│ Promise kept?                                │
│ Prune the north beds — Maria · 6 hours       │
│ Offer · provider Maria · recipient confirms  │
│ evidence: 2 items · linked work: 1 approved  │
├──────────────────────────────────────────────┤
│ Confirmations   ▓▓▓▓▓▓▓░░░  2 of 3           │
│ ≡ João ✓        ≡ Ana ✓       ≡ you ○        │
│ Provider Maria cannot confirm this delivery. │
├──────────────────────────────────────────────┤
│ [ Confirm — promise kept ]                   │
│ [ Not yet — tell the stewards why ]          │
└──────────────────────────────────────────────┘`,
W5: `┌──────────────────────────────────────────────┐
│ Wallet            ○ jar  ○ vault  ◉ pools +2 │
├──────────────────────────────────────────────┤
│ Waiting on you                               │
│ ≡ Maria — Prune the north beds   (Rocinha) ▸ │
│ ≡ TAS Hub — Field survey ride    (Awka)    ▸ │
├──────────────────────────────────────────────┤
│ My commitments                               │
│ Rocinha Community Garden                     │
│ ≡ ··queued·· Compost workshop    (Offered)   │
│ ≡ Ride to market                 (Accepted) ▸│
│ Muizenberg                                   │
│ ≡ Beach cleanup Saturday         (Fulfilled)▸│
└──────────────────────────────────────────────┘`,
W6: `┌──────────────────────────────────────────────┐
│ Retired frame — compatibility redirect       │
│ W6 deep links resolve to WalletDrawer W5  ▸  │
└──────────────────────────────────────────────┘`,
W7: `┌────────────────────────────────────────────────────────────────────────┐
│ Garden ▸ Rocinha        overview · activity · ◉pool · settings         │
├────────────────────────────────────────────────────────────────────────┤
│ ┌─ Pool ─────────────────────────────────────────────────────────────┐ │
│ │ (Open) charter ✓ baseline ✓ cap 24     [ Pause… ] [ Edit charter ] │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│ ┌─ Cycles console ───────────────────────────────────────────────────┐ │
│ │ SEASON · First Rains · Open                                        │ │
│ │ Seeded ─ ◉Open ─ InProgress ─ Reviewing ─ Reconciled ─ Composted   │ │
│ │ [ Close Season ] [ Cancel… ]  [ Open Season disabled: one exists ]│ │
│ │ CAMPAIGNS (2 open)                                  [ New Campaign ]│ │
│ │ ≡ Market rides · Open · 6/16                [ Close ] [ Cancel… ] │ │
│ │ ≡ Tool library · Reviewing · 8/8            [ Review ] [ Cancel… ]│ │
│ │ History: ≡ Winter campaign (Reconciled) — scoped report ▸          │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│ ┌─ Commitments ──────────────────────────────────────────────────────┐ │
│ │ [search………] (state ▾)(type ▾)(direction ▾)  sort: newest ▾         │ │
│ │ ≡ Prune the north beds   (Offer)(Accepted)   6h    Maria         ▸ │ │
│ │ ≡ Market ride            (Request)(Ready)    1     João          ▸ │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│ ┌─ Claims waiting (approval-gated) ──────────────────────────────────┐ │
│ │ Field survey · request terms                                       │ │
│ │ ≡ claimant 0x12…9a · requested by same · individual · Jul 9       │ │
│ │                                      [ Accept ] [ Decline… ]       │ │
│ │ ≡ claimant Awka Hub · requested by 0x45…2b · garden · Jul 10      │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│                                                        (+) seed        │
└────────────────────────────────────────────────────────────────────────┘`,
W7X: `DECLINE A                            ACCEPT B
┌──────────────────────────────┐     ┌────────────────────────────────┐
│ A · Declined · reason…       │     │ B · Accepted · stored terms   │
│ B · Pending (unchanged)      │     │ A · Superseded                │
└──────────────────────────────┘     │ other pending · Superseded    │
                                     └────────────────────────────────┘`,
W8: `┌── Seed a commitment ── ● ● ● ○ ──────────────────────────┐
│ Step 1 — Type and scope                                  │
│ type   ◉ Season/campaign  ○ Support  ○ Impact  ○ Capture │
│ direction  ◉ the pool offers   ○ the pool requests       │
│ cycle  [ Season: First Rains ▾ ]                         │
│ title  [                              ]  note [        ] │
├──────────────────────────────────────────────────────────┤
│ Step 2 — Requirements                                    │
│ unit [ hours ▾ ]  target [ 12 ]  approved works [ 2 ]    │
│ assessment required  ○ yes ◉ no   due [ cycle deadline ] │
├──────────────────────────────────────────────────────────┤
│ Step 3 — Confirmation rule and reward                    │
│ confirmers  [ + add address ]  ≡ Maria ✕  ≡ João ✕       │
│ threshold   N = [ 2 ] of 2                               │
│ claim mode  ◉ open   ○ steward-reviewed                  │
│ rail        ○ none  ◉ external payout  ○ Celo G$         │
│ external    source [ garden jar ▾ ] token [DAI] amt [20] │
├──────────────────────────────────────────────────────────┤
│ Step 4 — Review · ArbitrumExternal                       │
│                              [ Seed this commitment ]    │
└──────────────────────────────────────────────────────────┘`,
W9: `┌── Record on a member's behalf ───────────────────────────┐
│ "Recorded by {steward} on your behalf.                   │
│  The promise stays yours."                               │
├──────────────────────────────────────────────────────────┤
│ Step 0 — Who and what kind                               │
│ member   [ search members… ▾ ]                           │
│ capture  ◉ their offer  ○ their request  ○ confirmation  │
│          (captured confirmations always carry a reason)  │
├──────────────────────────────────────────────────────────┤
│ … steps continue as W8 steps 2–4 …                       │
└──────────────────────────────────────────────────────────┘`,
W10: `┌── Prune the north beds ──────────────── (Offer)(Ready) ──┐
│ Maria → João · 6 hours · due Aug 12 · open claim         │
│ Timeline: Offered → Accepted → Work linked → Ready       │
│ Evidence (2)  ≡ photo  ≡ note                            │
│ Linked work (1)  ≡ Pruning session (Approved)            │
│ Provider: Maria (cannot confirm)                          │
│ Eligible: João ✓ · Ana ○ · you ○   (1 of 2 required)     │
├──────────────────────────────────────────────────────────┤
│ Rail: ArbitrumExternal                                   │
│ Reward: 20 DAI · garden jar · unpaid   [ Record payout ] │
│ [ Confirm as fallback… ]  [ Raise dispute… ]             │
│ Provider address can never use fallback confirmation.    │
│ Resolve dispute → ( Restore previous / Fulfilled /       │
│                     Cancelled / Expired ) + reason        │
└──────────────────────────────────────────────────────────┘`,
W11: `┌── Open cycle: allocation policy ─────────────────────────┐
│ preset  ◉ Garden-led (default)  ○ Balanced  ○ Custom     │
│ gardeners [6000] treasury [1500] steward [1000]          │
│ evaluator [ 500] community [ 500] funder   [ 500]        │
│ sum: 10000 ✓                                             │
│ ⚠ shows if treasury < 1500 bps (guidance floor)          │
│                          [ Open cycle ]                  │
└──────────────────────────────────────────────────────────┘`,
W12: `┌────────────────────────────────────────────────────────────────────────┐
│ Community ▸ Pools        ◉ Protocol pool · ○ Gardens                   │
├────────────────────────────────────────────────────────────────────────┤
│ PROTOCOL POOL (root garden)                                            │
│ ├─ Funding view ─────────────────────────────────────────────────────┤ │
│ │ ≡ 20 DAI · protocol treasury → Field survey (co-funded w/ Awka)    │ │
│ ├─ Claims across gardens ────────────────────────────────────────────┤ │
│ │ ≡ Awka Hub (garden claim) → Methodology survey    [ Accept ]       │ │
│ ├─ Confirmations queue ──────────────────────────────────────────────┤ │
│ │ ≡ Field survey — 1 of 2 confirmed                              ▸   │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│ GARDENS tab: one row per garden — alphabetical, never ranked           │
│ ≡ Awka Hub   Season: InProgress · 2 campaigns   kept 8/9  exposure 14  │
└────────────────────────────────────────────────────────────────────────┘`,
W13: `┌────────────────────────────────────────────────────────────────────────┐
│ Hub      work (3) · assess (1) · certify (2) · ◉confirm (2) · history  │
├────────────────────────────────────────────────────────────────────────┤
│ Ready for confirmation — where you are named or fallback-eligible      │
│ ≡ Maria — Prune the north beds   (Rocinha)   ▓▓▓░░ 2 of 3          ▸   │
│ ≡ TAS — Field survey ride        (Awka)      ░░░░░ 0 of 1          ▸   │
└────────────────────────────────────────────────────────────────────────┘`,
W14: `┌── Create assessment — step 1 additions ──────────────────┐
│ cycle    [ Season of First Rains ▾ ]        NET-NEW      │
│ kind     ◉ Baseline   ○ Re-assessment (delta)            │
│ baseline [ pick prior baseline… ▾ ]   (delta only)       │
│ ⚠ one baseline per garden/cycle/domain — duplicate       │
│   attempts point at the existing record                  │
└──────────────────────────────────────────────────────────┘`,
W15: `│ … field notes (existing, untouched) …        │
├──────────────────────────────────────────────┤
│ PROMISES                                     │
│ This garden is midway through its Season     │
│ of First Rains.                              │
│ ▓▓▓▓▓▓▓▓▓░░░░  runs through Aug 30           │
│ ${SEASON_LIVE.made} promises made, ${SEASON_LIVE.kept} kept so far               │
│ Fulfilled promises from this cycle are       │
│ anchored in the certificates below.          │
├──────────────────────────────────────────────┤
│ … impact certificates (existing) …           │`,
W16: `├──────────────────────────────────────────────┤
│ PROMISES                                     │
│ Work that starts as a promise kept           │
│ 11 gardens with live pools · 43 promises     │
│ fulfilled this season                        │
│ A promise is offered, taken up, worked,      │
│ witnessed, and confirmed by the person it    │
│ was made to.                                 │
│ [ See the gardens ▸ ]                        │
└──────────────────────────────────────────────┘`,
W21: `┌─ Settlement (Celo) ────────────────────────────────────────────────────┐
│ no settlement account yet   [ Review registration requirements ]       │
│                                                                        │
│  — once registered —                                                   │
│ Safe celo:0x9a…4f (active) · balance 1,240 G$ · allowance 500 G$/wk    │
│ member delivery: enabled · changed by 0x9a…4f · Jul 30 · evidence ↗    │
│ CCIP: peers configured · native reserves funded · last ack 4m ago      │
│ Disbursements                                                          │
│ ≡ settlement 104 / attempt 0   (Queued)             [ dispatch ]       │
│ ≡ settlement 103 / attempt 1   (Failed: route rejected) [retry][close] │
│ ≡ settlement 102 / attempt 0   (confirming arrival) [ retry ack ]      │
│ ≡ settlement 101 / attempt 0   (Confirmed ↗ Celo tx)                   │
│ [ Create batch (2) ]                                                   │
└────────────────────────────────────────────────────────────────────────┘`,
	W22: `┌── Settlement 104 / attempt 0 — Rocinha ───────────────────────────┐
│ 2 of configured 8 · hard ceiling 24 · 35 G$ · no G$ in CCIP │
│ payer Rocinha pool Safe · Celo peer/version/gas snapshot     │
│ ≡ Maria — 20 G$ → 0x12…9a                                │
│ ≡ João — 15 G$ → 0x77…3c                                 │
│ [ Dispatch command ]                                     │
│ command 0xab…11 ↗ CCIP Explorer · Dispatched             │
│ destination 0xce…42 ↗ Celoscan · outcome stored          │
│ acknowledgment 0xac…09 ↗ CCIP Explorer · pending         │
├──────────────────────────────────────────────────────────┤
│ delivery delay is derived, never manually marked         │
│ [ Manual-execution guidance ] [ Retry same command ]     │
│ [ Retry acknowledgment ] — never moves G$ twice          │
│ authenticated failure: [ Requeue member ]                │
│ queued only: [ Cancel whole batch ] · no partial member  │
└──────────────────────────────────────────────────────────┘`,
W23: `├──────────────────────────────────────────────┤
│ Support received (G$ · Celo)          128 G$ │
│ ≡ +20 G$ — Prune the north beds  (arrived ↗) │
│ [ Send G$ ]                                  │
├──────────────────────────────────────────────┤
│ Send G$                                      │
│ to [ address or member… ]  amount [    ] G$  │
│ "Sent from your account on Celo.             │
│  No gas needed."                             │
│ [ Send ]                                     │
└──────────────────────────────────────────────┘`,
W23G: `┌─ G$ member delivery ─────────────────────────┐
│ Planned · not available yet                  │
│ The Celo account and sponsored-send path has │
│ not passed its round-trip check. Safe-to-Safe│
│ garden funding may continue, but member      │
│ delivery and Send G$ stay unavailable.       │
│ [ View technical status ]                    │
└──────────────────────────────────────────────┘`,
W24: `┌────────────────────────────────────────────────────────────────────────┐
│ Operations        ◉ queue (4) · CCIP · flows                           │
├────────────────────────────────────────────────────────────────────────┤
│ QUEUE — all gardens                                                    │
│ ≡ Rocinha  batch #12 · 2 members · 35 G$             (Queued)    [ Execute ▸ ]  │
│ ≡ Awka     Maria — 20 G$                    (Failed ▸)  [ Requeue ]    │
│ ≡ protocol funding → Muizenberg · 200 G$    (Queued)    [ Execute ▸ ]  │
├────────────────────────────────────────────────────────────────────────┤
│ CCIP — command / execution / acknowledgment health                     │
│ Arbitrum reserve ✓ · Celo reserve ✓ · peers ✓ · 0 deferrals           │
│ ≡ settlement 102 · execution stored · acknowledgment pending              ▸   │
├────────────────────────────────────────────────────────────────────────┤
│ FLOWS — cross-chain funds board                                        │
│ GoodDollar pool → GG protocol Safe    balance 4,120 G$  (Celo read)    │
│ GG protocol Safe → garden Safes       3 confirmed · 1 dispatched       │
│ garden Safes → members                42 confirmed · 2 failed          │
│ Gardens: ≡ Awka kept 8/9 · ≡ Muizenberg kept 5/6   (alphabetical)      │
└────────────────────────────────────────────────────────────────────────┘`,
W25: `┌──────────────────────────────────────────────┐
│ (Protocol)(Request)  Methodology survey      │
│ 1 survey · stewards review who takes this up │
│ take this up as   ◉ myself   ○ this garden   │
│ [ Ask to take this up ]                      │
├──────────────────────────────────────────────┤
│ → (waiting for review) chip                  │
│ → accepted: deliver like any promise         │
│   work + evidence anchor to YOUR garden      │
│ → confirm via W4 when ready                  │
└──────────────────────────────────────────────┘`,
W26: `┌── Close cycle: Season of First Rains ── ● ● ● ○ ─────────┐
│ Step 1 — Review        ${SEASON_LIVE.made} promises · ${SEASON_LIVE.kept} kept · 62% units   │
│   unresolved first: 1 expired [ Re-seed… ]               │
│                     1 disputed [ Resolve… ]              │
│ Step 2 — Shares (read-only; locked at open, W11)         │
│   gardeners 60% · treasury 15% · steward 10%             │
│   evaluator 5% · community 5% · funder 5%                │
│ Step 3 — Impact certificate                              │
│   bundle: 7 fulfilled promises + their work, evidence,   │
│   and need lineage → allowlist from the shares above     │
│   [ Mint impact certificate ]                            │
│ Step 4 — Rest the cycle    [ Reconcile + compost ]       │
│   aggregates roll into pool history; the next season     │
│   seeds fresh on this pool (D9)                          │
└──────────────────────────────────────────────────────────┘`,
MF1: `┌─ Pool ─────────────────────────────────────────────────────────────┐
│ (Ready) charter ✓ baseline ✓ cap 24                                │
│ [ Open pool ]                    [ Edit charter ] [ Pause… ]       │
│  — once Open —                                                     │
│ [ Close pool… ]  after all cycles end and pool live count = 0      │
└────────────────────────────────────────────────────────────────────┘`,
MF3: `┌──────────────────────────────────────────────┐
│ (Expired)  This promise ran through Aug 12.  │
│ The season moved on — you can offer it again.│
│ [ Offer again ]                              │
└──────────────────────────────────────────────┘`,
MF4: `┌─ Lapsed this cycle ────────────────────────────────────────────────────┐
│ ≡ Field survey  (Request)(Expired)  due Jul 2 · 0 of 1 taken up        │
│                                  [ Re-seed… ]  [ View history ]        │
└────────────────────────────────────────────────────────────────────────┘`,
MF5: `│ ≡ ··waiting·· Compost workshop   (Offered)   │
│   waiting for your garden membership —       │
│   will send once you're welcomed in          │`,
MF6: `┌──────────────────────────────────────────────┐
│ Evidence attached: 1 · no work required      │
│ [ Send for confirmation ]                    │
│ the person this promise was made to          │
│ confirms it was kept                         │
└──────────────────────────────────────────────┘`,
MF8: `┌──────────────────────────────────────────────┐
│ Take this up…                                │
│ ◉ as myself                                  │
│ ○ for Awka Hub (you steward this garden)     │
│ Working for the garden: its account makes    │
│ the promise; you remain the requester.       │
│ [ Continue ]                      [ Cancel ] │
└──────────────────────────────────────────────┘`,
MF9: `┌── Season of First Rains — report ────────────────────────────────┐
│ ${SEASON_CLOSED.made} promises · ${SEASON_CLOSED.kept} kept · ${SEASON_CLOSED.expired} expired · ${SEASON_CLOSED.cancelled} cancelled                  │
│ units: 61 of 74 promised                                         │
│ [ Compost this season ]                    [ Export… flagged ]   │
└──────────────────────────────────────────────────────────────────┘`,
MF10: `┌──────────────────────────────────────────────┐
│ Season of First Rains — season closed        │
│ ${SEASON_CLOSED.kept} of ${SEASON_CLOSED.made} promises kept · ${SEASON_CLOSED.units} units            │
│ ready for the next season                    │
└──────────────────────────────────────────────┘`,
MF13: `┌── Attach assessment ─────────────────────────┐
│ provider garden: AgroforestDAO               │
│ ◉ Baseline — AGRO — Jul 2   (v3)             │
│ ○ Delta — AGRO+EDU — Jul 9  (v3)             │
│ [ Attach ]                        [ Cancel ] │
└──────────────────────────────────────────────┘`,
WFLOW: `┌──────────────────────────────────────────────┐
│ ✕  Submit work        Intro ● Media ● Rev ◉  │
├──────────────────────────────────────────────┤
│ Review                                       │
│ ≡ 2 photos · pruning session                 │
│ fulfills: Plant 200 seedlings (Offer · AGRO) │
│ [ Submit work ]                              │
└──────────────────────────────────────────────┘
existing Garden-tab work flow — only the
"fulfills:" row is new (MF-7, UX:174)`,
HUBWORK: `┌──────────────────────────────────────────────────────────┐
│ Hub   ◉work (3) · assess · certify · confirm · history   │
├──────────────────────────────────────────────────────────┤
│ ≡ Pruning session — Plant 200 seedlings                  │
│   [ Approve ]  [ Reject ]                                │
└──────────────────────────────────────────────────────────┘
existing Work stage — approval rails untouched (UX:285)`,
C1: `┌──────────────────────────────────────────────┐
│ Rocinha Community Garden                    │
│ This season · promises and progress         │
├──────────────────────────────────────────────┤
│ Needs                             [Explore] │
│ [All] [Open] [Committed] [In progress]      │
├──────────────────────────────────────────────┤
│ THIS MONTH · IN PROGRESS                     │
│ Elders need reliable market rides           │
│ Better: two rides each market day           │
│ Agro · Education · 8 support · 2 do not     │
│ Acknowledged · In progress                  │
│         [View] [Support] [Do not support]   │
├──────────────────────────────────────────────┤
│    Needs          ＋ Create          Profile │
└──────────────────────────────────────────────┘`,
C3: `┌──────────────────────────────────────────────┐
│ Create                                1 of 3 │
│ What is your community trying to solve?     │
├──────────────────────────────────────────────┤
│ Describe the problem in your own words.      │
│ Requests and offers come later, when someone │
│ makes a commitment to address this Need.     │
├──────────────────────────────────────────────┤
│ Tell us in your words                        │
│ [● Record]  or  [Type here…                ]│
│ Audio is kept · transcript can be edited    │
├──────────────────────────────────────────────┤
│ [Save and leave]                 [Continue] │
└──────────────────────────────────────────────┘`,
C4: `┌──────────────────────────────────────────────┐
│ Review                                3 of 3 │
│ THIS MONTH · NEED                            │
│ Elders need reliable market rides           │
│ Better: two rides each market day           │
│ Audio 0:42 · 2 photos                        │
├──────────────────────────────────────────────┤
│ SAVED ON THIS DEVICE                         │
│ Waiting for garden membership. No send      │
│ attempts have been used.                    │
│ [About membership] [Edit] [Cancel] [Delete]│
├──────────────────────────────────────────────┤
│ [Share with my garden]                       │
└──────────────────────────────────────────────┘`,
C5: `┌──────────────────────────────────────────────┐
│ ← Elders need reliable market rides          │
│ THIS MONTH                                   │
│ Moderation: Acknowledged                     │
│ Progress: In progress                        │
├──────────────────────────────────────────────┤
│ Your neighbor's words                        │
│ “Market days are hard for elders…” [▶ audio]│
├──────────────────────────────────────────────┤
│ What followed                                │
│ ✓ Need acknowledged                         │
│ ✓ Promise: 16 market rides this season      │
│ ● Work: 6 rides approved                    │
│ ○ Assessment and eligible confirmation      │
│ ○ Fulfillment and community testimony       │
├──────────────────────────────────────────────┤
│ Funding context                              │
│ 120 G$ funding attribution verified         │
│ Funding supports the garden; it is not escrow│
├──────────────────────────────────────────────┤
│ [Support] [Do not support] [Clear my signal]│
│                              [Add testimony]│
└──────────────────────────────────────────────┘`,
C6: `┌──────────────────────────────────────────────┐
│ Profile                                      │
├──────────────────────────────────────────────┤
│ Garden membership                            │
│ Rocinha · Waiting for steward approval      │
│ [How this works] [Cancel request]*           │
├──────────────────────────────────────────────┤
│ Saved and sending                            │
│ Need · Waiting for membership       [Edit]  │
│ Signal · Offline                    [Retry] │
│ Testimony · Upload failed            [Retry]│
├──────────────────────────────────────────────┤
│ Needs your confirmation                      │
│ Market rides · work is ready to review      │
│ You are the eligible Request creator        │
│ [Review evidence] [Confirm fulfillment]     │
└──────────────────────────────────────────────┘`,
C9: `┌──────────────────────────────────────────────────────────────┐
│ Community / For the gathering                               │
│ [Fresh Needs] [Confirmations] [Recent changes] [Print]      │
├──────────────────────────────────────────────────────────────┤
│ WEEK · Moderation: none · Progress: open                    │
│ Water is pooling beside the school path                     │
│ Better: the path stays passable after rain                  │
│ Domains [Waste ×] [＋ Add domain]                            │
│ [Acknowledge] [Merge…] [Decline…] [Hide…]                  │
├──────────────────────────────────────────────────────────────┤
│ SEASON · Acknowledged · Open                                │
│ Weekend work days lack a shared tool library                │
│ No domain assigned                     [Seed a commitment]  │
└──────────────────────────────────────────────────────────────┘`,
C10: `┌──────────────────────────────────────────────────────────────┐
│ Community / Seed commitment                                 │
│ From Need: Water beside the school path                     │
├──────────────────────────────────────────────────────────────┤
│ Need UID              [0x91…]  linked, read-only            │
│ Pool / cycle          [Choose…]                             │
│ Offer or Request      [Choose…]                             │
│ Units and target      [________] [________]                  │
│ Domains suggested    [Waste ×] [＋ Add]                     │
│ Confirmer rule       [____________________]                  │
├──────────────────────────────────────────────────────────────┤
│ Suggestions are not saved until you review every field.     │
│ [Cancel]                       [Review commitment]           │
└──────────────────────────────────────────────────────────────┘`,
};

export const FT: Record<string, string> = {
  W1: "W1 · Pool tab (garden detail)", W1P: "W1 · claim-request panels (pending/declined)", W1S: "W1 · claim-request panels (superseded/accepted)",
  W2: "W2 · Commitment detail", W3: "W3 · Offer/request creation", W4: "W4 · Confirmation sheet", W5: "W5 · WalletDrawer pools panel",
  W6: "W6 · retired → W5 compatibility alias", W7: "W7 · Garden Pool tab (admin)", W7X: "W7 · claim outcomes", W8: "W8 · Seeding console",
  W9: "W9 · Analog capture", W10: "W10 · Commitment dialog (admin)", W11: "W11 · Open-cycle allocation", W12: "W12 · Community → Pools",
  W13: "W13 · Hub Confirm stage", W14: "W14 · Assessment v3 additions", W15: "W15 · Garden pool story (public)", W16: "W16 · /impact promises (public)",
  W21: "W21 · Settlement section (admin)", W22: "W22 · CCIP command/ack console", W23: "W23 · Wallet G$ + send", W23G: "W23 · delivery blocked",
  MF1: "MF-1 · Pool lifecycle actions (realized)", MF3: "MF-3 · Expired band (realized)", MF4: "MF-4 · Expiry queue (realized)",
  MF5: "MF-5 · Membership-wait chrome (realized)", MF6: "MF-6 · Send for confirmation (realized)", MF8: "MF-8 · Provider-context chooser (realized)",
  MF9: "MF-9 · Reconciliation report (realized)", MF10: "MF-10 · Cycle summary card (realized)", MF13: "MF-13 · Attach-assessment picker (realized)",
  W24: "W24 · Operations workspace (admin)", W25: "W25 · Protocol-pool claim (client)", W26: "W26 · Cycle-close wizard (admin)",
  WFLOW: "Existing work flow (+ fulfills row)", HUBWORK: "Existing Hub Work stage",
  C1: "CI-W1 · Needs board (Sept)", C3: "CI-W3 · Create — intent + words (Sept)", C4: "CI-W4 · Review + queue state (Sept)",
  C5: "CI-W5 · Need detail (Sept)", C6: "CI-W6 · Profile (Sept)", C9: "CI-W9 · Gathering + triage (Sept)", C10: "CI-W10 · Seed from Need (Sept)",
};

export type Hot = { m: string; l: string; to?: string; info?: string };
export const HOTMAP: Record<string, Hot[]> = {
W1: [
  { m: "[ Offer support ]", l: "Offer support", to: "frame:W3", info: "Starts the creation flow with direction = offer (UX:120). Walked in SB-1." },
  { m: "[ Request help ]", l: "Request help", to: "frame:W3", info: "Creation flow with direction = request. Walked in SB-2." },
  { m: "[ Take this up ]", l: "Take this up (open claim)", to: "frame:W2", info: "Open mode: claim job → optimistic Accepted (UX:129). Walked in SB-1." },
  { m: "[ Ask to take this up ]", l: "Ask to take this up (steward-reviewed)", to: "frame:W1P", info: "Approval-gated: creates a claim request with stored terms; the commitment stays available to others (UX:99). Walked in SB-3." },
  { m: "Scope: [All current] [Season] [Market rides]", l: "Scope control", info: "Filters the list; every aggregate names its scope — Season and Campaigns never blur (UX:127)." },
  { m: "(All)(Offers)(Requests)(Matched)(Mine)", l: "Filter chips", info: "Client-local filter chips (admin AdminFilterChip is admin-only)." },
  { m: "My commitments", l: "My commitments strip", to: "frame:W5", info: "Your own promises across gardens live in the WalletDrawer pools panel (UX:186)." },
  { m: "Home         Garden         Profile", l: "AppBar", info: "Unchanged three-tab AppBar; the Garden tab is the existing work-submission flow (UX:116)." },
],
W1P: [
  { m: "[Ask again]", l: "Ask again", info: "Creates a FRESH request while the commitment is claimable — never retries the declined row (UX:105)." },
  { m: "[Back to browse]", l: "Back to browse", to: "frame:W1", info: "Declined/superseded exits return to browse." },
],
W1S: [
  { m: "[Open commitment]", l: "Open commitment", to: "frame:W2", info: "Acceptance names the counterparty / provider garden (UX:104)." },
  { m: "[Back to browse]", l: "Back to browse", to: "frame:W1" },
],
W2: [
  { m: "[ + Add ]", l: "Add evidence", info: "W2a attach sheet: photo / link / note → one evidence job per submit; fully offline (UX:159)." },
  { m: "[ Submit work for this promise ]", l: "Submit work for this promise", to: "frame:WFLOW", info: "Deep-links the existing Garden-tab work flow with commitment context (UX:174). DomainImpact only." },
  { m: "[ Link existing work ]", l: "Link existing work", info: "Picker of your approved/pending works → workLink job (UX:140)." },
  { m: "[ Confirm: promise kept ]", l: "Confirm", to: "frame:W4", info: "Visible only to eligible confirmers while ReadyForConfirmation — the provider never sees it (UX:142)." },
  { m: "Reward: 20 DAI from the garden jar · pending", l: "Declared reward row", info: "Reference only — no custody. When a G$ disbursement exists, settlement status replaces this line (SS §7)." },
  { m: "recorded on Arbitrum", l: "Chain phrasing", info: "Chain vocabulary lives on the detail engage layer only — never on browse cards (UX:436)." },
],
W3: [
  { m: "[ Continue ]", l: "Continue", info: "Four steps: what + cycle scope → how much → anchors (DomainImpact only) → review (UX:150-153)." },
  { m: "[ Make this offer ]", l: "Make this offer", to: "frame:W1", info: "Enqueues the commitment job; returns to the pool tab with an optimistic queued card (UX:212)." },
],
W4: [
  { m: "[ Confirm — promise kept ]", l: "Confirm — promise kept", to: "frame:W2", info: "Positive-only confirmation job; the Nth confirmation flips Fulfilled (CS:139)." },
  { m: "[ Not yet — tell the stewards why ]", l: "Not yet", to: "frame:W10", info: "Requires a reason → online raiseDispute. It never cancels the promise (UX:167)." },
  { m: "Provider Maria cannot confirm this delivery.", l: "Provider exclusion", info: "Provider self-confirmation is blocked everywhere, including steward fallback (UX:32)." },
],
W5: [
  { m: "Maria — Prune the north beds   (Rocinha) ▸", l: "Pending confirmation", to: "frame:W4", info: "Inbox of promises waiting on YOUR confirmation, across gardens (UX:185)." },
  { m: "Ride to market", l: "My commitment", to: "frame:W2" },
  { m: "··queued··", l: "Queued row", info: "Offline-queued job chrome; syncs when connected (UX:237)." },
],
W6: [
  { m: "W6 deep links resolve to WalletDrawer W5", l: "Compatibility redirect", to: "frame:W5", info: "Retired frame; no Home-card work remains active (Decision Log #28f)." },
],
W7: [
  { m: "[ Pause… ]", l: "Pause pool (reason)", info: "pausePool with mandatory reason CID; members keep evidence/linkage + recovery (UX:60)." },
  { m: "[ Edit charter ]", l: "Edit charter", info: "setPoolCharter — one of the three readiness inputs (UX:269)." },
  { m: "[ Close Season ]", l: "Close Season", info: "closeCycle — the reconcile act; commitments derive Reconciled (CS:118). Walked in SB-9." },
  { m: "[ New Campaign ]", l: "New Campaign", info: "seedCycle — any number of concurrent Campaigns; a second Season is blocked (UX:66)." },
  { m: "[ Accept ]", l: "Accept claim", to: "frame:W7X", info: "Consumes the stored request terms; other pending rows become Superseded (CS:733)." },
  { m: "[ Decline… ]", l: "Decline claim (reason)", to: "frame:W7X", info: "Clears exactly one request; the claimant may ask again (CS:734)." },
  { m: "(+) seed", l: "Seed a commitment", to: "frame:W8" },
  { m: "scoped report ▸", l: "Cycle report", to: "frame:MF9", info: "Reconciliation report — realized as W26 via MF-9 (UX:75)." },
  { m: "≡ Prune the north beds", l: "Commitment row", to: "frame:W10" },
],
W7X: [
  { m: "A · Superseded", l: "Supersession", info: "Indexer side-effect of acceptance/cancel/expiry — never a user action, never a sync failure (DG:696)." },
],
W8: [
  { m: "[ Seed this commitment ]", l: "Seed this commitment", to: "frame:W7", info: "Console seeding — SeasonCampaign and StewardCaptured exist only here (UX:150)." },
  { m: "claim mode  ◉ open   ○ steward-reviewed", l: "Claim mode", info: "Set at seeding; prefilled by context — protocol pool gated, garden campaigns open (register #19)." },
  { m: "confirmers  [ + add address ]", l: "Confirmer rule", info: "Named any-N group; every frozen team member is excluded before threshold validation (UX:280)." },
  { m: "○ none  ◉ external payout  ○ Celo G$", l: "Reward rail", info: "Exactly one rail is stored. ArbitrumExternal records an outside payout; CeloSettlement uses a finalized payout plan to prepare canonical G$ child disbursements from the payer garden Safe." },
],
W9: [
  { m: "search members", l: "Pick the member", info: "The member is the social source; the steward is only the recorder (UX:437)." },
  { m: "◉ their offer  ○ their request  ○ confirmation", l: "Capture kind", info: "Captured confirmations always carry a reason (UX:291)." },
],
W10: [
  { m: "[ Record payout ]", l: "Record payout", info: "ArbitrumExternal only: AdminConfirmDialog captures the executed rail reference → ConsiderationPaid; no value moves here. CeloSettlement uses the contributor payout-plan flow instead." },
  { m: "[ Confirm as fallback… ]", l: "Confirm as fallback", info: "Steward fallback with mandatory reason — provider-steward blocked on-chain (CS:744)." },
  { m: "[ Raise dispute… ]", l: "Raise dispute", info: "Steward dispute entry, Accepted through Expired (UX:300)." },
  { m: "Resolve dispute", l: "Resolve dispute", info: "RestorePrevious / Fulfilled / Cancelled / Expired, each with a required reason; Expired can never resolve Fulfilled (CS:144)." },
],
W11: [
  { m: "[ Open cycle ]", l: "Open cycle", to: "frame:W7", info: "Emits the six-class bps snapshot; sum must equal 10000 (UX:322-330)." },
  { m: "preset  ◉ Garden-led (default)", l: "Allocation presets", info: "Presets prefill an editable bps editor; soft warning under 1500 treasury bps." },
],
W12: [
  { m: "[ Accept ]", l: "Accept a garden claim", info: "Protocol steward accepts stored terms; providerGarden derives (CS:733). Walked in SB-13." },
  { m: "Field survey — 1 of 2 confirmed", l: "Confirmations queue", to: "frame:W10" },
  { m: "20 DAI · protocol treasury", l: "Funding view", info: "Reward references only; co-funded entries name the owning garden (UX:313). Route queueing control is MF-11 (undrawn)." },
  { m: "alphabetical, never ranked", l: "No-ranking invariant", info: "Cross-garden rows sort alphabetically; no rank column ever (UX:314)." },
],
W13: [
  { m: "Maria — Prune the north beds", l: "Confirm queue row", to: "frame:W10", info: "Queue of promises where you are named or fallback-eligible (UX:318)." },
],
W14: [
  { m: "◉ Baseline   ○ Re-assessment (delta)", l: "Assessment kind", info: "Baseline: evaluator or steward. Delta: Evaluator Hat only (CS:760-761)." },
],
W15: [
  { m: `${SEASON_LIVE.made} promises made, ${SEASON_LIVE.kept} kept so far`, l: "Counts-only sentence", info: "Percentages render publicly only at ≥5 due commitments and ≥3 promisers (UX:350)." },
],
W16: [
  { m: "[ See the gardens ▸ ]", l: "See the gardens", info: "Links to /gardens; no per-garden table on /impact — comparison drifts toward ranking (UX:354)." },
],
W21: [
  { m: "[ Review registration requirements ]", l: "Review registration requirements", info: "Read-only prerequisite summary. Release governance deploys and verifies the 2-of-3 Safe/Roles route; registration binds only the existing account." },
  { m: "member delivery: enabled", l: "Delivery-gate status row", info: "Read-only (register #34f): enabled/disabled · changed by · date · evidence. The owner-only flip gates Individual reward delivery and member send, never Garden rewards or non-commitment garden seeding." },
  { m: "[ Create batch (2) ]", l: "Create batch", to: "frame:W22", info: "Batches hold immutable members up to the measured configured limit; the hard ceiling is 24." },
  { m: "[ Requeue ]", l: "Requeue", info: "Failed → Queued; clears the old batchId, attempts++ (SS §3.1.3)." },
  { m: "[close]", l: "Close failed delivery", info: "Failed → Cancelled; preserves the attempt/failure history and creates no new execution key." },
  { m: "[ dispatch ]", l: "Dispatch command", info: "Sends the immutable data-only command through CCIP; G$ stays on Celo." },
  { m: "[ retry ack ]", l: "Retry acknowledgment", info: "Resends only the stored Celo outcome and cannot move G$ again." },
],
W22: [
  { m: "[ Dispatch command ]", l: "Dispatch command", info: "Sends the versioned data-only command; the router receives no token amounts." },
  { m: "[ Cancel whole batch ]", l: "Cancel whole queued batch", info: "Requires a reason and blast-radius confirmation; atomically cancels every immutable member before dispatch. No member-level cancellation is available while Queued." },
  { m: "command 0xab…11", l: "Command message", info: "Open in CCIP Explorer; command delivery is not confirmation." },
  { m: "destination 0xce…42", l: "Destination transaction", info: "Celo execution evidence; the source remains Dispatched until acknowledgment." },
  { m: "acknowledgment 0xac…09", l: "Acknowledgment message", info: "Only an authenticated success acknowledgment for the subject's current execution key and attempt can produce Confirmed." },
  { m: "[ Manual-execution guidance ]", l: "Manual-execution guidance", info: "External CCIP recovery shown only when Explorer marks the message eligible; never a state mutation." },
  { m: "[ Retry same command ]", l: "Retry same command", info: "Preserves the attempt, execution key, and payload; creates only a new CCIP message ID." },
  { m: "[ Retry acknowledgment ]", l: "Retry acknowledgment", info: "Resends the stored outcome without calling the Safe route." },
],
W23: [
  { m: "[ Send G$ ]", l: "Send G$", info: "Online-only wallet action, sponsored gas — never enters the offline queue (UX:219)." },
  { m: "[ Send ]", l: "Send", info: "Wallet-pending → confirmed; failure surfaces inline with retry (UX:219)." },
],
W23G: [
  { m: "[ View technical status ]", l: "Technical status", info: "AA/paymaster gate failed: first contributor-child preparation + member sends stay off; steward-authorized non-commitment garden seeding continues Safe-to-Safe (SS §5)." },
],
W24: [
  { m: "[ Execute ▸ ]", l: "Execute batch", to: "frame:W22", info: "Cross-garden execution home (WF:643). Executor-role guard (register #34e) applies to every execute/report control here, same as W22." },
  { m: "[ Requeue ]", l: "Requeue", info: "Failed → Queued; clears the old batchId, attempts++ (SS §3.1.3)." },
  { m: "GoodDollar pool → GG protocol Safe", l: "Inflow row (Celo read)", info: "Protocol-Safe inflow is a Celo balance read — the module records no upstream hop (corrections-log §9)." },
  { m: "(alphabetical)", l: "No-ranking invariant", info: "Cross-garden oversight rows sort alphabetically; never ranked (UX:314)." },
],
W25: [
  { m: "◉ myself   ○ this garden", l: "Provider context", to: "frame:MF8", info: "Garden option renders for eligible stewards only; claimant = GardenAccount, requestedBy = you (CS:581)." },
  { m: "[ Ask to take this up ]", l: "Ask to take this up", to: "frame:W1P", info: "Protocol pool defaults steward-reviewed (register #19); W1's pending/declined/superseded grammar applies unchanged (WF:671)." },
],
W26: [
  { m: "[ Re-seed… ]", l: "Re-seed expired", to: "frame:W8", info: "Unresolved-first: lapsed seeded promises re-enter the seeding console prefilled (UX:94)." },
  { m: "[ Resolve… ]", l: "Resolve disputed", to: "frame:W10", info: "Cycle close sequences unresolved commitments before reconcile (WF:691)." },
  { m: "[ Mint impact certificate ]", l: "Mint impact certificate", info: "Existing Hypercert pipeline; bundle = fulfilled promises + work, evidence, need lineage; allowlist from the six-role shares (CS §9)." },
  { m: "[ Reconcile + compost ]", l: "Reconcile + compost", info: "closeCycle → certificate mint → compostCycle as one ritual; aggregates roll into pool history (WF:714)." },
],
MF1: [
  { m: "[ Open pool ]", l: "Open pool", info: "openPool → PoolOpened. Adopted per register #34a — closes the Ready→Open deadlock (CS:100, CS:727)." },
  { m: "[ Close pool… ]", l: "Close pool", info: "Only after every cycle is Cancelled/Composted and pool live commitments are zero (CS:102); then Compost/Reopen per §4.1." },
],
MF3: [{ m: "[ Offer again ]", l: "Offer again", to: "frame:W3", info: "Per-cycle renewal — a fresh commitment, prefilled (UX:94)." }],
MF4: [{ m: "[ Re-seed… ]", l: "Re-seed", to: "frame:W8", info: "Lapsed seeded promises re-enter the seeding console prefilled (UX:94)." }],
MF5: [{ m: "··waiting··", l: "Membership wait", info: "waiting_for_hat — no retries consumed; resumes when the hat lands (register #34c). The join-request approval (register #35) is the trigger." }],
MF6: [{ m: "[ Send for confirmation ]", l: "Send for confirmation", to: "frame:W4", info: "Evidence-only kinds; DomainImpact is rejected on-chain (CS:138b)." }],
MF8: [
  { m: "[ Continue ]", l: "Continue", to: "frame:W1P", info: "Garden claim: claimant = GardenAccount, requestedBy = you (CS:581)." },
  { m: "[ Cancel ]", l: "Cancel", info: "No custody, no member-delivery fallback via garden claims (AM:38-39)." },
],
MF9: [
  { m: "[ Compost this season ]", l: "Compost this season", info: "compostCycle → archived under pool history (CS:119)." },
  { m: "[ Export… flagged ]", l: "Export (flagged)", info: "Flagged, not designed — §9 pattern: flag missing primitives, never invent them." },
],
MF13: [
  { m: "[ Attach ]", l: "Attach assessment", info: "Only non-revoked v2/v3 with recipient = providerGarden appear (UX:287)." },
  { m: "[ Cancel ]", l: "Cancel" },
],
WFLOW: [
  { m: "fulfills: Plant 200 seedlings (Offer · AGRO)", l: "fulfills row (NEW)", info: "The only delta to the existing flow — commitment context on Review (MF-7, UX:174)." },
  { m: "[ Submit work ]", l: "Submit work", to: "frame:W2", info: "Existing work job + meta.commitmentId; the queue auto-links after sync (UX:220)." },
],
HUBWORK: [
  { m: "[ Approve ]", l: "Approve", info: "Existing WorkApproval rails → onWorkDecision → ApprovedWorkCounted; a newer pre-freeze rejection emits ApprovedWorkReversed." },
],
C1: [
  { m: "[View]", l: "View", to: "frame:C5", info: "Open the Need thread; board order is recency + status, never funding (CI-SPEC §8)." },
  { m: "[Support]", l: "Support", info: "Writes the latest NeedSignal direction; support and non-support stay separate (CI-SPEC §6)." },
  { m: "[Do not support]", l: "Do not support", info: "Writes the latest NeedSignal direction without producing a net score (CI-SPEC §6)." },
  { m: "＋ Create", l: "Create", to: "frame:C3" },
  { m: "[Explore]", l: "Explore", info: "Global read-only discovery — no signal buttons outside your garden (CI-WF:64)." },
],
C3: [
  { m: "[Continue]", l: "Continue", to: "frame:C4" },
  { m: "[● Record]", l: "Record", info: "Voice-first capture; transcript editable; typing fallback always present (CI-WF:122)." },
],
C4: [
  { m: "[Share with my garden]", l: "Share with my garden", to: "frame:C1", info: "Offline-queueable Need; waiting_for_hat consumes no send attempts (CI-WF:153)." },
  { m: "[About membership]", l: "About membership", info: "Join submission + membership queue stay gated on RESR-64 (CI-WF:260); register #35 designs the garden-side queue." },
  { m: "[Edit] [Cancel] [Delete]", l: "Draft controls", info: "Offline draft verbs: edit/retry/cancel/delete with media retained (LAP:191)." },
],
C5: [
  { m: "[Support]", l: "Support", info: "NeedSignal — same-garden Community Hat members only (CI-WF:65)." },
  { m: "[Do not support]", l: "Do not support", info: "Directional NeedSignal; non-support never subtracts into a net score (CI-WF:65)." },
  { m: "[Clear my signal]", l: "Clear my signal", info: "Revoke the canonical winning signal; an older direction never returns (CI-SPEC §6)." },
  { m: "[Add testimony]", l: "Add testimony", info: "Community-Hat EAS attestation — September-realized (register #34g; CS:762)." },
  { m: "[▶ audio]", l: "Play audio", info: "The neighbor's own words stay primary; protocol evidence renders separately (CI-WF:162)." },
],
C6: [
  { m: "[Review evidence] [Confirm fulfillment]", l: "Eligible confirmation", info: "Author-confirm consumes the shared confirmation primitive; a provider never sees a self-confirm CTA (CI-WF:222)." },
  { m: "[Cancel request]*", l: "Cancel request", info: "Shown only after RESR-64 locks a transport with a defined cancellation API (CI-WF:222)." },
],
C9: [
  { m: "[Acknowledge]", l: "Acknowledge", info: "Typed moderation; moderation and progress are separate axes (CI-SPEC:267)." },
  { m: "[Merge…]", l: "Merge", info: "Typed same-garden canonical-Need picker + separate rationale (CI-WF:311)." },
  { m: "[Seed a commitment]", l: "Seed a commitment", to: "frame:C10" },
],
C10: [
  { m: "[Review commitment]", l: "Review commitment", info: "Suggestions are not saved until the steward reviews every field; unreachable-threshold errors surface before acceptance (CI-WF:335-340)." },
  { m: "[Cancel]", l: "Cancel", to: "frame:C9" },
],
};
