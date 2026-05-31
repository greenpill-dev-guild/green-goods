# Public Endowment Withdrawal Recovery Evaluation Plan

## Release Gates

1. Correctness: connected wallet/email-wallet users can see owned endowment positions and withdraw
   from `/fund`; Card Endow stays hidden until ownership plus withdrawal proof exists.
2. Usability: funders do not need the PWA to understand or use withdrawal; `/fund` copy clearly
   centers Wallet Endow and Manage Endowments, with Donate absent from this sprint surface.
3. Regression safety: wallet Donate/Endow and Treasury withdrawal behavior remain intact; card methods
   do not appear without provider proof and low-level Cookie Jar code remains preserved.
4. Card proof quality: Card Endow proves recovered-owner vault shares plus public withdrawal. Provider
   success alone is not enough, and any future Card Donate proof must not unlock Card Endow.
5. Privacy: receipt tokens, wallet addresses, emails, and provider identifiers are not placed in
   shareable management URLs or client-visible logs.
6. Evidence quality: research evidence and open assumptions are recorded before implementation.
7. Human judgment: protected surfaces and maintainer-call decisions are called out before merge.
8. Skill tracking quality: reusable vault crowdfunding UI skill work is visible in this hub and
   Linear, but does not expand the June 1 `/fund` sprint acceptance gates.

## Acceptance Checks

| ID | Behavior Boundary | Check | Owner | Evidence |
|---|---|---|---|---|
| AC-1 | `/fund` connected empty state | Connect an account with no indexed deposits; panel explains no endowments without exposing lookup or admin controls. | `ui` | |
| AC-2 | `/fund` active positions | Connect an account with one or more deposits; panel shows Garden, asset, endowed amount, shares, and withdrawable balance. | `ui` | |
| AC-3 | Public withdrawal | User enters amount, uses Max, confirms, sees transaction lifecycle, and successful withdrawal refreshes positions. | `ui` | |
| AC-4 | Public management deeplink | `/fund?manage=endowments` focuses or scrolls to the account panel, and Endow receipt/success CTAs use that route. | `ui` | |
| AC-5 | Public data layer | Shared hook composes owner deposits, vault metadata, and public garden summaries for no-position, one-Garden, multi-Garden, and missing-metadata cases. | `state_api` | |
| AC-6 | Safe withdrawal limit | Available balance and Max use the same max-loss basis points as the withdraw mutation, not a more permissive preview. | `state_api` | |
| AC-7 | Funding lane matrix | `/fund` clearly separates Wallet Endow, Manage Endowments, deferred Donate, and Card Endow hidden state. | `ui` | |
| AC-8 | Donate deferral | Public `/fund` shows Endow and Manage Endowments, not Donate; low-level Cookie Jar code remains available for future non-Cookie-Jar planning. | `ui` | |
| AC-9 | Provider proof scope | One proof entry only unlocks the exact intent, Garden destination, token, chain, and method it covers. | `state_api` | |
| AC-10 | Card Endow gate | Card Endow cannot become visible or create sessions unless the request carries an email-wallet `receiverAddress`, vault shares are verified for that receiver, and public withdrawal proof is recorded. | `state_api` | |
| AC-11 | Privacy | `/fund?manage=endowments` and receipt return paths do not leak receipt tokens, addresses, emails, or provider identifiers. | `ui`, `state_api` | |
| AC-12 | Contracts boundary | No Solidity, deployment, or indexer schema changes are made. | `contracts` | `n/a` |
| AC-13 | QA review | QA verifies desktop/mobile `/fund` withdrawal UX, receipt return path, lane availability, and Card Endow gating. | `qa_pass_1` | |
| AC-14 | Regression review | QA re-runs targeted validation and confirms no unrelated funding/PWA/admin work was pulled in. | `qa_pass_2` | |
| AC-15 | Skill tracking plan | `brief.md`, `spec.md`, `plan.todo.md`, and `status.json` capture the reusable skill goal, required inputs, output boundaries, and non-sprint scope. | `system` | |
| AC-16 | Skill Linear tracking | A Linear parent issue plus child issues track input schema, DesignMD/template fixture, vault runtime semantics, and provider/create-vault extension boundaries. | `system` | |
| AC-17 | Plan-hub validity | Skill issue links are recorded outside `linear.lanes`, and `node scripts/harness/plan-hub.mjs validate` passes. | `system` | |

## Test Strategy

- Unit: shared public endowment-position hook, safe max-loss preview parity, exact availability
  gating, Card Donate/Card Endow proof-key separation, required Card Endow receiver semantics, and
  Card Endow share verification.
- Integration: client `/fund` tests for account-gated panel, active positions, withdraw controls, Max,
  confirmation, failure, success refresh, `/fund?manage=endowments`, receipt return path, no Donate
  CTAs, and no admin controls.
- E2E / Playwright: desktop and mobile smoke of `/fund` management once implementation exists.
- Manual checks: wallet connect/recover path, public copy clarity, Donate absent from `/fund`, Card
  Endow hidden state, docs truth, and privacy-safe receipt URLs.
- TDD proof: RED/GREEN commands and evidence are recorded in lane handoffs and summarized in `status.json`.
- Tracking checks: plan-hub validation, JSON parse validation, and Linear read-back of the skill
  parent/child issue tree after issue creation.

## QA Sequence

### Claude QA Pass 1

- Focus on public `/fund` withdrawal UX, mobile layout, copy clarity, i18n, and missing requirement gaps
- Confirm `packages/client/DESIGN.browser.md` and funder-guide docs no longer claim `/fund` is
  support-only or PWA-only for withdrawal
- If blocked, record the blocker in `handoffs/claude-qa-pass-1.md`

### Codex QA Pass 2

- Start only after `qa_pass_1` is passed
- Confirm the trigger branch exists: `claude/qa-pass-1/public-endowment-withdrawal-recovery`
- Re-run targeted validation, inspect provider proof gates, and close the loop on remaining defects
- Inspect agent tests for exact provider-proof keys, Card Endow receiver/share verification, and
  redacted logging
