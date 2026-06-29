# Commitment Pooling Lifecycle And Aggregator Semantics

Last updated: 2026-06-29

This is a planning/scoping brief, not an implementation plan. Linear remains the current
research/product source of truth until the commitment-pooling work is explicitly promoted to
implementation.

## Current Alignment

- Green Goods should add a `CommitmentPoolingModule` in the contracts module system.
- V1 uses a module with a pool registry/control plane. The module owns default pool identity, cycle
  lifecycle, capability flags, and aggregate event/state semantics.
- A separately deployed aggregator is not required for V1. A future split is allowed only if it does
  not change `poolId`, user flows, or the shared pool identity.
- Grassroots Economics / Sarafu remains a clean-room reference, with future interoperability in
  mind, but the Green Goods module can differ where our roles, offline field UX, and seasons need a
  different shape.
- Existing gardens get default pools through HoA/readiness/backfill. Future gardens auto-provision
  once the module is live.
- Operators and owners are the highest-permission roles for pool operations.
- Proof and settlement remain capabilities attached to the same `poolId`; settlement must not
  replace the proof pool or create a second user-facing pool.
- G$ on Arbitrum is partner-confirmed by the user, but token address, custody, and transfer path
  must be recorded before funds move.

## Planning Interfaces

These are planning interfaces, not code.

| Interface | Meaning |
| --- | --- |
| `poolId` | Durable Green Goods garden pool identity used by proof and future settlement. |
| `cycleId` | Season/campaign cycle inside a pool. Default pool cycles are the normal path. |
| `commitmentId` | Stable commitment identifier linked to issuer, counterparty/requester, work, and confirmations. |
| `poolState` | Readiness and availability of the garden pool. |
| `cycleState` | Season/campaign lifecycle inside the pool. |
| `commitmentState` | Social promise lifecycle from draft through reconciliation. |

Pool registry fields:

- garden account;
- default/season/campaign type;
- capability flags: proof enabled, settlement enabled later, paused/disabled;
- policy/charter metadata CID;
- active cycle pointer;
- optional settlement adapter address;
- aggregate event/state support for Envio and shared reads.

Commitment requirement fields:

- unit label and target quantity per commitment;
- required count of approved work submissions;
- required domains/actions where relevant;
- optional assessment requirement;
- confirmer rule;
- due date or cycle deadline.

Future offline job kinds:

- commitment creation;
- fulfillment confirmation.

## Pool, Season, And Campaign Lifecycle

Default approach: a garden has one default pool, and seasons/campaigns are cycles inside that pool.
Composting closes and recycles a cycle without deleting history.

Use a separate season/campaign pool only when the campaign has meaningfully different membership,
stewarding, settlement/reserve/custody rules, external partner reporting boundary, or a long-running
public story that should stay distinct from the default pool.

### Pool State Table

| State | Entered when | Allowed next states | UX meaning |
| --- | --- | --- | --- |
| `NotReady` | Pool identity exists or is planned, but steward/use case/evidence path is missing. | `Ready`, `Paused` | Admin shows readiness checklist; PWA can show "pool preparing" copy. |
| `Ready` | Steward, use case, evidence path, and confirmation path are recorded. | `Open`, `Paused` | Admin can open the pool/cycle; editorial can show readiness. |
| `Open` | Operators/owners open the pool or active cycle for commitments. | `Paused`, `Closed`, `Composted` | PWA allows offers/requests and operator-assisted capture. |
| `Paused` | Operators/owners pause new activity. | `Open`, `Closed` | Existing commitments can resolve; new commitments are blocked. |
| `Closed` | Operators/owners end new activity and preserve history. | `Composted` | Historical stats remain queryable; no new commitments. |
| `Composted` | Prior cycle is reconciled and archived, carried forward, or re-seeded. | `Ready`, `Open` | Garden can start the next cycle without pool bloat. |

### Season/Campaign Cycle State Table

