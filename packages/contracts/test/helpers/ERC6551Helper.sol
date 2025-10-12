// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC6551Registry } from "../../lib/tokenbound/lib/erc6551/src/ERC6551Registry.sol";
import { TOKENBOUND_REGISTRY } from "../../src/Constants.sol";

error ERC6551RegistryNotDeployed();

/// @title ERC6551Helper
/// @notice Test helper to deploy ERC6551 registry at canonical Tokenbound address
/// @dev Uses vm.etch to deploy registry at 0x000000006551c19487814612e58FE06813775758
abstract contract ERC6551Helper is Test {
    /// @notice Deploys ERC6551 Registry at canonical Tokenbound address for testing
    /// @dev This must be called in setUp() before any operations that interact with TBAs
    function _deployERC6551Registry() internal {
        // Deploy a temporary instance to get the runtime bytecode
        ERC6551Registry tempRegistry = new ERC6551Registry();
        bytes memory runtimeBytecode = address(tempRegistry).code;

        // Deploy the registry at the canonical Tokenbound address using vm.etch
        vm.etch(TOKENBOUND_REGISTRY, runtimeBytecode);

        emit log_named_string("[PASS] ERC6551Helper", "Registry deployed at canonical address");
        emit log_named_address("Registry Address", TOKENBOUND_REGISTRY);
    }

    /// @notice Verifies the registry is deployed and functional
    function _verifyERC6551Registry() internal view {
        if (TOKENBOUND_REGISTRY.code.length == 0) revert ERC6551RegistryNotDeployed();
    }
}
