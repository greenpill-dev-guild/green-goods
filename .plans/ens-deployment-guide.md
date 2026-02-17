# ENS Deployment Guide: `*.greengoods.eth`

> **Status**: Ready for deployment
> **Branch**: `feature/ens-integration`
> **Prerequisites**: Own `greengoods.eth`, funded deployer on Ethereum + Arbitrum

---

## Architecture Summary

The ENS integration spans **two chains**:

| Component | Chain | Contract | Purpose |
|-----------|-------|----------|---------|
| **L2 Sender** | Arbitrum | `GreenGoodsENS` | Manages claims, validates slugs, sends CCIP messages |
| **L1 Receiver** | Ethereum | `GreenGoodsENSReceiver` | Receives CCIP, registers ENS subdomains |

Cross-chain messaging uses **Chainlink CCIP** (~15-20 min delivery, ~$0.09/message).

---

## Prerequisites Checklist

- [ ] Deployer EOA owns `greengoods.eth` on ENS (Ethereum mainnet)
- [ ] Deployer EOA funded with ETH on Ethereum mainnet (~0.5 ETH for deployment + gas)
- [ ] Deployer EOA funded with ETH on Arbitrum (~0.1 ETH for deployment)
- [ ] Hats Protocol tree deployed on Arbitrum (required for `protocolGardenersHatId`)
- [ ] GardenToken deployed on Arbitrum (required for module wiring)
- [ ] CCIP Router addresses verified (see Network Addresses below)
- [ ] Foundry keystore configured for deployer (`cast wallet import`)

---

## Network Addresses

### Ethereum Mainnet (Chain ID: 1)

| Contract | Address |
|----------|---------|
| CCIP Router | `0x80226fc0Ee2b096224EeAc085Bb9a8cba1146f7D` |
| CCIP Chain Selector | `5009297550715157269` |
| ENS Registry | `0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e` |
| ENS Public Resolver | `0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63` |

### Arbitrum One (Chain ID: 42161)

| Contract | Address |
|----------|---------|
| CCIP Router | `0x141fa059441E0ca23ce184B6A78bafD2A517DdE8` |
| CCIP Chain Selector | `4949039107694359620` |

### Sepolia Testnet (Chain ID: 11155111)

| Contract | Address |
|----------|---------|
| CCIP Router | `0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59` |
| CCIP Chain Selector | `16015286601757825753` |
| ENS Registry | `0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e` |
| ENS Resolver | `0x8FADE66B79cC9f707aB26799354482EB93a5B7dD` |

---

## Deployment Sequence

### Phase 1: Deploy L1 Receiver + ENS Approval (Ethereum Mainnet)

The L1 receiver must exist first so the L2 sender can reference it.
The deployer owns `greengoods.eth`, so ENS operator approval is granted automatically during deployment.

```bash
# Step 1: Deploy GreenGoodsENSReceiver on Ethereum mainnet
# This is handled by Deploy.s.sol's _deployMainnetENS() when targeting chain ID 1
# ENS setApprovalForAll(receiver, true) is called automatically in the same transaction
bun script/deploy.ts core --network mainnet --broadcast

# Constructor parameters (auto-loaded from networks.json):
#   ccipRouter:             0x80226fc0Ee2b096224EeAc085Bb9a8cba1146f7D
#   arbitrumChainSelector:  4949039107694359620
#   l2Sender:               address(0)  ← set after L2 deploy
#   ensRegistry:            0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e
#   ensResolver:            0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63
#   baseNode:               namehash("greengoods.eth")
#   owner:                  deployer address
```

**Record the deployed receiver address** from the console output.

**Verify ENS approval:**
```bash
cast call 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e \
  "isApprovedForAll(address,address)(bool)" \
  <DEPLOYER_ADDRESS> <RECEIVER_ADDRESS> \
  --rpc-url $MAINNET_RPC
# Should return: true
```

### Phase 2: Deploy L2 Sender (Arbitrum)

```bash
# Step 2: Deploy GreenGoodsENS on Arbitrum (part of core deployment)
# Deploy.s.sol's _deployAndWireENS() handles this automatically
bun script/deploy.ts core --network arbitrum --broadcast

# Constructor parameters (auto-loaded):
#   ccipRouter:               0x141fa059441E0ca23ce184B6A78bafD2A517DdE8
#   ethereumChainSelector:    5009297550715157269
#   l1Receiver:               <address from Phase 1>  ← loaded from ENS_L1_RECEIVER env var
#   hats:                     <Hats Protocol address on Arbitrum>
#   protocolHatId:            <from HatsModule.protocolGardenersHatId()>
#   owner:                    deployer address
```