| State | Entered when | Allowed next states | UX meaning |
| --- | --- | --- | --- |
| `Draft` | Operator/owner defines scope, expected commitments, and readiness. | `Seeded`, `Open`, `Cancelled` | Admin setup and HoA readiness template. |
| `Seeded` | Campaign commitments or funding context are seeded. | `Open`, `Cancelled` | Admin shows seeded commitments; PWA preview can open soon. |
| `Open` | Members can offer/request/accept commitments. | `InProgress`, `Reviewing`, `Cancelled` | PWA primary pool surface is active. |
| `InProgress` | Active commitments are being fulfilled. | `Reviewing`, `Cancelled` | PWA focuses on evidence, work submission, and progress. |
| `Reviewing` | Work/evidence is submitted and awaiting approval/confirmation. | `Reconciled`, `InProgress` | Operators review work; counterparties confirm promises kept. |
| `Reconciled` | Fulfilled, expired, cancelled, and disputed commitments are resolved for reporting. | `Composted` | Admin/reporting surface locks cycle outcomes. |
| `Composted` | Cycle closes and useful commitments are rolled forward or archived. | `Draft`, `Seeded`, `Open` | Next season starts with clean current-state views and historical continuity. |

## Commitment Model

The shared pool supports these commitment types:

- `DomainImpact`: tied to SOLAR, AGRO, EDU, or WASTE work and eligible for impact reporting after
  approvals/assessment.
- `SupportService`: mutual-aid commitments such as meals, rides, childcare, tool lending, meeting
  hosting, or coordination help. Visible in the pool, but not automatically counted as regenerative
  impact.
- `SeasonCampaign`: commitments seeded by or scoped to a specific campaign/season cycle.
- `OperatorCaptured`: analog/operator-assisted records that preserve the member as the social
  source of the promise when possible.

Creation authority:

- members can create their own offers and requests;
- operators/owners can seed campaign commitments;
- operators/owners can capture analog commitments for members, with the member preserved as the
  promise source when possible.

Default relationship: one commitment to many work submissions. One-to-one is a common case, but the
data model should allow several work submissions and approvals to satisfy one commitment.

## Commitment State Table

| State | Entered when | Allowed next states | UX meaning |
| --- | --- | --- | --- |
| `Draft` | Member/operator is preparing the commitment. | `Offered`, `Requested`, `Cancelled` | Draft form or operator-assisted intake. |
| `Offered` | Someone offers help, goods, or service. | `Accepted`, `Cancelled`, `Expired` | PWA/admin can match or accept the offer. |
| `Requested` | Someone requests help, goods, or service. | `Accepted`, `Cancelled`, `Expired` | PWA/admin can match responders. |
| `Accepted` | Counterparties and expectations are clear. | `Active`, `Cancelled`, `Expired`, `Disputed` | Commitment becomes socially accountable. |
| `Active` | Fulfillment is underway. | `EvidenceSubmitted`, `Cancelled`, `Expired`, `Disputed` | PWA shows work/evidence actions. |
| `EvidenceSubmitted` | One or more work/evidence records are attached. | `PartiallyApproved`, `ReadyForConfirmation`, `Disputed` | Operators review evidence; member waits for approval/confirmation. |
| `PartiallyApproved` | Some required work is approved, but requirements are incomplete. | `EvidenceSubmitted`, `ReadyForConfirmation`, `Cancelled`, `Disputed` | PWA shows remaining requirement progress. |
| `ReadyForConfirmation` | Approved work satisfies required count/quantity, or operator/owner waives/replaces rejected work with reason. | `Fulfilled`, `Disputed`, `Expired` | Counterparty gets the primary confirmation action. |
| `Fulfilled` | Beneficiary/counterparty confirms the promise was kept; operator/owner fallback can confirm with reason. | `Reconciled` | PWA celebrates the promise kept; stats update. |
| `Reconciled` | Cycle reporting counts the commitment outcome. | none | Historical reporting state. |
| `Cancelled` | Commitment is intentionally stopped before fulfillment. | `Reconciled` | Not counted as fulfilled. |
| `Expired` | Deadline passes without fulfillment. | `Reconciled`, `Disputed` | Not fulfilled unless operator/owner resolves otherwise. |
| `Disputed` | Fulfillment is contested. | `ReadyForConfirmation`, `Fulfilled`, `Cancelled`, `Expired`, `Reconciled` | Admin resolution path; details are not public by default. |

Fulfillment is counterparty-first. Self-confirmation is blocked. Operators/owners provide fallback
for analog capture, missing counterparties, high-value cases, and disputes.

## Work Approval Gates

