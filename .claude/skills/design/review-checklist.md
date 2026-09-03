# Design Review Checklist

Unified PR review flow combining all four design lenses. Run in order — each lens builds on the previous.

---

## When to Use

- **Every PR** that touches UI components, views, or styles
- **Quick pass** (5 min): Lenses 1 + 4 only (Regenerative + Compliance)
- **Full pass** (15 min): All four lenses in order
- **New view/feature**: Full pass + Paradigm Validation (bottom of this file)

---

## Lens 1: Regenerative Design

> Does this design regenerate or extract?

| # | Check | Pass | Fix if Fail |
|---|-------|------|-------------|
| 1.1 | **Value flow visible?** User can trace how their action connects to the system | | Add contextual text showing chain: "Your submission → steward review → assessment → funding" |
| 1.2 | **Succession-appropriate?** Feature complexity matches garden maturity | | Use progressive disclosure — hide advanced controls behind expansion, not removal |
| 1.3 | **Edge-enriched?** If at a stakeholder boundary, designed for bidirectional learning | | Add context from both sides: rejection shows steward's reasoning + past approved examples |
| 1.4 | **Failure as succession?** Error/empty/rejection states guide toward renewal | | Replace "Error" with actionable context. Replace empty states with "Here's how to get started" |
| 1.5 | **Growth-agnostic?** No engagement gamification, urgency manufacturing, or FOMO | | Remove countdown timers, streak indicators, competitive leaderboards, re-engagement cues |
| 1.6 | **Capability-building?** Increases independence, not dependency | | Ask: "If the platform disappeared, would this feature's value persist?" If no, redesign |
| 1.7 | **Regen aesthetic?** Solarpunk visual language, not degen financial terminal | | Use earth tones + natural light; replace PnL-style red/green with semantic status colors |
| 1.8 | **Honorable Harvest?** Takes only needed data, gives value back | | Audit data collection — remove fields not required for the feature's core function |

---

## Lens 2: Spatial Readiness

> Does this design use depth and material intentionally?

| # | Check | Pass | Fix if Fail |
|---|-------|------|-------------|
| 2.1 | **Paradigm declared?** Surface type chosen (Command / Ambient / Data Landscape / Conversational) | | Choose paradigm using the Decision Matrix below. Add comment to component: `// Paradigm: Command Surface` |
| 2.2 | **Material appropriate?** Glass blur level matches content density | | Text-dense → thick material (solid bg). Glanceable → regular (light blur). Status → thin (max blur). See `surfaces.md`. Admin: solid everywhere except the nav dock — blur outside the admin chrome files fails `check:design-tokens` |
| 2.3 | **Depth hierarchy?** Z-axis used for information priority (Z0–Z4) | | Primary content at Z2 (main pane), contextual at Z1 (recessed), alerts at Z3 (elevated). See `surfaces.md`. Admin: depth is backed by the single `--m3-elevation-0/1/2` ladder plus the warm chrome shadow |
| 2.4 | **Hit targets ≥ 44px?** All interactive elements large enough for touch/gaze | | Increase padding. Use `min-h-11 min-w-11` (44px) on clickable areas |
| 2.5 | **Rounded corners scale?** Larger elements have larger radii | | Client: badge `rounded-lg` (8px), card `rounded-xl` (12px), modal `rounded-2xl` (16px), full pane `rounded-3xl` (24px). Admin: badge 8, card 12, dialog/pane 16, pill 9999 — no 24px step |
| 2.6 | **Progressive disclosure?** Information layers: glance → scan → engage → deep dive | | Surface summary first. Details on click/expand. Full data behind navigation |
| 2.7 | **Container-query aware?** Components adapt to container, not viewport | | Replace `@media` with `@container` where component may appear in different layout contexts |
| 2.8 | **Motion respects reduced-motion?** Animations degrade gracefully | | Wrap animations in `@media (prefers-reduced-motion: no-preference)`. Use `motion-safe:` prefix |

---

