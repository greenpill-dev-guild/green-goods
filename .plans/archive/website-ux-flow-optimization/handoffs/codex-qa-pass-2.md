# QA pass 2 - website-ux-flow-optimization

**Owner**: codex (qa_pass_2)
**Closing turn**: 2026-05-10
**Working branch**: `main` (primary repo, no worktree)
**Verdict**: `pass-with-followups`

## Scope

Corrected AC-6 regression review after the user clarified that the broad
historical range crosses other committed lanes. This pass focuses on the
website-UX plan-owned surface: public-browser tests/views, public i18n keys,
and the editorial dialog flat-edge CSS.

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
- `origin/claude/qa-pass-1/website-ux-flow-optimization` -> `4d29d495`
- Local `main` at start of corrected run -> `4a984422`, clean and ahead of
  `origin/main` by two unrelated local commits:
  `808d0bdd chore(client): archive PWA audit closeout` and
  `4a984422 fix(agent): harden Fly shutdown handling`

## What I confirmed

### Diff scope

The broad `28768a18..HEAD` comparison still crosses multiple committed lanes,
so it includes unrelated PWA/native-feel changes. That range is not a useful
single-lane proof boundary.

The website-UX plan-owned commits after the Phase 1 lock are:

```text
876c4804 feat(client): finish website UX flow Phase 2 + Phase 3 (P3-3 skipped)
5d8050bb revert(client): drop editorial /fund stale-query toast, restore inline banner
a20ee68d fix(client): drop garden dialog rounded corners for editorial flat-edge consistency
```

`git show --name-status 876c4804 5d8050bb a20ee68d -- packages/client packages/shared .plans/active/website-ux-flow-optimization`
is scoped to:

- `.plans/active/website-ux-flow-optimization/handoffs/claude-ui.md`
- `.plans/active/website-ux-flow-optimization/status.json`
- `packages/client/src/__tests__/components/PublicFundingReceipt.test.tsx`
- `packages/client/src/__tests__/components/PublicProofBand.test.tsx`
- `packages/client/src/__tests__/components/PublicRecordLoop.test.tsx`
- `packages/client/src/__tests__/views/PublicGardenDetailSemantics.test.tsx`
- `packages/client/src/__tests__/views/garden-query-resolution.test.ts`
- `packages/client/src/views/Public/Fund.tsx`
- `packages/client/src/views/Public/garden-query-resolution.ts`
- `packages/client/src/styles/editorial.css`

The plan-owned scoped diff against the Phase 1 lock for public-browser tests,
views, i18n, and editorial CSS is:

```text
12 files changed, 560 insertions(+), 48 deletions(-)
```

Files:

- `packages/client/src/__tests__/components/PublicFundingReceipt.test.tsx`
- `packages/client/src/__tests__/components/PublicProofBand.test.tsx`
- `packages/client/src/__tests__/components/PublicRecordLoop.test.tsx`
- `packages/client/src/__tests__/views/PublicGardenDetailSemantics.test.tsx`
- `packages/client/src/__tests__/views/garden-query-resolution.test.ts`
- `packages/client/src/styles/editorial.css`
- `packages/client/src/views/Public/Fund.tsx`
- `packages/client/src/views/Public/GardenDialog.tsx`
- `packages/client/src/views/Public/garden-query-resolution.ts`
- `packages/shared/src/i18n/en.json`
- `packages/shared/src/i18n/es.json`
- `packages/shared/src/i18n/pt.json`

No contracts, indexer, deployment files, or admin UI are part of the
website-UX plan-owned diff. The installed-PWA/shared work is present in the
broad commit history but belongs to a separate committed lane, not to this
qa_pass_2 product verdict.

### QA pass 1 followups

**Subscription toast vs. inline-only**

`PublicGetInTouch.tsx` still calls `toastService.success(...)` after a
successful subscribe and then renders the inline `role="status"` confirmation.
`PublicGetInTouch.test.tsx` waits for `mockToastSuccess` before checking the
email field clears.

Reading: the "no toast on the editorial site" parenthetical is ambiguous. The
accepted lane proof clearly rejected the stale `?garden=` toast and restored
the inline banner. The subscription toast pre-existed this plan and is locked
by an existing test. Recommended next action: open a small UI follow-up to
decide the editorial toast policy explicitly, then either remove the
subscription toast and update the test or document it as the one allowed
editorial toast.

**/cookies environmental empty state**

