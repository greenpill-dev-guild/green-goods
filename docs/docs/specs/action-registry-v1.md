---
id: specs/action-registry-v1
title: Action Registry v1 Architecture (4 Core Domains)
sidebar_label: Action Registry v1
description: Domain-first action registry design for Solar Hub Development, Agroforestry, Ethereum Education, and Waste Management.
---

# Action Registry v1 Architecture (4 Core Domains)

This exploration proposes a simple but extensible action registry for Green Goods v1 that keeps each domain focused around **4 core actions** (sweet spot), with up to **2 optional advanced actions** when chapters are ready.

It is grounded in the Green Goods v1 PRD domain lifecycles and pilot input patterns from recent form responses.

## Goals

1. Keep action selection simple for operators and gardeners.
2. Preserve enough structure for robust MRV/DMRV and reporting.
3. Support both user types clearly:
   - **Garden Operator** (admin/organizer/lead)
   - **Gardener** (member/attendee)
4. Reuse one UX pattern across all domains.

## Design Principles

- **4 actions by default** per domain, max 6.
- **Action families** map to a common lifecycle:
  1. Plan
  2. Execute
  3. Verify
  4. Report/Improve
- **Role-aware permissions** are explicit per action.
- **Evidence-first**: every action defines required and optional evidence.
- **Progressive complexity**: chapters can enable advanced actions without changing core reporting.

## Registry Data Model

Use a domain-first registry with normalized action metadata:

```ts
export type Role = 'operator' | 'gardener';

export type DomainKey =
  | 'solar_hub_development'
  | 'agroforestry'
  | 'ethereum_education'
  | 'waste_management';

export type ActionStage = 'plan' | 'execute' | 'verify' | 'report';

export interface ActionDefinition {
  id: string; // stable slug, e.g. "waste.cleanup_event"
  domain: DomainKey;
  title: string;
  stage: ActionStage;
  description: string;
  enabledByDefault: boolean; // true for core 4, false for optional actions
  allowedRoles: Role[];
  requiredEvidence: string[];
  optionalEvidence: string[];
  outputMetrics: string[];
  dependencies?: string[]; // action ids that should be completed first
}
```

## Permission Pattern

- **Operator-only actions**: setup, approvals, partner/facility reconciliation.
- **Shared actions**: event/work execution and basic evidence capture.
- **Gardener-heavy actions**: recurring field logs and reflections.
- Final verification can be configured as:
  - operator sign-off only (default)
  - operator + peer witness

## Recommended Action Sets (v1)

Each domain has:
- **Core 4 (default enabled)**
- **Optional +2 (advanced)**

---

## 1) Solar Hub Development

Aligned to PRD lifecycle: site acquisition, installation, commissioning, operations, workshops.

### Core 4

1. **Site & Readiness Setup** (operator)
   - Captures site photos, basic agreement proof, readiness checklist.
2. **Infrastructure Milestone Logged** (operator + gardener)
   - Tracks container retrofit/solar installation/connectivity milestone.
3. **Hub Service Session Logged** (operator + gardener)
   - Logs hours open, users served, charging/service sessions.
4. **Energy & Uptime Check Logged** (operator)
   - Records meter reading (kWh), uptime notes, maintenance notes.

### Optional +2

5. **Ethereum Node Operation Logged** (operator)
6. **Workshop Hosted at Hub** (operator + gardener)

### Why this set

Most pilot responses need to prove that infrastructure exists, is being used, and is reliable before deeper modules (node/yield/programming) are required.

---

## 2) Agroforestry

Aligned to PRD lifecycle: assessment, planting, monitoring, knowledge documentation.

### Core 4

1. **Site Assessment & Species Plan** (operator)
   - Baseline photos, site notes, species list.
2. **Planting Event Logged** (operator + gardener)
   - Species planted, count, optional rough GPS, event evidence.
3. **Survival Monitoring Check** (operator + gardener)
   - 30/60/90-day survival and condition updates.
