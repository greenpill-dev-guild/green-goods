# CSS Maintainability Polish Evaluation Plan

## Release Gates

1. Plan integrity: this hub remains active, scoped to CSS architecture polish, and does not expand
   into a redesign pass.
2. Architecture fit: CSS ownership, global selectors, and guardrails follow the plan hub contract and existing design-system validation posture.
3. Dialect safety: public browser, installed PWA, and admin styles remain separate.
4. Token compliance: design-system values use existing tokens, aliases, or component variables instead of repeated raw values where intent is clear.
5. Guardrail proof: unresolved CSS custom property risk is covered by tooling or an explicit blocker with owner.
6. Evidence quality: cleanup claims are backed by command output, file references, and visual proof where relevant.

## Acceptance Checks

| ID | Check | Owner | Evidence |
|---|---|---|---|
| AC-1 | Hub has complete `brief.md`, `spec.md`, `plan.todo.md`, `eval.md`, `status.json`, `handoffs/`, `reports/`, and `artifacts/` | system | `plan-hub validate` plus file list |
| AC-2 | CSS ownership inventory identifies global, package, component, Storybook, and docs boundaries | `ui` | `handoffs/claude-ui.md` or durable docs reference |
| AC-3 | Undefined CSS custom property risk is guarded or has a documented blocker | `state_api` | check output, script diff, or blocker note |
| AC-4 | Cleanup changes are source-grounded and do not introduce broad redesign or new framework scope | `qa_pass_1` | diff review plus visual notes |
| AC-5 | Browser/PWA/admin dialect boundaries hold after cleanup | `qa_pass_1` | screenshots, display-mode tests, or route smoke evidence |
| AC-6 | Final validation matches the touched surface | `qa_pass_2` | command output in handoff |

## Required Evidence

- Source-grounded CSS ownership inventory.
- List of accidental globals, legacy selectors, and deferred items.
- Guardrail output or documented blocker for undefined custom properties.
- Diff summary for any raw-value/token cleanup.
- Feature-readiness classification for any modern CSS/Web UI primitive proposed for adoption.
- Text-scale, reduced-motion, and fallback proof before enabling any Chrome-first or progressive primitive in runtime.
- Validation command output.
- Visual proof for representative surfaces affected by the cleanup.

## Validation Ladder

Minimum validation:

- `node scripts/harness/plan-hub.mjs validate`
- `bun run check:design-generated`
- `bun run check:design-tokens`
- `bun run lint:vocab`

Add surface-specific validation:

- Shared primitives changed: targeted shared tests and Storybook checks for affected stories.
- Client CSS changed: targeted client tests and a client build or runtime smoke.
- Admin/shared CSS changed: targeted admin/shared tests and admin runtime smoke.
- Docs CSS changed: docs lint/build path used by the docs package.

## QA Sequence

### Claude QA Pass 1

- Review visual cohesion, source-grounded scope, global selector boundaries, and dialect safety.
- Confirm visual evidence exists for affected surfaces.
- If blocked, record the blocker in `handoffs/claude-qa-pass-1.md`.

### Codex QA Pass 2

- Start only after `qa_pass_1` is passed.
- Confirm the trigger branch exists: `claude/qa-pass-1/css-maintainability-polish`.
- Re-run targeted validation.
- Confirm `status.json`, handoffs, and source diff all describe the same outcome.

## Archive Criteria

This hub can move to `.plans/archive/` only after:

- all implementation lanes are `passed`, `completed`, `skipped`, or `n/a`;
- CSS ownership inventory and global selector boundaries are recorded;
- guardrail output or an explicit blocker/defer decision is recorded;
- relevant design and surface-specific validation passes;
- visual proof exists for affected runtime surfaces;
- `status.json` history records the closeout.

## Failure Modes To Watch

- Treating this plan as a visual redesign instead of architecture polish.
- Moving browser editorial CSS into installed PWA defaults.
- Moving PWA mobile-shell assumptions into public browser pages.
- Adding a new CSS framework or broad abstraction when targeted cleanup would solve the issue.
- Creating component variables that simply mirror every CSS property without design intent.
- Relying on Tailwind utility classes authored in `packages/shared/src/` for consumer app layout.
- Claiming coverage from validators that do not inspect the changed files.
- Treating Chromium-first CSS features as baseline production requirements without `@supports`, feature detection, or static fallback proof.
