// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import { CookieJarModule } from "../src/modules/CookieJar.sol";

/// @title CookieJarAssetLimits
/// @notice The per-claim limit new garden jars are created with, by asset: 10 DAI and 0.01 WETH
/// @dev One shared value capped every asset at 0.01, which is a fair WETH claim and one cent of DAI.
///      The module records asset addresses only, so an asset is recognised by its ERC-20 symbol.
///      That is safe here because only the module owner adds supported assets. Deploy and upgrade
///      runs both call `applyTo`, so a fresh deployment and an upgraded one end up the same.
library CookieJarAssetLimits {
    /// @notice The ruled limit for an asset in its smallest unit, or zero when it has none
    function limitFor(address asset) internal view returns (uint256) {
        // try/catch does not cover the check that the target has code, so rule it out first.
        if (asset.code.length == 0) return 0;

        string memory symbol;
        uint256 unit;
        try IERC20Metadata(asset).symbol() returns (string memory value) {
            symbol = value;
        } catch {
            return 0;
        }
        try IERC20Metadata(asset).decimals() returns (uint8 value) {
            unit = 10 ** uint256(value);
        } catch {
            return 0;
        }

        bytes32 id = keccak256(bytes(symbol));
        if (id == keccak256("DAI")) return 10 * unit;
        if (id == keccak256("WETH")) return unit / 100;
        return 0;
    }

    /// @notice Write the ruled limit for every supported asset that does not already carry it
    /// @dev Caller must be the module owner. Assets with no ruled limit keep defaultMaxWithdrawal.
    /// @return changed How many limits were written
    function applyTo(CookieJarModule module) internal returns (uint256 changed) {
        address[] memory assets = module.getSupportedAssets();
        for (uint256 i = 0; i < assets.length; i++) {
            uint256 limit = limitFor(assets[i]);
            if (limit == 0 || module.assetMaxWithdrawal(assets[i]) == limit) continue;

            module.setAssetMaxWithdrawal(assets[i], limit);
            changed++;
        }
    }
}
