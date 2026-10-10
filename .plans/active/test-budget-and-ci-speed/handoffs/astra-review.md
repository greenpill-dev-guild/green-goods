# Handoff to Astra: velocity follow-through review (2026-09-28)

Claude Fable 5.1 implemented the approved follow-through to Velocity Scorecard snapshot 06 as local
commits on `develop`. Nothing is pushed. The closeout pass pushes after your review and supplies the
current-head CI that steps 3 and 5 of the plan still wait for.

## Range

- **START:** `d7cf681ec`, `origin/develop` when the pass began.
- **END:** the commit that adds this file (`git log -1 --format=%h -- .plans/active/test-budget-and-ci-speed/handoffs/astra-review.md`).
- Review with `git log --stat d7cf681ec..END` and `git diff d7cf681ec..END`.

| Slice | Commit | Claim | Evidence |
|---|---|---|---|
| 0 | `fbccab4ed` | Baseline. Critical push 263 s cold and 57 s warm (`useWorkApprovals.ts`), against a 965 s estimate. A read-only hook took the critical plan: 360 s cold (contended) and 73 s warm | Report § Slice 0 |
| 1 | `d1bc5d86e` | A package-wide test run takes a machine-wide lease in the git common directory. A second run waits and names the holder, with stale recovery, a 900 s timeout (exit 75) and a warning when the directory is unwritable | Report § Slice 1; `scripts/dev/package-commands.test.mjs` |
| 2 | `56ed7f6ac` | D1: critical means signing, money, queue and auth. 52 read-only hooks left the tier and 60 uncovered mutation files entered it. The selector escalates a new mutation file from its code, and CI Gate guards the list | Report § Slice 2; `select-validation.test.mjs` |
| 3 | `e4c5799e5` | Critical push 274 s cold (twice) and 3 s warm, through exact-fingerprint receipt reuse in push intent only, with suites run one at a time. The estimate now reads 267 s | Report § Slice 3; `ci-local.test.mjs` |
| 4 | `9cee25ae3` | The push gate selects `test-quality`, `docs-generated` and `docs-authority` for the paths that break them. 37 of the 39 CI red pairs replay green; 2 were base drift | Report § Slice 4 |
| 5 | `023b17326` | The DetailsGate table had already landed (`ee5c8a147`). `--maxWorkers` never reached Vitest and is now passed as `VITEST_MAX_WORKERS`. The full Client suite passes at one worker | Report § Slice 5 |
| 6 | `b27b85a21` | 145 mock-free Shared Node files share one module graph, with a lean Node setup. Four leak classes are fenced, and Check 7 checks the resolved membership. Node files −51% to −54% wall, full suite −8% to −13%; identical names and results | Report § Slice 6; parity and selector tests |
| 7 | `6d880e5ca` | happy-dom for the Shared DOM project (D2): DOM wall −21%, −28% and −26%, and three full runs identical to jsdom. Five files are pinned to jsdom with reasons | Report § Slice 7 |
| 8 | `d57d3a6be` | Three test-budget rules; Check 8 fails a new test file below four cases without a reason; ten small Shared files folded (549 → 540), identical names and results | Report § Slice 8 |
| 9 | `a4b0e98d6` | Critical release tooling. Develop PRs reuse an exact-input production tree; pushes, release PRs, the local release gate and a new nightly step rebuild from scratch. Local unit command: 71–72 s fresh, 18 s cached | Report § Slice 9; `release-gas-gate.test.ts`, parity test |
| 10 | `4e36e556a` | Shared tests import test-utils leaves (−16% to −18% duration over the 55 importers); Check 9 rejects the barrel in Shared tests; Admin and Client keep `@green-goods/shared/testing` | Report § Slice 10 |
| 11 | `e6f2638c1` | Behaviour tests for the six near-zero files, each proven against one injected fault | Report § Slice 11 |
| 12 | `a61203b08` | D3: the ratchet is closed in `testing.md` and in the architecture hub (decision 11, `coverage_ratchet` closed); floors unchanged | Report § Slice 12 |
| 13 | END | This handoff and the hub update | `plan.todo.md` § Velocity follow-through |

