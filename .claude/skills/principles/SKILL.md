---
name: principles
user-invocable: false
description: Internal principles lens for Green Goods. Prefer this inside `/review` when a change feels too complex, too coupled, too duplicative, or too implicit. Use a dedicated pass only when the user explicitly asks for it.
argument-hint: "[package-name] [--focus cohesion|boundaries|simplicity|duplication|reliability|data]"
context: fork
effort: high
version: "2.0.1"
status: active
packages: ["all"]
dependencies: ["architecture"]
last_updated: "2026-05-09"
last_verified: "2026-05-09"
---

# Principles Skill

Read-only design judgment for Green Goods.

Prefer `/review` first. This skill is the deeper coherence lens when review findings turn into questions about simplicity, coupling, duplication, or reliability visibility.

This skill answers:

- should this be simplified?
- is this module carrying too many responsibilities?
- is the boundary clear enough for humans and agents?
- is duplication starting to drift into real maintenance cost?
- are important reliability decisions visible where they matter?

## Activation

Use when:

- `/review` needs a focused coherence or simplicity pass
- a user asks for a principles audit
- a package feels overgrown or unclear
- you need a design-level judgment before refactoring
- you want to pressure-test whether a change is coherent, not just correct

Do not use this skill for dead-code scanning, dependency health, or exhaustive architecture mapping.

## Scope Lock

This skill is strictly read-only. Do not edit files while auditing.

## What This Skill Owns

This skill focuses on five lenses only:

1. **Cohesion** — one module, one responsibility boundary
2. **Boundary Discipline** — dependencies and public surfaces stay legible
3. **Simplicity** — avoid unnecessary indirection, cleverness, or premature structure
4. **Duplication** — repeated logic only becomes a finding when it creates real maintenance or divergence risk
5. **Reliability Clarity** — permissions, retries, destructive paths, and trust-sensitive behavior should be visible

### Optional Lens

`--focus data` is opt-in and should only be used when the user specifically wants ACID/BASE/CAP-style reasoning on storage, sync, or consistency behavior.

## What This Skill Does Not Own

- dead code, unused exports, or dependency scanning (`audit`)
- full repo structure mapping (`architecture`)
- PR correctness and test review (`review`)
- implementation orchestration or auto-fix flows

## Workflow

### 1. Declare Scope and Focus

Start with:

```text
Principles scope: [package, module, or change]
Focus: [cohesion | boundaries | simplicity | duplication | reliability | data]
Mode: read-only
```

Default to one package or one changed surface. Avoid full-repo audits unless explicitly requested.

### 2. Read Local Context First

Before making findings:

- read the neighboring modules
- identify the local pattern already in use
- check whether the code is intentionally shaped by an existing repo rule

Do not audit a file in isolation.

### 3. Evaluate the Five Lenses

#### Cohesion

Look for:

- one file serving multiple unrelated responsibilities
- domain logic mixed with glue code in ways that obscure ownership
- public surfaces that combine unrelated concepts

Do not equate file size with bad cohesion.

#### Boundary Discipline

Look for:

- shared rules being bypassed
- unstable internals imported from the wrong place
- risky checks or trust boundaries hidden too far from use sites
- public surfaces that make it unclear where code should live

#### Simplicity

Look for:

- wrappers that add indirection without removing real complexity
- abstractions that have only one current use and no concrete pressure behind them
- complexity that makes code harder for both humans and agents to verify

#### Duplication

Look for:

- 3+ repeated implementations of the same concern
- divergence across similar flows that creates bug risk
- repeated translation of the same concept across packages

Do not flag duplication just because two packages solve similar UI or domain problems independently.

#### Reliability Clarity

Look for:

- permissioning that is easy to miss
- retry or fallback behavior that hides failure
- destructive behavior without a clear boundary
- external trust decisions embedded in convenience code

This lens should align with the repo's friction model: judgment-heavy areas should remain visible.

## False-Positive Guardrails

These are mandatory:

- do not report a principles finding without concrete harm or clear maintenance risk
- do not call something a DRY violation unless the repetition is materially costly or drifting
- do not call something YAGNI just because it feels unused; confirm the consumer story first
- do not call something an SRP violation based on size alone
- do not use CAP/ACID language unless you inspected real storage or sync paths
- drop any finding below high confidence

## Output Contract

Keep the report short, opinionated, and actionable.

### Required

1. **Verdict** — `tighten now` | `monitor` | `leave as-is`
2. **Top Findings** — maximum 7
3. **Positive Findings** — what is structurally or semantically strong
4. **Rejected Temptations** — optional, up to 3 things that looked suspicious but are not actual issues
5. **Smallest Next Move** — the least invasive improvement that would matter

### Finding Format

```text
[Title]
- Lens: cohesion | boundaries | simplicity | duplication | reliability | data
- Evidence: file:line
- Why it matters: ...
- Smallest credible fix: ...
```

## Severity Guidance

Use these labels only:

- `must-fix` — concrete design problem with active maintenance or correctness cost
- `should-fix` — real issue, but not urgent
- `watch` — worth monitoring, not yet strong enough to change

Avoid giant scorecards across every named principle. They create noise and encourage weak findings.

## Linear Routing After Acceptance

This skill is read-only while producing a principles report. All routing after acceptance
(team, `.plans`/`source:plans`, projects, labels, privacy, prompt-before-create) follows the
shared core: [`.claude/context/linear-routing-rules.md`](../../context/linear-routing-rules.md).

## Green Goods Heuristics

Before reporting a finding, pressure-test it against the repo:

- if it touches `packages/shared`, prefer narrower public surfaces over new architecture
- if it touches contracts, migrations, or permissions, optimize for visible judgment, not elegance
- if it touches UI, prefer existing shared/admin primitives over new abstraction families
- if it touches offline or retry paths, prefer explicitness over convenience fallbacks

## Anti-Patterns

Avoid these:

- turning the audit into a textbook SOLID lecture
- generating broad issue lists that a human has to re-triage
- recommending new layers without a deletion or simplification story
- scoring principles that do not map cleanly to the repo surface under review

## Related Skills

- `architecture` — structure mapping and placement guidance
- `audit` — dead code, dependency drift, and concrete brittle spots
- `review` — PR or diff-scoped correctness review
- `clean` — implementation pass after design judgment is accepted