## Lens 3: Ecosystem Awareness

> Whose experience composes with whose?

| # | Check | Pass | Fix if Fail |
|---|-------|------|-------------|
| 3.1 | **Archetypes mapped?** Can name at least 3 user archetypes this surface serves | | Review the 15 archetypes in `ecosystem.md`. A card seen by Direct (gardener), Governing (steward), and Oblique (researcher) needs different emphasis |
| 3.2 | **Cascade visible?** Governing actions show blast radius before confirmation | | Add: "This will affect N gardeners" or "Rejecting this removes it from the assessment" before destructive actions |
| 3.3 | **Autonomic actors surfaced?** On-chain state, sync status, and resolver activity are visible | | Show sync badges (queued/syncing/confirmed), transaction status, indexer freshness |
| 3.4 | **Surrogate supported?** Can a steward act on behalf of a gardener? | | Check if flows work when user ≠ author (e.g., steward submitting for a gardener without a phone) |
| 3.5 | **Multi-archetype transitions?** UI adapts when user changes role (gardener → steward) | | Role-switch should update available actions without full navigation. Use role context from Hats |

---

## Lens 4: Compliance & Accessibility

> Does this meet WCAG 2.1 AA and Green Goods standards?

| # | Check | Pass | Fix if Fail |
|---|-------|------|-------------|
| 4.1 | **Labels on all inputs?** Every form field has a visible or sr-only label | | Add `<label>` or `aria-label`. Never rely on placeholder alone |
| 4.2 | **Error associations?** Validation errors linked via `aria-describedby` | | Add `id` to error message, `aria-describedby={errorId}` to input |
| 4.3 | **Color not sole indicator?** State conveyed through icon + color + text | | Add icon or text alongside color changes. Never red/green alone |
| 4.4 | **Focus management?** Modals trap focus, dismissal returns focus | | Use Radix Dialog (handles automatically). For custom overlays, add focus trap |
| 4.5 | **Keyboard navigable?** All actions reachable without mouse | | Test with Tab/Shift+Tab/Enter/Escape. Add `tabIndex` if needed |
| 4.6 | **Dark mode tested?** Component renders correctly in both themes | | Check in Storybook via theme toggle. Verify contrast ratios in both modes |
| 4.7 | **Responsive tested?** Works at 320px, 768px, and 1280px | | Use Storybook viewport addon. Check container queries, not just media queries |
| 4.8 | **i18n ready?** All user-facing strings use `intl.formatMessage()` | | Replace hardcoded strings. Update en.json, es.json, pt.json |
| 4.9 | **Storybook story exists?** Component has story with loading/error/empty variants | | Create story file. Include `tags: ["autodocs"]`, add play functions for interactions |
| 4.10 | **Offline state handled?** Component degrades gracefully without connectivity | | Show cached data with freshness indicator. Queue actions for background sync |
| 4.11 | **Admin: single elevation ladder?** Only `--m3-elevation-0/1/2` (+ warm chrome shadow on floating chrome) | | Replace any other shadow token or ad-hoc `box-shadow` with the ladder |
| 4.12 | **Admin: radius set?** Only 4/8/12/16/9999px | | Snap to the nearest admin step — no 20/24/28px |
| 4.13 | **Admin: tone budget?** Workspace tone appears only in its 4 sanctioned uses (active tab/nav pill, one filled header action, faint canvas wash, nav-shell FAB fill) | | Return extra tone usage to neutral ink/stone |
| 4.14 | **Admin: hover discipline?** Elevation step or neutral 8% ink layer only — no lift, no glow, no hue shift | | Replace transform/glow hovers with elevation 1→2 or `rgb(var(--m3-on-surface)/0.08)` |
| 4.15 | **Buttons: Title Case labels?** Buttons are `AdminButton` (pill); action labels are Title Case in en (DL-012 — es/pt keep native casing); shared `Button` never appears in admin | | Swap shared `Button` for `AdminButton`; fix sentence-case action labels |

---

