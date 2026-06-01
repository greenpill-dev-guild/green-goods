# NYC Vault Crowdfunding Evaluation Plan

## Release Gates

1. Correctness: the June 1 shareable public demo link supports Wallet Endow and Thirdweb Card Endow
   for the two deployed NYC Ethereum Octant vaults; connected wallet/email-wallet users can see owned
   endowment positions and withdraw from `/fund`; Card Endow stays hidden until ownership plus
   withdrawal proof exists.
2. Usability: funders do not need the PWA to understand or use withdrawal; `/fund` copy clearly
   centers Wallet Endow and Manage Endowments, with Donate absent from this sprint surface.
3. Regression safety: wallet Donate/Endow and Treasury withdrawal behavior remain intact; card methods
   do not appear without provider proof and low-level Cookie Jar code remains preserved.
4. Card proof quality: Thirdweb Card Endow proves recovered-owner vault shares plus public
   withdrawal. Provider success alone is not enough, custody must not land in a provider-owned
   account, and any future Card Donate proof must not unlock Card Endow.
5. Privacy: receipt tokens, wallet addresses, emails, and provider identifiers are not placed in
   shareable management URLs or client-visible logs.
6. Evidence quality: research evidence and open assumptions are recorded before implementation.
7. Human judgment: protected surfaces and maintainer-call decisions are called out before merge.
8. Skill tracking quality: reusable vault crowdfunding UI skill work is visible in this hub and
   Linear, starts only after Green Goods demo validation, and does not expand the June 1 `/fund`
   sprint acceptance gates.
9. Plan metadata quality: `status.json` parses, the NYC vault crowdfunding `linear-sync --json` manifest
   returns zero warnings, and full `plan-hub validate` blockers are reported rather than hidden.

## Acceptance Checks

| ID | Behavior Boundary | Check | Owner | Evidence |
|---|---|---|---|---|
| AC-1 | `/fund` connected empty state | Connect an account with no indexed deposits; panel explains no endowments without exposing lookup or admin controls. | `ui` | |
| AC-2 | `/fund` active positions | Connect an account with one or more deposits; panel shows Garden, asset, endowed amount, shares, and withdrawable balance. | `ui` | |
| AC-3 | Public withdrawal | User enters amount, uses Max, confirms, sees transaction lifecycle, and successful withdrawal refreshes positions. | `ui` | |
| AC-4 | Public management deeplink | `/fund?manage=endowments` focuses or scrolls to the account panel, and Endow receipt/success CTAs use that route. | `ui` | |
| AC-5 | June 1 public demo link | The shareable `/fund` demo path presents the two deployed NYC Ethereum Octant vaults and supports Wallet Endow for both. | `ui`, `state_api` | |
| AC-6 | Thirdweb Card Endow demo | The same two vaults support Thirdweb Card Endow only after recovered-wallet receiver custody, share verification, visibility, and withdrawal proof pass. | `ui`, `state_api` | |
| AC-7 | Public data layer | Shared hook composes owner deposits, vault metadata, and public garden summaries for no-position, one-Garden, multi-Garden, and missing-metadata cases. | `state_api` | |
| AC-8 | Safe withdrawal limit | Available balance and Max use the same max-loss basis points as the withdraw mutation, not a more permissive preview. | `state_api` | |
| AC-9 | Funding lane matrix | `/fund` clearly separates Wallet Endow, Manage Endowments, deferred Donate/Card Donate, and Card Endow hidden-until-proof state. | `ui` | |
| AC-10 | Donate deferral | Public `/fund` shows Endow and Manage Endowments, not Donate; low-level Cookie Jar code remains available for future non-Cookie-Jar planning. | `ui` | |
| AC-11 | Provider proof scope | One proof entry only unlocks the exact intent, Garden destination, token, chain, and method it covers. | `state_api` | |
| AC-12 | Card Endow gate | Card Endow cannot become visible or create sessions unless the request carries an email-wallet `receiverAddress`, vault shares are verified for that receiver, and public withdrawal proof is recorded. | `state_api` | |
| AC-13 | Privacy | `/fund?manage=endowments` and receipt return paths do not leak receipt tokens, addresses, emails, or provider identifiers. | `ui`, `state_api` | |
| AC-14 | Contracts boundary | No Solidity, deployment, or indexer schema changes are made. | `contracts` | `n/a` |
| AC-15 | QA review | QA verifies desktop/mobile `/fund` withdrawal UX, receipt return path, lane availability, and Card Endow gating. | `qa_pass_1` | |
| AC-16 | Regression review | QA re-runs targeted validation and confirms no unrelated funding/PWA/admin work was pulled in. | `qa_pass_2` | |
| AC-17 | Skill tracking plan | `brief.md`, `spec.md`, `plan.todo.md`, and `status.json` capture reusable skill work as post-demo planning, with simplest output = existing Ethereum Octant vault frontend over standard RPC + wallet connection and advanced backend/API modules deferred. | `system` | |
| AC-18 | Skill Linear tracking | A Linear parent issue plus child issues track input schema, DesignMD/template fixture, vault runtime semantics, and provider/create-vault extension boundaries. | `system` | |
| AC-19 | Plan-hub validity | Skill issue links are recorded outside `linear.lanes`; `status.json` parses; NYC vault crowdfunding `linear-sync --json` returns zero warnings; full `plan-hub validate` passes or reports only known unrelated blockers. | `system` | |

