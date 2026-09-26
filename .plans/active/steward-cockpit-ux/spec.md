# Steward Cockpit UX Fixes Spec

## Summary

Fix the admin dashboard problems a 2026-09-24 UX audit found (D1–D36), in five pull requests,
applying eight design decisions (DEC-A–H) Afo accepted on 2026-09-24 and the scope and copy he
settled on 2026-09-25. Each finding below names its owning PR; the PR handoffs in `handoffs/`
carry file-level instructions, tests, and validation.

## Users

- Primary: garden stewards and operators reviewing work, editing their garden, and managing
  members and payouts in the admin dashboard.
- Secondary: deployers (Actions registry, campaign cookie jars) and evaluators (Hub read access).

## Decisions

| ID | Decision | Owning PR |
|---|---|---|
| DEC-A | The Hub's action trio (Submit Work, Create Assessment, Create Hypercert) renders all outlined; Submit Work stays the declared primary for order and the FAB. | PR4 |
| DEC-B | Cards show neutral Pending plus age; the Hub header shows one plain-ink "N waiting over a week"; garden health is Critical only when work waited 7+ days and no review landed in the last 7 days; Median Review Time becomes submission-to-decision time in days. | PR2 |
| DEC-C | The Actions workspace tone becomes purple (light purple-700 action, purple-100/purple-900 container; dark purple-200 tonal fill with purple-900 ink per DL-009). | PR4 |
| DEC-D | Campaign cookie jars live in a "Campaign Cookie Jars" card on Community → Payouts, for deployers while the Green Goods Community Garden is selected; creation is a flow dialog; `/cookies` and `/cookies/deploy` redirect there. | PR4 |
| DEC-E | Assessment steps use plain titles with method names as helper text, and start with no domain selected (copy in the PR2 handoff). | PR2 |
| DEC-F | Storybook loads the admin layout classes from a stylesheet the admin app also imports. | PR5 |
| DEC-G | Rejecting work requires a reason through `AdminReasonDialog`, saved as the review feedback (copy in the PR2 handoff). | PR2 |
| DEC-H | Member counts mean distinct people everywhere. | PR3 |

Execution decisions (2026-09-25): five grouped PRs in order PR1 → PR5; the implementing agent
merges PR1, PR2, PR3, and PR5 with `--merge` once CI Gate is green and bot reviews are resolved;
PR4 waits for Afo's yes on before/after screenshots, and PR5 merges only after PR4 has merged; one Linear parent plus one child per PR; the
QA catalog changes in the PR that changes the behaviour (new IDs from ADM-177); each PR adds
in-between-state stories for the write surfaces it changes; D13 is fixed in the shared
`ConfidenceSelector`, so the client review sheet changes too; D32 migrates every raw type size and
view-level raw `--m3-*` colour, with a ratchet.

Design-log rows DL-043 to DL-051 record the locked design decisions; each implementing PR codifies
its rows into `interaction-patterns.md`, `packages/admin/DESIGN.md`, or `language.md`.

## Findings

Priority: P0 blocks a task or misleads about its target; P1 makes a common task wrong or slow;
P2 is friction that adds up; P3 is words and polish.

