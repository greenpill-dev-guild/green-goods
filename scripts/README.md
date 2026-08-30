# `scripts/`

Repo-level scripts, organized by purpose. Each one has a durable caller — root `package.json`, a `.github/workflows/*.yml`, `ecosystem.config.cjs`, or a Claude skill / planning harness. If a script doesn't fit those, it doesn't live here. See the policy in [CLAUDE.md](../CLAUDE.md) and [AGENTS.md](../AGENTS.md) before adding a new one.

## Layout

```text
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
| `ci-local.js` | `bun run ci:local` | Selector-driven local executor with change-aware plans, fail-fast stopping, explicit blocked/cancelled results, and opt-in exact passing receipts |
| `ci-local.test.mjs` | `bun run test:validation-system`, CI Gate | Fixture coverage for local fail-fast, cancellation, blocking, and exact passing-receipt behavior |
| `surface-leases.mjs` | `stack.js`, `doctor.js` | Coordinate port/service ownership, compatible reuse, stale-claim cleanup, and owner-only release for concurrent development sessions |
| `surface-leases.test.mjs` | `bun run test:validation-system`, CI Gate | Deterministic coverage for claims, reuse, conflicts, stale-owner handling, and owner-only release |

### `mcp/` — project-scoped MCP server launchers
| Script | Caller | Purpose |
|---|---|---|
| `brave-devtools.mjs` | `.mcp.json` (`brave-devtools`) | Start the upstream DevTools MCP package against Brave only, with the repo's Node 22 toolchain, isolated browser profile, stable viewport, page-id routing, structured output, redacted network headers, localhost HTTPS support, WebMCP debugging category, WebMCP testing flags, external telemetry/CrUX opt-outs, and explicit rejection of Google Chrome, Chrome for Testing, Chromium, or Edge executable paths |

### `quality/` — CI gates and consistency
| Script | Caller | Purpose |
|---|---|---|
| `branch-name-policy.mjs` | Plan Hub, Codex dispatcher, Ship preflight, GitHub branch ruleset parity | Validate structural and semantic `<type>/<work-description>` branch naming without worker, issue, or lane-only identity |
| `branch-name-policy.test.mjs` | Supply Chain Guardrails | Fixture coverage for accepted work names and rejected worker, Linear-ID, lane-only, and malformed names |
| `check-codex-docs.js` | `bun run check:codex-guidance` | Verify `AGENTS.md` ↔ `.codex/` ↔ `package.json` ↔ `codex.mdx` parity |
| `drift-check.mjs` | `bun run drift:check` | Read-only drift classifier across guidance, plans, design, docs, ontology, cleanup readiness, and quality guardrails |
| `drift-check.test.mjs` | `bun run test:review-guardrails` | Fixture tests for drift checker warning normalization, routing, and dirty-tree context |
| `check-guidance-links.mjs` | `bun run check:guidance-links`, Supply Chain Guardrails | Guidance drift guard: links/scripts resolve, deleted commands and guides have no live consumers, changed fences have language tags, and the command banner remains aligned |
| `check-guidance-links.test.mjs` | `bun run test:review-guardrails` | Fixture tests for deleted command/guide consumers, retirement notices, renames, and fenced-language checks |
| `check-skill-behavior-contracts.mjs` | `bun run check:skill-behavior`, `bun run agentic:check`, Supply Chain Guardrails | Deterministic scenarios for architecture routing, research source authority and branch stopping, fact/decision persistence, frontier-round planning, map escalation, registry freshness, critical audit, module-seams review, contract-review, browser-proof, evidence, plan-lifecycle, and Ship-activation guidance contracts |
| `check-skill-behavior-contracts.test.mjs` | `bun run test:review-guardrails`, Supply Chain Guardrails | Positive live-source coverage and negative mutations proving each critical guidance scenario fails closed |
| `check-immutable-plan-reports.mjs` | `bun run check:immutable-plan-reports`, Supply Chain Guardrails | Reject edits, deletions, and renames of existing dated Plan Hub reports while allowing new correction artifacts |
| `check-immutable-plan-reports.test.mjs` | `bun run test:review-guardrails` | Fixture tests for immutable dated report diff classification |
| `lint-linear-issue.test.mjs` | `bun run test:review-guardrails` | Fixture tests for the `.claude/scripts/lint-linear-issue.sh` PreToolUse gate: accepted shapes (including generated plan mirrors), every rejecting rule with its reason, and the property-only/patch calls it must ignore |
| `check-source-structure.js` | `bun run check:source-structure` | Source placement, client naming, hook/shared-import layering, changed-file dead exports, file-size limits, and shrinking baseline policy |
| `check-source-structure.test.mjs` | `bun run test:validation-system` | Fixture coverage for placement, naming, layering, dead-export exclusions, staged modules, and exact baseline shrinkage |
| `check-staged-modules.mjs` | `bun run check:staged-modules`, validation selector | Keep deferred Card Endow modules marked and isolated from live Client imports |
| `check-staged-modules.test.mjs` | `bun run test:validation-system` | Positive and fail-closed fixtures for the staged-module boundary |
| `check-test-quality.sh` | `bun run check:test-quality` | Detect tautological assertions, ungoverned skips, `@ts-nocheck`, malformed new Solidity test names, and direct-test seam drift |
| `check-direct-tested-seams.mjs` | `bun run check:test-quality` | Resolve real package exports, require direct non-self-mocking subject proof, and validate selected/certified seam registry paths, composition, consumers, proof categories, and evidence fingerprints |
| `check-direct-tested-seams.test.mjs` | `bun run test:validation-system` | Fixture proof for export-map resolution, self-mocking rejection, missing/duplicate registry evidence, lifecycle gates, fingerprint freshness, and exact-baseline shrinkage |
| `check-story-coverage.ts` | `design.yml` (via `packages/shared` script) | Storybook coverage policy per package |
| `check-story-quality.ts` | `design.yml` (via `packages/shared` script) | Storybook story-quality lints |
| `check-docs-design-parity.mjs` | `bun run check:docs-design-parity` | `docs/DESIGN.md` ↔ `docs/src/css/custom.css` role-accent + section-accent parity (light + dark) |
| `check-react-patterns.js` | `bun run lint:rules`, root `bun lint` | Blocks high-confidence state/import violations; `--report` exposes noisier cleanup heuristics without flooding normal lint |
| `check-browser-verification-policy.mjs` | `bun run check:browser-verification-policy`, `bun run agentic:check` | Verify authenticated Brave QA guidance across canonical agent docs, reject stale local isolated-browser guidance, and enforce browser-proof guard wiring |
| `require-authenticated-browser-qa.mjs` | `bun run browser-proof:routes` via `agentic:browser-proof` | Block local isolated browser-proof runs unless `CI=true`, so clean-room proof cannot be reported as authenticated local QA |
| `select-validation.mjs` | `bun run validation:plan`, `bun run ci:local`, CI Gate | Shared intent/path/dependency/risk selector for agent plans, local execution, and expected PR workflows |
| `select-validation.test.mjs` | `bun run test:validation-system`, CI Gate | Fixture matrix for validation intent, risk overrides, dirty-tree freshness, toolchain blocking, budgets, and workflow routing |
| `ci-gate.mjs` | `.github/workflows/ci-gate.yml` | Fail-closed PR aggregate that consumes the shared selector, fails immediately on terminal non-success, and keeps strict missing-workflow protection |
| `ci-gate.test.mjs` | `bun run test:validation-system`, `.github/workflows/ci-gate.yml` | Fixture coverage for selector parity, immediate failure, missing registration, terminal conclusions, and stale reruns |
| `workflow-performance-parity.test.mjs` | `bun run test:validation-system`, Supply Chain Guardrails | Static guard for exact JS pins, cache scope, workflow routing, production import seams, CI-only coverage reporters, and Contracts Realism setup equivalence |
| `check-ontology.mjs` | `bun run check:ontology` / `ontology:generate`, `ontology.yml`, `drift-check.mjs` (ontology scope), `agentic:check` | Ontology drift gate: cross-checks the sidecar (`packages/shared/src/ontology/`) against Solidity enums, indexer GraphQL, shared TS vocabularies, EAS schema config, and glossary tables, with a burn-down baseline; `--generate` renders the two docs artifacts |
| `ontology-render.mjs` | `check-ontology.mjs` | Pure MDX renderers for the generated ontology reference page and entity matrix |
| `check-ontology.test.mjs` | `node --test scripts/quality/check-ontology.test.mjs`, `ontology.yml` | Fixture tests for ontology extractors, baseline reconciliation, and renderers |

### `design/` — design system enforcement
| Script | Caller | Purpose |
|---|---|---|
| `check-tokens.sh` | `bun run check:design-tokens` | DesignMD ↔ `theme.css` drift + `data/design-token-usage-baseline.tsv` audit |
| `check-guidance-examples.mjs` | `bun run check:design-tokens`, Design CI | Code-fence-aware guard against hardcoded motion, color, radius, and shadow values in design implementation examples |
| `check-guidance-examples.test.mjs` | `bun run test:review-guardrails`, Design CI | Fixture tests for design-example token allowances and hardcoded-value failures |
| `check-vocab.sh` | `bun run lint:vocab` | Banned-vocabulary scan over i18n strings |
| `md-generate.mjs` | `bun run design:generate` / `check:design-generated` | Regenerate `design-md.generated.css` from DesignMD |
| `check-css-custom-properties.mjs` | `check-tokens.sh` | Undefined `var(--*)` guard with audited baseline support |
| `check-css-custom-properties.test.mjs` | `bun run test:review-guardrails` | Fixture tests for undefined custom-property guard behavior |

### `contracts/` — contract audits + verification
| Script | Caller | Purpose |
|---|---|---|
| `check-foundry-version.mjs` | pre-push, contracts format/lint wrappers, production verifier, Contracts CI | Require the exact Forge version pinned in `.mise.toml` before formatter-sensitive commands |
| `check-foundry-version.test.mjs` | `bun run test:review-guardrails` | Fixture tests for the pinned Foundry version parser and comparison guard |
| `check-test-realism.sh` | `contracts.yml`, `packages/contracts test:audit:realism` | Audit fork/E2E tests for mocks, generic reverts, CI skip-returns |
| `check-solidity-test-names.mjs` | `bun run check:test-quality`, Contracts CI | Diff-aware naming guard for newly added or renamed Solidity test functions; legacy names are grandfathered |
| `check-solidity-test-names.test.mjs` | `bun run test:review-guardrails`, Contracts CI | Fixture tests for canonical Solidity test categories and added-function diff parsing |
| `check-test-realism-worker.cjs` | `check-test-realism.sh` | Node worker for the audit (CommonJS — uses `require`) |
| `validate-test-realism-tooling.sh` | `contracts.yml`, `packages/contracts test:audit:realism:tooling` | Meta-test that exercises the realism audit script itself |
| `run-coverage-audit.sh` | `packages/contracts test:audit:coverage` | Run unit + integration coverage and write `output/contracts-test-audit/` reports |
| `coverage-policy.mjs` | `run-coverage-audit.sh` | Per-file coverage thresholds policy |
| `verify-production.sh` | `bun run verify:contracts[:fast]` | Pre-deploy contract verification gate |
| `verify-production.test.mjs` | `bun run test:contracts-verifier` | Black-box regression test for contract verifier path resolution and working directory |

### `ops/` — chain operations + release artifacts
| Script | Caller | Purpose |
|---|---|---|
| `garden-rename-batch.ts` | `bun run garden:rename-batch[:dry:arbitrum/:arbitrum]` | Build Safe txs to rename gardens in batch |
| `ipfs-repin.ts` | `bun run ipfs:repin[:audit]` | Re-pin / audit Pinata content |
| `upload-action-images.ts` | `bun run upload:action-images[:dry-run]` | Upload action images to IPFS |
| `upload-sourcemaps.js` | `bun run sourcemaps[:dry-run]`, `client.yml`, `admin.yml` | Build sourcemap-enabled bundles in GitHub Actions, upload maps to PostHog, then remove local map files |
| `bump-version.mjs` | `bun run version:bump <x.y.z> [--dry-run]`, `bun run version:check <x.y.z>` | Keep root + 6 package versions and the supported release in `SECURITY.md` aligned; release CI uses check mode to block stale release metadata |
| `month-metrics.mjs` | `bun run metrics:month -- --month YYYY-MM [--json]` | Manual, read-only month-in-review aggregates for reviewed PRs, E2E static skips, active plans, and alias-folded contributor counts; no schedule or CI caller |

### `agents/` — agent query surfaces
| Script | Caller | Purpose |
|---|---|---|
| `posthog-query.ts` | `bug-intake` routine / debug skill | Read-only PostHog HogQL query surface for recent errors, error details, user sessions, recurring patterns, and bug-report matching; writes JSON to stdout and keeps replay links/user identifiers out of public issue evidence |
| `posthog-query.test.ts` | `bun run test:agent-tools` (root package.json) | Fixture coverage for the curated read-only commands, request shaping, cache behavior, and public-evidence privacy boundary |
| `qa-sheet-append.ts` | `qa-triage` skill (Phase 6 write path) | Thin client that POSTs Defects rows + Test-tab Defect Link backfills + column bootstrap to an Apps Script Web App deployed on the Green Goods v1.1 QA workbook. No Google Cloud Console, no OAuth, no service account — the Apps Script writes under the user's Google identity. Webhook URL + secrets cached at `~/.config/qa-triage/{webhook,webhook-secret,webhook-admin-secret}.txt`. Canonical Apps Script source at `~/.config/qa-triage/setup.md` (chmod 600, never in git); repo-side pointer: [`qa-sheet-webhook-setup.md`](agents/qa-sheet-webhook-setup.md) |
| `qa-sheet-webhook-setup.md` | n/a | Repo-side pointer: tells you how to recreate `~/.config/qa-triage/setup.md` on a fresh machine. The canonical Apps Script source + both secrets live in that local file, never in git |
| `qa-workbook-build.ts` | `bun run qa:workbook` (root package.json) / `qa-session` skill pre-flight | Projects `scripts/data/qa-test-catalog.json` (the upstream QA scenario source of truth) into a human-first Excel run sheet — Overview tab with run info + live counts, one tab per surface with plain-language columns grouped by area — in gitignored `tmp/qa/`. Definitions only; results live in Drive/the v1.1 Sheet, never in git |
| `qa-workbook-build.test.ts` | `bun run test:agent-tools` (root package.json) | Catalog validation (unique IDs, prefix↔tab consistency, enums), output-path reservation, and projection coverage for the run-sheet generator |
| `qa-state.ts` | `bun run qa:pull` (root package.json) / `qa-state.test.ts` | Pure merge and projection rules for QA app session state — folds each tester's shard into one case-keyed view, rolls up the standing verdict when testers disagree (most severe wins), and projects `results.csv` for the `qa-session` skill |
| `qa-state.test.ts` | `bun run test:agent-tools` (root package.json) | Two testers on one case both survive the merge, verdict rollup ordering, and CSV quoting for dictated notes full of commas and quotes |
| `qa-state-pull.ts` | `bun run qa:pull` (root package.json) / `qa-session` skill close-out | Pulls a QA app session (packages/qa) from its private Blob store into `tmp/qa-session/<slug>/` as `results.csv` + `qa-state.json`. Reads the store directly, so it works while the app is password-protected. Refuses to land on an existing session unless `--force`, since severity and redactions live only in the pulled files, and fails on a malformed shard rather than dropping that tester from a complete-looking sheet. Results stay in gitignored `tmp/` |
| `qa-state-pull.test.ts` | `bun run test:agent-tools` (root package.json) | Proves custom pull destinations cannot escape the repo's gitignored `tmp/` privacy boundary, that a rerun names what it would replace rather than overwriting a worked-on session, and that a malformed or misattributed shard fails the pull |
| `qa-app-parity.test.ts` | `bun run test:agent-tools` (root package.json) | Guards the one duplication the QA app accepts: the merge rules in the deployed function (`packages/qa/api/state.ts`) and the local server (`packages/qa/dev.mjs`) must agree, or a local two-tester run proves something the deployment would not do. Also proves the local server answers 503 on an unreadable request rather than dying on an unhandled rejection |
| `qa-app-store.test.ts` | `bun run test:agent-tools` (root package.json) | Runs two first writers against a deterministic Blob fake and proves create-only retry merges both deltas |
| `qa-app-client.test.ts` | `bun run test:agent-tools` (root package.json) | Executes the shipped inline page in Node-hosted JSDOM and proves field-level saves survive a stale in-flight poll, that a note left unsent when the tab closes is recovered and sent by the next page session, and that a verdict already stored is not resent alongside a later note |
| `qa-app-build.test.ts` | `bun run test:agent-tools` (root package.json) | Guards the QA app's bundler-less page: proves the inline script parses, that its note cap and roster fallback match the API, that every path it fetches is one the local server serves, and that the build ships only active catalog cases |

### `harness/` — skill and planning helpers
| Script | Caller | Purpose |
|---|---|---|
| `plan-hub.mjs` | `plan` skill | Manage `.plans/{ideas,backlog,active,archive}/` queue, lane status, TDD gates, taxonomy summaries, and root-layout validation |
| `plan-hub.test.mjs` | `node --test scripts/harness/plan-hub.test.mjs` | Black-box fixture checks for plan-hub schema, taxonomy, summaries, and TDD proof gates |
| `skill-trigger-eval.mjs` | `bun run eval:skills` (on-demand, not CI) | Routes the fixture queries in `scripts/data/skill-trigger-eval.json` against the live SKILL.md descriptions via a cheap `claude -p` call — catches description-routing regressions after trigger edits |
| `parse-docx-feedback.ts` | `doc-feedback` skill | Parse a Google Doc downloaded as `.docx` into markdown with body + comments + tracked changes |

### `postinstall/`
| Script | Caller | Purpose |
|---|---|---|
| `fix-multiformats.js` | `npm`/`bun` postinstall | Patches `multiformats/basics`, `uint8arrays`, and walletconnect bundles to keep the Node CJS resolver happy in vitest workers; also synchronizes `.bun/react@*` cache slots with the override-pinned root React version |

### `lib/`
- `ipfs-hybrid.ts` — Pinata client helpers used by `ops/ipfs-repin.ts` and `ops/upload-action-images.ts`.
- `dev-shared.js` — shared dev-script helpers, including tool/version probes, Bun-to-Node re-exec with the repo's Node 22 toolchain, and loopback URL probes for local smoke checks.
- `env-schema.mjs` — dotenv/schema parser and profile-required-key helpers used by `dev/env-check.js` and env-parity checks.
- `env-parity.mjs` — Vercel build-time environment-parity and Sentry-DSN assertions used by the client and admin Vite configs.
- `git-guardrails.mjs` — shared Git/base-ref resolution for diff-aware quality and contracts checks, including invalid CI base fallback.

### `data/`
- `validation-policy.json` — versioned check catalog, hard overrides, timing budgets, surface impact, and workflow routing consumed by the shared validation selector.
- `plan-hub-validation-receipt-debt.json` — exact owner- and expiry-bound burn-down baseline for pre-policy terminal lanes missing structured Validation Receipts; consumed by `harness/plan-hub.mjs`.
- `design-token-usage-baseline.tsv` — audited baseline of legacy token references; consumed by `design/check-tokens.sh`.
- `css-custom-property-baseline.tsv` — audited baseline of unresolved legacy CSS custom properties; consumed by `design/check-css-custom-properties.mjs`.
- `ontology-drift-baseline.json` — audited burn-down baseline of known ontology drift (owner/expires/note per entry); consumed by `quality/check-ontology.mjs`.
- `direct-tested-seam-baseline.json` — exact burn-down baseline for legacy tests that do not yet prove their named module seam; consumed by `quality/check-direct-tested-seams.mjs`.
- `module-seam-registry.json` — selected hotspots and certified critical TypeScript/JavaScript seams with export, production composition, consumer, proof, review-date, and deterministic fingerprint evidence; consumed by `quality/check-direct-tested-seams.mjs`.

## Companion locations

- `.claude/scripts/` — Claude harness scripts (skill frontmatter check, codex lane dispatch, agent gates)
- `docs/scripts/` — Docusaurus generators (`docs-audit.mjs`, `generate-protocol-status.mjs`)
- `packages/*/scripts/` — package-local scripts (e.g. `packages/indexer/scripts/`)
- `packages/contracts/script/` — Foundry scripts and their Bun CLIs. Commitment Pooling deploys in four ordered steps, each step's output being the next step's input: `deploy/commitment-schemas.ts` + `DeployCommitmentSchemas.s.sol` **preparation** (CREATE2-deploys the testimony resolver via `lib/TestimonyResolverDeployment.sol`, registers assessment v3, and PINS the community testimony UID while the resolver stays inert), `deploy/release.ts` + `DeployPooling.s.sol` (module + register, deployed paused), `deploy/pooling-configure.ts` + `ConfigurePooling.s.sol` (three resolver calls; without the work-approval bridge the module is inert), and the same `commitment-schemas` target with `--finalize-community-testimony` (**finalization**: registers the exact record, then activates the resolver against the artifact-recorded module as the last action). The ordering is enforced by `lib/CommitmentSchemaRecovery.sol`, a pure classifier over the five recovery states — preparation accepts two, finalization exactly the three ordered ones, everything else fails closed. Shared logic: `utils/pooling-release.ts` (deterministic schema UIDs, grouped upgrade keys, configuration planning, live `owner()` preflight), `lib/PoolingConfiguration.sol` (the re-runnable configure sequence, driven by both the deploy script and the fork rehearsal), and `lib/NetworkSelectors.sol` (the single CCIP selector parser). The release rehearsal is `test/fork/ArbitrumCommitmentPooling.t.sol` on an Arbitrum One fork, not a testnet; callers are the root `contracts:pooling:*` scripts. The settlement lane's transport check is `test/fork/CrossChainSettlementLane.t.sol` via `contracts:settlement:verify-lane` — read-only proof that the Arbitrum One ↔ Celo Mainnet CCIP lane is live, priced, and matches `deployments/networks.json`; no broadcast, no funds

## Adding a new script

A script earns a place here only if it has a durable caller in (1) root `package.json`, (2) a `.github/workflows/*.yml`, (3) `ecosystem.config.cjs`, or (4) a Claude skill or planning harness path. Place it in the bucket that matches its purpose; create a new bucket only if it genuinely doesn't fit any existing one. Add it to the table above in the same PR.

One-shot ops (single-deploy fixes, batch migrations, ad-hoc audits) do not belong here — keep them in `.plans/<feature>/` or delete after use.
