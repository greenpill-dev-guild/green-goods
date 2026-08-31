# Commitment Pooling functional QA follow-up

## 1. Target and environment

- Date: 2026-08-25 (America/Los_Angeles)
- Mode: A functional follow-up
- Exact target: `origin/develop@fc27a5b000fd8ab8674ac5a6dea159a0a602234b`
- Target discipline: `git fetch --prune origin develop` completed, `HEAD == TARGET_SHA` before runtime testing and every browser phase, and the shared checkout never drifted.
- Branch: existing `develop`; no branch was created, switched, renamed, pulled, reset, or stashed.
- Browser: the already-open authenticated Brave window, controlled through the Codex browser extension. No isolated Browser, Playwright CLI, DevTools MCP, or new profile was used.
- Runtime: existing compatible client (`3001`), admin (`3002`), and Storybook (`3004`) listeners were reused. Their processes predated this QA and were not restarted or stopped. Existing OrbStack and Anvil listeners were left untouched and supplied no substitute evidence.
- Local mirror: not proven healthy. `dev:prod:mirror:health` could not find Docker in the shell, and `dev:prod:smoke` produced no endpoint result. Hosted health and prior reports were not promoted to current Commitment Pooling read-back proof.
- Existing unrelated changes were preserved, including the prior focused report/evidence, experience-audit work, and handoff edit.

Structured evidence: `evidence/qa-functional-follow-up-2026-08-25/qa-summary.json` and `fixtures-1001-1021.json`.

## 2. Functional verdict

**PASS for all four scoped regressions. No product or test code changed.**

The current target already contains the effective fixes hypothesized by `1e34e39e29df1f26d5d943af587ebdb6ae1676e1`. Fresh suites and authenticated rendered checks passed the four named defects on one exact target SHA, so no further implementation was justified.

The broader follow-up is not an unconditional production-mirror certification. Client fixture and Storybook coverage completed; authenticated admin routes rendered their honest unavailable/unregistered/empty states, but a successful local Commitment Pooling read-back remains blocked by the unavailable target-matched mirror. Real proof-media attachment is also blocked because the Brave extension denied `fileChooser.setFiles`; the independent text-only proof path passed.

Three unrelated findings were recorded and left unchanged: a PWA Home-link routing failure, two live Storybook responsive-selector failures, and two unrelated Actions story failures in the full component-test command.

## 3. Four-defect disposition

| Regression | Result | Baseline result | Code changed | Test evidence | Rendered evidence | Evidence path |
| --- | --- | --- | --- | --- | --- | --- |
| Fallback confirmation provenance invalid DOM/hydration | **PASS** | The first fresh target render was clean. | No | Shared suite: 4,234 passed, 18 skipped. | Fixture 1012 displayed fallback actor, path, and reason. Invalid paragraph/div count was 0; invalid-nesting, hydration, and uncaught-product log matches were 0. | `evidence/qa-functional-follow-up-2026-08-25/client-fixture-1012-fallback-provenance.png` |
| `Admin/Pool/PoolSetupFlow--FirstRun` render/play | **PASS** | The first target run rendered and completed without a patch. | No | Scoped Storybook Vitest: 1 file, 4 stories passed. | Authenticated Brave showed `How it works`; Next began disabled, the play typed `Neighbourly help in Rio`, Next became enabled, and all seven interactions passed. | `evidence/qa-functional-follow-up-2026-08-25/storybook-admin-poolsetupflow-first-run-pass.png` |
| ConfirmSheet positive count versus empty sentence | **PASS** | The target rendered a coherent positive-proof state. | No | Shared and client suites passed; clean Storybook CI did not fail this story. | Product-only `Multiple Proofs` render showed `Proof / 2 items`, two submitted rows, and zero `No proof has been attached yet.` sentences. | `evidence/qa-functional-follow-up-2026-08-25/storybook-client-confirmsheet-multiple-proofs-render.png` |
| Local PWA service-worker HTML MIME failure | **PASS** | No fresh MIME failure appeared. | No | Shared suite passed. The exact `/dev-sw.js?dev-sw` request returned `200` and `content-type: text/javascript`. | Authenticated Brave navigated Home, Profile, and Garden. Service-worker/MIME/`text/html`/registration error matches were 0. | `evidence/qa-functional-follow-up-2026-08-25/client-pwa-navigation-service-worker-pass.png` |

