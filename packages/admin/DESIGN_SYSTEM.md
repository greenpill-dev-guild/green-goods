# Green Goods Admin Design System

This document is the contract for the admin cockpit UI.

## Baseline

- Structural baseline: Material 3 for hierarchy, layout, navigation, surfaces, forms, dialogs, states, and accessibility.
- Product polish: Apple HIG influence is limited to calmer density, restrained motion, and reduced chrome.
- Brand layer: Green Goods stays distinct through regenerative imagery, stewardship language, impact framing, treasury transparency, and garden-specific hero surfaces.

## Ownership Model

- `packages/shared` owns reusable foundations:
  - tokens and theme aliases
  - form fields and selects
  - buttons, alerts, empty states, status badges
  - reusable cards and dialog shells
  - cockpit foundations such as `TopContextBar`, `NavigationBar`, `GardenChip`, `SideSheet`, `BottomSheet`, and `SheetErrorBoundary`
  - Storybook documentation for foundations
- `packages/admin` owns admin-specific composites:
  - `CockpitLayout`, `SettingsSheet`, `UserAvatar`, `ConnectShell`, `CommandPalette`, and `PageHeader`
  - page headers and shell composition
  - garden-detail hero, rails, and workbench compositions
  - domain workflows and feature-specific screens

If a pattern appears across multiple admin page families, it belongs in `shared`.

## Codex Defaults

- Canonical shell: `CockpitLayout`
- Wave 3 shell contract: `TopContextBar + .workspace-canvas + NavigationBar`
- Legacy for new work: `DashboardLayout`, `Sidebar`, `Header`
- Prefer shared/admin primitives before inventing new shell or surface patterns.

## Preferred Primitives

- `TopContextBar`
- `NavigationBar`
- `GardenChip`
- `CommandPalette`
- `SettingsSheet`
- `UserAvatar`
- `ConnectShell`
- `SideSheet`
- `PageHeader`
- `ListToolbar`
- `SortSelect`
- `Card`
- `Alert`
- `StatusBadge`
- `FormField`
- `DialogShell`

## Surface Primitives

- `.surface-section` creates a rounded-xl, full-width page grouping with responsive padding.
- `.surface-inset` creates rounded-lg nested panels inside a section.
- `.surface-card` creates rounded-lg interactive tiles with hover elevation.
- `.workspace-canvas` is the main workspace background treatment with the cockpit dot-grid canvas.

## Page Families

| Family | Required Structure | Notes |
| --- | --- | --- |
| List page | `PageHeader + ListToolbar + filters/sort + loading/empty/error + results` | Use shared toolbar, empty state, alert, and card primitives. |
| Detail / workbench | `PageHeader` or garden hero + `main / rail` layout | Preserve Green Goods hero treatments, but resolve cards, states, filters, and dialogs back to shared foundations. |
| Operational page | `PageHeader + tabs + status workspace cards` | Contracts, deployment, and treasury views should communicate status with icon + text + color. |

## Surface, Type, Shape, Motion

- Surface hierarchy:
  - page canvas uses the lowest-emphasis surface
  - working cards, dialogs, and sheets use container surfaces
  - featured or brand-forward sections may step up one emphasis level
- Shape:
  - controls use the small radius tier
  - cards, dialogs, and sheets use the medium radius tier
  - hero banners and featured containers may use the large radius tier
- Type:
  - page titles and section headings must communicate hierarchy through role, not decoration
  - body text stays calm; emphasis comes from spacing and surface contrast first
- Motion:
  - short, utility-driven transitions only
  - no decorative bouncing, elastic movement, or novelty animation in admin
  - loading and state changes should feel deliberate and quiet

## Material Role Aliases

Green Goods semantic tokens remain canonical. Material aliases in `packages/shared/src/styles/theme.css` are additive documentation for alignment and future adoption.

| Material role | Green Goods token |
| --- | --- |
| `surface` | `--bg-white-0` |
| `surface-container-lowest` | `--bg-white-0` |
| `surface-container-low` | `--bg-weak-50` |
| `surface-container` | `--bg-soft-200` |
| `surface-container-high` | `--bg-sub-300` |
| `surface-container-highest` | `--bg-surface-800` |
| `on-surface` | `--text-strong-950` |
| `on-surface-variant` | `--text-sub-600` |
| `outline` | `--stroke-sub-300` |
| `outline-variant` | `--stroke-soft-200` |
| `primary` | `--primary-base` |
| `primary-container` | Green Goods brand container alias |
| `error` | `--error-base` |
| `state-hover/focus/pressed` | `--primary-alpha-10/16/24` |

## Green Goods Identity Layer

Green Goods should not fork Material primitives. It should infuse the system through:

- garden hero imagery and land-based visuals
- earth-forward tonal accents with green reserved for emphasis and healthy system state
- stewardship-oriented language instead of generic SaaS phrasing
- impact, community, treasury, and yield storytelling
- transparent operational status for funding, deployments, and governance

## Shell Contract

- `CockpitLayout` is the canonical Wave 3 shell with three regions: sticky `TopContextBar` (`z-40`, `h-14`) at the top, `.workspace-canvas` for the main workspace, and bottom-floating `NavigationBar` (`z-30`).
- `TopContextBar` renders `GardenChip` on the left and desktop search, settings, and `UserAvatar` on the right.
- `NavigationBar` is pure navigation only. It accepts `slots`, `activePath`, and `onNavigate`; it does not take leading or trailing slots. The canonical items are `Work`, `Garden`, `Community`, and `Actions`.
- `UserAvatar` is a 40px circular button that shows the role initial (`D`, `O`, or `U`) and opens `SettingsSheet`.
- `ConnectShell` is the disconnected full-screen shell with a centered connect prompt and no navigation.
- `CommandPalette` and `SettingsSheet` handle global search and cockpit settings; shared sheets such as `SideSheet` support secondary flows.
- Sticky headers are allowed where they improve task continuity.
- Sticky `PageHeader` variants use `backdrop-blur-lg` and `shadow-elevation-1`.
- Chain, role, and status context must stay legible without relying on color alone.
- Top-level pages should feel like members of one system, not bespoke one-off compositions.

## Migration Rules

- `DashboardLayout`, `Sidebar`, and `Header` are legacy references for migration work, not starting points for new UI.
- Raw `rounded border bg shadow` recipes are a migration smell when a shared primitive exists.
- New dialogs should start from shared dialog shells.
- New list pages should start from `PageHeader`, `ListToolbar`, shared feedback states, and shared cards.
- New status UI must use icon + text + color.
- Storybook coverage is required for shared foundations and curated admin shell components.
