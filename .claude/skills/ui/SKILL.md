---
name: ui
user-invocable: false
description: UI implementation — TailwindCSS v4, Radix UI primitives, accessibility, Storybook, i18n, diagrams. Implements the direction set by the `design` skill. Use for theming, component composition, accessibility compliance, stories, internationalization, or creating diagrams.
version: "1.4.1"
design_token_version: "2.3.0"
status: active
packages: ["shared", "client", "admin"]
dependencies: ["design"]
last_updated: "2026-04-17"
last_verified: "2026-04-17"
changelog:
  - "1.4.1 — Added 10-step New Component Runbook (single golden path replacing scattered steps). Part 3 Dialogs now names DialogShell (shared, default) and AdminDialog (admin, strict M3) with file paths. Admin Cockpit Mode trimmed to ui-implementation specifics, pointing back to design/SKILL.md § Admin Cockpit Carve-Out as canonical. Registry design_token_version synced to 2.3.0 (was drifted at 2.2.0). Spring motion tokens now real in theme.css."
  - "1.4.0 — Added view-transitions.md (inherited from former design/implementation.md — execution details belong here, not in design). design_token_version pinned to design skill 2.3.0. Material tokens (--color-material-*, --blur-material-*) now implemented in theme.css; compliance guidance should reference them over hardcoded glass values."
  - "1.3.0 — Part 1 replaced with pointer to design skill. Design Thinking and Green Goods Aesthetic Tokens moved wholly to design/language.md and root DESIGN.md to eliminate duplication."
---

# UI Skill

Unified UI development guide: design thinking, component development, TailwindCSS v4, Radix UI, accessibility, Storybook, i18n, and diagrams.

## Activation

| Domain | Keywords / Triggers | Sub-file |
|--------|-------------------|----------|
| **Design & Aesthetics** | build UI, component, page, visual polish, animation, layout | This file (Parts 1-3) |
| **TailwindCSS** | theme, tokens, dark mode, CSS config, `@theme`, responsive utilities | [tailwindcss.md](./tailwindcss.md) |
| **Radix UI** | dialog, select, popover, accordion, accessible primitive, `asChild` | [radix-ui.md](./radix-ui.md) |
| **Accessibility & Compliance** | WCAG, a11y, form validation, responsive, reduced motion, safe areas | [compliance.md](./compliance.md) |
| **Storybook** | story, stories, CSF3, play function, visual regression, story authoring | [storybook.md](./storybook.md) |
| **Storybook Addons** | a11y addon, theme switching, design system docs, MDX | [storybook-addons.md](./storybook-addons.md) |
| **Storybook Testing** | visual regression, Chromatic, interaction testing, responsive stories | [storybook-testing.md](./storybook-testing.md) |
| **i18n** | translation, react-intl, locale, RTL, Browser Translation API | [i18n.md](./i18n.md) |
| **View Transitions** | view transition API, entity morphing, route navigation | [view-transitions.md](./view-transitions.md) |
| **Diagrams** | mermaid, flowchart, sequence diagram, state diagram, ERD | [mermaid.md](./mermaid.md) |

When invoked:
- Choose a clear aesthetic direction before writing code.
- Preserve existing Green Goods design tokens when working in existing views/components.
- Pair design work with compliance checks (accessibility + responsive).
- All shared components need Storybook stories.
- Dedicated Storybook authoring now routes through this skill. Do not use a separate storybook agent.

---

## Part 1: Design Direction Pointer

**Design direction, paradigm selection, spatial patterns, material language, and aesthetic tokens are owned by the `design` skill.**

