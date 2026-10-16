# Certified publishing Linear map

Observed 2026-10-16 UTC. Project: [Certified and Ma Earth Approval Publishing](https://linear.app/greenpill-dev-guild/project/certified-and-ma-earth-approval-publishing-8f362015ebda).
Roadmap: [PRD-1240](https://linear.app/greenpill-dev-guild/issue/PRD-1240). Native milestones follow the phases in the execution plan;
no dates or new assignees were invented. Product issues remain Backlog; research states retain
independent ownership. This map does not claim runtime completion.

## Checkpoint mirrors

Checkpoint 1 is [RESR-69](https://linear.app/greenpill-dev-guild/issue/RESR-69); checkpoint 14 routes independent provider research below.

| Plan scope | Issue | Outcome | Native blockers |
|---|---|---|---|
| Checkpoint 2 | [PRD-1242](https://linear.app/greenpill-dev-guild/issue/PRD-1242) | Set authority and consent for approval publication | None |
| Checkpoint 3 | [PRD-1243](https://linear.app/greenpill-dev-guild/issue/PRD-1243) | Link an existing Certified account | [PRD-1242](https://linear.app/greenpill-dev-guild/issue/PRD-1242), [RESR-69](https://linear.app/greenpill-dev-guild/issue/RESR-69) |
| Checkpoint 4 | [PRD-1244](https://linear.app/greenpill-dev-guild/issue/PRD-1244) | Persist scoped Certified grants safely | [PRD-1243](https://linear.app/greenpill-dev-guild/issue/PRD-1243) |
| Checkpoint 5 | [PRD-1245](https://linear.app/greenpill-dev-guild/issue/PRD-1245) | Bind a Garden to an authorized external project | [PRD-1244](https://linear.app/greenpill-dev-guild/issue/PRD-1244) |
| Checkpoint 6 | [PRD-1246](https://linear.app/greenpill-dev-guild/issue/PRD-1246) | Discover current and historical Work approvals | [PRD-1242](https://linear.app/greenpill-dev-guild/issue/PRD-1242) |
| Checkpoint 7 | [PRD-1247](https://linear.app/greenpill-dev-guild/issue/PRD-1247) | Preview and consent to public approval evidence | [PRD-1245](https://linear.app/greenpill-dev-guild/issue/PRD-1245), [PRD-1246](https://linear.app/greenpill-dev-guild/issue/PRD-1246) |
| Checkpoint 8 | [PRD-1248](https://linear.app/greenpill-dev-guild/issue/PRD-1248) | Publish approval records in Certified native structure | [PRD-1247](https://linear.app/greenpill-dev-guild/issue/PRD-1247), [RESR-69](https://linear.app/greenpill-dev-guild/issue/RESR-69) |
| Checkpoint 9 | [PRD-1249](https://linear.app/greenpill-dev-guild/issue/PRD-1249) | Reconcile interrupted and changed publications | [PRD-1248](https://linear.app/greenpill-dev-guild/issue/PRD-1248) |
| Checkpoint 10 | [PRD-1250](https://linear.app/greenpill-dev-guild/issue/PRD-1250) | Show publication history and repair controls | [PRD-1249](https://linear.app/greenpill-dev-guild/issue/PRD-1249) |
| Checkpoint 11 | [PRD-1251](https://linear.app/greenpill-dev-guild/issue/PRD-1251) | Prove Ma Earth display and correction behavior | [PRD-1250](https://linear.app/greenpill-dev-guild/issue/PRD-1250) |
| Checkpoint 12 | [PRD-1252](https://linear.app/greenpill-dev-guild/issue/PRD-1252) | Verify the publication journey and operational recovery | [PRD-1251](https://linear.app/greenpill-dev-guild/issue/PRD-1251) |
| Checkpoint 13 | [PRD-1253](https://linear.app/greenpill-dev-guild/issue/PRD-1253) | Enable bounded opt-in approval publication | [PRD-1252](https://linear.app/greenpill-dev-guild/issue/PRD-1252) |
| Assessment A1 follow-on | [PRD-1254](https://linear.app/greenpill-dev-guild/issue/PRD-1254) | Adopt the accepted assessment projection into canonical sources | [RESR-69](https://linear.app/greenpill-dev-guild/issue/RESR-69), [RESR-49](https://linear.app/greenpill-dev-guild/issue/RESR-49) |

## Provider research frontiers

| Provider | Frontier | Current evidence/state | Gates |
|---|---|---|---|
| Certified | [RESR-69](https://linear.app/greenpill-dev-guild/issue/RESR-69) | In Progress; verify deployed contract and Ma Earth path | D1–D9 |
| GainForest | [RESR-99](https://linear.app/greenpill-dev-guild/issue/RESR-99) | Backlog; follow-up to completed [RESR-98](https://linear.app/greenpill-dev-guild/issue/RESR-98) | G1–G5; M1 only for later shared transport |
| Silvi | [RESR-100](https://linear.app/greenpill-dev-guild/issue/RESR-100) | Backlog; confirm AT/native/export mode; related [GROW-49](https://linear.app/greenpill-dev-guild/issue/GROW-49) | SI1–SI3 |
| Bloom Network | [RESR-101](https://linear.app/greenpill-dev-guild/issue/RESR-101) | Backlog; confirm community report/API or manual export | B1–B3 |
| Regen Network | [RESR-96](https://linear.app/greenpill-dev-guild/issue/RESR-96) | In Review; existing research and pilot decision retained | R1–R3 |

These research frontiers are related records, not blockers on initial Certified delivery. Each
provider may later gain its own bounded implementation project/hub after conformance and pilot
scope acceptance. The shared acceptance contract covers authority, native identity, public preview,
historical matching, correction and lost-response recovery; provider acceptance and visibility stay native.

## Domain and adjacent records

- [RESR-49](https://linear.app/greenpill-dev-guild/issue/RESR-49) owns remaining baseline/standards research; it blocks assessment adoption [PRD-1254](https://linear.app/greenpill-dev-guild/issue/PRD-1254).
- [RESR-77](https://linear.app/greenpill-dev-guild/issue/RESR-77) owns report/certificate claims; it blocks report exports [PRD-1258](https://linear.app/greenpill-dev-guild/issue/PRD-1258).
- [PRD-744](https://linear.app/greenpill-dev-guild/issue/PRD-744) retains its documentation-residual scope and relates to canonical assessment adoption.
- Independent social project: [Impact Sharing and Report Exports](https://linear.app/greenpill-dev-guild/project/impact-sharing-and-report-exports-f24d787cb2bd); [owning plan](../impact-sharing-report-exports/plan.todo.md).

## Synchronization contract

Canonical parent/project and every Product checkpoint ID are recorded in `status.json` using
execution sub-lanes and `preserve_existing`. Generate and inspect the manifest, then verify live
records before confirming the sync timestamp. Preserve existing states; changes to scope or
native blockers require the owning plan and live record to agree. The current sync is a verified
snapshot, not a continuously running bidirectional sync. External research gates live in this map
and native Linear relations; local `depends_on` encodes only same-hub checkpoint edges.
