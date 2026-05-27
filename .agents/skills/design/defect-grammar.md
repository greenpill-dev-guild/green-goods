# UI Defect Grammar — Admin Surface

How Claude (and subagents) resolve casual admin-UI defect reports to an exact DOM node, token, and fix — without making the user memorize a formal template. The companion to `prompt-contract.md`: prompt-contract is how we talk **to** AI design tools; this is how Claude reasons **about** existing rendered admin UI.

> **For the user**: speak casually. "The card on Hub feels tight" is a valid input. The agent is responsible for resolving it to a canonical component and grounding the fix — see "Automatic component resolution" below.

## Automatic component resolution (agent behavior)

When the user reports anything off on an admin surface, the agent MUST resolve to a canonical `Admin*` wrapper or canvas region before proposing an edit. Never guess. Escalate in this order:

### Tier 1 — Live DOM via Brave-Backed Browser MCP (preferred)

If an admin tab is open in Brave through a Brave-backed browser MCP, read the rendered DOM to locate the target:

```js
// Via the available Brave-backed browser MCP JavaScript tool
Array.from(document.querySelectorAll('[data-component], [data-region]')).map(el => ({
  component: el.dataset.component,
  variant: el.dataset.variant,
  region: el.dataset.region,
  workspace: el.closest('[data-workspace]')?.dataset.workspace,
  route: location.pathname,
  text: (el.textContent || '').slice(0, 80).trim(),
  rect: el.getBoundingClientRect(),
}));
```

Narrow candidates by:

| User says… | Agent filters by… |
|------------|-------------------|
| "on Hub" / "in Garden" / etc. | `data-workspace` on CanvasLayout root |
| "at the top" / "top bar" | `data-region="canvas-area-top"` |
| "the main area" / "the content" | `data-region="main-scroll-area"` |
| "the bottom nav" / "tabs at bottom" | `data-region="canvas-area-bottom"` |
| "the card" | `data-component="AdminCard"` + visible rect |
| "the tabs" | `data-component="AdminTabRail"` |
| "the search" / "search bar" | `data-component="AdminSearchToolbar"` |
| "that button" / "the CTA" | `data-component="AdminButton"` or `AdminFab` |
| "the input" / "the field" | `data-component="AdminTextField"` (+ `data-variant`) |
| "the list item" / "the row" | `data-component="AdminListItem"` |
| "the chip" / "filter" | `data-component="AdminFilterChip"` |
| "the progress bar" | `data-component="AdminLinearProgress"` |
| "the modal" / "the dialog" | `data-component="AdminDialog"` |
| "the tooltip" | `data-component="AdminTooltip"` |
| "the badge" / "notification dot" | `data-component="AdminBadge"` |

### Tier 2 — Static grep (Brave-backed browser MCP unavailable, or page not open)

```bash
grep -rn 'data-component="Admin<X>"' packages/admin/src/views/<workspace>/
```

Use the casual-term mapping above, narrow to the workspace directory, and cross-reference with the user's description (position, adjacent labels, route).

### Tier 3 — Ask (last resort)

If Tier 1 + 2 do not narrow to a single candidate, ask in terms the user recognizes:

> "On `/hub`, is this the `AdminCard` in WorkSubmissions, or the `GardenCommunityCard` on the same view?"

Never ask the user to formalize their report in the grammar — that is the agent's job.

### Ground before editing

Before proposing an edit, form an internal defect statement using the template below and use it as the fix target. The user does not need to see or write this.

```
<Component> in <route/region> → <defect-type>: <expected> vs <actual>
```

If the user's description can't be mapped to a canonical `Admin*` wrapper or region, that itself is a finding: the composition probably uses raw HTML where a primitive is missing. Flag `missing-primitive` rather than inventing a local wrapper.

## Defect types

