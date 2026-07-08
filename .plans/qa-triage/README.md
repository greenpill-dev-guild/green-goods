# QA triage artifact index

Freshness pass date: 2026-06-02.

This directory stores repo-local QA triage artifacts. Linear is the accepted-work surface, and the QA Sheet is the append-only reporting surface. Files here are supporting evidence, fixtures, and dry-run payloads; they are not a substitute for accepted Linear records.

| Artifact set | Status | Reporting rule |
|---|---|---|
| `product-sync-2026-05-13/` | Accepted production triage run | Count as the current accepted QA Sheet baseline: PRD-496 through PRD-522, 27 linked Customer Needs, 21 Defects-tab rows, and test-tab backfills. |
| `product-sync-2026-05-20/` | Fixture dry-run only | Do not count in Linear or QA Sheet reporting. `PRD-XXX`, draft Defects rows, and payload examples are synthetic shape checks only. |

## Hygiene rules

- Keep fixture runs visibly labeled as `fixture` and `dry-run` in reports, payloads, row files, and future summaries.
- Do not promote fixture `PRD-XXX` links into docs prose as accepted records.
- Keep PostHog replay URLs, session IDs, distinct IDs, wallet addresses, and reporter identifiers out of public reports.
- Current Linear labels use only the canonical families: `protocol:*`, `package:*`, `activity:*`, `source:*`, `agent:*`, and `funding:*`. Historical fixture text that mentions retired `task:*` labels must be treated as stale fixture metadata, not current guidance.
