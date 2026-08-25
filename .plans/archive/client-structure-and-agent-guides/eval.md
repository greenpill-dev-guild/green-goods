# Client Structure Cleanup + Agent Guide Consolidation Evaluation Plan

> **Archived record:** implementation is closed. Operational handoffs, artifacts, and lane files were removed; preserved reports and any references below describe historical execution, not live work.

## Release Gates

1. **Correctness**: a deliberate type error in any client or admin source file fails `bun run build`.
2. **No suppression**: the 132 errors are fixed, not excluded, `@ts-ignore`d, or allowlisted.
3. **Regression safety**: no runtime behavior changes; the existing client and admin suites stay green.
4. **Evidence quality**: every phase records the command and output that proves it, per
   `AGENTS.md` § Validation and `.claude/context/validation-pipeline.md`.
5. **Human judgment**: decisions A–E are resolved; optional decision C remains explicitly deferred.

## Acceptance Checks

| ID | Behavior Boundary | Check | Owner | Evidence |
|---|---|---|---|---|
| AC-0 | Baseline | Pre-change `bun run test` and `bun run build` results recorded for client and admin, plus a re-measured per-project error count (evidence in `spec.md` predates the concurrent wagmi v2→v3 upgrade) | `state_api` | PASS: pre-change full suite passed; client and admin builds returned success while the old `tsc --noEmit` invocation compiled no project. Re-measured app, node, and test projects were already at zero after intervening fixes on `develop`. |
| AC-1 | Build gate | Append a deliberate type error to a client source file → `bun run build` **fails**. Repeat for admin. Remove the probe. | `state_api` | PASS: independent final probe failed both builds with `TS2322` and `TS6133`; probes removed before the clean build. |
| AC-2 | Typecheck scope | `tsc -b --listFiles` in client and admin each report a non-zero file count covering `src/**`, `vite/**`, and tests | `state_api` | PASS: client app/node/test listed 6,220 / 886 / 6,267 files; admin listed 5,609 / 653 / 6,007, including representative source, Vite, and test files. |
| AC-3 | Error count | `tsc -b` reports **0 errors** in both packages, across **all** referenced projects — app, node, and test. | `state_api` | PASS: both package `typecheck:full` checks and the final package builds passed. |
| AC-3b | Test project | `src/__tests__/**` type-checks clean | `state_api` | PASS: both test projects are referenced by their root `tsconfig.json` and passed `tsc -b`. |
| AC-4 | No suppression | `git diff` introduces no new `@ts-ignore`, `@ts-expect-error`, `any` widening, or tsconfig `exclude` covering app source | `qa_pass_2` | PASS: zero added suppression or widening lines; app-source excludes remain limited to tests, stories, and Shared test fixtures. |
| AC-5 | Client layout | `packages/client/src/modules/` does not exist; no kebab-case `.ts`/`.tsx` under `src/` except framework-mandated entry files; no file named `*.config.*` remains at `src/` root | `ui` | PASS: direct filesystem checks and the whole-tree source-structure gate pass. The only matching hyphenated source name is framework-owned `vite-env.d.ts`. |
| AC-6 | Imports intact | `bun run test` and `bun run build` green after every rename — proves no import broke | `ui` | PASS: full repository suite and deterministic root build passed after all moves. |
| AC-7 | Staged code | All three staged components carry the marker, have a story, and appear in the typecheck | `ui` | PASS: seven-entry staged manifest is isolated; three real-render stories pass story checks and the client test project typecheck. |
| AC-8 | Dead code | `WorkCard`, `WorkCardProps`, `WorkCardItem`, `AvatarRootProps`, `AvatarVariantProps` are gone; `MinimalWorkCard` still renders in `WorkListTab` and `Features/Garden/Work` | `ui` | PASS: removed symbols have no production declarations; both live `MinimalWorkCard` consumers and its focused test remain. |
| AC-9 | Name collision | Exactly one `buttonVariants` export exists across client and shared | `ui` | PASS: only `packages/shared/src/components/Button.tsx` exports `buttonVariants`; the client helper is private and named `clientButtonVariants`. |
| AC-10 | Guide neutrality | No "Codex Guide" title or Codex-specific instruction remains in root or package `AGENTS.md`; Codex mechanics live in `.codex/` | `docs` | PASS: `bun run check:codex-guidance`; root and package titles inspected |
| AC-11 | Guide dedupe | No section body appears near-verbatim in both `AGENTS.md` and `CLAUDE.md`; one validation section, not three | `docs` | PASS: duplicate-policy RED/GREEN; 3 focused fixtures and `bun run test:review-guardrails` |
| AC-12 | Guide completeness without bloat | `AGENTS.md` exposes common commands, package routing, criticality, environment/chain invariants, PostHog routing, and canonical architecture/validation/service links without duplicating volatile port or documentation inventories | `docs` | PASS: 26-check Ship plan, `check:guidance-links` (62 files), and guidance drift scope |
| AC-13 | Gate teeth | A deliberately misnamed and a deliberately misplaced fixture each fail the source-structure policy; the real tree passes `bun run check:source-structure` | `docs` | PASS: 11 fixtures cover placement, naming, layering, dead exports, direct-test consumers, baseline exactness/growth, and exclusions; whole-tree gate passes with seven exact remaining hook-location IDs. |
| AC-14 | Gate respects staged | A file in the exact staged manifest and carrying the staged marker is not flagged by naming or dead-export scans | `docs` | PASS: staged fixture plus existing `check-staged-modules` contract |

## Test Strategy

- **Unit**: existing client (`src/__tests__/`, 86 files) and admin suites must stay green. The
  `WorkCard.test.tsx` file loses its dead-export half in step 2.6 and keeps its `MinimalWorkCard` half.
- **Integration**: none added — this plan changes no runtime behavior.
- **E2E / Playwright**: not applicable.
- **Manual checks**: none required. Every gate here is a command.
- **TDD proof**: Phase 1's RED is already captured (the probe passing today, recorded in `spec.md`
  § Research Evidence). GREEN is AC-1. Phase 3 prose is documentation, while its duplicate-policy
  checker has a focused missing-export RED and three-fixture GREEN receipt. Phase 4's RED is the
  fixture suite failing before the checker exported its new policy API; GREEN is nine focused
  fixtures plus the whole-tree checker. Phase 2 remains `not_applicable` as a refactor.

## Known Evidence Limits

- Every error count in `spec.md` was measured on 2026-08-19 **before** a concurrent session landed a
  wagmi v2→v3 major upgrade on this branch. wagmi types feed the `` `0x${string}` `` cluster directly.
  AC-0 exists to re-establish the baseline; do not execute against the recorded numbers.
- The original error counts remain historical evidence only; the current app, node, and test
  projects all pass and the negative probe proves they are no longer no-op checks.

## Validation Ladder Selection

Per `AGENTS.md` § Validation and `.claude/context/validation-pipeline.md`, this work is **Ship Gate** — it touches build
configuration, a shared domain type, and security-sensitive surfaces (`AGENTS.md`,
`scripts/quality/**`). QA Speed Mode is not sufficient for any phase.

Render the plan with `bun run validation:plan -- --intent ship` before executing.

## QA Sequence

### Claude QA Pass 1

- Confirm AC-5 through AC-9 by reading the diff, not by trusting the checklist
- Confirm no runtime behavior changed anywhere in Phase 2
- If blocked, record the blocker in `handoffs/claude-qa-pass-1.md`

### Codex QA Pass 2

- Start only after `qa_pass_1` passes
- Focus on AC-4: hunt for suppression introduced to make the error count reach zero
- Re-run the AC-1 probe independently rather than trusting the recorded evidence
