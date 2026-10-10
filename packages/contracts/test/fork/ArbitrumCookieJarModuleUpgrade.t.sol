// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

import { IERC6551Registry } from "../../src/interfaces/IERC6551Registry.sol";
import { CookieJarModule } from "../../src/modules/CookieJar.sol";
import { CookieJarAssetLimits } from "../../script/CookieJarAssetLimits.sol";

interface ILiveCookieJar {
    function maxWithdrawal() external view returns (uint256);
    function CURRENCY() external view returns (address);
}

/// @notice Stands in for a newly supported DAI-like asset, so the rehearsal can watch the upgraded
///         module create one more jar for a garden that already has its DAI and WETH jars.
contract RehearsalDai is ERC20 {
    constructor() ERC20("Rehearsal DAI", "DAI") { }
}

/// @title ArbitrumCookieJarModuleUpgradeForkTest
/// @notice Rehearses the CookieJarModule upgrade against live Arbitrum state: nothing already
///         stored moves, deployed jars keep their limits, and new jars take their asset's limit.
contract ArbitrumCookieJarModuleUpgradeForkTest is Test {
    struct ModuleSnapshot {
        address owner;
        address hatsModule;
        address gardenToken;
        address yieldSplitter;
        address cookieJarFactory;
        address hatsProtocol;
        uint256 defaultMaxWithdrawal;
        uint256 defaultWithdrawalInterval;
        bool defaultStrictPurpose;
        bytes32 supportedAssetsHash;
        bytes32 gardenJarsHash;
    }

    address private constant TOKENBOUND_REGISTRY = 0x000000006551c19487814612e58FE06813775758;
    bytes32 private constant TOKENBOUND_SALT = 0x6551655165516551655165516551655165516551655165516551655165516551;
    bytes32 private constant IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    address private constant ARBITRUM_DAI = 0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1;
    address private constant ARBITRUM_WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    uint256 private constant REVIEWED_GARDENS = 8;

    CookieJarModule private module;
    address private gardenToken;
    address private gardenAccountImpl;

    function setUp() public {
        uint256 forkBlock = vm.envUint("COOKIE_JAR_MODULE_UPGRADE_FORK_BLOCK_NUMBER");
        assertGt(forkBlock, 0, "reviewed fork block must be positive");
        vm.createSelectFork(vm.envString("ARBITRUM_RPC_URL"), forkBlock);
        assertEq(block.chainid, 42_161, "fork uses the wrong chain");

        string memory deployment = vm.readFile(string.concat(vm.projectRoot(), "/deployments/42161-latest.json"));
        module = CookieJarModule(abi.decode(vm.parseJson(deployment, ".cookieJarModule"), (address)));
        gardenToken = abi.decode(vm.parseJson(deployment, ".gardenToken"), (address));
        gardenAccountImpl = abi.decode(vm.parseJson(deployment, ".gardenAccountImpl"), (address));
        assertGt(address(module).code.length, 0, "CookieJarModule proxy must contain code");
    }

    function testForkArbitrum_cookieJarModuleUpgradeKeepsLiveJarsAndLimitsNewOnes() public {
        ModuleSnapshot memory before = _snapshot();
        address firstGarden = _garden(0);
        address liveDaiJar = module.getGardenJar(firstGarden, ARBITRUM_DAI);
        assertGt(liveDaiJar.code.length, 0, "the first garden should already hold a DAI jar");
        uint256 liveDaiLimit = ILiveCookieJar(liveDaiJar).maxWithdrawal();

        CookieJarModule newImplementation = new CookieJarModule();
        vm.startPrank(before.owner);
        UUPSUpgradeable(address(module)).upgradeTo(address(newImplementation));
        uint256 limitsWritten = CookieJarAssetLimits.applyTo(module);
        vm.stopPrank();

        assertEq(_implementation(), address(newImplementation), "proxy did not use the rehearsed implementation");
        assertEq(keccak256(abi.encode(_snapshot())), keccak256(abi.encode(before)), "stored state moved during upgrade");
        assertEq(limitsWritten, 2, "DAI and WETH should each receive a limit");
        assertEq(module.assetMaxWithdrawal(ARBITRUM_DAI), 10 ether, "new DAI jars should allow 10 DAI");
        assertEq(module.assetMaxWithdrawal(ARBITRUM_WETH), 0.01 ether, "new WETH jars should allow 0.01 WETH");
        assertEq(ILiveCookieJar(liveDaiJar).maxWithdrawal(), liveDaiLimit, "a jar already deployed must keep its own limit");

        // One more supported asset makes the live module create one more jar for a live garden,
        // through the live factory and that garden's real gardener hat.
        address rehearsalDai = address(new RehearsalDai());
        vm.startPrank(before.owner);
        module.addSupportedAsset(rehearsalDai);
        CookieJarAssetLimits.applyTo(module);
        vm.stopPrank();

        vm.prank(gardenToken);
        module.onGardenMinted(firstGarden);

        address newJar = module.getGardenJar(firstGarden, rehearsalDai);
        assertGt(newJar.code.length, 0, "the upgraded module should deploy the new jar");
        assertEq(ILiveCookieJar(newJar).CURRENCY(), rehearsalDai, "the new jar should hold the new asset");
        assertEq(ILiveCookieJar(newJar).maxWithdrawal(), 10 ether, "a new DAI jar should allow 10 DAI per claim");
        assertEq(module.getGardenJar(firstGarden, ARBITRUM_DAI), liveDaiJar, "the garden's live DAI jar must not change");
    }

    function _snapshot() private view returns (ModuleSnapshot memory snapshot) {
        address[][] memory gardenJars = new address[][](REVIEWED_GARDENS);
        for (uint256 tokenId = 0; tokenId < REVIEWED_GARDENS; tokenId++) {
            gardenJars[tokenId] = module.getGardenJars(_garden(tokenId));
        }

        snapshot = ModuleSnapshot({
            owner: module.owner(),
            hatsModule: address(module.hatsModule()),
            gardenToken: module.gardenToken(),
            yieldSplitter: module.yieldSplitter(),
            cookieJarFactory: address(module.cookieJarFactory()),
            hatsProtocol: module.hatsProtocol(),
            defaultMaxWithdrawal: module.defaultMaxWithdrawal(),
            defaultWithdrawalInterval: module.defaultWithdrawalInterval(),
            defaultStrictPurpose: module.defaultStrictPurpose(),
            supportedAssetsHash: keccak256(abi.encode(module.getSupportedAssets())),
            gardenJarsHash: keccak256(abi.encode(gardenJars))
        });
    }

    function _garden(uint256 tokenId) private view returns (address) {
        return IERC6551Registry(TOKENBOUND_REGISTRY)
            .account(gardenAccountImpl, TOKENBOUND_SALT, block.chainid, gardenToken, tokenId);
    }

    function _implementation() private view returns (address) {
        return address(uint160(uint256(vm.load(address(module), IMPLEMENTATION_SLOT))));
    }
}
