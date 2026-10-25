// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @notice Permissionless canonical role refresh; never accepts caller-supplied eligibility.
interface IStewardRoleObserver {
    function syncSteward(address account) external;
}
