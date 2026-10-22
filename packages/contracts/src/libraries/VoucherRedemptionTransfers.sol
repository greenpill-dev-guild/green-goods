// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ICLCGiftableToken } from "../interfaces/ICLCGiftableToken.sol";

/// @notice Linked GiftableToken custody checks; custody and state remain in the calling escrow.
/// @dev No mint, reserve pull or pool authority.
library VoucherRedemptionTransfers {
    using SafeERC20 for IERC20;
    error WrongVoucherIssuer();
    error InexactVoucherTransfer();
    error UnlimitedVoucherAllowance();

    /// @dev Initial authorization/intake only: later owner rotation cannot strand deposited units.
    function requireIssuer(address token, address issuer) public view {
        try ICLCGiftableToken(token).owner() returns (address actualOwner) {
            if (actualOwner != issuer) revert WrongVoucherIssuer();
        } catch {
            revert WrongVoucherIssuer();
        }
    }

    function present(address tokenAddress, address holder, uint256 units) public {
        IERC20 token = IERC20(tokenAddress);
        uint256 holderBefore = token.balanceOf(holder);
        uint256 escrowBefore = token.balanceOf(address(this));
        uint256 allowanceBefore = token.allowance(holder, address(this));
        if (allowanceBefore == type(uint256).max) revert UnlimitedVoucherAllowance();
        token.safeTransferFrom(holder, address(this), units);
        _check(token, holder, holderBefore, address(this), escrowBefore, units);
        if (token.allowance(holder, address(this)) != allowanceBefore - units) {
            revert InexactVoucherTransfer();
        }
    }

    function release(address tokenAddress, address recipient, uint256 units) public {
        IERC20 token = IERC20(tokenAddress);
        uint256 escrowBefore = token.balanceOf(address(this));
        uint256 recipientBefore = token.balanceOf(recipient);
        token.safeTransfer(recipient, units);
        _check(token, address(this), escrowBefore, recipient, recipientBefore, units);
    }

    function _check(
        IERC20 token,
        address sender,
        uint256 senderBefore,
        address recipient,
        uint256 recipientBefore,
        uint256 units
    )
        private
        view
    {
        uint256 senderAfter = token.balanceOf(sender);
        uint256 recipientAfter = token.balanceOf(recipient);
        if (
            senderAfter > senderBefore || senderBefore - senderAfter != units || recipientAfter < recipientBefore
                || recipientAfter - recipientBefore != units
        ) revert InexactVoucherTransfer();
    }
}
