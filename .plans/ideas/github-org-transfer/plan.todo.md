# GitHub Organization Transfer Plan

**Feature Slug**: `github-org-transfer`
**Stage**: `ideas`
**Status**: `IDEA: decisions recorded; waits for the 2.1.0 release`
**Created**: `2026-11-15`
**Last Updated**: `2026-11-15`

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Move with GitHub's repository transfer, never by re-creating the repository or mirror-pushing | A transfer keeps pull requests, stars, secrets, webhooks and the repository ID, and it is what makes GitHub redirect the old location |
| 2 | Target `green-goods/platform`, renamed in the transfer step (decided 2026-11-14) | One redirect hop; matches the local checkout layout |
| 3 | Not scheduled; this hub records the plan for later (decided 2026-11-14) | The research is for understanding now; execution waits for a chosen window |
| 4 | Prepare the new organization (teams, apps, settings) before the transfer | Access and integrations are bound to the owning organization; preparing first avoids silent outages |
| 5 | Leave history and immutable records unchanged | `.plans` history, release notes, submitted documents, contract comments and commit-pinned permalinks resolve through redirects; the issuer-terms permalink is part of data that approvals are checked against |
| 6 | Never create a repository or fork at the old path, and never use the self-serve "Leave fork network" | Either would break redirects or delete pull request history |
| 7 | Settle the indexer with Envio before the move and never delete the existing indexer | Envio identifies organizations by GitHub name, has no self-serve repository change, and deleting an indexer deletes its deployments |
| 8 | Keep the "forked from `camp-green`" label; no request to GitHub Support (decided 2026-11-14) | The label is cosmetic; nothing functional depends on it |
| 9 | Ask Envio to move the existing indexer into `green-goods`, and recreate it only if they cannot; indexer deploys continue from today's setup until the move (decided 2026-11-14) | A move keeps the indexer's history and settings; recreating is the fallback |
| 10 | The new organization requires sign-off on web commits and lets only owners create public repositories (decided 2026-11-14) | Matches the guild's current rules |
| 11 | Move the supply-chain guardrail script into a new `green-goods/.github` repository and pin the workflow to a commit there (decided 2026-11-14) | Same pattern as today, without Green Goods CI depending on the guild |
| 12 | Recreate three teams (maintain, triage, write) and retire the read-only team; CODEOWNERS names the new maintain team (decided 2026-11-14) | Fewer teams to maintain; the read-only team grants little on a public repository |
| 13 | Ruleset bypass stays with organization owners, accepting that the new organization has one more owner than the guild (decided 2026-11-14) | Ownership in the new organization was set up deliberately |
| 14 | Update old Linear workspace links in living files only; `.plans` history and dated reports stay as written (decided 2026-11-14) | Removes the dependency on Linear's redirect where people read today, without rewriting history |
| 15 | Schedule the move for a quiet weekend after the 2.1.0 release ships (decided 2026-11-14) | Keeps the move out of a release cycle |

## Research / Plan Gate

- [x] Record research evidence in `spec.md` (observed 2026-11-14)
- [x] Identify the existing pattern to mirror: the guild's `cookie-jar` repository already moved to
      `green-goods`, and its old API URL redirects
- [x] List human judgment points before execution (`spec.md`)
- [x] Define what is out of scope (`brief.md`)
- [x] Choose the lightest honest validation (`eval.md`)
- [x] Record the maintainer's decisions (decisions 8 to 15, 2026-11-14)
- [ ] Re-derive the integration and access inventory on the day of execution; this hub does not
      store one

## Sequence

### Phase A: Prepare (nothing changes for users)

1. **Settle the indexer with Envio.** Ask Envio to move the existing indexer into the
   `green-goods` organization, and recreate it only if they cannot (decision 9). Indexer deploys
   continue from today's setup until the move. Verify: Envio's answer and the chosen path are
   recorded in this hub.
2. **Prepare the organization.** Keep 2FA required, require sign-off on web commits, and let only
   owners create public repositories (decision 10). Match the Actions policy: SHA pinning and a
   read-only default token. Create the three teams (maintain, triage, write; decision 12) and
   invite anyone missing. Verify: every current access path except the read-only team has a
   counterpart (`gh api repos/greenpill-dev-guild/green-goods/teams`).
3. **Create `green-goods/.github`** with the organization profile README, the SUPPORT and FUNDING
   files, and the supply-chain guardrail script (decision 11). Verify: the script runs against a
   checkout of this repository, and the commit to pin is recorded.
4. **Install integrations on `green-goods`.** Install every app from the re-derived list, with
   access to all repositories where the vendor allows it. Before anything is reconnected, record
   what a reconnect could drop: Vercel deploy hooks, Sentry code mappings, and where the Linear
   commit webhook lives. Export the CodeRabbit learnings and organization settings. Verify:
   `gh api orgs/green-goods/installations` lists each app.
5. **Draft the reference sweep pull request** (contents below), so it moves with the repository.
   Verify: CI passes on the draft.
