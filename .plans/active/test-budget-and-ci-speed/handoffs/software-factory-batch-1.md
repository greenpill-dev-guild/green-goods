# Software Factory first batch — local implementation

SF01–SF04 are implemented in the selected scope. SF01, SF02 and SF04 meet local acceptance;
SF03 remains open because final Admin readiness checks fail. Afo's “Go ahead and implement the first batch” authorizes
local implementation now. SF05–SF13 remain unselected. This handoff records working-copy proof,
not a committed or current-head CI receipt.

## Changes and boundaries

- **SF01 — test startup.** `all` and `smoke` delegate startup and cleanup to Playwright. Its
  Client/Admin servers use `APP_ENV=test`, `NODE_ENV=test`, and Sepolia, invoke the installed
  Vite CLI directly, and refuse occupied ports. The normal PM2 development profile remains
  owned by the existing launcher. Client warms its PWA login graph before the first interaction
  budget, as Admin already warms its boot graph. Specs still require rendered outcomes.
- **SF02 — strict shared fixtures.** Named GraphQL operations validate chain, selected garden,
  schema, identity and pagination inputs. Unsupported operations/RPC reads throw. Multicalls
  validate their inner calls; evaluator results follow the fixture's roles. Empty results are
  explicit, and required requests must be observed. A declared approval preparation simulation
  matches destination, sender and full calldata. Transaction sends remain unsupported.
- **SF03 — meaningful journeys.** Client requires the Your Work dialog, tabs and close action;
  a steward's offline approval survives reconnect/reload as one unsent durable record; an
  injected EAS read outage exposes Retry and recovers the same work. Admin requires actual
  route content and the empty-vault result, and tests create-garden validation, correction and
  cancel recovery. The selected Admin scenario never deploys a garden. Canonical `gardenId`
  and Endowment paths replace stale test URLs.
- **SF04 — browser jobs required.** The existing aggregate map now requires `Playwright Client
  CI` and `Playwright Admin CI`, alongside the existing Shared shard jobs. Missing, skipped,
  cancelled, failed or nonterminal browser jobs cannot pass a successful parent workflow.

The shared fixture is used by the Client helpers and Admin production-flow spec. Older
standalone Admin smoke mocks remain separate. This is not a complete external-network sandbox
or a full GraphQL schema validator. It qualifies these scenarios, not every possible role or
transaction path. No runtime application code, dependencies, lockfile, workflow YAML, native
permission settings, release attestation policy, or external records were changed by this batch.

## RED/GREEN evidence

| Slice | Failing proof | Passing control / result |
|---|---|---|
| SF01 | Updated runner expectations failed three cases; resolved-config tests failed both CI/local cases against the former development profile | Runner suite 14/14; resolved config pins the test profile. A disposable occupied-port server is rejected and remains alive. SIGINT returns 130, releases both owned app ports, and preserves an unrelated sentinel server. |
| SF02 | Original permissive helper failed four of five new contract cases: unknown operation, wrong chain, missing required request, unsupported RPC | Expanded fixture invocation passes 194 tests across 38 files, including explicit empty results, EAS argument rejection, role-derived evaluator reads, and rejection inside multicall. |
| SF03 | Four disposable browser faults fail at the intended boundary: static shell, endless loader, blocked dashboard click, unexpected GraphQL operation | Focused Client 4/4 and Admin 2/2 passed. Final full Client: 20 passed, four existing skips. The broader Admin outcome is recorded below. |
| SF04 | Both new Client/Admin gate cases failed against the old required-job map | Gate suite 28/28. The existing current-head, terminal-workflow and Shared-shard cases remain passing. |

The browser work also found and corrected incomplete fixtures for ENS, batched role reads,
the root-garden lookup, vault/jar/governance reads, hypercerts, and the wizard's accepted
commitments. These were checked against their owning callers; no generic success fallback was
restored. A former assertion against `main` was wrong for modal routes because the dialog hides
the background landmark. Named visible route content now supplies that proof.

Faults were injected through a temporary copy of the real Client spec and removed afterward.
Shell/loader faults supplied inert HTML; the dispatch fault intercepted the dashboard click;
the request fault sent `UnexpectedAction` into the real route handler. All four returned exit 1
with the expected failing assertion or fixture error. Production source was not mutated.

## Verification commands and observed limits

All browser proof is **CI Playwright (clean-room Chromium, mock auth)**. It does not establish
real wallet/passkey signing, installed production-PWA behavior, or authenticated Brave proof.
The stronger existing offline-work-submission spec is retained unchanged.

The QA selector was rendered with the authored config/script/test/README paths. It selected
format and lint through `automatic-hygiene`, and `validation-system-test` through its direct-root
and conditional rules. Browser and fixture runs below were invoked explicitly; the selector
does not automatically certify them.

