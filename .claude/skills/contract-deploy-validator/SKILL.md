# Contract Deploy Validator Skill

Validate smart contracts before deployment to ensure safety and correctness.

## Activation

Use when:
- Before deploying contracts to testnet/mainnet
- After contract modifications
- Validating upgrade safety
- User requests contract validation

## Process

### Phase 1: Compilation Check

```bash
cd packages/contracts && forge build
```

Verify:
- Clean compilation (no errors)
- No warnings that could indicate issues

### Phase 2: Storage Layout Validation (UUPS)

For upgradeable contracts, verify storage gaps:

```bash
# Generate storage layout
forge inspect [Contract] storage-layout

# Check for gaps
grep -n "__gap" packages/contracts/src/**/*.sol
```

**Critical checks**:
- Gap variables exist in upgradeable contracts
- Gap size appropriate (typically `uint256[50] __gap`)
- No storage slot collisions with base contracts

### Phase 3: Schema Immutability

Schemas are immutable after deployment. Check `schemas.json`:

```bash
# Check if schemas.json was modified
git diff packages/contracts/schemas.json

# If modified, require explicit --update-schemas flag
```

**Rules**:
- Never modify deployed schema UIDs
- New schemas can be added
- Schema changes require migration plan

### Phase 4: Gas Estimation

Run gas reports:

```bash
cd packages/contracts && forge test --gas-report
```

Check for:
- Functions exceeding expected gas limits
- Unexpected gas increases from changes
- Loops that could hit block gas limit

### Phase 5: Security Checks

```bash
# Static analysis with slither (if available)
slither packages/contracts/src/

# Check for common issues
grep -rn "selfdestruct\|delegatecall\|tx.origin" packages/contracts/src/
```

Look for:
- Reentrancy vulnerabilities
- Access control issues
- Integer overflow/underflow
- Unchecked external calls

### Phase 6: Test Coverage

```bash
cd packages/contracts && forge coverage
```

Requirements:
- 100% coverage for mainnet deployments
- All critical paths tested
- Fuzz tests for complex logic
- Invariant tests for state transitions

### Phase 7: ABI Freshness

Verify deployment artifacts match compiled output:

```bash
# Compare compiled ABIs with deployment artifacts
diff packages/contracts/out/[Contract].sol/[Contract].json \
     packages/contracts/deployments/[chainId]-latest.json
```

### Phase 8: Pre-Deployment Checklist

Generate validation report:

```markdown
# Deployment Validation: [Contract]

## Compilation
- [ ] Clean build
- [ ] No warnings

## Storage (UUPS)
- [ ] Gap variables present
- [ ] No slot collisions
- [ ] Layout compatible with previous version

## Schemas
- [ ] No modifications to deployed schemas
- [ ] New schemas documented

## Gas
- [ ] Gas report generated
- [ ] No unexpected increases
- [ ] Within block limits

## Security
- [ ] Static analysis clean
- [ ] No dangerous patterns
- [ ] Access control verified

## Tests
- [ ] 100% coverage
- [ ] All tests passing
- [ ] Fuzz tests included

## Artifacts
- [ ] ABIs match compiled output
- [ ] Deployment scripts updated

## Ready for Deployment
- Network: [testnet/mainnet]
- Chain ID: [id]
- Deployer: [address]
```

## Deployment Commands

**Always use the bun wrapper scripts**:

```bash
# Testnet (Base Sepolia)
bun deploy:testnet

# Mainnet
bun deploy:mainnet

# Never use raw forge script
# forge script ... # DON'T DO THIS
```

## Chain IDs Reference

| Network | Chain ID | Deployment File |
|---------|----------|-----------------|
| Base Sepolia | 84532 | 84532-latest.json |
| Arbitrum | 42161 | 42161-latest.json |
| Celo | 42220 | 42220-latest.json |
| Sepolia | 11155111 | 11155111-latest.json |
| Local | 31337 | 31337-latest.json |

## Critical Rules

1. **Never skip validation** for mainnet
2. **Always test on testnet first**
3. **Use deployment scripts**, not raw forge
4. **Verify on block explorer** after deployment
5. **Document all upgrades** in ADRs

## Output

Present validation summary to user:
- Overall readiness status
- Any blocking issues
- Recommended actions
- Deployment command to use
