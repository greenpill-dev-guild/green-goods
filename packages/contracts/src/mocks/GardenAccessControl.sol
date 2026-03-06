// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IGardenAccessControl } from "../interfaces/IGardenAccessControl.sol";

/// @title MockGardenAccessControl
/// @notice Mock implementation of IGardenAccessControl for unit testing resolvers
/// @dev Allows tests to set arbitrary role assignments without HatsModule/GardenAccount wiring
contract MockGardenAccessControl is IGardenAccessControl {
    mapping(address account => bool) public gardenerRole;
    mapping(address account => bool) public evaluatorRole;
    mapping(address account => bool) public operatorRole;
    mapping(address account => bool) public ownerRole;
    mapping(address account => bool) public funderRole;
    mapping(address account => bool) public communityRole;

    function setGardener(address account, bool status) external {
        gardenerRole[account] = status;
    }

    function setEvaluator(address account, bool status) external {
        evaluatorRole[account] = status;
    }

    function setOperator(address account, bool status) external {
        operatorRole[account] = status;
    }

    function setOwner(address account, bool status) external {
        ownerRole[account] = status;
    }

    function setFunder(address account, bool status) external {
        funderRole[account] = status;
    }

    function setCommunity(address account, bool status) external {
        communityRole[account] = status;
    }

    function isGardener(address account) external view override returns (bool) {
        return gardenerRole[account];
    }

    function isEvaluator(address account) external view override returns (bool) {
        return evaluatorRole[account];
    }

    function isOperator(address account) external view override returns (bool) {
        return operatorRole[account];
    }

    function isOwner(address account) external view override returns (bool) {
        return ownerRole[account];
    }

    function isFunder(address account) external view override returns (bool) {
        return funderRole[account];
    }

    function isCommunity(address account) external view override returns (bool) {
        return communityRole[account];
    }
}
