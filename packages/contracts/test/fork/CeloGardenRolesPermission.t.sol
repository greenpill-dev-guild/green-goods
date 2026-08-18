// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { stdJson } from "forge-std/StdJson.sol";

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
}

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
}

contract CeloGardenRolesPermissionForkTest is Test {
    using stdJson for string;

    address private constant FACTORY = 0x000000000000aDdB49795b0f9bA5BC298cDda236;
    address private constant ROLES_MASTERCOPY = 0x9646fDAD06d3e24444381f44362a3B0eB343D337;
    address private constant EXECUTOR = 0xB8a7F3c3DfA407c45e05b7B2381233101938a84F;

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
    address private registeredRecipient;
    address private outsider = address(0xBEEF);

    IRoles private roles;

    function setUp() public {
        vm.createSelectFork(vm.envString("CELO_RPC_URL"));
        plan = vm.readFile("./.generated/runtime/42220-garden-roles.json");

        deploymentOperator = plan.readAddress(".modifierOwnerAtDeployment");
        canonicalToken = plan.readAddress(".canonicalTarget");
        canonicalSelector = bytes4(plan.readBytes(".canonicalSelector"));
        roleKey = plan.readBytes32(".roleKey");
        allowanceKey = plan.readBytes32(".allowanceKey");
        periodAmount = uint128(plan.readUint(".allowance.refill"));
        periodDuration = uint64(plan.readUint(".allowance.period"));

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
        // Ownership moves to the Safe while the modifier is still inert.
        roles.transferOwnership(safe);
        vm.stopPrank();

        assertEq(roles.owner(), safe, "ownership did not transfer to the Safe");

        // Only now does the modifier gain authority.
        vm.prank(safe);
        ISafe(safe).enableModule(address(roles));
        assertTrue(ISafe(safe).isModuleEnabled(address(roles)), "module was not enabled on the Safe");

        deal(canonicalToken, safe, uint256(periodAmount) * 2);
    }

    function _send(address to, uint256 amount) private returns (bool) {
        vm.prank(EXECUTOR);
        return roles.execTransactionWithRole(
            canonicalToken, 0, abi.encodeWithSelector(canonicalSelector, to, amount), 0, roleKey, false
        );
    }

    function testFork_reviewedTreeAllowsOnlyRegisteredRecipientsWithinAllowance() public {
        uint256 amount = 1000e18;
        uint256 before = IERC20(canonicalToken).balanceOf(registeredRecipient);

        assertTrue(_send(registeredRecipient, amount), "transfer to a registered Safe was refused");
        assertEq(IERC20(canonicalToken).balanceOf(registeredRecipient) - before, amount, "recipient did not receive G$");
    }

    /**
     * Roles reverts on a condition violation regardless of the shouldRevert flag, which only governs
     * whether an inner call's own revert bubbles. A denied transfer therefore fails loudly rather
     * than returning false, and no G$ moves.
     */
    function testFork_reviewedTreeRejectsUnregisteredRecipient() public {
        uint256 before = IERC20(canonicalToken).balanceOf(outsider);

        vm.expectRevert();
        _send(outsider, 1000e18);

        assertEq(IERC20(canonicalToken).balanceOf(outsider), before, "unregistered address received G$");
    }

    function testFork_reviewedTreeRejectsAmountAboveTheAllowance() public {
        uint256 before = IERC20(canonicalToken).balanceOf(registeredRecipient);

        vm.expectRevert();
        _send(registeredRecipient, uint256(periodAmount) + 1);

        assertEq(IERC20(canonicalToken).balanceOf(registeredRecipient), before, "over-allowance transfer settled");
    }

    function testFork_reviewedTreeRejectsAnySelectorOtherThanTransfer() public {
        vm.prank(EXECUTOR);
        vm.expectRevert();
        roles.execTransactionWithRole(
            canonicalToken, 0, abi.encodeWithSignature("approve(address,uint256)", outsider, 1000e18), 0, roleKey, false
        );
    }

    function testFork_roleCannotReachAnyTargetOtherThanCanonicalGDollar() public {
        vm.prank(EXECUTOR);
        vm.expectRevert();
        roles.execTransactionWithRole(
            registeredRecipient, 0, abi.encodeWithSelector(canonicalSelector, outsider, 1), 0, roleKey, false
        );
    }
}
