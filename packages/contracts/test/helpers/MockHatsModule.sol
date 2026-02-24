// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25;

import { IHatsModule } from "../../src/interfaces/IHatsModule.sol";

/// @title MockHatsModule
/// @notice Shared mock for IHatsModule used across test files
/// @dev Includes call tracking (CreateCall, GrantCall) for integration tests.
///      Files needing only the stub can ignore tracking fields.
contract MockHatsModule is IHatsModule {
    struct CreateCall {
        address garden;
        string name;
        address communityToken;
    }

    struct GrantCall {
        address garden;
        address account;
        GardenRole role;
    }

    CreateCall public lastCreate;
    bool public created;
    GrantCall[] public grantCalls;

    // ═══════════════════════════════════════════════════════════════════════════
    // Configurable return values for role queries
    // ═══════════════════════════════════════════════════════════════════════════

    mapping(address garden => mapping(address account => bool)) public gardenerOf;
    mapping(address garden => mapping(address account => bool)) public evaluatorOf;
    mapping(address garden => mapping(address account => bool)) public operatorOf;
    mapping(address garden => mapping(address account => bool)) public ownerOf;
    mapping(address garden => mapping(address account => bool)) public funderOf;
    mapping(address garden => mapping(address account => bool)) public communityOf;

    function setGardener(address garden, address account, bool value) external {
        gardenerOf[garden][account] = value;
    }

    function setEvaluator(address garden, address account, bool value) external {
        evaluatorOf[garden][account] = value;
    }

    function setOperator(address garden, address account, bool value) external {
        operatorOf[garden][account] = value;
    }

    function setOwner(address garden, address account, bool value) external {
        ownerOf[garden][account] = value;
    }

    function setFunder(address garden, address account, bool value) external {
        funderOf[garden][account] = value;
    }

    function setCommunity(address garden, address account, bool value) external {
        communityOf[garden][account] = value;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Tracking helpers
    // ═══════════════════════════════════════════════════════════════════════════

    function grantCallsLength() external view returns (uint256) {
        return grantCalls.length;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // IHatsModule Implementation
    // ═══════════════════════════════════════════════════════════════════════════

    function createGardenHatTree(
        address garden,
        string calldata name,
        address communityToken
    )
        external
        returns (uint256 adminHatId)
    {
        lastCreate = CreateCall({ garden: garden, name: name, communityToken: communityToken });
        created = true;
        return 123;
    }

    function grantRole(address garden, address account, GardenRole role) external {
        grantCalls.push(GrantCall({ garden: garden, account: account, role: role }));
        _setRole(garden, account, role, true);
    }

    function revokeRole(address garden, address account, GardenRole role) external {
        _setRole(garden, account, role, false);
    }

    function grantRoles(address garden, address[] calldata accounts, GardenRole[] calldata roles) external {
        for (uint256 i = 0; i < accounts.length; i++) {
            grantCalls.push(GrantCall({ garden: garden, account: accounts[i], role: roles[i] }));
        }
    }

    function revokeRoles(address, address[] calldata, GardenRole[] calldata) external { }

    function setConvictionStrategies(address, address[] calldata) external { }

    function getConvictionStrategies(address) external pure returns (address[] memory) {
        return new address[](0);
    }

    function isGardenerOf(address garden, address account) external view returns (bool) {
        return gardenerOf[garden][account];
    }

    function isEvaluatorOf(address garden, address account) external view returns (bool) {
        return evaluatorOf[garden][account];
    }

    function isOperatorOf(address garden, address account) external view returns (bool) {
        return operatorOf[garden][account];
    }

    function isOwnerOf(address garden, address account) external view returns (bool) {
        return ownerOf[garden][account];
    }

    function isFunderOf(address garden, address account) external view returns (bool) {
        return funderOf[garden][account];
    }

    function isCommunityOf(address garden, address account) external view returns (bool) {
        return communityOf[garden][account];
    }

    function getGardenHatIds(address)
        external
        pure
        returns (uint256, uint256, uint256, uint256, uint256, uint256, uint256, bool)
    {
        return (0, 0, 0, 0, 0, 0, 0, false);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Internal
    // ═══════════════════════════════════════════════════════════════════════════

    function _setRole(address garden, address account, GardenRole role, bool value) internal {
        if (role == GardenRole.Owner) ownerOf[garden][account] = value;
        else if (role == GardenRole.Operator) operatorOf[garden][account] = value;
        else if (role == GardenRole.Evaluator) evaluatorOf[garden][account] = value;
        else if (role == GardenRole.Gardener) gardenerOf[garden][account] = value;
        else if (role == GardenRole.Funder) funderOf[garden][account] = value;
        else if (role == GardenRole.Community) communityOf[garden][account] = value;
    }
}
