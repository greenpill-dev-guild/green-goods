// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {CookieJarModule} from "../../../src/modules/CookieJar.sol";
import {YieldResolver} from "../../../src/resolvers/Yield.sol";
import {ICookieJarFactory} from "../../../src/interfaces/ICookieJarFactory.sol";
import {IHatsModule} from "../../../src/interfaces/IHatsModule.sol";
import {MockERC20} from "../../../src/mocks/ERC20.sol";

contract TestHatsProtocol is ERC1155 {
    constructor() ERC1155("") {}

    function mint(address to, uint256 id, uint256 amount) external {
        _mint(to, id, amount, "");
    }
}

contract TestHatsModule is IHatsModule {
    struct GardenHats {
        uint256 ownerHatId;
        uint256 operatorHatId;
        uint256 evaluatorHatId;
        uint256 gardenerHatId;
        uint256 funderHatId;
        uint256 communityHatId;
        uint256 adminHatId;
        bool configured;
    }

    mapping(address => GardenHats) internal hats;

    function setGardenHats(address garden, uint256 gardenerHatId) external {
        hats[garden] = GardenHats(1, 2, 3, gardenerHatId, 5, 6, 7, true);
    }

    function getGardenHatIds(address garden)
        external
        view
        returns (uint256, uint256, uint256, uint256, uint256, uint256, uint256, bool)
    {
        GardenHats storage config = hats[garden];
        return (
            config.ownerHatId,
            config.operatorHatId,
            config.evaluatorHatId,
            config.gardenerHatId,
            config.funderHatId,
            config.communityHatId,
            config.adminHatId,
            config.configured
        );
    }

    function createGardenHatTree(address, string calldata, address) external pure returns (uint256) {
        return 0;
    }

    function grantRole(address, address, GardenRole) external {}
    function revokeRole(address, address, GardenRole) external {}
    function grantRoles(address, address[] calldata, GardenRole[] calldata) external {}
    function revokeRoles(address, address[] calldata, GardenRole[] calldata) external {}
    function setConvictionStrategies(address, address[] calldata) external {}

    function getConvictionStrategies(address) external pure returns (address[] memory) {
        return new address[](0);
    }

    function isGardenerOf(address, address) external pure returns (bool) {
        return false;
    }

    function isEvaluatorOf(address, address) external pure returns (bool) {
        return false;
    }

    function isOperatorOf(address, address) external pure returns (bool) {
        return false;
    }

    function isOwnerOf(address, address) external pure returns (bool) {
        return false;
    }

    function isFunderOf(address, address) external pure returns (bool) {
        return false;
    }

    function isCommunityOf(address, address) external pure returns (bool) {
        return false;
    }
}

contract TestCookieJar {
    error MissingHat(uint256 hatId, address wearer);

    address public immutable hatsProtocol;
    uint256 public immutable requiredHatId;

    constructor(address _hatsProtocol, uint256 _requiredHatId) {
        hatsProtocol = _hatsProtocol;
        requiredHatId = _requiredHatId;
    }

    function withdraw(address token, uint256 amount, address to) external {
        if (ERC1155(hatsProtocol).balanceOf(msg.sender, requiredHatId) == 0) {
            revert MissingHat(requiredHatId, msg.sender);
        }
        IERC20(token).transfer(to, amount);
    }
}

contract RealCookieJarFactoryForFork is ICookieJarFactory {
    function createCookieJar(JarConfig calldata, AccessConfig calldata accessConfig, MultiTokenConfig calldata)
        external
        returns (address jarAddress)
    {
        jarAddress =
            address(new TestCookieJar(accessConfig.nftRequirement.nftContract, accessConfig.nftRequirement.tokenId));
    }
}

contract MockVaultForCookieJarFork {
    MockERC20 public immutable asset;
    mapping(address => uint256) public shares;

    constructor(address _asset) {
        asset = MockERC20(_asset);
    }

    function mintShares(address to, uint256 amount) external {
        shares[to] += amount;
    }

    function redeem(uint256 sharesAmount, address receiver, address, uint256, address[] calldata)
        external
        returns (uint256 assets)
    {
        require(shares[msg.sender] >= sharesAmount, "insufficient shares");
        shares[msg.sender] -= sharesAmount;
        asset.transfer(receiver, sharesAmount);
        return sharesAmount;
    }
}

