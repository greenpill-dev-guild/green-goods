# Production Readiness Checklist

**Version:** 1.0  
**Last Updated:** 2025-10-09  
**Target Network:** Base Sepolia (Testnet) / Mainnet

This document provides a comprehensive checklist for assessing production readiness of the Green Goods smart contracts before deployment.

---

## Pre-Deployment Requirements

### Smart Contract Readiness

- [ ] **All tests passing** (100% target for mainnet, 80%+ for testnet)
  ```bash
  cd packages/contracts && bun test
  ```
  - Expected: All unit tests passing
  - Expected: All integration tests passing  
  - Expected: All E2E workflow tests passing

- [ ] **Test coverage >= 80%**
  ```bash
  forge coverage --report lcov
  ```
  - Target: 80% minimum for testnet
  - Target: 90%+ for mainnet

- [ ] **No TODO/FIXME in production code**
  ```bash
  grep -r "TODO\|FIXME\|XXX\|HACK" packages/contracts/src/
  ```
  - Expected: Zero results

- [ ] **All compiler warnings resolved**
  ```bash
  forge build --via-ir
  ```
  - Expected: Clean compilation with no warnings

- [ ] **Gas optimization completed**
  ```bash
  forge test --gas-report | tee gas-report.txt
  ```
  - Review gas-report.txt for optimization opportunities
  - mintGarden: < 500k gas
  - registerAction: < 200k gas
  - Work submission: < 150k gas
  - Work approval: < 100k gas

### Security Audit

- [ ] **External audit completed (mainnet only)**
  - Auditor: _______________________
  - Date completed: _________________
  - Critical issues: 0
  - High issues: 0
  - All medium/low issues addressed: Yes/No

- [ ] **Internal security review (minimum for testnet)**
  - Reviewed by: _______________________
  - Date: _________________
  - Access control verified
  - Reentrancy protection verified
  - Integer overflow/underflow checks verified
  - External call safety verified

- [ ] **Bug bounty program ready (mainnet)**
  - Platform: Immunefi / Code4rena / Other: ____________
  - Reward structure defined: Yes/No
  - Scope documented: Yes/No

- [ ] **Incident response plan documented**
  - Contact person: _______________________
  - Emergency procedures written: Yes/No
  - Upgrade procedures tested: Yes/No
  - Rollback procedures documented: Yes/No

### Testing

- [ ] **Unit tests: 100% core functionality**
  - ActionRegistry: ✓ 8/8 tests passing
  - GardenToken: ✓ All tests passing
  - DeploymentRegistry: ✓ 13/13 tests passing
  - GardenAccount: ✓ 47/47 tests passing
  - Resolvers: ✓ All tests passing

- [ ] **Integration tests: All workflows tested**
  - E2EWorkflow: ✓ 7 comprehensive tests
  - Complete protocol workflow: Tested
  - Multi-garden workflows: Tested
  - Work rejection flow: Tested
  - Assessment workflow: Tested
  - Time-based validation: Tested
  - Access control: Tested
  - Gas optimization: Tested

- [ ] **Fork testing: Tested against live state**
  ```bash
  bun fork:celo
  # In another terminal:
  bun deploy:local
  forge test --fork-url http://localhost:8545 -vv
  ```

- [ ] **Gas profiling: All functions optimized**
  - Gas report reviewed: Yes/No
  - No functions exceeding block gas limit
  - Batch operations considered where applicable

- [ ] **Upgrade testing: UUPS upgrades verified**
  - UpgradeSafety: ✓ 7 upgrade tests
  - Storage preservation: Tested
  - Access control: Tested
  - Storage gaps: Verified
  - Multiple upgrades: Tested

### Deployment Infrastructure

- [ ] **Foundry keystore configured**
  ```bash
  cast wallet list
  # Should show: green-goods-deployer
  ```

- [ ] **Deployer wallet funded**
  ```bash
  cast balance $(cast wallet address green-goods-deployer) --rpc-url $BASE_SEPOLIA_RPC_URL
  ```
  - Required balance: 0.1 ETH minimum for testnet
  - Required balance: 0.5 ETH minimum for mainnet

- [ ] **RPC endpoints verified**
  ```bash
  bun network:verify
  ```
  - All networks: Connectivity confirmed
  - Chain IDs: Verified correct