6. **Snapshot settings for comparison and remove dead config.** Record rulesets, secret names,
   environments, webhooks, Actions permissions, CodeQL default setup and team access. Turn off
   the GitHub Pages configuration, whose site already returns 404.

### Phase B: Cutover (a quiet window of about an hour)

7. **Pick the window and freeze merges.** Choose a quiet weekend after the 2.1.0 release ships
   (decision 15). Weekend hours in Pacific time are clear of routines: the weekday routines finish
   on Friday evening and resume early on Monday. Confirm with the routine list on the day.
8. **Transfer** the repository to `green-goods`, entering `platform` as the new name.
9. **Restore access and remotes.** Grant the three new teams access, add the repository to any app
   installed for selected repositories, and run `git remote set-url` once in the primary checkout,
   which covers all of its worktrees.
10. **Compare settings** against the Phase A snapshot (`eval.md`, AC-3).
11. **Reconnect integrations**: Vercel projects, the Fly app, the TinaCloud repository, the Linear
    organization, CodeRabbit (import the learnings, reapply settings), Codex review, Sentry,
    PostHog, Chromatic and the Lighthouse token.
12. **Merge the sweep pull request** as the end-to-end check, then promote the website and docs
    production builds, which do not promote themselves.
13. **Update the routines.** With the spec edits merged, send each stored prompt and source update
    with the full job configuration (a partial update resets the routine's session settings), then
    re-read each routine.

### Phase C: Follow-through (first week)

14. **Switch the indexer** at the next Envio deployment and point the apps at the new endpoint once
    it has synced.
15. **Update living references outside the repository**: living Drive drafts, the guild's `.github`
    files that mention this repository, Linear team pages, external project profiles and agent
    memory notes. Watch the first scheduled routine runs.

## Reference Sweep Contents

Find every candidate with `git grep -n greenpill-dev-guild -- ':!.plans'`.

Update:
- `.github/CODEOWNERS`: the new maintain team (decision 12).
- `.github/workflows/supply-chain-guardrails.yml`: check out the guardrail script from
  `green-goods/.github` at the pinned commit (decision 11).
- `docs/docusaurus.config.ts`: the edit URL, the navbar link and the redirect targets.
- `scripts/docs/renderers.mjs` and `scripts/quality/ontology-render.mjs`, then regenerate the
  generated docs and the ontology page.
- `packages/client/src/components/Public/PublicFooter.tsx` and its test.
- `README.md` and `docs/docs/builders/getting-started.mdx`: the clone URL and `cd platform`.
- Builder docs pages that link to the repository.
- Routine specs in `docs/routines/` that build repository URLs or clone the repository.
- `.claude/skills/qa-triage/references/intake.md`: the compare URL.
- The old Linear workspace URL in living files: guidance such as
  `.claude/context/linear-routing-rules.md`, `.github/ISSUE_TEMPLATE/config.yml`, docs pages, and
  routine specs such as `docs/routines/research-agenda.md` (decision 14).
- Fallbacks and fixtures: `scripts/ops/prune-codeql-caches.mjs`,
  `packages/shared/.storybook/prepare-design-assets.mjs`, `scripts/quality/ci-gate.test.mjs` and
  `docs/scripts/docs-audit.test.mjs`.
- Remove `packages/client/.npmrc`; nothing uses its registry scope.
- `.dev-surfaces/surfaces.json`: the root path.
- The indexer runbooks' Envio project link, after step 14.

Leave unchanged:
- `.plans` history, dated reports and `docs/releases` notes, including their old Linear workspace
  links (decision 14).
- The commit-pinned issuer-terms permalink in the commitment-pooling live config.
- Contract comment links.
- Copyright and license holder lines, which wait on the operating-entity decision.
- Links to repositories that stay with the guild.

## Requirements Coverage

| Requirement (`spec.md`) | Planned Step | Status |
|---|---|---|
| 1. Transfer with rename | 8 | ⏳ |
| 2. Old URLs keep resolving | 6, 8, `eval.md` AC-2 | ⏳ |
| 3. Integrations installed and verified | 4, 11 | ⏳ |
| 4. Access preserved | 3, 9 | ⏳ |
| 5. Living references updated | 5, 12, 15 | ⏳ |
| 6. Routines keep running | 13 | ⏳ |
| 7. No silent failures | 10 to 14, `eval.md` | ⏳ |

## TDD / Proof Order

Not applicable: the move changes no product behavior. The sweep pull request updates links,
generated docs and test fixtures, and is proven by the checks the selector chooses for those paths.
Integration health is proven by the acceptance checks in `eval.md`.

## Rollback

Treat the move as one-way. Transferring back is possible in principle but untested, and whether a
retired name can be reused, even by this repository, is unresolved.

## Validation

- [ ] `node scripts/harness/plan-hub.mjs validate` for hub changes
- [ ] `bun run check --plan -- --intent push` to select checks for the sweep pull request
- [ ] The acceptance checks in `eval.md` on cutover day
