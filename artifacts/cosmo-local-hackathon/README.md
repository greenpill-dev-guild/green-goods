# Cosmo-Local hackathon pitch assets

Editable pitch material for the SustainableFinance.Live 2026 entry (Problem Statement 2). First
draft, 9 October 2026. Research, claim ledger, supporter offer, demo scripts and the fiat
decision note live in
[`.plans/backlog/cosmo-local-credit-interop/research/`](../../.plans/backlog/cosmo-local-credit-interop/research/README.md).

## Deck

- Source: [`deck/index.html`](deck/index.html). One self-contained HTML file: slides, inline SVG
  diagrams, Warm Earth tokens, and the speaker notes in the `#speaker-notes` JSON block.
- Notes: [`deck/speaker-notes.md`](deck/speaker-notes.md) carries the same notes with timings.
- Rendered: `deck/output/slide-NN.png` (960 x 540 previews) and `deck/output/deck.pdf`. The
  repository's `.gitignore` ignores `output/`, so these are local files: run the render command
  below to produce them.

### Present

Open `deck/index.html` in a browser. Keys: `→` `Space` `PgDn` next, `←` `PgUp` previous, `Home`
and `End`, `1` to `0` jump, `N` toggles the notes panel, `P` prints. The deck scales to any
screen. Fonts load from Google Fonts; offline, the system serif and sans fallbacks apply.

### Re-render after edits

From the repository root, with the repository's Playwright install:

```bash
node artifacts/cosmo-local-hackathon/deck/render.mjs
```

### Photos

Slides 2 and 13 use two photographs of the Awka hub, `deck/assets/photos/awka-hub.jpg` and
`deck/assets/photos/tas-hub-build.jpg`. They are not committed: they belong to Tech and Sun and
show identifiable people, and the permission given on 9 October covers the pitch, not
redistribution under this repository's license. Place the two files in that folder before
presenting or rendering. Without them the two slides show an empty frame with its caption.

### Status labels

Every diagram distinguishes three states with the same chips: **Live today** (solid green),
**Planned pilot, rehearsal first** (dashed amber) and **Stretch** (dotted sky). Keep the labels
when editing. The [claim ledger](../../.plans/backlog/cosmo-local-credit-interop/research/claim-ledger.md)
says which wording each claim may carry.

### What is deliberately missing

No participant quotes or names (consent pending, MAR-35 and COM-28). No live Gnosis
screenshots (no live pools exist). No prices beyond the hub's draft plan, labeled scenario. No
hackathon rubric or pitch length (unpublished; confirm at the 16 October briefing).