abstract contract CookieJarForkTestBase is Test {
    address internal owner = makeAddr("owner");
    address internal octantModule = makeAddr("octant");
    address internal garden = makeAddr("garden");
    address internal treasury = makeAddr("treasury");
    address internal gardener = makeAddr("gardener");

    uint256 internal constant GARDENER_HAT_ID = 4242;

    TestHatsProtocol internal hatsProtocol;
    TestHatsModule internal hatsModule;
    RealCookieJarFactoryForFork internal factory;
    CookieJarModule internal cookieJarModule;
    YieldResolver internal yieldSplitter;
    MockERC20 internal token;
    MockVaultForCookieJarFork internal vault;

    function _rpcEnvVar() internal pure virtual returns (string memory);

    function setUp() public {
        string memory rpcUrl = _getRpc(_rpcEnvVar());
        if (bytes(rpcUrl).length == 0) return;
        vm.createSelectFork(rpcUrl);

        hatsProtocol = new TestHatsProtocol();
        hatsModule = new TestHatsModule();
        factory = new RealCookieJarFactoryForFork();
        token = new MockERC20();
        vault = new MockVaultForCookieJarFork(address(token));

        hatsModule.setGardenHats(garden, GARDENER_HAT_ID);

        address[] memory assets = new address[](1);
        assets[0] = address(token);

        CookieJarModule cookieJarImpl = new CookieJarModule();
        bytes memory cookieJarInit = abi.encodeWithSelector(
            CookieJarModule.initialize.selector,
            owner,
            address(hatsModule),
            address(0),
            address(factory),
            address(hatsProtocol),
            assets
        );
        cookieJarModule = CookieJarModule(address(new ERC1967Proxy(address(cookieJarImpl), cookieJarInit)));

        YieldResolver yieldImpl = new YieldResolver();
        bytes memory yieldInit =
            abi.encodeWithSelector(YieldResolver.initialize.selector, owner, octantModule, address(hatsModule), 1);
        yieldSplitter = YieldResolver(address(new ERC1967Proxy(address(yieldImpl), yieldInit)));

        vm.startPrank(owner);
        cookieJarModule.setGardenToken(address(this));
        yieldSplitter.setCookieJarModule(address(cookieJarModule));
        yieldSplitter.setGardenTreasury(garden, treasury);
        yieldSplitter.setGardenVault(garden, address(token), address(vault));
        vm.stopPrank();

        cookieJarModule.onGardenMinted(garden);
    }

    function test_fork_createsJar_deposit_and_hatsGatedWithdrawal() public {
        if (address(cookieJarModule) == address(0)) return;

        address jar = cookieJarModule.getGardenJar(garden, address(token));
        assertTrue(jar != address(0), "jar should be created");

        token.mint(address(this), 100e6);
        token.transfer(jar, 100e6);

        vm.prank(gardener);
        vm.expectRevert();
        TestCookieJar(jar).withdraw(address(token), 10e6, gardener);

        hatsProtocol.mint(gardener, GARDENER_HAT_ID, 1);

        uint256 beforeBal = token.balanceOf(gardener);
        vm.prank(gardener);
        TestCookieJar(jar).withdraw(address(token), 10e6, gardener);
        assertEq(token.balanceOf(gardener) - beforeBal, 10e6, "hats wearer should withdraw");
    }

    function test_fork_routes_4865bps_to_cookie_jar_via_yield_splitter() public {
        if (address(yieldSplitter) == address(0)) return;

        address jar = cookieJarModule.getGardenJar(garden, address(token));
        uint256 yieldAmount = 1_000e6;

        token.mint(address(vault), yieldAmount);
        vault.mintShares(address(yieldSplitter), yieldAmount);

        vm.prank(octantModule);
        yieldSplitter.registerShares(garden, address(vault), yieldAmount);

        uint256 jarBefore = token.balanceOf(jar);
        yieldSplitter.splitYield(garden, address(token), address(vault));

        uint256 expectedCookieJar = (yieldAmount * 4865) / 10_000;
        uint256 jarDelta = token.balanceOf(jar) - jarBefore;
        assertEq(jarDelta, expectedCookieJar, "cookie jar should receive 48.65%");
    }

    function _getRpc(string memory envVar) internal view returns (string memory) {
        try vm.envString(envVar) returns (string memory rpcUrl) {
            return rpcUrl;
        } catch {
            return "";
        }
    }
}
