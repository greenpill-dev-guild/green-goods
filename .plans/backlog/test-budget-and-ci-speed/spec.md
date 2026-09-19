# Scope and execution decisions

## Outcome and sources

Reduce the cost of changing and verifying Green Goods while retaining independently useful protection. Preserve the main package boundaries. Counts, line ratios and mock counts nominate investigation; they are not deletion quotas.

The source is the user-provided September 18 “Velocity Scorecard snapshot 05” execution brief, originally measured at `9180601ee`, plus the architecture audit and September 19 sequencing discussion. [Preparation evidence](reports/2026-09-19-preparation.md) pins the refresh. The original Claude artifact's full measurement method and fault definitions were not available in this session; the brief supports planning but cannot establish a comparable twelve-fault remeasurement.

## Test budget (item 1)

Prove each decision at its lowest owning layer. Add another layer where wiring, composition, recovery or interaction can fail independently. Prefer tables for pure decisions and existing `@green-goods/shared/testing` helpers. Move tests with code; remove exclusive tests with verified-unused code. Assert observable outcomes; retain source assertions when the source contract is the requirement and no cheaper faithful signal exists.

Spend proof effort where mistakes affect money, identity or data. Review duplicate layers, excessive setup, class assertions, uncalled exports and unexplained test/source growth. Preserve critical cleanup and composition proof; do not turn “critical” into automatic duplication of every assertion at multiple layers.

Expected files: `.claude/context/testing.md`, `.claude/skills/review/SKILL.md`, and one pointer in `AGENTS.md`. Skills stay in the canonical shared tree. Reconcile overlap with PR #795 (testing guidance) and #802 (review skill and agent guide). Replace the ratchet only as selected implementation, coordinating the architecture hub's checkpoint.

## Browser evidence decision (item 4)

| Design | Benefit | Obligation |
|---|---|---|
| Accept manual receipts before push | Preserves the existing push requirement | Bind evidence to surface, checked inputs, authenticated session and freshness; stale/missing evidence cannot pass |
| Permit ordinary push after automated checks, retain manual proof at readiness | Removes publication pressure to bypass automated checks | Distinguish published from ready; missing automated capabilities still block |

The second is recommended, not approved. The attachment's “manual or capability-blocked” exemption must not become blanket success. Critical overrides and ship/merge/release requirements remain enforceable. CI clean-room evidence does not become authenticated local proof. Settle design before implementation and show the diff before publication.

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

PR #802 is stacked on #799. It overlaps review guidance and CookieJarTab tests and uses older WalletDrawer paths; reconcile with current WalletSheet code. PR #795 also edits `.husky/pre-push`; reconcile its hook/testing changes with steps 1–2. Its old development aliases need integration updates, not automatic restoration.

No matching local/cached-origin refs or open PRs were found for the three queued test branches. Unpublished work in other checkouts was not exhaustively inspected; refresh ownership before overlapping edits.

Planning uses the state_api lane; UI and contracts implementation are not selected. Future test/tooling execution remains serial and can be split by subject without creating a separate lane for every file. No lane is ready for unattended execution.

No production architecture refactor, contract-suite overhaul, dependency installation, environment change, deploy, broad deletion, Linear write, commit, push or PR is authorized by this preparation session. Execution selection and item 4's policy are still owed. Representative helper/file changes need review before rollout; isolation remains enabled. Follow-on runtime, environment and pruning candidates remain with their owning hubs until selected.
