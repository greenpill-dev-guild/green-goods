# Handoff: Green Goods Admin — Cockpit Revamp

> **Bringing this into Claude Code?** The exact prompt to use is in **`CLAUDE_CODE_PROMPT.md`** — it tells Claude to audit your existing Storybook first and work bottom-up (tokens → atoms → organisms → screens) with reviewable PRs at each tier. Read that first.

> **For the developer:** the files in `screens/` are **HTML design references**, not production code to copy verbatim. Your task is to **recreate these designs as React + Tailwind components** in the target codebase, using the design tokens in `screens/tokens.css` as the source of truth. The HTML/JSX in this bundle was authored as a static prototype (Babel-in-the-browser) — treat it as a visual + structural spec, not a build target.

---

## 1 · What this is

Green Goods is a community/DAO-style admin tool for neighborhood gardens. The cockpit has four primary surfaces:

| Surface | Role |
|---|---|
| **Hub** | Operator dashboard — impact pipeline, quick stats, queues |
| **Garden** | A single garden's identity, plots, members, activity |
| **Community** | The federation view — proposals, members across gardens |
| **Actions** | Operator action queue (audit log + intake) |

A separate **UI Review** doc (see §3) proposes the **next iteration** — alignment fixes that should be applied during implementation, not as a follow-up.

---

## 2 · Fidelity

**High-fidelity.** Colors, typography, spacing, and component anatomy are all final. The HTML files are pixel-targeted prototypes. Recreate them pixel-perfectly using the codebase's React + Tailwind setup. The design tokens (`screens/tokens.css`) are the contract — keep their values exact (see §6).

---

## 3 · Two sources of truth — read in this order

1. **`screens/UI Review.html`** ← **the v2 spec.** Read this *first*. It documents:
   - Header anatomy alignment across the four views (eyebrow / title / identity slot / inline stats / action group)
   - The per-view tone system (subtle canvas wash; never tints headers)
   - The **conviction-voting redesign** (split your 100% across proposals; no for/against)
   - The **responsive FAB rule** (hidden on desktop; speed-dial on tablet/mobile)
   - Recap of exactly what to ship

2. **`screens/Hub.html` / `Garden.html` / `Community.html` / `Actions.html`** ← v1 screens.
   These show the current built state. They have **not** had the v2 deltas from UI Review applied yet. When implementing, treat the v1 screens as the "everything else" baseline and the v2 review as the targeted overrides.

> **In short:** implement the v1 screens, but where the UI Review proposes a delta (header slots, tones, conviction voting, FAB), apply the v2 version instead.

---

## 4 · Target stack

- **React 18+** with functional components and hooks
- **Tailwind CSS** for styling
- Tokens map: see `tokens.css` → either copy the CSS variables wholesale into `globals.css` and reference via `var(--…)`, **or** mirror them into `tailwind.config.js` `theme.extend`. The first option is preferred — it keeps the contract one-way and avoids drift.
- The prototype uses Plus Jakarta Sans + JetBrains Mono — keep these unless the host codebase mandates a different family.
- Use a real router (Next.js App Router or React Router) for screen-level navigation. The prototype is multi-file, but production should be one app.
- Skip the `<DesignCanvas>` / `<TweaksPanel>` wrappers — those are presentation chrome, not product UI.

---

## 5 · Screens

### 5.1 Hub
- **Purpose:** operator dashboard. Surfaces "what needs my attention" and a rolling impact pipeline.
- **Files:** `screens/Hub.html`, `hub-a.jsx`, `hub-a-refined.jsx`, `hub-b.jsx`, `hub-atoms.jsx`, `hub.css`, `hub-a-refined.css`, `hub-responsive.css`
- **Note:** Hub.html is a *design canvas* showing several variants side by side. The intended production version is the **`hub-a-refined`** variant (the most evolved one). Use `hub-a` and `hub-b` only as comparison reference.
- **v2 deltas to apply:** add an eyebrow slot to `hub-header-tight`; add inline header action buttons (matching Garden / Community); apply tone wash to canvas only.