```sh
# Installed fixture/config tests
bun x vitest run tests/fixtures/mock-backend.test.ts tests/fixtures/playwright-services.test.ts --environment node

# Aggregate gate and launcher tests (also covered by validation-system-test)
node scripts/dev/node-cli.js node --test scripts/quality/ci-gate.test.mjs scripts/dev/command-runners.test.mjs

# Exact selected tooling suite
node scripts/dev/node-cli.js node --test scripts/lib/dev-shared.test.mjs scripts/quality/check-direct-tested-seams.test.mjs scripts/quality/check-source-structure.test.mjs scripts/quality/check-staged-modules.test.mjs scripts/quality/select-validation.test.mjs scripts/dev/ci-local.test.mjs scripts/dev/surface-leases.test.mjs scripts/dev/stack.test.mjs scripts/dev/smoke-full.test.mjs scripts/quality/ci-gate.test.mjs scripts/quality/workflow-performance-parity.test.mjs scripts/dev/dev-modes.test.mjs scripts/dev/setup-env.test.mjs scripts/dev/package-commands.test.mjs scripts/dev/command-runners.test.mjs scripts/quality/check-commit-identity.test.mjs

# Full matching browser projects; explicit inherited wrong profile tests the override
CI=true SKIP_INDEXER=true APP_ENV=development VITE_CHAIN_ID=42161 PLAYWRIGHT_JSON_OUTPUT_FILE=/tmp/green-goods-sf-client-results.json bun x playwright test --project=client-ci --workers=2 --retries=0 --reporter=line,json --output=/tmp/green-goods-sf-client-results
CI=true SKIP_INDEXER=true APP_ENV=development VITE_CHAIN_ID=42161 PLAYWRIGHT_JSON_OUTPUT_FILE=/tmp/green-goods-sf-admin-results.json bun x playwright test --project=admin-ci --workers=2 --retries=0 --reporter=line,json --output=/tmp/green-goods-sf-admin-results

# Direct static check for the config and new fixture boundary
bun x tsc --noEmit --target es2022 --module esnext --moduleResolution bundler --esModuleInterop --resolveJsonModule --skipLibCheck --types node --lib es2022,dom playwright.config.ts tests/global-setup.ts tests/helpers/mock-backend.ts tests/fixtures/mock-backend.test.ts tests/fixtures/playwright-services.test.ts
bun x oxlint playwright.config.ts tests/global-setup.ts tests/helpers/mock-backend.ts tests/fixtures/mock-backend.test.ts tests/fixtures/playwright-services.test.ts tests/specs/admin.production-flows.ci.spec.ts tests/specs/client.work-approval.ci.spec.ts --allow no-console --deny-warnings
bash scripts/quality/check-test-quality.sh

# Disposable ownership and fault probes (local scratch, no durable CLI introduced)
node scripts/dev/node-cli.js node /tmp/green-goods-sf-owned-port.mjs
node scripts/dev/node-cli.js node /tmp/green-goods-sf-cancel.mjs
node scripts/dev/node-cli.js node /tmp/green-goods-sf-faults.mjs
```

Tooling suite: 360/360 passed outside the sandbox. Its first sandboxed run passed 359 and failed
only the `ps` process-inventory check; the same suite passed when that capability was available.
The selected format command checked eight files; selected Biome lint checked zero because
these paths are excluded by its configuration. The supplemental Oxlint command above checks
the authored browser files and permits CLI logging under the repository's existing exception.
The test-quality script passed all nine checks.

A broader standalone TypeScript probe including `test-utils.ts` and both specs reported two
pre-existing nullable `errorText.substring` diagnostics in `test-utils.ts`. Those lines are
unchanged. The focused config/fixture typecheck passes; no whole-repository typecheck is claimed.

`dev-surfaces check` remains nonzero for existing ecology and registry drift (including missing
Coop/TAS-Hub roots, retired guidance aliases, and cached old-port references). No registry or
unrelated checkout was repaired. Repository-wide Plan Hub validation remains separately subject
to the unrelated `agent-messaging-channels` hub missing `status.json`.

Logs and browser output remain local under `/tmp/green-goods-sf-*`; no raw QA evidence is added
to Git. No commit, push, PR, merge, deployment, or Linear write is part of this handoff.


## Final working-copy evidence

- Base HEAD: `c4a9487350c6739de54bcc2737dd2a972223243f`, branch `develop`. The validation
  includes uncommitted authored files and the existing application changes; HEAD alone is not
  the tested implementation. No current-head GitHub CI or merge-readiness claim is made.
- Source fingerprint at 2026-10-05 00:40:18 UTC:
  `sha256:c75f4024ba3a0a28a35b557b35b3a5a23eb8eabbebdf79bdf45ee82dbff8f675`.
  `/tmp/green-goods-sf-source-final.json` records the scope. The hash combines base HEAD,
  the binary working-tree diff, and scoped untracked file paths/content. It covers the browser
  config, scripts/tests, Client/Admin/Shared, Sepolia deployment JSON, root manifest and lockfile;
  it is a source identifier, not a fully hermetic environment receipt.
