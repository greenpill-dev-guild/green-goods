# QA pass 2 - website-ux-flow-optimization

**Owner**: codex (qa_pass_2)
**Closing turn**: 2026-05-09
**Working branch**: `main` (primary repo, no worktree)
**Verdict**: `fail`

## Scope

Regression review for AC-6: targeted tests and plan-hub state must match the
final diff. This pass stayed read-only on production code. The only writes were
the qa_pass_2 lane state and this handoff.

Read first:

- `.plans/active/website-ux-flow-optimization/spec.md`
- `.plans/active/website-ux-flow-optimization/plan.todo.md`
- `.plans/active/website-ux-flow-optimization/eval.md`
- `.plans/active/website-ux-flow-optimization/status.json`
- `.plans/active/website-ux-flow-optimization/handoffs/claude-ui.md`
- `.plans/active/website-ux-flow-optimization/handoffs/claude-qa-pass-1.md`
- `AGENTS.md`
- `packages/client/AGENTS.md`

Pre-flight:

- `git branch --show-current` -> `main`
- `git status --porcelain=v1` -> clean before validation
- `git rev-parse --short origin/claude/qa-pass-1/website-ux-flow-optimization` -> `4d29d495`
- `HEAD` / `origin/main` -> `a20ee68d`

## What I confirmed

### Diff scope

`git diff --stat 28768a18..a20ee68d -- packages/client packages/shared` is not
tightly scoped to the website UX flow work. It reports:

```text
48 files changed, 2400 insertions(+), 836 deletions(-)
```

The range includes the expected public-browser flow files:

- `packages/client/src/components/PublicFundingReceipt.test.tsx`
- `packages/client/src/components/PublicProofBand.test.tsx`
- `packages/client/src/components/PublicRecordLoop.test.tsx`
- `packages/client/src/views/Public/Fund.tsx`
- `packages/client/src/views/Public/GardenDialog.tsx`
- `packages/client/src/views/Public/garden-query-resolution.ts`
- `packages/client/src/styles/editorial.css`
- `packages/shared/src/i18n/{en,es,pt}.json`

But it also pulls in unrelated installed-PWA/shared native-feel work:

- `packages/client/DESIGN.pwa.md`
- `packages/client/src/components/Dialogs/DraftDialog.tsx`
- `packages/client/src/components/Dialogs/ModalDrawer.tsx`
- `packages/client/src/components/Communication/Offline/OfflineIndicator.tsx`
- `packages/client/src/components/Navigation/TopNav.tsx`
- `packages/client/src/views/Home/WorkDashboard/index.tsx`
- `packages/client/src/views/Profile/AppSettings.tsx`
- `packages/shared/src/components/Dialog/PwaSheet.tsx`
- `packages/shared/src/components/Toast/presets/*.ts`
- `packages/shared/src/components/Toast/LocalizedToastsBridge.tsx`
- `packages/shared/src/utils/app/route-transitions.ts`

`git log --oneline 28768a18..a20ee68d -- packages/client packages/shared`
shows the unrelated lane in the comparison range:

```text
a20ee68d fix(client): drop garden dialog rounded corners for editorial flat-edge consistency
a642f402 feat(client,shared): PWA native-feel remediation lane
5d8050bb revert(client): drop editorial /fund stale-query toast, restore inline banner
20820601 fix(client): ship animation polish C3 cadence
d859e936 fix(shared,client): unblock animation polish QA
876c4804 feat(client): finish website UX flow Phase 2 + Phase 3 (P3-3 skipped)
```

That violates the qa_pass_2 dispatch requirement to flag drift into installed
PWA shell/shared work.

### QA pass 1 followups

**Subscription toast vs. inline-only**

`PublicGetInTouch.tsx:65-86` still calls `toastService.success(...)` after a
successful subscribe, then `PublicGetInTouch.tsx:189-199` renders the inline
`role="status"` confirmation. The existing test at
`PublicGetInTouch.test.tsx:136-149` waits for `mockToastSuccess` and then checks
the email field is cleared.

My reading: the "no toast on the editorial site" parenthetical reads broader
than the `?garden=` decision if taken literally, but the accepted lane proof
only rejected the stale-garden toast and the current subscription toast is an
existing test contract. Recommended next action: open a UI follow-up to decide
the editorial toast policy explicitly, then either remove the subscription toast
and update the test or document it as the one allowed editorial toast. Do not
treat this as a qa_pass_2-only production defect.

**/cookies environmental empty state**

`Cookies.tsx:166-170` reads `campaigns`, `isLoading`, and `error` from
`useCampaignCookieJarCampaigns()`. `Cookies.tsx:339-360` shows a skeleton while
loading; if `sortedCampaigns.length === 0`, it renders either
`public.cookies.registryLoadFailed` when `campaignListError` is present or
`public.cookies.gridEmpty` when the list is simply empty.

