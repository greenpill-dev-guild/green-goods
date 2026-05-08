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
├── agents/         durable agent query surfaces used by routines / skills
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
| `env-template-init.js` | `bun run env:template:init` | Generate `.env.template` skeleton from `.env.schema` (one-shot) |
| `env-sync.js` | `bun run env:sync` | Run `op inject` against `.env.template` to materialize `.env` |
| `env-bootstrap.js` | `bun run env:bootstrap` | Append `.env.schema` defaults to `.env` for keys missing there (one-shot post-varlock-removal) |
| `env-check.js` | `bun run env:check`, called from `doctor.js` | Validate `.env` has all required `.env.schema` keys non-empty |
| `node-cli.js` | `packages/client dev`, `packages/admin dev`, `packages/shared storybook`, `docs dev` | Run local JS dev CLIs under real system Node instead of Bun's injected `node` shim |
| `stack.js` | `bun run dev:web` / `dev` / `dev:stop` | Start/stop PM2 app groups from `ecosystem.config.cjs` |
| `smoke-web.js` | `bun run dev:smoke:web` | Verify client/admin/docs/storybook respond on local ports |
| `tunnel.js` | `bun run dev:tunnel`, `ecosystem.config.cjs` | Cloudflared tunnel(s) for client + admin device testing. Spawns one tunnel per `--port` arg (defaults to client 3001 + admin 3002); writes `.tunnel-url` (client) and `.tunnel-url-admin` (admin) |
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
| `check-css-custom-properties.mjs` | `check-tokens.sh` | Undefined `var(--*)` guard with audited baseline support |
| `check-css-custom-properties.test.mjs` | `node --test scripts/design/check-css-custom-properties.test.mjs` | Fixture tests for undefined custom-property guard behavior |

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
| `upload-sourcemaps.js` | `bun run sourcemaps[:dry-run]`, `client.yml`, `admin.yml` | Build sourcemap-enabled bundles in GitHub Actions, upload maps to PostHog, then remove local map files |

### `agents/` — agent query surfaces
| Script | Caller | Purpose |
|---|---|---|
| `posthog-query.ts` | `bug-intake` routine / debug skill | Read-only PostHog HogQL query surface for recent errors, error details, user sessions, recurring patterns, and bug-report matching; writes JSON to stdout and keeps replay links/user identifiers out of public issue evidence |

### `harness/` — skill and planning helpers
| Script | Caller | Purpose |
|---|---|---|
| `plan-hub.mjs` | `plan` skill, `.plans/_automation/*` | Manage `.plans/{ideas,backlog,active}/` queue, lane status, TDD gates, and taxonomy summaries |
| `plan-hub.test.mjs` | `node --test scripts/harness/plan-hub.test.mjs` | Black-box fixture checks for plan-hub schema, taxonomy, summaries, and TDD proof gates |
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
- `css-custom-property-baseline.tsv` — audited baseline of unresolved legacy CSS custom properties; consumed by `design/check-css-custom-properties.mjs`.

## Companion locations

- `.claude/scripts/` — Claude harness scripts (skill frontmatter check, codex lane dispatch, agent gates)
- `docs/scripts/` — Docusaurus generators (`docs-audit.mjs`, `generate-protocol-status.mjs`)
- `packages/*/scripts/` — package-local scripts (e.g. `packages/indexer/scripts/`)

## Adding a new script

A script earns a place here only if it has a durable caller in (1) root `package.json`, (2) a `.github/workflows/*.yml`, (3) `ecosystem.config.cjs`, or (4) a Claude skill or planning harness path. Place it in the bucket that matches its purpose; create a new bucket only if it genuinely doesn't fit any existing one. Add it to the table above in the same PR.

One-shot ops (single-deploy fixes, batch migrations, ad-hoc audits) do not belong here — keep them in `.plans/<feature>/` or delete after use.
