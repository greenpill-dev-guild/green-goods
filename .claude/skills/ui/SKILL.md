---
name: ui
description: UI development - design system, TailwindCSS v4, Radix UI primitives, accessibility, Storybook, i18n, diagrams. Use for frontend design, theming, component composition, accessibility compliance, stories, internationalization, or creating diagrams.
version: "1.1.0"
status: active
packages: ["shared", "client", "admin"]
dependencies: []
last_updated: "2026-04-12"
last_verified: "2026-04-12"
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
| **Diagrams** | mermaid, flowchart, sequence diagram, state diagram, ERD | [mermaid.md](./mermaid.md) |

When invoked:
- Choose a clear aesthetic direction before writing code.
- Preserve existing Green Goods design tokens when working in existing views/components.
- Pair design work with compliance checks (accessibility + responsive).
- All shared components need Storybook stories.
- Dedicated Storybook authoring now routes through this skill. Do not use a separate storybook agent.

---

## Part 1: Design Thinking

> For design direction, paradigm selection, spatial patterns, and material language, see the **`design`** skill. This section covers execution-level aesthetic guidelines.

### Frontend Aesthetics Guidelines

- **Typography**: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter. Pair a distinctive display font with a refined body font.
- **Color & Theme**: Commit to a coherent aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes.
- **Motion**: Use animations for effects and micro-interactions. CSS-only for HTML; Motion library for React. One well-orchestrated page load with staggered reveals creates more delight than scattered micro-interactions. Use scroll-triggering and hover states that surprise.
- **Spatial Composition**: Unexpected layouts. Asymmetry. Overlap. Diagonal flow. Grid-breaking elements. Generous negative space OR controlled density.
- **Backgrounds & Visual Details**: Create atmosphere and depth. Gradient meshes, noise textures, geometric patterns, layered transparencies, dramatic shadows, decorative borders, grain overlays.

NEVER use generic AI-generated aesthetics: overused fonts (Inter, Roboto, Arial, system fonts), purple gradients on white, predictable layouts, cookie-cutter design without context-specific character. No two designs should be the same.

### Green Goods Aesthetic Tokens

- **Color**: Primary green (#1FC16B) with earth-toned accents
- **Feel**: Organic, trustworthy, action-oriented (regenerative/nature)
- **Tokens**: Semantic tokens from `packages/shared/src/styles/theme.css`
- **Typography**: `packages/client/src/styles/typography.css` for existing hierarchy
- **Animation**: `packages/client/src/styles/animation.css` for existing motions
- **Consistency**: Shared tokens across client and admin, but admin surfaces should be quieter, denser, and more utility-led than public/client surfaces

### Admin Cockpit Mode

When the package is `admin` or the surface is an operator dashboard, cockpit, or workbench:

- Use utility copy, status language, and task framing. Do not write homepage, campaign, or executive-summary copy.
- Default layout is `PageHeader`, then one primary workspace, then optional secondary context in a sheet or rail.
- Start from layout and flow before reaching for `Card`.
- Cards and elevated surfaces are for records or bounded interactions, not the default page structure.
- Prefer one dominant workspace surface per route. Avoid nested stacks of rounded bordered panels.
- Use shared semantic tokens and one workspace accent. Do not introduce decorative gradients behind routine product UI.
- Use the admin `/hub` route as the reference composition for new cockpit surfaces.

---

## Part 2: Component Development Workflow

1. **Check existing patterns** (`CanvasLayout`, `AccountSheet`, `PageHeader`, `ListToolbar`, `SortSelect`, `Surface`, `Card`, `Alert`, `FormField`)
2. **Develop reusable components in Storybook first** (`bun run storybook` in packages/shared)
3. **Follow Radix UI + tailwind-variants patterns** (see [radix-ui.md](./radix-ui.md))
4. **Run compliance checklist** before integration (see [compliance.md](./compliance.md))
5. **Test light/dark mode** via Storybook toolbar
6. **Verify admin routes in a real browser** for desktop and mobile when changing page-level composition
7. **Add i18n** for all user-facing strings (see [i18n.md](./i18n.md))

---

## Part 3: Implementation Patterns

All UI patterns use **Radix UI primitives** + **tailwind-variants** (`tv()`). See [radix-ui.md](./radix-ui.md) for Dialog, Select, Popover composition examples.

- **Dialogs**: Radix `Dialog.*` namespace imports + `tv()` for overlay/content size variants (see [radix-ui.md](./radix-ui.md))
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
|    --> This file, Part 1 (Design Thinking)
|    --> Green Goods Aesthetic Tokens
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
