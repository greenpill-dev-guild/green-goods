# Figma Make Prompts — Phase 1: Spatial States

**Created**: 2026-04-07
**Purpose**: 7 frames establishing the spatial choreography of the admin cockpit
**Tool**: Figma Make (Claude Sonnet 4)
**Strategy**: One screen per prompt, placeholder content, focus on layers/depth/motion

## Delivery Order

1. Frame 1 (Desktop Resting) — establishes the cockpit feel
2. Frame 2 (Right Sheet) — validates no-scrim depth separation
3. Frame 3 (Left Sheet) — validates spatial origin rule
4. Frame 4 (Workspace Transition) — captures cross-fade morph
5. Frame 5 (Command Palette) — center-scale pattern
6. Frame 6 (Mobile Resting) — compact viewport adaptation
7. Frame 7 (Mobile Bottom Sheet) — Y-axis entry within content zone

After each frame, review and iterate prompt language before proceeding.

---

## Frame 1 — Desktop Resting State

```
Frame: 1440×900px. This is a spatial UI architecture wireframe showing the resting state of a cockpit-style dashboard. Material Design 3. Light mode.

Background: #F7F7F7 (soft warm gray, the Z1 ground layer).

TOP AXIS (Z3, floating, NO background, NO border):
- This is NOT a traditional app bar. It's a set of floating elements with no background color, no border, no shadow. The ground (#F7F7F7) is visible behind and between them.
- Left side, 24px from left, 16px from top: a pill chip 36px tall, background rgba(31,193,107,0.10), border-radius 9999px, 12px padding. Inside: green circle 16px + "Context" 14px semibold #171717 + chevron 12px. This is the left-side trigger.
- Right side, 24px from right, 16px from top, 12px gap: green dot 8px (sync), icon circle 40px #F5F5F5 with icon, icon circle 40px #F5F5F5 with gear icon, avatar circle 32px. These are right-side triggers.

CANVAS (Z2, the main content surface):
- Position: 24px from left, 64px from top (below top axis), 24px from right, 96px from bottom (above nav zone).
- A large rounded rectangle: border-radius 20px, background #FFFFFF, box-shadow 0 1px 3px rgba(0,0,0,0.04).
- Inside the canvas: show 3 placeholder content blocks to represent workspace content:
  - Top block: 100% width, 48px tall, border-radius 12px, background #F5F5F5. Represents page header.
  - Middle block: 100% width, 36px tall, border-radius 9999px, background #F5F5F5. Represents segmented controls.
  - Lower section: 3 columns of placeholder cards, each 200px tall, border-radius 12px, background #F5F5F5, 12px gap. Represents content grid.
- Label outside frame: "Z2 — Canvas (resting: scale 1, opacity 1)"

NAVIGATION BAR (Z3, floating glass):
- Centered horizontally, 16px from bottom edge of frame.
- Pill: 400px wide, 56px tall, border-radius 9999px, background rgba(247,247,247,0.95), backdrop-blur effect (show as slightly frosted), box-shadow 0 12px 40px rgba(0,0,0,0.12), ring 1px rgba(0,0,0,0.04).
- Inside: 4 placeholder items evenly spaced. First item has a green (#1FC16B) pill indicator behind it.
- Label outside frame: "Z3 — Nav Bar (glass, persistent)"

Outside the frame, add annotation labels:
- Top: "Z3 — Top Axis (transparent, no background)"
- Center: "Z2 — Canvas (main content surface)"
- Bottom: "Z3 — Nav Bar (glass, always visible)"
- Corner: "Ground: Z1 #F7F7F7"

Clean, spatial, minimal. The canvas should feel like a physical surface floating above the ground. No heavy borders or shadows — just enough elevation to separate from background.
```

---

## Frame 2 — Right Sheet Open

