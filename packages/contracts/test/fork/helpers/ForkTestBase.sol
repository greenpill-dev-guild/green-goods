// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { DeploymentBase } from "../../helpers/DeploymentBase.sol";
import { ERC6551Helper } from "../../helpers/ERC6551Helper.sol";
import { GardensV2Addresses } from "./GardensV2Addresses.sol";

import { GardenToken } from "../../../src/tokens/Garden.sol";
import { ActionRegistry, Capital, Domain } from "../../../src/registries/Action.sol";
import { IHatsModule } from "../../../src/interfaces/IHatsModule.sol";
import { IGardensModule } from "../../../src/interfaces/IGardensModule.sol";
import { MockERC20 } from "../../../src/mocks/ERC20.sol";

/// @title ForkTestBase
/// @notice Shared base contract for fork tests. Provides multi-chain fork setup,
/// full-stack deployment against real EAS, and garden lifecycle helpers.
/// @dev Inherits DeploymentBase (production deployment logic) and ERC6551Helper
/// (canonical ERC6551 registry deployment). Test contracts should inherit this
/// and call _tryChainFork() + _deployFullStackOnFork() in setUp or per-test.
abstract contract ForkTestBase is DeploymentBase, ERC6551Helper {
    // ═══════════════════════════════════════════════════════════════════════════
    // Constants
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Hats Protocol canonical address (same on all EVM chains)
    address internal constant HATS_PROTOCOL = 0x3bc1A0Ad72417f2d411118085256fC53CBdDd137;

    // ═══════════════════════════════════════════════════════════════════════════
    // Test Actors
    // ═══════════════════════════════════════════════════════════════════════════

    address internal forkOwner;
    address internal forkOperator;
    address internal forkGardener;
    address internal forkEvaluator;
    address internal forkNonMember;

    // ═══════════════════════════════════════════════════════════════════════════
    // Community Token
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Mock ERC20 used as community token for garden minting
    MockERC20 internal communityToken;

    /// @notice Mock ERC20 used as GOODS token for Gardens V2 community staking
    MockERC20 internal goodsToken;

    // ═══════════════════════════════════════════════════════════════════════════
    // Fork State
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Whether a fork was successfully created
    bool internal forkActive;

    // ═══════════════════════════════════════════════════════════════════════════
    // Fork Setup
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Try to create a fork for the given chain
    /// @param chainName One of: "sepolia", "arbitrum", "celo"
    /// @return success True if fork was created and selected
    function _tryChainFork(string memory chainName) internal returns (bool success) {
        string memory rpc = _resolveRpcUrl(chainName);
        if (bytes(rpc).length == 0) return false;

        uint256 forkId = vm.createFork(rpc);
        vm.selectFork(forkId);
        forkActive = true;
        return true;
    }

    /// @notice Resolve RPC URL for a chain name from environment variables
    /// @dev Tries {CHAIN}_RPC_URL first, then {CHAIN}_RPC as fallback
    /// @param chainName The chain identifier (e.g., "sepolia", "arbitrum")
    /// @return rpc The resolved RPC URL, or empty string if not found
    function _resolveRpcUrl(string memory chainName) internal returns (string memory rpc) {
        // Convert chain name to uppercase env var prefix
        string memory envPrefix = _toUpperSnakeCase(chainName);

        // Try {CHAIN}_RPC_URL first
        string memory primaryVar = string.concat(envPrefix, "_RPC_URL");
        try vm.envString(primaryVar) returns (string memory value) {
            if (bytes(value).length > 0) return value;
        } catch { }

        // Fallback: try {CHAIN}_RPC
        string memory fallbackVar = string.concat(envPrefix, "_RPC");
        try vm.envString(fallbackVar) returns (string memory value) {
            if (bytes(value).length > 0) return value;
        } catch { }

        return "";
    }

    /// @notice Convert a chain name to uppercase snake case for env var lookup
    /// @dev "sepolia" → "SEPOLIA", "arbitrum" → "ARBITRUM"
    function _toUpperSnakeCase(string memory input) internal pure returns (string memory) {
        bytes memory b = bytes(input);
        bytes memory result = new bytes(b.length);
        for (uint256 i = 0; i < b.length; i++) {
            // Convert lowercase a-z to uppercase A-Z
            if (b[i] >= 0x61 && b[i] <= 0x7A) {
                result[i] = bytes1(uint8(b[i]) - 32);
            } else {
                result[i] = b[i];
            }
        }
        return string(result);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Full Stack Deployment
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Deploy the full protocol stack on the current fork
    /// @dev Must be called after _tryChainFork() succeeds. Deploys ERC6551 registry,
    /// community token, and the entire protocol stack using production deployment logic.
    function _deployFullStackOnFork() internal {
        // 1. Set up test actors
        forkOwner = address(this);
        forkOperator = makeAddr("forkOperator");
        forkGardener = makeAddr("forkGardener");
        forkEvaluator = makeAddr("forkEvaluator");
        forkNonMember = makeAddr("forkNonMember");

        // 2. Deploy ERC6551 registry at canonical address (needed BEFORE GardenToken)
        _deployERC6551Registry();

        // 3. Deploy community token
        communityToken = new MockERC20();

        // 4. Deploy full stack using production deployment logic
        // DeploymentBase.deployFullStack() handles everything:
        // - EAS addresses from _getEASForChain()
        // - All CREATE2 deployments
        // - Schema registration
        // - Module wiring
        deployFullStack(address(communityToken), address(this));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Gardens V2 Configuration
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Configure GardensModule with real Gardens V2 addresses for the current fork chain.
    /// @dev Must be called AFTER _deployFullStackOnFork() and BEFORE _mintTestGarden().
    ///      1. Resolves the RegistryFactory for block.chainid from GardensV2Addresses
    ///      2. Calls gardensModule.setRegistryFactory() if non-zero
    ///      3. Deploys a new MockERC20 as goodsToken
    ///      4. Calls gardensModule.setGoodsToken() with the deployed token
    function _configureRealGardensV2() internal {
        // 1. Set real RegistryFactory if available for this chain
        address factory = GardensV2Addresses.getRegistryFactory(block.chainid);
        if (factory != address(0)) {
            gardensModule.setRegistryFactory(factory);
        }

        // 2. Deploy GOODS token and configure on GardensModule
        goodsToken = new MockERC20();
        gardensModule.setGoodsToken(address(goodsToken));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Garden Lifecycle Helpers
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Mint a test garden with sensible defaults
    /// @param name The garden name
    /// @param domainMask Bitmask of enabled domains (bit 0=Solar, 1=Agro, 2=Edu, 3=Waste)
    /// @return gardenAccount The address of the created garden TBA
    function _mintTestGarden(string memory name, uint8 domainMask) internal returns (address gardenAccount) {
        GardenToken.GardenConfig memory config = GardenToken.GardenConfig({
            communityToken: address(communityToken),
            name: name,
            description: "Fork test garden",
            location: "Test Location",
            bannerImage: "ipfs://QmTest",
            metadata: "",
            openJoining: false,
            weightScheme: IGardensModule.WeightScheme.Linear,
            domainMask: domainMask
        });
        return gardenToken.mintGarden(config);
    }

    /// @notice Grant a garden role to a user via HatsModule
    /// @param garden The garden account address
    /// @param user The user to grant the role to
    /// @param role The GardenRole to grant
    function _grantGardenRole(address garden, address user, IHatsModule.GardenRole role) internal {
        hatsModule.grantRole(garden, user, role);
    }

    /// @notice Track next expected action UID (mirrors ActionRegistry._nextActionUID)
    uint256 private _expectedNextActionUID;

    /// @notice Register a test action in the ActionRegistry
    /// @return actionUID The UID of the newly registered action
    function _registerTestAction() internal returns (uint256 actionUID) {
        actionUID = _expectedNextActionUID++;

        Capital[] memory capitals = new Capital[](2);
        capitals[0] = Capital.LIVING;
        capitals[1] = Capital.SOCIAL;

        actionRegistry.registerAction(
            block.timestamp,
            block.timestamp + 90 days,
            "Fork Test Action",
            "agro.fork_test",
            "ipfs://QmForkTestInstructions",
            capitals,
            new string[](0),
            Domain.AGRO
        );
    }
}