- [ ] **Etherscan API key configured**
  ```bash
  echo $ETHERSCAN_API_KEY
  ```
  - API key present: Yes/No
  - Etherscan V2 API: Confirmed

- [ ] **Deployment scripts tested**
  ```bash
  bun deploy:dryrun
  ```
  - Dry run successful: Yes/No
  - No errors in simulation: Yes/No

### Network Configuration

- [ ] **Chain ID verified**
  - Target chain ID: ____________
  - Config matches: Yes/No

- [ ] **EAS contracts confirmed**
  - EAS address: 0x4200000000000000000000000000000000000021 (Base Sepolia)
  - Schema Registry: 0x4200000000000000000000000000000000000020 (Base Sepolia)
  - Verified on explorer: Yes/No

- [ ] **Block explorer links correct**
  - Explorer URL: https://sepolia.basescan.org (Base Sepolia)
  - API working: Yes/No

- [ ] **Network config file validated**
  ```bash
  cat packages/contracts/deployments/networks.json | jq
  ```
  - All required fields present: Yes/No

---

## Deployment Checklist

### Pre-Deployment

- [ ] **Run full test suite**
  ```bash
  cd packages/contracts && bun test
  ```
  - Result: ___ tests passing / ___ total
  - Pass rate: ____%

- [ ] **Verify network config**
  ```bash
  bun network:verify
  ```
  - All checks passing: Yes/No

- [ ] **Dry run deployment**
  ```bash
  bun deploy:dryrun
  ```
  - Simulation successful: Yes/No
  - Estimated gas cost: _______ ETH

- [ ] **Review gas estimates**
  - Total deployment cost acceptable: Yes/No
  - Gas price reasonable: Yes/No
  - Sufficient deployer balance: Yes/No

- [ ] **Check deployer balance**
  ```bash
  cast balance $(cast wallet address green-goods-deployer) --rpc-url $BASE_SEPOLIA_RPC_URL
  ```
  - Balance: _______ ETH
  - Sufficient: Yes/No

### Deployment Execution

- [ ] **Deploy to testnet**
  ```bash
  bun deploy:testnet
  ```
  - Deployment started: ________________ (timestamp)
  - Deployment completed: ________________ (timestamp)
  - Transaction hashes saved: Yes/No

- [ ] **Verify all contracts on explorer**
  - DeploymentRegistry: ☐ Verified
  - GardenToken: ☐ Verified
  - ActionRegistry: ☐ Verified
  - WorkResolver: ☐ Verified
  - WorkApprovalResolver: ☐ Verified
  - AssessmentResolver: ☐ Verified
  - GardenAccount (impl): ☐ Verified

- [ ] **Save deployment addresses**
  - File: `deployments/{chainId}-latest.json`
  - Backed up: Yes/No
  - Committed to git: Yes/No

- [ ] **Test basic operations**
  - Mint test garden: ☐ Success
  - Register test action: ☐ Success
  - Submit test work: ☐ Success
  - Approve test work: ☐ Success

- [ ] **Verify schema UIDs**
  - Assessment schema UID: 0x________________
  - Work schema UID: 0x________________
  - Work approval schema UID: 0x________________
  - All non-zero: Yes/No

### Post-Deployment

- [ ] **Test minting garden**
  ```bash
  cast send $GARDEN_TOKEN "mintGarden(...)" --rpc-url $BASE_SEPOLIA_RPC_URL
  ```
  - Garden minted: Yes/No
  - Garden address: 0x________________
  - Token ID: ________

- [ ] **Test registering action**
  ```bash
  cast send $ACTION_REGISTRY "registerAction(...)" --rpc-url $BASE_SEPOLIA_RPC_URL
  ```
  - Action registered: Yes/No
  - Action ID: ________

- [ ] **Test submitting work**
  - EAS attestation created: Yes/No
  - Attestation UID: 0x________________

- [ ] **Test approval flow**
  - Approval attestation created: Yes/No
  - Approval UID: 0x________________

- [ ] **Monitor for 24-48 hours**
  - Day 1 checks: ☐ No issues
  - Day 2 checks: ☐ No issues
  - Event monitoring: ☐ Configured
  - Error tracking: ☐ Configured

### Access Control Transfer (Mainnet Only)

