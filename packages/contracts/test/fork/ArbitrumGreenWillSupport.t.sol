// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { IOctantVault } from "../../src/interfaces/IOctantFactory.sol";
import { GreenWill } from "../../src/registries/GreenWill.sol";
import { AaveV3ERC4626 } from "../../src/strategies/AaveV3ERC4626.sol";
import { AaveOctantForkBase } from "./helpers/AaveOctantForkBase.sol";

/// @dev Scope: prove that a supporter with a live Arbitrum Octant vault position can
/// claim `FIRST_SUPPORT` directly from onchain state without a GreenWill-specific router.
/// This suite asserts:
/// - direct deposit of a live Aave-capable Arbitrum asset mints vault shares to the supporter
/// - the deposited assets route into the live Aave strategy and are backed by the matching aToken
/// - `GreenWill.claimBadge(FIRST_SUPPORT, abi.encode(garden, asset))` verifies that share position
/// - the badge issuance records the resolved vault as the source reference
contract ArbitrumGreenWillSupportForkTest is AaveOctantForkBase {
    bytes32 internal constant FIRST_SUPPORT_BADGE = keccak256("FIRST_SUPPORT");

    function test_fork_claimsFirstSupportFromLiveVaultPosition() public {
        _requireChainFork("arbitrum");
        address asset = DAI;
        address aToken = ADAI;
        uint256 amount = 0.05 ether;
        _deployFullStackOnForkWithAssets(asset, asset);

        address garden = _mintTestGarden("GreenWill Aave Support Garden", 0x0F);
        address vault = _setupOctantVaultWithAaveAsset(
            garden, asset, aToken, "GreenWill Fork Vaults", "GreenWill Arbitrum DAI", "ggaGWDAI"
        );
        address strategy = octantModule.vaultStrategies(vault);

        GreenWill greenWill = _deployGreenWill();

        greenWill.configureBadgeClass(
            FIRST_SUPPORT_BADGE,
            "first-support",
            "ipfs://first-support",
            address(octantModule),
            address(0),
            address(0),
            true,
            true
        );
        greenWill.configureBadgeRule(FIRST_SUPPORT_BADGE, GreenWill.BadgeRule.VaultShares, bytes32(0), 0);

        address supporter = makeAddr("greenWillSupporter");
        _fundFromLiveAaveReserve(asset, aToken, supporter, amount);

        vm.startPrank(supporter);
        IERC20(asset).approve(vault, amount);
        uint256 shares = IOctantVault(vault).deposit(amount, supporter);
        uint256 tokenId = greenWill.claimBadge(FIRST_SUPPORT_BADGE, abi.encode(garden, asset));
        vm.stopPrank();

        GreenWill.BadgeRecord memory record = greenWill.getBadgeRecord(FIRST_SUPPORT_BADGE, supporter);
        uint256 aTokenBalance = IERC20(aToken).balanceOf(strategy);
        uint256 strategyTotalAssets = AaveV3ERC4626(strategy).totalAssets();
        uint256 idleVaultAssets = IERC20(asset).balanceOf(vault);

        assertGt(shares, 0, "direct support should mint Octant vault shares");
        assertEq(tokenId, 0, "no unlock lock configured in fork claim test");
        assertEq(IOctantVault(vault).asset(), asset, "vault should use the selected live Arbitrum asset");
        assertEq(octantModule.gardenAssetVaults(garden, asset), vault, "GreenWill should resolve the Octant vault");
        assertGt(IOctantVault(vault).balanceOf(supporter), 0, "supporter should hold live vault shares");
        assertApproxEqAbs(
            strategyTotalAssets + idleVaultAssets,
            amount,
            2,
            "support deposit should remain fully accounted for between strategy assets and idle vault assets"
        );
        assertGt(strategyTotalAssets, 0, "support deposit must route into the live Aave strategy");
        assertGt(aTokenBalance, 0, "support deposit must mint the matching live Aave aToken");
        assertApproxEqAbs(aTokenBalance, amount, 2, "aToken balance should approximate the support deposit");

        assertTrue(greenWill.hasBadge(FIRST_SUPPORT_BADGE, supporter), "FIRST_SUPPORT should be issued");
        assertEq(record.issuer, supporter, "supporter self-claim should be recorded as issuer");
        assertEq(
            record.sourceRef, keccak256(abi.encode(garden, asset, vault)), "source ref should match the resolved vault"
        );
    }

    function _deployGreenWill() internal returns (GreenWill greenWill) {
        GreenWill implementation = new GreenWill();
        greenWill = GreenWill(
            address(
                new ERC1967Proxy(
                    address(implementation), abi.encodeWithSelector(GreenWill.initialize.selector, address(this))
                )
            )
        );
    }
}
