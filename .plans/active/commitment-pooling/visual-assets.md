# Commitment Pooling — Visual Asset Index

**Updated**: 2026-07-19 (gallery extended to 10 of 11 assets and republished; fund topology corrected; square-canvas + non-square exception techniques verified)
**Gallery**: [Commitment Pooling — Visual Asset Gallery](https://claude.ai/code/artifact/007ef090-9e26-4b1d-898c-615155304d9d), built by `visual-assets-artifact.build.ts` in this folder. ✅ **It now renders 10 of the 11 assets** across an 11-section story tab — the loop, roles, money map, settlement states, funding rails, flywheel, three tiers, circular G$, rollout timeline and ownership map, plus the baseline text panel. It is a complete review surface for everything except **`synthesis-ge-protocol`**, which is deliberately excluded while its four-vs-six framing is unresolved (see Known asset issues below). Rebuild with `bun .plans/active/commitment-pooling/visual-assets-artifact.build.ts`; it republishes to the same URL.
**Pipeline**: every asset is a hand-crafted, self-contained SVG (Warm-Earth palette, explicit 2x `width`/`height` so Linear sizes it correctly) with a 2x PNG companion for Linear upload. Linear docs cannot be written with embedded images over MCP — **uploads are manual** (drag the PNG into the doc at the placement below). The SVG is the print/PDF source; the PNG is the Linear-upload source.

## Style contract

Reference implementation: `artifacts/visuals/external-brief-loop.svg`. Paper `#FBF8F2`, ink `#2A2722`, Built = fill `#DFEBDE` / stroke `#4C7A57` solid, Planned/gated = white fill / stroke `#A19884` dashed `5 4`, negation `#A65D57`, arrows `#AC9F87`, system font stack, rx 12, footer caption `Green Goods · Commitment Pooling — v1 (2026-07)`. Solid = Built/live, dashed = Planned/gated, everywhere.

**Content constraints (all assets)**: no garden names in diagrams; presentation prose names the three confirmed candidate gardens only — the fourth slot is open and is never given a name (Decision Log #29). Diagrams stay garden-agnostic so they survive cohort changes. Use canonical role names only (Gardener, Operator, Evaluator, Funder, Community) — this is the **persona axis** (`v1-0.mdx` §3.1 archetypes) and is deliberately unchanged by Decision Log #28c, which standardizes "Garden Steward" as the *role* term in prose, not as a persona label; only the modeled ProtocolToGarden funding route (HoA → protocol Safe stays upstream); *Reported* visually distinct from *Oracle-verified*; the local spend sink is a circulation aim / ordering criterion, never a launch gate; no banned vocabulary (streak/countdown/leaderboard/FOMO/urgency terms); no rankings imagery.

**Canvas convention**: square (or ≤1.3:1) viewBoxes only — macOS `qlmanage` (the local render pipeline) slice-crops wide-landscape SVGs from the left, so wide canvases fail local verification even though browsers/Linear render them correctly. Square canvases are safe everywhere.

## Asset index

| File | Target document | Placement | Shows |
|---|---|---|---|
| `artifacts/visuals/external-brief-loop.svg/.png` | **01 External Brief** | after "How the loop works" | The 7-step loop as a circle, Built/Planned coded |
| `artifacts/visuals/external-brief-roles.svg/.png` | **01 External Brief** | before "An invitation" | Five roles × their loop actions |
| `artifacts/visuals/external-brief-money-map.svg/.png` | **01 External Brief** | in "Trust and money" | Arbitrum proof ∥ Celo G$, routes, oracle check, no-bridge |
| `artifacts/visuals/external-brief-funding-rails.svg/.png` | **01 External Brief** | in "How delivered outcomes attract funding" | Three rails converging on delivered outcomes |
| `artifacts/visuals/rollout-timeline-band.svg/.png` | **04 External Doc & Rollout Plan** | at "Sequence" | Six checkpoints with engagement + exit evidence |
| `artifacts/visuals/rollout-ownership-map.svg/.png` | **04 External Doc & Rollout Plan** | at "The documentation set" | Eight artifacts → the surface that owns each |
| `artifacts/visuals/rollout-settlement-states.svg/.png` | **04 External Doc & Rollout Plan** | at "The words we use for evidence" | Queued→…→Oracle-verified/Failed state machine, no human path |
| `external-brief-loop` + `external-brief-roles` (reuse) | **04 External Doc & Rollout Plan** | at "One grounded story" | Same assets as the brief — visual consistency |
| `artifacts/visuals/synthesis-flywheel.svg/.png` | **02 GE Learnings & Full Flywheel** | at TL;DR or §2.0 | Loop at center, four funding rails, gated borrow-repay ring |
| `artifacts/visuals/synthesis-three-tiers.svg/.png` | **02 GE Learnings & Full Flywheel** | at §4.4 | Mutual aid → G$ paid work → borrow-and-repay ladder |
| `artifacts/visuals/synthesis-circular-gd.svg/.png` | **02 GE Learnings & Full Flywheel** | at §2.8 | HoA → … → members → local sink circulation circle |
| `artifacts/visuals/synthesis-ge-protocol.svg/.png` | **02 GE Learnings & Full Flywheel** | at §1.1 — ⚠️ four-vs-six, see above | Curation/valuation/limitation/exchange quadrant (Ruddick 2023) |

### Known asset issues (2026-07-18)

- ✅ **`rollout-ownership-map` redrawn 2026-07-19.** It previously mapped *eight artifacts → owning Linear records*, from when the documentation set lived across Linear issues. It now maps the same eight artifacts to the **surface that owns each** — repo plan hub, Linear, or Google Doc — which is what § The three surfaces actually asserts, and it carries the direction-of-truth rule in its caption. (The earlier warning said the set had grown to nine rows; § Documentation set has eight, so that count was itself wrong. The owner column was the real defect.) **One scheduled change**: the operator onboarding guide is drawn as repo-homed, which is true today; if the community-interface instruments move to Linear as canonical after the 07-31 checkpoint, that one connector moves with them.
- ⚠️ **`synthesis-ge-protocol` may under-describe its source.** It renders GE's protocol as a four-part quadrant (curation / valuation / limitation / exchange). Ruddick's June 2026 paper ([Regenerative Bonds](https://arxiv.org/html/2606.23922), lead author) describes **six**, adding *route* and *repair*. Both appear in our §1.7 clearing text, so the prose is not wrong — but the graphic is narrower than the paper. Redraw is a judgement call.
- **No asset exists for the Use Cases tab.** Nothing carries the Part B garden-journey story. Zero-cost option: reuse `external-brief-roles` after "Terms used here" and `rollout-settlement-states` at scenario S8. Better: author a three-column garden-journey strip (garden names in column headers only, so it survives a cohort change).

Tab **02** has **zero images today** — all four synthesis assets exist with designated placements and were never uploaded. Google Docs will not accept embedded images over MCP: drag the 2x PNGs in by hand.

## Truth sources

Audience assets simplify, never contradict, the engineering diagrams in `diagrams.md`: money map ↔ D8 + D12 + `settlement-spec.md`; roles strip ↔ D13 permission map; settlement states ↔ D10 + D9; loop ↔ D2/D6. If a spec changes, regenerate the affected asset in the same pass.

## Optional: product screenshots as Built-proof

`docs/static/img/screenshots/` holds ~20 shipped-surface captures (`client-work-offline.png`, `client-garden-home.png`, `admin-work-queue.png`, …). They may be inserted into the brief's PDF export as Built evidence — with a version/date caption per the docs screenshot rules. Decide at upload time; not wired into any document automatically.

## Regeneration

**After editing any asset, rebuild the gallery** so the shared link reflects it:
`bun .plans/active/commitment-pooling/visual-assets-artifact.build.ts` — republishes to the same artifact URL above (three audience tabs: story, architecture D1–D13, screens W1–W26).

The per-asset SVG/PNG steps:

1. Edit the SVG directly (they are plain hand-written XML).
2. Validate: `python3 -c "import xml.etree.ElementTree as ET; ET.parse('<file>.svg')"`.
3. PNG at 2x: `qlmanage -t -s <2xW> <file>.svg -o <dir>`, then rename `<file>.svg.png` → `<file>.png`. With square canvases this yields the exact 2x size with no cropping. (Headless Brave hangs on this machine with both `--headless` flags; qlmanage slice-crops wide-landscape SVGs — hence the square-canvas convention above.) **Non-square exception** (`artifacts/visuals/external-brief-loop.svg`, 1.3:1): qlmanage slice-crops even at 1.3:1 — wrap the SVG content in a temporary square 1800×1800 canvas (`<g transform="translate(0,105)">` for the 690-tall viewBox), render the square, then `sips -c 1380 1800` center-crops back to the exact 1800×1380 export (verified 2026-07-18).
4. Check dimensions: `sips -g pixelWidth -g pixelHeight <file>.png`.
