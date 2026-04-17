# Admin Design System Alignment — Prompt Chain Spec

**Date:** 2026-04-15
**Status:** Spec
**Branch:** `feature/admin-ui-revamp`
**Approach:** Three-layer prompt chain (Foundation → Structure → Polish)

## Problem

The admin dashboard's design system has accumulated depth — M3 strict anatomy, Warm Earth spatial model, workspace tinting, spring motion, regenerative principles — but these layers haven't been unified into a single coherent system. Critical issues remain:

- **D1 (Critical):** Dual visual system — `canvas-route-shell` warm-earth treatment coexists with M3 solid surfaces on content areas
- **D2 (High):** AdminCard (M3 filled/elevated/outlined variants) exists but has zero consumers
- **D3 (High):** Duplicate view tree — `views/Gardens/Garden/` (18 files, old) vs `views/Garden/` (5 files, new)
- **A1 (High):** Hub monolith at 1375 LOC (~4.5x SRP violation)
- **12 audit items** from visual audit (margins, icons, tooltips, nav flash, sheet widths, etc.)
- **Missing documentation:** No canonical DESIGN.md, COPY_PROMPT.md, or per-package design briefs
- **Dark mode gaps:** Green-tinted elevation shadows incomplete, workspace atmospheres need tuning
- **Component coverage:** M3 components built but not fully adopted across all views

## Design Decision: D1 Resolution

**Glass on chrome, solid on content, atmosphere on canvas background.**

- Glass material (backdrop-filter + blur) stays ONLY on TopContextBar/AppBar (Z3 persistent chrome)
- All Z2 content surfaces (MainSheet, cards, list items, form sections) use solid M3 surfaces
- Canvas background (Z1 Ground) keeps atmospheric gradients for workspace identity
- Rationale: User feedback — "Mixing Material+Liquid caused 'AI slop.' Strict M3 anatomy, not hybrid."

## Architecture: Three-Layer Prompt Chain

Each layer builds on the prior layer's deliverables. Each layer's acceptance criteria become the next layer's prerequisites — a built-in regression gate.

```
Layer 1: Foundation (rules)
  ├── D1: Retire warm-earth from content surfaces
  ├── Write root DESIGN.md
  ├── Write packages/admin/DESIGN.md
  ├── Write COPY_PROMPT.md
  └── Dark mode polish pass
         │
         ▼ prerequisites verified
Layer 2: Structure (reorganize)
  ├── D3: Merge views/Gardens/ → views/Garden/
  ├── A1: Decompose Hub monolith (<300 LOC target)
  ├── D2: Adopt AdminCard across 3+ views
  └── Component coverage audit (Admin* adoption)
         │
         ▼ prerequisites verified
Layer 3: Polish (consistency)
  ├── Verify/fix all 12 audit items
  ├── Component coverage sweep (zero raw elements)
  ├── Visual consistency per workspace
  ├── Cross-cutting: dark mode, reduced motion, keyboard nav, empty states
  └── Coherence report
```

## Layer 1: Foundation

### Prompt

