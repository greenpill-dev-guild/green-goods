// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { OctantModule } from "../../src/modules/Octant.sol";
import { IOctantVault } from "../../src/interfaces/IOctantFactory.sol";
import { MockGardenAccessControl } from "../../src/mocks/GardenAccessControl.sol";
import { AaveV3 } from "../../src/strategies/AaveV3.sol";
import { MultistrategyVault } from "../../src/vendor/octant/core/MultistrategyVault.sol";
import { MultistrategyVaultFactory } from "../../src/vendor/octant/factories/MultistrategyVaultFactory.sol";

contract ArbitrumOctantGarden is MockGardenAccessControl {
    string public name;

    constructor(string memory _name) {
        name = _name;
    }
}

contract ArbitrumOctantVaultForkTest is Test {
    address internal constant AAVE_V3_POOL = 0x794a61358D6845594F94dc1DB02A252b5b4814aD;
    address internal constant WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    address internal constant AWETH = 0xe50fA9b3c56FfB159cB0FCA61F5c9D750e8128c8;

    address internal constant GARDEN_TOKEN = address(0xA11);
    address internal constant OPERATOR = address(0xA12);
    address internal constant GARDEN_OWNER = address(0xA13);
    address internal constant USER = address(0xA14);
    address internal constant DONATION = address(0xA15);

    function _tryFork() internal returns (bool) {
        string memory rpc;
        try vm.envString("ARBITRUM_RPC_URL") returns (string memory value) {
            rpc = value;
        } catch {
            try vm.envString("ARBITRUM_RPC") returns (string memory fallback_) {
                rpc = fallback_;
            } catch {
                return false;
            }
        }

        if (bytes(rpc).length == 0) return false;

        uint256 forkId = vm.createFork(rpc);
        vm.selectFork(forkId);
        return true;
    }

    function test_forkLifecycle_realOctantVaultWithAaveStrategy() public {
        if (!_tryFork()) {
            emit log("SKIPPED: ARBITRUM_RPC_URL not set");
            return;
        }

        MultistrategyVault vaultImplementation = new MultistrategyVault();
        MultistrategyVaultFactory factory =
            new MultistrategyVaultFactory("Green Goods Arbitrum Octant", address(vaultImplementation), address(this));

        OctantModule implementation = new OctantModule();
        bytes memory initData =
            abi.encodeWithSelector(OctantModule.initialize.selector, address(this), address(factory), 7 days);
        OctantModule module = OctantModule(address(new ERC1967Proxy(address(implementation), initData)));
        module.setGardenToken(GARDEN_TOKEN);

        AaveV3 strategy = new AaveV3(WETH, AAVE_V3_POOL, AWETH, address(module));
        module.setSupportedAsset(WETH, address(strategy));

        ArbitrumOctantGarden garden = new ArbitrumOctantGarden("Arbitrum Octant Garden");
        garden.setOperator(OPERATOR, true);
        garden.setOwner(GARDEN_OWNER, true);

        vm.prank(GARDEN_TOKEN);
        module.onGardenMinted(address(garden), "Arbitrum Octant Garden");

        address vaultAddress = module.getVaultForAsset(address(garden), WETH);
        assertTrue(vaultAddress != address(0), "vault should be created through octant module");

        uint256 depositAmount = 0.5 ether;
        deal(WETH, USER, depositAmount);

        vm.startPrank(USER);
        IERC20(WETH).approve(vaultAddress, depositAmount);
        uint256 mintedShares = IOctantVault(vaultAddress).deposit(depositAmount, USER);
        vm.stopPrank();

        assertGt(mintedShares, 0, "deposit should mint shares");

        vm.prank(USER);
        uint256 withdrawnShares = IOctantVault(vaultAddress).withdraw(0.1 ether, USER, USER, 0, new address[](0));
        assertGt(withdrawnShares, 0, "withdraw should burn shares");

        vm.prank(OPERATOR);
        module.setDonationAddress(address(garden), DONATION);

        vm.prank(OPERATOR);
        module.harvest(address(garden), WETH);

        vm.prank(GARDEN_OWNER);
        module.emergencyPause(address(garden), WETH);

        assertTrue(strategy.depositsPaused(), "emergencyPause should shut down strategy deposits");
    }
}
