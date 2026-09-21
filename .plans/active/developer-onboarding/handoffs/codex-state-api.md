# state_api handoff

Status: completed. This lane owns the development interface: the PM2 launcher, setup profiles,
health/smoke routing, and owner-bound surface leases.

## What changed

Root `dev`, `dev:health`, `dev:smoke`, `dev:clean` forward modes and service names through the
shared routing in `scripts/lib/dev-modes.mjs`. Setup gained the `isolated` and `host` profiles.
`surface-leases.mjs` owns claim compatibility and owner-bound release.

## What remains

Nothing in this lane. The first-run acceptance that was previously blocked on installation
permission is now proven; see the receipt below.

## TDD Proof

- RED: `node --test scripts/dev/dev-modes.test.mjs` — initial missing-mode-module failure recorded during implementation.
- GREEN: see the receipt below; the isolated validation-system suite and a live first-run launch both pass.
- Proof limit: `none`

## Validation Receipt

- Tested implementation commit SHA: `af6a97351401b97a4d040ee6baea9a27a4f71b52`
- Run at (UTC): `2026-09-21T23:14:13Z`
- Exact command(s): `git submodule update --init --recursive`; `bun install --frozen-lockfile`; `npm run setup -- --profile isolated`; `bun run dev:health -- prod`; `bun run dev -- prod`; `GREEN_GOODS_DEV_OWNER=prd918-firstrun bun run dev -- stop`; `bun run dev:health`
  The first six ran in a disposable clone of `develop` with no team `.env`; the last ran in the connected main checkout to prove the team path.
- Result: Install 3,336 packages, frozen lockfile honored, 27.03s. Setup reports pinned contract
  submodules ready, creates a non-secret baseline `.env`, performs no host install and resolves no
  secret. Hosted health: no required checks failed, 2 warnings (absent `PINATA_JWT`, foreign
  listener on 3001). Hosted launch: all 4 service ports ready in 22.9s — client 3001, admin 3002,
  docs 3003, storybook 3004. Production smoke passed: 11 PASS (services, `eth_chainId=42161`,
  gardenToken bytecode, agent health, browser-origin refusal, hosted indexer GraphQL, indexer lag
  123 blocks) and 1 SKIP (local indexer not started in hosted mode); no transaction submitted.
  Owner-bound stop released exactly 4 claims and left an unrelated stale lease on 3005 untouched.
  Team path: no required checks failed, 1 warning (that same stale lease). `.env` satisfies
  `.env.schema` across 173 keys; Docker daemon, Envio v3 types and 1Password CLI all present.
- Validated paths: `package.json packages/admin/package.json packages/agent/package.json packages/client/package.json packages/contracts/package.json packages/indexer/package.json packages/qa/package.json packages/shared/package.json docs/package.json scripts README.md ONBOARDING.md AGENTS.md CONTRIBUTING.md`
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- package.json packages/admin/package.json packages/agent/package.json packages/client/package.json packages/contracts/package.json packages/indexer/package.json packages/qa/package.json packages/shared/package.json docs/package.json scripts README.md ONBOARDING.md AGENTS.md CONTRIBUTING.md` → empty result

## Known risks

Neither `setup` nor `dev:health` checks the Node version against the `.mise.toml` pin of 22.22.1.
The first run passed on Node v24.20.0 and the team path passed on v26.3.0, both reported as `[PASS]`.
Node 24 is a known CI blocker, so a newcomer can complete setup and fail later in CI.
