---
name: architecture
user-invocable: false
description: Internal architecture lens for Green Goods. Prefer this inside `/plan` or `/review` when boundaries, placement, or structural refactors need focused judgment. Use a dedicated pass only when the user explicitly asks for it.
effort: high
version: "3.0.0"
status: active
packages: ["contracts", "shared", "client", "admin", "agent", "indexer"]
dependencies: []
last_updated: "2026-04-18"
last_verified: "2026-04-18"
---

# Architecture Skill

Read-only architecture analysis for Green Goods.

Prefer `/plan` or `/review` first. This skill exists as a deeper internal lens or as a dedicated pass when the user explicitly asks for architecture work.

This skill exists to answer:

- How is this part of the repo put together?
- Where are the boundaries blurry or overloaded?
- What is the smallest structural fix that improves coherence?
- Where should a new feature or refactor actually live?

## Activation

Use when:

- `/plan` or `/review` needs a focused boundary or placement pass
- a user asks for architecture analysis or structural refactoring guidance
- you need a package or module boundary map before planning changes
- you need to decide where a feature belongs
- you suspect coupling, boundary drift, or structural entropy

Do not use this skill for dead-code scanning, dependency CVEs, or PR correctness review.

## Scope Lock

This skill is strictly read-only. Do not edit files while running it.

## What This Skill Owns

- package and module boundary mapping
- public surface and import discipline review
- coupling and coherency hotspot detection
- placement recommendations for new work
- deletion, merge, or split recommendations when structure is unclear

## What This Skill Does Not Own

- dead code or unused export detection (`audit`)
- dependency health or security advisory scanning (`audit`)
- PR-scoped correctness review (`review`)
- textbook principle scoring (`principles`)
- implementation of the refactor itself

## Workflow

### 1. Declare Scope

Start by stating the scope:

```text
Architecture scope: [package, module, or full repo]
Question: [boundary | placement | coupling | coherency | refactor]
Mode: read-only
```

Default to the smallest relevant scope unless the user explicitly asks for the whole repo.

### 2. Build a Structure Map

For the scoped area, map only what is needed:

1. top-level modules/directories and their purpose
2. public entry points and barrel surfaces
3. import relationships to immediate neighbors
4. large or high-fan-in files worth closer inspection

Prefer a short table:

```text
| Module | Purpose | Public Surface | Depends On | Notes |
```

### 3. Check Boundary Rules

Evaluate the structure against actual Green Goods rules, not generic ideals:

- hooks live in `@green-goods/shared`
- shared imports should prefer the barrel
- addresses come from deployment artifacts, not hardcoded literals
- chain defaults flow through `getDefaultChain()` or `DEFAULT_CHAIN_ID`
- package layering respects `contracts -> shared -> indexer -> client/admin/agent`

Also inspect whether:

- one feature is spread across too many entry points
- business logic is hiding inside UI-heavy files
- risky checks are too far from the code that uses them
- a public surface has become a junk drawer

### 4. Identify Hotspots

Only flag a structural hotspot when there is concrete evidence. Good signals:

- a file mixes unrelated responsibilities
- a module acts as both domain surface and implementation sink
- multiple callers depend on unstable internals
- the same placement decision has been solved differently in nearby modules
- a large file is also hard to test, hard to navigate, or repeatedly edited

### 5. Run a Coherency and Deletion Pass

Ask three questions:

1. what can be deleted?
2. what can be merged because it is one concern pretending to be several?
3. what can be split because one file or surface is carrying two different responsibilities?

Bias toward reducing total code and reducing decision surface, not adding new layers.

### 6. Recommend the Smallest Structural Move

End with one of:

- `Do now` — narrow, high-confidence structural fix
- `Do later` — real issue, but not on the critical path
- `Leave alone` — looks odd, but is justified by current repo constraints

## Confidence Rules

These rules exist to reduce false positives:

- do not flag a file based on length alone
- do not recommend a new abstraction unless it removes repeated complexity or isolates a high-risk boundary
- do not prescribe Clean Architecture, DDD, or ports/adapters unless the local code already wants that shape
- do not call something a boundary problem unless you can point to the concrete import, surface, or ownership confusion
- every finding must cite file paths and explain why it matters in Green Goods specifically

## Output Contract

Keep the output tight and decision-oriented.

### Required

1. **Structure Map** — brief table or bullets
2. **Top Findings** — maximum 5
3. **Deletion / Merge / Split Opportunities** — maximum 3
4. **Positive Anchors** — what is already structurally sound
5. **Recommended Next Move** — one paragraph

### Finding Format

```text
[Title]
- Type: boundary | coupling | coherency | placement | risk
- Evidence: file:line
- Why it matters here: ...
- Smallest credible fix: ...
```

## Green Goods Heuristics

Use these repo-specific heuristics before making a recommendation:

- `packages/shared` is the highest-blast-radius surface; prefer stability over cleverness
- `packages/contracts` and deployment flows are structural risk surfaces, not cleanup playgrounds
- `packages/indexer` should stay narrow and explicit about indexing boundaries
- `packages/agent` needs visible external trust and retry boundaries
- frontend structure should optimize for reuse through existing primitives, not new abstraction trees

## Anti-Patterns

Avoid these failure modes:

- turning architecture review into a lecture on general software patterns
- proposing net-new directories, wrappers, or layers without a deletion story
- reporting more findings than a human can act on
- confusing "different from my preference" with "architecturally wrong"
- using generic scorecards without repo evidence

## Related Skills

- `principles` — design judgment on simplicity, duplication, and boundary clarity
- `audit` — dead code, dependency drift, and concrete brittle spots
- `review` — PR-scoped review
- `ops` — migration or cross-package implementation work after a structural decision is made
