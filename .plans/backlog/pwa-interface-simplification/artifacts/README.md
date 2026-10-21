# Artifacts: the design lab

[pwa-home-lab.html](pwa-home-lab.html) is one HTML file plus the banners in [gardens/](gardens/).
Open it in a browser; it needs no build and no server. The typeface loads from Google Fonts and
falls back to the system face offline.

The stage draws two phones at real size, 390 × 844 and 360 × 800, side by side, scaled to the
window height. The picks sit in a rail beside them, and a hint line at the foot describes the
control under the pointer. Taps inside a phone work: the chip, the launchers, the rows, See all,
Explore gardens, the sheets and the bottom bar. Both phones follow the same taps.

| Control | What it switches |
|---|---|
| Presets | The decided picks of 20 October (the maintainer's pasted line), Steward on first run, No garden yet, Gardener offline: set several picks at once. |
| Phones, Size | Both widths or one; fit the window height or draw at 100%. |
| Language, Theme | English, Spanish or Portuguese; the app's light palette on the linen canvas, or the dark ladder with the card one step above the canvas. |
| Gardens | No garden, one, several on first run, several remembered. Several means TAS HUB, Ilhas de Abundância and the Aiyeloja Family Garden. |
| Role in the active garden, Active garden | Gardener or steward (the evaluator left the lab on 20 October: the app has no assessment flow on the phone). A steward gets the duties section, join requests first under Gardeners, Endowment in About, To confirm in Promises and per-event rows in the bell. Active garden switches between TAS HUB and Green Goods Community Garden to see how a long name truncates in the chip. |
| Endowment deposit, Pending request, Connection | A depositor's Endowment row; a request to join Vida Verde awaiting review; the shell's offline strip laid over the header's top padding, with nothing below it moving. |
| Start screen | Home, the switcher, Explore, a garden you visit, Submit Work, and the Your Work, Promises, Notifications, Work, Insights and Gardeners sheets. |
| Composition, Activity rows, Continue rows, Steward duties, Duties title | Compact journal, featured activity or the promoted garden page; how many rows each section shows; the duties section above Recent Activity for stewards (decided 20 October; four queues, each row opening its exact queue), or the earlier draft with duties inside Continue; four titles for the section, Needs Your Attention picked. |
| Header, Top strip, Seasons and campaigns, Rows | The chip row sticky at the top while the journal scrolls, or scrolling away; the Highlights carousel above Recent Activity (picked 20 October, reversing the 19 October no-strip decision) or none; where the garden's open season and campaigns show (see below); Home's rows as the locked cards (picked), one grouped surface per section, open rows with no boxes, or hairlines alone. |
| Variations | The switcher as a half sheet or a menu under the chip; About as a row, inside the switcher or as header icons; the first-run chooser opening by itself or a prompt only; garden sections as sheets over Home or today's garden page; the wallet launcher in the header (picked) or in Profile; the garden's banner at the top of the Insights sheet (picked) or not; a notifications bell in the header or none. |
| Submit Work | Shape: the flow as decided on 20 October (no Start button; promises first with the free-work row last; a promise's own screen with Add evidence first and its actions; two-up action tiles under a dynamic domain filter with All; Media with the pinned promise), or today's order for comparison. Your promises: some (one needing an action, one taking an action or evidence, one open evidence-only ask) or none. Garden domains: three or one, which decides the filter. Domain filter: capsule chips (the maintainer's preference) or the sheets' tabs. Promise rows, from least to most: the plain row, the row with a progress line, the compact card with status, progress, due date and up to two needs plus a +N mark (picked), and the full card that adds the description and asker. Free-work row: the wording of the row that leads to the actions without a promise (Log Work on Its Own picked). Work for: a pinned card, one line, or nothing (hidden picked; the line shows only when the submission garden differs from the active one). The info panel keeps one height across the step, and the four steps spread across the width beside the back button. The switcher marks the active garden with a tinted row and a ring on its picture, so every row keeps its role chip in the same slot. |
| Seasons and campaigns | The garden's open season and campaigns are the commitment pool's cycles, shown in the app today only on the old garden page's Pool tab. Rail: that tab's cycle cards at the top of the Promises sheet, each filtering the list by tap and opening its details from the ⓘ (the recommendation; it reuses the shipped rail and details sheet). Chips: capsule chips with a details line for the chosen cycle. Not shown: the lab as drawn before. On Home the open cycles lead the Highlights carousel, or stand as one line each under Take Part without it; every one opens the half-sheet details (identity, what counts toward it, live now, kept so far) whose Show Its Promises opens the Promises sheet filtered to it; the Insights sheet's season card is the same cycle. Decided on 21 October: the rail. |
| Copy picks | Copies the current picks as one line of text for a note, a review or the specification. |

The picks persist in the browser's local storage under `gg-pwa-home-lab-v2`.

**What the 19 October round changed.** Garden cards, the chip, the switcher rows and the pinned
Work-for card show the garden's own banner; a garden without one draws the app's fallback tile.
Explore lists the gardens the app lists, the member's own first, with one tag on the photo (Member,
Awaiting review, Open) and no line that changes a card's height; the two family test gardens show
only to their members. The switcher is the half sheet. Promises and Your Work are scoped to the
active garden with no widening row. Submit Work pins the garden and offers no way to change it. The
offline strip overlays the header. The chip is 32px tall like the icon buttons beside it. The
primary button in dark mode has dark text on the mint fill.

**Decided later on 19 October.** Garden sections open as sheets over Home, the notifications bell
takes the header's free slot, the Home header is sticky, Submit Work's first step leads with the
garden's open asks, and there is no Highlights strip; the Your Work badge counts the active garden
only. The lab draws each decision as its default and keeps the alternative (today's garden page,
no bell, a scrolling header, actions first, the carousel) for comparison.

**What the 20 October picks changed.** The maintainer's pasted line is the lab's default and its
Decided picks preset: the carousel is back, leading with the open season and campaigns; Home's
rows stay the locked cards; the duties section is titled Needs Your Attention; the wallet launcher
stays in the header; the Insights sheet opens with the banner; the Start step shows the compact
promise card, the free-work row reads Log Work on Its Own, and Submit Work shows no Work-for pin.
Three tweaks came with it: the compact card folds more than two needs into a +N mark, the info
panel keeps one height across the step's contexts, and the four steps spread across the width.
The "season assessment" wording is gone: assessments are garden-level, and the word season now
means the pool's cycle. On 21 October the maintainer took the rail for seasons and campaigns and
locked the plan and scope.

**It is a mock, not the product.** Every screen is hand-built HTML drawn with the token values and
sizes locked by the app and cockpit unification hub on 18 October 2026 (Plus Jakarta Sans, the
linen ground, 24px cards, 88px item rows with the status pill under a one-line title, capsule
chips, equal-width tabs, one count badge, the pill behind the active bottom-bar icon). The gardens
come from the eighteen the production indexer listed on Arbitrum One on 19 October 2026. Two of
them the app hides everywhere (Live Garden Coop and Greenpill Nigeria), and the lab leaves them out
too; the sixteen it draws carry real names, places, gardener and steward counts, open-joining flags
and creation dates, with places lightly tidied for display. Among the sixteen, the two family test
gardens (Aiyeloja Family Garden and Mama Gardens) are off the app's public lists and appear only
where the member belongs to them, which is why Aiyeloja Family Garden sits in the several-garden
scenario but never in Explore for a stranger. The banners in `gardens/` are the gardens'
own, re-encoded at 640 × 320; eight could not be fetched from this environment (four gardens have
none, four sit behind gateways that refused the request) and draw the fallback instead. Work
photos, people, promises, counts and activity are invented, and the work tiles are drawn scenes. It
proves nothing about the shipped interface; the locked picks are recorded in
[spec.md](../spec.md#decisions-locked-on-18-october-2026).

The same screens also exist as a private Design canvas on claude.ai from the first round; it does
not carry the 19 October changes, and its link is not part of this repository.

The findings behind the lock were taken from a mock-auth localhost walk on 18 October 2026 (the
main checkout at `06a31dbf5`, whose journey files matched develop `eeda2d4e5`, on Arbitrum with the
production indexer) and from the unification hub's Storybook captures. No screenshots from that walk
are stored here.