## Paradigm Decision Matrix

Use when starting a new view or refactoring an existing one.

```
Q1: Is this a primary action area where the user DOES things?
    → Yes: Command Surface (thick material, high contrast, controls visible)
    → No: Q2

Q2: Is this monitoring/status that the user GLANCES at?
    → Yes: Ambient Display (thin material, peripheral, never demands attention)
    → No: Q3

Q3: Is this data exploration — charts, history, comparisons?
    → Yes: Data Landscape (variable density, zoomable overview-to-detail)
    → No: Q4

Q4: Is this AI/guidance interaction?
    → Yes: Conversational (minimal chrome, content-forward)
    → No: Default to Command Surface
```

### Paradigm → Token → Component Mapping

| Paradigm | Material | Density | Key Radix Primitives | Example Green Goods Surface |
|----------|----------|---------|---------------------|---------------------------|
| **Command Surface** | Thick (solid bg, minimal blur) | High — controls visible | Dialog, Select, DropdownMenu, Toggle | Admin dashboard, review queue, garden config |
| **Ambient Display** | Thin (max blur, translucent) | Low — glanceable | Tooltip, HoverCard, Progress | Sync status badge, garden health indicator |
| **Data Landscape** | Regular (balanced blur) | Variable — zooms | Tabs, Accordion, ScrollArea | Assessment history, impact analytics, cross-garden view |
| **Conversational** | Ultrathin (subtle) | Sparse — message-focused | — | GreenWill agent interaction, guided onboarding |

### Paradigm → Tailwind Token Strategy

| Paradigm | Background | Border | Text | Shadow |
|----------|-----------|--------|------|--------|
| **Command** (admin) | Solid `rgb(var(--admin-surface-0))` | `--stroke-sub-300` hairline | `--text-strong-950` (high contrast) | `--m3-elevation-1` |
| **Ambient** (client) | `--color-material-thin` + `--blur-material-thin` | `var(--border-material)` | `--text-sub-600` | None |
| **Data Landscape** | `--bg-white-0` canvas | `--stroke-sub-300` hairline | `--text-strong-950` | Variable by depth (`--shadow-elevation-*`) |
| **Conversational** | Transparent | None | `--text-strong-950` | None |

---

## Review Order Summary

```
1. REGENERATIVE (Lens 1) — Is this design aligned with regen principles?
   ↓ Catches: gamification, extraction patterns, degen aesthetics
2. SPATIAL (Lens 2) — Is depth/material used intentionally?
   ↓ Catches: flat/generic UI, missing progressive disclosure
3. ECOSYSTEM (Lens 3) — Does this consider multi-user cascades?
   ↓ Catches: single-user tunnel vision, hidden blast radius
4. COMPLIANCE (Lens 4) — Does this meet a11y/i18n/responsive standards?
   ↓ Catches: accessibility violations, missing stories, hardcoded strings
5. INTERACTION (admin surfaces) — Does this follow interaction-patterns.md?
   ↓ Catches: left-aligned action clusters, tab-varying view actions, dialog
     shell changes mid-flow, flows without visible entries, banner-as-status,
     invented components outside the shipped palette
```

**Lens 5 is mandatory for every admin design round — shipped console, prototypes, or
AI-generated output — and runs as an explicit checklist pass against
[interaction-patterns.md](./interaction-patterns.md) before publishing.** A green prototype
build does not substitute for it (2026-08-16 lesson: validators check structure, not design).

---

## Closing the Loop — Automated Enforcement

Each lens has a manual review pass. Some lenses also have automation that runs today; the rest are on the roadmap. Treat rows marked **Wired** as real CI defenders. Treat **Proposed** / **Partial** as gaps to fill — not as guarantees that anything will catch a regression.

