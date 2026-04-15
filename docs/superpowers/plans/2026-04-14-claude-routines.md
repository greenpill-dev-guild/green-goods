# Claude Routines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up four Claude Code routines (`gg-pr-review`, `gg-morning-watch`, `gg-dream-on`, `gg-data-analyst`) with a `develop`-as-routine-target branching model, so Claude can work on Green Goods autonomously without merge conflicts or cross-routine clashes.

**Architecture:** Routine PRs target `develop`; human `feature/*` PRs keep targeting `main`; a GitHub Action fast-forwards `develop` to `main` on every main push. Each routine has a committed markdown prompt under `routines/` for rebuildability. Output channels differ by routine: inline PR comments, deduped issues, session-only, or PR to isolated `docs/metrics/` path.

**Tech Stack:** Claude Code routines (research preview), GitHub Actions, Envio indexer, Arbitrum RPC, Dune API, PostHog API, Google Drive connector.

**Spec:** `docs/superpowers/specs/2026-04-14-claude-routines-design.md`

---

## File Structure

Each file has one clear responsibility:

| File | Responsibility | Phase |
|---|---|---|
| `.github/workflows/sync-develop.yml` | Fast-forward `develop` to `main` on every main push; open labeled issue on FF failure. | 0 |
| `routines/README.md` | Explain what lives in this directory, naming conventions, how to rebuild a routine from a prompt file. | 0 |
| `routines/gg-pr-review.md` | Source-of-truth prompt for the PR-review routine (trigger filters, checklist, cost controls). | 1 |
| `.github/workflows/claude-code-review.yml` | **DELETE** after parallel-run validation proves routine supersedes it. | 2 |
| `routines/gg-morning-watch.md` | Prompt for daily operational health-check routine. | 3 |
| `routines/gg-dream-on.md` | Prompt for nightly cross-project exploration routine. | 4 |
| `routines/gg-data-analyst.md` | Prompt for weekly Dune/PostHog maintenance routine. | 5 |
| `docs/metrics/.gitkeep` | Placeholder so the data-analyst routine has a target directory on first run. | 5 |

## Before You Start — Repository Setup

The spec was committed on `feature/admin-ui-revamp` for convenience, but routines work is unrelated to that branch. Move to a dedicated branch before starting implementation so the PR for each phase is focused.

- [ ] **Step R.1: Create a dedicated branch**

```bash
git checkout main
git pull origin main
git checkout -b chore/claude-routines
# Cherry-pick the spec commit if it's not already on main
git cherry-pick e37d859c  # the spec commit
```

Expected: clean branch `chore/claude-routines` with the spec file committed.

- [ ] **Step R.2: Verify spec is present**

Run: `ls docs/superpowers/specs/2026-04-14-claude-routines-design.md`
Expected: file exists.

---

## Phase 0 — Infrastructure

Reset `develop`, wire up the sync workflow, and create the cloud environment. No routines yet.

### Task 0.1: Decide what to do with develop's orphan commits

**Files:** (none modified; decision step)

- [ ] **Step 1: Inspect the two orphan commits**

Run:
```bash
git log --oneline main..develop
git show 83dc8760 --stat
git show 34251c45 --stat
```
Expected: two commits shown — `Release/1.1 (#403)` and `Feature/ens integration (#338)`.

- [ ] **Step 2: Confirm with user whether to preserve or discard**

Ask: "The orphan commits on develop are `Release/1.1` and `Feature/ens integration`. Their diffs show \<summary\>. Preserve by cherry-picking to main, or discard?"

Record the answer in a commit message or the PR description.

- [ ] **Step 3: If preserving, cherry-pick to main first**

```bash
git checkout main
git cherry-pick 83dc8760 34251c45
git push origin main
```

Expected: clean cherry-pick (may need conflict resolution).

### Task 0.2: Reset develop to match main

**Files:** (remote branch update; destructive)

- [ ] **Step 1: Fetch latest main**

Run: `git fetch origin main`
Expected: up-to-date with remote.

- [ ] **Step 2: Reset develop**

```bash
git checkout develop
git reset --hard origin/main
```
Expected: `develop` HEAD matches `main` HEAD.

- [ ] **Step 3: Force-push**

```bash
git push --force-with-lease origin develop
```
Expected: remote develop updated to match main.

- [ ] **Step 4: Verify divergence is zero**

```bash
git log --oneline main..develop
git log --oneline develop..main
```
Expected: both commands produce empty output.

- [ ] **Step 5: Return to routines branch**

```bash
git checkout chore/claude-routines
```

### Task 0.3: Create the SYNC_DEVELOP_PAT secret

**Files:** (GitHub repository settings; manual step)

- [ ] **Step 1: Generate a fine-grained PAT**

Go to GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token.

- Repository access: only the `green-goods` repo
- Permissions: Contents = Read and write, Metadata = Read
- Expiration: 1 year

Expected: token generated, shown once.

- [ ] **Step 2: Add as repository secret**

Repository → Settings → Secrets and variables → Actions → New repository secret.

