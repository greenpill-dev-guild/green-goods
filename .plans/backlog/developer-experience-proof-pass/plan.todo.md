# Developer Experience Proof Pass Plan

**Feature Slug**: `developer-experience-proof-pass`
**Stage**: `backlog`
**Status**: `BACKLOG`
**Created**: `2026-04-25`
**Last Updated**: `2026-04-25`

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Delete the stale DevEx implementation plan | Phase 1 tooling and docs are already implemented; the old hub's state was stale. |
| 2 | Keep this follow-up proof-first | The next risk is whether onboarding works outside the original machine, not whether another abstraction is needed. |
| 3 | Web stack before full stack | Client/admin/docs proof avoids Docker/indexer noise and matches the first onboarding success bar. |
| 4 | No package-level env changes | The repo invariant is root `.env` only. |

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| Prove web doctor JSON output in a fresh environment | `state_api` | Step 1 | ⏳ |
| Prove client/admin/docs web stack startup | `state_api` | Step 2 | ⏳ |
| Prove `dev:smoke:web` checks reachability, not PM2 state alone | `state_api` | Step 3 | ⏳ |
| Record any docs mismatch or setup blocker | `state_api` | Step 4 | ⏳ |
| Decide whether full-stack proof becomes a separate hub | `qa_pass_1` | Step 5 | ⏳ |

## Implementation Steps

### Step 1: Capture environment and doctor output

- [ ] Record OS, Node, Bun, and Docker availability.
- [ ] Run `bun run dev:doctor -- --profile web --json`.
- [ ] Confirm JSON parses and does not print secret values.

### Step 2: Start the web stack

- [ ] Run `bun run dev:web`.
- [ ] Confirm client, admin, and docs processes start or record exact blocker output.

### Step 3: Smoke web reachability

- [ ] Run `bun run dev:smoke:web`.
- [ ] Confirm it checks client/admin/docs HTTP reachability after the doctor gate.

### Step 4: Reconcile docs only if proof finds drift

- [ ] Compare observed commands against `docs/docs/builders/getting-started.mdx`.
- [ ] Record any mismatch as a small docs/tooling follow-up.

### Step 5: Decide full-stack follow-up

- [ ] Decide whether Docker/indexer/full-stack proof should be promoted separately.
- [ ] Keep this hub closed if web proof passes and no full-stack proof is needed immediately.

## Lane Checklists

### UI (`claude/ui/developer-experience-proof-pass`)

- [x] Mark this lane `n/a`.

### State / API (`codex/state-api/developer-experience-proof-pass`)

- [ ] Own the proof run and evidence capture.
- [ ] Avoid code edits unless a command fails for a repo-owned reason.
- [ ] Write `handoffs/codex-state-api.md`.

### Contracts (`codex/contracts/developer-experience-proof-pass`)

- [x] Mark this lane `n/a`.

### QA Pass 1 (`claude/qa-pass-1/developer-experience-proof-pass`)

- [ ] Review proof evidence and decide whether the remaining full-stack work should be split.
- [ ] Write `handoffs/claude-qa-pass-1.md`.

### QA Pass 2 (`codex/qa-pass-2/developer-experience-proof-pass`)

- [ ] Re-run the relevant command or inspect the evidence if the environment is not available.
- [ ] Confirm status/history match the proof result.
- [ ] Write `handoffs/codex-qa-pass-2.md`.

## Validation

- [ ] `bun run dev:doctor -- --profile web --json`
- [ ] `bun run dev:web`
- [ ] `bun run dev:smoke:web`
- [ ] `node scripts/plan-hub.mjs validate`
