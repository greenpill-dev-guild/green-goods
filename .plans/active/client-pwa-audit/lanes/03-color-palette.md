# Lane 03 — Color & Token Audit (Client PWA)

**Scope.** Routes `/login`, `/home`, `/home/:id`, `/home/:id/work/:workId`, `/home/:id/assessments/:assessmentId`, `/garden`, `/profile`. Files: `packages/client/src/views/{Login,Home,Garden,Profile}/**`, `packages/client/src/routes/**`, `packages/client/src/components/**` (excluding `Public/**`), `packages/client/src/styles/**`, plus `@green-goods/shared` components imported transitively. Out of scope: `views/Public/**`, `views/Landing/**`, admin package.

**Method.** `grep` + targeted file reads against `packages/shared/src/styles/theme.css`, `packages/shared/src/styles/design-md.generated.css`, the five client style files, and every PWA-scope `.tsx`/`.ts`. Spot-checked the 10 most-imported shared components.

---

## Top-Level Summary

The PWA-scope code is in remarkably good shape on the literal-hex front — only **one** authored hex literal exists in scope (a `#fff` fallback inside a `var()` call), and that's by design. The real inconsistency story is **(1) Rule 13 violations in shared components (`ActionBannerFallback`, `AudioPlayer`)** that ship into the client unchanged, **(2) two unsuffixed/suffixed token dialects coexisting in the same components** (`bg-bg-white` vs `bg-bg-white-0`, `border-stroke-sub` vs `border-stroke-sub-300`), and **(3) a missing first-class garden/workspace tint token** — the four action domains have `--domain-*-rgb` tokens, but per-garden tinting has no equivalent in `theme.css` and is not used anywhere in the PWA today, leaving a documented design intent unrealized.

**Biggest source of color inconsistency:** the `bg-bg-white` / `bg-bg-white-0` (and `stroke-sub` / `stroke-sub-300`, `bg-weak` / `bg-weak-50`) split. Both forms are valid (the unsuffixed aliases are defined at `theme.css:1410-1415`, `:1424-1428`, `:1436-1439`), but consumers mix them within the same file — readers cannot tell from a diff whether a "soft" surface change is intentional or a typo. Pick one dialect, ban the other.

---

## Sub-check A — Hardcoded color literals

### A1. `#fff` fallback inside `var()` — P2

- **File:** `packages/client/src/styles/editorial.css:276`
- **Literal:** `background-color: var(--color-bg-white-0, #fff);`
- **Context:** `.public-garden-dialog` background fallback. The class name is `public-garden-dialog` but the editorial.css file is loaded from `index.css:14` (line `@import "./styles/editorial.css";`), so the rule is in scope of the PWA bundle even though the dialog is mounted from `views/Public/GardenDialog`.
- **Canonical token:** Already correct. The `var()` first arg is the right token; the `#fff` is a hard fallback for legacy browsers. Decision: leave or strip. If you keep the pattern, do it everywhere; if you drop it, drop it consistently — there is no other `var(--*, #fff)` in the file.

### A2. QR code library props — `#ffffff` / `#000000` / `#1a1a1a` — Out of scope (Landing only)

- **File:** `packages/client/src/components/Layout/Hero.tsx:160-161`
- **Literal:** `fgColor={isDark ? "#ffffff" : "#000000"}` and `bgColor={isDark ? "#1a1a1a" : "#ffffff"}`
- **Context:** `Hero` is imported only by `views/Landing/index.tsx`, which is reached via the `/landing` route that *redirects to `/`* (`router.config.tsx:52`). Hero only renders if Landing is rendered, and Landing is in `views/Landing/`, not `views/{Login,Home,Garden,Profile}/`. **Excluded from scope.**
- Note for the consolidation conversation: if Hero is ever revived, the `#1a1a1a` is not a token (closest match would be `--neutral-925` = `22 20 18`) and `QRCodeCanvas` does not accept CSS variables — this would require resolving the var to a hex at runtime via `getComputedStyle`.

### A3. CSS-file `rgba(0, 0, 0, …)` literals — Out of scope (Public only)