- [ ] **Verify multisig setup**
  - Multisig address: 0x________________
  - Signers confirmed: Yes/No
  - Threshold set: ___ of ___
  - Tested on testnet: Yes/No

- [ ] **Transfer ownership to multisig**
  - DeploymentRegistry: ☐ Transferred
  - GardenToken: ☐ Transferred
  - ActionRegistry: ☐ Transferred
  - WorkResolver: ☐ Transferred
  - WorkApprovalResolver: ☐ Transferred
  - AssessmentResolver: ☐ Transferred

- [ ] **Test multisig operations**
  - Create test transaction: Yes/No
  - Collect signatures: Yes/No
  - Execute transaction: Yes/No

- [ ] **Document multisig signers**
  - Signer 1: _______________________ (address: 0x_______)
  - Signer 2: _______________________ (address: 0x_______)
  - Signer 3: _______________________ (address: 0x_______)

---

## Monitoring & Maintenance

### Monitoring Setup

- [ ] **Event monitoring configured**
  - Platform: The Graph / Envio / Other: ____________
  - Events tracked: ☐ GardenMinted, ☐ ActionRegistered, ☐ Work attestations
  - Alerts configured: Yes/No

- [ ] **Error tracking enabled**
  - Platform: Sentry / Other: ____________
  - Contract error events monitored: Yes/No
  - Alert thresholds set: Yes/No

- [ ] **Gas price alerts set**
  - Alert threshold: _____ gwei
  - Notification method: ____________
  - Recipients: ____________

- [ ] **Contract balance monitoring**
  - Resolver balances tracked: Yes/No
  - Low balance alerts: Yes/No
  - Refill procedures documented: Yes/No

### Documentation

- [ ] **API documentation complete**
  - Contract interfaces documented: Yes/No
  - Function signatures clear: Yes/No
  - Events documented: Yes/No
  - Examples provided: Yes/No

- [ ] **User guide published**
  - Location: ____________
  - Covers basic workflows: Yes/No
  - Screenshots/diagrams included: Yes/No

- [ ] **Operator manual created**
  - Work approval process: ☐ Documented
  - Garden management: ☐ Documented
  - Troubleshooting: ☐ Documented

- [ ] **Upgrade procedures documented**
  - See: docs/UPGRADES.md
  - Deploy vs Upgrade decision matrix: ☐ Clear
  - Rollback procedures: ☐ Documented
  - Multisig upgrade process: ☐ Documented

---

## Risk Assessment Matrix

| Risk | Likelihood | Impact | Mitigation | Owner |
|------|-----------|---------|------------|--------|
| Smart contract bug | Low | High | UUPS upgradeable, comprehensive tests, external audit (mainnet) | Tech Lead |
| Access control breach | Low | High | OpenZeppelin patterns, audited code, multisig ownership | Security Team |
| Gas price spike | Medium | Low | Monitor gas, batch operations, flexible timing | Ops Team |
| Schema incompatibility | Low | Medium | Version fields, backward compatible design | Tech Lead |
| RPC provider downtime | Medium | Medium | Multiple RPC providers, fallback endpoints | DevOps |
| Key compromise | Low | Critical | Foundry keystore, multisig, key rotation procedures | Security Team |
| Insufficient testing | Low | High | 80%+ coverage, E2E tests, fork testing | QA Lead |
| Upgrade failure | Low | High | Comprehensive upgrade tests, rollback plan | Tech Lead |

---

## Rollback Procedures

### If Critical Bug Found

1. **Immediate Response**
   - Pause affected operations (if pausable functionality exists)
   - Notify all stakeholders
   - Document the bug and impact

2. **Deploy Patched Implementation**
   ```bash
   # Deploy new implementation
   forge create src/registries/Action.sol:ActionRegistry
   
   # Note the implementation address
   ```

3. **Execute Upgrade via Multisig** (Mainnet)
   - Create upgrade transaction in Safe
   - Generate calldata: `cast calldata "upgradeTo(address)" <NEW_IMPL>`
   - Collect required signatures
   - Execute upgrade
   - Verify upgrade successful

4. **Verify Fix with Tests**
   ```bash
   forge test --match-test testBugFix -vvv
   ```

5. **Resume Operations**
   - Unpause contracts (if paused)
   - Monitor closely for 24-48 hours
   - Document post-mortem

