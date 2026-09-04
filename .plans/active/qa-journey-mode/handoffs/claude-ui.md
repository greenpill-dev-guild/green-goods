# UI Handoff

Journey Mode is implemented in the static QA application and authored from the canonical catalog.
Walk remains the default, Priority remains available, and Journey supports whole-flow and
participant-part filtering. Known gates keep all verdict controls visible and unselected, so the
tester can record `Blocked` after encountering the gate.

The reproducible QA tooling suite passed on 2026-09-03: 11 test files and 216 tests. The QA build
also projected all 142 active cases, and the validation selector's 73 tests passed. Authenticated
Brave rehearsal rendered the Journey at desktop with its Portuguese authored steps in semantic
ordered lists and no horizontal overflow. Earlier lane proof also covered the 375 × 812 mobile
layout and the accessible names and states for the view, journey, part, and verdict controls.

The UI lane is complete after implementation and local proof. Redeployment and the two-wallet
service-relay smoke belong to `qa_pass_1`.

## Validation Receipt

- Tested implementation commit SHA: `5a0a5400dc1016d05c49389a04c694c731dcd37b`
- Run at (UTC): `2026-09-04T00:03:01Z`
- Exact command(s): `bun run test:agent-tools`; `node --test scripts/quality/select-validation.test.mjs`; `bun run --filter @green-goods/qa build`; connected Brave inspection of the local QA build
- Result: the QA tooling command passed 11 test files and 216 tests; the validation selector passed 73 tests; the QA build projected 142 active cases. Connected Brave rendered 16 Portuguese Journey step lists as semantic `<ol>` elements at 1912 × 939 with no horizontal overflow; the first case showed all four authored steps and no verdict was selected.
- Validated paths: `packages/qa/index.html`, `scripts/agents/qa-app-client.test.ts`, `scripts/data/validation-policy.json`, and `scripts/quality/select-validation.test.mjs`
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- packages/qa/index.html scripts/agents/qa-app-client.test.ts scripts/data/validation-policy.json scripts/quality/select-validation.test.mjs` → empty at `5a0a5400dc1016d05c49389a04c694c731dcd37b`
- Evidence-only diff command and result: `git diff --exit-code 5a0a5400d..HEAD -- packages/qa/index.html scripts/agents/qa-app-client.test.ts scripts/data/validation-policy.json scripts/quality/select-validation.test.mjs` → exit code 0, no output
- Evidence-only worktree-status command and result: `git status --porcelain=v1 --untracked-files=all -- packages/qa/index.html scripts/agents/qa-app-client.test.ts scripts/data/validation-policy.json scripts/quality/select-validation.test.mjs` → empty
