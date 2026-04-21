# Skills Quick Reference

> Start with one of four verbs. Everything else is routed internally when it is actually needed.

---

## Command Skills (User-Invocable)

| Skill | Invoke With | Use For |
|-------|-------------|---------|
| **plan** | `/plan` | Before a change: shape the work, constrain scope, surface judgment points |
| **debug** | `/debug` | When reality disagrees: reproduce, prove root cause, rank fixes by confidence |
| **review** | `/review` | Before merge: inspect the diff, separate must-fix items from human call-outs |
| **status** | `/status` | Resume and orient: branch state, blockers, continuity, and the next 1-3 moves |
| **clean** | `/clean` | After findings are accepted: dispatch 8 parallel cleanup agents (use `--dry-run`, `--scope`, `--agents`) |

---

## Domain Skills

These are still available, but they are not the default starting points anymore.

| Surface | Role | Notes |
|---------|------|-------|
| architecture | Internal lens inside `plan` or `review` | Use when placement, boundaries, or structural refactors are the real question |
| principles | Internal lens inside `review` | Use when simplicity, coupling, duplication, or reliability clarity need pressure-testing |
| audit | Broader repo-health sweep | Follow-up when `status` or `review` reveals drift beyond a single change |
| ship | Passive finishing flow | Validation and merge readiness when work is actually ready |
| specialty package skills | React, UI, contracts, indexer, data-layer, ops, testing, design, web3, stitch | These load by context; you usually do not choose them manually |

---

## Defaults

If you are unsure where to start:

- planning a change -> `/plan`
- investigating a bug -> `/debug`
- judging a change -> `/review`
- picking up work -> `/status --resume`

Shortcuts that remain useful:

- `/teams` -> `/plan --mode teams`
- `tdd bugfix` -> `/debug --mode tdd_bugfix`
- `cross-package-verify-mode` -> `/review --mode verify_only --scope cross-package`
