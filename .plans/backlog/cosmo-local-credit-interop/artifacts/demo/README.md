# Clickable demo · SustainableFinance.Live 2026

The demonstrator for the submission: one page a judge clicks through in under three minutes. It
walks the garden loop from slide 5 of the deck as four short flows, Needs, Promise, Work and
Funding, set at Tech and Sun's hub in Awka. Every screen is a capture of the real app: components
from the deployed Storybook at design.greengoods.app with sample data, and, in the Funding flow,
the public pages at greengoods.app as they stand. Each screen has one caption and one hotspot on
the control to tap; a tap anywhere else does not advance.

- Drive: `Shared drives/Greenpill Dev Guild/Product/Green Goods/Growth/Green Goods SF.Live 2026 clickable demo.html`
- Private artifact: <https://claude.ai/artifact/9ThhqDPZTEggFZuKnvS2wa>
- UI review of every screen: [`ui-review-2026-10-26.md`](ui-review-2026-10-26.md)

## What is here

| Path | What it is |
|---|---|
| [`index.html`](index.html) | The page: landing, flow view and the `#flows` block with every caption, source and hotspot. It shows the screens from `assets/screens/` when they are present |
| [`capture.mjs`](capture.mjs) | Captures the 22 screens, swaps in the demo copy and writes each screen's source, size and measured hotspot into `#flows` |
| [`build.mjs`](build.mjs) | Inlines the screens and the corner symbol into `output/green-goods-sf-live-demo.html` (the Drive copy) and `output/artifact.html` (the same page without its document wrapper) |
| [`check.mjs`](check.mjs) | Checks the build and walks every flow headless; screenshots each step and a contact sheet into `output/` |
| `assets/screens/`, `assets/photos/`, `output/` | Local files, not committed: the screens and the built page include the hub's group photo and the live page's member photos |

## Capture, build and check

From the repository root of an installed checkout (Playwright and network access; no new
dependency). Place the approved Awka photo first; without it the Promise flow keeps the fixture
banner and `capture.mjs` says so:

```bash
cp /Users/afo/Code/greenpill/artifacts/octant-e12-deck/assets/photos/awka-hub.jpg .plans/backlog/cosmo-local-credit-interop/artifacts/demo/assets/photos/
node .plans/backlog/cosmo-local-credit-interop/artifacts/demo/capture.mjs
node .plans/backlog/cosmo-local-credit-interop/artifacts/demo/build.mjs
node .plans/backlog/cosmo-local-credit-interop/artifacts/demo/check.mjs
```

`capture.mjs --only=work-3,promise-1` re-captures single screens. Capture fails when a demo copy pair
matches nothing, a fixture name survives, or a hotspot target is missing or off screen. Check fails
on an em dash in the demo's HTML or Markdown, a caption over eight words or using "commitment",
"chain", "blockchain", "Arbitrum", "Celo", "Gnosis" or "live", a tile line that is not five words, a
missing or extra hotspot, a stale build, a file over 15 MB, an image that does not load, a caption
that does not change, a tap beside the hotspot that advances, broken keys (Right, Left, Escape),
Back, Restart or deep links (`#work-3`), any request beyond Google Fonts, console errors, sideways
scroll at 390 wide, or a light background in dark mode.

To rename a flow or change a caption, edit `#flows` in `index.html`, then build and check. To
present, open the built file; `#promise` opens a flow and `#promise-3` its third screen.

## The flows

