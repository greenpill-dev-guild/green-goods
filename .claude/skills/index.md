# Skills Quick Reference

> Start with a command skill when the workflow is explicit, or just describe planning/debugging intent and the passive skills will fire.

---

## Command Skills (User-Invocable)

| Skill | Invoke With | Use For |
|-------|-------------|---------|
| **review** | `/review [package|PR|file]` | Before merge: inspect the diff, separate must-fix items from human call-outs. Positional arg scopes the review (`/review admin`, `/review #123`, `/review packages/shared/...`) |
| **audit-then-ship** | `/audit-then-ship [scope]` | The user's default rhythm: investigate (read-only) → explicit scope-lock gate → fix only locked items → ship pipeline. Use when scope is ambiguous or multi-issue. |
| **status** | `/status` | Resume and orient: branch state, blockers, continuity, and the next 1-3 moves |
| **clean** | `/clean` | After findings are accepted: dispatch 8 parallel cleanup agents (use `--dry-run`, `--scope`, `--agents`) |
| **doc-feedback** | `/doc-feedback [<docx-path>] [--mode in-repo\|out-of-repo]` | Process Google Doc review feedback for any GG doc (`docs/` drafts, research, grant proposals, product feedback) — parses comments + tracked-changes from a `.docx` export, triage gate locks scope, addresses items in-repo (edit repo files) or out-of-repo (write paste-ready `responses.md`); mode auto-inferred from title/filename |

---

## Passive Skills (Intent-Triggered, No Slash)

These fire automatically when the prompt matches. No slash command exposed.

| Skill | Fires On | Use For |
|-------|----------|---------|
| **plan** | "plan this", "break down X", "orchestrate", "coordinate a team", "parallel lanes", "spawn teammates", "mixed codex and claude", cross-package work | Shape work, constrain scope, surface judgment points. Routes to teams mode on orchestration signals, brainstorm on fuzzy intent. |
| **debug** | "debug this", pasted stack traces or errors, reported unexpected behavior, failing tests, "production is down", "hotfix" | Systematic root cause investigation. Routes to incident_hotfix on urgency signals, tdd_bugfix on red-test signals, default on general bug reports. |

---

## Domain Skills

These are still available, but they are not the default starting points anymore.

| Surface | Role | Notes |
|---------|------|-------|
| architecture | Internal lens inside `plan` or `review` | Use when placement, boundaries, or structural refactors are the real question |
| principles | Internal lens inside `review` | Use when simplicity, coupling, duplication, or reliability clarity need pressure-testing |
| audit | Broader repo-health sweep | Follow-up when `status` or `review` reveals drift beyond a single change |
| specialty package skills | React, UI, contracts, indexer, data-layer, ops, testing, design, web3 | These load by context; you usually do not choose them manually |

---

## Defaults

If you are unsure where to start:

- planning a change -> just describe the intent ("plan this", "break down X")
- orchestrating a multi-lane build -> describe orchestration intent ("coordinate a team across contracts + shared + admin")
- investigating a bug -> describe the bug or paste the error (no slash)
- judging a change -> `/review [package|PR|file]` (or describe it in words)
- picking up work -> `/status --resume`

Shortcuts that remain useful:

- `/review admin` -> scope review to the admin package
- `/review --mode verify_only --scope cross-package` -> cross-package impact pass
- `/review design-system` (or `/review --mode verify_only --scope design-system`) -> full-repo design-system alignment review (DesignMD + tokens + Storybook + admin/client/docs). Read-only; delegates to `.claude/skills/design/system-alignment-review.md`
- "this test is failing:" -> routes debug to tdd_bugfix mode
- "production is down" / "incident" / "hotfix" -> routes debug to incident_hotfix mode
