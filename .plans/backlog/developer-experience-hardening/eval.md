# Developer Experience Hardening Evaluation Plan

## Release Gates

1. Correctness: doctor profiles and web smoke checks identify actual startup blockers without mutating repo state or printing secrets.
2. Usability: docs describe a 30-minute web-stack path and clearly separate web, upload, contracts, and full-stack readiness.
3. Regression safety: plan hub, guidance checks, docs audit, script syntax checks, and targeted smoke commands all run cleanly except documented unrelated repo drift.

## Acceptance Checks

| ID | Check | Owner | Evidence |
|---|---|---|---|
| AC-1 | `status.json` is valid backlog truth with `ui` and `contracts` marked `n/a` | `state_api` | `node scripts/plan-hub.mjs validate` |
| AC-2 | `bun run dev:doctor -- --profile web --json` emits parseable JSON and profile-aware failures | `state_api` | JSON smoke plus manual inspection |
| AC-3 | `bun run dev:smoke:web` verifies client/admin/docs reachability, not PM2 status alone | `state_api` | Local or container smoke log |
| AC-4 | README/getting-started docs explain first clone, doctor, web stack, focused tests, and full-stack escalation | `qa_pass_1` | Docs review notes |
| AC-5 | Ubuntu container/web proof is documented and can run without secrets | `qa_pass_2` | Container command/log or follow-up report |

## Test Strategy

- Unit: script syntax checks with `node --check`; JSON output parsed by Node.
- Integration: `bun run dev:doctor -- --profile web --json` and `bun run dev:smoke:web`.
- E2E / Playwright: not required for Phase 1; use `bun run test:e2e:smoke` after web stack is stable.
- Manual checks: first-clone flow on macOS/Linux/WSL2 or devcontainer; record blocked prerequisites in `reports/`.

## Container Proof Target

Use an Ubuntu-based container or CI runner with:

- Node.js 22
- Bun 1.x
- Git
- generated `.env` from `.env.schema`
- `SKIP_MKCERT=true`
- no secrets and no 1Password dependency

The container proof should run setup/doctor/web-smoke for client/admin/docs only. Docker-in-Docker and indexer checks are Phase 3 follow-up work.

## QA Sequence

### Claude QA Pass 1

- Review the onboarding flow as if joining the repo for the first time.
- Check docs for unclear sequencing, hidden prerequisites, or old command drift.
- If blocked, record the blocker in `handoffs/claude-qa-pass-1.md`.

### Codex QA Pass 2

- Start only after `qa_pass_1` is passed.
- Confirm the trigger branch exists: `claude/qa-pass-1/developer-experience-hardening`.
- Re-run targeted script and plan-hub validation and close the loop on remaining defects.
