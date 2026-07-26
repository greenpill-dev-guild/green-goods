# Commitment Pooling — Visual Asset Index

**Updated**: 2026-07-25 (architecture coherency pass — the 12 story SVGs are unchanged; the Architecture tab was reconciled to the frozen specs, its three densest diagrams split, and five previously undrawn surfaces added. Story SVG state as of 2026-07-23: document-scale type, contrast-safe Warm Earth roles, accessible metadata, frozen CCIP command/acknowledgment states, ownership map matching the six-tab external document, and Follow On / Hardening closing in parallel with the Community/evidence checkpoint on September 30.)
**Gallery**: [Commitment Pooling — Visual Asset Gallery](https://claude.ai/code/artifact/007ef090-9e26-4b1d-898c-615155304d9d), built by `visual-assets-artifact.build.ts` in this folder. The story tab covers all 12 hand-drawn assets — loop, roles, the Use Cases journey strip, money map, settlement states, funding rails, flywheel, three tiers, circular G$, GE protocol functions, rollout timeline, and ownership map. The Architecture tab is generated wholly from `diagrams.md` (**32 Mermaid blocks across 23 named D-sections**) and the Screens tab from `wireframes.md`. Rebuild and validate locally before republishing to the same URL; an unavailable artifact publisher is a publication blocker, not proof that the live URL changed.
**Pipeline**: every asset is a hand-crafted, self-contained SVG (Warm-Earth palette, explicit 2x `width`/`height` so Linear sizes it correctly) with a 2x PNG companion for Linear upload. Linear docs cannot be written with embedded images over MCP — **uploads are manual** (drag the PNG into the doc at the placement below). The SVG is the print/PDF source; the PNG is the Linear-upload source.

## Style contract

Reference implementation: `artifacts/visuals/external-brief-loop.svg`. Paper `#FBF8F2`, ink `#2A2722`, stone text `#6E6857`, Built = fill `#DFEBDE` / stroke `#4C7A57` solid, Planned/gated = white fill / stroke `#988D77` dashed `5 4`, negation `#A65D57`, arrows `#988D77`, system font stack, rx 12, footer caption `Green Goods · Commitment Pooling — v1 (2026-07)`. Solid = Built/live, dashed = Planned/gated, everywhere. A green check or red failure label may describe an authenticated lifecycle outcome inside a planned dashed boundary; outcome color never reclassifies the component as built. On paper, stone text passes 4.5:1 and planned boundaries/arrows pass 3:1; planned number badges use ink rather than white.

**Typography and accessibility contract**: optimize each source for a 624–720 px document placement, not only its 2× export dimensions. Body copy should normally use at least 16–20 viewBox units, with larger type where the canvas is 1000 or 1100 units wide; short evidence-state labels may use 14–16 only when the surrounding card and explicit solid/dashed treatment carry the same meaning. Every informative SVG requires `role="img"`, a unique `aria-labelledby`, and matching `<title>` + `<desc>`. The gallery's inline desktop view fits the complete composition inside a laptop-height reading plane; the dedicated preview plane is the detailed-reading path, cloning the inline SVG or rendered Mermaid with zoom plus pan/scroll and focus return on close. Narrow screens retain the readable minimum width and horizontal-scrolling fallback.

**Content constraints (all assets)**: no garden names in diagrams; presentation prose names the three confirmed candidate gardens only — the fourth slot is open and is never given a name (Decision Log #29). Diagrams stay garden-agnostic so they survive cohort changes. External-facing assets use the human role names Gardener, Garden Steward, Evaluator, Funder, and Community; implementation specs may retain `operator` as the permission term. A Need is a problem paired with a desired outcome; Request / Offer appears only as commitment direction. Show only the modeled ProtocolToGarden funding route (HoA → protocol Safe stays upstream); keep *Queued*, *Dispatched*, derived *delivery delayed*, derived *Celo executed / acknowledgment pending*, authenticated *Confirmed*, authenticated *Failed*, and origin-specific *Cancelled* distinct; cancellation is available before dispatch or after authenticated failure, never from delay. Show command retry and acknowledgment retry as separate paths and state that neither can execute G$ twice; the local spend sink is a circulation aim / ordering criterion, never a launch gate; no banned vocabulary (streak/countdown/leaderboard/FOMO/urgency terms); no rankings imagery.

**Canvas convention**: square (or ≤1.3:1) viewBoxes only — macOS `qlmanage` (the local render pipeline) slice-crops wide-landscape SVGs from the left, so wide canvases fail local verification even though browsers/Linear render them correctly. Square canvases are safe everywhere.

## Asset index

| File | Target document | Placement | Shows |
|---|---|---|---|
| `artifacts/visuals/external-brief-loop.svg/.png` | **01 External Brief** | after "How the loop works" | The 7-step loop as a circle, Built/Planned coded |
| `artifacts/visuals/external-brief-roles.svg/.png` | **01 External Brief** | before "An invitation" | Five roles × their loop actions |
| `artifacts/visuals/external-brief-money-map.svg/.png` | **01 External Brief** | in "Trust and money" | Arbitrum command/ack ∥ Celo G$, bounded route, no-bridge; HoA mechanism/receipt remains visibly evidence-pending |
| `artifacts/visuals/external-brief-funding-rails.svg/.png` | **01 External Brief** | in "How delivered outcomes attract funding" | Three rails converging on delivered outcomes |
| `artifacts/visuals/use-cases-journey-strip.svg/.png` | **03 Use Cases & Scenarios** | after the section introduction | Three garden-agnostic Need → Request/Offer commitment → proof journeys, including no-token and gated G$ paths |
| `artifacts/visuals/rollout-timeline-band.svg/.png` | **04 External Doc & Rollout Plan** | at "Sequence" | Four native phases plus two separately labeled operational checkpoints |
| `artifacts/visuals/rollout-ownership-map.svg/.png` | **04 External Doc & Rollout Plan** | at "The documentation set" | One canonical external document supported by distinct repo, Linear, and Google Doc truth surfaces; no prose mirrors |
| `artifacts/visuals/rollout-settlement-states.svg/.png` | **04 External Doc & Rollout Plan** | at "The words we use for evidence" | Queued→Dispatched→Celo outcome stored→Confirmed/Failed state machine, origin-specific cancellation boundaries, no human verification path, and no implication that a stored failure moved G$ |
| `external-brief-loop` + `external-brief-roles` (reuse) | **04 External Doc & Rollout Plan** | at "One grounded story" | Same assets as the brief — visual consistency |
| `artifacts/visuals/synthesis-flywheel.svg/.png` | **02 GE Learnings & Full Flywheel** | at TL;DR or §2.0 | Loop at center, four funding rails, gated borrow-repay ring |
| `artifacts/visuals/synthesis-three-tiers.svg/.png` | **02 GE Learnings & Full Flywheel** | at §4.4 | Mutual aid → G$ paid work → borrow-and-repay ladder |
| `artifacts/visuals/synthesis-circular-gd.svg/.png` | **02 GE Learnings & Full Flywheel** | at §2.8 | HoA → … → members → local sink circulation circle |
| `artifacts/visuals/synthesis-ge-protocol.svg/.png` | **02 GE Learnings & Full Flywheel** | at §1.1 | Six functions: curation, valuation, limitation, exchange, route, and repair |

## PNG upload alt text

Use the exact intent below when manually uploading a PNG to Linear or the canonical Google Doc. Do not use the filename as alt text, and do not prefix the description with “Image of.”

| PNG | Alt text |
|---|---|
| `external-brief-loop.png` | Seven-step commitment loop from community need through baseline, promise, proven work, recipient confirmation, community learning, and impact certificate, with each step labeled Built or Planned. |
| `external-brief-roles.png` | Five role cards for Gardener, Garden Steward, Evaluator, Funder, and Community, with every action individually labeled Built or Planned. |
| `external-brief-money-map.png` | Arbitrum command and acknowledgment states above Celo G$ movement, with Dispatched separated from Confirmed and an explicit rule that G$ never bridges to Arbitrum. |
| `external-brief-funding-rails.png` | Impact certificates, supporter-vault yield, donations, and planned G$ settlement converging on delivered and confirmed outcomes. |
| `use-cases-journey-strip.png` | Three garden-agnostic journeys in which a problem and desired outcome become a Request or Offer commitment, followed by proof and confirmation; one moves no token and one uses separately gated G$ settlement on Celo. |
| `rollout-timeline-band.png` | Four native phases from July 22 through September 30, plus separate July and September operational checkpoints; the two September closures run in parallel. |
| `rollout-ownership-map.png` | One six-section external document supported by three distinct truth surfaces: repo specifications and evidence, Linear delivery status, and Google Doc external narrative, with no mirrored prose in the repo. |
| `rollout-settlement-states.png` | Settlement flow from Queued to Dispatched to Celo execution and acknowledgment, then Confirmed only after an authenticated success acknowledgment for the current execution key and attempt, or Failed after its authenticated failure acknowledgment; cancellation is allowed before dispatch or after authenticated failure, never because delivery is late; no human verification path. |
| `synthesis-flywheel.png` | Commitment loop at the center of donations, supporter-vault yield, impact-certificate sales, and planned G$ settlement, surrounded by an evidence-gated borrow-and-repay ring. |
| `synthesis-three-tiers.png` | Three-step ladder from planned mutual aid to planned G$ paid work to evidence-gated borrow-and-repay. |
| `synthesis-circular-gd.png` | Circular Celo G$ flow from the House of Alignment stream through the protocol treasury, garden accounts, members, and a local spend sink. |
| `synthesis-ge-protocol.png` | Six Green Goods protocol functions shown equally: curation, valuation, limitation, exchange, route, and repair. |

### Known asset issues (2026-07-18)

- ✅ **`rollout-ownership-map` reconciled 2026-07-21.** The asset now shows one canonical six-section external document supported by three non-overlapping truth surfaces. The Google Doc owns all external prose; the repo owns specs/evidence/artifacts; Linear owns current delivery status. No repo or Linear prose mirror is prescribed.
- ✅ **`synthesis-ge-protocol` redrawn 2026-07-20.** It now renders curation, valuation, limitation, exchange, route, and repair as six equally visible functions; the former four-part quadrant is retired.
- ✅ **`use-cases-journey-strip` added 2026-07-21.** It covers the missing Use Cases section with three garden-agnostic paths and encodes the locked Need-versus-commitment model without tying the asset to a provisional cohort.

Tab **02** now has **2 of the 4** synthesis assets embedded and visibly rendered — `synthesis-ge-protocol` (under "The six protocol functions") and `synthesis-flywheel` (under "One model, one loop") — live-verified in the Google Doc on 2026-07-22 (supersedes the earlier "zero images today" note). **`synthesis-three-tiers` and `synthesis-circular-gd` are still not uploaded.** Google Docs will not accept embedded images over MCP: drag the remaining 2x PNGs in by hand.

## Vocabulary source

Every state and enum label in these assets resolves to the machine-readable ontology sidecar, **`packages/shared/src/ontology/green-goods-ontology.json`** (human-readable render: `docs/docs/reference/ontology.generated.mdx`), which became repo canon with the ontology foundation on 2026-07-26. The twelve commitment-pooling vocabularies carry `status: "spec"` and are transcribed member-for-member from `contract-spec.md` §6.1/§6.2.

Three rules bind the assets:

1. **1:1 mapping.** Display copy may prettify — a GraphQL mirror may read `APPROVAL_GATED`, an edge label may read "accepted (creator)" — but every label must map onto exactly one canonical member. No asset may introduce a term the sidecar does not carry; see `plan.todo.md` § *Ontology sidecar gaps* for the families flagged rather than invented.
2. **Provenance is visible.** The sidecar flags each state `on-chain`, `derived`, or `off-chain`, and the Architecture tab renders that: paper = on-chain, amber = derived, grey = app-only. A derived state must never read as a chain write. `Reconciled` is derived for commitments and on-chain for cycles — the two diagrams style it differently on purpose.
3. **`PoolType` is two vocabularies.** `commitment-pool-type` (Garden/Protocol) and the live Gardens V2 `signal-pool-type` (ActionSignal/HypercertSignal) share a Solidity identifier and must never be labelled interchangeably.

The 12 hand-drawn story SVGs carry prose rather than enum labels, so they hold no vocabulary surface. `bun run check:ontology` guards the code layers only — it parses neither Markdown nor images, so this index and `diagrams.md` are the manual leg of that contract.

## Truth sources

Audience assets simplify, never contradict, the engineering diagrams in `diagrams.md`: money map ↔ D8 + D12 + `settlement-spec.md`; roles strip ↔ D13 capability summary and D13b exact permissions; settlement states ↔ D10 + **D10b** (the 5-stored → 9-rendered derivation) + D9.0/D9.1/D9.2; loop ↔ D2.0 overview and D6.0 overview. If a spec changes, regenerate the affected asset in the same pass.

**Status vocabulary across the two tabs**: the story assets label *actions* Built or Planned; the Architecture tab labels *components*, using three treatments — Built/live, Planned/gated, and **existing surface with a planned delta** (`diagrams.md` § Visual status contract). A live surface carrying a planned action is the third class, which is why the client PWA, editorial website, Admin, and the Envio read model read as Built in the story tab and as an existing-surface delta in D1/D1b without contradiction.

## Optional: product screenshots as Built-proof

`docs/static/img/screenshots/` holds ~20 shipped-surface captures (`client-work-offline.png`, `client-garden-home.png`, `admin-work-queue.png`, …). They may be inserted into the brief's PDF export as Built evidence — with a version/date caption per the docs screenshot rules. Decide at upload time; not wired into any document automatically.

## Regeneration

**After editing any asset, rebuild the gallery** so the shared link reflects it. There are **two steps, and the second is not optional for publishing**:

```bash
bun .plans/active/commitment-pooling/visual-assets-prerender.ts
```

That script runs the builder read-only and then freezes the result, producing all three outputs:

1. `visual-assets-artifact.build.ts` writes the two build targets — three audience tabs: story; **23 named Architecture sections D1–D16** (including D1b, D7b, D7c, D7d, D10b, D11b, D13b) rendered as **32 Architecture Mermaid blocks**; and the canonical CP screen states.
   - `LOCAL_OUT` → `/tmp/commitment-pooling-visual-assets.html` — the complete local `file://` preview with the locked Mermaid runtime embedded. **This is the file to open for visual validation.**
   - `ARTIFACT_OUT` → `/tmp/commitment-pooling-visual-assets.artifact-body.html` — body content that still contains `<pre class="mermaid">`.
2. The prerender step renders every block through the already-installed Playwright chromium (light + dark), splices the resulting inline `<svg>` into the body, and writes `SHAREABLE_OUT`.

**Publish `SHAREABLE_OUT`, not `ARTIFACT_OUT`.** An artifact containing `<pre class="mermaid">` cannot be shared publicly — the host renders Mermaid at view time and unauthenticated viewers can't invoke that renderer, so the share is refused with "This version can't be shared publicly" (confirmed empirically 2026-07-22). The frozen body has no `<pre class="mermaid">`, no embedded runtime, and no external script references; the prerender asserts all three before writing.

The builder hard-fails on missing or duplicate required D sections, Mermaid-count drift, a diagram-bearing section losing its diagram, a reading-guide section losing its panel, and any nav link that does not resolve to a section or sub-block anchor. The prerender additionally fails if any diagram does not render to SVG — its `render status: … (rendered N, failed 0)` line is the parse proof. `LOCAL_OUT`, `ARTIFACT_OUT`, and `SHAREABLE_OUT` may all be overridden by environment variable. W6 and the dissolved lo-fi variants are not standalone frames. Republish only after validating the local preview.

The per-asset SVG/PNG steps:

1. Edit the SVG directly (they are plain hand-written XML).
2. Validate: `python3 -c "import xml.etree.ElementTree as ET; ET.parse('<file>.svg')"`.
3. PNG at 2x: `qlmanage -t -s <2xW> <file>.svg -o <dir>`, then rename `<file>.svg.png` → `<file>.png`. With square canvases this yields the exact 2x size with no cropping. (Headless Brave hangs on this machine with both `--headless` flags; qlmanage slice-crops wide-landscape SVGs — hence the square-canvas convention above.) **Non-square exception** (`artifacts/visuals/external-brief-loop.svg`, 1.3:1): qlmanage slice-crops even at 1.3:1 — wrap the SVG content in a temporary square 1800×1800 canvas (`<g transform="translate(0,105)">` for the 690-tall viewBox), render the square, then `sips -c 1380 1800` center-crops back to the exact 1800×1380 export (verified 2026-07-18).
4. Check dimensions: `sips -g pixelWidth -g pixelHeight <file>.png`.
