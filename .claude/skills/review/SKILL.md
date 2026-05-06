---
name: review
description: Diff-scoped code review for Green Goods. Use when reviewing a PR, branch diff, working-copy change, or cross-package change. Focus on correctness, boundary violations, missing tests, and judgment-heavy callouts such as dependencies, permissions, migrations, and destructive operations. Avoid broad style commentary and keep findings high-confidence.
argument-hint: "[package|PR|file ...] [--mode report_only|verify_only|apply_fixes] [--scope cross-package]"
version: "2.1.0"
status: active
packages: ["all"]
dependencies: []
last_updated: "2026-04-24"
last_verified: "2026-04-24"
---

# Review Skill

Read-only review for Green Goods unless the user explicitly asks for a fix pass.

This skill exists to answer:

- what changed?
- what is broken or risky?
- what can the agent fix automatically?
- what must a human judge deliberately?

## Activation

Use when:

- the user asks for a review
- a PR, diff, or working-copy change needs structured findings
- a cross-package change needs a scoped verification pass

Invocation forms (all equivalent — pick whichever is easiest):

| Form | Example |
|------|---------|
| Slash + positional | `/review admin`, `/review shared admin`, `/review #123`, `/review packages/shared/src/hooks/garden/useGardens.ts` |
| Slash + flags | `/review --scope cross-package --mode verify_only`, `/review admin --mode apply_fixes` |
| Slash + domain scope | `/review design-system`, `/review --mode verify_only --scope design-system` |
| Natural language | "review the shared package", "review the admin changes in this diff", "review PR 42", "review design-system alignment" |

## Scoping

Always resolve scope **before** inspecting code, and state the resolved scope in the Summary so the user can redirect.

### Resolution order

1. **Explicit positional arg(s)** — a package name, PR ref, or file path. Multiple allowed; they combine (union, not intersection).
2. **Natural-language scope** — "review the shared package", "review admin changes", "review PR 42". Resolve the same way as positional.
3. **Working-copy auto-inference** — when no scope given, run `git diff --name-only` against the merge-base and infer packages touched. Print the inferred scope. If nothing is staged/modified, ask the user what to review instead of guessing.

### Valid package scopes

| Scope | Paths |
|-------|-------|
| `contracts` | `packages/contracts/**` |
| `indexer` | `packages/indexer/**` |
| `shared` | `packages/shared/**` |
| `client` | `packages/client/**` |
| `admin` | `packages/admin/**` |
| `agent` | `packages/agent/**` |
| `docs` | `docs/**` |

### Scope combinators

- `/review shared admin` — files touching either package (union)
- `/review --scope cross-package` — special lens: only findings that cross package boundaries
- `/review --scope design-system` (or `/review design-system`) — domain lens: full-repo design-system alignment. Delegates to [`design/system-alignment-review.md`](../design/system-alignment-review.md). Read-only by default; does not turn ordinary diff reviews into design audits. Activation rules live in the Lens Activation Matrix § design-system below.
- `/review #123` — restrict to files in the PR's diff
- `/review packages/shared/src/hooks/garden/useGardens.ts` — single-file review (narrowest)

### When to ask vs infer

- Multiple packages touched and user gave no scope → print inferred scope, proceed with all of them unless the user redirects
- Zero files touched in working tree and no scope given → ask what to review
- Scope resolves to >800 LOC → warn and offer to narrow before continuing

## Scope Lock

Default mode is read-only. Only switch into a fix flow when the user explicitly asks for one.

## What This Skill Owns

- diff-scoped correctness review
- repo-invariant checks against `CLAUDE.md` and `AGENTS.md`
- judgment routing: automatic fix candidates vs human call-outs
- verification recommendations proportional to blast radius

## What This Skill Does Not Own

- dead-code or dependency audits across the full repo (`audit`)
- abstract design judgment detached from a concrete change (`principles`)
- full architecture mapping (`architecture`)

### Internal Lenses

Review folds in the `architecture`, `principles`, `testing`, and `audit` lenses *when the diff exposes their signals* — not on every review. See the Lens Activation Matrix below for concrete trigger rules. Do not make the user switch commands unless they explicitly ask for a dedicated pass.

## Lens Activation Matrix

Predictable lens activation. Scan the diff against these signals *before* producing findings, and declare which lenses fired (and what triggered each) in the Summary.

Each lens has **hard signals** (any match → lens MUST run) and **soft signals** (≥2 matches → lens SHOULD run). If no signals match, review runs core-only.

### architecture

**Hard signals** (any → fire):

