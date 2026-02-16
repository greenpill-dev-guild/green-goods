// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.25;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IMultistrategyVault } from "@octant/core/interfaces/IMultistrategyVault.sol";

/**
 * @title ERC20 Safe Approve Library
 * @author [Golem Foundation](https://golem.foundation)
 * @custom:security-contact security@golem.foundation
 * @notice Library for safe ERC20 approve operations handling non-standard tokens
 * @dev Handles tokens that don't return bool or revert silently
 *
 *      PROBLEM SOLVED:
 *      - Some tokens (USDT, BNB) don't return bool from approve()
 *      - Some tokens revert silently on approval failure
 *      - Standard Solidity expects bool return value
 *
 *      SOLUTION:
 *      - Uses low-level call to handle any return data format
 *      - Validates success flag
 *      - Validates return data if present
 *      - Reverts with ApprovalFailed() on any failure
 *
 * @custom:security Critical for compatibility with non-standard ERC20 tokens
 */
library ERC20SafeApproveLib {
    /**
     * @notice Safely approves ERC20 tokens handling non-standard implementations
     * @dev Uses low-level call to handle tokens that:
     *      - Don't return bool (e.g., USDT)
     *      - Return false instead of reverting
     *      - Have non-standard approval behavior
     * @param token ERC20 token address
     * @param spender Address being approved to spend tokens
     * @param amount Amount to approve
     * @custom:security Reverts with ApprovalFailed() on any failure
     */
    function safeApprove(address token, address spender, uint256 amount) external {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(IERC20.approve.selector, spender, amount));
        if (!success || (data.length > 0 && !abi.decode(data, (bool)))) {
            revert IMultistrategyVault.ApprovalFailed();
        }
    }
}
