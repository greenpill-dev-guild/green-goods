# QA Runs - UI Handoff

## Lane

- Owner: Claude
- Branch: `feature/qa-runs`
- Status: passed (implementation and local proof complete 2026-09-07; the deployed two-tester smoke is `qa_pass_1`)

## Scope

- `packages/qa/index.html`: run select, compare select, Re-QA filter, delta tally, inherited verdicts, run and help lines, N/A hint, Start new run form, queue keyed by owner and run, 409 re-targeting, poll overlay gated to the open run, tolerant mode for a server without runs.
- `packages/qa/build.mjs`: `replaces` (transitive `replacedBy` closure per active case) and `revision` in `dist/catalog.json`.

## What changed

- Boot reads `runs` / `openRun` from the state payload; without them the page keeps its previous behaviour (no run controls, run-less queue key, saves that name no run), which keeps the old client harnesses green.
- `#qa-run-select` beside the View select; a closed run renders read-only (`editable = selected === who && runOpen()`), with the mode line saying so. `#qa-compare-select` lists closed runs other than the one on screen; the compared run is fetched once per page life (`GET /api/state?run=<id>`), shown under every row with its notes, and a case retired since that run inherits the verdict of each id in `replaces`, labelled *inherited from <id>*. The tally adds `vs Run N: fixed · still failing · regressed · newly walked`; the `Re-QA` filter appears while a comparison is on.
- Queue key `qa-outbox:<owner>:<runId>`: the run-less key is adopted into the open run once and retired; queues left under closed runs are adopted on boot. A 409 with `openRun` re-keys the queue, switches the selection if it was the closed run, announces it, and re-sends once; a rollover noticed by the poll does the same proactively.
- The poll only overlays pending edits when the served run is the open run, and rebuilds a pending patch on the server copy when the view left and returned (the case is not in the cleared local rows).
- `#qa-run-rollover` opens `#qa-rollover` (label, environment defaulting to beta, three optional build SHAs, confirm line); submit posts `{ action: "rollover", … , catalog: { revision, activeCases } }` and follows the opened run.
- `.title-row` wraps so the header actions drop to their own line at phone widths (found in the rehearsal at 401px).

## What remains

- Tuesday's two-tester smoke on the deployed app (`qa_pass_1`).
- Fast-follow candidates: a persisted compare across page loads is in `qa-view` already; `openedByLabel` on a rollover response arrives with the next poll (the response carries raw records).

## TDD Proof

- RED: `bun --bun x vitest run --dir scripts/agents qa-app-client` — `runsHarness` failed at the return to the open run (the pending PWA-052 verdict was not re-overlaid: `aria-pressed` `false`) and at the re-target notice (the savebar read `live — shared results`), before the poll rebuilt pending patches on the server copy and notices held through polls.
- GREEN: `bun --bun x vitest run --dir scripts/agents qa-app-client qa-app-build` — 30 passed; full `bun run test:agent-tools` — 245 passed (2026-09-07).
- Proof limit: none

## Validation

- `runsHarness` in `scripts/agents/qa-app-client.test.ts`: keyed queues and one-time adoption, compare with inherited verdicts and notes, delta tally, Re-QA filter, read-only closed run without overlay, 409 re-target with the announced move, rollover form, tolerant mode.
- `scripts/agents/qa-app-build.test.ts`: `replaces` on successors (including the PWA-038 → PWA-IOS-011 chain), absent on non-successors, `revision` shape, the N/A hint, the `editable` guard, the fetch-literal allowlist against `dev.mjs`.
- Local rehearsal in the Browser pane against `dev.mjs` (phone width, 401×382): migration on first contact, verdict into Run 1, rollover as Gui with a client SHA, compare with inherited verdicts (PWA-052 ← PWA-021, PWA-060 ← PWA-038), Re-QA filter listing the nine rows Run 1 left failing, a pass into Run 2 counted as `1 fixed`, Run 1 read-only with the Run 2 edit not overlaid. Pointer clicks stalled while the pane was hidden, so the form submit and the filter click in the rehearsal were real DOM clicks dispatched from the console; the harness covers the same wiring with real events.

## Validation Receipt

- Tested implementation commit SHA: `62e2d604356c2eb0b1c2c8a2dbb1cb0f3ca25c93`
- Run at (UTC): `2026-09-07T22:19:00Z`
- Exact command(s): `bun run test:agent-tools && node scripts/dev/ci-local.js --intent push --reuse-passing-receipts`
- Result: `245 tests passed; node scripts/dev/node-cli.js scripts/dev/ci-local.js --intent push --reuse-passing-receipts → format, lint, docs-authority, agent-guidance, qa-id-ledger, agent-tools-test (245 tests) passed; browser-proof blocked: the authenticated Brave QA profile was unreachable through the Claude-in-Chrome extension (tabs_context probe failed), so rendered proof is recorded BLOCKED and belongs to the 2026-09-08 deployed smoke`
- Validated paths: `packages/qa/index.html, packages/qa/build.mjs, scripts/agents/qa-app-client.test.ts, scripts/agents/qa-app-build.test.ts`
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- packages/qa scripts/agents` → `` (empty)
- Evidence-only diff command and result (if applicable): not applicable
- Evidence-only worktree-status command and result (if applicable): not applicable

## Risks / Blockers

- Strings stay hardcoded English like the rest of the non-journey UI; the `ui` locale keys are exact-key gated by the build.
- Authenticated Brave screenshots at desktop and 375×812 on the deployed app are still owed to `qa_pass_1`; the Browser pane rehearsal covered the phone width only.
