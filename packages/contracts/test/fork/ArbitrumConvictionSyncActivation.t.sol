// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Vm } from "forge-std/Vm.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { Metadata, ArbitrableConfig, CVParams } from "../../src/interfaces/IGardensV2.sol";
import { ICVStrategy } from "../../src/interfaces/ICVStrategy.sol";
import { ICVSyncPowerFacet } from "../../src/interfaces/ICVSyncPowerFacet.sol";
import { IGardensModule } from "../../src/interfaces/IGardensModule.sol";
import { IHatsModule } from "../../src/interfaces/IHatsModule.sol";
import { HatsModule } from "../../src/modules/Hats.sol";
import { HatsModuleUpgradeForkHarness } from "./helpers/HatsModuleUpgradeForkHarness.sol";

interface IActivationPool {
    function setAuthorizedSyncCaller(address caller, bool authorized) external;
    function isAuthorizedSyncCaller(address caller) external view returns (bool);
    function registryCommunity() external view returns (address);
    function getAllo() external view returns (address);
    function getPoolId() external view returns (uint256);
    function activatePoints() external;
    function setPoolParams(
        ArbitrableConfig calldata arbitrableConfig,
        CVParams calldata cvParams,
        uint256 sybilScoreThreshold,
        address[] calldata membersToAdd,
        address[] calldata membersToRemove,
        address superfluidToken
    )
        external;
}

interface IActivationCommunity {
    function councilSafe() external view returns (address);
    function enabledStrategies(address strategy) external view returns (bool);
    function addStrategy(address strategy) external;
    function gardenToken() external view returns (address);
    function getStakeAmountWithFees() external view returns (uint256);
    function stakeAndRegisterMember(string calldata covenant) external;
}

interface IActivationAllo {
    function registerRecipient(uint256 poolId, bytes calldata data) external payable returns (address);
    function allocate(uint256 poolId, bytes calldata data) external payable;
}

/// @dev Cheatcodes the pinned forge-std interface predates.
interface IActivationVm {
    function cool(address target) external;
    function snapshotState() external returns (uint256 snapshotId);
    function revertToState(uint256 snapshotId) external returns (bool success);
}

struct ActivationProposal {
    uint256 poolId;
    address beneficiary;
    uint256 amountRequested;
    address requestedToken;
    Metadata metadata;
}

struct ActivationSupport {
    uint256 proposalId;
    int256 deltaSupport;
}