```
Frame: 1440×900px. Spatial UI architecture wireframe showing a RIGHT SHEET open within the cockpit. Material Design 3. Light mode.

Background: #F7F7F7.

TOP AXIS (Z3, same as Frame 1): Floating elements, no background. Left chip, right icons. Fully visible and interactive — the sheet does NOT cover the top axis.

CANVAS (Z2, RECEDED STATE):
- Same position as Frame 1 (24px margins, 64px top, 96px bottom).
- BUT now transformed: show visually smaller (as if scale 0.97 applied), slightly faded (opacity ~85%), and slightly blurred.
- To represent this in Figma: make the canvas rectangle slightly smaller (shrink by ~1.5% each dimension), lower its opacity to 85%, and use a very subtle blur or desaturated placeholder blocks inside.
- The same placeholder content blocks from Frame 1 but faded/smaller.
- Label: "Z2 — Canvas (receded: scale 0.97, opacity 0.85, blur 2px)"
- NO dark overlay, NO scrim rectangle on top of canvas. The scale + opacity + blur IS the depth separation.

RIGHT SHEET (Z4):
- Positioned within the content zone: top = 64px from frame top, bottom = 96px from frame bottom, right = 24px from frame right.
- Width: 400px. Height: fills content zone (740px).
- Border-radius: 20px on left corners only (rounded-l-[20px]), 0 on right (flush with right margin).
- Background: #FFFFFF.
- Box-shadow on left edge: -8px 0 24px rgba(0,0,0,0.08) (shadow falls onto the receded canvas).
- Inside: placeholder content blocks (3-4 horizontal rows, each 48px tall, border-radius 8px, #F5F5F5) to represent sheet content. No specific UI elements.
- Label: "Z4 — Right Sheet (slides from X+, shadow provides edge separation)"

Arrow annotation showing motion: "← slides in from right (300ms spring)"
Arrow annotation on canvas: "canvas recedes (scale 0.97, no scrim)"

NAV BAR (Z3): Same as Frame 1. Still visible below both canvas and sheet. Persistent.

Key callout annotation: "Sheet bounded by cockpit chrome — top axis and nav bar always visible"
```

---

## Frame 3 — Left Sheet Open

```
Frame: 1440×900px. Spatial UI architecture wireframe showing a LEFT SHEET open. Material Design 3. Light mode.

Background: #F7F7F7.

TOP AXIS (Z3): Same floating elements. Visible.

CANVAS (Z2, RECEDED): Same receded state as Frame 2 — scale 0.97, opacity 85%, blurred. Positioned slightly right of center (pushed by left sheet presence).

LEFT SHEET (Z4):
- Content zone bounds: top 64px, bottom 96px from frame edges, LEFT = 24px from frame left.
- Width: 360px. Height: fills content zone.
- Border-radius: 20px on RIGHT corners only (rounded-r-[20px]).
- Background: #FFFFFF.
- Box-shadow on right edge: 8px 0 24px rgba(0,0,0,0.08).
- Placeholder content inside: a list of 4-5 items (48px tall rows, border-radius 8px, #F5F5F5).
- Label: "Z4 — Left Sheet (slides from X-, triggered by left-side action)"

Arrow: "slides in from left →"

NAV BAR (Z3): Persistent, same position.

Annotation: "Left sheet triggered by garden chip (left side of top axis) — spatial continuity"
```

---

## Frame 4 — Workspace Transition Mid-Morph

```
Frame: 1440×900px. Spatial UI wireframe showing a WORKSPACE TRANSITION in progress — the moment between two workspaces during a cross-fade + scale morph. Material Design 3. Light mode.

Background: #F7F7F7.

TOP AXIS (Z3): Same. No change during transitions.

CONTENT ZONE — show TWO overlapping canvases to represent the mid-transition:

OUTGOING CANVAS (fading out):
- Same canvas rectangle but at ~50% opacity, scale ~0.985 (between 1.0 and 0.97).
- Placeholder blocks visible but ghosted.
- Label: "Outgoing canvas — fading out, scaling to 0.97"

INCOMING CANVAS (fading in):
- Same canvas rectangle, overlapping the outgoing, at ~50% opacity, scale ~0.985 (between 0.97 and 1.0).
- DIFFERENT placeholder blocks (e.g., 2-column grid instead of 3-column) to show it's different content.
- Label: "Incoming canvas — fading in, scaling from 0.97 to 1.0"

The two canvases should visually overlap with the outgoing slightly behind (lower opacity) and incoming slightly in front.

NAV BAR (Z3): Persistent. Show the active indicator MOVING between two items (halfway between "Work" and "Garden" positions) to represent the transition.

Annotations:
- "Cross-fade + scale morph (300ms spring)"
- "Nav bar indicator animates independently"
- "No directional slide — depth-only transition"
- "Same pattern for workspace switch AND detail navigation"
```

---

## Frame 5 — Command Palette

