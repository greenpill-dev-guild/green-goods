# Command consolidation evidence

The user selected the expanded consolidation on 2026-09-12. This record supplements the earlier
onboarding implementation evidence; it does not replace that work's unresolved fresh-checkout proof.

## Baseline and boundaries

The clean starting checkout was `d3df1d3bcd452eed19c18dfc7998418066abe159`. Its nine manifests
contained 548 entries: root 215, contracts 230, indexer 22, shared 20, agent 17, admin 15,
client 14, docs 14, and QA 1. The operational subset is 94 root contract wrappers plus
172 contracts-package entries. Development, build, test, and independent validation checks remain
package-native.

The approved public interface requires explicit network and execution mode for deployment,
upgrade, migration, and repair. This deliberately changes ambiguous defaults and login-shell
argument handling. Replacement equivalence must preserve actual handlers, operator policy,
prerequisites, artifacts, and failure behavior rather than retain the old ambiguous syntax.

No dependency installation, secret environment access, transaction broadcast, deployment, branch
switch, or Plan Hub archival is part of this implementation.

## One-off retirement decisions

| Operation | Decision | Current evidence |
|---|---|---|
| Action instructions v2 | Retain under the CLI | The tool supports selective action/UID updates, upload-only execution, source hashes, and cache reuse. No evidence establishes that its ongoing update role has ended. |
| Vault migration | Retain under the CLI | Current contract guidance still includes the migration, and its implementation validates/backfills multiple garden and vault relationships. |
| Octant asset repair | Retain under the CLI | Vault migration explicitly recommends this repair when template validation fails. Removing it would remove a documented recovery path. |
| Open minting | Retain under the CLI | Existing scripts target Sepolia and Arbitrum; historical enablement does not establish that future supported deployments no longer need the operation. |
| ENS reconciliation | Retain under the CLI | Reconciliation compares chain records and can recover missing receiver registrations; the ability is not limited to one recorded execution. |
| Pool backfill and release targets | Preserve current handler guards | The current release operator explicitly excludes completed orchestration. Consolidating names must not restore retired broadcasting paths. |

These decisions retire aliases, not independently useful regression assertions. Dated reports and
historical transaction evidence remain untouched. No implementation is deleted merely because
its name contains “migrate” or “repair”.

## Intermediate contract consolidation

The nine manifests now contain **237 entries**, down **311** from 548 (57%).

| Manifest | Before | After | Net reduction |
|---|---:|---:|---:|
| Root | 215 | 91 | 124 |
| Contracts | 230 | 44 | 186 |
| Docs | 14 | 13 | 1 |
| Indexer | 22 | 22 | 0 |
| Shared | 20 | 20 | 0 |
| Agent | 17 | 17 | 0 |
| Admin | 15 | 15 | 0 |
| Client | 14 | 14 | 0 |
| QA | 1 | 1 | 0 |

There are 314 removed names and three new names: root/package `contracts` and package
`test:shard`. The removal categories are 266 contract operational/rehearsal aliases, 28 plain
root forwarding aliases, 11 package shard aliases, five E2E variants, three docs-audit variants,
and one upload dry-run variant. The 266-entry contract category includes two root rehearsal
aliases that now use the retained shard runner; the other 264 map to the contract CLI.

The complete old-command → replacement table is generated in
[`contract-operations.mdx`](../../../docs/docs/builders/packages/contract-operations.mdx).
Its evidence source is [`command-migration.json`](../../../packages/contracts/config/command-migration.json),
which records every original invocation and working directory. Runtime dispatch never reads that
historical mapping. Operation definitions own supported modes, invocation arrays, environment policy,
and mandatory checks. Generated help and documentation consume those definitions.

Protected surfaces changed: root/contracts/docs manifests, contract/docs workflows, validation
policy and selector, and directly affected agent/development guidance. No lockfile, dependency,
application feature, chain default, production artifact, or deployed state was changed by this task.
Concurrent avatar edits in the shared checkout are outside this scope.

## Final repository consolidation

The follow-up pass reduced the 237-command intermediate surface to **95 manifest entries**. The
approved per-manifest inventory sums to 95; the plan's approximate total of 105 was an arithmetic
overestimate. The root now has the selected 17 commands.

| Manifest | Intermediate | Final | Removed |
|---|---:|---:|---:|
| Root | 91 | 17 | 74 |
| Contracts | 44 | 18 | 26 |
| Indexer | 22 | 13 | 9 |
| Shared | 20 | 12 | 8 |
| Agent | 17 | 9 | 8 |
| Admin | 15 | 8 | 7 |
| Client | 14 | 9 | 5 |
| Docs | 13 | 8 | 5 |
| QA | 1 | 1 | 0 |
| **Total** | **237** | **95** | **142** |

The complete baseline ledger records 150 replaced names and 87 retained names. Eight consolidated
entrypoints were added, so the net reduction is 142. The 150 removals comprise 74 root aliases and
76 package aliases: 26 contract build/test variants, 23 frontend/shared/agent test-type-format
variants, nine indexer test/Docker variants, five docs utility variants, and 13 other package option
or lifecycle variants. The generated command reference keeps the exact old-name replacements.

