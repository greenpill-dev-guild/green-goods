# Manual Ops Closeout Plan

**Feature Slug**: `manual-ops-closeout`
**Status**: `DONE / ARCHIVED`
**Created**: `2026-04-19`
**Priority**: `p2`
**Branch**: n/a — most items touch no code. The one exception (native es/pt translation pass) lands on `chore/manual-ops-closeout-i18n` when started.

> **Closure note 2026-04-28:** Afo clarified this should not remain an active
> manual-ops blocker. GitHub Copilot and privacy items are fine; PostHog route
> event proof, translation fill, client stacking QA, and admin breakpoint QA are
> agent-owned follow-up work when needed, not reasons to keep this hub active.

## Task Families

| Task family | Rows tracked here | Blocker type |
|---|---|---|
| `github-copilot-rollout` | Remaining GitHub settings and pilot-review items after 2026-04-25 API verification | GitHub.com UI / org admin |
| Admin telemetry | PostHog dashboard + funnel updates for current admin/client routes | Afo setup complete; agent API check complete with findings |
| Admin i18n | Native es/pt translation pass after English keys are stable | Agent audit complete; translation fill still open |
| Client stacking QA | Draft dialog, toast, image preview, wallet modal, and mobile stack checks | Agent browser QA |
| Design breakpoint QA | Admin dashboard checks at 375/768/1024/1440px | Agent browser QA |

## Completion Update — 2026-04-26

### Done / Recorded

- [x] Afo-only GitHub Copilot settings checklist reported complete by Afo on 2026-04-26.
- [x] Afo added a PostHog analytics read token and confirmed `POSTHOG_ANALYTICS_READ_KEY` as the canonical env name.
- [x] Agent added `.plans/active/manual-ops-closeout/posthog-check.mjs` for repeatable read-only PostHog verification.
- [x] Agent ran the PostHog checker against admin project `262122` and client project `163591`.
- [x] Agent verified the checker can fetch PostHog dashboards and insights: 10 dashboards, 104 insights.
- [x] Agent verified no stale route references were found in dashboards or insights/funnels.
- [x] Agent ran translation audit for tracked admin shell and route-error keys: no missing `es`/`pt` keys, 42 English fallbacks in each locale.
- [x] Agent ran `bun run lint:vocab`; vocabulary lint passed.
- [x] Agent archived the completed GitHub Copilot rollout hub and ran `node scripts/harness/plan-hub.mjs validate`; plan hub validation passed.

### Former Open Items

- PostHog route-event proof: agent-owned verification, not a manual blocker.
- PostHog privacy review: Afo confirmed privacy is fine.
- Native `es`/`pt` translation fill: AI/agent-owned work, not an Afo manual task.
- Client stacking browser QA: agent-owned browser QA.
- Admin breakpoint browser QA: agent-owned browser QA.

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Consolidate manual tails into one hub | Deleted or completed implementation plans should not remain open just to host operator-only checks. |
| 2 | Split Afo-only external-console decisions from agent-owned verification | GitHub billing/ruleset decisions and PostHog dashboard edits require Afo; translation audit, locale grep, PostHog API reads, and browser QA are agent-owned. |
| 3 | Translation pass waits on stable en.json keys | Do not translate inline strings that will move; real translation is additive, done here. |
| 4 | Keep deleted-plan context out of agent instructions | The current checklist must be self-contained so agents do not chase stale paths. |
| 5 | No `ui` / `state_api` / `contracts` lane — only `qa_pass_1` carries work | Purely operational hub; `qa_pass_1` is the verification agent pass after each Afo section. |

## Checklist

### 1. GitHub Copilot Rollout (source: `.plans/archive/github-copilot-rollout`)

Reference: `.github/copilot-rollout-settings-checklist.md` for screenshots and exact navigation; this is the execution queue.

- [x] Enable automatic Copilot PR review on PRs targeting `main` and `develop`. **Verified 2026-04-25:** active rulesets `main` and `dev` both include `copilot_code_review`.
- [x] Enable rerun-on-push for qualifying PRs (new commits retrigger review). **Verified 2026-04-25:** both rulesets have `review_on_push: true`.
- [x] Adjust draft-review parity. **Afo reported complete 2026-04-26; agent API re-verification optional/pending.**
- [x] Set Copilot premium-request budget + alert threshold before the rollout goes broad. **Afo reported complete 2026-04-26; agent API re-verification optional/pending.**
- [x] Scope automatic review to `main` / `develop` only at the ruleset level. **Verified 2026-04-25:** ruleset conditions include only `refs/heads/main` and `refs/heads/develop`.
- [x] Enable dependency graph + Dependabot alerts repo-wide. **Verified 2026-04-25:** vulnerability alerts endpoint returned `204 No Content`, and Dependabot security updates are enabled.
- [x] Enable secret scanning + push protection. **Verified 2026-04-25:** repo security settings show both enabled.
- [x] Enable CodeQL default setup for JS/TS + GitHub Actions. **Verified 2026-04-25:** default setup state is `configured` for `actions`, `javascript`, `javascript-typescript`, `python`, and `typescript`.
- [x] Route open Dependabot alerts and decide which suitable alerts should be assigned to Copilot coding agent. **Afo reported triage/routing complete 2026-04-26. Actual remediation PRs remain owned by the alert queue.**
- [x] Enable or intentionally defer Copilot cloud-agent signed commits + runner/firewall controls before expanding autonomous features. **Afo reported complete 2026-04-26.**
- [x] Pick 2-week pilot review date/owner. **Afo reported complete 2026-04-26.**
- [x] 2-week pilot review moved out of manual-ops blocking work. Capture coverage, rerun usefulness, reopened bugs, remediation speed, premium-request spend, and maintainer trust in a future operating routine if needed.

