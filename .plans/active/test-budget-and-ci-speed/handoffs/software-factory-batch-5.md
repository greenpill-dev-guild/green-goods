# Software Factory — remaining local implementation

Afo authorized completing the remaining work. SF05–SF08 and SF12 are implemented locally.
SF10's Claude Desktop observation and SF13's ordinary-task/dispatch observations still require
actual evidence. No branch change, commit, publication, deployment, or external record write
is part of this batch. Earlier dependency approval remains in effect; this batch adds none.

## Changes and boundaries

- **SF05:** Replaced the permissive passkey spec with one real Chromium virtual-authenticator
  ceremony. The strict server substitute checks the username, challenge, origin, credential type
  and call order, then rejects verification. The UI must show the specific verification error,
  re-enable the form, and remain signed out after reload. Missing input, no credential, unfinished
  verification, a silent fallback and a stale success URL no longer count as success. Legacy
  Pimlico response-shape checks now call the fixture directly in Node; they do not use
  `page.request`, which bypassed the page's request interception.
- **SF06:** Added an owned production-build/preview profile and a production-worker login-shell
  check. No mock auth is enabled. Page HTTP caching is disabled; page and worker network access
  are blocked during the offline phase. Reload must render the login action. Deleting the actual
  navigation cache entry must then prevent navigation. Preview disables telemetry/source-map
  uploads and pins path routing. The existing Client browser job runs this proof after local
  qualification; no second required-job aggregator was introduced.
- **SF07:** Added a bounded `explore` preset, using the existing strict backend and mock roles.
  Two fresh contexts inspect synthetic work, including one EAS outage/retry, then reload the same
  record. The unsigned seed fixes role, viewport and Unicode data; the browser clock is fixed.
  Route actions and requests are allowlisted. Profile-avatar absence and reverse ENS failure
  are explicit read substitutes; fonts and SDK telemetry are replaced or blocked locally.
  Unknown requests, uncaught page errors, wrong navigation, missing results and overflow fail.
  Each result includes a screenshot and replay/action log. This is read-only: no signing or
  approval dispatch is exercised. SDK warnings remain outside the uncaught-page-error oracle.
- **SF08:** Registered the three qualified checks with relevant exact paths/prefixes and the
  existing fixture gate. Unrelated docs and work mutations do not inherit the exploration check.
  Critical overrides remain intact. Missing pinned Chromium is blocked. The capability probe
  fingerprints the binary used by these projects and their warm-up, plus the Playwright version;
  existing source, environment, root-env and toolchain fingerprints remain authoritative.
- **SF12:** Mechanized the repeated need to scope browser commands and audit their outcomes.
  Qualified presets reject filters, sharding, empty-test success, nonzero retries and unbounded
  timeouts. They enforce a five-minute run budget, first-failure stop, and complete fresh JSON
  proof: no missing/skipped/retried cases or stale report can pass. Seed validation and pure
  replay/navigation tests catch unreplayable input and route escape. No global lint/compiler
  rules, memory deletion, new dispatcher or dependency were needed.

The existing runner owns reports and passing receipts. Default preset reports are under
`.cache/validation/browser-<preset>/results.json`; selector commands use their named check
folders. Playwright attachments carry the scenario evidence. CI retains its synthetic evidence
under `tests/test-results/{passkey,explore,pwa-preview}`. Tests grew to prove these verification
boundaries; no application business behavior was changed.

## Fork assessment (SF05)

`client.fork.spec.ts` starts/snapshots/reverts its own Sepolia Anvil context and directly tests
contract calls. Its browser sections still use legacy wallet-storage injection and allow an
unpersisted auth attempt; they do not wire the browser's RPC and the indexer to that same fork.
The repository's regular fork profile explicitly keeps indexing live networks. Neither that
profile nor these separate contract tests prove browser → fork → indexed result integration.
The fork project is therefore not promoted into the selector. A future qualification must bind
all three services to a disposable fork and require the resulting UI state before it can count
as browser integration proof. No fork or real-chain transaction was run in this batch.

## Evidence and failure controls

This is dirty-worktree evidence based on `c4a9487350c6739de54bcc2737dd2a972223243f`, not a
commit-attributed or merge-readiness receipt. The checkout contains unrelated active work.

- CLI guard RED: `node --test --test-name-pattern='qualified browser|exploration accepts' scripts/dev/command-runners.test.mjs`
  failed 2/2 before implementation; both passed after implementation.
- Complete-report guard RED: `node --test --test-name-pattern='qualified reports' scripts/dev/command-runners.test.mjs`
  failed before implementation. The final owning suite includes valid, missing, skipped, failed,
  retried, stale and wrong-project report cases.
- Selector RED: `node --test --test-name-pattern='qualified browser checks|browser proof fingerprints' scripts/quality/select-validation.test.mjs`
  failed 2/2 before registration. Direct proof covers relevant/unrelated selection, missing
  capability, retained critical checks and changed source/profile/toolchain/seed fingerprints.
- The first production negative control exposed worker network access despite page offline
  emulation. Blocking worker requests made the control meaningful; positive cached reload and
  deliberate missing-cache rejection then passed in the same context.
- Early exploration runs failed on undeclared external dependencies and a short cold-route
  budget. The trace identified the actual fonts, telemetry, avatar and reverse-name reads.
  Those substitutes are explicit. The new multi-action scenario has a 90-second case budget
  inside the five-minute run cap; no existing journey's timeout was increased. Seeds 42 and 17
  subsequently passed both cases, without retries. The fixed-clock default seed passed again.

