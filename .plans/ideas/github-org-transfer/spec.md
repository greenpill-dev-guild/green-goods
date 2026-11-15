# GitHub Organization Transfer Spec

## Summary

Move the repository from `greenpill-dev-guild/green-goods` to `green-goods/platform` with GitHub's
repository transfer, renaming it in the same step. Prepare the new organization first, so that
access, GitHub Apps and settings are in place when the repository arrives. Then reconnect each
integration, verify it, and update living references in one pull request. History and immutable
records keep their old links, which resolve through GitHub's redirects.

## Users

- Primary: maintainers and coding agents, who depend on CI, deploys, review bots, tracker links and
  routines working the day after the move.
- Secondary: contributors with forks and local clones, and readers who follow old links from
  documents, grant records, issues and external profiles.

## Functional Requirements

1. The repository moves by transfer, not by re-creation or a mirror push, and is renamed to
   `platform` in the same step.
2. Old web, git and API URLs for `greenpill-dev-guild/green-goods` keep resolving. Nothing is ever
   created at the old path.
3. Every integration bound to the owning organization is installed on `green-goods` before the
   transfer and verified after it.
4. Everyone with write, triage or maintain access keeps it, through teams in the new
   organization. The read-only team is retired.
5. Living references (docs, config, scripts, tests, routine specs, CODEOWNERS) point at the new
   location. History and immutable records are left as written.
6. Cloud routines keep running from the new repository URL.
7. No integration fails silently: each one has a named check in `eval.md`.

## Research Evidence

Observed on 2026-11-14 unless marked otherwise. Labels: Established (stated by a primary source or
observed directly), Inferred (reasoned from established facts), Unresolved.

### How a transfer behaves (GitHub Docs, read 2026-11-14)

- Established: issues, pull requests, wiki, stars and watchers move. Webhooks, services, secrets
  and deploy keys stay attached. Git LFS objects move. Forks stay attached, and a repository that is
  itself a fork stays linked to its upstream.
- Established: old web links and git clone, fetch and push redirect. API redirects were observed
  working for another repository that made the same move.
- Established: creating a new repository or fork at the old location ends the redirects.
- Established: when a repository had more than 100 clones or GitHub Actions uses in the seven days
  before a transfer, GitHub permanently retires the old owner and name. Inferred: weekly clone
  volume here is far above that threshold, so the old name will be retired and the redirect cannot
  be broken by accident.
- Established: GitHub Pages sites are not redirected. References to actions or reusable workflows
  by the old owner or name stop working.
- Established: an owner of the target organization can rename the repository during the transfer.
- Unresolved (not covered by the docs): rulesets, environments, Actions variables, CodeQL default
  setup and team access. Teams belong to an organization, so access through the old organization's
  teams is expected to end (Inferred).
- Established: the self-serve "Leave fork network" option needs a public fork under 1 GB with no
  child forks. It is permanent and deletes issues, pull requests, stars and watchers. GitHub
  Support can detach a fork and keep its history.

### Repository facts

- The repository is public. It is a fork of the archived `greenpill-dev-guild/camp-green` and has
  child forks of its own, so the self-serve leave option is not available.
- GitHub Pages is still configured, but the site returns 404.
- All rulesets are repository-scoped. Their bypass actors are the organization-admin role and the
  Dependabot app, which resolve in any owning organization. The required status check is `CI Gate`.
- Workflows read `github.repository` instead of a fixed name. There is no OIDC trust, runners are
  GitHub-hosted, and actions must be pinned by SHA. One cross-organization dependency exists:
  `.github/workflows/supply-chain-guardrails.yml` checks out the guild's public `.github`
  repository at a pinned commit.
- All non-owner access comes through guild teams, and CODEOWNERS names a guild team. There are no
  direct collaborators.
- The repository has its own CONTRIBUTING, SECURITY, CODE_OF_CONDUCT and LICENSE files. It inherits
  SUPPORT and FUNDING from the guild's `.github` repository.
- One organization-level secret and one variable reach the repository from the guild. No workflow
  reads them.
- The guild's `cookie-jar` repository already moved to `green-goods`, and its old API URL redirects.
  It has not been pushed since, so it does not show how integrations behave after a move.

### Integrations bound to the owning organization

Re-derive the live list at cutover. Do not rely on a copied inventory:
`gh api orgs/greenpill-dev-guild/installations`, the routine list from the remote-trigger API, and
the Vercel project search by repository URL. Vendor behavior below comes from vendor docs read on
2026-11-14.

