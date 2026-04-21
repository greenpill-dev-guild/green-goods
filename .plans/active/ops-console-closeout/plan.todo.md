# Ops Console Closeout Plan

**Feature Slug**: `ops-console-closeout`
**Status**: `ACTIVE`
**Created**: `2026-04-19`
**Priority**: `p2`
**Branch**: n/a — most items touch no code. The one exception (native es/pt translation pass) lands on `chore/ops-console-closeout-i18n` when started.

> **Why this hub exists:** four otherwise-near-complete hubs each carry a small tail of manual GitHub / PostHog / translator work. Rolling them into one checklist lets the parent hubs close now (once their agent-doable tails land) instead of staying open indefinitely for operator-only items. Completion here is **human-gated** — the agent's role is post-hoc verification, not execution.

## Source Hubs

| Source hub | Rows migrated here | Blocker type |
|---|---|---|
| `github-copilot-rollout` | Automatic review ruleset, premium budget, security toggles, CodeQL/Dependabot enable, 2-week pilot metrics review | GitHub.com UI |
| `admin-ui-revamp` | PostHog dashboard + funnel updates (D54) | PostHog UI |
| `admin-ui-revamp` | Native es/pt translation pass (D56) — after agent freezes en.json | Native translators |

`client-z-index-sweep` migrated its live-browser QA rows here on 2026-04-19 after the agent-doable tail closed (Section 4 below). `design-system-enforcement` likewise migrates its responsive breakpoint sweep here if needed — otherwise closes on the parent hub via the standard validation ladder.

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Consolidate 4 hubs' manual tails into one hub | Each parent hub can close once its agent-doable tail lands; no manual work blocks parent closure. |
| 2 | Agent role = post-hoc verification, not execution | GitHub rulesets, PostHog dashboards, and native translation each require a human operator; the agent confirms live state via `gh api`, PostHog API, locale grep. |
| 3 | Translation pass waits on en.json formalization in `admin-ui-revamp` | Do not translate inline strings that will move. D56 already agreed to ship English-with-fallback first; real translation is additive, done here. |
| 4 | Do not migrate a row from its parent hub until the parent's agent-doable tail has merged | Keeps the trail from this hub back to the commit that closed the code side. |
| 5 | No `ui` / `state_api` / `contracts` lane — only `qa_pass_1` carries work | Purely operational hub; `qa_pass_1` is the verification agent pass after each Afo section. |

## Checklist

### 1. GitHub Copilot Rollout (source: `.plans/active/github-copilot-rollout`)

Reference: `.github/copilot-rollout-settings-checklist.md` for screenshots and exact navigation; this is the execution queue.

- [ ] Enable automatic Copilot PR review on open PRs targeting `main` and `develop` (drafts excluded).
- [ ] Enable rerun-on-push for qualifying PRs (new commits retrigger review).
- [ ] Set Copilot premium-request budget + alert threshold before the rollout goes broad (first-layer cost control).
- [ ] Scope automatic review to `main` / `develop` only at the ruleset level.
- [ ] Enable dependency graph + Dependabot alerts repo-wide.
- [ ] Enable secret scanning + push protection.
- [ ] Enable CodeQL default setup for JS/TS + GitHub Actions (config already committed at `.github/codeql/codeql-config.yml` + `.github/workflows/codeql.yml`).
- [ ] Wire Dependabot alerts → assign to Copilot coding agent for conservative remediation PRs.
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

### 2. Admin UI Revamp — PostHog (source: `.plans/active/admin-ui-revamp` D54)

- [ ] Update PostHog dashboards to include the new admin route paths: `/hub/work`, `/hub/actions`, `/garden`, `/community`, `/fund`, `/gardens`, `/impact`, `/actions`.
- [ ] Update funnel definitions that reference retired / renamed route paths.
- [ ] Confirm `usePageView` auto-capture is firing for each new route in the PostHog Events explorer.

**Agent verification:** PostHog `insight` / `dashboards` API read confirming the dashboards list the new paths; events feed sanity-check that at least one capture per new route has landed within the last 24h of Afo's session.

### 3. Admin UI Revamp — Translation (source: `.plans/active/admin-ui-revamp` D56)

