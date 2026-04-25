# Codex QA Pass 2 Handoff

1. What changed: this lane performs the final regression and contract confirmation after Claude QA passes.
2. What remains: confirm the trigger branch exists, re-run the minimum regression checks from `../eval.md`, verify the run log outcome matches the changed files, and close the loop.
3. Validation run: `node scripts/ci-local.js --quick`, `node scripts/plan-hub.mjs validate`, plus run-log review for the cleanup metric.
4. Known risks or blockers: do not start before `qa_pass_1` passes; if the outcome or scope is inconsistent, keep the lane blocked.
5. Repo-truth references: `../eval.md`, `../metrics.md`, `../status.json`, `../handoffs/claude-qa-pass-1.md`
