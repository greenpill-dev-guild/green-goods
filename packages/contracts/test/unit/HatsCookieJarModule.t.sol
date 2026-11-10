// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { CookieJarModule } from "../../src/modules/CookieJar.sol";
import { HatsCookieJarModule, IHatsJarFactory } from "../../src/modules/HatsCookieJar.sol";
import { ICookieJarFactory } from "../../src/interfaces/ICookieJarFactory.sol";
import { ICookieJarModule } from "../../src/interfaces/ICookieJarModule.sol";

/// @dev An address with no code, which a misbehaving factory hands back as a jar.
address constant CODELESS_JAR = address(0xC0DE1E55);

// ═══════════════════════════════════════════════════════════════════════════
// Mocks
// ═══════════════════════════════════════════════════════════════════════════

/// @notice A deployed jar. The registry only requires that a jar has code.
contract JarStub { }

/// @notice The parts of GardenCookieJarFactory v1 the registry reads, plus a switch that makes it hand back a jar
///         the real factory never would.
/// @dev Faithful where the registry depends on it: only the registrar creates, a config must name the factory's
///      Hats contract and a nonzero generation, and each garden, asset and generation gets one jar, recorded as
///      the factory's.
contract HatsJarFactoryMock {
    enum Fault {
        None,
        RepeatedJar,
        CodelessJar,
        UnrecordedJar,
        MisfiledJar
    }

    bytes32 public immutable FAMILY;
    uint256 public immutable VERSION;
    address public immutable HATS;
    address public registrar;
    mapping(address garden => mapping(address asset => mapping(uint256 generation => address jar))) public jarFor;
    mapping(address jar => bool) public isFactoryJar;

    address private _faultyAsset;
    Fault private _fault;
    address private _lastJar;

    error NotRegistrar();
    error InvalidConfiguration();
    error JarAlreadyExists();

    constructor(bytes32 family, uint256 version, address hats, address registrar_) {
        FAMILY = family;
        VERSION = version;
        HATS = hats;
        registrar = registrar_;
    }

    /// @notice Governance choosing another registrar, which the real factory allows for future deployments.
    function setRegistrar(address nextRegistrar) external {
        registrar = nextRegistrar;
    }

    /// @notice Answer every later request for `asset`'s jar with `fault`. RepeatedJar files the previous jar again,
    ///         under this asset, CodelessJar records an address with no code, UnrecordedJar leaves its jar unmarked
    ///         as the factory's, and MisfiledJar files its jar under no garden, asset and generation.
    function misbehaveFor(address asset, Fault fault) external {
        _faultyAsset = asset;
        _fault = fault;
    }

    function createJar(IHatsJarFactory.Config calldata config, uint256 generation) external returns (address jar) {
        if (msg.sender != registrar) revert NotRegistrar();
        if (config.hats != HATS || generation == 0) revert InvalidConfiguration();
        if (jarFor[config.garden][config.asset][generation] != address(0)) revert JarAlreadyExists();

        Fault fault = config.asset == _faultyAsset ? _fault : Fault.None;
        if (fault == Fault.RepeatedJar) jar = _lastJar;
        else if (fault == Fault.CodelessJar) jar = CODELESS_JAR;
        else jar = address(new JarStub());
        if (fault != Fault.MisfiledJar) jarFor[config.garden][config.asset][generation] = jar;
        if (fault != Fault.UnrecordedJar) isFactoryJar[jar] = true;
        _lastJar = jar;
    }
}

/// @notice The garden token's record of garden accounts and of the token ID where its upgradeable accounts begin.
contract GardenTokenAccountsMock {
    uint80 public firstUpgradeableTokenId;
    mapping(address account => bool) public isGardenAccount;

    constructor(uint80 firstUpgradeableTokenId_) {
        firstUpgradeableTokenId = firstUpgradeableTokenId_;
    }

    function setGardenAccount(address account) external {
        isGardenAccount[account] = true;
    }
}