- **File:** `packages/client/src/styles/editorial.css:255`, `:291`
- **Literal:** `var(--color-overlay, rgba(0, 0, 0, 0.45))` and `var(--shadow-editorial-panel, 0 24px 64px rgba(0, 0, 0, 0.18))`
- **Context:** Both are fallbacks inside `.public-garden-dialog-*` rules — these target Public's GardenDialog only. Not consumed by `/home`, `/garden`, `/profile`, `/login`. Both have the canonical token as the first `var()` argument; the rgba is a fallback. **No fix needed for PWA scope.**

### A4. `rgb(var(--neutral-…) / N%)` in animation.css — Acceptable

- **File:** `packages/client/src/styles/animation.css:127`, `:290`
- **Literal:** `box-shadow: 0 8px 20px rgb(var(--neutral-950) / 8%);` and `background: rgb(var(--neutral-0) / 60%);`
- **Context:** These are `rgb()` *function calls* with token references, not literal RGB values. The pattern is exactly what theme.css uses internally. **No issue.**

### A5. Shared `ActionBannerFallback` — twelve hex literals — **P0**

- **File:** `packages/shared/src/components/Display/ActionBannerFallback.tsx:13-30, 46`
- **Literals:** 12 hex pairs forming domain-keyed gradients:
  - SOLAR: `#78350f → #f59e0b`, `#92400e → #fbbf24`, `#451a03 → #d97706`
  - AGRO: `#14532d → #22c55e`, `#052e16 → #16a34a`, `#365314 → #84cc16`
  - EDU: `#1e3a5f → #3b82f6`, `#1e1b4b → #6366f1`, `#0c4a6e → #0ea5e9`
  - WASTE: `#7c2d12 → #f97316`, `#9a3412 → #fb923c`, `#431407 → #ea580c`
  - Plus dot-grid `radial-gradient(circle, rgba(255,255,255,0.12) 1px, transparent 1px)` at `:46`
- **Context:** This is the fallback banner that appears whenever an action's image fails to load. Renders in every Action card across Home/Work/Assessment routes — a high-visibility surface. The component lives in `shared/`, but every one of its consumers is the PWA (and admin Action surfaces).
- **Canonical token:** The four action domains have first-class tokens already in `theme.css:404-411`:
  - `--domain-solar-rgb` (200 148 31), `--domain-solar-soft-rgb` (248 237 224)
  - `--domain-agro-rgb` (62 85 50), `--domain-agro-soft-rgb` (234 239 226)
  - `--domain-education-rgb` (46 79 107), `--domain-education-soft-rgb` (226 234 240)
  - `--domain-waste-rgb` (155 60 45), `--domain-waste-soft-rgb` (244 232 226)
  - These resolve to Tailwind utilities `bg-domain-solar`, `bg-domain-solar-soft`, etc. (`theme.css:1475-1482`).
- **Why this is the most important finding:** The Tailwind tokens claim "Backed by `--domain-*-rgb` / `--domain-*-soft-rgb` tokens above" (`theme.css:1471-1474`) and explicitly say "admin work filters and the client PWA reach for the same per-domain ink + soft surfaces." But `ActionBannerFallback` predates those tokens and uses a *completely different* palette — Tailwind's `amber-50/500`, `emerald-900/500`, `blue-950/500`, `orange-950/500` family. The "Warm Earth" intent (from `theme.css:402-411` comment: "deep moss / pale sage / harbour blue / pale harbour / terracotta / pale terracotta / golden amber / pale amber") is contradicted by the actual fallback rendering. **This is the largest single source of off-token color in the PWA.**

### A6. `AudioPlayer` hex fallbacks — P1

- **File:** `packages/shared/src/components/Audio/AudioPlayer.tsx:144`
- **Literal:** `background: linear-gradient(to right, var(--color-primary-base, #3b82f6) ${progress}%, var(--color-bg-soft-200, #e5e7eb) ${progress}%)`
- **Context:** Range slider track in audio playback (Garden Work / Assessment audio media). Both literals are `var()` fallbacks.
- **Canonical token:** `var(--color-primary-base, …)` and `var(--color-bg-soft-200, …)` are already correct. The `#3b82f6` (Tailwind `blue-500`) and `#e5e7eb` (Tailwind `gray-200`) fallbacks are *wrong shade* and would only render if the variable were unresolved. The closer fallbacks would be `rgb(31 193 107)` (matching `--green-500`) and `rgb(245 245 244)` (matching `--neutral-100`). Lower priority because the fallback is unlikely to fire, but the values themselves are off-Warm-Earth.

### A7. `FormSelect` `boxShadow` literal — P1