- Name: `SYNC_DEVELOP_PAT`
- Value: (paste token)

Expected: secret listed.

### Task 0.4: Write the sync-develop workflow

**Files:**
- Create: `.github/workflows/sync-develop.yml`

- [ ] **Step 1: Write the workflow file**

Create `.github/workflows/sync-develop.yml`:

```yaml
name: Sync develop with main

on:
  push:
    branches: [main]

jobs:
  sync:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      issues: write
    steps:
      - name: Checkout develop
        uses: actions/checkout@v4
        with:
          ref: develop
          fetch-depth: 0
          token: ${{ secrets.SYNC_DEVELOP_PAT }}

      - name: Fast-forward develop to main
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git fetch origin main
          if git merge --ff-only origin/main; then
            git push origin develop
            echo "develop fast-forwarded to main"
          else
            echo "FF failed; opening labeled issue"
            gh issue create \
              --title "develop sync: FF failed, manual resolution needed" \
              --label "routine:sync-develop:blocked" \
              --body "Fast-forward of develop from main failed on commit $GITHUB_SHA. Routine PRs on develop now conflict with main. Resolve manually by either (1) merging develop → main first, or (2) rebasing any open claude/* branches onto main."
          fi
```

- [ ] **Step 2: Ensure the label exists**

Run:
```bash
gh label create "routine:sync-develop:blocked" --color "d73a4a" --description "develop sync GHA failed; manual resolution needed" || true
```
Expected: label created (or already exists).

- [ ] **Step 3: Commit the workflow**

```bash
git add .github/workflows/sync-develop.yml
git commit -m "ci(ops): add sync-develop workflow for routine branching model

Fast-forwards develop to main on every push to main so routine PRs
(which target develop) always see a current base. Opens a labeled
issue if FF fails, so conflicts are visible instead of silent."
```

### Task 0.5: Verify the workflow fires

**Files:** (test by push)

- [ ] **Step 1: Open PR for the workflow to main**

```bash
git push -u origin chore/claude-routines
gh pr create --base main --title "ci(ops): add sync-develop workflow for routine branching" --body "Phase 0 of claude-routines rollout. See docs/superpowers/plans/2026-04-14-claude-routines.md."
```

- [ ] **Step 2: Merge the PR and observe sync-develop run**

After merge, check GitHub Actions tab.

Expected: `Sync develop with main` workflow runs, completes successfully, pushes to develop.

- [ ] **Step 3: Verify develop is at main's tip**

```bash
git fetch origin main develop
git log --oneline origin/main..origin/develop
git log --oneline origin/develop..origin/main
```
Expected: both empty.

### Task 0.6: Create the routines/ directory + README

**Files:**
- Create: `routines/README.md`

- [ ] **Step 1: Create a new branch for Phase 0 completion**

```bash
git checkout main
git pull origin main
git checkout -b chore/claude-routines-directory
```

- [ ] **Step 2: Write the README**

Create `routines/README.md`:

```markdown
# Claude Routines

This directory holds the source-of-truth prompts and configurations for Claude Code routines that operate on Green Goods. Each routine's actual config lives on claude.ai/code/routines; the files here exist so the setup can be rebuilt if routines are lost or the API surface changes.

## Files

- `gg-pr-review.md` — GitHub-triggered inline PR review (replaces `claude-code-review.yml`)
- `gg-morning-watch.md` — Scheduled weekday operational health checks; writes GitHub Issues
- `gg-dream-on.md` — Nightly cross-project exploration; session-only output
- `gg-data-analyst.md` — Weekly Dune + PostHog maintenance; writes PR to develop + issues

## Conventions

- All routine PRs target `develop`, never `main`.
- All routine branches use the `claude/<routine-name>/<topic>` prefix.
- Dedupe issues by label `routine:<name>:<category>`.
- See `docs/superpowers/specs/2026-04-14-claude-routines-design.md` for the full design.

## Rebuilding a routine

1. Log in to claude.ai/code/routines.
2. Click "New routine".
3. Paste the prompt from the relevant `.md` file.
4. Configure repos, environment, connectors, and triggers as specified in the file's frontmatter.
5. Save.
```

- [ ] **Step 3: Commit**

```bash
git add routines/README.md
git commit -m "docs(routines): add routines/ directory with conventions README"
```

### Task 0.7: Create the cloud environment on claude.ai

**Files:** (claude.ai settings; manual step)

- [ ] **Step 1: Create a Green Goods cloud environment**

Go to claude.ai → Settings → Cloud environments → New environment.

- Name: `green-goods-routines`
- Network access: **Trusted** (upgrade to Full only when a specific routine needs Dune/PostHog)
- Environment variables: leave empty for now (added per routine as needed)
- Setup script: (none for Phase 0)

Expected: environment listed.

- [ ] **Step 2: Note the environment name**

Record `green-goods-routines` in the phase-1 task for routine creation.

### Task 0.8: Commit and open PR for Phase 0 completion

