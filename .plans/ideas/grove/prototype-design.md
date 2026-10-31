# Grove design brief: the workbench dialect

**Status:** design direction agreed on 24 October 2026; nothing built. **Updated:** 24 October 2026.
**Companion to:** [prototype.md](prototype.md) (what and why) and [prototype-architecture.md](prototype-architecture.md) (how). This document owns how Grove looks and behaves. At G1 it becomes `packages/extension/DESIGN.md`, an overlay of the root [DESIGN.md](../../../DESIGN.md) in the same form as the cockpit's and the installed app's briefs (`extends`, `surface`, `dialect` in its front matter), and the [design decision log](../../../.claude/skills/design/decision-log.md) gets its rows.

Grove is not a third design system. The app and cockpit unification left one language, Warm Earth, with a shared core that is identical on both surfaces and a short list of dials each surface sets. Grove takes the core verbatim and sets the dials the way the cockpit does. It is the cockpit's language on a graph: the steward's companion, not a new product.

## Surface identity

| Mode | Audience | Metaphor | Paradigm | Navigation |
|---|---|---|---|---|
| Extension tab, desktop | Stewards | The map table in the potting shed: the garden's knowledge spread out, pinned and annotated | Data Landscape for the canvas, inside a Command Surface frame for the toolbar and inspector | One workspace per garden; a breadcrumb and a Back control; no nav dock, no speed dial, no bottom bar |

The cockpit litmus test applies: if a move would be inappropriate for Linear, GitHub or Stripe's dashboard, it is inappropriate here. The second test is Grove's own: if a move makes the canvas louder than the knowledge on it, it is wrong.

## The three tiers

**Shared core, taken as is.** The linen canvas and white cards in light, the one warm dark ladder in dark (the card ten points of lightness above the canvas with an 8% ring, DL-097). Plus Jakarta Sans with the `type-*` roles (DL-096). The status palette and `StatusBadge` at its one size. Capsule chips with the solid selected fill and no check mark (DL-065). The app's equal-width tinted tabs. The one 16px count badge at 11px semibold (DL-099). The control-grade outline `--gg-control-outline` and the one focus-ring role drawn as a solid 2px ring with a 2px offset (DL-098). The shared empty, loading and error anatomy (`EmptyStateShell`). The garden context chip (`GardenChip`). Toasts, alerts, addresses and names.

**Dials, set to the cockpit's values.**

| Dial | Grove's setting | Where it comes from |
|---|---|---|
| Density | 14px body on the cockpit's type roles: `type-title-lg` 22/28, `type-title-md` 16/24, `type-body` 14/20, `type-label` 14/20 at 500, `type-meta` 12/16, `type-meta-sm` 11/16; controls 40/32/28; 44px hit areas | The cockpit column of the root type-role table; shared controls carry `data-surface="admin"` |
| Button corner | Pill at every emphasis; fill, outline and color carry emphasis; label weight 500 | F3, DL-026 |
| Card and panel corner | 12px; concentric children by `child = parent − padding`; radius tops out at 16px | F7, the cockpit's shape scale |
| Motion | Named spring tokens only; interactive surfaces step elevation, never scale-press; the canvas camera moves on `--spring-spatial`; no perpetual simulation | The cockpit's carve-out in the design skill; the hub's visual contract |
| Accent | The garden tone on the five-use budget (next section) | The cockpit's accent model |
| Copy voice | The steward's: utility copy, sentence case, the product's terms | Brand voice; the cockpit's voice |

**Never crosses into Grove.** Hero moments, haptics and the press morph (app only). The speed dial, the translucent dock and the workspace switcher (cockpit shell only). The editorial serif (website only). Glass of any thickness: Grove has no chrome that earns it, so every surface is solid.

## Accent: the garden tone

Grove is garden knowledge, so it reuses the cockpit's garden tone roles rather than adding a palette: `--tone-action` (green-800) with `--tone-on-action`, the `--tone-primary-container` pair, `--tone-on-surface-accent`, `--tone-focus-ring` and `--tone-surface-tint-color`. The Hub's Garden workspace and Grove then match, and a steward moving between them sees one accent.

The five uses, mapped to Grove's chrome:

