# Software Fundamentals Hardening Plan

**Feature Slug**: `software-fundamentals-hardening`
**Stage**: `backlog`
**Status**: `BACKLOG`
**Created**: `2026-05-01`
**Last Updated**: `2026-05-01`

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Save the audit as a backlog hub | The audit is actionable, but no implementation lane has been explicitly activated yet |
| 2 | Keep contracts `n/a` | The findings are agentic flow, planning, source structure, shared hooks, admin/client UI structure, and agent API internals |
| 3 | Treat guidance and plan command drift as the first hardening slice | Agents must trust repo truth before deeper refactors can be executed cleanly |
| 4 | Treat source-structure work as a ratchet reconciliation, not cap inflation | The point is to reduce entropy, not mark every large stable file as acceptable |
| 5 | Require test-first boundary evidence for large behavior changes | The audit found tests around surfaces, but not always around the main behavior boundary |
| 6 | Keep Contracts behavior out of scope while repairing Contracts guidance drift | The package guide references removed resolver files; fixing that is repo-truth work, not Solidity work |
| 7 | Preserve ADR-008's fat-barrel decision while tightening the public API policy | The shared barrel is intentional, but current scale needs clearer review and subpath rules |
| 8 | Add dead-code audit reliability as a first-class feedback loop | Repeated cleanup requires Knip/file-level checks that do not fail before analysis on Varlock/1Password setup |
| 9 | Compare Knip and Fallow before choosing the recurring static-analysis tool | The transcript points to Fallow's broader dead-code/dupes/health/audit surface, but Green Goods already has Knip evidence and false-positive lessons |

## Research / Plan Gate

- [x] Record research evidence in `spec.md`
- [x] Identify the existing repo pattern to mirror: foldered `.plans/backlog/<slug>/` feature hub
- [x] List human judgment points before implementation
- [x] Define what is out of scope
- [x] Choose the lightest honest validation commands
- [ ] Human scope lock before implementing any lane

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| Repair guidance validation | `state_api` | Fix `check:claude-guidance` failures and confirm `check:codex-guidance` remains current | ⏳ |
| Repair plan command drift | `state_api` | Replace stale `node scripts/plan-hub.mjs` references or add durable package scripts | ⏳ |
| Repair contracts guidance drift | `state_api` | Update package guidance and stale comments that mention removed `GreenGoodsResolver` architecture | ⏳ |
| Tighten shared public API policy | `state_api` | Refresh ADR-008 and `packages/shared/AGENTS.md` around root barrel, subpath exports, and public-symbol review | ⏳ |
| Review Knip vs Fallow | `state_api` | Run both tools on the same baseline, compare signal quality, and record a recommendation before adding gates | ⏳ |
| Make dead-code audit runnable | `state_api` | Implement the chosen env-safe dead-code command so file-level audit does not import Varlock-backed Vite configs | ⏳ |
| Reconcile source-structure baseline | `state_api` | Audit stable oversized files, stale allowlist entries, and CI/local gate placement | ⏳ |
| Add test-first boundary policy | `state_api` | Update plan/handoff expectations so large behavior work records RED evidence or explicit proof limits | ⏳ |
| Harden Campaign Cookie Jar module boundaries | `state_api`, `ui` | Add controller/service boundary tests, then thin shared hook and admin/client surfaces | ⏳ |
| Harden agent API server internals | `state_api` | Split route/security/upload/funding/webhook internals behind existing `createServer` | ⏳ |
| Classify stale admin surfaces | `ui`, `state_api` | Delete, mark story-only, or adopt stale admin views/primitives/shims with explicit rationale | ⏳ |
| Verify repo truth after each slice | `qa_pass_1`, `qa_pass_2` | Run targeted validation and record proof in handoffs | ⏳ |

## Proposed Execution Slices

### Slice 1: Repo-Truth Repair

- Fix `node .claude/scripts/check-skill-frontmatter.js` failures.
- Correct stale `.plans` command references or introduce package scripts that hide raw paths.
- Update `packages/contracts/AGENTS.md` so the resolver/module map names the current files and tests instead of `GreenGoodsResolver`.
- Clean up stale contract source comments that refer to the removed central resolver if they are documentation-only.
- Validate with `node scripts/harness/plan-hub.mjs validate`, `bun run check:claude-guidance`, `bun run check:codex-guidance`, and `rg "GreenGoodsResolver|src/resolvers/GreenGoods|GreenGoods\\.sol" packages/contracts/AGENTS.md packages/contracts/src packages/contracts/test`.

### Slice 2: Shared API Policy And Dead-Code Audit

- Refresh `.plans/adr/ADR-008-barrel-exports.md` with the current barrel size, accepted tradeoff, and when app packages may use documented subpath exports.
- Add the same practical rule to `packages/shared/AGENTS.md`: app packages default to `@green-goods/shared`; internal `src` deep imports stay banned; new public exports require explicit barrel review.
- Run the Knip vs Fallow evaluation before changing package scripts:
  - `bunx knip --include files --reporter compact`
  - `bunx knip --reporter compact`
  - `bunx fallow dead-code --format json`
  - `bunx fallow dupes --mode mild --format json`
  - `bunx fallow health --targets --format json`
  - `bunx fallow audit --base origin/develop --format json`