Work approval proves work quality/evidence; fulfillment confirmation closes the social promise.

| Gate | Default rule | Override rule | Notes |
| --- | --- | --- | --- |
| Work attached | One or more work/evidence records link to the commitment. | Operator/owner can attach analog evidence reference. | Existing work submission remains the preferred path for domain impact. |
| Work approved | Approved work satisfies required count and/or target quantity. | Rejected work can be replaced or waived with operator/owner reason. | One rejected item does not permanently block fulfillment. |
| Assessment complete | Required only when the commitment declares an assessment requirement. | Operator/owner can defer assessment for non-impact support/service commitments. | Hypercert linkage remains deferred until cycle reporting is clearer. |
| Ready for confirmation | Requirements are satisfied or explicitly overridden. | Override must be visible in admin/member details. | Public surfaces only show aggregate progress. |
| Fulfilled | Counterparty confirms, or operator/owner fallback confirms with reason. | Self-confirmation is blocked. | This is the promise-kept moment. |

## Aggregate Semantics

The pool control plane should emit/index state transitions and maintain stats that are useful across
PWA, admin, and editorial surfaces.

Core counts:

- `commitmentsOffered`;
- `commitmentsRequested`;
- `commitmentsAccepted`;
- `commitmentsActive`;
- `commitmentsPendingReview`;
- `commitmentsReadyForConfirmation`;
- `commitmentsFulfilled`;
- `commitmentsExpired`;
- `commitmentsCancelled`;
- `commitmentsDisputed`.

Work/evidence counts:

- `workSubmitted`;
- `workApproved`;
- `workRejected`.

Unit/progress counts:

- `expectedUnits`;
- `approvedUnits`;
- `fulfilledUnits`;
- `openExposureUnits`.

Rates:

- `workApprovalProgress = approvedUnits / expectedUnits`;
- `promiseKeptRate = fulfilledCommitments / commitmentsDueForCycle`;
- `cycleCompletionRate = fulfilledUnits / expectedUnits`.

Units are per commitment. A commitment can use hours, tasks, meals, rides, plants, or another
operator-approved label without forcing a global conversion in V1.

Avoid leaderboard semantics. These are pool health and season/campaign readiness signals, not
individual ranking mechanics.

## Surface UX States

| Surface | V1 states to render | Visibility rule |
| --- | --- | --- |
| Client PWA | Preparing, open offers/requests, active commitments, evidence needed, pending approval, ready for confirmation, promise kept, cycle closed. | Members see their commitments and relevant counterparty details. |
| Admin | Readiness checklist, cycle setup, seeded commitments, review queue, overrides/waivers, dispute resolution, compost cycle. | Operators/owners see details, disputes, participant-level status, and override reasons. |
| Editorial/public | Garden pool story, active season/campaign, aggregate offered/requested/fulfilled/progress stats, promises kept narrative. | Public gets aggregate stats and curated stories only. |
| Analog/operator-assisted | Intake, member attribution, evidence capture, queued confirmation, later sync. | Consent/privacy rules apply; operators do not custody member accounts. |

Future settlement controls are additive on the same pool surface: redeem, transfer, reserve,
denomination, and curated exchange appear only when settlement capability is enabled.

## House Of Alignment Readiness Template

For each selected garden:

- garden name and garden account;
- operator/owner steward;
- default pool use case;
- likely season/campaign cycle;
- expected commitment types;
- evidence path;
- work approval path;
- fulfillment confirmation path;
- analog/operator-assisted capture needs;
- G$ on Arbitrum token/custody/transfer notes;
- readiness status: `Ready`, `NeedsSupport`, `NotReadyYet`;
- reporting notes and open risks.

## AI / IoT Evidence Policy

AI and IoT can support evidence and context, but should not replace human confirmation.

- AI/IoT evidence can attach as verification context.
- Human beneficiary/community/operator confirmation remains the closure mechanism.
- Consent and privacy rules are required before passive capture is used in community spaces.
- Hardware should be treated as long-term roadmap, not a first proof capability dependency.

## Remaining External Confirmations

- Record G$ token address, custody, and transfer path on Arbitrum before funds move.
- Confirm whether later settlement custody should use Garden TBA, garden Safe, or another
  operator-controlled structure.
- Confirm counsel guidance before any clean-room settlement/voucher contract work.
