// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { ERC1155 } from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

import { CookieJarModule } from "../../../src/modules/CookieJar.sol";
import { YieldResolver } from "../../../src/resolvers/Yield.sol";
import { IHatsModule } from "../../../src/interfaces/IHatsModule.sol";
import { MockERC20 } from "../../../src/mocks/ERC20.sol";

contract TestHatsProtocol is ERC1155 {
    constructor() ERC1155("") { }

    function mint(address to, uint256 id, uint256 amount) external {
        _mint(to, id, amount, "");
    }
}

interface ICookieJarLike {
    function deposit(uint256 amount) external payable;
    function withdraw(uint256 amount, string calldata purpose) external;
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

    function grantRole(address, address, GardenRole) external { }
    function revokeRole(address, address, GardenRole) external { }
    function grantRoles(address, address[] calldata, GardenRole[] calldata) external { }
    function revokeRoles(address, address[] calldata, GardenRole[] calldata) external { }
    function setConvictionStrategies(address, address[] calldata) external { }

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

contract MockVaultForCookieJarFork {
    MockERC20 public immutable asset;
    mapping(address => uint256) public shares;

    constructor(address _asset) {
        asset = MockERC20(_asset);
    }

    function mintShares(address to, uint256 amount) external {
        shares[to] += amount;
    }

    function redeem(
        uint256 sharesAmount,
        address receiver,
        address,
        uint256,
        address[] calldata
    )
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
    address internal factory;
    CookieJarModule internal cookieJarModule;
    YieldResolver internal yieldSplitter;
    MockERC20 internal token;
    MockVaultForCookieJarFork internal vault;

    function _rpcEnvVar() internal pure virtual returns (string memory);

    function setUp() public {
        string memory rpcUrl = _getRpc(_rpcEnvVar());
        if (bytes(rpcUrl).length == 0) return;
        vm.createSelectFork(rpcUrl);

        factory = _getCookieJarFactory(block.chainid);
        if (factory == address(0)) return;

        hatsProtocol = new TestHatsProtocol();
        hatsModule = new TestHatsModule();
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
            factory,
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

        token.mint(address(this), 100 ether);
        token.approve(jar, 100 ether);
        ICookieJarLike(jar).deposit(100 ether);

        vm.prank(gardener);
        vm.expectRevert();
        ICookieJarLike(jar).withdraw(10 ether, "gated-withdrawal");

        hatsProtocol.mint(gardener, GARDENER_HAT_ID, 1);

        uint256 beforeBal = token.balanceOf(gardener);
        vm.prank(gardener);
        ICookieJarLike(jar).withdraw(10 ether, "gated-withdrawal");
        assertEq(token.balanceOf(gardener) - beforeBal, 10 ether, "hats wearer should withdraw");
    }

    function test_fork_routes_4865bps_to_cookie_jar_via_yield_splitter() public {
        if (address(yieldSplitter) == address(0)) return;

        address jar = cookieJarModule.getGardenJar(garden, address(token));
        uint256 yieldAmount = 1000 ether;

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

    function _getCookieJarFactory(uint256 chainId) internal view returns (address) {
        // Optional explicit override (useful for local debugging)
        try vm.envAddress("COOKIE_JAR_FACTORY_ADDRESS") returns (address factoryAddress) {
            if (factoryAddress != address(0)) return factoryAddress;
        } catch { }

        // Deployed addresses sourced from sibling cookie-jar repo:
        // contracts/broadcast/Deploy.s.sol/{chainId}/run-latest.json
        if (chainId == 42_161) return 0xfe367D31d181D305dcF5AAaa345a70A65c345153; // Arbitrum
        if (chainId == 11_155_111) return 0x021368bf9958f4D535d39d571Bc45f74d20e4666; // Sepolia

        return address(0);
    }
}
