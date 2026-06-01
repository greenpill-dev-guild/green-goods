# NYC Vault Crowdfunding Evaluation Plan

## Release Gates

1. Correctness: the final public demo is a dedicated `/vaults` Octant V2 Ethereum crowdfunding route
   for the NYC vault campaigns, not a `/fund` Garden funding redesign.
2. Usability: users can browse campaigns, understand project/recipient/funding purpose, choose a
   vault and amount, and connect only at final confirmation.
3. Wallet proof: Wallet Endow deposits into the selected deployed Octant V2 Ethereum vault and keeps
   ownership with the connected wallet.
4. Card proof: Thirdweb Card Endow is hidden until the checkout targets a user-owned recovered wallet,
   shares are visible for that user, the public manage/withdraw path is available, and webhook/provider
   verification proves the exact chain/token/amount/destination/transaction/intent tuple.
5. Scope safety: Public Donate and Card Donate are absent from `/vaults` and remain deferred.
6. Route safety: `/fund` remains the existing Garden funding surface; only reusable Card Endow
   capability may be applied there later.
7. Infrastructure truth: route copy and architecture do not present Green Goods Arbitrum contracts as
   Octant V2 Ethereum infrastructure.
8. Privacy: receipt tokens, wallet addresses, emails, recovered-wallet IDs, and provider identifiers
   do not appear in shareable URLs or client-visible logs.
9. Skill tracking quality: reusable scaffold work starts after Green Goods demo validation and does
   not expand the `/vaults` demo acceptance gates.
10. Plan metadata quality: `status.json` parses, `linear-sync --json` returns zero warnings, and full
    `plan-hub validate` blockers are reported rather than hidden.

## Acceptance Checks

| ID | Behavior Boundary | Check | Owner | Evidence |
|---|---|---|---|---|
| AC-1 | Dedicated route | `/vaults` renders the NYC Octant vault crowdfunding experience; `/fund` is not the primary demo route. | `ui` | |
| AC-2 | Browse without wallet | Campaign list/detail states are usable before any wallet prompt. | `ui` | |
| AC-3 | Campaign comprehension | Each campaign explains project, recipient/routing logic, funding purpose, chain/token/vault metadata, and safe onchain context. | `ui`, `state_api` | |
| AC-4 | Wallet-last flow | User chooses vault and amount before wallet connection; wallet prompt occurs at final confirmation. | `ui` | |
| AC-5 | Wallet Endow | Connected wallet deposits into both NYC Octant V2 Ethereum vault targets and owns the resulting position. | `ui`, `state_api` | |
| AC-6 | Card Endow receiver | Thirdweb Card Endow requests require a user-owned recovered-wallet `receiverAddress`. | `state_api` | |
| AC-7 | Card Endow share proof | Vault shares are verified for the recovered wallet before Card Endow is visible or marked share-verified. | `state_api` | |
| AC-8 | Public manage/withdraw proof | The vault route provides a public path for users to see/manage owned positions without leaking private identifiers. | `ui`, `state_api` | |
| AC-9 | Provider proof scope | Provider/webhook proof is exact by intent, chain, token, amount, destination, transaction, and method. | `state_api` | |
| AC-10 | Deferred Donate lanes | Donate and Card Donate are absent and cannot unlock Card Endow proof. | `ui`, `state_api` | |
| AC-11 | `/fund` boundary | Existing Garden `/fund` UI is not redesigned; any touched Card Endow capability is reusable and separately tested. | `ui`, `state_api` | |
| AC-12 | Contracts boundary | No new Solidity, deployment broadcast, or indexer schema work is introduced. | `contracts` | `n/a` |
| AC-13 | Browser proof | Final `/vaults` route is browser-proofed on desktop and mobile. | `qa_pass_1`, `qa_pass_2` | |
| AC-14 | Linear/check-in proof | Linear comments and status JSON record phase gates after phases 2, 3, 5, and 6. | `system` | |
| AC-15 | Skill handoff | Reusable skill plan remains post-demo and starts with frontend UI for existing Ethereum Octant vaults. | `system` | |

## Test Strategy

- Unit/shared: campaign/vault manifest parsing, receiver typing, exact chain/vault/token tuple
  validation, Card Endow/Card Donate proof separation, required `receiverAddress`, and share
  verification status.
- Client integration: `/vaults` browse-without-wallet states, campaign detail, amount-first
  selection, wallet-last confirmation, Wallet Endow for both NYC vault fixtures, route-local receipt
  and management links, Card Endow hidden-until-proof, Donate/Card Donate absence.
- Agent/API: Thirdweb checkout creation with recovered-wallet receiver, webhook signature parsing,
  exact tuple verification, redacted logs, rejection without `receiverAddress`, rejection when
  provider success lacks onchain/share postconditions.
- `/fund` compatibility: only run targeted tests for Card Endow capability reuse if implementation
  touches shared code consumed by `/fund`; do not make `/fund` the primary browser proof route.
- E2E / Playwright: final public `/vaults` desktop and mobile proof once implementation exists.
- Tracking checks: status JSON parse, `linear-sync --feature nyc-vault-crowdfunding --json` with zero
  warnings, full `plan-hub validate` when unrelated drift permits, and Linear read-back/comments.

## Check-In Gates

- After phase 2: confirm `/vaults` route/manifest/browse scope is correct before transaction work.
- After phase 3: confirm Wallet Endow works for both NYC Octant V2 Ethereum vaults before Card Endow
  implementation proceeds.
- After phase 5: confirm Thirdweb Card Endow preserves user custody and passes receiver/share/public
  manage/provider proof before exposure.
- After phase 6: confirm demo QA proof is acceptable before reusable skill planning starts.

## QA Sequence

### Claude QA Pass 1

- Focus on visible `/vaults` UX, campaign comprehension, wallet-last sequence, mobile layout, copy,
  i18n, and missing requirement gaps.
- Confirm `/fund` was not used as the primary route and Donate/Card Donate are absent.
- If blocked, record the blocker in `handoffs/claude-qa-pass-1.md`.

### Codex QA Pass 2

- Start only after `qa_pass_1` is passed.
- Confirm the trigger branch exists: `claude/qa-pass-1/nyc-vault-crowdfunding`.
- Re-run targeted shared/client/agent validation selected by implementation agents.
- Inspect Thirdweb provider proof, recovered-wallet receiver semantics, share verification, route
  privacy, and final `/vaults` browser proof.
