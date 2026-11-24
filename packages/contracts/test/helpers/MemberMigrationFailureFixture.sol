// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IMemberMigrationFixtureKernel {
    function changeRootValidator(bytes21 root, address hook, bytes calldata data, bytes calldata hookData) external payable;
}

/// @dev Controlled local failure target, never a replacement for the unverified migration helper.
/// Delegatecall gives the real Kernel a self-call; EntryPoint still validates the fixture owner's signature.
contract MemberMigrationFailureFixture {
    error ControlledMigrationFailure(uint8 stage);

    function failBeforeChange() external pure {
        revert ControlledMigrationFailure(0);
    }

    function changeThenFail(bytes21 root, bytes calldata data) external {
        IMemberMigrationFixtureKernel(address(this)).changeRootValidator(root, address(0), data, "");
        revert ControlledMigrationFailure(1);
    }

    function changeThenExhaustGas(bytes21 root, bytes calldata data) external {
        IMemberMigrationFixtureKernel(address(this)).changeRootValidator(root, address(0), data, "");
        assembly {
            for { } 1 { } { }
        }
    }

    function changeThenReturn(bytes21 root, bytes calldata data) external {
        IMemberMigrationFixtureKernel(address(this)).changeRootValidator(root, address(0), data, "");
    }
}
