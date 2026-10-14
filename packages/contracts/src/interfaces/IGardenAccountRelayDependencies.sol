// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

interface IGardenAccountExecutor {
    function execute(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation
    )
        external
        payable
        returns (bytes memory result);
}

interface ISafeV141 {
    function getOwners() external view returns (address[] memory);
    function isOwner(address owner) external view returns (bool);
    function getThreshold() external view returns (uint256);
    function nonce() external view returns (uint256);

    function getTransactionHash(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address refundReceiver,
        uint256 safeNonce
    )
        external
        view
        returns (bytes32);

    function execTransaction(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address payable refundReceiver,
        bytes calldata signatures
    )
        external
        payable
        returns (bool success);
}
