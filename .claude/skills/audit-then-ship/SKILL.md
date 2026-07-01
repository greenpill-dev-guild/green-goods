---
name: audit-then-ship
user-invocable: true
description: Two-phase scope-locked workflow — investigate (read-only) → user-approved scope lock → fix only locked items → ship pipeline. Codifies the audit-then-ship rhythm so scope creep and unverified claims fail loud.
argument-hint: "[scope] [--lens=audit|review|principles|architecture|design] [--no-ship]"
context: default
effort: high
version: "1.0.0"
status: active
packages: ["all"]
dependencies: ["audit", "review", "principles", "architecture", "ship"]
last_updated: "2026-04-25"
last_verified: "2026-04-25"
---

# Audit-Then-Ship Skill

The codified version of how the user actually works: investigate first, get explicit approval on what to fix, fix only that, ship with evidence. This skill exists because the freeform version drifts — audits balloon, fixes leak into adjacent code, and "done" gets claimed without the ship pipeline running.

**Core contract**: each phase has a hard gate. Do not advance past a gate without the gate's specific output.

---

## Activation

| Trigger | Action |
|---------|--------|
| `/audit-then-ship` | Full three-phase run, lens auto-picked from scope |
| `/audit-then-ship admin` | Scope to admin package |
| `/audit-then-ship --lens=principles` | Force a specific investigation lens |
| `/audit-then-ship --no-ship` | Stop after fixes, skip the ship pipeline (rare; prefer the default) |
| "audit X then fix Y" / "review X and apply" | Passive trigger |

Do not activate this skill for concrete QA-mode fixes such as "quick fix",
"get this to staging", or "fix this while I QA" unless the user explicitly asks
for an audit/review phase or final ship gate. For those, use the repo's QA Speed
Mode: focused fix, targeted proof, and coordinator checkpoint validation.

---

## Phase 1 — Investigate (read-only)

Pick the right lens for the scope. **Do not edit any files in this phase.**

| Scope signal | Lens | Skill |
|--------------|------|-------|
| Diff, branch, PR, single feature | review | `.claude/skills/review/SKILL.md` |
| Repo health, dead code, drift | audit | `.claude/skills/audit/SKILL.md` |
| Design soundness, coupling, duplication | principles | `.claude/skills/principles/SKILL.md` |
| Placement, boundaries, structural refactor | architecture | `.claude/skills/architecture/SKILL.md` |
| Tokens, vocab, surface compliance | design | `.claude/skills/design/review-checklist.md` |

Run the chosen lens read-only. Produce a **numbered findings list** in this exact shape — nothing else:

```markdown
## Findings — <scope> · <lens>

1. [SEVERITY] <one-line description> — `path/to/file.ts:LINE`
   Why it matters: <1 sentence>
   Proposed fix: <1 sentence>

2. ...
```

**Hard gate at end of Phase 1**: stop. Do not start fixing. Do not write `session-state.md`. Do not open files for edit.

---

## Phase 2 — Scope Lock (REQUIRED USER GATE)

Present the findings. Ask exactly:

> Which findings should I fix? Reply with numbers (e.g., `1, 3, 5`), `all`, or `none`. Anything outside the listed numbers is out of scope for this run.

**The user's reply is the contract.** Record it explicitly:

```markdown
## Scope Lock
- Approved fixes: [1, 3, 5]
- Out of scope: [2, 4, 6, 7]
- Anything discovered mid-fix that is not in this list → flag in the final report under "Out of Scope — For Later", do not act on it.
```

Hard rules:
- If the user replies with anything other than the prescribed format ("yeah just go", "do what makes sense"), re-ask once with the same prompt. Ambiguity at this gate is the entire failure mode this skill exists to prevent.
- If the user explicitly authorizes "use your judgment", treat that as `all` of severity ≥ HIGH and re-confirm: "I'll fix all 3 HIGH+ findings: 1, 3, 5. Out of scope: 2, 4."
- Do not advance past this gate without a recorded scope lock.

---

## Phase 3 — Implement (locked scope only)

Apply only the approved fixes, in order. For each:

1. Make the edit.
2. **Verify the change in the same turn**: re-read the file, run the targeted test, or read the rendered DOM through the authenticated Brave QA profile for UI changes. No "should work" claims. (See CLAUDE.md → *Verify Before Claiming Success*.)
3. Move to the next.