/// @notice A token-bound garden account. The registry reads its token ID to tell older accounts from upgradeable
///         ones.
contract GardenAccountStub {
    address private immutable TOKEN_CONTRACT;
    uint256 private immutable TOKEN_ID;

    constructor(address tokenContract, uint256 tokenId) {
        TOKEN_CONTRACT = tokenContract;
        TOKEN_ID = tokenId;
    }

    function token() external view returns (uint256 chainId, address tokenContract, uint256 tokenId) {
        return (block.chainid, TOKEN_CONTRACT, TOKEN_ID);
    }
}

/// @notice Each garden's role Hats in HatsModule.getGardenHatIds order, all zero for a garden without a tree.
contract GardenHatsMock {
    mapping(address garden => uint256 adminHat) private _adminHat;

    function setHatTree(address garden, uint256 adminHat) external {
        _adminHat[garden] = adminHat;
    }

    function getGardenHatIds(address garden)
        external
        view
        returns (uint256, uint256, uint256, uint256, uint256, uint256, uint256, bool)
    {
        uint256 admin = _adminHat[garden];
        if (admin == 0) return (0, 0, 0, 0, 0, 0, 0, false);
        // Owner, Steward, Evaluator, Gardener, Funder, Community, admin, configured
        return (admin + 1, admin + 2, admin + 3, admin + 4, admin + 5, admin + 6, admin, true);
    }
}

