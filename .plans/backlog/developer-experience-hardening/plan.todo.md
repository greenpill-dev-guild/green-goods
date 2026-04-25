# Developer Experience Hardening Plan

**Feature Slug**: `developer-experience-hardening`
**Stage**: `backlog`
**Status**: `BACKLOG`
**Created**: `2026-04-23`
**Last Updated**: `2026-04-23`

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Keep this as one backlog hub | DevEx spans setup, docs, scripts, and validation; one hub keeps the staged program coherent |
| 2 | Target 30-minute web start first | Client/admin/docs onboarding is the fastest useful proof before full-stack Docker/indexer work |
| 3 | Native Windows stays out of scope | The supported Windows path is WSL2 or devcontainer until scripts receive a native Windows pass |
| 4 | `state_api` owns implementation | This is tooling/docs work, not product UI or contracts work |
| 5 | Use staged confidence | Linux container proof and full-stack Docker proof come after local web onboarding is stable |

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| Create backlog hub | `state_api` | Add real brief/spec/plan/eval/status content under `.plans/backlog/developer-experience-hardening/` | ✅ |
| Profile-aware doctor | `state_api` | Add `--profile web|full|contracts|upload` and profile-specific required checks | ✅ |
| Machine-readable doctor | `state_api` | Add `--json` output with profile, results, failure count, warning count, and readiness summary | ✅ |
| Web smoke command | `state_api` | Add `bun run dev:smoke:web` to verify doctor readiness and client/admin/docs reachability | ✅ |
| Developer rhythm docs | `state_api` | Update README and builder docs with first clone, doctor, web stack, focused tests, agent guidance, and full-stack escalation | ✅ |
| Linux container proof plan | `qa_pass_1` | Verify the eval describes Ubuntu-based proof without requiring it before Phase 1 | ✅ planned |
| Full-stack follow-up | `qa_pass_2` | Confirm Docker/indexer proof remains Phase 3 and does not block first web-start success | ✅ planned |

## Lane Checklists

### UI (`claude/ui/developer-experience-hardening`)

- [x] Mark this lane `n/a` in `status.json`
- [ ] Re-open only if the work expands into product UI

### State / API (`codex/state-api/developer-experience-hardening`)

- [x] Fill the backlog hub with execution-ready content
- [x] Add doctor profiles and JSON output
- [x] Add web smoke script and package command
- [x] Update onboarding and agentic docs for the developer rhythm
- [x] Run plan-hub and guidance validation
- [ ] Write `handoffs/codex-state-api.md` only if/when this backlog item is promoted to active implementation

### Contracts (`codex/contracts/developer-experience-hardening`)

- [x] Mark this lane `n/a` in `status.json`
- [ ] Re-open only if DevEx work reaches Solidity, deploy, or contract test surfaces

### QA Pass 1 (`claude/qa-pass-1/developer-experience-hardening`)

- [ ] Review docs from a new-developer perspective
- [ ] Confirm command names and flow are understandable without prior repo context
- [ ] Confirm first success bar is web-stack start, not full-stack completion
- [ ] Write `handoffs/claude-qa-pass-1.md`

### QA Pass 2 (`codex/qa-pass-2/developer-experience-hardening`)

- [ ] Re-run targeted validation from `eval.md`
- [ ] Confirm `dev:doctor -- --json` is parseable and does not leak secret values
- [ ] Confirm `dev:smoke:web` checks real reachability, not only PM2 state
- [ ] Write `handoffs/codex-qa-pass-2.md`

## Validation

- [x] `node scripts/plan-hub.mjs validate`
- [x] `node --check scripts/dev-doctor.js`
- [x] `node --check scripts/dev-smoke-web.js`
- [x] `bun run dev:doctor -- --profile web --json` (expected local failure: stale Storacha env keys and unsigned `op`)
- [x] `bun run dev:smoke:web` (expected local failure: blocked by web doctor before port probing)
- [x] `bun run check:codex-guidance`
- [x] `bun run check:claude-guidance`
- [x] `bun run docs:audit:readme`
- [x] `node scripts/ci-local.js --quick` (failed only on unrelated admin story formatting drift; shared/client/admin/agent tests passed)