Rendered evidence is **CI Playwright, clean-room Chromium**: virtual authenticator for passkey,
mock auth for work review, and anonymous production preview for PWA. Screenshots of the passkey
error, offline login shell and seeded work review were inspected. This does not prove physical
biometrics, a real wallet, a live passkey server, authenticated Brave, an installed PWA, queued
uploads, or worker update recovery. The worker networking limitation and context routing are
consistent with [Playwright's worker-network documentation](https://playwright.dev/docs/service-workers).

## Validation receipt

The full selected QA run passed **7/7 checks**, with **378/378 tooling tests**, **333/333 fixture
tests**, and all four browser scenarios passing without skips or retries. No passing receipt was
reused. The observed browser timings (including their startup/build) were:

| Check | UTC start, 2026-10-05 | Cases | Playwright duration |
|---|---|---:|---:|
| Passkey rejection | 06:48:52 | 1 | 72.03 s |
| Production PWA | 06:50:06 | 1 | 79.49 s |
| Seeded work, seed 17 | 06:51:28 | 2 | 73.46 s |

These are single observations. Host load reported substantial contention; it does not waive a
failed check or establish a cause. Estimates are now 80/100/90 seconds respectively. The final
profile was exercised by these browser runs and the closing fixture/runner tests. After the full
QA run, matching workflow triggers and measured estimates were finalized; the closing selector
suite verifies those edits. The full gate was not repeated solely for that metadata change.

Final source identity at **2026-10-05T06:57:25.062787+00:00**: **sha256:40cbfa56ae0cc664d7de1f165b7a95b4814583037759b42b6ecf4d502ffcce82**,
stored in `/tmp/green-goods-sf-final-source-v2.json`. It hashes sorted path/content digests over
Client, Shared, contract ABI/deployment data, scripts, tests, the Client workflow, root manifest,
lockfile and Playwright config. This identifies dirty source, including unrelated changes; it is
not ownership evidence or a commit receipt. Plan-only closeout edits follow that snapshot.

Exact full-gate command:

```sh
node scripts/dev/ci-local.js --intent qa \
  --changed playwright.config.ts --changed scripts/data/validation-policy.json \
  --changed scripts/quality/select-validation.mjs --changed scripts/quality/select-validation.test.mjs \
  --changed scripts/dev/ci-local.js --changed scripts/dev/browser.js --changed scripts/dev/test-e2e.js \
  --changed scripts/dev/command-runners.test.mjs --changed tests/fixtures/playwright-services.ts \
  --changed tests/fixtures/playwright-services.test.ts --changed tests/fixtures/work-exploration.ts \
  --changed tests/fixtures/work-exploration.test.ts --changed tests/fixtures/pimlico-handlers.test.ts \
  --changed tests/specs/client.passkey.spec.ts --changed tests/specs/client.exploration.spec.ts \
  --changed tests/specs/client.pwa-preview.spec.ts --changed .github/workflows/client.yml \
  --changed tests/README.md --changed scripts/README.md
```

Final refresh and supporting commands:

```sh
node --test scripts/quality/select-validation.test.mjs scripts/dev/command-runners.test.mjs
bun x vitest run tests/fixtures/*.test.ts --environment node
node scripts/dev/ci-local.js --intent qa --only format --only lint --changed playwright.config.ts --changed tests/global-setup.ts --changed tests/fixtures/playwright-services.test.ts --changed scripts/data/validation-policy.json --changed tests/README.md --changed scripts/README.md --changed .github/workflows/client.yml
bun x oxlint tests/global-setup.ts tests/specs/client.passkey.spec.ts tests/specs/client.exploration.spec.ts tests/specs/client.pwa-preview.spec.ts tests/fixtures/work-exploration.ts tests/fixtures/work-exploration.test.ts tests/fixtures/playwright-services.test.ts tests/fixtures/pimlico-handlers.test.ts --allow no-console --deny-warnings
node scripts/quality/check-codex-docs.js
node scripts/quality/check-skill-behavior-contracts.mjs
node scripts/quality/check-guidance-links.mjs
node scripts/quality/check-immutable-plan-reports.mjs
```

The closing tooling suite passed **115/115**, fixtures **333/333**, and the scoped style gate
**2/2**. Biome lint's existing exclusions checked zero files; supplemental Oxlint checked the
authored browser/fixture code. Guidance consistency, 15 behavior scenarios/routes, 77 guidance
files and immutable reports passed. A missing-Chromium plan explicitly reports
`blocked:playwrightChromium`. The initial README consistency failure was repaired by restoring
the runner path reference. A mistyped comma-separated `--only` invocation was rejected before
checks ran; the corrected repeated flags above passed.

Workflow-trigger RED failed before adding the browser CLI/lifecycle paths to both the Client
workflow and its required-workflow map. The final selector suite passes that case and workflow
parity. Final protected-source diff checks found no unintended changes to another session's work.


## Remaining observational obligations

SF10: actual Codex hook events were already observed; Claude Desktop Code has not supplied
an observation. A terminal invocation or another synthetic fixture cannot fill that gap.
SF13: the architecture pilot still has one ordinary bug-fix observation and four empty task
categories. No five-task p50/p90, missed-regression rate or live routine-dispatch outcome is
claimed. The current implementation task is not five independent adoption samples. The existing
pilot remains the owner; no new scheduled automation or billed synthetic task was created.

The unrelated `.plans/active/agent-messaging-channels/` directory still lacks `status.json`,
so the repository-wide Plan Hub validator cannot pass. Its files were left untouched.
Current-head GitHub CI and publication are also pending. Optional SF09 PR-text export remains
deferred; existing runner diagnostics and the reports above provide the local evidence.
