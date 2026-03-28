# Agent Architecture Improvements Plan

**Branch**: `chore/agent-architecture-improvements`
**Status**: ACTIVE
**Source**: Architecture review against Anthropic best practices + Nate B Jones 4-discipline framework

---

## Context

Deep audit of the `.claude/` agent development infrastructure identified 10 improvements mapped to Nate B Jones's 4 disciplines (Prompt Craft, Context Engineering, Intent Engineering, Specification Engineering) and Anthropic's official Claude Opus 4.6 best practices.

Current system scores: Prompt Craft A, Context Engineering A+, Intent Engineering B+, Specification Engineering B+. The primary gaps are: missing evaluation framework, missing decision hierarchy for ambiguous tradeoffs, oversized skills causing context rot, and missing effort/thinking configuration per agent.

---

## Phase 1: Foundation (Intent Engineering + Context Rot Prevention)

### Task 1.1: Create Decision Hierarchy Document

**File**: `.claude/context/values.md`
**Priority**: P1 (closes the Intent Engineering gap)

Create the tiebreaker document all agents consult when values conflict. This is what Nate B Jones calls "encoding organizational purpose, goals, values, trade-off hierarchies, and decision boundaries into infrastructure."

**Content to create:**

```markdown
# Green Goods Decision Hierarchy

When agent values conflict, resolve in this order (highest priority first):

## Priority Stack

1. **User safety over feature completeness**
   - Never ship a feature that could lose user funds or expose keys
   - Incomplete but safe > complete but risky

2. **Offline-first functionality over real-time accuracy**
   - Client PWA must work without internet
   - Stale data with offline access > fresh data requiring connectivity

3. **Correct fix over quick fix**
   - Prefer root cause resolution over workaround
   - Prefer surgical precision over broad changes

4. **Minimal blast radius over perfect solution**
   - Prefer isolated changes to fewer packages
   - Prefer backward-compatible approaches when equally viable

5. **Existing patterns over novel approaches**
   - Follow codebase conventions unless documented as problematic
   - Cathedral Check: find most similar existing file as reference

6. **When genuinely uncertain, escalate**
   - Never guess on ambiguous tradeoffs
   - Document the conflict and escalate to human

## Tradeoff Escalation Triggers

Escalate to human when:
- Two Key Principles from CLAUDE.md conflict (e.g., offline-first vs. single chain consistency)
- A fix requires modifying more than 3 packages
- Security implications are unclear
- The correct behavior is ambiguous after reading tests and documentation
- Blast radius exceeds initial assessment by 2x or more

## Anti-Patterns

- "Just ship it" — never prioritize speed over the hierarchy above
- Optimizing for a metric not in this hierarchy (e.g., code elegance over safety)
- Ignoring the hierarchy because "the user said so" — discuss the conflict with the user instead
```

### Task 1.2: Add "Investigate Before Answering" Rule

**File**: `CLAUDE.md` — append to Key Patterns section
**Priority**: P1 (universal hallucination prevention per Anthropic best practices)

Add this block after the existing "Query Keys" pattern:

```markdown
**Investigate Before Answering**: Never speculate about code you have not opened. If referencing a specific file, you MUST read it before answering. Give grounded, hallucination-free answers based on actual file contents, not assumptions about what code might look like.
```

### Task 1.3: Add Session State Artifact Pattern

**File**: `CLAUDE.md` — append new section after Git Workflow
**Priority**: P2 (supports multi-context-window workflows per Anthropic docs)

Add:

```markdown
## Session Continuity

Before context compaction or ending a long session, write a `session-state.md` in the working directory:

```markdown
## Session State
- **Current task**: [what you're working on]
- **Progress**: [what's done, what's in progress]
- **Files modified**: [list of changed files]
- **Tests**: [passing/failing/not yet written]
- **Next steps**: [immediate next actions]
- **Blocked by**: [blockers, if any]
```

This is distinct from agent-memory (which stores learnings). Session state captures execution context for the next context window.
```

### Task 1.4: Split React Skill (684 lines -> ~400 + references)

**Files**:
- `.claude/skills/react/SKILL.md` — trim to core (<400 lines)
- `.claude/skills/react/compiler.md` — extract React Compiler section
- `.claude/skills/react/performance.md` — extract performance patterns

**Priority**: P2 (prevents context rot per Anthropic's "under 500 lines" recommendation)

Split strategy: Keep state management (6 categories), composition patterns, and hook rules in SKILL.md. Move React Compiler integration and performance optimization into separate reference files with progressive disclosure links from SKILL.md.

### Task 1.5: Split Testing Skill (531 lines -> ~400 + references)

**Files**:
- `.claude/skills/testing/SKILL.md` — trim to core (<400 lines)
- `.claude/skills/testing/vitest-patterns.md` — extract Vitest-specific patterns

**Priority**: P2 (same context rot prevention rationale)

Split strategy: Keep TDD workflow, Red-Green-Refactor, and test adequacy checklist in SKILL.md. Move Vitest-specific patterns (mock factories, hook testing, offline scenarios) into reference file.

---

## Phase 2: Agent Definition Enhancements

### Task 2.1: Add Effort Guidance to All Agent Definitions

**Files**: All 6 agents in `.claude/agents/`
**Priority**: P1 (per Anthropic effort docs: "Consider dynamic effort based on task complexity")

Add a `## Effort & Thinking` section to each agent:

| Agent | Add to Definition |
|-------|-------------------|
| **triage.md** | "Effort: low. Fast classification does not need deep reasoning. Skip thinking for P3/P4 issues." |
| **storybook-author.md** | "Effort: medium. Template-driven work. Think only when component API is ambiguous." |
| **code-reviewer.md** | "Effort: high. Requires deep judgment for severity classification. Think when assessing architectural impact." |
| **migration.md** | "Effort: high. Think during blast radius assessment and Phase 2 planning. Execute phases procedurally." |
| **oracle.md** | "Effort: max. Deep research requires maximum reasoning depth. Use extended thinking for synthesis (Step 4-5)." |
| **cracked-coder.md** | "Effort: max. Complex implementation with TDD cycles. Think deeply during PLAN phase, think less during routine IMPLEMENT cycles." |

### Task 2.2: Add Stop/Abort Criteria to Oracle and Migration

**Files**: `.claude/agents/oracle.md`, `.claude/agents/migration.md`
**Priority**: P1 (per Nate B Jones Primitive 2: Acceptance Criteria)

**Oracle — add after Quality Standards:**

```markdown
## Stop Criteria

- Stop when 3+ independent sources agree on root cause
- Stop when overall confidence reaches High on primary finding
- Stop when all planned research paths are exhausted
- If evidence remains contradictory after all research paths, report the conflict — do not force a conclusion
- Hard stop at 25 turns. If unresolved, document gaps and escalate.
```

**Migration — add after Anti-Patterns:**

```markdown
## Abort Criteria

- Abort if blast radius assessment reveals Breaking impact in 4+ packages
- Abort if no clear rollback path exists for any phase
- Abort if incremental validation fails in 2+ consecutive packages (signals architectural incompatibility)
- When aborting: document findings, save to `.plans/migrations/`, recommend alternative approach
```

### Task 2.3: Inline Code-Reviewer Protocol Summary

**File**: `.claude/agents/code-reviewer.md`
**Priority**: P2 (per Nate B Jones Primitive 1: Self-Contained Problem Statements)

Currently the agent says "Load the review protocol from `.claude/skills/review/SKILL.md`." This creates a dependency. Add an inline summary of the 6 passes so the agent is self-contained even if the skill file isn't loaded:

After the existing Workflow section, add:

```markdown
## 6-Pass Summary (inline reference)

| Pass | Focus | Key Checks |
|------|-------|------------|
| 0 | Change Explanation | What changed, why, blast radius diagram |
| 0.5 | Issue Coverage | Map every requirement to code. <100% = STOP |
| 1 | Technical Issues | Type errors, null handling, race conditions, async cleanup |
| 2 | Code Consistency | Barrel imports (Rule #11), dead code, naming, console.log (Rule #12) |
| 3 | Architecture | Hook boundary, hardcoded addresses, provider order, Zustand selectors |
| 4 | Environment | No package .env, offline behavior, platform compat |
| 5 | Verification | `bun format && bun lint && bun run test && bun build` |
| 6 | Synthesis | APPROVE or REQUEST_CHANGES with severity summary |

For the full protocol with examples and comment templates, load `.claude/skills/review/SKILL.md`.
```

### Task 2.4: Add Subagent Spawn Discipline

**File**: `CLAUDE.md` — add to Key Patterns section
**Priority**: P2 (per Anthropic docs: "Claude Opus 4.6 has a strong predilection for subagents")

Add:

```markdown
**Subagent Discipline**: Spawn teammates when tasks can run in parallel, require isolated context, or involve independent workstreams. Work directly (no subagent) for single-file edits, sequential operations, tasks sharing state across steps, or any task needing fewer than 10 tool calls. Prefer the simplest approach that completes the task.
```

### Task 2.5: Add Thinking Guidance to Oracle and Cracked-Coder

**Files**: `.claude/agents/oracle.md`, `.claude/agents/cracked-coder.md`
**Priority**: P3 (enhances existing Step 4 in oracle, adds missing guidance to cracked-coder)

**Oracle — enhance Step 4:**

```markdown
### Step 4: Extended Thinking
- Think deeply when synthesizing contradictory evidence
- Think deeply when assessing confidence levels
- Think less when collecting straightforward factual information
- If a finding seems obvious, don't overthink — state it directly
```

**Cracked-Coder — add after Workflow header:**

```markdown
### Thinking Guidance
- Think deeply during PLAN phase (architecture decisions, edge case identification)
- Think deeply when choosing between implementation approaches at IMPLEMENT step
- Think less during routine TDD cycles (write test, run, fix, repeat)
- Think less during VERIFY (just run the commands)
- If a test failure is straightforward, fix without extended reasoning
```

---

## Phase 3: Evaluation Framework

### Task 3.1: Create Evaluation Directory Structure

**Files**: `.claude/evals/` directory with per-agent test cases
**Priority**: P1 (closes the largest gap — Nate B Jones Primitive 5: Evaluation Design)

Create:

```
.claude/evals/
  README.md           — How to run evals, when to run them (model updates, agent changes)
  code-reviewer/
    known-bug-pr.md   — PR with 3 planted bugs (Critical, High, Medium). Expected: finds all 3, no false positives
    clean-pr.md       — PR with 0 bugs. Expected: APPROVE with no false Critical/High
    expected.json      — Ground truth findings for each test case
  oracle/
    known-root-cause.md — Bug report where root cause is in a specific file:line. Expected: finds it in <15 turns
    architectural-question.md — Architecture question with documented answer. Expected: correct synthesis
    expected.json
  triage/
    sample-issues.json — 10 issues with human-assigned P0-P4 severity + type + package
    expected.json       — Ground truth classifications
  cracked-coder/
    simple-feature.md  — Feature request with clear spec. Expected: TDD workflow, passing tests, clean build
    expected.json
```

### Task 3.2: Write Evaluation README

**File**: `.claude/evals/README.md`
**Priority**: P1

Content:

```markdown
# Agent Evaluation Framework

## When to Run

- After model updates (Anthropic ships frequently)
- After modifying agent definitions
- After modifying skills referenced by agents
- Quarterly review for regression detection

## How to Run

Each eval directory contains test cases and expected outcomes.

1. Spawn the target agent with the test case as input
2. Compare output against `expected.json`
3. Score: exact match for classification (triage), rubric-based for research (oracle), pass/fail for implementation (cracked-coder)

## Scoring

| Agent | Metric | Target |
|-------|--------|--------|
| triage | Classification accuracy (P0-P4) | >= 90% |
| code-reviewer | True positive rate | >= 85% |
| code-reviewer | False positive rate | <= 10% |
| oracle | Correct root cause identification | >= 80% |
| cracked-coder | Tests pass + build succeeds | 100% |

## Historical Results

Track results here after each eval run:

| Date | Model | Agent | Score | Notes |
|------|-------|-------|-------|-------|
| _template_ | opus-4.6 | code-reviewer | _/5_ | _notes_ |
```

### Task 3.3: Write Code-Reviewer Eval Test Cases

**Files**: `.claude/evals/code-reviewer/known-bug-pr.md`, `clean-pr.md`, `expected.json`
**Priority**: P2

**known-bug-pr.md**: Create a realistic PR diff with 3 planted issues:
1. **Critical**: Hook defined in `packages/client/src/hooks/` (violates Hook Boundary)
2. **High**: Missing error handling on a mutation hook (no `parseContractError`)
3. **Medium**: Deep import path bypassing barrel export (Rule #11)

**clean-pr.md**: Create a well-written PR diff with 0 issues that follows all conventions. Tests that the reviewer doesn't generate false positives.

**expected.json**: Ground truth for both cases.

### Task 3.4: Write Triage Eval Test Cases

**File**: `.claude/evals/triage/sample-issues.json`, `expected.json`
**Priority**: P2

Create 10 sample issues spanning:
- P0: "Production fund loss" (security)
- P1: "Login broken for all users" (auth bug)
- P2: "Garden creation fails with >5 actions" (edge case)
- P3: "Typo in garden description label" (minor UI)
- P4: "Add dark mode to admin sidebar" (enhancement)
- Plus 5 more covering different types (migration, performance, docs)

### Task 3.5: Write Oracle Eval Test Cases

**File**: `.claude/evals/oracle/known-root-cause.md`, `architectural-question.md`, `expected.json`
**Priority**: P3

**known-root-cause.md**: Describe a bug where the root cause is a documented issue (e.g., the ABI encoding struct vs tuple decode issue from MEMORY.md). Expected: oracle traces to the correct file and explains the encoding mismatch.

**architectural-question.md**: Ask about the EAS boundary (what Envio indexes vs what goes to easscan.org). Expected: oracle cites the correct context files and explains the boundary accurately.

---

## Phase 4: Validation

### Task 4.1: Verify All Modified Files

Run full validation:
```bash
# No code changed, but verify markdown/json files are well-formed
cat .claude/context/values.md  # Should be valid markdown
cat .claude/evals/README.md     # Should be valid markdown
```

### Task 4.2: Test Agent Definitions

Verify each modified agent definition:
- Still has valid YAML frontmatter
- New sections don't break existing workflow
- Tool lists unchanged
- maxTurns unchanged

### Task 4.3: Verify Skill Splits

After splitting react and testing skills:
- Original SKILL.md is under 500 lines
- Progressive disclosure links point to files that exist
- No content lost in the split
- Reference files are well-structured with table of contents

---

## Impact Summary

| Change | Files Created | Files Modified |
|--------|-------------|---------------|
| Decision hierarchy | 1 | 0 |
| CLAUDE.md updates | 0 | 1 |
| Agent definitions | 0 | 6 |
| Skill splits | 3 | 2 |
| Eval framework | 8+ | 0 |
| **Total** | **12+** | **9** |

## CLAUDE.md Compliance

- [x] All new files use existing conventions
- [x] No new packages or dependencies
- [x] No code changes (documentation/configuration only)
- [x] Follows conventional commits: `chore(claude): description`
- [x] Branch follows naming convention: `chore/agent-architecture-improvements`