- Hook added/modified outside `packages/shared/src/hooks/` (violates repo invariant)
- File created outside a valid package directory
- Cross-package import path added for the first time (e.g., admin first import from client)
- Barrel export moved between packages

**Soft signals** (≥2 → fire):

- Diff touches ≥3 packages
- File size grows ≥30% AND public exports expand
- New module has no clear owning package
- Placement decision visible in the diff (new top-level file, first usage of a capability)
- New import path that may close a cycle (verify with `madge --circular` if suspected)

### principles

**Hard signals:**

- Silent `catch (_)` or `catch (err) {}` block with no error-handling path
- User-affecting fallback added with no visible decision trail
- Permission check wrapped, moved, or removed without adjacent test update
- Deprecated pattern added (see CLAUDE.md invariants)

**Soft signals:**

- Diff adds code near existing code doing ~80% similar work (duplication scent)
- Function exceeds 40 lines OR carries ≥3 distinct concerns
- Nested conditional depth ≥3 OR ternary chain ≥3 levels
- Abstraction (wrapper/adapter/util) added with only one call site
- Public interface grows by ≥2 new methods/properties

### testing

**Hard signals:**

- Critical surface (CLAUDE.md Criticality Matrix) modified without corresponding test change
- Public hook/module API changed without test update
- Bugfix with no regression test reproducing the bug
- Contract function signature changes without test update

**Soft signals:**

- New mutation or state transition without coverage
- Rewrite of a function with existing tests, no test changes
- Assertion removed without replacement

### audit

**Hard signals:**

- `package.json` dependency version change
- Env var added or removed in `.env.schema`
- Public export removed (breaking change to API surface)

**Soft signals:**

- Symbol usage removed but symbol remains exported (dead-code scent)
- Deprecated API usage adjacent to the diff left untouched
- Circular dependency created
- Large deletion block without corresponding cleanup of callers

### design-system

Narrow by design. Do not let ordinary UI diffs trigger a full-repo design-system audit.

**Hard signals** (any → fire, delegate to [`design/system-alignment-review.md`](../design/system-alignment-review.md)):

- Explicit invocation: `/review design-system`, `/review --scope design-system`, or natural-language phrasing "design-system alignment", "design system alignment", "UI drift review", "Storybook alignment", "admin client docs alignment"
- Diff touches root `DESIGN.md` front matter or any surface DESIGN.md dialect (`packages/admin/DESIGN.md`, `packages/client/DESIGN.md`, `packages/client/DESIGN.pwa.md`, `packages/client/DESIGN.browser.md`, `docs/DESIGN.md`) AND at least one of: `packages/shared/src/styles/theme.css`, `packages/shared/.storybook/**`, `packages/shared/src/components/Tokens/**`
- Diff touches ≥2 surfaces out of {admin visual layer, client PWA shell, client browser surface, docs UI, Storybook Tokens surface} in a single change

**Soft signals** (do **not** fire this lens; they belong in `review-checklist.md` instead):

- A single component's padding / copy / token swap
- One-file theme.css edit with no surface DESIGN.md change
- A single-story addition or update

**Scope when fired:** read-only protocol from `design/system-alignment-review.md`. Do not mix its output into the diff-review must-fix / should-fix buckets — return its Sections 1-5 directly to the user. If the user then asks for fixes, route through the normal `apply_fixes` gate.

### How to apply

1. Scan the diff against **hard signals** first. Any match → fire that lens.
2. Count **soft signals** per lens. ≥2 matches → fire that lens.
3. If no signals fire, review runs core-only.
4. The Summary MUST declare which lenses fired and cite the triggering signal(s). Example:

   ```
   Lenses applied: architecture (hard: cross-package import admin→client at packages/admin/src/views/Hub.tsx:12),
                   testing (hard: useGardens public API change with no test update)
   Lenses skipped: principles, audit (no signals matched)
   ```

5. When only one lens fires with one soft signal, mention it but keep the finding count proportional — do not turn a narrow review into a deep audit.

## Review Model

This review uses two buckets.

### Agent-Fix-Now

These are mechanical or localized issues:

- broken imports
- obvious lint or type violations
- missing barrel usage
- missing nearby tests for narrow behavior
- clear invariant breaks with an obvious fix

### Human-Judge

These require deliberate ownership:

- new dependencies
- auth or permission changes
- migrations, backfills, or destructive operations
- contract upgrade or deployment behavior
- retry, fallback, or trust-boundary changes
- shared public API changes with cross-package impact

Do not blur these categories.

## Workflow

### 1. Confirm the Scope

Start by stating the resolved scope explicitly before inspecting anything:

```text
Review scope: [package(s) | PR #N | file set | full working tree]
Files in scope: [count] (packages touched: ...)
Review mode: report_only | verify_only | apply_fixes
```

