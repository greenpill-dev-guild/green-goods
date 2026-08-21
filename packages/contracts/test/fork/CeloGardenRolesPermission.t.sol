// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { stdJson } from "forge-std/StdJson.sol";
import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";

import { ICeloSettlementExecutor } from "../../src/interfaces/ICeloSettlementExecutor.sol";
import { SettlementMessageCodec } from "../../src/libraries/SettlementMessageCodec.sol";

/**
 * Proves the reviewed G$ transfer permission on a pinned Celo fork.
 *
 * The condition tree is read from the planner's own artifact rather than rebuilt here, so this
 * executes the exact bytes the release would install. Roles validates tree integrity inside
 * scopeFunction, which is the check the plan currently reports as unproven.
 */
interface IModuleProxyFactory {
    function deployModule(address masterCopy, bytes memory initializer, uint256 saltNonce) external returns (address proxy);
}

interface IRoles {
    function owner() external view returns (address);
    function avatar() external view returns (address);
    function target() external view returns (address);
    function transferOwnership(address newOwner) external;
    function scopeTarget(bytes32 roleKey, address targetAddress) external;
    function scopeFunction(
        bytes32 roleKey,
        address targetAddress,
        bytes4 selector,
        ConditionFlat[] memory conditions,
        uint8 options
    )
        external;
    function setAllowance(
        bytes32 key,
        uint128 balance,
        uint128 maxRefill,
        uint128 refill,
        uint64 period,
        uint64 timestamp
    )
        external;
    function assignRoles(address module, bytes32[] memory roleKeys, bool[] memory memberOf) external;
    function setDefaultRole(address module, bytes32 roleKey) external;
    function defaultRoles(address module) external view returns (bytes32);
    function isModuleEnabled(address module) external view returns (bool);
    function execTransactionWithRole(
        address to,
        uint256 value,
        bytes memory data,
        uint8 operation,
        bytes32 roleKey,
        bool shouldRevert
    )
        external
        returns (bool success);
}

struct ConditionFlat {
    uint8 parent;
    uint8 paramType;
    uint8 operator;
    bytes compValue;
}

interface ISafe {
    function enableModule(address module) external;
    function isModuleEnabled(address module) external view returns (bool);
    function approveHash(bytes32 hashToApprove) external;
    function approvedHashes(address owner, bytes32 hash) external view returns (uint256);
    function nonce() external view returns (uint256);
}

/// Roles reverts every condition failure with this; the status names which rule refused.
error ConditionViolation(uint8 status, bytes32 info);

// Roles Status values, confirmed against the live modifier by this proof.
// The block the Garden Safes and Guardian trust were confirmed at.
uint256 constant CELO_FORK_BLOCK = 75_178_393;

uint8 constant STATUS_TARGET_ADDRESS_NOT_ALLOWED = 2;
uint8 constant STATUS_FUNCTION_NOT_ALLOWED = 3;
uint8 constant STATUS_PARAMETER_NOT_ALLOWED = 5;
uint8 constant STATUS_ALLOWANCE_EXCEEDED = 17;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
}

interface ICcipReceiver {
    function ccipReceive(Client.Any2EVMMessage calldata message) external;
}

