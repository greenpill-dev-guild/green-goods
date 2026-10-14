# Test lease gaps (2026-09-29)

Snapshot 08's follow-up left one question open: why a push gate in
`.claude/worktrees/beautiful-mcclintock-768d91` ran full suites while the lease directory was empty.
Afo asked for the cause, then chose to harden the lease and record the answer (D13, options B and
C). Commits on `develop`: `e0046ac17` and `09ada5970`.

## Why the worktree gate ran without the lease

The worktree's code predates the lease.

- A process tree captured at 20:44 PDT on September 28 shows a Claude Code shell in the worktree
  running that worktree's own `scripts/dev/ci-local.js --intent push --reuse-passing-receipts`.
  The gate started `turbo run test --filter=@green-goods/shared`, Turbo started the worktree's
  `package-commands.mjs shared test`, and that started Vitest at 312% CPU. The lease directory,
  listed at the same minute, was empty.
- The worktree is on `feature/agent-reporting-core`, which branched from `develop` at `87938a730`
  (September 26, 21:06 PDT) and has not merged it since; it is 215 commits behind. The lease
  arrived in `d1bc5d86e` (September 28, 02:03 PDT). That commit is not an ancestor of the branch's
  head during the gate (`6615a909e`, committed 20:35) or after it (`f1fb38874`, 21:15, "record the
  push-gate receipts for the schema declaration").
- The worktree's files agree: it has no `scripts/dev/test-lease.mjs`, its `package-commands.mjs`
  never mentions a lease, its `ci-local.js` never sets `GREEN_GOODS_LOCAL_GATE`, and its
  `turbo.json` passes neither lease variable through.

The lease itself works across worktrees. `resolveTestLeaseDirectory` gives the same
`.git/green-goods-test-lease` from the main checkout, a nested Claude worktree and a Codex worktree,
and `package-commands.test.mjs` already covers a linked worktree. It is cooperative, though: only
code that takes it waits for it, and a checkout's scripts, its pre-push hook included, are frozen
at its branch point. On September 29 every worktree except the main checkout, 33 of them, was on
code from before `d1bc5d86e`: all of `.claude/worktrees/`, the four Codex worktrees and three stale
`/private/tmp/gg-*` ones.

A second exemption was in `develop`'s own code. `runsInContinuousIntegration` treated any `CI`
value without the local-gate marker as a CI runner, so a hand-run `CI=true bun run test`, the
usual way to reproduce Coverage Nightly, skipped the lease and took the whole machine. The first
attempt at the contaminated Admin run (20:36 PDT) recorded a Shared run from the main checkout
that held no lease, which fits this exemption; which session started it is unknown.

## Fixes

| Commit | Change | Proof |
|---|---|---|
| `e0046ac17` | `runsInContinuousIntegration` also requires `GITHUB_ACTIONS=true`, so a local `CI=true` run takes a slot. Turbo passes `GITHUB_ACTIONS` through; CI's package suites run `bun run test` in the package directory and still skip the lease | 26/26 lease tests in that commit's tree. With a stand-in holding the lease, `CI=true bun run test` in `packages/agent` waited 9 s for the slot, then took it and passed |
| `09ada5970` | Holding its slot, a package-wide run lists the machine's `vitest run` processes, skips those under a slot holder or in its own ancestry, and waits up to five minutes for the rest, naming each pid and command every 30 s; then it starts on half the machine. Watch and UI sessions and `vitest related` are left alone; a GitHub runner never scans | 30/30 lease tests, four of them new. With a stand-in `vitest run` process alive for 20 s, `bun run test` in `packages/agent` named it, waited 20 s, then passed |

Both commits passed the push gate's 12 checks, with `validation-system-test` at 357/357. The other
session's uncommitted UI edits were in the tree for those runs and are not part of either commit.

## Left

- The branches themselves (option A): each owning session merges `develop` into its worktree
  branch, starting with `feature/agent-reporting-core`, and Afo decides which finished worktrees to
  prune. Until then their gates still run without the lease.
- The wait makes new code yield to old runs; it cannot make old code wait for new ones, and it is
  bounded at five minutes so a stuck process cannot hold every suite back.
