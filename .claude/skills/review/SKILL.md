---
name: review
description: Production-readiness review for a bounded Green Goods change. Use for PRs, branch diffs, working-copy changes, or cross-package changes. Proves regression safety, requirement closure, and production readiness before APPROVE while keeping findings high-confidence.
argument-hint: "[package|PR|file ...] [--mode readiness|report_only|verify_only|apply_fixes] [--scope cross-package]"
version: "3.0.0"
status: active
packages: ["all"]
# Lens dependencies: review folds these in when the diff exposes their signals
# (see § Internal Lenses + Lens Activation Matrix). Changing one changes review.
dependencies: ["architecture", "principles", "testing", "audit", "design"]
last_updated: "2026-07-12"
last_verified: "2026-07-12"
---

# Review Skill

Read-only review for Green Goods unless the user explicitly asks for a fix pass.

This skill exists to answer three questions with fresh evidence:

1. **Regression Safety** — did the change preserve behavior that must remain stable?
2. **Gap Closure** — does the bounded feature satisfy every authoritative requirement and applicable state?
3. **Production Readiness** — did the required validation and runtime/browser proof pass in this invocation?

`APPROVE` is a bounded, evidence-backed readiness verdict. It is not a claim that every unrelated
repository or production failure is impossible.

## Activation

Use when:

- the user asks for a review
- a PR, diff, or working-copy change needs structured findings
- a cross-package change needs a scoped verification pass

Invocation forms (all equivalent — pick whichever is easiest):

| Form | Example |
|------|---------|
| Slash + positional | `/review admin`, `/review shared admin`, `/review #123`, `/review packages/shared/src/hooks/garden/useGardens.ts` |
| Slash + flags | `/review admin --mode report_only`, `/review --scope cross-package --mode verify_only`, `/review admin --mode apply_fixes` |
| Slash + domain scope | `/review design-system`, `/review --mode verify_only --scope design-system` |
| Natural language | "review the shared package", "review the admin changes in this diff", "review PR 42", "review design-system alignment" |

## Scoping

Always resolve scope **before** inspecting code, and state the resolved scope in the Summary so the user can redirect.

### Resolution order

1. **Explicit positional arg(s)** — a package name, PR ref, or file path. Multiple allowed; they combine (union, not intersection).
2. **Natural-language scope** — "review the shared package", "review admin changes", "review PR 42". Resolve the same way as positional.
3. **Working-copy auto-inference** — when no scope given, run `git diff --name-only` against the merge-base and infer packages touched. Print the inferred scope. If nothing is staged/modified, ask the user what to review instead of guessing.

### Authoritative requirements

After resolving the code scope, establish the requirement baseline in this order:

1. the user's current request and explicit acceptance criteria
2. the PR description and any linked Linear issue
3. the Linear issue parsed from a conventional branch name
4. any `.plans/` lane referenced by the request, PR, or Linear issue — read its `brief.md`,
   `spec.md`, `plan.todo.md`, and `status.json` when present
5. directly applicable product or package documentation referenced by those sources

Record which sources were available. If no authoritative requirements can be established, or a
required source is unavailable, continue with useful findings but set the final recommendation to
`COMMENT_ONLY`; do not claim that no gaps remain.

### Linear context (when branch matches the Linear convention)

After scope resolution, if the current branch matches `<user>/<team-key>-<id>-<slug>` (e.g., `afo/prd-370-...`, `afo/resr-3-...`), pull the linked Issue via the Linear MCP and surface its title, acceptance criteria (if present in the body), and any `activity:*` labels in the Summary. Use this to focus the review — a branch tied to `activity:qa` should weight correctness; one tied to `activity:architecture` should weight boundaries. If the branch does not parse to a Linear ID, skip — do not block on it.

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
- Scope resolves to >800 LOC → split it into declared review batches and maintain a coverage ledger
  of reviewed and remaining files; do not narrow or imply completeness unless the user explicitly
  changes the scope

## Default Mode and Readiness Boundary

Plain `/review [scope]` runs `readiness`, the strict read-only default. It inspects the bounded
feature path and runs the non-mutating Review Readiness Gate from
[`validation-pipeline.md`](../../context/validation-pipeline.md).

The bounded feature path includes:

- changed implementation and tests
- direct callers and downstream package consumers affected by changed behavior or public surfaces
- applicable loading, error, empty, permission, offline, responsive, accessibility, migration,
  destructive-operation, and recovery states

This is not a whole-repo audit. Unrelated repository health remains owned by `audit`.

## Scope Lock

Default mode is read-only. Only switch into a fix flow when the user explicitly asks for one.

