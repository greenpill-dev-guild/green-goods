# 03 — `/community` · Roster of gardens

> **Read `00-SYSTEM.md` first.** This file scopes the per-view session for the Community workspace.
> **Files to include in this session**: `00-SYSTEM.md` + this file + `reference-image.png` + design system files + `screenshots/shell/` + `screenshots/primitives/` + `screenshots/tokens/` + `screenshots/community/`.

---

## 1. Route identity

`/community` is the **portfolio surface** — where an operator who stewards multiple gardens (or works at the org level across gardens) sees the roster of gardens within their community.

**Audience**: an org-level operator viewing a federated set of gardens. Less common than Hub or Garden; Community is for operators who work across multiple Gardens within a coalition or org.

**Workflow**: scan the roster → drill into a specific Garden (which routes to `/garden?id=…`). Community is a *navigation* view first, a *summary* view second.

---

## 2. Content shape

- **Primary content**: a list / grid of Gardens.
- **Per Garden card**: garden chip (avatar + name) + ENS domain + member count + operator avatars (3–5 overlapping circles) + last-activity time + recent-impact micro-stat (e.g., "12 hypercerts").
- **Selecting a card**: routes to `/garden?id=<garden-id>` (full Garden management surface).
- **Filters / sort**: by activity recency, by member count, by domain alphabetical, by impact volume. Search by garden name or operator address.

**Density**: 8–40 gardens per page. Should feel like a roster (browsable), not a feed (chronological).

---

## 3. Reference grammar applied to Community

The reference image is `/hub`-shaped. For Community, **adapt** the grammar:

- **No photo collage** — Community is about garden *identity*, not work *artifacts*.
- **Garden as the visual anchor**: avatar (emoji or photo), name, domain. The garden chip *is* the identity.
- **Operator avatars overlaid** as a stacked circle group — communicates "who's tending this."
- **Restrained green accent** for primary affordances (open garden, search, FAB to invite a new garden / start a new community member).
- **Segmented tabs** could split by view scope: All Gardens / Active / Archived / Pending.
- **Floating chrome** matches the rest of admin — locked.

---

## 4. Tier 3 axes most relevant for Community

Lean on **2 of these 3** for your two variations:

### 4.1 Card composition

- **Roster card** (default): garden chip + ENS + members count + operator avatars overlaid + last-activity + impact stat. 3-column grid.
- **Roster row** (denser): same content in a single row — table-style with thumbnails. 12–20 rows visible.
- **Editorial card**: larger garden hero with a single full-width photo (if Garden has a banner image) + name + domain + member count. 2-column grid. Less dense, more identity-forward.

### 4.2 Filter / sort affordances

- **Inline toolbar**: search + sort dropdown (current admin pattern).
- **Pill chip filters above grid**: "All / Active / Archived" + sort dropdown.
- **Left-sheet filter rail**: sticky filter panel with member-count slider, activity range, domain text filter, impact-volume threshold. Persists per session.
- **Map mode toggle**: a list-vs-map toggle if Gardens have geographic identity (most do — they're tied to physical regions).

### 4.3 Density and grouping

- **Flat grid**: all gardens in one grid, sort applies globally.
- **Grouped sections**: gardens grouped by region / activity-tier / impact-volume, with collapsible section headers.
- **Pinned + grouped**: operator can pin frequently-visited gardens to the top; rest are grouped below.

The two variations should pick distinct points — e.g., one variation = roster card + flat grid + chip filters; the other = roster row + grouped sections + left-sheet filter rail.

---

## 5. Page header weight options

Community is a portfolio view — the header should communicate scope (which community, how many gardens):

- **Compact**: community chip + "Community" title + subtitle ("Gardens you steward"). Minimum.
- **Identity strip**: community avatar + name + member-garden count + total operator count + total impact volume.
- **Title + numeric strip**: title + 3 numbers ("23 gardens · 142 operators · 1.2k members").
- **Title + map**: title + a thin geographic strip showing where gardens are (if relevant).

Avoid: "Network" / "Federation" / "Portfolio" framing — stick with "Community" canonical vocabulary.

---

## 6. Empty / loading / error states

Show in at least one variation:

- **No gardens yet** — "Start a garden to begin your community."
- **Loading** — skeleton roster cards.
- **Permission-denied** (gardener-only operator viewing a multi-garden community they don't fully access) — disabled rows or filtered list.

---

## 7. Output format

Per `00-SYSTEM.md` § 6:

- **2 variations**
- For each: name + 200–300 word rationale (which 2 of the 3 Tier 3 axes, what the user gives up).
- Light + dark renders of `/community` with 6–12 garden cards / rows visible.
- Token contrast table for dark mode.
- Composition note.
- Pixel-area budget check — accent green ≤ 3%.

---

## 8. Community-specific success / failure criteria

**Good**:

- Roster feels scannable. The operator can answer "which garden has the most active operators right now?" in under 5 seconds.
- Garden identity (avatar + name + domain) is legible at every density.
- Operator-avatar stack reads as "who tends this" without explanation.
- Filters help the operator slice — they don't hide content behind menus.
- Dark mode preserves contrast on stacked operator avatars (don't lose the avatar borders).

**Failed**:

- Cards look like Hub work cards (no work artifacts here).
- Adds "Network" / "Federation" / "Portfolio" framing or vocabulary.
- Buries garden ENS domain (it's the canonical handle).
- Treats gardens as if they were users (no `Profile` framing).
- Adds a "Trending" / "Featured" / "Recommended" section (engagement-hack vocabulary, banned).

---

End of Community prompt.
