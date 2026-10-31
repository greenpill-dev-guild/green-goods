// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { StdStorage, stdStorage, Test } from "forge-std/Test.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

import { ICookieJarModule } from "../../src/interfaces/ICookieJarModule.sol";
import { IERC6551Registry } from "../../src/interfaces/IERC6551Registry.sol";
import { IHatsModule } from "../../src/interfaces/IHatsModule.sol";
import { YieldResolver } from "../../src/resolvers/Yield.sol";

interface ILiveCookieJar {
    function currencyHeldByJar() external view returns (uint256);
    function maxWithdrawal() external view returns (uint256);
    function MIN_DEPOSIT() external view returns (uint256);
    function withdraw(uint256 amount, string calldata purpose) external;
    function emergencyWithdraw(address token, uint256 amount) external;
    function pause() external;
}

/// @title ArbitrumYieldResolverUpgradeForkTest
/// @notice Rehearses the YieldResolver upgrade against live Arbitrum state: nothing already stored
///         moves, routed yield reaches a live jar's ledger and can leave it again, and a jar that
///         refuses the deposit leaves that portion with the garden treasury.
contract ArbitrumYieldResolverUpgradeForkTest is Test {
    using stdStorage for StdStorage;

    address private constant TOKENBOUND_REGISTRY = 0x000000006551c19487814612e58FE06813775758;
    bytes32 private constant TOKENBOUND_SALT = 0x6551655165516551655165516551655165516551655165516551655165516551;
    bytes32 private constant IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    address private constant ARBITRUM_DAI = 0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1;
    address private constant ARBITRUM_WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    uint256 private constant REVIEWED_GARDENS = 18;
    uint256 private constant ROOT_TOKEN_ID = 0;
    // A garden whose jars came from the current factory and held nothing at the reviewed block.
    uint256 private constant CURRENT_JAR_TOKEN_ID = 3;

    YieldResolver private resolver;
    ICookieJarModule private jarModule;
    IHatsModule private hatsModule;
    address private gardenToken;
    address private gardenAccountImpl;
    address private newImplementation;
    bytes32 private stateBeforeUpgrade;

    function setUp() public {
        uint256 forkBlock = vm.envUint("YIELD_RESOLVER_UPGRADE_FORK_BLOCK_NUMBER");
        assertGt(forkBlock, 0, "reviewed fork block must be positive");
        vm.createSelectFork(vm.envString("ARBITRUM_RPC_URL"), forkBlock);
        assertEq(block.chainid, 42_161, "fork uses the wrong chain");

        string memory deployment = vm.readFile(string.concat(vm.projectRoot(), "/deployments/42161-latest.json"));
        resolver = YieldResolver(abi.decode(vm.parseJson(deployment, ".yieldSplitter"), (address)));
        jarModule = ICookieJarModule(abi.decode(vm.parseJson(deployment, ".cookieJarModule"), (address)));
        hatsModule = IHatsModule(abi.decode(vm.parseJson(deployment, ".hatsModule"), (address)));
        gardenToken = abi.decode(vm.parseJson(deployment, ".gardenToken"), (address));
        gardenAccountImpl = abi.decode(vm.parseJson(deployment, ".gardenAccountImpl"), (address));
        assertGt(address(resolver).code.length, 0, "YieldResolver proxy must contain code");

        stateBeforeUpgrade = _storedState();
        newImplementation = address(new YieldResolver());
        vm.prank(resolver.owner());
        UUPSUpgradeable(address(resolver)).upgradeTo(newImplementation);
    }

    function testForkArbitrum_yieldResolverUpgradeKeepsStoredState() public {
        assertEq(
            address(uint160(uint256(vm.load(address(resolver), IMPLEMENTATION_SLOT)))),
            newImplementation,
            "proxy did not use the rehearsed implementation"
        );
        assertEq(_storedState(), stateBeforeUpgrade, "stored state moved during upgrade");
    }

    function testForkArbitrum_upgradedResolverLetsYieldLeaveLiveDaiJar() public {
        _assertSeededYieldLeavesLiveJar(ARBITRUM_DAI);
    }

    function testForkArbitrum_upgradedResolverLetsYieldLeaveLiveWethJar() public {
        _assertSeededYieldLeavesLiveJar(ARBITRUM_WETH);
    }

    /// @dev The root garden's jars came from an older factory and take nothing under one whole token.
    function testForkArbitrum_upgradedResolverPaysTreasuryBelowOlderJarMinimum() public {
        address garden = _garden(ROOT_TOKEN_ID);
        address jar = jarModule.getGardenJar(garden, ARBITRUM_WETH);
        address vault = resolver.gardenVaults(garden, ARBITRUM_WETH);
        assertEq(ILiveCookieJar(jar).MIN_DEPOSIT(), 1 ether, "the reviewed root jar should have a minimum");
        vm.prank(resolver.owner());
        resolver.setAssetYieldThreshold(ARBITRUM_WETH, 1);

        uint256 treasuryBefore = IERC20(ARBITRUM_WETH).balanceOf(garden);
        _seedWaitingYield(garden, ARBITRUM_WETH, 0.1 ether);
        resolver.splitYield(garden, ARBITRUM_WETH, vault);

        assertEq(IERC20(ARBITRUM_WETH).balanceOf(jar), 0, "a refused deposit should leave nothing in the jar");
        assertGe(
            IERC20(ARBITRUM_WETH).balanceOf(garden) - treasuryBefore, _jarPortion(0.1 ether), "treasury should take it"
        );

        _seedWaitingYield(garden, ARBITRUM_WETH, 10 ether);
        resolver.splitYield(garden, ARBITRUM_WETH, vault);

        assertEq(ILiveCookieJar(jar).currencyHeldByJar(), _jarPortion(10 ether), "above the minimum the jar should book it");
    }

    function testForkArbitrum_upgradedResolverPaysTreasuryWhenLiveJarIsPaused() public {
        address garden = _garden(CURRENT_JAR_TOKEN_ID);
        address jar = jarModule.getGardenJar(garden, ARBITRUM_DAI);
        vm.prank(garden);
        ILiveCookieJar(jar).pause();

        uint256 treasuryBefore = IERC20(ARBITRUM_DAI).balanceOf(garden);
        _seedWaitingYield(garden, ARBITRUM_DAI, 10 ether);
        resolver.splitYield(garden, ARBITRUM_DAI, resolver.gardenVaults(garden, ARBITRUM_DAI));

        assertEq(IERC20(ARBITRUM_DAI).balanceOf(jar), 0, "a paused jar should receive nothing");
        assertGe(IERC20(ARBITRUM_DAI).balanceOf(garden) - treasuryBefore, _jarPortion(10 ether), "treasury should take it");
        assertEq(IERC20(ARBITRUM_DAI).allowance(address(resolver), jar), 0, "no allowance should remain");
    }

    function _assertSeededYieldLeavesLiveJar(address asset) private {
        address garden = _garden(CURRENT_JAR_TOKEN_ID);
        address jar = jarModule.getGardenJar(garden, asset);
        _seedWaitingYield(garden, asset, 10 ether);

        vm.prank(makeAddr("anyone"));
        resolver.splitYield(garden, asset, resolver.gardenVaults(garden, asset));

        _assertRoutedYieldLeavesTheJar(garden, asset, jar, _jarPortion(10 ether));
    }

    function _assertRoutedYieldLeavesTheJar(address garden, address asset, address jar, uint256 routed) private {
        ILiveCookieJar liveJar = ILiveCookieJar(jar);
        assertEq(IERC20(asset).balanceOf(jar), routed, "jar should hold the routed yield");
        assertEq(liveJar.currencyHeldByJar(), routed, "jar should book the routed yield");
        assertEq(IERC20(asset).allowance(address(resolver), jar), 0, "no allowance should remain");

        address gardener = makeAddr("gardener");
        vm.prank(garden);
        hatsModule.grantRole(garden, gardener, IHatsModule.GardenRole.Gardener);
        uint256 claim = routed < liveJar.maxWithdrawal() ? routed : liveJar.maxWithdrawal();
        vm.prank(gardener);
        liveJar.withdraw(claim, "seed purchase");
        assertEq(IERC20(asset).balanceOf(gardener), claim, "gardener should be paid");

        uint256 rest = routed - claim;
        if (rest > 0) {
            uint256 ownerBefore = IERC20(asset).balanceOf(garden);
            vm.prank(garden);
            liveJar.emergencyWithdraw(asset, rest);
            assertEq(IERC20(asset).balanceOf(garden) - ownerBefore, rest, "jar owner should be paid the rest");
        }
        assertEq(IERC20(asset).balanceOf(jar), 0, "nothing should stay behind");
    }

    /// @dev Leaves the state a below-threshold split leaves: tokens in the resolver, pendingYield booked.
    function _seedWaitingYield(address garden, address asset, uint256 amount) private {
        deal(asset, address(resolver), IERC20(asset).balanceOf(address(resolver)) + amount, false);
        stdstore.target(address(resolver)).sig("pendingYield(address,address)").with_key(garden).with_key(asset)
            .checked_write(amount);
    }

    function _jarPortion(uint256 amount) private view returns (uint256) {
        return (amount * resolver.DEFAULT_COOKIE_JAR_BPS()) / resolver.BPS_DENOMINATOR();
    }

    function _storedState() private view returns (bytes32) {
        bytes memory state = abi.encode(
            resolver.owner(),
            resolver.octantModule(),
            resolver.hypercertMarketplace(),
            resolver.jbMultiTerminal(),
            resolver.juiceboxProjectId(),
            resolver.minYieldThreshold(),
            resolver.minAllocationAmount(),
            resolver.hatsModule(),
            resolver.cookieJarModule(),
            resolver.gardensModule()
        );
        for (uint256 tokenId = 0; tokenId < REVIEWED_GARDENS; tokenId++) {
            address garden = _garden(tokenId);
            state = abi.encode(
                state,
                resolver.getSplitConfig(garden),
                resolver.gardenCookieJars(garden),
                resolver.gardenTreasuries(garden),
                resolver.gardenHypercertPools(garden),
                _assetState(garden, ARBITRUM_DAI),
                _assetState(garden, ARBITRUM_WETH)
            );
        }
        return keccak256(state);
    }

    function _assetState(address garden, address asset) private view returns (bytes memory) {
        address vault = resolver.gardenVaults(garden, asset);
        return abi.encode(
            vault,
            resolver.gardenShares(garden, vault),
            resolver.totalRegisteredShares(vault),
            resolver.pendingYield(garden, asset),
            resolver.escrowedFractions(garden, asset),
            resolver.assetYieldThresholds(asset)
        );
    }

    function _garden(uint256 tokenId) private view returns (address) {
        return IERC6551Registry(TOKENBOUND_REGISTRY)
            .account(gardenAccountImpl, TOKENBOUND_SALT, block.chainid, gardenToken, tokenId);
    }
}
