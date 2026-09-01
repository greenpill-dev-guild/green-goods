---
name: resolve-pr-comments
description: Resolve actionable GitHub pull request review feedback with a validate, bounded-sweep, fix, targeted proof, push gate, and current-head CI workflow. Use when the user asks to address, fix, clear, or resolve unresolved PR review threads, requested changes on a pull request, review-level feedback, or GitHub PR comments. Make GitHub replies, reviews, reactions, and thread-resolution writes only with explicit authorization.
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
2. Fetch fresh PR metadata and record its state; base repository and branch; head repository owner,
   name, URL, and branch; cross-repository status; live head SHA; changed files; and local HEAD.
   Require the PR to be `OPEN` before classification or editing. Report a closed or merged PR as
   blocked; do not edit or publish commits to its former head branch.
3. Before editing, require the writable checkout to be the tracked PR head repository and branch at
   the exact live head SHA. Resolve the upstream fetch and push destinations to repository identity
   and require the push destination plus ref to match the PR head repository plus branch; a matching
   branch name or SHA on another remote is insufficient. Refuse to edit or publish directly from
   `main`, `master`, or `develop`. If the checkout is on another branch, tracks another repository,
   is detached, ahead, behind, or diverged, stop and request authorization to use an isolated
   writable checkout at the live head. Do not contaminate the current branch.
4. Establish the execution trust boundary before running repository-controlled code from the PR
   head. For a fork or otherwise untrusted head, first inspect changes to dependency manifests,
   lockfiles, package-manager configuration, hooks, workflows, agent instructions, and validation
   scripts. Run commands only in an isolated credential-free, network-restricted sandbox, or stop
   and report validation as blocked. Never expose local credentials to an untrusted PR head.
5. Inspect the working tree and index before editing. Preserve unrelated changes and do not unstage,
   overwrite, stash, or commit another session's work.
6. Establish an exact live-head inspection surface before classifying feedback. Use GitHub file
   contents addressed by the live SHA, `git show <live-head-sha>:<path>`, or an isolated clean
   snapshot at that SHA. Use the current checkout only after proving tree identity for every
   affected path and confirming those paths have no staged, unstaged, or untracked changes.
7. Treat descendant-only commits or working-tree changes as a separate, read-only observation until
   the branch mismatch is coordinated. Classify against the exact live-head tree first. An ancestry
   check alone is not proof of live-head behavior or authority to edit or push the descendant.

## 2. Validate each feedback item

Collect complete PR feedback from all applicable review surfaces:

- pull-request reviews with their state, body, author, submission time, and reviewed commit when
  available; collect and classify every non-empty submitted review body regardless of state, using
  `COMMENTED`, `APPROVED`, `CHANGES_REQUESTED`, later review state, and the PR's `reviewDecision` as
  classification context rather than eligibility filters;
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

After classification and scope lock, record a feedback snapshot that can detect review-only drift
without a head commit change. Include connection counts and pagination completion plus each item's
stable ID, state or resolution fields, latest reply or submission identity and time, and body
content or hash. A head SHA or connection cursor alone is not a feedback snapshot.

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
targeted proof and the ready-for-CI Push Gate pass. Critical surfaces retain their complete local
override. It does not authorize:

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
2. Use an isolated clean writable checkout, or prove the working tree and index contain only the
   approved feedback paths. Apply the credential-free sandbox requirement from phase 1 to every
   untrusted head.
3. Define the exact approved path allowlist, require an empty index, stage only those paths, and
   inspect the full cached diff. Select local proof from the union of the committed PR diff and every
   allowlisted staged, unstaged, and untracked path so new fixes cannot escape touched-surface
   detection.
4. If the selector identifies a critical surface, run its complete mandatory local override before
   publication. Do not run the full local Ship Gate for ordinary comment fixes merely because a
   commit or push is in scope.
5. For visible UI changes, obtain the required authenticated Brave rendered proof or report browser
   QA as blocked.
6. Repeat the root-cause search after all fixes. Any remaining approved manifestation keeps the
   feedback cluster open.
7. Re-read the changed code, require the allowlisted paths to have no unstaged or untracked changes,
   and record the tested index tree with `git write-tree`. Distinguish fixes present only in the
   tested index from fixes present in a commit or on the live PR head.

Failed or unavailable targeted proof keeps the affected actionable feedback cluster unresolved. A
failed or unavailable critical override blocks commit and push. Do not use compatibility flags,
receipts, `--no-verify`, or hook isolation to bypass a failed required check. Report the blocker,
fix it only when it is inside the locked scope, and do not claim readiness.

## 7. Publish, reply, and resolve safely

Unless the user asks to keep changes local, finish an existing-PR feedback task by committing and
pushing the scoped, proven fixes to the current tracked PR branch:

1. After targeted proof, re-fetch the PR and every feedback surface to pagination completion. Require
   it to remain open with the same base repository and branch, non-protected head repository and
   branch, and live head SHA used for classification. A base change alters the PR diff, changed-file
   sweep, and conditional validation scope even when the head is unchanged; stop and repeat the
   sweep, scope lock, fix, and affected proof if either base identity changes. Compare the new
   feedback snapshot with the locked ledger and reclassify every added or changed item. If a request
   was resolved, superseded, or revised, or new actionable feedback changes the locked scope, stop
   and repeat the sweep, scope lock, fix, and affected proof before committing. An unchanged head
   SHA does not prove stable feedback. Reconfirm the push destination, trust boundary, and
   tested-tree invariants from phases 1 and 6. Stop if the remote advanced or any invariant changed.
2. Re-inspect `git diff --cached --name-only` and the full cached diff. Require every staged path and
   hunk to belong to the locked feedback scope and require `git write-tree` to equal the tested tree;
   stop on any extra path, mixed-ownership hunk, or tree drift.
3. Create a conventional commit from that verified index while preventing repository-controlled
   hooks from executing with publication credentials. Use a command-scoped `core.hooksPath` that
   points to a freshly created, verified-empty directory outside the PR tree; never change persistent
   Git configuration. This is execution isolation, not a validation bypass: phase 6 must already have
   run and passed its targeted proof and any critical override. Compare `git rev-parse HEAD^{tree}` with the
   tested tree after the guarded commit; stop on any mismatch and repeat proof at the new tree.
4. Run the post-commit Ready-for-CI Push Gate with
   `node scripts/dev/ci-local.js --intent push --reuse-passing-receipts` and the direct
   `--test-path <surface>:<path>` proof. `needs-focus`, `budget-exceeded`, a failed check, or a blocked
   critical override stops publication. An exact pass may be reused by the pre-push hook.
5. Immediately before pushing, repeat the complete feedback-delta check from step 1 and require the
   ledger and locked scope to remain valid. Revalidate the commit tree, live head SHA, remote
   repository identity, URL, and target ref. Push normally to that verified destination with the
   same command-scoped empty hook path so a repository-controlled pre-push hook cannot execute with
   credentials. Never use `--no-verify`, force-push, rewrite history, switch branches, create another
   branch, or open another PR without explicit authorization.
6. Fetch the PR head again and record the pushed SHA. A local commit or successful `git push` message
   alone is not proof that the live PR contains the fix.
7. Wait for required GitHub CI on that pushed SHA. Pending, missing, or unavailable CI keeps the
   publication result blocked/comment-only; a broad local fallback cannot substitute for approval.

GitHub replies, reactions, thread resolution, and review submission remain separate conversational
writes. Perform them only when the user explicitly authorizes them.

Before resolving an inline thread:

1. Confirm the fix is present on the live PR head, not only locally.
2. Re-fetch the thread and ensure no newer reply or head change invalidates the conclusion.
3. Summarize the root cause, bounded sweep, affected paths, and validation evidence concisely.
4. Resolve only `ACTIONABLE` threads whose exact manifestation is fixed and proven, `DUPLICATE`
   threads whose own manifestation is fixed and proven or absent at the live head, or `STALE`
   threads whose underlying concern is proven absent there. Fixing the canonical root-cause instance
   alone is not proof for a duplicate manifestation; leave an unfixed out-of-scope duplicate open.
   Resolve an explanation-only thread only after either the original reviewer accepts or dismisses
   the explanation in a newer GitHub reply or review, or the user explicitly directs closure after
   receiving the exact explanation and live-head evidence. General authorization to resolve
   comments is not acceptance evidence. Leave `RESOLVED` threads untouched.

Leave ambiguous, conflicting, out-of-scope, and unverified feedback open or unaddressed. Never use
thread resolution to hide a deferred finding.

Review submissions and top-level PR conversation comments do not have review-thread resolution
state. Report them as addressed only after the fix is present and proven on the live PR head. Reply
only with explicit authorization, and leave the requested-changes decision for the reviewer to
update through a subsequent review.

## Output contract

Report:

1. PR number, base and head repositories and branches, live head SHA, and execution-trust decision.
2. Feedback ledger with source, classification, and root-cause clusters.
3. Sweep boundary, affected paths, and checked-unaffected paths.
4. Fixes made and regression coverage added.
5. Exact validation run, tested index tree, committed-tree comparison, results, and any blocked proof.
6. Feedback still open or unaddressed and why.
7. Commit SHA, verified push repository and ref, and verified live PR head, or why publication was
   blocked or declined.
8. GitHub conversational writes performed, or an explicit statement that none were performed.
