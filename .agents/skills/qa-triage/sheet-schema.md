# Green Goods QA Sheet Schema

Canonical schema for the **Green Goods v1.1 QA** workbook (file id `1IiviDIqwFM7gcD3oV48LwHNW5poCE-HmSCLtsLt3xBo`, owner `afo@greenpill.builders`).

Used by:
- **Phase 0** — validate that the resolved Sheet matches the tab and column layout below; emit `schema-bootstrap.csv` if the Defects tab is missing the 6 new PostHog/Linear columns.
- **Phase 5** — render `sheet-rows.csv` and `sheet-test-backfill.csv` against the **actual** column order read from the Sheet (which may differ from the canonical order if columns were added in a different position).

The skill **always** uses the column order read from the Sheet, not the order in this document. This document is the canonical reference for which columns should exist and what they mean.

---

## Workbook tabs

| Tab | Type | Purpose |
|---|---|---|
| `Guide` | Auxiliary | QA execution rules. Read-only for this skill. |
| `Summary` | Auxiliary | Per-surface pass/fail/blocked counters. Recomputed from formulas. Read-only. |
| `Public Website` | Test | 8 test rows covering client editorial routes. |
| `PWA iOS` | Test | 10 test rows covering installed iOS PWA scenarios. |
| `PWA Android` | Test | 8 test rows covering installed Android PWA scenarios. |
| `Admin Dashboard` | Test | 11 test rows covering admin cockpit surfaces. |
| `Cross Surface` | Test | 4 test rows for visual / copy / error / evidence-quality cross-cutting checks. |
| `Defects` | Defects | Bug records. The skill appends new rows here and references them from Test rows via `Defect Link`. |

Phase 0 confirms all tabs above exist. If any is missing, fail loud — don't write to a partial workbook.

---

## Defects tab schema

The Defects tab is the skill's primary write target. Column order **after** the first-run bootstrap:

| # | Column | Type | Filled by |
|---|---|---|---|
| 1 | `Defect ID` | string | Auto-generated `D-NNN` from `max(existing) + 1` |
| 2 | `Linked Test ID` | string | Phase 5 — set only when the extraction or `[derived:test-fail]` names a Test ID (e.g. `ADM-006`) |
| 3 | `Severity` | enum | `P0 \| P1 \| P2 \| P3` (defaults: see below) |
| 4 | `Surface` | enum | `Public Website \| PWA iOS \| PWA Android \| Admin Dashboard \| Cross Surface \| Docs` |
| 5 | `Title` | string | The extraction's one-line description |
| 6 | `Owner` | string | Phase 5 assignee-dialog result |
| 7 | `Status` | enum | `Open` by default |
| 8 | `Repro Steps` | string | Verbatim from notes; `needs repro` if absent |
| 9 | `Expected` | string | From notes; `needs definition` if absent |
| 10 | `Actual` | string | From notes |
| 11 | `Evidence Link` | url | The Linear PRD URL; append `\| <screenshot-url>` for visual bugs when the notes attached one |
| 12 | `Fix Owner` | string | Same as `Owner` unless the call differentiated triage owner from fix owner |
| 13 | `Retest Owner` | string | Empty until QA retests |
| 14 | `Retest Result` | enum | Empty until QA retests |
| 15 | `Release Decision` | string | Empty until release owner decides |
| 16 | `Notes` | string | Free-text scratch space from the extraction |
| 17 | `PostHog Hash` | string | ← Phase 0 bootstrap. Safe-summary error hash from Phase 3 cross-ref |
| 18 | `PostHog Sessions 7d` | int | ← Phase 0 bootstrap. Affected sessions, 7-day window |
| 19 | `PostHog Users 7d` | int | ← Phase 0 bootstrap. Affected users, 7-day window |
| 20 | `PostHog Session ID` | string | ← Phase 0 bootstrap. **Private-internal exception** — only allowed in this Sheet |
| 21 | `PostHog Replay URL` | url | ← Phase 0 bootstrap. **Private-internal exception** — only allowed in this Sheet |
| 22 | `Linear URL` | url | ← Phase 0 bootstrap. The filed Linear Issue or Customer Need URL |

### Severity defaults

| Default | Condition |
|---|---|
| `P0` | PostHog confirms ≥50 sessions in 30d, OR the call flagged it as release-blocking |
| `P1` | Confirmed bug with named surface + behavior |
| `P2` | Idea, polish, or non-blocking item |
| `P3` | Speculative or hypothetical |

### Bootstrap CSV (`schema-bootstrap.csv`)

