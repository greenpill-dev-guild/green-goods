// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";

import { IRouterClient } from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import { NetworkSelectors } from "../../script/lib/NetworkSelectors.sol";

interface ITypeAndVersion {
    function typeAndVersion() external view returns (string memory);
}

/// @title CrossChainSettlementLaneForkTest
/// @notice Read-only proof that the Arbitrum One <-> Celo Mainnet CCIP lane is live, against the
///         real routers on forks of both chains.
/// @dev The cheapest possible de-risking of the settlement lane (PRD-686): no broadcast, no
///      deployment, no funds. It converts "Chainlink's directory says the lane is published" into
///      an on-chain fact, and it can run today — long before any settlement contract exists.
///
///      Nothing here is a settlement contract. `Commitment.settlementEnabled` and
///      `settlementAdapter` are reserved MVP fields that are always false and zero, and
///      `RewardRail.CeloSettlement` is an enum value the module deliberately refuses in
///      `recordRewardPaid`. This test is about the transport those contracts will eventually sit
///      on, not about the contracts.
///
///      Router addresses and chain selectors are read from `deployments/networks.json` rather than
///      hardcoded here, so a passing run proves the *configured* values are the live ones. A
///      hardcoded copy could pass while the config that ships is wrong.
///
///      What this cannot prove, and what no fork can: DON liveness, real delivery latency,
///      destination gas under congestion, and the Safe/Zodiac signer ceremony. Those need one real
///      message-only ping on the live lane, and a human process.
contract CrossChainSettlementLaneForkTest is Test {
    /// @dev Message-only settlement is the shape this lane will carry; a gas limit large enough
    ///      for a receiver to record a payout, and no token transfer.
    uint256 internal constant RECEIVER_GAS_LIMIT = 200_000;

    uint256 internal arbForkId;
    uint256 internal celoForkId;

    address internal arbRouter;
    address internal celoRouter;
    uint64 internal arbSelector;
    uint64 internal celoSelector;
    uint256 internal arbChainId;
    uint256 internal celoChainId;

    bool internal forked;

    function setUp() public {
        _readLaneConfig();
        forked = _tryDualFork();

        // Said out loud because the alternative is the worst kind of green: every liveness
        // assertion below no-ops without a fork, so a silent skip would read as a passing lane.
        if (forked) {
            emit log("settlement lane: forked Arbitrum One and Celo Mainnet; liveness assertions are live");
        } else {
            emit log("settlement lane: SKIPPED - set ARBITRUM_RPC_URL and CELO_RPC_URL to verify the lane");
        }
    }

    // ─────────────────────────────── Lane liveness ───────────────────────────────

    /// @notice Both configured addresses are real CCIP routers, not stale or wrong entries.
    /// @dev Bytecode alone would pass for any contract; `typeAndVersion` is what makes this an
    ///      assertion about a Router rather than about an address that happens to be occupied.
    function testConfiguredAddressesAreRealCcipRouters() public {
        if (!forked) return;

        vm.selectFork(arbForkId);
        _assertIsRouter(arbRouter, "arbitrum");

        vm.selectFork(celoForkId);
        _assertIsRouter(celoRouter, "celo");
    }

    /// @notice Both forks are the chains this lane is about.
    /// @dev A `CELO_RPC_URL` pointing at the wrong network would otherwise verify some other
    ///     chain's lane and report it as Celo's. Chain IDs come from the same config as the
    ///     routers, so this also catches a router recorded under the wrong network entry.
    function testForksAreTheConfiguredChains() public {
        if (!forked) return;

        vm.selectFork(arbForkId);
        assertEq(block.chainid, arbChainId, "ARBITRUM_RPC_URL is not Arbitrum One");

        vm.selectFork(celoForkId);
        assertEq(block.chainid, celoChainId, "CELO_RPC_URL is not Celo Mainnet");
    }

    /// @notice Each router accepts the other chain as a destination.
    function testLaneIsSupportedInBothDirections() public {
        if (!forked) return;

        vm.selectFork(arbForkId);
        assertTrue(
            IRouterClient(arbRouter).isChainSupported(celoSelector),
            "Arbitrum One router does not support the configured Celo selector"
        );

        vm.selectFork(celoForkId);
        assertTrue(
            IRouterClient(celoRouter).isChainSupported(arbSelector),
            "Celo Mainnet router does not support the configured Arbitrum selector"
        );
    }

    /// @notice A bogus selector is rejected, so the assertions above mean something.
    /// @dev Without this control, `isChainSupported` returning true proves nothing — a router that
    ///      answered true for everything would satisfy the test above just as well.
    function testUnsupportedSelectorIsRejected() public {
        if (!forked) return;

        vm.selectFork(arbForkId);
        assertFalse(
            IRouterClient(arbRouter).isChainSupported(type(uint64).max),
            "router claims to support an unassigned chain selector"
        );
    }

    /// @notice The lane is priced, not merely flagged supported.
    /// @dev `getFee` runs the router's real fee logic against the live fee quoter. A lane that is
    ///      registered but has no working price feed fails here rather than at broadcast time.
    function testLaneQuotesANonZeroFeeInBothDirections() public {
        if (!forked) return;

        vm.selectFork(arbForkId);
        uint256 arbToCelo = IRouterClient(arbRouter).getFee(celoSelector, _settlementShapedMessage());
        assertGt(arbToCelo, 0, "Arbitrum One -> Celo Mainnet quoted a zero fee");

        vm.selectFork(celoForkId);
        uint256 celoToArb = IRouterClient(celoRouter).getFee(arbSelector, _settlementShapedMessage());
        assertGt(celoToArb, 0, "Celo Mainnet -> Arbitrum One quoted a zero fee");

        emit log_named_uint("arbitrum -> celo fee (wei, native)", arbToCelo);
        emit log_named_uint("celo -> arbitrum fee (wei, native)", celoToArb);
    }

    // ─────────────────────────────── Config integrity ───────────────────────────────

    /// @notice Neither side of the lane is left unconfigured.
    /// @dev Celo's router and selector were both zero until this lane was verified; a zero here
    ///      means someone reverted the config, and every assertion above would pass vacuously
    ///      against `address(0)` if the fork were unavailable.
    function testLaneConfigIsPopulatedOnBothSides() public {
        assertTrue(arbRouter != address(0), "networks.json: arbitrum.contracts.ccipRouter is zero");
        assertTrue(celoRouter != address(0), "networks.json: celo.contracts.ccipRouter is zero");
        assertTrue(arbSelector != 0, "networks.json: arbitrum.ccipChainSelector is zero");
        assertTrue(celoSelector != 0, "networks.json: celo.ccipChainSelector is zero");
        assertTrue(arbSelector != celoSelector, "the two chains cannot share a selector");
    }

    // ───────────────────────────────── Helpers ─────────────────────────────────

    function _assertIsRouter(address router, string memory label) private {
        assertGt(router.code.length, 0, string.concat(label, ": configured ccipRouter has no bytecode"));

        string memory version = ITypeAndVersion(router).typeAndVersion();
        assertTrue(
            _startsWith(version, "Router"), string.concat(label, ": configured address is not a CCIP Router, got ", version)
        );
    }

    function _startsWith(string memory value, string memory prefix) private pure returns (bool) {
        bytes memory valueBytes = bytes(value);
        bytes memory prefixBytes = bytes(prefix);
        if (valueBytes.length < prefixBytes.length) return false;

        for (uint256 i = 0; i < prefixBytes.length; i++) {
            if (valueBytes[i] != prefixBytes[i]) return false;
        }
        return true;
    }

    /// @dev Message-only and zero-value: the shape a settlement acknowledgment takes. No token
    ///      transfer, so this quotes the transport alone.
    function _settlementShapedMessage() private pure returns (Client.EVM2AnyMessage memory) {
        return Client.EVM2AnyMessage({
            receiver: abi.encode(address(0xdEaD)),
            data: abi.encode(uint256(1), uint256(2)),
            tokenAmounts: new Client.EVMTokenAmount[](0),
            feeToken: address(0),
            extraArgs: Client._argsToBytes(Client.EVMExtraArgsV1({ gasLimit: RECEIVER_GAS_LIMIT }))
        });
    }

    /// @dev Reads the shipped config so the test asserts about what deploys, not about a copy.
    function _readLaneConfig() private {
        string memory json = vm.readFile(string.concat(vm.projectRoot(), "/deployments/networks.json"));

        arbRouter = abi.decode(vm.parseJson(json, ".networks.arbitrum.contracts.ccipRouter"), (address));
        celoRouter = abi.decode(vm.parseJson(json, ".networks.celo.contracts.ccipRouter"), (address));
        // Base-10 strings, not JSON numbers — see `testSelectorsAreStoredAsExactStrings`.
        arbSelector = _selector(json, ".networks.arbitrum");
        celoSelector = _selector(json, ".networks.celo");
        arbChainId = abi.decode(vm.parseJson(json, ".networks.arbitrum.chainId"), (uint256));
        celoChainId = abi.decode(vm.parseJson(json, ".networks.celo.chainId"), (uint256));
    }

    /// @dev Delegates to the parser deployment code uses. This file previously had its own copy,
    ///      so a review could mutate `DeployHelper`'s parse to return a wrong selector and all six
    ///      lane tests still passed — verifying a selector no deploy would ever read.
    function _selector(string memory json, string memory networkKey) private pure returns (uint64) {
        return NetworkSelectors.readCcipChainSelector(json, networkKey);
    }

    /// @dev Skips rather than fails when either RPC is missing, matching `CrossChainENS.t.sol`.
    function _tryDualFork() private returns (bool) {
        string memory arbRpc = _rpcUrl("ARBITRUM_RPC_URL");
        string memory celoRpc = _rpcUrl("CELO_RPC_URL");
        if (bytes(arbRpc).length == 0 || bytes(celoRpc).length == 0) return false;

        arbForkId = vm.createFork(arbRpc);
        celoForkId = vm.createFork(celoRpc);
        return true;
    }

    function _rpcUrl(string memory key) private view returns (string memory url) {
        try vm.envString(key) returns (string memory value) {
            url = value;
        } catch {
            url = "";
        }
    }
}