4. **Maintenance & Learning Note** (operator + gardener)
   - Mulching/weeding/pest updates + short reflection on what worked/failed.

### Optional +2

5. **Harvest & Yield Record** (operator + gardener)
6. **Caretaker Assignment Record** (operator)

### Why this set

This captures the minimum viable agroforestry arc (plan → plant → survive → learn), while preserving room for education-oriented care assignment and production/yield reporting.

---

## 3) Ethereum Education

Aligned to PRD lifecycle: planning, hosting, attendance, learning, follow-up.

### Core 4

1. **Session Published & Roster Opened** (operator)
2. **Workshop Delivered** (operator + gardener)
3. **Attendance Verified** (operator + gardener)
4. **Follow-up Action Logged** (operator + gardener)
   - Example: wallet setup, first tx, project started, contribution made.

### Optional +2

5. **Learning Assessment Completed** (operator + gardener)
6. **Certificate/Badge Issued** (operator)

### Why this set

Pilot responses emphasize proving real behavior change (not only event attendance). The follow-up action is therefore core in v1.

---

## 4) Waste Management

Aligned to PRD lifecycle: assessment, cleanup, sorting, delivery/processing.

### Core 4

1. **Site Assessment Logged** (operator + gardener)
   - Before photo, site notes, approximate location.
2. **Cleanup Event Logged** (operator + gardener)
   - Participants + before/after evidence + quantity estimate.
3. **Sorting & Category Breakdown Logged** (operator + gardener)
4. **Disposal/Recycler Transfer Logged** (operator)
   - Receipt/log or partner confirmation.

### Optional +2

5. **Composting/Upcycling Batch Logged** (operator + gardener)
6. **Recurring Maintenance Check** (operator + gardener)

### Why this set

Pilots repeatedly prioritize lightweight DMRV: before/after proof, waste quantities, categories, and disposal evidence to satisfy trust and funding requirements.

## Cross-Domain UX Flow (Simple + Rich)

Use the same flow everywhere with domain-specific labels:

1. **Pick Domain**
2. **Pick Action (core 4 first)**
3. **Submit Evidence** (required first, optional expanded)
4. **Review & Confirm**
5. **Operator Verification Queue**
6. **Approved action updates metrics/reporting**

### UX Constraints for v1

- Show only **core 4** by default.
- Show optional actions behind **"Enable Advanced Actions"** per domain.
- Keep required evidence to **2–4 fields max** for gardener-facing submissions.
- Save drafts and support offline capture (especially photo-first flows).

## Operator vs Gardener Responsibility Matrix

| Action Type | Operator | Gardener |
|---|---|---|
| Program setup/planning | Owns | Views / contributes context |
| Event or field execution | Co-runs | Co-runs |
| Evidence capture | Reviews quality | Primary capture in the field |
| Verification/sign-off | Owns | Optional peer witness |
| Reporting/export | Owns | Views personal + team progress |

## Suggested Registry Seed (Summary)

- 4 domains × 4 core actions = **16 default actions**.
- 4 domains × 2 optional actions = **8 advanced actions**.
- **24 total definitions** in v1 registry.

This keeps the product easy to learn while allowing growth into deeper MRV and funding workflows.

## Phased Rollout Recommendation

### Phase 1 (Launch)

- Ship only 16 core actions.
- Per-domain completion and output metrics.
- Single verification mode (operator sign-off).

### Phase 2 (After pilot signal)

- Enable optional +2 actions per domain.
- Add peer witness mode where needed.
- Add domain-specific quality scoring.

### Phase 3 (Scale)

- Add automation hooks for report generation and certificates.
- Expand action templates per chapter while preserving core action IDs for comparability.

## Decision Checklist

Before adding a new action, confirm:

1. Does it map to one of the 4 lifecycle stages?
2. Is it distinct from an existing action (not just a field variation)?
3. Can it be completed with realistic evidence in low-bandwidth conditions?
4. Does it improve reporting, verification, or behavior change signal?
5. Can both roles understand who owns it?

If not, keep it as a field on an existing action instead of creating a new action.
