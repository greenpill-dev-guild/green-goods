# Software Factory third batch — Address repair and verification outcomes

Afo explicitly approved dependency changes and continuation. This batch completes the local
SF11 implementation and adds SF09's reporting checkpoint. SF03's Admin browser qualification
and the architecture hub's live hook-loading pilot remain open. No publication or external
record update is included.

## Address contract

Admin declares exact dev dependency `abitype@1.2.3`, the version already in the lockfile.
The lockfile adds only that workspace dependency entry; no package resolution changes. Bun's
three-day release-age policy remains enabled. Installation used Bun's offline cache with
lifecycle scripts disabled. The first sandboxed attempt could not write Bun's temporary files;
the approved retry succeeded.

The Hypercert component directory owns the ABIType registration because its marketplace SDK
pulls in Safe's deprecated `AddressType: string` augmentation. The supported `addressType`
registration restores `0x${string}`. Both app graphs now contain compile-only consumer guards,
including compatibility with Shared's domain Address alias. Unrestricted strings, ordinary
names, numbers and null are rejected; a valid literal passes. These guards run through existing
typecheck/build entrypoints and are not imported at runtime.

The seven exposed runtime callers now reuse validated addresses or narrow external text with
`isAddress`. Invalid garden IDs disable the three scoped vault reads; passing `undefined` must
not accidentally enable the hook's chain-wide query. ENS display reuses Add Members' validated
resolved address. Invalid garden text cannot enter the add-member dialog or address preview.
Existing public Address and hook signatures are preserved; no blanket assertions or compiler
suppression were added.

Restoring the contract also exposed 11 test/story diagnostics. Fixtures now preserve address
types at their owner, normalize query-key inputs through the existing helper, and describe
partial mocks honestly. The command-palette test now has a complete local `satisfies Garden`
fixture. An initial Shared test-factory export unnecessarily changed every certified seam
fingerprint; it was removed, and all original certificates now pass unchanged. The broad test
barrel and undeclared deep imports remain forbidden. The only retained manifest/lockfile change
is Admin's exact dependency entry; Shared's manifest is unchanged.

## Verification outcomes

`ci-local.js` now prints a final summary of the selected scope, fresh passes, reused receipts,
first failure, interrupted checks, unrun checks, compatibility skips and pending manual proof.
Its structured summary carries the source fingerprint and profile without copying subprocess
logs, environment values or attestation text. A failed or blocked run offers a quoted command
to inspect the same selected checks and focused test paths. Cancellation offers no automatic
restart command.

The package wrappers reserve exit 75 for a test-lease timeout before any suite runs. The runner
now reports that as a block, retains the original child code and stops under normal fail-fast
execution. Explicit `--no-fail-fast` still runs independent checks; a prior failure remains a
failure if a later suite cannot acquire its lease. No blocked result is cached as a pass.

Budget exhaustion, cancellation, unavailable capabilities, lease timeout and check failure stay
distinct. Numeric host load can suggest contention, but never excuses a failure or changes its
status. This checkpoint adds no retry loop, selector-policy change, PR-text exporter, or second
receipt store. Optional PR-text export remains deferred.

## Evidence

All evidence is from the dirty `develop` checkout based on
`c4a9487350c6739de54bcc2737dd2a972223243f`, with other sessions' application and Docs work left
untouched. The broad source snapshot at **2026-10-05 04:37:43 UTC** is
`sha256:c07cc3dab643865a548e9087c8602ef90cb65e3d01c1034b36c8b9efda6ae654`;
`/tmp/green-goods-sf-batch3-source.json` records roots and untracked inputs. It combines base HEAD,
the scoped binary diff and untracked source content. It is not a committed/current-head CI receipt.

| Proof | Observed result |
|---|---|
| Admin actual-graph negative probe before registration | Two unused `@ts-expect-error` directives: ordinary and unrestricted strings were accepted |
| Registration before caller fixes | Both rejection probes hold; seven caller diagnostics expose unchecked strings |
| Invalid route cases before narrowing | Shared 2 failed / 13 passed; Admin 2 failed / 4 passed; invalid strings still enabled vault reads |
| Focused Shared proof after narrowing | 22/22 passed, including valid/malformed/absent IDs and existing vault query behavior |
| Focused Admin proof after narrowing | 61/61 passed across vault, membership, create-hypercert and preview subjects |
| Application typechecks | Admin, Shared and Client pass; Admin and Shared test typechecks also pass after fixture repair |
| Test-type baseline control | The real Admin test graph with only the new registration excluded passes; the fixture diagnostics were caused by restoring the contract |
| SF09 initial negative proof | All six new cases fail against the prior runner; lease timeout is wrongly classified as a failed check and no summary exists |
| SF09 focused final proof | 49/49 pass, including later lease blocks, cancellation, budget exhaustion, pending manual proof and private-log exclusion |
| Live CLI summary | A format-only plan reports exactly one selected check and explicitly lists omitted lint/tooling checks; formatter checked zero excluded script files |
| Source structure / story coverage | Source structure passes without baseline expansion; existing story coverage check passes |

The selected QA plan retains every critical override for Shared, Client, Admin and Agent. The
root lockfile's one Admin dev-dependency entry also selected unrelated Contract, Indexer and Docs
checks. Per the validation contract's QA scope rule, those non-mandatory checks are explicitly
filtered with `--skip-contracts --skip-indexer --skip-docs`; their omissions remain visible in the
plan and outcome. No critical override is filtered. No whole-repository or merge-ready claim is made.