1. The active filter chip or tab in the query row.
2. One filled action per view: **Connect this garden** before a connection exists, **Share** in the share preview, nothing while the graph is simply being read.
3. The **New since your last visit** count badge.
4. The focus ring on every control and on the selected node or edge.
5. The canvas's new-item marker (the halo on a node or edge added since the seen cursor).

One atmospheric allowance, as in the cockpit: the faint top-of-canvas wash from `--tone-surface-tint-color` fading by 320px. Everything else is ink and stone. The 1 to 3 percent accent rule holds on the canvas as it does on a page: green is the flower, the graph is the garden.

Implementation note for G1: the tone roles live today in the cockpit's own token file (`packages/admin/src/styles/admin-m3-tokens.css`), which the extension must not import. Lift the garden tone roles into Shared's `theme.css` under the same `[data-tone="garden"]` selector so the Hub and Grove read one source; until that lands, Grove declares the same role names from the Shared green ramp and the decision log records the interim.

## Reading the canvas

Sigma draws with values, not classes, so the canvas reads its colors, sizes and fonts from the live CSS tokens through `getComputedStyle` at mount and on theme change, and never hardcodes a hex. Dark mode and the tone follow the page.

| Element | Treatment | Meaning carried by |
|---|---|---|
| Garden | Fixed circle, ink fill, the largest size | Shape and label |
| Action | Squircle, ink outline | Shape, icon, label |
| Work | Rounded rectangle, ink outline; its approval state as a small `StatusBadge` glyph in the inspector, not on the node | Shape, label |
| Source | Document shape, stone outline, the domain shown as the favicon or a document icon | Shape, label |
| Question | Outlined circle, stone | Shape, label |
| Planned activity | Dashed outline, stone, the `Planned` label always visible | Shape, dash, label |
| Concept | Small stone dot with a label | Size, label |
| Proposed edge | Dashed stone line | Dash |
| Accepted edge | Solid ink line | Weight |
| Rejected edge | Hidden by default; filter reveals it dotted | Filter state |
| Superseded edge | Only in the history view, stone, thin | View |
| New since last visit | A tone-colored halo on the node or edge and a line in the strip | Halo plus text |
| Selected | The focus-ring color as a 2px ring at a 2px offset, the same as a focused control | Ring plus the inspector |
| Peer-suggested | The proposed treatment plus the origin line in the inspector (`Suggested by another garden's node`) | Inspector text |

Never meaning by color alone: every state above has a shape, a dash, a weight or a label. Labels sit on the canvas at `type-meta` and promote to `type-label-sm` for the selected neighborhood; unrelated edges fade to 40% ink on selection and return on deselect, on `--spring-effects`. Positions are deterministic at first placement and saved afterwards; a new node settles near its connected context once and stays. Camera and selection survive deltas, filters and the history comparison.

## The workspace

One React application in the graph tab, built from the Shared primitives the cockpit uses and nothing invented. Regions, top to bottom:

| Region | Component recipe | Notes |
|---|---|---|
| Top bar | A plain solid bar on the canvas: `GardenChip`, the workspace name, connection state as a `StatusBadge`, the single filled action; right-aligned utility icons as the cockpit's `IconButton` set, identical styling and hover | No translucent chrome; no avatar, since Grove has no account |
| Query row | The cockpit's inline filter chips (F9 kept the cockpit's control): kind, status, origin; a text query field at 40px; a **List** toggle | Chips are capsules; selected is the solid tone fill |
| Canvas | Z1 ground, solid linen; the graph; the breadcrumb and **Back to topic** as text controls in the top-left corner | The one place Grove is itself |
| Result list | The same results as text in a 12px-corner panel over the canvas's right edge, keyboard first | Equal-height rows, the one 12px list gap (F11) |
| Inspector | A solid 12px-corner pane docked right, Z2; node or edge title at `type-title-md`, the evidence quote as a block in `type-body` with the source link, the review actions as one row (filled only when a decision is pending), the planned-activity form with the shared field anatomy (outlined, label above, one message line) | Thickens to a centered `DialogShell` only for the share preview and the destructive confirmations |
| New-since strip | A thin solid strip under the top bar with the count badge and a **Mark as seen** text action | Appears only when the count is above zero |
| Investigation status | A `StatusBadge` on the source node's inspector header: `Saved`, `Finding connections`, `Paused`, `Ready for review`, `Needs attention` | One size, the cockpit's chip size |
| Connection panel | A centered `DialogShell` from the top bar: garden source toggle, community node URL and key fingerprint, the node's identity, the allowlist | Settings, not a workspace |