**Record the deployed sender address** from the console output.

### Phase 3: Cross-Chain Wiring

After both contracts exist, wire them together:

```bash
# Step 3a: On L1 — Set L2 sender address on receiver
cast send <L1_RECEIVER_ADDRESS> \
  "setL2Sender(address)" \
  <L2_SENDER_ADDRESS> \
  --rpc-url $MAINNET_RPC \
  --account deployer

# Step 3b: On L2 — Set GardenToken as authorized caller
cast send <L2_SENDER_ADDRESS> \
  "setAuthorizedCaller(address,bool)" \
  <GARDEN_TOKEN_ADDRESS> true \
  --rpc-url $ARBITRUM_RPC \
  --account deployer

# Step 3c: On L2 — Wire ENS module to GardenToken
cast send <GARDEN_TOKEN_ADDRESS> \
  "setENSModule(address)" \
  <L2_SENDER_ADDRESS> \
  --rpc-url $ARBITRUM_RPC \
  --account deployer
```

**Note:** Steps 3b and 3c may already be handled by `_deployAndWireENS()` in DeploymentBase. Verify by checking:

```bash
# Verify GardenToken has ENS module set
cast call <GARDEN_TOKEN_ADDRESS> "ensModule()(address)" --rpc-url $ARBITRUM_RPC

# Verify L2 sender has GardenToken as authorized caller
cast call <L2_SENDER_ADDRESS> "authorizedCallers(address)(bool)" <GARDEN_TOKEN_ADDRESS> --rpc-url $ARBITRUM_RPC
```

### Phase 4: Fund Sponsored Claims (Optional)

For passkey users who can't pay CCIP fees:

```bash
# Send ETH to L2 sender for sponsored claims
# ~0.01 ETH covers ~100 sponsored registrations at ~$0.09 each
cast send <L2_SENDER_ADDRESS> \
  --value 0.01ether \
  --rpc-url $ARBITRUM_RPC \
  --account deployer
```

### Phase 5: Update Indexer Configuration

```bash
# Step 5a: Update deployment JSONs (should be auto-updated by deploy.ts)
# Verify:
jq '.greenGoodsENS' packages/contracts/deployments/42161-latest.json
# Should show non-zero address

# Step 5b: Rebuild indexer to pick up new addresses from config.yaml
cd packages/indexer && bun build

# Step 5c: Restart indexer
bun run dev:docker:down && bun run dev:docker
# Or: bun exec pm2 restart indexer
```

---

## Post-Deployment Verification

### 1. Verify Contract State

```bash
# L1 Receiver — verify configuration
cast call <L1_RECEIVER> "l2Sender()(address)" --rpc-url $MAINNET_RPC
cast call <L1_RECEIVER> "ARBITRUM_CHAIN_SELECTOR()(uint64)" --rpc-url $MAINNET_RPC
cast call <L1_RECEIVER> "ENS_REGISTRY()(address)" --rpc-url $MAINNET_RPC
cast call <L1_RECEIVER> "ENS_RESOLVER()(address)" --rpc-url $MAINNET_RPC

# L2 Sender — verify configuration
cast call <L2_SENDER> "l1Receiver()(address)" --rpc-url $ARBITRUM_RPC
cast call <L2_SENDER> "protocolHatId()(uint256)" --rpc-url $ARBITRUM_RPC
cast call <L2_SENDER> "authorizedCallers(address)(bool)" <GARDEN_TOKEN> --rpc-url $ARBITRUM_RPC

# GardenToken — verify ENS module
cast call <GARDEN_TOKEN> "ensModule()(address)" --rpc-url $ARBITRUM_RPC
```

### 2. Verify ENS Permissions

```bash
# Check receiver can manage greengoods.eth subdomains
# Deployer owns greengoods.eth — approval was granted during deployment
cast call 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e \
  "isApprovedForAll(address,address)(bool)" \
  <DEPLOYER_ADDRESS> <L1_RECEIVER> \
  --rpc-url $MAINNET_RPC
```

### 3. Test Registration Flow (Testnet First!)

