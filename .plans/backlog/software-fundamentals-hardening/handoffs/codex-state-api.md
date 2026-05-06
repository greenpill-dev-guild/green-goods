# Codex State/API Handoff

## Starting Point

This backlog hub was created from a read-only software-fundamentals audit on 2026-05-01. The work should not start as broad cleanup. Pick one slice, confirm scope, and preserve unrelated WIP.

## First Recommended Slice

Start with repo-truth repair, then do the static-analysis tool evaluation before changing gates:

1. Fix `bun run check:claude-guidance` failures.
2. Confirm `bun run check:codex-guidance`.
3. Correct stale `.plans` plan-hub command references or add durable package scripts.
4. Repair contracts package guidance drift around the removed `GreenGoodsResolver` vocabulary without touching Solidity behavior.
5. Refresh ADR-008 and `packages/shared/AGENTS.md` so shared root-barrel and documented subpath import rules match the current repo.
6. Run the Knip vs Fallow comparison from `eval.md` in report-only mode and write `reports/knip-vs-fallow-evaluation.md`.
7. Add or adjust the chosen dead-code/static-health audit path so it does not import Varlock-backed Vite configs.
8. Validate with `node scripts/harness/plan-hub.mjs validate`.

## Guardrails

- Do not touch contracts or deployments.
- Contracts package guide updates are allowed only as docs/vocabulary repair unless a child hub explicitly reopens Contracts.
- Do not redesign Campaign Cookie Jar while doing boundary hardening.
- Preserve ADR-008's accepted fat-barrel strategy; tighten review rules instead of replacing the import architecture.
- Treat Knip and Fallow output as triage evidence first. Do not delete files in the same slice that merely makes the audit runnable.
- Do not add Fallow as a dependency or CI gate until the same-baseline report recommends it.
- Do not run autofix except as `--dry-run` unless the human scope-locks the exact deletion class.
- Do not widen source-structure caps without recording why.
- Do not delete stale admin surfaces until current imports, routes, docs, and stories are checked.
- Record RED test evidence or explicit proof limits before large behavior refactors.

## Key Files

- `.plans/backlog/software-fundamentals-hardening/spec.md`
- `.plans/backlog/software-fundamentals-hardening/plan.todo.md`
- `.plans/backlog/software-fundamentals-hardening/eval.md`
- `.plans/backlog/software-fundamentals-hardening/reports/software-fundamentals-audit-2026-05-01.md`
- `.plans/backlog/software-fundamentals-hardening/reports/knip-vs-fallow-evaluation.md`
