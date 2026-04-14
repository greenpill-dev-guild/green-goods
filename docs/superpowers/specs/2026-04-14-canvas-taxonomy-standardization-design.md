# Canvas Taxonomy Standardization

**Date:** 2026-04-14
**Scope:** Admin dashboard canvas architecture — structural taxonomy, responsive adaptation, animation system, and component cleanup
**Branch:** feature/admin-ui-revamp

## Problem

The admin dashboard's canvas/sheet system lacks a formal taxonomy. A single `SideSheet` component serves both left and right panels without semantic distinction. The gradient lives on `MainSheet` rather than the canvas. Sheet widths are hardcoded pixels. Animations use CSS cubic-bezier approximations instead of true physics. The deprecated `FloatingToolbar` is still exported. There is no grid-based layout — everything uses flex positioning.

## Design

### 1. Canvas Taxonomy

The canvas is a spatial surface that extends conceptually beyond the viewport. Elements live at their natural offscreen positions and animate into view.

#### Three Transparent Containers (structural, no visual presence)

**TopContainer** (`grid-area: top`)
- Height: 56px, sticky
- Left: Garden selector chip
- Center: Breadcrumb/title (mobile only, hidden on desktop)
- Right: Action icons with tooltips — Notifications, Settings, Account
- All action icons share identical styling

**CenterContainer** (spans `grid-area: left`, `main`, and `right` columns)
- The center row of the grid, `overflow: hidden`
- Houses LeftSheet, MainSheet, RightSheet as adjacent grid cells
- Extends conceptually beyond the viewport horizontally (sheets at width 0 are offscreen)
- On mobile: grid collapses to single column; FAB moves here (bottom-right of MainSheet)

**BottomContainer** (`grid-area: bottom`)
- `position: relative` — children use absolute positioning to float freely
- NavigationBar: absolute, centered, can overflow container bounds
- FAB (desktop): absolute, right-aligned to MainSheet edge

#### Three Surface Sheets (inside CenterContainer)

**LeftSheet**
- Width: `clamp(260px, 25vw, 360px)` — viewport-driven
- Surface: Glass floating (white/45% + blur 20px)
- Semantic role: Action-oriented — Submit Work, Create Assessment, Mint Hypercert, Work Detail
- Slides in from left edge on demand
- Mobile: becomes bottom drawer triggered by FAB

**MainSheet**
- Width: `1fr` — fills remaining space
- Surface: Glass (white/45% + blur 12px) — NOT gradient (canvas owns the gradient)
- Always visible, recedes when sheets open (scale down, blur, dim opacity)
- Never compresses horizontally

**RightSheet**
- Width: `clamp(220px, 20vw, 300px)` — viewport-driven
- Surface: Glass floating (white/45% + blur 20px)
- Semantic role: Config & alerts — tabbed panel with Notifications / Settings / Account
- Slides in from right edge on demand
- Mobile: splits — notifications become dialog off bell icon, settings/account embed in Profile view

#### Simultaneous Sheets

Left and right sheets can be open at the same time. MainSheet recedes further (deeper scale-down, more blur). Both sheets animate in parallel with independent springs.

### 2. Grid Layout

```css
.workspace-canvas {
  display: grid;
  grid-template-areas:
    "top    top    top"
    "left   main   right"
    "bottom bottom bottom";
  grid-template-rows: auto 1fr auto;
  grid-template-columns:
    var(--left-sheet-width, 0)   /* animated via react-spring */
    1fr
    var(--right-sheet-width, 0); /* animated via react-spring */
  background: var(--canvas-gradient);
}
```

The canvas root owns the gradient. All containers and sheets are transparent or glass, letting the gradient bleed through everything.

Sheet column widths are CSS custom properties driven by react-spring. When closed, they animate to `0`. When open, they animate to their `clamp()` value.

NavigationBar and FAB use `position: absolute` relative to the BottomContainer, allowing them to float outside container bounds as needed.

### 3. Surface Model

| Element | Background | Rationale |
|---------|-----------|-----------|
| Canvas (`.workspace-canvas`) | Gradient (white → warm neutral) | Single source of truth for color |
| TopContainer | Transparent | Canvas gradient shows through |
| BottomContainer | Transparent | Canvas gradient shows through |
| MainSheet | Glass (white/45% + blur 12px) | Semi-transparent, canvas bleeds through |
| LeftSheet | Glass floating (white/45% + blur 20px) | Same glass language |
| RightSheet | Glass floating (white/45% + blur 20px) | Same glass language |
| NavigationBar | Glass ground (white/85% + blur 8px) | Slightly more opaque for readability |

### 4. Animation System

**Dependencies:** `@react-spring/web` + `@use-gesture/react`

#### Spring Configs (shared tokens)