Exact plan and path list: `/tmp/green-goods-sf-batch3-plan.json` and
`/tmp/green-goods-sf-batch3-paths.json`. The gate command is
`node scripts/dev/ci-local.js --intent qa --changed <comma-joined paths from that list> --skip-contracts --skip-indexer --skip-docs`.
The gate completed with exit 0: **15 fresh passes, zero reused, zero unrun**. Shared passed
6,519 tests with 17 existing skips; Client 1,528; Admin 1,167; Agent 353 plus 16 settlement
conformance tests with one existing skip. Tooling passed 373 tests. Shared application/test,
Admin test and Agent typechecks, Admin production build, staged-module boundaries, story
quality and the complete Storybook build passed. Standalone Admin/Client application typechecks
also passed. Build warnings about large chunks, browser-externalized crypto and Storybook's
`@theme` at-rule remain nonfatal; they were not repaired by this batch.

After that broad run, the only authored source adjustment removed Shared's new export and
replaced its single test consumer with a local typed fixture. At **2026-10-05 04:44–04:46 UTC**,
Admin test typecheck, that command-palette subject (6/6), formatting, source structure and the
entire test-quality guard passed on the final adjustment. The full suites/builds were not rerun
for that test-only change. The earlier stale-certificate failure is preserved in
`/tmp/green-goods-sf-batch3-test-quality.log`; the passing follow-up is
`/tmp/green-goods-sf-batch3-test-quality-final.log`. No certificate, baseline or policy was weakened.

The final source manifest at **2026-10-05 04:46:17 UTC** is
`sha256:430ee60a36d6877dec77b71a0f778e5cd168dda7529eedff32f74ed6698dd406` in
`/tmp/green-goods-sf-batch3-final-source.json`. This manifest hashes a sorted path-to-file-SHA256
mapping; it includes unrelated active source and therefore is not a task-only or CI receipt.
The final authored paths omit Shared's manifest and are in
`/tmp/green-goods-sf-batch3-final-paths.json`.

Focused commands:

```sh
bun run --cwd packages/admin typecheck
bun run --cwd packages/admin typecheck --scope tests
bun run --cwd packages/client typecheck
bun run --cwd packages/shared typecheck
bun run --cwd packages/shared typecheck --scope tests
bun run --cwd packages/shared test -- src/__tests__/hooks/garden/useGardenDetailData.fallback.test.ts src/__tests__/hooks/vault/useGardenVaults.test.ts
bun run --cwd packages/admin test -- src/__tests__/views/GardenVaultView.test.tsx src/__tests__/components/Garden/AddMembersDialog.test.tsx src/__tests__/components/CreateHypercertDialog.test.tsx src/__tests__/components/Hypercerts/HypercertPreview.test.tsx
node scripts/dev/node-cli.js node --test --test-name-pattern='summary ' scripts/dev/ci-local.test.mjs
node scripts/dev/node-cli.js node --test scripts/dev/ci-local.test.mjs
node scripts/dev/ci-local.js --intent qa --only format --changed scripts/dev/ci-local.js,scripts/dev/ci-local.test.mjs
node scripts/quality/check-source-structure.js
bun run --cwd packages/shared check:stories
```

Supplemental Oxlint on the runner and its test still reports the existing unused `GIBIBYTE`
constant and unnecessary regex escape, both present at base HEAD. The selector's authored
application lint passes. These two older script warnings were not suppressed or claimed fixed.

## Browser evidence and remaining work

Browser proof is **CI Playwright, clean-room Chromium with mock auth**. The normal port 3002 is
occupied by an external server. The first attempt correctly refuses it. A temporary config and
global-setup copy use port 13002, preserving test profile, Sepolia, strict startup and zero retries;
the owning Playwright process cleans up its server, and both temporary files were removed.
The existing server was not stopped or reused as test-profile proof.

The isolated run started **2026-10-05 04:29:16 UTC**, took 86.93 seconds, and finished **1 passed,
1 failed, no skips or retries**. Create-garden validation, correction and cancel recovery pass.
The route sweep fails its first Create Garden heading readiness assertion. This is consistent
with the earlier open Admin qualification issue, but does not prove an identical root cause.
No auth/runtime repair, timeout increase or retry is used to qualify the result.

Visually inspected recovery screenshot: `/tmp/green-goods-sf11-validation-recovery.png`.
It shows the corrected name/description and deliberate remaining short-slug/domain rejection.
Raw screenshots and browser logs stay outside Git. This passing scenario does not qualify the
entire Admin route set or authenticated wallet/installed-PWA behavior. SF03 remains open.

Local logs use `/tmp/green-goods-sf11-*`, `/tmp/green-goods-sf09-*` and
`/tmp/green-goods-sf-batch3-*`. No branch change, commit, push, PR, merge, deployment,
worktree repair, routine dispatch or Linear write occurred.

## Plan and guidance validation

At final handoff, `node scripts/quality/check-guidance-links.mjs --base HEAD` passes all 77
guidance files, `node scripts/quality/check-immutable-plan-reports.mjs --base HEAD` confirms dated
reports unchanged, and the scoped Markdown file-reference check resolves all 49 links.
`git diff --check` passes. The final source manifest was rechecked without source drift.
`record-tdd` and `set-lane` succeed; the overall hub and state/API lane remain active for the
outstanding slices. Checkmarks on SF09/SF11 mean local acceptance, not publication.

`node scripts/harness/plan-hub.mjs validate` remains blocked by the unrelated in-progress
`.plans/active/agent-messaging-channels` directory, which lacks `status.json`. It was not edited.
The narrower passing document checks do not replace full hub validation. Browser readiness and
that separate hub issue are explicit limitations; there is no current-head GitHub CI claim.