```markdown
# Admin Design System — Layer 1: Foundation

## Context
Branch: `feature/admin-ui-revamp`. The admin dashboard has a dual visual system
problem (D1): `canvas-route-shell` applies warm-earth treatment (blur, frosted
surfaces) to content areas, while `admin-m3-tokens.css` defines solid M3 surfaces.
This creates visual inconsistency. The decision: **glass on chrome only
(TopContextBar/AppBar), solid M3 on all content surfaces, atmospheric gradients
on the canvas background only.**

## Existing Specs (read before planning)
- `docs/superpowers/specs/2026-04-15-design-system-creative-briefs-design.md` —
  defines DESIGN.md structure, color vocabulary, typography, shape, motion
- `docs/superpowers/specs/2026-04-14-canvas-taxonomy-standardization-design.md` —
  canvas grid naming
- `docs/superpowers/specs/2026-04-12-m3-dark-theme-compliance-design.md` — dark
  mode tokens
- `.plans/active/admin-ui-revamp/artifacts/spatial-architecture.md` — three-body
  spatial model

## Deliverables

### 1. Resolve D1: Retire warm-earth from content surfaces
- In `packages/admin/src/index.css`, audit every `.canvas-route-shell`,
  `.glass-surface`, and any `backdrop-filter` usage on content surfaces
- Remove blur/frosted treatment from MainSheet, cards, list items, and all
  Z2 (Surface) elements
- Keep glass ONLY on TopContextBar/AppBar (Z3 chrome)
- Keep atmospheric gradients on the canvas background (Z1 Ground)
- Verify dark mode still works after removal

### 2. Write root `DESIGN.md`
- Follow the spec in `docs/superpowers/specs/2026-04-15-design-system-creative-briefs-design.md`
- Include: empathy statement, color hierarchy, typography, shape system, motion
  tokens, material thickness rules, elevation, regenerative constraints, do/don't
- This is a lossy export for external AI tools — it does NOT replace skill files

### 3. Write `packages/admin/DESIGN.md`
- Admin cockpit creative brief: M3 strict anatomy, Plus Jakarta Sans, solid
  surfaces, workspace tinting, CanvasLayout structure
- Component inventory: list all 13 Admin* components with their M3 roles
- Stable prompt core for Stitch/AI tools
- Never/always lists specific to admin

### 4. Write `COPY_PROMPT.md`
- Voice/tone guide: utility copy, no marketing language in admin
- Per-surface copy patterns (workspace headers, empty states, error messages,
  tooltips, button labels)
- Word list: preferred terms from glossary (`docs/docs/glossary.md`)

### 5. Dark mode polish pass
- Ensure green-tinted elevation shadows per
  `docs/superpowers/specs/2026-04-12-m3-dark-theme-compliance-design.md`
- Verify workspace atmosphere adjusts saturation for dark backgrounds
- Check all semantic tokens have dark variants in `admin-m3-tokens.css`

## Approach
Use `/plan` to create a detailed plan first. Get my approval before executing.

## Acceptance Criteria
- Zero `backdrop-filter` on any Z2 surface in admin CSS
- Glass treatment only on `.top-context-bar` / AppBar
- All three doc files written and committed
- `bun format && bun lint && bun run test` passes
- Dark mode: no contrast violations, green-tinted shadows visible
```

## Layer 2: Structure

### Prompt