| Token | Mass | Tension | Friction | Use Case |
|-------|------|---------|----------|----------|
| `sheet` | 1 | 170 | 26 | Sheet open/close, MainSheet recession |
| `snappy` | 0.8 | 300 | 28 | FAB press, nav item tap, tooltips |
| `gentle` | 1.2 | 120 | 20 | Choreographed stagger, background blur |

#### Gesture-Driven Interactions

- **Sheet drag-dismiss:** Flick left to close LeftSheet, flick right to close RightSheet. Velocity threshold (~0.5px/ms) determines snap-back vs dismiss.
- **Mobile bottom drawer:** Drag handle with rubber-banding at extents, velocity-aware fling dismiss.
- **FAB long-press:** Speed dial fans out with staggered springs (each action offset ~30ms).

#### Choreography (`useChain`)

Sheet open sequence:
1. MainSheet recedes (scale, blur, opacity) — `sheet` spring
2. Sheet slides in from edge — `sheet` spring, 60ms delay
3. FAB repositions if needed — `snappy` spring, 120ms delay

Both-sheets-open: recession deepens, both sheets animate in parallel.

#### What Gets Replaced

| Current | Replacement |
|---------|-------------|
| `cubic-bezier(0.16, 1, 0.3, 1)` CSS transitions | `useSpring` with `sheet` config |
| `@keyframes modalSlideIn/Out` | `useSpring` + `useDrag` |
| `transition-delay` staggering | `useChain` with ref sequence |
| `--canvas-scale-receded` CSS vars | Animated spring values via `animated.div` |

### 5. FAB Behavior

- **Single action:** Distinct icon per action (not generic `+`), tooltip always visible on hover
- **Speed dial (multi-action):** Long-press or tap fans out action list with staggered springs, each action has its own icon and label
- **Positioning:**
  - Desktop: absolute in BottomContainer, right-aligned to MainSheet edge
  - Mobile: absolute in CenterContainer, bottom-right of MainSheet with safe-area margin
- **Tooltips required:** Since the FAB is dynamic and context-dependent, tooltips help users build a relationship with each FAB's purpose

### 6. Mobile Adaptation

**Breakpoint:** `<600px`

#### Grid Collapses

```css
@media (max-width: 599px) {
  .workspace-canvas {
    grid-template-areas:
      "top"
      "main"
      "bottom";
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr auto;
  }
}
```

#### Mapping

| Desktop | Mobile | Trigger |
|---------|--------|---------|
| LeftSheet: action flows (Submit Work, Create Assessment, Mint Hypercert) | Bottom drawer (ModalDrawer pattern) | FAB tap |
| RightSheet: Notifications | Dialog | Bell icon in TopContainer |
| RightSheet: Settings + Account | Tabs in Profile view | Nav bar "Profile" tab |
| TopContainer: Notifications, Settings, Account icons | Only Notifications bell remains | Automatic |
| TopContainer: no breadcrumb | Center breadcrumb/title slot | Automatic |
| FAB in BottomContainer | FAB in CenterContainer | Automatic at breakpoint |
| NavigationBar: centered pill | Full-width bar with safe-area inset | Automatic |
| LeftSheet: Work Detail | Full-page push navigation | Tap work item in list |

#### Bottom Drawer Spec (client ModalDrawer reference)

- Max height: `85dvh`
- Drag handle + rubber-banding via `useDrag`
- Velocity-aware fling dismiss
- Scrim: `black/30` + `blur(4px)`
- Spring animation with `sheet` config
- Focus trap + Escape dismiss
- Triggered by FAB — not persistent

### 7. Migration Scope

#### Components to Create

- **LeftSheet** — derived from current SideSheet, left-specific defaults (wider, action-oriented)
- **RightSheet** — derived from current SideSheet, right-specific defaults (narrower, tabbed: Notifications / Settings / Account)

#### Components to Refactor

- **CanvasLayout.tsx** — flex → CSS Grid with named areas, gradient moves to canvas root
- **MainSheet.tsx** — remove gradient, make glass surface
- **TopContextBar** → rename to **TopContainer**, add mobile breadcrumb slot, standardize action icons (Notifications, Settings, Account) with tooltips
- **NavigationBar** — position absolute relative to BottomContainer
- **FabContext** — add speed dial variant, tooltip requirement, responsive container switching
- **AccountSheet + AccountSurface** — merge into RightSheet tab system

#### Components to Remove

- **SideSheet** — replaced by LeftSheet + RightSheet
- **FloatingToolbar** — already deprecated, remove fully

#### New Dependencies

- `@react-spring/web`
- `@use-gesture/react`

#### CSS Changes

- Canvas gradient moves from MainSheet to `.workspace-canvas`
- Grid areas defined on canvas root
- Remove all `cubic-bezier` sheet transitions (replaced by react-spring)
- Glass utility classes remain; MainSheet switches from gradient to glass
