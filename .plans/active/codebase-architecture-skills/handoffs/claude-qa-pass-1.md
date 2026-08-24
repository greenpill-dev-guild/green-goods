# Codebase Architecture Skills and Seam Governance - QA Pass 1 Handoff

## Lane

- Owner: Codex
- Branch: `develop` (direct integration, as approved)
- Status: passed

## Scope

- Confirm the exact-path Ship Gate, safe direct integration, and exact-SHA outer-loop coverage.

## Validation

- Full Ship Gate passed, including format, lint, tests, deterministic root build, Agent build, Docs
  build, and the guidance/supply-chain checks selected for sensitive paths.
- Manually dispatched coverage run
  [32775723169](https://github.com/greenpill-dev-guild/green-goods/actions/runs/32775723169)
  succeeded on the exact implementation SHA.
- Coverage, statements / branches / functions / lines:
  - Shared: `62.76 / 54.01 / 61.29 / 64.29`; floors `61 / 52 / 59 / 62`.
  - Admin: `52.75 / 48.37 / 47.38 / 54.39`; floors `51 / 47 / 44 / 53`.
  - Client: `64.87 / 57.69 / 63.62 / 66.56`; floors `63 / 56 / 62 / 64`.

## Validation Receipt

- Tested implementation commit SHA: `446c75c2d7b8b2b4f8c31605828c8578f150d7a7`
- Run at (UTC): `2026-08-24T20:52:42Z`
- Exact command(s): `bun format`; `bun lint`; `bun run test`;
  `VITE_CHAIN_ID=11155111 bun run build`; `bun run build:agent`; `bun run build:docs`;
  `gh run watch 32775723169 --exit-status --interval 10`
- Result: Ship Gate passed; Coverage Nightly run 32775723169 completed with success for all three
  package jobs on the exact implementation SHA
- Validated paths: the 42-file implementation commit plus Shared, Admin, and Client coverage projects
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- .claude docs packages/shared packages/client packages/indexer scripts` -> empty
- Evidence-only diff command and result (if applicable): `git diff --exit-code 446c75c2d7b8b2b4f8c31605828c8578f150d7a7..HEAD -- .claude docs packages/shared packages/client packages/indexer scripts` -> empty
- Evidence-only worktree-status command and result (if applicable): `git status --porcelain=v1 --untracked-files=all -- .claude docs packages/shared packages/client packages/indexer scripts` -> empty

## Risks / Blockers

- The scheduled 2026-09-22 ratchet is not part of this current coverage receipt.
