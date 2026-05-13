# Handoffs

Each implementation or QA lane writes its evidence here before changing lane status.

- `codex-contracts.md` - contracts/operator scripts, verifier, deployment artifact, indexer policy
- `codex-state-api.md` - shared readiness helpers, hooks, contract mapping, query invalidation
- `claude-ui.md` - admin/client marketplace UX, Storybook/browser evidence, i18n/design checks
- `claude-qa-pass-1.md` - UX/design review
- `codex-qa-pass-2.md` - regression and closeout review

Do not mark a behavior-changing lane complete until RED/GREEN proof is recorded with `node scripts/harness/plan-hub.mjs record-tdd`.
