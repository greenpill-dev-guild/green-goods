# Manual Ops Closeout Evaluation Plan

## Release Gates

1. **Correctness:** every row migrated from a parent hub has either been completed by Afo (with link/snippet evidence) or explicitly re-scoped out.
2. **Usability:** Afo does not need to re-read each parent hub to understand what console work he owes — this hub is the single source.
3. **Regression safety:** no parent hub's release notes or `status.json` claims completion for an item that is actually sitting unchecked here.

## Acceptance Checks

| ID | Check | Owner | Evidence |
|---|---|---|---|
| AC-1 | Automatic Copilot review ruleset live on `main` + `develop`, rerun-on-push enabled | `qa_pass_1` | `gh api repos/greenpill-dev-guild/green-goods/rulesets` JSON snippet |
| AC-2 | Copilot premium-request budget + alert threshold set | `qa_pass_1` | `gh api /orgs/greenpill-dev-guild/copilot/billing` snippet or GitHub billing screenshot link |
| AC-3 | CodeQL default setup + secret scanning + push protection + Dependabot alerts enabled | `qa_pass_1` | `gh api` reads for `code-scanning/default-setup`, `secret-scanning/alerts`, `dependabot/alerts` |
| AC-4 | PostHog dashboards + funnels have no stale route references; `usePageView` fires `page_view` with `app` + `path` for current route families | `qa_pass_1` | `posthog-check.mjs` output; currently dashboards/insights pass stale-route scan, route-event proof fails with zero expected route events |
| AC-5 | Admin es/pt translation pass has no English fallbacks in the tracked key set | `qa_pass_1` | Agent locale diff; merged PR link if strings changed; `bun run lint:vocab` green |
| AC-6 | 2-week Copilot pilot metrics review recorded on `github-copilot-rollout` hub | `qa_pass_1` | `history[]` entry on the parent hub citing coverage, reruns, bugs, premium spend |
| AC-7 | Each parent hub's "Manual / Human Tasks" rows are either completed or struck and cross-linked here | `qa_pass_2` | Diff on parent hubs' `plan.todo.md` and `status.json` |
| AC-8 | Client stacking QA completed for DraftDialog, Toast, ImagePreviewDialog, wallet modal, and 375px overlap | `qa_pass_1` | Browser screenshots or short clip plus notes |
| AC-9 | Admin breakpoint QA completed at 375/768/1024/1440 | `qa_pass_1` | Browser screenshots per breakpoint |

## Test Strategy

- Unit: n/a
- Integration: n/a
- E2E / Playwright: n/a
- Manual checks:
  - `gh api repos/greenpill-dev-guild/green-goods/rulesets` returns at least the Copilot-review ruleset targeting `main` / `develop`.
  - PostHog checker confirms `page_view` capture with `app` and `path` for each current route family.
  - `bun run lint:vocab` passes for all three locales after the translation merge.
  - Locale diff confirms no tracked `app.admin.nav.*`, `app.admin.auth.*`, or `app.error.route.*` key remains equal to English in `es.json` / `pt.json`.
  - Browser QA captures client stacking and admin breakpoint evidence.

## QA Sequence

### Claude QA Pass 1

- Runs after each manual item is reported done by Afo.
- Invokes the matching `gh api` / PostHog API read / locale grep in the same turn.
- Records the probe command + output snippet in `status.json` `history[]` with the AC id it satisfies.
- Never ticks an AC from prior cache — each tick is evidence from that turn.

### Codex QA Pass 2

- Runs once `qa_pass_1` has green-checked every AC.
- Sweeps each parent hub's `plan.todo.md` + `status.json` and confirms the rows migrated to this hub are either completed or explicitly struck with a cross-link.
- Closes the loop on any residual row still claimed inline by a parent hub.