- **File:** `packages/shared/src/components/Form/Select/FormSelect.tsx:87`
- **Literal:** `boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)"`
- **Context:** react-select menu open shadow. This is the default Tailwind `shadow-md` recipe; everywhere else in the PWA the shadow comes from `--shadow-elevation-2` (`theme.css:1647`) or `--shadow-regular-md` (`theme.css:1655`).
- **Canonical token:** `--shadow-elevation-2` (`0 4px 12px 0 rgba(14, 18, 27, 0.06), 0 1px 3px 0 rgba(14, 18, 27, 0.04)`). Note also: PWA shadows use ink-tinted RGBs (`rgba(14, 18, 27, …)`), not pure black. This `rgba(0, 0, 0, …)` reads colder.

---

## Sub-check B — Raw Tailwind color utilities (Rule 13)

Result: **zero raw color utilities found in PWA scope.** No `bg-{slate,gray,zinc,neutral,stone,red,orange,amber,yellow,lime,green,emerald,teal,cyan,sky,blue,indigo,violet,purple,fuchsia,pink,rose}-N`, no `text-…-N`, no `border-…-N` in views, components, or routes. Rule 13 is being upheld at the PWA-source level.

### B1. `Hero.tsx` exception — Out of scope

- **File:** `packages/client/src/components/Layout/Hero.tsx:156`
- **Literal:** `bg-white dark:bg-gray-800 … dark:border-gray-600`
- **Context:** Used only by Landing, which is out of scope.
- **Canonical token:** If revived, `bg-white` → `bg-bg-white-0`; `dark:bg-gray-800` → `dark:bg-bg-soft-200` (or `dark:bg-bg-sub-300` depending on intended elevation); `dark:border-gray-600` → `dark:border-stroke-sub-300`. Flag for the consolidation pass even though it's out of scope today.

---

## Sub-check C — Gradients, ring/border/shadow drift

### C1. The `bg-bg-white` vs `bg-bg-white-0` dialect split — **P0 (single biggest in-scope inconsistency)**

Two valid token dialects coexist:

- **Suffixed (`-0`, `-50`, `-200`, `-300`)**: `bg-bg-white-0`, `bg-bg-weak-50`, `bg-bg-soft-200`, `border-stroke-soft-200`, `border-stroke-sub-300`. These resolve from `--color-bg-white-0` etc. (`theme.css:1402-1408`).
- **Unsuffixed aliases**: `bg-bg-white`, `bg-bg-weak`, `bg-bg-soft`, `border-stroke-soft`, `border-stroke-sub`. Defined as semantic aliases at `theme.css:1410-1415`, `:1436-1439`.

The same component sometimes uses both. Concrete co-occurrences:

- **`packages/client/src/components/Dialogs/TreasuryDrawer/CookieJarCard.tsx:67`** — `border-stroke-soft bg-bg-white p-3` (unsuffixed)
- **`packages/client/src/components/Dialogs/TreasuryDrawer/TreasuryTabContent.tsx:107`** — `border border-stroke-soft-200 bg-bg-white-0` (suffixed) … then `:119` — `border border-stroke-soft bg-bg-white p-3` (unsuffixed) **in the same file**
- **`packages/client/src/views/Home/WalletDrawer/CookieJarTab.tsx:62`** — `border border-stroke-soft bg-bg-white p-3` (unsuffixed)
- **`packages/client/src/components/Dialogs/ConvictionDrawer.tsx:51, 154, 315, 384, 469`** — all unsuffixed (`bg-bg-white`, `border-stroke-soft`, `border-stroke-sub`, `text-text-strong`, `text-text-soft`, `text-text-sub`, `bg-bg-weak`)
- **`packages/client/src/components/Dialogs/TreasuryDrawer/MyDepositRow.tsx:78, 103, 109, 129`** — all unsuffixed
- **All three `ENSSection.tsx`, `Garden/Assessment.tsx`, `Garden/index.tsx`, etc.** — all suffixed

This shows up as a clear authorial divide: the **TreasuryDrawer / WalletDrawer / ConvictionDrawer** family uses unsuffixed; the rest of the PWA uses suffixed. Both render identically — the inconsistency is in the source, not the pixels — but it makes review and grep noise much harder. Pick one and migrate. (Suffixed is the older convention and used by ~80% of the PWA; unsuffixed is the newer alias.)