| Type | What it describes | First-check |
|------|-------------------|-------------|
| `spacing` | Padding, gap, margin. Includes concentricity (`child_radius = parent_radius − padding`). | M3 anatomy token + parent radius. |
| `alignment` | Horizontal/vertical alignment inside a container. | Flex/grid direction, `items-*`, `justify-*`. |
| `contrast` | Token pair mismatch (fg/bg), WCAG failure, disabled state too subtle. | Role token pair (`--m3-on-surface` over `--m3-surface-*`). |
| `state-layer` | Hover, pressed, focused, selected, disabled — missing, wrong opacity, or wrong color. | M3 state layer percentages (8/12/12/16). |
| `motion` | Duration, easing, orchestration — stutter, jump, missing entrance/exit, ignored `prefers-reduced-motion`. | `--spring-*` tokens. |
| `hierarchy` | Elevation, Z-layer, visual weight, order of attention. | Z-scale, 4-role volume ratio (canvas/ink/stone/green). |
| `typography` | Wrong role (`label-sm` vs `label-lg`), weight, line-height, font (Plus Jakarta vs Inter). | Role token in `theme.css`. |
| `responsive` | Breaks at a specific width/container size, overflow, missing truncation. | Container queries (`@[Npx]:`), Rule 11 breakpoints. |
| `a11y` | Missing `aria-label`, role, focus trap, keyboard trap, missing `prefers-reduced-motion`. | StatusBadge + FormField + Alert components. |
| `token-drift` | Raw color/radius/duration used where a token should be. Surfaced by `bun run check:design-tokens` / `bun run lint:vocab`. | `AGENTS.md § Design System` banned vocabulary. |
| `surface-identity` | Admin has glass outside the admin `AppBar`, or client copy leaks into admin, or vice versa. | `prompt-contract.md § Never Use`. |
| `missing-primitive` | A composition that SHOULD use a canonical `Admin*` wrapper uses raw HTML instead. | 13 `Admin*` wrappers in `prompt-contract.md`. |

## Casual → resolved examples

The left column is what the user says. The right column is the internal statement the agent produces after Tier 1/2 resolution, and uses to target the fix.

| User says | Agent's internal statement |
|-----------|----------------------------|
| "The card on Hub feels tight." | `AdminCard in /hub WorkSubmissions → spacing: expected p-4 (16dp) per M3 card anatomy, currently p-3 (12dp)` |
| "The top bar looks flat on Garden." | `canvas-area-top in /garden → hierarchy: AppBar lacks elevation-3 + --blur-material-regular separation from MainSheet below` |
| "The tabs on Community snap weirdly." | `AdminTabRail in /community → motion: sliding indicator uses ease-out 200ms instead of --spring-medium-* tokens` |
| "The input label looks wrong at phone width." | `AdminTextField (outlined) in LeftSheet create-garden form → responsive: floating-label notch overlaps outline below 400px container width` |
| "Something's off but I can't tell what." | Tier 3 — agent asks which workspace/region to focus on, then Tier 1s again. |

## Why this exists

Design-system updates do not automatically propagate to casual issue reports. Before `data-component` / `data-region` / `data-workspace`, a description like "the thing looks off" forced the agent to guess between 5+ candidate components; guesses miss, which is how "updates to the design system don't seem to address identified issues" happens.

The data attributes make the DOM self-identifying. This file tells the agent to **read them** (via Brave-backed browser MCP or grep) **before editing**, so casual user input maps to exact canonical targets. The grammar is a tool the agent uses on itself, not a vocabulary imposed on the user.

## Related

- [prompt-contract.md](./prompt-contract.md) — canonical admin vocabulary (components, workspaces, banned terms)
- [review-checklist.md](./review-checklist.md) — 4-lens PR review (Regenerative / Spatial / Ecosystem / Compliance)
- [language.md](./language.md) — full Warm Earth token + motion spec
- Project rules: `.claude/rules/frontend-design.md`
- Tooling: `bun run check:design-tokens`, `bun run lint:vocab`
- Brave-backed browser MCP tools: use the project `.mcp.json` `brave-devtools` server or a Brave-attached Claude browser extension. Never use Google Chrome, Chrome for Testing, Chromium, or Edge for Green Goods browser proof.
