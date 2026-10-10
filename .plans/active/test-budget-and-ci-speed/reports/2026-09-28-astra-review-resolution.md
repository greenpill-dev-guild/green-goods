# Astra review resolution (2026-09-28)

Astra's review of the velocity follow-through
([report](2026-09-28-astra-review.md), range `d7cf681ec..01ba4e2cd`) returned REQUEST_CHANGES with
five Must-Fix findings and one Should-Fix. All six are fixed, each with a failing proof first and
its siblings swept. Afo answered the three Human Call-Outs as D6–D8, and those fixes are in too.
Fourteen commits follow `01ba4e2cd`, one per root-cause class. Nothing here was answered by
argument instead of code.

## Findings

| Finding | Resolution | Commit | Proof |
|---|---|---|---|
| MF1: critical receipts omit the effective environment | The runner builds each check's environment once, spawns the check with it, and fingerprints the same object, plus a digest of the git-ignored root `.env*` files. The fingerprint leaves out only `PATH`, `GIT_EXEC_PATH`, `NODE`, the re-exec markers and shell bookkeeping. A manual run and the pre-push hook differ in exactly `PATH`, `GIT_EXEC_PATH` and `SHLVL`, so the hook still reuses the pass it follows. Sibling: Turbo hashed no `VITEST_MAX_WORKERS`; it is now in `globalEnv`. | `51105627d` | RED: `VITEST_MAX_WORKERS` 1→9 reused, and a probe exiting 42 replayed `passed`. GREEN: runner tests; a CLI run reuses under a hook-like environment and reruns under `VITEST_MAX_WORKERS=9` |
| MF2: mutation aliases and forwarded callbacks escape critical classification | Two classes. (a) Capability travels by reference: an imported primitive used whole (alias, callback property, JSX element), namespace members and destructuring, and a primitive member read without a call now count. A member forwarded under its own name (`signOut: auth.signOut`, as `useAuth()` does) keeps only its own file critical, and a value used through a member (`jobQueue.getJobs()`) leaves the member name to decide. (b) Imports the analyzer cannot read fail closed: Shared self-imports resolve through package exports, `@shared/` resolves, and an unexported subpath, a missing internal file or a computed `import()` count as invoking. An unlisted entry point such as `wagmi/actions` is judged by name. | `741c27d5c`, `f3454cc24` | RED: 9 of 10 and 7 of 10 fixture files, in `hooks/`, `modules/`, `utils/` and `components/`, selected routine plans. GREEN: all critical, with readers routine. On the real tree 5 files entered (4 under critical prefixes) and none left. `providers/AuthGate.tsx`, which mounts `AuthProvider`, joined the exact list |
| MF3: strict intents still reuse noncritical receipts | One rule, `receiptPolicyFor(intent, risk)`, owned by the selector. Readiness, ship, merge and release never reuse at any risk, and a critical plan reuses only in push. The runner fails closed when a plan says nothing. Sibling: those gates' package suites ran through Turbo's cache; they now pass `--force`. | `b0d245f23` | RED: a routine readiness rerun reused 25 checks. GREEN: real routine, sensitive and critical plans run twice in each strict intent with no reuse |
| MF4: shared-graph admission permits dependency state to leak | Three layers. Admission follows a test's helpers under `__tests__/` and `__mocks__/`, including casted global writes. The shared-graph setup resets the module registry before each file. A global or `navigator` property a test leaves changed fails its file and is restored, after the file's spies are restored, because `restoreMocks` would otherwise re-apply a stale spy at the next file's first test. The guard found a real leak: `graphql-client-timeout` left the fake clock's `clearTimeout` installed for every later file in its worker. | `f22859608` | RED: an ordered fixture suite under the real setup failed 4 of 4 (module counter, helper global, navigator property, fake-clock spy). GREEN: 4 of 4. Four files moved to the isolated project because their helpers stub `navigator`; the shared graph runs 137 files in about 10 s |
| MF5: the required readiness gate is red (`SeedStepHowMuch.tsx`) | `./utils/action/window` is a declared Shared leaf, and all three Seed files import from it; sweeping found `index.tsx` and `seedStepModel.ts`. Four seams whose evidence includes the Shared manifest were re-certified. | `96d90391e` | workflow-performance-parity 40/40, was 39/1 |
| SF: an empty small-file justification passes the guard | The marker must open a comment line, and its reason is the rest of that line: at least two words, not a template, not a TODO. A marker inside a string no longer counts. | `e4202ad70` | RED: an empty reason followed by `it("one")` passed. GREEN: 8 rejected and 3 accepted sources |