| ID | P | Finding (what the steward meets) | Status | PR | Rule or book section |
|---|---|---|---|---|---|
| D1 | P0 | The Actions workspace crashes to "Something went wrong" | Open | PR1 | P16 real and worst-case content; DMMT ch. 11 |
| D2 | P1 | Work titles carry machine timestamps, sometimes twice, up to the dialog title | Open | PR2 | DMMT ch. 5 omit needless words; P1 |
| D3 | P1 | Reject sends the decision in one click, with no reason | Open | PR2 | P2; interaction-patterns § 2 |
| D4 | P1 | Garden Profile Save sends unannounced wallet prompts and never shows where it stopped | Open | PR3 | DESIGN.md consequential writes (P7, P12) |
| D5 | P1 | Every pending card is a red Overdue; the garden reads Critical | Open | PR2 | RUI emphasize by de-emphasizing; interaction-patterns § 5 |
| D6 | P1 | Three member counts disagree; Manage Members lists role seats | Open | PR3 | DMMT ch. 1; P11 |
| D7 | P1 | A row's Manage Roles opened the whole roster | Fixed by #894 | — | DMMT ch. 6 |
| D8 | P2 | Dialog and page names differ from the buttons that open them | Open | PR2, PR3, PR4 | DMMT ch. 6; P5 |
| D9 | P2 | Header actions repeat in the page; three filled primaries on Endowment | Open | PR3 | frontend-design Rule 5; P10 |
| D10 | P2 | Fund Cookie Jar does nothing when the garden has no jar | Open | PR3 | P2; P12 |
| D11 | P2 | The Name field is disabled for stewards with no reason given | Open | PR3 | admin-ux-brief permission states |
| D12 | P2 | Validation warnings show before the steward has done anything | Open | PR2 | P12; error prevention |
| D13 | P2 | "None" is the selected, filled confidence chip | Open | PR2 | RUI semantics are secondary |
| D14 | P2 | Amounts have no units, and endowment totals add different assets together; review time reads as "4365h" | Open | PR3 (amounts), PR2 (review time) | P11; RUI labels are a last resort |
| D15 | P2 | Role counts appear twice; the filter chips push members below the fold on phones | Open | PR3 | interaction-patterns § 5 |
| D16 | P2 | At 375 the garden chip runs under the app-bar icons; "Community" truncates | Open | PR4 | DMMT ch. 6 street signs |
| D17 | P2 | The FAB shows "+" on dials with nothing to create | Open | PR4 | DMMT ch. 3 and ch. 10 |
| D18 | P2 | The tab rail overflows on phones with no cue | Open | PR4 | DMMT ch. 6 you are here |
| D19 | P2 | Empty lists keep View All; empty cards are forced screen-tall | Open | PR3, PR4 | RUI empty states; don't fill the screen |
| D20 | P2 | Cookie jar creation is a page while every other create flow is a flow dialog | Open | PR4 | interaction-patterns § 2; DL-007 |
| D21 | P2 | The Actions tone is the error red | Open | PR4 | DESIGN.md state colours |
| D22 | P2 | Cookies has no place in the navigation | Open | PR4 | DMMT ch. 6 trunk test |
| D23 | P2 | Assessment steps use method vocabulary; Solar is preselected | Open | PR2 | DESIGN.md voice; DMMT ch. 1 |
| D24 | P2 | Storybook workspace stories render without the admin layout classes | Open | PR5 | P16; P17 |
| D25 | P2 | Many admin components have a single story; write surfaces lack in-between states | Open | every PR, PR5 | P12 |
| D26 | P2 | Join requests load only after a click | Dropped (loading signs a proof) | — | — |
| D27 | P3 | The same paragraph repeats on every vault card | Open | PR3 | DMMT ch. 5 |
| D28 | P3 | Titles print two or three times in the review dialog and assessment steps | Open | PR2 | RUI hierarchy |
| D29 | P3 | Dates repeat or show seconds and a time zone | Open | PR2 | RUI labels |
| D30 | P3 | Descriptions carry instructions and happy talk | Open | PR2, PR3, PR5 | DMMT ch. 5; P6 |
| D31 | P3 | Developer vocabulary reaches stewards, sometimes with no act attached | Open | PR2, PR3, PR4 | DESIGN.md voice |
| D32 | P3 | Raw type sizes and raw `--m3-*` colours remain in admin views | Open | PR5 | P13; frontend-design Rules 9 and 13 |
| D33 | P3 | Bordered cards nest two and three deep | Open | PR3, PR5 | admin DESIGN.md don'ts; RUI fewer borders |
| D34 | P3 | Title Case drifts on named things | Open | PR3, PR4 | DL-012, DL-013 |
| D35 | P3 | The unselected "Select" badge looks like a button | Open | PR2 | DMMT ch. 3 |
| D36 | P3 | On phones the alert card lands two screens down | Open | PR4 (amends DL-008) | DMMT ch. 10 |

## Research Evidence

- Method: labelled mock-auth localhost captures (Playwright Chromium, `?mockAuth=deployer`, admin
  dev server against the hosted beta indexer), Storybook captures, trunk tests per workspace at
  1280 and 375, three steward task walks, and a code read for every finding.
- Re-verified against `origin/develop` at 51682c605 on 2026-09-25. Beyond the audit:
  - D14 is a correctness bug: `useGardenDetailData.ts` sums net deposits across WETH and DAI
    vaults into one `vaultNetDeposited`.
  - "Median Review Time" is the median age of reviewed work (`useGardenDerivedState.ts`,
    `medianReviewAgeHours`); work rows drop the indexed approval time in `resolveGardenWorkRows`
    (`modules/work/local-status-overlay.ts`).
  - The client review flow already requires feedback to reject (`useWorkApprovalActions.ts`).
  - The protocol-garden test that gates protocol surfaces lives in `CommunityPools.tsx`.
- Existing patterns to mirror: `AdminReasonDialog` (pool reason dialogs), `TxProgressList` (pool
  setup progress), `parseIndexerDomain` (indexer normalisation), the design-token usage baseline in
  `scripts/design/check-tokens.sh`.

## Human Judgment Points

- PR4 changes visual rules (outlined Hub trio, FAB icon, phone nav, alert order, purple tone,
  campaign jar home): Afo approves rendered before/after pairs before merge.
- The stall rule (DEC-B) and the D13 change to the shared confidence selector touch behaviour
  stewards and gardeners rely on; both are decided, and their QA cases change with them.

## Non-Functional Constraints

- Package boundaries: hooks live in `packages/shared/src/hooks`; admin imports declared
  `@green-goods/shared` subpaths only.
- Critical surfaces: PR2 and PR3 touch `hooks/garden/`, `hooks/assessment/`, `hooks/vault/`, or
  `modules/work/`, so their push plans run the critical override.
- Localization: every new en key ships with es and pt in the same change.
- Security and privacy: no wallet addresses or transaction hashes in logs or Linear bodies.
- Offline and cache: rows restored from cache may lack the new review time; the stall rule treats
  unknown review times as not stalled.

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| UI | `ui` | Admin views, components, stories; PR2–PR5 |
| State / API | `state_api` | Shared hooks, utilities, modules, types; PR1–PR3, PR5 |
| Contracts | `contracts` | `n/a` |
| QA | `qa_pass_1`, `qa_pass_2` | After PR5 merges |

Execution sub-lanes `pr1_actions_crash` to `pr5_copy_storybook_polish` in `status.json` carry each
PR's branch, dependency, handoff, and Linear child issue.

## Risks

- Critical gates are slow and flake under machine load; rerun a failing file alone before
  suspecting the diff.
- The D32 migration touches many files; a rendered type census before and after is the guard.
- PR4's flow-dialog conversion is the largest UI change; keep its state logic in the existing
  workspace component.
