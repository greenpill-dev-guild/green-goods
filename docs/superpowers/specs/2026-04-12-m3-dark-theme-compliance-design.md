# M3 Dark Theme Compliance — Design Spec

**Date:** 2026-04-12
**Scope:** Admin dashboard dark mode, shared theme tokens, Canvas components
**Approach:** Token-first — fix CSS custom properties, minimal component changes

## Problem

The admin dashboard's dark mode does not follow Material Design 3's adaptive coloring system. Five specific gaps:

1. Dark surface container hierarchy is too spread out (neutral-600 for containerHighest ≈ M3 tone 34, ceiling should be tone 24)
2. surfaceContainerLowest maps to the same value as surface (both neutral-950)
3. primaryContainer uses a transparent alpha overlay instead of a solid tonal value
4. Glass tinting surfaces use light-mode hue colors (-500) regardless of theme
5. Some Canvas components use hardcoded `dark:` color classes instead of semantic tokens

## M3 Reference

M3 dark surfaces use tones from the Neutral palette in a tight range:

| M3 Role | Tone | Purpose |
|---------|------|---------|
| surfaceContainerLowest | 4 | Deepest background, behind everything |
| surface / surfaceDim | 6 | Page background |
| surfaceContainerLow | 10 | Side sheets, navigation drawers |
| surfaceContainer | 12 | Default cards, menus |
| surfaceContainerHigh | 17 | Dialogs, FABs, search bars |
| surfaceContainerHighest | 22 | Text fields, elevated chips |
| surfaceBright | 24 | Maximum surface prominence |

Primary color roles: primary uses tone 80 (light text on dark), primaryContainer uses tone 30 (solid deep color).

## Fix 1: New Neutral Palette Stops

Add 3 new stops to the warm stone neutral palette in `theme.css` `:root`:

| Stop | RGB | M3 Tone | Purpose |
|------|-----|---------|---------|
| `--neutral-975` | `8 7 6` | 4 | Below surface — deepest bg |
| `--neutral-925` | `22 20 18` | 10 | Between 950 and 900 — smooth step |
| `--neutral-775` | `50 46 43` | 24 | Brightest dark surface option |

All existing neutral stops remain unchanged. New stops follow the warm stone hue/saturation curve.

## Fix 2: Dark Mode Surface Remapping

In `theme.css` `:root[data-theme="dark"]`, remap the `--bg-*` semantic tokens:

| Semantic Token | Before | After |
|----------------|--------|-------|
| `--bg-white-0` (surface) | `neutral-950` | `neutral-950` (unchanged) |
| M3 surfaceContainerLowest | `neutral-950` (= surface) | `neutral-975` |
| `--bg-weak-50` (containerLow) | `neutral-850` | `neutral-925` |
| `--bg-soft-200` (container) | `neutral-800` | `neutral-900` |
| `--bg-sub-300` (containerHigh) | `neutral-700` | `neutral-850` |
| `--bg-surface-800` (containerHighest) | `neutral-600` | `neutral-800` |

Add new M3 tokens:
- `--m3-surface-dim: var(--bg-white-0)` (same as surface in baseline)
- `--m3-surface-bright: var(--neutral-775)`

Note: The `--bg-*` semantic tokens are the canonical layer. The `--m3-*` tokens are aliases that document the M3 relationship. Remapping `--bg-*` automatically fixes both.

### Impact on --bg-strong-950

`--bg-strong-950` (currently `neutral-100`) is used for highlights/hovers on dark surfaces. This is an inverse surface role, not part of the surface container ladder. It stays at `neutral-100` (unchanged).

## Fix 3: primaryContainer — Solid Tone

In `theme.css` dark overrides:

| Token | Before | After |
|-------|--------|-------|
| `--m3-primary-container` | `--green-alpha-24` | `--green-900` |
| `--m3-on-primary-container` | `--green-300` | `--green-100` |

M3 says primaryContainer in dark mode should be the Primary palette at tone 30 — a solid, deep, rich color. `--green-900` is the closest match in our palette. The alpha-based approach creates a transparent bleed effect that doesn't match M3's intent.

## Fix 4: Dark-Aware Glass Tinting

In `index.css`, the glass tinting rules use hardcoded hue colors:

```css
/* Before — always uses -500 regardless of theme */
[data-workspace="hub"] .glass-raised {
  background: color-mix(in srgb, rgb(var(--bg-white-0) / 70%) 92%, rgb(var(--blue-500)) 8%);
}
```

Change to use the workspace primary token, which already flips to `-200` in dark mode:

```css
/* After — respects theme via --ws-primary */
[data-workspace="hub"] .glass-raised {
  background: color-mix(in srgb, rgb(var(--bg-white-0) / 70%) 92%, rgb(var(--ws-primary)) 8%);
}
```

Apply to all 4 workspace glass rules (hub, garden, community, actions).

Similarly update the tab rail tint gradients to use dark-aware tokens.

## Fix 5: Hardcoded `dark:` Class Cleanup

Audit and fix Canvas components that use raw Tailwind dark colors instead of semantic tokens:

**Exact instances (exhaustive audit — no other Canvas files affected):**

1. `NavigationBar.tsx:271` — `dark:border-white/10 dark:bg-[linear-gradient(...)]`
   - Replace `dark:border-white/10` with `border-stroke-soft` (already theme-aware)
   - Replace `dark:bg-[linear-gradient(...)]` with semantic gradient using `--bg-*` tokens

2. `CanvasScaffold.tsx:161` — `dark:divide-white/5`
   - Replace `divide-black/5 dark:divide-white/5` with `divide-stroke-soft`

## Files Touched

| File | Changes |
|------|---------|
| `packages/shared/src/styles/theme.css` | New palette stops (fix 1), dark override remapping (fix 2), primaryContainer fix (fix 3), new M3 tokens (fix 2) |
| `packages/admin/src/index.css` | Glass tinting (fix 4), tab rail tinting (fix 4), expose new Tailwind tokens for neutral-975/925/775 if needed |
| `packages/shared/src/components/Canvas/*.tsx` | Hardcoded class cleanup (fix 5) |

## What Stays the Same

- **Light mode** — entirely untouched (all changes are in dark overrides or new palette stops)
- **Warm stone palette character** — new stops derived from same hue/saturation curve
- **Workspace tonal palettes** — already correct (primary flips to -200, container to -900)
- **Typography, shape, spacing** — no changes
- **Component structure** — no structural changes, only className/style adjustments

## Validation

1. `bun build` — verify no CSS parse errors
2. `bun lint` — verify no new lint warnings
3. `bun run test` — all existing tests pass
4. Visual verification in browser — toggle dark mode, check Hub view surface hierarchy, glass tinting, primaryContainer badges
5. Verify contrast ratios: onSurface on surface should be ≥ 4.5:1 (WCAG AA)
