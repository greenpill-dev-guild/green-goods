# Harvest Distribution Completion Evaluation Plan

## Release Gates

1. Correctness: split is sent only after confirmed harvest or from an already-ready state.
2. Usability: the operator sees destination, estimate, stage, partial recovery, and final outcome.
3. Regression safety: deposit, withdraw, pause, lower-level harvest, and lower-level split remain intact.
4. Evidence quality: research evidence and open assumptions are recorded before implementation.
5. Human judgment: protected surfaces and maintainer-call decisions are called out before merge.

## Acceptance Checks

| ID | Behavior Boundary | Check | Owner | Evidence |
|---|---|---|---|---|
| AC-1 | Yield status | Shares plus pending use the effective asset threshold and resolved route | `state_api` | Focused hook test |
| AC-2 | Transaction sequence | Harvest failure blocks split; confirmed harvest may split; Safe submit stops | `state_api` | Focused mutation test |
| AC-3 | Partial recovery | Split failure preserves harvested state and retry sends split only | `state_api` | Focused mutation test |
| AC-4 | Operator workflow | State labels, confirmation, loading, error, retry, and permissions are accessible | `ui` | Component tests + Storybook |
| AC-5 | Full completion | Confirmed event amounts appear and relevant balances refresh | `ui` | Authenticated Brave proof |
| AC-6 | Scope | No contract, client, indexer, preset, treasury, deploy, or production write change | `qa_pass_2` | Diff review |

## Test Strategy

- Unit: direct-tested shared status and mutation hooks with financial state matrix coverage.
- Integration: PositionCard tests cover action selection, confirmation, partial retry, and outcome copy.
- E2E / Playwright: not used for authenticated local QA; existing CI clean-room coverage remains unchanged.
- Manual checks: authenticated Brave against a local fork/test garden for ready, waiting, partial, and complete states.
- TDD proof: RED/GREEN commands and evidence are recorded in lane handoffs and summarized in `status.json`.

## QA Sequence

### Claude QA Pass 1

- Focus on UX issues, missing requirements, and test gaps
- If blocked, record the blocker in `handoffs/claude-qa-pass-1.md`

### Codex QA Pass 2

- Start only after `qa_pass_1` is passed
- Re-run targeted validation and close the loop on remaining defects
