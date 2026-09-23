# UI Handoff

Journey Mode is implemented in the static QA application and authored from the canonical catalog.
Walk remains the default, Priority remains available, and Journey supports whole-flow and
participant-part filtering. Known gates keep all verdict controls visible and unselected, so the
tester can record `Blocked` after encountering the gate.

The reproducible QA tooling suite passed on 2026-09-03: 11 test files and 216 tests. The QA build
also projected all 142 active cases, and the validation system's 196 tests passed. Authenticated
Brave rehearsal rendered English, Spanish, and Portuguese prerequisite and action lists in Journey
order with no desktop horizontal overflow. Earlier lane proof also covered the 375 × 812 mobile
layout and the accessible names and states for the view, journey, part, and verdict controls.

The UI lane is complete after implementation and local proof. Redeployment and the two-wallet
service-relay smoke belong to `qa_pass_1`.

## Validation Receipt

- Tested implementation commit SHA: `0a93574e43bd83228294b576613ca47e98f1e40e`
- Run at (UTC): `2026-09-04T01:08:30Z`
- Exact command(s): `bun run test:agent-tools`; `bun run test:validation-system`; `node --test scripts/docs/generate.test.mjs docs/scripts/docs-audit.test.mjs && bun run docs:audit:ci && bun run check:docs-generated`; `bun run build:docs`; `bun run agentic:check`; `bun run --filter @green-goods/qa build`; authenticated Brave inspection of the local QA build
- Result: the QA tooling command passed 11 test files and 216 tests; the validation system passed 196 tests; docs authority, generated projections, docs build, and agentic checks passed; the QA build projected 142 active cases. Authenticated Brave rendered localized prerequisite and action lists before the verdict controls in English, Spanish, and Portuguese. The Portuguese treasury gate showed all four verdicts unselected at 1912 px with `scrollWidth` equal to `innerWidth`. The post-commit push runner's automated checks passed, then it exited 2 only because browser proof is recorded manually outside the runner.
- Validated paths: `docs/docs/builders/quality/test-cases.mdx`, `packages/qa/build.mjs`, `packages/qa/index.html`, `packages/qa/locales/en.json`, `packages/qa/locales/es.json`, `packages/qa/locales/pt.json`, `scripts/agents/qa-app-build.test.ts`, `scripts/agents/qa-app-client.test.ts`, `scripts/data/validation-policy.json`, `scripts/docs/generate.test.mjs`, `scripts/docs/renderers.mjs`, and `scripts/quality/select-validation.test.mjs`
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- docs/docs/builders/quality/test-cases.mdx packages/qa/build.mjs packages/qa/index.html packages/qa/locales/en.json packages/qa/locales/es.json packages/qa/locales/pt.json scripts/agents/qa-app-build.test.ts scripts/agents/qa-app-client.test.ts scripts/data/validation-policy.json scripts/docs/generate.test.mjs scripts/docs/renderers.mjs scripts/quality/select-validation.test.mjs` → empty