**Severity P0** because: this is the largest single class of grep-and-fix work in scope, and "color inconsistency" was the user's exact phrasing.

### C2. The garden filter pill in WalletDrawer/ConvictionDrawer also uses `text-text-strong` / `text-text-soft` (unsuffixed)

Same issue, same components. Fold into C1.

### C3. Workspace canvas gradient uses tokens — Acceptable

- **File:** `packages/shared/src/styles/theme.css:1732-1734`
- **Literal:** `background: var(--canvas-gradient, linear-gradient(180deg, rgb(var(--bg-white-0)) 0%, rgb(var(--bg-weak-50) / 0.6) 40%, rgb(var(--bg-sub-300) / 0.3) 100%));`
- **Context:** All token-driven; the `linear-gradient` only contains `var(--bg-…)` references. **No issue.**

### C4. `bg-[var(--color-overlay)]` — Acceptable

- **File:** `packages/client/src/views/Garden/Media.tsx:514, 558`
- **Pattern:** `bg-[var(--color-overlay)]`
- **Context:** Tailwind arbitrary-value bracket syntax pointing at the canonical overlay token (`theme.css:1524`). **Token-correct, just verbose.** If you want consistency, the equivalent semantic utility doesn't exist (`bg-overlay` would need adding to `@theme`). Could simplify by adding `--color-overlay-overlay` to `@theme` block, but cosmetic.

### C5. `WorkViewSection` `!bg-` `!border-` `!text-` overrides — P1

- **File:** `packages/client/src/views/Home/Garden/WorkViewSection.tsx:326, 339, 349, 362`
- **Pattern:** `!bg-bg-white-0 !border-2 !border-primary-base !text-primary-base hover:!bg-primary-alpha-10 !outline-none` and similar for `warning-` and `verified-` tones.
- **Context:** All tokens are correct. The concern is the heavy use of `!` (Tailwind `important:`) — which usually signals fighting with another CSS rule rather than expressing intent. Worth a separate audit item under specificity drift, but the *colors* themselves are fine.

### C6. `text-white` / `bg-white` raw — none in PWA scope

The two hits earlier (Hero.tsx) are out of scope.

### C7. No arbitrary color rings/borders found

Searched `ring-{color}-N`, `outline-{color}-N`, `border-{color}-N`, `divide-{color}-N` — zero matches in scope. Searched `shadow-[...]` — zero matches in scope. The gradient utility search (`bg-gradient-*`, `bg-[linear-gradient…]`) returned zero matches in PWA-scope `.tsx` files (the only such gradients are in `ActionBannerFallback`, covered in A5).

---

## Sub-check D — Token coverage gaps

### D1. Missing per-garden / per-workspace tint token — **P0 design intent unrealized**

- **Need:** CLAUDE.md states "workspace color tinting" as a feedback-memory item (`feedback_hub_ui_direction.md` summary). The four **action domains** (solar/agro/education/waste) have first-class tokens (`--domain-*-rgb`, `theme.css:404-411`). The four **garden workspaces** do not.
- **Search result:** No `garden.color` or `workspace*Color` field on `Garden` or `PublicGardenSummary` types. No mapping table from garden id → color anywhere in `packages/shared/src/utils/`. No CSS variable like `--garden-tint-*` or `--workspace-tint-*` in `theme.css`.
- **Impact:** Today, the PWA rendering of garden cards (`GardenCard.tsx`, `Home/Garden/index.tsx`) is colorless apart from action-domain tinting on inner content. Any future "tint the garden header in its own color" work has nowhere to anchor. If the consolidation conversation includes garden-color-identity, that needs to start with adding a token family.

### D2. Domain palette utilities work; ink/soft pair is asymmetric

- `--domain-solar-rgb` + `--domain-solar-soft-rgb` are both defined. Same for agro, education, waste.
- However, no **dark-mode override** for these tokens (theme.css comment at `:401-403` explicitly says "Mode-agnostic on purpose"). This is documented intent, not a bug, but worth flagging because in `[data-theme="dark"]` the soft pastels read as washed-out off-white rather than the warm pastels they were designed as. Confirm with design.

### D3. `--color-primary` naming overload