/// @title ArbitrumConvictionSyncActivationForkTest
/// @notice Rehearses the remaining PRD-1377 sequence against every live garden: the HatsModule upgrade,
///         then each pool's council authorizing the module, then real role changes.
/// @dev Councils are pranked, not signed. The private Safe packet rehearsal proves the exact signed calls;
///      this proof discovers the gardens on chain so a garden minted after that packet cannot be missed.
contract ArbitrumConvictionSyncActivationForkTest is HatsModuleUpgradeForkHarness {
    /// @dev The Green Goods Safe is the council of every live garden community.
    address private constant COUNCIL = 0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19;
    /// @dev The existing Gardens SafeArbitrator. Live signal pools have none, so proposals need a fork-only one.
    address private constant FIXTURE_ARBITRATOR = 0x1c62F449058BbeeD546823A1a581D28233f7A69c;
    bytes4 private constant NOT_AUTHORIZED_SYNC_CALLER = bytes4(keccak256("NotAuthorizedSyncCaller(address)"));
    bytes32 private constant SYNC_TRIGGERED = keccak256("ConvictionSyncTriggered(address,address,address)");
    bytes32 private constant SYNC_FAILED = keccak256("ConvictionSyncFailed(address,address,address,string)");

    function setUp() public {
        _setUpHatsModuleUpgrade("ARBITRUM_RPC_URL", 42_161);
    }

    /// @notice The 18 November fork walk saw a failed sync on every grant. Both missing steps cause it, and
    ///         neither alone repairs it, so the upgrade must execute before the councils authorize the module.
    function testForkArbitrum_convictionSyncFailsUntilUpgradedAndAuthorized() public {
        address garden = _liveGardens()[0];
        address[2] memory pools = _signalPools(garden);
        address module = _hatsModule();

        _assertGrantSyncFailsOnBothPools(garden, pools, "live-module-unauthorized");
        vm.prank(module);
        vm.expectRevert(abi.encodeWithSelector(NOT_AUTHORIZED_SYNC_CALLER, module));
        ICVSyncPowerFacet(pools[0]).syncPower(makeAddr("live-module-unauthorized"));

        uint256 beforeAuthorization = IActivationVm(address(vm)).snapshotState();
        _authorize(pools);
        _coolSyncPath(garden, pools);
        _assertGrantSyncFailsOnBothPools(garden, pools, "live-module-authorized");
        assertTrue(IActivationVm(address(vm)).revertToState(beforeAuthorization));

        _upgradeToRehearsedImplementation();
        _assertGrantSyncFailsOnBothPools(garden, pools, "upgraded-module-unauthorized");
    }

    /// @notice After the upgrade, one authorization per pool lets every live garden's role changes reach
    ///         both of its pools.
    function testForkArbitrum_convictionSyncActivatesOnEveryLiveGarden() public {
        _upgradeToRehearsedImplementation();
        address[] memory gardens = _liveGardens();
        HatsModule module = HatsModule(_hatsModule());
        address owner = module.owner();

        uint256 authorizations;
        uint256 notEnabled;
        for (uint256 g = 0; g < gardens.length; g++) {
            address[2] memory pools = _signalPools(gardens[g]);
            authorizations += _authorize(pools);
            for (uint256 i = 0; i < 2; i++) {
                if (!_enabledInCommunity(pools[i])) notEnabled++;
            }
        }
        emit log_named_uint("live gardens", gardens.length);
        emit log_named_uint("pool authorizations", authorizations);
        // Sync does not need it, but members cannot activate points in a pool their community has not enabled.
        emit log_named_uint("pools their community has not enabled", notEnabled);

        for (uint256 g = 0; g < gardens.length; g++) {
            address garden = gardens[g];
            address[2] memory pools = _signalPools(garden);
            address member = makeAddr(string.concat("activation-member-", vm.toString(g)));

            vm.recordLogs();
            vm.prank(owner);
            module.grantRole(garden, member, IHatsModule.GardenRole.Gardener);
            _assertSyncedBothPools(vm.getRecordedLogs(), garden, member, pools);

            vm.recordLogs();
            vm.prank(owner);
            module.revokeRole(garden, member, IHatsModule.GardenRole.Gardener);
            _assertSyncedBothPools(vm.getRecordedLogs(), garden, member, pools);
            assertFalse(module.isGardenerOf(garden, member));
        }
    }

    /// @notice The newest garden was minted after the reviewed authorization packet. Once its council
    ///         authorizes the module, losing the last role still clears six stale support positions on
    ///         both deployed pools.
    function testForkArbitrum_revokingLastRoleClearsSupportOnNewestGarden() public {
        _upgradeToRehearsedImplementation();
        address[] memory gardens = _liveGardens();
        address garden = gardens[gardens.length - 1];
        address[2] memory pools = _signalPools(garden);
        HatsModule module = HatsModule(_hatsModule());
        address owner = module.owner();
        address subject = makeAddr("activation-six-proposal-stale-member");

        // Roles are granted with sync off so the stake below models support recorded before a missed hook.
        vm.startPrank(owner);
        module.grantRole(garden, subject, IHatsModule.GardenRole.Gardener);
        module.grantRole(garden, subject, IHatsModule.GardenRole.Steward);
        module.grantRole(garden, subject, IHatsModule.GardenRole.Community);
        vm.stopPrank();
        _registerFixtureMember(IActivationPool(pools[0]).registryCommunity(), subject);
        // Pool-wide totals return to where they started; other members may hold points too.
        uint256[2] memory activatedBefore;
        uint256[2] memory stakedBefore;
        for (uint256 i = 0; i < 2; i++) {
            activatedBefore[i] = _uint(pools[i], abi.encodeWithSignature("totalPointsActivated()"));
            stakedBefore[i] = _uint(pools[i], abi.encodeWithSignature("totalStaked()"));
        }
        uint256[2] memory firstProposalIds;
        for (uint256 i = 0; i < 2; i++) {
            _enableInCommunity(pools[i]);
            firstProposalIds[i] = _createSixSupportedProposals(pools[i], subject);
        }
        vm.startPrank(owner);
        module.revokeRole(garden, subject, IHatsModule.GardenRole.Steward);
        module.revokeRole(garden, subject, IHatsModule.GardenRole.Community);
        vm.stopPrank();
        vm.roll(block.number + 1_000_000);

        _authorize(pools);
        _coolSyncPath(garden, pools);
        vm.recordLogs();
        uint256 gasBefore = gasleft();
        vm.prank(owner);
        module.revokeRole{ gas: 4_200_000 }(garden, subject, IHatsModule.GardenRole.Gardener);
        emit log_named_uint("cold six-proposal revocation, both pools", gasBefore - gasleft());
        _assertSyncedBothPools(vm.getRecordedLogs(), garden, subject, pools);

        for (uint256 i = 0; i < 2; i++) {
            assertEq(_uint(pools[i], abi.encodeWithSignature("totalVoterStakePct(address)", subject)), 0);
            assertEq(_uint(pools[i], abi.encodeWithSignature("totalPointsActivated()")), activatedBefore[i]);
            assertEq(_uint(pools[i], abi.encodeWithSignature("totalStaked()")), stakedBefore[i]);
            for (uint256 id = firstProposalIds[i]; id < firstProposalIds[i] + 6; id++) {
                assertEq(ICVStrategy(pools[i]).getProposalStakedAmount(id), 0);
                assertEq(_uint(pools[i], abi.encodeWithSignature("getProposalVoterStake(uint256,address)", id, subject)), 0);
            }
            (bool hasProposal,) =
                pools[i].staticcall(abi.encodeWithSignature("voterStakedProposals(address,uint256)", subject, 0));
            assertFalse(hasProposal, "zero-support proposals must be pruned");
        }
    }

    /// @dev Both registries must name the same two pools, and only the reviewed council may authorize them.
    function _signalPools(address garden) private returns (address[2] memory pools) {
        HatsModule module = HatsModule(_hatsModule());
        address[] memory registered = IGardensModule(module.gardensModule()).getGardenSignalPools(garden);
        address[] memory strategies = module.getConvictionStrategies(garden);
        assertEq(registered.length, 2, "garden must have two signal pools");
        assertEq(keccak256(abi.encode(strategies)), keccak256(abi.encode(registered)), "Hats strategies drifted");
        for (uint256 i = 0; i < 2; i++) {
            pools[i] = registered[i];
            address community = IActivationPool(pools[i]).registryCommunity();
            assertEq(IActivationCommunity(community).councilSafe(), COUNCIL, "pool council is not the reviewed Safe");
        }
    }

    function _enabledInCommunity(address pool) private view returns (bool) {
        return IActivationCommunity(IActivationPool(pool).registryCommunity()).enabledStrategies(pool);
    }

    /// @dev Fork-only: newer gardens' communities have not enabled their pools, so members cannot activate
    ///      points there. Production needs its own reviewed council call; neither PRD-1377 batch makes it.
    function _enableInCommunity(address pool) private {
        if (_enabledInCommunity(pool)) return;
        IActivationCommunity community = IActivationCommunity(IActivationPool(pool).registryCommunity());
        vm.prank(COUNCIL);
        community.addStrategy(pool);
        assertTrue(_enabledInCommunity(pool));
    }

    function _authorize(address[2] memory pools) private returns (uint256 authorized) {
        address module = _hatsModule();
        for (uint256 i = 0; i < 2; i++) {
            assertFalse(IActivationPool(pools[i]).isAuthorizedSyncCaller(module), "live pool already authorized");
            vm.prank(COUNCIL);
            IActivationPool(pools[i]).setAuthorizedSyncCaller(module, true);
            assertTrue(IActivationPool(pools[i]).isAuthorizedSyncCaller(module));
            authorized++;
        }
    }

    /// @dev Earlier calls in this test warm the storage a real role transaction reads cold.
    function _coolSyncPath(address garden, address[2] memory pools) private {
        HatsModule module = HatsModule(_hatsModule());
        IGardensModule gardens = IGardensModule(module.gardensModule());
        IActivationVm(address(vm)).cool(address(module));
        IActivationVm(address(vm)).cool(address(module.hats()));
        IActivationVm(address(vm)).cool(gardens.getGardenCommunity(garden));
        IActivationVm(address(vm)).cool(gardens.getGardenPowerRegistry(garden));
        for (uint256 i = 0; i < 2; i++) {
            IActivationVm(address(vm)).cool(pools[i]);
        }
    }

    function _assertGrantSyncFailsOnBothPools(address garden, address[2] memory pools, string memory label) private {
        HatsModule module = HatsModule(_hatsModule());
        address member = makeAddr(label);
        vm.recordLogs();
        vm.prank(module.owner());
        module.grantRole(garden, member, IHatsModule.GardenRole.Gardener);
        assertTrue(module.isGardenerOf(garden, member), "the role grant itself must succeed");
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i = 0; i < 2; i++) {
            (uint256 triggered, uint256 failed) = _syncOutcomes(logs, garden, member, pools[i]);
            assertEq(triggered, 0, string.concat(label, ": sync must not reach the pool"));
            assertEq(failed, 1, string.concat(label, ": the module logs one failed sync per pool"));
        }
    }

    function _assertSyncedBothPools(Vm.Log[] memory logs, address garden, address member, address[2] memory pools) private {
        for (uint256 i = 0; i < 2; i++) {
            (uint256 triggered, uint256 failed) = _syncOutcomes(logs, garden, member, pools[i]);
            assertEq(failed, 0, "no failed sync once upgraded and authorized");
            assertEq(triggered, 1, "each role change syncs each pool once");
        }
    }

    function _syncOutcomes(
        Vm.Log[] memory logs,
        address garden,
        address member,
        address pool
    )
        private
        view
        returns (uint256 triggered, uint256 failed)
    {
        address module = _hatsModule();
        for (uint256 i = 0; i < logs.length; i++) {
            Vm.Log memory entry = logs[i];
            if (entry.emitter != module || entry.topics.length != 4) continue;
            if (entry.topics[1] != _topic(garden) || entry.topics[2] != _topic(member)) continue;
            if (entry.topics[3] != _topic(pool)) continue;
            if (entry.topics[0] == SYNC_TRIGGERED) triggered++;
            if (entry.topics[0] == SYNC_FAILED) failed++;
        }
    }

    function _registerFixtureMember(address community, address subject) private {
        address token = IActivationCommunity(community).gardenToken();
        uint256 stake = IActivationCommunity(community).getStakeAmountWithFees();
        deal(token, subject, stake);
        vm.startPrank(subject);
        assertTrue(IERC20(token).approve(community, stake));
        IActivationCommunity(community).stakeAndRegisterMember("");
        vm.stopPrank();
    }

    function _createSixSupportedProposals(address pool, address subject) private returns (uint256 firstId) {
        _configureFixtureArbitrator(pool);
        firstId = _uint(pool, abi.encodeWithSignature("proposalCounter()")) + 1;
        IActivationAllo allo = IActivationAllo(IActivationPool(pool).getAllo());
        uint256 poolId = IActivationPool(pool).getPoolId();
        vm.prank(subject);
        IActivationPool(pool).activatePoints();
        ActivationSupport[] memory support = new ActivationSupport[](6);
        for (uint256 i = 0; i < 6; i++) {
            ActivationProposal memory proposal = ActivationProposal({
                poolId: poolId,
                beneficiary: subject,
                amountRequested: 0,
                requestedToken: address(0),
                metadata: Metadata({ protocol: 1, pointer: "conviction-sync-activation-fork-only" })
            });
            vm.prank(subject);
            allo.registerRecipient(poolId, abi.encode(proposal));
            assertEq(ICVStrategy(pool).proposalCounter(), firstId + i);
            support[i] = ActivationSupport({ proposalId: firstId + i, deltaSupport: 1 });
        }
        vm.prank(subject);
        allo.allocate(poolId, abi.encode(support));
        assertEq(_uint(pool, abi.encodeWithSignature("totalVoterStakePct(address)", subject)), 6);
        // Prove the support is stored where the clearing assertions later read it.
        for (uint256 i = 0; i < 6; i++) {
            uint256 id = firstId + i;
            assertEq(_uint(pool, abi.encodeWithSignature("getProposalVoterStake(uint256,address)", id, subject)), 1);
            assertEq(_uint(pool, abi.encodeWithSignature("voterStakedProposals(address,uint256)", subject, i)), id);
            assertEq(ICVStrategy(pool).getProposalStakedAmount(id), 1);
        }
    }

    /// @dev Fork-only: live signal pools have arbitration disabled, so they refuse proposals.
    function _configureFixtureArbitrator(address pool) private {
        assertEq(_uint(pool, abi.encodeWithSignature("proposalType()")), 0, "signal pools only");
        ArbitrableConfig memory arbitration = ArbitrableConfig({
            arbitrator: FIXTURE_ARBITRATOR,
            tribunalSafe: COUNCIL,
            submitterCollateralAmount: 0,
            challengerCollateralAmount: 0,
            defaultRuling: 0,
            defaultRulingTimeout: 1 days
        });
        CVParams memory unchanged;
        vm.prank(COUNCIL);
        IActivationPool(pool).setPoolParams(arbitration, unchanged, 0, new address[](0), new address[](0), address(0));
    }

    function _uint(address target, bytes memory query) private returns (uint256) {
        (bool ok, bytes memory result) = target.staticcall(query);
        assertTrue(ok);
        return abi.decode(result, (uint256));
    }

    function _topic(address account) private pure returns (bytes32) {
        return bytes32(uint256(uint160(account)));
    }
}
