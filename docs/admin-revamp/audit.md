# Tier 0 Audit — Admin Design Handoff Reconciliation

> **Read this first.** This is the read-only audit gate from the bottom-up reconciliation workflow defined in [`design_handoff_admin-revamp/CLAUDE_CODE_PROMPT.md`](../../design_handoff_admin-revamp/CLAUDE_CODE_PROMPT.md). It diffs the handoff bundle against the existing token system, component library, and admin views, then surfaces the decisions that need a human call before any code is written.
>
> **Status (2026-05-03):** all 10 decision points in §5 have been answered. Tier 1 has been split into three sub-PRs (1a additive tokens · 1b status palette remap · 1c workspace→tone unification) and executed locally. See the **Decisions log** below.
>
> **Scope of this document:** read-only inventory plus recommendation memo. Out-of-scope per the original prompt: backend / API changes, dark-mode polish beyond mapping the new tone tokens, performance optimization. **Note**: the original "no new routes / nav" out-of-scope rule has been **relaxed** — see decisions IA-Garden and IA-Community below.

---

## Decisions log (locked 2026-05-03)

| # | Decision point | Resolution | Tier |
| --- | --- | --- | --- |
| 5.1 | Canvas wiring (`#FAF8F5`) | **Add to admin design system specifically** — `--canvas` and the warm-Earth surface tokens live in admin scope; `packages/shared/src/styles/theme.css` is **not** touched; client PWA continues to use `--bg-white-0 = #FFFFFF` | Tier 1a ✅ |
| 5.2 | Tone vs workspace | **Unify under `[data-tone]`** — `[data-workspace]` selectors and `--ws-*` tokens migrated to `[data-tone]` + `--tone-*`; ~13 admin/shared consumers refactored | Tier 1c ✅ |
| 5.3 | Conviction UI placement | **Inside Governance tab** of Community — no new routes | Tier 3/4 (deferred) |
| 5.4.1 | Allocator UX | **Inline at top of Governance tab** | Tier 3 (deferred) |
| 5.4.2 | Decay UI fidelity | Ship without ghost trailing fill in v1 | Tier 3 (deferred) |
| 5.4.3 | Dark tone strength | **`subtle` default in dark mode** | Tier 1a ✅ |
| 5.4.4 | FAB on read-only screens | Per handoff responsive rule (desktop hidden + inline header actions, tablet/mobile FAB+speed-dial). A screen with zero registered actions renders **no FAB on any breakpoint** (opt-in via `FabContext`) | Tier 2/4 (deferred) |
| 5.5 | Status palette | **Global remap to handoff palette** — runtime values of `--orange-*`, `--red-*`, `--sky-*` now resolve to handoff's muted/azure values **inside `.admin-m3` scope only**; `--information-*` aliased to `--sky-*` so info badges shift too. Client PWA unchanged. | Tier 1b ✅ |
| 5.6 | Garden identity strip | **Honor Rule 17** — demote `MetaStrip` in Garden + Community to stats only (member count / last activity / vault count); drop garden-name re-declaration; AppBar `GardenChip` stays canonical | Tier 4 (deferred) |
| IA — Garden | Tab structure | **Overview / Activity / Members / Settings** — Impact tab dropped (Hub Certify + History abstracts impact); Activity is net-new (gardener-floor feed) | Tier 4 (deferred) |
| IA — Community | Tab structure | **Treasury / Governance / Payouts / People** — `Members` renamed to `People`; cross-cutting Activity feed dropped | Tier 4 (deferred) |

**Tier 1 implementation notes:**
- PR 1a edited `packages/admin/src/index.css` (Warm-Earth aliases + tone selectors with strength axis) and added `packages/admin/src/components/AdminRevampTokens.stories.tsx` (Storybook reference page). The plan originally split tone-strength scaffolding into `admin-m3-tokens.css`; consolidated into `index.css` for cohesion (both files import together).
- PR 1b added a `.admin-m3` scoped block at the end of `index.css` overriding `--orange-*`, `--red-*`, `--sky-*` runtime values plus an explicit `--information-*` remap so info badges resolve through sky.
- PR 1c renamed via sed across 13 source files (admin + shared): `--ws-* → --tone-*`, `--workspace-tint → --tone-tint`, `--workspace-accent → --tone-accent`, `data-workspace → data-tone`. Includes `packages/shared/src/styles/theme.css` lines 880–886 (action-button styling) and `packages/shared/src/components/Canvas/BottomSheet.tsx` line 256 (drag handle). Client PWA unaffected — those tokens were already wrapped in `var(..., fallback)` so the rename only changes the lookup name, not the resolved value.

---

## Sources

| Bundle / file | Role |
| --- | --- |
| [`design_handoff_admin-revamp/screens/tokens.css`](../../design_handoff_admin-revamp/screens/tokens.css) (142 lines) | The contract — every prototype CSS custom property |
| [`design_handoff_admin-revamp/screens/UI Review.html`](../../design_handoff_admin-revamp/screens/UI%20Review.html) (415 lines) | v2 spec sections 01–05 |
| [`design_handoff_admin-revamp/DESIGN_NOTES.md`](../../design_handoff_admin-revamp/DESIGN_NOTES.md) (96 lines) | Rationale + four open questions |
| [`design_handoff_admin-revamp/README.md`](../../design_handoff_admin-revamp/README.md) (248 lines) | Conviction proposal-record migration spec, FAB rule, file map |
| [`packages/shared/src/styles/theme.css`](../../packages/shared/src/styles/theme.css) | Existing token source-of-truth |
| [`packages/shared/src/styles/design-md.generated.json`](../../packages/shared/src/styles/design-md.generated.json) | DesignMD upstream — contains `colors.neutral: #FAF8F5` already |
| [`packages/admin/src/index.css`](../../packages/admin/src/index.css), `styles/admin-m3-tokens.css`, `styles/admin-m3-overrides.css` | Admin scope tokens, M3 overrides, workspace tinting |
| [`packages/admin/src/components/Layout/PageHeader.tsx`](../../packages/admin/src/components/Layout/PageHeader.tsx), `Layout/CanvasRouteFrame.tsx`, `AdminFab.tsx` | Reuse targets |
| [`packages/admin/src/views/{Hub,Garden,Community,Actions}/index.tsx`](../../packages/admin/src/views/) | Current screen anatomy |

---

## §1 Token diff

`prototype value` is the literal from [`screens/tokens.css`](../../design_handoff_admin-revamp/screens/tokens.css). `our value (file:line)` is the resolved value in our system, with the file path of the canonical declaration. `Match` is `exact` (same value), `equivalent` (same value, different name), `divergent` (different value), or `new` (no equivalent in our system).

### 1.1 Neutral / Stone palette (warm)

`tokens.css:5–18` defines a 14-step warm-neutral scale as RGB triplets. Our scale is in `theme.css:134–149`.

| Prototype token | Prototype value | Our value (file:line) | Match | Proposed action |
| --- | --- | --- | --- | --- |
| `--neutral-0` | `255 255 255` | `--neutral-0: 255 255 255` (`theme.css:149`) | exact | none |
| `--neutral-50` | `250 250 249` | `--neutral-50: 250 250 249` (`theme.css:148`) | exact | none |
| `--neutral-100` | `245 245 244` | `--neutral-100: 245 245 244` (`theme.css:147`) | exact | none |
| `--neutral-200` | `231 229 228` | `--neutral-200: 231 229 228` (`theme.css:146`) | exact | none |
| `--neutral-300` | `214 211 209` | `--neutral-300: 214 211 209` (`theme.css:145`) | exact | none |
| `--neutral-400` | `168 162 158` | `--neutral-400: 168 162 158` (`theme.css:144`) | exact | none |
| `--neutral-500` | `120 113 108` | `--neutral-500: 120 113 108` (`theme.css:143`) | exact | none |
| `--neutral-600` | `87 83 78` | `--neutral-600: 87 83 78` (`theme.css:142`) | exact | none |
| `--neutral-700` | `68 64 60` | `--neutral-700: 68 64 60` (`theme.css:141`) | exact | none |
| `--neutral-800` | `41 37 36` | `--neutral-800: 41 37 36` (`theme.css:139`) | exact | none |
| `--neutral-850` | `35 32 30` | `--neutral-850: 35 32 30` (`theme.css:138`) | exact | none |
| `--neutral-900` | `28 25 23` | `--neutral-900: 28 25 23` (`theme.css:137`) | exact | none |
| `--neutral-925` | `22 20 18` | `--neutral-925: 22 20 18` (`theme.css:136`) | exact | none |
| `--neutral-950` | `12 10 9` | `--neutral-950: 12 10 9` (`theme.css:135`) | exact | none |

