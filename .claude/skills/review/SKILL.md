---
name: review
description: Review a change for regressions, unfinished requirements, and readiness in one pass, ending in a verdict. Use when asked to review a PR, branch, working copy, package, or files, or asked "any regressions?", "remaining gaps?", or "is this ready / production quality?".
argument-hint: "[package|PR#|file ...] [--fix] [--scope cross-package|design-system]"
user-invocable: true
---

# Review

## Adapter

Read `.agents/adapter.md` at the repository root: section `## review`, plus `## checks` for commands. If the file, a section, or a field is missing, say so in one line and use the defaults written as "(default: ...)". Adapter fields are the bold names that follow `## checks` or carry a "(default: ...)". Without `## checks`, take commands from the repository's package scripts, Makefile, or CI config, name the ones you used, and treat auth, payment, and deploy code as critical.

## Overview

Three passes over one resolved scope, then a verdict: regression safety (Pass 1), requirement closure (Pass 2), and the evidence or readiness level the user asked for (Pass 3). Read-only unless the user asks for `--fix`. `APPROVE` is a bounded verdict for the reviewed scope, not a claim that unrelated failures are impossible. This skill judges a resolved change; repository-wide architecture opportunity discovery belongs to `plan`.

## Scope and intent

Resolve scope before reading code and state it in the Summary so the user can redirect.

1. Explicit arguments (packages, a PR, paths) combine as a union. Map names through **Scopes** (default: top-level packages and folders).
2. Natural language: "review the shared package", "review PR 42".
3. No scope: `git diff --name-only` against the merge-base with `## checks` **Base** (default: the PR base, else the default branch); infer the touched packages and print the scope. Nothing changed: ask what to review.

`--scope cross-package` checks blast radius along **Dependency order** (default: the import graph) and reports only cross-boundary findings. Other `--scope` values come from **Special scopes** (default: none).

Resolve intent separately from scope:
- **Evidence review** (the default): "review this", regressions, gap analysis, audit evidence, a specific question. Inspect first, then run only the non-mutating checks that prove findings. A clean evidence review returns `COMMENT_ONLY`.
- **Readiness**: only on an explicit request for production quality, approval, or PR or merge readiness. A live PR combines direct local evidence with required CI at the current head SHA. Offline or full-local readiness runs the `readiness` tier. Critical surfaces add their mandatory override.

Plan the checks with `## checks` **Selector** for the matching intent and run that plan (default: choose tiers from the Pass 3 ladder). If the selector fails or is unavailable, follow `## checks` **Guide** directly, report the selector problem, and keep every hard gate.

## Requirements baseline

Establish, in order: (1) the user's request and acceptance criteria; (2) the PR description and the issue it links (**Requirement sources**; default: issues linked in the PR body); (3) plan documents the request, PR, or issue references; (4) package docs those sources reference. Never infer the issue from the branch name. Record which sources existed. With none, keep reviewing, but the verdict is `COMMENT_ONLY` and you may not claim that no gaps remain.

Over 800 changed lines: split into declared batches and keep a coverage ledger of reviewed and remaining files. Package, lane, or pinned-range reviews are supporting evidence only; a PR-wide verdict covers the exact union of changed files from the base through the declared upper bound, trailing commits included. If the review is pinned below HEAD, prove the relevant tree is identical before using checkout lines or results. Never silently extend or narrow the range.

## Pass 1: Regressions

Correctness of what changed. Hunt first in: runtime behavior and edge cases on changed paths; permission checks or shared boundaries moved, wrapped, or removed; hidden fallbacks and swallowed errors (a `catch` with no handling path); retry, trust-boundary, migration, or destructive-operation changes; missing or misleading tests (a bugfix with no regression test, a public API change with no test update).

Check the diff against **Invariants** (default: the rules in the repository and nearest package agent guides).