**If you discover a new issue mid-fix**:
- It goes into "Out of Scope — For Later" at the end of the report.
- It does **not** get fixed in this run, even if it's a one-line change.
- Exception: if the new issue actively blocks an approved fix from working (e.g., a broken import on the same line), fix it inline and call it out in the report under "Inline Blockers Resolved".

---

## Phase 4 — Ship (default; skip with `--no-ship`)

Hand off to the `ship` skill (`.claude/skills/ship/SKILL.md`). Run the full pipeline:

```bash
bun format && bun lint && bun run test && bun build
```

Plus scope-conditional checks (design tokens, vocab lint, contracts fork) per `ship` Step 6.

**Do not declare done until the ship pipeline reports green with output you can paste.** If any stage fails, the run is incomplete — return to Phase 3 to address the failure (still inside the locked scope, unless the failure surfaces a new issue, in which case re-open Phase 2 with the new finding).

If the user's approved scope is explicitly a QA-speed handoff rather than
ship/PR/merge readiness, stop after Phase 3 with targeted evidence and label the
Ship Pipeline as "not run - QA Speed Mode". Do not claim the branch is ready to
ship in that report.

---

## Final Report

Always produce this, regardless of `--no-ship`:

```markdown
## Audit-Then-Ship Report — <scope> · <lens>

### Locked Scope
- Approved: [1, 3, 5]

### Applied
| # | Finding | File:Line | Verification |
|---|---------|-----------|--------------|
| 1 | ... | ... | test passed / DOM read / file re-read |
| 3 | ... | ... | ... |
| 5 | ... | ... | ... |

### Inline Blockers Resolved (if any)
- ...

### Ship Pipeline
| Stage | Status | Detail |
|-------|--------|--------|
| Format | PASS | 0 modified |
| Lint | PASS | 0 errors |
| Tests | PASS | N/N |
| Build | PASS | all packages |

### Out of Scope — For Later
- [2] <finding> · `path:line` — flagged but not fixed (not in locked scope)
- [new] <discovered mid-fix> · `path:line` — flagged but not fixed
```

---

## Anti-Patterns

| Don't | Why |
|-------|-----|
| Skip Phase 2 ("user obviously wants all of them") | The whole point of this skill is the explicit gate — without it, scope creeps |
| Fix anything outside the locked scope, even one-liners | Inline blockers are the only exception, and they get called out |
| Claim "done" before the ship pipeline runs | Violates the iron law from `ship` |
| Declare a fix verified without paste-able evidence | Violates *Verify Before Claiming Success* in CLAUDE.md |
| Reword the Phase 2 prompt | The exact prompt is the contract; ambiguity here is the failure mode |
| Reuse a stale Phase 1 report from a previous session | Code drifts; each run starts fresh |
| Open the editor between Phase 1 and Phase 2 | Read-only means read-only |
| Convert "fix all HIGH+" into "fix everything you noticed" | The lock is the lock |
| Fix design-level problems via this skill | If the lens revealed design rot, hand off to `principles` or `architecture` for a separate run |

---

## When NOT to Use This Skill

- Single-file edits the user described concretely ("rename this to X", "add a `loading` prop") — just do them
- Bug reports with a known fix path — use `debug` skill, not this one
- Greenfield work — there's nothing to audit; use `plan`
- Doc-only edits — overhead exceeds benefit

The skill earns its keep on **multi-issue, ambiguous-scope, cross-file work** — exactly the cases where freeform sessions drift.

---

## Related Skills

- `audit` — read-only repo-health lens used in Phase 1
- `review` — diff-scoped lens used in Phase 1
- `principles` — design-soundness lens used in Phase 1
- `architecture` — placement/boundaries lens used in Phase 1
- `ship` — Phase 4 delegate; this skill does not duplicate its pipeline
- `plan` — for greenfield work where there's nothing yet to audit

---

## Key Principles

- **Two-phase rhythm** — investigation and action are separated by an explicit gate
- **The scope lock is a contract** — recorded, referenced, and respected to the end
- **Verify in the same turn** — no claims without evidence
- **Out-of-scope findings still get reported** — but not fixed in this run
- **Ship is non-optional by default** — green pipeline with paste-able output, or it's not done
