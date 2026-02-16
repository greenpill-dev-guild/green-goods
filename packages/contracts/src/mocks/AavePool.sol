// SPDX-License-Identifier: MIT
// solhint-disable one-contract-per-file
pragma solidity ^0.8.25;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title MockAToken
/// @notice Mock aToken that tracks deposits/withdrawals for unit testing AaveV3
contract MockAToken {
    mapping(address account => uint256 balance) public balanceOf;

    function mint(address account, uint256 amount) external {
        balanceOf[account] += amount;
    }

    function burn(address account, uint256 amount) external {
        balanceOf[account] -= amount;
    }
}

/// @title MockAavePool
/// @notice Mock Aave V3 Pool that simulates supply/withdraw without real Aave
/// @dev Transfers underlying tokens and mints/burns mock aTokens accordingly
contract MockAavePool {
    MockAToken public immutable mockAToken;

    constructor(address _mockAToken) {
        mockAToken = MockAToken(_mockAToken);
    }

    function supply(address asset, uint256 amount, address onBehalfOf, uint16) external {
        IERC20(asset).transferFrom(msg.sender, address(this), amount);
        mockAToken.mint(onBehalfOf, amount);
    }

    function withdraw(address asset, uint256 amount, address to) external returns (uint256) {
        mockAToken.burn(msg.sender, amount);
        IERC20(asset).transfer(to, amount);
        return amount;
    }
}
