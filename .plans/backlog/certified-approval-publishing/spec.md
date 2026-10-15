# Certified and Ma Earth approval publishing specification

## Architecture authority

The [public architecture specification](../../../docs/docs/builders/reference/certified-atproto-integration-spec-2026-07.md)
is the single design reference for component boundaries, sequence diagrams, ERD, state machines,
DFD, activity and class diagrams, mapping rules and gates D1–D9. The
[topology memo](../../../docs/docs/builders/reference/certified-atproto-topology-memo-2026-07.md)
records the recommended delegated Agent topology and rejected alternatives. This hub does not
duplicate those models.

## Users and behavior

- Steward: prove account control, select a permitted project, consent to public reports and inspect outcomes.
- Garden integration manager: authorize or revoke the destination/grant under the role selected in phase 0.
- Gardener/reviewer: retain proper attribution and evidence/privacy boundaries.
- Operator: recover uncertain deliveries, inspect sanitized errors and pause publishing.

Linking must be distinct from publishing permission. The service must discover confirmed
approvals across direct, queued and batch paths, validate source authority, persist intent,
project only permitted fields, and deliver native activity/evaluation/evidence/project records.
Readback receipts establish Certified publication; actual Ma Earth display establishes visibility.
Conflicting later reviews and public corrections need explicit semantics before broad automation.

## Evidence and assumptions

Repository evidence was reviewed at `b9176994beddb74c1f32240a1829a7e2c3805896`. The architecture
lists exact source paths and upstream references checked on 2026-10-15. Candidate lexicons are
v1.5.1; reference-page version drift, deployed OAuth scopes, CGS conditional writes, group custody,
evaluation attribution and Ma Earth indexing remain gates. No live provider conformance test was
performed for this planning update.

## Phase 0 decision register

| Decision | Recommended starting point | Current status |
|---|---|---|
| Integration-manager authority | Explicit authorized Garden management role, verified separately from review attribution | Needs product/domain acceptance |
| Personal link topology | BFF OAuth plus exact Green Goods account proof | Needs D2 proof |
| External destination | Existing CGS group repository and project collection | Needs D3/D4/D9 proof |
| Reviewer model | Verified consenting reviewer DID; explicit Green Goods relationship | Needs D5 acceptance |
| Report consent | Per-report preview first, versioned standing policy later | Needs D8 policy acceptance |
| Effective decisions | Preserve current latest-timestamp semantics and conflicting-decision uncertainty; retain each source reviewer | Needs D6 fixtures |
| Source confirmation | Chain-specific finality, bounded scanner, explicit activation/backfill block | Needs operational selection |
| Credential and DB custody | Existing Agent runtime with encrypted grants, durable database and tested restore | Needs D7 deployment proof |
| Correction display | Explicit correction of stale external positive reports, with retained source/CID audit | Needs D6 provider demonstration |

## Lane mapping and constraints

| Lane | Scope | State |
|---|---|---|
| `state_api` | Shared public contracts/projection, Agent identity/source/publisher module | Blocked pending phase 0 and runtime scope acceptance |
| `ui` | Shared hooks and Admin account/Garden/approval controls | Blocked pending accepted contracts and phase 0 |
| `contracts` | No source changes planned | Not applicable |
| `qa_pass_1` | Product workflow, attribution, privacy and recovery evidence | Blocked on implementation |
| `qa_pass_2` | Independent regression/security review | Blocked on first QA |

Hooks belong in Shared, consumed through declared exports; new UI copy uses i18n. Secrets stay
server-side and root configuration rules apply. The existing browser queue continues to own
pending onchain work; a separate durable Agent outbox owns external reports. Preserve critical
validation overrides if implementation touches auth/work/queue mutation surfaces. No dependencies
may be installed or upgraded without explicit task approval.

## Failure examples that must remain explicit

- A linked person without external project rights can view connection state but cannot activate publishing.
- A confirmed EAS transaction containing three approvals creates three source identities, not one hash-based report.
- A timed-out external write is read back at the saved record key before retrying the same payload.
- A different remote payload at that key blocks for review; it is never silently overwritten.
- An approved public preview becomes stale when source, destination, policy or grant epoch changes.
- A later rejection cannot leave an old positive report presented as current without a visible correction state.
- A disconnected grant can still have an already committed in-flight result; status must report the real outcome.
