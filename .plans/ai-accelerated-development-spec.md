# AI-Accelerated Development Spec for Greenpill Dev Guild

> **Source**: Synthesized from Nate B Jones' frameworks (AI Integration Framework, Five-Level Maturity Model, Delegation vs Coordination model) + spec-driven development practices + Green Goods existing tooling.
>
> **Purpose**: Feed this to Claude Code or Codex to adopt these practices across the Green Goods codebase and improve product development speed and quality.
>
> **Video reference**: [Junior Dev Jobs Just Dropped 60%. The Career Ladder Is Changing. Here's What Replaced It.](https://youtu.be/bDcgHzCBgmQ) by Nate B Jones

---

## 1. Core Philosophy: High Agency + AI-Native Thinking

### The Shift

The traditional development career ladder (junior → mid → senior → lead) is collapsing. Junior dev jobs dropped 60% because AI now handles the "training rung" tasks — boilerplate, CRUD, simple bug fixes, data cleanup. What replaces the ladder is **high-agency individuals leveraging AI to compress 20-year career trajectories into months**.

### What This Means for the Guild

- **Every guild member operates as a "10x generalist"** — AI handles breadth, humans provide depth in domain expertise (regenerative finance, on-chain regeneration, Hats Protocol governance)
- **Code is about to cost nothing; knowing what to build costs everything** — invest guild time in problem definition, user research, and protocol design, not implementation mechanics
- **Small bets, rapid iteration** — ship experimental features in hours, not weeks. Validate with real users before investing in production hardening

### The AI Integration Framework (Three Layers)

Map each guild member's capabilities across three layers:

| Layer | Definition | AI Role | Guild Example |
|-------|-----------|---------|---------------|
| **Core Expertise** | Areas mastered 100% | AI accelerates, doesn't replace | Solidity/Foundry, React, protocol design |
| **Secondary Knowledge** | 70-80% competent | AI elevates to top 1% quality | DevOps/CI, indexer tuning, security audits |
| **Extensions** | 40-60% confident | AI enables entirely new capabilities | Mobile UX, data viz, ML-based impact metrics |

**Action**: Each guild member should identify their 3 layers and configure their Claude Code skills/agents to match. Secondary and Extension layers get heavier AI delegation.

---

## 2. Spec-Driven Development (Not Vibe Coding)

### The Problem with Vibe Coding

Ad-hoc prompting ("make this work", "fix this bug") produces "brilliant bursts of creativity mixed with brittle code that crumbles under pressure." It works for prototypes but creates tech debt at scale.

### Spec Coding: The "What" and the "How"

Every non-trivial feature gets a two-part specification before any code is written:

**The "What" (Functional Spec)**:
```markdown
## Feature: [Name]

### User Story
As a [gardener/operator/evaluator], I want to [action] so that [value].

### Acceptance Criteria
- [ ] Given [context], when [action], then [result]
- [ ] Given [edge case], when [action], then [graceful handling]

### Success Metrics
- [Measurable outcome 1]
- [Measurable outcome 2]
```

**The "How" (Technical Guardrails)**:
```markdown
## Technical Spec

### Architecture Constraints
- Package boundary: hooks in @green-goods/shared, views in client/admin
- Contract pattern: UUPS proxy, CREATE2 deterministic deployment
- State: Zustand stores with granular selectors (Rule 6)

### Standards
- TypeScript strict mode, Address type for all Ethereum addresses (Rule 5)
- React Hook Form + Zod for all forms (Rule 8)
- Error handling: parseContractError + USER_FRIENDLY_ERRORS (Rule 4)

### Test Requirements
- Unit: [specific scenarios to cover]
- Fork: [chain-specific validation]
- E2E: [workflow coverage]

### Lessons Learned (append after completion)
- [What worked, what didn't, what to change next time]
```

### Integration with Existing Workflow

This maps directly to the existing 4 entry points:

| Entry Point | Spec Requirement | AI Tool |
|-------------|-----------------|---------|
| PRD → /plan | Full functional + technical spec | Claude Code /plan skill |
| Feature | cracked-coder SCOPE phase = spec | cracked-coder agent |
| Bug | /debug root cause = mini-spec | debug skill → cracked-coder |
| Polish | No spec needed (< 10 lines) | Direct Claude |

---

## 3. Delegation vs Coordination: When to Use What

### Two Agent Philosophies

| Model | Tool | Best For | Guild Usage |
|-------|------|----------|-------------|
| **Delegation** (autonomous) | Codex, background agents | Well-defined, isolated tasks with clear specs | Batch test writing, boilerplate generation, doc updates, migration scripts |
| **Coordination** (collaborative) | Claude Code, agent teams | Exploratory work, multi-file refactors, protocol design | Feature implementation, architecture decisions, cross-package changes |

### Decision Criteria (Three Questions)

Before starting any AI-assisted task, ask:

1. **Can I write a complete spec in < 5 minutes?** → Delegation (hand off and walk away)
2. **Will I need to make judgment calls mid-implementation?** → Coordination (stay in the loop)
3. **Does this touch > 3 packages or require domain knowledge?** → Coordination with agent teams

### Practical Mapping for Green Goods

**Delegate (fire-and-forget):**
- Generate unit tests from existing implementation
- Write Storybook stories for existing components
- Create TypeScript types from Solidity ABIs
- Migrate i18n strings to new locale files
- Format/lint cleanup across packages

**Coordinate (collaborative loop):**
- New Solidity modules (security implications, gas optimization)
- Cross-package refactors (shared hooks → client/admin views)
- Protocol design (Hats tree structure, EAS schema design)
- Deployment pipeline changes (multi-chain wiring)
- User-facing feature implementation (offline-first, UX flows)

---

## 4. The "Second Brain" Pattern

### What It Is

A persistent knowledge system that doesn't just store information but **actively classifies, routes, summarizes, surfaces, and nudges**. For the first time, we have systems that work against our stored information while we sleep.

### Implementation for Green Goods

The guild already has the foundation — enhance it:

**1. CLAUDE.md as Living Architecture Document**
- Current: 500+ lines of rules, patterns, and commands
- Enhancement: Add a `## Decision Log` section that records architectural decisions with rationale. AI agents reference this before proposing changes.

**2. Memory Files as Persistent Context**
- Current: `.claude/projects/.../memory/MEMORY.md` with key learnings
- Enhancement: Create topic-specific memory files that agents auto-consult:
  - `memory/deployment-gotchas.md` — things that went wrong and fixes
  - `memory/performance-baselines.md` — bundle sizes, test times, gas costs
  - `memory/user-feedback.md` — patterns from user testing sessions

**3. Lessons Learned Loop**
- After every significant feature or bug fix, append to a `memory/lessons.md`:
  ```markdown
  ## [Date] [Feature/Bug]: [Title]
  - **What worked**: [approach that succeeded]
  - **What didn't**: [approach that failed and why]
  - **Time saved/spent**: [estimate]
  - **Spec quality**: [was the spec sufficient? what was missing?]
  ```
- AI agents read this before starting similar work

**4. Specification Library**
- Store proven specs in `.plans/templates/` for reuse:
  - `new-solidity-module.md` — template for adding a new contract module
  - `new-shared-hook.md` — template for adding a hook to @green-goods/shared
  - `new-indexer-handler.md` — template for adding an Envio event handler
  - `cross-package-migration.md` — template for breaking changes

---

## 5. Five-Level AI Maturity Framework (Guild Self-Assessment)

### Where Is the Guild Today?

| Level | Description | Characteristics | Status |
|-------|------------|-----------------|--------|
| **0: Manual** | No AI integration | All code hand-written | N/A (past this) |
| **1: Assisted** | AI as autocomplete | Copilot suggestions, ChatGPT for questions | Past this |
| **2: Augmented** | AI in the workflow | Claude Code for implementation, agents for review | **Current baseline** |
| **3: Orchestrated** | AI-first development | Spec-driven, agent teams, persistent memory, delegation model | **Target** |
| **4: Autonomous** | AI-led with human oversight | Long-running agents, self-healing CI, auto-triage | Future state |

### Level 3 Checklist (Target State)

- [ ] Every feature starts with a spec (functional + technical) before any code
- [ ] Agent teams (cracked-coder, code-reviewer, oracle) used for every non-trivial feature
- [ ] Delegation model used for all well-specified isolated tasks
- [ ] Lessons learned logged after every significant piece of work
- [ ] Spec templates exist for all common work types
- [ ] Memory files consulted automatically by agents before starting work
- [ ] Build/test/deploy pipeline is fully scriptable (no manual steps)
- [ ] Cross-package changes validated by automated agent review before merge

---

## 6. Concrete Workflow Changes

### Before (Level 2 — Current)

```
1. Receive task/issue
2. Open Claude Code
3. Describe what you want conversationally
4. Iterate back and forth until it works
5. Run tests, fix what breaks
6. Submit PR
```

### After (Level 3 — Target)

```
1. Receive task/issue
2. Write spec (use template from .plans/templates/)
   - Functional: user story + acceptance criteria
   - Technical: constraints + test requirements
3. Choose model:
   - Delegation: hand spec to background agent, move to next task
   - Coordination: use /plan → cracked-coder → /review pipeline
4. Agent implements against spec (not against conversation)
5. Automated cross-package verification (agent teams)
6. Lessons learned logged to memory/lessons.md
7. Spec template updated if gaps found
8. Submit PR with spec linked
```

### Key Differences

| Aspect | Before | After |
|--------|--------|-------|
| Starting point | Conversation | Written spec |
| AI guidance | Ad-hoc prompts | Structured guardrails |
| Quality check | Manual review | Agent teams + human review |
| Knowledge retention | Lost between sessions | Memory files + lessons log |
| Parallelism | Sequential tasks | Delegation frees up time for coordination tasks |
| Spec reuse | None | Template library grows over time |

---

## 7. Metrics to Track

### Speed Metrics
- **Time from issue → merged PR** (target: 50% reduction for spec'd features)
- **Delegation success rate** (% of delegated tasks that need < 1 round of human correction)
- **Spec writing time** (target: < 15 min for standard features, < 30 min for complex)

### Quality Metrics
- **Post-merge bug rate** (target: 30% reduction within 3 months)
- **Test coverage delta** (every PR should increase or maintain coverage)
- **Spec accuracy** (% of acceptance criteria met on first implementation attempt)

### Learning Metrics
- **Lessons logged per week** (target: 3+ entries)
- **Spec template reuse rate** (how often templates are used vs. blank-slate specs)
- **Memory file consultation rate** (are agents actually reading context?)

---

## 8. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Create `.plans/templates/` directory with 4 core spec templates
- [ ] Create `memory/lessons.md` with initial entries from recent work
- [ ] Create `memory/deployment-gotchas.md` from existing MEMORY.md content
- [ ] Add `## Decision Log` section to CLAUDE.md
- [ ] Document the delegation vs coordination criteria in CLAUDE.md

### Phase 2: Practice (Week 3-4)
- [ ] Use spec-driven workflow for 3 features (one per work type: contract, hook, view)
- [ ] Log lessons learned for each
- [ ] Refine templates based on what was missing
- [ ] Measure time-to-merge vs. previous features of similar scope

### Phase 3: Automation (Week 5-8)
- [ ] Configure Claude Code agents to auto-consult memory files
- [ ] Set up delegation pipeline for batch tasks (test generation, i18n, docs)
- [ ] Implement cross-package verification agent team workflow
- [ ] Create a "spec review" step in the /review skill

### Phase 4: Optimization (Ongoing)
- [ ] Monthly review of metrics
- [ ] Quarterly spec template audit (update, merge, or retire templates)
- [ ] Annual AI maturity self-assessment
- [ ] Share guild learnings with broader Greenpill network

---

## 9. Prompt Engineering Principles

When feeding specs to Claude Code or Codex, follow these principles:

### Structure Over Length
```
BAD:  "Make a hook that fetches garden data and handles errors and caches it"
GOOD: See spec template with explicit sections for inputs, outputs, constraints, and test cases
```

### Constrain the Solution Space
```
BAD:  "Implement this however you think is best"
GOOD: "Implement using TanStack Query with queryKeys from hooks/query-keys.ts,
       error handling via parseContractError, and Address type from @green-goods/shared"
```

### Reference, Don't Repeat
```
BAD:  Paste entire CLAUDE.md into every prompt
GOOD: "Follow architectural rules in CLAUDE.md, specifically Rules 4, 5, 11, 14"
```

### Specify the Verification
```
BAD:  "Make sure it works"
GOOD: "Verify: bun run test in packages/shared passes,
       bun lint has no new warnings,
       bun build completes without errors"
```

---

## 10. Anti-Patterns to Avoid

| Anti-Pattern | Why It Fails | What to Do Instead |
|-------------|-------------|-------------------|
| **Vibe coding** | Inconsistent quality, no reuse | Write spec first, even a 5-line one |
| **Over-delegation** | AI lacks domain context for judgment calls | Coordinate on anything touching protocol design or UX |
| **Spec rigidity** | Specs become bureaucratic overhead | Keep specs lightweight; a user story + 3 acceptance criteria is enough for most features |
| **Ignoring lessons** | Same mistakes repeated across sessions | Log and read lessons.md religiously |
| **Tool loyalty** | Using one AI for everything | Match tool to task: Claude for coordination, Codex for delegation, oracle for research |
| **Skipping review** | AI-generated code ships with subtle bugs | Always run /review (6-pass) before merge, even for delegated work |
| **Hoarding context** | Knowledge lives in one person's head | Put it in CLAUDE.md, memory files, or spec templates |

---

## Summary: The Greenpill Dev Guild AI Playbook

1. **Spec first, always** — even 5 lines beats zero lines
2. **Delegate the defined, coordinate the complex** — match the AI model to the task shape
3. **Log everything** — lessons, decisions, gotchas. Your future self (and AI) will thank you
4. **Templates compound** — every spec template saved is 15 minutes saved next time
5. **Measure what matters** — time-to-merge, bug rate, spec accuracy
6. **Stay high-agency** — AI handles breadth, you provide depth in what matters (regenerative finance, regenerative impact, community governance)
7. **Code costs nothing, knowing what to build costs everything** — invest guild time in problem definition and user research

---

*This spec is a living document. Update it as practices evolve and new tools emerge.*
*Based on frameworks by [Nate B Jones](https://www.natebjones.com/) + spec-driven development practices.*
