# UI Handoff

Journey Mode is implemented in the static QA application and authored from the canonical catalog.
Walk remains the default, Priority remains available, and Journey supports whole-flow and
participant-part filtering. Known gates keep all verdict controls visible and unselected, so the
tester can record `Blocked` after encountering the gate.

Focused regression proof passed on 2026-09-03: 22 test files and 426 tests across the pull,
report, workbook/catalog, QA build, and QA client suites. Authenticated Brave
rehearsal also passed at desktop and 375 × 812 mobile dimensions, with no horizontal overflow and
with native accessible names and state exposed for the view, journey, part, and verdict controls.

The UI lane is complete after implementation and local proof. Redeployment and the two-wallet
service-relay smoke belong to `qa_pass_1`.

## Validation Receipt

- Tested implementation commit SHA: `a34a684d97a3d9bb4dd9a66bf982ac7ebf1f8624`
- Run at (UTC): `2026-09-03T23:21:34Z`
- Exact command(s): `bun --bun x vitest run scripts/agents/qa-state-pull.test.ts scripts/agents/qa-report.test.ts scripts/agents/qa-workbook-build.test.ts scripts/agents/qa-app-build.test.ts scripts/agents/qa-app-client.test.ts`
- Result: 22 test files and 426 tests passed. Connected Brave also rendered the English, Spanish, and Portuguese Journey views without horizontal overflow; translated case copy carried the selected language metadata, and known gates retained four unselected verdict controls.
- Validated paths: `packages/qa/**`, the focused QA agent scripts and tests, `scripts/quality/check-qa-id-ledger*`, `docs/docs/builders/quality/product-experience-qa.mdx`, and `docs/static/img/screenshots/qa-app-journey-view.jpg`
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- docs/docs/builders/quality/product-experience-qa.mdx docs/static/img/screenshots/qa-app-journey-view.jpg packages/qa scripts/agents/qa-app-build.test.ts scripts/agents/qa-app-client.test.ts scripts/agents/qa-state-pull.test.ts scripts/agents/qa-state-pull.ts scripts/agents/qa-workbook-build.test.ts scripts/quality/check-qa-id-ledger.mjs scripts/quality/check-qa-id-ledger.test.mjs` → empty at `a34a684d97a3d9bb4dd9a66bf982ac7ebf1f8624`
- Evidence-only diff command and result (if applicable): `git diff --exit-code a34a684d9..HEAD -- docs/docs/builders/quality/product-experience-qa.mdx docs/static/img/screenshots/qa-app-journey-view.jpg packages/qa scripts/agents/qa-app-build.test.ts scripts/agents/qa-app-client.test.ts scripts/agents/qa-state-pull.test.ts scripts/agents/qa-state-pull.ts scripts/agents/qa-workbook-build.test.ts scripts/quality/check-qa-id-ledger.mjs scripts/quality/check-qa-id-ledger.test.mjs` → exit code 0, no output
- Evidence-only worktree-status command and result (if applicable): `git status --porcelain=v1 --untracked-files=all -- docs/docs/builders/quality/product-experience-qa.mdx docs/static/img/screenshots/qa-app-journey-view.jpg packages/qa scripts/agents/qa-app-build.test.ts scripts/agents/qa-app-client.test.ts scripts/agents/qa-state-pull.test.ts scripts/agents/qa-state-pull.ts scripts/agents/qa-workbook-build.test.ts scripts/quality/check-qa-id-ledger.mjs scripts/quality/check-qa-id-ledger.test.mjs` → empty