The live Storybook manager reports a separate hidden-responsive-duplicate assertion failure for `ConfirmSheet--MultipleProofs`, even though the product frame is coherent and clean Storybook CI passes that story. That harness finding is FU-2 below; it is not the prior product contradiction.

## 4. Blocked coverage closure

Evidence tiers are kept separate. A suite result is not described as a rendered route pass.

| Focused row | Result | Tier | Fresh closure |
| ---: | --- | --- | --- |
| 5 | **PASS** | `FIXTURE` | Fixtures 1001–1021 all rendered their expected titles/states at the checksum-cased garden route. No fixture produced `Garden not found`, a product-error sentence, or a scoped console match. Seat, team, Work/proof, provenance, and terminal exits were present where expected. |
| 6 | **PASS** | `FIXTURE` | Season/campaign rails and All/Offers/Requests responded to clicks. The commitments drawer switched between Live and Over time; there was no fixture-unwrapped To confirm tab. |
| 7 | **PASS** | `FIXTURE` | Offer and Request accepted real clicks and typing, reached Review, and each produced exactly one local `Waiting to send` row. |
| 8 | **BLOCKED (authenticated Brave denied `fileChooser.setFiles`)** | `FIXTURE` | Text-only proof accepted clicks and typing, reached Review, and queued. The deployer fixture rendered `Nothing for you to add here`. Real media selection returned `Not allowed`; no isolated browser fallback was used. |
| 9 | **PASS** | `FIXTURE` | A request claim visibly queued. Withdrawal and Not yet reasons enabled their submits without being sent. Confirm kept queued locally and displayed `1 of 1 saved`. Terminal/lapsed exits rendered in fixtures 1005, 1006, and 1013–1015. |
| 10 | **PASS** | `FIXTURE` + `SUITE` | Local result beats showed no wallet or broadcast prompt. A rapid double-click on Make this offer yielded one `QA mulch support 825` pool row; the request also yielded one row. Job dedupe/recovery suites passed. |
| 11 | **PASS** | `FIXTURE` + `SUITE` | `mockPooling=0` removed Pool and fixture data without losing the garden. Flipping back to `mockPooling=1` restored Pool without `Garden not found`; the demo cache-boundary suite passed. |
| 12 | **PASS** | `SUITE` + `STORYBOOK` | The exact test `says why a pool is paused even when it holds nothing yet` passed. The paused status story rendered the steward reason, recovery copy, and withheld blocked acts. No single existing seeded story combines the zero-count case, so the exact zero-count claim remains suite-tier. |
| 13 | **BLOCKED (target-matched local Commitment Pooling mirror unavailable)** | authenticated route | `/garden/pool`, `/community/pools`, and `/hub/confirm` all rendered in authenticated admin. They showed, respectively, pooling unavailable on the chain, no protocol pool registered, and Nothing to confirm. These truthful states are captured, but successful pooling read-back is not claimed. |
| 14 | **PASS at lower tiers** | `STORYBOOK` + `SUITE` | FirstRun play passed. Partial-failure recovery rendered the landed/unlanded split. Seed direction, cycle including no-cycle, quantity, proof/confirmation, named confirmer group, review, and reward states rendered in focused stories; the 723-test admin suite passed. No admin write was attempted. |
| 15 | **PASS at lower tiers** | `STORYBOOK` + `SUITE` | Ordinary and garden-fallback provenance rendered distinctly. The no-credit Kept guard withheld Kept. Queue empty/loading/read-error/retry states rendered, and the admin suite passed. The authenticated route supplied fresh empty-state evidence. |
| 16 | **PASS** | `LIVE` + `STORYBOOK` + `SUITE` | A reachable public garden rendered the pre-launch commitments state. Local `/impact` rendered honest `None yet`/`None due yet` values rather than fake rates. Record, paused, pre-launch, ready, empty-pool, populated impact, and unavailable/em-dash stories rendered with privacy-safe public facts. |

