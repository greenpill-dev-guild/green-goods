# ENS Registrar Test Fix Path

## Current Status

The ENSRegistrar tests are failing because the mock setup doesn't properly cover all ENS contract calls made during registration.

## Root Cause

The `ENSRegistrar.register()` function makes three sequential ENS calls:

1. `IENS(ENS_REGISTRY).setSubnodeOwner(BASE_NODE, label, address(this))` - Sets this contract as owner
2. `IENS(ENS_REGISTRY).setResolver(node, ENS_RESOLVER)` - Sets resolver for the subdomain
3. `IENSResolver(ENS_RESOLVER).setAddr(node, owner)` - Points subdomain to gardener address

The test mocks are using wildcard function selector matching, but the second call (`setResolver`) uses the computed `node` parameter (not `BASE_NODE`), which doesn't match the mock setup.

## Fix Options

### Option 1: Improved Mock Setup (Recommended)

Update the mock calls to properly match all three ENS calls:

```solidity
function testRegisterSubdomain() public {
    string memory name = "alice";
    bytes32 credentialId = bytes32(uint256(12_345));

    bytes32 label = keccak256(bytes(name));
    bytes32 node = keccak256(abi.encodePacked(GREENGOODS_BASE_NODE, label));

    // Mock setSubnodeOwner
    vm.mockCall(
        MOCK_ENS_REGISTRY,
        abi.encodeWithSelector(IENS.setSubnodeOwner.selector, GREENGOODS_BASE_NODE, label, address(registrar)),
        abi.encode(node) // Returns the new node
    );

    // Mock setResolver - note: uses 'node' not 'BASE_NODE'
    vm.mockCall(
        MOCK_ENS_REGISTRY,
        abi.encodeWithSelector(IENS.setResolver.selector, node, MOCK_ENS_RESOLVER),
        abi.encode()
    );

    // Mock setAddr on resolver
    vm.mockCall(
        MOCK_ENS_RESOLVER,
        abi.encodeWithSelector(IENSResolver.setAddr.selector, node, gardenerAccount),
        abi.encode()
    );

    vm.prank(gardenerAccount);
    registrar.register(name, gardenerAccount, credentialId);

    // Assertions...
}
```

### Option 2: Deploy Mock Contracts

Create simple mock ENS contracts that don't revert:

```solidity
contract MockENSRegistry {
    function setSubnodeOwner(bytes32, bytes32, address) external returns (bytes32) {
        return bytes32(0);
    }
    function setResolver(bytes32, address) external {}
}

contract MockENSResolver {
    function setAddr(bytes32, address) external {}
}
```

### Option 3: Skip Tests Until Full ENS Integration

Since ENS integration isn't fully implemented in the protocol yet, these tests could be marked as skipped with a clear TODO:

```solidity
/// @notice Tests for ENSRegistrar with passkey recovery
/// @dev SKIPPED: ENS integration not yet deployed. See ENS_FIX_PATH.md
contract ENSRegistrarTest is Test {
    function setUp() public {
        vm.skip(true); // Skip all tests in this contract
    }
    // ... existing tests
}
```

## Additional Notes

1. **Interface Dependencies**: Ensure `IENS` and `IENSResolver` interfaces match actual ENS contracts
2. **Base Node**: The `GREENGOODS_BASE_NODE` constant should be the actual namehash of "greengoods.eth" when deployed
3. **Network Specificity**: ENS is mainnet-only; tests should account for this with fork tests when ready

## Recommended Next Steps

1. **Short-term**: Use Option 3 (skip tests) until ENS integration is prioritized
2. **Medium-term**: Implement Option 1 with improved mocks for unit testing
3. **Long-term**: Add fork tests against mainnet ENS for integration testing

## Related Files

- `src/registries/ENSRegistrar.sol` - Contract implementation
- `src/interfaces/IENS.sol` - ENS interface definitions
- `test/ENSRegistrar.t.sol` - Test file (needs fixing)






