# Gas Limits and Optimization Guide

## Overview

This document provides guidance on gas costs, limits, and optimization strategies for Green Goods smart contracts.

## Array Length Limits

To prevent gas exhaustion and ensure predictable transaction costs, the following array length limits are enforced:

### GardenAccount Initialization
- **Maximum Gardeners**: 100 addresses
- **Maximum Operators**: 100 addresses  
- **Reason**: Prevents out-of-gas errors during initialization loop

### GardenToken Batch Operations
- **Maximum Batch Size**: 10 gardens per transaction
- **Maximum Gardeners per Garden**: 100 addresses
- **Maximum Operators per Garden**: 100 addresses
- **Reason**: Ensures batch operations stay within block gas limits

## Function Gas Costs

### GardenToken Operations

| Function | Estimated Gas | Notes |
|----------|--------------|-------|
| `mintGarden()` | ~500K-800K | Varies with gardener/operator count |
| `batchMintGardens(10)` | ~5M-8M | Maximum recommended batch size |
| `setDeploymentRegistry()` | ~50K | Owner-only operation |

### ActionRegistry Operations

| Function | Estimated Gas | Notes |
|----------|--------------|-------|
| `registerAction()` | ~200K-300K | Varies with capitals/media array sizes |
| `updateActionStartTime()` | ~50K | Simple state update |
| `updateActionEndTime()` | ~50K | Simple state update |
| `updateActionTitle()` | ~60K-100K | Varies with string length |
| `updateActionInstructions()` | ~60K-100K | Varies with string length |
| `updateActionMedia()` | ~100K-200K | Varies with array size |

### GardenAccount Operations

| Function | Estimated Gas | Notes |
|----------|--------------|-------|
| `initialize()` | ~300K-600K | Varies with gardener/operator count |
| `addGardener()` | ~50K | Simple mapping update |
| `removeGardener()` | ~30K | Simple mapping update |
| `addGardenOperator()` | ~50K | Simple mapping update |
| `removeGardenOperator()` | ~30K | Simple mapping update |
| `joinGarden()` | ~50K | Direct join without invite system |
| `updateDescription()` | ~50K-80K | Varies with string length |

### Resolver Operations

| Function | Estimated Gas | Notes |
|----------|--------------|-------|
| WorkResolver `onAttest()` | ~100K-150K | Validation + external calls |
| WorkApprovalResolver `onAttest()` | ~120K-180K | Multiple validations |
| AssessmentResolver `onAttest()` | ~150K-250K | Capital validation loops |

## Optimization Strategies

### 1. Batch Operations

**Recommended**: Use `batchMintGardens()` instead of multiple `mintGarden()` calls
- **Gas Savings**: ~40% compared to individual calls
- **Maximum Batch**: 10 gardens (stay within block gas limit)

### 2. String Optimization

**Recommendations**:
- Store large content on IPFS, use CIDs in contracts
- Keep on-chain strings under 100 characters when possible
- Use bytes32 for fixed-length identifiers

### 3. Array Management

**Best Practices**:
- Keep arrays under 100 elements
- Use mappings for large datasets
- Consider pagination for user-facing arrays

### 4. Unchecked Arithmetic

**Used in**:
- Loop counters (when overflow impossible)
- Batch token ID increments
- **Savings**: ~50-100 gas per operation

```solidity
for (uint256 i = 0; i < length;) {
    // ... operation ...
    unchecked { ++i; }  // Save gas on counter increment
}
```

## Block Gas Limit Considerations

### Network Gas Limits

| Network | Block Gas Limit | Recommendation |
|---------|----------------|----------------|
| Ethereum | ~30M | Keep transactions < 10M gas |
| Arbitrum | ~1.2B (soft) | Higher limit, but optimize anyway |
| Base | ~30M | Keep transactions < 10M gas |
| Celo | ~20M | Keep transactions < 8M gas |

### Transaction Size Guidelines

| Operation Type | Max Recommended Gas | Reason |
|---------------|---------------------|---------|
| User Operations | < 500K | Mobile wallet friendly |
| Batch Operations | < 10M | Block inclusion safety |
| Admin Operations | < 1M | Reasonable for governance |

## Gas Profiling Commands

### Generate Gas Report

```bash
# Full gas report
forge test --gas-report

# Save to file
forge test --gas-report > gas-report.txt

# Focus on specific contract
forge test --match-contract GardenToken --gas-report
```

### Analyze Specific Functions

```bash
# Test with gas tracking
forge test --match-test testMintGarden -vvv

# Profile a specific scenario
forge test --match-test testBatchMintGardens --gas-report
```

## Cost Estimates (Mainnet)

Assuming gas price of 30 gwei and ETH at $3000:

| Operation | Gas | Cost (USD) |
|-----------|-----|-----------|
| Mint Single Garden | 600K | ~$54 |
| Batch Mint 10 Gardens | 6M | ~$540 ($54/garden) |
| Register Action | 250K | ~$22.50 |
| Submit Work (EAS) | 150K | ~$13.50 |
| Approve Work (EAS) | 180K | ~$16.20 |

**Note**: L2 networks (Arbitrum, Base) typically have 10-100x lower costs.

## Monitoring and Alerts

### Recommended Monitoring

1. **Transaction Gas Usage**: Alert if > 80% of block limit
2. **Failed Transactions**: Track out-of-gas failures
3. **Gas Price Trends**: Optimize deployment timing
4. **Array Sizes**: Monitor actual usage vs limits

### Gas Optimization Checklist

Before production deployment:

- [ ] Run gas profiling on all major functions
- [ ] Verify array limits prevent out-of-gas
- [ ] Test batch operations at maximum size
- [ ] Confirm transactions work at peak gas prices
- [ ] Document gas costs for user-facing operations
- [ ] Set up gas usage monitoring
- [ ] Plan for gas price volatility

## Future Optimizations

Potential areas for further gas reduction:

1. **Storage Packing**: Pack multiple values into single slots
2. **Event Optimization**: Minimize indexed parameters
3. **Assembly**: Critical path optimization for hot functions
4. **Proxy Patterns**: Consider beacon proxies for multiple instances
5. **Batch Processing**: Extend batching to more operations

## References

- [Solidity Gas Optimization Techniques](https://github.com/iskdrews/awesome-solidity-gas-optimization)
- [Foundry Gas Tracking](https://book.getfoundry.sh/forge/gas-tracking)
- [EIP-2930: Access Lists](https://eips.ethereum.org/EIPS/eip-2930)

## Contact

For gas optimization questions or concerns, please file an issue on the GitHub repository.

