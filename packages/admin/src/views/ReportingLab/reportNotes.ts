/**
 * Garden reporting lab: the reviewer's notes for each report. These belong to the lab's
 * review panel, never to the product flow.
 */
import type { ReportView } from "./scope";

export interface ReportNote {
  reuses: string;
  data: string;
  missing: string;
  decisions: string;
  proposed: string;
  home: string;
}

export const REPORT_NOTES: Record<ReportView, ReportNote> = {
  overview: {
    reuses:
      "AppBar with GardenChip, NavigationBar, MainSheet, CanvasRouteFrame and CanvasRouteHeader with MetaStrip, AdminCard, AdminListRow, AdminSortSelect, AdminFilterChip, AdminDialog.",
    data: "The garden's work list with approvals, its pool's cycles and promises, assessments, and the vault and cookie jar reads the Community tabs already make.",
    missing:
      "A month-scoped work read that also returns a total, so every report counts the same records. Today the list holds the newest 50 and pages back.",
    decisions:
      "Where the overview lives, what it is called, and whether the reports share one month or each keep their own.",
    proposed: "ReportsOverview, the More Reports rows, ReportToolbar.",
    home: "Garden workspace: either the first screen of Activity (the feed becomes a day's records) or a fifth Garden tab.",
  },
  calendar: {
    reuses:
      "AdminCard, AdminListRow as each day's button, AdminFilterChip, IconButton, Alert; drill-down in AdminDialog with ItemRow, FactList and StatusBadge.",
    data: "Work createdAt (submitted), reviewedAt and status; work metadata submittedAt (sent from the device) for late uploads.",
    missing:
      "A query by date range with counts. A garden time zone (none today; the lab fixes one per garden). A work-performed date: no shipped action asks for one. Status at a past moment needs every decision's time.",
    decisions:
      "Count days by submission (lab default) or by review. Past months read today's statuses (default) or the month-end statuses. Day boundaries in garden time or the viewer's.",
    proposed:
      "ActivityCalendar, CalendarMonthGrid (one tab stop, arrow keys, agenda below 34rem), StatusMarks.",
    home: "Garden, Activity.",
  },
  review: {
    reuses:
      "The shipped stall rule (summarizeReviewQueue, DL-044), StatTile, StatusBadge, AdminFilterChip, ItemRow.",
    data: "Work status, createdAt and reviewedAt; the garden queue read for counts past the newest page.",
    missing:
      "Weekly review counts need every decision in the period, not only the newest page. Age bands are new.",
    decisions:
      "Band edges (2, 7 and 14 days). Health reads at today, or at the end of the month the steward picked (lab).",
    proposed: "ReviewHealthPanel, WeeklyBars in paired mode.",
    home: "Garden, Health, beside Garden Health; its counts could also lead the Hub's Work tab.",
  },
  outputs: {
    reuses: "AdminCard, StatusMarks, a semantic table.",
    data: "Quantities in each work's metadata details, the action's input units, and timeSpentMinutes.",
    missing:
      "Quantities sit in IPFS metadata, so charts need every record's metadata or an indexed copy. Some inputs have no unit (Cleanup Amount Removed) or two (Maintenance: kg or bags). A rule for which measures overlap: sorting, transfer and batch weights can be the same material.",
    decisions: "Which measures each domain reports, and whether rejected work stays in Reported.",
    proposed: "OutputTrends, WeeklyBars in nested mode.",
    home: "Garden, Impact.",
  },
  season: {
    reuses: "ItemRow (the promise row's pills: Past due, Done), FactList, AdminDialog, EmptyState.",
    data: "Pool cycles (Season and Campaign with start and end), promises with due dates and confirmations, assessments.",
    missing:
      "Milestones are not part of a season today (proposed). Done dates come from confirmation events. Planned work exists only where an action plans (Publish Session) or as promises.",
    decisions:
      "What counts as planned work in each domain; whether a promise links work by action, by window or explicitly.",
    proposed: "SeasonTimeline (a drawn axis over an accessible list).",
    home: "Garden, Promises.",
  },
  places: {
    reuses: "StatTile, AdminListRow, StatusMarks, StatusBar.",
    data: "Work metadata location: coarse latitude and longitude, optional and shared only when the gardener allows it.",
    missing:
      "Named sites (proposed; a steward would draw them). A map library: the repository has none, so this map is schematic. Locations live only in IPFS metadata.",
    decisions: "Whether funders see places at all; how coarse a shown location must be.",
    proposed: "PlaceActivity (schematic map with a site list).",
    home: "Garden, Activity.",
  },
  people: {
    reuses: "StatTile, WeeklyBars, a semantic table, role gating as useGardenPermissions does.",
    data: "The reporting account on each work, attendance and participant counts in details, unique-attendee bands, garden membership dates.",
    missing:
      "A shared-device flag on accounts (none today). Unique people are recorded nowhere, by design.",
    decisions:
      "Who sees account-level rows (lab: stewards and evaluators). How long before an account counts as quiet (lab: three weeks).",
    proposed: "ParticipationView.",
    home: "Community, Members.",
  },
  funding: {
    reuses: "ItemRow with the amount in its right slot (DL-113), StatTile, EmptyState.",
    data: "Vault deposits and harvests, cookie jar deposits and claims, per asset.",
    missing:
      "One ledger read across a garden's vaults and jars. Allocations are not recorded today (proposed). Harvest splits per destination.",
    decisions: "No values in another currency. Whether funders see who claimed.",
    proposed: "FundingHistory with a balance step line per account.",
    home: "Community, Payouts and Endowment.",
  },
  evidence: {
    reuses: "FactList, ItemRow, StatTile, StatusBadge, EmptyState.",
    data: "The assessment (diagnosis, outcomes, metric, target, reporting period), approved work with photos, approval confidence and method.",
    missing:
      "A follow-up assessment (planned, not built). A way to tie evidence records to a baseline metric.",
    decisions:
      "Who records the later observation (an evaluator), and how evidence is chosen for the comparison.",
    proposed: "EvidenceOutcomes.",
    home: "Garden, Impact.",
  },
};
