# Enable Gardener Celo Wallets

## Summary

Enable the existing W23 design: every authenticated user can view and receive Celo G$, see contributor payout receipts, and send G$ from the current WalletDrawer. Passkey users reuse their existing credential and same smart-account address with sponsored gas; connected and embedded wallets switch to Celo and pay their own network fee.

The completed Garden Safe/CCIP canary remains accepted. A separate Kernel passkey/G$ canary is still required before the final on-chain activation.

No contract deployment or indexer schema change is expected. Reopen the existing commitment-pooling `state_api`, `ui_client`, and `release_ops` lanes rather than creating a new Plan Hub.

## Implementation Changes

### 1. Make passkey transaction routing chain-aware

- Add a session-scoped `SmartAccountClientResolver(chainId)` capability to shared auth. Seed it with the existing primary client and lazily build/cache other clients from the same credential.
- When resolving Celo `42220`, use Kernel `0.3.1`, EntryPoint `0.7`, and the dedicated Celo sponsorship policy. Require the derived address to equal the stored Arbitrum smart-account address; fail closed on any mismatch.
- Remove a failed client promise from the cache so temporary RPC or Pimlico failures can be retried. Replace the resolver whenever the credential changes and discard it on sign-out.
- Make `ContractCall.chainId` authoritative in `PasskeySender`. Resolve the matching client, verify its chain and account, and never silently submit through the primary client.
- Remove the current passkey-to-wallet fallback when the smart-account client is unavailable; a passkey session must never send from a different identity.
- Preserve current behavior for calls without `chainId`: they continue using the primary Arbitrum client.

### 2. Establish one runtime gate and Celo policy

