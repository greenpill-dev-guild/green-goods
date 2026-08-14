---
name: resolve-pr-comments
description: Resolve actionable GitHub pull request review feedback with a validate, bounded-sweep, fix, and proof workflow. Use when the user asks to address, fix, clear, or resolve unresolved PR review threads, requested changes, or inline GitHub comments. Confirm comments against the current PR head, search the changed scope and direct consumers for the same root-cause class, fix approved instances, prove recurrence is closed, and write back to GitHub only with explicit authorization.
---

# Resolve PR Comments

Address PR feedback as evidence of a possible failure class, not as an isolated line edit.

Follow this sequence:

`VALIDATE -> SWEEP -> LOCK -> FIX -> PROVE -> RESOLVE`

Apply the Implementation Quality Contract in
[`values.md`](../../context/values.md#implementation-quality-contract), the behavior-proof rules in
[`testing.md`](../../context/testing.md#regression-and-tooling-closure), and the validation rung
selected from [`validation-pipeline.md`](../../context/validation-pipeline.md).

## 1. Resolve the live PR state

1. Resolve the repository and PR from the supplied URL or number. For current-branch requests,
   resolve the PR from local Git and GitHub metadata.
2. Fetch fresh PR metadata and record the base branch, live head SHA, changed files, and local HEAD.
   Do not rely on an earlier comment snapshot or a stale local checkout.
3. Inspect the working tree before editing. Preserve unrelated changes and remain on the current
   branch unless the user explicitly authorizes a branch change.
4. Verify that local HEAD contains the live PR head. If it is stale or unexpectedly diverged, stop
   before editing or resolving threads and explain the mismatch. A local descendant may be fixed,
   but its changes remain local-only until the live PR head advances. Do not silently switch branches.

## 2. Validate each review thread

Read thread-aware review data that preserves `isResolved`, `isOutdated`, file and line anchors, the
diff hunk, and replies. Use the available GitHub connector when it exposes those fields; otherwise
use `gh api graphql`. A flat list of comments is not sufficient evidence of unresolved thread state.

Classify every thread:

- `ACTIONABLE`: the issue still exists at the live PR head and the requested outcome is coherent.
- `STALE`: later code or an outdated diff anchor already removed the issue.
- `DUPLICATE`: another thread describes the same root-cause class.
- `INFORMATIONAL`: no code or response change is requested.
- `UNSUPPORTED`: current code, behavior, or repository requirements do not support the claimed issue.
- `AMBIGUOUS`: the expected behavior or requested change is unclear.
- `CONFLICTING`: the request conflicts with authoritative requirements, another review comment, or
  a repository invariant.

For an alleged defect, inspect or reproduce the behavior before accepting the proposed fix. Treat
the comment as evidence, not authority. When the root cause is unclear, use the repository's debug
workflow before editing.

## 3. Sweep the root-cause class

For each actionable feedback cluster:

1. Name the root-cause class and the violated invariant, contract, or requirement.
2. Search semantically, not only for the exact commented text.
3. Sweep the bounded default scope:
   - the PR's changed files;
   - sibling implementations in the touched package;
   - direct consumers of the changed API, type, component, hook, or contract;
   - relevant tests, locales, schemas, configuration, or generated projections when the invariant
     crosses those surfaces.
4. Record affected paths and checked-unaffected paths. Never turn a bounded sweep into a claim that
   the entire repository is safe.
5. Separate manifestations inside the PR's intent from adjacent findings that would materially
   expand scope. Report the latter and request approval before fixing them.

Do not widen an intentionally unsupported product, security, deployment, or authorization boundary
just because a similar code shape exists.

## 4. Lock the fix scope

Present a numbered ledger before editing unless the user already explicitly asked to fix every
unresolved actionable thread.

Interpret "fix all comments" as authorization to fix all `ACTIONABLE` threads and their approved
in-scope sibling instances. It does not authorize:

- ambiguous or conflicting changes;
- unrelated repository cleanup;
- material scope expansion outside the PR's intent;
- commits, pushes, GitHub replies, reviews, or thread resolution.

Surface ambiguity or scope expansion for a human decision. Keep stale, duplicate, informational,
and unsupported threads in the ledger so the final outcome remains traceable.

## 5. Fix the approved failure classes

1. Add negative or boundary coverage for the original trigger when behavior changed. If a test is
   genuinely inapplicable, record the concrete proof substitute.
2. Fix the root cause and every approved in-scope manifestation found by the sweep.
3. Keep each change traceable to a thread or feedback cluster.
4. Prefer the smallest behavior-complete change and avoid opportunistic refactors.
5. Draft a response instead of forcing a code change when the comment only needs explanation.

Do not resolve a thread merely because a local edit exists.

## 6. Prove closure

1. Run the lightest honest validation rung for the touched behavior. Escalate proof for shared,
   cross-package, critical, or ship-readiness changes according to the repository ladder.
2. For visible UI changes, obtain the required authenticated Brave rendered proof or report browser
   QA as blocked.
3. Repeat the root-cause search after all fixes. Any remaining approved manifestation keeps the
   feedback cluster open.
4. Re-read the changed code and record the exact tested state. Distinguish fixes present only in the
   local working tree from fixes present on the live PR head.

Failed or unavailable proof keeps the affected actionable feedback cluster unresolved.

## 7. Reply and resolve safely

Reply on GitHub, resolve threads, submit a review, commit, or push only when the user explicitly
authorizes that write action.

Before resolving a thread:

1. Confirm the fix is present on the live PR head, not only locally.
2. Re-fetch the thread and ensure no newer reply or head change invalidates the conclusion.
3. Summarize the root cause, bounded sweep, affected paths, and validation evidence concisely.
4. Resolve only `ACTIONABLE` threads that are fixed and proven, `DUPLICATE` threads whose canonical
   failure class is fixed and proven, or threads closed by an explicit, accurate explanation
   accepted by the requested workflow.

Leave ambiguous, conflicting, out-of-scope, and unverified threads open. Never use thread resolution
to hide a deferred finding.

## Output contract

Report:

1. PR number and live head SHA reviewed.
2. Thread ledger with classification and root-cause clusters.
3. Sweep boundary, affected paths, and checked-unaffected paths.
4. Fixes made and regression coverage added.
5. Exact validation run, results, and any blocked proof.
6. Threads still open and why.
7. GitHub writes performed, or an explicit statement that none were performed.
