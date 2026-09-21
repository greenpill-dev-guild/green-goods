# Evaluation

## First-run acceptance (2026-09-21)

The installation permission that blocked this work was granted on 2026-09-21. The acceptance run
used a disposable clone of `develop` at `af6a97351401b97a4d040ee6baea9a27a4f71b52` with no team
`.env` and no copied credentials. Full command list and output summary are in the
[state_api receipt](handoffs/codex-state-api.md#validation-receipt).

- Frozen-lockfile install succeeds: 3,336 packages in 27.03s. Submodules initialize recursively.
- `npm run setup -- --profile isolated` completes: submodules validated against their recursive
  gitlinks, non-secret baseline `.env` created, no host-tool install, no secret resolution.
- `bun run dev:health -- prod` reports no required failures.
- `bun run dev -- prod` brings all 4 service ports up in 22.9s and the read-only production smoke
  passes: services, `eth_chainId=42161`, gardenToken bytecode, agent health, browser-origin
  refusal, hosted indexer GraphQL, indexer lag 123 blocks. No transaction was submitted.
- Owner-bound stop released exactly its own 4 claims and left an unrelated stale lease untouched.
- Team path in the connected checkout reports no required failures: `.env` satisfies `.env.schema`
  across 173 keys, Docker daemon running, Envio v3 types present, 1Password CLI detected.

This supersedes the earlier first-run and team-readiness blockers below. Both plan items are closed.

## Passed

- Launcher, ownership and validation-system fixtures: 232 tests passed in the final run, including dependency readiness and owner-bound stop.
- Documentation generator/audit fixtures: 30 tests passed, including removed aliases, missing
  guide targets, invalid validation intents, wrong cwd, and mismatched development modes.
- Documentation audit and 19 generated projections pass; the docs build and search index pass.
- Contract build and ABI-artifact guard pass. The required `verify:contracts:fast` passed after
  granting local socket access for disposable Anvil tests. No live broadcast was performed.
- The retained contract regression file passes all 11 tests through `test:script` and remains
  discoverable in the ordinary suite. The removed admin shortcuts refer to tests included in
  the ordinary package test globs.
- Baseline fixture creation needs no secret; reruns preserve existing content.
- The consolidated `contracts` CLI resolves from a first-run install and requires explicit
  `--network` and `--mode` on every mutating command.

## Blocked / not claimed

- The Solidity suite, gas gates, and storage baselines passed on 2026-09-13 against an uncommitted
  working copy, so they carry no commit SHA. They have not been re-run against `develop`.
- The Hats Arbitrum fork rehearsal refuses to run without a fresh reviewed block number, garden
  count, and expected implementation inputs. Mock proof does not replace that fork rehearsal.
- Shard comparison reports 345 of 356 baseline tests. Pre-existing and unchanged from the baseline
  commit; the 11 omitted tests keep dedicated runners. No membership was changed to mask it.
- The global workbench check fails on absent sibling repositories and stale global guidance paths.
  Those resources are outside this repository's change boundary.
- The selector overselects unrelated package suites for root-manifest-only QA and maps a TS
  contract test to Forge `test:match` (zero tests). The retained TS tests were run through the
  package `test:script` wrapper instead.
- Neither `setup` nor `dev:health` validates the Node version against the `.mise.toml` pin of
  22.22.1. The first run passed on Node v24.20.0 and the team path on v26.3.0, both reported
  `[PASS]`. Node 24 is a known CI blocker, so setup can succeed and CI still fail.
- No independent QA review pass ran against this work.
