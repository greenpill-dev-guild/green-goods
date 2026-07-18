# TypeScript 7-only upgrade - QA Pass 2 Handoff

## Lane

- Owner: Codex (executed by Claude Code in this session)
- Branch: `develop` (shared worktree; no isolated branch created — repo runs concurrent agents)
- Status: completed

## Scope

- Finish and verify the TypeScript 7-only upgrade, including the WalletConnect/uint8arrays resolution repair.
- Not a broad dependency audit. Only the root-wide `uint8arrays` constraints and the Bun lockfile were changed.

## Final Resolution (2026-07-15, user-approved) — READ THIS FIRST

**The uint8arrays override/resolutions removal was reverted — decoupled from the TS7 upgrade and undone.** Shipped state:

- `package.json` and `bun.lock` uint8arrays topology are **byte-identical to HEAD**:
  `overrides.uint8arrays: ^5.1.0` and the `resolutions` block are restored, and the lockfile
  nests **no `uint8arrays@3`**. Net footprint of all uint8arrays work this session = **zero**;
  only the TypeScript-7 changes remain in these two files.
- WalletConnect resolves `uint8arrays@5` **deterministically on every machine** — a clean
  `rm -rf node_modules` install creates **no v3 store dirs at all** — eliminating the
  CI-redness risk entirely.
- `scripts/postinstall/fix-multiformats.js` is **git-clean** (the trial fix was reverted).

**Why revert, not fix:** the root override is load-bearing infrastructure, not cruft. The
repo's compat strategy is *force all `uint8arrays` to v5, then patch the top-level v5 copy* for
`multiformats@13`'s dropped `./basics` subpath (`patchUint8arrays()` + the postinstall clobber
both assume v5-everywhere). Removing the override bought nothing — WalletConnect ends up on v5
via the clobber regardless, and its CJS `require` is never exercised (tests mock it; Vite
bundles ESM) — while introducing non-deterministic installs (readdir order → v3 possible on CI
→ 25 shared failures via `multiformats/basics`). uint8arrays is unrelated to TypeScript, so the
two were decoupled.

**Validation (deterministic-v5 tree, node 22):** `ci-local --quick` "All CI checks passed!";
`VITE_CHAIN_ID=11155111` build green (client + admin); focused shared locale-coverage 12/12;
docs RevenueProjectionChart 1/1. Full test + build were validated green earlier on the
functionally-identical v5 tree.

> The sections below (Repair Rationale, Resolved Topology, Findings) are the **investigation
> history** that led here — they describe the now-reverted override-removal experiment. Read
> them as the audit trail, not the shipped state.

## Repair Rationale

The root `package.json` carried three `uint8arrays` declarations: a direct
`dependencies.uint8arrays: ^5.1.0`, plus a root-wide `overrides.uint8arrays: ^5.1.0`
**and** `resolutions.uint8arrays: ^5.1.0`. The two root-wide constraints forced *every*
`uint8arrays` in the tree — including `@walletconnect/utils@2.23.1`'s pinned
`uint8arrays@3.1.1` — up to v5. uint8arrays v5 is ESM-only, so WalletConnect's CommonJS
`require("uint8arrays")` broke (`ERR_REQUIRE_ESM` / `No "exports" main defined`).

Fix: **remove the two root-wide constraints, keep the direct dependency.**

- Root direct `dependencies.uint8arrays: ^5.1.0` stays → v5 remains hoisted and available
  for any consumer whose range admits it (no first-party source imports uint8arrays; it is a
  hoist anchor).
- With no override, Bun's linker resolves each consumer to its own pin: the lockfile nests
  WalletConnect's `uint8arrays@3` (v3.1.0/3.1.1) in its subtree, and other uint8arrays
  consumers are no longer force-upgraded to v5.

