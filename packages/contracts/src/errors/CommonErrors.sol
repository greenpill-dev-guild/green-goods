// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title CommonErrors
/// @notice Shared custom errors used across Green Goods contracts
/// @dev Import specific errors: `import { ZeroAddress, ... } from "../errors/CommonErrors.sol";`
///      Centralizing eliminates 35+ redundant declarations across the codebase.

/// @notice Thrown when a zero address is provided where a valid address is required
error ZeroAddress();

/// @notice Thrown when caller is not a garden operator
error NotGardenOperator();

/// @notice Thrown when caller is not authorized to perform the action
error UnauthorizedCaller(address caller);

/// @notice Thrown when input arrays have different lengths
error ArrayLengthMismatch();

/// @notice Thrown when an attestation uses the wrong schema UID
error InvalidSchema();
