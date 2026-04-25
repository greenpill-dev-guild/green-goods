# Manual Ops Closeout Plan

**Feature Slug**: `manual-ops-closeout`
**Status**: `ACTIVE`
**Created**: `2026-04-19`
**Priority**: `p2`
**Branch**: n/a — most items touch no code. The one exception (native es/pt translation pass) lands on `chore/manual-ops-closeout-i18n` when started.

> **Why this hub exists:** operator-only GitHub / PostHog / translator / live-browser QA work should live in one current checklist, not in deleted implementation plans. Completion here is **human-gated** — the agent's role is post-hoc verification, not execution.

## Task Families

| Task family | Rows tracked here | Blocker type |
|---|---|---|
| `github-copilot-rollout` | Remaining GitHub settings and pilot-review items after 2026-04-25 API verification | GitHub.com UI / org admin |
| Admin telemetry | PostHog dashboard + funnel updates for current admin routes | PostHog UI |
| Admin i18n | Native es/pt translation pass after English keys are stable | Native translators |
| Client stacking QA | Draft dialog, toast, image preview, wallet modal, and mobile stack checks | Live browser |
| Design breakpoint QA | Admin dashboard checks at 375/768/1024/1440px | Live browser |

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Consolidate manual tails into one hub | Deleted or completed implementation plans should not remain open just to host operator-only checks. |
| 2 | Agent role = post-hoc verification, not execution | GitHub rulesets, PostHog dashboards, and native translation each require a human operator; the agent confirms live state via `gh api`, PostHog API, locale grep. |
| 3 | Translation pass waits on stable en.json keys | Do not translate inline strings that will move; real translation is additive, done here. |
| 4 | Keep deleted-plan context out of agent instructions | The current checklist must be self-contained so agents do not chase stale paths. |
| 5 | No `ui` / `state_api` / `contracts` lane — only `qa_pass_1` carries work | Purely operational hub; `qa_pass_1` is the verification agent pass after each Afo section. |

## Checklist

### 1. GitHub Copilot Rollout (source: `.plans/active/github-copilot-rollout`)

Reference: `.github/copilot-rollout-settings-checklist.md` for screenshots and exact navigation; this is the execution queue.

- [x] Enable automatic Copilot PR review on PRs targeting `main` and `develop`. **Verified 2026-04-25:** active rulesets `main` and `dev` both include `copilot_code_review`.
- [x] Enable rerun-on-push for qualifying PRs (new commits retrigger review). **Verified 2026-04-25:** both rulesets have `review_on_push: true`.
- [ ] Adjust draft-review parity: `main` excludes draft PRs, but `develop` currently has `review_draft_pull_requests: true`; plan intent is drafts excluded.
- [ ] Set Copilot premium-request budget + alert threshold before the rollout goes broad (first-layer cost control).
- [x] Scope automatic review to `main` / `develop` only at the ruleset level. **Verified 2026-04-25:** ruleset conditions include only `refs/heads/main` and `refs/heads/develop`.
- [x] Enable dependency graph + Dependabot alerts repo-wide. **Verified 2026-04-25:** vulnerability alerts endpoint returned `204 No Content`, and Dependabot security updates are enabled.
- [x] Enable secret scanning + push protection. **Verified 2026-04-25:** repo security settings show both enabled.
- [x] Enable CodeQL default setup for JS/TS + GitHub Actions. **Verified 2026-04-25:** default setup state is `configured` for `actions`, `javascript`, `javascript-typescript`, `python`, and `typescript`.
- [ ] Route/remediate open Dependabot alerts, then decide which suitable alerts should be assigned to Copilot coding agent. **Current state 2026-04-25:** 14 open alerts, including 1 critical and multiple high severity alerts.
- [ ] Enable Copilot cloud-agent signed commits + runner/firewall controls before expanding autonomous features.
- [ ] 2-week pilot review: capture coverage, rerun usefulness, reopened bugs, remediation speed, premium-request spend, and maintainer trust; append as a `history[]` entry on the parent `github-copilot-rollout` hub.

**Agent verification (run after each manual item is reported done):**

```
gh api repos/greenpill-dev-guild/green-goods/rulesets
gh api repos/greenpill-dev-guild/green-goods/code-scanning/default-setup
gh api repos/greenpill-dev-guild/green-goods/dependabot/alerts --paginate
gh api repos/greenpill-dev-guild/green-goods/secret-scanning/alerts --paginate
gh api /orgs/greenpill-dev-guild/copilot/billing   # premium budget visibility
```

Record each probe's relevant output snippet in `status.json` `history[]` with the AC id it satisfies.

### 2. Admin Telemetry — PostHog

- [ ] Update PostHog dashboards to include the new admin route paths: `/hub/work`, `/hub/actions`, `/garden`, `/community`, `/fund`, `/gardens`, `/impact`, `/actions`.
- [ ] Update funnel definitions that reference retired / renamed route paths.
- [ ] Confirm `usePageView` auto-capture is firing for each new route in the PostHog Events explorer.

**Agent verification:** PostHog `insight` / `dashboards` API read confirming the dashboards list the new paths; events feed sanity-check that at least one capture per new route has landed within the last 24h of Afo's session.

### 3. Admin Translation

**Gate:** the English key set for admin route-error and current admin-shell strings must be stable before this row starts. Do **not** translate moving targets.

- [x] Route-error `en.json` key set frozen. **Closed 2026-04-19:** 11 `app.error.route.*` keys added to `packages/shared/src/i18n/{en,es,pt}.json` with English fallbacks; `RouteErrorBoundary.tsx` refactored to consume them via `useIntl`; locale-coverage test + admin lint + admin typecheck + admin test suite all exit 0.
- [ ] `es.json` filled with native Spanish strings (coordinate with translator).
- [ ] `pt.json` filled with native Portuguese strings.
- [ ] `bun run lint:vocab` passes across all three locales.
- [ ] Spot-check render in admin at `?lang=es` and `?lang=pt` via Chrome MCP.

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

- [ ] `node scripts/plan-hub.mjs validate` after every edit to `status.json` here or on a parent hub.
- [ ] After each Afo-completed item, the matching `gh api` / PostHog API read / locale grep passes and is recorded in `status.json` `history[]`.

## Deferred

- [ ] ESLint `no-restricted-syntax` rule preventing deprecated PostHog event names in new code — separate follow-up, out of scope for this hub.
