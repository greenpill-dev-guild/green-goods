# Certified and Ma Earth approval publishing plan

**Feature Slug**: `certified-approval-publishing`  
**Status**: BACKLOG — architecture proposed; runtime execution pending phase 0  
**Created / Last Updated**: 2026-10-15  
**PR**: [#640](https://github.com/greenpill-dev-guild/green-goods/pull/640)  
**Related research**: RESR-69 (Backlog when inspected; not changed by this plan)

The [public architecture](../../../docs/docs/builders/reference/certified-atproto-integration-spec-2026-07.md)
owns diagrams and dependency IDs. This hub owns execution order and evidence. No runtime code,
external account, provider record, or live publishing policy is changed by the planning PR.

## Decision log

| Decision | Rationale and status |
|---|---|
| Start with Certified/Ma Earth linking and approval publication | Selected product direction from the user; other platforms follow |
| Add a publication module to the existing Agent runtime | Proposed; covers every approval path and browser closure without a new deployment |
| Separate personal link, Garden binding, grant and policy | Proposed; each has different authority and revocation rules |
| Preview each report before enabling standing automation | Proposed rollout default; bounds initial attribution/privacy/correction risk |
| Use an existing CGS repository/project | Proposed; provisioning and custody migration add an independent operational problem |
| Read canonical EAS sources; keep existing approval mutation paths intact | Proposed; client completion events cannot cover all confirmed decisions |
| Keep the candidate schema at v1.5.1 until conformance evidence selects a pin | Research baseline, not dependency-install authorization |

## Requirements coverage

| Requirement | Steps | Completion evidence |
|---|---|---|
| Architecture first, with all requested diagram types | Planning PR | Component, DFD, ERD, three sequences, two state machines, activity and class diagrams |
| Steward connects an existing Certified identity | 3–5 | Verified account/DID, replay rejection and authenticated browser proof |
| Garden selects the correct external project | 4–5 | Both authorities checked; explicit existing project binding and disconnect |
| Work approvals cross-post under native provider structure | 6–10 | Activity/evaluation/evidence/project receipts with exact source provenance |
| Delivery survives offline submission, browser exit and retry | 6–9 | Chain scanner, durable intent, replay and crash recovery proof |
| Ma Earth displays the result with correct attribution | 11–12 | Actual provider-visible project report and correction test |
| Automatic publication follows user consent | 13 | Versioned standing policy, pause/revoke and stale-source checks |
| GainForest, Bloom, Silvi, Regen can follow | 14 | GainForest monitoring pilot and independent native provider mappings without speculative adapter code |
| All nine actions map to the ontology | Planning PR, 2, 14 | Crosswalk names authoritative sources, valid triggers, native representations and deferred gates |
| Shared AT records do not duplicate across apps | 8–11, 14 | Stable semantic record identity; per-application visibility and explicit distinct-repository copies |
| Unresolved dependencies remain visible in PR | Every checkpoint | D1–D9 and extension G1–G5/A1–A4 matrices updated with observed results |

## Scope and implementation boundaries

Runtime changes are expected in Shared public types/mapping/hooks, Agent persistence/API/worker,
and Admin settings/status. Contracts and Envio changes are not planned. Existing auth, Work and
JobQueue code is critical if touched; retain the validation selector's full critical override.
The public ontology is updated only when the domain mapping is accepted, not to make a proposed
integration appear live. Root-only environment configuration and declared Shared exports apply.

The nearest existing implementations are the signed Garden-join request verifier, Agent database
migrations and reporting outbox, existing EAS source readers, and Shared approval submission.
Their gaps are integration-specific account binding, provider grants, durable external record
checkpoints and source reconciliation. Reuse primitives, not conversation or join-request domain
payloads. Removing the Certified adapter should leave onchain approval behavior unchanged.

Each numbered step is a session-sized checkpoint, normally up to four implementation/test files.
Paths below are proposed file targets, not existing APIs. If a step needs more files, split it
before execution and keep a runnable checkpoint. Backend and UI steps follow their actual data
dependencies; do not start several incomplete lanes in the shared checkout.

## Phase 0 — conformance and scope decisions

### 1. Verify the provider contract

- [ ] Record D1, D3, D4, D5 and D9 evidence in `spec.md` and the architecture dependency table.
- [ ] Use an authorized test identity/project to prove scopes, group role, schema keys, conditional
  writes, attribution and Ma Earth discovery; obtain dependency approval before installing anything.
- [ ] Produce a pass/block decision for the chosen topology, including correction display semantics.

**Verify:** every claimed capability has a versioned source or observed test receipt; unsupported
capabilities remain blocked. No live mutation is authorized by this planning step alone.

### 2. Set the Green Goods authority and operating policy

- [ ] Resolve D2, D6, D7 and D8: integration-manager role, proof matrix, effective approval semantics,
  finality/backfill, public fields, retention, custody and production persistence.
- [ ] Record choices in `spec.md`, `eval.md`, and the architecture; accept the implementation scope.
- [ ] Review the nine-action ontology crosswalk. Keep approval publishing as the first public trigger;
  assign later assessment, commitment and certificate gates without silently expanding phase 1.

**Verify:** concrete accepted/rejected examples exist for linking, publication and correction.
Phase 1 can begin once its subset of gates passes; later unresolved gates stay visible.

## Phase 1 — account linking and Garden configuration

### 3. Define account-link commands and verification

**Proposed files:** Shared `public-contracts/impact-publication.ts` and its behavioral test,
Shared `package.json` export, Agent `api/routes/integration-proof.ts`.

- [ ] Define nonce-bound account/DID/chain/audience/action/expiry claims and sanitized status types.
- [ ] Verify replay, account switching, and supported wallet/passkey/embedded proofs using reviewed primitives.

**Verify:** valid control proofs link exactly one pair; substituted DID/account/audience and reused
nonce fail. Manifest/export changes are sensitive and require reporting.

### 4. Persist OAuth links and grants

**Proposed files:** Agent integration migration, `services/impact-publication/store.ts`,
`api/routes/integration-oauth.ts`, and the owning integration test.

- [ ] Implement bounded BFF OAuth callbacks and encrypted credential references with account-link epochs.
- [ ] Add tested CGS capability discovery, role checks and revocation through the selected provider flow.

**Verify:** expired callbacks and missing capabilities fail closed; secrets do not appear in logs,
API responses, browser storage or public snapshots. D2/D3/D7 must pass first.

### 5. Bind an existing project and expose account controls

**Proposed files:** Agent `api/routes/integration-destinations.ts`, Shared integration hook,
Admin existing settings entry, Admin connection panel/test boundary (split if more than four files).

- [ ] Show linked identity, repository publisher and existing project; validate Garden-management authority.
- [ ] Save explicit destination/policy and implement disconnect with epoch invalidation.

**Verify:** linking alone enables no writes; unauthorized Garden/project selections fail; authenticated
browser evidence covers signing, switching accounts, reconnect and disconnect. D8/D9 gate activation.

## Phase 2 — explicit preview and Certified publication

### 6. Reconcile confirmed approval sources

**Proposed files:** Agent `approval-source-reader.ts`, `source-reconciler.ts`, store transaction
extension and behavioral scanner test in `services/impact-publication`.

- [ ] Scan configured Gardens with canonical receipt/finality checks, overlap cursor and explicit activation block.
- [ ] Atomically store source and eligible intent with deduplication and batch-aware source extraction.

**Verify:** direct, queued and batched approvals are each discovered once; replay, crash before
cursor commit, out-of-order records and reorgs produce the expected source state.

### 7. Project and consent to public evidence

**Proposed files:** Shared `modules/impact-publication/projection.ts`, its tests,
Agent `api/routes/integration-publications.ts`, and projection snapshot store extension.

- [ ] Map allowed Work/Approval fields to pinned lexicons and verified reviewer attribution.
- [ ] Persist exact payload hashes and versioned consent, rejecting indirect private metadata links.

**Verify:** malformed/unconsented media, stale source, unknown evaluator and changed payload cannot
be published; confidence is preserved as review evidence, not an invented impact score.

### 8. Build the Certified write adapter

**Proposed files:** Agent `certified-adapter.ts`, `record-keys.ts`, protocol fixtures and adapter tests
under `services/impact-publication`.

- [ ] Implement tested write/readback and project merge with correct record key rules and strong references.
- [ ] Classify provider failures and conditional-update conflicts without losing unrelated project data.

**Verify:** exact deployed API fixtures prove unknown-outcome recovery and CAS behavior; a missing
remote capability blocks the operation instead of falling back to blind overwrite.

### 9. Add durable worker and restart recovery

**Proposed files:** Agent `publication-worker.ts`, repository lease/checkpoint extension,
existing runtime lifecycle registration, worker recovery test.

- [ ] Reserve keys/payloads, lease intents, checkpoint each stage, and retry known transient failures within a budget.
- [ ] Recheck source and grant epochs; reconcile uncertain writes and disconnect races.

**Verify:** fault injection after every external write creates no duplicate logical records; concurrent
workers, partial success, lease expiry, process restart and grant revocation preserve actual outcomes.

### 10. Expose preview and publication receipts

**Proposed files:** Shared publication-status hook, Admin preview component, Admin work-detail
integration and its UI test (split as needed).

- [ ] Present the exact public payload, destination and reviewer; require explicit consent in the pilot.
- [ ] Show approval, publication and Ma Earth visibility separately with clear repair actions.

**Verify:** provider failure never changes Green Goods approval success; browser closure loses no
intent; UI reflects partial/blocked/uncertain results without claiming Ma Earth visibility.

## Phase 3 — supervised Ma Earth pilot

### 11. Prove visibility and correction semantics

**Targets:** provider conformance fixtures, focused integration test, sanitized evidence in `eval.md`.

- [ ] Publish approved test evidence to the selected project and verify actual Ma Earth display.
- [ ] Exercise later contradictory decisions, multiple reviewers, activity versions and stale positive reports.

**Verify:** D4–D6 pass with actual result links and observed semantics. If correction is unsupported,
keep automatic rollout blocked and record the precise product limitation. Keep private identities out of Git.

### 12. Prove operations and complete sequential QA

**Targets:** operational runbook, `eval.md`, QA lane handoffs.

- [ ] Demonstrate pause/revoke, disconnect during send, rate-limit recovery, encrypted backup/restore and alerting.
- [ ] Complete product/UX QA followed by regression/security review on the tested implementation SHA.

**Verify:** D7–D9 satisfied, no unresolved critical defect, and all required local/CI/browser evidence
is fresh. Runtime lanes remain pending until their RED/GREEN evidence exists.

## Phase 4 — standing automatic publication

### 13. Roll out a bounded automatic policy

**Targets:** Shared policy contract, Agent eligibility policy, Admin consent controls and policy test
(split into separate package checkpoints if needed).

- [ ] Offer explicit opt-in for defined fields/actions and future eligible approvals; keep preview as a fallback.
- [ ] Require renewed consent for broader fields, mapping revisions or changed destinations; roll out per Garden.

**Verify:** current consent and both authorities are checked at send time; unsupported correction,
stale source, unknown authorship, and exhausted retries stop automatic delivery with visible reasons.

## Phase 5 — later provider mappings

### 14. Scope the GainForest pilot and later provider/action plans

**Targets:** the action crosswalk and a separately accepted pilot/research brief; no runtime
extension is authorized by completing this planning checkpoint.

- [ ] GainForest: resolve G1–G5 with one existing project, baseline visit, approved Work,
  follow-up and corrected observation. Start with explicit evidence links; prove shared record
  identity, native organization/site references, units, licensing and independent AppView visibility.
- [ ] Route assessment, cycle/commitment and certificate triggers through A1–A3 with their owning
  teams. Preserve source lifecycle and actual product readiness; do not treat all actions as activities.
- [ ] Bloom: establish its community/action/report identity and authenticated write contract.
- [ ] Silvi: establish site/tree/monitoring schema and evidence rules. Regen: distinguish data anchor,
  attestation and credit issuance, then select the intended operation.

**Verify:** each proposal has confirmed account authority, native object mapping, trigger, evidence,
delivery semantics and acceptance criteria. GainForest can progress independently of the other
providers. A4 gates adoption into canonical ontology/projection sources after mappings are accepted.
No generic adapter framework is required in phase 1.

## Validation and current status

Planning artifacts need Plan Hub validation, document authority/link checks, Mermaid parse proof,
Docs production build, formatting/lint and the selected post-commit push gate. Runtime tests are
specified in [eval.md](./eval.md), not reported as run. The implementation lanes stay blocked;
contracts are not applicable. Planning validation and phase timing are recorded in the chat
handoff and [planning handoff](./handoffs/planning.md); future QA records must identify the exact
tested implementation SHA and a clean path-scoped worktree.
