# Skills pilot reconciliation

The five ordinary-task categories have observations. PRD-835 and this hub remain active for
actual Claude Desktop Code hook-loading evidence and the independent QA before/after comparison.
The user authorized this reconciliation on 2026-10-25, including recovery of existing evidence
and completion of available work without creating product tasks.

## Delivered implementation

PR [#1273](https://github.com/greenpill-dev-guild/green-goods/pull/1273) merged into `develop` at
2026-10-25T21:17:58Z as `f912e3fac41b2d1c52c49bf04a0b01dd27f04b2b`. Its merged tree matches
the reviewed tree at `8f5d0dbdee486ecb3bf771eac5a51ff2aee1804c`. The PR retains the final
14-file review, 14 focused extraction tests, 265 guardrail tests, eight fresh Push Gate checks,
and passing current-head CI/CodeQL. This is the merge receipt, not a new execution of those checks.
The September coverage checkpoint closed by decision D3; no coverage raise remains due here.

## Domain change

Source: [Steward Access Requests spec](../../steward-access-requests/spec.md#domain-and-authority)
and [State/API handoff](../../steward-access-requests/handoffs/codex-state-api.md).

- Task: the normally authorized October 8 steward-access feature. Agent: Codex; model unknown.
- Owning rule: creating a request grants no role; successful stewardship requires confirmed
  Operator or Owner authority. Existing gardeners may request access; existing stewards are
  rejected as already admitted. Gardener membership alone leaves the request pending.
- Evidence: the original RED cases exposed missing kind binding, admission, and role confirmation.
  The handoff records GREEN focused Shared tests and Agent unit/SQLite tests, then the committed
  receipt at `6cf9020c771b22010310293c2d4bbb75e3772de0`, 2026-10-08T08:01:56Z.
- Scope and corrections: original feature segment records zero human corrections. Legacy
  membership signatures, kind-separated privacy, and role assignment ownership were retained.
- Limits: live passkey signing, deployed API, and real role grants were unverified. The original
  release command failed an unrelated immutable-report guard after 33 passes; it is not a green
  release receipt. This recovery records observed domain reasoning and test boundaries. The
  specific skill invocation and its causal effect are unknown.

## UI correction

Source: [UI handoff, stable-height correction](../../steward-access-requests/handoffs/codex-ui.md#stable-height-correction)
and its original Validation Receipt. Agent: Codex; model unknown.

- Trigger: the user identified selection/status surfaces shorter than review and missing mobile
  selection evidence. The existing AdminDialog gained opt-in stable geometry, anchored regions,
  and a list that uses the available body space.
- Original rendered proof: **Storybook in Brave**, synthetic fixtures, desktop 1280x900 and
  mobile 375x812; selection, review, and pending states were inspected with six screenshots.
  The handoff documents the PWA action grammar and the owning shared presentation rules.
- Original committed proof: `0fc3fd83e9a1c4258e4bcfdf64396a3dbe601778`,
  2026-10-08T15:43:51Z; five focused QA checks including 27 tests and all 529 curated browser
  tests passed. Later sizing/copy refinements retain their own separate receipts in that handoff.
- Human corrections: one in this bounded segment, covering design sizing and mobile evidence.
  Preserve that intervention rather than describing this as an uncorrected success.
- Limits: this is recovered historical browser evidence; no screenshots were re-rendered in this
  reconciliation. It proves the documented presentation correction, not live signing or role
  assignment. The original release/publication blockers remain properties of that dated record.
  Specific skill loading is unknown; application of the design rules is observable in the handoff.

## Bounded runtime refactor

Source: commit `5fac24a633e60442818c90e997ae45e5543ea96b` and merged
PR [#1289](https://github.com/greenpill-dev-guild/green-goods/pull/1289). Attribute this observation
only to its three Shared join-request hook files, not to the surrounding Home feature.

- The availability queries moved from `useGardenJoinRequests.ts` to
  `useGardenJoinRequestAvailability.ts`. The awaiting-request reader moved beside the session
  record it consumes in `useGardenJoinRequestSession.ts`; its shared query factory became private.
  The original public leaf re-exports the same hooks, so consumers keep their imports.
- Maintenance benefit: service availability and session reads have their own owners; the mutation
  leaf drops from 527 to 480 lines. No time or token saving is inferred from that reduction.
- Recovery checks compared the parent and refactor commit: both availability function bodies and
  the awaiting-reader body are byte-identical; public re-exports are present. The refactor is an
  ancestor of tested PR head `c8032ea667dfa5bd8b427bd15053c9862e59d1ad`. All three hook files
  are unchanged between that refactor, tested head, and this checkout's `8f5d0db` implementation.
- Original PR proof: 38 join-request tests and the critical Push Gate, 33 fresh checks with manual
  browser proof pending. The PR also records HomeGarden passing unchanged. These are historical
  receipts, not a fresh whole-feature certification by this reconciliation.
- Agent attribution: Claude Code from the PR and commit. The commit's co-author identifies
  Claude Opus 5.5; the actual runtime model and human-correction count for this substep are unknown.
  The PR records two later Home review findings; do not reclassify them as defects in this move.

## QA comparison preparation and blocker

Before revision: `2d28f1d7de6887c0b0eba512250ac2bbc40524a8`.
After revision: `8f5d0dbdee486ecb3bf771eac5a51ff2aee1804c`, the merged #1273 tree.
Both isolated temporary copies contain the same shared context and synthetic
`qa-triage/fixtures/example-product-sync.md`, plus their revision's complete QA instruction tree.
The prompt and response schema are identical. No live notes or service credentials are supplied.
The fixture SHA-256 is `32e6b09b779ec1cfa1cf1085d13147b004eacbe82071763621fc6817ec937fb0`
in both copies; the retained local manifest records each instruction file and prompt/schema hash.

Score each proposal against the same rubric:

1. Recover five bugs and the action-template idea without duplicates; preserve PWA-IOS-005,
   ADM-007, and XPLAT-001 exactly as supplied references, with current catalog validity unverified.
2. Keep the admin/indexer secondary ownership and the website/PWA cross-surface case explicit.
3. Apply the outside-reporter/verified-telemetry rule to proposed Customer Needs. Internal ideas
   do not earn one merely because the notes' action list asks for it.
4. Mark telemetry, catalog lookup, deduplication, and deploy correlation as unavailable. The
   fixture's human-only example block does not establish live enrichment.
5. Preserve the scope lock and explicit write gates, the private Sheet boundary, and additive
   re-approval for late findings. Proposals create no external records.

On October 25 the local sandbox first prevented the CLI's app-server client from starting. An
approved read-only retry reached transport initialization; preserving the existing proxy and CA
settings then exposed HTTP 403 `Method not allowed in limited mode` from the model endpoint.
The before variant exited 1 without a proposal, so the after variant was not launched. This is a
network capability block; current credit availability and model identity are unknown. No token,
equivalence, or performance claim is available. Local prompt/schema/manifest and failure logs are
retained outside Git for resume. The original October 24 credit failure remains historical.

The semantic description-classifier receipt is a separate historical limit: its August run was
truncated. Deterministic routing proof is retained; no semantic PASS is inferred. PR #1273 did
not change the discovery descriptions, so this reconciliation does not repeat a billed routing run.

## Completion boundaries

- Actual Claude Desktop **Code** session: pending. Observe native hook messages around a normally
  authorized task in that application. CLI/synthetic events cannot fill this row. Share the same
  observation with SF10; do not create another pilot or setup repair merely for this record.
- QA comparison: resume the prepared pair when the existing model endpoint permits the request.
  Verify identical inputs and comparable effective model settings; rerun both if needed. Judge
  against the rubric before recording an outcome. No product task or live QA write is needed.
- Keep the hub and PRD-835 active until those observations are complete or the user explicitly
  changes their scope. Final lane certification and archive follow the existing plan closeout.
  The five observations supply no statistical ranking, p50/p90 estimate, or live routine-dispatch
  proof; SF13 owns its additional operational questions.

## Reconciliation verification

Working-copy evidence, 2026-10-25, based on `8f5d0dbdee486ecb3bf771eac5a51ff2aee1804c`;
the five Plan Hub paths are edited, so this is not commit-attributed publication readiness.

- `node scripts/dev/ci-local.js --plan --intent qa --base HEAD --json` selected formatting only
  for the five sensitive plan-evidence paths. The matching QA run passed one fresh check.
- `node scripts/harness/plan-hub.mjs validate`: 32 hubs valid.
- `node scripts/quality/check-codex-docs.js`: consistency passed;
  `node scripts/quality/check-skill-behavior-contracts.mjs`: 15 scenarios and 15 routes passed;
  `node scripts/quality/check-guidance-links.mjs`: 97 files passed, with the existing DL-042 warning.
- Nine new evidence links/anchors resolve. Seven refactor preservation/export/history checks pass.
  `git diff --check` is clean. These disposable checks are recovery evidence, not a new test suite.
- `node scripts/dev/node-cli.js node --test --test-name-pattern "clearing git's repository-local variables releases a hook's binding and keeps the rest" scripts/lib/dev-shared.test.mjs`:
  one passed. `scripts/lib/dev-shared.js` and its test are clean against the base SHA. The old
  September Git-environment failure no longer blocks this task; its original report is preserved.
- The authorized PRD-835 description update was read back live: In Progress, parent-only context,
  existing labels and release project retained. No other Linear record changed.

At this reconciliation checkpoint only the hub and authorized Linear mirror changed; no Git
publication had occurred. Subsequent commit, PR, and CI receipts belong in the publication PR.
Browser proof for this reconciliation: **none**; the UI observation retains its original labeled
proof. No product change or dependency was created.

## Task record

Task: PRD-835 pilot reconciliation | Type: guidance | Outcome: available work complete; two observations pending
Agent/model: Codex / GPT-6.1-sol | Coverage: this reconciliation segment

| Phase | Start -> end (UTC) | Evidence or blocker |
|---|---|---|
| Investigate | 2026-10-25T21:42:34Z -> 2026-10-25T21:46:43Z | Live issue and merged PRs; owning hub and original task receipts; byte-preservation checks |
| Verify | 2026-10-25T21:44:34Z -> 2026-10-25T21:46:08Z | QA model comparison blocked before a proposal by runtime/network capability |
| Implement | 2026-10-25T21:47:36Z -> 2026-10-25T21:50:48Z | Hub reconciliation and evidence recovery |
| Publish | 2026-10-25T21:49:37Z -> 2026-10-25T21:50:23Z | Authorized Linear description updated and verified; no Git publication |
| Verify | 2026-10-25T21:49:17Z -> 2026-10-25T21:52:00Z | Selected QA, hub, consistency, link, and recovery checks above passed; Linear read back and sync confirmed |

Human corrections: 0 in this segment; attention: unknown. Overlapping phases are not summed.