### If Upgrade Fails

1. **Identify Failure Point**
   - Check transaction revert reason
   - Review logs and events
   - Identify root cause

2. **Deploy Previous Implementation**
   - Locate previous implementation address from deployment history
   - Verify bytecode matches

3. **Execute Rollback Upgrade**
   ```bash
   cast send $PROXY "upgradeTo(address)" $PREVIOUS_IMPL --rpc-url $RPC_URL
   ```

4. **Verify State Consistency**
   - Check all critical state variables
   - Verify contract functionality
   - Test basic operations

5. **Document Issue**
   - Write incident report
   - Document lessons learned
   - Update upgrade procedures

---

## Network-Specific Notes

### Base Sepolia (Testnet)

- **Chain ID:** 84532
- **RPC:** https://sepolia.base.org
- **Explorer:** https://sepolia.basescan.org
- **Faucet:** https://www.coinbase.com/faucets/base-ethereum-goerli-faucet
- **EAS:** 0x4200000000000000000000000000000000000021
- **Schema Registry:** 0x4200000000000000000000000000000000000020

**Deployment Command:**
```bash
bun deploy:testnet
```

### Base Mainnet

- **Chain ID:** 8453
- **RPC:** https://mainnet.base.org
- **Explorer:** https://basescan.org
- **EAS:** 0x4200000000000000000000000000000000000021
- **Schema Registry:** 0x4200000000000000000000000000000000000020

**⚠️ Mainnet Deployment:**
```bash
# Requires external audit
# Requires multisig ownership
# Requires comprehensive testing on testnet first
bun deploy:base
```

### Celo Mainnet

- **Chain ID:** 42220
- **RPC:** https://forno.celo.org
- **Explorer:** https://explorer.celo.org

**Deployment Command:**
```bash
bun deploy:celo
```

### Arbitrum One

- **Chain ID:** 42161
- **RPC:** https://arb1.arbitrum.io/rpc
- **Explorer:** https://arbiscan.io

**Deployment Command:**
```bash
bun deploy:arbitrum
```

---

## Sign-off

### Pre-Deployment Sign-off

- [ ] **Technical Lead Approved**
  - Name: _______________________
  - Signature: _______________________
  - Date: _______________________

- [ ] **Security Review Completed**
  - Reviewer: _______________________
  - Date: _______________________
  - Approval: Yes/No

- [ ] **Operations Team Briefed**
  - Lead: _______________________
  - Date: _______________________
  - Ready: Yes/No

- [ ] **Deployment Date Scheduled**
  - Scheduled date: _______________________
  - Time (UTC): _______________________
  - Participants: _______________________

### Post-Deployment Sign-off

- [ ] **Deployment Verified**
  - Verifier: _______________________
  - Date: _______________________
  - All tests passed: Yes/No

- [ ] **Monitoring Active**
  - Setup by: _______________________
  - Date: _______________________
  - Status: Active/Issues

- [ ] **Documentation Updated**
  - Updated by: _______________________
  - Date: _______________________
  - Complete: Yes/No

---

## Appendix

### Quick Reference Commands

```bash
# Test suite
cd packages/contracts && bun test

# Coverage
forge coverage --report lcov

# Network verification
bun network:verify

# Dry run
bun deploy:dryrun

# Deploy to testnet
bun deploy:testnet

# Check balance
cast balance $(cast wallet address green-goods-deployer) --rpc-url $BASE_SEPOLIA_RPC_URL

# Verify contract
forge verify-contract --chain-id 84532 <ADDRESS> src/Contract.sol:Contract

# Gas report
forge test --gas-report

# Upgrade contract
bun upgrade:testnet
```

### Related Documentation

- [Deployment Guide](./DEPLOYMENT.md)
- [Upgrade Guide](./UPGRADES.md)
- [Testing Guide](./TESTING.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
- [Architecture](./ARCHITECTURE.md)
- [Karma GAP](./KARMA_GAP.md)

### Contact Information

- **Technical Lead:** _______________________
- **Security Contact:** _______________________
- **Operations Contact:** _______________________
- **Emergency Contact:** _______________________

---

**Document Version:** 1.0  
**Last Review Date:** 2025-10-09  
**Next Review Date:** _______________________ (Quarterly recommended)