**Verdict:** entire neutral scale is a perfect match. No migration needed.

### 1.2 Warm Earth canvas + text + hairline

`tokens.css:21–25`. This is where naming diverges most.

| Prototype token | Prototype value | Our value (file:line) | Match | Proposed action |
| --- | --- | --- | --- | --- |
| `--canvas` | `#FAF8F5` | `--bg-white-0` resolves to `--neutral-0` = `#FFFFFF` (`theme.css:354`); but `design-md.generated.json:7` has `colors.neutral: "#FAF8F5"` (matches!) | divergent at runtime, exact at DesignMD source | **alias** — wire DesignMD's `colors.neutral` through to a runtime `--canvas` token; alias `--canvas: var(--gg-design-neutral)` so both names work |
| `--ink` | `#292524` | `--text-strong-950` resolves to `--neutral-950` = `#0c0a09` at runtime (`theme.css:356`); but `--neutral-800: 41 37 36` = `#292524` matches exactly (`theme.css:139`); `design-md.generated.json:11` has `colors.primary: "#292524"` | divergent at runtime, exact at DesignMD source | **alias + flag** — propose `--ink: rgb(var(--neutral-800))` since that's the actual handoff value; this conflicts with our current `--text-strong-950` mapping (which uses `--neutral-950`); decide whether to remap text-strong or only introduce a parallel `--ink` |
| `--stone` | `#78716C` | `--text-sub-600` resolves to `--neutral-600` = `#57534E` (`theme.css:357`); `--neutral-500: 120 113 108` = `#78716C` matches exactly | divergent at runtime, exact at scale | **alias** — `--stone: rgb(var(--neutral-500))` |
| `--hairline` | `rgba(41,37,36,0.08)` | `--stroke-soft-200` resolves to `rgb(--neutral-100)` (`theme.css:364`) — different mechanism (solid color, not alpha-on-ink) | divergent | **introduce** — add `--hairline` and `--hairline-strong` as new tokens; do not retrofit `--stroke-*` since 100+ consumers depend on the solid-color behavior |
| `--hairline-strong` | `rgba(41,37,36,0.14)` | (same as above) | divergent | **introduce** — see above |

**Critical finding:** the warm-cream canvas `#FAF8F5` is already the canonical DesignMD value (see `pwaProtection` + `colors.neutral` at `design-md.generated.json:7,90–95`). The runtime divergence is a wiring gap, not a value disagreement. Surfacing this should be the #1 mechanical action of Tier 1.

### 1.3 Tertiary green (1–3% accent budget)

`tokens.css:28–35`.

| Prototype token | Prototype value | Our value (file:line) | Match | Proposed action |
| --- | --- | --- | --- | --- |
| `--green-50` | `#E0FAEC` | `--green-50: 224 250 236` (`theme.css:183`) | exact | none |
| `--green-100` | `#D0FBE9` | `--green-100: 208 251 233` (`theme.css:182`) | exact | none |
| `--green-200` | `#C2F5DA` | `--green-200: 194 245 218` (`theme.css:181`) | exact | none |
| `--green-500` | `#1FC16B` | `--green-500: 31 193 107` (`theme.css:178`) | exact | none |
| `--green-700` | `#178C4E` | `--green-700: 23 140 78` (`theme.css:176`) | exact | none |
| `--green-800` | `#1A7544` | `--green-800: 26 117 68` (`theme.css:175`) | exact | none |
| `--green-900` | `#16643B` | `--green-900: 22 100 59` (`theme.css:174`) | exact | none |
| `--green-950` | `#0B4627` | `--green-950: 11 70 39` (`theme.css:173`) | exact | none |

**Verdict:** entire green scale is exact match. Conviction meter, FAB, primary buttons all map cleanly.

### 1.4 Hub green role system

`tokens.css:47–54` defines six action-role tokens locked to two values (`#1A7544` = `--green-800`, `#16643B` = `--green-900`).

| Prototype token | Prototype value | Our value (file:line) | Match | Proposed action |
| --- | --- | --- | --- | --- |
| `--g-action` | `#1A7544` | `--primary-action` → `--green-800` = `#1A7544` (`theme.css:337`) | equivalent | **alias** — `--g-action: rgb(var(--green-800))` |
| `--g-action-hover` | `#16643B` | `--primary-action-hover` → `--green-900` (`theme.css:338`) — the prototype value is `#16643B` which is `--green-900` | equivalent | **alias** — `--g-action-hover: rgb(var(--green-900))` |
| `--g-action-ring` | `rgba(26,117,68,0.16)` | no direct equivalent; closest is `--primary-alpha-16: 31 193 107 / 16%` (`green-500` not `green-800`) | divergent | **introduce** as `--g-action-ring: rgb(var(--green-800) / 0.16)` |
| `--g-soft-bg` | `rgba(26,117,68,0.10)` | `--ws-surface-tint` per workspace (`admin/src/index.css:305,321,337,353`) — workspace-scoped, value differs | divergent (mechanism mismatch) | **introduce** as `--g-soft-bg`; flag — overlaps with `--ws-surface-tint` |
| `--g-soft-fg` | `#1A7544` | `--primary-action` (`theme.css:337`) | equivalent | **alias** |
| `--g-on-action` | `#FFFFFF` | `--primary-action-foreground` → `--neutral-0` (`theme.css:339`) | exact | **alias** |

**Verdict:** alias-able to existing primary-action chain. The only net-new token is the explicit `--g-action-ring` for FAB/dot focus halos.

### 1.5 Status accents

`tokens.css:38–42`.

| Prototype token | Prototype value | Our value (file:line) | Match | Proposed action |
| --- | --- | --- | --- | --- |
| `--amber-500` | `#D97706` | no `--amber-*` scale; closest is `--orange-500: 250 115 25` = `#FA7319` (`theme.css:212`) — much more saturated; `--orange-700: 206 94 18` = `#CE5E12` is closer | divergent | **flag** — handoff's amber is muted/desaturated; ours is vivid orange; need explicit decision: introduce `--amber-*` or remap warning state to muted? **Affects all warning states across admin.** |
| `--amber-700` | `#B45309` | (no equivalent) | divergent | same as above |
| `--red-500` | `#E03835` | `--red-500: 251 55 72` = `#FB3748` (`theme.css:195`) | divergent (slightly more vivid in ours) | **flag** — minor; could keep ours; or alias `--red-500` from prototype to a desaturated value |
| `--red-700` | `#B91C1C` | `--red-700: 208 37 51` = `#D02533` (`theme.css:193`) | divergent | same as above |
| `--sky-500` | `#3B82F6` | `--sky-500: 71 194 255` = `#47C2FF` (`theme.css:263`) | divergent | **flag** — completely different hue; ours is cyan, prototype is azure/blue |

**Verdict:** status accents are the largest *value* divergence in the bundle. Surface as a single decision in flag-back §5: do we adopt the handoff's muted/cooler status palette (impacts every warning/error/info badge across admin) or keep our existing vivid scales?

### 1.6 Workspace tints

`tokens.css:45`.

