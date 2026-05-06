---
name: plan/brainstorm
description: Pre-plan exploration when requirements are fuzzy — turns a vague idea into an approved design before any plan steps are written
---

# Brainstorm Before Plan

Turn ideas into designs through collaborative dialogue before committing to a plan. Fires when requirements are too fuzzy to start planning directly.

## When to brainstorm

Brainstorm first when any of the following are true:

- The user's request has no clear "done when" criteria
- Multiple plausible approaches exist and the tradeoffs haven't been discussed
- The request spans 3+ packages and scope isn't bounded
- The user says "what do you think?" / "how should we approach this?" / "let's figure out..."
- Scope feels like a platform rather than a feature ("build a dashboard with charts, filters, and export")

**Skip brainstorming when** the request is single-file, a clear bug report, a config change, or an execution of an already-approved plan.

## Hard gate

Do NOT write a plan, scaffold files, or edit code until:
1. The design has been presented and explicitly approved by the user
2. A brief has been written to `.plans/ideas/<feature-slug>/brief.md`
3. The user has reviewed the brief

This applies regardless of perceived simplicity. "Simple" projects are where unexamined assumptions cause the most wasted work.

## Process

```
Explore context → Ask clarifiers one at a time → Propose 2-3 approaches
  → Present design in sections → User approves → Write brief → User reviews brief
  → Move to planning to create implementation plan
```

### 1. Explore project context (before asking anything)

- Read relevant files in the affected packages
- Check recent commits touching the area
- Check for existing plans in `.plans/active/` that overlap
- Read `CLAUDE.md` + package context files (`.claude/context/*.md`)

Don't ask the user about things the code or docs already answer.

### 2. Scope assessment (do this before clarifiers)

If the request describes multiple independent subsystems, flag it immediately. Don't spend clarifiers refining a project that needs to be decomposed first.

> "This sounds like 3 independent features: A, B, C. Let's decompose before diving in — which one do you want to brainstorm first?"

Each sub-feature gets its own brief → plan → implementation cycle.

### 3. Clarifying questions (one at a time)

Focus on: purpose, constraints, success criteria.

**Rules:**
- One question per message. No stacking.
- Prefer multiple choice when the option space is small. Open-ended is fine when it isn't.
- Don't ask about things the code already answers.

**Good questions:**
- "For the garden creation flow — should draft state persist across sessions, or only within the same tab? (a) cross-session via IndexedDB, (b) tab-only via sessionStorage, (c) no persistence"
- "Is this offline-capable from day one, or are we shipping online-only and adding offline later?"

**Bad questions:**
- "What tech should we use?" (too open; we already know the stack)
- "Anything else to consider?" (fishing)

### 4. Propose 2-3 approaches

Once you understand intent, propose 2-3 approaches with tradeoffs and a recommendation.

```markdown
**Approach A** — [one-line summary]
Pros: ...
Cons: ...

**Approach B** — [one-line summary]
Pros: ...
Cons: ...

**Recommendation:** A, because [reason tied to Green Goods intent priorities: offline correctness → security → UX → DX → elegance].
```

### 5. Present design in sections

Scale each section to its complexity. A few sentences for straightforward parts; up to ~250 words for nuanced ones. Ask after each section whether it looks right before continuing.

Cover:
- **Architecture** — where code lives (which packages, which modules)
- **Components / entities** — what gets created, what gets modified
- **Data flow** — mutations, queries, onchain calls, indexer entities
- **Error handling** — what fails, how we surface it
- **Offline behavior** — what works without network (per CLAUDE.md intent priority 1)
- **Test strategy** — what to unit/integration/e2e test
- **Breaking changes / migrations** — if any

### 6. Write brief and get user review

Save the validated design to `.plans/ideas/<feature-slug>/brief.md` with this structure:

```markdown
# <Feature Name> Brief

**Status**: IDEA
**Created**: YYYY-MM-DD

## Problem
What need does this serve? Which user journey?

## Approach
Chosen approach from brainstorm, with key tradeoffs.

## Scope
- In scope: ...
- Out of scope: ...
- Deferred: ...

## Impact
Packages touched, breaking changes, migration path.

## Open questions
Anything unresolved the plan must answer.
```

Then ask the user to review:

> "Brief written to `.plans/ideas/<slug>/brief.md`. Review it — any changes before we move it to `.plans/active/` and write the plan?"

On approval, move the brief to `.plans/active/<slug>/brief.md`, then move to planning to create `spec.md`, `plan.todo.md`, `status.json`.

## Key principles

- **One question at a time** — don't overwhelm
- **YAGNI ruthlessly** — remove everything the user didn't ask for
- **Resolve intent priorities** — when approaches conflict, default to: offline > security > UX > DX > elegance (per CLAUDE.md)
- **Scale to complexity** — a bug fix doesn't need a 10-section design; a new module does
- **Evidence before claims** — don't claim alignment until the user explicitly approves each section

## Anti-patterns

| Don't | Why |
|-------|-----|
| Ask 5 questions in one message | User can't answer them linearly; context gets lost |
| Propose one approach without alternatives | Forecloses the conversation; hides tradeoffs |
| Start writing code before the brief is approved | Violates the hard gate; wastes work |
| Write a brief longer than the plan will be | Overplanning signals fuzzy thinking; distill |
| Ask about things the code already answers | Read first, ask second |
| Use the brainstorm for an already-clear task | Skip brainstorm when requirements are concrete |

## Transition

The terminal state of brainstorming is the planning skill. Do NOT invoke `ui`, `contracts`, or any other implementation skill directly — planning owns the path from approved brief to execution.
