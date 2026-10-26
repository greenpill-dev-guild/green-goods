// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @notice Hand-written purchase interface from CLC docs/SPEC.md at
///         ce090fd3d5a7493c726fb939da39af15ef1c9d7c. No upstream source is imported.
/// @dev Argument order is output token, input token. Quotes are temporary and may call a
///      stateful quoter, so these declarations deliberately do not impose STATICCALL.
///      Only the bounded swap overload is exposed to integration consumers.
interface ICLCSwapPool {
    error Expired();
    error InsufficientOutput();
    error UnauthorizedToken();
    error LimitExceeded();
    error InsufficientBalance();
    error FeeTooHigh();
    error InvalidRecipient();
    error InvalidToken();
    error TransferFailed();
    error Sealed();

    /// @dev Learner identity comes from bounded calldata and the output-token Transfer log.
    event SwapSettlement(
        address indexed initiator,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 quotedAmountOut,
        uint256 nominalAmountOut,
        uint256 amountOut,
        uint256 poolFee,
        uint256 protocolFee
    );

    function withdraw(
        address tokenOut,
        address tokenIn,
        uint256 amountIn,
        address learner,
        uint256 minAmountOut,
        uint256 deadline
    )
        external
        returns (uint256 amountOut);

    function getAmountOut(address tokenOut, address tokenIn, uint256 amountIn) external returns (uint256 amountOut);

    function getAmountIn(address tokenOut, address tokenIn, uint256 amountOut) external returns (uint256 amountIn);
}
