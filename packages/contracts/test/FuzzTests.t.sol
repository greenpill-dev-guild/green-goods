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
        vm.prank(multisig);
        gardenToken.setHatsModule(address(mockHatsModule));
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
        // Bound string lengths to reasonable values (1-100 characters)
        nameLength = uint8(bound(nameLength, 1, 100));
        descLength = uint8(bound(descLength, 1, 200));

        // Generate random strings
        string memory name = _generateString(nameLength);
        string memory description = _generateString(descLength);

        vm.prank(multisig);
        GardenToken.GardenConfig memory config = GardenToken.GardenConfig({
            communityToken: address(mockToken),
            name: name,
            slug: "",
            description: description,
            location: "Location",
            bannerImage: "Banner",
            metadata: "",
            openJoining: false,
            weightScheme: IGardensModule.WeightScheme.Linear,
            domainMask: 0
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
                communityToken: address(mockToken),
                name: string(abi.encodePacked("Garden", uint2str(i))),
                slug: "",
                description: "Description",
                location: "Location",
                bannerImage: "Banner",
                metadata: "",
                openJoining: false,
                weightScheme: IGardensModule.WeightScheme.Linear,
                domainMask: 0
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
            communityToken: address(mockToken),
            name: "Test",
            slug: "",
            description: "Description",
            location: "Location",
            bannerImage: "Banner",
            metadata: "",
            openJoining: openJoiningValue,
            weightScheme: IGardensModule.WeightScheme.Linear,
            domainMask: 0
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
            communityToken: address(mockToken),
            name: "Unauthorized Garden",
            slug: "",
            description: "Desc",
            location: "Location",
            bannerImage: "Banner",
            metadata: "",
            openJoining: false,
            weightScheme: IGardensModule.WeightScheme.Linear,
            domainMask: 0
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