If the resolved scope doesn't match the user's intent, ask before diving in. If the change is too large to review honestly (>800 LOC without a tight focus), say so and ask for a narrower scope.

### 2. Check Requirement Coverage

For requested work, map stated requirements to code changes.

If a requirement is clearly missing, lead with that. Do not bury requirement misses under style commentary.

### 3. Inspect High-Signal Risk Areas

Prioritize:

- correctness and runtime behavior
- shared boundary violations
- missing or misleading permission checks
- missing tests on changed behavior
- hidden fallback or error-swallowing behavior
- dependency or destructive-operation call-outs

### 4. Apply Green Goods Invariants

Check the diff against actual repo rules:

- hooks live in `@green-goods/shared`
- shared imports should prefer the barrel
- addresses come from deployment artifacts
- no package-level `.env` files
- use `bun run test`, not `bun test`
- user-facing strings need localization
- frontend work should use the established shared/admin primitives

### 5. Produce Findings Only if They Clear the Bar

A finding must have:

- a concrete file reference
- a clear explanation of why it matters
- a credible next step

Drop anything that is speculative, preference-based, or low-confidence.

## False-Positive Guardrails

- do not review the whole codebase when the request is a diff review
- do not report style preferences as findings
- do not elevate architectural taste into a blocker unless it violates a repo rule or creates concrete risk
- do not report "missing abstraction" unless the current diff creates repeated cost or confusion
- do not call out missing tests when the changed behavior is purely mechanical or non-behavioral
- do not report missing deployment addresses as a finding for undeployed new contract work by itself; classify as pending broadcast unless the deploy/persist/indexer-update path is missing, or unless broadcast was claimed and artifacts/config are still zero

## Output Contract

Lead with findings. Keep the list short enough to act on.

### Bucket Rules

- `Critical|High -> must-fix`
- `Medium -> should-fix`
- `Low -> nice-to-have`

Use this mapping in the final review output even when you keep the total number of findings small.

### Required Sections

1. **Summary** — what changed and blast radius
2. **Findings** — ordered by severity
3. **Human Call-Outs** — optional, only when needed
4. **What Looks Good** — positive anchors
5. **Verification** — what was run or what should run next
6. **Verdict** — `approve`, `request_changes`, or `comment_only`

Use this exact ordered output shape:

### Summary

What changed, blast radius, whether the review scope is trustworthy enough to judge, and which internal lenses fired (per the Lens Activation Matrix) with the triggering signals cited.

### Severity Mapping

- `Critical|High -> must-fix`
- `Medium -> should-fix`
- `Low -> nice-to-have`

### Must-Fix

High-confidence correctness, invariant, permission, migration, or reliability issues only.

### Should-Fix

Meaningful issues worth fixing in this change when they are not hard blockers.

### Nice-to-Have

Only low-risk suggestions with clear value. Keep this section short or omit its contents.

### Verification

State what was run, what was inspected, and what still needs confirmation.

### Recommendation

End with `APPROVE`, `REQUEST_CHANGES`, or `COMMENT_ONLY`.

### Finding Format

```text
[Title]
- Severity: critical | high | medium
- Type: correctness | invariant | testing | dependency | permissions | migration | reliability
- Evidence: file:line
- Why it matters: ...
- Next step: ...
```

### Severity Rules

- `critical` — broken behavior, security risk, or hard invariant violation
- `high` — likely regression, missing guard, or missing high-value test
- `medium` — meaningful cleanup or consistency issue worth fixing in this change

Use `comment_only` when the change mainly needs human judgment, not a hard block.

## GitHub Posting

Only post when PR context exists. For working-copy reviews or local diffs, return findings in chat instead of assuming GitHub output.

## Mode Notes

### `report_only`

Default. Produce findings and stop.

### `verify_only`

Use for cross-package verification when the main implementation is already done. Focus on blast radius, dependency order, and shared-surface impact.

### `apply_fixes`

Only when explicitly requested. Fix the `Agent-Fix-Now` bucket first. Re-review after changes. Do not auto-resolve human-judge call-outs.

## Anti-Patterns

- reviewing >800 LOC as if it were trustworthy and complete
- mixing broad codebase audits into a diff review
- giving long lists of low-confidence nits
- treating every review comment as equally urgent
- auto-fixing dependencies, permissions, or migrations without explicit approval

## Related Skills

- `architecture` — structural context when a finding is really a boundary issue
- `principles` — design judgment when a diff exposes deeper coherence problems
- `testing` — test strategy and focused verification
- `audit` — repo-health follow-up when a review reveals broader drift
