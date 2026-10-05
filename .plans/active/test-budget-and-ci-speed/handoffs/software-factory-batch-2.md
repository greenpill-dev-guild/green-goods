# Software Factory second batch — hooks and Address constraints

Afo selected the next local batch: SF10–SF11. Hook diagnostics and the Client Address guard are
implemented. SF10's live agent hook-loading observations remain in the architecture hub's pilot.
SF11's Admin repair is pending explicit dependency approval. SF03 Admin browser qualification
from the [first batch](software-factory-batch-1.md) remains open.

## Implemented scope

`dev:health` now resolves the effective pre-push hook independently for each registered checkout
through Git. It distinguishes absent/bare checkouts, missing or non-executable dispatchers,
missing Husky helpers or targets, custom/older hooks, absent branch tooling, and `HUSKY=0`.
An absolute hook path still checks gate files relative to the pushed checkout. Missing targets
are called out because Husky otherwise silently skips them. Inventory failures produce a warning
instead of an empty healthy result. These checks use the existing doctor and shared helper;
no additional command or registry was introduced.

Success means the known chain's files are available. It does not prove user init behavior,
real execution, or agent harness loading. The doctor performs no dependency installation,
hook execution, Git-config change, worktree cleanup, or repair. Repair advice points to the
checkout owner and its own setup instructions.

The six new cases cover effective relative/absolute paths, missing chain links, branch-local
tooling, inactive registrations, unknown/custom hooks, and failed inventory. A disposable linked
checkout uses real Git and the installed Husky helper to reach its own fake gate. The marker
records that checkout's cwd, and exit 17 propagates back through Git. No push occurs.

The retained `packages/client/src/config/address.typecheck.ts` participates in the existing app
typecheck/build graph. A valid prefixed literal passes; non-hex text, unrestricted strings,
numbers and null require compiler rejection. Nothing imports this compile-only fixture at runtime.
It does not establish full Ethereum address validity; runtime validation remains necessary.

## Corrected Address finding and proposed Admin repair

The dated comparison's Client conclusion was too broad: its external scratch probe resolved a
different Bun peer-context copy of viem/ABIType. The real Client project already preserves the
intended Address constraint. Its new guard passes without any compiler/dependency change.

The same fixture temporarily placed at `packages/admin/src/types/address.typecheck.ts` makes
the actual Admin typecheck fail with exactly two unused `@ts-expect-error` directives, for the
non-hex literal and unrestricted string. Numbers and null are still rejected. This temporary
path is also outside Admin's declared source layout, so it was removed after diagnosis. Both
package typechecks pass in the retained state. Reproduce by copying the Client fixture into
Admin's source graph temporarily, running `bun run --cwd packages/admin typecheck`, then removing
that copy; choose a declared location before retaining the Admin guard.

Compiler `--explainFiles` traces the widening through
`@hypercerts-org/marketplace-sdk` → `@safe-global/api-kit` → `@safe-global/types-kit`.
Safe declarations register deprecated `AddressType: string` in ABIType. ABIType 1.2.3 prefers the
supported lowercase `addressType` registration before consulting that legacy key. In a scratch
configuration, declaring `addressType: \`0x${string}\`` restores both expected rejections and
exposes seven real caller diagnostics:

| Caller | Narrowing needed |
|---|---|
| `packages/admin/src/components/Garden/AddMembersDialog.tsx` | Resolved ENS text passed to Address display |
| `packages/admin/src/components/Hypercerts/HypercertWizard/index.tsx` | Garden ID passed to preview |
| `packages/admin/src/views/Community/components/CommunityMembersDialogs.tsx` | Garden ID passed to add-member dialog |
| `packages/admin/src/views/Community/components/CommunityMembersTab.tsx` | Garden ID passed to join requests |
| `packages/admin/src/views/Community/components/VaultActionRouteDialog.tsx` | Route/selected garden ID passed to vault query |
| `packages/admin/src/views/Garden/Vault.tsx` | Route/selected garden ID passed to vault query |
| `packages/shared/src/hooks/garden/useGardenDetailData.ts` | Detail route ID passed to vault query |

The proposed next step is one owning ABIType registration plus consumer guards, with the existing
`abitype@1.2.3` declared directly as an exact dev dependency and Bun's release-age gate preserved.
Fix those caller boundaries using existing validation/narrowing, preserving invalid-input and
query-enabled behavior. A bare augmentation without a resolvable dependency fails with TS2664;
hardcoding Bun cache paths or broad type assertions is not an acceptable repair. Scratch paths
were used only to diagnose the mechanism. Verify actual package resolution after installation;
a duplicate ABIType context must not create false confidence.

The async approval question remains unanswered. Root `AGENTS.md` says, “Do not install or upgrade
dependencies without explicit approval for this task.” No manifest, lockfile, registration,
runtime caller, or permission setting was changed. Approval must cover the exact dependency and
bounded caller fixes before continuing this repair. The immutable comparison report is preserved;
the corrected current finding is recorded here and in `eval.md`.

## Working-copy evidence