Dialogs: the extension can import only Shared, so its centered dialogs are the shared `DialogShell` and `ConfirmDialog` at the cockpit density, not the cockpit's own `AdminDialog`. G1 checks that the two read the same at desktop widths and records any gap in the decision log. Every string goes through the extension's `react-intl` catalog in `en`, `es` and `pt`.

## States

Every state keeps the graph visible; none replaces it with a chat or a dashboard.

| State | Treatment |
|---|---|
| No garden connected | `EmptyStateShell` on the canvas: what Grove holds, the one filled **Connect this garden** |
| Connected, empty neighborhood | The garden node alone with its Actions; the strip explains that sources will appear here |
| Saving, finding connections | The source node appears at once with its badge; no spinner over the canvas |
| Model unavailable or paused | The badge says so; the inspector offers **Link manually**; the graph stays queryable |
| Enrichment failed or abstained | `Needs attention` or `No connection found` on the source; the source stays saved |
| Partial import | The connection state badge reads `Partial` with the unavailable sources named in the panel |
| Stale review | The review row shows the conflict in place and offers to reload the record; the decision is not lost silently |
| Offline | The top bar's connection state reads `Offline`; everything cached works |
| Storage failure | The shared error anatomy, one line saying nothing was lost, and Try again; never a false `Saved` |

## Accessibility

Two modalities for every interaction: the canvas is never the only path, so the result list and the inspector reach every node and edge by keyboard, with visible focus in the one ring. Hit areas are 44px, including the canvas's node targets, which carry an invisible padding ring; a one-pixel edge is never the target, the edge's midpoint handle is. `prefers-reduced-motion` turns off the camera animation and the settle, and shows highlights at once. Contrast is measured on linen and on the dark ladder for every canvas color, and the labels read at `type-meta` against the canvas in both themes.

## Copy

The steward's voice. Sentence case. The product's own terms: `Suggested`, `Accepted by you`, `Rejected`, `Planned`, `Saved`, `Finding connections`, `Ready for review`, `Needs attention`, `New since your last visit`, `On this device`, `Suggested by another garden's node`. `Garden`, `Action`, `Work` and `WorkApproval` as record names; `garden` for the place. No claims the graph cannot keep: a connection is suggested or accepted, never verified; a completed investigation is never completed work.

## Proving it

Grove's dialect is proven where the unification was reviewed, before the extension exists:

1. A **Grove** page in the shared Storybook's Design System section (`packages/shared/.storybook/design-system/`), beside App, Website and Admin: the token table for the dials, the measured specimens for controls, chips, tabs, the count badge and the focus ring at the cockpit density, and the canvas legend above as a rendered specimen in light and dark.
2. Stories co-located with the graph tab's components in `packages/extension`, on the synthetic fixture: default, loading, error, empty and the review states, with the determinism rules of the implementation guide. G1 adds the extension's story glob to the shared Storybook.
3. The three directions the hub explored earlier (garden atlas, evidence map, seasonal memory) collapse into one: the garden atlas composition with the evidence map's inspector. The seasonal memory rail waits for the MVP's time scrubber.

## Do's and don'ts

- Do start from the Hub's garden workspace and copy its tokens and treatment; never extrapolate from a primitive's internals.
- Do keep the canvas quiet: ink, stone, one green for what is new.
- Do show the shape, the label and the badge before any color.
- Don't add glass, gradients, a hero, a KPI wall, a feed or a chat.
- Don't give Grove a bottom bar, a dock or a speed dial; it is a tab, not the cockpit's shell.
- Don't animate the graph continuously, and don't move a node the person did not move.
- Don't invent a component: if a piece is missing from Shared, flag it.

## Decisions recorded

Prototype decisions 22 to 25 in [prototype.md](prototype.md): the cockpit's dials; the garden tone on the five-use budget; ink, stone and accent-for-new on the canvas; Storybook Design System pages as the proof. Open for G1: the home of the tone roles, the desktop dialog parity between `DialogShell` and `AdminDialog`, and the exact canvas label sizes once Sigma renders real text at the cockpit's density.