Additional prior regression rows closed as follows:

- Composer controls: **PASS — FIXTURE**. Offer, Request, and text-only Proof responded to actual clicks and typing.
- Address casing: **PASS — FIXTURE + SUITE**. All fixture paths used the checksum-cased garden address; none rendered `Garden not found`.
- Steward seating: **PASS — FIXTURE + SUITE**. Fixture 1012 kept the ordinary confirmer and steward fallback distinct; provider/contributor exclusion suites passed.
- Pause reason with zero commitments: **PASS — SUITE**. The exact zero-state assertion passed; the visible paused story supplied separate rendered reason evidence.
- Protocol creation controls for ordinary members: **PASS — FIXTURE + SUITE**. Fixture 1021 exposed Take this up but no Offer/Request creation door; the protocol `canCreate` permission test passed.
- Double submission: **PASS — FIXTURE + SUITE**. Rapid double-click left one queued Offer row; idempotence suites passed.
- Demo query cleanup: **PASS — FIXTURE + SUITE**. Pooling-off/on was driven in the browser and the query-eviction suite passed.

## 5. Changes made

No product, test, configuration, dependency, plan-state, prior report, or prior evidence file changed.

This follow-up added only:

- `reports/qa-functional-follow-up-2026-08-25.md`
- `reports/evidence/qa-functional-follow-up-2026-08-25/`

Mode A demo interactions added local browser queue records for one Offer, one Request, one text-only proof, one claim, and one confirmation. They remained local/waiting; no external or on-chain write occurred.

## 6. Commands and counts

`bun run validation:plan -- --intent qa` returned `status=ready`, `effectiveIntent=qa`, `criticality=sensitive`, and selected only `format`, with `selectedBy=["automatic-hygiene"]`. The selector saw 64 pre-existing changed paths belonging to protected prior QA/handoff work. `format` was not run because it could rewrite those unrelated, explicitly preserved artifacts, and this task changed no product or test code. The explicit dispatch checks still ran.

| Command or check | Fresh result |
| --- | --- |
| `git fetch --prune origin develop` | PASS; target recorded as `fc27a5b000fd8ab8674ac5a6dea159a0a602234b`. |
| `bun run validation:plan -- --intent qa` | PASS; selected `format`, `selectedBy=[automatic-hygiene]`. |
| `bun run dev:doctor` | PASS for the existing frontend QA stack. |
| `bun run dev:prod:mirror:health` | FAIL; Docker unavailable in the shell. |
| `bun run dev:prod:smoke` | BLOCKED; two owned invocations produced no endpoint result and were stopped. |
| `bun run --filter @green-goods/shared test` | PASS: 385 files passed, 2 skipped; 4,234 tests passed, 18 skipped. |
| `bun run --filter @green-goods/client test` | PASS: 105 files; 871 tests. |
| `bun run --filter @green-goods/admin test` | PASS: 102 files; 723 tests. |
| `bun run --filter @green-goods/shared check:stories` | PASS: 254/254. |
| `bun run --filter @green-goods/shared check:story-quality` | PASS: 226 story files. |
| `bun run lint:vocab` | PASS: 3 i18n files. |
| `bun run --filter @green-goods/shared test:stories:ci` | FAIL: 192 passed, 2 unrelated Actions story plays failed. The initial sandbox attempt failed with loopback `listen EPERM`; the fresh unrestricted rerun is the governing result. |
| Scoped `SetupFlow.stories.tsx` Storybook Vitest command | PASS: 1 file, 4 stories. |
| Authenticated Brave `PoolSetupFlow--FirstRun` interaction panel | PASS: seven steps, including disabled → typing → enabled. |
| `curl -sk -D - -o /dev/null 'https://localhost:3001/dev-sw.js?dev-sw'` | PASS: HTTP 200, `content-type: text/javascript`. |
| `git diff --check` | PASS. |

