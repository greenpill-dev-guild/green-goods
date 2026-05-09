# Public Endowment Withdrawal Recovery Evaluation Plan

## Release Gates

1. Correctness: connected wallet/email-wallet users can see owned endowment positions and withdraw
   from `/fund`; Card Endow stays hidden until ownership plus withdrawal proof exists.
2. Usability: funders do not need the PWA to understand or use withdrawal; copy clearly distinguishes
   Donate, Endow, and Manage Endowments.
3. Regression safety: wallet Donate/Endow and Treasury withdrawal behavior remain intact; card methods
   do not appear without provider proof.
4. Evidence quality: research evidence and open assumptions are recorded before implementation.
5. Human judgment: protected surfaces and maintainer-call decisions are called out before merge.

## Acceptance Checks

| ID | Behavior Boundary | Check | Owner | Evidence |
|---|---|---|---|---|
| AC-1 | `/fund` connected empty state | Connect an account with no indexed deposits; panel explains no endowments without exposing lookup or admin controls. | `ui` | |
| AC-2 | `/fund` active positions | Connect an account with one or more deposits; panel shows Garden, asset, endowed amount, shares, and withdrawable balance. | `ui` | |
| AC-3 | Public withdrawal | User enters amount, uses Max, confirms, sees transaction lifecycle, and successful withdrawal refreshes positions. | `ui` | |
| AC-4 | Public data layer | Shared hook composes owner deposits, vault metadata, and public garden summaries for no-position, one-Garden, multi-Garden, and missing-metadata cases. | `state_api` | |
| AC-5 | Card Donate proof | Agent has real checkout dependency wiring, current webhook parsing, provider proof gating, and strict onchain tuple verification tests. | `state_api` | |
| AC-6 | Card Endow gate | Card Endow cannot become visible or create sessions unless email-wallet owner and public withdrawal proof are recorded. | `state_api` | |
| AC-7 | Contracts boundary | No Solidity, deployment, or indexer schema changes are made. | `contracts` | `n/a` |
| AC-8 | QA review | QA verifies desktop/mobile `/fund` withdrawal UX, receipt return path, and Card Endow gating. | `qa_pass_1` | |
| AC-9 | Regression review | QA re-runs targeted validation and confirms no unrelated funding/PWA/admin work was pulled in. | `qa_pass_2` | |

## Test Strategy

- Unit: shared public endowment-position hook; agent checkout/webhook proof parsing and gating.
- Integration: client `/fund` tests for account-gated panel, active positions, withdraw controls, Max,
  confirmation, failure, success refresh, receipt return path, and no admin controls.
- E2E / Playwright: desktop and mobile smoke of `/fund` management once implementation exists.
- Manual checks: wallet connect/recover path, public copy clarity, Card Endow hidden state, docs truth.
- TDD proof: RED/GREEN commands and evidence are recorded in lane handoffs and summarized in `status.json`.

## QA Sequence

### Claude QA Pass 1

- Focus on public `/fund` withdrawal UX, mobile layout, copy clarity, i18n, and missing requirement gaps
- If blocked, record the blocker in `handoffs/claude-qa-pass-1.md`

### Codex QA Pass 2

- Start only after `qa_pass_1` is passed
- Confirm the trigger branch exists: `claude/qa-pass-1/public-endowment-withdrawal-recovery`
- Re-run targeted validation, inspect provider proof gates, and close the loop on remaining defects
