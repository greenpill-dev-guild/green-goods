# Certified and Ma Earth evaluation plan

**Current state:** architecture/planning only. No runtime acceptance test below has run.
The public architecture owns dependencies D1–D9; its linked action crosswalk owns G1–G5/A1–A4.
The sync/provider architectures own S/M/H/SI/B/R gates. This file owns implementation proof
expectations. AC17–AC22 and AC27–AC32 apply only when the relevant extension
is accepted; they are not claims that every lifecycle trigger belongs in the first release.

## Acceptance matrix

| ID | Boundary | Required evidence | Lane / phase |
|---|---|---|---|
| AC1 | Identity control | OAuth DID plus exact GG proof; replay, audience mismatch and account switch rejected; wallet/passkey/embedded matrix | state_api / 1 |
| AC2 | Dual authority | Garden management and external project permissions separately enforced; account link alone enables no write | state_api, ui / 1 |
| AC3 | Grant custody | Encrypted storage, redacted telemetry, expired/revoked grant recovery, epoch invalidation, retention/deletion behavior | state_api / 1–3 |
| AC4 | All approval paths | Direct wallet, queued submission and batch receipts discovered with unique approval UIDs | state_api / 2 |
| AC5 | Canonical source | Wrong schema/resolver/Garden, failed tx, premature finality and reorg rejected; cursor replay and atomic commit tested | state_api / 2 |
| AC6 | Native provider mapping | Pinned schema fixtures validate; correct key shapes, typed content and strong references; project fields preserved | state_api / 2 |
| AC7 | Attribution and privacy | Verified reviewer consent, no invented independent evaluator or impact score; indirect private metadata/media excluded | state_api, ui / 2 |
| AC8 | Durable delivery | Crash after every stage; timeout after remote commit; readback conflict; leases; partial success; bounded retry; restart | state_api / 2 |
| AC9 | Provider concurrency | Concurrent project mutation uses remote CAS; capacity limit produces blocked status | state_api / 2 |
| AC10 | User-visible status | GG approval, Certified publication and Ma Earth visibility separate; preview matches saved payload hash | ui / 2 |
| AC11 | Live Ma Earth display | Actual authorized project visibly displays the native records and correct reviewer/source relationship | qa_pass_1 / 3 |
| AC12 | Corrections | Later negative decision, multiple reviewers, changed activity CID and source invalidation produce correct downstream interpretation | state_api, qa_pass_1 / 3 |
| AC13 | Disconnect race | Unsent intents cancelled, in-flight outcomes reconciled, no new writes after revocation, public-erasure limit explained | state_api, ui / 3 |
| AC14 | Operational recovery | Restore from encrypted backup does not duplicate logical records; destination pause and sanitized alerting work | qa_pass_1 / 3 |
| AC15 | Automatic consent | Standing policy covers exact fields/actions/revision; broadened scope or destination change requires renewed consent | ui, state_api / 4 |
| AC16 | Regression and release | No approval-path regression, current-head selected local/CI checks, authenticated identity proof and sequential QA receipts | qa_pass_2 / each release |
| AC17 | Shared records and independent views | Same repository/source/semantic role reuses a record across Ma Earth and Bumicerts; mapping revision, reconnect and indexing delay create no duplicate activity; each view has dated version evidence | state_api, qa_pass_1 / 5 |
| AC18 | Monitoring provenance | Two visits preserve stable subjects, date/method/units/uncertainty; URI-only external links have captured versions; changed observations mark comparisons stale; no invented planting count or species | state_api / GainForest pilot |
| AC19 | Assessment meaning | Baseline plan differs from measurements; v2/v3/kind/cycle mapping accepted; invalid baseline, chronology, revocation and incomparable methods block delta export | state_api / A1 |
| AC20 | Commitment source completeness | Seeded is not Open; promise is not Work; both normal and dispute fulfillment are discovered; cancellation/correction and chain readiness proven; no inferred payment | state_api / A2 |
| AC21 | Certificate provenance | New mint and existing-token registration remain distinct; active chain/product and evidence bundle checked; no implied Regen credits or automatic mint authority | state_api / A3 |
| AC22 | External consent and loop prevention | Native schema/authority fixtures, ecological/community disclosure and license policy; imported evidence keeps origin; our own export cannot become new GG Work or re-export indefinitely | state_api, ui, qa_pass_1 / 5 |

| AC23 | Historical coverage | Bounded range/upper watermark, page crash, overlapping live scan and gaps; old work uses current effective decision and consent | state_api, ui / 2 |
| AC24 | Comparison and adoption | Desired/base/remote comparisons, exact-match lost response, changed remote payload, deleted record and pre-existing adoption; unsupported readback never means missing | state_api / 2 |
| AC25 | Sync controls | Preview selection and exclusions, scope counts/freshness, pause/cancel, partial resume and read-only Check sync; no false all-synced result | ui, state_api / 2 |
| AC26 | Reconnect and restore | Same identity rotates grants without losing mappings; different identity blocks replay; backup restore retains reserved keys and uncertain outcomes | state_api / 2–3 |
| AC27 | Assessment decomposition | Diagnosis can be evaluation; observations require metric/unit/method; targets and missing values never become measured outcomes; correct subject and evaluator | state_api / A1 |
| AC28 | Silvi native workflow | Existing asset/repeat claim, method/capture requirements, AT/native/export mode, timeout recovery, independent review/payment | state_api, qa_pass_1 / SI pilot |
| AC29 | Bloom reporting | Community authority, deduplicated manifest, native report or user-reported receipt, independent peer review/rewards and actual correction | state_api, qa_pass_1 / B pilot |
| AC30 | Regen operations | Native content hash/IRI, raw vs graph, explicit signer/network/fees, persisted tx before broadcast, sequence/timeout recovery, correction version; anchor is not attestation | state_api, qa_pass_1 / R pilot |
| AC31 | Social/report output | Public preview equals crawler page/assets; missing vs targets vs observed, no double counting, PNG/PDF/text accessibility, sensitive-media exclusion, stale/correction behavior; cancelled/copy/handoff never claims Published | ui, state_api / H track |
| AC32 | Modular provider boundary | Certified and second adapter pass capability-specific conformance and faults; unsupported operations disabled; one provider outage cannot block source actions or other destinations | state_api / M1 |

## Proof strategy

Use focused tests for meaningful boundaries: pure projection and policy tests in Shared;
database/provider fault-injection tests in Agent; preview and repair states in Admin. Add provider
fixtures from the approved deployed version, then run a separately authorized live conformance
exercise. Mocks do not establish provider compatibility or Ma Earth visibility.

Record RED/GREEN commands and evidence in implementation lane handoffs with the Plan Hub helper.
Do not mark a runtime lane passed on the strength of this documentation build. Run the repository
validation selector at each checkpoint and preserve its critical overrides. Do not add tests that
merely mirror field assignments or require live provider credentials for routine CI.

Account linking/signing needs labeled authenticated-session browser proof. Other UI surfaces use
the accepted labeled mock-auth, Storybook or CI browser class. Real provider pilot results must
identify the tested version, source approval, destination and observed outcome while excluding
private identities and credentials from public artifacts.

## Planning PR checks

- Plan Hub schema and Markdown links.
- Documentation authority/generated projections and production build.
- Parse every Mermaid diagram; inspect rendered diagrams when the local browser surface is available.
- Scoped formatting/lint, post-commit push gate, then current-head GitHub CI.

Validation receipts belong in the chat/PR handoff for this documentation-only update. Future
implementation receipts require exact commit SHA, UTC time, command/result and clean path-scoped
worktree evidence. Any failed, pending or unrun check remains explicitly labeled.
