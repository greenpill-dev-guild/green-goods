# `scripts/`

Repo-level scripts, organized by purpose. Each one has a durable caller — root `package.json`, a `.github/workflows/*.yml`, `ecosystem.config.cjs`, or a Claude skill / planning harness. If a script doesn't fit those, it doesn't live here. See the policy in [CLAUDE.md](../CLAUDE.md) and [AGENTS.md](../AGENTS.md) before adding a new one.

## Layout

```
scripts/
├── dev/            local dev workflow (setup, doctor, stack, smoke, e2e, seed)
├── mcp/            project-scoped MCP server launchers
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
| `setup.js` | `npm run setup`, `bun run setup`, `setup:host`, `setup:isolated`, `setup:cloud` | First-clone and workspace setup; checks deps, bootstraps Bun when allowed, installs dependencies, and handles host/isolated/cloud env posture |
| `clean.js` | `bun run dev:clean`, `bun run dev:clean:dry` | Remove disposable build/test/cache artifacts from the current checkout only; never stops services, removes dependencies, touches env files, or inspects sibling worktrees |
| `doctor.js` | `bun run dev:doctor` / `setup:doctor` / `dev:prod:health` / `dev:prod:mirror:health` | Non-mutating readiness check (ports, tools, env, profiles) |
| `env-template-init.js` | `bun run env:template:init` | Generate `.env.template` skeleton from `.env.schema` (one-shot) |
| `env-sync.js` | `bun run env:sync` | Run `op inject` against `.env.template` to materialize `.env` |
| `env-bootstrap.js` | `bun run env:bootstrap` | Append `.env.schema` defaults to `.env` for keys missing there (one-shot post-varlock-removal) |
| `env-check.js` | `bun run env:check`, called from `doctor.js` | Validate `.env` has all required `.env.schema` keys non-empty |
| `node-cli.js` | `packages/client dev`, `packages/admin dev`, `packages/shared storybook`, `docs dev` | Run local JS dev CLIs under real system Node instead of Bun's injected `node` shim |
| `remove-public-sourcemaps.js` | `packages/client build`, `packages/admin build` | Remove emitted `.map` files after Sentry upload so Vercel does not publish browser source maps |
| `stack.js` | `bun run dev:stack` / `dev:web` / `dev:full` / `dev:prod` / `dev:prod:mirror` / `dev:stack:stop` | Start/stop PM2 app groups from `ecosystem.config.cjs` |
| `smoke-web.js` | `bun run dev:smoke:web` | Verify client/admin/docs/storybook respond on local ports |
| `smoke-full.js` | `bun run dev:smoke:full` | Verify the default full-local stack: browser surfaces, local agent, local indexer/Hasura/Postgres, Anvil chain id `42161`, deployed bytecode, and funded Anvil accounts |
| `smoke-prod.js` | `bun run dev:prod:smoke`; auto-run by `bun run dev:prod` and `bun run dev:prod:mirror` | Verify local browser surfaces plus read-only production agent health, Arbitrum RPC, contract bytecode, production/local indexer health, and indexer lag |
| `tunnel.js` | `bun run dev:tunnel`, `ecosystem.config.cjs` | Cloudflared tunnel(s) for client + admin device testing. Spawns one tunnel per `--port` arg (defaults to client 3001 + admin 3002); writes `.tunnel-url` (client) and `.tunnel-url-admin` (admin) |
| `open-urls.sh` | `ecosystem.config.cjs` (PM2 app) | Wait on dev ports, open Brave to localhost URLs |
| `test-e2e.js` | `bun run test:e2e[:smoke]` | Boot the web stack (client + admin + docs + storybook) via `bun run dev:web`, wait on health, run Playwright, stop the PM2 stack via `bun run dev:stack:stop` |
| `seed-test-data.ts` | `bun run seed:test` / `seed:anvil` | Seed local/anvil chain with test fixtures |
| `ci-local.js` | `bun run ci:local` | Local mirror of the CI gates |

### `mcp/` — project-scoped MCP server launchers
| Script | Caller | Purpose |
|---|---|---|
| `brave-devtools.mjs` | `.mcp.json` (`brave-devtools`) | Start the upstream DevTools MCP package against Brave only, with the repo's Node 22 toolchain, isolated browser profile, stable viewport, page-id routing, structured output, redacted network headers, localhost HTTPS support, WebMCP debugging category, WebMCP testing flags, external telemetry/CrUX opt-outs, and explicit rejection of Google Chrome, Chrome for Testing, Chromium, or Edge executable paths |

### `quality/` — CI gates and consistency
| Script | Caller | Purpose |
|---|---|---|
| `check-codex-docs.js` | `bun run check:codex-guidance` | Verify `AGENTS.md` ↔ `.codex/` ↔ `package.json` ↔ `codex.mdx` parity |
| `drift-check.mjs` | `bun run drift:check` | Read-only drift classifier across guidance, plans, design, docs, cleanup readiness, and quality guardrails |
| `drift-check.test.mjs` | `node --test scripts/quality/drift-check.test.mjs` | Fixture tests for drift checker warning normalization, routing, and dirty-tree context |
| `check-source-structure.js` | `bun run check:source-structure` | File-size limits + frozen-allowlist policy |
| `check-test-quality.sh` | `bun run check:test-quality` | Detect tautological `expect(true)`, ungoverned `.skip`, `@ts-nocheck` in tests |
| `check-story-coverage.ts` | `design.yml` (via `packages/shared` script) | Storybook coverage policy per package |
| `check-story-quality.ts` | `design.yml` (via `packages/shared` script) | Storybook story-quality lints |
| `check-docs-design-parity.mjs` | `bun run check:docs-design-parity` | `docs/DESIGN.md` ↔ `docs/src/css/custom.css` role-accent + section-accent parity (light + dark) |
| `check-react-patterns.js` | `bun run lint:rules` | Repo-specific React, TypeScript, import, and frontend-pattern lint rules with a generated baseline |
| `check-browser-verification-policy.mjs` | `bun run check:browser-verification-policy`, `bun run agentic:check` | Verify authenticated Brave QA guidance across canonical agent docs, reject stale local isolated-browser guidance, and enforce browser-proof guard wiring |
| `require-authenticated-browser-qa.mjs` | `bun run browser-proof:routes` via `agentic:browser-proof` | Block local isolated browser-proof runs unless `CI=true`, so clean-room proof cannot be reported as authenticated local QA |

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
| `bump-version.mjs` | `bun run version:bump <x.y.z> [--dry-run]` | Surgically set the `"version"` field across root + 6 package.json files to a target semver (unified versioning for monthly releases / hotfixes); one-line diff per file |

### `agents/` — agent query surfaces
| Script | Caller | Purpose |
|---|---|---|
| `posthog-query.ts` | `bug-intake` routine / debug skill | Read-only PostHog HogQL query surface for recent errors, error details, user sessions, recurring patterns, and bug-report matching; writes JSON to stdout and keeps replay links/user identifiers out of public issue evidence |
| `qa-sheet-append.ts` | `qa-triage` skill (Phase 6 write path) | Thin client that POSTs Defects rows + Test-tab Defect Link backfills + column bootstrap to an Apps Script Web App deployed on the Green Goods v1.1 QA workbook. No Google Cloud Console, no OAuth, no service account — the Apps Script writes under the user's Google identity. Webhook URL + secrets cached at `~/.config/qa-triage/{webhook,webhook-secret,webhook-admin-secret}.txt`. Canonical Apps Script source at `~/.config/qa-triage/setup.md` (chmod 600, never in git); repo-side pointer: [`qa-sheet-webhook-setup.md`](agents/qa-sheet-webhook-setup.md) |
| `qa-sheet-webhook-setup.md` | n/a | Repo-side pointer: tells you how to recreate `~/.config/qa-triage/setup.md` on a fresh machine. The canonical Apps Script source + both secrets live in that local file, never in git |

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
- `dev-shared.js` — shared dev-script helpers, including tool/version probes, Bun-to-Node re-exec with the repo's Node 22 toolchain, and loopback URL probes for local smoke checks.

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