This is documented heavily in `theme.css:40-46, 1126-1130` and `design-md.generated.css:1-7` ("Do not map DesignMD colors.primary to --color-primary; in this codebase --color-primary is the protected PWA tertiary accent alias.") Not a token *gap*, but it is a **dialect divergence**: admin's "primary" is the Warm Earth M3 primary (warm neutral 41 37 36), but the same name on the client resolves to green (31 193 107). Anyone porting code admin→client or reading both side-by-side will trip on this. The naming is grandfathered; the docs are loud about it; fix is non-trivial. **Flag for the consolidation conversation, do not auto-rename.**

### D4. Status tones have shadowed `dark` variants but `--color-domain-*` does not

- **`--success-*`, `--warning-*`, `--error-*`, `--information-*`** all have full dark-mode overrides (`theme.css:631-650`). Their alpha variants too.
- **`--domain-*-rgb`** does not (D2). 
- **`--editorial-*`** does (`editorial.css:30-35`).
- **Verdict:** Domain tokens are the only chromatic family without dark-mode awareness. This is intentional per the comment, but is the only place the rule is broken — worth confirming.

### D5. Status surface — no `bg-status-*` shorthand

`pwaStatusStyles.ts:16-95` rebuilds a per-tone `{ text, icon, surface, border, dot, badge, progress, spinnerBorder, focus, foreground }` lookup. The seven keys are spread across the same Tailwind utilities everywhere — good consistency at the *callsite*, but the design system has no pre-bundled `data-status="warning"` CSS class that pulls all seven from `--warning-*`. Result: every status surface re-imports `pwaStatusStyles` and gets it right, but a new author who doesn't import it is free to invent their own mapping. This is currently working — flag it, don't change it.

### D6. No "info"/"success"/"warning" CSS class layer

There are tokens (`--success-*`, etc.) and Tailwind utilities (`bg-success-base`, `text-success-dark`), but no semantic component class like `.gg-alert-success` to match `.gg-button-primary` (`theme.css:894-919`). Means status alert boxes are reconstructed inline every time. Out of scope for *color* drift, in scope for the consolidation conversation as "primitives we should add."

---

## Sub-check E — theme.css health

### E1. No duplicate token definitions detected

Ran `awk` for any `--color-*` (and friends) defined more than 2x. Only 3-count hits are `--color-material-*` (defined in `:root`, `[data-theme="dark"]`, and `@media (prefers-contrast: more)` — all intentional). No accidental redefinition.

### E2. Dark-mode pair completeness — partial