Found while verifying MF4: happy-dom's own `fetch` really sends a request made while a test file
loads, before the core setup's strict fetch replaces it. AppKit's telemetry beacon went out that
way and failed a full Shared run with an unhandled rejection. The DOM setup now answers every such
request with a 503 (`6f7279cf4`).

## Human Call-Outs (D6–D8)

- **D6: order-dependent tests, fixed before push.** Seven files, in two classes.
  - `vi.clearAllMocks()` keeps a test's `mockReturnValue`: `useActionOperations`,
    `useGardenDomains` and `WorkProvider` now reset the defaults they assume (`282747338`).
  - Module or store state carried from the test before: `service-worker-registration` and
    `upload-preparation` load fresh modules per test, `useDrafts` resets the work-flow store, and
    the `connectivity` probe fetches reject on abort, as fetch does (`407d4459b`).

  Each file passes 25 in-file shuffle seeds (`useDrafts`, 40). The full Shared suite under
  `--sequence.shuffle --sequence.seed=5101` passed 543 files and 6,081 tests.
- **D7: `offlineDownloads` fixed now; the SDK patch is a follow-up.** The test runs in happy-dom and
  asserts the file's real bytes, `"original-bytes"`, not the 13 characters of `"[object Blob]"`
  (`7f1c0b7c7`). Run alone, the old assertion had also started failing under jsdom (14, not 13).
- **D8: all three CI routing gaps fixed now.**
  - CI Gate expects exactly the workflows whose path filters start (`ba6feb9b2`). A new guard reads
    every mapped workflow's filter, with globs and negations, and fails in either direction. It
    found 14 unexpected starts and one expectation that never starts (Docs for
    `deployments/README.md`). The fixes: `package-commands.mjs` in five workflows,
    `setup-playwright`, `check-staged-modules`, `useTheme.ts`, `yarn.lock`, root `tests/` specs,
    and `docs.yml` starting for `deployments/**`.
  - The parity job runs for every file its suites read or import (`77cf70b55`). A guard derives
    those files from the suite itself.
  - Client and Admin run for the Shared test support they import, as named in
    `sharedConsumerTestSupport` (`268bb138f`).

## Open items and destinations

| Item | Destination |
|---|---|
| `@hypercerts-org/sdk` 2.9.1 patches `BigInt.prototype.toJSON` on load, so `canonicalJobPayload` cannot tell `9n` from `"9"` once the SDK has loaded (D7) | Product follow-up for Afo; a Linear issue belongs to a pass that may write to Linear |
| `prepareNow()` keeps the Data Saver override in the page-lifetime snapshot, so a later signed-in session's preparation inherits it | Product question for Afo; the behavior is unchanged and the test pins neither answer |
| The parity suite's production import-seam case reads every Admin, Client and Shared source file, but neither the parity job nor the local push gate runs it for source changes. MF5's barrel import reached `develop` through that gap. Fixing it means routing source changes to the parity job (reversing its "no broad fallthrough" case) or moving the case into a check the package workflows run | Afo's decision; recommended: move the case into the package workflows' existing test job |
| The local push gate does not select `validation-system-test` for the configuration files the parity suite locks; CI now does | By design (consumer and configuration proof stays with CI); no change |
| Slice 1's lease timing bound (both runs within twice one quiet run) remains unmet in contended samples | Measure on a quiet machine with the next scorecard |

## Sensitive surfaces changed in this pass

- **Workflows:** `docs.yml`, `client.yml` and `admin.yml`, which now start in more cases and are
  never weakened.
- **Validation policy:** workflow rules, the critical exact list, `sharedConsumerTestSupport` and
  the primitive note.
- **Harness:** the receipt runner, the selector, the mutation analyzer, the shared-graph partition
  and its setup, and the supply-chain classifier.
- **Configuration:** `turbo.json` now hashes `VITEST_MAX_WORKERS`, `packages/shared/package.json`
  gains one export leaf, and the seam registry has five re-certifications.
- **Agent guidance:** `validation-pipeline.md` and `testing.md`.
- **Dependencies:** no dependency, lockfile or permission changed.

## Verification

All at the commit that carries each change unless noted:

- `node scripts/dev/node-cli.js node --test` over the validation-system-test file list: 348/348 at
  `268bb138f`.
- The full Shared suite passed at `6f7279cf4`: 6,081 tests, 17 skipped, no unhandled errors,
  235 s. It passed again under `--sequence.shuffle --sequence.seed=5101` (543 files) at
  `7f1c0b7c7`.
- `bash scripts/quality/check-test-quality.sh`, `node scripts/quality/check-guidance-links.mjs`,
  `node scripts/docs/generate.mjs --check` and the Shared and Admin typechecks: passing.
- The push gate and current-head CI for the pushed range are recorded in the hub closeout.
