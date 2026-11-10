// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IERC6551Account } from "../interfaces/IERC6551Account.sol";

/// @notice The garden token's record of which accounts belong to minted gardens
interface IGardenTokenAccounts {
    function isGardenAccount(address account) external view returns (bool);
    function firstUpgradeableTokenId() external view returns (uint80);
}

/// @title GardenAccountsLib
/// @notice Tells the garden token's two account generations apart: the older accounts of gardens minted before
///         its first upgradeable token ID, and the upgradeable accounts of every garden minted from then on.
library GardenAccountsLib {
    /// @notice Whether `account` is the account of a garden minted before the first upgradeable token ID
    function isOlderGardenAccount(address gardenToken, address account) internal view returns (bool) {
        (bool bound, uint256 tokenId) = _boundTokenId(account);
        return bound && tokenId < IGardenTokenAccounts(gardenToken).firstUpgradeableTokenId()
            && IGardenTokenAccounts(gardenToken).isGardenAccount(account);
    }

    /// @notice Whether `account` is the upgradeable account of a garden minted from the first upgradeable token ID on
    function isUpgradeableGardenAccount(address gardenToken, address account) internal view returns (bool) {
        (bool bound, uint256 tokenId) = _boundTokenId(account);
        return bound && tokenId >= IGardenTokenAccounts(gardenToken).firstUpgradeableTokenId()
            && IGardenTokenAccounts(gardenToken).isGardenAccount(account);
    }

    /// @dev The token ID an account reports. Not a `try`: an account that answers with nothing reverts while
    ///      decoding, in the caller's frame, where no `catch` would see it.
    function _boundTokenId(address account) private view returns (bool bound, uint256 tokenId) {
        if (account.code.length == 0) return (false, 0);
        (bool answered, bytes memory answer) = account.staticcall(abi.encodeCall(IERC6551Account.token, ()));
        if (!answered || answer.length != 96) return (false, 0);
        (,, tokenId) = abi.decode(answer, (uint256, uint256, uint256));
        return (true, tokenId);
    }
}