Base HEAD is `c4a9487350c6739de54bcc2737dd2a972223243f` on `develop`. Authored files and other
sessions' application changes are uncommitted; HEAD is not the tested implementation.
The five retained second-batch source/doc files are listed in
`/tmp/green-goods-sf-batch2-source.json`. Their sorted path/content hash plus base HEAD, collected
at **2026-10-05 01:47:10 UTC**, is
`sha256:62871a9f489aeaf88c2bb7f5f1cd520b28b12579b847f3bd624ea866272361b6`.
This is working-copy provenance, not a commit-attributed or current-head CI receipt.

```sh
# Focused subject and live doctor
node scripts/dev/node-cli.js node --test scripts/lib/dev-shared.test.mjs
bun run dev:health -- --profile web --core --json

# Exact selected tooling suite
node scripts/dev/node-cli.js node --test scripts/lib/dev-shared.test.mjs scripts/quality/check-direct-tested-seams.test.mjs scripts/quality/check-source-structure.test.mjs scripts/quality/check-staged-modules.test.mjs scripts/quality/select-validation.test.mjs scripts/dev/ci-local.test.mjs scripts/dev/surface-leases.test.mjs scripts/dev/stack.test.mjs scripts/dev/smoke-full.test.mjs scripts/quality/ci-gate.test.mjs scripts/quality/workflow-performance-parity.test.mjs scripts/dev/dev-modes.test.mjs scripts/dev/setup-env.test.mjs scripts/dev/package-commands.test.mjs scripts/dev/command-runners.test.mjs scripts/quality/check-commit-identity.test.mjs

# Consumer graphs and selected Client suite
bun run --cwd packages/client typecheck
bun run --cwd packages/admin typecheck
bun run --cwd packages/client test

# Selection and static checks
bun run check --plan -- --intent qa --changed scripts/lib/dev-shared.js,scripts/lib/dev-shared.test.mjs,scripts/dev/doctor.js,scripts/README.md,packages/client/src/config/address.typecheck.ts --json
bun x biome format --no-errors-on-unmatched packages/client/src/config/address.typecheck.ts scripts/README.md scripts/dev/doctor.js scripts/lib/dev-shared.js scripts/lib/dev-shared.test.mjs
bun --bun run oxlint packages/client/src/config/address.typecheck.ts --deny-warnings
bun x oxlint scripts/lib/dev-shared.test.mjs scripts/dev/doctor.js --allow no-console --deny-warnings
node scripts/quality/check-source-structure.js
node scripts/quality/check-staged-modules.mjs
bash scripts/quality/check-test-quality.sh
```

The QA selector chooses format, lint, validation-system, Client tests, and the staged-module
boundary. The exact tooling suite passes **366/366** with permitted process inventory; focused
helper proof passes **26/26**. A copy of the six new tests against `git show HEAD`'s original
helper fails all six because the capability is absent, then passes with the implementation.
The initial RED attempt used a wrong installed Husky helper path; it was corrected before the
recorded six-failure baseline. Only the corrected run supplies RED evidence.

The live doctor exits 0, ready, with 55 worktree records: 38 known chains available, 13 missing
dispatchers, three inactive registrations, and one custom/older chain. These are 17 hook
warnings, plus two unrelated warnings; there are no failures. Raw worktree paths remain local.
Both retained package typechecks pass. Format checks one file; selected lint and supplemental
doctor/test lint pass. Broader supplemental Oxlint on `dev-shared.js` reports two pre-existing
`prefer-const` findings in the unchanged request/timer code; no new lint diagnostic is hidden.
Source structure passes its shrinking baseline, all seven staged modules remain isolated, and
all nine test-quality checks pass. No policy baseline was expanded.

The selected Client suite passes **1,528/1,528 tests in 145 files** (28.99 seconds), completed
at 2026-10-05 01:48 UTC. Its first sandboxed run passed 1,527 and failed only the existing Vite
watcher test when listening on loopback returned EPERM. The same full command passed with that
capability available. No application repair or test suppression was used. Both package
typechecks passed at 01:45–01:46 UTC; the final focused helper run passed at 01:43 UTC.

The final tooling rerun at 2026-10-05 01:49 UTC passes **366/366** (10.30 seconds); the corrected
baseline control at 01:50 UTC fails **6/6** as expected. Final logs are
`/tmp/green-goods-sf10-validation-final.log` and `/tmp/green-goods-sf10-red-final.log`.
At 01:50 UTC, `node scripts/quality/check-guidance-links.mjs --base HEAD` passes all 77 guidance
files, `node scripts/quality/check-immutable-plan-reports.mjs --base HEAD` passes, and scoped
`git diff --check` passes. `node scripts/harness/plan-hub.mjs validate` exits 1 solely because
the unrelated in-progress `agent-messaging-channels` hub lacks `status.json`; that hub is untouched.
The implementation lane remains `in_progress`; machine TDD records do not close the outstanding
pilot, Admin repair, SF03 qualification, or current-head CI requirements.

Logs remain under `/tmp/green-goods-sf10-*` and `/tmp/green-goods-sf11-*`; they are transient
local evidence. Browser proof is **none**: this batch changes developer diagnostics and compile
constraints, with no rendered UI change. Live Claude/Codex hook loading and the five-task pilot
remain explicitly pending in the architecture hub. No commit, branch change, push, PR,
deployment, dependency installation, worktree repair, or external write occurred.
