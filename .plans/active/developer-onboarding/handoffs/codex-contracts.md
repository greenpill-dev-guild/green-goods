# contracts handoff

Status: in_progress — implementation shipped, certification partial. This lane owns the
consolidated contract command surface, not contract behavior. No Solidity source changed.

## What changed

264 contract operational aliases collapsed into `bun run contracts -- <command> [arguments]`,
identical at package scope. Mutating deploy/upgrade/migrate/repair commands now require explicit
`--network` and `--mode`. Six operations were retained on evidence (action instructions v2, vault
migration, Octant asset repair, open minting, ENS reconciliation, pool backfill guards); the
old-name mapping is generated into `contract-operations.mdx` from `command-migration.json`.

## What remains

The Solidity suite has never been re-run against a commit SHA. See the proof limit below.

## TDD Proof

- RED: `bun run test:script` (isolated fixture) — caught and corrected stale command assertions; selector regression and boundary-policy negative tests recorded.
- GREEN: 2,083 Solidity tests, production gas checks, and 15 storage baselines passed on 2026-09-13.
- Proof limit: that GREEN run was made against an uncommitted working copy, so it carries no commit
  SHA and cannot be converted into a commit-attributed receipt after the fact. The receipt below
  covers only the consolidation surface this lane changed.

## Validation Receipt

- Tested implementation commit SHA: `af6a97351401b97a4d040ee6baea9a27a4f71b52`
- Run at (UTC): `2026-09-21T23:14:13Z`
- Exact command(s): `git submodule update --init --recursive`; `npm run setup -- --profile isolated`; `bun run contracts -- --help`; `bun run check --plan -- --intent qa`
  All four ran in a disposable clone of `develop` with no team `.env`. This receipt covers the
  consolidation surface only, not contract behavior; see the proof limit above.
- Result: Submodules initialize recursively (kernel, tokenbound, openzeppelin-contracts, forge-std,
  ds-test) and setup validates them against their recursive gitlinks; forge 1.7.1 detected. The
  consolidated CLI resolves and prints its operation surface with mandatory `--network` and
  `--mode` on every mutating command. The check planner resolves and correctly yields an empty
  plan for an unmodified clone.
- Validated paths: `packages/contracts/package.json packages/contracts/script/cli.mjs packages/contracts/config/command-migration.json docs/docs/builders/packages/contract-operations.mdx`
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- packages/contracts/package.json packages/contracts/script/cli.mjs packages/contracts/config/command-migration.json docs/docs/builders/packages/contract-operations.mdx` → empty result

## Known risks or blockers

- The Solidity suite, gas gates, and storage baselines are unverified at any commit. Re-running
  `bun run verify:contracts:fast` on `develop` would close this.
- Shard coverage audit reports 345 of 356 tests. Pre-existing and unchanged from the baseline
  commit; the 11 omitted tests keep dedicated runners.
- The Hats Arbitrum fork rehearsal still refuses to run without a fresh reviewed block number,
  garden count, and expected implementation inputs.