- [ ] **Step 1: Push branch**

```bash
git push -u origin chore/claude-routines-directory
```

- [ ] **Step 2: Open PR to main**

```bash
gh pr create --base main --title "chore(routines): add routines/ directory with README" --body "Phase 0 of claude-routines rollout (directory scaffold). sync-develop workflow already merged in earlier PR."
```

Expected: PR opens, CI passes, user merges.

- [ ] **Step 3: Verify sync-develop fires on merge**

After merge, check Actions tab. Expected: sync-develop runs, develop stays current.

---

## Phase 1 — gg-pr-review (parallel with claude-code-review.yml)

Ship the PR-review routine without removing the existing action. Observe for a week.

### Task 1.1: Write the gg-pr-review prompt

**Files:**
- Create: `routines/gg-pr-review.md`

- [ ] **Step 1: Create a new branch**

```bash
git checkout main
git pull origin main
git checkout -b chore/claude-routines-pr-review
```

- [ ] **Step 2: Write the routine prompt file**

Create `routines/gg-pr-review.md`:

````markdown
---
routine-name: gg-pr-review
triggers:
  github:
    events: [pull_request.opened, pull_request.ready_for_review]
    filters:
      base_branch: main
      is_draft: false
      head_branch_excludes: claude/*  # routine PRs carry user's GitHub author (per docs), so filter on branch prefix instead
      from_fork: false
repos:
  - green-goods
environment: green-goods-routines
network-access: trusted
connectors: []
model: claude-opus-4-6
---

# Prompt

You are reviewing a pull request on the Green Goods monorepo. Your job is to leave inline comments on specific lines where an invariant is violated, then post one summary comment at the end.

## Cost controls (check FIRST)

1. If the PR has the label `skip-review` or `wip`, post a single comment "Review skipped (labeled `skip-review`/`wip`)" and stop.
2. If the PR touches more than 50 files, post a single summary comment "Large PR (>50 files); focused line-level review skipped. Please request review on specific files via PR comment." and stop.

## Invariants to check (from CLAUDE.md)

### 1. Hook boundary

ALL React hooks must live in `@green-goods/shared`. Flag any file outside `packages/shared/` that defines a hook (exports anything named `use*` that is a function using React hooks).

### 2. Indexer boundary

The Envio indexer indexes ONLY Green Goods core state (actions, gardens, hats role membership, vault history, yield split history, minimal hypercert linkage/claims). Flag any indexer change that adds handlers for:
- EAS attestations
- Gardens V2 community / pools
- Marketplace
- ENS lifecycle
- Cookie jars
- Hypercert display metadata

### 3. Address typing

Ethereum addresses must use the `Address` type from `@green-goods/shared`, not `string`. Flag any new TypeScript function parameter, field, or return type that uses `string` for what is clearly an address.

### 4. No raw forge commands

Contracts workflows must use `bun build`, `bun build:changed`, `bun build:target`, or `bun build:full`. Flag any raw `forge build`, `forge test`, or `forge script` in scripts or docs.

### 5. Deployment artifacts

Contract addresses must be imported from `deployments/{chainId}-latest.json`. Flag any hardcoded `0x…` address literal in frontend or shared code.

### 6. Barrel imports

Imports from shared must use the barrel: `import { x } from "@green-goods/shared"`. Flag any deep path like `@green-goods/shared/dist/foo/bar`.

### 7. Contract test coverage

If the PR diff touches any `.sol` file under `packages/contracts/src/`, verify the diff also touches `.t.sol` tests. If not, flag with "Contract change without test coverage diff."

### 8. bun test vs bun run test

`bun test` uses bun's built-in runner and ignores vitest config. All test invocations must use `bun run test`. Flag any `bun test` in new scripts, workflows, or docs.

## Summary comment format

At the end, post one summary comment:

```
## Review summary

**Invariants checked:** 8 from CLAUDE.md
**Inline flags:** N (see comments above)
**Verdict:** [APPROVE | REQUEST_CHANGES | COMMENT_ONLY]

Notes: …
```

Use `COMMENT_ONLY` unless there is a hard-invariant violation (items 1, 2, 5). Items 3, 4, 6, 7, 8 are `REQUEST_CHANGES`-worthy only if the author has been told about them before in this PR thread — otherwise `COMMENT_ONLY`.
````

- [ ] **Step 3: Commit**

```bash
git add routines/gg-pr-review.md
git commit -m "docs(routines): add gg-pr-review prompt

Source-of-truth for the GitHub-triggered PR review routine that
replaces claude-code-review.yml (Phase 2). Checklist enforces the
8 CLAUDE.md invariants (hook boundary, indexer boundary, Address
type, no raw forge, deployment artifacts, barrel imports, contract
test coverage, bun run test)."
```

### Task 1.2: Open PR for the prompt file

- [ ] **Step 1: Push and open PR**

```bash
git push -u origin chore/claude-routines-pr-review
gh pr create --base main --title "docs(routines): add gg-pr-review prompt" --body "Phase 1 artifact of claude-routines rollout. Routine itself is created via claude.ai web UI; this is the committed prompt for rebuildability."
```

### Task 1.3: Create the routine on claude.ai (manual)

- [ ] **Step 1: Open claude.ai/code/routines**

Expected: routines list page loads.

- [ ] **Step 2: Click New routine**

- [ ] **Step 3: Fill in the form**

- Name: `gg-pr-review`
- Prompt: (paste the prompt body from `routines/gg-pr-review.md` — everything after the `# Prompt` heading)
- Model: `claude-opus-4-6`
- Repositories: `green-goods` (or the org-qualified name, e.g., `greenpill/green-goods`)
- Allow unrestricted branch pushes: **No**
- Environment: `green-goods-routines`
- Connectors: none
- Trigger: **GitHub event**
  - Event: `pull_request.opened`
  - Filters: base branch = `main`, is draft = `false`, from fork = `false`, **head branch does not start with `claude/`** (this catches routine-opened PRs, which carry the user's GitHub author per docs — author filter would not work)
- Add another trigger: **GitHub event**
  - Event: `pull_request.ready_for_review`
  - Filters: same as above (base=main, not-draft, not-from-fork, head branch does not start with `claude/`)

- [ ] **Step 4: Save**

Expected: routine appears in the list, labeled "Active".

### Task 1.4: Verify the routine fires

- [ ] **Step 1: Open a test PR**

Any small PR works — e.g., a typo fix. Push to a branch, open PR to main.

- [ ] **Step 2: Watch the routine session**

Within a few minutes, a new session should appear on claude.ai/code with name containing `gg-pr-review`.

Expected: session completes; inline comments appear on the PR; summary comment posted.

- [ ] **Step 3: Confirm both gg-pr-review AND claude-code-review.yml ran**

On the PR, verify two distinct Claude comments (one from the routine, one from the action).

Expected: both visible. This is the parallel-run state.

### Task 1.5: Parallel-run observation (1 week)

- [ ] **Step 1: Observe at least 3 PRs opened during the observation week**

For each, compare the routine's output vs. the action's output.

- [ ] **Step 2: Log observations**

Create a section at the bottom of `routines/gg-pr-review.md`:

```markdown
## Validation log

| Date | PR | Routine findings | Action findings | Verdict |
|---|---|---|---|---|
| 2026-04-15 | #451 | 3 inline (hook boundary, Address, barrel) | 1 inline (style) | Routine superior |
| … | … | … | … | … |
```

- [ ] **Step 3: Decide whether to proceed to Phase 2**

Proceed only if routine met or exceeded action on all observed PRs.

---

## Phase 2 — Retire claude-code-review.yml

Only after Phase 1 observation passes.

### Task 2.1: Delete the workflow

**Files:**
- Delete: `.github/workflows/claude-code-review.yml`

- [ ] **Step 1: Branch**

```bash
git checkout main
git pull origin main
git checkout -b chore/retire-claude-code-review-yml
```

- [ ] **Step 2: Delete the file**

```bash
git rm .github/workflows/claude-code-review.yml
```

- [ ] **Step 3: Commit**

```bash
git commit -m "ci(claude): retire claude-code-review.yml in favor of gg-pr-review routine

Parallel-run observation (see routines/gg-pr-review.md Validation log)
confirmed the routine meets or exceeds the workflow's output on
observed PRs. Keeping claude.yml (on-demand @claude mentions)."
```

### Task 2.2: Open PR and verify next PR only gets routine review

- [ ] **Step 1: Push and open PR**

```bash
git push -u origin chore/retire-claude-code-review-yml
gh pr create --base main --title "ci(claude): retire claude-code-review.yml" --body "Phase 2 of claude-routines rollout. Routine superseded the workflow on N observed PRs (see routines/gg-pr-review.md)."
```

- [ ] **Step 2: Merge**

- [ ] **Step 3: Open a test PR after merge**

Any small PR works.

Expected: only ONE Claude review comment (from the routine). No `claude-code-review.yml` run in the Actions tab.

---

## Phase 3 — gg-morning-watch

Daily operational health checks. Issues only.

### Task 3.1: Write the gg-morning-watch prompt

**Files:**
- Create: `routines/gg-morning-watch.md`

- [ ] **Step 1: Branch**

```bash
git checkout main
git pull origin main
git checkout -b chore/claude-routines-morning-watch
```

- [ ] **Step 2: Write the file**

Create `routines/gg-morning-watch.md`:

````markdown
---
routine-name: gg-morning-watch
trigger:
  schedule: "30 7 * * 1-5"  # 07:30 local, Mon-Fri
repos:
  - green-goods
environment: green-goods-routines
network-access: trusted  # add ARBITRUM_RPC and ENVIO_INDEXER domains if custom
env-vars:
  - ARBITRUM_RPC_URL
  - ENVIO_INDEXER_URL
connectors: []  # optionally add Slack for ping
model: claude-sonnet-4-6
---

# Prompt

You are the morning-watch routine for Green Goods. Run the four checks below. For each anomaly found, open or update a GitHub issue labeled `routine:watch:<category>`. Never open duplicate issues — if an open issue already has that category label, append a dated comment instead.

## Setup

- `ARBITRUM_RPC_URL` is available as an environment variable.
- `ENVIO_INDEXER_URL` is available as an environment variable.
- Do not read `.env` — variables are already in the environment.

## Categories and checks

### 1. `routine:watch:indexer`

Query `ENVIO_INDEXER_URL` for the last-indexed-block number.
Query `ARBITRUM_RPC_URL` with `eth_blockNumber`.
If (chain_head - last_indexed) > 50 blocks → anomaly. Issue body should include both block numbers and the delta.

### 2. `routine:watch:pilot-activity`

Query the indexer for action events created in the last 24h, grouped by garden.
List: the 13 Season One gardens (known operators stored in project memory).
If any Season One garden has zero actions for >7 days → anomaly. Issue body should list the garden and last-action timestamp.

### 3. `routine:watch:ci-pulse`

Use `gh run list --branch main --status failure --created ">1 day ago" --limit 20`.
If any failures exist → anomaly. Issue body should list failing workflow names, run URLs, and whether the same workflow failed before.

### 4. `routine:watch:onchain-sanity`

Query vault contract balances and yield-split state via Arbitrum RPC using addresses from `deployments/<chainId>-latest.json`.
If any vault balance changed by >30% in 24h OR any yield-split parameter drifted from its expected value → anomaly. Issue body should include before/after values.

## Dedupe logic

For each category:
```
open_issues = gh issue list --label "routine:watch:<category>" --state open --json number,title,body
if open_issues is empty:
  gh issue create --label "routine:watch:<category>" --title "<category summary>" --body "<findings>"
else:
  gh issue comment <first open issue number> --body "<dated append of findings>"
```

## Output

At the end of the session, print a one-line summary: `morning-watch: indexer=OK, pilot-activity=OK, ci=1_failure_issue_#452_updated, onchain=OK`.
````

- [ ] **Step 3: Commit**

```bash
git add routines/gg-morning-watch.md
git commit -m "docs(routines): add gg-morning-watch prompt

Daily weekday 07:30 operational health check. Four categories
(indexer, pilot-activity, ci-pulse, onchain-sanity) each write to
deduped GitHub issues."
```

### Task 3.2: Add env vars to the cloud environment

- [ ] **Step 1: Open claude.ai → Settings → Cloud environments → green-goods-routines**

- [ ] **Step 2: Add env vars**

- `ARBITRUM_RPC_URL`: (from root `.env` under Green Goods)
- `ENVIO_INDEXER_URL`: (from root `.env` or the indexer's hosted URL)

Expected: both listed.

- [ ] **Step 3: Ensure network access covers the RPC + indexer domains**

If `Trusted` doesn't cover them, switch to `Custom` and add the specific domains. Only use `Full` if needed.

### Task 3.3: Create the labels

- [ ] **Step 1: Create four labels**

```bash
for cat in indexer pilot-activity ci-pulse onchain-sanity; do
  gh label create "routine:watch:$cat" --color "0e8a16" --description "Morning-watch routine finding: $cat" || true
done
```
Expected: labels created (or already exist).

### Task 3.4: Create the routine on claude.ai

- [ ] **Step 1: Open claude.ai/code/routines → New routine**

- [ ] **Step 2: Fill in**

- Name: `gg-morning-watch`
- Prompt: (paste from `routines/gg-morning-watch.md`, content after `# Prompt`)
- Model: `claude-sonnet-4-6`
- Repositories: `green-goods`
- Environment: `green-goods-routines`
- Trigger: **Schedule** — Weekdays, 07:30 local

- [ ] **Step 3: Save**

### Task 3.5: Trigger Run now and verify

- [ ] **Step 1: Click Run now**

- [ ] **Step 2: Watch session**

Expected: routine completes; if anomalies exist, corresponding labeled issues open. If none, session ends with "all checks OK" summary.

- [ ] **Step 3: Trigger Run now a second time**

Expected: if the first run opened issues, the second run appends a comment to them (no duplicate issues).

### Task 3.6: Open PR for the prompt file

- [ ] **Step 1: Push and open PR**

```bash
git push -u origin chore/claude-routines-morning-watch
gh pr create --base main --title "docs(routines): add gg-morning-watch prompt" --body "Phase 3 of claude-routines rollout."
```

---

## Phase 4 — gg-dream-on

Cross-project nightly exploration. Session-only.

### Task 4.1: Write the gg-dream-on prompt

**Files:**
- Create: `routines/gg-dream-on.md`

- [ ] **Step 1: Branch**

```bash
git checkout main
git pull origin main
git checkout -b chore/claude-routines-dream-on
```

- [ ] **Step 2: Write the file**

Create `routines/gg-dream-on.md`:

````markdown
---
routine-name: gg-dream-on
trigger:
  schedule: "0 3 * * *"  # 03:00 local, daily
repos:
  - green-goods  # primary
  - greenpill-website
  - coop
  - wefa
environment: green-goods-routines
network-access: trusted
env-vars: []
connectors:
  - google-drive  # for cross-project meeting notes
  # - gmail  # optional, enable if useful
model: claude-opus-4-6
---

# Prompt

You are the nightly dream-on routine. Your output is SESSION-ONLY — do not open issues, do not open PRs, do not push branches, do not write files. The user will read your final message in the claude.ai session history.

## What you have

Four repos cloned as read-only reference:
- `green-goods` (primary — regenerative work platform, Envio indexer, Arbitrum contracts, PWA)
- `greenpill-website` (marketing + community)
- `coop` (browser extension, shares identity/chain/attestation infra with Green Goods)
- `wefa` (game PWA, shares identity/chain/attestation infra)

DO NOT run `bun install` in any repo. DO NOT run builds or tests. Read-only exploration only.

You have the Google Drive connector available for cross-project meeting notes and shared docs.

## Sleep cycle structure

Alternate NREM (deep analysis) and REM (ideation) passes. Aim for 3-4 cycles.

### NREM pass (deep analysis)

Pick one repo and one unexplored question. Examples:
- "Where in `green-goods` is there a feature that `coop` or `wefa` could reuse?"
- "What is `greenpill-website` promising that `green-goods` hasn't shipped?"
- "Where does `green-goods` duplicate logic that lives elsewhere in the sibling projects?"
- "What is the oldest unmerged intention in any repo's `.plans/` directory?"

Read enough code and docs to answer concretely. Cite file paths and line numbers.

### REM pass (ideation)

Dream about what COULD be, not what IS. Examples:
- "If `coop` and `green-goods` shared the passkey flow, what would it look like?"
- "What would a single regenerative-ledger view across all four projects tell a grant evaluator?"
- "What's a one-sentence synthesis of this month's meeting notes?"

Stretch — don't constrain to what's feasible this quarter.

## Morning brief (final message)

End your session with a markdown brief. Structure:

```markdown
# Dream-on brief — YYYY-MM-DD

## NREM findings
- [concrete observation with file:line]
- [concrete observation with file:line]

## REM ideations
- [stretch idea 1]
- [stretch idea 2]

## Cross-project signal
- [something one project knows that another doesn't]

## Suggested follow-ups (user decides)
- [a concrete .plans/ entry the user could create]
- [an issue the user could open — but don't open it yourself]
```

The user reads this in the morning and decides which (if any) to act on.

## Privacy reminder

This session is private to the user's claude.ai account. You may discuss ideas-in-progress, pre-public product directions, and internal thinking. Do not summarize this brief anywhere else.
````

- [ ] **Step 3: Commit**

```bash
git add routines/gg-dream-on.md
git commit -m "docs(routines): add gg-dream-on prompt

Nightly 03:00 cross-project exploration. Four repos cloned
read-only (green-goods, greenpill-website, coop, wefa). Output is
session-only for privacy — no issues, no PRs, no file writes."
```

### Task 4.2: Ensure Google Drive connector is installed

- [ ] **Step 1: Check claude.ai → Settings → Connectors**

Expected: Google Drive listed. If not, install from the connector directory.

### Task 4.3: Create the routine on claude.ai

- [ ] **Step 1: New routine**

- Name: `gg-dream-on`
- Prompt: (paste content after `# Prompt` from `routines/gg-dream-on.md`)
- Model: `claude-opus-4-6`
- Repositories: `green-goods`, `greenpill-website`, `coop`, `wefa` (org-qualified as needed)
- Environment: `green-goods-routines`
- Connectors: Google Drive (and Gmail if desired)
- Trigger: **Schedule** — Daily, 03:00 local

- [ ] **Step 2: Save**

### Task 4.4: Trigger Run now and verify session-only output

- [ ] **Step 1: Click Run now**

- [ ] **Step 2: Watch session**

Expected: routine completes within resource limits (4 repos, no installs).

- [ ] **Step 3: Verify no side effects**

```bash
gh issue list --limit 10 --created "$(date -u +%Y-%m-%dT%H:%M:%SZ -v -1H)"
gh pr list --limit 10
git branch -r | grep claude/
```

Expected: no new issues, no new PRs, no new `claude/*` branches attributable to this run.

- [ ] **Step 4: Read the brief**

Open the session in claude.ai and verify the morning-brief markdown is present as the final message.

### Task 4.5: Open PR for the prompt file

- [ ] **Step 1: Push and open PR**

```bash
git push -u origin chore/claude-routines-dream-on
gh pr create --base main --title "docs(routines): add gg-dream-on prompt" --body "Phase 4 of claude-routines rollout. Session-only output, no repo writes."
```

---

## Phase 5 — gg-data-analyst

Weekly Dune + PostHog maintenance. Three write-back channels.

### Task 5.1: Verify Dune API write access

- [ ] **Step 1: Check Dune plan**

Log in to dune.com → Settings → API. Confirm your tier includes query CRUD via API (usually Dune Plus or higher).

If not available, pause Phase 5 and revisit — either upgrade Dune, or restrict this routine to read-only Dune execution.

- [ ] **Step 2: Generate a Dune API key**

Record it for Task 5.5.

### Task 5.2: Verify PostHog API access

- [ ] **Step 1: Log in to PostHog → Project settings → API keys**

- [ ] **Step 2: Create a read-only personal API key**

Record it for Task 5.5.

### Task 5.3: Write the gg-data-analyst prompt

**Files:**
- Create: `routines/gg-data-analyst.md`
- Create: `docs/metrics/.gitkeep`

- [ ] **Step 1: Branch**

```bash
git checkout main
git pull origin main
git checkout -b chore/claude-routines-data-analyst
```

- [ ] **Step 2: Create the metrics directory placeholder**

```bash
mkdir -p docs/metrics
echo "# Weekly metrics digests go here (written by gg-data-analyst routine)." > docs/metrics/README.md
```

- [ ] **Step 3: Write the routine prompt**

Create `routines/gg-data-analyst.md`:

````markdown
---
routine-name: gg-data-analyst
trigger:
  schedule: "0 22 * * 0"  # 22:00 local, Sunday
repos:
  - green-goods
environment: green-goods-routines
network-access: full  # needs Dune + PostHog
env-vars:
  - DUNE_API_KEY
  - POSTHOG_API_KEY
  - POSTHOG_HOST
  - ENVIO_INDEXER_URL
  - ARBITRUM_RPC_URL
connectors: []  # optionally Slack
model: claude-opus-4-6
---

# Prompt

You are the weekly data-analyst routine for Green Goods. You have three write-back channels: Dune API, a PR to `develop`, and GitHub issues. Use each for its intended purpose.

## Setup

- Env vars are already loaded; do not read `.env`.
- `ENVIO_INDEXER_URL` gives on-chain event data.
- `ARBITRUM_RPC_URL` gives raw chain state.
- `DUNE_API_KEY` is owner-scoped; **only modify queries whose names or descriptions include the tag `[routine]`**. Never touch user-owned queries.
- `POSTHOG_API_KEY` should be scoped read-only; do not call destructive endpoints.

## Channel 1: Dune API (query maintenance)

1. List your Dune queries via the Dune API.
2. For each query tagged `[routine]`: run it, confirm results look sane. If the query errors or produces obviously wrong results (e.g., zero rows for a query that ran fine last week), mark it for update.
3. For any new contracts deployed since last week (compare `deployments/<chainId>-latest.json` git history), propose a new Dune query and create it (tagged `[routine]`).
4. If a query is too slow (>30s execution, check via the Dune API run metadata), propose a rewrite.

**Guardrail:** if you are <90% confident in a query change, do NOT apply it via API. Include the proposal in Channel 2 (PR digest) instead.

## Channel 2: PR to `develop` (weekly digest)

Create branch `claude/data-analyst/YYYY-WW` from `develop`.
Write `docs/metrics/YYYY-WW.md` (e.g., `docs/metrics/2026-15.md`). Structure:

```markdown
# Week YYYY-WW metrics digest

## Growth
- Gardens: [count] (WoW: +N)
- Actions: [count] (WoW: +N%)
- Vaults: [count] ([total balance])
- Yield: [amount]

## PostHog funnels
- Onboarding → first action: [conversion %]
- Other funnels observed…

## On-chain trends
- [notable transaction patterns]
- [unusual activity on pilot gardens]

## Dune query changes
- [Query name / ID] — [updated | created | proposed] — [rationale]

## Proposals (low-confidence, user decides)
- [query-change proposal]
- …
```

Open a PR to `develop`, title `metrics: week YYYY-WW digest`, label `routine:metrics:digest`.

## Channel 3: Issue (anomalies only)

If any of these are true, open a GitHub issue labeled `routine:metrics:anomaly`:
- Action volume drops >40% WoW
- Yield-split parameter drifts from its configured expected value
- Vault balance changes >50% WoW without a clear cause
- A Dune query that worked last week now errors

Dedupe: if a `routine:metrics:anomaly` issue is already open for the same category, append a dated comment instead.

## Output

End the session with a one-line summary:

```
data-analyst: dune=[N updated, M created, K proposed], digest-PR=#[N], anomalies=[count]
```
````

- [ ] **Step 4: Commit**

```bash
git add routines/gg-data-analyst.md docs/metrics/README.md
git commit -m "docs(routines): add gg-data-analyst prompt

Weekly Sunday 22:00 routine. Three write-back channels: Dune API
(query maintenance, tagged [routine] only), PR to develop
(persistent digest at docs/metrics/YYYY-WW.md), GitHub issue
(anomalies, deduped). Created docs/metrics/ directory."
```

### Task 5.4: Add env vars to the cloud environment

- [ ] **Step 1: Open claude.ai → Cloud environments → green-goods-routines**

- [ ] **Step 2: Add**

- `DUNE_API_KEY`: (from Task 5.1)
- `POSTHOG_API_KEY`: (from Task 5.2, read-only)
- `POSTHOG_HOST`: (e.g., `https://us.posthog.com` or your self-hosted URL)

- [ ] **Step 3: Change network access to Full for this routine**

Two options:
- (a) Create a separate cloud environment `green-goods-routines-full` with Full access, and only use it for `gg-data-analyst`.
- (b) Switch the shared environment to Full.

Prefer (a) for least-privilege: other routines stay on Trusted.

### Task 5.5: Create the anomaly label

```bash
gh label create "routine:metrics:anomaly" --color "d73a4a" --description "Data-analyst routine anomaly finding" || true
gh label create "routine:metrics:digest" --color "0366d6" --description "Weekly metrics digest PR" || true
```

### Task 5.6: Create the routine on claude.ai

- [ ] **Step 1: New routine**

- Name: `gg-data-analyst`
- Prompt: (paste content after `# Prompt` from `routines/gg-data-analyst.md`)
- Model: `claude-opus-4-6`
- Repositories: `green-goods` (allow `claude/data-analyst/*` branch pushes)
- Environment: `green-goods-routines-full` (or shared with Full access)
- Connectors: none (Slack optional)
- Trigger: **Schedule** — Weekly, Sundays 22:00 local

- [ ] **Step 2: Save**

### Task 5.7: Trigger Run now and verify all three channels

- [ ] **Step 1: Click Run now**

- [ ] **Step 2: Verify Dune channel**

Log in to dune.com → My queries. Expected: if any `[routine]`-tagged queries existed, they are updated. If any new contracts were deployed since last week, a new `[routine]`-tagged query exists.

- [ ] **Step 3: Verify digest PR**

```bash
gh pr list --label "routine:metrics:digest"
```
Expected: one open PR targeting `develop` with `docs/metrics/YYYY-WW.md` diff.

- [ ] **Step 4: Verify anomaly issues (if any)**

```bash
gh issue list --label "routine:metrics:anomaly"
```
Expected: zero or more issues; none duplicated.

- [ ] **Step 5: Merge the digest PR to develop**

Review the digest content, then:
```bash
gh pr merge <PR#> --merge --delete-branch
```

### Task 5.8: Open PR for the prompt file

- [ ] **Step 1: Push and open PR**

```bash
git push -u origin chore/claude-routines-data-analyst
gh pr create --base main --title "docs(routines): add gg-data-analyst prompt + docs/metrics directory" --body "Phase 5 of claude-routines rollout. Completes the initial routine portfolio."
```

---

## Post-rollout

### Task 6.1: Confirm success criteria

After 4 weeks of operation:

- [ ] All four routines operational
- [ ] Zero routine-vs-human merge conflicts
- [ ] `gg-pr-review` caught ≥ 1 CLAUDE.md violation that slipped past human review
- [ ] ≥ 1 weekly metrics digest merged to main via develop
- [ ] ≥ 3 dream-on sessions yielded an insight the user acted on (issue or `.plans/` entry created from a dream brief)
- [ ] `claude-code-review.yml` retired without regression

Record observations in a retrospective comment on the spec file.

### Task 6.2: Review daily budget usage

Visit claude.ai/settings/usage → Routine runs.

- [ ] Typical daily usage stays ≤ 8/15 (5 slots headroom for manual + API triggers)
- [ ] If consistently under 5, consider adding deps/docs drift routines (Approach 2 from spec)
- [ ] If consistently near 15, pause one routine (lowest-ROI first)

---

## Self-review notes (for the engineer executing the plan)

**Spec coverage check:**
- 4 routines defined in spec → 4 routines created here (Phases 1/3/4/5). ✓
- develop branching + sync GHA → Phase 0. ✓
- `claude-code-review.yml` retirement → Phase 2. ✓
- Path-prefix isolation → `routines/`, `docs/metrics/`, issue labels. ✓
- Phased rollout with gates → explicit in each phase. ✓
- 5 open questions from spec → addressed in Phase 0 (orphan commits, PAT), Phase 3 (env vars), Phase 5 (Dune tier, PostHog). ✓

**No hidden placeholders:** every prompt body is inline and complete. All `gh` commands are concrete. All routine fields (name, trigger, repos, env, connectors, model) are specified per routine.

**Type/name consistency check:**
- Routine names: `gg-pr-review`, `gg-morning-watch`, `gg-dream-on`, `gg-data-analyst` — consistent throughout.
- Branch prefixes: `claude/<routine-name>/<topic>` — e.g., `claude/data-analyst/YYYY-WW`. Consistent.
- Labels: `routine:watch:<category>`, `routine:metrics:anomaly`, `routine:metrics:digest`, `routine:sync-develop:blocked` — documented at creation, referenced in prompts.
- Cloud env names: `green-goods-routines` (trusted) and `green-goods-routines-full` (Dune-enabled) — distinct and referenced consistently.

Plan is ready for execution.