| Prototype token | Prototype value | Our value (file:line) | Match | Proposed action |
| --- | --- | --- | --- | --- |
| `--ws-hub-tint` | `rgba(59,130,246,0.04)` | `--ws-surface-tint` per `[data-workspace="hub"]`: `var(--blue-500) / 8%` (`admin/src/index.css:305`) | divergent (different blue, different opacity) | **flag** — partially superseded by tone system in 1.10; resolve together |

### 1.7 M3 shape (radius)

`tokens.css:57–62`.

| Prototype token | Prototype value | Our value (file:line) | Match | Proposed action |
| --- | --- | --- | --- | --- |
| `--r-xs` | `4px` | `--admin-radius-xs: 4px` (`admin/src/index.css:110`); also `--m3-shape-xs: 4px` (`admin-m3-tokens.css:24`) | exact | **alias** — `--r-xs: var(--admin-radius-xs)` |
| `--r-sm` | `8px` | `--admin-radius-sm: 8px` (`admin/src/index.css:111`) | exact | **alias** |
| `--r-md` | `12px` | `--admin-radius-md: 12px` (`admin/src/index.css:112`); but **note** `--gg-radius-md: 8px` (DesignMD-generated, different value!) and the public `--radius-md: var(--gg-radius-md) = 8px` (`admin/src/index.css:118`) | exact for `--admin-radius-md`, divergent for public `--radius-md` | **flag** — public `--radius-md` resolves to 8px not 12px in the current setup; the alias should be `--r-md: var(--admin-radius-md)` (12px), not `var(--radius-md)` (8px). Document the DesignMD `rounded.md: "8px"` discrepancy |
| `--r-lg` | `16px` | `--admin-radius-lg: 16px` (`admin/src/index.css:113`) | exact | **alias** |
| `--r-xl` | `28px` | `--admin-radius-xl: 28px` (`admin/src/index.css:114`); DesignMD `rounded.xl: "20px"` is divergent | exact for admin scale | **alias to admin-radius-xl** |
| `--r-full` | `9999px` | `--admin-radius-full: 9999px` (`admin/src/index.css:115`) | exact | **alias** |

**Verdict:** all values exist. The `--gg-radius-md/xl` mismatch with `--admin-radius-md/xl` is pre-existing technical debt that the handoff exposes; flag once, decide once.

### 1.8 Elevation

`tokens.css:65–68`. Handoff uses warm-tinted shadows (rgb 41,37,36 base = ink); ours uses pure black.

| Prototype token | Prototype value | Our nearest (file:line) | Match | Proposed action |
| --- | --- | --- | --- | --- |
| `--e1` | `0 1px 2px rgba(41,37,36,0.06), 0 1px 1px rgba(41,37,36,0.04)` | `--elevation-1: 0px 1px 2px 0px rgba(0, 0, 0, 0.05)` (`admin/src/index.css:475`); `--m3-elevation-1: 0 1px 2px rgba(0, 0, 0, 0.3), …` (`admin-m3-tokens.css:13`) — much heavier | divergent | **introduce** — handoff shadows are warm-tinted, lighter; not interchangeable with `--m3-elevation-*` (which is heavy black M3 spec). Add `--e1..3, --e-float` as the warm-shadow set; reserve M3 elevations for chrome surfaces that already use them |
| `--e2` | `0 2px 6px rgba(41,37,36,0.08), 0 1px 2px rgba(41,37,36,0.06)` | `--elevation-2`, `--m3-elevation-2` — both diverge | divergent | **introduce** |
| `--e3` | `0 6px 16px rgba(41,37,36,0.10), 0 2px 4px rgba(41,37,36,0.06)` | `--elevation-3`, `--m3-elevation-3` — both diverge | divergent | **introduce** |
| `--e-float` | `0 12px 32px rgba(41,37,36,0.14), 0 2px 6px rgba(41,37,36,0.08)` | no equivalent (4-step ceiling); closest is `--elevation-5` | divergent | **introduce** |

**Verdict:** introduce as a parallel warm-shadow set; do not retrofit existing `--m3-elevation-*` consumers. Cards / sheets that follow the handoff use `--e*`; chrome surfaces (NavigationBar, BottomSheet, etc.) already use `--m3-elevation-*` and should stay.

### 1.9 Spring motion

`tokens.css:71–73`.

| Prototype token | Prototype value | Our value (file:line) | Match | Proposed action |
| --- | --- | --- | --- | --- |
| `--spring-spatial` | `cubic-bezier(0.16, 1, 0.3, 1) 300ms` | `--spring-spatial: var(--spring-spatial-easing) var(--spring-spatial-duration)` = `cubic-bezier(0.16, 1, 0.3, 1) 300ms` (`theme.css:475–488`) | exact | none |
| `--spring-effects` | `cubic-bezier(0.2, 0, 0, 1) 200ms` | `--spring-effects: cubic-bezier(0.2, 0, 0, 1) 250ms` (`theme.css:481–491`) | divergent (200 vs 250ms) | **flag** — minor 50ms difference; recommend keeping our 250ms (more deliberate) and noting the deviation, OR aliasing to handoff's 200ms — needs a call |
| `--spring-effects-fast` | `cubic-bezier(0.2, 0, 0, 1) 150ms` | `--spring-effects-fast: cubic-bezier(0.2, 0, 0, 1) 150ms` (`theme.css:483–492`) | exact | none |

**Verdict:** spring system is essentially aligned. The single 50ms difference on `--spring-effects` is small enough to call as a preference.

### 1.10 Typography

`tokens.css:76–77`.

| Prototype token | Prototype value | Our value (file:line) | Match | Proposed action |
| --- | --- | --- | --- | --- |
| `--font-sans` | `"Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif` | `--font-heading: 'Plus Jakarta Sans', system-ui, sans-serif` (`admin/src/index.css:17`); body family set on `body { font-family: 'Plus Jakarta Sans', system-ui, sans-serif }` (`admin/src/index.css:128`) | equivalent | **alias** — `--font-sans: var(--font-heading)` (or expand fallback chain to match prototype) |
| `--font-mono` | `"JetBrains Mono", ui-monospace, "Menlo", monospace` | not declared at root; `Tailwind` defaults | divergent | **introduce** if any UI surface uses monospace (timestamps, IDs); skip if not used |

Implicit: prototype h1 spec is `22px / -0.015em / weight 600–700`. Our `--type-title-lg: 22px` (`theme.css:540`) matches; `-0.015em` letter-spacing is not a token — applied inline in the prototype's `.rv-header h1` rule.

### 1.11 Surface tokens (light)

`tokens.css:80–88`.

| Prototype token | Prototype value | Our value (file:line) | Match | Proposed action |
| --- | --- | --- | --- | --- |
| `--surface` | `var(--canvas)` = `#FAF8F5` | `--m3-surface: var(--bg-white-0)` = white (`admin-m3-tokens.css:44`) | divergent | **alias** to new `--canvas` per §1.2 |
| `--surface-raised` | `#FFFFFF` | `--bg-white-0: var(--neutral-0)` = white (`theme.css:354`) | exact | **alias** — `--surface-raised: rgb(var(--bg-white-0))` |
| `--surface-sunken` | `#F2EFEA` | no equivalent; closest is `--admin-surface-50: 251 249 244 = #FBF9F4` (`admin/src/index.css:264`) — slightly different | divergent (close) | **introduce** with prototype value, or accept `--admin-surface-50` as a near-match |
| `--surface-quiet` | `#EFEBE5` | no equivalent; closest is `--neutral-100: #F5F5F4` (`theme.css:147`) — too light | divergent | **introduce** |
| `--on-surface` | `var(--ink)` = `#292524` | `--m3-on-surface: var(--text-strong-950)` (`admin-m3-tokens.css:51`) — see §1.2 | divergent (per §1.2) | resolve via §1.2 |
| `--on-surface-muted` | `#57534E` | `--text-sub-600: var(--neutral-600)` = `#57534E` (`theme.css:357`) — exact match! | exact at value | **alias** — `--on-surface-muted: rgb(var(--neutral-600))` |
| `--on-surface-soft` | `#78716C` | `--text-soft-400: var(--neutral-400)` = `#A8A29E` (`theme.css:358`) — divergent; but `--neutral-500: 120 113 108` matches exactly | divergent at default mapping, exact at scale | **alias** — `--on-surface-soft: rgb(var(--neutral-500))` |
| `--outline` | `rgba(41,37,36,0.10)` | `--m3-outline: var(--stroke-sub-300)` → `--neutral-300` solid (`admin-m3-tokens.css:53`) | divergent (alpha vs solid) | **introduce** as `--outline` separate from `--m3-outline`; do not retrofit |
| `--outline-strong` | `rgba(41,37,36,0.18)` | (same as above) | divergent | **introduce** |