- Simplify `isGardenerDeliveryEnabled` to require matching production profiles and indexed `gardenerDeliveryEnabled === true`; remove the unowned `mainnetEvidenceReady` application boolean.
- Treat the production canary record as a release prerequisite, while the indexed on-chain flag is the sole runtime source of truth.
- Read the source configuration explicitly from Arbitrum `42161`, role `SOURCE`; `null`, stale, missing, or false remains blocked.
- Add chain-specific Pimlico configuration for Celo. The Celo policy ID must be explicit and must not fall back to the Arbitrum/default policy.
- Configure the policy for chain `42220`, zero native value, canonical G$ only, and `transfer(address,uint256)` only. Set launch limits to 5 sponsored sends per account per day, 200 globally per day, and a per-operation cost cap of three times the measured canary cost. Pimlico supports global, per-user, and per-operation limits through hosted policies. [Pimlico sponsorship policies](https://docs.pimlico.io/guides/how-to/sponsorship-policies)
- Restrict the browser API key to approved Green Goods origins and required bundler/paymaster methods. Keep keys, passkey material, and policy credentials out of source and evidence artifacts.

### 3. Add the Celo wallet read model

- Add `chainId` to `SendableToken`; primary-chain tokens retain their current chain, while G$ is explicitly `42220`.
- Add a shared Celo wallet hook that composes:
  - indexed delivery-gate state;
  - the canonical G$ balance read from Celo;
  - passkey Celo-client readiness and same-address validation;
  - contributor payout history for the current primary address.
- Query existing `ContributorPayout`, payout-plan, commitment, disbursement, and execution entities by contributor. Derive the existing queued, dispatched, delayed, execution/acknowledgment-pending, confirmed, failed, and cancelled states without indexing raw G$ transfers.
- Reuse the existing settlement-state derivation. “Arrived” is shown only after authenticated Arbitrum confirmation; earlier states remain “support on its way,” and authenticated failures remain “support is being rearranged.”
- Add chain-scoped query keys and invalidate the Celo G$ balance after a confirmed send. A balance-read failure must show unavailable, never a fake zero; a metadata failure must retain the receipt with a neutral commitment-ID fallback.

### 4. Use the existing send flow for Celo G$

- Generalize `useSendToken` to use `token.chainId` for its balance check, sender call, receipt handling, and invalidation.
- Retire the unused `useSettlementWalletTransfer` hook and export so there is only one ERC-20 send path.
- Before a G$ review or submission, call `getFees(amount,sender,recipient)`:
  - sender-paid fee: show transfer amount, token fee, and total debit; require sufficient balance for both;
  - receiver-paid fee: show the recipient’s net amount;
  - failed or invalid quote: block submission with retry;
  - hide “Max” when a non-zero sender-paid fee prevents an exact safe maximum.
- Keep gas sponsorship and the G$ token fee distinct. Passkey copy says Green Goods covers the network fee; connected/embedded wallet copy says the wallet will switch to Celo and the user pays the Celo network fee.
- Preserve the online-only behavior. Cancellation, wallet rejection, chain-switch rejection, policy denial, and failed inclusion retain recipient and amount for an explicit retry.
- GoodDollar fee behavior is dynamic and must be quoted rather than assumed. [Official G$ transfer implementation](https://github.com/GoodDollar/GoodProtocol/blob/master/contracts/token/superfluid/SuperGoodDollar.sol)

### 5. Implement the full W23 WalletDrawer state

- Add the Celo G$ card to the existing Tokens tab, not a new route or tab.
- Show balance, “G$ · Celo,” recent contributor receipts, and the existing receive address/QR with explicit Celo context.
- Enable Send for:
  - passkey users through the sponsored Celo smart-account client;
  - connected and embedded wallets through the existing chain guard and user-paid Celo transaction path.
- Render loading, partial read error, offline/cached, policy unavailable, address mismatch, send pending, send failed, and delivery-blocked states.
- Use native controls, associated labels, polite status announcements, restored focus after dialogs, visible focus, and text/icon status cues. Add all copy to English, Spanish, and Portuguese.

## Public Interfaces

- Add `SmartAccountClientResolver = (chainId: number) => Promise<SmartAccountClient>` to shared auth state and `useUser`.
- Add `resolveSmartAccountClient` to transaction-sender construction.
- Keep `TransactionSender` structurally compatible, but make `ContractCall.chainId` an enforced routing contract.
- Add required `chainId` to `SendableToken` and `SendableTokenBalance`.
- Remove `mainnetEvidenceReady` from the delivery-gate and settlement-wallet interfaces.
- Add `GardenerSettlementReceipt` and a chain/account-scoped settlement-history query.
- Remove the unused `useSettlementWalletTransfer` public export.

## Test and Release Plan

### Automated proof

- RED/GREEN tests must cover:
  - same credential derives the same Arbitrum/Celo address;
  - requested Celo calls use the Celo client;
  - mismatched address, chain, missing policy, or missing resolver fails before submission;
  - transient resolver failures can retry;
  - no-chain calls remain on Arbitrum;
  - passkey initialization never falls back to an external wallet;
  - wallet/embedded calls switch to Celo and remain unsponsored;
  - delivery `null`/false blocks W23 and true enables it;
  - Celo balance, partial errors, fee modes, insufficient gross balance, invalid fee quotes, and chain-scoped invalidation;
  - contributor receipt ordering and every settlement state;
  - offline, cancellation, retry retention, accessible names, and translated copy.

- Run the focused shared and client tests, shared typecheck, client test typecheck, design/vocabulary guardrails, and `bun run agentic:check`.
- Re-render `bun run validation:plan` with the actual changed paths at each checkpoint and execute every selected check. Because auth and blockchain mutation hooks are critical, run the final `release` intent with fresh, uncached evidence.
- Record TDD and validation receipts in the reopened Plan Hub lanes at the tested commit.

### Authenticated browser proof

Using the authenticated Brave QA profile:

- Existing passkey session opens W23 without another registration.
- Arbitrum and Celo addresses match.
- Celo G$ balance and receive QR render correctly.
- A passkey send is sponsored and confirms without CELO.
- Connected and embedded wallets switch to Celo, disclose user-paid fees, and recover cleanly from rejected switching or signing.
- Pending, failed, retry, confirmed, offline, and contributor-receipt states match W23 at mobile widths and 200% zoom.
- Existing Arbitrum token sends and unrelated passkey actions remain unchanged.

### Production canary and activation

1. Deploy the app with the on-chain flag still false.
2. Create a dedicated, non-personal production-RP canary passkey.
3. Derive its Kernel address on Arbitrum and Celo; verify equality plus the pinned EntryPoint, factory, validator, implementation, and deployed code hashes.
4. Configure a one-operation canary policy restricted to canonical G$ transfer and capped from the estimated UserOperation cost.
5. Fund the counterfactual Celo address with the quoted amount plus any sender-paid G$ fee.
6. Submit one sponsored first-use G$ transfer through the shipping app and record the UserOperation receipt, transaction receipt, EntryPoint event, deployed code, fee quote, exact balance deltas, block, and time. Record no passkey material or personal identity.
7. Set the launch policy limits to the agreed conservative pilot values.
8. After fresh human authorization, call `setGardenerDeliveryEnabled(true)`.
9. Wait for the indexer to expose true, confirm W23 unblocks, then execute one minimum-value contributor payout to the canary account and verify its receipt reaches “arrived.”
10. Monitor policy denials, address/chain mismatches, inclusion failures, indexer lag, and Celo read failures without recording wallet addresses or session identifiers.

Rollback is fail-closed: set the delivery flag false to stop new gardener preparation and app sends; pause the source/executor if queued value movement must also stop. Historical receipts remain visible and no completed transfer is reversed.

## Assumptions

- The existing Garden Safe/CCIP deployment and canary are accepted and will not be repeated.
- The separate Kernel passkey/G$ canary has not yet been completed.
- Same-address identity is mandatory; a mismatch never creates a second gardener account.
- Full W23 means balance, receive, sponsored/user-paid send, and contributor receipts; no additional Celo contract actions are included.
- All auth modes receive the Celo wallet UI, but only passkey accounts receive sponsorship.
- No new dependencies, contract changes, indexer schema changes, raw G$ indexing, or offline transaction queue are introduced.
- Every production broadcast, value movement, policy activation, and delivery-toggle change requires fresh human authorization.
