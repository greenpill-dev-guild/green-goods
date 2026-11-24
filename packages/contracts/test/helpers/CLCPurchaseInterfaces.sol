// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { ICLCSwapPool } from "../../src/interfaces/ICLCSwapPool.sol";

// Hand-written fixture configuration interfaces from published CLC docs/SPEC.md at
// ce090fd3d5a7493c726fb939da39af15ef1c9d7c. No implementation source is imported.
interface ICLCPurchasePool is ICLCSwapPool {
    function initialize(
        string calldata name,
        string calldata symbol,
        uint8 decimals,
        address owner,
        address feePolicy,
        address feeAddress,
        address tokenRegistry,
        address tokenLimiter,
        address quoter,
        bool feesDecoupled,
        address protocolFeeController
    )
        external;

    function deposit(address token, uint256 amount) external returns (uint256 received);
    function withdrawLiquidity(address token, address recipient, uint256 amount) external;
    function owner() external view returns (address);
    function feePolicy() external view returns (address);
    function feeAddress() external view returns (address);
    function tokenRegistry() external view returns (address);
    function tokenLimiter() external view returns (address);
    function quoter() external view returns (address);
    function protocolFeeController() external view returns (address);
    function feesDecoupled() external view returns (bool);
    function fees(address token) external view returns (uint256);
    function seal(uint8 state) external;
    function isSealed(uint8 state) external view returns (bool);
    function setQuoter(address quoter) external;
}

interface ICLCPurchaseIndex {
    function initialize(address owner, address[] calldata tokens, bytes32[] calldata symbols) external;
    function register(address token) external;
    function remove(address token) external;
    function have(address token) external view returns (bool);
    function owner() external view returns (address);
}

interface ICLCPurchaseLimiter {
    function initialize(address owner) external;
    function setLimitFor(address token, address holder, uint256 amount) external;
    function limitOf(address token, address holder) external view returns (uint256);
    function isWriter(address writer) external view returns (bool);
    function owner() external view returns (address);
}

interface ICLCPurchaseQuoter {
    function initialize(address owner) external;
    function setPriceIndexValue(address token, uint256 rate) external;
    function owner() external view returns (address);
}

interface ICLCPurchaseFeePolicy {
    function initialize(address owner, uint256 defaultFee) external;
    function setDefaultFee(uint256 fee) external;
    function setPairFee(address tokenIn, address tokenOut, uint256 fee) external;
    function getFee(address tokenIn, address tokenOut) external view returns (uint256);
    function owner() external view returns (address);
}

interface ICLCPurchaseProtocolFee {
    function initialize(address owner, uint256 fee, address recipient) external;
    function setActive(bool active) external;
    function owner() external view returns (address);
}

/// @dev Actual Gnosis WXDAI, used only as an explicitly labeled local-rehearsal payment asset.
interface IRehearsalWXDAI is IERC20Metadata {
    function deposit() external payable;
}
