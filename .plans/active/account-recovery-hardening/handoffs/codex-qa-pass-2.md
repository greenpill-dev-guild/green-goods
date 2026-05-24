# Codex QA Pass 2 Handoff

## Lane

- Branch signal: `codex/qa-pass-2/account-recovery-hardening`
- Linear issue: `PRD-541`
- Starts after: Claude QA pass 1 is passed and `claude/qa-pass-1/account-recovery-hardening` exists

## Regression Checks

- Confirm `status.json` marks `qa_pass_1` passed before starting.
- Re-run targeted shared auth tests chosen by the implementation lane.
- Confirm rollout-flag-off behavior, server-unavailable behavior, and guarded new-account confirmation are covered by QA pass 1 evidence or follow-up tests.
- Confirm canonical RP/origin evidence, address-continuity proof, privacy-safe telemetry, and docs/support cleanup are complete.
- Run `node scripts/harness/plan-hub.mjs validate`.
- Run `bun run build:shared`.
- Confirm `PRD-505` and `PRD-507` are resolved or explicitly carried as June 10 release risks.

## Evidence

Record final release-gate evidence here and in `reports/`.
