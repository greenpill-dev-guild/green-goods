// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { ActionRegistry, Capital } from "../src/registries/Action.sol";
import { GardenToken } from "../src/tokens/Garden.sol";
import { GardenAccount } from "../src/accounts/Garden.sol";
import { MockERC20 } from "../src/mocks/ERC20.sol";

/// @title FuzzTests
/// @notice Fuzz testing for edge cases and boundary conditions
contract FuzzTests is Test {
    ActionRegistry private actionRegistry;
    GardenToken private gardenToken;
    MockERC20 private mockToken;
    
    address private multisig = address(0x123);
    address private gardenAccountImplementation;

    function setUp() public {
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
                address(0x1001),
                address(0x1002),
                address(0x1003),
                address(0x1004)
            )
        );
        
        // Deploy garden token
        GardenToken gardenTokenImpl = new GardenToken(gardenAccountImplementation);
        bytes memory gardenInitData = abi.encodeWithSelector(
            GardenToken.initialize.selector,
            multisig,
            address(0)
        );
        ERC1967Proxy gardenProxy = new ERC1967Proxy(address(gardenTokenImpl), gardenInitData);
        gardenToken = GardenToken(address(gardenProxy));
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
            startTime,
            endTime,
            "Fuzz Test Action",
            "instructions",
            capitals,
            media
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
        
        address[] memory gardeners = new address[](0);
        address[] memory operators = new address[](0);
        
        vm.prank(multisig);
        address gardenAccount = gardenToken.mintGarden(
            address(mockToken),
            name,
            description,
            "Location",
            "Banner",
            gardeners,
            operators
        );
        
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
            address[] memory gardeners = new address[](0);
            address[] memory operators = new address[](0);
            
            configs[i] = GardenToken.GardenConfig({
                communityToken: address(mockToken),
                name: string(abi.encodePacked("Garden", uint2str(i))),
                description: "Description",
                location: "Location",
                bannerImage: "Banner",
                gardeners: gardeners,
                gardenOperators: operators
            });
        }
        
        vm.prank(multisig);
        address[] memory gardens = gardenToken.batchMintGardens(configs);
        
        assertEq(gardens.length, batchSize, "Should mint correct number of gardens");
    }

    /// @notice Fuzz test array length validation
    /// @param gardenerCount Number of gardeners (will test boundary at 100)
    function testFuzz_ArrayLengthValidation(uint8 gardenerCount) public {
        // Test values around the boundary
        gardenerCount = uint8(bound(gardenerCount, 0, 150));
        
        address[] memory gardeners = new address[](gardenerCount);
        for (uint256 i = 0; i < gardenerCount; i++) {
            gardeners[i] = address(uint160(i + 1));
        }
        address[] memory operators = new address[](0);
        
        vm.prank(multisig);
        
        if (gardenerCount > 100) {
            // Should revert for arrays > 100
            vm.expectRevert("Too many gardeners");
            gardenToken.mintGarden(
                address(mockToken),
                "Test",
                "Description",
                "Location",
                "Banner",
                gardeners,
                operators
            );
        } else {
            // Should succeed for arrays <= 100
            address gardenAccount = gardenToken.mintGarden(
                address(mockToken),
                "Test",
                "Description",
                "Location",
                "Banner",
                gardeners,
                operators
            );
            assertTrue(gardenAccount != address(0), "Garden should be created");
        }
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
            "instructions",
            capitals,
            media
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

    /// @notice Convert bitmap to capital array
    function _bitmapToCapitals(uint8 bitmap) internal pure returns (Capital[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < 8; i++) {
            if (bitmap & (1 << i) != 0) count++;
        }
        
        Capital[] memory capitals = new Capital[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < 8; i++) {
            if (bitmap & (1 << i) != 0) {
                capitals[index] = Capital(i);
                index++;
            }
        }
        
        return capitals;
    }
}


