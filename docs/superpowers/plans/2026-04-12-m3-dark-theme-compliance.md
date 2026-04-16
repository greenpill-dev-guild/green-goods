# M3 Dark Theme Compliance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align admin dark mode with Material Design 3's adaptive coloring by fixing the surface container hierarchy, primaryContainer, glass tinting, and hardcoded dark classes.

**Architecture:** Token-first approach — fix CSS custom properties in theme.css and index.css so components that consume semantic tokens get the fix automatically. Only touch component files for 2 hardcoded `dark:` class instances.

**Tech Stack:** CSS custom properties, Tailwind CSS v4, `color-mix()` for glass tinting

**Spec:** `docs/superpowers/specs/2026-04-12-m3-dark-theme-compliance-design.md`

---

### Task 1: Add New Neutral Palette Stops

**Files:**
- Modify: `packages/shared/src/styles/theme.css:125-138`

- [ ] **Step 1: Add 3 new neutral stops to the warm stone palette**

In `packages/shared/src/styles/theme.css`, find the neutral palette block (line 125). Add `neutral-975`, `neutral-925`, and `neutral-775` in numeric order among existing stops:

```css
  /* Neutral — Stone (warm gray with earthy undertone) */
  --neutral-975: 8 7 6;
  --neutral-950: 12 10 9;
  --neutral-925: 22 20 18;
  --neutral-900: 28 25 23;
  --neutral-850: 35 32 30;
  --neutral-800: 41 37 36;
  --neutral-775: 50 46 43;
  --neutral-700: 68 64 60;
```

These 3 new values maintain the warm stone hue/saturation curve. Existing stops are untouched.

- [ ] **Step 2: Verify CSS parses cleanly**

Run: `cd packages/shared && bunx postcss src/styles/theme.css --no-map -o /dev/null 2>&1 || echo "CSS parse error"`

Expected: No output (clean parse). If postcss isn't configured standalone, skip and rely on build step in Task 5.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/styles/theme.css
git commit -m "feat(shared): add neutral-975, neutral-925, neutral-775 palette stops for M3 dark surface ladder"
```

---

### Task 2: Remap Dark Mode Surface Tokens + Add M3 surfaceDim/surfaceBright

**Files:**
- Modify: `packages/shared/src/styles/theme.css:500-507` (dark bg overrides)
- Modify: `packages/shared/src/styles/theme.css:586-605` (dark M3 aliases)

- [ ] **Step 1: Remap dark mode --bg-* semantic tokens**

In `packages/shared/src/styles/theme.css`, find the dark theme block at line 500. Replace the background section:

Old (lines 501-507):
```css
  /* Backgrounds - proper dark mode hierarchy with clear card elevation */
  --bg-white-0: var(--neutral-950);      /* 23 23 23 - page background (darkest) */
  --bg-weak-50: var(--neutral-850);      /* 35 35 35 - card surfaces (visibly lighter) */
  --bg-soft-200: var(--neutral-800);     /* 41 41 41 - elevated cards/surfaces */
  --bg-sub-300: var(--neutral-700);      /* 51 51 51 - more elevated elements */
  --bg-surface-800: var(--neutral-600);  /* 92 92 92 - prominent surfaces */
  --bg-strong-950: var(--neutral-100);   /* 245 245 245 - highlights/hovers */
```

New:
```css
  /* Backgrounds — M3-aligned dark surface ladder (tones 6→22, ceiling at 24) */
  --bg-white-0: var(--neutral-950);      /* 12 10 9  — surface / surfaceDim (tone 6) */
  --bg-weak-50: var(--neutral-925);      /* 22 20 18 — surfaceContainerLow (tone 10) */
  --bg-soft-200: var(--neutral-900);     /* 28 25 23 — surfaceContainer (tone 12) */
  --bg-sub-300: var(--neutral-850);      /* 35 32 30 — surfaceContainerHigh (tone 17) */
  --bg-surface-800: var(--neutral-800);  /* 41 37 36 — surfaceContainerHighest (tone 22) */
  --bg-strong-950: var(--neutral-100);   /* 245 245 244 — inverse surface (unchanged) */
