# Guidance and Toolchain Handoff

## Scope

- Exact Node 22.22.1, Bun 1.3.14, and Foundry 1.7.1 declarations.
- Selector-first intent ladder across Codex and Claude guidance.
- Non-mutating diagnosis/review and targeted QA behavior; strict ship and critical overrides.
- Correct `bun run build` command spelling and package build coverage.

## Proof

Codex consistency, guidance links, guidance examples, and authenticated browser-policy checks pass.
No product UI behavior changed, so rendered browser proof is not applicable.

## Validation Receipt

- Tested implementation commit SHA: `8fd3311980b28d71d48f72fe41c99d15276de912`
- Run at (UTC): `2026-08-23T08:02:46Z`
- Exact command(s): `node scripts/quality/check-codex-docs.js`; `node
  scripts/quality/check-guidance-links.mjs`; `node scripts/design/check-guidance-examples.mjs`;
  `node scripts/check-browser-verification-policy.mjs`.
- Result: Codex consistency passed; 59 guidance files passed link/command/fence parity; design
  examples passed; authenticated-browser policy passed for all 5 required guidance files.
- Validated paths: `AGENTS.md`, `CLAUDE.md`, `.claude/**`, `packages/{admin,client,shared}/AGENTS.md`,
  and the four guidance-check entrypoints.
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all --
  AGENTS.md CLAUDE.md .claude packages/admin/AGENTS.md packages/client/AGENTS.md
  packages/shared/AGENTS.md scripts/quality/check-codex-docs.js
  scripts/quality/check-guidance-links.mjs scripts/design/check-guidance-examples.mjs
  scripts/check-browser-verification-policy.mjs` → empty.
- Evidence-only diff command and result (if applicable): not applicable.
- Evidence-only worktree-status command and result (if applicable): not applicable.