- Full Client project started 2026-10-05 00:37:18 UTC and finished in 126.3 seconds:
  **20 passed, four skipped, zero unexpected failures, zero retries**. The four existing skips
  are production-PWA offline reload, virtual passkey/Pimlico compatibility, the iOS-only wallet
  case in a Chromium project, and a pre-existing skipped login-page case. None counts as proof.
- The prior Client run failed the approval test because its five-second count assertion preceded
  the existing thirty-second restored-UI readiness assertion. The error snapshot already showed
  the restored queue. Reordering readiness before count fixed the race without weakening the
  outcome or adding a retry. The final pass also verifies one unsent approval in IndexedDB.
- Visually inspected CI Playwright screenshots: `/tmp/green-goods-sf-offline-decision.png`
  (offline save confirmation and disabled upload preparation) and
  `/tmp/green-goods-sf-admin-validation.png` (corrected required fields, remaining deliberate
  short-slug rejection). Browser assertions additionally prove reconnect/reload and cancel recovery.
- Focused config/fixture TypeScript and supplemental Oxlint pass. The broader TypeScript probe
  still reports only the two unchanged nullable diagnostics at `test-utils.ts:264` and `:412`.
- Final selected format check: eight files, no fixes. Guidance check: 77 files pass. Immutable
  report check passes. A focused probe checks 43 local links/anchors in the mutable hub documents.
  Full Plan Hub validation remains blocked only by the unrelated `agent-messaging-channels`
  directory missing `status.json`; the batch does not edit it.


### Admin qualification limit

The full two-worker Admin project started 2026-10-05 00:39:46 UTC and finished in 141.2 seconds:
**four passed, four failed, one declared skip, and four tests not run after the serial smoke
failure** (the JSON reporter groups the latter four with skips). Failures were reload/deployer
boot readiness, the unauthenticated connect shell, and the changed route sweep's vault step
remaining at “Checking authentication…”. The selected create-garden recovery case passed.
No unsupported fixture request was reported. This run is not green.

A disposable control restored the original HEAD Playwright configuration and RPC mock, copied
the unchanged Admin auth spec, and adjusted only its temporary filename selector. On the same
working-copy application sources, two workers and zero retries, it reproduced reload and
multi-tab readiness timeouts: **three passed, two failed, one declared skip** in 106.0 seconds,
starting 2026-10-05 00:44:21 UTC. This establishes pre-existing Admin instability; it does not
prove that every failure of the broader changed run has the same cause. The first control
attempt selected no tests and is excluded from this evidence. Temporary files were removed.

Control command: `python3 /tmp/green-goods-sf-admin-original-run.py`. Evidence:
`/tmp/green-goods-sf-admin-original.log` and `/tmp/green-goods-sf-admin-original.json`.
The final focused command isolates the two changed Admin scenarios with one worker:

```sh
CI=true SKIP_INDEXER=true APP_ENV=development VITE_CHAIN_ID=42161 PLAYWRIGHT_JSON_OUTPUT_FILE=/tmp/green-goods-sf-admin-focused-results.json bun x playwright test tests/specs/admin.production-flows.ci.spec.ts --project=admin-ci --workers=1 --retries=0 --reporter=line,json --output=/tmp/green-goods-sf-admin-focused-results
```

The full Admin project must pass against the eventual published head before approval. A broader
Admin boot/auth investigation is a remaining verification issue; this batch does not repair
runtime auth, weaken readiness checks, increase the global timeout, or add retries to hide it.


Other proof log timestamps (UTC, log completion time rather than a commit receipt):

| Proof | Log completed |
|---|---|
| Gate 28/28 | 2026-10-04 23:51:55 |
| Selected tooling suite 360/360 | 2026-10-05 00:16:18 |
| Occupied-port refusal | 2026-10-05 00:19:00 |
| SIGINT ownership cleanup | 2026-10-05 00:23:45 |
| Four browser fault detections | 2026-10-05 00:25:59 |
| Test-quality checks | 2026-10-05 00:30:43 |
| Fixture invocation 194/194 and scoped types | 2026-10-05 00:32:25 |
| Supplemental Oxlint | 2026-10-05 00:38:20 |


Final Admin checkpoint: the one-worker focused run started 2026-10-05T00:46:37.789Z and ran
for 148.1 seconds. **Both tests failed**: the route sweep remained at its vault
authentication/loading state, and create-garden did not reach its heading within the readiness
budget. The earlier 2/2 pass is historical evidence of a successful run, not a stable final
qualification. SF03 therefore stays unchecked in the plan; its code is implemented but acceptance
is incomplete. No further retry or runtime repair is folded into this batch.

Next bounded investigation: reproduce Admin boot and eligible-garden readiness under the real
CI two-worker command; distinguish dev-server loading from unresolved role/garden queries;
identify a specific root cause before selecting a runtime or fixture repair. Preserve the current
assertions and rerun both changed scenarios plus the complete Admin project after that repair.

Final source-fingerprint recheck after the Admin control and focused run matched the recorded
source hash. All temporary probe files are removed. Plan status stays `in_progress`; only SF01,
SF02 and SF04 are checked off. SF03 remains open, and SF05–SF13 remain unselected.
