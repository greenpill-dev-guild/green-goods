# Gardener Celo wallets

Status: source implementation and automated release checks complete. Authenticated browser and
production evidence are blocked.
The approved scope is [Enable Gardener Celo Wallets](../gardener-celo-wallets.md).
This reopens `state_api`, `ui_client`, and `release_ops`; it does not reopen the accepted Garden
Safe/CCIP canary or authorize a production transaction.

## Implementation

The auth session owns a revocable resolver keyed by chain. It reuses the credential, requires the
primary address on Celo, discards failed builds for explicit retry, and binds Kernel 0.3.1 and
EntryPoint 0.7 to a dedicated Celo sponsorship policy. Passkey initialization cannot fall back to
an external wallet. Calls without an explicit chain keep their primary client.

The Tokens tab adds Celo balance, receive context, and contributor payout receipts. Receipt status
comes from the existing indexed settlement entities; only confirmed Arbitrum state means arrived.
Missing commitment metadata keeps the receipt with its commitment number. Balance, receipt, and
policy failures remain separate. Cached reads remain visible offline, while sends are online only.

The existing ERC-20 mutation now routes by the token's chain. G$ review shows the live token fee,
total sender debit or recipient net amount, separately from the network fee. Review and submission
both re-quote; a changed fee requires another review. Celo sends require a successful receipt before
balance invalidation. There is no automatic transfer retry or offline transfer queue.

Send preflight and the wallet adapters bind the quoted account through chain switching. A changed
account blocks submission. Cancelled or materially replaced transactions fail; a repriced transfer
uses the included transaction hash. Fee review and confirmation preserve exact base-unit precision.

The runtime gate reads chain 42161, role SOURCE. Missing, false, failed, or stale cached gate reads
block new app sends. GraphQL currently exposes no chain-head lag measurement, so the app cannot
prove indexer synchronization from a successful query alone. Configuration `updatedAt` is the last
configuration event, not a health timestamp; operational indexer monitoring remains required.

## State and invariant proof

| Boundary | Required result |
|---|---|
| Credential reused on Arbitrum/Celo | Same Kernel factory and initialization inputs, pinned version/EntryPoint; runtime address equality |
| Missing resolver/policy, wrong chain/address, revoked session | Reject before submission |
| Resolver build temporarily fails | Evict failure; explicit retry can rebuild |
| Wallet/embedded send to Celo | Switch chain, user pays network fee, rejection retains draft |
| Gate null/false/error/stale | Block sends; preserve history |
| Celo RPC or metadata fails | Unavailable balance or neutral receipt title; no invented zero |
| Sender-paid / receiver-paid G$ fee | Gross balance check / recipient net amount; invalid quote blocks |
| Quote changes during review | Remain in review; require confirmation of updated terms |
| Offline, cancellation, signing failure | No queued transaction; retain recipient and amount |
| Destination execution without source confirmation | Support on its way; never arrived |
| Authenticated source failure/confirmation | Rearranging support / arrived respectively |

## Hosted policy and production runbook

Nothing in this section has been executed. Each production broadcast, value movement, policy
activation, and delivery-toggle change requires fresh human authorization.

Set `VITE_PIMLICO_CELO_SPONSORSHIP_POLICY_ID` in the root deployment environment. A blank value
blocks Celo passkey sends; it cannot inherit the Arbitrum/default policy. `.env.schema` documents
the name without containing a policy credential or API key.

Configure the hosted Celo policy for chain 42220, native value zero, the canonical token from
`packages/shared/src/config/tokens.ts`, and only `transfer(address,uint256)` (`0xa9059cbb`). The
hosted validator must decode the Kernel execution call and apply these restrictions to the inner
call; checking only the Kernel target is insufficient. Deny arbitrary calls and batches. Test a
wrong chain, target, selector, and nonzero value as negative cases.