### 1.12 Dark theme surface tokens

`tokens.css:91–130` defines a warm-biased dark ladder (canvas `#14110F`, surface-raised `#1F1B19`, etc).

Our dark theme (`theme.css:570–600`) uses an M3-aligned warm ladder — surface `--neutral-950` = `#0c0a09`, surfaceContainerLow `--neutral-925` = `#161210`. Values are close-but-not-exact (single-digit rgb deltas). Per the prompt's "Dark-mode polish beyond mapping the new tone tokens" out-of-scope rule, the audit defers a full dark-mode reconciliation to a future tier. **Action:** alias the new `--canvas`/`--surface-*` tokens through to the existing dark-theme ladder; do not introduce a parallel dark palette.

### 1.13 Tone system (net-new — not in `tokens.css`)

The tone system is described in `DESIGN_NOTES.md:7–28` and `README.md:122–129` but is **not yet defined** in `tokens.css`. It is what Tier 1 must add:

```css
[data-tone="hub"]       { --tone-canvas: oklch(96.5% 0.008 240); }   /* cool blue */
[data-tone="garden"]    { --tone-canvas: oklch(96.5% 0.008 145); }   /* green */
[data-tone="community"] { --tone-canvas: oklch(96.5% 0.008 50);  }   /* warm */
[data-tone="actions"]   { --tone-canvas: oklch(96.5% 0.008 30);  }   /* clay */
```

Plus a strength axis (`off | subtle | default`) implemented as a multiplier on `--tone-canvas`.

| Token | Status | Conflict | Proposed action |
| --- | --- | --- | --- |
| `[data-tone="*"]` selector + `--tone-canvas` | **new** | overlaps with existing `[data-workspace="*"]` (`admin/src/index.css:296–449`) which defines 13 `--ws-*` tokens per workspace | **flag** — see decision §5.2 |
| Strength scale `off / subtle / default` | **new** | none direct | introduce |

---

## §2 Component map

`Prototype primitive` is what appears in [`screens/Hub.html`](../../design_handoff_admin-revamp/screens/Hub.html) / `Garden.html` / `Community.html` / `Actions.html` and the matching `*-atoms.jsx` libraries. `Our component (file)` is the closest existing implementation. `Storybook story` is the file path; `(none)` means absent. `Gap` is `none` (drop-in), `minor` (variant addition), `new variant` (additive prop on existing API), or `brand new` (does not exist yet).

| Prototype primitive | Our component (file) | Storybook story | Gap | Notes |
| --- | --- | --- | --- | --- |
| `AppBar` (top chrome, glass) | `Canvas/AppBar.tsx` | `AppBar.stories.tsx` | none | Already glass via `.glass-surface`; `admin-m3-overrides.css:13–19` keeps glass on AppBar only |
| Garden context pill (in AppBar) | `Canvas/GardenChip.tsx` | `GardenChip.stories.tsx` | none | Workspace-tinted leaf already supported via `--ws-*` |
| Presence dot (in AppBar) | (no dedicated component; inline span in AppBar) | (none) | minor | Add a small `PresenceDot` primitive or document the inline pattern |
| `NavBar` (bottom floating pill) | `Canvas/NavigationBar.tsx` | `NavigationBar.stories.tsx` | none | M3 anatomy locked in `admin-m3-overrides.css:14–160` |
| `Fab` (single icon) | `AdminFab.tsx` | `AdminFab.stories.tsx` | new variant | Sizes + extended exist; **responsive desktop-hide and speed-dial composition do not** — both additive |
| Speed-dial (radial menu of FABs) | (none) | (none) | brand new | Build on top of `AdminFab` + `FabContext`; per-view dial composition from `UI Review.html` § 04 |
| `seg-tabs` (segmented tabs with `tab-count` chips) | `AdminTabRail.tsx` | `AdminTabRail.stories.tsx` | minor | Workspace-tinted active state already exists; **add tone-tinted underline variant** when `[data-tone]` is set |
| `g-filter-chip` (inline pill filters) | `AdminFilterChip.tsx` | `AdminFilterChip.stories.tsx` | none | Multi-select + selected-state already supported |
| `g-search-field` (search input + leading icon) | `AdminSearchToolbar.tsx` | `AdminSearchToolbar.stories.tsx` | none | Wraps a search field + filters slot |
| Status pill (`Accruing` / `Passing` / `Funded` / `Flagged` / `Rejected`) | `StatusBadge.tsx` (shared) | `StatusBadge.stories.tsx` | minor | Mandatory icon+color per Frontend Rule 12; **add conviction states to the variant enum** |
| Page header (5-slot) | `Layout/PageHeader.tsx` + `Layout/CanvasRouteFrame.tsx` (`CanvasRouteHeader`) | `PageHeader.stories.tsx` | new variant | Has 4 of 5 slots (`title`, `description`, `metadata`, `actions`); **`eyebrow` slot is missing**; `metadata` slot is text-only and would need to grow to host the v2 identity strip — see §3.2 Garden + §5.6 |
| Eyebrow (11px caps label) | (none — no dedicated component) | (none) | brand new (or new prop on PageHeader) | Easiest path: add `eyebrow?: ReactNode` prop to `PageHeader`; not a new file |
| Identity strip (`g-id-strip`: avatar + name + ENS + location + members) | `MetaStrip` (shared, text-only) | (no story for richer variant) | new variant or brand new | **See §5.6 — conflicts with Frontend Rule 17 (do not redeclare context the chrome already declares)** |
| Stats line (inline numeric stats under title) | `MetaStrip` already supports text items; no numeric variant | partial | minor | Add a numeric/stat variant of `MetaStrip` items, or pass a `stats?: StatItem[]` prop on `PageHeader` |
| Action group (right-side header buttons) | `PageHeader.actions` slot | exists | none | Already wired; Hub doesn't pass `actions` (uses `toolbar` for refresh) — inconsistency to fix in Tier 4 |
| `LeftSheet` (action / wizard sheet) | `Canvas/LeftSheet.tsx` | `LeftSheet.stories.tsx` | none | M3 directional shape via `admin-m3-overrides.css:174–178` |
| `RightSheet` (detail / config sheet) | `Canvas/RightSheet.tsx` | `RightSheet.stories.tsx` | none | Same |
| `BottomSheet` (mobile sheet) | `Canvas/BottomSheet.tsx` | `BottomSheet.stories.tsx` | none | Same |
| Sheet header / body / footer | `DialogShell` (shared) — see CLAUDE.md "DialogShell vs AdminDialog" | various | none | Already in use across the 9 admin modals |
| Primary button (filled) | `AdminButton.tsx` `variant="filled"` | `AdminButton.stories.tsx` | none | M3 state-layer included |
| Ghost button (outline / text) | `AdminButton.tsx` `variant="outlined"` / `"text"` | (same story) | none | |
| Icon button | `Canvas/AppBar.tsx` inline `.iconbtn`-style | (within AppBar story) | minor | Document or extract a standalone `IconButton` primitive if any prototype usage requires it outside AppBar |
| Avatar (generic) | `Layout/UserAvatar.tsx` (AppBar-scoped) | `UserAvatar.stories.tsx` | new variant | Standalone reusable `Avatar` is missing; needed by Garden identity strip + Community people rows |
| Cards (Hub work card / Community proposal card / Actions template card / Garden member card) | `Cards/CardBase.tsx` + `AdminCard.tsx` + `WorkbenchRow.tsx` (Hub queue rows) | various | minor (per type) | The handoff's Hub work card with photo collage + state-border is a richer composition; current `WorkbenchRow` covers structure but not the multi-image collage. Decide per-card during Tier 4 whether to extend `WorkbenchRow` or compose ad-hoc |
| Activity feed row | `WorkbenchList` + `WorkbenchRow` (shared) | `WorkbenchRow.stories.tsx` | none for structure | Date dividers + per-event types are net-new compositions, not new components |
| `ConvictionMeter` | (none) | (none) | brand new | Tier 3. Bar + threshold tick + accrual rate + ETA. Backed by `useHypercertConviction` (`packages/shared/src/hooks/conviction/`) |
| `WeightAllocator` | (none) | (none) | brand new | Tier 3. List of proposals + sliders summing to 100%. Backed by `useMemberVotingPower` + `useAllocateHypercertSupport` |
| `ProposalCardConviction` | (none) | (none) | brand new | Tier 3. Composition of proposal metadata + `ConvictionMeter` + status pill |
| `OldTallyCard` (for/against/abstain) | (none — not present in our codebase either) | n/a | n/a | Per the handoff this is being *replaced*, not migrated — we never had it |
| Conviction-decay UI (ghost trailing fill) | (none) | (none) | open question | See §5.4 |

