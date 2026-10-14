# Scope and execution decisions

## Agentic development proposal (2026-10-04)

The initial request was for a comprehensive comparison and update plan. The
[comparison report](reports/2026-10-04-software-factory-comparison.md) is direct evidence for this
hub's verification and operating-cost work. The
[SF checklist](plan.todo.md#agentic-development-follow-up-proposed-2026-10-04) is its sole execution
plan. Afo subsequently selected SF01–SF04 with “Go ahead and implement the first batch.” These
four local slices were the scope at that stage; later authorizations below supersede that
selection. D14's timing for unrelated work remains unchanged. Publication, dependency changes,
Linear writes, and browser-policy changes are outside that first batch. Afo then selected the next batch: SF10–SF11, the independent constraint
repairs in the report. Afo then approved dependency changes and continuation: finish SF11 and
implement SF09 reporting. SF03 remains open and does not authorize broader browser rollout.

| ID | Recommended constraint | Rationale and decision status |
|---|---|---|
| SF-D1 | SF01–SF12 SELECTED for local implementation; SF13 and actual-session SF10 evidence remain open | Afo's subsequent batch and remaining-work authorizations supersede the first-batch scope. See “Remaining Software Factory local implementation” below for evidence limits. |
| SF-D2 | Extend browser CLI, existing fixtures, runner and receipt owner | These already own the lifecycle and proof. Avoid a duplicate verify framework or receipt database. |
| SF-D3 | Require named outcomes and strict unexpected-request handling | A route, visible body, or successful fake does not prove a workflow completed. |
| SF-D4 | Keep evidence classes and existing release attestation intact | Virtual authentication, clean-room Chromium, and installed authenticated Brave prove different claims. New automation is additive. |
| SF-D5 | Keep Stop/TaskCompleted advisory and native permissions unchanged | The architecture hub explicitly accepted this posture. Changing it is a separate policy decision, not a dependency of better verification. |
| SF-D6 | Diagnose before retrying; preserve original failures and cancellation | Load is context, not a deterministic explanation. Retry semantics need explicit design and approval if proposed later. |
| SF-D7 | Read-only worktree diagnosis; explicit targeted repair | Relative hook configuration exists already. Missing files require setup/conformance proof, not blanket shared-hook retargeting or deletion. |
| SF-D8 | Reproduce memory claims before turning them into rules | Memory can be stale, superseded, or judgment-heavy. No count-based deletion or blanket rule promotion. |
| SF-D9 | Treat dependency changes and external actions separately | Accessibility/property libraries, private-memory edits, schedules, dispatch, Git operations, and publication are not authorized by planning. |
| SF-D10 | Evaluate the existing outer-loop handoff before replacing it | Delegation is configured in routines. Live operation is unverified; a new dispatcher needs an observed gap. |

Ownership stays with the nearest existing capability. Browser behavior uses the browser runner
and tests; validation selection/evidence uses the existing policy and runner; local readiness
uses doctor/setup; type contracts use their owning package; live agent-hook observations stay
with the architecture hub's pilot; routine dispatch stays with the routine contract. The report's
candidate cards record the current interfaces, deletion test, dependencies, test migration,
risks, confidence, and rejected alternatives. SF01–SF04 use the existing owners; this batch adds
no new machine registry or orchestration framework.

SF01 uses Playwright's own server lifecycle for `all` and `smoke`, with an explicit Sepolia test
environment and refusal to reuse occupied ports. The direct Vite CLI avoids the package `dev`
script's development override. The ordinary PM2 development profile is unchanged.

SF02 replaces the shared fixture's permissive fallbacks with named GraphQL operations, checked
variables, exact RPC reads, and required-request accounting. Empty gardens/roles/vaults and the
selected approval simulation are explicit fixture states. SF03 proves offline approval
persistence and read-error recovery, plus Admin create-garden validation and cancel recovery;
it makes no deployment or real-wallet claim. SF04 adds the existing Client/Admin browser job
names to the aggregate gate's required-job map.

The initial browser pilot is bounded to an owned disposable profile and strict substitutes or
an explicitly selected local fork. It must not click arbitrary controls in a personal session,
broadcast to a public chain, or loosen production authentication. Supported roles and routes
come from code. Broad role/locale/viewport campaigns follow measured value and cost.

This proposal introduces no new product/domain behavior. Any defect repair discovered during
implementation requires its own scope decision, affected domain rules, and appropriate proof.

## Outcome and sources

Reduce the cost of changing and verifying Green Goods while retaining independently useful protection. Preserve the main package boundaries. Counts, line ratios and mock counts nominate investigation; they are not deletion quotas.

The source is the user-provided September 18 “Velocity Scorecard snapshot 05” execution brief, originally measured at `9180601ee`, plus the architecture audit and September 19 sequencing discussion. [Preparation evidence](reports/2026-09-19-preparation.md) pins the refresh. The original Claude artifact's full measurement method and fault definitions were not available in this session; the brief supports planning but cannot establish a comparable twelve-fault remeasurement.

## Test budget (item 1)

Prove each decision at its lowest owning layer. Add another layer where wiring, composition, recovery or interaction can fail independently. Prefer tables for pure decisions and existing `@green-goods/shared/testing` helpers. Move tests with code; remove exclusive tests with verified-unused code. Assert observable outcomes; retain source assertions when the source contract is the requirement and no cheaper faithful signal exists.

Spend proof effort where mistakes affect money, identity or data. Review duplicate layers, excessive setup, class assertions, uncalled exports and unexplained test/source growth. Preserve critical cleanup and composition proof; do not turn “critical” into automatic duplication of every assertion at multiple layers.

Expected files: `.claude/context/testing.md`, `.claude/skills/review/SKILL.md`, and one pointer in `AGENTS.md`. Skills stay in the canonical shared tree. Reconcile overlap with PR #795 (testing guidance) and #802 (review skill and agent guide). Replace the ratchet only as selected implementation, coordinating the architecture hub's checkpoint.

## Browser evidence decision (item 4)

The September 19 decision allowed ordinary push after automated checks while retaining a readiness requirement. That implementation is historical and has since been superseded. Follow the current repository [browser-evidence policy](../../../AGENTS.md#browser-evidence) and [validation pipeline](../../../.claude/context/validation-pipeline.md), which own the applicable surfaces, evidence classes and gates. This plan does not override them.

The current test-consolidation slice changes no visible runtime behavior. No new rendered proof is claimed. Missing automated capabilities or failed checks cannot be relabeled as success. Publication and external records remain outside this local implementation authorization.

## Requirements retained from the original prompt

| Item | Scope |
|---|---|
| 2 | Per-glob floors in Shared/Client/Admin where measured and useful; unchanged global floors; installed Vitest semantics verified; matching performance-parity tests. Near-zero paths receive floors with new proof. Never average file percentages into glob totals. |
| 3 | Two Shared shards through scripts/dev/package-commands.mjs; update shared.yml, ci-gate.mjs and its tests, and performance parity. Prove failed/missing-shard handling. No broader workflow consolidation. |
| 5 | Existing helpers first. Preserve provider/cache/retry/mutation semantics. Identical test names/results for pure setup refactors; list exclusions. Add the diff-aware local-wrapper/client guard last with justified allowances. |
| 6b | Merge within one subject; exclude exact files in direct-tested-seam-baseline.json and module-seam-registry.json. |
| 7 | Real owning module, fake external edges. Inspect all touched critical lines. Report exposed defects separately; no runtime fix bundled into test-only work. See the refreshed target matrix. Do not restore the intentionally removed system-theme test. |
| 8 | Settlement candidates: selectConfirmedDisbursementTotal, selectConsiderationStatus, selectSettlementReadiness, deriveCommitmentSettlementFlow, hashPaymentSnapshot, hashBeneficiarySnapshot. Inspect wildcard barrels, exports, consumers and active plans before deleting their exclusive tests. Retain role/capability cases and staged Card Endow code. |
| 8 | Common memory/SQLite join-request contract; retain memory store needed by API tests. Add SQLite withdrawal, sweep, stale revision and 100-pending-cap cases while preserving encryption/persistence proof. |
| 9 | Scratch import-closure analysis nominates mocks; remove and run each subject before declaring them stale. No permanent one-shot audit script. |
| 10 | Only GardensList's named layout case and bootFallback's named CSS cases. Verify equivalent geometry/interaction proof before removal. Preserve nativeSelectTheming.guard.test.ts. Pre-React boot proof may require the real document fixture rather than an unrelated story. |
| 11 | Informational summary in an existing workflow: source/test line deltas, ratio, added/deleted files. No required check or ratio threshold. |
| 12 | Comparable snapshot with methods, SHAs, skips and fault results. Distinguish test-step, job, workflow and gate time from aggregate worker buckets. |

## Coordination and scope

The active codebase-architecture-skills hub owns the September 22 coverage checkpoint and PRD-835 visibility. This plan proposes a replacement policy but does not mark that obligation done or edit its mirror.

The September 19 guidance slice names that ownership in `.claude/context/testing.md` without changing the existing two-point ratchet or any numerical threshold. The replacement proposal remains a separate decision for the checkpoint, supported by fresh measured coverage and parity evidence.

PR #802 is stacked on #799. It overlaps review guidance and CookieJarTab tests and uses older WalletDrawer paths; reconcile with current WalletSheet code. PR #795 also edits `.husky/pre-push`; reconcile its hook/testing changes with steps 1–2. Its old development aliases need integration updates, not automatic restoration.

No matching local/cached-origin refs or open PRs were found for the three queued test branches. Unpublished work in other checkouts was not exhaustively inspected; refresh ownership before overlapping edits.

Planning uses the state_api lane; UI and contracts implementation are not selected. Future test/tooling execution remains serial and can be split by subject without creating a separate lane for every file. No lane is ready for unattended execution.

The execution request authorizes local implementation and Plan Hub updates, beginning with item 1. A later request authorizes committing completed local slices. Production architecture refactoring, a contract-suite overhaul, dependency installation, environment changes, deployment, broad deletion, Linear writes, pushes, and PRs remain unauthorized. Item 4's second policy is selected and locally implemented. Representative helper and file changes need review before rollout; isolation remains enabled. Follow-on runtime, environment, and pruning candidates remain with their owning hubs until selected.


## Second-batch implementation boundaries

SF10 extends `scripts/lib/dev-shared.js`, the existing owner of non-mutating Git/environment
inspection, and its direct tests. `scripts/dev/doctor.js` consumes the results. The missing
capability is per-checkout resolution of the effective pre-push dispatcher, Husky target, and
checkout-local gate tooling. This does not add a second setup command or repair registry.
A disposable Git repository proves dispatch and failure propagation without pushing anywhere.
The architecture hub retains live Codex/Claude hook-loading and five-task pilot ownership.

The second-batch checkpoint exercised compile-only Address probes inside each application's
actual source graph through the existing typecheck/build commands. Client's graph rejected
unrestricted strings; Admin's graph accepted them because Safe's legacy ABIType registration
widened Address to string. A scratch registration exposed seven callers needing narrower inputs.
The Admin probe was temporarily removed while dependency approval was pending. The approved
third batch restores that probe with the supported `addressType` registration and the caller
repairs below. Both real application graphs now reject unrestricted strings.

## Third-batch boundaries

Dependency approval now covers SF11's direct Admin ABIType dependency and necessary repairs.
The Hypercert SDK brings the offending registration into Admin, so its existing component
directory owns the override and consumer guard. The Client guard remains in its existing config
directory. Reuse `isAddress` and the already-resolved Add Members address; do not add a parallel
address model or cast unchecked external strings. Invalid garden IDs must disable a scoped vault
query rather than turn an absent address into a chain-wide query.
Test/story types must compile under the restored contract too. Preserve fixture address types
at their owner and replace incomplete assertions with checked fixture shapes. The command-palette
test uses a complete local `satisfies Garden` fixture. One test does not justify widening Shared's public exports; the protected test imports no broad testing barrel.

SF09 extends `scripts/dev/ci-local.js` and its existing direct tests. `executePlan` already owns
outcomes, receipts, stop rules and check scope; `test-lease.mjs` owns the lease timeout exit code.
The missing capability is a concise final account of failed, interrupted, blocked and unrun
checks, with the first failure preserved and safe numeric host-load/lease context. Add it beside
that owner rather than creating another runner or receipt store. Load is advisory, never evidence
that a failure is harmless. This reporting checkpoint does not retry, reclassify assertion
failures as passes, change check selection, or export PR text.

## Fourth-batch boundaries

Afo selected SF03 Admin qualification and SF10 live hook observations. The reproduced full-project
failure was an Admin smoke fixture mismatch: its indexer and RPC stubs described different gardens.
Pass the existing indexer garden into the existing RPC mock; preserve strict rejection of unknown
calls. The earlier hydration-loader timeout did not recur in this batch and is not diagnosed as
that fixture defect. Do not change app boot, routing, authentication or timeouts without evidence.
Actual Codex context messages qualify only the observed events; the architecture hub owns their
record. Claude Desktop Code evidence and the other ordinary-task pilot categories remain pending.

### Remaining Software Factory local implementation (2026-10-05)

The latest authorization selects SF05–SF08 and SF12. The fifth-batch handoff owns implementation
detail, fork qualification limits and final validation. Qualified browser presets use the existing
runner and report store. SF10 and SF13 retain their actual-session and ordinary-task evidence
requirements; neither is closed by synthetic verification work.
