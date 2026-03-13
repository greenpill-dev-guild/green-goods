// SPDX-License-Identifier: MIT
// solhint-disable one-contract-per-file
pragma solidity ^0.8.25;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title MockAToken
/// @notice Mock aToken that tracks deposits/withdrawals for unit testing AaveV3
/// @dev In real Aave V3, the aToken contract holds the underlying asset.
///      This mock approves the pool to pull underlying during withdrawals.
contract MockAToken {
    mapping(address account => uint256 balance) public balanceOf;
    uint256 public totalSupply;

    /// @notice Approve a spender (the pool) to pull underlying tokens held by this aToken
    function approveUnderlying(address asset, address spender) external {
        IERC20(asset).approve(spender, type(uint256).max);
    }

    function mint(address account, uint256 amount) external {
        balanceOf[account] += amount;
        totalSupply += amount;
    }

    function burn(address account, uint256 amount) external {
        balanceOf[account] -= amount;
        totalSupply -= amount;
    }
}

/// @title MockAavePool
/// @notice Mock Aave V3 Pool that simulates supply/withdraw without real Aave
/// @dev Matches real Aave V3 token flow: underlying is held by the aToken contract,
///      NOT the Pool proxy. supply() routes tokens to aToken, withdraw() pulls from aToken.
contract MockAavePool {
    MockAToken public immutable mockAToken;

    /// @notice When non-zero, cap the amount returned by withdraw to simulate Aave partial liquidity
    uint256 public partialWithdrawLimit;

    constructor(address _mockAToken) {
        mockAToken = MockAToken(_mockAToken);
    }

    function setPartialWithdrawLimit(uint256 limit) external {
        partialWithdrawLimit = limit;
    }

    function supply(address asset, uint256 amount, address onBehalfOf, uint16) external {
        // Real Aave V3: underlying goes to aToken contract, not Pool
        IERC20(asset).transferFrom(msg.sender, address(mockAToken), amount);
        mockAToken.mint(onBehalfOf, amount);
    }

    function withdraw(address asset, uint256 amount, address to) external returns (uint256) {
        uint256 actual = (partialWithdrawLimit > 0 && amount > partialWithdrawLimit) ? partialWithdrawLimit : amount;
        mockAToken.burn(msg.sender, actual);
        // Real Aave V3: underlying is pulled from aToken contract
        IERC20(asset).transferFrom(address(mockAToken), to, actual);
        return actual;
    }
}

/// @title MockPoolDataProvider
/// @notice Minimal Aave data provider mock for AaveV3ERC4626 unit tests.
contract MockPoolDataProvider {
    MockAToken public immutable mockAToken;

    uint256 public supplyCap;
    bool public reserveActive = true;
    bool public reserveFrozen;
    bool public reservePaused;

    constructor(address _mockAToken) {
        mockAToken = MockAToken(_mockAToken);
    }

    function setReserveCaps(uint256 _supplyCap) external {
        supplyCap = _supplyCap;
    }

    function setReserveState(bool isActive, bool isFrozen, bool isPaused) external {
        reserveActive = isActive;
        reserveFrozen = isFrozen;
        reservePaused = isPaused;
    }

    function getReserveConfigurationData(address)
        external
        view
        returns (uint256, uint256, uint256, uint256, uint256, bool, bool, bool, bool, bool)
    {
        return (18, 0, 0, 0, 0, false, false, false, reserveActive, reserveFrozen);
    }

    function getReserveCaps(address) external view returns (uint256, uint256) {
        return (0, supplyCap);
    }

    function getPaused(address) external view returns (bool) {
        return reservePaused;
    }

    function getATokenTotalSupply(address) external view returns (uint256) {
        return mockAToken.totalSupply();
    }
}