```
Frame: 1440×900px. Spatial UI wireframe showing the COMMAND PALETTE open. Material Design 3. Light mode.

Background: #F7F7F7.

TOP AXIS (Z3): Visible.

CANVAS (Z2, RECEDED): scale 0.97, opacity 85%. Same treatment as sheet states.

COMMAND PALETTE (Z4, centered):
- Centered horizontally and vertically within the content zone.
- Width: 560px. Height: auto (roughly 400px).
- Border-radius: 24px all corners.
- Background: #FFFFFF.
- Box-shadow: 0 20px 40px rgba(0,0,0,0.12) (strong elevation — highest in the system).
- Inside: placeholder blocks — one 48px row at top (represents search input), a divider line, then 6-7 rows of 40px placeholder items grouped in 2-3 sections.
- Label: "Z4 — Command Palette (scales from 0.95→1.0 + fade, centered in content zone)"

Arrow annotations: "scales from center (Z axis)" with arrows pointing outward from center.

NAV BAR (Z3): Visible.

Annotation: "Canvas recedes same as sheet state — consistent depth language"
```

---

## Frame 6 — Mobile Resting State

```
Frame: 375×812px. Spatial UI wireframe showing MOBILE resting state. Material Design 3. Light mode.

Background: #F7F7F7.

TOP AXIS (Z3, floating, transparent):
- Left: pill chip 32px tall, 12px from left, 12px from top. Green-tinted bg, text "Context".
- Right: 12px from right, avatar 28px + gear icon 36px.
- NO background, NO border. Ground shows through.

CANVAS (Z2):
- Position: 12px from left, 52px from top, 12px from right, 84px from bottom.
- Rounded rectangle: border-radius 16px, background #FFFFFF, subtle shadow.
- Inside: placeholder blocks scaled for mobile:
  - Header block: full width, 40px, rounded-8px, #F5F5F5.
  - Segmented control: full width, 32px, rounded-9999px, #F5F5F5.
  - 2 placeholder cards stacked, each full width, 140px, rounded-12px, #F5F5F5, 8px gap.
- Label: "Z2 — Canvas (mobile, full width)"

NAV BAR (Z3):
- Full width (375px), 64px tall + 16px safe area = 80px total. Fixed to bottom.
- Background: frosted glass (rgba(247,247,247,0.95) + blur indication).
- Border-radius: 16px top corners.
- 4 items evenly spaced, first has green indicator.
- Label: "Z3 — Nav Bar (full-width, glass, safe area)"

Annotations: "Same Z-layer model as desktop, adapted to compact viewport"
```

---

## Frame 7 — Mobile Bottom Sheet

```
Frame: 375×812px. Spatial UI wireframe showing a BOTTOM SHEET open on mobile. Material Design 3. Light mode.

Background: #F7F7F7.

TOP AXIS (Z3): Same as Frame 6. Visible above everything.

CANVAS (Z2, RECEDED):
- Same position as Frame 6 but visually smaller (scale 0.97), faded (opacity 85%), blurred.
- Label: "Canvas receded — scale 0.97, opacity 0.85, blur 2px, no scrim"

BOTTOM SHEET (Z4):
- Rises from above the nav bar zone. Sheet bottom = 84px from frame bottom (above nav).
- Sheet height: ~500px (roughly 60% of content zone).
- Full width of content zone: 12px from left, 12px from right (351px).
- Border-radius: 20px top corners.
- Background: #FFFFFF.
- Box-shadow: 0 -8px 24px rgba(0,0,0,0.08) (shadow falls upward onto canvas).
- Top: drag handle centered — 32px wide, 4px tall, border-radius 9999px, #D4D4D4.
- Inside: 4-5 placeholder rows.
- Label: "Z4 — Bottom Sheet (slides from Y+, within content zone)"

Arrow: "↑ rises from bottom (300ms spring)"

NAV BAR (Z3): Visible below the sheet. Persistent.

Annotation: "Sheet respects cockpit chrome — top axis AND nav bar stay visible and interactive"
```

---

## Phase 2 Prompts (after spatial states validated)

Once these 7 frames feel right, Phase 2 fills the containers:
1. Work Pipeline canvas content
2. Garden Overview canvas content
3. Community canvas content
4. Actions Registry canvas content
5. Settings right sheet content
6. Garden context left sheet content
7. Command palette with real results
8. Connect Wallet (non-auth state)
9. Empty state (no gardens)
10. Garden Selection state
11. Garden Detail (tabbed)
12. Work Review (2-column detail)
