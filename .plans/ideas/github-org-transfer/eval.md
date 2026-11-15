# GitHub Organization Transfer Evaluation Plan

## Release Gates

1. Continuity: the repository keeps its ID, history, pull requests, stars, secrets and webhooks.
2. Links: old web, git and API URLs resolve to `green-goods/platform`.
3. Access: everyone with write, triage or maintain access keeps it, through teams in the new
   organization. The read-only team is retired (decision 12).
4. No silent failures: every integration on the day's inventory passes its check below.
5. Safety: no ruleset, Actions policy or organization security setting is weaker than before.
6. Public boundary: the sweep pull request and generated docs add no personal names, private
   document titles or live inventories.

## Acceptance Checks

Run these on cutover day. Compare against the Phase A snapshot (`plan.todo.md`, step 6).

| ID | Check | Evidence |
|---|---|---|
| AC-1 | The repository is at the new path with the same ID | `gh api repos/green-goods/platform --jq '.full_name, .id'` matches the ID recorded before the move |
| AC-2 | Old URLs redirect | `gh api repos/greenpill-dev-guild/green-goods --jq .full_name` returns `green-goods/platform`; `git ls-remote https://github.com/greenpill-dev-guild/green-goods.git HEAD` succeeds; an old pull request URL opens the same pull request |
| AC-3 | Settings match the snapshot | Compare `rulesets`, `actions/secrets`, `environments`, `hooks`, `actions/permissions` and `code-scanning/default-setup` under `repos/green-goods/platform` with the snapshot |
| AC-4 | Access and organization rules match the decisions | `gh api repos/green-goods/platform/teams` lists the three teams at their levels; `gh api repos/green-goods/platform/codeowners/errors` reports no errors; the organization requires web commit sign-off and owner-only public repositories |
| AC-5 | Web deploys run | The first push after the move deploys every linked Vercel project; previews appear on the sweep pull request |
| AC-6 | The Agent deploys | The sweep merge into `develop` gets a successful "Fly.io" check run, and the Agent health endpoint shows a fresh release |
| AC-7 | Review bots review | CodeRabbit and Codex both review the sweep pull request, and the imported CodeRabbit learnings are listed |
| AC-8 | Tracker links work | The sweep pull request attaches to its Linear issue, and the issue moves as the routing rules expect |
| AC-9 | Routines run | Each routine's next run creates a session that reads the new repository (the remote-trigger API's run list) |
| AC-10 | The content editor writes | A TinaCloud edit commits to the repository |
| AC-11 | The indexer deploys | A deployment built from the moved repository syncs, and the apps read its endpoint (after step 14) |
| AC-12 | Observability is connected | Sentry lists the repository and its code mappings; the PostHog connection is active |
| AC-13 | Public sites link correctly | After the production promotions, the website footer and the docs links open `green-goods/platform` |
| AC-14 | Only intended old references remain | `git grep -n greenpill-dev-guild -- ':!.plans'` shows only the items listed under "Leave unchanged" in `plan.todo.md` |

## Test Strategy

- Unit: the client footer test asserts the new repository link.
- Integration: generated docs and guidance checks selected by `bun run check --plan -- --intent push`
  for the sweep pull request.
- E2E / Playwright: not needed; no product behavior changes.
- Manual checks: AC-1 to AC-13 on cutover day. Record the commands and their results in this hub.
- TDD proof: not applicable (`status.json` marks each lane `n/a` with a note).

## Cutover Verification

- The maintainer runs the dashboard steps. An agent can run the read-only `gh` and remote-trigger
  checks and record their output.
- A failed check stops the follow-through phase until that integration is fixed or its outage is
  accepted and recorded here.
