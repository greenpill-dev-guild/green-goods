# Agent Run Ledger

Use one entry per meaningful delegated run. Keep private prompts, secrets, raw tokens, private source bodies, and sensitive user data out of this file.

## Entry Template

| Field | Value |
|---|---|
| Date | YYYY-MM-DD |
| Feature |  |
| Repo | Green Goods |
| Agent role |  |
| Human goal |  |
| Context packet |  |
| Assigned scope |  |
| Files touched |  |
| Commands run |  |
| Failures or retries |  |
| Verification cost |  |
| Human judgment callouts |  |
| Follow-up rule updates |  |
| Outcome | pending |

## First Required Adoption

The first measured lane is the `ai-native-dev-workflow` scaffold-hardening pass. `css-maintainability-polish` remains the default product/runtime candidate for the next adoption step.

## Recorded Entries

### 2026-05-24 - Scaffold Hardening

| Field | Value |
|---|---|
| Date | 2026-05-24 |
| Feature | `ai-native-dev-workflow` |
| Repo | Green Goods |
| Agent role | Codex plan-hardening reviewer/implementer |
| Human goal | Address review findings so the plan hub is production-quality as a `.plans` operating artifact. |
| Context packet | Google I/O AI-native workflow transcript, user-approved six-week plan, prior review findings, Green Goods plan-hub validator, `.plans`/Linear visibility conventions. |
| Assigned scope | `.plans/active/ai-native-dev-workflow` only; no runtime, package, contract, deployment, or app files. |
| Files touched | `status.json`, `plan.todo.md`, `eval.md`, `handoffs/*.md`, `artifacts/*.md`, `reports/*.md`. |
| Commands run | `node scripts/harness/plan-hub.mjs validate` |
| Failures or retries | Review found template-only evidence, a queue-visible state lane, Linear visibility warnings for ready work, and prose-form validation commands. |
| Verification cost | One plan-hub validation pass; selected-feature runtime validation intentionally deferred because this pass touched only the plan hub. |
| Human judgment callouts | The scaffold-hardening lane is the first measured lane; product/runtime adoption remains future work. No Linear issues were created because this pass stayed repo-local. |
| Follow-up rule updates | `None` for repeated agent failures. Local eval wording was tightened so commands are copy-runnable and conditions live outside command text. |
| Outcome | completed |

### 2026-05-24 - CSS Maintainability Scope Lock

| Field | Value |
|---|---|
| Date | 2026-05-24 |
| Feature | `css-maintainability-polish` |
| Repo | Green Goods |
| Agent role | Codex read-only scope-lock auditor |
| Human goal | Complete the revamped UI lane through the AI-native workflow by auditing scope before runtime CSS edits. |
| Context packet | `.plans/active/css-maintainability-polish/{status.json,plan.todo.md,eval.md,handoffs/claude-ui-revamp.md}`, AI-native ledger/scorecard/closeout artifacts, live repo status, CSS/token/story/test evidence. |
| Assigned scope | Read-only runtime CSS audit across global entrypoints, admin M3 overrides, shared Canvas primitives, client/browser/PWA boundaries, Storybook parity, token health, Tailwind v4 risks, visual-proof requirements, and plan truth. |
| Files touched | Plan/workflow artifacts only: CSS revamped UI handoff plus this ledger and the workflow scorecard. No runtime CSS edited. |
| Commands run | `git status --short`; `node scripts/harness/plan-hub.mjs validate`; `node scripts/design/check-css-custom-properties.mjs`; `bun run check:design-tokens`; `bun run --filter @green-goods/shared check:stories`; `bun run --filter @green-goods/shared check:story-quality`; package-wrapper Vitest for client PWA drawer styles, shared Canvas sheets, admin CanvasLayout/AdminDialog. |
| Failures or retries | Direct root `bunx vitest run ...` was not a valid clean gate for mixed package suites; package-wrapper Vitest commands passed after allowing Vite temp config writes. |
| Verification cost | One plan-hub pass, one CSS custom-property pass, one design-token pass, two Storybook static gates, and three targeted package test invocations. No browser screenshots captured because runtime CSS edits are pending human scope lock. |
| Human judgment callouts | Approve or reject the proposed installed-PWA overlay token micro-batch; keep public browser/editorial dialogs, admin chrome, shared Canvas geometry, Storybook frames, and the 60 audited typography/font entries out unless explicitly approved. |
| Follow-up rule updates | `None` for repeated agent failures. Validation note: package-wrapper Vitest commands are the reliable path for package suites under sandboxed temp-cache constraints. |
| Outcome | scope-lock report recorded; waiting on human approval before runtime CSS edits |

### 2026-05-24 - CSS Maintainability Approved Micro-Batch

| Field | Value |
|---|---|
| Date | 2026-05-24 |
| Feature | `css-maintainability-polish` |
| Repo | Green Goods |
| Agent role | Codex implementation and proof agent |
| Human goal | Complete the approved revamped UI cleanup batch after reviewing PWA regression risk. |
| Context packet | Human-approved scope-lock report, CSS hub status/plan/eval/handoff, AI-native ledger/scorecard/closeout gate, live dirty worktree, local dev-surfaces client and Storybook surfaces. |
| Assigned scope | Runtime CSS micro-batch only: align installed-PWA drawer/dialog backdrop classes in `pwaDrawerStyles` to the existing PWA scrim token, add focused regression proof, and update `.plans` truth. |
| Files touched | `packages/client/src/styles/pwaDrawerStyles.ts`; `packages/client/src/__tests__/styles/pwaDrawerStyles.test.ts`; CSS hub plan/status/eval/handoff; AI-native ledger/scorecard/closeout gate. |
| Commands run | `git status --short`; `node scripts/harness/plan-hub.mjs validate`; `node scripts/design/check-css-custom-properties.mjs`; `bun run check:design-tokens`; `bun run lint:vocab`; `bun run --filter @green-goods/shared check:stories`; `bun run --filter @green-goods/shared check:story-quality`; client package-wrapper Vitest for `pwaDrawerStyles`; `bun run build:client`; Playwright browser checks against Storybook ModalDrawer and PwaSheet. |
| Failures or retries | Modern Web Guidance retrieval failed: repo run hit npm override conflict and `/private/tmp` run hit `ERR_INVALID_ARG_TYPE`. Sandboxed Vite/Vitest/build/browser commands hit expected temp-file or Chromium permission limits; approved reruns passed. Client PWA dev URL stayed on a loading spinner without seeded runtime state, so route-level proof is left to QA. |
| Verification cost | One plan-hub pass, CSS custom-property guard, design-token gate, vocab gate, two Storybook static gates, one focused client Vitest run, one client production build, built CSS grep, and two Storybook browser screenshot/computed-style checks. |
| Human judgment callouts | The cleanup intentionally does not touch public browser/editorial dialogs, admin chrome, shared Canvas geometry, Storybook frames, or the 60 audited typography/font entries. QA should decide whether seeded installed-PWA route proof is needed before archive. |
| Follow-up rule updates | `None` for repeated agent failures. Keep `check:design-generated` excluded as clean evidence until its dirty-tree side effect is fixed. |
| Outcome | completed; revamped UI lane ready for QA pass 1 |
