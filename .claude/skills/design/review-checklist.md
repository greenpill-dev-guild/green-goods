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
| 1.1 | **Value flow visible?** User can trace how their action connects to the system | | Add contextual text showing chain: "Your submission → operator review → assessment → funding" |
| 1.2 | **Succession-appropriate?** Feature complexity matches garden maturity | | Use progressive disclosure — hide advanced controls behind expansion, not removal |
| 1.3 | **Edge-enriched?** If at a stakeholder boundary, designed for bidirectional learning | | Add context from both sides: rejection shows operator's reasoning + past approved examples |
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
| 2.2 | **Material appropriate?** Glass blur level matches content density | | Text-dense → thick material (solid bg). Glanceable → regular (light blur). Status → thin (max blur). See `materials.md` |
| 2.3 | **Depth hierarchy?** Z-axis used for information priority (Z0–Z4) | | Primary content at Z2 (main pane), contextual at Z1 (recessed), alerts at Z3 (elevated). See `spatial.md` |
| 2.4 | **Hit targets ≥ 44px?** All interactive elements large enough for touch/gaze | | Increase padding. Use `min-h-11 min-w-11` (44px) on clickable areas |
| 2.5 | **Rounded corners scale?** Larger elements have larger radii | | Small badge: `rounded-lg` (8px). Card: `rounded-xl` (12px). Modal: `rounded-2xl` (16px). Full pane: `rounded-3xl` (24px) |
| 2.6 | **Progressive disclosure?** Information layers: glance → scan → engage → deep dive | | Surface summary first. Details on click/expand. Full data behind navigation |
| 2.7 | **Container-query aware?** Components adapt to container, not viewport | | Replace `@media` with `@container` where component may appear in different layout contexts |
| 2.8 | **Motion respects reduced-motion?** Animations degrade gracefully | | Wrap animations in `@media (prefers-reduced-motion: no-preference)`. Use `motion-safe:` prefix |

---

## Lens 3: Ecosystem Awareness

> Whose experience composes with whose?

| # | Check | Pass | Fix if Fail |
|---|-------|------|-------------|
| 3.1 | **Archetypes mapped?** Can name at least 3 user archetypes this surface serves | | Review the 15 archetypes in `ecosystem.md`. A card seen by Direct (gardener), Governing (operator), and Oblique (researcher) needs different emphasis |
| 3.2 | **Cascade visible?** Governing actions show blast radius before confirmation | | Add: "This will affect N gardeners" or "Rejecting this removes it from the assessment" before destructive actions |
| 3.3 | **Autonomic actors surfaced?** On-chain state, sync status, and resolver activity are visible | | Show sync badges (queued/syncing/confirmed), transaction status, indexer freshness |
| 3.4 | **Surrogate supported?** Can an operator act on behalf of a gardener? | | Check if flows work when user ≠ author (e.g., operator submitting for a gardener without a phone) |
| 3.5 | **Multi-archetype transitions?** UI adapts when user changes role (gardener → operator) | | Role-switch should update available actions without full navigation. Use role context from Hats |

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
| **Command** | `bg-card` (solid) | `border-border` (visible) | `text-foreground` (high contrast) | `shadow-sm` to `shadow-md` |
| **Ambient** | `bg-card/60 backdrop-blur-xl` | `border-border/30` (subtle) | `text-muted-foreground` | `shadow-none` |
| **Data Landscape** | `bg-background` | `border-border/50` | `text-foreground` | Variable by depth |
| **Conversational** | `bg-transparent` | `border-none` | `text-foreground` | `shadow-none` |

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
```

---

## Closing the Loop — Automated Enforcement

Each lens has a manual review pass AND a set of automated checks that can run in CI or Storybook. Wire them up so the checklist isn't the only defender.

| Lens | Manual Review | Automated Enforcement | Where It Runs |
|------|--------------|----------------------|---------------|
| **1 — Regenerative** | Motivation filter + degen/regen pattern table | Lint rule forbidding banned terms (`streak`, `countdown`, `leaderboard`, `FOMO`) in user-facing strings; grep CI check on i18n files | `packages/shared/src/i18n/*.json`, Biome custom rule |
| **2 — Spatial** | Paradigm declared, material thickness matches content density | Chromatic visual regression for material/paradigm stories; Storybook `tags: ["paradigm-*"]` for filtering; `@container` coverage via eslint-plugin-css-query | Storybook + Chromatic CI |
| **3 — Ecosystem** | Archetype mapping, cascade visibility, surrogate flows | Playwright role-based flows (gardener / operator / evaluator / funder); vitest tests that exercise surrogate submission paths; indexer schema checks for archetype-spanning entities | `packages/*/src/**/*.spec.ts`, `e2e/*.spec.ts` |
| **4 — Compliance** | WCAG 2.1 AA, i18n readiness, responsive breakpoints | `@storybook/addon-a11y` fail on violations; `intl-lint` for missing translation keys; Storybook `@viewport` tests at 320/768/1280; `prefers-reduced-motion` vitest matcher | Storybook addons, Vitest, CI |

### Quick wiring reference

```bash
# Lens 4 — accessibility gate in Storybook CI
bun --filter @green-goods/shared test-storybook --failOnA11yIssues

# Lens 2 — visual regression on paradigm stories
bun --filter @green-goods/shared chromatic --only-changed --exit-zero-on-changes=false

# Lens 1 — lint banned vocabulary in user strings (streak/countdown/leaderboard/FOMO/…)
bun run lint:vocab

# Token-spec drift — Warm Earth spec ↔ theme.css + version coupling
bun run check:design-tokens
```

### Why automate

A checklist agents run once per PR catches what we remember. Automated checks catch what we forget. The combination is the whole system — manual review for judgment, CI for vigilance.

**Implementation notes**:
- `lint:vocab` runs `scripts/check-i18n-vocab.sh` against `packages/*/src/i18n/*.json`. Biome's linter is disabled repo-wide so a shell grep is the practical substitute; wire it into pre-commit + CI.
- `check:design-tokens` runs `scripts/check-design-tokens.sh`, which verifies every spec'd Warm Earth token (springs, materials, border) exists in `theme.css` AND that `token_version` is in sync across `design/SKILL.md`, `ui/SKILL.md`, and `.claude/registry/skills.json`.

---

## Related

- Regenerative principles: [regenerative.md](./regenerative.md)
- Spatial patterns: [spatial.md](./spatial.md)
- Ecosystem archetypes: [ecosystem.md](./ecosystem.md)
- Compliance details: [../ui/compliance.md](../ui/compliance.md)
- Green Goods personas: `docs/docs/reference/design-research.md`
