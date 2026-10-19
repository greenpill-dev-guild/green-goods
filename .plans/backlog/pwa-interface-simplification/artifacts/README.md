# Artifacts: the design lab

[pwa-home-lab.html](pwa-home-lab.html) is one self-contained file. Open it in a browser; it needs
no build and no server. The typeface loads from Google Fonts and falls back to the system face
offline.

The stage draws two phones at real size, 390 × 844 and 360 × 800, side by side, scaled to the
window height. The picks sit in a rail beside them, and a hint line at the foot describes the
control under the pointer. Taps inside a phone work: the chip, the three launchers, the rows,
See all, Explore gardens, the sheets and the bottom bar. Both phones follow the same taps.

| Control | What it switches |
|---|---|
| Presets | Locked picks, Steward on first run, No garden yet, Evaluator offline: set several picks at once. |
| Phones, Size | Both widths or one; fit the window height or draw at 100%. |
| Language, Theme | English, Spanish or Portuguese; the app's light or dark palette. |
| Gardens | No garden, one, several on first run, several remembered. |
| Role in TAS HUB | Gardener, steward or evaluator. A steward gets review duties, join requests, Endowment, Governance and To confirm; an evaluator gets the season assessment duty. |
| Endowment deposit, Pending request, Connection | A depositor's Endowment row; a request to join La Ligne Verte awaiting review; the offline banner and copy. |
| Start screen | Home, the switcher, Explore, a garden you visit, Submit Work, Your Work, Promises. |
| Composition, Activity rows, Continue rows | Compact journal, featured activity or the promoted garden page; how many rows each section shows. |
| Variations | The switcher as a sheet or a menu under the chip; About as a row, inside the switcher or as header icons; the first-run chooser opening by itself or a prompt only; sheets scoped to this garden or to all gardens. |
| Copy picks | Copies the current picks as one line of text for a note, a review or the specification. |

The picks persist in the browser's local storage under `gg-pwa-home-lab-v1`.

**It is a mock, not the product.** Every screen is hand-built HTML drawn with the token values and
sizes locked by the app and cockpit unification hub on 18 October 2026 (Plus Jakarta Sans, the
linen ground, 24px cards, 88px item rows with the status pill under a one-line title, capsule
chips, equal-width tabs, one count badge, the pill behind the active bottom-bar icon). The garden
scenes are drawn illustrations, not photographs. Sample gardens, names and addresses are invented.
It proves nothing about the shipped interface; the locked picks are recorded in
[spec.md](../spec.md#decisions-locked-on-18-october-2026).

The same screens also exist as a private Design canvas on claude.ai (two interactive artboards
with the picks as Tweaks); its link lives with the maintainer and is not part of this repository.

The findings behind the lock were taken from a mock-auth localhost walk on 18 October 2026 (the
main checkout at `06a31dbf5`, whose journey files matched develop `eeda2d4e5`, on Arbitrum with the
production indexer) and from the unification hub's Storybook captures. No screenshots from that walk
are stored here.
