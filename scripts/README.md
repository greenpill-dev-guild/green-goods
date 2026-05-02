# `scripts/`

Repo-level scripts, organized by purpose. Each one has a durable caller — root `package.json`, a `.github/workflows/*.yml`, `ecosystem.config.cjs`, or a Claude skill / planning harness. If a script doesn't fit those, it doesn't live here. See the policy in [CLAUDE.md](../CLAUDE.md) and [AGENTS.md](../AGENTS.md) before adding a new one.

## Layout

```
scripts/
├── dev/            local dev workflow (setup, doctor, stack, smoke, e2e, seed)
├── quality/        CI gates / consistency checks
├── design/         design system enforcement
├── contracts/      contract audits + deploy verification
├── ops/            chain ops + release artifact uploads
├── harness/        skill + planning helpers
├── postinstall/    bun/npm postinstall shims
├── lib/            shared helpers used by other scripts
└── data/           data files (baselines, fixtures) consumed by scripts
```

## Inventory

### `dev/` — local dev workflow
| Script | Caller | Purpose |
|---|---|---|
| `setup.js` | `bun run setup` | First-clone setup; checks deps, installs, configures env |
| `doctor.js` | `bun run dev:doctor` / `setup:doctor` | Non-mutating readiness check (ports, tools, env, profiles) |
| `node-cli.js` | `packages/client dev`, `packages/admin dev`, `packages/shared storybook`, `docs dev` | Run local JS dev CLIs under real system Node instead of Bun's injected `node` shim |
| `stack.js` | `bun run dev:web` / `dev` / `dev:stop` | Start/stop PM2 app groups from `ecosystem.config.cjs` |
| `smoke-web.js` | `bun run dev:smoke:web` | Verify client/admin/docs/storybook respond on local ports |
| `tunnel.js` | `bun run dev:tunnel`, `ecosystem.config.cjs` | Cloudflared tunnel for PWA device testing; writes `.tunnel-url` |
| `open-urls.sh` | `ecosystem.config.cjs` (PM2 app) | Wait on dev ports, open Brave to localhost URLs |
| `test-e2e.js` | `bun run test:e2e[:smoke]` | Boot the web stack (client + admin + docs + storybook) via `bun run dev:web`, wait on health, run Playwright, stop via `bun run dev:stop` |
| `seed-test-data.ts` | `bun run seed:test` / `seed:anvil` | Seed local/anvil chain with test fixtures |
| `ci-local.js` | `bun run ci:local` | Local mirror of the CI gates |

### `quality/` — CI gates and consistency
| Script | Caller | Purpose |
|---|---|---|
| `check-codex-docs.js` | `bun run check:codex-guidance` | Verify `AGENTS.md` ↔ `.codex/` ↔ `package.json` ↔ `codex.mdx` parity |
| `check-source-structure.js` | `bun run check:source-structure` | File-size limits + frozen-allowlist policy |
| `check-test-quality.sh` | `bun run check:test-quality` | Detect tautological `expect(true)`, ungoverned `.skip`, `@ts-nocheck` in tests |
| `check-story-coverage.ts` | `design.yml` (via `packages/shared` script) | Storybook coverage policy per package |
| `check-story-quality.ts` | `design.yml` (via `packages/shared` script) | Storybook story-quality lints |
| `check-docs-design-parity.mjs` | `bun run check:docs-design-parity` | `docs/DESIGN.md` ↔ `docs/src/css/custom.css` role-accent + section-accent parity (light + dark) |
| `check-react-patterns.js` | `bun run lint:rules` | Repo-specific React, TypeScript, import, and frontend-pattern lint rules with a generated baseline |

### `design/` — design system enforcement
| Script | Caller | Purpose |
|---|---|---|
| `check-tokens.sh` | `bun run check:design-tokens` | DesignMD ↔ `theme.css` drift + `data/design-token-usage-baseline.tsv` audit |
| `check-vocab.sh` | `bun run lint:vocab` | Banned-vocabulary scan over i18n strings |
| `md-generate.mjs` | `bun run design:generate` / `check:design-generated` | Regenerate `design-md.generated.css` from DesignMD |