| Screen | Source | Caption |
|---|---|---|
| needs-1 | `admin-workspaces-hub--assessments-tab` | Start an assessment of the hub |
| needs-2 | `admin-workspaces-hub--create-assessment-route`, Solar chosen and the fields typed in | Name the need and the place |
| needs-3 | `admin-workflows-assessment-reviewstep--in-flow-ready` | Review the baseline, then submit it |
| needs-4 | `admin-workflows-assessment-reviewstep--in-flow-sent` | Close the finished assessment |
| needs-5 | `client-garden-assessments--solar` | Members see what the hub needs |
| promise-1 | `client-commitments-gardenpool--live`, list scrolled to the request | Open a request from the hub |
| promise-2 | `client-commitments-promisegrouppage--open` | Read what it asks, then take it |
| promise-3 | `client-commitments-takeuponesheet--ready` | Promise to do it |
| promise-4 | `client-commitments-proofcomposer--details` | Add proof when the work is done |
| promise-5 | `client-commitments-confirmsheet--ask-garden-work` | Now confirm it as the person served |
| promise-6 | `client-commitments-gardencommitment--kept` | The promise is kept and recorded |
| work-1 | `client-work-submitwork--media-with-example-photo` | Add a photo of the work |
| work-2 | `client-work-submitwork--review-with-example-photo` | Check the details, then upload |
| work-3 | `client-garden-gardenwork--all-work` | As steward, open the new work |
| work-4 | `client-work-reviewwork--evaluate-example` | Approve what the photo shows |
| work-5 | `client-work-reviewwork--feedback-example` | Add a note and submit |
| work-6 | `client-work-workdashboard--completed-with-example-photo` | The gardener sees it approved |
| funding-1 | `https://greengoods.app/gardens/tas-hub`, top | Open Fund to support the hub |
| funding-2 | `https://greengoods.app/fund`, scrolled to TAS HUB | Choose an endowment for TAS Hub |
| funding-3 | the same page's Endow dialog for TAS HUB, 50 typed, no wallet connected | Enter an amount and continue |
| funding-4 | `client-public-vault-vaultmanagepositionspanel--positions` | Check your endowment any time |
| funding-5 | `https://greengoods.app/gardens/tas-hub`, approved submissions | Follow the work it supports |

Desktop screens are 1440 by 900 at 1.5x and phone screens 390 by 844 at 2x, saved as JPEG; the
built page is about 3.6 MB.

### Where the brief's screens did not render a usable state

- **Needs.** `admin-workflows-assessment-domaincontextstep--prefilled`, `-outcomefields--editable`
  and `-reviewstep--ready` / `--sent` render only a step's fields on an empty canvas, with no
  wizard or dashboard. The flow uses the Hub's Assessments tab, the Hub's own Create Assessment
  route (Solar chosen and three fields typed in, as a steward would), and the review step's "in
  flow" variants, which draw the wizard. The wizard's middle two steps are not shown.
- **Promise.** Every `client-commitments-gardencommitment--*` variant shows a promise already taken
  up, so the request before acceptance is `client-commitments-promisegrouppage--open`. No screen
  shows a reward before acceptance (a UI review finding).
- **Work.** The dashboard's `admin-workspaces-hub--work-queue` and `--work-detail` render "All caught
  up" and "Work not found" in the deployed Storybook (the queue story notes that it needs live
  indexer data). Opening the
  seeded work through the approved scope works, but the viewing steward submitted it, so the dialog
  says "Independent review required" instead of offering Approve, and `admin-workflows-hub-reviewform--actionable`
  is a bare form. The steward therefore reviews in the installed app
  (`client-work-reviewwork--*`). SubmitWork has no details-step story, so the flow shows media and review.
- **Funding.** `client-public-vault-staged-card-endow-flow--staged` and `-staged-card-payment-panel--staged`
  render "Card checkout is not available here yet" and "We couldn't open card checkout". The fund
  step is the live Endow dialog instead, opened from the live Fund page with no wallet connected and
  nothing sent. The voucher stories are not used.
- **Name.** The fourth flow is called Funding, as on slide 5; the brief called it Support. Change
  its `label` in `#flows` to rename it.

## Demo copy

Swapped in each Storybook screen's text, `alt`, `aria-label`, `title`, placeholders and field values
after it renders; components, layout, controls and state stay as rendered. The Funding flow's live
pages are unchanged apart from the 50 typed into the Endow amount.

