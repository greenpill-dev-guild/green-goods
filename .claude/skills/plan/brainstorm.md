# Brainstorm before planning

Part of the [plan skill](SKILL.md). Turn a fuzzy idea into an approved design through dialogue before any plan steps exist. Paths and priorities come from the adapter's `## plan` section.

## When

Brainstorm first when the request has no clear "done when", several plausible approaches have undiscussed tradeoffs, it spans 3+ packages with unbounded scope, the user asks "what do you think?", "how should we approach this?", or "let's figure out...", or it reads like a platform rather than a feature. Skip it for a single-file change, a clear bug report, a config change, or an already-approved plan.

## Hard gate

Write no plan, scaffold no files, and edit no code until (1) the user has explicitly approved the design, (2) a brief exists at the idea stage of **Plan location** (default: a `brief.md` beside the work), and (3) the user has reviewed that brief. This holds however simple the project looks; simple projects are where unexamined assumptions waste the most work.

## Process

Explore context → research factual gaps → ask frontier rounds → propose 2 or 3 approaches → present the design in sections → user approves → write the brief → user reviews the brief → plan.

1. **Explore before asking.** Read the affected files, recent commits in the area, overlapping active plans, and the guides in **Context**. Never ask what the code or docs already answer.
2. **Assess scope before any question.** If the request describes several independent subsystems, say so at once and decompose: "This sounds like three independent features: A, B, C. Which one first?" Each piece gets its own brief, plan, and implementation.
3. **Resolve the decision frontier** (purpose, constraints, success criteria):
   1. List the unresolved decisions and the dependencies between them.
   2. Settle cheap repository facts from code, docs, plans, or live state; send bounded factual prerequisites that need reconciled evidence to the `research` skill.
   3. The frontier is the unresolved decisions whose prerequisites are already known.
   4. Ask every independent frontier question together in one numbered round, each with a recommended answer and the tradeoff behind it. Prefer multiple choice when the options are few.
   5. Defer a question that depends on an unsettled one, and update the frontier after each answer. Advance only when no silent assumption remains; anything deliberately deferred goes under Open questions in the brief.

   The frontier is a reasoning aid, not a second artifact: keep no separate decision ledger. Split an unusually large frontier into coherent rounds that keep dependency order.
   Good: "Should draft state persist across sessions or only within the tab? (a) across sessions, (b) tab only, (c) no persistence." "Is this offline-capable from day one, or online-only first?" Bad: "What tech should we use?" (the stack is known); "Anything else to consider?" (fishing).
4. **Propose 2 or 3 approaches**, each with a one-line summary, pros, and cons, then a recommendation tied to **Priorities** (default: correctness, security, user experience, developer experience, elegance).
5. **Present the design in sections**, a few sentences for simple parts and up to about 250 words for nuanced ones, and ask after each whether it looks right. Cover architecture (where code lives), components or entities created and modified, data flow, error handling, test strategy, and breaking changes or migrations, plus **Design sections** (default: none).
6. **Write the brief, then ask for review**: "Brief written to `<path>`. Any changes before it moves to active and we write the plan?"

   ```markdown
   # <Feature Name> Brief

   **Status**: IDEA
   **Created**: YYYY-MM-DD

   ## Problem
   What need does this serve? Which user journey?

   ## Approach
   The chosen approach and its key tradeoffs.

   ## Scope
   - In scope: ...
   - Out of scope: ...
   - Deferred: ...

   ## Impact
   Packages touched, breaking changes, migration path.

   ## Open questions
   Anything unresolved that the plan must answer.
   ```

   On approval, move the brief to the active stage of **Plan location** and continue in the plan skill.

## Principles

- Ask the current independent frontier together, then advance.
- YAGNI ruthlessly: remove everything the user did not ask for.
- When approaches conflict, resolve them by **Priorities**.
- Scale to complexity: a bug fix needs no ten-section design; a new module does.
- Claim alignment only after the user explicitly approves each section.

| Anti-pattern | Why it hurts |
|---|---|
| A wall of dependent questions | unsettled prerequisites invalidate the later answers |
| Independent decisions asked one message at a time | avoidable back-and-forth that hides how they relate |
| One approach with no alternatives | forecloses the conversation and hides tradeoffs |
| Code before the brief is approved | breaks the hard gate and wastes work |
| A brief longer than the plan will be | a sign of fuzzy thinking: distill it |
| Questions the code already answers | read first, ask second |
| Brainstorming an already-clear task | skip it when requirements are concrete |

The end state of brainstorming is the plan skill, never implementation.
