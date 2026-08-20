# Client Structure Cleanup + Agent Guide Consolidation Evaluation Plan

## Release Gates

1. **Correctness**: a deliberate type error in any client or admin source file fails `bun run build`.
2. **No suppression**: the 132 errors are fixed, not excluded, `@ts-ignore`d, or allowlisted.
3. **Regression safety**: no runtime behavior changes; the existing client and admin suites stay green.
4. **Evidence quality**: every phase records the command and output that proves it, per `CLAUDE.md`.
5. **Human judgment**: open decisions A–D are resolved by the maintainer, not assumed by an agent.

## Acceptance Checks

| ID | Behavior Boundary | Check | Owner | Evidence |
|---|---|---|---|---|
| AC-0 | Baseline | Pre-change `bun run test` and `bun run build` results recorded for client and admin, plus a re-measured per-project error count (evidence in `spec.md` predates the concurrent wagmi v2→v3 upgrade) | `state_api` | |
| AC-1 | Build gate | Append a deliberate type error to a client source file → `bun run build` **fails**. Repeat for admin. Remove the probe. | `state_api` | |
| AC-2 | Typecheck scope | `tsc -b --listFiles` in client and admin each report a non-zero file count covering `src/**`, `vite/**`, and tests | `state_api` | |
| AC-3 | Error count | `tsc -b` reports **0 errors** in both packages, across **all** referenced projects — app, node, and test. If decision E selects `-p tsconfig.app.json` instead, this narrows to the app project and AC-3b does not apply. | `state_api` | |
| AC-3b | Test project | `src/__tests__/**` type-checks clean — ~79 client errors and an unmeasured admin count are exposed for the first time by removing `baseUrl` | `state_api` | |
| AC-4 | No suppression | `git diff` introduces no new `@ts-ignore`, `@ts-expect-error`, `any` widening, or tsconfig `exclude` covering app source | `qa_pass_2` | |
| AC-5 | Client layout | `packages/client/src/modules/` does not exist; no kebab-case `.ts`/`.tsx` under `src/` except framework-mandated entry files; no file named `*.config.*` remains at `src/` root | `ui` | |
| AC-6 | Imports intact | `bun run test` and `bun run build` green after every rename — proves no import broke | `ui` | |
| AC-7 | Staged code | All three staged components carry the marker, have a story, and appear in the typecheck | `ui` | |
| AC-8 | Dead code | `WorkCard`, `WorkCardProps`, `WorkCardItem`, `AvatarRootProps`, `AvatarVariantProps` are gone; `MinimalWorkCard` still renders in `WorkListTab` and `Features/Garden/Work` | `ui` | |
| AC-9 | Name collision | Exactly one `buttonVariants` export exists across client and shared | `ui` | |
| AC-10 | Guide neutrality | No "Codex Guide" title or Codex-specific instruction remains in root or package `AGENTS.md`; Codex mechanics live in `.codex/` | `docs` | |
| AC-11 | Guide dedupe | No section body appears near-verbatim in both `AGENTS.md` and `CLAUDE.md`; one validation section, not three | `docs` | |
| AC-12 | Guide completeness | `AGENTS.md` contains a commands table, Git Workflow, Key Patterns, Criticality Matrix, environment/chain, service ports, and PostHog routing | `docs` | |
| AC-13 | Gate teeth | A deliberately misnamed and a deliberately misplaced fixture each fail `bun run check:source-structure`; the real tree passes | `docs` | |
| AC-14 | Gate respects staged | A file carrying the staged marker is not flagged by the dead-export scan | `docs` | |

## Test Strategy

- **Unit**: existing client (`src/__tests__/`, 86 files) and admin suites must stay green. The
  `WorkCard.test.tsx` file loses its dead-export half in step 2.6 and keeps its `MinimalWorkCard` half.
- **Integration**: none added — this plan changes no runtime behavior.
- **E2E / Playwright**: not applicable.
- **Manual checks**: none required. Every gate here is a command.
- **TDD proof**: Phase 1's RED is already captured (the probe passing today, recorded in `spec.md`
  § Research Evidence). GREEN is AC-1. Phase 4's RED is a misnamed fixture failing the new rule.
  Phases 2 and 3 record `not_applicable` with the note that they are refactor and documentation.

## Known Evidence Limits

- Every error count in `spec.md` was measured on 2026-08-19 **before** a concurrent session landed a
  wagmi v2→v3 major upgrade on this branch. wagmi types feed the `` `0x${string}` `` cluster directly.
  AC-0 exists to re-establish the baseline; do not execute against the recorded numbers.
- Admin's test-project error surface has never been measured — admin has no test tsconfig yet.
- The staged-marker syntax (decision D) is unresolved, so AC-14 cannot be written as a concrete
  command until it is.

## Validation Ladder Selection

Per `CLAUDE.md` § Validation Intent Ladder, this work is **Ship Gate** — it touches build
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
