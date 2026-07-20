# Commitment Pooling - Codex QA Pass 2 Handoff

## Status

- Machine lane: qa_pass_2
- Owner: Codex
- Branch signal: codex/qa-pass-2/commitment-pooling
- Branch trigger: claude/qa-pass-1/commitment-pooling
- Current state: blocked on qa_pass_1
- Linear context: PRD-730 (QA pass 2 lane) under parent PRD-650. Register #37 reversed the earlier no-QA-child rule.

## Inputs

- QA Pass 1 evidence and defect disposition
- Final contracts/indexer/shared/UI/docs handoffs
- Updated status.json and plan-hub proof
- Authenticated Brave/real-device evidence references

## Outputs

- Regression review of contracts -> indexer -> shared -> app boundaries.
- Re-run evidence for corrected defects and unchanged guardrails.
- Status/handoff/dispatch consistency report and final remaining-blocker list.
- Repo Quick Gate only after targeted lane proofs are green.

## Acceptance

- Exact ABI/event/config signatures match across specs, generated types, handlers, and shared types.
- Composite Garden IDs, nullable actors, claim supersession, oracle request/callback states, and member-delivery gating retain coverage.
- QA Pass 1 defects are fixed and re-proven or explicitly accepted by the user.
- Parent-only mode remains intact; blocked/follow-on lanes cannot dispatch.
- Browser evidence remains authenticated Brave and real device where required.
- No result collapses visible defects or external blockers into a pass.

## RED / GREEN or proof limit

- RED: a fixed QA1 defect still reproduces, any boundary/signature/dispatch invariant differs, or an exact regression command fails.
- GREEN: every accepted QA1 fix is re-proven, all exact commands pass, and status/dispatch/lane-issue evidence agrees with the final artifacts.
- Proof limit: QA Pass 2 introduces no behavior. If an external path cannot be rerun, preserve the earlier evidence and record staleness; do not substitute isolated browser or test-only proof or call the path GREEN.

## Exact Bun commands

- bun run --filter @green-goods/contracts test
- bun run --filter @green-goods/indexer test
- bun run --filter @green-goods/shared typecheck
- bun run --filter @green-goods/client test
- bun run --filter @green-goods/admin test
- bun run docs:audit
- bun run build:docs
- bun run lint:vocab
- node scripts/dev/ci-local.js --quick
- node scripts/harness/plan-hub.mjs validate
- node scripts/harness/plan-hub.mjs list --agent codex --lane qa_pass_2 --stage active --json

## Out of scope

- New features, scope expansion, contract broadcasts, defect fixes inside the QA lane, isolated browser proof labeled authenticated, manual receipt verification, garden-held member claims, or branch ship/merge claims without the explicit Ship Gate.

## Unblock evidence

- qa_pass_1 is GREEN with defects dispositioned.
- All retested lane commands pass.
- Authenticated Brave/real-device evidence is current or its proof limit is explicit.
- Plan-hub validation and dispatch listing agree with status.json before QA Pass 2 can turn GREEN.
