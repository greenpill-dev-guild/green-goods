---
name: ship
user-invocable: false
description: Publish changes safely with targeted local proof, a budgeted push gate, and current-head GitHub CI. Runs the explicit full local gate only for offline/full-readiness requests, critical surfaces, or releases.
argument-hint: "[--dry-run] [--no-commit] [--pr] [--full-local]"
---

# Ship Skill

Publish Green Goods changes without duplicating CI locally. Ordinary work proves the changed
behavior, passes the ready-for-CI push gate, and lets GitHub CI own broad regression coverage and
merge approval. Critical and release work retain the complete local override.

## Iron law

```
NO READINESS CLAIM WITHOUT FRESH EVIDENCE FOR THE CURRENT SHA
```

For ordinary publication, fresh evidence means targeted behavior proof, the post-commit Push Gate,
and required GitHub CI green for the PR's current head SHA. Pending, missing, stale-SHA, or
unavailable CI is `BLOCKED`; a local full-suite run is not a substitute for PR approval.

For critical surfaces, releases, or an explicit offline/full-local readiness request, fresh
evidence also includes the complete local Ship Gate from
[`validation-pipeline.md`](../../context/validation-pipeline.md).

## Activation

| Trigger | Action |
|---|---|
| “commit”, “push”, or “open a PR” | Targeted proof → commit → Push Gate → push/PR → current-head CI |
| “ready to ship” or `--full-local` | Full local Ship Gate, then the publication flow |
| Critical or release surface | Mandatory full local override, then the publication flow |
| “dry-run ship check” | Selected validation only; no commit, push, or PR |

Do not activate this skill for "QA mode", "quick fix", "get this to staging", or similar requests
unless the user also asks to commit, open a PR, merge, release, or prove the branch is ready.
QA-only requests stay in QA Speed Mode and do not activate publication.

## 1. Resolve branch and comparison base

Confirm the branch, worktree, staging area, and remote before validation:

```bash
git rev-parse --abbrev-ref HEAD
node scripts/quality/branch-name-policy.mjs "$(git branch --show-current)"
git status --short
git remote -v
```

Use the live PR base branch when one exists. Otherwise use `origin/develop`. Fetch the resolved base
before computing the change set, then inspect commits and diff against that base. Never assume
`origin/main`.

Stop on a detached HEAD, `main`, `master`, or `develop`; an invalid branch name; credential-like
files; a staged file larger than 5 MB without confirmation; unrelated working-tree changes that
overlap the publication scope; or no actual change to publish.

For PR creation, never infer Linear linkage from the branch. Use exactly one explicit reference in
the PR body when an issue exists: `Fixes PRD-NNN`, `Refs PRD-NNN`, or `Relates to PRD-NNN`.

## 2. Prove the changed behavior

Render the selector plan before running validation. Run the smallest direct acceptance check for
the changed behavior. Add owner-package typecheck/build only when an interface, route, generated
artifact, or runtime composition moved.

Use `--test-path <surface>:<path>` to give the selector direct proof. A `needs-focus` plan starts
nothing: provide a focused test, narrow the change, or choose an existing explicit acceptance
check.

If the selector marks any surface critical, run its complete mandatory local override. For a
release or explicit `--full-local` request, run the complete Ship Gate. Do not use compatibility
flags or receipts to suppress critical checks.

## 3. Commit the proven change

Stage only the approved paths and inspect the complete cached diff. Pre-commit is limited to
`lint-staged`; it is not a repository readiness gate. Create a conventional commit, then verify the
resulting commit tree and working tree before continuing.

Commit subjects use `type(scope): description` with the repository's allowed types and scopes.
Never commit secrets, environment files, or unrelated work.

## 4. Run the post-commit Push Gate

Run the exact ready-for-CI contract against the committed tree:

```bash
node scripts/dev/ci-local.js --intent push --reuse-passing-receipts \
  --test-path <surface>:<focused-test-path>
```

Routine work has a 90-second hard limit; sensitive work has 180 seconds. `needs-focus` and
`budget-exceeded` block publication. Passing receipts are reusable only when the commit,
working-tree fingerprint, command, policy, toolchain, validated paths, and environment match
exactly. The pre-push hook calls the same command and may reuse that exact pass.

## 5. Push and create or update the PR

Push normally to the verified branch and remote. Never force-push or publish directly to a
protected branch. Create the PR only when requested, using the repository PR template, draft label,
automation label, validation evidence, and Linear reference when applicable.

After publication, fetch the live PR metadata again and record its current head SHA. A local commit
or successful push message alone is not proof that the PR contains the change.

## 6. Require current-head CI for readiness

Wait for all required workflows selected for the changed paths to finish on the current PR head
SHA. A failure blocks readiness. Pending, missing, or unavailable CI yields a blocked report; do not
run a broad local fallback and call the PR approved.

Critical surfaces require both the complete local override and current-head CI. Ordinary work needs
the targeted local contract and current-head CI.

## Output

Report the resolved base, branch and head SHA, targeted proof, Push Gate status and elapsed time,
whether the full local gate was required, commit and push result, PR URL, and current-head CI state.
Use one of these outcomes:

- `READY`: current-head required CI is green and every applicable local contract passed.
- `BLOCKED`: local proof, push budget, publication, or current-head CI is pending/unavailable.
- `FAILED`: a required local or CI check failed.

## Anti-patterns

- Do not run full Client, Admin, and Agent suites locally for an ordinary Shared implementation
  change; CI owns that regression fanout.
- Do not treat PR creation, commit, or push alone as a reason to run the full local Ship Gate.
- Do not approve a PR from local evidence while required CI is pending or stale.
- Do not bypass `needs-focus`, the hard deadline, critical overrides, hooks, or receipt freshness.
- Do not assume `origin/main`; resolve the live PR base or use `origin/develop`.