| Category | What matters for a transfer | Confidence |
|---|---|---|
| Web deploys (Vercel) | The app must be installed on the organization that owns the repository; missing app access is a documented reason commits stop deploying. Whether the project link survives is undocumented. The documented repair, disconnect and reconnect, may drop deploy hooks. | Established, link survival Unresolved |
| Agent deploys (Fly GitHub app) | Relinking after a transfer is undocumented. A GitHub Actions deploy with a deploy token is the documented fallback. A Fly community notice from 12 to 13 Nov 2026 (not official docs) says GitHub tokens were revoked and auto-deploy resumes only after the person who linked the repository signs in again. | Unresolved |
| Indexer (Envio Cloud) | Envio identifies organizations by their GitHub name and says pushes stop deploying after an organization rename; contact them first. There is no self-serve way to change an indexer's repository. Each deployment has its own endpoint URL, and deleting an indexer deletes its deployments. | Established |
| Review bots (CodeRabbit, Codex) | CodeRabbit learnings belong to the Git organization and move by export and import; organization UI settings stay behind, and this repository has no `.coderabbit.yaml`. Codex review is switched on per repository. | Established |
| Tracker (Linear) | Several GitHub organizations can be connected for pull request automation; commit linking works for one organization through a webhook. Attachment continuity after a transfer is undocumented. | Established, continuity Unresolved |
| Cloud agents (Claude GitHub App) | Sessions can clone any public repository. GitHub triggers and Auto-fix need the app on the repository. Each routine stores its own repository sources. | Established |
| Content editor (TinaCloud) | Install the app per organization, then use Change Repository in the project configuration and Refresh Webhooks. | Established |
| Observability (Sentry, PostHog) | Both install per GitHub organization, and Sentry accepts several. What happens to existing code mappings is undocumented. PostHog marks a lost connection "Removed from GitHub". | Established, mappings Unresolved |
| Visual tests (Chromatic) | Unlinking and relinking the same project keeps its baselines. Publishing here is manual. | Established |
| Performance checks (Lighthouse CI) | Authorize the app for the new owner and expect a new token. The checks are advisory here. | Inferred |
| Dependency updates (Dependabot) | Built into GitHub; unaffected. | Established |

### Adjacent renames already done

- Linear: the workspace URL changed. Old `linear.app/greenpill-dev-guild/...` links redirect
  (observed signed in; Linear's changelog documents the redirect).
- Vercel: the team slug changed, so preview hostnames changed. The Agent's preview-origin rule
  still names the old slug; that fix is tracked separately.
- Drive: the shared drive was renamed in place.
- The local checkout moved. `.dev-surfaces/surfaces.json` still names the old path.

### Reference scale

- `git grep -l greenpill-dev-guild` listed 147 tracked files: mostly GitHub links, many links on the
  old Linear workspace URL, and the CODEOWNERS team. About two thirds of them are `.plans` history.
- Renaming to `platform` adds the README and getting-started steps that `cd green-goods` after
  cloning, and new forks default to the name `platform`.
- Linear issues and Drive documents hold many old links. All resolve through redirects; only living
  drafts need edits.
- No contract source, deployment config or on-chain metadata contains the repository URL.
- Inferred from code: the commit-pinned terms permalink in
  `packages/shared/src/modules/commitment-pooling/service-issuer-live-config.ts` is part of the
  issuer-terms data that approvals are checked against. It must not change.

### Open inferences to settle during execution

- Rulesets, environments, CodeQL default setup and Actions settings survive the transfer.
- An app installed for all repositories covers the repository the moment it arrives. This is
  documented for CodeRabbit only.
- Vercel project links, Linear attachments, Sentry code mappings and Tina's project configuration
  survive or need a reconnect.
- Whether a retired name could be reused, even by this repository, if it were ever transferred back.

## Human Judgment Points

- Decided on 2026-11-14 (the decision log in `plan.todo.md` has the rationale):
  - Target `green-goods/platform`, renamed in the transfer step. Not scheduled until the 2.1.0
    release ships.
  - Keep the "forked from `camp-green`" label; no request to GitHub Support.
  - Ask Envio to move the existing indexer; recreate it only if they cannot.
  - The new organization requires sign-off on web commits and lets only owners create public
    repositories.
  - The supply-chain guardrail script moves to a new `green-goods/.github` repository.
  - Three teams (maintain, triage, write); the guild's read-only team is not recreated.
  - Ruleset bypass stays with organization owners, accepting that the new organization has one
    more owner than the guild.
  - Old Linear workspace links change in living files only.
- Open: Envio's answer, and the exact weekend once 2.1.0 has shipped.
- Not a decision: the hosted projects and apps already carry Green Goods names. Only the indexer's
  organization in Envio still carries the guild name, and the Envio decision covers it.
- Protected surfaces: organization and repository settings, rulesets, CODEOWNERS, workflows,
  routine configuration and deploy integrations. AGENTS.md treats these as sensitive; report every
  change.

## Non-Functional Constraints

- Security: 2FA, SHA pinning, the read-only default token and the rulesets stay at least as strict.
  No gate is weakened to ease the move. Agents never handle secret values.
- Public repository: this hub, the sweep pull request and generated docs contain no personal names,
  handles, private document titles or live inventories.
- Signing: commits stay SSH-signed through the maintainer's signing agent.
- Package boundaries, product URLs and package names are unchanged.

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| Organization setup, integrations, transfer | ops (maintainer) | Dashboard and settings work; agents assist with reads and checks |
| Reference sweep | docs and config pull request | Docs, generated docs, config, tests, CODEOWNERS |
| Routine specs and stored prompts | ops | Spec edits in the sweep, then full stored-prompt updates |
| UI, state, contracts, QA lanes | `n/a` | No product behavior changes |

## Risks

| Risk | Mitigation |
|---|---|
| Deploys stop silently after the move (Vercel, Fly) | Install apps on `green-goods` first; verify the first push deploys |
| The indexer cannot deploy from the moved repository | Settle the path with Envio before the move; keep the current deployment serving; never delete the indexer |
| Review knowledge is lost | Export CodeRabbit learnings before the move; import after |
| People lose access | Recreate teams and invitations first; grant access right after the transfer |
| Routines stop without an error | Update sources and prompts; confirm each next run creates a session |
| A pinned or immutable reference breaks | Leave history, submitted records and pinned permalinks unchanged |
| The old name gets reused | Never create a repository or fork at the old path; name retirement is expected |
| Merges collide with the cutover | Freeze merges during the window |
| The owner bypass covers one more person than today | Accepted (decision 13); revisit whenever organization ownership changes |
