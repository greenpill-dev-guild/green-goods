# Developer Experience Proof Pass Plan

**Feature Slug**: `developer-experience-proof-pass`
**Stage**: `archive`
**Status**: `DONE`
**Created**: `2026-04-25`
**Last Updated**: `2026-04-28`

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Delete the stale DevEx implementation plan | Phase 1 tooling and docs are already implemented; the old hub's state was stale. |
| 2 | Keep this follow-up proof-first | The next risk is whether onboarding works outside the original machine, not whether another abstraction is needed. |
| 3 | Web stack before full stack | Client/admin/docs proof avoids Docker/indexer noise and matches the first onboarding success bar. |
| 4 | No package-level env changes | The repo invariant is root `.env` only. |
| 5 | Keep `.env.schema` to developer-owned local config | Workflow-only CI/deploy values and hardcoded service defaults should not inflate local onboarding. |

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| Prove web doctor JSON output in a fresh environment | `state_api` | Step 1 | Proven in local fallback; clean Ubuntu/WSL/devcontainer proof still unrun |
| Prove client/admin/docs web stack startup | `state_api` | Step 2 | Proven in local fallback |
| Prove `dev:smoke:web` checks reachability, not PM2 state alone | `state_api` | Step 3 | Proven with standard smoke |
| Record any docs mismatch or setup blocker | `state_api` | Step 4 | Recorded |
| Decide whether full-stack proof becomes a separate hub | `qa_pass_1` | Step 5 | Intentionally deferred as a separate proof if/when Docker/indexer onboarding becomes the target |

## Implementation Steps

### Step 1: Capture environment and doctor output

- [x] Record OS, Node, Bun, and Docker availability.
- [x] Note whether this is the preferred Ubuntu/WSL/devcontainer proof or the strongest local fallback proof.
- [x] Run `bun run dev:doctor -- --profile web --json`.
- [x] Confirm JSON parses and does not print secret values.

### Step 2: Start the web stack

- [x] Run `bun run dev:web`.
- [x] Confirm client, admin, and docs processes start or record exact blocker output.

### Step 3: Smoke web reachability

- [x] Run `bun run dev:smoke:web`.
- [x] Confirm it checks client/admin/docs HTTP reachability after the doctor gate.

### Step 4: Reconcile docs only if proof finds drift

- [x] Compare observed commands against `docs/docs/builders/getting-started.mdx`.
- [x] Record any mismatch as a small docs/tooling follow-up.

### Step 5: Decide full-stack follow-up

- [x] Decide whether Docker/indexer/full-stack proof should be promoted separately.
- [x] Keep this hub closed if web proof passes and no full-stack proof is needed immediately.

## Proof Notes — 2026-04-27

- Plan review found small executable gaps, not a scope-changing ambiguity: stale `node scripts/plan-hub.mjs validate` references, stale `scripts/dev-doctor.js` / `scripts/dev-smoke-web.js` references, and no explicit local fallback proof note when Ubuntu/WSL/devcontainer is unavailable.
- Proof environment was the strongest local fallback, not the preferred clean Ubuntu/WSL/devcontainer target: macOS Darwin 25.4.0 arm64, shell Node v22.22.1, Bun 1.3.10, Docker CLI unavailable. `bun run dev:doctor` used Bun's Node shim and reported Node v24.3.0.
- `bun run dev:doctor -- --profile web --json` returned parseable JSON and did not print secret values. It failed on local environment state: root `.env` contains stale Storacha keys (`STORACHA_KEY_OP_REF`, `STORACHA_PROOF_OP_REF`, `VITE_STORACHA_GATEWAY`) and 1Password CLI is not signed in for 3 OP refs / bulk loading.
- `bun run dev:web` was blocked inside the workspace sandbox by PM2 log writes to `/Users/afo/.pm2/pm2.log`; the escalated run started docs, admin, and client. Docs compiled and served `http://localhost:3003`; client and admin Vite servers reported ready on ports 3001 and 3002.
- `bun run dev:smoke:web` now runs the real web doctor gate and fails honestly on the same local environment blockers before reachability checks. Supplemental `--skip-doctor` reachability during the running stack proved docs responded; direct probes showed client responded on `https://localhost:3001` and admin responded on the Vite network address, while `https://localhost:3002` timed out in this environment.
- Full-stack Docker/indexer proof should stay deferred or become a separate follow-up only after a clean web-profile proof is available; Docker is not installed in this local fallback environment.

## Completion Notes — 2026-04-27

- The schema cleanup narrowed `.env.schema` to developer-owned local config. PostHog host is a hardcoded US default, PostHog source-map upload secrets stay in deploy/workflow contexts, test URL overrides and `ANVIL_PORT` are no longer schema entries, and `PINATA_JWT_OP_REF` is the only schema-backed Pinata upload OP ref.
- Baseline web development is secrets-light: direct root `.env` values are allowed for personal local-only credentials, and 1Password is reserved for shared team, deploy, upload, and CI secrets.
- Latest local fallback proof passed for the baseline web path: `bun run dev:doctor -- --profile web --json` returned 0 failures, `bun run dev:web` started docs/admin/client/Storybook, and `bun run dev:smoke:web` passed through the normal doctor gate.
- `bun run dev:doctor -- --profile upload --json` still fails honestly when Pinata credentials are unresolved or `op` is unsigned-in. That is upload-only readiness, not a baseline web blocker.
- The preferred clean Ubuntu/WSL/devcontainer proof remains unrun because no clean target was available in this session. That is the remaining proof boundary and should be handled as a fresh-machine verification task.
- Full-stack Docker/indexer proof is intentionally out of scope for this hub and should be promoted separately only when full-stack onboarding is the target.

## Archive Notes — 2026-04-28

- Archived after final validation on `develop`. `bun run dev:doctor -- --profile web --json` passed with 0 failures, `bun run dev:web` started docs/admin/client/Storybook, `bun run dev:smoke:web` passed, and `bun run dev:stop` cleaned PM2 services.
- A pre-existing `node scripts/dev/stack.js full` wrapper process was left untouched because it was not started by this pass.

## Lane Checklists

### UI (`claude/ui/developer-experience-proof-pass`)

- [x] Mark this lane `n/a`.

### State / API (`codex/state-api/developer-experience-proof-pass`)

- [x] Own the proof run and evidence capture.
- [x] Avoid code edits unless a command fails for a repo-owned reason.
- [x] Write `handoffs/codex-state-api.md`.

### Contracts (`codex/contracts/developer-experience-proof-pass`)

- [x] Mark this lane `n/a`.

### QA Pass 1 (`claude/qa-pass-1/developer-experience-proof-pass`)

- [x] Review proof evidence and decide whether the remaining full-stack work should be split.
- [x] Write `handoffs/claude-qa-pass-1.md`.

### QA Pass 2 (`codex/qa-pass-2/developer-experience-proof-pass`)

- [x] Re-run the relevant command or inspect the evidence if the environment is not available.
- [x] Confirm status/history match the proof result.
- [x] Write `handoffs/codex-qa-pass-2.md`.

## Validation

- [x] `bun run dev:doctor -- --profile web --json` — latest run passed with 0 failures, 1 warning, and secret-safe JSON.
- [x] `bun run dev:doctor -- --profile upload --json` — failed as intended on unsigned-in `op` plus unresolved upload credentials.
- [x] `bun run dev:web` — escalated run started docs/admin/client/Storybook.
- [x] `bun run dev:smoke:web` — passed through the normal doctor gate and confirmed browser surface reachability.
- [x] `bun run dev:stop` — stopped PM2 services after validation.
- [x] `node scripts/harness/plan-hub.mjs validate` — passed.
