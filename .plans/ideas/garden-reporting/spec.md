# Garden Reporting in the Steward Cockpit Spec

## Summary

Eight steward reports, each placed in the shipped cockpit tab whose components it improves. A
Storybook-only prototype builds them from the cockpit's own components with deterministic sample
data for two gardens, fixed at Jan 16, 2026: Riverbend Compost Collective, with frequent waste
work in UTC+3, and Hilltop Learning Garden, with occasional sessions and attendance in UTC−3. A
clickable walkthrough (`artifacts/`) takes a steward through them in six chapters. Nothing here is
accepted for production yet.

## Users

- Primary: garden stewards, who review work and run the season.
- Secondary: evaluators, who read evidence and outcomes; funders, who see a restricted view
  without account-level rows.

## Functional Requirements

Placement was decided in review on 2026-11-13: each report goes into the tab it improves.

1. **Hub › Work, waiting time.** Chips beside Pending and Approved count pending work by age (under
   2 days, 2 to 7 days, 1 to 2 weeks, over 2 weeks), and each chip filters the queue. Plain ink,
   no warning tone (DL-044).
2. **Garden › Activity, calendar.** The month grid above the Activity Feed: counts by status per
   day as icon and number, with Submission or Review grouping and status as of today or month end.
   Days before records, days with nothing, days not yet read and future days look different. A day
   opens its work in a dialog, and a record keeps the performed, sent-from-device and submitted
   dates apart.
3. **Garden › Activity, Places.** A schematic site map (no map library exists) beside a site list,
   with work that shared no location kept in its own row.
4. **Garden › Health, Review Health.** A new card under the unchanged Garden Health card: the
   shipped stall rule's verdict (`summarizeReviewQueue`), waiting work by age, and submitted
   against reviewed each week. Its age bands hand off to the Hub's chips.
5. **Garden › Promises, season timeline.** The season card becomes a drawn timeline (windows,
   promise deadlines, milestones, planned against recorded work, today) over an accessible list.
   A promise opens the work it links.
6. **Garden › Impact, output trends.** One weekly chart per measure in its own unit, reported
   against approved. A week opens its records.
7. **Garden › Impact, evidence and outcomes.** Activity, output and outcome kept apart: baseline,
   a later observation marked proposed, dated evidence. A garden without a later observation says
   so.
8. **Community › Members, participation.** Reporting accounts, returning accounts and attendance,
   kept apart from unique people (not recorded), with a member-by-week matrix and no ranking.
9. **Community › Endowment, funding history.** Balances per asset over time, money in, money out
   and allocations, and the ledger. Assets never convert; an allocation is a plan, not a payment.

## Research Evidence

- Existing pattern references: Hub (`packages/admin/src/views/Hub/index.tsx`), Garden
  (`views/Garden/index.tsx`, `components/OverviewTab.tsx`, `ImpactTab.tsx`, `Pool/`), Community
  (`views/Community/index.tsx` and its tabs). Records open through the left-sheet channel as an
  `AdminDialog` (`components/Layout/leftSheetChannel.tsx`), not a side sheet.
- Source reviewed: the shared header and action builders (`hub.utils`, `garden.utils`,
  `community.utils`), `useGardenDerivedState` (alert copy and severities), `summarizeReviewQueue`
  (DL-044), and en strings in `packages/shared/src/i18n/en.json`.
- Evidence confirmed: the prototype lives in `packages/admin/src/views/ReportingLab/` (stories
  under `Admin/Prototypes/Garden Reporting/*`), with focused tests in `aggregate.test.ts`. The
  walkthrough was captured from those stories.
- Open inferences or assumptions:
  - The shipped work list holds the newest 50, so a month needs a month-range read with totals.
  - Gardens have no time zone, so the prototype fixes one per garden.
  - No shipped action records a work-performed date.
  - Quantities live only in IPFS metadata. Some inputs have no unit or two units, and no rule
    says when two measures count the same material.
  - Location is optional and coarse, and there are no named sites.
  - Accounts carry no shared-device flag.
  - Milestones are not part of a season, and promises have no explicit link to work.
  - There is no single ledger read across vaults and jars, allocations are not recorded, and the
    follow-up assessment is not built.

## Human Judgment Points

- Decisions that need maintainer judgment:
  - Which slice ships first.
  - Calendar defaults: grouping, status as of today or month end, garden or viewer time.
  - Age-band edges.
  - Which measures each domain reports, and whether rejected work still counts as reported.
  - What counts as planned work.
  - How a promise links to work.
  - What funders see.
  - Who records later observations.
  - The PRD-1485 name, still undecided.
- Protected or high-risk surfaces: none in the prototype. A production slice touches the work read
  (shared) and the Hub's review surface.
- Tradeoffs to keep visible during review: placing reports in existing tabs keeps one place per
  question but spreads them across workspaces.

## Non-Functional Constraints

- Package boundaries: new hooks live in `packages/shared/src/hooks`. The prototype imports only
  declared shared exports.
- Performance: a month-range read returns counts, not the whole history.
- Security: read-only reporting; no signing or transactions.
- Offline / sync: status as of a moment needs each decision's time, and a decision known only on
  one device has none yet.
- Localization: the prototype's own copy is English sample text. A production slice moves new
  strings into the shared i18n files.

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| UI | `ui` | Admin tabs: Hub › Work, Garden tabs, Community tabs |
| State / API | `state_api` | Month-range work read with counts; review timestamps |
| Contracts | `contracts` | `n/a`: no contract change |
| QA | `qa_pass_1`, `qa_pass_2` | Sequential, when a slice is accepted |

## Risks

- Risk: a report that reads a partial list presents it as a whole month.
- Mitigation: every report states what it read, and the calendar marks unread days as not loaded.