Launch limits are five sponsored sends per account per day, 200 globally per day, and an operation
cost cap equal to three times the measured canary cost. Before the canary use a one-operation
policy with a ceiling bounded by the estimated UserOperation cost. The measured value and hosted
policy field units must be recorded before setting the launch cap; no guessed cap is supplied.
[Pimlico's policy documentation](https://docs.pimlico.io/guides/how-to/sponsorship-policies)
describes hosted global, per-user, and per-operation limits.

Restrict the browser API key to the approved deployed Green Goods origins and the exact required
bundler/paymaster methods. Inventory the actual requests from the shipping build before setting
that allowlist, including first-use estimation and receipt reads. Do not add wildcard origins,
policy-management methods, secrets, or passkey material to the browser or this evidence record.
No hosted key or policy configuration has been inspected or changed in this task.

1. Deploy the validated app with the source delivery flag false.
2. Have the human create a dedicated non-personal production-RP canary passkey. Verify the RP is
   `greengoods.app`, subject to the deployment's approved RP configuration.
3. Derive Arbitrum and Celo addresses with the shipping adapter. Require equality; record pinned
   EntryPoint, Kernel factory, validator, implementation, and deployed code hashes. Local tests
   prove identical construction inputs using the installed SDK; they do not prove deployed code.
4. After authorization, bind the one-operation canary policy and fund the Celo address with the
   transfer amount plus any sender-paid G$ fee. Read `getFees(amount,sender,recipient)` immediately
   before the operation; the [GoodDollar transfer implementation](https://github.com/GoodDollar/GoodProtocol/blob/master/contracts/token/superfluid/SuperGoodDollar.sol)
   delegates fees to a changeable formula.
5. Submit one sponsored first-use transfer through the shipping app. Record UserOperation and
   transaction receipts, EntryPoint event, deployment code, quoted token fee, exact balance deltas,
   block, and UTC time. Store only the dedicated canary's public transaction evidence, never
   passkey material, API keys, personal identities, wallet/session identifiers from real users.
6. After authorization, apply the launch policy limits from the measured cost.
7. After separate fresh authorization, call `setGardenerDeliveryEnabled(true)` through the owning
   release path. Wait for the indexed SOURCE configuration to read true and W23 to unblock.
8. After authorization, make one minimum-value contributor payout to the dedicated canary account
   and verify its receipt reaches arrived only after Arbitrum confirmation.

Monitor aggregate policy denials, identity/chain mismatches, failed inclusion, indexer lag, and
Celo read failures without user addresses or session identifiers. Roll back by setting the delivery
flag false after authorization; pause source/executor separately if queued movement must also stop.
Historical receipts remain visible, and no completed transfer is reversed.

## Validation receipt

Tested commit: `ea193295f9ce1f6ebac415481c320c5d7a61baae` on `develop`, containing implementation
commit `b2ab43024` and its UI-test fixture correction. The tree was clean after the run completed at
2026-09-05 22:32:48 UTC. No passing-receipt cache was used.

```sh
bun run validation:plan -- --intent release --base 7d60a27d4640fc00a78eaae8c2fafd613030f420 --head ea193295f9ce1f6ebac415481c320c5d7a61baae --capability authenticatedBrave=false --check storybook-build --json
node scripts/dev/ci-local.js --intent release --base 7d60a27d4640fc00a78eaae8c2fafd613030f420 --head ea193295f9ce1f6ebac415481c320c5d7a61baae --capability authenticatedBrave=false --check storybook-build --no-fail-fast
bun run agentic:check
```

All 35 automated checks passed. The release runner exited 2 solely because authenticated Brave
proof is unavailable. Shared passed 4,657 tests (18 existing skips); Client 1,068; Admin 847;
Agent 311 unit/API tests plus nine SQLite tests (one existing skip); Indexer 320 (one pending);
Contracts 2,083 Solidity tests plus 295 script tests. The contract verifier, all selected typechecks
and builds, Storybook, design/vocabulary, ontology, source-structure, validation-system, and Plan Hub
guards passed. `agentic:check` passed independently.

The [machine-readable receipt](../evidence/gardener-celo-wallet-validation-2026-09-05.json) records
each check, its selection reason, duration, command, and validated paths. Localhost fixtures needed
an approved sandbox escalation; no production transaction was involved. Earlier failed or
superseded runs are not counted as passing evidence.

Development TDD on September 5, 2026:

- Send mutation: nine new failures and five existing passes before implementation; controller:
  five failures before fee review existed. Together their focused final run passed 23 tests.
- Auth routing: seven initial failures; the full auth regression selection passed 192 tests with
  five pre-existing conformance skips. The actual installed SDK construction/resolver subset passed
  23 tests. Its RPC is mocked, so deployed code equality remains a production canary requirement.
- Account binding and replacement: new failures reproduced the wrong-account and cancelled
  transaction cases. The transaction-module selection then passed 105 tests with five existing skips.
- Receipt acknowledgment: one new failure reproduced a sent acknowledgment reverting the status to
  dispatched. The history selection then passed 13 tests; only source confirmation means arrived.
- WalletDrawer: nine new failures and 14 existing passes before the Celo UI existed. The final
  SendTab, CeloWalletCard, and WalletDrawer selection passed 53 tests, including the real Radix
  dialog's focus restoration and a 0.00001 G$ fee that must not round away.

The full regression pass also exposed obsolete passkey-fallback expectations and a locale guard
that treated the proper names in “G$ · Celo” as untranslated prose. Updated direct-consumer tests
pass 13 cases; the locale suite passes 13 with a key-scoped proper-name exception. Five admin
test/story auth fixtures now explicitly supply a null resolver for wallet/unauthenticated sessions.
The existing auth and Work-command seam fingerprints were refreshed for the changed auth
composition and sender conformance proof; the registry gained no entries or exceptions. The auth
machine's redundant state/event inventory comment was shortened to retain its frozen size ceiling.
The two new client tests use explicit fixtures so they satisfy the repository's isolated-import
contract; all 196 validation-system tests pass.

Review covered auth/session routing, send mutation/controller, gate/history composition, and the
WalletDrawer consumers. Two safety facts have executed local proof: explicit Celo calls cannot use
the primary-chain client or another account; destination execution cannot make a receipt arrived.
Neither fact is claimed as live-observed. Hosted policy enforcement and authenticated browser
behavior remain release evidence.

Authenticated Brave proof is BLOCKED: `cua.getState()` exposed only the in-app browser, and the
explicit browser-extension tab probe returned `Browser is not available: chrome`. Native computer
control is disabled. No isolated browser was used as substitute evidence. The policy setup,
production Kernel canary, app deployment, delivery toggle, and contributor payout remain unrun.
