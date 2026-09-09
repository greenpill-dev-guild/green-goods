# Local validation and remaining acceptance

Evidence recorded on 2026-09-09 UTC before commit from the working tree on `develop`, based on `beb933e9727962fbbc448b99d5c673c7ed64318d`. The implementation is now committed locally as `7bb26ff86409b3312ad4f8b70f5d8a42c07b937b`, but these results are pre-commit evidence and do not constitute a clean-commit receipt. There is no PR, deployment or production-acceptance claim. The pre-existing Agent Dockerfile change was left untouched.

The validation selector was run before checks and refreshed after the final test edits:
`bun run validation:plan -- --intent ship --base HEAD --changed-file /tmp/reliable-work-authored-paths.txt --json`.
The file lists the authored Shared/Client paths; the selector retained critical overrides for Shared Work/JobQueue and their consumers. Full package tests ran directly through each package's `bun run test` wrapper, without cache reuse. Format was checked without rewriting unrelated files.

## Automated evidence

- Shared: `bun run test` completed at approximately 03:10 UTC: 426 files passed, 2 skipped; 4,576 tests passed, 18 skipped. Log: `/tmp/reliable-work-shared-clean.log`.
- Client: `bun run test` completed at approximately 03:08 UTC: all 127 files and 1,063 tests passed. Its Vite watcher needs local loopback access; automatic approval allowed the existing test server to bind after the sandbox's initial EPERM. Log: `/tmp/reliable-work-client-clean.log`.
- Admin: fresh `bun run test` completed at approximately 03:12 UTC: all 112 files and 847 tests passed (`/tmp/reliable-work-admin-clean.log`). Agent: fresh `bun run test` completed at approximately 03:11 UTC: 311 tests passed with one skipped, plus all 9 native-lane tests passed (`/tmp/reliable-work-agent-clean.log`).
- Shared `bun run typecheck` and `bun run typecheck:tests`; Client `bun run typecheck` and `bun run typecheck:tests`; Admin `bun run typecheck:tests`; Agent `bun run typecheck` and `bun run typecheck:tests`: passed. Shared/Client test types were refreshed after the last added tests.
- Client and Admin `VITE_CHAIN_ID=11155111 bun run build`: passed at approximately 03:06–03:07 UTC. Client PWA budgets passed. Agent `bun run build` passed. Shared `bun run build` confirms source consumption with no build step needed.
- Root `bun run lint`, `bun run format:check`, `bun run check:source-structure`, `bun run check:staged-modules`, design-md/generated/tokens/vocabulary guards, and ontology checks passed. `bun run agentic:check` passed, including Storybook story quality. Shared story coverage checked 265/265 stories and story quality checked 236 files. `git diff --check` passed.

The first broad runs exposed obsolete DraftsTab dialog mocks and a missing remove-button translation key, both corrected. Under simultaneous build/test load, unrelated ENS, Cookies and Details tests also failed; isolated reruns and the subsequent complete Shared/Client runs passed without changing those unrelated implementations. Those failed runs are not reused as passing evidence.

Focused behavior proof covers copied bytes after the original file becomes unreadable, compression fallback, atomic complete snapshots/audio, retained unreadable legacy records, draft limits and removals, hydration and overlapping writes, repeated recovery and account changes, partial visual/audio/metadata uploads, checkpoint-write failure, durable queue identity/order/progress, known wallet transaction reconciliation, location consent/rounding/clearing, and sheet dismissal. These tests prove local behavior; they do not simulate every Android storage provider.

## Authenticated browser proof

Authenticated Brave at `https://localhost:3001/home/garden` verified a garden selection reaching “Saved on this device,” restoration of that draft after reload, initial sheet focus, Escape dismissal without deletion, sheet stacking above PWA navigation, and the explicit two-step discard flow. A further reload confirmed the task-created garden-only QA draft stayed removed. Screenshots and accessibility trees are retained in this task's browser tool results. No upload or on-chain submission was performed.

The development server briefly showed a provider error during HMR after source changes; a clean reload resolved it. Browser claims above are from clean reloads. No global provider repair was made.

## Acceptance still pending

Full photo/audio/video recovery and upload must still be exercised in authenticated Brave. Physical Android Chrome/PWA proof remains pending: background/resume, Android back, offline restart, app termination after “Saved,” and supported video playback. No connected Android bridge was available in this environment; device availability was asked in the task and has not been confirmed. These gaps block production acceptance, not the completed local code changes.

The implementation promises reuse of confirmed durable checkpoints, not exactly-once remote pinning when both response and local checkpoint are lost. An edit still marked “Saving” can be lost on sudden termination. A committed snapshot marked “Saved” is the durability boundary.
