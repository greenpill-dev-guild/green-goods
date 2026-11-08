# Hub review fixes and proof preparation

The loaded Hub work list now survives a failed read. Confirmed batch reviews keep their proven Approved or Rejected chip while query observers catch up, without keeping any sendable staged decision. The landing callback carries the actual proven decision; an unreadable recovered decision does not borrow the staged draft's outcome. The whole-group refusal parser fix already exists in `72f1cf75c47dfaedf3081f67689a6440bc3a256b`; a new integration regression protects it without changing that implementation.

The tablet send bar now reserves the same 3.75rem below itself as its existing raised position. The final work row can scroll fully above it; the settled Chromium proof measured 12px clearance.

The ADM-199 definition now includes a taken, unkept promise alongside exactly two available promises. It records that promise's reward before editing and reads it again after the partial send, retry, and successful passkey send. Prompt counts and QA IDs are unchanged. `docs/docs/builders/quality/test-cases.mdx` was regenerated using `node scripts/docs/generate.mjs --scope qa`. This prepares a live test; it does not establish a live pass.

## Ownership and change boundary

- Admin: `HubWorkQueue.tsx`, `HubWorkQueue.stories.tsx`, `HubQueueEnsDisplay.test.tsx`, and the scoped tablet rule in `styles/admin-layout.css`.
- Shared: `useReviewBatch.ts`, `useBatchWorkApproval.ts`, their focused tests, and `work-review-batch.test.ts`.
- QA: ADM-199 only in `scripts/data/qa-test-catalog.json`, plus its generated documentation projection.
- No copy decisions from PRD-1399 were rewritten. No signing, dependency changes, branch changes, publication, external updates, staging, or commits were performed.
- Existing and concurrent changes outside these paths remain untouched. All results below concern the uncommitted working tree, not a commit-attributed receipt.

## Regression evidence

| Behavior | RED | GREEN |
|---|---|---|
| Keep loaded work after read failure | `HubQueueEnsDisplay.test.tsx`: 1 failed / 19 passed; loaded Compost setup button missing because only error state rendered | Same command: 20/20 passed, including an empty-list error guard |
| Preserve confirmation while query observers lag | `useReviewBatch.test.ts`: 1 failed / 15 passed; review chip became undefined immediately on landing | Initial fix passed 16/16 |
| Use the proven decision, including unknown recovery | Expanded hook tests: 3 failed / 15 passed; opposite staged decision incorrectly won and unknown decision showed confirmation | Final focused work run: 3 files / 72 tests passed, including both proven booleans and unknown outcome |
| Final row clears the raised tablet send bar | Chromium at measured 800×700: row bottom 334, bar top 286, 48px overlap; screenshot and failed story | Settled layout: row bottom 274, bar top 286, 12px clearance; last row visible and callback click passed |
| Friendly whole-group refusal remains parseable | Existing implementation was already corrected; new integration test runs real review-chain simulation, sendReviewBatch, and error formatter | Included in final 72 passing tests |

Commands and observed results:

- `bun run --cwd packages/admin test src/__tests__/components/HubQueueEnsDisplay.test.tsx`: GREEN 20/20; 56.36s, 2026-11-07 20:45:42 UTC start.
- `bun run --cwd packages/admin test src/__tests__/views/HubReviewBatchBar.test.tsx`: 7/7; 51.04s, 20:39:32 UTC start.
- `bun run --cwd packages/shared test src/__tests__/hooks/work/useReviewBatch.test.ts src/__tests__/hooks/work/useBatchWorkApproval.test.ts src/__tests__/modules/work-review-batch.test.ts`: 3 files / 72 tests passed; 16.06s, 20:55:36 UTC start.
- `node scripts/quality/check-qa-id-ledger.mjs`: passed, 446 IDs, no removed/reintroduced/reactivated IDs.
- `bun run vitest run --dir scripts/agents scripts/agents/qa-app-build.test.ts`: 21 passed / 2 failed from 5s import timeouts under concurrent machine load. A diagnostic rerun with `--testTimeout=30000` passed 23/23; this raised-timeout run is not offered as final baseline gate proof. Catalog-specific tests passed in both runs.
- `bun run --cwd packages/shared check:stories --help` invoked the repository check rather than help: 333/333 required stories passed.
- Focused Biome formatting passed. Final scoped lint, source checks, typechecks, and selector receipt belong to the lead's combined verification.

## Rendered evidence

Label: **Storybook / headless Chromium**, fictional hook fixtures, not authenticated signing proof.

CUA inventory failed first with a timeout, then `Browsers: Error: transport closed before response`. Required CUA completion summary was recorded. No authenticated session was reached.

The existing Storybook runner first failed sandbox bind (`EPERM ::1:63315`). Authorized escalated runner attempts then timed out connecting the browser at 60s while dependency optimization was still running. A CLI `--browser.connectTimeout=180000` attempt still used the effective 60s default. No tests ran in those attempts.

A disposable `/tmp/green-goods-batching-storybook.config.mts` imports the checked-in `packages/shared/vitest.storybook.config.ts` and sets only startup connection allowance and requested viewport:

```ts
import config from '/Users/afo/Code/greenpill/green-goods/packages/shared/vitest.storybook.config.ts';
config.test.browser = { connectTimeout: 240000 };
for (const project of config.test.projects) {
  project.test.browser.viewport = { width: 800, height: 700 };
}
export default config;
```

No tracked harness configuration or functional assertion timeout was changed.

First rendered command:

