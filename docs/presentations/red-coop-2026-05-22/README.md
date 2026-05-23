# Green Goods · 5-minute deck

Editorial-styled presentation deck for the regional cooperative talk (2026-05-22). Built to match the Green Goods public website (Warm Earth palette, Fraunces + Inter, kicker + hero-card patterns).

## Present it

1. Open **`deck.html`** in Chrome or Brave (double-click, or drag into a browser tab).
2. Press **`f`** for fullscreen.
3. Navigate:
   - **→ / Space / click** — next slide
   - **← / right-click** — previous slide
   - **Home / End** — first / last slide
   - slide counter sits bottom-right.

The HTML works offline on its own (fonts fall back to system serif/sans). For a hard backup, export **`deck.pdf`** in one step — see *Exporting the PDF* below. Only needed if the venue machine can't open the HTML at all.

## Fonts (read before presenting offline)

The deck loads **Fraunces** (headlines) and **Inter** (body) from Google Fonts. With internet they render exactly like the website. **Offline**, they fall back to a warm system serif (Georgia/Hoefler) and the system sans — still clean and readable, just not pixel-identical. If you can, present on wifi for full fidelity. The PDF embeds whatever fonts were available when it was exported.

## Run of show (~5 min)

| # | Slide | Budget | Notes |
|---|-------|--------|-------|
| 1 | The Gap (cover) | 0:35 | the gap + the goal (make reporting accessible); $5K–15K MRV cost excludes grassroots |
| 2 | The Regenerative Work Loop | 0:40 | Assess → Do → Verify → Fund, across 4 domains |
| 3 | Who Tends a Garden | 0:40 | the five archetypes |
| 4 | What We Built | 0:50 | accessible PWA front door, then the composed stack (Hats first, Gardens substrate) |
| 5 | A Living Public Record | 0:35 | **demo cue → greengoods.app/impact**; 18 / 63 / 45 / 31 |
| 6 | Tech and the Sun | 0:50 | **demo cue → the TAS garden page**, then return |
| 7 | Where We're Headed | 0:35 | transparent evaluations + community signal |
| 8 | Close | 0:15 | tagline |

**Total ≈ 4:45** plus the live demo. Keep the combined live portion (slides 5→6) to ~45–60s.

## Live demo path

Slides 5 and 6 each carry a green **Live ·** cue that opens the real page in a new tab:
1. On slide 5, click **Live · greengoods.app/impact** and show the public counts.
2. Advance to slide 6, click **Live · the TAS HUB garden** (this is the Tech and the Sun garden, `/gardens/0xA2DF…D5E3`).
3. Close the tab(s), return to the deck, advance to slide 7.

> Click the TAS HUB cue once before the talk to confirm the page loads.

## Editing the stat numbers (slide 5)

The four counts live on slide 5 as `<div class="n" data-stat="...">`: `gardens`, `hands`, `entries`, `verified`. Current values **18 / 63 / 45 / 31** are a live snapshot pulled 2026-05-21 from the greengoods.app indexer (gardens, contributors) plus EAS on Arbitrum (work entries, work approvals). To refresh, read the four tiles on greengoods.app/impact and edit the text in the tags. Note: assessments are live-zero (2 exist but both revoked), so the fourth tile shows operator **Work verified** (work approvals); Impact Certificates omitted (first issuance pending).

## Exporting the PDF (one step, ~10s)

Open `deck.html` in Brave/Chrome → **Print** (⌘P) → Destination **Save as PDF**, Layout **Landscape**, Margins **None**, **Background graphics ON**, Paper size **A4** or **Letter** (the deck's print CSS already sizes pages 13.333×7.5in). Save as `deck.pdf` in this folder. Do a quick scroll through the print preview first to confirm all 8 slides each land on their own page.

> The PDF was not auto-generated when this deck was built (the build sandbox couldn't run a headless browser). Generating it on your machine takes the one step above and embeds the live Fraunces/Inter fonts since you'll have internet.

## Assets

`assets/hero-home.webp` (cover), `assets/hero-garden.webp` (TAS slide), `assets/hero-impact.webp` (spare) — copied from `packages/client/public/images/`. Fonts load from CDN; no local font files shipped.
