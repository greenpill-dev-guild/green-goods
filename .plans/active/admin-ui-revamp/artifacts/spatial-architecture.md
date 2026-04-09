# Spatial Architecture — Three-Body System

> **Design Language**: Warm Glass — see `.claude/skills/design/language.md`
> Material expression through spatial structure.

**Created**: 2026-04-07
**Status**: Wireframing in Figma Make (Phase 1: spatial states, Phase 2: content fill)
**Complements**: `plan.todo.md` Phase 2 (View Transitions, M3 tonal elevation)

---

## The Three Bodies

### 1. Persistent Chrome (Z3, always visible, always interactive)

**Top Axis** — NOT a bar. A transparent left-right axis of floating elements:
- Left: Garden context chip (left-side trigger → opens left sheet)
- Right: Sync dot, search, settings, avatar (right-side triggers → open right sheet)
- Z-index: 40
- No background, no border, no shadow. Ground (#F7F7F7) visible behind and between elements.

**Nav Bar** — glass material, floating:
- Desktop (≥600px): centered pill, `backdrop-blur-lg`, `bg-bg-soft/95`, `shadow-float`
- Mobile (<600px): full-width bottom bar with safe-area inset
- Z-index: 30
- Non-modal: content scrolls behind it

### 2. Canvas (Z2, main content surface)

The workspace content lives in a single rounded surface floating above the ground.

| State | Transform | Opacity | Filter |
|-------|-----------|---------|--------|
| Resting | `scale(1)` | `1.0` | none |
| Sheet active | `scale(0.97)` | `0.85` | `blur(2px)` |
| Transition out | `scale(0.97)` + fade | `0→0` | none |
| Transition in | `scale(0.97→1)` + fade | `0→1` | none |

**No dark scrim.** Depth separation via transform + opacity + blur + sheet shadow.

### 3. Sheets (Z4, within content zone)

Sheets slide within the content zone bounds — they do NOT cover the top axis or nav bar.

| Sheet | Trigger Origin | Motion | Corner Radius | Shape Type | Shadow |
|-------|---------------|--------|---------------|------------|--------|
| Right Sheet | Right-side top axis icons | `translateX(100%→0)` | `rounded-l-[20px]` | Concentric (24px viewport - 4px margin) | Left edge: `-8px 0 24px rgba(0,0,0,0.08)` |
| Left Sheet | Left-side garden chip | `translateX(-100%→0)` | `rounded-r-[20px]` | Concentric (24px viewport - 4px margin) | Right edge: `8px 0 24px rgba(0,0,0,0.08)` |
| Bottom Sheet (mobile) | Various | `translateY(100%→0)` | `rounded-t-[20px]` | Concentric (24px viewport - 4px margin) | Top edge: `0 -8px 24px rgba(0,0,0,0.08)` |
| Command Palette | ⌘K / search icon | `scale(0.95→1)` + fade | `rounded-[24px]` | Concentric (from viewport edge) | `0 20px 40px rgba(0,0,0,0.12)` |

**Sheet bounds:**
- Top: below top axis (56px from viewport top)
- Bottom: above nav bar (~80px from viewport bottom desktop, ~72px mobile)
- Sheets always have their outer edge flush with the content zone margin (24px desktop, 12px mobile)

**Spatial origin rule:** Sheets open from the side where you triggered them. Click garden chip (left) → left sheet. Click settings (right) → right sheet. This creates spatial continuity.

---

## Motion Language

### Animation Specs — Spring Tokens

Uses Warm Glass named spring tokens (see `language.md` § Motion System) instead of hardcoded beziers. The cockpit uses the **Standard** motion scheme by default; **Expressive** activates for hero moments (garden creation, first submission).

```css
/* Spatial springs (layout, navigation, sheets) */
--spring-spatial:      cubic-bezier(0.16, 1, 0.3, 1) 300ms;   /* entrance, sheets, nav */
--spring-spatial-fast: cubic-bezier(0.34, 1.56, 0.64, 1) 200ms; /* button press, toggles */
--spring-spatial-slow: cubic-bezier(0.16, 1, 0.3, 1) 400ms;   /* hero transitions, view morphs */

/* Effects springs (opacity, color, blur) */
--spring-effects:      cubic-bezier(0.2, 0, 0, 1) 250ms;      /* material transitions */
--spring-effects-fast: cubic-bezier(0.2, 0, 0, 1) 150ms;      /* hover, focus rings */

/* Canvas recession (material focus variation) */
--canvas-scale-receded: 0.97;
--canvas-opacity-receded: 0.85;
--canvas-blur-receded: 2px;

/* Sheet translation */
--sheet-translate-start: 100%;  /* ±100% depending on direction */
--sheet-translate-end: 0;

/* Command palette */
--palette-scale-start: 0.95;
--palette-scale-end: 1;

/* Reduced motion: all durations → 0.01ms (already in animation.css) */
```

### Transition Rules

| Trigger | Surface | Axes Used | Canvas Response | Spring Token |
|---------|---------|-----------|-----------------|-------------|
| Workspace switch (nav bar) | Canvas cross-fade | Z (scale) | Current→0.97+fade out, New→from 0.97+fade in | `--spring-spatial-slow` |
| Detail entry (card tap) | Canvas cross-fade | Z (scale) | Same as workspace switch | `--spring-spatial-slow` |
| Right-side action (⚙️👤) | Right Sheet | X (slide right→left) | scale(0.97) + opacity(0.85) + blur(2px) | `--spring-spatial` |
| Left-side action (🌱 chip) | Left Sheet | X (slide left→right) | scale(0.97) + opacity(0.85) + blur(2px) | `--spring-spatial` |
| Command palette (⌘K) | Center dialog | Z (scale from center) | scale(0.97) + opacity(0.85) | `--spring-spatial` |
| Mobile action | Bottom Sheet | Y (rise from bottom) | scale(0.97) + opacity(0.85) + blur(2px) | `--spring-spatial` |
| Any dismiss | Reverse of entry | Reverse | Restore: scale(1), opacity(1), blur(0) | `--spring-effects` |

All source-anchored: sheets open from the side where triggered. This extends to menus, toasts, and confirmations (see `language.md` § Source-Anchored Interactions).

---

## Z-Index Stack (updated from D49)

```
Z1: Ground        — #F7F7F7 background, dot-grid pattern
Z2: Canvas         — main content surface (white, rounded, elevated)
Z3: Chrome         — top axis (z-40), nav bar (z-30)
Z4: Sheets         — side/bottom sheets, command palette (z-50)
```

---

## Implementation Notes

### Canvas as a Physical Surface
The current `CockpitLayout.tsx` renders `<main>` as flex-1 with no distinct surface treatment. To achieve the spatial model, wrap content in a Canvas component:
```
<div className="canvas" style={{
  transform: `scale(${isSheetOpen ? 0.97 : 1})`,
  opacity: isSheetOpen ? 0.85 : 1,
  filter: isSheetOpen ? 'blur(2px)' : 'none',
  transition: 'all var(--spring-spatial)',
  borderRadius: '20px',
  background: '#FFFFFF',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
}}>
```

### Top Axis Transparency
Remove from `TopContextBar.tsx`:
- `bg-gradient-to-r from-primary-alpha-10/30 via-bg-soft to-bg-soft`
- `border-b border-stroke-sub`
Replace with: transparent background, floating elements only.

### Sheet Boundary Change
Current: `fixed inset-0 z-50` (full viewport)
New: bounded to content zone (`top: 56px`, `bottom: ~80px`, `left/right: 24px`)

### Canvas Transform Orchestration
Shared state (Zustand or context) tracking `isAnySheetOpen`. Canvas subscribes and applies transforms. Consider `useSheetOrchestrator` hook.

### View Transitions for Workspace Switching
The existing `view-transitions.css` has directional slides (`vt-slide-in-right`, `vt-slide-out-left`). The cross-fade + scale morph pattern replaces directional slides for workspace switching. Detail navigation uses the same pattern.

---

## Visual Design Layer

### Workspace Color Atmospheres

Each workspace tints the Z1 ground with a subtle radial gradient — felt more than seen. This is an instance of Warm Glass "Dynamic Garden Theming" (see `language.md` § Color Direction) — workspace atmospheres are the first implementation of context-derived color. Future: garden detail views could derive atmosphere from the garden's banner image.

The atmosphere transitions during workspace cross-fade morph using `--spring-spatial-slow`.

| Workspace | Color | Hex | Opacity | Feeling |
|-----------|-------|-----|---------|---------|
| Hub | Warm amber | `#F59E0B` | 4-6% | Morning sunlight, focused attention |
| Garden | Sage green | `#34D399` | 4-6% | Growth, vitality, brand softened |
| Community | Soft blue | `#60A5FA` | 4-6% | Trust, calm, governance |
| Actions | Earth terracotta | `#D97706` | 3-5% | Hands-on, craft, soil |

```css
.ground {
  background: #F7F7F7;
  background-image: radial-gradient(
    ellipse 80% 60% at 50% 40%,
    var(--workspace-atmosphere),
    transparent 70%
  );
  transition: background-image var(--spring-spatial-slow);
}
```

The atmosphere is visible in the 24px margins around the canvas — the spatial margins ARE the atmosphere window.

### Lift-and-Press Interaction Language

Every interactive element follows this spatial interaction language. **Warm Glass complement**: cards use lift-and-press (scale), buttons use shape morph (radius). Interactive cards get both. See `language.md` § Shape Morphing.

**Cards** (lift-and-press + shape morph complement):

| State | Scale | Shadow | Border | Radius | Spring Token |
|-------|-------|--------|--------|--------|-------------|
| Rest | `1.0` | `0 1px 3px rgba(0,0,0,0.04)` | `1px solid #E5E5E5` | `rounded-2xl` (16px, concentric) | — |
| Hover | `1.008` | `0 4px 16px rgba(31,193,107,0.10)` | `1px solid rgba(31,193,107,0.20)` | unchanged | `--spring-spatial-fast` |
| Focus | `1.0` | `0 0 0 3px rgba(31,193,107,0.20)` (ring) | same as rest | unchanged | `--spring-effects-fast` |
| Active | `0.985` | `0 1px 2px rgba(0,0,0,0.06)` | `1px solid rgba(31,193,107,0.30)` | tightens 2px (14px) | `--spring-spatial-fast` |
| Disabled | `1.0` | none | `1px solid #F0F0F0` | unchanged | — |

**Buttons** (shape morph, no scale):

| Size / Shape | Rest Radius | Press Radius | Spring Token |
|-------------|-------------|--------------|-------------|
| LG / Capsule (primary CTA, FAB) | `rounded-full` | `rounded-xl` (squircle) | `--spring-spatial-fast` |
| MD / Squircle (default) | `rounded-xl` | `rounded-lg` (tighter) | `--spring-spatial-fast` |
| SM / Squircle (toolbar, compact) | `rounded-xl` | `rounded-lg` (tighter) | `--spring-spatial-fast` |
| Icon / Capsule | `rounded-full` | squished toward square | `--spring-spatial-fast` |

Shape = emphasis hierarchy: capsule (pill) reads as primary, squircle reads as secondary. No color difference needed for hierarchy — shape alone communicates.

Green-tinted hover shadows (#1FC16B at 10%) create organic warmth — like sunlight through leaves.

### Status as Ambient Signal

Cards use a left-edge **status stripe** visible at a glance:

| Status | Stripe | Ambient Effect |
|--------|--------|---------------|
| Pending | 3px amber `#F59E0B` | Faint warm inner glow |
| Approved | 3px green `#1FC16B` | Subtle green shimmer |
| Rejected | 3px red `#FB3748` | Card slightly desaturated |
| Syncing | 3px pulsing amber | Left edge pulses (2s cycle) |
| On-chain | 3px solid green + chain icon | Fully saturated, permanent |

### Sync Indicator (Ambient Heartbeat)

The sync dot in the top axis:
- **Synced**: solid green dot, still
- **Syncing**: amber dot, gentle pulse (2s, opacity 0.6→1.0)
- **Offline**: hollow ring, muted gray, queued count beside it
- **Error**: red dot, single slow pulse

### Value Chain Dots (Mycelium Pattern)

Four small circles showing impact flow progression: `●●○○`

```
Submit → Verify → Assess → Fund
  ●         ●        ○       ○    (verified, awaiting assessment)
```

- Filled dots: completed stages (`#1FC16B` green)
- Empty dots: future stages (`#E5E5E5`)
- Current stage: pulsing dot (amber, same as sync pulse)
- Replaces progress bars with meaningful journey indicator

### Card Layouts by Workspace

Three layout styles mapped to content density:

**Layout A — Thumbnail + Text** (compact, scannable):
- Image: 64×64px rounded-lg
- Best for: Work Pipeline queue, Community members
- Shows 5-6 cards on screen

**Layout B — Hero Image** (visual, browseable):
- Image: full-width, 16:9, object-fit cover
- Best for: Actions Registry, Garden Gallery
- Each card is a visual postcard

**Layout C — Panoramic Strip** (immersive, journal-like):
- Image: full-width, 100-120px tall, gradient overlay bottom
- Best for: Garden Overview activity feed
- Title + metadata overlaid on gradient

| Workspace | Layout | Why |
|-----------|--------|-----|
| Work Pipeline | A (Thumbnail + Text) | Operators scan queue quickly — density matters |
| Garden Overview | C (Panoramic Strip) for activity, Stats grid for metrics | Activity feed is a garden journal |
| Community | A (Thumbnail + Text) for members, Stats for treasury | People-oriented — avatars as images |
| Actions Registry | B (Hero Image) | Visual catalog — each action is a seed packet |
| Garden Detail | B (Hero banner) + A (lists within tabs) | Hero for garden, compact for nested content |

### Visual-First Progressive Disclosure (Jarvis)

Images are first-class at every disclosure layer:

| Layer | Time | What Shows |
|-------|------|------------|
| Glance | <1s | Photo thumbnail + title + status stripe + value chain dots |
| Scan | 1-3s (hover/focus) | Person, place, domain chip, timestamp expand below |
| Engage | click | Canvas cross-fades to full detail (evidence gallery, review form) |
| Deep Dive | from detail | Sheet opens with audit trail, on-chain data, raw attestation |

### Sheet Widths (Variable by Content)

| Sheet | Width | Content Type |
|-------|-------|-------------|
| Settings (right) | ~45-50% of content zone | Sections: profile, theme, network, sync, disconnect |
| Review/Detail (right) | ~55-60% of content zone | Evidence, review form, submission data |
| Garden Context (left) | ~35-40% of content zone | Garden list, mini preview, quick stats |
| Command Palette (center) | 560px fixed | Search + results |

### Garden Journal Aesthetic (Regen Lens)

- Lead with the **action**, not the metric: "Planted 50 saplings" not "#147"
- Name the **person and place**, not the address: "Maria · Milpa Alta"
- **Value chain dots** instead of progress bars
- **Earth-toned domain icons** — organic style, not flat geometric
- **Squircle corners** throughout (12-24px radius)
- Natural light palette — no pure black, warm grays, primary green
- **No engagement gamification** — no streaks, no FOMO, no competitive leaderboards

---

## Workspace Structure

### Nav Bar Tabs

Renamed "Work" → **"Hub"** to avoid collision with "work" domain concept.

| Tab | Operator | Evaluator | Deployer |
|-----|----------|-----------|----------|
| Hub | ✓ Primary | ✓ Primary | ✓ |
| Garden | ✓ Settings, profile, bento | ✓ Garden context | ✓ |
| Community | ✓ Treasury, cookie jars, members | ✗ | ✓ |
| Actions | ✗ | ✗ | ✓ Platform-level |

### Hub — Pipeline Tabs

| Tab | Content | Operator | Evaluator | Badge |
|-----|---------|----------|-----------|-------|
| Review | Pending work to approve/reject | ✓ Primary | ✓ Can approve | Count (amber if stale) |
| Assess | Approved work needing assessment | Read-only | ✓ Primary | Count |
| Certify | Assessed work ready for minting | Read-only | ✓ Primary | Count |
| History | Completed + rejected (audit trail) | ✓ | ✓ | — |

### Context-Aware FAB

| Tab | FAB Action | Who Sees It |
|-----|-----------|-------------|
| Review | Submit Work (on behalf) | Operators |
| Assess | Create Assessment | Evaluators |
| Certify | Mint Hypercert | Evaluators |
| History | — (hidden) | — |

### Garden Workspace — Bento Layout

Visually-driven card grid. Tapping a card → opens sheet for editing.
- Operators: stats, settings, profile, domains, activity
- Evaluators: read-only stats, garden context for assessments

### Community Workspace — Bento Layout

Operator-only management surface:
- Cookie jars, treasury/vault, members, signal pools, yield
- Each card → sheet for actions

### Sheets vs. Dialogs

| Pattern | Entry | Size | Use When |
|---------|-------|------|----------|
| Sheet | Slides from edge (X) | 40-60% | Content-rich: detail views, forms, settings |
| Dialog | Scales from center (Z) | 400-500px | Confirmations, quick yes/no, destructive actions |

Both cause canvas recession. Rule: need canvas context → sheet. Simple yes/no → dialog.

---

## Warm Glass Quick Reference

This spatial architecture is the first consumer of the Warm Glass design language. Quick reference for implementation:

| Dimension | Cockpit Application |
|-----------|-------------------|
| **Shape** | Concentric nesting: sheets 20px (from 24px viewport - 4px). Cards 16px (from 20px panel - 4px). Capsule for primary buttons/FABs, squircle for secondary/toolbar. |
| **Motion** | Spring tokens: `--spring-spatial` for sheets/nav, `--spring-spatial-fast` for press/morph, `--spring-spatial-slow` for view transitions. Standard scheme default, Expressive for hero moments. |
| **Interaction** | Lift-and-press for cards (scale), shape morph for buttons (radius). Combined on interactive cards. Source-anchored: actions from trigger. |
| **Material** | Focus variation: canvas recedes on sheet open (material behavior, not just animation). Dimming for modal interruption, glass separation for parallel tasks. |
| **Color** | Workspace atmospheres = dynamic garden theming. Accent triad: green primary, amber secondary, blue tertiary. |
| **Navigation** | Symbol-first: icons in nav bar/toolbar, text via delayed tooltips. Group related actions on shared glass. |

Full spec: `.claude/skills/design/language.md`