## What This Skill Owns

- bounded feature-path correctness and regression review
- authoritative requirement-to-evidence mapping
- repo-invariant checks against `CLAUDE.md` and `AGENTS.md`
- judgment routing: automatic fix candidates vs human call-outs
- fresh non-mutating production-readiness verification

## What This Skill Does Not Own

- dead-code or dependency audits across the full repo (`audit`)
- abstract design judgment detached from a concrete change (`principles`)
- full architecture mapping (`architecture`)

### Internal Lenses

Review folds in the `architecture`, `principles`, `testing`, `audit`, and `design` lenses *when the change exposes their signals* — not on every review. See the Lens Activation Matrix below for concrete trigger rules. Do not make the user switch commands unless they explicitly ask for a dedicated pass.

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
- Function mixes orchestration with low-level parsing, transport, or persistence detail (SLAP)
- Nested conditional depth ≥3 OR ternary chain ≥3 levels
- Abstraction (wrapper/adapter/util) added with only one call site
- Public interface grows by ≥2 new methods/properties
- New comment narrates what the code does, preserves edit history, or duplicates the implementation

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

**Soft signals** (do **not** fire this lens; apply the per-change
[`design/review-checklist.md`](../design/review-checklist.md) instead):

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
Review mode: readiness | report_only | verify_only | apply_fixes
Requirement sources: [request | PR | Linear | .plans | docs]
```

If the resolved scope doesn't match the user's intent, ask before diving in. For scopes over 800
LOC, declare review batches and keep this ledger current until every file is covered:

```text
| Batch | Files / feature path | Status | Notes |
|-------|----------------------|--------|-------|
| 1     | ...                  | REVIEWED | ... |
| 2     | ...                  | REMAINING | ... |
```

Any `REMAINING` row prevents `APPROVE`.

### 2. Pass One — Regression Safety

Identify:

- behavior intentionally changed
- existing behavior that must remain stable
- direct callers and downstream consumers of the changed surface
- regression tests that prove the bug or behavior boundary
- applicable rendered or runtime journey that automated tests do not prove

For a bug fix, missing regression coverage is a hard testing-lens signal. For visible UI, begin
from the rendered surface and verify state and interaction through the authenticated Brave path.

### 3. Pass Two — Gap Closure

Map every authoritative requirement to implementation and evidence. Use explicit statuses:
`SATISFIED`, `MISSING`, `BLOCKED`, or `OUT_OF_SCOPE`.

Then inspect applicable states across the bounded feature path: loading, error, empty, permission,
offline, responsive, accessibility, migration, destructive-operation, recovery, and localization.
Do not force irrelevant states into the review; mark them `N/A` with a short reason.

Any `MISSING` requirement produces `REQUEST_CHANGES`. Any `BLOCKED` requirement prevents
`APPROVE` and produces `COMMENT_ONLY` unless another finding already requires changes.

### 4. Pass Three — Production Readiness

Run the non-mutating Review Readiness Gate from
[`validation-pipeline.md`](../../context/validation-pipeline.md) in this invocation, including all
scope-conditional checks. Do not reuse stale evidence.

For visible UI, authenticated Brave proof is required. If authenticated Brave is unavailable,
record browser proof as `BLOCKED`; isolated Browser, Playwright, or DevTools profiles cannot
substitute for authenticated local QA or support `APPROVE`.

Use only `PASS`, `FAIL`, `BLOCKED`, or `N/A` for verification status. A required `FAIL` produces
`REQUEST_CHANGES`; a required `BLOCKED` produces `COMMENT_ONLY` unless code findings already
require changes.

### 5. Inspect High-Signal Risk Areas

Prioritize:

- correctness and runtime behavior
- shared boundary violations
- missing or misleading permission checks
- missing tests on changed behavior
- hidden fallback or error-swallowing behavior
- dependency or destructive-operation call-outs

### 6. Apply Green Goods Invariants

Check the diff against actual repo rules:

- hooks live in `@green-goods/shared`
- shared imports must use declared public export paths, never source internals
- addresses come from deployment artifacts
- no package-level `.env` files
- use `bun run test`, not `bun test`
- user-facing strings need localization
- frontend work should use the established shared/admin primitives
- production code should satisfy `.claude/context/values.md#implementation-quality-contract`

### 7. Produce Findings Only if They Clear the Bar

A finding must have:

- a concrete file reference
- a clear explanation of why it matters
- a credible next step

Drop anything that is speculative, preference-based, or low-confidence.

## False-Positive Guardrails

