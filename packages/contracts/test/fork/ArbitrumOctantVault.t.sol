// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ForkTestBase } from "./helpers/ForkTestBase.sol";
import { GardenAccount } from "../../src/accounts/Garden.sol";
import { IHatsModule } from "../../src/interfaces/IHatsModule.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { AaveV3 } from "../../src/strategies/AaveV3.sol";
import { MultistrategyVault } from "../../src/vendor/octant/core/MultistrategyVault.sol";
import { MultistrategyVaultFactory } from "../../src/vendor/octant/factories/MultistrategyVaultFactory.sol";
import { IOctantVault } from "../../src/interfaces/IOctantFactory.sol";

/// @title ArbitrumOctantVaultForkTest
/// @notice Fork tests for OctantModule vault lifecycle against real Aave V3 on Arbitrum.
/// @dev Extends ForkTestBase for full-stack deployment with real GardenToken, HatsModule,
///      and GardenAccount (TBA). Uses real Arbitrum Aave V3 pool for vault strategy.
contract ArbitrumOctantVaultForkTest is ForkTestBase {
    // ═══════════════════════════════════════════════════════════════════════════
    // External Contract Addresses (Arbitrum Mainnet)
    // ═══════════════════════════════════════════════════════════════════════════

    address internal constant AAVE_V3_POOL = 0x794a61358D6845594F94dc1DB02A252b5b4814aD;
    address internal constant WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    address internal constant AWETH = 0xe50fA9b3c56FfB159cB0FCA61F5c9D750e8128c8;

    // ═══════════════════════════════════════════════════════════════════════════
    // Helpers
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Set up a real Aave-backed Octant vault for a garden
    function _setupOctantVaultWithAave(address garden) internal returns (address vault) {
        MultistrategyVault vaultImpl = new MultistrategyVault();
        MultistrategyVaultFactory vaultFactory =
            new MultistrategyVaultFactory("Green Goods Octant Fork", address(vaultImpl), address(this));

        AaveV3 strategy = new AaveV3(WETH, AAVE_V3_POOL, AWETH, address(octantModule));

        octantModule.setOctantFactory(address(vaultFactory));
        octantModule.setSupportedAsset(WETH, address(strategy));
        octantModule.setDonationAddress(garden, address(yieldSplitter));

        vault = octantModule.createVaultForAsset(garden, WETH);
        assertTrue(vault != address(0), "vault should be created");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Full vault lifecycle with real Aave V3 strategy
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkLifecycle_realOctantVaultWithAaveStrategy() public {
        if (!_tryChainFork("arbitrum")) {
            emit log("SKIPPED: No Arbitrum RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        // Mint garden with real GardenAccount TBA
        (address garden,) = _setupGardenWithRolesAndAction("Octant Vault Garden");
        GardenAccount gardenAcct = GardenAccount(payable(garden));

        // Verify real roles via HatsModule
        assertTrue(hatsModule.isOperatorOf(garden, forkOperator), "operator should have role");

        // Set up real Aave-backed vault
        address vault = _setupOctantVaultWithAave(garden);

        // Deposit WETH
        uint256 depositAmount = 0.5 ether;
        deal(WETH, address(this), depositAmount);
        IERC20(WETH).approve(vault, depositAmount);
        uint256 mintedShares = IOctantVault(vault).deposit(depositAmount, address(this));
        assertGt(mintedShares, 0, "deposit should mint shares");

        // Withdraw partial
        uint256 withdrawnShares = IOctantVault(vault).withdraw(0.1 ether, address(this), address(this), 0, new address[](0));
        assertGt(withdrawnShares, 0, "withdraw should burn shares");

        // Harvest through real OctantModule (uses real GardenAccount for auth)
        octantModule.harvest(garden, WETH);

        // Emergency pause (owner action via real access control)
        octantModule.emergencyPause(garden, WETH);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Vault auto-created on garden mint via OctantModule callback
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkLifecycle_vaultCreatedOnGardenMint() public {
        if (!_tryChainFork("arbitrum")) {
            emit log("SKIPPED: No Arbitrum RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        // Set up vault factory + strategy BEFORE minting
        MultistrategyVault vaultImpl = new MultistrategyVault();
        MultistrategyVaultFactory vaultFactory =
            new MultistrategyVaultFactory("Green Goods Octant Fork", address(vaultImpl), address(this));
        AaveV3 strategy = new AaveV3(WETH, AAVE_V3_POOL, AWETH, address(octantModule));
        octantModule.setOctantFactory(address(vaultFactory));
        octantModule.setSupportedAsset(WETH, address(strategy));

        // Mint garden — triggers onGardenMinted callback on OctantModule
        address garden = _mintTestGarden("Auto Vault Garden", 0x0F);
        assertTrue(garden != address(0), "garden should be created");

        // Vault should exist for this garden+WETH
        address vault = octantModule.getVaultForAsset(garden, WETH);
        assertTrue(vault != address(0), "vault should be auto-created on mint");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Non-member cannot harvest (real access control)
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkLifecycle_unauthorizedHarvestReverts() public {
        if (!_tryChainFork("arbitrum")) {
            emit log("SKIPPED: No Arbitrum RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        (address garden,) = _setupGardenWithRolesAndAction("Auth Test Garden");
        _setupOctantVaultWithAave(garden);

        // Non-member should not be able to harvest via OctantModule
        // (OctantModule.harvest checks isOperatorOf or isOwnerOf on the garden)
        vm.prank(forkNonMember);
        vm.expectRevert(bytes4(keccak256("UnauthorizedCaller(address)")));
        octantModule.harvest(garden, WETH);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: YieldResolver wiring after harvest
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkLifecycle_yieldResolverWiringAfterHarvest() public {
        if (!_tryChainFork("arbitrum")) {
            emit log("SKIPPED: No Arbitrum RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        (address garden,) = _setupGardenWithRolesAndAction("Yield Wiring Garden");
        address vault = _setupOctantVaultWithAave(garden);

        // Deposit and time warp
        uint256 depositAmount = 1 ether;
        deal(WETH, address(this), depositAmount);
        IERC20(WETH).approve(vault, depositAmount);
        IOctantVault(vault).deposit(depositAmount, address(this));

        vm.warp(block.timestamp + 30 days);
        vm.roll(block.number + 216_000);

        octantModule.harvest(garden, WETH);

        // Verify vault registered in YieldResolver
        address registeredVault = yieldSplitter.gardenVaults(garden, WETH);
        assertEq(registeredVault, vault, "vault should be registered in YieldResolver");
    }
}
