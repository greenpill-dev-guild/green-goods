# Simplify development and onboarding

**Status**: `CLOSED — shipped in 22c616a4d and 4e4968cec on develop; 588 manifest commands reduced to 95, with 17 at root`
**Last Updated**: 2026-09-21

Implementation followed the user-approved four-stage plan.

- [x] Inspect manifests, callers, launcher modes, setup profiles, and developer resources.
- [x] Forward root development arguments and consolidate health/smoke mode routing.
- [x] Preserve service membership, ownership, chain overlays, and database retention.
- [x] Remove obsolete aliases with active caller updates; retain non-equivalent contract wrappers.
- [x] Retire completed steward-relabel commands while keeping independent regressions and history.
- [x] Rewrite README and onboarding; align package, environment, contributing, and agent guidance.
- [x] Generate the command inventory from manifests.
- [x] Add guide-link, anchor, command, intent, and development-mode regressions.
- [x] Run focused development, documentation, and required contract checks.
- [x] Verify external developer-resource destinations and replace retired references.
- [x] Inspect rendered public browsing through the connected authenticated Brave profile.
- [x] Complete the frozen-lockfile install and fresh hosted launch in the isolated checkout.
- [x] Prove connected team readiness with available local services and credentials.

Both acceptance checks were completed on 2026-09-21 once the installation permission was granted.
See [eval.md](eval.md) and [implementation evidence](implementation.md). Root aliases decreased
from 245 to 215; all manifest entries decreased from 588 to 548. There is no numerical deletion target.

## Selected command consolidation

The user approved the expanded implementation on 2026-09-12. The earlier onboarding proof and
its unresolved fresh-checkout acceptance remain separate. Baseline: 548 entries, including 94
root contract wrappers and 172 package operational entries.

- [x] Add the package-owned CLI and operation policy; migrate core operations and callers.
- [x] Consolidate specialist operations and preserve the release operator boundaries.
- [x] Record evidence-based retirement decisions; keep uncertain recovery tools.
- [x] Remove plain forwarding and equivalent flag variants with all active callers.
- [x] Generate operational discovery and enforce documented commands.
- [x] Run stage validation and report counts, baseline failures, and blocked integration proof.
- [ ] Resolve acceptance limits recorded in command-consolidation.md before claiming a fully green gate.

Contract CLI: `bun run contracts -- <command> [arguments]`, identical at package scope.
Mutating deploy/upgrade/migrate/repair commands require explicit network and mode. Modes distinguish
compile-only preflight, RPC simulation, transaction planning, broadcasting, and existing upload-only
behavior. Old aliases are removed with caller updates. Distinct checks, native package lifecycle
commands, release safeguards, service ownership, chain defaults, and historical reports are preserved.
No installs, broadcasts, deployments, branch changes, or archival are authorized by this cleanup.

## Selected final consolidation (2026-09-13)

Continue from the 237-entry working-copy baseline. Root retains setup, dev, dev:health,
dev:smoke, dev:clean, env:sync, env:check, check, test, build, lint, format, contracts,
browser, qa, prepare, and postinstall. Package operations remain package-owned.
Stable validation identities survive alias removal; scoped tests preserve existing membership.
The command policy and migration ledger live in scripts/data and generate public discovery.

- [x] Capture all manifests and initialize the complete replacement ledger.
- [x] Add check selection, plan/list output, and mandatory-override regression proof.
- [x] Validate contract build/test/fork/audit selections and repair the recorded shard membership.
- [x] Validate ordinary package scopes and database-preserving indexer commands.
- [x] Complete root browser, QA, test, and specialist caller migration.
- [x] Enforce command admission and regenerate operational discovery and guidance.
- [x] Run selected checks and record current proof, baseline failures, and capability blockers.

No dependencies, broadcasts, application changes, deployment, or branch changes.

## Closeout (2026-09-21)

Closed as `closed`. Shipped in `22c616a4d` (2026-09-11) and `4e4968cec` (2026-09-13), both merged
into `develop`. The developer journey is complete and independently proven: the nine manifests went
from 588 commands to 95, the root from 245 to 17, and a disposable first-run clone of `develop`
installs, sets up, launches hosted mode, passes the read-only production smoke, and releases its
own service claims without touching anyone else's.

This closes as `closed` rather than `completed` for two reasons. The contracts lane is only
partially certified: its 2,083 Solidity tests, gas gates, and storage baselines passed on
2026-09-13 against an uncommitted working copy, so they carry no commit SHA and cannot be given a
commit-attributed receipt after the fact. And neither QA review lane ever ran — both were declared
not-applicable in their own handoffs, since this is a developer-workflow change rather than
application work, but neither was certified.

The `state_api` lane is certified with a full receipt against `af6a97351`. See
[eval.md](eval.md) for the acceptance run and [command-consolidation.md](command-consolidation.md)
for the per-manifest reduction ledger.

Still open:
- Solidity suite, gas gates and storage baselines never commit-attributed → needs one
  `bun run verify:contracts:fast` run on `develop`; not filed, Linear was unreachable at closeout.
- `setup` and `dev:health` do not check Node against the `.mise.toml` pin of 22.22.1; the
  acceptance run passed on Node v24.20.0 and the team path on v26.3.0, both `[PASS]`, while Node 24
  is a known CI blocker → new finding, needs its own issue.
- Hats Arbitrum fork rehearsal still needs a fresh reviewed block number, garden count, and
  expected implementation inputs → unchanged pre-existing limit, carried by the contracts package.
- Shard coverage audit reports 345 of 356 tests → pre-existing and unchanged from the baseline
  commit; the 11 omitted tests keep dedicated runners. Dropped as not caused by this work.
- Validation selector overselects unrelated suites for root-manifest-only QA → recorded limit,
  dropped here; it belongs to the validation-policy surface, not this hub.
- No independent QA review pass → dropped; the lanes were not applicable to a workflow change.
