// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";

/// @title SepoliaHypercertsForkTest
/// @notice Fork tests for Hypercert deployments and cross-chain minter consistency.
contract SepoliaHypercertsForkTest is Test {
    address internal constant EXPECTED_HYPERCERT_MINTER = 0x822F17A9A5EeCFd66dBAFf7946a8071C265D1d07;

    // Canonical hypercert minter used across supported chains
    address internal constant ARBITRUM_HYPERCERT_MINTER = 0x822F17A9A5EeCFd66dBAFf7946a8071C265D1d07;
    address internal constant CELO_HYPERCERT_MINTER = 0x822F17A9A5EeCFd66dBAFf7946a8071C265D1d07;
    address internal constant SEPOLIA_HYPERCERT_MINTER = 0x822F17A9A5EeCFd66dBAFf7946a8071C265D1d07;

    function _tryForkSepolia() internal returns (bool) {
        string memory rpc;
        try vm.envString("SEPOLIA_RPC_URL") returns (string memory value) {
            rpc = value;
        } catch {
            try vm.envString("SEPOLIA_RPC") returns (string memory fallback_) {
                rpc = fallback_;
            } catch {
                return false;
            }
        }
        if (bytes(rpc).length == 0) return false;

        uint256 forkId = vm.createFork(rpc);
        vm.selectFork(forkId);
        return true;
    }

    function test_fork_sepoliaHypercertMinterIsDeployed() public {
        if (!_tryForkSepolia()) {
            emit log("SKIPPED: SEPOLIA_RPC_URL not set");
            return;
        }

        assertEq(SEPOLIA_HYPERCERT_MINTER, EXPECTED_HYPERCERT_MINTER, "sepolia minter address mismatch");
        assertGt(SEPOLIA_HYPERCERT_MINTER.code.length, 0, "HypercertMinter should be deployed on Sepolia");
    }

    function test_hypercertMinterAddressIsConsistentAcrossChains() public pure {
        assertEq(ARBITRUM_HYPERCERT_MINTER, EXPECTED_HYPERCERT_MINTER, "arbitrum minter mismatch");
        assertEq(CELO_HYPERCERT_MINTER, EXPECTED_HYPERCERT_MINTER, "celo minter mismatch");
        assertEq(SEPOLIA_HYPERCERT_MINTER, EXPECTED_HYPERCERT_MINTER, "sepolia minter mismatch");
    }
}