- do not review the whole codebase when the request is a diff review
- do not stop at changed lines when a changed behavior has affected callers or consumers
- do not report style preferences as findings
- do not elevate architectural taste into a blocker unless it violates a repo rule or creates concrete risk
- do not report "missing abstraction" unless the current diff creates repeated cost or confusion
- do not call out missing tests when the changed behavior is purely mechanical or non-behavioral
- do not report missing deployment addresses as a finding for undeployed new contract work by itself; classify as pending broadcast unless the deploy/persist/indexer-update path is missing, or unless broadcast was claimed and artifacts/config are still zero

## Output Contract

Use the exact evidence order below. Within the finding buckets, lead with the highest-severity
issue and keep the list short enough to act on.

### Bucket Rules

- `Critical|High -> must-fix`
- `Medium -> should-fix`
- `Low -> nice-to-have`

Use this mapping in the final review output even when you keep the total number of findings small.

### Required Sections

1. **Summary** — what changed, blast radius, requirement sources, lenses, and scope trustworthiness
2. **Requirements Coverage** — authoritative requirement-to-evidence mapping
3. **Regression Coverage** — changed behavior, preserved behavior, consumers, and proof
4. **Findings** — ordered by severity/action bucket
5. **Verification** — fresh readiness evidence with explicit statuses
6. **Recommendation** — strict `APPROVE`, `REQUEST_CHANGES`, or `COMMENT_ONLY`

Use this exact ordered output shape:

### Summary

What changed, blast radius, whether the review scope is trustworthy enough to judge, and which internal lenses fired (per the Lens Activation Matrix) with the triggering signals cited.

### Requirements Coverage

Map every authoritative requirement to its implementation and evidence. Use `SATISFIED`,
`MISSING`, `BLOCKED`, or `OUT_OF_SCOPE`. Cite the requirement source.

### Regression Coverage

State changed behavior, behavior that must remain stable, affected callers/consumers, regression
tests, rendered/runtime proof, and any remaining review batches.

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

Report every required readiness check as `PASS`, `FAIL`, `BLOCKED`, or `N/A`, with the command or
observable proof. Never place a future-tense "should run" item beside `APPROVE`.

### Recommendation

End with exactly one:

- `APPROVE` — all requirements are `SATISFIED`, the bounded scope and consumer path are fully
  reviewed, every required proof is `PASS`, and both Must-Fix and Should-Fix are empty
- `REQUEST_CHANGES` — a requirement is `MISSING`, required proof `FAIL`ed, or a must-fix or
  should-fix production-quality gap remains
- `COMMENT_ONLY` — requirements, scope, human judgment, or required proof are unavailable or
  `BLOCKED`, and no confirmed finding already requires changes

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

Human-judge call-outs remain visible. An unresolved judgment point prevents `APPROVE` and results
in `COMMENT_ONLY` unless it is already a confirmed production-quality defect.

## GitHub Posting

Only post when PR context exists. For working-copy reviews or local diffs, return findings in chat instead of assuming GitHub output.

## Mode Notes

### `readiness`

Default for plain `/review`. Run all three passes and the non-mutating Review Readiness Gate.
This is the only read-only mode that may return overall `APPROVE`.

### `report_only`

Produce requirements, regression, and code findings without requiring the Readiness Gate. A clean
report ends `COMMENT_ONLY`, never `APPROVE`; confirmed gaps still end `REQUEST_CHANGES`.

### `verify_only`

Use for cross-package verification when the main implementation is already done. Focus on blast
radius, dependency order, and shared-surface impact. As a standalone pass it ends `COMMENT_ONLY`
when green or `REQUEST_CHANGES` when evidence fails; only an enclosing `readiness` review may issue
overall `APPROVE`.

### `apply_fixes`

Only when explicitly requested. Fix the `Agent-Fix-Now` bucket first. Re-run the complete
`readiness` review after changes; only that fresh re-review may return `APPROVE`. Do not auto-resolve
human-judge call-outs.

## Anti-Patterns

- reviewing >800 LOC as if it were trustworthy and complete
- returning `APPROVE` with a remaining review batch, missing requirement, unresolved must-fix or
  should-fix, or required verification that is unrun or blocked
- treating isolated browser evidence as authenticated Brave proof
- mixing broad codebase audits into a diff review
- giving long lists of low-confidence nits
- treating every review comment as equally urgent
- auto-fixing dependencies, permissions, or migrations without explicit approval

## Related Skills

- `architecture` — structural context when a finding is really a boundary issue
- `principles` — design judgment when a diff exposes deeper coherence problems
- `testing` — test strategy and focused verification
- `audit` — repo-health follow-up when a review reveals broader drift
- `design` — per-change UI checklist and full design-system alignment routing