- **Warm Earth language** (shape, motion, color, material behavior, hero moments) — [`.claude/skills/design/language.md`](../design/language.md)
- **Role hierarchy** (canvas / ink / stone / green-as-tertiary-accent) — root `DESIGN.md` + [`design/language.md` § Color Direction](../design/language.md#color-direction)
- **Paradigm selection** (Command / Ambient / Data Landscape / Conversational / Ritual) — [`design/SKILL.md`](../design/SKILL.md)
- **AI prompt vocabulary** for admin cockpit — [`design/prompt-contract.md`](../design/prompt-contract.md)

Execution-level tokens live in `packages/shared/src/styles/theme.css`, `packages/client/src/styles/typography.css`, and `packages/client/src/styles/animation.css`. This skill focuses on *how* to express the direction in code — Tailwind, Radix, Storybook, compliance, i18n.

### Admin Cockpit Mode

The design identity (**restrained operator cockpit**, why-it's-different-from-client, vocabulary, never-use list) is canonical in [`design/SKILL.md § Admin Cockpit Carve-Out`](../design/SKILL.md#admin-cockpit-carve-out) and [`design/prompt-contract.md`](../design/prompt-contract.md). Read those first.

UI-level implementation rules that follow from that identity:

- **Layout default**: `PageHeader` → one primary workspace → optional secondary context in a sheet or rail. Start from layout and flow before reaching for `Card`.
- **Card usage**: cards and elevated surfaces are for records or bounded interactions, not the default page structure. Prefer one dominant workspace surface per route. Avoid nested stacks of rounded bordered panels.
- **Tokens**: shared semantic tokens + one workspace accent. No decorative gradients behind routine product UI.
- **Reference composition**: admin `/hub` route is the canonical cockpit layout — model new admin surfaces on it.
- **Dialogs**: use `DialogShell` from `@green-goods/shared` by default; reserve `AdminDialog` for strict M3 flows (see Part 3).

---

## Part 2: Component Development Workflow

1. **Check existing patterns** (`CanvasLayout`, `AccountSurface`, `RightSheet`, `PageHeader`, `ListToolbar`, `SortSelect`, `Surface`, `Card`, `Alert`, `FormField`)
2. **Develop reusable components in Storybook first** (`bun run storybook` in packages/shared)
3. **Follow Radix UI + tailwind-variants patterns** (see [radix-ui.md](./radix-ui.md))
4. **Run compliance checklist** before integration (see [compliance.md](./compliance.md))
5. **Test light/dark mode** via Storybook toolbar
6. **Verify admin routes in a real browser** for desktop and mobile when changing page-level composition
7. **Add i18n** for all user-facing strings (see [i18n.md](./i18n.md))

---

## New Component Runbook

Linear golden path from blank file to merge-ready. Collapses the rules otherwise scattered across the design + ui skills into one pass.

| # | Step | Decide / Do | Source |
|---|------|-------------|--------|
| 1 | **Paradigm** | Command / Ambient / Data Landscape / Conversational / Ritual. Declare in a one-line comment at top of file. | [design/SKILL.md § Paradigm Selection](../design/SKILL.md#paradigm-selection) |
| 2 | **Material** | Pick thickness by content density: ultrathin/thin = glanceable, regular = default, thick/solid = text-dense. Admin dense surfaces stay solid. | [design/materials.md](../design/materials.md) |
| 3 | **Shape** | Fixed (badges/avatars), Capsule (primary CTA, icon button), Concentric (nested: `child_radius = parent_radius − padding`). Shape alone creates hierarchy. | [design/language.md § Shape System](../design/language.md#shape-system) |
| 4 | **Motion** | Use `var(--spring-*)` tokens only. Never hardcode `cubic-bezier` or `duration`. Standard scheme for admin; Expressive only for client hero moments. | [design/language.md § Motion System](../design/language.md#motion-system) |
| 5 | **Primitive** | Compose from Radix + `tv()`. Dialogs → `DialogShell` (default) or `AdminDialog` (strict M3). | [radix-ui.md](./radix-ui.md), Part 3 below |
| 6 | **Responsive** | Container queries (`@container`, `@[480px]:`) for component-internal layout; `sm:` / `md:` for page-level. | [compliance.md](./compliance.md), [tailwindcss.md](./tailwindcss.md) |
| 7 | **A11y** | Label every input, associate errors via `aria-describedby`, color is never the sole indicator, hit targets ≥ 44px, focus management via Radix. | [compliance.md](./compliance.md) |
| 8 | **i18n** | Every user-facing string via `intl.formatMessage` / `FormattedMessage`. Update `en.json`, `es.json`, `pt.json`. No banned vocabulary. | [i18n.md](./i18n.md), `bun run lint:vocab` |
| 9 | **Storybook** | CSF3 story, `tags: ["autodocs"]`, include default + loading + error + empty variants + dark mode. | [storybook.md](./storybook.md) |
| 10 | **Review** | Run the four-lens review on self: Regenerative → Spatial → Ecosystem → Compliance. `bun run check:design-tokens` before merge. | [design/review-checklist.md](../design/review-checklist.md) |

**Admin-specific shortcut**: steps 1-4 are usually pre-answered — admin = Command Surface + solid material + M3 shapes + Standard motion. Start at step 5.

**Client-specific shortcut**: hero-moment components (garden creation, hypercert mint, …) override step 4 to Expressive motion and step 2 to dramatic material. See [design/language.md § Hero Moments](../design/language.md#hero-moments).

---

## Part 3: Implementation Patterns

All UI patterns use **Radix UI primitives** + **tailwind-variants** (`tv()`). See [radix-ui.md](./radix-ui.md) for Dialog, Select, Popover composition examples.

- **Dialogs**: two project wrappers sit on top of Radix `Dialog.*`:
  - **`DialogShell`** — the **client / shared** default. `packages/shared/src/components/Dialog/ConfirmDialog.tsx`, exported from `@green-goods/shared`. Props: `open`, `onOpenChange`, `title`, `description?`, `icon?`, `size` (`md|lg|xl|2xl`), `children`, `preventClose?`. Mobile bottom-sheet + desktop centered, `glass-floating`, handles `z-overlay`/`z-modal`. Use for client PWA and shared (non-admin) dialogs — never for admin dashboard dialogs.
  - **`AdminDialog`** — the **admin dashboard** default, strict M3. `packages/admin/src/components/AdminDialog.tsx`. Props: `open`, `onOpenChange`, `title`, `description?`, `icon?`, `children`, `actions?`, `size` (`sm|md|lg|xl|2xl`), `variant` (`standard|confirm|palette|flow`). Uses `--m3-shape-xl`, `--m3-surface-container-high`, `--m3-elevation-3`, 32% scrim. Use for all admin dashboard dialogs; the `palette` variant backs the command palette and the `flow` variant at `size="2xl"` backs full-surface action flows (Submit Work, Create Assessment, Create Hypercert).
  - Raw Radix `Dialog.*` namespace only when neither wrapper fits — see [radix-ui.md](./radix-ui.md) for composition rules.
- **StatusBadge**: `tv()` with `status` variants (active, pending, failed, offline) mapping to semantic colors with dark mode
- **Cards**: Compound pattern (`Card`, `Card.Header`, `Card.Body`, `Card.Footer`) with `tv()` variants for `interactive` and `elevated` -- used for GardenCard, WorkCard, ActionCard
- **Animations**: CSS animations (transform, opacity) via `animate-in`/`fade-in`/`slide-in` utilities. Staggered reveals with `animationDelay` for list items. Skeletons with `animate-pulse`.
- **Responsive layouts**: Mobile-first (`flex-col` -> `sm:flex-row`), `auto-fill` grids with `minmax()`

---

## Reference Files

| File | Content |
|------|---------|
| [tailwindcss.md](./tailwindcss.md) | TailwindCSS v4 CSS-first config, `@theme` directive, `@property` tokens, dark mode via `[data-theme]`, custom utilities, CSS file organization |
| [radix-ui.md](./radix-ui.md) | Radix primitive composition (Dialog, Select, Popover, Slot), namespace imports, built-in a11y, animation with `data-[state]` |
| [compliance.md](./compliance.md) | WCAG 2.1 AA checklist, form patterns (RHF + Zod), responsive breakpoints, container queries, reduced motion, images, mobile safe areas |
| [storybook.md](./storybook.md) | CSF3 story format, play functions, decorators, global configuration, story organization |
| [storybook-addons.md](./storybook-addons.md) | a11y addon rules, theme switching, component API docs with JSDoc, MDX pages, story hierarchy |
| [storybook-testing.md](./storybook-testing.md) | Visual snapshots, responsive stories, Chromatic CI, test runner, multi-step play functions, offline scenarios |
| [i18n.md](./i18n.md) | Hybrid translation (react-intl + Browser Translation API), ICU message syntax, domain hooks, RTL support, Intl formatting |
| [mermaid.md](./mermaid.md) | Diagram type selection, sequence/flowchart/class/ERD examples, canonical diagram locations, rendering platforms |

---

## Anti-Patterns

### Design
1. Shipping generic default UI without an explicit visual direction
2. Ignoring existing design tokens in established Green Goods surfaces
3. Prioritizing novelty over accessibility, readability, and interaction clarity
4. Using placeholder motion without intent (random micro-animations)
5. Creating visual complexity without corresponding information hierarchy

### TailwindCSS
6. Using `tailwind.config.js` instead of CSS-first v4 configuration
7. Using raw color values (`bg-green-500`) instead of semantic tokens (`bg-primary`)
8. Defining theme tokens in app packages instead of `packages/shared/src/styles/theme.css`
9. Skipping dark mode values for new color tokens
10. Using `prefers-color-scheme` instead of `[data-theme]` attribute

### Radix UI
11. Using `@radix-ui/themes` instead of primitives + TailwindCSS
12. Skipping `Dialog.Title` (required for accessibility -- use `sr-only` to visually hide)
13. Destructuring Radix imports instead of namespace imports (`Dialog.Root`, not `Root`)

### Accessibility & Compliance
14. Relying on color alone to convey state or validation failures
15. Shipping forms without accessible labels and error associations (`aria-describedby`)
16. Ignoring `prefers-reduced-motion` for animated interactions
17. Assuming desktop-only layouts without mobile verification

### i18n
18. Hardcoding user-facing strings instead of `intl.formatMessage()` / `FormattedMessage`
19. Forgetting to update all three language files (en.json, es.json, pt.json)
20. Using physical CSS properties (`margin-left`) instead of logical (`margin-inline-start`) for RTL

### Storybook
21. Skipping `tags: ["autodocs"]` on component stories
22. Hardcoding data in stories instead of using mock factories from test-utils
23. Skipping loading/error/empty state stories

---

## Decision Tree

```text
What kind of UI work?
|
+--> Design direction / visual identity?
|    --> design skill (language.md, SKILL.md, prompt-contract.md)
|    --> root DESIGN.md for role hierarchy and atmosphere
|
+--> New component?
|    --> Part 2 (Component Development Workflow)
|    --> radix-ui.md for primitives
|    --> storybook.md for story co-location
|    --> compliance.md before merge
|
+--> Theme / token / dark mode change?
|    --> tailwindcss.md (Parts 2-3)
|
+--> Accessibility audit?
|    --> compliance.md (Parts 1-2)
|    --> storybook-addons.md (a11y addon)
|
+--> Responsive layout issue?
|    --> compliance.md (Parts 3, 10)
|    --> tailwindcss.md (Part 4)
|
+--> Storybook story or visual regression?
|    --> storybook.md (writing stories)
|    --> storybook-testing.md (visual regression, Chromatic)
|    --> storybook-addons.md (addon config, design system docs)
|
+--> Translation / i18n?
|    --> i18n.md (react-intl + Browser Translation API)
|    --> compliance.md Part 6 (i18n checklist)
|
+--> Architecture / flow diagram?
|    --> mermaid.md (diagram type selection)
|
+--> Animation / motion?
|    --> This file, Part 3 (Implementation Patterns)
|    --> compliance.md Part 4 (reduced motion)
```

---

## Related Skills

- `react` -- Component composition, state management, React 19 APIs, performance optimization
- `testing` -- TDD workflow, Vitest patterns, React Testing Library
- `data-layer` -- Offline-first patterns, IndexedDB, sync state that integrates with UI
- `react` (error-handling sub-file) -- Toast service, mutation error handlers, user-facing error messages
- `react` (performance sub-file) -- Bundle budgets, re-render optimization, virtualization