```markdown
# Admin Design System — Layer 2: Structure

## Context
Branch: `feature/admin-ui-revamp`. Layer 1 (foundation) is complete — D1 resolved,
DESIGN.md files written, dark mode polished. This layer restructures the admin
codebase: merging the old view tree, decomposing the Hub monolith, and adopting
AdminCard across views.

## Prerequisites (verify before planning)
- `DESIGN.md`, `packages/admin/DESIGN.md`, `COPY_PROMPT.md` exist
- No `backdrop-filter` on Z2 surfaces
- Tests pass: `bun run test`

## Existing Specs (read before planning)
- `packages/admin/DESIGN.md` — canonical admin design rules (from Layer 1)
- `docs/superpowers/specs/2026-04-14-admin-ui-audit-fixes-design.md` — 12 audit
  issues with designed solutions
- `docs/superpowers/specs/2026-04-13-admin-m3-component-compliance-design.md` —
  M3 component anatomy

## Deliverables

### 1. D3: Merge `views/Gardens/` into `views/Garden/`
The old view tree lives at `packages/admin/src/views/Gardens/Garden/` (18 files).
The new structure is `packages/admin/src/views/Garden/` (5 files).

- Migrate all functionality from `views/Gardens/Garden/*` into `views/Garden/`
- Move `views/Gardens/CreateGarden.tsx` to an appropriate location
- Delete the entire `views/Gardens/` directory when complete
- Update all imports and route definitions in the router
- Fix the 12 cross-tree imports that currently bridge the two directories
- Preserve all existing functionality — this is a file reorganization, not a rewrite

### 2. A1: Decompose Hub monolith
`packages/admin/src/views/Hub/index.tsx` is 1375 LOC — ~4.5x SRP violation.

Decompose into focused modules. Likely extraction targets:
- Work item list/table component
- Filter/sort toolbar logic
- Batch approval flow
- Work detail panel/sheet content
- Hub-specific hooks or helpers

Rules:
- ALL hooks must stay in or move to `@green-goods/shared` (hook boundary rule)
- View files should be composition of components, not logic
- Each extracted file should have a single clear responsibility
- Target: no file over ~300 LOC

### 3. D2: Adopt AdminCard across views
`AdminCard` exists (`packages/admin/src/components/AdminCard.tsx`) with M3
filled/elevated/outlined variants but has zero consumers.

- Audit every view for card-like surfaces (divs with rounded corners + shadows
  + padding that act as cards)
- Replace ad-hoc card markup with `<AdminCard>` using the appropriate variant
- Choose variants intentionally:
  - `filled` — default content cards (surface-container-lowest)
  - `elevated` — interactive/clickable cards (surface + shadow)
  - `outlined` — form sections, secondary groupings (outline-variant border)
- Do NOT adopt AdminCard inside shared components — admin-only

### 4. Component coverage audit
Review all 13 Admin* components for adoption gaps:
- `AdminButton` — used everywhere? Any raw `<button>` remaining?
- `AdminTextField` — any raw `<input>` in admin views?
- `AdminListItem` — any hand-rolled list rows?
- `AdminDialog` — any remaining Radix Dialog imports?
- `AdminBadge`, `AdminFilterChip`, `AdminTooltip` — adopted where appropriate?

Replace ad-hoc markup with the M3 components where they fit.

## Approach
Use `/plan` to create a detailed plan first. Get my approval before executing.

## Acceptance Criteria
- `views/Gardens/` directory deleted, all content lives under `views/Garden/`
- Zero broken imports — `bun build` succeeds
- Hub/index.tsx under 300 LOC
- AdminCard has consumers in at least 3 views
- No raw `<button>` or `<input>` in admin view files (shared form primitives
  from `@green-goods/shared` are exempt — they wrap inputs internally)
- No direct Radix Dialog imports in admin (use AdminDialog)
- `bun format && bun lint && bun run test` passes
- All existing routes still work (no 404s)
```

## Layer 3: Polish

### Prompt

```markdown
# Admin Design System — Layer 3: Polish

## Context
Branch: `feature/admin-ui-revamp`. Layers 1-2 are complete — design system
documented, D1 resolved (glass on chrome only), view tree merged (Gardens → Garden),
Hub decomposed, AdminCard adopted across views. This final layer sweeps for visual
consistency, fixes the 12 audit items, and validates the unified system.

## Prerequisites (verify before planning)
- `DESIGN.md`, `packages/admin/DESIGN.md`, `COPY_PROMPT.md` exist
- `views/Gardens/` directory does not exist
- Hub/index.tsx is under 300 LOC
- AdminCard has consumers in 3+ views
- Tests pass: `bun run test`

## Existing Specs (read before planning)
- `docs/superpowers/specs/2026-04-14-admin-ui-audit-fixes-design.md` — 12 issues
  with designed solutions (responsive sheet widths, MainSheet gutters, icon
  consistency, tooltips, nav flash fix, empty state, etc.)
- `packages/admin/DESIGN.md` — canonical admin design rules

## Deliverables

### 1. Verify and fix all 12 audit items
Read the audit spec and verify each fix. For items already resolved in Layer 2
restructuring, confirm no regressions. For items not yet addressed, implement
the designed solutions:

| # | Issue | Check |
|---|-------|-------|
| 1 | MainSheet full-width, no gutter | Should have `mx-4 max-w-[1400px]` |
| 2 | Action icons inconsistent | All TopContextBar icons same style (no avatar in icon row) |
| 3 | Hover animation harsh rectangle | Rounded hover states matching M3 shape tokens |
| 4 | No tooltips on action icons | `AdminTooltip` wrapping all TopContextBar action buttons |
| 5 | Nav bar flash on load | Visibility gated on `permissions.isLoading` |
| 6 | No creation path when no garden | Empty state with "Create Garden" CTA |
| 7 | No bottom padding when nav hidden | Conditional padding when NavigationBar absent |
| 8 | RightSheet too narrow | `clamp(320px, 28vw, 480px)` via CSS custom property |
| 9 | Profile tabs on desktop | Mobile-only rendering for Account/Settings tabs |
| 10 | Tab labels wrong | "Profile" → "Account" |
| 11 | Sheet content styling poor | M3 surface treatment, clear button hierarchy |
| 12 | Notifications placeholder | Proper empty state with icon + message |

### 2. Component coverage sweep
After Layer 2 adopted AdminCard and audited component usage, do a final sweep:
- `grep -r '<button' packages/admin/src/views/` — any raw buttons remaining?
- `grep -r '<input' packages/admin/src/views/` — any raw inputs?
- `grep -r '@radix-ui/react-dialog' packages/admin/src/` — any Radix Dialog?
- `grep -r 'backdrop-filter' packages/admin/src/` — any glass on content?
- Every interactive element should use an Admin* M3 component

### 3. Visual consistency validation
Walk through each workspace and verify:
- **Hub** (blue tint): workspace atmosphere renders, tabs use AdminTabRail,
  lists use AdminListItem, cards use AdminCard
- **Garden** (green tint): overview/impact/settings tabs consistent, all
  panels use AdminCard, forms use AdminTextField
- **Community** (orange tint): member list uses AdminListItem, role badges
  use AdminBadge
- **Actions** (red tint): wizard steps consistent, instruction builder
  uses AdminCard sections
- **Home** (stone/neutral): unauthenticated state renders correctly

### 4. Cross-cutting checks
- Dark mode: toggle and verify every view — no white flashes, shadows
  have green tint, workspace atmospheres adjust
- Reduced motion: verify `prefers-reduced-motion` disables all spring
  animations and view transitions
- Keyboard navigation: Tab through every view — focus rings visible,
  Escape closes sheets, ⌘K opens command palette
- Empty states: every view with data has a meaningful empty state

### 5. Design system coherence report
After all fixes, produce a brief report (output in chat, don't create a file):
- Remaining design debt (if any)
- Components still not adopted
- Views that need further attention
- Recommendation for next iteration

## Approach
Use `/plan` to create a detailed plan first. Get my approval before executing.

## Acceptance Criteria
- All 12 audit items verified fixed with no regressions
- Zero raw `<button>`, `<input>`, `@radix-ui/react-dialog`, or
  `backdrop-filter` on content surfaces in admin views
- All 5 workspaces visually consistent (same component vocabulary)
- Dark mode clean across all views
- Reduced motion and keyboard navigation functional
- `bun format && bun lint && bun run test && bun build` passes
- Coherence report delivered
```

## Execution Order

1. **Layer 1** — Start here. Establishes rules everything else references.
2. **Layer 2** — Only after Layer 1 passes all acceptance criteria.
3. **Layer 3** — Only after Layer 2 passes all acceptance criteria.

Each layer is a separate Claude Code session. Paste the prompt, let it plan, approve, execute.

## Related Specs
- `2026-04-15-design-system-creative-briefs-design.md` — DESIGN.md content structure
- `2026-04-14-admin-ui-audit-fixes-design.md` — 12 audit item solutions
- `2026-04-14-canvas-taxonomy-standardization-design.md` — canvas grid naming
- `2026-04-13-admin-m3-component-compliance-design.md` — M3 component anatomy
- `2026-04-12-m3-dark-theme-compliance-design.md` — dark mode tokens
- `2026-04-12-admin-m3-liquid-polish-design.md` — spring tokens, motion specs
