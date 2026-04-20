// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { IOctantVault } from "../../src/interfaces/IOctantFactory.sol";
import { GreenWillRegistry } from "../../src/registries/GreenWillRegistry.sol";
import { GreenWillSupportRouter } from "../../src/modules/GreenWillSupportRouter.sol";
import { AaveOctantForkBase, IWETH9 } from "./helpers/AaveOctantForkBase.sol";

/// @dev Scope: prove that `GreenWillSupportRouter.fundVault` on live Arbitrum state
/// (a) resolves the Octant vault for a garden-asset pair, (b) mints real vault shares
/// to the supporter, and (c) issues the `FIRST_SUPPORT` badge via the registry.
/// The vault is configured with a live Aave strategy (see `_setupOctantVaultWithAave`),
/// but auto-allocation from vault idle funds into that strategy is a governance/keeper
/// step (`update_debt`) that `fundVault` does not perform in one transaction — that
/// invariant is covered by `test/fork/ArbitrumAaveStrategy.t.sol` and
/// `test/fork/ArbitrumVaultYieldE2E.t.sol`. This suite intentionally asserts on
/// routing + share minting + badge issuance only.
contract ArbitrumGreenWillSupportForkTest is AaveOctantForkBase {
    bytes32 internal constant FIRST_SUPPORT_BADGE = keccak256("FIRST_SUPPORT");

    function test_fork_routesLiveWethSupportThroughOctantVaultAndIssuesFirstSupport() public {
        _requireChainFork("arbitrum");
        _deployFullStackOnFork();

        address garden = _mintTestGarden("GreenWill WETH Support Garden", 0x0F);
        address vault = _setupOctantVaultWithAave(garden, "GreenWill Fork Vaults", "GreenWill Arbitrum WETH", "ggaGWETH");

        GreenWillRegistry registry = _deployGreenWillRegistry();
        GreenWillSupportRouter supportRouter = _deployGreenWillSupportRouter(registry);

        registry.configureBadgeClass(
            FIRST_SUPPORT_BADGE,
            "first-support",
            "ipfs://first-support",
            address(0),
            address(supportRouter),
            address(0),
            false,
            true
        );

        address supporter = makeAddr("greenWillSupporter");
        uint256 amount = 0.05 ether;
        vm.deal(supporter, amount);

        vm.startPrank(supporter);
        IWETH9(WETH).deposit{ value: amount }();
        IERC20(WETH).approve(address(supportRouter), amount);
        uint256 shares = supportRouter.fundVault(garden, WETH, amount);
        vm.stopPrank();

        GreenWillRegistry.BadgeRecord memory record = registry.getBadgeRecord(FIRST_SUPPORT_BADGE, supporter);

        assertGt(shares, 0, "router support should mint Octant vault shares");
        assertEq(IOctantVault(vault).asset(), WETH, "vault should use live Arbitrum WETH");
        assertEq(octantModule.gardenAssetVaults(garden, WETH), vault, "router should resolve the Octant vault");
        assertGt(IOctantVault(vault).balanceOf(supporter), 0, "supporter should receive vault shares");
        assertTrue(registry.hasBadge(FIRST_SUPPORT_BADGE, supporter), "FIRST_SUPPORT should be issued");
        assertEq(record.issuer, address(supportRouter), "support router should be the authorized issuer");
        assertEq(record.sourceRef, keccak256(abi.encode(garden, WETH, vault, supporter)), "source ref should match route");
    }

    function _deployGreenWillRegistry() internal returns (GreenWillRegistry registry) {
        GreenWillRegistry implementation = new GreenWillRegistry();
        registry = GreenWillRegistry(
            address(
                new ERC1967Proxy(
                    address(implementation), abi.encodeWithSelector(GreenWillRegistry.initialize.selector, address(this))
                )
            )
        );
    }

    function _deployGreenWillSupportRouter(GreenWillRegistry registry)
        internal
        returns (GreenWillSupportRouter supportRouter)
    {
        GreenWillSupportRouter implementation = new GreenWillSupportRouter();
        supportRouter = GreenWillSupportRouter(
            address(
                new ERC1967Proxy(
                    address(implementation),
                    abi.encodeWithSelector(
                        GreenWillSupportRouter.initialize.selector,
                        address(this),
                        address(registry),
                        address(octantModule),
                        FIRST_SUPPORT_BADGE
                    )
                )
            )
        );
    }
}
