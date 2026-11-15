# GitHub Organization Transfer Evaluation Plan

## Release Gates

1. Continuity: the repository keeps its ID, history, pull requests, stars, secrets and webhooks.
2. Links: old web, git and API URLs resolve to `green-goods/platform`.
3. Access: everyone with write, triage or maintain access keeps it, through teams in the new
   organization. The read-only team is retired (decision 12).
4. No silent failures: every integration on the day's inventory has a check below. The cutover
   gates pass before the window closes; the follow-up checks pass within the first week.
5. Safety: no ruleset, Actions policy or organization security setting is weaker than before,
   proven by reading each one back (AC-5), not assumed.
6. Public boundary: the sweep pull request and generated docs add no personal names, private
   document titles or live inventories.

## Cutover Gates

Run these during the cutover window and compare against the Phase A snapshot (`plan.todo.md`,
step 6). The cutover is complete when every gate passes. A failing gate holds the window open
until it is fixed, or until its outage is accepted and recorded here.

| ID | Check | Evidence |
|---|---|---|
| AC-1 | The repository is at the new path with the same identity | `gh api repos/green-goods/platform --jq '.full_name, .id, .node_id'` matches the ID and node ID recorded in the snapshot |
| AC-2 | Old URLs redirect | `gh api repos/greenpill-dev-guild/green-goods --jq .full_name` returns `green-goods/platform`; `git ls-remote https://github.com/greenpill-dev-guild/green-goods.git HEAD` succeeds; an old pull request URL opens the same pull request |
| AC-3 | Repository settings match the snapshot | Compare `rulesets`, `actions/secrets`, `environments`, `hooks`, `actions/permissions`, `actions/permissions/workflow` and `code-scanning/default-setup` under `repos/green-goods/platform` with the snapshot |
| AC-4 | Effective access matches | Each person's role from `gh api 'repos/green-goods/platform/collaborators?affiliation=all' --jq '.[] \| [.login, .role_name]'` matches the snapshot, except people who had only the retired read-only team; the three teams are attached at their levels (`repos/green-goods/platform/teams`); `gh api repos/green-goods/platform/codeowners/errors` reports no errors. Keep both access lists outside this repository |
| AC-5 | Organization security settings hold | `gh api orgs/green-goods --jq '{two_factor_requirement_enabled, web_commit_signoff_required, members_can_create_public_repositories, default_repository_permission}'` reads true, true, false and the snapshot's base permission; `gh api orgs/green-goods/actions/permissions` allows the same actions as before and requires SHA pinning; `gh api orgs/green-goods/actions/permissions/workflow` reads a read-only default token that cannot approve pull requests. The two Actions endpoints need a token with `admin:org` |
| AC-6 | Web deploys run | The post-transfer push to the sweep branch (`plan.todo.md`, step 12) deploys a preview for every linked Vercel project |
| AC-7 | The Agent deploys | A push to the branch Fly deploys from gets a successful "Fly.io" check run, and the Agent health endpoint shows a fresh release. On 2026-11-14 that check ran on `develop` pushes and not on `main`, although `packages/agent/README.md` and the 2.0.0 deployment runbook still say `main`; read the branch in the Fly app's deployment settings before the move |
| AC-8 | Review bots review | CodeRabbit and Codex both review the post-transfer push, and the imported CodeRabbit learnings are listed |
| AC-9 | Tracker links work | The sweep pull request attaches to its Linear issue, and the issue moves as the routing rules expect |
| AC-10 | The content editor writes | A TinaCloud edit commits to the repository |
| AC-11 | Observability is connected | Sentry lists the repository and its code mappings; the PostHog connection is active |
| AC-12 | Public sites link correctly | After the production promotions, the website footer and the docs links open `green-goods/platform` |
| AC-13 | Only intended old references remain | `git grep -n greenpill-dev-guild -- ':!.plans'` shows only the items listed under "Leave unchanged" in `plan.todo.md` |

## Follow-up Checks

These wait on scheduled or later events, so they may stay pending when the window closes. Each must
pass within the first week; record the result here. A failure reopens the follow-through phase.

| ID | Check | Evidence |
|---|---|---|
| AC-14 | Routines run | Each routine's next scheduled run creates a session that reads the new repository (the remote-trigger API's run list). The weekday routines first run on Monday |
| AC-15 | The indexer deploys | A deployment built from the moved repository syncs, and the apps read its endpoint (`plan.todo.md`, step 14) |
| AC-16 | Chromatic publishes | Dispatch the Design workflow with `publish_chromatic` and confirm a build appears in the Chromatic project linked to `green-goods/platform`. Publishing runs only on manual dispatch |
| AC-17 | Lighthouse posts its checks | Dispatch the Client and Admin workflows with the Lighthouse operation and confirm both advisory jobs post their status with the new `LHCI_GITHUB_APP_TOKEN`. These jobs run only on manual dispatch |

## Test Strategy

- Unit: the client footer test asserts the new repository link.
- Integration: generated docs and guidance checks selected by `bun run check --plan -- --intent push`
  for the sweep pull request.
- E2E / Playwright: not needed; no product behavior changes.
- Manual checks: the cutover gates during the window and the follow-up checks within the first
  week. Record the commands and their results in this hub.
- TDD proof: not applicable (`status.json` marks each lane `n/a` with a note).

## Cutover Verification

- The maintainer runs the dashboard steps. An agent can run the read-only `gh` and remote-trigger
  checks and record their output.
- A failing cutover gate holds the window open. A failing follow-up check stops the follow-through
  phase until that integration is fixed or its outage is accepted and recorded here.