### 5.2 Garden
- **Purpose:** single-garden detail view (identity strip, plots, members, activity feed).
- **Files:** `screens/Garden.html`, `garden-a.jsx`, `garden-atoms.jsx`, `garden.css`
- **v2 deltas:** keep `g-id-strip` as-is — already has identity slot, stats, and inline actions. Only the canvas tone changes (faintest green wash).

### 5.3 Community
- **Purpose:** federation view — proposals, cross-garden activity.
- **Files:** `screens/Community.html`, `community-a.jsx`, `community-atoms.jsx`, `community.css`
- **v2 deltas:**
  - Move the 3 chip-tile stats up into the page header as inline stats (matches Actions).
  - Replace `TallyBar` (for / against / abstain) with `ConvictionMeter` on proposal cards (see §7).
  - Add a `WeightAllocator` somewhere — either inline at the top of the proposals tab, or in a "My voting weight" sheet opened from the appbar.

### 5.4 Actions
- **Purpose:** operator action queue and audit log.
- **Files:** `screens/Actions.html`, `actions-a.jsx`, `actions-atoms.jsx`, `actions.css`, `sheet-system.jsx`, `sheet-system.css`
- **v2 deltas:** add an eyebrow slot to `act-page-header`. Inline stats are already correct.

### 5.5 UI Review (reference only — do not ship)
- **Purpose:** internal design doc explaining the v2 alignment moves.
- **Files:** `screens/UI Review.html`, `review.jsx`, `review.css`
- **Action:** read it, implement the deltas it proposes; do not ship the review surface itself.

See `screenshots/` for rendered captures of each surface.

---

## 6 · Design tokens — the contract

`screens/tokens.css` is the **single source of truth** for color, type, radii, spacing, and shadow. Ship its values verbatim. Do not round, swap, or "harmonize" against the host codebase's existing tokens unless the user says so.

Recommended integration:

```css
/* globals.css */
@import "./tokens.css";  /* or paste contents inline */

/* Tailwind utilities can then reference: */
.bg-canvas { background: var(--canvas); }
.text-ink  { color: var(--ink); }
```

Or in `tailwind.config.js`:

```js
theme: {
  extend: {
    colors: {
      canvas: 'var(--canvas)',
      surface: 'var(--surface)',
      ink: 'var(--ink)',
      // … mirror every token
    }
  }
}
```

**v2 additions** (to add when implementing the tone system — see DESIGN_NOTES):
```css
[data-tone="hub"]       { --tone-canvas: oklch(96.5% 0.008 240); }
[data-tone="garden"]    { --tone-canvas: oklch(96.5% 0.008 145); }
[data-tone="community"] { --tone-canvas: oklch(96.5% 0.008 50);  }
[data-tone="actions"]   { --tone-canvas: oklch(96.5% 0.008 30);  }
```
Tweak panel exposes `off | subtle | default` strength — implement as a CSS-variable scale on the wrapper.

---

## 7 · Conviction voting — the data shape change

This is the biggest functional change. The current proposal record uses `{ forV, againstV, abstainV }`. The v2 model is **conviction voting**: each member has 100% weight to allocate across active proposals, and conviction accrues over time on each proposal in proportion to the weight resting on it. A proposal passes when conviction crosses its threshold.

**Migrate proposal records:**
```ts
// before
type Proposal = { id; title; summary; forV; againstV; abstainV };

// after
type Proposal = {
  id: string;
  title: string;
  summary: string;
  conviction: number;      // 0–100, current accrued conviction
  threshold: number;       // 0–100, pass bar (per-proposal)
  dailyAccrual: number;    // % per day at current weight
  supporters: number;      // # of members with weight on this
  status: 'accruing' | 'passing' | 'funded' | 'withdrawn' | 'expired';
};
```

**Add a member field:**
```ts
type Member = {
  /* … existing fields … */
  weightAllocations: Record<string /* proposalId */, number /* percent */>;
  // invariant: sum(values) <= 100
};
```

