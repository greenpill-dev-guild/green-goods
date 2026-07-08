# Skills Quick Reference

> Start with a command skill when the workflow is explicit, or just describe planning/debugging intent and the passive skills will fire.

---

## Which skill? (decision tree)

```text
What is the intent?
│
├─ Picking up / orienting ──────────────→ /status  (--resume on a work branch)
│
├─ A bug, error, or failing test is being described
│     └→ debug fires PASSIVELY (no slash) — reproduce first, then root-cause.
│        "production down"/"hotfix" → incident mode · pasted red test → tdd mode
│
├─ Judging a specific diff / PR / package ──→ /review [scope]
│
├─ Scope is ambiguous or multi-issue ("audit X then fix what matters")
│     └→ /audit-then-ship — explicit + gated: read-only findings →
│        user locks scope → fix only locked items → ship
│
├─ "Is our guidance/plans/docs/design stale?" ──→ /drift check [scope]
│
├─ Accepted cleanup at scale ──────────────→ /clean  (only after /drift or
│                                             /audit-then-ship proves it)
├─ Shaping / breaking down / orchestrating work
│     └→ describe the intent in words — plan fires passively
│
└─ Prove the branch is ready to merge ─────→ ship (fires via /audit-then-ship
                                              Phase 4, or ask explicitly)
```

**Precedence — `debug` vs `audit-then-ship`:** `debug` is passive and immediate — it fires
as soon as a bug is described, even mid-conversation, and owns reproduction + root cause.
`audit-then-ship` never self-triggers — it is explicit and scope-gated. When both could apply
(a bug report inside a broader "audit this area" ask), let `debug` reproduce the concrete
failure first; graduate to `/audit-then-ship` when the user wants a scoped multi-issue fix
pass. The two do not run concurrently on the same surface.

---

## Command Skills (User-Invocable)

| Skill | Invoke With | Use For |
|-------|-------------|---------|
| **review** | `/review [package|PR|file]` | Before merge: inspect the diff, separate must-fix items from human call-outs. Positional arg scopes the review (`/review admin`, `/review #123`, `/review packages/shared/...`) |
| **drift** | `/drift [check|clean] [scope]` | Read-only drift classifier for guidance, plans, design, docs, cleanup readiness, and quality guardrails. Routes findings to the right skill; gates `/clean` behind dry-run approval. |
| **audit-then-ship** | `/audit-then-ship [scope]` | The user's default rhythm: investigate (read-only) → explicit scope-lock gate → fix only locked items → ship pipeline. Use when scope is ambiguous or multi-issue. |
| **status** | `/status` | Resume and orient: branch state, blockers, continuity, and the next 1-3 moves |
| **clean** | `/clean` | After findings are accepted: dispatch 8 parallel cleanup agents (use `--dry-run`, `--scope`, `--agents`) |
| **doc-feedback** | `/doc-feedback [<docx-path>] [--mode in-repo\|out-of-repo]` | Process Google Doc review feedback for any GG doc (`docs/` drafts, research, grant proposals, product feedback) — parses comments + tracked-changes from a `.docx` export, triage gate locks scope, addresses items in-repo (edit repo files) or out-of-repo (write paste-ready `responses.md`); mode auto-inferred from title/filename |
| **qa-triage** | `/qa-triage [notes-path\|slug\|qa-sync:YYYY-MM-DD] [--dry-run] [--no-codex] [--no-sheet] [--fixture]` | Process Build Sync QA notes into triaged Linear records and QA-sheet rows. Pulls notes from Drive or Downloads, cross-references PostHog/Linear/Sheet state, scope-locks filing decisions, then writes Customer Needs + Issues and appends Defects rows. |

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

## Linear Awareness

Linear is the durable backlog (see `CLAUDE.md` § Linear Workspace). Skills that interact with Linear:

- **status, review, ship** — read Linear context when the branch matches `<user>/<team-key>-<id>-<slug>` (e.g., `afo/prd-370-...`). They do not write.
- **audit, principles, architecture, clean, debug, drift, plan** — route accepted findings to Linear Issues with the user's explicit OK. They prompt before writing; they never auto-write.
- All other skills — Linear-agnostic.

Privacy boundary applies on every Linear write: replay URLs, session IDs, distinct IDs, wallet addresses, and reporter identifiers stay out of Linear bodies.

---

## Defaults

If you are unsure where to start:

- planning a change -> just describe the intent ("plan this", "break down X")
- orchestrating a multi-lane build -> describe orchestration intent ("coordinate a team across contracts + shared + admin")
- investigating a bug -> describe the bug or paste the error (no slash)
- checking repo drift -> `/drift check [scope]`
- judging a change -> `/review [package|PR|file]` (or describe it in words)
- picking up work -> `/status --resume`

Shortcuts that remain useful:

- `/review admin` -> scope review to the admin package
- `/review --mode verify_only --scope cross-package` -> cross-package impact pass
- `/review design-system` (or `/review --mode verify_only --scope design-system`) -> full-repo design-system alignment review (DesignMD + tokens + Storybook + admin/client/docs). Read-only; delegates to `.claude/skills/design/system-alignment-review.md`
- "this test is failing:" -> routes debug to tdd_bugfix mode
- "production is down" / "incident" / "hotfix" -> routes debug to incident_hotfix mode
