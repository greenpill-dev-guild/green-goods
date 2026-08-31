# Builder Documentation Authority - State/API Handoff

## Lane

- Owner: Codex
- Branch: set when work begins using `<type>/<work-description>`
- Status: implementation and local validation complete

## Scope

- Implement the documentation authority migration, deterministic projection framework, and hard
  authority gates accepted in `plan.todo.md`, `spec.md`, and `eval.md`.
- Keep runtime behavior unchanged and preserve unrelated work in the shared checkout.

## TDD Proof

- RED: `bun run check:docs-generated` was unavailable before implementation; stale generated output
  and broken authority paths were not hard failures.
- GREEN: `node --test scripts/docs/generate.test.mjs && bun run docs:audit:ci && bun run
  check:docs-generated && bun run build:docs` passed with eight generator fixtures, zero hard audit
  errors, 17 current projections, and a successful production build.
- Proof limit: the first deployed sitemap remains a post-merge Pages observation; the local
  production sitemap is verified.

## Validation

- The local production sitemap contains 44 builder routes: 17 generated references, 26 thin
  authored guides, and Revenue Explorer. No archive, delete, or move source route remains.

## Validation Receipt

- Tested implementation commit SHA: not commit-attributable; dirty shared worktree limitation for
  the validated paths
- Run at (UTC): `2026-08-30T22:35:24Z`
- Exact command(s): `node --test scripts/docs/generate.test.mjs`; `bun run docs:audit:ci`; `bun run
  check:docs-generated`; `bun run test:docs`; `bun run build:docs`; `bun run check:ontology`; `bun
  run test:validation-system`; `node --test scripts/quality/drift-check.test.mjs`; `bun run
  drift:check -- --scope docs --json`; `bun run check:codex-guidance`; `bun run
  check:skill-behavior`; `bun run check:guidance-links`; `git diff --check`
- Result: generator fixtures 8/8, docs tests 28/28, ontology tests 61/61, validation-system tests
  passed, zero hard docs-audit errors, 17 deterministic projections current, production docs build
  passed, and local sitemap composition 44/17/26/1
- Validated paths: `docs`, `scripts/docs`, `scripts/quality`, `scripts/data/validation-policy.json`,
  `.github/workflows/docs.yml`, `package.json`, `AGENTS.md`, package READMEs, and owning Plan Hubs
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- docs
  scripts/docs scripts/quality scripts/data/validation-policy.json .github/workflows/docs.yml
  package.json AGENTS.md .plans/active/builder-docs-authority` -> expected implementation changes
  present in the dirty shared worktree; unrelated PWA changes were excluded from validation scope
- Evidence-only diff command and result (if applicable): not applicable
- Evidence-only worktree-status command and result (if applicable): not applicable

## Risks / Blockers

- No implementation blocker. First deployed sitemap verification awaits the normal post-merge Pages
  deployment; the equivalent local production sitemap check passes.
- The selector's broader cross-package checkpoint is not wholly green because the concurrent
  Shared/PWA tree currently hits a WalletConnect `uint8arrays` package-export error, and its
  direct-seam registry has stale/unwired entries. Global Plan Hub validation is also blocked by
  incomplete receipts in `client-pwa-platform-hardening`. These paths were not changed to make this
  documentation migration pass.
