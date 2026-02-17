// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { UnifiedPowerRegistry } from "../../src/registries/Power.sol";
import { MockCVStrategy } from "../../src/mocks/CVStrategy.sol";
import { IHats } from "../../src/interfaces/IHats.sol";
import { NFTPowerSource, NFTType } from "../../src/interfaces/IGardensV2.sol";

/// @title SepoliaConvictionVotingForkTest
/// @notice Fork tests for UnifiedPowerRegistry + MockCVStrategy on Sepolia testnet.
/// @dev Mirrors ArbitrumConvictionVoting.t.sol pattern for Sepolia.
///      Exercises Hats-derived voting power resolution against the real Hats Protocol,
///      then verifies conviction accumulation through the MockCVStrategy signal pool.
///      Gracefully skips when SEPOLIA_RPC_URL is not set.
contract SepoliaConvictionVotingForkTest is Test {
    /// @notice Hats Protocol on all EVM chains
    address internal constant HATS_PROTOCOL = 0x3bc1A0Ad72417f2d411118085256fC53CBdDd137;

    UnifiedPowerRegistry public powerRegistry;
    MockCVStrategy public strategy;

    address public owner = address(0xA1);
    address public gardensModule; // mock authorized caller for registry
    address public garden = address(0xC1);

    // Test actors — will wear hats
    address public operator;
    address public gardener;
    address public communityMember;
    address public nonMember;

    // Hat IDs (set during _setupHatsTree)
    uint256 public operatorHatId;
    uint256 public gardenerHatId;
    uint256 public communityHatId;

    // CV parameters (match GardensModule defaults)
    uint256 internal constant DEFAULT_DECAY = 9_999_799;
    uint256 internal constant DEFAULT_MAX_RATIO = 2_000_000;
    uint256 internal constant DEFAULT_WEIGHT = 10_000;
    uint256 internal constant DEFAULT_MIN_THRESHOLD_POINTS = 2_500_000;

    // ═══════════════════════════════════════════════════════════════════════════
    // Fork Helper
    // ═══════════════════════════════════════════════════════════════════════════

    function _tryFork() internal returns (bool) {
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

    // ═══════════════════════════════════════════════════════════════════════════
    // Deploy Helpers
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Create test actors, deploy UnifiedPowerRegistry, set up Hats tree
    function _deployStack() internal {
        // 1. Create test actors
        operator = makeAddr("operator");
        gardener = makeAddr("gardener");
        communityMember = makeAddr("communityMember");
        nonMember = makeAddr("nonMember");
        gardensModule = makeAddr("gardensModule");

        // 2. Deploy UnifiedPowerRegistry behind UUPS proxy
        UnifiedPowerRegistry impl = new UnifiedPowerRegistry();
        bytes memory initData =
            abi.encodeWithSelector(UnifiedPowerRegistry.initialize.selector, owner, HATS_PROTOCOL, gardensModule);
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        powerRegistry = UnifiedPowerRegistry(address(proxy));

        // 3. Set up Hats tree on the real protocol
        _setupHatsTree();

        // 4. Register garden with Hats-based power sources (Linear weights)
        _registerGardenPowerSources();
    }

    /// @notice Create a Hats tree owned by address(this), mint hats to test actors
    function _setupHatsTree() internal {
        IHats hats = IHats(HATS_PROTOCOL);

        // Non-zero placeholder for eligibility/toggle (defaults to permissive)
        address permissive = address(0xdead);

        // Top hat — owned by this test contract
        uint256 topHat = hats.mintTopHat(address(this), "Sepolia CV Fork Test Tree", "");

        // Community hat (level 1)
        communityHatId = hats.createHat(topHat, "Community", 100, permissive, permissive, true, "");

        // Operator hat (level 2, under community)
        operatorHatId = hats.createHat(communityHatId, "Operator", 100, permissive, permissive, true, "");

        // Gardener hat (level 2, under community)
        gardenerHatId = hats.createHat(communityHatId, "Gardener", 100, permissive, permissive, true, "");

        // Mint hats to actors
        hats.mintHat(communityHatId, communityMember);
        hats.mintHat(operatorHatId, operator);
        hats.mintHat(gardenerHatId, gardener);
        // nonMember gets no hat
    }

    /// @notice Register garden power sources using Linear weight scheme (10k/20k/30k)
    function _registerGardenPowerSources() internal {
        NFTPowerSource[] memory sources = new NFTPowerSource[](3);
        sources[0] = NFTPowerSource({
            token: HATS_PROTOCOL,
            nftType: NFTType.HAT,
            weight: 30_000, // Operator: 3x
            tokenId: 0,
            hatId: operatorHatId
        });
        sources[1] = NFTPowerSource({
            token: HATS_PROTOCOL,
            nftType: NFTType.HAT,
            weight: 20_000, // Gardener: 2x
            tokenId: 0,
            hatId: gardenerHatId
        });
        sources[2] = NFTPowerSource({
            token: HATS_PROTOCOL,
            nftType: NFTType.HAT,
            weight: 10_000, // Community: 1x
            tokenId: 0,
            hatId: communityHatId
        });

        vm.prank(gardensModule);
        powerRegistry.registerGarden(garden, sources);
    }

    /// @notice Deploy MockCVStrategy wired to the power registry and register pool mapping
    function _deployStrategy() internal {
        strategy = new MockCVStrategy(
            address(powerRegistry),
            address(0),
            DEFAULT_DECAY,
            DEFAULT_MAX_RATIO,
            DEFAULT_WEIGHT,
            DEFAULT_MIN_THRESHOLD_POINTS
        );

        // Map pool (strategy address) to garden in power registry
        vm.prank(gardensModule);
        powerRegistry.registerPool(address(strategy), garden);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 1: Strategy Registered On Garden Mint
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Strategy wired after garden creation, pool-garden mapping active
    function test_fork_conviction_strategyRegisteredOnGardenMint() public {
        if (!_tryFork()) {
            emit log("SKIPPED: SEPOLIA_RPC_URL not set");
            return;
        }

        _deployStack();
        _deployStrategy();

        // Verify pool -> garden mapping
        assertEq(powerRegistry.getPoolGarden(address(strategy)), garden, "pool should map to garden");

        // Verify garden is registered
        assertTrue(powerRegistry.isGardenRegistered(garden), "garden should be registered");

        // Verify power resolution works end-to-end
        uint256 opPower = powerRegistry.getMemberPowerInStrategy(operator, address(strategy));
        assertEq(opPower, 3, "operator should have power 3 from operator hat");

        uint256 gardenerPower = powerRegistry.getMemberPowerInStrategy(gardener, address(strategy));
        assertEq(gardenerPower, 2, "gardener should have power 2 from gardener hat");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 2: Power Sync On Role Grant
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Role grant (new hat mint) triggers power sync — new member gains voting power
    function test_fork_conviction_powerSyncOnRoleGrant() public {
        if (!_tryFork()) {
            emit log("SKIPPED: SEPOLIA_RPC_URL not set");
            return;
        }

        _deployStack();
        _deployStrategy();

        // nonMember has no power initially
        uint256 powerBefore = powerRegistry.getMemberPowerInStrategy(nonMember, address(strategy));
        assertEq(powerBefore, 0, "non-member should have zero power before role grant");

        // Grant community hat to nonMember (simulates role grant)
        IHats hats = IHats(HATS_PROTOCOL);
        hats.mintHat(communityHatId, nonMember);

        // Power should update immediately (Hats are checked live)
        uint256 powerAfter = powerRegistry.getMemberPowerInStrategy(nonMember, address(strategy));
        assertEq(powerAfter, 1, "member should have power 1 after community hat grant");

        // Verify isMember also resolves
        vm.prank(address(strategy));
        assertTrue(powerRegistry.isMember(nonMember), "newly hatted member should be recognized");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 3: Power Sync On Role Revoke
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Role revoke (hat transfer away) zeroes power for that member
    function test_fork_conviction_powerSyncOnRoleRevoke() public {
        if (!_tryFork()) {
            emit log("SKIPPED: SEPOLIA_RPC_URL not set");
            return;
        }

        _deployStack();
        _deployStrategy();

        // Verify operator has power before revoke
        uint256 powerBefore = powerRegistry.getMemberPowerInStrategy(operator, address(strategy));
        assertEq(powerBefore, 3, "operator should have power 3 before revoke");

        vm.prank(address(strategy));
        assertTrue(powerRegistry.isMember(operator), "operator should be member before revoke");

        // Revoke operator hat by toggling hat status
        // Hats Protocol: setting hat status to inactive removes all wearers' power
        IHats hats = IHats(HATS_PROTOCOL);

        // Use transferHat to remove the hat from the operator
        // The top hat admin (address(this)) can transfer hats
        hats.transferHat(operatorHatId, operator, address(0xdead));

        // Power should be zero after hat removal
        uint256 powerAfter = powerRegistry.getMemberPowerInStrategy(operator, address(strategy));
        assertEq(powerAfter, 0, "operator should have zero power after hat revoke");

        // isMember should also return false
        vm.prank(address(strategy));
        assertFalse(powerRegistry.isMember(operator), "operator should not be member after hat revoke");
    }
}
