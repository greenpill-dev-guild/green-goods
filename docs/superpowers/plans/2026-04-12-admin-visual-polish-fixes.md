# Admin Visual Polish Fixes — Token Consumption + Workspace Color

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 7 visual issues found during M3+Liquid Polish review — the token foundation is correct but surfaces don't consume the tokens, glass lacks elevation, and workspace colors are imperceptible.

**Architecture:** CSS-first, cascade-ordered fixes. Wave 1 patches the token layer (utilities.css, index.css) so fixes propagate automatically to all consumers. Wave 2 fixes two structurally broken components (NavigationBar, SideSheet). Wave 3 polishes Hub-specific controls. All waves are independent and can run in parallel if desired.

**Tech Stack:** TailwindCSS v4 (CSS-first), CSS custom properties, stone neutral tokens, M3 workspace tonal palette, glass tier utilities.

**Root Cause Summary:** Two systemic gaps:
1. **Token consumption gap** — canvas, toolbar, glass tiers, route shell all use hardcoded RGB values instead of the stone neutral tokens and workspace palette defined in theme.css/index.css
2. **Workspace color fragmentation** — dual token system (`--ws-*` vs `--workspace-tint`), glass tint at 4% (imperceptible), components reference hardcoded fallbacks

**Spec:** `docs/superpowers/specs/2026-04-12-admin-m3-liquid-polish-design.md`
**Diagnosis:** Conversation root cause analysis (2026-04-12)

---

## Wave 1: Foundation CSS (no component changes)

### Task 1: Glass tiers — compose with elevation shadows

**Issue addressed:** #5 (component depth too flat)

Glass tiers provide transparency + blur but zero drop shadow. Every surface sits at the same visual Z-plane. Fix by composing glass tiers with elevation tokens that already exist.

**Files:**
- Modify: `packages/shared/src/styles/utilities.css:133-177`

- [ ] **Step 1: Add elevation to glass-raised (light mode)**

In `packages/shared/src/styles/utilities.css`, replace the `.glass-raised` block:

```css
  .glass-raised {
    background: rgb(var(--neutral-0) / 70%);
    backdrop-filter: blur(16px) saturate(1.3);
    box-shadow:
      inset 0 0 0 1px rgb(var(--neutral-0) / 30%),
      0 1px 2px 0 rgba(0, 0, 0, 0.05);
  }
```