## Test Strategy

- Unit: shared public endowment-position hook, existing-vault manifest/receiver typing chosen by
  implementation agents, safe max-loss preview parity, exact availability gating, Card Donate/Card
  Endow proof-key separation, required Card Endow receiver semantics, and Card Endow share
  verification.
- Integration: client `/fund` tests for the two-vault public demo path, account-gated panel, active
  positions, withdraw controls, Max, confirmation, failure, success refresh,
  `/fund?manage=endowments`, receipt return path, no Donate CTAs, and no admin controls.
- Agent: targeted Thirdweb Card Endow tests for exact provider proof gating, strict tuple
  verification, redacted logs, recovered-owner share verification, and rejection without
  `receiverAddress`.
- E2E / Playwright: desktop and mobile browser proof of the final public `/fund` demo once
  implementation exists.
- Manual checks: wallet connect/recover path, public copy clarity, Donate absent from `/fund`, Card
  Endow hidden state, docs truth, and privacy-safe receipt URLs.
- TDD proof: RED/GREEN commands and evidence are recorded in lane handoffs and summarized in `status.json`.
- Tracking checks: status JSON parse validation,
  `node scripts/harness/plan-hub.mjs linear-sync --feature nyc-vault-crowdfunding --json`
  with zero warnings, full `plan-hub validate` when unrelated hub drift permits it, and Linear
  read-back of the issue tree after updates.

## Check-In Gates

- After phase 2: confirm Wallet Endow works for both deployed NYC Ethereum Octant vaults before
  entering Card Endow implementation.
- After phase 3: confirm Thirdweb Card Endow path shape preserves recovered-wallet custody before
  treating Card Endow as exposure-ready.
- After phase 5: confirm `/fund?manage=endowments` proves visibility and withdrawal for wallet and
  card-funded endowment positions.
- After phase 6: confirm demo QA proof is acceptable before opening reusable skill planning.

## QA Sequence

### Claude QA Pass 1

- Focus on public `/fund` withdrawal UX, mobile layout, copy clarity, i18n, and missing requirement gaps
- Confirm `packages/client/DESIGN.browser.md` and funder-guide docs no longer claim `/fund` is
  support-only or PWA-only for withdrawal
- If blocked, record the blocker in `handoffs/claude-qa-pass-1.md`

### Codex QA Pass 2

- Start only after `qa_pass_1` is passed
- Confirm the trigger branch exists: `claude/qa-pass-1/nyc-vault-crowdfunding`
- Re-run targeted validation, inspect provider proof gates, and close the loop on remaining defects
- Inspect agent tests for exact provider-proof keys, Card Endow receiver/share verification, and
  redacted logging
