// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test, StdStorage, stdStorage } from "forge-std/Test.sol";
import { ICVStrategy } from "../../src/interfaces/ICVStrategy.sol";
import { HatsModule } from "../../src/modules/Hats.sol";
import { IHatsModule } from "../../src/interfaces/IHatsModule.sol";
import { IDelegationSafe } from "./ArbitrumHatsProtocolDelegation.t.sol";

interface IHardeningJars {
    function getGardenJars(address garden) external view returns (address[] memory);
}

interface IHardeningPool {
    function setAuthorizedSyncCaller(address caller, bool authorized) external;
    function isAuthorizedSyncCaller(address caller) external view returns (bool);
}

interface IHardeningForkSkip {
    function skip(bool condition) external;
    function cool(address target) external;
    function expectPartialRevert(bytes4 selector) external;
}

/// @notice Exact reviewed predecessor and hardening calls through the deployed two-signature Safe.
/// @dev Owners are explicitly impersonated on a disposable fork. This proves execution, not key possession.
contract ArbitrumAuditHardeningForkTest is Test {
    using stdStorage for StdStorage;
    address private constant SAFE = 0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19;
    address private constant MANAGER = 0xfBf07b2d0e5eA8249756F205e5214B9d7cDF4e66;
    address private constant HATS = 0x5b943088ecdDBF8E4ae387348A88A654aC5F7266;
    address private constant JARS = 0x726bfbd0B7449C8f4aBfbcc2FBC5a89eB18fF157;
    address private constant POOLING = 0x6BB5b0fd70b6771B0E955Fef37f8Bd2ce911470a;
    bytes32 private constant SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    function testForkAuditHardening_exactSafePacketPreservesAll18Gardens() public {
        bool enabled;
        try vm.envBool("AUDIT_HARDENING_FORK") returns (bool value) {
            enabled = value;
        } catch { }
        if (!enabled) {
            IHardeningForkSkip(address(vm)).skip(true);
            return;
        }
        string memory packet = vm.readFile(vm.envString("AUDIT_HARDENING_PACKET"));
        uint256 pin = abi.decode(vm.parseJson(packet, ".proofBlock.number"), (uint256));
        vm.createSelectFork(vm.envString("ARBITRUM_FORK_RPC_URL"), pin);
        assertEq(block.chainid, 42_161);
        assertEq(IDelegationSafe(SAFE).getThreshold(), 2);
        string memory prior = vm.readFile(vm.envString("AUDIT_HARDENING_PREREQUISITES"));
        vm.warp(abi.decode(vm.parseJson(prior, ".readyAt"), (uint256)));
        uint256 count = abi.decode(vm.parseJson(prior, ".count"), (uint256));
        for (uint256 i = 0; i < count; i++) {
            string memory key = string.concat(".calls[", vm.toString(i), "]");
            uint256 nonce = abi.decode(vm.parseJson(prior, string.concat(key, ".nonce")), (uint256));
            if (nonce == 50) vm.warp(block.timestamp + 1 days);
            assertEq(IDelegationSafe(SAFE).nonce(), nonce);
            _sendJson(prior, key, true, true);
        }
        assertEq(IDelegationSafe(SAFE).nonce(), 51, "queued release must finish first");
        _assertImplementation(HATS, _address(packet, ".previousImplementations.hats"));
        _assertImplementation(JARS, _address(packet, ".previousImplementations.jars"));
        _assertImplementation(POOLING, _address(packet, ".previousImplementations.pooling"));
        (bool pauseReadOk, bytes memory pauseBefore) = POOLING.staticcall(abi.encodeWithSignature("paused()"));
        assertTrue(pauseReadOk);

        string memory inventory = vm.readFile(vm.envString("AUDIT_HARDENING_INVENTORY"));
        bytes32[18] memory hatsBefore;
        bytes32[18] memory jarsBefore;
        for (uint256 i = 0; i < 18; i++) {
            address garden = _address(inventory, string.concat(".gardens[", vm.toString(i), "].garden"));
            hatsBefore[i] = _hatsHash(garden);
            address[] memory jars = IHardeningJars(JARS).getGardenJars(garden);
            assertEq(jars.length, 2);
            jarsBefore[i] = keccak256(abi.encode(jars));
        }

        _batch(packet, 0);
        for (uint256 i = 0; i < 5; i++) {
            string memory key = string.concat(".deployments[", vm.toString(i), "]");
            address implementation = _address(packet, string.concat(key, ".address"));
            bytes32 expectedHash = abi.decode(vm.parseJson(packet, string.concat(key, ".runtimeHash")), (bytes32));
            assertEq(implementation.codehash, expectedHash, "exact production bytecode including immutables");
        }
        // A rejected pre-ready call cannot consume the Safe nonce or apply any upgrade.
        _sendJson(packet, ".envelopes[1]", true, false);
        _assertImplementation(HATS, _address(packet, ".previousImplementations.hats"));
        assertEq(IDelegationSafe(SAFE).nonce(), 52);
        vm.warp(block.timestamp + abi.decode(vm.parseJson(packet, ".governanceDelay"), (uint256)));
        _batch(packet, 1);
        _assertImplementation(HATS, _address(packet, ".deployments[2].address"));
        _assertImplementation(JARS, _address(packet, ".deployments[3].address"));
        _assertImplementation(POOLING, _address(packet, ".deployments[4].address"));
        (bool afterReadOk, bytes memory pauseAfter) = POOLING.staticcall(abi.encodeWithSignature("paused()"));
        assertTrue(afterReadOk);
        assertEq(pauseAfter, pauseBefore, "upgrade preserves the operational pause state");
        for (uint256 i = 0; i < 18; i++) {
            string memory key = string.concat(".gardens[", vm.toString(i), "]");
            address garden = _address(inventory, string.concat(key, ".garden"));
            assertEq(_hatsHash(garden), hatsBefore[i], "garden Hats preserved");
            assertEq(
                keccak256(abi.encode(IHardeningJars(JARS).getGardenJars(garden))), jarsBefore[i], "jar discovery preserved"
            );
            for (uint256 p = 0; p < 2; p++) {
                address pool = _address(inventory, string.concat(key, ".pools[", vm.toString(p), "]"));
                assertTrue(IHardeningPool(pool).isAuthorizedSyncCaller(HATS));
            }
            _assertRealRevocationSync(garden, inventory, key);
        }
        emit log_named_uint("gardens preserved", 18);
        emit log_named_uint("authorized pools", 36);
        _assertSixStoredPointsCleared(inventory);
        _assertGovernanceRecovery(packet, inventory);
    }

    /// @dev Contingency proof only. Recovery needs a newly reviewed packet and fresh nonces.
    function _assertGovernanceRecovery(string memory packet, string memory inventory) private {
        bytes32 identityBefore = _allGardenIdentities(inventory);
        (bool beforeOk, bytes memory pauseBefore) = POOLING.staticcall(abi.encodeWithSignature("paused()"));
        assertTrue(beforeOk);
        bytes memory packed;
        for (uint256 g = 0; g < 18; g++) {
            for (uint256 p = 0; p < 2; p++) {
                address pool =
                    _address(inventory, string.concat(".gardens[", vm.toString(g), "].pools[", vm.toString(p), "]"));
                bytes memory data = abi.encodeCall(IHardeningPool.setAuthorizedSyncCaller, (HATS, false));
                packed = bytes.concat(packed, abi.encodePacked(uint8(0), pool, uint256(0), uint256(data.length), data));
            }
        }
        _send(
            _address(packet, ".multisend.address"), abi.encodeWithSignature("multiSend(bytes)", packed), 1, bytes32(0), true
        );
        address[3] memory proxies = [POOLING, HATS, JARS];
        address[3] memory previous = [
            _address(packet, ".previousImplementations.pooling"),
            _address(packet, ".previousImplementations.hats"),
            _address(packet, ".previousImplementations.jars")
        ];
        bytes[] memory schedules = new bytes[](3);
        bytes[] memory executions = new bytes[](3);
        for (uint256 i = 0; i < 3; i++) {
            bytes memory upgrade = abi.encodeWithSignature("upgradeTo(address)", previous[i]);
            schedules[i] = abi.encodeWithSignature("schedule(address,bytes,uint48)", proxies[i], upgrade, uint48(0));
            executions[i] = abi.encodeWithSignature("execute(address,bytes)", proxies[i], upgrade);
        }
        _send(MANAGER, abi.encodeWithSignature("multicall(bytes[])", schedules), 0, bytes32(0), true);
        uint256 nonceBefore = IDelegationSafe(SAFE).nonce();
        bytes memory execute = abi.encodeWithSignature("multicall(bytes[])", executions);
        _send(MANAGER, execute, 0, bytes32(0), false);
        assertEq(IDelegationSafe(SAFE).nonce(), nonceBefore);
        vm.warp(block.timestamp + abi.decode(vm.parseJson(packet, ".governanceDelay"), (uint256)));
        _send(MANAGER, execute, 0, bytes32(0), true);
        for (uint256 i = 0; i < 3; i++) {
            _assertImplementation(proxies[i], previous[i]);
        }
        assertEq(_allGardenIdentities(inventory), identityBefore);
        (bool afterOk, bytes memory pauseAfter) = POOLING.staticcall(abi.encodeWithSignature("paused()"));
        assertTrue(afterOk);
        assertEq(pauseAfter, pauseBefore);
        for (uint256 g = 0; g < 18; g++) {
            for (uint256 p = 0; p < 2; p++) {
                address pool =
                    _address(inventory, string.concat(".gardens[", vm.toString(g), "].pools[", vm.toString(p), "]"));
                assertFalse(IHardeningPool(pool).isAuthorizedSyncCaller(HATS));
            }
        }
        emit log_named_uint("recovery implementations restored", 3);
        emit log_named_uint("recovery sync callers disabled", 36);
    }

    function _allGardenIdentities(string memory inventory) private returns (bytes32 identity) {
        for (uint256 g = 0; g < 18; g++) {
            address garden = _address(inventory, string.concat(".gardens[", vm.toString(g), "].garden"));
            identity =
                keccak256(abi.encode(identity, garden, _hatsHash(garden), IHardeningJars(JARS).getGardenJars(garden)));
        }
    }

    /// @dev Fork-only fixture models six stale points left by previously missed hooks. It seeds
    ///      support, not bytecode or power reads. Revocation uses the real Hats and voting registry.
    function _assertSixStoredPointsCleared(string memory inventory) private {
        address garden = _address(inventory, ".gardens[0].garden");
        address community = _address(inventory, ".gardens[0].community");
        address subject = makeAddr("hardening-six-proposal-stale-member");
        address[2] memory pools;
        uint256[2] memory firstProposalIds;
        for (uint256 i = 0; i < 2; i++) {
            pools[i] = _address(inventory, string.concat(".gardens[0].pools[", vm.toString(i), "]"));
            vm.prank(SAFE);
            IHardeningPool(pools[i]).setAuthorizedSyncCaller(HATS, false);
        }
        vm.prank(MANAGER);
        HatsModule(HATS).grantRole(garden, subject, IHatsModule.GardenRole.Gardener);
        for (uint256 i = 0; i < 2; i++) {
            firstProposalIds[i] = _seedSixProposals(pools[i], community, subject);
            vm.prank(SAFE);
            IHardeningPool(pools[i]).setAuthorizedSyncCaller(HATS, true);
            IHardeningForkSkip(address(vm)).cool(pools[i]);
        }
        IHardeningForkSkip(address(vm)).cool(community);
        IHardeningForkSkip(address(vm)).cool(HATS);
        IHardeningForkSkip(address(vm)).cool(0x3bc1A0Ad72417f2d411118085256fC53CBdDd137);
        IHardeningForkSkip(address(vm)).cool(0xD36004307c136FFed0Fe425f699FB1569BFabCBa);
        for (uint256 i = 0; i < 2; i++) {
            vm.expectEmit(true, true, true, true, HATS);
            emit IHatsModule.ConvictionSyncTriggered(garden, subject, pools[i]);
        }
        uint256 beforeGas = gasleft();
        vm.prank(MANAGER);
        HatsModule(HATS).revokeRole{ gas: 4_200_000 }(garden, subject, IHatsModule.GardenRole.Gardener);
        emit log_named_uint("cold six-proposal revocation, both pools", beforeGas - gasleft());
        for (uint256 i = 0; i < 2; i++) {
            assertEq(_uint(pools[i], abi.encodeWithSignature("totalVoterStakePct(address)", subject)), 0);
            assertEq(_uint(pools[i], abi.encodeWithSignature("totalStaked()")), 0);
            assertEq(_uint(pools[i], abi.encodeWithSignature("totalPointsActivated()")), 0);
            for (uint256 id = firstProposalIds[i]; id < firstProposalIds[i] + 6; id++) {
                assertEq(ICVStrategy(pools[i]).getProposalStakedAmount(id), 0);
                assertEq(_uint(pools[i], abi.encodeWithSignature("getProposalVoterStake(uint256,address)", id, subject)), 0);
            }
            (bool hasProposal,) =
                pools[i].staticcall(abi.encodeWithSignature("voterStakedProposals(address,uint256)", subject, 0));
            assertFalse(hasProposal, "zero-support proposals must be pruned");
        }
    }

    function _seedSixProposals(address pool, address community, address subject) private returns (uint256 firstId) {
        firstId = _uint(pool, abi.encodeWithSignature("proposalCounter()")) + 1;
        stdstore.target(pool).sig("proposalCounter()").checked_write(firstId + 5);
        assertEq(_uint(community, abi.encodeWithSignature("enabledStrategies(address)", pool)), 1);
        stdstore.target(community).sig("getMemberPowerInStrategy(address,address)").with_key(subject).with_key(pool)
            .checked_write(uint256(6));
        stdstore.target(pool).sig("totalVoterStakePct(address)").with_key(subject).checked_write(uint256(6));
        stdstore.target(pool).sig("totalStaked()").checked_write(uint256(6));
        stdstore.target(pool).sig("totalPointsActivated()").checked_write(uint256(6));
        bytes32 list = _seedProposalList(pool, subject);
        for (uint256 i = 0; i < 6; i++) {
            uint256 id = firstId + i;
            vm.store(pool, bytes32(uint256(keccak256(abi.encode(list))) + i), bytes32(id));
            // Find once: this forge-std revision keeps keys when a cached find returns early.
            uint256 stakeSlot = stdstore.target(pool).sig("getProposalStakedAmount(uint256)").with_key(id).find();
            vm.store(pool, bytes32(stakeSlot), bytes32(uint256(1)));
            uint256 base = stakeSlot - 2;
            // Verified Proposal prefix: id, request, stake, conviction, beneficiary, submitter,
            // token, last block and status. Live getters below fail closed if that prefix changes.
            vm.store(pool, bytes32(base), bytes32(id));
            vm.store(pool, bytes32(base + 3), bytes32(uint256(1)));
            vm.store(pool, bytes32(base + 4), bytes32(uint256(uint160(subject))));
            vm.store(pool, bytes32(base + 5), bytes32(uint256(uint160(subject))));
            vm.store(pool, bytes32(base + 7), bytes32(block.number - 1_000_000));
            vm.store(pool, bytes32(base + 8), bytes32(uint256(1)));
            stdstore.target(pool).sig("getProposalVoterStake(uint256,address)").with_key(id).with_key(subject)
                .checked_write(uint256(1));
            (address submitter, address beneficiary,,, uint256 stake, uint8 status, uint256 lastBlock,,,,,) =
                ICVStrategy(pool).getProposal(id);
            assertEq(submitter, subject);
            assertEq(beneficiary, subject);
            assertEq(stake, 1);
            assertEq(status, 1);
            assertEq(lastBlock, block.number - 1_000_000);
            assertEq(_uint(pool, abi.encodeWithSignature("getProposalVoterStake(uint256,address)", id, subject)), 1);
            assertEq(_uint(pool, abi.encodeWithSignature("voterStakedProposals(address,uint256)", subject, i)), id);
        }
    }

    function _seedProposalList(address pool, address subject) private returns (bytes32) {
        bytes memory query = abi.encodeWithSignature("voterStakedProposals(address,uint256)", subject, 0);
        vm.record();
        (bool exists,) = pool.staticcall(query);
        assertFalse(exists);
        (bytes32[] memory reads,) = vm.accesses(pool);
        for (uint256 i = 0; i < reads.length; i++) {
            if (reads[i] == SLOT) continue;
            bytes32 previous = vm.load(pool, reads[i]);
            vm.store(pool, reads[i], bytes32(uint256(6)));
            (bool ok, bytes memory result) = pool.staticcall(query);
            if (ok && result.length == 32) return reads[i];
            vm.store(pool, reads[i], previous);
        }
        revert("could not identify the live voter proposal list");
    }

    function _uint(address target, bytes memory query) private returns (uint256) {
        (bool ok, bytes memory result) = target.staticcall(query);
        assertTrue(ok);
        return abi.decode(result, (uint256));
    }

    function _assertRealRevocationSync(address garden, string memory inventory, string memory key) private {
        HatsModule module = HatsModule(HATS);
        address subject = makeAddr(string.concat("hardening-fork-member-", key));
        vm.prank(MANAGER);
        module.grantRole(garden, subject, IHatsModule.GardenRole.Gardener);
        assertTrue(module.isGardenerOf(garden, subject));
        for (uint256 p = 0; p < 2; p++) {
            address pool = _address(inventory, string.concat(key, ".pools[", vm.toString(p), "]"));
            vm.expectEmit(true, true, true, true, HATS);
            emit IHatsModule.ConvictionSyncTriggered(garden, subject, pool);
        }
        vm.prank(MANAGER);
        module.revokeRole(garden, subject, IHatsModule.GardenRole.Gardener);
        assertFalse(module.isGardenerOf(garden, subject));
    }

    function _batch(string memory packet, uint256 batch) private {
        address multisend = _address(packet, ".multisend.address");
        assertEq(multisend.codehash, abi.decode(vm.parseJson(packet, ".multisend.runtimeHash"), (bytes32)));
        string memory key = string.concat(".envelopes[", vm.toString(batch), "]");
        assertEq(IDelegationSafe(SAFE).nonce(), abi.decode(vm.parseJson(packet, string.concat(key, ".nonce")), (uint256)));
        _sendJson(packet, key, true, true);
    }

    function _sendJson(string memory json, string memory key, bool checkHash, bool shouldExecute) private {
        address target = _address(json, string.concat(key, ".to"));
        bytes memory data = abi.decode(vm.parseJson(json, string.concat(key, ".data")), (bytes));
        uint8 operation = uint8(abi.decode(vm.parseJson(json, string.concat(key, ".operation")), (uint256)));
        bytes32 expectedHash =
            checkHash ? abi.decode(vm.parseJson(json, string.concat(key, ".safeTxHash")), (bytes32)) : bytes32(0);
        _send(target, data, operation, expectedHash, shouldExecute);
    }

    function _send(address target, bytes memory data, uint8 operation, bytes32 expectedHash, bool shouldExecute) private {
        IDelegationSafe safe = IDelegationSafe(SAFE);
        bytes32 hash = safe.getTransactionHash(target, 0, data, operation, 0, 0, 0, address(0), address(0), safe.nonce());
        if (expectedHash != bytes32(0)) assertEq(hash, expectedHash);
        address[] memory owners = safe.getOwners();
        (address a, address b) = owners[0] < owners[1] ? (owners[0], owners[1]) : (owners[1], owners[0]);
        vm.prank(a);
        safe.approveHash(hash);
        vm.prank(b);
        safe.approveHash(hash);
        bytes memory signatures = abi.encodePacked(
            bytes32(uint256(uint160(a))), bytes32(0), uint8(1), bytes32(uint256(uint160(b))), bytes32(0), uint8(1)
        );
        if (!shouldExecute) {
            IHardeningForkSkip(address(vm)).expectPartialRevert(bytes4(keccak256("AccessManagerNotReady(bytes32)")));
        }
        uint256 beforeGas = gasleft();
        bool success =
            safe.execTransaction(target, 0, data, operation, 0, 0, 0, address(0), payable(address(0)), signatures);
        if (shouldExecute) {
            assertTrue(success);
            uint256 used = beforeGas - gasleft();
            assertLt(used, 32_000_000, "Safe execution gas exceeds Arbitrum's accounting limit");
            emit log_named_uint(string.concat("Safe execution gas, nonce ", vm.toString(safe.nonce() - 1)), used);
        }
    }

    function _address(string memory json, string memory key) private pure returns (address) {
        return abi.decode(vm.parseJson(json, key), (address));
    }

    function _assertImplementation(address proxy, address expected) private {
        assertEq(address(uint160(uint256(vm.load(proxy, SLOT)))), expected);
    }

    function _hatsHash(address garden) private returns (bytes32) {
        (bool ok, bytes memory data) = HATS.staticcall(abi.encodeCall(HatsModule.getGardenHatIds, (garden)));
        assertTrue(ok);
        return keccak256(data);
    }
}
