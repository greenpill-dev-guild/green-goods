---
name: ship
description: Commit, push, and open or update a PR with targeted local proof, the push gate, and current-head CI as the final check. Use when the user asks to commit, push, open a PR, ship, release, or prove a branch is ready, or asks for a dry-run ship check.
user-invocable: false
argument-hint: "[--dry-run] [--no-commit] [--pr] [--full-local]"
---

# Ship

## Adapter

Read `.agents/adapter.md` at the repository root: section `## ship`, plus `## checks` for commands. If the file, a section, or a field is missing, say so in one line and use the defaults written as "(default: ...)". Adapter fields are the bold names that follow `## checks` or carry a "(default: ...)". Without `## checks`, take commands from the repository's package scripts, Makefile, or CI config, name the ones you used, and treat auth, payment, and deploy code as critical.

## Iron law

Publish without re-running CI locally. Ordinary work proves the changed behavior, passes the push gate, and lets required CI own broad regression coverage and merge approval. Critical surfaces keep their mandatory override; releases keep the full local gate.

```
NO READINESS CLAIM WITHOUT FRESH EVIDENCE FOR THE CURRENT SHA
```

For ordinary publication, fresh evidence is targeted behavior proof, the post-commit push gate, and required CI green at the PR's current head SHA. Pending, missing, stale-SHA, or unavailable CI is `BLOCKED`; a local full suite never substitutes for PR approval. A release or an explicit full-local request adds the `full` tier (`release` for a release). A critical surface adds its mandatory override (step 2); an ordinary critical commit or push does not need the `full` tier.

## Activation

| Request | Flow |
|---|---|
| "commit", "push", or "open a PR" | targeted proof → commit → push gate → push or PR → current-head CI |
| "ready to ship" or `--full-local` | `full` tier, then the publication flow |
| critical surface (`## checks` **Criticality**) | mandatory override, then the publication flow |
| release | `release` tier, then the publication flow |
| "dry-run ship check" (`--dry-run`) | planned validation only; no commit, push, or PR |

"QA mode", "quick fix", "get this to staging", and similar requests stay in the `targeted` tier and do not publish unless the user also asks to commit, open a PR, merge, release, or prove the branch ready. `--no-commit` stops before the commit; `--pr` opens or updates the PR.

## 1. Resolve branch and base

Confirm the branch, worktree, staging area, and remote before validation:

```bash
git rev-parse --abbrev-ref HEAD
git status --short
git remote -v
```

Run **Branch check** too (default: none). Use the live PR base when one exists, otherwise `## checks` **Base** (default: the remote default branch). Fetch the resolved base before computing the change set, then inspect commits and the diff against it. Never assume a base.

Stop on: a detached HEAD; a branch in **Protected branches** (default: the default branch); a branch name **Branch check** rejects; credential-like files; a staged file over 5 MB without confirmation; unrelated working-tree changes that overlap the publication scope; nothing to publish.

Never infer the tracker issue from the branch name. When **PR issue line** requires one (default: no requirement), find or file the issue before opening the PR.

## 2. Prove the changed behavior

Render the check plan (`## checks` **Selector**) before running validation. Run the smallest direct acceptance check for the changed behavior; add the owner package's typecheck or build only when an interface, route, generated artifact, or runtime composition moved. When the selector refuses to start for lack of focused proof, give it a focused test, narrow the change, or choose an existing explicit acceptance check: never broaden to full suites to get past it.

For a critical surface, run its mandatory override (`## checks` **Criticality**). For a release or `--full-local`, run the `full` or `release` tier. Compatibility flags and reused receipts never suppress critical checks.

## 3. Commit the proven change

Stage only the approved paths, by name, and read the complete cached diff. Commit hooks (**Hooks**; default: whatever the repository installs) are not a readiness gate. Write the subject in **Commit format** (default: the style of recent commits), then verify the resulting commit tree and the working tree before continuing. Never commit secrets, environment files, or unrelated work.

When the change finishes a tracked plan, the PR also carries that plan's closeout record (plan skill, Close a plan, steps 1 to 5); the archive commit lands after the human merge.

## 4. Run the push gate

Run the `push` tier against the committed tree (`## checks` **Tiers**) under **Push gate** rules (default: none). The push gate is a thin pre-check; its plan names what it leaves to PR CI, and CI runs those (step 6). A budget overrun or missing focused proof blocks publication. Reuse a passing receipt only when the commit, working-tree state, command, policy, toolchain, validated paths, and environment all match exactly.

## 5. Push and open or update the PR

Push normally to the verified branch and remote. Never force-push or publish directly to a protected branch. Open a PR only when asked, following **PR** (default: the repository PR template, opened as a draft), with validation evidence and any required issue line.

After publication, fetch the live PR metadata again and record its current head SHA. A local commit or a successful push message alone is not proof that the PR contains the change.

## 6. Require current-head CI

Wait for every required workflow selected for the changed paths to finish at the PR's current head SHA (`## checks` **CI**). A failure blocks readiness. Pending, missing, or unavailable CI yields a `BLOCKED` report; never run a broad local fallback and call the PR approved. Critical surfaces need both the mandatory override and current-head CI; ordinary work needs the targeted local checks and current-head CI.

## 7. Merge, then close out

Publication never authorizes a merge. When the user authorizes one, use **Merge** (default: `.agents/merge-policy.json` when the repository has one, with its merge method, and auto-merge only for a change whose highest tier allows it, so never for a critical path; otherwise ask which method). A merge does not finish the tracker record: when the user asks for a merge or reports one, run **After merge** (default: none), which owns its steps, conditions, and permitted writes.

## Output

Report the resolved base, branch and head SHA, targeted proof, push gate status and elapsed time, whether the full tier was required, the commit and push result, the PR URL, current-head CI state, and **Report line** (default: none). The report line informs; it never changes the outcome.
- `READY`: required current-head CI is green and every applicable local check passed.
- `BLOCKED`: local proof, push budget, publication, or current-head CI is pending or unavailable.
- `FAILED`: a required local or CI check failed.

## Anti-patterns

- Running consumer suites locally for an ordinary change when CI owns that fanout (`## checks` **CI**).
- Treating a PR, commit, or push alone as a reason for the `full` tier.
- Approving a PR from local evidence while required CI is pending or stale.
- Bypassing focused-proof requirements, push deadlines, critical overrides, hooks, or receipt freshness.
- Assuming a base branch instead of resolving the live PR base or `## checks` **Base**.

## Unattended runs

Unattended maintenance PRs stay within **Unattended** (default: draft PRs only, with no changes to deploy scripts, environment files, dependencies, or agent guidance unless the task asks). These limits never authorize publication or merging.
