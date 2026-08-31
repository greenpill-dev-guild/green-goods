# Agent Research and Discussion Grounding Spec

## Summary

Add a passive, read-only-by-default `research` skill that connects source evidence to the planning
decision it unblocks. Keep it distinct from debugging, review, audit, historical-rationale tracing,
simple lookup, and implementation. Integrate it into planning without introducing a tracker,
sidecar, dependency, or separate skill tree.

## Users

- Primary: maintainers discussing product or architecture work with an agent before implementation.
- Secondary: future coding agents that need a compact, freshness-bounded account of what is already
  settled and what still needs human judgment.

## Functional Requirements

1. Frame a bounded research question, the decision it unblocks, its scope, and required freshness.
2. Resolve authority from a user-named source; Plan Hub `status.json.links` and document map;
   canonical specs; relevant code, tests, history, or live state; then external primary sources.
3. Follow new evidence branches only when they can change the answer, and stop at authoritative
   evidence, source exhaustion, a human decision, or the scope boundary.
4. Classify material conclusions as established, corrected/contradicted, inferred, or unresolved,
   with a freshness or proof limit where needed.
5. Return a compact research brief covering source coverage, established context, contradictions,
   gaps, decision implications, and the remaining human frontier.
6. Keep ordinary research in chat and read-only. Preserve one focused artifact only on explicit
   request, and route accepted product or architecture decisions back through `plan` into canonical
   Plan Hub files.
7. When a bounded session is insufficient, return a map-ready handoff with destination, settled
   facts and decisions, sharp frontier questions, remaining fog, dependencies, and out-of-scope
   boundaries. Never create tracker records automatically.
8. Planning must resolve discoverable facts before asking the user. Brainstorming must ask every
   currently independent human decision in a numbered round with a recommendation while deferring
   dependent questions.
9. Trigger routing must select research for repository-context and external-primary-source work,
   while preserving the neighboring routes for planning, debugging, review, audit, simple lookup,
   and historical-rationale tracing.

## Research Evidence

- Upstream patterns reviewed: Matt Pocock's
  [research](https://github.com/mattpocock/skills/blob/main/skills/engineering/research/SKILL.md),
  [writing-for-agents](https://github.com/mattpocock/skills/blob/main/skills/productivity/writing-for-agents/SKILL.md),
  and [Wayfinder](https://github.com/mattpocock/skills/blob/main/skills/engineering/wayfinder/SKILL.md)
  are useful but distinct concepts. This slice adopts primary-source research and context-pointer
  discipline without importing tracker or sidecar architecture.
- Existing repository pattern: `.claude/skills` is canonical and `.agents/skills` exposes the same
  tree through a symlink. `plan` owns accepted architecture/product decisions and Plan Hub state.
- Proving case: `.plans/active/commitment-pooling/status.json#links` identifies the external brief,
  contract, standing-commitments, settlement, UI/UX, acceptance, correction, and handoff authorities
  inside a current 236-file hub. Targeted pointer use is sufficient; full-hub loading is not.
- Behavior boundary: `scripts/quality/check-skill-behavior-contracts.mjs` and its node tests are the
  existing deterministic guidance contract harness. `scripts/data/skill-trigger-eval.json` and
  `bun run eval:skills` are the existing live description-routing harness.
- Open inference: a single forward test is directional evidence, not a statistical model-quality
  benchmark. The deterministic contracts remain the durable regression guard.

## Human Judgment Points

- Locked by the approved plan: active-agent research, no subagent delegation; read-only chat output
  by default; one artifact only on request; frontier rounds; no automatic tracker; no Linear mirror.
- Protected surfaces: `.claude/skills/**`, Plan Hub machine state, the trigger eval fixture, and
  behavior-checker contracts. The documented skill inventory must change with the filesystem count.
- Review tradeoff: the research description must be broad enough to activate on real evidence work
  without swallowing simple lookups or specialized diagnosis/review/audit workflows.

## Non-Functional Constraints

- Keep `.claude/skills/research/SKILL.md` self-contained and passive-only.
- Add no package dependency, new harness script, top-level directory, instruction-file rule, or
  OpenAI sidecar.
- Preserve Commitment Pooling files byte-for-byte during the proving case.
- Use the current branch and do not publish, commit, or create a PR in this slice.

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| UI | `ui` | Not applicable; no rendered surface changes |
| State / API | `state_api` | Agent guidance, routing fixtures, deterministic contracts, Plan Hub evidence |
| Contracts | `contracts` | Not applicable; no Solidity, ABI, deployment, or release changes |
| QA | `qa_pass_1`, `qa_pass_2` | Selector-chosen deterministic guidance and routing checks; terminal receipt deferred until a clean committed candidate exists |

## Risks

- Greedy activation could route specialized work to research. Mitigation: explicit exclusions plus
  positive and near-neighbor trigger fixtures.
- A research session could become an indiscriminate repository crawl. Mitigation: authority
  pointers, decision relevance, and branch stop conditions are deterministic behavior contracts.
- Guidance could turn findings into product decisions or tracker state. Mitigation: fact/decision,
  persistence, and map-escalation contracts fail closed in the checker.
