// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { HatsModule } from "../../src/modules/Hats.sol";
import { IHatsModule } from "../../src/interfaces/IHatsModule.sol";
import { IHats } from "../../src/interfaces/IHats.sol";

interface IDelegationManager {
    function canCall(address caller, address target, bytes4 selector) external view returns (bool, uint32);
    function schedule(address target, bytes calldata data, uint48 when) external returns (bytes32, uint32);
    function execute(address target, bytes calldata data) external payable returns (uint32);
    function multicall(bytes[] calldata data) external returns (bytes[] memory);
}

interface IDelegationSafe {
    function nonce() external view returns (uint256);
    function getThreshold() external view returns (uint256);
    function getOwners() external view returns (address[] memory);
    function approveHash(bytes32 hash) external;
    function getTransactionHash(
        address,
        uint256,
        bytes calldata,
        uint8,
        uint256,
        uint256,
        uint256,
        address,
        address,
        uint256
    )
        external
        view
        returns (bytes32);
    function execTransaction(
        address,
        uint256,
        bytes calldata,
        uint8,
        uint256,
        uint256,
        uint256,
        address,
        address payable,
        bytes calldata
    )
        external
        payable
        returns (bool);
}

/// @notice Live two-signature Safe and AccessManager execution, with explicitly impersonated owners on a fork.
contract ArbitrumHatsProtocolDelegationForkTest is Test {
    address private constant SAFE = 0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19;
    HatsModule private constant MODULE = HatsModule(0x5b943088ecdDBF8E4ae387348A88A654aC5F7266);
    bytes32 private constant SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    uint256 private constant TEAM = 0x0000005c00010000000000000000000000000000000000000000000000000000;
    uint256 private constant PRODUCT_LEAD = 0x0000005c00050000000000000000000000000000000000000000000000000000;
    uint256 private constant AGENTS = 0x0000005c00040000000000000000000000000000000000000000000000000000;
    uint256 private constant DEPLOYER = 0x0000005c00030001000000000000000000000000000000000000000000000000;

    function setUp() public {
        vm.createSelectFork(vm.envString("ARBITRUM_RPC_URL"), vm.envUint("HATS_DELEGATION_FORK_BLOCK"));
        assertEq(block.chainid, 42_161);
    }

    function testForkArbitrum_safeUpgradeAndTeamStewardOperationsAcrossEighteenGardens() public {
        IDelegationSafe safe = IDelegationSafe(SAFE);
        assertEq(safe.getThreshold(), 2);
        address manager = MODULE.owner();
        assertGt(manager.code.length, 0);
        address oldImplementation = address(uint160(uint256(vm.load(address(MODULE), SLOT))));
        string memory inventory = vm.readFile("test/fixtures/hats-delegation-arbitrum.json");
        address[] memory gardens = new address[](18);
        bytes32[] memory beforeHashes = new bytes32[](18);
        for (uint256 i = 0; i < gardens.length; i++) {
            gardens[i] =
                abi.decode(vm.parseJson(inventory, string.concat(".gardens[", vm.toString(i), "].garden")), (address));
            beforeHashes[i] = _configurationHash(gardens[i]);
        }
        HatsModule implementation = new HatsModule();
        bytes memory configuration =
            abi.encodeCall(MODULE.configureProtocolAdministration, (TEAM, PRODUCT_LEAD, AGENTS, DEPLOYER));
        bytes memory upgrade =
            abi.encodeWithSignature("upgradeToAndCall(address,bytes)", address(implementation), configuration);
        (bool immediate, uint32 delay) = IDelegationManager(manager).canCall(SAFE, address(MODULE), bytes4(upgrade));
        uint256 startingNonce = safe.nonce();
        if (!immediate) {
            assertGt(delay, 0, "Safe has no governance authorization");
            uint48 readyAt = uint48(block.timestamp + delay);
            _send(manager, abi.encodeCall(IDelegationManager.schedule, (address(MODULE), upgrade, readyAt)));
            vm.warp(readyAt);
        }
        _send(manager, abi.encodeCall(IDelegationManager.execute, (address(MODULE), upgrade)));
        assertEq(address(uint160(uint256(vm.load(address(MODULE), SLOT)))), address(implementation));
        assertEq(MODULE.owner(), manager);
        (,,,, address gardensToggle,,,,) = MODULE.hats().viewHat(MODULE.gardensHatId());
        assertEq(gardensToggle, manager, "legacy Deployer toggle authority must be disconnected");
        assertEq(safe.nonce(), startingNonce + (immediate ? 1 : 2));

        _configureProtocolRoleControllers(manager);
        // A governance-minted fixture proves Team authority without relying on overlapping garden roles.
        address team = makeAddr("governance-minted-fork-team-fixture");
        _governTarget(manager, address(MODULE.hats()), abi.encodeCall(IHats.mintHat, (TEAM, team)));
        assertTrue(MODULE.isProtocolTeam(team), "fixture must actually wear Team");
        address subject = makeAddr("delegation-fork-subject");
        vm.recordLogs();
        for (uint256 i = 0; i < gardens.length; i++) {
            address garden = gardens[i];
            assertEq(_configurationHash(garden), beforeHashes[i]);
            vm.prank(team);
            MODULE.grantRole(garden, subject, IHatsModule.GardenRole.Steward);
            assertTrue(MODULE.isStewardOf(garden, subject));
            vm.prank(subject);
            vm.expectRevert(abi.encodeWithSelector(HatsModule.NotGardenAdmin.selector, subject, garden));
            MODULE.grantRole(garden, subject, IHatsModule.GardenRole.Owner);
            vm.prank(team);
            MODULE.revokeRole(garden, subject, IHatsModule.GardenRole.Steward);
            assertFalse(MODULE.isStewardOf(garden, subject));
            assertFalse(MODULE.isOwnerOf(garden, subject));
            assertEq(_configurationHash(garden), beforeHashes[i]);
        }
        vm.writeFile(vm.envString("HATS_DELEGATION_LOGS"), vm.toString(abi.encode(vm.getRecordedLogs())));

        _governTarget(manager, address(MODULE.hats()), abi.encodeCall(IHats.setHatWearerStatus, (TEAM, team, false, true)));
        assertFalse(MODULE.isProtocolTeam(team), "Safe-controlled eligibility must revoke Team membership");

        // Governance can disable the delegation without changing garden ownership or the configured Hats.
        bytes memory disable = abi.encodeCall(MODULE.setProtocolRoleHats, (0, PRODUCT_LEAD, AGENTS, DEPLOYER));
        _govern(manager, disable);
        assertFalse(MODULE.isProtocolTeam(team));
        vm.prank(team);
        vm.expectRevert(abi.encodeWithSelector(HatsModule.NotGardenAdmin.selector, team, gardens[0]));
        MODULE.grantRole(gardens[0], subject, IHatsModule.GardenRole.Steward);

        // Rehearse storage-preserving rollback through the same governance route.
        _govern(manager, abi.encodeWithSignature("upgradeTo(address)", oldImplementation));
        assertEq(address(uint160(uint256(vm.load(address(MODULE), SLOT)))), oldImplementation);
        for (uint256 i = 0; i < gardens.length; i++) {
            assertEq(_configurationHash(gardens[i]), beforeHashes[i]);
        }
        emit log_named_uint("gardens with live Team grant and revoke", gardens.length);
        emit log_named_uint("existing governance execution delay", delay);
    }

    /// @dev The files are private/ignored. This sends their actual bytes through the real Safes.
    function testForkArbitrum_exactFrozenSafePacketAfterQueuedPrerequisites() public {
        string memory prerequisites = vm.readFile(vm.envString("HATS_DELEGATION_PREREQUISITES"));
        uint256 readyAt = abi.decode(vm.parseJson(prerequisites, ".readyAt"), (uint256));
        vm.warp(readyAt);
        uint256 prerequisiteCount = abi.decode(vm.parseJson(prerequisites, ".count"), (uint256));
        for (uint256 i = 0; i < prerequisiteCount; i++) {
            string memory key = string.concat(".calls[", vm.toString(i), "]");
            _sendReviewedCall(prerequisites, key);
        }
        assertEq(IDelegationSafe(SAFE).nonce(), 48, "queued prerequisites must finish first");
        string memory packet = vm.readFile(vm.envString("HATS_DELEGATION_PACKET"));
        address implementation = abi.decode(vm.parseJson(packet, ".implementation"), (address));
        bytes32 expectedRuntime = abi.decode(vm.parseJson(packet, ".runtimeHash"), (bytes32));
        string memory inventory = vm.readFile("test/fixtures/hats-delegation-arbitrum.json");
        address[] memory gardens = new address[](18);
        bytes32[] memory hashes = new bytes32[](18);
        for (uint256 i = 0; i < gardens.length; i++) {
            gardens[i] =
                abi.decode(vm.parseJson(inventory, string.concat(".gardens[", vm.toString(i), "].garden")), (address));
            hashes[i] = _configurationHash(gardens[i]);
        }
        _sendReviewedCall(packet, ".calls[0]");
        assertEq(implementation.codehash, expectedRuntime, "exact production runtime");
        _sendReviewedCall(packet, ".calls[1]");
        // A pre-ready execution must not consume its nonce or activate any operation.
        bytes memory execution = abi.decode(vm.parseJson(packet, ".calls[2].data"), (bytes));
        vm.prank(SAFE);
        (bool premature,) = MODULE.owner().call(execution);
        assertFalse(premature, "governance wait must remain enforced");
        assertEq(IDelegationSafe(SAFE).nonce(), 50);
        vm.warp(block.timestamp + abi.decode(vm.parseJson(packet, ".governanceDelay"), (uint256)));
        vm.recordLogs();
        _sendReviewedCall(packet, ".calls[2]");
        assertEq(IDelegationSafe(SAFE).nonce(), 51);
        assertEq(address(uint160(uint256(vm.load(address(MODULE), SLOT)))), implementation);
        _assertProtocolGovernanceControls(MODULE.owner());
        address team = makeAddr("exact-packet-Team-fixture");
        _governTarget(MODULE.owner(), address(MODULE.hats()), abi.encodeCall(IHats.mintHat, (TEAM, team)));
        for (uint256 i = 0; i < gardens.length; i++) {
            address subject = makeAddr(string.concat("exact-packet-subject-", vm.toString(i)));
            vm.prank(team);
            MODULE.grantRole(gardens[i], subject, IHatsModule.GardenRole.Steward);
            assertTrue(MODULE.isStewardOf(gardens[i], subject));
            vm.prank(team);
            MODULE.revokeRole(gardens[i], subject, IHatsModule.GardenRole.Steward);
            assertFalse(MODULE.isStewardOf(gardens[i], subject));
            assertEq(_configurationHash(gardens[i]), hashes[i]);
        }
        vm.writeFile(vm.envString("HATS_DELEGATION_LOGS"), vm.toString(abi.encode(vm.getRecordedLogs())));
        address previous = abi.decode(vm.parseJson(packet, ".previousImplementation"), (address));
        _govern(MODULE.owner(), abi.encodeWithSignature("upgradeTo(address)", previous));
        assertEq(address(uint160(uint256(vm.load(address(MODULE), SLOT)))), previous);
        for (uint256 i; i < gardens.length; i++) {
            assertEq(_configurationHash(gardens[i]), hashes[i]);
        }
        emit log_named_address("exact production implementation", implementation);
        emit log_named_uint("exact reviewed Safe calls including queued prerequisites", prerequisiteCount + 3);
    }

    function _assertProtocolGovernanceControls(address manager) private {
        uint256[4] memory ids = [TEAM, PRODUCT_LEAD, AGENTS, DEPLOYER];
        uint32[4] memory supply = [uint32(5), uint32(1), uint32(0), uint32(1)];
        for (uint256 i; i < ids.length; i++) {
            (,, uint32 actualSupply, address eligibility, address toggle,,,, bool active) = MODULE.hats().viewHat(ids[i]);
            assertEq(actualSupply, supply[i], "existing protocol roster is preserved");
            assertEq(eligibility, manager);
            assertEq(toggle, manager);
            assertTrue(active);
        }
        address[] memory owners = IDelegationSafe(SAFE).getOwners();
        for (uint256 i; i < owners.length; i++) {
            assertTrue(MODULE.isProtocolTeam(owners[i]));
        }
        (,,,, address gardensToggle,,,, bool gardensActive) = MODULE.hats().viewHat(MODULE.gardensHatId());
        assertEq(gardensToggle, manager);
        assertTrue(gardensActive);
    }

    function _sendReviewedCall(string memory document, string memory key) private {
        address target = abi.decode(vm.parseJson(document, string.concat(key, ".to")), (address));
        bytes memory data = abi.decode(vm.parseJson(document, string.concat(key, ".data")), (bytes));
        uint8 operation = uint8(abi.decode(vm.parseJson(document, string.concat(key, ".operation")), (uint256)));
        uint256 nonce = abi.decode(vm.parseJson(document, string.concat(key, ".nonce")), (uint256));
        bytes32 expectedHash = abi.decode(vm.parseJson(document, string.concat(key, ".safeTransactionHash")), (bytes32));
        address wallet = SAFE;
        assertEq(IDelegationSafe(wallet).nonce(), nonce, "reviewed Safe nonce");
        assertEq(
            IDelegationSafe(wallet).getTransactionHash(target, 0, data, operation, 0, 0, 0, address(0), address(0), nonce),
            expectedHash,
            "reviewed Safe hash"
        );
        _sendSafe(wallet, target, data, operation);
    }

    function _govern(address manager, bytes memory data) private {
        _governTarget(manager, address(MODULE), data);
    }

    function _governTarget(address manager, address target, bytes memory data) private {
        (bool immediate, uint32 delay) = IDelegationManager(manager).canCall(SAFE, target, bytes4(data));
        if (!immediate) {
            assertGt(delay, 0);
            uint48 readyAt = uint48(block.timestamp + delay);
            _send(manager, abi.encodeCall(IDelegationManager.schedule, (target, data, readyAt)));
            vm.warp(readyAt);
        }
        _send(manager, abi.encodeCall(IDelegationManager.execute, (target, data)));
    }

    function _configureProtocolRoleControllers(address manager) private {
        uint256[4] memory roleHats = [TEAM, PRODUCT_LEAD, AGENTS, DEPLOYER];
        bytes[] memory schedules = new bytes[](8);
        bytes[] memory executions = new bytes[](8);
        uint32 maxDelay;
        address core = address(MODULE.hats());
        for (uint256 i = 0; i < roleHats.length; i++) {
            bytes[2] memory changes = [
                abi.encodeCall(IHats.changeHatEligibility, (roleHats[i], manager)),
                abi.encodeCall(IHats.changeHatToggle, (roleHats[i], manager))
            ];
            for (uint256 j = 0; j < 2; j++) {
                (bool immediate, uint32 delay) = IDelegationManager(manager).canCall(SAFE, core, bytes4(changes[j]));
                assertFalse(immediate);
                assertGt(delay, 0);
                if (delay > maxDelay) maxDelay = delay;
                schedules[i * 2 + j] = abi.encodeCall(IDelegationManager.schedule, (core, changes[j], 0));
                executions[i * 2 + j] = abi.encodeCall(IDelegationManager.execute, (core, changes[j]));
            }
        }
        _send(manager, abi.encodeCall(IDelegationManager.multicall, (schedules)));
        vm.warp(block.timestamp + maxDelay);
        _send(manager, abi.encodeCall(IDelegationManager.multicall, (executions)));
        for (uint256 i = 0; i < roleHats.length; i++) {
            (,,, address eligibility, address toggle,,,,) = MODULE.hats().viewHat(roleHats[i]);
            assertEq(eligibility, manager);
            assertEq(toggle, manager);
        }
    }

    function _configurationHash(address garden) private returns (bytes32) {
        (bool ok, bytes memory result) = address(MODULE).staticcall(abi.encodeCall(MODULE.getGardenHatIds, (garden)));
        assertTrue(ok);
        return keccak256(result);
    }

    function _send(address target, bytes memory data) private {
        _sendSafe(SAFE, target, data, 0);
    }

    function _sendSafe(address wallet, address target, bytes memory data, uint8 operation) private {
        IDelegationSafe safe = IDelegationSafe(wallet);
        bytes32 hash = safe.getTransactionHash(target, 0, data, operation, 0, 0, 0, address(0), address(0), safe.nonce());
        address[] memory owners = safe.getOwners();
        (address a, address b) = owners[0] < owners[1] ? (owners[0], owners[1]) : (owners[1], owners[0]);
        vm.prank(a);
        safe.approveHash(hash);
        vm.prank(b);
        safe.approveHash(hash);
        bytes memory signatures = abi.encodePacked(
            bytes32(uint256(uint160(a))), bytes32(0), uint8(1), bytes32(uint256(uint160(b))), bytes32(0), uint8(1)
        );
        assertTrue(safe.execTransaction(target, 0, data, operation, 0, 0, 0, address(0), payable(address(0)), signatures));
    }
}