Single row containing the 6 new column names, ordered to append at the right edge of the existing Defects schema:

```csv
PostHog Hash,PostHog Sessions 7d,PostHog Users 7d,PostHog Session ID,PostHog Replay URL,Linear URL
```

The user pastes this into row 1 of the Defects tab, starting in the first empty column to the right of `Notes`. Phase 0 then re-reads the header row and caches the new column indexes to `.config.json`.

---

## Test tab schema

The 5 Test tabs (`Public Website`, `PWA iOS`, `PWA Android`, `Admin Dashboard`, `Cross Surface`) share a 20-column schema.

| # | Column | Filled by | Mutable by skill? |
|---|---|---|---|
| 1 | `Test ID` | QA owner manually | no |
| 2 | `Surface` | QA owner manually | no |
| 3 | `Platform` | QA owner manually | no |
| 4 | `Priority` | QA owner manually | no |
| 5 | `Area` | QA owner manually | no |
| 6 | `Scenario` | QA owner manually | no |
| 7 | `Preconditions` | QA owner manually | no |
| 8 | `Steps` | QA owner manually | no |
| 9 | `Expected Result` | QA owner manually | no |
| 10 | `Required Evidence` | QA owner manually | no |
| 11 | `QA Owner` | QA owner manually | no |
| 12 | `Device/Browser` | QA owner manually | no |
| 13 | `Account/Role` | QA owner manually | no |
| 14 | `Build/Commit` | QA owner manually | no |
| 15 | `Result` | QA owner manually | no |
| 16 | `Severity` | QA owner manually | no |
| 17 | `Defect Link` | QA owner OR `/qa-triage` Phase 6 backfill | **yes — single-column-precise** |
| 18 | `Notes` | QA owner manually | no |
| 19 | `Retest Result` | QA owner manually | no |
| 20 | `Retest Date` | QA owner manually | no |

The skill **only ever writes** column 17 (`Defect Link`) on a Test row, and **only** when:

1. A Defects row was filed this run with a matching `Linked Test ID`.
2. The matching Test row's current `Defect Link` cell is empty.

Phase 5 emits `sheet-test-backfill.csv` of shape:

```csv
tab,test_id,defect_link
PWA iOS,PWA-IOS-004,D-018
Admin Dashboard,ADM-006,D-019
```

Phase 6's guided-paste step lists each `(tab, test_id)` pair and asks the user to navigate to the row and paste the `defect_link` value into the `Defect Link` cell. Single-column-precise; no other column touched.

---

## Surface vocabulary

The skill's surface vocabulary matches the Sheet's `Surface` column values, plus a sixth value `Docs`:

| Vocabulary | Source surface | Test tab | PostHog project |
|---|---|---|---|
| `Public Website` | Client editorial (`packages/client` in website mode) | `Public Website` | App `163591` |
| `PWA iOS` | Installed PWA on iOS | `PWA iOS` | App `163591` |
| `PWA Android` | Installed PWA on Android | `PWA Android` | App `163591` |
| `Admin Dashboard` | Admin cockpit (`packages/admin`) | `Admin Dashboard` | Admin `262122` |
| `Cross Surface` | Multi-surface / cross-cutting | `Cross Surface` | App + Admin (per-surface) |
| `Docs` | Docusaurus (`docs/`) | — (no test tab) | none |

The PWA iOS / PWA Android split is platform-specific. When the extraction's notes don't name a device, default to `PWA iOS`; if the call discussed Android specifically, use `PWA Android`; if it's universal across platforms, use `Cross Surface` rather than picking one.

---

## Access mode requirement

The skill writes session IDs and replay URLs to columns 20 and 21 of the Defects tab. Phase 0 hard-aborts if the Sheet's permission state is `anyoneWithLink` or `public`. The expected state is:

- `private` (default for a new Sheet owned by an individual), OR
- explicitly shared with named team members only

If the access mode changes between runs and a subsequent run detects `anyoneWithLink`, Phase 0 aborts even if the file id is cached. The cache is for resolution, not for skipping the access check.

---

## Read-modify-write conflict policy

V0.1.0 uses guided paste (the Drive MCP doesn't expose Sheets `values.append`), so this section applies to v0.2.0 when `scripts/agents/qa-sheet-append.ts` exists.

Before any append, re-read the Defects body row count. If it differs from the count captured in Phase 0, abort the Sheet write and surface the conflict — another run or a manual edit landed mid-flight. Re-running `/qa-triage <slug>` after the conflict resolves picks up where it left off because the workspace is durable.