**Summary:** of 26 distinct prototype primitives, 14 are drop-in matches, 7 are minor/new-variant additions on existing components, and 5 are brand-new (speed-dial wrapper, ConvictionMeter, WeightAllocator, ProposalCardConviction, decay UI). No primitive in the handoff requires a breaking API change to an existing shared component.

---

## §3 Screen map

For each of the four screens: current implementation (file:line + structure), what the v2 spec proposes, and the smallest delta to apply v2 within our existing routing.

### 3.1 Hub — `/hub`

**Current implementation:** [`packages/admin/src/views/Hub/index.tsx`](../../packages/admin/src/views/Hub/index.tsx)

- Uses `CanvasRouteFrame` + `CanvasRouteHeader` (`Hub/index.tsx:24,63`)
- Header passes `title={hub.stageTitle}`, `description={hub.headerDescription}`, `variant="canvas"`, `toolbar={<AdminSearchToolbar … />}` (search + refresh + sort), `children={<AdminTabRail …/>}` (4 stage tabs: Review / Assess / Certify / History)
- **Does not use `actions` slot** — refresh button lives inside `toolbar`
- **Does not pass `sticky`** — Hub header scrolls with content (Garden / Community / Actions all set `sticky`)
- **Does not pass `metadata`** — no garden re-declaration (compliant with Frontend Rule 17)
- Body: `CanvasRouteContent` → `<section className="hub-results-shell surface-section">` → `HubStageContent` (renders `HubWorkQueue` / `HubAssessmentQueue` / `HubCertificationQueue` / `HubHistoryQueue`, each a `WorkbenchList` of `WorkbenchRow`s with stage-specific `eyebrow`)
- Data attributes: `data-component="HubWorkspace"`, `data-region="workspace-hub"` / `"workspace-hub-content"`

**v2 spec proposes** ([`UI Review.html:117–155`](../../design_handoff_admin-revamp/screens/UI%20Review.html), `README.md:63`):
- Add eyebrow slot ("Workbench")
- Add inline header action buttons on desktop (Submit work / Review next / Quick log) — per `DESIGN_NOTES.md:62–64` FAB rule, FAB hidden on desktop and these become inline header actions
- Apply tone wash to canvas only (faintest blue per `tokens.css` proposed `[data-tone="hub"] { --tone-canvas: oklch(96.5% 0.008 240); }`)
- Tab structure unchanged

**Smallest delta within our routing:**
1. Add `eyebrow={"Workbench"}` (via new prop on `PageHeader` — Tier 2)
2. Move refresh from `toolbar` into `actions`; promote the (currently absent) primary creation actions into `actions` on desktop (`@media (min-width: 1024px)`); they collapse into FAB speed-dial below 1024px (Tier 4)
3. Add `data-tone="hub"` on the `CanvasRouteFrame` wrapper, with the strength multiplier inherited from a root attribute (Tier 1 + Tier 4)
4. Decide: enable `sticky` for consistency with the other three views (recommended) or keep Hub's scroll-with-content behavior

**Friction:** low. Eyebrow is a backward-compatible prop; tone is a new attribute on the frame; actions slot is already supported.

### 3.2 Garden — `/garden`

**Current implementation:** [`packages/admin/src/views/Garden/index.tsx`](../../packages/admin/src/views/Garden/index.tsx)

- Uses `CanvasRouteFrame` + `CanvasRouteHeader` (`Garden/index.tsx:15,25`)
- Header passes `title="Garden"`, `description="Manage your garden overview, impact metrics, and settings"`, `variant="canvas"`, `metadata={<MetaStrip items={[{ label: garden.name }]} />}`, `sticky`, plus `children={<AdminTabRail/>}` with 3 tabs: **Overview / Impact / Settings**
- **No identity strip** — `MetaStrip` shows the garden name as a plain text item (single line, no avatar/ENS/location/member count)
- **`metadata` re-declares the garden name** that `AppBar`'s `GardenChip` already shows — see §5.6 (Frontend Rule 17 conflict)
- Data attributes: `data-component="GardenWorkspace"`, `data-region="workspace-garden"`

**v2 spec proposes** ([`UI Review.html:127–134`](../../design_handoff_admin-revamp/screens/UI%20Review.html), `README.md:67–68`):
- Keep `g-id-strip` structure as-is (avatar + name + ENS + meta + "View public" / "Edit garden" actions)
- Apply canvas tone wash (faintest green)

**Tab divergence:** Handoff Garden tabs are Overview / Members / Settings / Treasury — our Garden has Overview / Impact / Settings only. **Members + Treasury live in our Community view, not Garden.** Per the prompt "no new routes or navigation structure," do not change tabs. Treat the handoff's Members/Treasury content as a guide for our Community tabs, not for restructuring Garden.

**Smallest delta within our routing:**
1. Add `data-tone="garden"` on the `CanvasRouteFrame` wrapper
2. **Decide identity strip approach** — see §5.6:
   - **Option A (recommended):** demote `MetaStrip` to stats only (member count, last activity, etc.), drop the garden-name line; AppBar GardenChip remains the canonical identity declaration. Honors Frontend Rule 17.
   - **Option B:** ignore Rule 17 for Garden specifically (justify "this view's whole purpose is the garden, identity duplication is informational here"); enrich `MetaStrip` into a richer identity strip with avatar + ENS + location + member count.
3. Eyebrow optional ("Garden" — but the title is already "Garden" so this would be redundant; per `UI Review.html:166` Garden is the only view that "skips" the eyebrow)

**Friction:** medium. The identity-strip decision is the load-bearing call. Do not enrich `MetaStrip` until §5.6 is settled.

### 3.3 Community — `/community`

**Current implementation:** [`packages/admin/src/views/Community/index.tsx`](../../packages/admin/src/views/Community/index.tsx)

- Uses `CanvasRouteFrame` + `CanvasRouteHeader` (`Community/index.tsx:14,27`)
- Header passes `title="Community"`, `description="Manage treasury, governance, payouts, and members"`, `variant="canvas"`, `metadata={<MetaStrip items={[{ label: garden.name }]} />}` (re-declares garden name — see §5.6), `sticky`, plus `children={<AdminTabRail/>}` with **4 tabs: Treasury / Governance / Payouts / Members**
- Body: `CommunityWorkspaceContent` renders the active tab; `community.pools` exists as data (conviction strategies) but is not rendered as proposal cards — pool creation is via `createPools()` callback
- Data attributes: `data-component="CommunityWorkspace"`, `data-region="workspace-community"`