The report is `reports/2026-09-28-velocity-follow-through.md`. Its tables hold each slice's
commands, RED and GREEN results, and measurements.

## Where to look hardest

- **Slice 9 (critical release tooling).**
  - Check `script/utils/release-gas-build-mode.ts`: `cached` is the only way past `forge build
    --force`, and a typo fails the gate.
  - Check the exact-key production cache in `contracts.yml`: no restore-keys, and inputs that
    include `test/**`, `lib/**` and `bun.lock`.
  - Check that only a develop pull request passes `cached`.
  - Check the new nightly step.
- **Slice 2.** Check `scripts/quality/shared-mutation-surface.mjs`, the lexical analyzer that
  escalates mutation files, and its fail-safe default for new hooks.
- **Slice 3.** Critical receipts are reused in push intent only; readiness, ship, merge and release
  never reuse.
- **Slice 6.**
  - Check the shared-graph rule in `scripts/lib/vitest-shared-graph.mjs`.
  - Check the built-in guard in `setupTests.shared-graph.ts`.
  - Check the `@shared-graph isolate` markers on the three `lib/hypercerts` tests.
- **Slice 7.** The lockfile diff re-hoists `ws`, `whatwg-mimetype` and `entities`. The report
  resolves every dependency edge to show that no existing edge changed version.
- **Seams.** Slices 7 and 10 re-certified fingerprints for seams whose proof files only switched
  environment or imports. `check-direct-tested-seams` reports no drift.

## Known limits and open items

- **Slice 1 lease timing:** "both runs within twice one quiet run" was not met in contended samples.
- **Pre-existing failure:** `validation-system-test` fails one parity case,
  `packages/admin/src/views/Garden/Pool/Seed/SeedStepHowMuch.tsx must not restore a broad Shared
  barrel`, a file this pass never touched. A spawned task tracks it.
- **Full shuffles (slice 6):** `--sequence.shuffle`, which reorders tests within files, fails the
  same five files on the pre-change config:
  - `service-worker-registration`;
  - `useActionOperations`;
  - `useGardenDomains`;
  - `useDrafts`;
  - `stores/connectivity`.

  `upload-preparation` also depends on its test order. File-order shuffles pass. These need Afo's
  scope decision.
- **For Afo (product):** `@hypercerts-org/sdk` 2.9.1 patches `BigInt.prototype.toJSON` when it
  loads. Any app session that loads it changes bigint JSON, including `canonicalJobPayload`'s
  `__bigint` tag.
- **For Afo (test defect):** `offlineDownloads.test.ts` asserts `size` 13, the length of jsdom's
  `"[object Blob]"`, not the downloaded bytes. It is pinned to jsdom and not changed here.
- **CI routing gaps** (the first two predate this pass):
  - `shared.yml` runs for `scripts/dev/package-commands.mjs`, but `workflowRules.Shared` omits it;
  - the parity job does not run for Client or Admin Vitest config changes;
  - Shared `test-utils` changes, which Client and Admin import, select neither consumer suite; they
    ran by hand in slice 10.
- **Shared CI shards:** shard 2 is slower than shard 1 on both configs, so slice 6 did not rebalance.
- **Unverified until CI runs:**
  - slice 9's cache hit: the second run of a develop contracts PR should log `reusing the production
    tree`;
  - the happy-dom and shared-graph timings on GitHub runners;
  - every current-head CI check.
- **Linear:** PRD-835 (architecture hub) still shows the ratchet checkpoint until the next
  `linear-sync`, which belongs to the closeout pass. This pass made no Linear writes.
- **Measurement conditions:** runs were made under memory pressure, with about 11.7 GB of 13.3 GB
  swap used and a 1-minute load of 12–15 during full-suite runs. Controlled A B B A pairs stand
  behind each speed claim, and contended runs are labelled.

## Reproduce

```bash
node scripts/dev/node-cli.js node --test scripts/quality/select-validation.test.mjs scripts/quality/workflow-performance-parity.test.mjs scripts/dev/ci-local.test.mjs scripts/dev/package-commands.test.mjs
bash scripts/quality/check-test-quality.sh
bun run --cwd packages/shared test
bun run --cwd packages/contracts test --suite script
node scripts/harness/plan-hub.mjs validate
```