```

- [ ] **Step 2: Fix M3 aliases — add surfaceContainerLowest, surfaceDim, surfaceBright**

In the same file, find the dark mode M3 aliases block at line 586. Replace it:

Old (lines 586-605):
```css
  /* Material 3 role aliases - documentation layer only */
  --m3-surface: var(--bg-white-0);
  --m3-surface-container-lowest: var(--bg-white-0);
  --m3-surface-container-low: var(--bg-weak-50);
  --m3-surface-container: var(--bg-soft-200);
  --m3-surface-container-high: var(--bg-sub-300);
  --m3-surface-container-highest: var(--bg-surface-800);
  --m3-on-surface: var(--text-strong-950);
  --m3-on-surface-variant: var(--text-sub-600);
  --m3-outline: var(--stroke-sub-300);
  --m3-outline-variant: var(--stroke-soft-200);
  --m3-primary: var(--primary-base);
  --m3-on-primary: var(--primary-foreground);
  --m3-primary-container: var(--green-alpha-24);
  --m3-on-primary-container: var(--green-300);
  --m3-error: var(--error-base);
  --m3-on-error: var(--neutral-950);
  --m3-state-hover: var(--primary-alpha-10);
  --m3-state-focus: var(--primary-alpha-16);
  --m3-state-pressed: var(--primary-alpha-24);
```

New:
```css
  /* Material 3 role aliases — dark mode overrides */
  --m3-surface: var(--bg-white-0);
  --m3-surface-dim: var(--bg-white-0);
  --m3-surface-bright: var(--neutral-775);
  --m3-surface-container-lowest: var(--neutral-975);
  --m3-surface-container-low: var(--bg-weak-50);
  --m3-surface-container: var(--bg-soft-200);
  --m3-surface-container-high: var(--bg-sub-300);
  --m3-surface-container-highest: var(--bg-surface-800);
  --m3-on-surface: var(--text-strong-950);
  --m3-on-surface-variant: var(--text-sub-600);
  --m3-outline: var(--stroke-sub-300);
  --m3-outline-variant: var(--stroke-soft-200);
  --m3-primary: var(--primary-base);
  --m3-on-primary: var(--primary-foreground);
  --m3-primary-container: var(--green-900);
  --m3-on-primary-container: var(--green-100);
  --m3-error: var(--error-base);
  --m3-on-error: var(--neutral-950);
  --m3-state-hover: var(--primary-alpha-10);
  --m3-state-focus: var(--primary-alpha-16);
  --m3-state-pressed: var(--primary-alpha-24);
```

Key changes: `surfaceContainerLowest` → `neutral-975` (not same as surface), added `surfaceDim` and `surfaceBright`, `primaryContainer` → `green-900` (solid tone 30), `onPrimaryContainer` → `green-100`.

- [ ] **Step 3: Also add surfaceDim and surfaceBright to the LIGHT mode M3 aliases**

In the light mode M3 aliases block (line 431), add the two missing tokens after `--m3-surface`:

Old (lines 431-432):
```css
  --m3-surface: var(--bg-white-0);
  --m3-surface-container-lowest: var(--bg-white-0);
```

New:
```css
  --m3-surface: var(--bg-white-0);
  --m3-surface-dim: var(--neutral-200);
  --m3-surface-bright: var(--bg-white-0);
  --m3-surface-container-lowest: var(--bg-white-0);
```

In M3 light mode, surfaceDim is tone 87 (a slightly dimmed white) and surfaceBright equals surface (tone 98). `neutral-200` (231,229,228) approximates tone 87.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/styles/theme.css
git commit -m "fix(shared): remap dark mode surface tokens to M3 tonal ladder and fix primaryContainer"
```

---

### Task 3: Fix Dark-Aware Glass Tinting

**Files:**
- Modify: `packages/admin/src/index.css:397-429`

- [ ] **Step 1: Replace hardcoded hue in glass tinting rules**

In `packages/admin/src/index.css`, find the glass tinting block (line 397). Replace the 4 workspace glass rules:

Old (lines 397-415):
```css
[data-workspace="hub"] .glass-raised,
[data-workspace="hub"] .glass-floating {
  background: color-mix(in srgb, rgb(var(--bg-white-0) / 70%) 92%, rgb(var(--blue-500)) 8%);
}

[data-workspace="garden"] .glass-raised,
[data-workspace="garden"] .glass-floating {
  background: color-mix(in srgb, rgb(var(--bg-white-0) / 70%) 92%, rgb(var(--green-500)) 8%);
}

[data-workspace="community"] .glass-raised,
[data-workspace="community"] .glass-floating {
  background: color-mix(in srgb, rgb(var(--bg-white-0) / 70%) 92%, rgb(var(--orange-500)) 8%);
}

[data-workspace="actions"] .glass-raised,
[data-workspace="actions"] .glass-floating {
  background: color-mix(in srgb, rgb(var(--bg-white-0) / 70%) 92%, rgb(var(--red-500)) 8%);
}
```

New:
```css
[data-workspace="hub"] .glass-raised,
[data-workspace="hub"] .glass-floating {
  background: color-mix(in srgb, rgb(var(--bg-white-0) / 70%) 92%, rgb(var(--ws-primary)) 8%);
}

[data-workspace="garden"] .glass-raised,
[data-workspace="garden"] .glass-floating {
  background: color-mix(in srgb, rgb(var(--bg-white-0) / 70%) 92%, rgb(var(--ws-primary)) 8%);
}

[data-workspace="community"] .glass-raised,
[data-workspace="community"] .glass-floating {
  background: color-mix(in srgb, rgb(var(--bg-white-0) / 70%) 92%, rgb(var(--ws-primary)) 8%);
}

[data-workspace="actions"] .glass-raised,
[data-workspace="actions"] .glass-floating {
  background: color-mix(in srgb, rgb(var(--bg-white-0) / 70%) 92%, rgb(var(--ws-primary)) 8%);
}
```

`--ws-primary` flips from `-500` (light) to `-200` (dark) via the workspace tonal palette overrides, so glass gets the right hue automatically.

- [ ] **Step 2: Fix tab rail tint gradients**

Replace the tab rail tint block (lines 418-429):

Old:
```css
[data-workspace="hub"] .canvas-stage-tab-rail-tint {
  background: linear-gradient(180deg, rgb(var(--blue-50) / 0.5) 0%, rgb(var(--bg-soft-200) / 0.7) 100%);
}
[data-workspace="garden"] .canvas-stage-tab-rail-tint {
  background: linear-gradient(180deg, rgb(var(--green-50) / 0.5) 0%, rgb(var(--bg-soft-200) / 0.7) 100%);
}
[data-workspace="community"] .canvas-stage-tab-rail-tint {
  background: linear-gradient(180deg, rgb(var(--orange-50) / 0.5) 0%, rgb(var(--bg-soft-200) / 0.7) 100%);
}
[data-workspace="actions"] .canvas-stage-tab-rail-tint {
  background: linear-gradient(180deg, rgb(var(--red-50) / 0.5) 0%, rgb(var(--bg-soft-200) / 0.7) 100%);
}
```

New:
```css
[data-workspace="hub"] .canvas-stage-tab-rail-tint {
  background: linear-gradient(180deg, rgb(var(--ws-surface-variant) / 0.5) 0%, rgb(var(--bg-soft-200) / 0.7) 100%);
}
[data-workspace="garden"] .canvas-stage-tab-rail-tint {
  background: linear-gradient(180deg, rgb(var(--ws-surface-variant) / 0.5) 0%, rgb(var(--bg-soft-200) / 0.7) 100%);
}
[data-workspace="community"] .canvas-stage-tab-rail-tint {
  background: linear-gradient(180deg, rgb(var(--ws-surface-variant) / 0.5) 0%, rgb(var(--bg-soft-200) / 0.7) 100%);
}
[data-workspace="actions"] .canvas-stage-tab-rail-tint {
  background: linear-gradient(180deg, rgb(var(--ws-surface-variant) / 0.5) 0%, rgb(var(--bg-soft-200) / 0.7) 100%);
}
```