**v2 spec proposes** ([`UI Review.html:136–144,247–291`](../../design_handoff_admin-revamp/screens/UI%20Review.html), `README.md:71–77`, `DESIGN_NOTES.md:31–48`):
- Move 3 chip-tile stats up into the page header as inline stats
- Replace `TallyBar` with `ConvictionMeter` on proposal cards
- Add `WeightAllocator` (inline at top of Proposals tab, or in a "My voting weight" sheet)
- Add eyebrow ("Engagement")
- Apply canvas tone wash (faintest warm)

**MAJOR IA divergence:** The handoff's Community has **3 tabs (Activity / Proposals / People)** — none of which exist in our Community routing. Our Treasury / Governance / Payouts / Members tabs were not present in the v2 spec at all. The v2 deltas were authored against a different IA.

Per the prompt's "no new routes or navigation structure" out-of-scope rule, we cannot restructure Community to match. The reconciliation must land within our 4-tab IA.

**Recommended mapping:**

| Handoff Community surface | Lands in our IA where | Why |
| --- | --- | --- |
| Activity tab (chronological feed of work + proposals + milestones + discussions) | **Out of scope.** No equivalent surface in our admin. Could become a future "Engagement" tab but that's a new route — flag and defer. |
| Proposals tab (proposal cards + ConvictionMeter + WeightAllocator) | **Our Governance tab.** The data model lives here (`community.pools`, `useConvictionStrategies`, `useMemberVotingPower`, `useAllocateHypercertSupport`). The v2 conviction UI lands as the rendering of the Governance pool list. |
| People tab (engagement-lensed roster) | **Our Members tab.** Already has roster + role summary. The v2 "engagement chips" (work / contributions / votes / discussions) layer onto our existing members content as additional metadata columns, not a tab restructure. |
| Stats in header (3 inline numbers) | Our `MetaStrip` slot can grow stats — but Community has no equivalent of "top contributors / proposals open / milestones this month" yet. Pick our own stats: vault count? pool count? member count? |

**Smallest delta within our routing:**
1. Add `data-tone="community"` on the `CanvasRouteFrame` wrapper
2. Add eyebrow ("Engagement") via new `PageHeader` prop
3. **Build `ConvictionMeter` + `WeightAllocator` + `ProposalCardConviction` (Tier 3) and land them inside the Governance tab** — not a new Proposals tab
4. Resolve §5.6 Garden identity decision before changing Community's `metadata` slot
5. Decide stats — what 3 numbers go in the header? (Out-of-scope to define here; flag as a §5 question if stats go above tabs)

**Friction:** high. The IA divergence is the single biggest decision. Conviction UI is net-new (no regression risk) but its placement is consequential.

### 3.4 Actions — `/actions`

**Current implementation:** [`packages/admin/src/views/Actions/index.tsx`](../../packages/admin/src/views/Actions/index.tsx)

- Uses `CanvasRouteFrame` + `CanvasRouteContent` + `PageHeader` directly (not `CanvasRouteHeader`) — `Actions/index.tsx:60,67,72`
- Header passes `title="Actions"`, `description="Scan the registry, review lifecycle status, and maintain submission requirements."`, `variant="canvas"`, `sticky`, `actions={<Button refresh />}`, `toolbar={<AdminSearchToolbar>{sort + domain filter chips}</AdminSearchToolbar>}`, `children={<AdminTabRail/>}` (lifecycle: all / draft / active / completed / archived)
- Body: `WorkbenchList` of `WorkbenchRow`s with `eyebrow={domainLabel}` (Solar / Agro / Edu / Waste) — **eyebrow is already in use on rows**, just not on the page header
- Data attributes: `data-component="ActionsWorkspace"`, `data-region="workspace-actions"` / `"workspace-actions-content"`

**v2 spec proposes** ([`UI Review.html:145–153`](../../design_handoff_admin-revamp/screens/UI%20Review.html), `README.md:81`):
- Add eyebrow slot ("Catalog")
- Apply canvas tone wash (faintest clay)
- Inline stats already correct

**Smallest delta within our routing:**
1. Add `eyebrow={"Catalog"}` (via new `PageHeader` prop)
2. Add `data-tone="actions"` on the `CanvasRouteFrame` wrapper
3. Resolve naming clash: the handoff's "actions" tone color is "clay" (warm orange-red `oklch(96.5% 0.008 30)`). Our existing `[data-workspace="actions"]` is **red** (`--red-500: 251 55 72`). Tone wash and workspace tinting must coexist or one must be demoted — see §5.2

**Friction:** low. `Actions/index.tsx` already uses `PageHeader` directly (not via `CanvasRouteHeader`), so the eyebrow + sticky pattern matches. The tone vs workspace conflict is the only complication.

### 3.5 Cross-screen header inconsistencies (independent of v2)

While auditing, three inconsistencies surfaced that the v2 work is a natural moment to fix:

| Inconsistency | Hub | Garden | Community | Actions |
| --- | --- | --- | --- | --- |
| `sticky` set on header | ❌ no | ✅ yes | ✅ yes | ✅ yes |
| Refresh button location | inside `toolbar` | (no refresh) | (no refresh) | inside `actions` |
| Wraps via `CanvasRouteHeader` (vs direct `PageHeader`) | `CanvasRouteHeader` | `CanvasRouteHeader` | `CanvasRouteHeader` | direct `PageHeader` |
| `metadata` slot used | ❌ none (Rule 17 compliant) | ✅ `MetaStrip` w/ garden name (Rule 17 violation) | ✅ `MetaStrip` w/ garden name (Rule 17 violation) | ❌ none (no garden name needed) |

Recommend bundling these alignments into the Tier 4 screen-recompose PRs rather than spinning a separate cleanup PR.

---

## §4 Risk list

Components where Tier 1–4 edits could regress consumers elsewhere. Consumer counts gathered via grep across `packages/admin/src/` and `packages/shared/src/`.

| Component | Consumers | Risk level | What could regress | Mitigation |
| --- | --- | --- | --- | --- |
| `CanvasRouteFrame` / `CanvasRouteContent` / `CanvasRouteHeader` | **20** call sites | **critical** | Adding `eyebrow` + `tone` props must be additive; layout-shift if `eyebrow` element changes title row dimensions; sticky positioning if eyebrow lifts the title further from `top: 0` | Make all new props optional with no default render; add visual regression snapshots for current callers; verify sticky `top-14` offset still aligns under AppBar with eyebrow present |
| `PageHeader` | 3 direct (Actions, Profile, Cookies) + 20 transitive (via `CanvasRouteHeader`) | **critical** | Same as above; the title `<h1 className="truncate text-headline-lg">` truncates — adding eyebrow doesn't break this, but if eyebrow becomes `<header><eyebrow><h1>` the line-clamp on `description` and the `actions` flex layout must keep working | Test all 23 consumers with Storybook stories that exercise: eyebrow only, eyebrow + actions, eyebrow + metadata + actions + toolbar + children |
| `Surface` / `Card` / `surface-section` / `surface-card` | **25+** consumers in Garden / Community alone (per agent count) | **critical** | The new tone-wash works on the canvas behind these surfaces; if cards inadvertently inherit `--tone-canvas`, they'll tint too | Tone applies only to the wrapper element with `[data-tone]`; cards should already use `--m3-surface*` solid backgrounds. Validate by inspecting a tinted Garden in Chrome MCP after Tier 1 lands |
| `AdminTabRail` | **7** consumers | **high** | Tone-tinted active underline must coexist with the existing workspace-tinted tab rail (`canvas-stage-tab-rail-tint` in `admin/src/index.css:452–463`); adding a new active-state color could collide | Underline tint should be an additive `[data-tone] .seg-tab[aria-current] { border-bottom-color: var(--tone-canvas-strong) }` rule layered on top of existing tab styles; test both light and dark modes |
| `WorkbenchList` / `WorkbenchRow` | **5+** consumers (Hub × 4 stages, Actions, plus Garden / Community sub-views) | **high** | `eyebrow` prop is already used for stage/domain context (Hub's "Review" / "Assess" / "Certify" / "History" + Actions' "Solar" / "Agro" / etc.); page-header eyebrow is a different concept on a different element — no API conflict, but be careful in PR descriptions to avoid confusion | Documentation only; no code change |
| `MetaStrip` | **3** consumers (Garden, Community headers + 1 other) | **medium** | Enriching `MetaStrip` to host the v2 identity strip would be an API change; if §5.6 lands as Option A (demote `MetaStrip` to stats only), Garden + Community both drop the garden-name item | Prefer a new compound (e.g. `IdentityStrip`) if the prop surface grows substantially; otherwise small additive props |
| `--workspace-tint` / `--ws-*` system | **all four admin views** read these tokens | **medium** | The new `[data-tone]` system overlaps with `[data-workspace]` (per §5.2). If we keep both, surfaces that read `--ws-surface-tint` will tint at workspace strength while canvas reads `--tone-canvas` at tone strength — possible visual conflict | Decision in §5.2 settles this |
| `AdminFab` | **0** active consumers in the four target views (per agent count) | **low** | New FAB integration via `FabContext` is greenfield; speed-dial wrapping is additive | Build with new visual regression snapshots for the speed-dial behavior; no existing consumer breaks |
| Status colors (`--amber-500` / `--red-500` / `--sky-500`) | every `StatusBadge`, every workspace tint, every `Alert` variant | **critical if remapped** | If §1.5 lands as "remap warning state to handoff's muted amber," every warning surface across admin shifts hue | If we go that direction, do it as its own Tier 1 sub-PR with explicit before/after snapshots; otherwise add prototype names as new tokens (e.g. `--amber-handoff-500: #D97706`) without remapping the warning role |