## 7. Defects

### FU-1 — Major — PWA Home link does not leave `/home/garden`

- Route: client `/home/garden`, installed-PWA presentation
- Role/seat/state: `mockAuth=user`; authenticated member; Garden route
- Expected: clicking the visible Home AppBar link (`href=/home`) navigates to `/home`.
- Observed: after Garden settles at `/home/garden`, clicking Home leaves the URL at `/home/garden`; `waitForURL("**/home")` times out. The link is visible, has non-zero geometry, `pointer-events:auto`, and the correct href.
- Reproduction: open `/home?presentation=pwa`; click Garden; wait for `/home/garden`; click Home; observe the route does not change.
- Evidence: `evidence/qa-functional-follow-up-2026-08-25/client-pwa-home-link-no-navigation.png` and `qa-summary.json`.
- Suspected owner: `packages/client`, AppBar/router/view-transition seam.
- Disposition: recorded only; outside the four-defect scope lock.

### FU-2 — Minor QA harness — live Storybook selects a hidden responsive duplicate

- Story: `Client/Commitments/ConfirmSheet--MultipleProofs` and `Admin/Pool/SeedCommitmentDialog--What`
- Role/seat/state: seeded Storybook states
- Expected: the play assertion resolves the visible responsive instance.
- Observed: the product frame renders correctly, but the live Interactions panel can bind `findByText`/`findByRole` to a hidden responsive duplicate and fail `toBeVisible`. The clean Storybook CI run did not fail these stories.
- Reproduction: open either story in the running manager and inspect Interactions.
- Evidence: `evidence/qa-functional-follow-up-2026-08-25/storybook-client-confirmsheet-multiple-proofs.png` and `qa-summary.json`.
- Suspected owner: client/admin story play selectors.
- Disposition: recorded only; no product contradiction and outside scope.

### FU-3 — Minor QA harness — two unrelated Actions story plays fail

- Story: `Actions--Registry` and `ActionsSheetDescriptor--RouteBackedCreateMobile`
- Role/seat/state: Storybook CI harness
- Expected: the full component-test command passes all story plays.
- Observed: 192 passed; Registry could not find the Actions heading, and RouteBackedCreateMobile could not find its dialog.
- Reproduction: run `bun run --filter @green-goods/shared test:stories:ci` with loopback available.
- Evidence: `evidence/qa-functional-follow-up-2026-08-25/qa-summary.json`.
- Suspected owner: `packages/shared` Actions stories.
- Disposition: recorded only; unrelated to Commitment Pooling and not fixed.

## 8. External blockers

- **Target-matched local mirror:** Docker was unavailable in the shell, mirror health failed, and smoke produced no endpoint result. Successful Commitment Pooling read-back for authenticated admin routes remains blocked. Existing OrbStack listeners were not restarted or replaced.
- **Proof media:** authenticated Brave opened the file chooser, but the extension returned `Not allowed` for `setFiles`. Text-only proof and NotYours paths completed; no isolated profile was substituted.
- **Full Storybook gate:** the command remains failed because of two unrelated Actions stories. A passing targeted FirstRun run does not erase that failure.

## 9. Not run

- No wallet signature, passkey ceremony, transaction approval, simulation leading toward a signature, broadcast, on-chain write, settlement execution, deployment, activation, reindex, or hosted-infrastructure change.
- No Mode B, availability-ledger change, Anvil/local-chain substitute, Docker/OrbStack restart, unknown-listener stop, dependency install/upgrade, raw Forge, or deployment wrapper.
- No experience/design QA: tab overflow, touch targets, visual density, typography, motion, dark mode, locale tone, layout taste, and design-system alignment remained outside scope.
- The QA run made no branch change, commit, push, merge, PR, or Linear record; after closeout, the user separately authorized committing only this report and its evidence.