Command admission now requires every root entry to have an owner, repository-wide purpose, and
durable consumer. It rejects unregistered root additions, restored retired aliases, plain forwarding,
and option-only aliases. Package inventories are allowlisted, while justified exceptions must name
their owner, reason, and consumer. Documentation checks validate commands in their stated working
directory, workflow matrix values, supported arguments, guide links, and generated-reference drift.
Manifest entries, selectable operations, and implementation files are reported separately.

The final runner tests cover root check/test/browser/QA dispatch, package test/type/format scopes,
Indexer Docker behavior, contract build/test/fork/audit selection, exact environment and working
directories, exit propagation, and signal cancellation. The repaired shard manifest now includes
the Assessment release sequence and the two dedicated Celo release suites without bypassing their
planner and isolation runners. A full Forge shard-list comparison was started but did not finish in
the available validation window; this remains unavailable proof rather than a passing claim.

## Fresh validation

Validation was rendered for the initial critical stage and the complete selected path set. The
selector retains the full mandatory contract test suite when inferred TypeScript test paths exist;
a regression test now prevents those paths from being routed to a Solidity-only match wrapper.

Tests requiring backend imports ran in a disposable source snapshot without the secret environment,
using existing dependency installations and task-local trust for the unchanged pinned Mise config.
No dependency installation was performed. Commands below used `bun --no-env-file run` in this
restricted session; ordinary documented usage remains `bun run`.

Passing evidence:

- CLI behavior: 23 Node tests, including resolution of all 314 replacement mappings, original explicit
  environment policies, handler identity, ordered checks, cancellation/failure propagation, and
  the operator's shared boundary argument allowlist.
- Focused release/operator/session/upgrade/recovery/E2E-runner tests: 85 tests in six files.
- Contract TypeScript checking, default adaptive build, full test-profile compilation, contract lint,
  and committed ABI check pass. All 2,083 Solidity tests and three production gas-boundary tests pass.
  All 15 storage-layout baselines match.
- Isolated validation-system suite: 237 tests pass. Selector-specific suite: 75 tests pass.
- Documentation/workflow/production-verifier fixtures: 63 tests pass; additional guide fixtures pass.
- Docs audit has no errors or warnings; all 20 generated projections match; docs build indexes
  72 live routes; docs unit suite has 54 passing tests.
- Codex guidance, skill behavior (15 scenarios/routes), and guidance links (61 files) pass.
- Agent-tool tests: 257 pass. QA ledger: 318 IDs with no retirement/reintroduction drift.
- Shared and agent source typechecks pass. Client: 1,134 tests; admin: 860 tests; agent's ordinary
  test lanes pass; indexer: 320 passing tests and one pending.
- Root and package CLI `--explain --json` invocations resolve identically without credential lookup.

Remaining proof is tracked explicitly below; none is waived by the script-count reduction.

## Acceptance limits

- Shared full suite: 4,842 tests passed, one failed, 17 skipped. The failed locale assertion compares
  `app.update.finishWork` in `AppSettings.tsx` with `en.json`. The two different strings are already
  present at the baseline commit; no application/i18n fix is included in this cleanup.
- Full critical verification reaches the script suite after compilation, lint, 2,083 Solidity tests,
  and the production gas gate pass. The script suite has 279 passing tests and 11 skipped tests;
  its real dual-chain lifecycle suite is blocked because port 3012 is already claimed. It correctly
  refuses to replace an unknown process. No existing session was stopped. Release/session focused
  tests pass in the disposable Git fixture; the initial missing-fixture-commit failure is resolved.
- Hats Arbitrum fork proof refuses to run without fresh reviewed block number, garden count, and
  expected implementation inputs. Mock proof does not replace that fork rehearsal.
- Shard comparison reports 356 baseline tests versus a 345-test default-shard union, with 11 missing.
  This is pre-existing: the shard runner and all contract test sources have no diff from the baseline
  commit, and the old and new check both invoke `bun script/utils/fork-shards.mjs check`. The omitted
  tests are the Assessment release sequence (one), Celo garden-account release (one), and Celo garden
  roles permission tests (nine). Existing dedicated runners remain available; no membership or
  exclusion changes are made to mask the failed coverage audit. Replacement tests prove the original
  shard/E2E commands and arguments are retained.
- Earlier isolated first-run installation/hosted startup and connected team-readiness acceptance
  remain separate in implementation.md and eval.md. This cleanup does not claim new browser proof.


Final review on 2026-09-13: focused CLI/release proof, the isolated 237-test validation-system
suite, formatting, package-script lint, guidance checks, documentation audit/projections, and the
72-route documentation build were rerun after the final edits. No task-owned validation process
remains intentionally running. The full-green acceptance limits above remain open; this is an
implementation handoff, not deployment or release approval.

The final consolidation rerun adds 102 validation-selector/workflow tests, 38 documentation authority
tests, 29 development/package runner tests, 23 contract CLI tests, 257 agent-tool tests, the Docs
production build and its 72-route search-index check, package full typechecks except the recorded Docs
baseline, the contract adaptive build, repository lint and formatting, and the focused Indexer
contract-event selection. The ordinary Indexer suite's stale timeout assertion was updated to inspect
the owning resolver and now passes in its focused selection. No transaction or deployment command ran.