/// @notice The Release C CookieJarFactory, which made the jars an older garden lists from its mint.
contract LegacyJarFactoryMock {
    function createCookieJar(
        ICookieJarFactory.JarConfig calldata,
        ICookieJarFactory.AccessConfig calldata,
        ICookieJarFactory.MultiTokenConfig calldata
    )
        external
        returns (address)
    {
        return address(new JarStub());
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

/// @title HatsCookieJarModuleTest
/// @notice Pair provisioning and the unlisting guard that the Hats jar upgrade adds to the Cookie Jar registry.
/// @dev setUp follows the reviewed Safe packet: a Release C registry whose older gardens list their mint jars, a
///      factory whose registrar is that registry, then the upgrade to HatsCookieJarModule.
contract HatsCookieJarModuleTest is Test {
    bytes32 private constant FACTORY_FAMILY = keccak256("GREEN_GOODS_GARDEN_COOKIE_JAR_FACTORY");
    uint256 private constant GENERATION = 1;
    /// @dev As on Arbitrum One, where gardens 0 to 17 have older accounts.
    uint80 private constant FIRST_UPGRADEABLE_TOKEN_ID = 18;

    address private owner = makeAddr("protocol Safe");
    address private hats = makeAddr("Hats Protocol");
    address private weth = makeAddr("WETH");
    address private dai = makeAddr("DAI");

    GardenHatsMock private hatsModule;
    GardenTokenAccountsMock private gardenToken;
    HatsJarFactoryMock private factory;
    HatsCookieJarModule private module;

    /// @dev An older garden with an empty registry entry, like each of the 18 gardens before activation.
    address private garden;
    /// @dev An older garden that still lists the jars Release C made at its mint.
    address private legacyGarden;

    function setUp() public {
        hatsModule = new GardenHatsMock();
        gardenToken = new GardenTokenAccountsMock(FIRST_UPGRADEABLE_TOKEN_ID);
        garden = _olderGarden(0, 1000);
        legacyGarden = _olderGarden(1, 2000);

        address[] memory assets = new address[](2);
        assets[0] = weth;
        assets[1] = dai;
        bytes memory initialization = abi.encodeCall(
            CookieJarModule.initialize,
            (owner, address(hatsModule), makeAddr("yield"), address(new LegacyJarFactoryMock()), hats, assets)
        );
        address registry = address(new ERC1967Proxy(address(new CookieJarModule()), initialization));
        vm.prank(owner);
        CookieJarModule(registry).setGardenToken(address(gardenToken));
        vm.prank(address(gardenToken));
        CookieJarModule(registry).onGardenMinted(legacyGarden);

        factory = new HatsJarFactoryMock(FACTORY_FAMILY, 1, hats, registry);
        HatsCookieJarModule implementation = new HatsCookieJarModule(IHatsJarFactory(address(factory)));
        vm.prank(owner);
        CookieJarModule(registry).upgradeTo(address(implementation));
        module = HatsCookieJarModule(registry);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Provisioning
    // ═══════════════════════════════════════════════════════════════════════════

    function testHatsCookieJarModule_provisionListsBothJarsForAGardenWithNoJars() public {
        (IHatsJarFactory.Config memory wethConfig, IHatsJarFactory.Config memory daiConfig) = _pair(garden);
        uint256 nonce = vm.getNonce(address(factory));
        address expectedWethJar = computeCreateAddress(address(factory), nonce);
        address expectedDaiJar = computeCreateAddress(address(factory), nonce + 1);

        // The factory receives each queued config unchanged, policy included.
        vm.expectCall(address(factory), abi.encodeCall(IHatsJarFactory.createJar, (wethConfig, GENERATION)));
        vm.expectCall(address(factory), abi.encodeCall(IHatsJarFactory.createJar, (daiConfig, GENERATION)));
        vm.expectEmit(true, true, true, true, address(module));
        emit ICookieJarModule.JarCreated(garden, weth, expectedWethJar);
        vm.expectEmit(true, true, true, true, address(module));
        emit ICookieJarModule.JarCreated(garden, dai, expectedDaiJar);
        vm.prank(owner);
        (address wethJar, address daiJar) = module.provisionHatsJarPair(wethConfig, daiConfig, GENERATION);

        assertEq(wethJar, expectedWethJar, "returns the factory's new WETH jar");
        assertEq(daiJar, expectedDaiJar, "returns the factory's new DAI jar");
        assertEq(module.getGardenJar(garden, weth), wethJar, "yield finds the WETH jar");
        assertEq(module.getGardenJar(garden, dai), daiJar, "yield finds the DAI jar");
        address[] memory pair = new address[](2);
        pair[0] = wethJar;
        pair[1] = daiJar;
        assertEq(module.getGardenJars(garden), pair, "the garden lists the pair in order");
    }

    function testHatsCookieJarModule_provisionRevertsWhenCallerIsNotOwner() public {
        (IHatsJarFactory.Config memory wethConfig, IHatsJarFactory.Config memory daiConfig) = _pair(garden);
        address stranger = makeAddr("stranger");

        vm.prank(stranger);
        vm.expectRevert("Ownable: caller is not the owner");
        module.provisionHatsJarPair(wethConfig, daiConfig, GENERATION);
    }

    function testHatsCookieJarModule_provisionRevertsWhenPairIsInvalid() public {
        bytes memory refusal = abi.encodeWithSelector(HatsCookieJarModule.InvalidJarPair.selector);
        address usdc = makeAddr("USDC");

        (IHatsJarFactory.Config memory first, IHatsJarFactory.Config memory second) = _pair(garden);
        _expectRefusal(first, second, 0, refusal, "generation zero");

        (first, second) = _pair(address(0));
        _expectRefusal(first, second, GENERATION, refusal, "no garden");

        (first, second) = _pair(garden);
        second.garden = legacyGarden;
        _expectRefusal(first, second, GENERATION, refusal, "two gardens");

        (first, second) = _pair(garden);
        second.asset = weth;
        _expectRefusal(first, second, GENERATION, refusal, "one asset twice");

        (first, second) = _pair(garden);
        first.asset = usdc;
        _expectRefusal(first, second, GENERATION, refusal, "first asset unsupported");

        (first, second) = _pair(garden);
        second.asset = usdc;
        _expectRefusal(first, second, GENERATION, refusal, "second asset unsupported");
    }

    function testHatsCookieJarModule_provisionRevertsWhenGardenIsNotAGardenAccount() public {
        address notAGarden = makeAddr("not a garden");
        (IHatsJarFactory.Config memory first, IHatsJarFactory.Config memory second) = _pair(notAGarden);

        _expectRefusal(
            first,
            second,
            GENERATION,
            abi.encodeWithSelector(ICookieJarModule.UnsupportedGarden.selector, notAGarden),
            "not a garden account"
        );
    }

    function testHatsCookieJarModule_provisionRevertsWhenGardenAlreadyListsJars() public {
        (IHatsJarFactory.Config memory first, IHatsJarFactory.Config memory second) = _pair(legacyGarden);
        _expectRefusal(first, second, GENERATION, _alreadyListed(legacyGarden), "still lists its Release C jars");

        // A garden minted while only USDC was supported lists a jar but has no WETH or DAI entry.
        address usdc = makeAddr("USDC");
        address usdcGarden = _olderGarden(3, 3000);
        vm.startPrank(owner);
        module.addSupportedAsset(usdc);
        module.removeSupportedAsset(weth);
        module.removeSupportedAsset(dai);
        vm.stopPrank();
        vm.prank(address(gardenToken));
        module.onGardenMinted(usdcGarden);
        vm.startPrank(owner);
        module.removeSupportedAsset(usdc);
        module.addSupportedAsset(weth);
        module.addSupportedAsset(dai);
        vm.stopPrank();
        (first, second) = _pair(usdcGarden);
        _expectRefusal(first, second, GENERATION, _alreadyListed(usdcGarden), "lists a jar for another asset");

        _provision(garden);
        (first, second) = _pair(garden);
        _expectRefusal(
            first, second, GENERATION + 1, _alreadyListed(garden), "already provisioned, even for a new generation"
        );
    }

    function testHatsCookieJarModule_provisionRevertsWhenAStaleAssetEntryRemains() public {
        // Unlisting after DAI stops being supported clears the list but leaves the garden's DAI entry behind.
        address staleDaiJar = module.getGardenJar(legacyGarden, dai);
        vm.startPrank(owner);
        module.removeSupportedAsset(dai);
        module.unlistOlderGardenJars(_gardens(legacyGarden));
        module.addSupportedAsset(dai);
        vm.stopPrank();
        assertEq(module.getGardenJars(legacyGarden).length, 0, "unlisting cleared the jar list");
        assertEq(module.getGardenJar(legacyGarden, weth), address(0), "unlisting cleared the WETH entry");
        assertEq(module.getGardenJar(legacyGarden, dai), staleDaiJar, "unlisting left the DAI entry behind");

        (IHatsJarFactory.Config memory wethConfig, IHatsJarFactory.Config memory daiConfig) = _pair(legacyGarden);
        _expectRefusal(wethConfig, daiConfig, GENERATION, _alreadyListed(legacyGarden), "stale DAI entry second");
        _expectRefusal(daiConfig, wethConfig, GENERATION, _alreadyListed(legacyGarden), "stale DAI entry first");
    }

    function testHatsCookieJarModule_provisionRevertsWhenFactoryNoLongerMatchesReview() public {
        bytes memory refusal = abi.encodeWithSelector(HatsCookieJarModule.InvalidHatsJarFactory.selector);
        (IHatsJarFactory.Config memory first, IHatsJarFactory.Config memory second) = _pair(garden);

        // One trailing byte changes the code hash and nothing else the factory answers.
        bytes memory reviewedCode = address(factory).code;
        vm.etch(address(factory), bytes.concat(reviewedCode, hex"00"));
        _expectRefusal(first, second, GENERATION, refusal, "factory code changed");
        vm.etch(address(factory), reviewedCode);

        factory.setRegistrar(makeAddr("next registrar"));
        _expectRefusal(first, second, GENERATION, refusal, "factory registrar moved");
        factory.setRegistrar(address(module));

        address otherHats = makeAddr("another Hats contract");
        vm.prank(owner);
        module.setHatsProtocol(otherHats);
        _expectRefusal(first, second, GENERATION, refusal, "registry Hats contract changed");
    }

    function testHatsCookieJarModule_provisionRevertsWhenGardenHatsChanged() public {
        bytes memory refusal = abi.encodeWithSelector(HatsCookieJarModule.GardenHatsChanged.selector, garden);

        (IHatsJarFactory.Config memory first, IHatsJarFactory.Config memory second) = _pair(garden);
        first.ownerHat += 1;
        _expectRefusal(first, second, GENERATION, refusal, "WETH config names another Owner Hat");

        (first, second) = _pair(garden);
        second.stewardHat += 1;
        _expectRefusal(first, second, GENERATION, refusal, "DAI config names another Steward Hat");

        (first, second) = _pair(garden);
        first.gardenerHat += 1;
        _expectRefusal(first, second, GENERATION, refusal, "WETH config names another Gardener Hat");

        (first, second) = _pair(garden);
        second.hats = makeAddr("another Hats contract");
        _expectRefusal(first, second, GENERATION, refusal, "DAI config names another Hats contract");

        address gardenWithoutHats = _olderGarden(2, 0);
        (first, second) = _pair(gardenWithoutHats);
        _expectRefusal(
            first,
            second,
            GENERATION,
            abi.encodeWithSelector(HatsCookieJarModule.GardenHatsChanged.selector, gardenWithoutHats),
            "garden has no Hats tree"
        );
    }

    function testHatsCookieJarModule_provisionRevertsWhenFactoryReturnsAnInvalidJar() public {
        (IHatsJarFactory.Config memory first, IHatsJarFactory.Config memory second) = _pair(garden);
        uint256 nonce = vm.getNonce(address(factory));
        address wethJar = computeCreateAddress(address(factory), nonce);
        address daiJar = computeCreateAddress(address(factory), nonce + 1);

        factory.misbehaveFor(dai, HatsJarFactoryMock.Fault.RepeatedJar);
        _expectRefusal(first, second, GENERATION, _invalidJar(wethJar), "the WETH jar again");
        factory.misbehaveFor(dai, HatsJarFactoryMock.Fault.CodelessJar);
        _expectRefusal(first, second, GENERATION, _invalidJar(CODELESS_JAR), "an address with no code");
        factory.misbehaveFor(dai, HatsJarFactoryMock.Fault.UnrecordedJar);
        _expectRefusal(first, second, GENERATION, _invalidJar(daiJar), "a jar the factory does not mark as its own");
        factory.misbehaveFor(dai, HatsJarFactoryMock.Fault.MisfiledJar);
        _expectRefusal(first, second, GENERATION, _invalidJar(daiJar), "a jar filed under no garden");

        // Three of those refusals came after the WETH jar was listed; the pair lands together or not at all.
        assertEq(module.getGardenJars(garden).length, 0, "the garden lists no jar");
        assertEq(factory.jarFor(garden, weth, GENERATION), address(0), "the WETH jar is rolled back with the pair");
    }

    function testHatsCookieJarModule_deployRevertsWhenFactoryIsNotTheReviewedOne() public {
        address noFactory = makeAddr("no factory");
        HatsJarFactoryMock otherFamily = new HatsJarFactoryMock(keccak256("ANOTHER_FACTORY"), 1, hats, address(module));
        HatsJarFactoryMock nextVersion = new HatsJarFactoryMock(FACTORY_FAMILY, 2, hats, address(module));

        vm.expectRevert(HatsCookieJarModule.InvalidHatsJarFactory.selector);
        new HatsCookieJarModule(IHatsJarFactory(noFactory));
        vm.expectRevert(HatsCookieJarModule.InvalidHatsJarFactory.selector);
        new HatsCookieJarModule(IHatsJarFactory(address(otherFamily)));
        vm.expectRevert(HatsCookieJarModule.InvalidHatsJarFactory.selector);
        new HatsCookieJarModule(IHatsJarFactory(address(nextVersion)));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Unlisting
    // ═══════════════════════════════════════════════════════════════════════════

    /// @dev `garden` is an older account, so without the guard the inherited unlisting would retire its Hats jars.
    function testHatsCookieJarModule_unlistRevertsWhenGardenListsAnActiveHatsJar() public {
        (address wethJar, address daiJar) = _provision(garden);
        address[] memory legacyJars = module.getGardenJars(legacyGarden);
        address[] memory gardens = new address[](2);
        gardens[0] = legacyGarden;
        gardens[1] = garden;

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(HatsCookieJarModule.ActiveHatsJar.selector, wethJar));
        module.unlistOlderGardenJars(gardens);
        assertEq(module.getGardenJars(legacyGarden), legacyJars, "the refused batch unlists nothing");

        vm.expectEmit(true, true, true, true, address(module));
        emit ICookieJarModule.JarUnlisted(legacyGarden, weth, legacyJars[0]);
        vm.expectEmit(true, true, true, true, address(module));
        emit ICookieJarModule.JarUnlisted(legacyGarden, dai, legacyJars[1]);
        vm.prank(owner);
        module.unlistOlderGardenJars(_gardens(legacyGarden));

        assertEq(module.getGardenJars(legacyGarden).length, 0, "Release C jars still retire");
        assertEq(module.getGardenJar(garden, weth), wethJar, "yield still finds the Hats WETH jar");
        assertEq(module.getGardenJar(garden, dai), daiJar, "yield still finds the Hats DAI jar");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Helpers
    // ═══════════════════════════════════════════════════════════════════════════

    /// @dev Provisions as the owner and requires exactly `refusal`, naming the case if anything else happens.
    function _expectRefusal(
        IHatsJarFactory.Config memory first,
        IHatsJarFactory.Config memory second,
        uint256 generation,
        bytes memory refusal,
        string memory label
    )
        private
    {
        vm.prank(owner);
        try module.provisionHatsJarPair(first, second, generation) {
            fail(string.concat(label, ": provisioned"));
        } catch (bytes memory reason) {
            assertEq(reason, refusal, label);
        }
    }

    function _provision(address account) private returns (address wethJar, address daiJar) {
        (IHatsJarFactory.Config memory wethConfig, IHatsJarFactory.Config memory daiConfig) = _pair(account);
        vm.prank(owner);
        return module.provisionHatsJarPair(wethConfig, daiConfig, GENERATION);
    }

    /// @dev The WETH and DAI configs a packet would queue for `account`, built from its current role Hats.
    function _pair(address account)
        private
        view
        returns (IHatsJarFactory.Config memory wethConfig, IHatsJarFactory.Config memory daiConfig)
    {
        wethConfig = _config(account, weth, 0.01 ether);
        daiConfig = _config(account, dai, 10 ether);
    }

    function _config(address account, address asset, uint256 maxClaim)
        private
        view
        returns (IHatsJarFactory.Config memory)
    {
        (uint256 ownerHat, uint256 stewardHat,, uint256 gardenerHat,,,,) = hatsModule.getGardenHatIds(account);
        return IHatsJarFactory.Config({
            garden: account,
            asset: asset,
            hats: hats,
            gardenerHat: gardenerHat,
            stewardHat: stewardHat,
            ownerHat: ownerHat,
            policy: IHatsJarFactory.Policy({
                maxClaimCeiling: maxClaim, minCooldown: 1 days, dailyBudget: 10 * maxClaim, recoveryRecipient: owner
            }),
            maxWithdrawal: maxClaim,
            withdrawalInterval: 1 days
        });
    }

    /// @dev A garden account bound to `tokenId`, below the first upgradeable token ID, with a Hats tree rooted at
    ///      `adminHat` (none when zero).
    function _olderGarden(uint256 tokenId, uint256 adminHat) private returns (address account) {
        account = address(new GardenAccountStub(address(gardenToken), tokenId));
        gardenToken.setGardenAccount(account);
        if (adminHat != 0) hatsModule.setHatTree(account, adminHat);
    }

    function _gardens(address account) private pure returns (address[] memory gardens) {
        gardens = new address[](1);
        gardens[0] = account;
    }

    function _alreadyListed(address account) private pure returns (bytes memory) {
        return abi.encodeWithSelector(HatsCookieJarModule.GardenAlreadyListed.selector, account);
    }

    function _invalidJar(address jar) private pure returns (bytes memory) {
        return abi.encodeWithSelector(HatsCookieJarModule.InvalidCreatedJar.selector, jar);
    }
}