`--ws-surface-variant` flips from `-50` (light) to `-900` (dark) automatically.

- [ ] **Step 3: Commit**

```bash
git add packages/admin/src/index.css
git commit -m "fix(admin): make glass tinting and tab rail dark-aware via workspace tokens"
```

---

### Task 4: Clean Up Hardcoded dark: Classes in Canvas Components

**Files:**
- Modify: `packages/shared/src/components/Canvas/NavigationBar.tsx:271`
- Modify: `packages/shared/src/components/Canvas/CanvasScaffold.tsx:161`

- [ ] **Step 1: Fix NavigationBar hardcoded dark styles**

In `packages/shared/src/components/Canvas/NavigationBar.tsx`, find line 271:

Old:
```tsx
            "dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(var(--neutral-900)/0.88)_0%,rgba(var(--neutral-950)/0.76)_100%)]",
```

New:
```tsx
            "dark:border-stroke-soft dark:bg-[linear-gradient(180deg,rgb(var(--bg-soft-200)/0.88)_0%,rgb(var(--bg-white-0)/0.76)_100%)]",
```

This replaces `white/10` with the semantic `stroke-soft` token, and replaces raw `neutral-900`/`neutral-950` with `bg-soft-200`/`bg-white-0` which now resolve to `neutral-900`/`neutral-950` in dark mode (after Task 2 remapping).

- [ ] **Step 2: Fix CanvasScaffold hardcoded dark divider**

In `packages/shared/src/components/Canvas/CanvasScaffold.tsx`, find line 161:

Old:
```tsx
        "overflow-hidden rounded-xl divide-y divide-black/5 dark:divide-white/5",
```

New:
```tsx
        "overflow-hidden rounded-xl divide-y divide-stroke-soft",
```

`divide-stroke-soft` resolves to `neutral-800` in light mode and `neutral-800` in dark mode (remapped), providing appropriate subtle division in both themes without hardcoded colors.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/components/Canvas/NavigationBar.tsx packages/shared/src/components/Canvas/CanvasScaffold.tsx
git commit -m "fix(shared): replace hardcoded dark: classes with semantic tokens in Canvas components"
```

---

### Task 5: Build, Lint, Test, and Visual Verification

**Files:** None (validation only)

- [ ] **Step 1: Run format and lint**

Run: `bun format && bun lint`

Expected: Clean output with no new errors. Fix any issues introduced by the changes.

- [ ] **Step 2: Build the workspace**

Run: `bun build`

Expected: Clean build. CSS custom properties are valid. No parse errors.

- [ ] **Step 3: Run the test suite**

Run: `bun run test`

Expected: All existing tests pass. No regressions from token remapping.

- [ ] **Step 4: Visual verification in browser**

Start the dev server: `bun dev`

Check in the admin dashboard:
1. Toggle to dark mode
2. Hub view: surfaces should show subtle tonal steps (not washed-out grays)
3. Glass surfaces should have a desaturated tint in dark mode (not vivid)
4. NavigationBar should have semantic border/gradient
5. Toggle back to light mode — verify nothing changed
6. Check contrast: primary text on dark surfaces should be easily readable

- [ ] **Step 5: Verify M3 tonal compliance — contrast ratios**

With the dev server running, check in browser DevTools:
- `onSurface` (neutral-50: 250,250,249) on `surface` (neutral-950: 12,10,9) → contrast ratio ~20:1 (exceeds WCAG AAA 7:1)
- `onSurfaceVariant` (neutral-300: 214,211,209) on `surfaceContainerHigh` (neutral-850: 35,32,30) → contrast ratio ~8.5:1 (exceeds WCAG AA 4.5:1)

- [ ] **Step 6: Final commit if any fixups were needed**

```bash
git add -A
git commit -m "fix(shared,admin): M3 dark theme compliance — fixups from validation"
```

Only create this commit if Step 1-3 required changes. Skip if everything passed clean.