The added `0 1px 2px` line is `--elevation-1` inlined (can't nest var() inside box-shadow shorthand with inset easily, so inline the value).

- [ ] **Step 2: Add elevation to glass-floating (light mode)**

Replace the `.glass-floating` block:

```css
  .glass-floating {
    background: rgb(var(--neutral-0) / 55%);
    backdrop-filter: blur(20px) saturate(1.5);
    box-shadow:
      inset 0 0 0 1px rgb(var(--neutral-0) / 25%),
      0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
  }
```

The added shadows are `--elevation-3` values.

- [ ] **Step 3: Add elevation to glass-overlay (light mode)**

Replace the `.glass-overlay` block:

```css
  .glass-overlay {
    background: rgb(var(--neutral-0) / 40%);
    backdrop-filter: blur(24px) saturate(1.6);
    box-shadow:
      inset 0 0 0 1px rgb(var(--neutral-0) / 20%),
      0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);
  }
```

The added shadows are `--elevation-4` values.

- [ ] **Step 4: Update dark mode glass with elevation**

Replace all four `[data-theme="dark"] .glass-*` blocks:

```css
  [data-theme="dark"] .glass-ground {
    background: rgb(var(--neutral-900) / 80%);
    box-shadow:
      inset 0 0 0 1px rgb(255 255 255 / 10%);
  }

  [data-theme="dark"] .glass-raised {
    background: rgb(var(--neutral-900) / 60%);
    box-shadow:
      inset 0 0 0 1px rgb(255 255 255 / 8%),
      0 1px 2px 0 rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(34, 197, 94, 0.03);
  }

  [data-theme="dark"] .glass-floating {
    background: rgb(var(--neutral-900) / 45%);
    box-shadow:
      inset 0 0 0 1px rgb(255 255 255 / 6%),
      0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(34, 197, 94, 0.07);
  }

  [data-theme="dark"] .glass-overlay {
    background: rgb(var(--neutral-900) / 30%);
    box-shadow:
      inset 0 0 0 1px rgb(255 255 255 / 5%),
      0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(34, 197, 94, 0.09);
  }
```

Dark elevation values match the `[data-theme="dark"]` overrides defined in `packages/admin/src/index.css:422-428`.

- [ ] **Step 5: Build and verify**

Run: `cd packages/shared && bun build`
Expected: Build succeeds with no errors.

Run: `cd packages/admin && bun build`
Expected: Build succeeds — glass classes consumed by components get new elevation automatically.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/styles/utilities.css
git commit -m "fix(shared): compose glass tiers with elevation shadows for visible depth"
```

---

### Task 2: Canvas + route shell — stone neutral backgrounds

**Issues addressed:** #2 (canvas gutters wrong color), #3 (MainSheet feels heavy)

The `.workspace-canvas` gradient and `.canvas-route-shell` both use hardcoded cold blue-gray values. Replace with stone neutral tokens defined in theme.css.

**Files:**
- Modify: `packages/admin/src/index.css` (lines ~1003-1031, ~1220-1321)

- [ ] **Step 1: Replace workspace-canvas light mode gradient**

In `packages/admin/src/index.css`, find the `.workspace-canvas` block (~line 1220) and replace its background:

```css
.workspace-canvas {
  --workspace-tint: 59 130 246;
  --workspace-tint-2: 125 211 252;
  --workspace-accent: 37 99 235;
  position: relative;
  isolation: isolate;
  overflow: clip;
  background: linear-gradient(180deg, rgb(var(--neutral-50)) 0%, rgb(var(--neutral-100) / 0.7) 100%);
  transition:
    background-color var(--spring-spatial-slow-duration) var(--spring-spatial-slow-easing),
    filter var(--spring-spatial-duration) var(--spring-spatial-easing);
}
```

Changed `rgb(246 248 252)` → `rgb(var(--neutral-50))` (stone `250 250 249`)
Changed `rgb(239 243 249)` → `rgb(var(--neutral-100) / 0.7)` (stone `245 245 244` at 70%)

- [ ] **Step 2: Replace workspace-canvas dark mode gradient**

Find `[data-theme="dark"] .workspace-canvas` (~line 1309) and replace:

```css
[data-theme="dark"] .workspace-canvas {
  background: linear-gradient(180deg, rgb(var(--neutral-950)) 0%, rgb(var(--neutral-900) / 0.95) 100%);
}
```

Changed `rgb(15 20 30)` → `rgb(var(--neutral-950))` (stone `12 10 9`)
Changed `rgb(13 18 28)` → `rgb(var(--neutral-900) / 0.95)` (stone `28 25 23` at 95%)

- [ ] **Step 3: Replace canvas-route-shell light mode gradient**

Find `.canvas-route-shell` (~line 1003) and replace:

```css
  .canvas-route-shell {
    border-radius: var(--shape-xl);
    background: linear-gradient(
      180deg,
      rgb(var(--neutral-0) / 0.94) 0%,
      rgb(var(--neutral-50) / 0.92) 100%
    );
    padding: 1rem;
    box-shadow:
      var(--edge-rest),
      0 18px 38px rgba(38, 28, 18, 0.08);
  }
```

Changed `rgb(255 255 255 / 0.94)` → `rgb(var(--neutral-0) / 0.94)` (same white, now token-based)
Changed `rgb(248 246 241 / 0.92)` → `rgb(var(--neutral-50) / 0.92)` (stone warm)

- [ ] **Step 4: Replace canvas-route-shell dark mode gradient**

Find `[data-theme="dark"] .canvas-route-shell` (~line 1022) and replace:

```css
  [data-theme="dark"] .canvas-route-shell {
    background: linear-gradient(
      180deg,
      rgb(var(--neutral-900) / 0.88) 0%,
      rgb(var(--neutral-800) / 0.78) 100%
    );
    box-shadow:
      var(--edge-rest),
      0 18px 38px rgba(0, 0, 0, 0.30);
  }
```

Changed `rgb(22 25 33 / 0.88)` → `rgb(var(--neutral-900) / 0.88)` (stone `28 25 23`)
Changed `rgb(17 19 27 / 0.78)` → `rgb(var(--neutral-800) / 0.78)` (stone `41 37 36`)

- [ ] **Step 5: Warm up the surface-section**

Find `.surface-section` (~line 1034) and update to use a warm stone tint:

```css
  /** Full-width section: page-level grouping */
  .surface-section {
    @apply rounded-xl;
    background: linear-gradient(180deg, rgb(var(--neutral-0)) 0%, rgb(var(--neutral-50) / 0.6) 100%);
    @apply p-4 sm:p-5;
    box-shadow: var(--edge-rest), var(--elevation-2);
  }
```

Replaces flat `bg-bg-white` with a subtle warm stone gradient so sections have warmth.

- [ ] **Step 6: Build and verify**

Run: `cd packages/admin && bun build`
Expected: Build succeeds. All canvas/route-shell/surface backgrounds now use stone tokens.

- [ ] **Step 7: Commit**

```bash
git add packages/admin/src/index.css
git commit -m "fix(admin): replace hardcoded canvas backgrounds with stone neutral tokens"
```

---

### Task 3: Workspace color intensity + glass tint increase

**Issues addressed:** #7 (color system not active), partial #4 (controls not using M3)

Glass tint at 4% is imperceptible. The workspace-tint tokens in the canvas atmosphere (`.workspace-canvas::before`) already work but glass surfaces don't visibly express the workspace color.

**Files:**
- Modify: `packages/admin/src/index.css` (lines ~385-408, ~1128-1170, ~76-77)

- [ ] **Step 1: Increase glass tint from 4% to 8%**

In `packages/admin/src/index.css`, find the workspace glass tinting block (~line 385) and replace all four workspace tint rules:

```css
/* ============================================================================
 * WORKSPACE GLASS TINTING — subtle color bleed into glass surfaces
 * ============================================================================ */
[data-workspace="hub"] .glass-raised,
[data-workspace="hub"] .glass-floating {
  background: color-mix(in srgb, rgb(var(--neutral-0) / 70%) 92%, rgb(var(--blue-500)) 8%);
}

[data-workspace="garden"] .glass-raised,
[data-workspace="garden"] .glass-floating {
  background: color-mix(in srgb, rgb(var(--neutral-0) / 70%) 92%, rgb(var(--green-500)) 8%);
}

[data-workspace="community"] .glass-raised,
[data-workspace="community"] .glass-floating {
  background: color-mix(in srgb, rgb(var(--neutral-0) / 70%) 92%, rgb(var(--orange-500)) 8%);
}

[data-workspace="actions"] .glass-raised,
[data-workspace="actions"] .glass-floating {
  background: color-mix(in srgb, rgb(var(--neutral-0) / 70%) 92%, rgb(var(--red-500)) 8%);
}
```

Changed `96%/4%` → `92%/8%` to match the spec's `--ws-surface-tint: seed-500 / 8%`.

- [ ] **Step 2: Add workspace tint to CanvasStageTabRail background**

The tab rail in `CanvasScaffold.tsx` uses a hardcoded warm gradient `bg-[linear-gradient(180deg,rgb(244_242_236/0.9)_0%,rgb(238_235_229/0.7)_100%)]`. To make it workspace-aware, add CSS rules after the glass tinting block:

```css
/* Workspace-aware tab rail tint */
[data-workspace="hub"] .canvas-stage-tab-rail-tint {
  background: linear-gradient(180deg, rgb(var(--blue-50) / 0.5) 0%, rgb(var(--neutral-100) / 0.7) 100%);
}
[data-workspace="garden"] .canvas-stage-tab-rail-tint {
  background: linear-gradient(180deg, rgb(var(--green-50) / 0.5) 0%, rgb(var(--neutral-100) / 0.7) 100%);
}
[data-workspace="community"] .canvas-stage-tab-rail-tint {
  background: linear-gradient(180deg, rgb(var(--orange-50) / 0.5) 0%, rgb(var(--neutral-100) / 0.7) 100%);
}
[data-workspace="actions"] .canvas-stage-tab-rail-tint {
  background: linear-gradient(180deg, rgb(var(--red-50) / 0.5) 0%, rgb(var(--neutral-100) / 0.7) 100%);
}
```

Then in `packages/shared/src/components/Canvas/CanvasScaffold.tsx`, add the `canvas-stage-tab-rail-tint` class to the tab rail's outer `<div>` (the one with `role="tablist"`). Find the `className` prop in `CanvasStageTabRail` and add the class alongside the existing hardcoded gradient:

Replace in the `className` of the tablist div:
```
"bg-[linear-gradient(180deg,rgb(244_242_236/0.9)_0%,rgb(238_235_229/0.7)_100%)] dark:bg-bg-sub/80"
```
with:
```
"canvas-stage-tab-rail-tint bg-[linear-gradient(180deg,rgb(var(--neutral-100)/0.9)_0%,rgb(var(--neutral-200)/0.7)_100%)] dark:bg-bg-sub/80"
```

The CSS class overrides the inline gradient when inside a `[data-workspace]` ancestor. The inline gradient is now also tokenized with `--neutral-100/200`.

- [ ] **Step 3: Build and verify**

Run: `cd packages/shared && bun build && cd ../admin && bun build`
Expected: Build succeeds. Glass surfaces now show visible workspace tint. Tab rail shows workspace-colored background.

- [ ] **Step 4: Commit**

```bash
git add packages/admin/src/index.css packages/shared/src/components/Canvas/CanvasScaffold.tsx
git commit -m "fix(admin,shared): increase workspace glass tint to 8% and tokenize tab rail"
```

---

## Wave 2: Component Structural Fixes

### Task 4: SideSheet — side-aware glass border

**Issue addressed:** #6 (sheet border artifacts)

The `glass-floating` class applies an inset box-shadow border on ALL sides. `border-l-0`/`border-r-0` are no-ops because glass doesn't use CSS borders. Fix by overriding the box-shadow to exclude the flush edge.

**Files:**
- Modify: `packages/shared/src/components/Canvas/SideSheet.tsx:82-108`

- [ ] **Step 1: Replace glass-floating border with side-aware shadow**

In `SideSheet.tsx`, find the `Dialog.Content` element (~line 78). Replace the `className` and `style` to use a side-aware inset border:

Replace the current className line:
```tsx
            "glass-floating focus:outline-none",
```
with:
```tsx
            "focus:outline-none",
```

And replace the current `style` prop:
```tsx
          style={{
            width: `min(${width}px, 100vw)`,
            animationTimingFunction: SPRING_EASING,
            paddingBottom: isBounded ? undefined : "env(safe-area-inset-bottom)",
            left: isLeft ? 0 : undefined,
            right: isLeft ? undefined : 0,
            boxShadow: "var(--elevation-4)",
          }}
```
with:
```tsx
          style={{
            width: `min(${width}px, 100vw)`,
            animationTimingFunction: SPRING_EASING,
            paddingBottom: isBounded ? undefined : "env(safe-area-inset-bottom)",
            left: isLeft ? 0 : undefined,
            right: isLeft ? undefined : 0,
            background: "rgb(var(--neutral-0) / 55%)",
            backdropFilter: "blur(20px) saturate(1.5)",
            boxShadow: isLeft
              ? "inset -1px 0 0 0 rgb(var(--neutral-0) / 25%), 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)"
              : "inset 1px 0 0 0 rgb(var(--neutral-0) / 25%), 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)",
          }}
```

This applies `glass-floating` properties inline but with a directional inset border — only the inner edge (facing content) gets the glass highlight line. The flush edge against the container edge has no inset border, preventing the artifact.

- [ ] **Step 2: Remove ineffective border classes**

In the same className, remove the no-op border classes. Replace:
```tsx
isLeft ? "left-0 rounded-r-xl border-l-0" : "right-0 rounded-l-xl border-r-0",
```
with:
```tsx
isLeft ? "left-0 rounded-r-xl" : "right-0 rounded-l-xl",
```

- [ ] **Step 3: Build and run tests**

Run: `cd packages/shared && bun build && bun run test`
Expected: Build succeeds, tests pass. SideSheet stories should still render (no visual test infra to validate border fix — visual check in browser needed).

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/components/Canvas/SideSheet.tsx
git commit -m "fix(shared): side-aware glass border on SideSheet to fix border artifacts"
```

---

### Task 5: NavigationBar — extract FAB to independent floating element

**Issue addressed:** #1 (NavigationBar + FAB merged)

The FAB renders inside the `<nav>` element on desktop, making them one combined pill. Extract to a separate fixed element.

**Files:**
- Modify: `packages/shared/src/components/Canvas/NavigationBar.tsx:264-290`

- [ ] **Step 1: Extract desktop FAB to independent fixed element**

In `NavigationBar.tsx`, find the desktop nav rendering (~line 264). The current code renders FAB inside the `<nav>`. Split them apart.

Replace the entire desktop nav block (lines 264-290):
```tsx
      {isDesktop && (desktopSlots.length > 1 || fab) && (
        <nav
          aria-label={navLabel}
          className={cn(
            "canvas-navigation-bar fixed bottom-4 left-1/2 z-nav flex -translate-x-1/2 items-center",
            "gap-1.5 rounded-2xl px-2.5 py-2",
            "glass-ground",
            "dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(20,24,33,0.88)_0%,rgba(17,19,27,0.76)_100%)]",
            fab && "pr-2.5",
            "animate-[nav-bar-enter_var(--spring-medium-duration,300ms)_cubic-bezier(0.16,1,0.3,1)_both]",
            "motion-reduce:animate-none"
          )}
          style={{
            boxShadow: "0 24px 48px rgba(15, 23, 42, 0.18), inset 0 0 0 1px rgba(255,255,255,0.18)",
          }}
        >
          {desktopSlots.map((slot) => (
            <NavItem
              key={slot.id}
              slot={slot}
              isActive={activePath === slot.path}
              onNavigate={onNavigate}
              label={formatMessage({ id: slot.labelId })}
            />
          ))}
          {fab && <FabButton config={fab} />}
        </nav>
      )}
```

with two separate elements:

```tsx
      {isDesktop && desktopSlots.length > 1 && (
        <nav
          aria-label={navLabel}
          className={cn(
            "canvas-navigation-bar fixed bottom-4 left-1/2 z-nav flex -translate-x-1/2 items-center",
            "gap-1.5 rounded-2xl px-2.5 py-2",
            "glass-ground",
            "dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(var(--neutral-900)/0.88)_0%,rgba(var(--neutral-950)/0.76)_100%)]",
            "animate-[nav-bar-enter_var(--spring-medium-duration,300ms)_cubic-bezier(0.16,1,0.3,1)_both]",
            "motion-reduce:animate-none"
          )}
          style={{
            boxShadow: "0 24px 48px rgba(15, 23, 42, 0.18), inset 0 0 0 1px rgba(255,255,255,0.18)",
          }}
        >
          {desktopSlots.map((slot) => (
            <NavItem
              key={slot.id}
              slot={slot}
              isActive={activePath === slot.path}
              onNavigate={onNavigate}
              label={formatMessage({ id: slot.labelId })}
            />
          ))}
        </nav>
      )}

      {isDesktop && fab && (
        <div
          className={cn(
            "fixed bottom-4 right-6 z-nav",
            "animate-[nav-bar-enter_var(--spring-medium-duration,300ms)_cubic-bezier(0.16,1,0.3,1)_both]",
            "motion-reduce:animate-none"
          )}
        >
          <FabButton config={fab} />
        </div>
      )}
```

Key changes:
- Nav `<nav>` no longer contains `FabButton` — removed `{fab && <FabButton config={fab} />}` from inside
- Nav visibility: `desktopSlots.length > 1` (no longer `|| fab` — nav shows only if there are slots to navigate)
- FAB gets its own `<div>` at `fixed bottom-4 right-6 z-nav` — independent floating element
- Removed `fab && "pr-2.5"` conditional padding (no longer needed)
- Dark mode nav background tokenized: `rgba(20,24,33,0.88)` → `rgba(var(--neutral-900)/0.88)` and `rgba(17,19,27,0.76)` → `rgba(var(--neutral-950)/0.76)`

- [ ] **Step 2: Build and run tests**

Run: `cd packages/shared && bun build && bun run test`
Expected: Build succeeds, tests pass. Storybook NavigationBar stories may need visual verification.

Run: `cd packages/admin && bun run test`
Expected: Admin tests pass. The `CanvasLayout.test.tsx` and `mobile-nav.test.tsx` should still pass since the DOM structure is similar — just wrapped differently.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/components/Canvas/NavigationBar.tsx
git commit -m "fix(shared): separate NavigationBar and FAB into independent floating elements"
```

---

## Wave 3: Hub-Specific Polish

### Task 6: Hub toolbar controls — workspace token consumption

**Issue addressed:** #4 (controls squished, wrong colors)

Toolbar shell, search input, sort select, and refresh button all use hardcoded RGB values. Replace with workspace-aware tokens.

**Files:**
- Modify: `packages/admin/src/index.css` (lines ~1128-1180)

- [ ] **Step 1: Replace hub-toolbar-shell background with workspace token**

Find `.hub-toolbar-shell` (~line 1128) and replace:

```css
  .hub-toolbar-shell {
    border-radius: 1.35rem;
    background: linear-gradient(180deg, rgb(var(--neutral-0) / 0.72) 0%, rgb(var(--neutral-50) / 0.58) 100%);
    padding: 0.75rem 1rem;
    box-shadow:
      inset 0 0 0 1px rgb(var(--neutral-0) / 0.8),
      0 6px 16px rgba(133, 109, 70, 0.05);
  }
```

Changes:
- Hardcoded `rgb(255 255 255 / 0.72)` → `rgb(var(--neutral-0) / 0.72)` (tokenized)
- Hardcoded `rgb(248 246 241 / 0.58)` → `rgb(var(--neutral-50) / 0.58)` (stone warm)
- Padding `0.75rem` → `0.75rem 1rem` (more horizontal breathing room)

- [ ] **Step 2: Replace hub-list-toolbar input background + focus**

Find `.hub-list-toolbar input` (~line 1146) and replace:

```css
  .hub-list-toolbar input {
    height: 2.75rem;
    border: 0;
    border-radius: 999px;
    background: rgb(var(--ws-surface-variant, var(--neutral-100)) / 0.65);
    box-shadow: inset 0 0 0 1px rgb(var(--ws-outline, var(--neutral-200)) / 0.4);
    padding-right: 2.5rem;
  }

  .hub-list-toolbar input:focus {
    box-shadow:
      inset 0 0 0 1px rgb(var(--ws-primary, var(--primary-base)) / 0.4),
      0 0 0 3px rgb(var(--ws-primary, var(--primary-base)) / 0.12);
  }
```

Changes:
- Input background: hardcoded `rgb(244 244 239 / 0.94)` → `rgb(var(--ws-surface-variant) / 0.65)` — uses workspace surface-variant token (blue-50 on Hub, green-50 on Garden, etc.)
- Input border: uses `--ws-outline` token
- Focus ring: `--workspace-tint` → `--ws-primary` (M3 token, not legacy)

- [ ] **Step 3: Replace sort select + refresh button styling**

Find `.hub-sort-select select, .hub-refresh-button` (~line 1161) and replace:

```css
  .hub-sort-select select,
  .hub-refresh-button {
    height: 2.75rem;
    border-radius: 999px;
    border: 0;
    background: rgb(var(--neutral-0) / 0.86);
    box-shadow:
      inset 0 0 0 1px rgb(var(--ws-outline, var(--neutral-200)) / 0.3),
      0 4px 12px rgba(38, 28, 18, 0.04);
  }
```

Changes:
- Background: `rgb(255 255 255 / 0.86)` → `rgb(var(--neutral-0) / 0.86)` (tokenized)
- Border: `rgb(0 0 0 / 0.05)` → `rgb(var(--ws-outline) / 0.3)` (workspace-aware)

- [ ] **Step 4: Build and verify**

Run: `cd packages/admin && bun build`
Expected: Build succeeds. Hub toolbar controls now adapt to workspace color on each view.

- [ ] **Step 5: Commit**

```bash
git add packages/admin/src/index.css
git commit -m "fix(admin): hub toolbar controls consume M3 workspace tokens instead of hardcoded values"
```

---

### Task 7: MainSheet — warm stone surface tint

**Issue addressed:** #3 (MainSheet feels heavy)

The MainSheet uses `bg-bg-white` (pure white). Give it a subtle warm stone surface gradient to align with the warm canvas behind it.

**Files:**
- Modify: `packages/shared/src/components/Canvas/MainSheet.tsx:90-93`

- [ ] **Step 1: Replace pure white background with warm stone surface**

In `MainSheet.tsx`, find the inner content div (~line 92). Replace:

```tsx
            className={cn(
              "h-full min-h-0 rounded-[inherit] bg-bg-white will-change-[transform,opacity,filter]"
            )}
```

with:

```tsx
            className={cn(
              "h-full min-h-0 rounded-[inherit] will-change-[transform,opacity,filter]"
            )}
```

And add the background to the `style` prop. Replace the existing `style` block:

```tsx
            style={{
              background: "linear-gradient(180deg, rgb(var(--neutral-0)) 0%, rgb(var(--neutral-50) / 0.5) 100%)",
              boxShadow:
                "inset 0 0 0 1px rgba(255,255,255,0.65), 0 18px 46px rgba(21, 16, 10, 0.14)",
              transform: isMainSheetReceded
                ? "translateY(8px) scale(var(--canvas-scale-receded))"
                : "translateY(0) scale(1)",
              opacity: isMainSheetReceded ? "var(--canvas-opacity-receded)" : "1",
              filter: isMainSheetReceded
                ? "blur(var(--canvas-blur-receded)) saturate(0.88) brightness(0.98)"
                : "none",
              transitionProperty: "transform, opacity, filter",
              transitionDuration: "var(--spring-spatial-slow-duration, 420ms)",
              transitionTimingFunction:
                "var(--spring-spatial-easing, cubic-bezier(0.16, 1, 0.3, 1))",
            }}
```

Changes:
- Removed `bg-bg-white` class (pure white)
- Added inline `background` gradient: white at top fading to subtle stone-50 at bottom
- This creates warmth without being heavy — the gradient is barely perceptible but removes the clinical flat-white feel

- [ ] **Step 2: Build and run tests**

Run: `cd packages/shared && bun build && bun run test`
Expected: Build succeeds, tests pass. MainSheet visual warmth only verifiable in browser.

Run: `cd packages/admin && bun build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/components/Canvas/MainSheet.tsx
git commit -m "fix(shared): warm stone surface tint on MainSheet instead of flat white"
```

---

## Validation

After all tasks complete:

- [ ] **Full workspace build**: `bun build`
- [ ] **Full test suite**: `bun run test`
- [ ] **Lint + format**: `bun format && bun lint`
- [ ] **Visual check**: Open admin in browser, verify:
  - NavigationBar and FAB are two separate floating elements
  - Canvas gutters show warm stone color (not cold blue or black)
  - MainSheet has subtle warmth
  - Hub tab rail and toolbar controls show workspace tint (blue on Hub, green on Garden)
  - Glass surfaces have visible elevation (shadows beneath cards)
  - SideSheet opens without border artifacts
  - Switching between Hub/Garden/Community shows perceptible workspace color shift

---

## Files Modified Summary

| File | Tasks | Changes |
|------|-------|---------|
| `packages/shared/src/styles/utilities.css` | 1 | Glass tiers + elevation shadows |
| `packages/admin/src/index.css` | 2, 3, 6 | Canvas/route-shell stone tokens, workspace tint 8%, toolbar tokens |
| `packages/shared/src/components/Canvas/CanvasScaffold.tsx` | 3 | Tab rail workspace tint class |
| `packages/shared/src/components/Canvas/SideSheet.tsx` | 4 | Side-aware glass border |
| `packages/shared/src/components/Canvas/NavigationBar.tsx` | 5 | FAB extraction to independent element |
| `packages/shared/src/components/Canvas/MainSheet.tsx` | 7 | Warm stone surface gradient |
