# Harness Hardening Wave 1 Plan

**Feature Slug**: `harness-hardening-wave-1`
**Stage**: `backlog`
**Status**: `BACKLOG`
**Created**: `2026-04-18`
**Last Updated**: `2026-04-18`

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Keep Wave 1 in `.plans/backlog/` | This turn plans and implements the harness surfaces without starting a new active execution hub |
| 2 | Blocking comes from deterministic scripts, not Claude review pass/fail | The repo does not yet trust Claude review action semantics as a required status check |
| 3 | Scope source-structure to owned package source files | This catches real structural debt without creating noise from generated, vendor, or test surfaces |
| 4 | Mark `ui` and `contracts` lanes as `n/a` | Wave 1 is harness work owned by `state_api`; contracts are review scope only |
| 5 | Keep `Telegram trace capture` out of Wave 1 | It is the next follow-on hub after this hardening wave stabilizes |

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| Add deterministic design guardrails | `state_api` | Add blocking workflow that runs `bun run check:design-tokens` and `bun run lint:vocab` on relevant changes | ⏳ |
| Add ratcheted structural check | `state_api` | Ship `bun run check:source-structure`, baseline allowlist ceilings, and blocking CI workflow | ⏳ |
| Split advisory reviewer scopes | `state_api` | Add `contracts-security` and `mutation-reliability` workflows with severe-only prompts | ⏳ |
| Make criticality explicit | `state_api` | Update repo guidance and edit-time warnings for `critical`, `sensitive`, and `routine` classes | ⏳ |
| Harvest weekly harness friction | `state_api` | Add weekly harness-GC prompt, report contract, and cadence docs | ⏳ |
| Prove repo-truth contracts still validate | `qa_pass_1` | Run plan-hub and guidance consistency checks after implementation | ⏳ |
| Prove deterministic checks work on the current baseline | `qa_pass_2` | Run design guardrails and source-structure locally; verify the workflow split is blocking vs advisory by contract | ⏳ |

## Lane Checklists

### UI (`claude/ui/harness-hardening-wave-1`)

- [x] Mark this lane `n/a` in `status.json`
- [ ] Re-open only if Wave 1 scope grows into product UI work

### State / API (`codex/state-api/harness-hardening-wave-1`)

- [ ] Create the backlog hub with real brief/spec/eval content and next-hub sequencing
- [ ] Add `check:source-structure` plus frozen oversized-file ceilings
- [ ] Add blocking `design-guardrails` and `source-structure` workflows
- [ ] Add advisory `contracts-security` and `mutation-reliability` workflows
- [ ] Update `CLAUDE.md`, `.claude/context/values.md`, and `.claude/settings.json`
- [ ] Add weekly harness-GC prompt and cadence docs
- [ ] Write `handoffs/codex-state-api.md`

### Contracts (`codex/contracts/harness-hardening-wave-1`)

- [x] Mark this lane `n/a` in `status.json`
- [ ] Re-open only if Wave 1 grows beyond review-scoping into contract implementation

### QA Pass 1 (`claude/qa-pass-1/harness-hardening-wave-1`)

- [ ] Verify the backlog hub, guidance docs, and automation prompt are aligned
- [ ] Confirm advisory reviewer prompts stay severe-only and diff-scoped by contract
- [ ] Write `handoffs/claude-qa-pass-1.md`

### QA Pass 2 (`codex/qa-pass-2/harness-hardening-wave-1`)

- [ ] Re-run the deterministic checks listed in `eval.md`
- [ ] Confirm the source-structure baseline allows current oversized files but prevents growth
- [ ] Confirm required-vs-advisory workflow intent is encoded in the new workflow files
- [ ] Write `handoffs/codex-qa-pass-2.md`

## Validation

- [ ] `node scripts/plan-hub.mjs validate`
- [ ] `node .claude/scripts/check-guidance-consistency.js`
- [ ] `node scripts/check-codex-consistency.js`
- [ ] `bun run check:design-tokens`
- [ ] `bun run lint:vocab`
- [ ] `bun run check:source-structure`