**Gate:** the agent formalizes the ~15 admin revamp strings (empty states, toasts, palette labels, Phase 2/3 items) into `packages/shared/src/i18n/en.json` in the parent hub before this row starts. Do **not** translate moving targets.

- [x] `en.json` key set for the revamp frozen (agent task on `admin-ui-revamp`). **Closed 2026-04-19:** 11 `app.error.route.*` keys added to `packages/shared/src/i18n/{en,es,pt}.json` with English fallbacks; `RouteErrorBoundary.tsx` refactored to consume them via `useIntl`; locale-coverage test + admin lint + admin typecheck + admin test suite all exit 0. Awaiting Afo's commit to make the freeze merge-backed.
- [ ] `es.json` filled with native Spanish strings (coordinate with translator).
- [ ] `pt.json` filled with native Portuguese strings.
- [ ] `bun run lint:vocab` passes across all three locales.
- [ ] Spot-check render in admin at `?lang=es` and `?lang=pt` via Chrome MCP.

**Agent verification:** after translation merge, a locale grep confirms no es.json / pt.json value in the revamp key set equals its en.json counterpart; `bun run lint:vocab` passes.

### 4. Client Z-Index Sweep — Live Browser QA (source: `.plans/active/client-z-index-sweep`)

Migrated 2026-04-19 after the agent-doable tail closed (grep, lint, test, build all green; toast escape hatch documented on the parent hub). These are the remaining rows that require a live browser session with the client app running.

- [ ] Stacking scenario 1: DraftDialog opens over InstallPrompt over AppBar → topmost surface is DraftDialog.
- [ ] Stacking scenario 2: Toast fires while DraftDialog is open → topmost is Toast.
- [ ] Stacking scenario 3: ImagePreviewDialog opens over WorkCard fullscreen → topmost is ImagePreview.
- [ ] Stacking scenario 4: Wallet connect modal (third-party escape hatch) renders above everything.
- [ ] Mobile 375px visual QA: DraftDialog + AppBar + OfflineIndicator stack renders without regression (iPhone-width viewport).

**Agent verification:** once Afo confirms, a Chrome MCP re-run of the four scenarios can capture a short GIF as evidence and attach it to the parent hub's `history[]`.

### 5. Design System Enforcement — Responsive Breakpoint Sweep (source: `.plans/active/design-system-enforcement`)

Migrated 2026-04-19 after the agent-doable tail closed (all token/lint/test/build gates green on the parent hub). This is the only remaining row on that hub and requires a live admin dashboard at multiple viewport widths.

- [ ] Admin dashboard visual QA at 375px (mobile).
- [ ] Admin dashboard visual QA at 768px (tablet — garden detail rail-as-strip layout per Decision 5).
- [ ] Admin dashboard visual QA at 1024px (desktop — rail reverts to 9fr/3fr grid).
- [ ] Admin dashboard visual QA at 1440px (wide — composition holds; no overflow).

**Agent verification:** Chrome MCP can drive the sweep once the admin app is running in a tab; capture a screenshot per breakpoint.

## Coordination With Parent Hubs

Once each parent hub's agent-doable tail has merged, the parent hub's `plan.todo.md` should strike its "Manual / Human Tasks" rows and link here. Concrete touch-ups pending at that point:

- `.plans/active/admin-ui-revamp/plan.todo.md` — strike PostHog + translation rows from the "Manual / Human Tasks" section; add a single line: "Remaining manual ops tracked in `.plans/active/ops-console-closeout`."
- `.plans/active/github-copilot-rollout/plan.todo.md` — strike Step 4 / 8 / 10 / 11 validation rows and its "Validation" ruleset / budget / scan lines; same cross-link.
- `.plans/active/github-copilot-rollout/status.json` — once all parent-side code is verified merged, flip `workflow.overall_status` to `done` and cite this hub for the remaining manual items.

**Do not migrate rows until each parent's agent-doable tail has merged** (Decision 4).

## Validation

- [ ] `node scripts/plan-hub.mjs validate` after every edit to `status.json` here or on a parent hub.
- [ ] After each Afo-completed item, the matching `gh api` / PostHog API read / locale grep passes and is recorded in `status.json` `history[]`.

## Deferred

- [ ] ESLint `no-restricted-syntax` rule preventing deprecated PostHog event names in new code — separate follow-up, out of scope for this hub.