---

## §5 Things to flag back (decisions before Tier 1)

The audit closes with explicit decision points. Each cites prompt or repo evidence so the conversation is grounded.

### 5.1 Token namespace strategy

**The conflict:** The handoff defines its own namespace (`--canvas`, `--ink`, `--stone`, `--g-action`, `--r-*`, `--e*`, `--font-sans`). Our system uses `--bg-*`, `--text-*`, `--primary-action`, `--gg-radius-*` / `--admin-radius-*`, `--m3-elevation-*` / `--elevation-*`, `--font-heading`. Per §1, **values mostly match; names don't.**

The prompt says: "If our tokens already cover the same ground, reconcile by mapping our tokens to the prototype's values (not the other way around) — or flag conflicts before changing anything." That literal reading would invert our token names. We don't recommend it because:

- 23 consumers already read `CanvasRouteHeader` and depend on `--m3-surface` resolving to `--bg-white-0`
- The DesignMD generator (`design-md.generated.json`) is the canonical source for these values upstream, and it already contains `colors.neutral: "#FAF8F5"` (the warm canvas), `colors.primary: "#292524"` (the ink), `colors.secondary: "#78716C"` (the stone) — wired through `--gg-design-*` runtime variables. **The handoff is downstream of DesignMD; the values are already in our system.**

**Recommendation:** introduce the handoff's names as a thin alias layer pointing at our existing tokens (or at the unified DesignMD-generated values). Concretely:

```css
:root {
  /* New aliases — consumers can use either name */
  --canvas: rgb(var(--neutral-100) / 1);  /* or wire to gg-design-neutral */
  --ink: rgb(var(--neutral-800));
  --stone: rgb(var(--neutral-500));
  --on-surface-muted: rgb(var(--neutral-600));
  --on-surface-soft: rgb(var(--neutral-500));
  --surface-raised: rgb(var(--neutral-0));
  --hairline: rgb(var(--neutral-800) / 0.08);
  --hairline-strong: rgb(var(--neutral-800) / 0.14);
  --outline: rgb(var(--neutral-800) / 0.10);
  --outline-strong: rgb(var(--neutral-800) / 0.18);
  --g-action: rgb(var(--green-800));
  --g-action-hover: rgb(var(--green-900));
  --g-action-ring: rgb(var(--green-800) / 0.16);
  --g-soft-bg: rgb(var(--green-800) / 0.10);
  --g-soft-fg: rgb(var(--green-800));
  --g-on-action: rgb(var(--neutral-0));
  --r-xs: var(--admin-radius-xs);
  /* … etc */
  --e1: 0 1px 2px rgb(var(--neutral-800) / 0.06), 0 1px 1px rgb(var(--neutral-800) / 0.04);
  /* … etc — warm-tinted shadow set, parallel to existing --m3-elevation-* */
  --font-sans: var(--font-heading);
}
```

The bigger surface-level question that needs a call: **should `--bg-white-0` be remapped from `#FFFFFF` to `#FAF8F5` warm-cream, to match the handoff's `--canvas`?** If yes, this is a global change to every solid-white background in admin (and possibly client). If no, we keep `--bg-white-0 = #FFFFFF` and `--canvas = #FAF8F5` as semantically distinct tokens.

**Decision needed:** keep both surfaces as today (white default + warm-cream canvas alias) — **OR** unify on warm-cream by remapping `--bg-white-0`?

### 5.2 Tone vs workspace tinting

**The conflict:** The handoff's `[data-tone="hub|garden|community|actions"]` system sets `--tone-canvas` and is meant to wash *only*: canvas background, garden-pill leaf, active tab underline, page-header bottom hairline (`DESIGN_NOTES.md:11–17`). Our existing `[data-workspace="…"]` system (`admin/src/index.css:296–449`) sets 13 `--ws-*` tokens per workspace and is consumed by NavigationBar, UserAvatar, PageHeader, AccountProfilePanel, AccountSettingsPanel, WorkbenchRow (per the comment at `admin/src/index.css:1241–1244`).

The two systems overlap in scope but not in intent. The handoff is more restrained; ours paints more surfaces.

**Recommendation:** introduce `[data-tone]` + strength scale as a parallel layer scoped to canvas + tab underline + page-header hairline + garden-pill leaf only. **Keep `[data-workspace]` for the existing M3 role mappings (`--m3-primary` resolution, etc).** Do not paint tone onto cards, status pills, filter chips, or buttons — that's exactly what the v2 review is correcting.

The strength axis (`off | subtle | default`) implements as a CSS-variable multiplier on `--tone-canvas` saturation. Default `subtle` for dark mode (per §5.4 question 3).

**Decision needed:** confirm parallel-systems approach (recommended) — **OR** unify by collapsing `[data-workspace]` into `[data-tone]` (large refactor, reaches ~10 admin components)?

### 5.3 Community IA divergence

**The conflict:** The handoff's Community has 3 tabs (Activity / Proposals / People). Ours has 4 tabs (Treasury / Governance / Payouts / Members). The v2 deltas were authored for the handoff IA.

The prompt is clear: "New routes or navigation structure — keep our existing routing" is **out of scope**. So we keep our tabs.

**Recommendation:** land the v2 conviction UI inside our Governance tab (where `community.pools` and the conviction hooks already live). Defer the handoff's Activity tab as a future possibility (would be a new route). Treat the handoff's People tab as inspiration for member metadata enrichment within our existing Members tab — no tab restructure.

**Decision needed:** confirm Governance-tab landing for ConvictionMeter + WeightAllocator + ProposalCardConviction (recommended) — **OR** land them somewhere else (e.g. a new sub-route under Governance, or a sheet from the AppBar)?

### 5.4 The four open questions from `DESIGN_NOTES.md`

Quoting [`DESIGN_NOTES.md:91–96`](../../design_handoff_admin-revamp/DESIGN_NOTES.md), with a recommended position for each.

1. **"Conviction allocator placement. Inline at the top of Community → Proposals, or in a dedicated sheet opened from the appbar?"**

   **Recommended:** inline at the top of **our Governance tab** for first delivery. Long lists won't be a problem in early rollout (Season 1 has 13 gardens, each with a single-digit pool count). If the list grows, surface a "expand to sheet" affordance later.