Structural lenses fire on a signal in the diff, never as ritual:
- **Placement**: a module outside its owning package, a first cross-package import, a layering break against **Dependency order**, a public surface turning into a junk drawer. Prefer the smallest structural fix; never prescribe a new layer without a deletion story.
- **Coherence**: a wrapper with one call site and no concrete pressure; a near-duplicate, flagged only when divergence creates real maintenance risk; a function gathering unrelated concerns. Size is not harm: before recommending an abstraction, name the concrete failure or repeated cost and say where complexity returns under the deletion test. Leaf exports can improve graph control without proving module depth. Judge against **Quality bar** (default: the repository agent guide).
- **Reuse**: when the change adds components or helpers, or moves module shape, public exports, dependency direction, composition, or test seams, read **Architecture guide** (default: none) and check the reuse evidence: closest existing implementation, actual behavior gap, capability owner. Unjustified duplicates, misplaced general helpers, and pass-through layers are design gaps; passing graph checks do not settle module depth or seam placement.
- **State**: on **State lens** triggers (default: state machines, retry or grace windows, asynchronous projections, persisted storage layouts), build the risk matrix it names and exercise role overlaps, terminal cleanup, time boundaries, and dependency generations. A prose lifecycle summary is not proof.
- **Critical surface** (`## checks` **Criticality**): read every touched line and apply the lens **Critical lenses** names for it (default: security for auth, money, and deploy code; failure handling for mutations and queues).
- **Excess proof**: when tests change, name the distinct failure each test catches and check that its assertion sits at the owning layer, within **Test budget** (default: none). Reject tests that assert only what their own mocks supply, and repeats across layers with no distinct failure. Keep independent composition, recovery, interaction, and critical cleanup proof. Accept a test deletion only with surviving proof of the same failure or verified absence of callers; counts and line ratios alone never justify one.

For a large or critical diff that warrants an adversarial deep pass, use **Deep pass** (default: do it by hand) and say so.

**Safety facts** (cross-package and critical reviews): pick the one or two invariants whose failure would invalidate the change. Report each as Fact, Consumers, Proof level, and Evidence and limit. Proof levels, by what was actually obtained: `REFERENCED` (claimed by source or docs), `PATH_TRACED` (call or data path followed), `DEPENDENCY_WALKED` (direct consumers checked), `EXECUTED` (targeted check passed), `LIVE_OBSERVED` (runtime or rendered surface seen). Levels describe, they are not a ladder to climb: use the level the intent requires, never promote a fact on indirect evidence, and turn a missing required proof into a finding, gap, or blocker.

## Pass 2: Remaining gaps

Map every requirement to implementation and evidence: `SATISFIED`, `MISSING`, `BLOCKED`, or `OUT_OF_SCOPE`. Any `MISSING` gives `REQUEST_CHANGES`; any `BLOCKED` prevents `APPROVE` and gives `COMMENT_ONLY` unless other findings already require changes.

Then sweep the recurring gap shapes, leading with requirement misses:
- a requirement present in intent but absent or half-wired in code;
- a reachable UI state with no entry wired, or wired but dead;
- changed behavior with no test;
- unhandled error, empty, or loading states on touched views;
- TODO, FIXME, or HACK introduced by this change, or commented-out code left behind;
- docs or guides the change invalidated (renamed commands, new environment variables);
- every shape in **Gap shapes** (default: none).

A gap is unfinished intent, not a defect: report gaps in their own section.

## Pass 3: Evidence or readiness

Evidence review runs only the planned non-mutating checks needed to prove or disprove findings; add no suites to look thorough. Explicit offline or full-local readiness runs the `readiness` tier and `## checks` **Conditional checks**, plus the critical override. A required stage that fails gives `REQUEST_CHANGES`; one that cannot run gives `COMMENT_ONLY`, never a silent downgrade or substitute.

Live PR readiness inspects every required workflow at the PR's current head SHA (`## checks` **CI**). Green CI is the broad regression authority. Pending, missing, stale-SHA, or unavailable CI gives `COMMENT_ONLY`; a failure gives `REQUEST_CHANGES`. A local full suite never stands in for pending CI.