- If network or package resolution blocks Fallow, record that as an evaluation blocker instead of adopting from docs alone.
- Capture results in `reports/knip-vs-fallow-evaluation.md`, including false positives, true positives, runtime, secret-manager coupling, and whether output is usable by agents.
- Choose one outcome:
  - keep Knip as dead-code source and add Fallow only for duplication/health/advisory audit
  - replace Knip with Fallow for recurring static analysis
  - defer both as gates and keep manual `.plans/clean` triage until config reliability improves
- Implement only the chosen env-safe command as `bun run check:dead-code` or `bun run check:static-health` after the report is reviewed.
- Treat tool output as triage evidence first; do not delete files or enforce a gate until false positives are classified.

### Slice 3: Source-Structure Ratchet Reconciliation

- Produce a current stable baseline report for oversized committed files.
- Remove stale allowlist paths that no longer exist.
- Decide which files are accepted temporary debt and which get child cleanup tasks.
- Confirm whether `bun run check:source-structure` belongs in CI, drift-watch, or both.

### Slice 4: Test-First Boundary Policy

- Add a plan/handoff checklist item for large behavior changes: RED test evidence, interface-level test target, or explicit proof limit.
- Prefer domain/controller/service tests before broad UI/hook implementation.
- Keep this as agent guidance unless the human explicitly asks for stricter automation.

### Slice 5: Campaign Cookie Jar Boundary Hardening

- Add tests around campaign-cookie-jar read-model and mutation-service boundaries before moving code.
- Extract pure read-model helpers from `useCampaignCookieJar.ts` for contract descriptor construction and multicall-result mapping.
- Cover unknown enum fallbacks, owner/user fields, token metadata defaults, partial read failures, non-canonical create hashes, approve-before-deposit, invalidation, and sync/update metadata behavior.
- Keep shared hooks thin: reads, mutations, invalidation, and UI state should not all live in one hook file.
- Split admin create/sync UI under `packages/admin/src/views/Cookies/components/` without changing product behavior unless separately approved.
- Preserve existing client public Cookie behavior; public UI changes are verification scope, not redesign scope.

### Slice 6: Agent API Server Internal Split

- Preserve `createServer` as the public interface.
- Extract public API validation, upload signing, funding intents, webhook handling, and transaction confirmation into route/service modules.
- Keep existing agent tests green after each extraction.

### Slice 7: Stale Surface Cleanup

- Classify `AdminBadge`, `AdminFab`, and `AdminListItem` as runtime-needed, story-only, or deletable.
- Remove or archive unrouted retired admin views if no current docs/tests rely on them.
- Replace or delete deprecated admin-route shims once consumers are confirmed absent.

## Lane Checklists

### UI (`claude/ui/software-fundamentals-hardening`)

- [ ] Classify stale admin primitives and retired views with concrete source references
- [ ] Review admin/client decomposition proposals for Campaign Cookie Jar before implementation
- [ ] Confirm any UI-touching changes preserve current behavior and i18n
- [ ] Write `handoffs/claude-ui.md`

### State / API (`codex/state-api/software-fundamentals-hardening`)

- [ ] Fix guidance validation failures
- [ ] Fix or abstract stale plan-hub command references
- [ ] Update contracts package guidance and stale resolver vocabulary without touching Solidity behavior
- [ ] Refresh ADR-008 and shared package API guidance
- [ ] Compare Knip and Fallow on the same baseline and write the recommendation report
- [ ] Make the chosen file-level dead-code audit runnable without Varlock-backed Vite config imports
- [ ] Reconcile source-structure baseline and stale allowlist entries
- [ ] Add test-first boundary expectations to the correct planning/handoff surface
- [ ] Implement Campaign Cookie Jar controller/service tests before code movement
- [ ] Split Campaign Cookie Jar shared hook internals behind the new boundary
- [ ] Split agent API server internals behind `createServer`
- [ ] Write `handoffs/codex-state-api.md`

### Contracts (`codex/contracts/software-fundamentals-hardening`)

- [x] Mark this lane `n/a` in `status.json`
- [ ] Re-open only if a later child hub explicitly touches Solidity or deployment paths

### QA Pass 1 (`claude/qa-pass-1/software-fundamentals-hardening`)

- [ ] Verify guidance docs, plan docs, and UI classification stay aligned
- [ ] Confirm Campaign Cookie Jar behavior remains unchanged if only internals move
- [ ] Record UX or docs drift separately from implementation blockers
- [ ] Write `handoffs/claude-qa-pass-1.md`

### QA Pass 2 (`codex/qa-pass-2/software-fundamentals-hardening`)

- [ ] Re-run plan/guidance/source-structure checks
- [ ] Re-run targeted tests for shared hook/controller, admin/client surfaces, and agent API extracts
- [ ] Confirm proof limits and remaining debt are written back into the hub
- [ ] Write `handoffs/codex-qa-pass-2.md`

## Validation

- [ ] `node scripts/harness/plan-hub.mjs validate`
- [ ] `bun run check:claude-guidance`
- [ ] `bun run check:codex-guidance`
- [ ] `rg "GreenGoodsResolver|src/resolvers/GreenGoods|GreenGoods\\.sol" packages/contracts/AGENTS.md packages/contracts/src packages/contracts/test`
- [ ] `reports/knip-vs-fallow-evaluation.md` updated with same-baseline comparison and recommendation
- [ ] `bun run check:dead-code`
- [ ] `bun run check:source-structure`
- [ ] Targeted `bun run test -- <file>` commands for touched package surfaces
- [ ] `bash scripts/quality/check-test-quality.sh` when adding or changing tests
- [ ] `bun run format:check && bun lint` before merge