2. **"Decay UI fidelity. A 'ghost trailing fill' on the meter is described above but not built. Decide based on engineering complexity vs. clarity gain."**

   **Recommended:** ship without the ghost trailing fill in the first delivery. Add the visual treatment behind a feature flag if member feedback requests it. The conviction-decay *behavior* is server-side; the UI fidelity question is purely visual feedback.

3. **"Tone strength on dark mode. Recommend `subtle` default since dark canvases already feel saturated. The host codebase's dark-mode policy supersedes this."**

   **Recommended:** `subtle` default in dark mode, `default` in light mode. Implement as a strength override in the dark-theme block.

4. **"FAB on routes with zero creation flows. A read-only screen (e.g. an audit-log detail) shouldn't show a FAB at all on tablet/mobile. Default to hidden unless the screen declares actions."**

   **Recommended:** opt-in via `FabContext`. A view registers actions and the FAB renders; no registration → no FAB. This already aligns with how `FabContext` is structured (`Canvas/FabContext.tsx`).

**Decision needed:** confirm or override each recommendation; any "Other" goes back into the spec.

### 5.5 Status palette divergence

**The conflict:** Per §1.5, the handoff uses muted `--amber-500: #D97706`, less-vivid `--red-500: #E03835`, azure `--sky-500: #3B82F6`. Our system uses vivid orange (no amber), vivid red, cyan sky. These tokens drive every warning / error / info badge across admin.

**Decision needed:** introduce handoff's status colors as parallel tokens (e.g. `--amber-handoff-*`) and migrate per-component as we recompose screens — **OR** remap our existing `--orange-*` / `--red-*` / `--sky-*` runtime values to the handoff's muted versions, accepting a global hue shift?

**Recommendation:** parallel tokens for now; revisit a global remap as a separate decision after the first Tier 4 PR lands and we can compare side-by-side.

### 5.6 Garden identity-strip vs Frontend Rule 17

**The conflict:** Frontend Design Rule 17 (`.claude/rules/frontend-design.md`) states: *"Persistent chrome (`AppBar` GardenChip, workspace title bar, breadcrumb) is the canonical declaration of which entity the operator is in. Views, page headers, toolbars, list rows, and cards must not restate that same entity."* It explicitly cites `<MetaStrip items={[{ label: garden.name }]} />` as the wrong pattern.

Garden / Community both currently re-declare the garden name via `MetaStrip` (`Garden/index.tsx:34–37`, `Community/index.tsx:35–39`) — pre-existing Rule 17 violations.

The handoff's Garden identity strip wants to add **more** (avatar + ENS + location + member count) — doubling down on the re-declaration.

**Decision needed:**
- **Option A (recommended, Rule 17 honoring):** demote `MetaStrip` in Garden / Community to stats only (e.g. `[member count] · [last activity] · [vault count]`); drop the garden-name item; AppBar `GardenChip` remains the single source of garden identity. Do not enrich `MetaStrip` into the v2's richer strip.
- **Option B (handoff-honoring):** keep / enrich `MetaStrip` into a true identity strip with avatar + ENS + location + members; explicitly exempt Garden + Community from Rule 17 with a justification ("this view's whole purpose is *this* garden, identity duplication is informational").

### 5.7 Things we already have right — do not touch

Per the prompt's "Anything in the v1 screens you suspect is already correct in our codebase and shouldn't be touched":

- **Spring motion tokens** — `--spring-spatial`, `--spring-effects-fast` are exact matches. Only `--spring-effects` differs by 50ms (§1.9).
- **Green action color chain** — `--green-500`, `--green-700`, `--green-800`, `--green-900`, `--green-950` are exact value matches; `--g-action`/`--g-action-hover`/`--g-on-action` alias cleanly off them.
- **Radius scale** — `--admin-radius-xs..xl, full` matches handoff `--r-xs..xl, full` exactly.
- **`AppBar` / `NavigationBar` / `LeftSheet` / `RightSheet` / `BottomSheet` shell anatomy** — matches the handoff structurally (glass on AppBar only, M3 directional shape on side sheets, M3 elevation-3/4).
- **`StatusBadge`** — already enforces icon + color (WCAG 1.4.1 / Frontend Rule 12); the handoff's status pills slot in cleanly.
- **Conviction data layer** — `useMemberVotingPower`, `useAllocateHypercertSupport`, `useConvictionStrategies`, `useHypercertConviction`, `useGardenPools`, `useRegisteredHypercerts` (all in `packages/shared/src/hooks/conviction/`) match the v2 mental model. The new components consume existing hooks; **no new data plumbing needed**.
- **Plus Jakarta Sans** — already imported and applied as the body family in admin (`admin/src/index.css:1,128`).
- **M3 type scale** — `--type-title-lg: 22px` matches the handoff's h1 size; full `--type-*` family covers the prototype's text needs.

---

## Reuse opportunities (extend, do not create)

Per the prompt's "Prefer updating existing components over creating new ones," the audit explicitly recommends **extending** the following rather than building parallel new components:

| Existing component | What to add | Why not new |
| --- | --- | --- |
| `PageHeader` | `eyebrow?: ReactNode` prop | Only missing slot of the v2 5-slot header; `title`/`description`/`metadata`/`actions`/`toolbar`/`children` already exist |
| `CanvasRouteHeader` | `tone?: "hub" \| "garden" \| "community" \| "actions"` prop that sets `data-tone` on the frame | Wraps `PageHeader`; tone propagates naturally to canvas + bottom hairline |
| `AdminTabRail` | tone-tinted active underline (CSS-only via `[data-tone] [aria-current]` selector) | Workspace tinting already exists; tone is a layered visual cue, not a new component |
| `AdminFab` | external responsive wrapper (`<DesktopHiddenFab>` or use Tailwind's `lg:hidden`) + speed-dial composition via `FabContext` | Sizes + extended already exist; only the orchestration is new |
| `MetaStrip` | optional richer slots if §5.6 lands as Option B | If §5.6 lands as Option A, no change to `MetaStrip` |
| `StatusBadge` | conviction states (`"accruing" \| "passing" \| "funded" \| "withdrawn" \| "expired"`) added to the variant enum | WCAG-compliant icon+color treatment is already baked in |
| DesignMD generator (`scripts/design/md-generate.mjs`) | wire `colors.neutral` / `colors.primary` / `colors.secondary` through to runtime `--canvas` / `--ink` / `--stone` | Source of truth already has the warm-earth values; this is a wiring fix, not a new token system |
| Conviction hooks (already in `packages/shared/src/hooks/conviction/`) | nothing — consume as-is from the new Tier 3 components | Data model already matches v2 mental model |

---

## Verification

Before declaring this audit complete, the writer confirmed:

1. ✅ All 5 sections present (token diff / component map / screen map / risk list / flag-back)
2. ✅ § 1 token diff has a row for every custom property in `tokens.css` (lines 5–88 dark mode at 91–130 plus the proposed tone block)
3. ✅ § 2 component map includes every primitive observed across the four screen HTMLs and the v2 review (26 entries)
4. ✅ § 3 screen map has all four screens (Hub / Garden / Community / Actions) with current/proposed/delta sub-rows
5. ✅ § 4 risk list cites concrete consumer counts from grep + agent inventory
6. ✅ § 5 flag-back covers all four `DESIGN_NOTES.md` open questions plus the IA divergence (5.3), namespace conflict (5.1), tone-vs-workspace conflict (5.2), status palette (5.5), and Rule 17 conflict (5.6)
7. ✅ Opens with a "read this first" framing
8. ✅ No code changes elsewhere; this `audit.md` is the only file written

**Next step:** human review, then proceed to Tier 1 (tokens & primitives PR) per [`design_handoff_admin-revamp/CLAUDE_CODE_PROMPT.md`](../../design_handoff_admin-revamp/CLAUDE_CODE_PROMPT.md) workflow.
