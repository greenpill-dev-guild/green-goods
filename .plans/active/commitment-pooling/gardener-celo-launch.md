# Gardener Celo wallet QA and setup

Use this checklist for [PR #799](https://github.com/greenpill-dev-guild/green-goods/pull/799).
The helper below prepares a policy, checks public chain state, and verifies a canary receipt.
It does not deploy the app, create a hosted policy, sign a transaction, or enable delivery.

## Selected community pilot policy

The user selected **DAI/USDC/WETH on Arbitrum One (42161), and G$ on Celo (42220)**, with
verified Green Goods passkey senders and registered gardener/garden recipients. Use one community
transfer policy covering both chains so the proposed 5/account/day and 200/global/day counters
belong to the same policy. Do not create two independent policies that silently double the limits.
The guard must bind each token contract to its chain; enabling two chains alone does not do that.

This supersedes the separate one-operation canary-policy stage. Select explicit per-operation
and daily USD ceilings for direct pilot setup. First-transfer QA uses this same community policy;
there is no required canary-cost multiplier. Funding, signing and the on-chain delivery toggle
still require the scoped release authorization. No hosted policy has been activated.

The generator reflects this decision. Runtime transfer-policy routing, the authenticated
sponsorship guard and verified recipient directory remain implementation work. The existing app
allows raw recipient addresses; it does not yet enforce community-only recipients. Keep current
Arbitrum sponsorship for other app actions: replacing it wholesale with a transfer-only policy
would block unrelated contract calls.

## QA checklist

Use the authenticated Brave QA profile and a dedicated test account. Record the app commit,
browser/device, result, and a screenshot for each visible state. Keep account/session evidence private.

1. **Open your wallet.** Sign in with an existing passkey. Open Tokens: no new passkey registration;
   the Arbitrum and Celo account addresses match.
2. **Check balance and receive.** Find “G$ · Celo,” check its balance against Celo, copy the receive
   address, and scan the QR. Both identify the same Celo account. A failed read shows unavailable,
   not a zero balance.
3. **Check blocked and offline states.** Before activation, Send stays unavailable. Disconnect the
   network: cached balance/history remains legible and no transfer is queued. Reconnect and retry
   a failed read; no transfer starts automatically.
4. **Check layout.** Repeat at a phone width and 200% zoom. Amount/recipient fields, fee text,
   buttons and close controls remain usable. Tab through dialogs; focus is visible and returns
   to the opening control when a dialog closes. Check English, Spanish and Portuguese.
5. **After authorized activation, check sends.** Use a small agreed G$ amount. Passkey
   sending needs no CELO and shows covered network fees. Connected and embedded wallets switch
   to Celo and disclose user-paid network fees. Every mode separately shows the quoted G$ fee,
   total debit or recipient net amount. Reject switching/signing once: input remains for an
   explicit retry. Confirm once: receipt and balance update without a duplicate send.
6. **Check receipts and regressions.** Contributor receipts remain pending until authenticated
   Arbitrum confirmation; only then show arrived. Check failed/retry states using fixtures if
   no live example exists, and label that evidence. Repeat an agreed Arbitrum token send and an
   unrelated passkey action. Real value movement needs the exact amount/recipient authorized.

## Run the setup helper

Run from the repository root. No dependency installation is needed. `--help` lists all options:

```sh
bun .plans/active/commitment-pooling/gardener-celo-setup.mjs --help
```

The helper has three commands. Policy generation is offline. `preflight` and `verify` make only
public RPC reads, using `ARBITRUM_RPC_URL` and `CELO_RPC_URL` if provided, otherwise the installed
Viem chain defaults. Use the root environment only. There are no Pimlico API calls or private-key
inputs. The emitted JSON is a preparation/evidence artifact, never an activation approval.

### 1. Prepare Pimlico settings

Supply the chosen **USD network-fee ceiling per operation**, **total daily USD budget**, and URL
of the deployed sponsorship webhook. Both budgets must be positive amounts in whole cents. These
are operator inputs, not new app environment settings; neither is a token transfer amount.

```sh
bun .plans/active/commitment-pooling/gardener-celo-setup.mjs policy \
  --gas-cap-usd "$PILOT_GAS_CAP_USD" --daily-budget-usd "$PILOT_DAILY_BUDGET_USD" \
  --webhook "$SPONSORSHIP_WEBHOOK_URL" > /tmp/green-goods-community-policy.json
```

The `policy` object contains hosted settings; `requiredWebhookChecks` describes the checks our
server must implement. These latter fields are not Pimlico API policy fields. The generator uses
5 operations/account/day and 200 globally/day, plus the explicit total daily budget. The account
spending cap is the lesser of five operation ceilings and the daily budget. Pimlico API USD amounts
use cents: a ceiling entered as `0.02` becomes `2`, without rounding or a multiplier.
[Policy schema](https://docs.pimlico.io/references/platform/api/sponsorship-policies/object)

**Manual Pimlico steps:**

1. Create the community transfer policy after the request guard is ready. Allow Arbitrum One
   (`42161`) and Celo (`42220`), then copy the generated count, reset and spending settings. For
   UI fields denominated in dollars, divide JSON cents by 100.
2. Attach the authenticated sponsorship-request webhook; protect its signing secret on the server.
   Test the exact chain/token pairs, community sender/recipient eligibility, and denial paths
   before activation. A webhook URL alone is not proof.
3. Restrict the browser API key to approved Green Goods origins and necessary functionality.
   Preserve permissions required by passkey registration/recovery. Keep policy-management
   credentials server-side. The app uses one `VITE_PIMLICO_API_KEY` across both chains.
   [API-key controls](https://docs.pimlico.io/guides/how-to/security/protect-api-keys)
4. For Celo, the client reads `VITE_PIMLICO_CELO_SPONSORSHIP_POLICY_ID`. Arbitrum currently uses
   its primary policy for all actions. Before attaching this new policy, implement selection
   specifically for the three approved Arbitrum token transfers. Do not replace the general
   Arbitrum policy and break other actions. Rebuild after deployment environment changes.
5. Run the agreed QA transfers under the community policy and inspect policy usage. Revisit
   budgets using actual observed costs; there is no separate one-operation policy stage.

**Guard requirements:** authenticate the request and validate chain, EntryPoint, policy identity,
verified Green Goods passkey sender, and registered gardener/garden recipient. Decode the Kernel
0.3.1 outer execution and its inner call; allow exactly one zero-native-value
`transfer(address,uint256)` (`0xa9059cbb`) to one of these chain-bound token contracts:

| Chain | Token | Contract |
| --- | --- | --- |
| Arbitrum One | DAI | `0xda10009cbd5d07dd0cecc66161fc93d7c9000da1` |
| Arbitrum One | USDC | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` |
| Arbitrum One | WETH | `0x82af49447d8a07e3bd95bd0d56f35241523fbab1` |
| Celo | G$ | `0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A` |

The direct tests check the Arbitrum addresses against the existing app registry; G$ comes from
the release manifest. No Celo DAI/USDC/WETH or Arbitrum G$ is in this policy. Reject other tokens,
approvals, batches, delegatecalls, malformed encoding and unexpected deployment/validator paths.
The policy's USD limits cover network fees, not transferred token value or G$ token fees. No
additional token-value cap has been selected.

Pimlico documents a webhook that can approve or deny sponsorship; token/recipient restrictions
need this guard and are not documented native hosted-policy fields.
[Webhook guide](https://docs.pimlico.io/guides/how-to/sponsorship-policies/webhook)

### 2. Check a first-use Celo QA account and funding

Create a dedicated non-personal passkey at the production relying-party origin. Obtain both
addresses through the same credential in the shipping auth flow. Set the three address variables
below from that session and the authorized recipient; do not export passkey material.

```sh
bun .plans/active/commitment-pooling/gardener-celo-setup.mjs preflight \
  --source-account "$CANARY_ARBITRUM_ADDRESS" --celo-account "$CANARY_CELO_ADDRESS" \
  --recipient "$CANARY_RECIPIENT" --amount "$CANARY_G_DOLLARS" > /tmp/gardener-celo-before.json
```

Expected before funding: exit 2 with a `fundingShortfall`. The quote reports amount, fee, total debit
and recipient net in raw G$ units. Fund only after the exact transfer is authorized, leaving the
canary account with no CELO. Then rerun preflight and use this **funded** snapshot for verification.
The funding transfer may itself charge a G$ fee; confirm the received balance rather than assuming it.

The checks require matching input addresses, correct RPC chains, the delivery flag false, nonempty matching code at the pinned EntryPoint/factory/meta-factory/validator addresses,
and matching implementation code after verifying its chain-dependent constants,
a first-use Celo account, zero CELO and enough G$ for the quote. An existing Celo deployment is
not first-use evidence: choose a new dedicated canary rather than ignoring the failure.

The Kernel 0.3.1 implementation embeds its deployment chain ID and cached EIP-712 domain.
The helper requires each expected constant exactly once before comparing the remaining bytecode,
and retains both raw chain-specific hashes in its output. Other pins require exact equality.

Matching supplied addresses do not prove credential derivation. Equal observed code hashes do not
prove approved bytecode. Review the browser identity evidence and compare observed hashes with the
approved deployment record separately. Any unavailable read fails; it never becomes a zero balance.

**Pre-activation QA signing path still needed:** `useSendToken` checks the indexed delivery flag before sending.
With the flag false, WalletDrawer cannot run the pre-activation send from the original plan.
Use a separately reviewed operator harness that reuses the shipping passkey account construction
at the production origin and signs exactly the authorized transfer. This helper has no signer.
Do not enable delivery merely to get past this check, and do not add a customer-facing bypass.
This uses the community policy; it does not require a separate canary policy. The operator harness
and sponsorship guard are outstanding launch work.

### 3. Verify the included Celo QA transfer

After the separately authorized operation, collect its transaction hash and UserOperation hash.
Keep the funded snapshot and use an RPC with historical reads. Avoid unrelated transfers involving
either account between the snapshot and receipt block; they invalidate exact balance-delta proof.

```sh
bun .plans/active/commitment-pooling/gardener-celo-setup.mjs verify \
  --before /tmp/gardener-celo-before.json \
  --transaction-hash "$CANARY_TRANSACTION_HASH" --user-operation-hash "$CANARY_USER_OPERATION_HASH" \
  > /tmp/gardener-celo-receipt.json
```

The check requires a canonical successful transaction, exactly one matching successful sponsored
EntryPoint event, deployed account code, zero CELO and the exact quoted sender/recipient G$ deltas.
It rereads historical snapshot state. It reports actual network cost in CELO wei; this is **not USD**.
Also save the Pimlico UserOperation receipt, policy usage/charged USD cost, approved code-hash
comparison and browser signing evidence. Inclusion is not a finality certificate; confirm the
release's required finality before activation. Keep raw canary evidence outside source control.

## Deployment and activation order

1. Finish CI and review. Configure the request guard and restricted browser key; test denials.
2. Deploy the client with the Celo policy ID and primary chain `42161`, while delivery stays false.
   Use the existing deployment workflow; this helper does not replace it. No contract deployment
   or indexer schema change is needed for this wallet change.
3. Complete the operator first-use QA path, authorized funding/send and receipt checks above
   under the community policy. Review actual network costs against the chosen pilot limits.
4. With fresh artifact-specific authorization, have the owning protocol Safe call
   `SettlementModule.setGardenerDeliveryEnabled(true)` on Arbitrum. Verify its receipt and then
   the indexer's `SOURCE` configuration shows true. There is no browser env toggle for this gate.
5. Finish send QA and the minimum-value contributor payout: Celo inclusion remains pending until
   the authenticated acknowledgment confirms on Arbitrum. Then check the wallet's arrived state.

Rollback: disabling the delivery flag blocks new app sends/contributor preparation. It does not
revoke a public paymaster policy or stop an already submitted operation. Disable the community transfer policy
separately for sponsorship abuse (this also stops its Arbitrum transfer sponsorship); pause source/executor separately if queued settlement must stop.
Do not disable the shared browser key indiscriminately, which also affects primary-chain auth.
Historical receipts remain visible.

## Local helper validation

The policy generator is tested separately from the unchanged G$-only preflight/receipt commands.
Those commands do not verify DAI/USDC/WETH receipts. This follow-up changes local preparation
artifacts only, with no runtime, environment, dependency, hosted-policy or deployment mutation.
Current targeted results are recorded in the release-ops handoff; browser proof and live transfers
remain outstanding.