| Lens | Manual Review | Automation | Status |
|------|--------------|-----------|--------|
| **1 — Regenerative** | Value-flow, succession, recovery, motivation, capability, and aesthetic checks | `bun run lint:vocab` — scans `packages/*/src/i18n/*.json` for `linter_enforced.terms` from `scripts/data/banned-vocabulary.json`; prompt-only admin/client vocabulary is guidance, not a runtime check | **Wired** |
| **2 — Spatial** | Paradigm declared, material thickness matches content density | Chromatic visual regression on paradigm-tagged stories; `@container` coverage lint | **Proposed** |
| **3 — Ecosystem** | Archetype mapping, cascade visibility, surrogate flows | Playwright role-based flows (gardener / steward / evaluator / funder); vitest surrogate-path tests; indexer archetype-span checks | **Proposed** |
| **4 — Compliance** | WCAG 2.1 AA, i18n readiness, responsive breakpoints | `@storybook/addon-a11y` (installed, not CI-gating); viewport tests at 320/768/1280; i18n-key coverage lint; `prefers-reduced-motion` vitest matcher | **Partial** — addon installed, no CI gate |
| **Cross-cutting** | Token consistency across docs and implementation | `bun run check:design-tokens` — spec ↔ `theme.css` (shared) + `packages/admin/src/styles/admin-m3-tokens.css` / `admin-m3-components.css` + `token_version` declared in `design/SKILL.md` | **Wired** |

### Quick wiring reference — currently runnable

```bash
# Lens 1 — lint-enforced banned vocabulary in user-facing i18n strings
bun run lint:vocab

# Cross-cutting — Warm Earth token spec ↔ theme.css + admin-m3-tokens.css/admin-m3-components.css + version coupling
bun run check:design-tokens
```

### Roadmap — not yet wired

To move rows out of **Proposed** / **Partial**:

- **Lens 4 — Storybook a11y gate**: add a `test-storybook` script to `packages/shared/package.json` backed by `@storybook/addon-a11y` (v10.2.8 is already installed); fail CI on violations.
- **Lens 2 — Chromatic visual regression**: add a `chromatic` script, tag stories with `tags: ["paradigm-command" | "paradigm-ambient" | …]`, run on paradigm-tagged stories. No `paradigm-*` tags exist today.
- **Lens 2 — `@container` coverage**: adopt `eslint-plugin-css-query` or equivalent (not installed).
- **Lens 4 — i18n key coverage**: adopt or build a lightweight lint that diffs keys across `en.json` / `es.json` / `pt.json`. No `intl-lint` package currently installed.
- **Lens 4 — viewport tests**: Storybook `@viewport` at 320/768/1280 — depends on the `test-storybook` script above.
- **Lens 3 — archetype-spanning Playwright flows**: Playwright is in the stack; missing is the gardener / steward / evaluator / funder + surrogate coverage.

### Why automate

A checklist agents run once per PR catches what we remember. Automated checks catch what we forget. The combination is the whole system — manual review for judgment, CI for vigilance. Keep this table honest: every row marked **Wired** must execute without error from a clean checkout.

**Implementation notes**:
- `lint:vocab` runs `scripts/design/check-vocab.sh` against `packages/*/src/i18n/*.json` and reads only `linter_enforced.terms` from `scripts/data/banned-vocabulary.json`. Biome's linter is disabled repo-wide so a shell grep is the practical substitute; select it for i18n/vocabulary changes and run it in Design CI.
- `check:design-tokens` runs `scripts/design/check-tokens.sh`, which verifies every spec'd Warm Earth token (springs, materials, border) exists in its source — `theme.css` for shared/client tokens; `packages/admin/src/styles/admin-m3-tokens.css` + `admin-m3-components.css` for admin M3/tone tokens — AND that `token_version` is declared in `design/SKILL.md`.

---

## Related

- Regenerative rationale and sources: `docs/docs/builders/architecture/design.mdx`
- Spatial patterns: [surfaces.md](./surfaces.md)
- Ecosystem archetypes: [ecosystem.md](./ecosystem.md)
- Implementation details: [implementation.md](./implementation.md)
- Green Goods personas: `docs/docs/builders/architecture/design.mdx`