Pick the lightest honest tier for narrower intents: isolated fix → `targeted`; cross-package or shared surface → `checkpoint`; live PR approval → direct local evidence plus current-head CI; offline readiness → `readiness` plus conditional checks; critical work → the mandatory override.

For each check, name its risk, expected signal, freshness rule, and stop condition, and report what ran with real output. Keep a **receipt** per run: tested commit SHA, UTC time, exact command, summarized result. Claim green, passed, or merge-ready only after the command finished in this review and `git status --porcelain=v1 --untracked-files=all -- <validated paths>` is empty. An evidence-only follow-up may cite its tested parent only with a recorded `git diff --exit-code <tested>..HEAD -- <validated paths>` covering implementation, dependency, configuration, and validation-entrypoint paths, plus that empty status.

A check that cannot run here is `BLOCKED`: name the missing capability and do not retry until it changes. Advisory checks that `## checks` names stay pending, not blocked. User cancellation is terminal: stop, schedule nothing more, and report the evidence already collected. Visible UI claims need rendered proof labeled by engine and session (`## checks` **Rendered proof**); never present one proof class as another. Records listed in **Immutable records** (default: none) are audit inputs: put corrections or closure evidence in a new record.

## Finding closure

Treat each confirmed finding as a possible failure class, not one line. In a read-only review, steps 3 to 5 are closure criteria for the author; run them yourself only under `--fix`, or verify evidence the author supplied.
1. Name the root-cause class and the invariant or rule it breaks.
2. Search the changed scope and its direct consumers for siblings; record affected and checked-unaffected paths so absence claims stay bounded.
3. Add negative or boundary coverage that fails for the original trigger, or state the concrete proof substitute when a test cannot apply.
4. Rerun the relevant validation at the current SHA before resolving.
5. After all fixes, sweep once more for every approved root-cause class.

An explicit product or security boundary (an unsupported payment rail, an unauthenticated receipt, a secret-sharing path, a deployment phase) stays a boundary unless the requirements change it: test or document the rejection instead of building the capability.

## False positives

Keep a diff review to the diff: no repository audit, no style preferences, no low-confidence hunches. Flag a missing abstraction only when the diff creates repeated cost now. Skip test demands for mechanical, non-behavioral edits. Skip everything in **Not findings** (default: none). Every finding needs file:line evidence, why it matters, and a credible next step; drop the rest.

## Output

1. **Summary**: scope, blast radius, lenses fired with their triggering signal, requirement sources used, and safety facts when required.
2. **Must-Fix** (critical, high), **Should-Fix** (medium), **Nice-to-Have** (low, kept short).
3. **Remaining Gaps**: each with the smallest completing step.
4. **Human Call-Outs**: dependencies, auth and permissions, migrations, deploys, trust-boundary changes. Never auto-fix these.
5. **Verification**: what ran, real results, what remains unverified.
6. **Verdict**: `APPROVE`, `REQUEST_CHANGES`, or `COMMENT_ONLY`. A `MISSING` requirement or failed required check gives `REQUEST_CHANGES`. `BLOCKED`, no requirement sources, evidence-only intent, or pending or unavailable current-head CI gives `COMMENT_ONLY`. `APPROVE` needs explicit readiness intent, every requirement `SATISFIED` or `OUT_OF_SCOPE`, applicable local proof passed, and required CI green at the current SHA; offline readiness also needs the complete `readiness` tier with fresh receipts, and critical reviews the mandatory override.

Finding format: `[Title] · severity · type · file:line · why it matters · next step`.

## --fix

Only on explicit request ("fix the findings", `--fix`). Report first. Group approved Must-Fix and Should-Fix items by root-cause class and address at most three classes per iteration; leave Nice-to-Have items and every Human Call-Out alone. Finish the sibling and recurrence sweeps, then rerun the Pass 3 tier and `## checks` **Conditional checks** for touched surfaces.

## Tracking and posting

Review output stays in chat. When the user accepts findings for tracking, follow **Tracker** (default: the repository's tracker) and ask before creating anything. Post to a PR only when PR context exists and the user asks.