**Components to add** (specs in `screens/review.jsx`):
- `<ConvictionMeter />` — single-bar accrual visualisation with threshold tick, accrual rate, ETA.
- `<WeightAllocator />` — list of active proposals with sliders/inputs that sum to 100%.
- `<ProposalCardConviction />` — replaces the for/against/abstain card layout.

The Activity feed's "decided" cards lose for/against tallies — withdrawing weight is the only opposing signal.

---

## 8 · Responsive FAB rule

| Breakpoint | FAB | Header actions |
|---|---|---|
| Desktop ≥ 1024px | **hidden** | inline ghost + primary buttons |
| Tablet 640–1023px | **visible** | collapsed into FAB; speed-dial if >1 creation flow |
| Mobile < 640px | **visible** (above navbar) | same as tablet |

Per-view dial composition is in `screens/UI Review.html` § 04 (see `<FabAuditTable />` in `review.jsx`).

---

## 9 · State management

The prototype mocks state inline. For production:

- **Per screen state** (filters, tab selection, modal open/close): React `useState` or URL params.
- **Domain state** (proposals, members, gardens, actions): use the host codebase's existing pattern — RTK Query, TanStack Query, Zustand, etc.
- **Member voting weight**: must be persisted server-side; the allocator component should debounce-save changes (300–500ms).

---

## 10 · Interactions & animations

- All transitions use the `--spring-effects-*` tokens in `tokens.css` (fast / med / slow).
- Tab switches: 180ms ease-out underline slide.
- FAB → speed-dial: 220ms staggered radial expand (40ms per item delay).
- Conviction meter fill: 600ms ease-out on weight change; instant on initial mount.
- Sheet/modal: 240ms slide-up on mobile, fade-and-scale on desktop.

---

## 11 · Assets

- **Fonts:** Plus Jakarta Sans + JetBrains Mono via Google Fonts. Self-host in production.
- **Icons:** the prototype uses inline SVG glyphs in atoms files. Swap for the host codebase's icon library (Lucide, Heroicons, etc.) at implementation time — match the visual weight (1.75–2px stroke).
- **No raster assets** are required by the design.

---

## 12 · Files in this bundle

```
design_handoff_admin-revamp/
├── README.md                    ← this file
├── DESIGN_NOTES.md              ← rationale for tone, conviction, FAB
├── INDEX.html                   ← open in browser to navigate prototypes
├── screens/                     ← the design references
│   ├── Hub.html
│   ├── Garden.html
│   ├── Community.html
│   ├── Actions.html
│   ├── UI Review.html           ← READ FIRST (v2 spec)
│   ├── tokens.css               ← THE CONTRACT
│   ├── *.css, *.jsx             ← supporting styles + components
├── context/                     ← original product/design briefs
│   ├── READ-ME-FIRST.md
│   ├── 00-SYSTEM.md             ← system overview
│   ├── 01-HUB.md, 02-GARDEN.md  ← per-screen briefs
│   ├── DESIGN.md, DESIGN.admin.md
└── screenshots/                 ← rendered captures of each screen
```

---

## 13 · Suggested implementation order

1. Set up the React + Tailwind shell, import `tokens.css` into globals.
2. Build the shared atoms first: button, chip, tab, filter, segmented control, search field, status pill — these recur across every view.
3. Build the **header** with all five slots (eyebrow / title / identity / stats / actions) as a single configurable component. Every view renders it with a different subset.
4. Build **Garden** first — it has the most evolved header + sidebar pattern; everything else borrows from it.
5. Build **Hub** (operator dashboard) and **Actions** (queue) — they share the table/list patterns.
6. Build **Community** last because it requires the conviction-voting components, which are net-new.
7. Layer in the tone system (CSS variable indirection on a `[data-tone]` wrapper) once all four screens exist.
8. Add the responsive FAB last — it's a thin wrapper, but verify on real tablet/mobile breakpoints.
