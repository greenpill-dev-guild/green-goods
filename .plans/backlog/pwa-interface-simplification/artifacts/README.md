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
| Presets | The decided picks of 19 October, Steward on first run, No garden yet, Evaluator offline: set several picks at once. |
| Phones, Size | Both widths or one; fit the window height or draw at 100%. |
| Language, Theme | English, Spanish or Portuguese; the app's light palette on the linen canvas, or the dark ladder with the card one step above the canvas. |
| Gardens | No garden, one, several on first run, several remembered. Several means TAS HUB, Ilhas de Abundância and the Aiyeloja Family Garden. |
| Role in TAS HUB | Gardener, steward or evaluator. A steward gets review duties, join requests, Endowment, Governance and To confirm; an evaluator gets the season assessment duty. |
| Endowment deposit, Pending request, Connection | A depositor's Endowment row; a request to join Vida Verde awaiting review; the shell's offline strip laid over the header's top padding, with nothing below it moving. |
| Start screen | Home, the switcher, Explore, a garden you visit, Submit Work, and the Your Work, Promises, Notifications, Work, Insights and Gardeners sheets. |
| Composition, Activity rows, Continue rows | Compact journal, featured activity or the promoted garden page; how many rows each section shows. |
| Header, Top strip, Rows | The chip row sticky at the top while the journal scrolls, or scrolling away; an optional Highlights carousel above Recent activity; Home's rows as the locked cards, one grouped surface per section, open rows with no boxes, or hairlines alone (an exploration for the 20 October discussion). |
| Variations | The switcher as a half sheet or a menu under the chip; About as a row, inside the switcher or as header icons; the first-run chooser opening by itself or a prompt only; garden sections as sheets over Home or today's garden page; a notifications bell in the header or none. |
| Submit Work | Explorations for the 20 October discussion, none decided. Shape: one list with the actions a promise of yours needs folded on top, two groups (For your promises, Everything else), a Working on a promise? question before any list, or today's order. Heading: What did you do?, What work are you logging?, or Select Your Action. Promises shown: only the ones you have taken up (the code today) or the garden's open asks too. Your promises: some or none. Work for: a pinned card, one line, or nothing. Action chooser: rows, cards with capsule chips, tabs drawn as tabs, a tile grid, a picker sheet, or today's tabs over a carousel. Promise attach (for the groups and today shapes): attach with a line and Unlink, always ask, or only from the ask. The sample garden has seven actions; Workshop photos and Node uptime log are promises you are keeping, Outage log an open ask. A pick keeps the screen in view. |
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

**It is a mock, not the product.** Every screen is hand-built HTML drawn with the token values and
sizes locked by the app and cockpit unification hub on 18 October 2026 (Plus Jakarta Sans, the
linen ground, 24px cards, 88px item rows with the status pill under a one-line title, capsule
chips, equal-width tabs, one count badge, the pill behind the active bottom-bar icon). The gardens
are the sixteen the production indexer listed on Arbitrum One on 19 October 2026, less the two the
app hides everywhere: real names, places, gardener and steward counts, open-joining flags and
creation dates, with places lightly tidied for display. The banners in `gardens/` are the gardens'
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