Tokens that have a `:root` definition but **no** `[data-theme="dark"]` override:
- All `--{color}-NN` chromatic primitives (`--gray-*`, `--slate-*`, `--neutral-*`, `--blue-*`, `--green-*`, `--red-*`, `--orange-*`, `--yellow-*`, `--purple-*`, `--sky-*`, `--pink-*`, `--teal-*`) — by design (these are the raw scale).
- `--domain-*-rgb` and `--domain-*-soft-rgb` — by design (D2).
- `--social-*` — overridden in dark (`theme.css:717-724`).
- `--editorial-*-rgb` — overridden in `editorial.css` (out of PWA's installed-PWA chrome but loaded in browser shell).
- `--shadow-*` — single set; **no dark-mode adjustment**. Means shadows on a near-black dark surface (`--neutral-950` = `12 10 9`) use ink-tinted black-on-black ranges (`rgba(14,18,27,…)`) which renders as essentially invisible. **Probable bug.**

### E3. Tokens defined but never referenced in PWA-scope code

Spot-checked a few. The following are defined in `theme.css` but I could not find a PWA-scope consumer (admin or storybook may consume them):
- `--shadow-fancy-buttons-neutral`, `--shadow-fancy-buttons-primary`, `--shadow-fancy-buttons-error`, `--shadow-fancy-buttons-stroke` — `theme.css:1666-1672`. No grep hits in PWA.
- `--color-feature-*`, `--color-verified-*`, `--color-highlighted-*`, `--color-stable-*`, `--color-away-*` — defined `theme.css:1484-1512`. The `--away-*` family appears unused in PWA. `--verified-*` is used (badges). `--feature-*`, `--highlighted-*`, `--stable-*` — unused in PWA scope.
- `--color-social-*` — unused in PWA scope (login screen uses different paths).

These are P2: not a fix priority, but the inventory should be reviewed before the next theme rev.

### E4. Tokens referenced in PWA-scope code but never defined

- The `--canvas-gradient` referenced at `theme.css:1732` has no `:root` default. Renders as `initial`, falling through to the `linear-gradient(...)` literal in the same `var(...)`. Acceptable — the literal is the "default" — but unconventional.
- `--bg-strong` referenced at `theme.css:1053` (`gg-switch` background) has no top-level definition. The fallback is `var(--text-sub-600)` so it works, but the chain `bg-strong → text-sub-600` inside a `gg-switch` background is semantic noise — switch off-state should not be a "text" token.

### E5. Generated `design-md.generated.css` is small and well-namespaced

`packages/shared/src/styles/design-md.generated.css` is 35 lines, all tokens prefixed `--gg-design-*` or `--gg-radius-*` / `--gg-space-*`. Header comment makes the boundary explicit. No conflict with the rest of theme. **Healthy.**

### E6. The unsuffixed semantic alias layer (`theme.css:1410-1428`)

```
--color-bg-strong: var(--color-bg-strong-950);
--color-bg-surface: var(--color-bg-surface-800);
…
--color-text-strong: var(--color-text-strong-950);
…
```

These exist to give consumers shorter names. As C1 documents, **the dialect split is the largest in-scope inconsistency.** The aliases are not the problem — the problem is that both forms are in active use in the same file. Either:

- Deprecate the unsuffixed aliases (smaller blast radius — only the four files in C1 need migration).
- Deprecate the suffixed forms (larger blast radius — most of PWA).

Document the choice in `theme.css` in the same comment block.

---

## Severity Recap

| ID | Severity | Where | What |
|---|---|---|---|
| A5 | P0 | `shared/src/components/Display/ActionBannerFallback.tsx:13-30, 46` | 12 hex pairs ignore the existing `--domain-*-rgb` token system |
| C1 | P0 | TreasuryDrawer/WalletDrawer/ConvictionDrawer family | `bg-bg-white` / `bg-bg-white-0` (and `stroke-sub`/`stroke-sub-300`, etc.) dialect mixed with the suffixed form used by ~80% of PWA |
| D1 | P0 | (token absent) | No per-garden / per-workspace tint token to anchor workspace color identity |
| A6 | P1 | `shared/src/components/Audio/AudioPlayer.tsx:144` | `var()` fallback hex (`#3b82f6`, `#e5e7eb`) does not match Warm Earth |
| A7 | P1 | `shared/src/components/Form/Select/FormSelect.tsx:87` | `boxShadow` literal (`rgba(0,0,0,0.1)`) instead of `--shadow-elevation-2` |
| C5 | P1 | `views/Home/Garden/WorkViewSection.tsx:326, 339, 349, 362` | Heavy `!important` overrides (color tokens correct, specificity smell) |
| E2 | P1 | `theme.css:1646-1676` | Shadow tokens have no dark-mode override; black-on-near-black renders invisibly |
| A1 | P2 | `client/src/styles/editorial.css:276` | Single `#fff` fallback inside `var(--color-bg-white-0, #fff)` |
| D2 | P2 | `theme.css:402-411` | Domain tokens are mode-agnostic by design; confirm dark-mode reading |
| D3 | P2 | `theme.css:40-46, 1126-1130` | `--color-primary` naming overload between admin and client |
| E3 | P2 | `theme.css:1484-1512, 1666-1672` | Tokens defined but unreferenced in PWA scope (`--feature-*`, `--highlighted-*`, `--stable-*`, `--away-*`, `--shadow-fancy-*`) |

---

## Notes for the consolidation conversation

1. **The literal-hex story is small** (one `#fff` inline; everything else is in `shared` and ships into admin too). The authoring discipline is good. The drift is in two places: the action-domain fallback that predates the domain tokens, and the dialect mixing.
2. **The dialect split (C1) is mechanical** — a single sweep across the four named files removes it. Worth resolving before any new component lands and continues the pattern.
3. **`ActionBannerFallback` (A5) is the highest-leverage single fix** — it touches every action card and is the only file with a multi-color non-token gradient set. Ship that, and the PWA's "still inconsistent" feeling drops noticeably.
4. **Garden tint (D1) is a token gap, not a fix** — flag it as a token-design conversation, do not paper over it with hardcoded values.
5. **Shadow dark mode (E2) is probably the user's "subtle wrong" feeling on the dark theme** — shadows that are tuned for light surfaces disappear on `--neutral-950`. Worth a quick visual confirmation in dark mode before deciding scope.
