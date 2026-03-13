// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { ActionRegistry, Capital, Domain } from "../src/registries/Action.sol";
import { GardenToken } from "../src/tokens/Garden.sol";
import { GardenAccount } from "../src/accounts/Garden.sol";
import { OctantModule } from "../src/modules/Octant.sol";
import { YieldResolver } from "../src/resolvers/Yield.sol";
import { MockERC20 } from "../src/mocks/ERC20.sol";
import { MockHatsModule } from "./helpers/MockHatsModule.sol";
import { ERC6551Helper } from "./helpers/ERC6551Helper.sol";
import { IGardensModule } from "../src/interfaces/IGardensModule.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { AaveV3ERC4626 } from "../src/strategies/AaveV3ERC4626.sol";
import { MockAavePool, MockAToken, MockPoolDataProvider } from "../src/mocks/AavePool.sol";

/// @title FuzzTests
/// @notice Fuzz testing for edge cases and boundary conditions

contract FuzzTests is Test, ERC6551Helper {
    ActionRegistry private actionRegistry;
    GardenToken private gardenToken;
    MockERC20 private mockToken;
    MockHatsModule private mockHatsModule;

    address private multisig = address(0x123);
    address private gardenAccountImplementation;

    function setUp() public {
        // Deploy ERC6551 Registry at canonical Tokenbound address
        _deployERC6551Registry();

        // Deploy mock token
        mockToken = new MockERC20();

        // Deploy action registry
        ActionRegistry actionRegistryImpl = new ActionRegistry();
        bytes memory actionInitData = abi.encodeWithSelector(ActionRegistry.initialize.selector, multisig);
        ERC1967Proxy actionProxy = new ERC1967Proxy(address(actionRegistryImpl), actionInitData);
        actionRegistry = ActionRegistry(address(actionProxy));

        // Deploy garden account implementation
        gardenAccountImplementation = address(
            new GardenAccount(
                address(0x1001), address(0x1002), address(0x1003), address(0x1004), address(0x2001), address(0x2002)
            )
        );

        // Deploy garden token
        GardenToken gardenTokenImpl = new GardenToken(gardenAccountImplementation);
        bytes memory gardenInitData = abi.encodeWithSelector(GardenToken.initialize.selector, multisig, address(0));
        ERC1967Proxy gardenProxy = new ERC1967Proxy(address(gardenTokenImpl), gardenInitData);
        gardenToken = GardenToken(address(gardenProxy));
        mockHatsModule = new MockHatsModule();
        vm.startPrank(multisig);
        gardenToken.setHatsModule(address(mockHatsModule));
        gardenToken.setCommunityToken(address(mockToken));
        vm.stopPrank();
    }

    /// @notice Fuzz test action registration with random timestamps
    /// @param startTime Random start time
    /// @param duration Random duration (bounded to prevent overflow)
    function testFuzz_ActionRegistrationWithRandomTimes(uint64 startTime, uint32 duration) public {
        // Bound duration to reasonable values
        duration = uint32(bound(duration, 1, 365 days));

        // Calculate end time
        uint256 endTime = uint256(startTime) + uint256(duration);

        // Skip if overflow would occur
        if (endTime < startTime) return;

        Capital[] memory capitals = new Capital[](1);
        capitals[0] = Capital.LIVING;
        string[] memory media = new string[](0);

        vm.prank(multisig);
        actionRegistry.registerAction(
            startTime, endTime, "Fuzz Test Action", "test.fuzz", "instructions", capitals, media, Domain.AGRO
        );

        ActionRegistry.Action memory action = actionRegistry.getAction(0);
        assertEq(action.startTime, startTime, "Start time should match");
        assertEq(action.endTime, endTime, "End time should match");
        assertTrue(action.endTime > action.startTime, "End time must be after start time");
    }

    /// @notice Fuzz test garden minting with random string lengths
    /// @param nameLength Length of garden name
    /// @param descLength Length of garden description
    function testFuzz_GardenMintingWithRandomStrings(uint8 nameLength, uint8 descLength) public {
        // Bound string lengths to contract limits (MAX_NAME_LENGTH = 72)
        nameLength = uint8(bound(nameLength, 1, 72));
        descLength = uint8(bound(descLength, 1, 200));

        // Generate random strings
        string memory name = _generateString(nameLength);
        string memory description = _generateString(descLength);

        vm.prank(multisig);
        GardenToken.GardenConfig memory config = GardenToken.GardenConfig({
            name: name,
            slug: "",
            description: description,
            location: "Location",
            bannerImage: "Banner",
            metadata: "",
            openJoining: false,
            weightScheme: IGardensModule.WeightScheme.Linear,
            domainMask: 0,
            gardeners: new address[](0),
            operators: new address[](0)
        });
        address gardenAccount = gardenToken.mintGarden(config);

        GardenAccount garden = GardenAccount(payable(gardenAccount));
        assertEq(garden.name(), name, "Name should match");
        assertEq(garden.description(), description, "Description should match");
    }

    /// @notice Fuzz test batch minting with random batch sizes
    /// @param batchSize Number of gardens to mint (bounded 1-10)
    function testFuzz_BatchMintingWithRandomSizes(uint8 batchSize) public {
        // Bound to valid batch size (1-10)
        batchSize = uint8(bound(batchSize, 1, 10));

        GardenToken.GardenConfig[] memory configs = new GardenToken.GardenConfig[](batchSize);

        for (uint256 i = 0; i < batchSize; i++) {
            configs[i] = GardenToken.GardenConfig({
                name: string(abi.encodePacked("Garden", uint2str(i))),
                slug: "",
                description: "Description",
                location: "Location",
                bannerImage: "Banner",
                metadata: "",
                openJoining: false,
                weightScheme: IGardensModule.WeightScheme.Linear,
                domainMask: 0,
                gardeners: new address[](0),
                operators: new address[](0)
            });
        }

        vm.prank(multisig);
        address[] memory gardens = gardenToken.batchMintGardens(configs);

        assertEq(gardens.length, batchSize, "Should mint correct number of gardens");
    }

    /// @notice Fuzz test openJoining initialization path
    function testFuzz_OpenJoiningInitialization(bool openJoiningValue) public {
        vm.prank(multisig);
        GardenToken.GardenConfig memory config = GardenToken.GardenConfig({
            name: "Test",
            slug: "",
            description: "Description",
            location: "Location",
            bannerImage: "Banner",
            metadata: "",
            openJoining: openJoiningValue,
            weightScheme: IGardensModule.WeightScheme.Linear,
            domainMask: 0,
            gardeners: new address[](0),
            operators: new address[](0)
        });

        address gardenAccount = gardenToken.mintGarden(config);
        assertTrue(gardenAccount != address(0), "Garden should be created");
    }

    /// @notice Fuzz test capital array combinations
    /// @param capitalBitmap Bitmap representing which capitals to include
    function testFuzz_CapitalCombinations(uint8 capitalBitmap) public {
        // Convert bitmap to capital array
        Capital[] memory capitals = _bitmapToCapitals(capitalBitmap);

        // Skip if no capitals (empty array)
        if (capitals.length == 0) return;

        string[] memory media = new string[](0);

        vm.prank(multisig);
        actionRegistry.registerAction(
            block.timestamp,
            block.timestamp + 1 days,
            "Fuzz Capital Test",
            "test.capital",
            "instructions",
            capitals,
            media,
            Domain.SOLAR
        );

        ActionRegistry.Action memory action = actionRegistry.getAction(0);
        assertEq(action.capitals.length, capitals.length, "Capital count should match");
    }

    /// @notice Helper function to generate a string of specified length
    function _generateString(uint256 length) internal pure returns (string memory) {
        bytes memory str = new bytes(length);
        for (uint256 i = 0; i < length; i++) {
            str[i] = bytes1(uint8(65 + (i % 26))); // A-Z cycling
        }
        return string(str);
    }

    /// @notice Helper to convert uint to string
    function uint2str(uint256 _i) internal pure returns (string memory) {
        if (_i == 0) return "0";
        uint256 j = _i;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint256 k = len;
        while (_i != 0) {
            k = k - 1;
            uint8 temp = (48 + uint8(_i - _i / 10 * 10));
            bstr[k] = bytes1(temp);
            _i /= 10;
        }
        return string(bstr);
    }

    // =========================================================================
    // Negative-Path Fuzz Tests
    // =========================================================================

    /// @notice Fuzz: registerAction reverts when startTime >= endTime
    function testFuzz_registerAction_revertsInvalidDateRange(uint256 startTime, uint256 endTime) public {
        vm.assume(startTime >= endTime);

        Capital[] memory capitals = new Capital[](1);
        capitals[0] = Capital.LIVING;

        vm.prank(multisig);
        vm.expectRevert();
        actionRegistry.registerAction(
            startTime, endTime, "Invalid Dates", "test.invalid", "instructions", capitals, new string[](0), Domain.WASTE
        );
    }

    /// @notice Fuzz: gardenToken mint from random unauthorized address reverts
    function testFuzz_gardenToken_mintRevertUnauthorized(address caller) public {
        vm.assume(caller != multisig);
        vm.assume(caller != address(0));

        GardenToken.GardenConfig memory config = GardenToken.GardenConfig({
            name: "Unauthorized Garden",
            slug: "",
            description: "Desc",
            location: "Location",
            bannerImage: "Banner",
            metadata: "",
            openJoining: false,
            weightScheme: IGardensModule.WeightScheme.Linear,
            domainMask: 0,
            gardeners: new address[](0),
            operators: new address[](0)
        });

        vm.prank(caller);
        vm.expectRevert();
        gardenToken.mintGarden(config);
    }

    /// @notice Fuzz: octantModule harvest from random unauthorized address reverts
    function testFuzz_octantModule_harvestRevertUnauthorized(address caller) public {
        vm.assume(caller != address(0));
        // No garden access control mock set up for random callers

        OctantModule octantImpl = new OctantModule();
        bytes memory initData = abi.encodeWithSelector(OctantModule.initialize.selector, multisig, address(0), 7 days);
        OctantModule octant = OctantModule(address(new ERC1967Proxy(address(octantImpl), initData)));

        vm.prank(caller);
        vm.expectRevert();
        octant.harvest(address(0x1), address(0x2));
    }

    // =========================================================================
    // YieldResolver Fuzz Tests
    // =========================================================================

    /// @notice Fuzz: setSplitRatio always reverts when BPS don't sum to 10000
    function testFuzz_setSplitRatio_revertsIfNotSumTo10000(
        uint256 cookieJarBps,
        uint256 fractionsBps,
        uint256 juiceboxBps
    )
        public
    {
        // Bound first to prevent overflow, then reject valid triples
        cookieJarBps = bound(cookieJarBps, 0, 10_000);
        fractionsBps = bound(fractionsBps, 0, 10_000);
        juiceboxBps = bound(juiceboxBps, 0, 10_000);
        vm.assume(cookieJarBps + fractionsBps + juiceboxBps != 10_000);

        // Deploy a minimal YieldResolver for this fuzz test
        YieldResolver ys = _deployYieldResolver();

        vm.prank(multisig);
        vm.expectRevert(YieldResolver.InvalidSplitRatio.selector);
        ys.setSplitRatio(address(0x100), cookieJarBps, fractionsBps, juiceboxBps);
    }

    /// @notice Fuzz: setSplitRatio succeeds for any valid BPS triple summing to 10000
    function testFuzz_setSplitRatio_acceptsValidBps(uint256 cookieJarBps, uint256 fractionsBps) public {
        cookieJarBps = bound(cookieJarBps, 0, 10_000);
        fractionsBps = bound(fractionsBps, 0, 10_000 - cookieJarBps);
        uint256 juiceboxBps = 10_000 - cookieJarBps - fractionsBps;

        YieldResolver ys = _deployYieldResolver();
        address garden = address(0x100);

        vm.prank(multisig);
        ys.setSplitRatio(garden, cookieJarBps, fractionsBps, juiceboxBps);

        YieldResolver.SplitConfig memory config = ys.getSplitConfig(garden);
        assertEq(config.cookieJarBps + config.fractionsBps + config.juiceboxBps, 10_000, "BPS must always sum to 10000");
    }

    /// @notice Helper: deploy a minimal YieldResolver for fuzz testing
    function _deployYieldResolver() internal returns (YieldResolver) {
        YieldResolver impl = new YieldResolver();
        bytes memory initData =
            abi.encodeWithSelector(YieldResolver.initialize.selector, multisig, address(0x2), address(0x3), 0);
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        return YieldResolver(address(proxy));
    }

    // =========================================================================
    // Vault ERC-4626 Fuzz Tests
    // =========================================================================

    function _deployFuzzStrategy() internal returns (AaveV3ERC4626, MockERC20, MockAToken, MockAavePool) {
        MockERC20 fuzzAsset = new MockERC20();
        MockAToken fuzzAToken = new MockAToken();
        MockAavePool fuzzPool = new MockAavePool(address(fuzzAToken));
        MockPoolDataProvider fuzzDataProvider = new MockPoolDataProvider(address(fuzzAToken));

        AaveV3ERC4626 strat = new AaveV3ERC4626(
            address(fuzzAsset),
            "Fuzz Aave",
            "fzAave",
            address(fuzzPool),
            address(fuzzAToken),
            address(fuzzDataProvider),
            address(this)
        );
        strat.setVault(address(this));

        // Pre-fund aToken with liquidity (real Aave: aToken holds underlying)
        fuzzAsset.mint(address(fuzzAToken), 100_000 ether);
        fuzzAToken.approveUnderlying(address(fuzzAsset), address(fuzzPool));

        // Approve strategy for deposits from this contract (acting as vault)
        fuzzAsset.approve(address(strat), type(uint256).max);

        return (strat, fuzzAsset, fuzzAToken, fuzzPool);
    }

    /// @notice Fuzz: deposit → redeem roundtrip returns at least depositAmount - 1 (OZ virtual offset)
    function testFuzz_vaultDepositRedeemRoundtrip(uint256 depositAmount) public {
        depositAmount = bound(depositAmount, 1, 1000 ether);

        (AaveV3ERC4626 strat, MockERC20 fuzzAsset,,) = _deployFuzzStrategy();
        fuzzAsset.mint(address(this), depositAmount);

        uint256 shares = strat.deposit(depositAmount, address(this));
        assertGt(shares, 0, "deposit should mint shares");

        uint256 received = strat.redeem(shares, address(this), address(this));
        // OZ ERC4626 virtual offset can cause 1 wei loss on roundtrip
        assertGe(received, depositAmount - 1, "roundtrip should return at least deposit - 1 wei");
    }

    /// @notice Fuzz: two depositors maintain correct share accounting
    function testFuzz_vaultMultiDepositorAccounting(uint256 amountA, uint256 amountB) public {
        amountA = bound(amountA, 1 ether, 500 ether);
        amountB = bound(amountB, 1 ether, 500 ether);

        (AaveV3ERC4626 strat, MockERC20 fuzzAsset,,) = _deployFuzzStrategy();

        address userA = address(0xA1);
        address userB = address(0xB2);
        fuzzAsset.mint(address(this), amountA + amountB);

        // Deposit for userA and userB (this contract is the vault)
        uint256 sharesA = strat.deposit(amountA, userA);
        uint256 sharesB = strat.deposit(amountB, userB);

        assertEq(strat.balanceOf(userA) + strat.balanceOf(userB), strat.totalSupply(), "shares should sum to totalSupply");
        assertEq(sharesA, strat.balanceOf(userA), "userA shares should match");
        assertEq(sharesB, strat.balanceOf(userB), "userB shares should match");

        // Redeem both
        vm.prank(userA);
        strat.redeem(sharesA, userA, userA);
        vm.prank(userB);
        strat.redeem(sharesB, userB, userB);

        assertEq(strat.totalSupply(), 0, "vault should be empty after full redemption");
    }

    /// @notice Fuzz: convertToShares→convertToAssets roundtrip never inflates
    function testFuzz_vaultConversionNoInflation(uint256 amount) public {
        amount = bound(amount, 1, type(uint128).max);

        (AaveV3ERC4626 strat,,,) = _deployFuzzStrategy();

        uint256 shares = strat.convertToShares(amount);
        uint256 assets = strat.convertToAssets(shares);
        assertLe(assets, amount, "convertToAssets(convertToShares(x)) must not exceed x");
    }

    /// @notice Inflation attack resistance: onlyVault modifier prevents direct attacker deposits.
    ///         Even if shares are diluted via donation, the vault-gated access control ensures
    ///         only the MultistrategyVault (not arbitrary users) can mint strategy shares.
    function test_vaultInflationAttackResistance() public {
        (AaveV3ERC4626 strat, MockERC20 fuzzAsset,,) = _deployFuzzStrategy();

        // Step 1: Vault (address(this)) deposits 1 wei to seed shares
        fuzzAsset.mint(address(this), 1);
        strat.deposit(1, address(this));

        // Step 2: Attacker donates 1e18 directly to strategy to inflate share price
        fuzzAsset.mint(address(strat), 1 ether);

        // Step 3: Verify external attacker CANNOT deposit (onlyVault blocks)
        address attacker = address(0xA77AC);
        fuzzAsset.mint(attacker, 1 ether);
        vm.startPrank(attacker);
        fuzzAsset.approve(address(strat), 1 ether);
        vm.expectRevert(AaveV3ERC4626.OnlyVault.selector);
        strat.deposit(1 ether, attacker);
        vm.stopPrank();

        // Step 4: Vault can still deposit — shares ARE diluted by the donation,
        //         but this is expected vault accounting that process_report handles.
        fuzzAsset.mint(address(this), 1 ether);
        uint256 postDonationShares = strat.deposit(1 ether, address(this));
        assertGt(postDonationShares, 0, "vault must still get non-zero shares after donation");

        // Step 5: totalAssets should reflect both deposits + donation
        uint256 total = strat.totalAssets();
        assertGt(total, 1 ether, "totalAssets should include donated tokens");
    }

    /// @notice Convert bitmap to capital array
    function _bitmapToCapitals(uint8 bitmap) internal pure returns (Capital[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < 8; i++) {
            // solhint-disable-next-line incorrect-shift
            if ((bitmap & (1 << i)) != 0) count++;
        }

        Capital[] memory capitals = new Capital[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < 8; i++) {
            // solhint-disable-next-line incorrect-shift
            if ((bitmap & (1 << i)) != 0) {
                capitals[index] = Capital(i);
                index++;
            }
        }

        return capitals;
    }
}