`Cookies.tsx` reads `campaigns`, `isLoading`, and `error` from
`useCampaignCookieJarCampaigns()`. The empty/error branch renders a skeleton
while loading, the registry-load-failed message when `campaignListError` is
present, and the no-published-jars message when the list is simply empty. The
"campaign jar list could not be loaded" copy is honest output for an
environmental data error, not a UI defect.

**GardenDetail.tsx unwired in production**

`router.config.tsx` maps `/gardens/:id` to `GardenDialog`, not `GardenDetail`.
`PublicGardenDetailSemantics.test.tsx` mounts `GardenDetail` directly. This is
pre-existing route architecture and not a production regression from this plan,
but it means P3-4 guards a preparatory/unwired view. Recommended next action:
add a future plan note clarifying whether `GardenDetail` should be wired or
kept as a preparatory public page.

**/fund cookie-jar CTA section number drift**

The Cookie Jar CTA lives at the bottom of the rendered `§ 03` Garden-support
section. The older `§ 02` dispatch wording is stale. Product behavior is
correct; sync wording on the next plan/docs touch.

**Garden dialog flat edges**

`.public-garden-dialog` desktop CSS now uses centered dimensions and
`var(--shadow-editorial-panel)` with no border and no desktop radius. That
matches the flat editorial convention used by `PublicFundingCard`,
`PublicInstallDialog`, and `PublicSourceDialog`.

## Validation ladder

| Command | Result | Output |
| --- | --- | --- |
| `cd packages/client && bun run test --run src/__tests__/components/PublicFundingDialogVocab.test.ts src/__tests__/components/PublicFundingReceipt.test.tsx src/__tests__/components/PublicGetInTouch.test.tsx src/__tests__/components/PublicFundingBridge.test.tsx src/__tests__/components/PublicProofBand.test.tsx src/__tests__/components/PublicRecordLoop.test.tsx src/__tests__/views/garden-query-resolution.test.ts src/__tests__/views/PublicGardenDetailSemantics.test.tsx` | PASS | `Test Files 8 passed (8) | Tests 28 passed (28)`. Existing React `act(...)` warnings appear in `PublicFundingReceipt.test.tsx`, but all assertions pass. |
| `bun run lint:vocab` | PASS | `check-vocab: no banned vocabulary found in 3 i18n file(s).` |
| `bun run format:check` | PASS | `Checked 1701 files in 344ms. No fixes applied.` |
| `bun lint` | PASS | Exit 0. Prints existing warnings, including contract-script `no-console`, Solidity warnings, and `packages/client/src/views/Public/Cookies.tsx:181` unused `campaign`, but 0 errors. |
| `cd packages/client && bunx tsc --noEmit` | PASS | Exit 0. |
| `node scripts/harness/plan-hub.mjs validate` | PASS | `Validated 22 feature hubs.` |
| `cd packages/client && VITE_CHAIN_ID=11155111 bun run build` | PASS | Vite build completed, PWA generated. Existing Rollup/chunk-size warnings only. |

Browser smoke was not rerun in this corrected pass because qa_pass_1 already
owned the desktop/mobile browser walkthrough and AC-6 is the regression proof
gate.

## Defects

None that block this lane.

## Followups

1. Decide editorial subscription-toast policy and update
   `PublicGetInTouch.test.tsx` if inline-only becomes the rule.
2. Clarify whether `GardenDetail.tsx` should be wired into production routing
   or stay as preparatory/test-guarded work.
3. Update stale `§ 02` wording for the `/fund` Cookie Jar CTA to `§ 03` on the
   next plan/docs touch.
4. Consider cleaning the existing lint warning in `Cookies.tsx` for the unused
   `campaign` binding when someone next touches `/cookies`.

## Plan-hub state

Updated lane state with:

```text
node scripts/harness/plan-hub.mjs set-lane --feature website-ux-flow-optimization --lane qa_pass_2 --status passed --actor codex --note "Corrected qa_pass_2 rerun: client-local targeted tests and guards green; plan-owned diff scoped to public-browser tests/views/i18n/editorial CSS. Verdict pass-with-followups."
```

Output:

```text
Updated website-ux-flow-optimization lane qa_pass_2 -> passed
```

## Verdict

**`pass-with-followups`**. The corrected qa_pass_2 validation ladder is green,
the plan-owned diff is scoped to the website UX flow surface, and remaining
items are non-blocking followups rather than regressions.
