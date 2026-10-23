# PRD-1299 voucher design lab, v2: handoff

**Status:** draft for Afo's review, not approved. Revised in place on 22 and 23 October 2026 so
the lab follows the locked pilot architecture. The revision is local only: the published
[Voucher Lab](https://claude.ai/artifact/3pwUYy43vdb91q6qdH3H9G) (artifact version 4) still shows
the earlier 22 October draft. Nothing here changes contracts, production code, live
configuration or Linear.

PRD-1299 owns design approval and PRD-1297 implements it. PRD-1323 and PRD-1324 own linked
rewards. Gui reviews the Portuguese copy (PRD-1312).

- **Open it:** [`voucher-lab.html`](voucher-lab.html) in any browser. Start with **Pilot design**
  in the left column: four written pages, then six journeys.
- **Look up a state:** [`crosswalk.md`](crosswalk.md) maps every pilot screen and state to its
  source, recorded proof, gaps and future ideas. [`copy-sheet.md`](copy-sheet.md) has every
  string in English, Spanish and Portuguese.
- **See it rendered:** [`evidence/`](evidence/) holds labeled static-prototype screenshots.
- **Change it:** edit [`lab/`](lab/), then [rebuild and check](#rebuild-and-check).

## What changed in this revision

The first v2 draft proposed four architecture changes: a Celo purchase escrow, paying as
agreeing, standing approvals, and automatic completion after a seven-day review window. None is
selected for this pilot. The lab now designs the architecture that is built and locally proven,
and keeps those four ideas, with what each would need, under **Future ideas**. v1 stays frozen in
its own folder, and the lab keeps v1's screens under **v1 reference**.

- **Ten pilot screens.** `SOffer`, `SPay`, `SPurchase`, `SRedeem`, `SReward`, `SExchange` and
  `SWallet` for members; `SFunds`, `SRequests` and `SIssuer` for stewards. `SRedeem` replaces
  `SCourse`; `SReward`, `SExchange` and `SFunds` are new.
- **Five questions on every member screen:** what you get, what you give, who holds it, who acts
  next, and what comes back if it falls short. The offer asks them in a "Before You Start" card.
  Status pages answer them with a summary band, one next-step message, and a timeline grouped by
  who acts.
- **One stepped sheet for each run of approvals.** A strip shows whose step comes next. The sheet
  never promises one prompt or sponsored fees, and a voucher deposit says it may ask twice.
- **Chain details in context.** Chain names, Safes and record numbers sit under Transaction
  details. Custody, costs, consent and refund limits stay in view wherever they affect a decision.
- **Three languages.** Every pilot string lives in `lab/copy.json` in English, Spanish and
  Portuguese. The build refuses a missing language, an em dash or a mismatched placeholder.
- **A stricter check.** `check.mjs` now renders every pilot state in every language, and again in
  dark, and fails on clipped text, unnamed controls, focus behind a dialog, missing icons or low
  contrast.
- **Dials.** Later on 23 October the lab gained dials, so reviewers can turn patterns, copy and
  the design-system forks and watch the screen change. See [The lab's dials](#the-labs-dials).

## The journeys

| Journey | Steps | Screens | What it shows |
|---|---:|---|---|
| Earn vouchers, with optional G$ | 12 | `SReward`, `SFunds`, `SWallet`, `SIssuer` | A Request pays 20 Sunroot vouchers and 120 G$. Each reward arrives on its own, with its own receipt. A used-up allowance makes a vouchers-only reward wait until the issuer raises it. |
| Redeem a voucher you hold | 14 | `SWallet`, `SOffer`, `SPay`, `SIssuer`, `SRedeem` | Agree, the issuer approves, deposit, the issuer accepts. Then the session, the final split and the confirmation, each a separate approval. |
| Exchange, then redeem | 8 | `SOffer`, `SExchange`, `SPay`, `SRedeem` | One direct exchange in the shared pool, showing fees, minimum, deadline and recipient. The swap books nothing; the vouchers it returns are then redeemed. |
| A course that ends early | 8 | `SRedeem`, `SIssuer` | The issuer proposes a return within its terms, the holder approves one final split, and each transfer is tracked, and retried if it fails, on its own. |
| Buy with your own G$ | 13 | `SOffer`, `SPay`, `SPurchase`, `SFunds`, `SRequests` | Lina's home-garden Safe holds the payment and its stewards check it. The provider accepts, the month runs, and Lina confirms it was kept before anyone is paid. |
| When something goes wrong | 17 | All but `SReward` and `SWallet` | Not a gardener, no result, changed terms, an unchecked payment, a decline, a failed refund, a dispute, signing not available, a cancel race, a stale quote, a short pool, a return above terms. |

Six before-and-after pairs, under **What changed from v1**, show what each pilot screen removes.

## What the design follows

- **Rewards.** Vouchers are the main reward, with G$ as an optional extra on Celo. A Request names
  the issuer, the entitlement and the quantity. Voucher and G$ deliveries keep separate statuses
  and receipts. Accepting a Request reserves no inventory, and another issuer's voucher needs its
  authorization and a finite allowance.
- **Exchange.** One shared curated pool on Gnosis. Issuers keep their own tokens, reserves and
  obligations. Arbitrum commitment pools coordinate promises and hold no liquidity. A swap books
  nothing. Quotes can list routes, but only direct exchanges run.
- **Redemption.** Exact consent first, then issuer approval and an authenticated escrow deposit
  on Gnosis, then acceptance. Activation fixes the agreement; it is not delivery. Service evidence
  and the member's confirmation stay explicit. The holder approves one final split within the
  issuer's return limit, and each transfer has its own pending, arrived and failed states, with
  retry.
- **Personal G$.** A member's own G$ goes to their home garden's Celo Safe, where a steward checks
  it arrived. It is an accounting earmark, not a lock. Consent, the payment check and the
  provider's acceptance stay separate steps. Each agreement uses one payment route, and refunds
  return the recorded deposit.
- **Left out:** a G$ bridge, G$-to-voucher swaps, cash-out or fiat payouts, mixed checkouts,
  timed approvals, automatic burns, and treating a financial close as proof of delivery.

## Corrected states

| Before | Now |
|---|---|
| One passkey approval and sponsored fees | "Your passkey asks you to approve. If there's a network fee, you see it first." A deposit may ask twice: allow, then deposit. |
| "Back in your account right away" | A return shows as pending until its transfer arrives. A failed one says so and can be retried, for the same amount only. |
| A provider remedy that moves value | The issuer can **Propose Return**: a limit within its terms. Nothing moves until the holder approves a split. |
| "Kept" for reports and payouts | **Kept** appears only after the member confirms, or after stewards resolve a dispute as kept. "Sunroot reported the delivery", "Ready to confirm" and "The payout is running" are separate states. |
| Topping up a changed price | Changed terms need a fresh agreement. A G$ payment made under the old terms is refunded and the new price paid in full. A voucher booking is canceled and booked again. |
| Cancel "any time before service starts" | Cancel before the issuer or provider accepts. If acceptance lands first, the screen says so and offers a return request or a problem report. |
| A dispute that pauses every payment | A disputed G$ purchase can't start a new payout or refund until the stewards decide. Escrowed vouchers stay where they are; only the holder's approved split moves them. |
| Steward authority over a holder's vouchers | Stewards resolve the promise. They can't change the holder's voucher split. |
| Redeem on the spot | Removed. Immediate services use the same consent, acceptance and delivery steps. A bounded on-the-spot receipt is a future idea. |
| Automatic completion after seven days | Removed. Suggested response times are labeled as policy, not enforced. |

The pass also cut repeated notices to one status message per page, put each blocking reason next
to the action it blocks, kept issuer names and amounts whole on a phone, kept numbers on the same
line as their units, removed the progress bar from canceled bookings, and stopped cockpit pages
above the dock.

## The lab's dials

The dials are lab tooling, not pilot behavior: every option draws the same implemented flow with
a different pattern or wording. The defaults are the pilot's picks, marked with a dot. Picks save
in the reviewer's browser, go into any note saved from the panel, and "Copy picks" puts them on
the clipboard as one line. A dial shows only on screens it changes.

| Dial | Options (pilot's pick first) | Screens |
|---|---|---|
| V1 Sheet steps | Strip, list, counter | Review sheet, voucher booking sheets |
| V2 Progress | Phases, flat, summary | Voucher booking, G$ purchase |
| V3 Final split | Bar, two steps, figures | Voucher booking |
| V4 Transfers | Rows, bar, in the band | Voucher booking |
| V5 Confirm | Dialog, in the row | Issuer, Promises and Funds cockpit pages |
| D1 Copy | Full, compact, minimal | Every member screen; minimal reshapes the offer and request cards |
| D2 Chain words | Details, one line, none | Voucher booking, G$ purchase |
| S1 to S5 Design system | Typeface, ground, cards, list gap, dark cards | Every pilot screen; defaults are the forks locked on 18 October |

The panel also changed so the lab fits a viewer window: controls hold without scrolling at
desktop sizes, the step list is a strip of dots, the narration sits in a fixed band under the
screen, and notes fold away. Cockpit steps show a readable crop of the dialog or card in play at
the phone frame's height, with a thumbnail of the whole screen and a "Whole screen" toggle.
Below 860px wide the screen stays pinned above the controls.

## The working pilot terms

On 23 October the implementation lane recorded working pilot terms in `pilot-issuer-terms.md`
(draft 3) on `feature/cosmo-local-contracts`. On 22 October the release owner accepted their
business baseline: the prices, a twenty-voucher ceiling per issuer, ten participants and a 1:1
pool ratio. The issuers haven't accepted the terms, so the lab keeps its fictional services. The
terms map onto these screens like this:

- **Tech and Sun hub day** (1 voucher, one visit of up to four hours) and **Green Goods assisted
  session** (2 vouchers, 30 minutes) follow "Redeem a voucher you hold" as single sessions.
- **Claude access** (10 Green Goods vouchers, 30 days from working access) uses the same booking.
  If access falls short, the split counts available days out of 30, the pattern the course
  example shows with lessons.
- **The exchange** starts at a 1:1 gross ratio, with zero fees proposed where supported. The
  screen keeps its fee, minimum, deadline and recipient rows either way.
- **Personal G$ purchases** are outside the working terms. That journey stays designed and
  locally proven, but it isn't part of the live target. Optional G$ rewards keep their own Celo
  consent, receipts and recovery.
- The terms also propose a two-business-day booking response, a help acknowledgment within two
  business days and a remedy proposal within five. None of these is enforced by a contract.

## Evidence

Three classes, kept apart. None of them is proof of authenticated signing.

**Static prototype: this lab, run during this revision** in headless Chromium (Playwright's
bundled build).

| Command or check | Observed result |
|---|---|
| `node build.mjs` | Wrote `voucher-lab.html`, `copy-sheet.md` (864 keys) and `crosswalk.md` (34 rows). Rebuilding without a source change produced an identical file. |
| `node check.mjs` | Passed on 23 October. The self-test passed, including every dial option on each screen it applies to. Fifteen views fit at 1440 × 900, 1280 × 720, 1024 × 768 and 390 × 844 with no sideways scroll, and at the three desktop sizes the side panel held its controls without scrolling. All 1,001 pilot renders (every state in English, Spanish and Portuguese, every state in dark, and 393 dial settings) showed no clipped or overflowing text, a name on every control, no focus behind an open dialog, every icon present, and AA contrast. |
| Keyboard walk | Seventy Tab presses through the lab on a journey step, after the dials were added. Every stop showed a focus ring and none landed behind a dialog; focus moved from navigation to the screen, then Back and Next, the step dots, the state controls, the dials and the notes. Run from a scratch script that isn't part of the lab. |
| Visual review | Every pilot state in English at native size, with Spanish, Portuguese and dark checks; every dial option on the screens it applies to; and the lab at 1440, 1000 and 390 wide in both screen themes, including a cockpit step in focus and whole-screen modes. The fixes it found are in this revision. |

**Recorded implementation proof, not rerun here.** The crosswalk's proof column cites contract
tests, pinned forks, component tests and Storybook rehearsal recorded in the implementation
handoffs at `c40697f6e`. Storybook accounts and transactions are fictional, and a pinned fork is
not cross-chain delivery. Later commits through `aacdd1f9b` add steward Safe signer sync and
release tooling. None of them changes the voucher, escrow, pooling or settlement sources the
crosswalk cites.

**Product and authenticated proof: none.** This revision ran no comparison with the running app,
no Storybook build of these designs, and no screen reader. The
[design audit](design-audit.md#remaining) lists what is still unchecked.

## Decisions for Afo

1. **The direction.** Approve the ten pilot screens and six journeys, or mark what to change.
2. **Disputes.** Who settles a disputed G$ purchase when the provider's own stewards resolve its
   pool, as in the protocol pool.
3. **Partial delivery.** Which core outcome records it: the issuer's stewards closing the promise
   early, or a dispute resolution.
4. **Follow-up calls.** Who runs activation after acceptance, the transfers after a split is
   approved, and a reward retry after a reserve or allowance repair. Anyone can call each of them,
   and the issuer's Safe also has a retry fallback, but none has an owner yet.
5. **The refund fee.** Whether the home garden or the member carries the refund transfer's token
   fee. Today the Safe pays it.
6. **Defaults.** The acceptance deadline (the lab shows 7 days; the working terms propose a
   two-business-day booking response) and the vault verb.
7. **Accept after the payment check.** Whether it becomes a contract rule. Today it is a design
   rule only.
8. **Real services.** Whether to restyle the fictional services as the working pilot services once
   the issuers accept their terms.

## Live blockers

As the implementation lane recorded them at 10:13 a.m. Pacific on 23 October, in
`handoffs/codex-live-pilot-deployment.md` on `feature/cosmo-local-contracts`. This session read
them and reran nothing. That lane is preparing a controlled live pilot for 24 October and has sent
no live transaction.

- **Same address.** A member's address must match on Arbitrum, Gnosis and Celo. The legacy
  validator that would preserve it can't be deployed safely, and no safe address-preserving
  bootstrap is selected. The intended member has no account code on Gnosis or Celo.
- **Signing and fees.** Chain 100 is excluded from the app's chain and Pimlico configuration.
  Hosted bundler or paymaster acceptance, a funded native route, actual member possession,
  signing and recovery, and the helper's provenance are unproven.
- **Issuers.** Capacity, accountable addresses and acceptance are unconfirmed. COM-46 is In
  Progress, and that status is not approval.
- **Delivery and data.** No live cross-chain delivery is proven, and the app and indexer have no
  reviewed Gnosis voucher endpoints.

This design authorizes no deployment, broadcast, production auth activation or live financial
action, and claims no readiness.

## Copy and text owners

- English is a draft for Afo. Portuguese awaits Gui's review (PRD-1312), and Spanish awaits a
  native speaker. The [copy sheet](copy-sheet.md) marks both.
- **Redeem** is the voucher verb. The vault verb is unresolved, and production vault strings are
  unchanged. In Spanish and Portuguese the Redeem verbs (canjear, resgatar) collide with today's
  vault strings until a vault verb is chosen.
- The hub spec still says "Redeem" keeps its vault meaning (line 47 of
  [`spec.md`](../../../spec.md)). Its owner should record the voucher decision.
- The contract branch's brief keeps a member's G$ in the buyer garden's Safe. The design now
  follows that rule, so v2's earlier request to change it is withdrawn.

## Rebuild and check

Run from the lab folder. `check.mjs` uses the repository's `@playwright/test`; set
`CHROMIUM_PATH` to use another Chromium build.

```sh
cd .plans/backlog/cosmo-local-credit-interop/artifacts/prd-1299-voucher-ui/v2/lab
node build.mjs   # writes ../voucher-lab.html, ../copy-sheet.md and ../crosswalk.md
node check.mjs   # self-test, fit, text, names and focus, icons, contrast
```

| File | Holds |
|---|---|
| `shell.html` | The lab page and runtime, all lab text (journeys, pairs and written pages), and the dials (`TWEAKS`). |
| `gg.css` | The screen kit. Audit corrections follow the "Design-system alignment (v2 audit)" comment, pilot additions follow "Pilot design additions", and the dial rules follow "Lab dials". |
| `screens/*.dc.html` | 30 screens: the ten `S*` pilot screens, and v1's twenty kept for reference. A pilot screen reads the dials from its props and carries them as data attributes on its root. |
| `copy.json` | Every pilot string as `[EN, ES, PT]`. |
| `crosswalk.json` | The screen and state crosswalk. |
| `remix-sprite.svg` | 60 Remix Icon 4.9.0 glyphs from the npm package. Icons by Remix Icon (https://remixicon.com), licensed under the Remix Icon License v1.0. |

These files are design artifacts. Code, tests and CI must not depend on them.

## Task record

Task record: PRD-1299 v2 pilot revision | Type: design | Outcome: complete as a draft; approval pending
Agent/model: Claude Code / claude-opus-5-5, in two sessions | Coverage: the revision from 22 October 23:54 UTC

| Phase | Start → end (UTC) | Result / evidence or blocker |
|---|---|---|
| Investigate and implement | 2026-10-22 23:54 → 2026-10-23 05:36 | Sources read; screens, copy and crosswalk rewritten; lab self-test clean. The two phases overlapped. |
| Verify | 2026-10-23 05:36 → 05:47 | Text, name, focus and contrast sweep added to `check.mjs` and passing; visual review began. |
| Wait | 2026-10-23 05:47 → 16:36 | Session usage limit; resolved. |
| Verify | 2026-10-23 16:36 → 16:45 | Visual-review fixes, keyboard walk, first evidence capture. The session then stopped at a usage limit. |
| Investigate | 2026-10-23 17:19 → 17:27 | Resumed in a second session; read the newer implementation handoffs and working pilot terms. |
| Implement and verify | 2026-10-23 17:26 → 17:38 | Copy fixes; current blockers and pilot terms in the crosswalk and lab pages; these docs; a rebuild; `check.mjs`, the selected `format` and `lint` checks (2 fresh passes, 0 reused) and Plan Hub validation passing; renders and evidence. |
| Investigate | unknown → 2026-10-23 20:10 | Measured the lab at viewer sizes (panel overflow of 600 to 940px, frames changing shape between steps, cockpit steps at 46 to 62%); read the unification lab's dials; four forks answered by Afo. |
| Implement and verify | 2026-10-23 20:10 → 22:30 | Dials, compact panel, step strip, narration band and cockpit focus crop; the Redeem journey rendered for a yes, then the rollout to every pilot screen; `check.mjs` with the panel-fit rule and dial sweep passing (1,001 renders); keyboard walk; evidence. Intervals overlap with the rendering waits. |

Human corrections: 0 observed in this segment; attention: unknown.
