---
name: resolve-pr-comments
description: Resolve actionable GitHub pull request review feedback with a validate, bounded-sweep, fix, proof, and publish workflow. Use when the user asks to address, fix, clear, or resolve unresolved PR review threads, requested changes on a pull request, review-level feedback, or GitHub PR comments. Confirm feedback against the current PR head, search the changed scope and direct consumers for the same root-cause class, fix approved instances, prove recurrence is closed, then commit and push scoped fixes to the existing PR branch by default after the full Ship Gate passes. Make GitHub replies, reviews, reactions, and thread-resolution writes only with explicit authorization.
---

# Resolve PR Comments

Address PR feedback as evidence of a possible failure class, not as an isolated line edit.

Follow this sequence:

`VALIDATE -> SWEEP -> LOCK -> FIX -> PROVE -> PUBLISH -> RESOLVE`

Apply the Implementation Quality Contract in
[`values.md`](../../context/values.md#implementation-quality-contract), the behavior-proof rules in
[`testing.md`](../../context/testing.md#regression-and-tooling-closure), and the validation rung
selected from [`validation-pipeline.md`](../../context/validation-pipeline.md).

## 1. Resolve the live PR state

1. Resolve the repository and PR from the supplied URL or number. For current-branch requests,
   resolve the PR from local Git and GitHub metadata.
2. Fetch fresh PR metadata and record its state, base branch, head branch, live head SHA, changed
   files, and local HEAD. Require the PR to be `OPEN` before classification or editing. Report a
   closed or merged PR as blocked; do not edit or publish commits to its former head branch.
3. Before editing, require the writable checkout to be the tracked PR head branch at the exact live
   head SHA. Refuse to edit or publish directly from `main`, `master`, or `develop`. If the checkout
   is on another branch, detached, ahead, behind, or diverged, stop and request authorization to use
   an isolated writable checkout at the live head. Do not contaminate the current branch.
4. Inspect the working tree and index before editing. Preserve unrelated changes and do not unstage,
   overwrite, stash, or commit another session's work.
5. Establish an exact live-head inspection surface before classifying feedback. Use GitHub file
   contents addressed by the live SHA, `git show <live-head-sha>:<path>`, or an isolated clean
   snapshot at that SHA. Use the current checkout only after proving tree identity for every
   affected path and confirming those paths have no staged, unstaged, or untracked changes.
6. Treat descendant-only commits or working-tree changes as a separate, read-only observation until
   the branch mismatch is coordinated. Classify against the exact live-head tree first. An ancestry
   check alone is not proof of live-head behavior or authority to edit or push the descendant.

## 2. Validate each feedback item

Collect complete PR feedback from all applicable review surfaces:

- pull-request reviews with their state, body, author, submission time, and reviewed commit when
  available; treat non-empty `CHANGES_REQUESTED` bodies as candidate actionable feedback and use
  later review state plus the PR's `reviewDecision` to detect superseded or dismissed requests;
- inline `reviewThreads` with `isResolved`, `isOutdated`, file and line anchors, the diff hunk, and
  every reply;
- top-level PR conversation comments that contain actionable review feedback.

Use the available GitHub connector when it exposes these fields; otherwise use `gh api graphql`.
Paginate every connection until `hasNextPage` is false, including reviews, review threads,
conversation comments, and nested thread replies. With `gh api graphql`, paginate each connection
independently using `--paginate` with an `$endCursor` variable and
`pageInfo { hasNextPage endCursor }`, or use an equivalent explicit cursor loop. Record item counts
and pagination completion. A flat list, first page, or unproven connector page is not sufficient for
a complete ledger; report retrieval as blocked instead of silently omitting later feedback.

For inline review feedback, classify `isResolved: true` threads as `RESOLVED` before evaluating the
underlying code. Do not reopen or modify an accepted decision unless the user explicitly asks to
revisit resolved feedback.

Classify every remaining feedback item:

- `RESOLVED`: GitHub already records the inline thread as resolved; exclude it from actionable work.
- `ACTIONABLE`: the issue still exists at the live PR head and the requested outcome is coherent.
- `STALE`: exact live-head inspection proves the underlying concern is absent. An outdated, moved, or
  missing diff anchor is only a relocation signal and is never sufficient by itself.
- `SUPERSEDED`: a later authoritative review or comment explicitly replaces or dismisses the request.
- `DUPLICATE`: another feedback item describes the same root-cause class.
- `INFORMATIONAL`: no code or response change is requested.
- `UNSUPPORTED`: current code, behavior, or repository requirements do not support the claimed issue.
- `AMBIGUOUS`: the expected behavior or requested change is unclear.
- `CONFLICTING`: the request conflicts with authoritative requirements, another feedback item, or
  a repository invariant.

For an alleged defect, inspect or reproduce the behavior before accepting the proposed fix. Treat
the feedback as evidence, not authority. When the root cause is unclear, use the repository's debug
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
unresolved actionable feedback item.

Interpret "fix all comments" as authorization to fix all `ACTIONABLE` feedback items and their
approved in-scope sibling instances. On a safe existing PR branch, it also authorizes staging only
the scoped files, creating a conventional commit, and pushing normally to that tracked branch after
the full Ship Gate passes. It does not authorize:

- ambiguous or conflicting changes;
- unrelated repository cleanup;
- material scope expansion outside the PR's intent;
- creating or switching branches, creating another PR, rewriting history, or force-pushing;
- GitHub replies, reviews, reactions, or thread resolution.

Surface ambiguity or scope expansion for a human decision. Keep resolved, stale, superseded,
duplicate, informational, and unsupported feedback in the ledger so the outcome remains traceable.

## 5. Fix the approved failure classes

1. Add negative or boundary coverage for the original trigger when behavior changed. If a test is
   genuinely inapplicable, record the concrete proof substitute.
2. Fix the root cause and every approved in-scope manifestation found by the sweep.
3. Keep each change traceable to a feedback item or cluster.
4. Prefer the smallest behavior-complete change and avoid opportunistic refactors.
5. Draft a response instead of forcing a code change when the feedback only needs explanation.

Do not resolve a thread merely because a local edit exists.

## 6. Prove closure

1. Run the lightest honest targeted proof for the touched behavior.
2. When commit or push is in scope, also run the full Ship Gate from
   [`validation-pipeline.md`](../../context/validation-pipeline.md), including every conditional
   addition for the touched surfaces. Every required stage must pass in the current invocation
   before committing or pushing.
3. For visible UI changes, obtain the required authenticated Brave rendered proof or report browser
   QA as blocked.
4. Repeat the root-cause search after all fixes. Any remaining approved manifestation keeps the
   feedback cluster open.
5. Re-read the changed code and record the exact tested state. Distinguish fixes present only in the
   local working tree from fixes present on the live PR head.

Failed or unavailable targeted proof keeps the affected actionable feedback cluster unresolved. A
failed or unavailable Ship Gate blocks commit and push even when the failure appears unrelated or
environmental. Do not bypass a failed pre-push hook with `--no-verify`. Report the blocker, fix it
only when it is inside the locked scope, and do not claim ship readiness.

## 7. Publish, reply, and resolve safely

Unless the user asks to keep changes local, finish an existing-PR feedback task by committing and
pushing the scoped, proven fixes to the current tracked PR branch:

1. Re-fetch the PR and require it to remain open with the same non-protected head branch and live
   head SHA used for classification. Stop if the remote advanced or any branch invariant changed.
2. Define the exact path allowlist for the approved feedback clusters before staging. If
   `git diff --cached --name-only` already contains unrelated paths, stop or move the work to an
   authorized isolated checkout. Never unstage another session's work to make the index appear safe.
3. Stage only the allowlisted paths, then inspect `git diff --cached --name-only` and the full cached
   diff. Require every staged path and hunk to belong to the locked feedback scope; stop on any
   extra path or mixed-ownership hunk.
4. Create a conventional commit from that verified index, then push normally to the tracked PR head
   branch. Never use `--no-verify`, force-push, rewrite history, switch branches, create another
   branch, or open another PR without explicit authorization.
5. Fetch the PR head again and record the pushed SHA. A local commit or successful `git push` message
   alone is not proof that the live PR contains the fix.

GitHub replies, reactions, thread resolution, and review submission remain separate conversational
writes. Perform them only when the user explicitly authorizes them.

Before resolving an inline thread:

1. Confirm the fix is present on the live PR head, not only locally.
2. Re-fetch the thread and ensure no newer reply or head change invalidates the conclusion.
3. Summarize the root cause, bounded sweep, affected paths, and validation evidence concisely.
4. Resolve only `ACTIONABLE` threads that are fixed and proven, `DUPLICATE` threads whose canonical
   failure class is fixed and proven, `STALE` threads whose underlying concern is proven absent at
   the live head, or threads closed by an explicit, accurate explanation accepted by the requested
   workflow. Leave `RESOLVED` threads untouched.

Leave ambiguous, conflicting, out-of-scope, and unverified feedback open or unaddressed. Never use
thread resolution to hide a deferred finding.

Review submissions and top-level PR conversation comments do not have review-thread resolution
state. Report them as addressed only after the fix is present and proven on the live PR head. Reply
only with explicit authorization, and leave the requested-changes decision for the reviewer to
update through a subsequent review.

## Output contract

Report:

1. PR number and live head SHA reviewed.
2. Feedback ledger with source, classification, and root-cause clusters.
3. Sweep boundary, affected paths, and checked-unaffected paths.
4. Fixes made and regression coverage added.
5. Exact validation run, results, and any blocked proof.
6. Feedback still open or unaddressed and why.
7. Commit SHA, push result, and verified live PR head, or why publication was blocked or declined.
8. GitHub conversational writes performed, or an explicit statement that none were performed.
