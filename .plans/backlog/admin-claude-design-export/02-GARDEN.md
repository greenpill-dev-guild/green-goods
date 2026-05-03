# 02 — `/garden` · Single-garden management

> **Read `00-SYSTEM.md` first.** This file scopes the per-view session for the Garden workspace.
> **Files to include in this session**: `00-SYSTEM.md` + this file + `reference-image.png` + design system files + `screenshots/shell/` + `screenshots/primitives/` + `screenshots/tokens/` + `screenshots/garden/`.

---

## 1. Route identity

`/garden` is the **single-garden management surface** — where an operator configures and observes one specific Garden.

**Audience**: a garden operator setting up or maintaining their garden's metadata, member roster, role assignments, action catalog, hypercert lineage, and yield distribution.

**Workflow**: not sequential like Hub. The Garden view presents a stable home for one Garden's record. Operators jump between sub-sections by intent: "I need to add a member" → Members; "I need to mint a hypercert" → Hypercerts; "what's our impact look like?" → Impact.

---

## 2. Content shape

The Garden route has **multiple sub-sections** the operator switches between. Treat them as tabs or rail segments — this is one of the variation levers (§ 4.1).

Sections include:

- **Overview** — at-a-glance summary: garden metadata, member count, recent activity, current cycle.
- **Members & Roles** — roster of gardeners + operator role assignments (Hats Protocol).
- **Settings** — garden name, description, domain (ENS), location, action catalog selection.
- **Impact** — assessments and hypercerts minted by this garden.
- **Yield** — supporter pool balances, yield split history.
- **Supporters** — list of community supporters and their contributions.

Not all of these need to be tabs — some can roll up into "Configuration" or "Impact" parent groupings.

**Selecting an item** (e.g., a member, a hypercert): opens a `RightSheet` or `AdminDialog` with detail.

**Density**: this view is reference-heavy, not queue-heavy. More text + numbers, fewer photos than Hub.

---

## 3. Reference grammar applied to Garden

The reference image is `/hub`-shaped. For Garden, **adapt** the grammar:

- **No photo collage** at the top of cards — Garden content is mostly textual (settings, roles, balances).
- **Replace the photo identity** with a **garden chip** (avatar/emoji + garden name + member count).
- **Keep** the restrained green accent, segmented tabs (if you go tabbed in § 4.1), floating chrome, FAB, soft warm canvas.
- **Status dots** can still indicate progress (e.g., setup checklist completion, hypercert mint state) — adapt to context.

The card grammar inherits Hub's *spirit* (identity-first + state-second + meta-third) without literal photo collages.

---

## 4. Tier 3 axes most relevant for Garden

Lean on **2 of these 3** for your two variations:

### 4.1 Sub-section navigation

How does the operator switch between Overview / Members / Settings / Impact / Yield?

- **Top tab rail** (matching Hub) — 4–6 tabs across the top of MainSheet.
- **Left rail navigation** inside MainSheet — sticky vertical list, content fills the right side. Better for 6+ sections.
- **Single-page scroll** with sticky section headers (Linear-style) — operator scrolls through everything; sections collapse/expand.
- **Hub-style overview + drill-down sheets** — Overview shows summary cards; clicking a card opens a `RightSheet` for that section's deep view.

### 4.2 Page header weight

Garden has more identity weight than Hub (it represents *one* garden, not a queue):

- **Compact**: garden chip + name + secondary action (Edit). Minimal.
- **Identity strip**: avatar + name + ENS domain + location + member count, in one row.
- **Identity strip + numeric strip**: identity row + numbers row (e.g., "23 gardeners · 47 hypercerts · 1.2k supporters · last assessed 3d ago").
- **Identity strip + recent activity**: identity row + a 3-event activity micro-feed.

### 4.3 Surface elevation strategy

Garden has nested content (sections within the page, then cards within sections). Variations:

- **Flat**: outline + token color shifts, zero shadow. Section boundaries via padding + faint dividers.
- **Tinted**: surface-tone steps (50 / 100 / 200) — section background slightly lighter than canvas, cards slightly lighter again.
- **Glass-edge**: thin highlight border on AppBar; flat surfaces below.
- **Shadow-as-border**: M3 elevation 1 for cards only; no nested elevation.

The two variations should pick distinct points — e.g., one variation = top tab rail + identity-strip header + flat surfaces; the other = left rail + identity + numeric strip + tinted surfaces.

---

## 5. Card composition for Garden

Cards in Garden carry textual / numeric content. Patterns:

- **Member card**: avatar + name + ENS + role chips (Operator / Gardener / Reviewer) + last-active.
- **Setting card**: label + current value + edit affordance.
- **Hypercert card**: hypercert ID + minted date + impact dimensions + status (active / archived) + small visual chart (optional).
- **Yield card**: pool name + current balance + token + last-distribution date + chart sparkline.

Each card has at most one primary affordance (open detail / edit). Multi-action cards split into list rows.

---

## 6. Empty / loading / error states

Show in at least one variation:

- **New garden, no members yet** — "Invite operators to start tending. Each invitation needs a wallet address."
- **Loading members** — skeleton roster.
- **Permission-denied** (gardener viewing operator-only Settings tab) — sub-section disabled with "Operators only" label.

---

## 7. Output format

Per `00-SYSTEM.md` § 6:

- **2 variations**
- For each: name + 200–300 word rationale (which 2 of the 3 Tier 3 axes, what the user gives up).
- Light + dark renders of `/garden` showing the Overview section + at least one detail section (Members or Settings).
- Token contrast table for dark mode.
- Composition note.
- Pixel-area budget check — accent green ≤ 3%.

---

## 8. Garden-specific success / failure criteria

**Good**:

- Garden feels like a *record* you maintain, not a feed you scroll.
- Sub-section navigation is one click away (no menu archaeology).
- Member roster and settings have visual hierarchy that distinguishes "who" from "what" from "how much."
- Identity (garden name + domain + location) is legible without scrolling.
- Dark mode preserves contrast on data-dense roster rows.

**Failed**:

- Garden looks like Hub with different cards (it's not the same shape — Hub is a queue, Garden is a record).
- Floods the page with cards that all look identical (member, setting, hypercert, yield should each have distinct visual identity).
- Adds a "Stats" / "Analytics" tab that doesn't exist (no `KPI dashboard` framing).
- Renames "Members" or "Operators" or "Hypercerts."
- Buries Settings in a hamburger / overflow menu instead of giving it equal weight.

---

End of Garden prompt.
