# Commitment Pooling — Visual Asset Index

**Updated**: 2026-07-11
**Pipeline**: every asset is a hand-crafted, self-contained SVG (Warm-Earth palette, explicit 2x `width`/`height` so Linear sizes it correctly) with a 2x PNG companion for Linear upload. Linear docs cannot be written with embedded images over MCP — **uploads are manual** (drag the PNG into the doc at the placement below). The SVG is the print/PDF source; the PNG is the Linear-upload source.

## Style contract

Reference implementation: `external-brief-loop.svg`. Paper `#FBF8F2`, ink `#2A2722`, Built = fill `#DFEBDE` / stroke `#4C7A57` solid, Planned/gated = white fill / stroke `#A19884` dashed `5 4`, negation `#A65D57`, arrows `#AC9F87`, system font stack, rx 12, footer caption `Green Goods · Commitment Pooling — v1 (2026-07)`. Solid = Built/live, dashed = Planned/gated, everywhere.

**Content constraints (all assets)**: no garden names in diagrams; presentation prose names the four-garden cohort (Barichara Regenerativa per decision #27, always with the "selection is not participation" guardrail — never implying confirmed participation before its corrected mandate). Diagrams stay garden-agnostic so they survive cohort changes. Use canonical role names only (Gardener, Operator, Evaluator, Funder, Community); only the modeled ProtocolToGarden funding route (HoA → protocol Safe stays upstream); *Reported* visually distinct from *Oracle-verified*; the local spend sink is a circulation aim / ordering criterion, never a launch gate; no banned vocabulary (streak/countdown/leaderboard/FOMO/urgency terms); no rankings imagery.

**Canvas convention**: square (or ≤1.3:1) viewBoxes only — macOS `qlmanage` (the local render pipeline) slice-crops wide-landscape SVGs from the left, so wide canvases fail local verification even though browsers/Linear render them correctly. Square canvases are safe everywhere.

## Asset index

| File | Target document | Placement | Shows |
|---|---|---|---|
| `external-brief-loop.svg/.png` | External Brief | after "How the loop works" | The 7-step loop as a circle, Built/Planned coded |
| `external-brief-roles.svg/.png` | External Brief | before "An invitation" | Five roles × their loop actions |
| `external-brief-money-map.svg/.png` | External Brief | in "Trust and money" | Arbitrum proof ∥ Celo G$, routes, oracle check, no-bridge |
| `external-brief-funding-rails.svg/.png` | External Brief | in "How delivered outcomes attract funding" | Three rails converging on delivered outcomes |
| `rollout-timeline-band.svg/.png` | Rollout Plan | at "Go-to-community sequence" | Six checkpoints with engagement + exit evidence |
| `rollout-ownership-map.svg/.png` | Rollout Plan | at "Documentation set" | Eight artifacts → owning records |
| `rollout-settlement-states.svg/.png` | Rollout Plan | at "Evidence vocabulary" | Queued→…→Oracle-verified/Failed state machine, no human path |
| `external-brief-loop` + `external-brief-roles` (reuse) | Rollout Plan | at "One grounded story" | Same assets as the brief — visual consistency |
| `synthesis-flywheel.svg/.png` | Canonical Synthesis | at TL;DR or §2.0 | Loop at center, four funding rails, gated borrow-repay ring |
| `synthesis-three-tiers.svg/.png` | Canonical Synthesis | at §4.4 | Mutual aid → G$ paid work → borrow-and-repay ladder |
| `synthesis-circular-gd.svg/.png` | Canonical Synthesis | at §2.8 | HoA → … → members → local sink circulation circle |
| `synthesis-ge-protocol.svg/.png` | Canonical Synthesis | at §1.1 | Curation/valuation/limitation/exchange quadrant (Ruddick 2023) |

The canonical synthesis document is **never edited by automation** — insert its four images manually at the sections above.

## Truth sources

Audience assets simplify, never contradict, the engineering diagrams in `diagrams.md`: money map ↔ D8 + D12 + `settlement-spec.md`; roles strip ↔ D13 permission map; settlement states ↔ D10 + D9; loop ↔ D2/D6. If a spec changes, regenerate the affected asset in the same pass.

## Optional: product screenshots as Built-proof

`docs/static/img/screenshots/` holds ~20 shipped-surface captures (`client-work-offline.png`, `client-garden-home.png`, `admin-work-queue.png`, …). They may be inserted into the brief's PDF export as Built evidence — with a version/date caption per the docs screenshot rules. Decide at upload time; not wired into any document automatically.

## Regeneration

1. Edit the SVG directly (they are plain hand-written XML).
2. Validate: `python3 -c "import xml.etree.ElementTree as ET; ET.parse('<file>.svg')"`.
3. PNG at 2x: `qlmanage -t -s <2xW> <file>.svg -o <dir>`, then rename `<file>.svg.png` → `<file>.png`. With square canvases this yields the exact 2x size with no cropping. (Headless Brave hangs on this machine with both `--headless` flags; qlmanage slice-crops wide-landscape SVGs — hence the square-canvas convention above.) **Non-square exception** (`external-brief-loop.svg`, 1.3:1): qlmanage slice-crops even at 1.3:1 — wrap the SVG content in a temporary square 1800×1800 canvas (`<g transform="translate(0,105)">` for the 690-tall viewBox), render the square, then `sips -c 1380 1800` center-crops back to the exact 1800×1380 export (verified 2026-07-18).
4. Check dimensions: `sips -g pixelWidth -g pixelHeight <file>.png`.