### `contracts/` — contract audits + verification
| Script | Caller | Purpose |
|---|---|---|
| `check-test-realism.sh` | `contracts.yml`, `packages/contracts test:audit:realism` | Audit fork/E2E tests for mocks, generic reverts, CI skip-returns |
| `check-test-realism-worker.cjs` | `check-test-realism.sh` | Node worker for the audit (CommonJS — uses `require`) |
| `validate-test-realism-tooling.sh` | `contracts.yml`, `packages/contracts test:audit:realism:tooling` | Meta-test that exercises the realism audit script itself |
| `run-coverage-audit.sh` | `packages/contracts test:audit:coverage` | Run unit + integration coverage and write `output/contracts-test-audit/` reports |
| `coverage-policy.mjs` | `run-coverage-audit.sh` | Per-file coverage thresholds policy |
| `verify-production.sh` | `bun run verify:contracts[:fast]` | Pre-deploy contract verification gate |

### `ops/` — chain operations + release artifacts
| Script | Caller | Purpose |
|---|---|---|
| `garden-rename-batch.ts` | `bun run garden:rename-batch[:dry:arbitrum/:arbitrum]` | Build Safe txs to rename gardens in batch |
| `ipfs-repin.ts` | `bun run ipfs:repin[:audit]` | Re-pin / audit Pinata content |
| `upload-action-images.ts` | `bun run upload:action-images[:dry-run]` | Upload action images to IPFS |
| `upload-sourcemaps.js` | `bun run sourcemaps[:dry-run]`, `packages/client build:deploy`, `packages/admin build:deploy` | Inject and upload built sourcemaps to PostHog with per-app env IDs |

### `harness/` — skill and planning helpers
| Script | Caller | Purpose |
|---|---|---|
| `plan-hub.mjs` | `plan` skill, `.plans/_automation/*` | Manage `.plans/{ideas,backlog,active}/` queue + lane status |
| `plan-hub.test.mjs` | `node --test scripts/harness/plan-hub.test.mjs` | Black-box fixture checks for plan-hub schema and TDD proof gates |
| `log-automation-run.mjs` | `.plans/_automation/*` prompts | Append plan-run telemetry under `.plans/_automation/runs/` |
| `parse-docx-feedback.ts` | `doc-feedback` skill | Parse a Google Doc downloaded as `.docx` into markdown with body + comments + tracked changes |

### `postinstall/`
| Script | Caller | Purpose |
|---|---|---|
| `fix-multiformats.js` | `npm`/`bun` postinstall | Patches `multiformats/basics`, `uint8arrays`, and walletconnect bundles to keep the Node CJS resolver happy in vitest workers; also synchronizes `.bun/react@*` cache slots with the override-pinned root React version |

### `lib/`
- `ipfs-hybrid.ts` — Pinata client helpers used by `ops/ipfs-repin.ts` and `ops/upload-action-images.ts`.
- `dev-shared.js` — `commandExists` / `commandVersion` / `majorVersion` helpers shared by `dev/setup.js` and `dev/doctor.js`.

### `data/`
- `design-token-usage-baseline.tsv` — audited baseline of legacy token references; consumed by `design/check-tokens.sh`.

## Companion locations

- `.claude/scripts/` — Claude harness scripts (skill frontmatter check, codex lane dispatch, agent gates)
- `docs/scripts/` — Docusaurus generators (`docs-audit.mjs`, `generate-protocol-status.mjs`)
- `packages/*/scripts/` — package-local scripts (e.g. `packages/indexer/scripts/`)

## Adding a new script

A script earns a place here only if it has a durable caller in (1) root `package.json`, (2) a `.github/workflows/*.yml`, (3) `ecosystem.config.cjs`, or (4) a Claude skill or planning harness path. Place it in the bucket that matches its purpose; create a new bucket only if it genuinely doesn't fit any existing one. Add it to the table above in the same PR.

One-shot ops (single-deploy fixes, batch migrations, ad-hoc audits) do not belong here — keep them in `.plans/<feature>/` or delete after use.
