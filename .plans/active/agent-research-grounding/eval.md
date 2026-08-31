# Agent Research and Discussion Grounding Evaluation Plan

## Release Gates

1. Correctness: research resolves authority, stops branches, classifies evidence, and exposes only
   the remaining human frontier.
2. Routing safety: repository and external research prompts select `research`; specialized and
   simple neighboring prompts retain their intended route.
3. Read-only safety: no default implementation, Plan Hub decision write, Linear write, tracker, or
   Commitment Pooling mutation is authorized.
4. Discussion quality: independent human choices are grouped with recommendations and dependent
   questions are deferred.
5. Escalation quality: an unbounded investigation yields the complete map-ready handoff without
   pretending Wayfinder exists.
6. Evidence quality: deterministic contracts, live trigger routing, Plan Hub validation, and a
   same-model read-only forward test are recorded with their limits.

## Acceptance Checks

| ID | Behavior Boundary | Check | Owner | Evidence |
|---|---|---|---|---|
| AC-1 | Source authority and targeted loading | Behavior contract requires user/Plan Hub/canonical/current/external-primary authority order and targeted Plan Hub pointers | `state_api` | `check-skill-behavior-contracts.test.mjs` |
| AC-2 | Adaptive stopping | Behavior contract requires follow-only-if-material and all four stop conditions | `state_api` | `check-skill-behavior-contracts.test.mjs` |
| AC-3 | Facts, judgment, and persistence | Behavior contract requires conclusion states, read-only default, explicit artifact request, and Plan Hub decision routing | `state_api` | `check-skill-behavior-contracts.test.mjs` |
| AC-4 | Frontier discussion | Behavior contract requires independent numbered rounds with recommendations and deferred dependent questions | `state_api` | `check-skill-behavior-contracts.test.mjs` |
| AC-5 | Map escalation | Behavior contract requires all handoff fields and forbids automatic tracker writes | `state_api` | `check-skill-behavior-contracts.test.mjs` |
| AC-6 | Trigger discrimination | Positive research plus planning/debug/review/audit/lookup/rationale neighbors route as expected | `qa_pass_1` | `bun run eval:skills` |
| AC-7 | Commitment Pooling proving case | Before/after run uses the same snapshot, model, prompt, and read-only permissions; after guidance begins at `status.json.links` and asks fewer factual questions | `qa_pass_2` | Conclusion in `handoffs/codex-state-api.md` |
| AC-8 | Repository integrity | Guidance links, Codex guidance, review guardrails, and all Plan Hubs validate | `qa_pass_2` | Exact commands in handoff |

## Test Strategy

- Unit: mutate one required marker for each new behavior contract and prove only that contract fails.
- Integration: run the existing behavior checker, review guardrails, guidance-link/Codex-guidance
  checks, and Plan Hub validator.
- Trigger routing: run `bun run eval:skills` once against the final description.
- Forward test: reconstruct the pre-change plan/brainstorm guidance from `HEAD`, compare it with the
  working-tree research guidance under one model and read-only permission mode, keep temporary
  output outside the repository, and retain only the comparison conclusion.
- Browser/E2E: not applicable; no rendered or interactive surface changes.
- TDD proof: record the failing pre-implementation contract run and the passing post-implementation
  run in the State/API lane.

## Proof Limits

- The forward test is a single qualitative comparison and does not measure routing reliability
  across models or long-running sessions.
- Live routing and forward testing are environment-blocked. The sandbox denies the Claude OAuth and
  bare API endpoints and also denies the Codex evaluator endpoint. No model output was substituted
  or inferred from the deterministic checks.
- A commit-attributed terminal validation receipt cannot be written while these guidance paths are
  intentionally uncommitted. The hub remains active and the implementation lane remains
  `in_progress` until publication or commit readiness is separately requested.
