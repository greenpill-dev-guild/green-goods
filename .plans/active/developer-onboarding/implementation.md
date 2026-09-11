# Implementation evidence

Checked on 2026-09-11 in the uncommitted Green Goods working copy. No application deployment,
contract broadcast, dependency install, or branch switch was performed.

## Commands removed

| Category | Entries removed |
|---|---:|
| Root development modes, services, diagnostics and stop aliases | 21 |
| Root setup profile/doctor aliases | 4 |
| Environment aliases and historical bootstrap | 2 |
| Contract forwarding and completed relabel operation (root + package) | 5 |
| Admin, indexer and docs duplicate package commands | 8 |
| Total | 40 |

Root scripts: **245 → 215**. All nine manifests: **588 → 548**.
The [migration table](../../../scripts/README.md#command-migration) explains replacements.
The command inventory is generated from manifests, rather than hand-maintained.

The final equivalence review retained two login-shell dry wrappers: replacing them would change
argument forwarding. Only the plain ENS forwarding wrapper was removed. Independent steward
upgrade, RPC redaction, verification, and storage assertions remain package-owned tests.

## Local proof

- `bun run test:validation-system`: 232 tests passed; final run recorded in `/tmp/gg-validation-system-final.log`.
  This includes launcher arguments, PM2 non-recursion, ownerless-stop refusal, mode overlays,
  owner lease/release tests, setup preservation, and the existing validation system regressions.
- `node --test scripts/docs/generate.test.mjs docs/scripts/docs-audit.test.mjs docs/scripts/developer-guides.test.mjs`:
  30 passing tests; `/tmp/gg-doc-tests-final.log`.
- `bun run test:review-guardrails`: 205 passing tests; `/tmp/gg-review-guardrails.log`.
- `bun run docs:audit:ci`, `bun run check:docs-generated`: pass; 19 projections.
- `bun run build:docs`: pass; search index covers all 71 live routes;
  `/tmp/gg-docs-build-final.log`. Updater notices do not affect the build.
- `bun run check:guidance-links`: 61 guidance files pass.
- `bun run check:codex-guidance`: pass.
- `bun run --cwd packages/contracts build`: pass.
- `bun run --cwd packages/contracts test:script script/utils/steward-relabel.test.ts`: 11 pass.
- `bun run verify:contracts:fast`: pass with authorized local socket access, including 2,083
  Solidity tests, release gas checks, and the ordinary script suite;
  `/tmp/gg-contracts-verify-host.log`. The initial sandbox run failed only on local Anvil access.
- The selector's built-in ABI-artifact check passed through `runCommandCheck`.
- Selected formatting and contract Oxlint checks pass; JavaScript syntax checks and
  `git diff --check` pass. An additional, non-selected Biome lint sweep reported two pre-existing
  template-literal findings in the untouched body of `upgrade-ens-receiver.ts`; canonical
  contract lint and the complete required contract verification pass. No unrelated edits made.

Stage plans were rendered with `validation:plan -- --intent qa --changed ... --json` and retained
as `/tmp/gg-stage1-validation.json` through `/tmp/gg-stage4-validation.json`. The selector
selected unrelated runtime suites for root-manifest-only work and a Forge command for a TS test;
those limitations are recorded in eval.md. Direct tool tests and the full critical contract gate
provide the relevant evidence without claiming zero-test output as a pass.

## First-run evidence and remaining limits

An isolated checkout was created at the path recorded in `/tmp/gg-first-run-path`. It includes
this work's changes and no team `.env`. No dependencies were installed. The actual setup command
with `--install skip` reports missing initialized contract submodules. The non-secret baseline
helper was then exercised independently. Hosted health reports only missing dependencies;
local health reports missing dependencies, submodules, Docker, and generated indexer declarations.
No secret credential is required by the hosted prerequisite path.

The connected Brave extension rendered the existing public website at
`https://localhost:3001/?presentation=website`: main navigation, product overview, public counts,
and the garden browsing link were visible. The existing authenticated home tab also rendered
its garden list. This is not proof of a new checkout or hosted-mode launch. A live client listener
and existing indexer listeners are owned by other/expired claims; none was stopped or adopted.

Full first-run acceptance remains blocked on task-specific installation permission and an
available standard-port environment. Setup rerun preservation is proven with disposable fixtures.
Connected team service readiness and live Ctrl-C/owner-stop behavior remain limited to existing
unit/fixture coverage until an owned environment can be launched.

## Resource verification

[resources.json](resources.json) records the one-time external checks. Most links returned 200
with the expected page title. The retired Foundry book URL was replaced with the verified current
installation page. The old Consensys resource announced that it is unmaintained and linked to the
Smart Contract Security Field Guide; the package guide now links to that successor. These checks
are not part of ordinary tests and no recurring automation was created.

The global workbench check has unrelated failures for missing Coop/TAS-Hub checkouts and retired
global documentation paths. The Green Goods manifest's commands resolve locally. No global
workbench files or sibling repositories were changed.
