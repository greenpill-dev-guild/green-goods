# 04 — `/actions` · Action catalog and configuration

> **Read `00-SYSTEM.md` first.** This file scopes the per-view session for the Actions workspace.
> **Files to include in this session**: `00-SYSTEM.md` + this file + `reference-image.png` + design system files + `screenshots/shell/` + `screenshots/primitives/` + `screenshots/tokens/` + `screenshots/actions/`.

---

## 1. Route identity

`/actions` is the **action template catalog** — where an operator selects which work-action templates are available for the gardeners in their garden(s).

**Audience**: a garden operator configuring the catalog. Lower-frequency than Hub (you visit Hub every session; you visit Actions every few weeks when adjusting what work counts).

**Workflow**: browse / search the catalog → select an Action → configure its parameters for the operator's garden → save. Actions has both *catalog* nature (browsing templates) and *settings* nature (configuration).

---

## 2. Content shape

- **Primary content**: a catalog of Action templates. Each template has:
  - **Icon** (the category visual — leaf for Agro, trash for Waste, sun for Solar, etc).
  - **Name** (e.g., "Plant native saplings", "Composting workshop", "Install solar panels").
  - **Category** (Agro / Waste / Solar / Water / Habitat / Education / etc).
  - **Short description** (1–2 sentences).
  - **Usage stat** ("used 47 times across 12 gardens" — informs operator confidence).
  - **Configuration state** (active / inactive / draft).

- **Selecting an action**: opens a `RightSheet` with the full template detail (parameters, evidence requirements, default impact dimensions) and a per-garden enable / disable toggle.

- **Filters / sort**: by category, by usage volume, by recency. Search by name.

**Density**: catalogs typically have 20–60 templates. Grid layout works.

---

## 3. Reference grammar applied to Actions

The reference image's photo-collage card grammar **does not apply** to Actions — templates don't have artifacts (they describe future work, not completed work).

- **Replace the photo collage** with the **category icon as visual anchor**. The icon *is* the identity.
- **Top-edge accent border** can still encode state: green (active), stone (inactive), amber (draft / needs config).
- **Restrained green accent** for active toggle state and primary affordances.
- **Segmented tabs** could split: All / Active / Inactive / Drafts.
- **Floating chrome** locked.

The Actions card is closer to a *catalog tile* than a Hub card. Think: "Action template card with icon, name, description, usage stat, status."

---

## 4. Tier 3 axes most relevant for Actions

Lean on **2 of these 3** for your two variations:

### 4.1 Card composition

- **Catalog tile**: large category icon (top-left) + name + 1-line description + usage stat + status dot. 3-column grid.
- **Catalog row**: icon + name + description + usage stat + toggle, in a single row. Table-ish, denser.
- **Categorized strips**: tiles grouped by category (Agro / Waste / Solar) with section headers + horizontal-scroll strips per category. iTunes-app-store-style browsing.

### 4.2 Catalog vs settings split

Actions has both browsing (catalog) and configuration (per-garden settings). How does the page resolve that duality?

- **Single-pane catalog**: tap a tile → opens RightSheet with config. Catalog stays primary.
- **Two-pane (master-detail)**: catalog list on left, selected action's config on right (always visible). Closer to Mac System Settings.
- **Two-tab top rail**: "Catalog" tab + "Configured" tab. Configured shows only the actions enabled for the operator's current garden.

### 4.3 Filter / sort / search affordances

- **Inline toolbar**: search + category dropdown.
- **Category chip group above grid**: "All / Agro / Waste / Solar / Water / Habitat / Education" — pill chips, multi-select.
- **Left-sheet filter rail**: category checkboxes + usage range + status filter + sort dropdown.

The two variations should pick distinct points — e.g., one variation = catalog tile + single-pane + chip filters; the other = catalog row + two-pane master-detail + left-sheet filters.

---

## 5. Page header weight options

Actions header is utility-flavored — operator wants to find a template fast:

- **Compact**: title + subtitle + search inline.
- **Title + numeric strip**: title + 3 numbers ("47 templates · 12 active · 3 drafts").
- **Title + category overview**: title + a thin category-distribution bar showing how many templates per category.

---

## 6. Empty / loading / error states

Show in at least one variation:

- **No actions configured** — "Activate templates to make them available to gardeners."
- **Loading** — skeleton tiles.
- **Search no-results** — "No templates match. Try clearing filters or browsing all categories."
- **Permission-denied** (gardener viewing operator-only configuration) — read-only catalog with toggles disabled.

---

## 7. Output format

Per `00-SYSTEM.md` § 6:

- **2 variations**
- For each: name + 200–300 word rationale (which 2 of the 3 Tier 3 axes, what the user gives up).
- Light + dark renders of `/actions` showing the catalog with 8–15 templates visible + at least one detail / config affordance shown (RightSheet open or master-detail right pane).
- Token contrast table for dark mode.
- Composition note.
- Pixel-area budget check — accent green ≤ 3%.

---

## 8. Actions-specific success / failure criteria

**Good**:

- Catalog feels browsable. The operator can find "the composting workshop template" in under 10 seconds.
- Category icon system is consistent — the same icon language used in Hub work cards.
- Active vs inactive vs draft state is legible at a glance (one accent dot or border, no badge soup).
- Configuration affordance is one click from the catalog tile.
- Dark mode preserves icon legibility (don't desaturate category icons).

**Failed**:

- Catalog looks like Hub work cards with photos (no photos in Actions).
- Renames "Action" to "Task" / "Activity" / "Mission" / "Challenge" (canonical vocabulary).
- Treats templates like blog posts (no `Featured` / `Latest` / `Trending` framing).
- Buries the configuration affordance in a 3-click menu drill.
- Adds a "Difficulty" / "Reward" / "Points" framing — gamification language banned.

---

End of Actions prompt.
