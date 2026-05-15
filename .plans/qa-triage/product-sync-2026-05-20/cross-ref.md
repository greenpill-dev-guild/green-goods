# Cross-reference — Product Sync 2026-05-20 (fixture)

> Mode: `--fixture --dry-run`. Simulated cross-ref data is taken from the fixture's `<!-- skill-fixture-context: ... -->` HTML comment. **The skill does not currently parse this block** — see gap-validate #2 in `report.md`. For this dry-run I'm hand-applying the simulated state so the rest of the phase flow can be validated.

### Item 1 — Camera preview clips on iOS Safari standalone PWA

- Surface: PWA iOS
- PostHog: no match (simulated context didn't include one)
- Deploy correlation: n/a (no PostHog anchor)
- Linear scan: no duplicates against current open issues (PWA-IOS-005 covers HEIC/JPG library imports, not camera capture — related, not duplicate)
- **QA-sheet dedupe scan**: **tracker-known** — fixture context's `defects_known` declares D-014 already covers "camera preview clips on iPhone" with linear_url=PRD-501. Phase 6 should skip the Defects row write.
- Disposition (proposed): **no new Linear Issue** (link as `relates to` PRD-501); skip Defects row.

### Item 2 — Admin Hub work queue doesn't refresh after approval

- Surface: Admin Dashboard
- PostHog: would query App-or-Admin project for "approve / pending / refresh" — fixture context didn't include a match
- Deploy correlation: n/a
- Linear scan: clean — no open issue
- QA-sheet dedupe: not present in Defects
- **Failed-test link**: fixture context's `test_tab_failed_rows` declares ADM-007 has Result=Fail + empty Defect Link. The notes already cite ADM-007 → this item's Linked-Test-ID = ADM-007 (verbatim, no fuzzy-match needed)
- Disposition (proposed): new Issue, `package:admin`, `activity:qa`, `task:evaluator-review` (admin approval flow), Todo, P1

### Item 3 — Radio buttons missing selected state on /fund

- Surface: Cross Surface (Public Website + PWA)
- **PostHog**: match (per fixture context) — error_hash=`9c2e1b40`, 6 sessions/4 users 7d, first_seen=2026-05-19T14:18:00Z, surface=client, confidence=medium
- **Deploy correlation**: first_seen anchor present → Phase 3a-bis would query Vercel for prod deploys in [2026-05-19T14:18 - 24h, 2026-05-19T15:18]. **In a real run** Vercel would return the live deploy; for this dry-run I'll note the path was correctly *gated* on the PostHog match (which is what we wanted to validate).
- Linear scan: clean
- QA-sheet dedupe: not present
- Disposition (proposed): new Issue, `package:client` (primary surface — the Warm Earth token rollout is shared but the bug surfaces in client), `activity:qa`, `task:funding-pathway` (touches `/fund`), Todo, P1

### Item 4 — Glossary typo "gardner" → "gardener"

- Surface: Docs
- PostHog: **no enrichment** per spec (`Docs / unknown surface → no enrichment`) ✓
- Deploy correlation: n/a
- Linear scan: clean
- QA-sheet dedupe: not present
- Disposition (proposed): new Issue, `package:docs`, `activity:maintenance` (copy fix, not a behavioral defect), Backlog, P3

### Item 5 — Admin Members tab shows raw address instead of ENS

- Surface: Cross Surface — primary `package:admin`, secondary `package:indexer` (per the notes' explicit framing)
- PostHog: would query Admin project; no fixture match
- Deploy correlation: n/a
- Linear scan: clean — note PRD-516 is the existing ENS regression bug on Admin generally; this is a narrower per-member instance. Mark as `relates to PRD-516`, do not duplicate.
- Disposition (proposed): new Issue, `package:admin` (primary; secondary `package:indexer` noted in body's `## Surface` block per Linear single-value constraint), `activity:qa`, `task:reputation-identity`, Todo, P2; link `relates to PRD-516`

### Item 6 — Action templates idea

- Surface: Admin Dashboard
- PostHog: not enrichable (pure feature request)
- Deploy correlation: n/a
- Linear scan: clean
- QA-sheet dedupe: n/a (ideas don't go on Defects)
- Disposition (proposed): **lightweight attach-Issue** with `[tracking]` prefix per linear-templates.md, `package:admin`, `activity:maintenance`, `task:local-onboarding` (operator action authoring), Backlog, P3; Customer Need attached

### Derived candidates (≥100)

- **[derived:test-fail] 100**: ADM-007 was already absorbed into item 2 — no separate candidate needed.
- No other derived candidates produced this run (fixture didn't seed `[derived:posthog]` or `[derived:recurring]` cases).

## Summary

- **PostHog matches**: 1 of 6 (item 3). Fixture-only — real runs depend on telemetry.
- **Vercel deploy correlation paths exercised**: 1 (gated on item 3's first_seen). Confirms the gating logic — paths without a match did NOT trigger Vercel queries.
- **Tracker-known**: 1 (item 1, D-014/PRD-501) — Defects row write will be skipped in Phase 6.
- **Failed-test backlinks**: 1 (item 2 → ADM-007).
- **Linear `relates to`**: 2 (item 1→PRD-501, item 5→PRD-516).