**Optional agent re-verification if machine evidence is later required:**

```
gh api repos/greenpill-dev-guild/green-goods/rulesets
gh api repos/greenpill-dev-guild/green-goods/code-scanning/default-setup
gh api repos/greenpill-dev-guild/green-goods/dependabot/alerts --paginate
gh api repos/greenpill-dev-guild/green-goods/secret-scanning/alerts --paginate
gh api /orgs/greenpill-dev-guild/copilot/billing   # premium budget visibility
```

Record each probe's relevant output snippet in `status.json` `history[]` with the AC id it satisfies.

### 2. PostHog Dashboard / Funnel Closeout

- [x] Add analytics read token for agent verification. **Canonical env name: `POSTHOG_ANALYTICS_READ_KEY`.**
- [x] Add repeatable checker: `.plans/active/manual-ops-closeout/posthog-check.mjs`.
- [x] Fetch admin/client dashboards and insights through PostHog API.
- [x] Verify dashboards/insights do not reference stale route paths. **Agent result 2026-04-26: no stale route references found.**
- [ ] Confirm `usePageView` captures for expected admin and client routes. **Agent result 2026-04-26: missing; zero expected `page_view` route events in last 30 days.**
- [ ] Review privacy-sensitive dashboard/insight references flagged by checker.

**Agent verification:** Run `node -r dotenv/config .plans/active/manual-ops-closeout/posthog-check.mjs`. The script checks admin project `262122`, client project `163591`, route `page_view` events, stale route references, and privacy-sensitive dashboard/insight references.

### 3. Admin Translation

**Gate:** the English key set for admin route-error and current admin-shell strings must be stable before this row starts. Do **not** translate moving targets.

- [x] Route-error `en.json` key set frozen. **Closed 2026-04-19:** 11 `app.error.route.*` keys added to `packages/shared/src/i18n/{en,es,pt}.json` with English fallbacks; `RouteErrorBoundary.tsx` refactored to consume them via `useIntl`; locale-coverage test + admin lint + admin typecheck + admin test suite all exit 0.
- [x] Agent lists tracked keys that still equal English in `es.json`. **Result 2026-04-26: 42 English fallbacks, 0 missing keys.**
- [x] Agent lists tracked keys that still equal English in `pt.json`. **Result 2026-04-26: 42 English fallbacks, 0 missing keys.**
- [ ] `es.json` filled with native Spanish strings.
- [ ] `pt.json` filled with native Portuguese strings.
- [x] `bun run lint:vocab` passes across all three locales. **Passed 2026-04-26.**
- [ ] Spot-check render in admin at `?lang=es` and `?lang=pt` via browser automation.

**Agent verification:** after translation merge, a locale grep confirms no es.json / pt.json value in the revamp key set equals its en.json counterpart; `bun run lint:vocab` passes.

### 4. Client Stacking — Live Browser QA

Code evidence previously showed no raw numeric z-index utility literals in `packages/client/src` or `packages/shared/src/components`; these are the remaining rows that require a live browser session with the client app running.

- [ ] Stacking scenario 1: DraftDialog opens over InstallPrompt over AppBar → topmost surface is DraftDialog.
- [ ] Stacking scenario 2: Toast fires while DraftDialog is open → topmost is Toast.
- [ ] Stacking scenario 3: ImagePreviewDialog opens over WorkCard fullscreen → topmost is ImagePreview.
- [ ] Stacking scenario 4: Wallet connect modal (third-party escape hatch) renders above everything.
- [ ] Mobile 375px visual QA: DraftDialog + AppBar + OfflineIndicator stack renders without regression (iPhone-width viewport).

**Agent verification:** once Afo confirms, a Chrome MCP re-run of the four scenarios can capture a short GIF as evidence and attach it to the parent hub's `history[]`.

### 5. Admin Design Breakpoints — Responsive Sweep

This requires a live admin dashboard at multiple viewport widths.

- [ ] Admin dashboard visual QA at 375px (mobile).
- [ ] Admin dashboard visual QA at 768px (tablet — garden detail rail-as-strip layout per Decision 5).
- [ ] Admin dashboard visual QA at 1024px (desktop — rail reverts to 9fr/3fr grid).
- [ ] Admin dashboard visual QA at 1440px (wide — composition holds; no overflow).

**Agent verification:** Chrome MCP can drive the sweep once the admin app is running in a tab; capture a screenshot per breakpoint.

## Validation

- [x] `node scripts/harness/plan-hub.mjs validate` after every edit to `status.json` here or on a parent hub. **Passed 2026-04-26 after GitHub Copilot archive/defer cleanup.**
- [ ] After each Afo-completed item, the matching `gh api` / PostHog API read / locale grep passes and is recorded in `status.json` `history[]`.

## Deferred

- [ ] ESLint `no-restricted-syntax` rule preventing deprecated PostHog event names in new code — separate follow-up, out of scope for this hub.