The "The campaign jar list could not be loaded. Direct jar links still work."
copy is honest output for the campaign-list error branch, not a UI defect.
Leave as-is, with the same environmental-data caveat recorded by qa_pass_1.

**GardenDetail.tsx unwired in production**

`router.config.tsx:69-81` maps `/gardens/:id` to `GardenDialog`, not
`GardenDetail`. `PublicGardenDetailSemantics.test.tsx:101-113` mounts
`GardenDetail` directly under a test-only route. This is pre-existing route
architecture and not a new production regression from qa_pass_2, but it does
mean P3-4 currently guards a preparatory/unwired view. Recommended next action:
add a follow-up plan note clarifying whether `GardenDetail` should be wired or
kept as a preparatory public page.

**/fund cookie-jar CTA section number drift**

`Fund.tsx:510-524` labels the garden support section as rendered `§ 03`.
`Fund.tsx:602-624` places the Cookie Jar CTA at the bottom of that section.
The qa_pass_1/dispatch language that said `§ 02` is stale. The product link is
correct; update plan/dispatch wording on the next documentation touch.

**Garden dialog flat edges**

`editorial.css:294-304` now centers `.public-garden-dialog` on desktop with
width, max-height, overflow, and `var(--shadow-editorial-panel)`, but no
`border-radius` and no border. That matches the flat editorial dialog convention
used by:

- `PublicFundingCard.tsx:269-272` - flat white panel with editorial shadow
- `PublicInstallDialog.tsx:46-52` - sheet panel with border/shadow, no radius
- `PublicSourceDialog.tsx:64` - flat white panel with editorial shadow

## Validation ladder

Stopped after the first red command per dispatch instructions.

| Command | Result | Output |
| --- | --- | --- |
| `bun run test --run packages/client/src/__tests__/components/PublicFundingDialogVocab.test.ts packages/client/src/__tests__/components/PublicFundingReceipt.test.tsx packages/client/src/__tests__/components/PublicGetInTouch.test.tsx packages/client/src/__tests__/components/PublicFundingBridge.test.tsx packages/client/src/__tests__/components/PublicProofBand.test.tsx packages/client/src/__tests__/components/PublicRecordLoop.test.tsx packages/client/src/__tests__/views/garden-query-resolution.test.ts packages/client/src/__tests__/views/PublicGardenDetailSemantics.test.tsx` | FAIL, exit 1 | Root `test` script fans out to all workspaces. `@green-goods/docs` says the filters did not match any test files. `@green-goods/contracts` errors: `unexpected argument '--run' found`. `@green-goods/shared`, `@green-goods/admin`, `@green-goods/client`, and `@green-goods/agent` report `No test files found` because the client file paths are treated as unmatched package-local filters. Final line: `error: script "test" exited with code 1`. |
| `bun run lint:vocab` | Not run | Stopped after first validation failure. |
| `bun run format:check` | Not run | Stopped after first validation failure. |
| `bun lint` | Not run | Stopped after first validation failure. |
| `bunx tsc --noEmit` from `packages/client` | Not run | Stopped after first validation failure. |
| `node scripts/harness/plan-hub.mjs validate` | Not run | Stopped after first validation failure. |
| `VITE_CHAIN_ID=11155111 bun run build` from `packages/client` | Not run | Stopped after first validation failure. |

The root command failure is enough to fail qa_pass_2 as dispatched. I did not
rerun a corrected package-local variant because the instructions said to stop
after any validation failure and not fix forward.

## Defects

1. **Validation ladder is red at the first command.** The dispatched root
   targeted-test command exits 1 before proving the client targets. This blocks
   a `pass` or `pass-with-followups` verdict.
2. **Diff scope drifted.** The required `28768a18..a20ee68d` comparison pulls in
   installed PWA shell and shared PWA/toast infrastructure work outside the
   public-browser website UX flow scope. This independently fails qa_pass_2.

## Plan-hub state

Updated lane state with:

```text
node scripts/harness/plan-hub.mjs set-lane --feature website-ux-flow-optimization --lane qa_pass_2 --status failed --note "qa_pass_2 failed: instructed root targeted test command exits 1 due workspace-wide unmatched filters; diff 28768a18..a20ee68d also includes unrelated PWA/shared native-feel work."
```

Output:

```text
Updated website-ux-flow-optimization lane qa_pass_2 -> failed
```

## Verdict

**`fail`**. qa_pass_2 cannot pass because the instructed validation command is
red and the final comparison range includes unrelated PWA/shared work. No
production fixes were made.