```sh
bun run --cwd packages/shared vitest run --config /tmp/green-goods-batching-storybook.config.mts --project=storybook ../admin/src/views/Hub/components/HubWorkQueue.stories.tsx ../client/src/components/Public/Vault/VaultCheckoutDialog.stories.tsx
```

Observed: Hub 6/6 passed; checkout Sequential and Held passed, Atomic failed because its test expected native `disabled` while shared Button exposes `aria-disabled` during loading. The checkout owner corrected the assertion to the established Button contract. Total 8 passed / 1 failed, 307.19s, 20:49:06 UTC start. The Hub last-row assertion passed; overlap is not yet reproduced and no speculative CSS change has been made.

Second rendered command adds existing deposit stories:

```sh
bun run --cwd packages/shared vitest run --config /tmp/green-goods-batching-storybook.config.mts --project=storybook ../admin/src/views/Hub/components/HubWorkQueue.stories.tsx ../client/src/components/Public/Vault/VaultCheckoutDialog.stories.tsx ../admin/src/components/Vault/DepositModal.stories.tsx ../client/src/components/Public/PublicFundingDocumentation.stories.tsx ../client/src/components/Sheets/EndowmentSheet/EndowmentSheet.stories.tsx
```

Observed report: 15 passed, 3 files passed / 2 skipped by existing story-tag selection; 73.56s, 20:55:55 UTC start, exit 0. The selected files were HubWorkQueue, VaultCheckoutDialog, and EndowmentSheet. DepositModal and PublicFundingDocumentation contain no selected storybook-ci stories and were skipped. The requested viewport in this command was not independently measured.

The initial geometry passes were not sufficient proof: resizing the Vitest iframe triggered a later media-query reflow, and the first assertion callback did not await Storybook expectations. A later diagnostic run passed its early assertion while a subsequent measurement showed row bottom 617 versus bar top 286. That run is explicitly rejected as layout proof. The final regression awaits two animation frames around scrolling, queries fresh attached row/bar nodes, awaits every assertion, and checks the last title and callback. No timers were added to application behavior.

### Final tablet proof

All artifacts below are local, fictional Storybook fixtures, not authenticated session evidence:

- RED log: `/tmp/green-goods-hub-rendered-proof.log`, 20:59:12 UTC start, 37.64s; 1 failed / 5 passed. Measured width 800, height 700, sticky bottom 60px, row bottom 334, bar top 286 before later responsive reflow. The failure correctly exposed overlap, although its first harness version also had the reflow/await weakness described above.
- RED screenshot: `/tmp/green-goods-hub-batch-tablet.png`; inspected and visibly shows the bar covering work-card content.
- Rejected intermediate diagnostic: `/tmp/green-goods-hub-rendered-proof-green.log`, 21:03:08 UTC start, 25.89s; reported 6 passing tests but measured row bottom 617 after an earlier passing observation. It is not GREEN geometry evidence. An earlier 33.14s run at 21:01:47 showed the same issue and was superseded by this diagnostic log.
- Final GREEN log: `/tmp/green-goods-hub-rendered-proof-stable.log`, 21:04:14 UTC start, 21.61s, exit 0; 6/6 passed.
- Final GREEN screenshot: `/tmp/green-goods-hub-batch-tablet-green.png`; inspected. It shows the final Education/Solar cards, their titles and metadata, and the send bar beneath with clearance.
- Final measured geometry: iframe 800×700, scroller height 400, scrollHeight 821, scrollTop 421, row bottom 274, bar top 286, sticky bottom 60px. The last-row click invokes the expected work ID.

Final capture command:

```sh
bun run --cwd packages/shared vitest run --config /tmp/green-goods-batching-storybook.config.mts --project=storybook ../admin/src/views/Hub/components/HubWorkQueue.stories.tsx --reporter=verbose > /tmp/green-goods-hub-rendered-proof-stable.log 2>&1
```

During capture only, the story imported `page` from `vitest/browser`, called `page.viewport(800, 700)`, logged metrics, and saved the screenshot. Those calls were removed after inspection. The tracked story retains the settled layout regression and works in regular Storybook. Tracked harness configuration and functional test timeouts remain unchanged. Source was declared stable to the lead after this capture (exact message timestamp not recorded); final formatting and focused diff whitespace checks passed.

## Remaining proof

Live passkey and atomic-wallet signing remain outside this code/preparation lane. ADM-199 needs its actual paired wallet test. The tablet overlap is fixed and has labeled rendered proof. The original live authenticated session was not replayed. Shared/Admin/Client/Agent typechecks and final selected checks are coordinated by the lead. No Linear status was changed.

Task record: PRD-1399 / transaction-batching-follow-ups | Type: fix and proof preparation | Outcome: partial
Agent/model: `/root/hub_review_fixes`, model unknown | Coverage: this delegated implementation segment

| Phase | Start → end (UTC) | Result / evidence or blocker |
|---|---|---|
| Investigate | unknown → 2026-11-07 20:34:18 | Confirmed existing refusal fix; traced loaded-list replacement and query/store notification ordering |
| Implement | unknown → 2026-11-07 20:55:36 | Hub error/confirmed-chip fixes, actual ProvenReview callback, ADM-199 fixture preparation |
| Verify | 2026-11-07 20:34:18 → 2026-11-07 21:04:35 (final browser result) | Focused RED/GREEN evidence above; settled tablet proof passed; combined gate handed to lead |
| Wait | unknown → 2026-11-07 20:53:29 | Browser transport unavailable and dependency-optimization startup delay; Storybook Chromium eventually connected |

Human corrections: 0 observed in this delegated segment; attention: unknown. Parent-agent review identified the proven-versus-staged decision distinction; the implementation and regression tests were corrected accordingly.