| Fixture text | Demo copy | Screens |
|---|---|---|
| Riverside Commons Garden; Rio Rainforest Lab; Botanic Commons | TAS Hub | every Storybook screen that names the garden |
| Riverside District | Awka, Nigeria | promise-1, work-2, work-4, work-5 |
| riverside-commons.example | tas-hub.example | promise-4 |
| Autumn Planting 2026; Summer 2026; Seed Swap Weekend | Hub season 1; Pilot season; Solar classroom build | promise-1, promise-6 |
| tomas | emeka | promise-6 |
| vault-owner.eth; Greenpill NYC | ngozi.eth; TAS Hub | funding-4 |
| The fixture banner photo | `awka-hub.jpg`, the approved Awka photo | promise-1 |
| Rainforest canopy strategy | Tree planting plan for the hub | needs-1 |
| Typed into the empty form: Solar; title; location; description | Steady power and internet at the hub; Awka, Nigeria; Hours of power and working internet each day, measured before the solar classroom opens. | needs-2 |
| East plot, Rio Rainforest Lab (dialog header; location row) | TAS Hub; Awka, Nigeria | needs-3, needs-4 |
| Agroforestry | Solar | needs-3, needs-4 |
| Rio canopy baseline, wet season | Steady power and internet at the hub | needs-3, needs-4 |
| Canopy cover and seedling survival across the east plot, measured before the wet-season planting. | Hours of power and working internet each day, measured before the solar classroom opens. | needs-3, needs-4 |
| Cattle grazing thinned the canopy along the east boundary, and the seedlings planted last season have no shade. | Power cuts stop classes most afternoons, and the internet drops when the hub is full. | needs-3, needs-4 |
| The east plot regains its canopy; Trees planted · 200 trees | The hub keeps steady power all day; Energy generated · 900 kWh | needs-3, needs-4 |
| Seedlings survive their first dry season; Area covered · 5 ha | Two more hubs open nearby; Hubs onboarded · 2 hubs | needs-3, needs-4 |
| Canopy baseline | Hub Service Session | needs-3, needs-4 |
| Reliable solar power for households in the garden community; Oct 18, 2025 – Jan 16, 2026 | Steady power and internet at the hub; Jul 1, 2026 – Sep 30, 2026 | needs-5 |
| Repair the north fence panel by the compost bays before the first frost | Fix the hub's router before Friday's class (the list); Mentor a new builder (the promise taken up) | promise-1; promise-4, promise-6 |
| Survey one household about rain barrel use (first; second) | Host the weekly climate discussion; Clean the solar panels on Saturday | promise-1 |
| Water the seedling beds every morning while the Okafor family is traveling | Lend my spare laptop to a new builder | promise-1 |
| Lend the seed dibber set for the swap weekend | Set up the solar classroom lights | promise-1 |
| Two hours sorting the seed library; Survey household water use on Mill Lane | Mentor a new builder | promise-1; promise-2, promise-3 |
| Teach the composting basics workshop for new members | Teach the coding basics workshop for new members | promise-1 |
| Visit one household, ask the six survey questions, and photograph the meter.; Two slats are split and loose after the storm. Materials are in the tool shed. | Spend two hours with one new builder on their first project, then share a short note. | promise-2; promise-6 |
| Replaced two split slats and secured the panel. Dele helped with measuring and fastening. | Helped Obi build his first web page. Dele joined for the last hour. | promise-4 |
| receipts/fence-posts | notes/first-web-page | promise-4 |
| 1 repair; Oct 20, 2026; Repair notes | 2 hours; Oct 30, 2026; Mentoring notes | promise-6 |
| Compost Turn (first row only) | Seedling Transplant | work-3 |

Kept as the fixtures have them: the names amara, dele and Okafor, counts such as "3 members" and
"4 available · 3 in progress · 3 kept", other dates, addresses, the other work titles in the Work
list, and every work and proof photo. The assessment metrics are the Solar domain's own (Energy
generated in kWh, Hubs onboarded).

## Claims

- Captions and the page's own words say nothing about chains, "live" or vouchers, and use
  "promise", never "commitment".
- App text inside the screens still says "on-chain" and "Your wallet will ask you once" (needs-3),
  and the live Fund page and Endow dialog show the hub's endowment in ETH and DAI and offer "WETH,
  Wrapped Ether" (funding-2, funding-3); none of them names a chain.
- funding-1, funding-2, funding-3 and funding-5 are the hub's real public record (16 approved
  submissions and 14 members on 26 October); every other screen is sample data, which the landing
  says.
- Vouchers appear nowhere, so no "in pilot" label was needed.

## Task record · clickable demo

Task record: SF.Live clickable demo | Type: feature | Outcome: complete; delivery links above
Agent/model: Claude Code / Claude Opus 5.5 | Coverage: this folder, from `26f5fee4c`

| Phase | Start → end (UTC, 26 October 2026, to the minute from command output) | Result / evidence |
|---|---|---|
| investigate | 03:01 → 03:47 | Storybook index listed; candidate stories and the live TAS Hub, Fund and Endow pages captured and compared |
| implement | 03:47 → 04:05 | Capture, page, build and check scripts; 22 screens captured, three re-captured after fixes |
| verify | 03:58 → 04:10 | `check.mjs` exit 0; every step screenshot and the phone and dark views inspected |
| publish | 04:10 → ongoing | Artifact published; commit, push and Drive copy follow |

Human corrections: 0 observed in this segment; attention unknown.
