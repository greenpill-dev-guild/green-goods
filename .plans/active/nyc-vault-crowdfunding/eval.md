# NYC Vault Crowdfunding Evaluation Plan

## Release Gates

1. Correctness: the final public demo is a dedicated `/vaults` Octant V2 Ethereum crowdfunding route
   for Greenpill NYC and EVMavericks fixture slots, not a `/fund` Garden funding redesign.
2. Usability: users can browse campaigns, understand project/recipient/funding purpose, choose a
   vault and amount, and connect only at final confirmation.
3. Wallet proof: Wallet Endow deposits into selected deployed Octant V2 Ethereum vaults with
   complete manifest data and keeps ownership with the connected wallet.
4. Card proof: Thirdweb Card Endow is hidden until the checkout targets a user-owned recovered wallet,
   shares are visible for that user, the public manage/withdraw path is available, and webhook/provider
   verification proves the exact chain/token/amount/destination/transaction/intent tuple.
5. Fixture safety: Greenpill NYC remains the first available transaction fixture when manifest data
   is recorded; EVMavericks is visible but transaction-blocked until its required manifest lands.
6. Scope safety: Public Donate and Card Donate are absent from `/vaults` and remain deferred.
7. Route safety: `/fund` remains the existing Garden funding surface; only reusable Card Endow
   capability may be applied there later.
8. Infrastructure truth: route copy and architecture do not present Green Goods Arbitrum contracts as
   Octant V2 Ethereum infrastructure.
9. Privacy: receipt tokens, wallet addresses, emails, recovered-wallet IDs, and provider identifiers
   do not appear in shareable URLs or client-visible logs.
10. Skill delivery quality: reusable `octant-vault-crowdfunding` agent skill work starts after
    Green Goods demo validation and the project is not complete until the skill plus templates pass
    static and dry-run QA.
11. Plan metadata quality: `status.json` parses, `linear-sync --json` returns zero warnings, and full
    `plan-hub validate` blockers are reported rather than hidden.

## Acceptance Checks

| ID | Behavior Boundary | Check | Owner | Evidence |
|---|---|---|---|---|
| AC-1 | Dedicated route | `/vaults` renders Greenpill NYC and EVMavericks Octant vault crowdfunding fixture slots; `/fund` is not the primary demo route. | `ui` | |
| AC-2 | Browse without wallet | Campaign list/detail states are usable before any wallet prompt. | `ui` | |
| AC-3 | Campaign comprehension | Each campaign explains project, recipient/routing logic, funding purpose, chain/token/vault metadata, and safe onchain context. | `ui`, `state_api` | |
| AC-4 | Wallet-last flow | User chooses vault and amount before wallet connection; wallet prompt occurs at final confirmation. | `ui` | |
| AC-5 | Greenpill NYC fixture | Greenpill NYC is the first available transaction fixture when its deployed vault metadata is recorded. | `ui`, `state_api` | |
| AC-6 | EVMavericks fixture gate | EVMavericks appears in the manifest and UI but Wallet/Card Endow remain disabled until chain ID, vault address, asset address/symbol/decimals, recipient/routing summary, Protocol Guild destination context, explorer link, and campaign copy are recorded. | `ui`, `state_api` | |
| AC-7 | Wallet Endow | Connected wallet deposits into complete-manifest Octant V2 Ethereum vault targets and owns the resulting position. | `ui`, `state_api` | |
| AC-8 | Card Endow receiver | Thirdweb Card Endow requests require a user-owned recovered-wallet `receiverAddress`. | `state_api` | |
| AC-9 | Card Endow share proof | Vault shares are verified for the recovered wallet before Card Endow is visible or marked share-verified. | `state_api` | |
| AC-10 | Public manage/withdraw proof | The vault route provides a public path for users to see/manage owned positions without leaking private identifiers. | `ui`, `state_api` | |
| AC-11 | Provider proof scope | Provider/webhook proof is exact by intent, chain, token, amount, destination, transaction, and method. | `state_api` | |
| AC-12 | Deferred Donate lanes | Donate and Card Donate are absent and cannot unlock Card Endow proof. | `ui`, `state_api` | |
| AC-13 | `/fund` boundary | Existing Garden `/fund` UI is not redesigned; any touched Card Endow capability is reusable and separately tested. | `ui`, `state_api` | |
| AC-14 | Contracts boundary | No new Solidity, deployment broadcast, or indexer schema work is introduced. | `contracts` | `n/a` |
| AC-15 | Browser proof | Final `/vaults` route is browser-proofed on desktop and mobile. | `qa_pass_1`, `qa_pass_2` | |
| AC-16 | Linear/check-in proof | Linear comments and status JSON record phase gates after phases 2, 3, 5, and 6. | `system` | |
| AC-17 | Skill delivery lane | Codex-owned `skill` lane is present, depends on demo QA validation, and points at `handoffs/codex-skill.md` plus `codex/skill/octant-vault-crowdfunding`. | `skill` | |
| AC-18 | Skill artifact scope | Skill deliverable is an agent skill plus templates for `.claude/skills/octant-vault-crowdfunding/`, mirrored to `.agents/skills` after `skills:sync`, not a runnable generator or packaged app in v1. | `skill` | |
| AC-19 | Skill dry-run proof | Skill QA covers Greenpill NYC, EVMavericks `blocked_pending_manifest`, and one synthetic complete manifest fixture. | `skill` | |
| AC-20 | Advanced module coverage | Skill covers Thirdweb as first concrete card provider, Coinbase/Stripe as future adapter modules, optional Octant Ethereum factory/API create-vault module, and backend custody/secrets/webhook/logging concerns. | `skill` | |