> **Correction (2026-07-15 follow-up).** The original rationale claimed "WalletConnect
> receives its exact v3 dependency." That is true of the **lockfile** but **not** the
> installed tree: the postinstall (`fix-multiformats.js`) re-materializes WalletConnect's
> `uint8arrays` back to **v5**, and that v5 is the **validated-green** config — forcing v3
> fails 25 shared test files (see Findings #2). So the repair's real effect is on *other*
> uint8arrays consumers; WalletConnect stays on the same v5 it had under the old override.
> Root v5 stays available directly.

## Changed Files (this repair)

- `package.json` — removed `overrides.uint8arrays` and the entire `resolutions` block; kept
  all other overrides (`multiformats`, `react`, `react-dom`, `protobufjs`, `basic-ftp`) and
  `dependencies.uint8arrays: ^5.1.0`.
- `bun.lock` — regenerated with Bun (`install --lockfile-only --ignore-scripts` then
  `install --frozen-lockfile`). Diff is **uint8arrays-scoped**: one removed root-wide entry;
  10 added nested `.../uint8arrays` entries, every one under a `@walletconnect/*`
  (or thirdweb/appkit → walletconnect) subtree resolving to v3.1.0/3.1.1; top-level
  `uint8arrays@5.1.0` unchanged. No unrelated package moved versions.

## Resolved uint8arrays Topology

- `dependencies.uint8arrays`: `^5.1.0` (kept)
- `overrides.uint8arrays`: removed (null)
- `resolutions`: block removed entirely (null)
- Lockfile: WalletConnect subtrees nest `uint8arrays@3.1.0/3.1.1`; top-level stays `5.1.0`.
- **Installed tree (post-postinstall): WalletConnect's `uint8arrays` is materialized to
  `v5`** — the validated-green config (see Findings #2). Not deterministic across machines.

## Validation (this invocation)

| Check | Result |
|---|---|
| `node scripts/dev/ci-local.js --quick` | PASS ("All CI checks passed!") |
| `bun run format:check` | PASS (1952 files) |
| `bun lint` | PASS (0 errors, 164 pre-existing solhint warnings) |
| `bun run lint:vocab` | PASS |
| `bun run check:source-structure` | PASS |
| `CI=true bun --no-env-file run test` | PASS — shared 3355, client 637, admin 538, agent 230, indexer 186, contracts 1533; 0 failures; **0 clobber-signature occurrences** |
| `VITE_CHAIN_ID=11155111 bun --no-env-file run build` | PASS (contracts, shared, indexer, client, admin) |
| `node scripts/harness/plan-hub.mjs validate` | PASS (24 hubs) |
| `git diff --check` | PASS |
| TypeScript version | 7.0.2 (package.json + node-22 `tsc --version`) |
| Focused: shared locale-coverage | PASS (12 tests) |
| Focused: docs RevenueProjectionChart labels | PASS (1 test) |
| WalletConnect Proof 1 (topology) | PASS (`{direct:^5.1.0, override:null, resolution:null}`) |
| WalletConnect Proof 2 (from-root CJS load) | FAIL — artifact (see Findings) |
| Docs-chart rendered browser proof | BLOCKED — non-interactive session; no authenticated Brave |

> All test/build PASS rows above were observed **with WalletConnect materialized to
> `uint8arrays@5`** (this machine's postinstall landing). The green result is contingent on
> that v5 landing — see Findings #2.

## Findings / Caveats (for maintainer)

1. **From-root `require("@walletconnect/utils")` proof fails as an artifact.** A clean Bun
   install correctly does *not* hoist the transitive `@walletconnect/utils` to root, so the
   probe cannot resolve it (`Cannot find module`) — this is a resolution/hoisting artifact,
   not a uint8arrays-version signal. Bun's linker natively symlinks
   WalletConnect → `uint8arrays@3.1.1` before postinstall; the lockfile nests v3. The real
   regression signal (the shared suite's previously-import-failing files, and all package
   tests) is green.

2. **Postinstall clobber — INVESTIGATED as a follow-up, premise inverted, NOT shipped.**
   `scripts/postinstall/fix-multiformats.js` → `fixBunCacheSymlinks()` materializes the
   WalletConnect `uint8arrays` symlink into a real copy using a **version-agnostic,
   last-wins `packageSources` map**. On this machine it lands **v5**.
   - The obvious fix — follow the symlink's own `fs.realpathSync(depPath)` target to force
     the pinned **v3** — was implemented and **disproven**: it regresses the shared suite to
     **260/285 (25 failed)** with `Package subpath './basics' is not defined by "exports" in
     .../multiformats/package.json`. `uint8arrays@3` does `require("multiformats/basics")`,
     which `multiformats@13` removed; the repo shim patches only the **top-level** uint8arrays
     copy, not the materialized WalletConnect copies.
   - So the **v5 clobber is load-bearing**, not a pure bug. Empirically on this machine:
     WalletConnect `uint8arrays` **v5 → shared 285/285 green**; **v3 → 260/285**.
   - **Residual risk:** version selection is **non-deterministic** (`readdirSync` order), so a
     machine or CI whose readdir picks **v3** would hit the 25 failures. The current green
     rests on this machine landing v5.
   - **Decision for the maintainer (deferred):** (a) accept WalletConnect-on-v5 as the
     deliberate validated-green config and make it deterministic (e.g. pin WalletConnect's
     `uint8arrays` to v5), **or** (b) authorize a **non-minimal** effort to extend the
     multiformats/basics shim across the materialized v3 copies so WalletConnect can run its
     pinned v3. The trial fix was reverted; `fix-multiformats.js` is git-clean.

3. **Environment notes (not regressions):**
   - `node node_modules/typescript/bin/tsc --version` fails under the environment's PATH
     node 18 (extensionless bin under `type:module`); node 22 (repo's `.mise.toml` pin, CI's
     version) prints `Version 7.0.2`.
   - `sharp@0.32.6` (agent-only, transitive via `@xenova/transformers`) native build is
     gated by node-gyp under node 18; it is outside the build path and agent tests pass.
   - node_modules was cleanly reinstalled during this session; the lockfile is the source of
     truth and was not hand-edited.

## Residual Plan State

- `qa_pass_1` remains `ready` (not promoted); `qa_pass_2` completed directly per the task
  instruction. Maintainer to decide whether to formally close `qa_pass_1`.
