# 01 — `/hub` · Operator pipeline

> **Read `00-SYSTEM.md` first.** This file scopes the per-view session for the Hub workspace.
> **Files to include in this session**: `00-SYSTEM.md` + this file + `reference-image.png` + design system files + `screenshots/shell/` + `screenshots/primitives/` + `screenshots/tokens/` + `screenshots/hub/`.

---

## 1. Route identity

`/hub` is the **operator pipeline** — where garden operators review, assess, and certify the work their gardeners have submitted.

**Audience**: a garden operator opens Hub at the start of their session to see what's queued for them across all the gardens they steward. This is the highest-traffic admin route.

**Workflow** (the four tabs, left-to-right):

1. **Review** — incoming work submissions awaiting first-pass operator approval. Cards show the submitted work artifacts (photos, location, narrative) and the operator marks each accepted / rejected / needs-info.
2. **Assess** — approved work waiting to be bundled into an *assessment* (a quantified impact summary). Operators group related work and assign measurement.
3. **Certify** — assessments ready to mint as on-chain *hypercerts*. Operators confirm the impact narrative and cryptographically certify.
4. **History** — cross-category feed of recent events (work + impact + community) in the selected garden. Read-only timeline.

The Hub workflow is sequential — work moves Review → Assess → Certify → archived under History.

---

## 2. Content shape

- **Primary content per tab**: a queue / list of work or assessments.
- **Per row**: a card bearing media (1–4 photos), a category badge (Agro / Waste / Solar / Water / Habitat / etc), title, author + garden, status, time, pipeline progress.
- **Selecting a card**: opens a `RightSheet` with the full submission detail (full media gallery, narrative, location, prior comments, action button).
- **Filters / sort**: typically newest-first; operators may filter by garden, by category, by status, or search by author / title.

**Density target**: a Hub session can show 5–30 work items per page. Card grid should feel scannable, not cramped.

---

## 3. Reference grammar (north star applies directly here)

`reference-image.png` renders this exact route in its Review tab. The card grammar there **is** the target for Hub:

- **Photo collage top** with `1/N` page indicator (work usually has 1–4 photos).
- **Category badge** in top-left of the photo (icon prefix: leaf for Agro, trash for Waste, sun for Solar, etc).
- **Top-edge accent border** colors the state: green for OK, amber for needs-attention, red for flagged / rejected.
- **Title** + **author · garden** stacked beneath.
- **Status-dot pipeline indicator** (3–4 dots) shows progress through Review → Assess → Certify. Green-filled dots = completed stage.
- **Relative time** bottom-right.

Variations should preserve this grammar's *intent* — even if you adjust photo treatment, badge placement, or pipeline visualization. Don't replace the photo-as-identity convention; work is visually-identified by what was done.

---

## 4. Tier 3 axes most relevant for Hub

Lean on **2 of these 3** for your two variations:

### 4.1 Card composition

Variations to consider:

- **Reference grammar** (photo collage + badge + state border + pipeline dots + meta). This is the validated default.
- **Compressed list-row**: single-photo thumbnail + title + meta in a row (denser, less scannable but fits more on screen).
- **Hybrid**: large hero card for top item (e.g., oldest, flagged) + dense rows below.

### 4.2 Filter / sort / search affordances

- **Inline toolbar** (current admin) — search left + sort right.
- **Pill chip group** above the grid for category filters (Agro / Waste / Solar) + dropdown sorts.
- **Left-sheet filter rail** with persistent state (saved filter sets, garden selection).
- **Command-palette** (`⌘K`) for power-user filtering with full text + structured filters.

### 4.3 Density and rhythm

- **Comfortable** (reference image — 3-column grid, generous gutters).
- **Compact** (4–5 column grid, tighter gutters, smaller type).
- **Spacious** (2-column with larger media, breathing room).

The two variations should pick distinct points across these axes — e.g., one variation = reference grammar + comfortable + chip-group filters; the other = compressed list-row + compact + left-sheet filters.

---

## 5. Page header weight options

The Hub header carries garden context + workspace title + subtitle. Variation lever:

- **Compact title row**: garden chip + "Hub" title + subtitle. Minimum chrome above the tab rail.
- **Title + numeric context strip**: 3 plain-text numbers under the title (e.g., "12 in review · 5 assessing · 3 to certify"). No decorative tiles, no `KPI` framing.
- **Title + tab rail merged**: tabs sit immediately under the title with no subtitle, max content area.

Don't propose a hero, gallery, or marketing banner — banned vocabulary in admin.

---

## 6. Empty / loading / error states

Show in at least one of the two variations:

- **Empty Review queue** — "All caught up. New work will appear here."
- **Loading** — `AdminLinearProgress` at the top of MainSheet, skeleton rows beneath.
- **Permission-denied** — operator without certify rights sees Certify tab as disabled.

These are not optional polish; they're the difference between a designed system and a screenshot.

---

## 7. Output format

Per `00-SYSTEM.md` § 6:

- **2 variations**
- For each: name + 200–300 word rationale (which 2 of the 3 Tier 3 axes you leaned on, what the user gives up to get the win).
- Light + dark renders of `/hub` with the Review tab active and 6–8 cards visible.
- Token contrast table for dark mode (surface / text pairs, WCAG ratios).
- Composition note — `Admin*` primitives and Canvas shells used.
- Pixel-area budget check — accent green ≤ 3%.

---

## 8. Hub-specific success / failure criteria

**Good**:

- Hub feels like the cockpit dashboard a real operator would use 30+ minutes per day.
- Card grammar respects the reference: photo identity + category badge + state edge + pipeline dots.
- Pipeline progress is legible at a glance (you can tell where each work item sits in Review → Assess → Certify without clicking).
- Dark mode preserves the photo color fidelity (don't desaturate the collage).
- Filter / sort feels closer to *one click to slice* than *menu archaeology*.

**Failed**:

- Cards look like generic notification rows (no work-as-photo identity).
- Pipeline progress hidden behind hover / detail click.
- Renames the tabs (Review / Assess / Certify / History are canonical).
- Introduces a "Drafts" / "Inbox" / "Approved" / "Pending" tab that doesn't exist in the workflow.
- Floods the cards with status badges instead of using the top-edge accent + pipeline dots.

---

End of Hub prompt. Switch to a different per-view file for other routes.