contract CeloGardenRolesPermissionForkTest is Test {
    using stdJson for string;

    address private constant FACTORY = 0x000000000000aDdB49795b0f9bA5BC298cDda236;
    address private constant ROLES_MASTERCOPY = 0x9646fDAD06d3e24444381f44362a3B0eB343D337;
    address private constant EXECUTOR = 0xB8a7F3c3DfA407c45e05b7B2381233101938a84F;
    uint16 private constant FROZEN_MAX_BATCH_SIZE = 2;
    uint16 private constant DELIVERABLE_MAX_BATCH_SIZE = 6;
    uint16 private constant FIRST_UNDELIVERABLE_BATCH_SIZE = 7;
    uint256 private constant CCIP_DESTINATION_GAS_LIMIT = 3_000_000;

    string private plan;
    address private deploymentOperator;
    address private canonicalToken;
    bytes4 private canonicalSelector;
    bytes32 private roleKey;
    bytes32 private allowanceKey;
    uint128 private periodAmount;
    uint64 private periodDuration;

    address private safe;
    address private predictedModifier;
    bytes32 private enableTxHash;
    bytes private enableCalldata;
    address[] private approvers;
    address private registeredRecipient;
    address private outsider = address(0xBEEF);

    IRoles private roles;

    function setUp() public {
        // Pinned so the proof is reproducible; an unpinned fork silently re-scopes what was proven.
        vm.createSelectFork(vm.envString("CELO_RPC_URL"), CELO_FORK_BLOCK);
        plan = vm.readFile("./.generated/runtime/42220-garden-roles-proof.json");

        deploymentOperator = plan.readAddress(".modifierOwnerAtDeployment");
        canonicalToken = plan.readAddress(".canonicalTarget");
        canonicalSelector = bytes4(plan.readBytes(".canonicalSelector"));
        roleKey = plan.readBytes32(".roleKey");
        allowanceKey = plan.readBytes32(".allowanceKey");
        periodAmount = uint128(plan.readUint(".allowance.refill"));
        periodDuration = uint64(plan.readUint(".allowance.period"));

        enableTxHash = plan.readBytes32(".enable[0].safeTxHash");
        enableCalldata = plan.readBytes(".enable[0].data");
        approvers = plan.readAddressArray(".enable[0].approvers");

        safe = plan.readAddress(".boundaries[0].safe");
        predictedModifier = plan.readAddress(".boundaries[0].modifier");
        // A different registered Safe, so the allowed case is a real allowlist hit.
        registeredRecipient = plan.readAddress(".boundaries[1].safe");

        roles = IRoles(_deployModifier());
        _configure();
    }

    function _deployModifier() private returns (address modifierAddress) {
        bytes memory initParams = abi.encode(deploymentOperator, safe, safe);
        bytes memory initializer = abi.encodeWithSignature("setUp(bytes)", initParams);
        uint256 saltNonce = plan.readUint(".boundaries[0].saltNonce");

        vm.prank(deploymentOperator);
        modifierAddress = IModuleProxyFactory(FACTORY).deployModule(ROLES_MASTERCOPY, initializer, saltNonce);

        // Cross-validates the planner's CREATE2 derivation against the factory's real behaviour.
        assertEq(modifierAddress, predictedModifier, "modifier address differs from the reviewed plan");
        assertEq(IRoles(modifierAddress).avatar(), safe, "avatar is not the Garden Safe");
        assertEq(IRoles(modifierAddress).target(), safe, "target is not the Garden Safe");
        assertEq(IRoles(modifierAddress).owner(), deploymentOperator, "owner is not the deployment operator");
    }

    /// Decodes the exact payload the release would hand to scopeFunction, not a re-derivation.
    function _planConditions() private view returns (ConditionFlat[] memory conditions) {
        conditions = abi.decode(plan.readBytes(".conditionsEncoded"), (ConditionFlat[]));
    }

    function _configure() private {
        bytes32[] memory roleKeys = new bytes32[](1);
        roleKeys[0] = roleKey;
        bool[] memory memberOf = new bool[](1);
        memberOf[0] = true;

        vm.startPrank(deploymentOperator);
        roles.scopeTarget(roleKey, canonicalToken);
        // Reverts here if the reviewed tree fails Roles' integrity check.
        roles.scopeFunction(roleKey, canonicalToken, canonicalSelector, _planConditions(), 0);
        roles.setAllowance(allowanceKey, periodAmount, periodAmount, periodAmount, periodDuration, 0);
        roles.assignRoles(EXECUTOR, roleKeys, memberOf);
        // assignRoles grants membership and enables the module but leaves defaultRoles at zero,
        // which is the one field configureGardenRoute reads. It has to be written before ownership
        // moves, because afterwards only the Safe can write it.
        roles.setDefaultRole(EXECUTOR, roleKey);
        // Ownership moves to the Safe while the modifier is still inert.
        roles.transferOwnership(safe);
        vm.stopPrank();

        assertEq(roles.owner(), safe, "ownership did not transfer to the Safe");

        // Only now does the modifier gain authority, and it gains it the way the release will:
        // each recovery Safe records its approval, then anyone submits the reviewed transaction
        // carrying the planner's pre-approved signature bytes. Pranking the Safe here would have
        // left that encoding — the thing both organisations' signing round depends on — unexecuted.
        assertEq(ISafe(safe).nonce(), 0, "reviewed enable hash is bound to nonce zero");
        for (uint256 index; index < approvers.length; ++index) {
            vm.prank(approvers[index]);
            ISafe(safe).approveHash(enableTxHash);
            assertGt(ISafe(safe).approvedHashes(approvers[index], enableTxHash), 0, "approval was not recorded");
        }

        // Submitted from an unrelated address: pre-approved hashes need no further signing.
        vm.prank(outsider);
        (bool ok,) = safe.call(enableCalldata);
        assertTrue(ok, "pre-approved enable transaction was rejected");
        assertTrue(ISafe(safe).isModuleEnabled(address(roles)), "module was not enabled on the Safe");

        deal(canonicalToken, safe, uint256(periodAmount) * 2);
    }

    /**
     * Asserts the call reverted with a Roles ConditionViolation and returns its status, so each
     * denial names the rule that refused rather than accepting any revert.
     */
    /**
     * The eighteen enables are submitted with pre-approved-hash signatures rather than live ones, so
     * the threshold has to be carried by the approvals themselves. Proven on a second registered
     * Safe, since the first is already enabled by setUp.
     */
    function testFork_enableRequiresBothRecoveryApprovals() public {
        address secondSafe = plan.readAddress(".boundaries[1].safe");
        bytes32 secondHash = plan.readBytes32(".enable[1].safeTxHash");
        bytes memory secondCalldata = plan.readBytes(".enable[1].data");
        address secondModifier = _prepareSecondModifier(secondSafe);

        // One approval is below threshold two, so the reviewed transaction must not execute.
        vm.prank(approvers[0]);
        ISafe(secondSafe).approveHash(secondHash);
        vm.prank(outsider);
        (bool tooFew,) = secondSafe.call(secondCalldata);
        assertFalse(tooFew, "one recovery approval was enough to enable the module");
        assertFalse(ISafe(secondSafe).isModuleEnabled(secondModifier), "module enabled below threshold");

        // With the second organisation's approval the identical bytes succeed.
        vm.prank(approvers[1]);
        ISafe(secondSafe).approveHash(secondHash);
        vm.prank(outsider);
        (bool ok,) = secondSafe.call(secondCalldata);
        assertTrue(ok, "both approvals present but the reviewed transaction was rejected");
        assertTrue(ISafe(secondSafe).isModuleEnabled(secondModifier), "module was not enabled");
    }

    /// The reviewed hash is nonce-bound, so a mined enable cannot be replayed against the same Safe.
    function testFork_enableCannotBeReplayed() public {
        assertEq(ISafe(safe).nonce(), 1, "setUp did not consume the reviewed nonce");

        vm.prank(outsider);
        (bool replayed,) = safe.call(enableCalldata);
        assertFalse(replayed, "the enable transaction replayed after its nonce advanced");
    }

    /// Deploys and configures a second modifier through the same reviewed path, stopping before enable.
    function _prepareSecondModifier(address secondSafe) private returns (address secondModifier) {
        bytes memory initializer =
            abi.encodeWithSignature("setUp(bytes)", abi.encode(deploymentOperator, secondSafe, secondSafe));
        vm.prank(deploymentOperator);
        secondModifier = IModuleProxyFactory(FACTORY)
            .deployModule(ROLES_MASTERCOPY, initializer, plan.readUint(".boundaries[1].saltNonce"));
        assertEq(secondModifier, plan.readAddress(".boundaries[1].modifier"), "second modifier differs from the plan");

        bytes32[] memory roleKeys = new bytes32[](1);
        roleKeys[0] = roleKey;
        bool[] memory memberOf = new bool[](1);
        memberOf[0] = true;

        vm.startPrank(deploymentOperator);
        IRoles(secondModifier).scopeTarget(roleKey, canonicalToken);
        IRoles(secondModifier).scopeFunction(roleKey, canonicalToken, canonicalSelector, _planConditions(), 0);
        IRoles(secondModifier).setAllowance(allowanceKey, periodAmount, periodAmount, periodAmount, periodDuration, 0);
        IRoles(secondModifier).assignRoles(EXECUTOR, roleKeys, memberOf);
        IRoles(secondModifier).transferOwnership(secondSafe);
        vm.stopPrank();
    }

    function _expectConditionViolation(address to, bytes memory data) private returns (uint8 status) {
        vm.prank(EXECUTOR);
        (bool ok, bytes memory err) = address(roles)
            .call(
                abi.encodeWithSelector(
                    IRoles.execTransactionWithRole.selector, to, uint256(0), data, uint8(0), roleKey, false
                )
            );
        assertFalse(ok, "call unexpectedly succeeded");
        assertEq(bytes4(err), ConditionViolation.selector, "revert is not a Roles ConditionViolation");
        bytes memory payload = new bytes(err.length - 4);
        for (uint256 i; i < payload.length; ++i) {
            payload[i] = err[i + 4];
        }
        bytes32 info;
        (status, info) = abi.decode(payload, (uint8, bytes32));
    }

    function _send(address to, uint256 amount) private returns (bool) {
        vm.prank(EXECUTOR);
        return roles.execTransactionWithRole(
            canonicalToken, 0, abi.encodeWithSelector(canonicalSelector, to, amount), 0, roleKey, false
        );
    }

    function testFork_reviewedTreeSettlesToARegisteredSafeWithinTheAllowance() public {
        uint256 amount = 1000e18;
        uint256 before = IERC20(canonicalToken).balanceOf(registeredRecipient);

        assertTrue(_send(registeredRecipient, amount), "transfer to a registered Safe was refused");
        assertEq(IERC20(canonicalToken).balanceOf(registeredRecipient) - before, amount, "recipient did not receive G$");
    }

    /**
     * Contributor consideration, loan principal, and refunds are all paid to an individual rather
     * than to a Garden Safe, and those addresses are not knowable when the tree is frozen. A
     * recipient allowlist here would have refused every one of them with PARAMETER_NOT_ALLOWED.
     */
    function testFork_reviewedTreePaysAnIndividualContributor() public {
        uint256 amount = 1000e18;
        uint256 before = IERC20(canonicalToken).balanceOf(outsider);

        assertTrue(_send(outsider, amount), "transfer to an individual contributor was refused");
        assertEq(IERC20(canonicalToken).balanceOf(outsider) - before, amount, "contributor did not receive G$");
    }

    function testFork_reviewedTreeRejectsAmountAboveTheAllowance() public {
        uint256 before = IERC20(canonicalToken).balanceOf(registeredRecipient);

        assertEq(
            _expectConditionViolation(
                canonicalToken, abi.encodeWithSelector(canonicalSelector, registeredRecipient, uint256(periodAmount) + 1)
            ),
            STATUS_ALLOWANCE_EXCEEDED,
            "amount was refused for the wrong reason"
        );

        assertEq(IERC20(canonicalToken).balanceOf(registeredRecipient), before, "over-allowance transfer settled");
    }

    function testFork_reviewedTreeRejectsAnySelectorOtherThanTransfer() public {
        assertEq(
            _expectConditionViolation(
                canonicalToken, abi.encodeWithSignature("approve(address,uint256)", outsider, uint256(1000e18))
            ),
            STATUS_FUNCTION_NOT_ALLOWED,
            "selector was refused for the wrong reason"
        );
    }

    function testFork_roleCannotReachAnyTargetOtherThanCanonicalGDollar() public {
        assertEq(
            _expectConditionViolation(registeredRecipient, abi.encodeWithSelector(canonicalSelector, outsider, uint256(1))),
            STATUS_TARGET_ADDRESS_NOT_ALLOWED,
            "target was refused for the wrong reason"
        );
    }

    /**
     * The ceremony and the executor were previously proven apart: this proof drove
     * execTransactionWithRole, which carries an explicit role key, while the unit tests drove
     * configureGardenRoute against a mock whose defaultRoles always answered. Neither crossed the
     * seam, and the real ceremony left defaultRoles at zero — so all eighteen routes would have
     * reverted with PolicyNotConfigured, after ownership had already moved to the Safes and only a
     * Safe transaction per Garden could have fixed it. This drives the live executor against the
     * real modifier the ceremony just finished configuring.
     */
    function testFork_configureGardenRouteAcceptsTheFinishedCeremony() public {
        ICeloSettlementExecutor executor = ICeloSettlementExecutor(EXECUTOR);
        address garden = plan.readAddress(".boundaries[0].garden");

        assertEq(roles.defaultRoles(EXECUTOR), roleKey, "ceremony did not leave the executor a default role");
        assertTrue(roles.isModuleEnabled(EXECUTOR), "ceremony did not leave the executor a Roles member");
        assertTrue(ISafe(safe).isModuleEnabled(address(roles)), "ceremony did not leave the modifier enabled");

        vm.prank(_executorOwner());
        executor.configureGardenRoute(
            garden, safe, address(roles), roleKey, allowanceKey, plan.readBytes32(".boundaries[0].permissionsConfigHash")
        );

        ICeloSettlementExecutor.GardenRoute memory route = executor.gardenRouteOf(garden);
        assertEq(route.safe, safe, "route did not record the Garden Safe");
        assertEq(route.rolesModifier, address(roles), "route did not record the modifier");
        assertTrue(route.active, "route was not activated");
    }

    /**
     * Measures the largest batch Celo can execute beneath the Arbitrum-to-Celo lane's exact
     * 3,000,000-gas per-message ceiling. Every call crosses the live executor, a real Safe, a real
     * Zodiac Roles modifier, G$, and the live CCIP router acknowledgment path at the pinned block.
     * The dedicated proof runner uses forge --isolate so every delivery starts with a fresh
     * transaction access list.
     *
     * The smaller cases preserve the measured sweep's ordering so the batch-six log remains
     * comparable to the frozen release evidence. Batch seven is the adjacent negative boundary,
     * and the separately frozen operational maximum of two must stay inside the measured envelope.
     */
    function testFork_measureDeliverableDestinationGasCeiling() public {
        ICeloSettlementExecutor executor = ICeloSettlementExecutor(EXECUTOR);
        address garden = plan.readAddress(".boundaries[0].garden");
        _activateForMeasurement(executor, garden);

        uint16[5] memory sizes = [uint16(1), 2, 4, DELIVERABLE_MAX_BATCH_SIZE, FIRST_UNDELIVERABLE_BATCH_SIZE];
        uint256 frozenMaxGasUsed;
        uint256 deliverableMaxGasUsed;
        uint256 firstUndeliverableGasUsed;

        for (uint256 caseIndex; caseIndex < sizes.length; ++caseIndex) {
            uint256 size = sizes[caseIndex];
            address[] memory recipients = new address[](size);
            uint256[] memory amounts = new uint256[](size);
            for (uint256 index; index < size; ++index) {
                recipients[index] = address(uint160(0x100000 + caseIndex * 1000 + index));
                amounts[index] = 10_000e18;
            }

            uint256 gasUsed = _deliver(executor, garden, caseIndex + 1, size > 1, recipients, amounts);
            emit log_named_uint(string.concat("batch of ", vm.toString(size), " -> destination gas"), gasUsed);

            if (size == FROZEN_MAX_BATCH_SIZE) frozenMaxGasUsed = gasUsed;
            if (size == DELIVERABLE_MAX_BATCH_SIZE) deliverableMaxGasUsed = gasUsed;
            if (size == FIRST_UNDELIVERABLE_BATCH_SIZE) firstUndeliverableGasUsed = gasUsed;
        }

        assertLe(FROZEN_MAX_BATCH_SIZE, DELIVERABLE_MAX_BATCH_SIZE, "frozen max exceeds measured deliverable max");
        assertLe(frozenMaxGasUsed, CCIP_DESTINATION_GAS_LIMIT, "frozen max batch exceeds the CCIP gas limit");
        assertLe(deliverableMaxGasUsed, CCIP_DESTINATION_GAS_LIMIT, "measured deliverable max exceeds the CCIP limit");
        assertGt(
            firstUndeliverableGasUsed,
            CCIP_DESTINATION_GAS_LIMIT,
            "the claimed deliverable maximum is not the transport boundary"
        );
    }

    function _activateForMeasurement(ICeloSettlementExecutor executor, address garden) private {
        vm.startPrank(_executorOwner());
        executor.configureGardenRoute(
            garden, safe, address(roles), roleKey, allowanceKey, plan.readBytes32(".boundaries[0].permissionsConfigHash")
        );
        executor.setCaps(24, 7_000_000e18, 10_000_000e18);
        executor.setFeePolicy(100, 50_000e18);
        executor.setPeriodicCap(uint64(periodDuration), uint256(periodAmount));
        executor.setAcknowledgmentFeeReserveMinimum(50e18);
        vm.deal(EXECUTOR, 10_000e18);
        executor.setPaused(false);
        vm.stopPrank();
    }

    function _deliver(
        ICeloSettlementExecutor executor,
        address garden,
        uint256 settlementId,
        bool isBatch,
        address[] memory recipients,
        uint256[] memory amounts
    )
        private
        returns (uint256 gasUsed)
    {
        ICeloSettlementExecutor.SourcePeer memory peer = executor.sourcePeer();
        Client.Any2EVMMessage memory message = Client.Any2EVMMessage({
            messageId: keccak256(abi.encode("measure", settlementId)),
            sourceChainSelector: peer.sourceChainSelector,
            sender: abi.encode(peer.sourceSettlementModule),
            data: SettlementMessageCodec.encodeCommand(
                peer.protocolVersion, settlementId, isBatch, 0, garden, 0, recipients, amounts
            ),
            destTokenAmounts: new Client.EVMTokenAmount[](0)
        });

        vm.prank(executor.CCIP_ROUTER());
        uint256 gasBefore = gasleft();
        ICcipReceiver(EXECUTOR).ccipReceive(message);
        gasUsed = gasBefore - gasleft();

        bytes32 executionKey = keccak256(
            abi.encode(peer.sourceChainSelector, peer.sourceSettlementModule, isBatch, settlementId, uint32(0))
        );
        ICeloSettlementExecutor.ExecutionResult memory result = executor.executionResultOf(executionKey);
        assertEq(uint8(result.status), uint8(ICeloSettlementExecutor.ResultStatus.Success), "batch did not settle");
        assertTrue(result.acknowledgmentSent, "acknowledgment was not sent");
        assertTrue(result.acknowledgmentMessageId != bytes32(0), "acknowledgment carries no message id");
    }

    function _executorOwner() private view returns (address) {
        (bool ok, bytes memory data) = EXECUTOR.staticcall(abi.encodeWithSignature("owner()"));
        require(ok && data.length == 32, "could not read the executor owner");
        return abi.decode(data, (address));
    }
}
