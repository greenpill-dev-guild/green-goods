# Docs Lane Handoff

Status: Phase 3 guidance consolidation implemented; the docs lane remains open for Phase 4 source-structure enforcement and its UI dependency.

## Completed Phase 3 scope

- `AGENTS.md` is the agent-neutral entry contract with one validation summary, early package routing,
  common commands, criticality, PostHog routing, and canonical architecture/validation links.
- `CLAUDE.md` contains Claude-specific entrypoints, tool routing, output/scope behavior, Codex
  dispatch, health-skill routing, and session continuity instead of copying shared policy.
- Every package guide uses the same validation shape: targeted QA, package loop, conditional proof,
  and broader-impact escalation. Package-specific domain and security rules remain local.
- Contracts no longer permit a partial test pass on testnet; every selector-required test must pass.
- `check-codex-docs.js` rejects near-verbatim policy blocks copied between root `AGENTS.md` and
  `CLAUDE.md`, while ignoring short shared labels and unrelated guidance.
- The architecture context link remains present in both agent entrypoints.

## TDD receipt

- RED: `node --test scripts/quality/check-codex-docs.test.mjs` failed because
  `findNearDuplicatePolicyBlocks` was not exported.
- GREEN: the same command passed three fixtures covering near-copy detection, short/unrelated prose,
  and one-report-per-block behavior.

## Deliberately retained boundaries

- Service ports and operational variants stay in `scripts/README.md` and builder docs rather than a
  second volatile inventory in root guidance.
- The Contracts guide remains longer because its deployment, upgrade, storage, and security rules
  are legitimate package-specific boundaries; only its development/validation contract was leveled.
- Phase 4 structure enforcement, the TypeScript build lane, client layout work, and final QA passes
  remain outside this Phase 3 slice.

## Validation receipt

- PASS: the exact-path Ship selector chose 26 mandatory checks for the guidance and package-guide
  scope; `node scripts/dev/ci-local.js --intent ship ...` passed format, lint, ABI, Shared, Client,
  Admin, Agent, Indexer, Contracts, Docs, agent-guidance, and supply-chain gates.
- PASS: `bun run test:review-guardrails`, including the three new duplicate-policy fixtures.
- PASS: `bun run test:validation-system` — 162 tests passed.
- PASS: `bun run drift:check -- --scope guidance` — no guidance drift findings.
- BLOCKED external evidence: the single `bun run eval:skills` run received incomplete,
  non-parseable JSON from the Claude/Haiku evaluator after its built-in retry. Deterministic trigger
  and behavior contracts remain green; the semantic run was not repeated to avoid extra model
  spend.
- Known non-blocking output: Foundry could not write its user cache inside the sandbox, and existing
  test/build warnings remained visible; all selected checks still exited successfully.