## Test Strategy

- Unit/shared: campaign/vault manifest parsing, EVMavericks blocked-pending-manifest state,
  receiver typing, exact chain/vault/token tuple validation, Card Endow/Card Donate proof
  separation, required `receiverAddress`, and share verification status.
- Client integration: `/vaults` browse-without-wallet states, campaign detail, amount-first
  selection, wallet-last confirmation, Wallet Endow for complete-manifest fixtures, EVMavericks
  disabled transaction state until manifest completion, route-local receipt and management links,
  Card Endow hidden-until-proof, Donate/Card Donate absence.
- Agent/API: Thirdweb checkout creation with recovered-wallet receiver, webhook signature parsing,
  exact tuple verification, redacted logs, rejection without `receiverAddress`, rejection when
  provider success lacks onchain/share postconditions.
- `/fund` compatibility: only run targeted tests for Card Endow capability reuse if implementation
  touches shared code consumed by `/fund`; do not make `/fund` the primary browser proof route.
- E2E / Playwright: final public `/vaults` desktop and mobile proof once implementation exists.
- Skill lane: after the later artifact is authored, run `bun run skills:sync`, `bun run
  check:skills`, and a documented dry-run against Greenpill NYC, EVMavericks
  `blocked_pending_manifest`, and one synthetic complete manifest fixture.
- Tracking checks: status JSON parse, `linear-sync --feature nyc-vault-crowdfunding --json` with zero
  warnings, full `plan-hub validate` when unrelated drift permits, and Linear read-back/comments.

## Check-In Gates

- After phase 2: confirm `/vaults` route/manifest/browse scope includes Greenpill NYC and
  EVMavericks, with EVMavericks blocked pending manifest metadata rather than omitted.
- After phase 3: confirm Wallet Endow works for complete-manifest fixtures before Card Endow
  implementation proceeds.
- After phase 5: confirm Thirdweb Card Endow preserves user custody and passes receiver/share/public
  manage/provider proof before exposure.
- After phase 6: confirm demo QA proof is acceptable before Codex starts reusable skill delivery.
- After phase 8: confirm skill static checks, dry-run proof, and Linear closeout evidence are
  recorded.

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

### Codex Skill QA

- Start only after demo QA validation passes.
- Confirm the skill lane points to `codex/skill/octant-vault-crowdfunding` and
  `handoffs/codex-skill.md`.
- Verify the skill artifact plan targets `.claude/skills/octant-vault-crowdfunding/` and the Codex
  mirror through `.agents/skills` after `bun run skills:sync`.
- Dry-run the skill against Greenpill NYC, EVMavericks `blocked_pending_manifest`, and one synthetic
  complete manifest fixture.
- Confirm advanced module coverage: Thirdweb first, Coinbase/Stripe future adapters, optional Octant
  Ethereum factory/API create-vault module, secrets/provider/webhook/receipt/custody/logging
  boundaries.