```bash
# Check slug availability on L2
cast call <L2_SENDER> "available(string)(bool)" "test-slug" --rpc-url $ARBITRUM_RPC

# Estimate CCIP fee
cast call <L2_SENDER> \
  "getRegistrationFee(string,address,uint8)(uint256)" \
  "test-slug" <YOUR_ADDRESS> 0 \
  --rpc-url $ARBITRUM_RPC

# Claim a test name (wallet user)
cast send <L2_SENDER> \
  "claimName(string)" "test-slug" \
  --value <FEE_FROM_ABOVE> \
  --rpc-url $ARBITRUM_RPC \
  --account deployer

# Wait ~15-20 minutes for CCIP delivery, then verify on L1
cast call <L1_RECEIVER> "resolve(string)(address)" "test-slug" --rpc-url $MAINNET_RPC
```

### 4. Verify Indexer

```bash
# Check indexer logs for ENS events
bun run dev:docker:logs | grep -i "ENS"

# Query GraphQL for ENS registration
curl -X POST http://localhost:8080/v1/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ ENSRegistration(limit: 5) { slug owner status nameType ccipMessageId } }"}'
```

---

## Deployment Order (Multi-Chain)

Deploy testnet first, then production:

```
1. Sepolia (11155111)  — Test everything end-to-end
2. Mainnet (1)         — Production L1 receiver (ENS approval is automatic)
3. Arbitrum (42161)    — Production L2 sender
4. Wire: L1 ↔ L2 cross-chain references
5. Fund: Pre-fund L2 sender for sponsored claims
6. Indexer: Update config, rebuild, restart
```

---

## Environment Variables

Add these to the root `.env` before deployment:

```bash
# ENS Deployment (set after each deployment step)
ENS_L1_RECEIVER=0x...        # Set after Phase 1 (L1 receiver address)
ENS_L2_SENDER=0x...          # Set after Phase 3 (L2 sender address)
ENS_SPONSOR_FUND=0.01        # ETH to pre-fund for sponsored claims (default: 0.01)
```

---

## Rollback Procedure

If issues arise post-deployment:

### Disable ENS (Non-Destructive)

```bash
# On L2: Disconnect ENS module from GardenToken
# Gardens will mint without ENS registration (graceful degradation)
cast send <GARDEN_TOKEN> "setENSModule(address)" 0x0000000000000000000000000000000000000000 \
  --rpc-url $ARBITRUM_RPC --account deployer
```

### Emergency Name Release (L1 Admin)

```bash
# Force-release a specific name on L1 (bypasses L2)
cast send <L1_RECEIVER> "adminReleaseName(string)" "squatted-name" \
  --rpc-url $MAINNET_RPC --account deployer
```

### Withdraw Funds

```bash
# Withdraw remaining sponsor funds from L2 sender
cast send <L2_SENDER> "withdrawETH(address)" <SAFE_ADDRESS> \
  --rpc-url $ARBITRUM_RPC --account deployer
```

---

## Monitoring

### CCIP Message Tracking

- **CCIP Explorer**: https://ccip.chain.link
- Search by CCIP message ID (emitted in `NameRegistrationSent` event)
- Expected delivery: 15-20 minutes
- If >25 minutes: check CCIP Explorer for stuck messages

### Key Metrics to Watch

| Metric | Source | Alert Threshold |
|--------|--------|-----------------|
| L2 sender ETH balance | `cast balance <L2_SENDER>` | < 0.005 ETH (low sponsor funds) |
| CCIP delivery time | CCIP Explorer | > 30 minutes |
| Failed registrations | Indexer: `ENSRegistration` with status "pending" > 30 min | Any |
| Failed refunds | L2 event `RefundFailed` | Any occurrence |

### Log Monitoring

```bash
# Indexer ENS events
bun run dev:docker:logs 2>&1 | grep "ENS name"

# Look for:
# "ENS name registration sent via CCIP" — L2 event indexed
# "ENS name release sent via CCIP" — L2 release indexed
```

---

## Known Limitations

1. **Slug validation in 4 locations** — Must stay synchronized:
   - `ENS.sol:_validateSlug()`
   - `ENSReceiver.sol:_isValidSlug()`
   - `shared/hooks/ens/useSlugForm.ts:slugSchema`
   - `shared/utils/blockchain/ens.ts:validateSlug()`

2. **CCIP fee volatility** — Fee estimates can change between estimation and submission. Frontend adds buffer but users may underpay in extreme gas spikes.

3. **No L2 testnet CCIP** — Cross-chain flow tested via fork tests with mock CCIP routers. Production is the first live CCIP deployment.

4. **ENS Registry upgrade risk** — If ENS governance upgrades the registry, receiver must be redeployed and re-approved.

5. **Single-name-per-owner** — Each address can only hold one `*.greengoods.eth` name. Release current before claiming new (30-day cooldown for personal names, garden names are immutable).
