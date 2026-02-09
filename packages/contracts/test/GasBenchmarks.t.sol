// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { HatsModule } from "../src/modules/Hats.sol";
import { IHatsModule } from "../src/interfaces/IHatsModule.sol";
import { MockHats } from "../src/mocks/Hats.sol";
import { ActionRegistry, Capital } from "../src/registries/Action.sol";
import { GardenToken } from "../src/tokens/Garden.sol";
import { GardenAccount } from "../src/accounts/Garden.sol";
import { MockERC20 } from "../src/mocks/ERC20.sol";
import { ERC6551Helper } from "./helpers/ERC6551Helper.sol";

/// @title GasBenchmarks
/// @notice Gas consumption benchmarks for critical contract operations
/// @dev Run with `forge test --match-contract GasBenchmarks -vvv` for gas reports
///      Uses MockHats (lighter than real Hats), so numbers are lower bounds.
contract GasBenchmarks is Test, ERC6551Helper {
    /// @dev Required to receive ERC721 tokens from GardenToken.mintGarden()
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    HatsModule public adapter;
    MockHats public mockHats;
    ActionRegistry public actionRegistry;
    GardenToken public gardenToken;
    MockERC20 public mockToken;

    address public owner = address(this);
    address public garden;

    function setUp() public {
        _deployERC6551Registry();

        mockHats = new MockHats();
        mockToken = new MockERC20();

        // Deploy HatsModule with proxy
        HatsModule hatsImpl = new HatsModule();
        bytes memory hatsInitData = abi.encodeWithSelector(HatsModule.initialize.selector, owner, address(mockHats));
        adapter = HatsModule(address(new ERC1967Proxy(address(hatsImpl), hatsInitData)));

        // Deploy ActionRegistry with proxy
        ActionRegistry actionImpl = new ActionRegistry();
        bytes memory actionInitData = abi.encodeWithSelector(ActionRegistry.initialize.selector, owner);
        actionRegistry = ActionRegistry(address(new ERC1967Proxy(address(actionImpl), actionInitData)));

        // Deploy GardenAccount implementation
        address gardenAccountImpl = address(
            new GardenAccount(
                address(0x1001), address(0x1002), address(0x1003), address(0x1004), address(0x2001), address(0x2002)
            )
        );

        // Deploy GardenToken with proxy
        GardenToken gardenTokenImpl = new GardenToken(gardenAccountImpl);
        bytes memory gardenInitData = abi.encodeWithSelector(GardenToken.initialize.selector, owner, address(0));
        gardenToken = GardenToken(address(new ERC1967Proxy(address(gardenTokenImpl), gardenInitData)));

        // Wire HatsModule into GardenToken (separate from initialize)
        gardenToken.setHatsModule(address(adapter));

        // Wire up: HatsModule needs gardenToken authorized
        adapter.setGardenToken(address(gardenToken));

        // Create protocol hat tree
        uint256 gardensHatId = mockHats.mintTopHat(address(adapter), "Green Goods Gardens", "");
        adapter.setProtocolHatIds(0, gardensHatId, 0);
    }

    // =========================================================================
    // Garden Creation Benchmarks
    // =========================================================================

    /// @notice Benchmark: mintGarden with Hats tree creation (most expensive operation)
    function testGas_mintGarden() public {
        address[] memory gardeners = new address[](0);
        address[] memory operators = new address[](1);
        operators[0] = address(0x5001);

        GardenToken.GardenConfig memory config = GardenToken.GardenConfig({
            communityToken: address(mockToken),
            name: "Gas Test Garden",
            description: "A garden for gas benchmarking",
            location: "Location",
            bannerImage: "Banner",
            metadata: "",
            openJoining: false
        });

        uint256 gasBefore = gasleft();
        garden = gardenToken.mintGarden(config);
        uint256 gasUsed = gasBefore - gasleft();

        emit log_named_uint("Gas: mintGarden (single, with hat tree)", gasUsed);
        assertTrue(garden != address(0), "Garden should be created");
    }

    /// @notice Benchmark: mintGarden with initial gardeners (5 gardeners)
    function testGas_mintGardenWith5Gardeners() public {
        address[] memory gardeners = new address[](5);
        for (uint256 i = 0; i < 5; i++) {
            gardeners[i] = address(uint160(0x7001 + i));
        }
        address[] memory operators = new address[](1);
        operators[0] = address(0x5001);

        GardenToken.GardenConfig memory config = GardenToken.GardenConfig({
            communityToken: address(mockToken),
            name: "Garden With Gardeners",
            description: "5 initial gardeners",
            location: "Location",
            bannerImage: "Banner",
            metadata: "",
            openJoining: false
        });

        uint256 gasBefore = gasleft();
        address g = gardenToken.mintGarden(config);
        uint256 gasUsed = gasBefore - gasleft();

        emit log_named_uint("Gas: mintGarden (5 gardeners + hat tree)", gasUsed);
        assertTrue(g != address(0));
    }

    /// @notice Benchmark: batchMintGardens with 5 gardens
    function testGas_batchMintGardens5() public {
        GardenToken.GardenConfig[] memory configs = new GardenToken.GardenConfig[](5);

        for (uint256 i = 0; i < 5; i++) {
            address[] memory gardeners = new address[](0);
            address[] memory operators = new address[](1);
            operators[0] = address(uint160(0x5001 + i));

            configs[i] = GardenToken.GardenConfig({
                communityToken: address(mockToken),
                name: string(abi.encodePacked("Batch Garden ", _uint2str(i))),
                description: "Batch description",
                location: "Location",
                bannerImage: "Banner",
                metadata: "",
                openJoining: false
            });
        }

        uint256 gasBefore = gasleft();
        address[] memory gardens = gardenToken.batchMintGardens(configs);
        uint256 gasUsed = gasBefore - gasleft();

        emit log_named_uint("Gas: batchMintGardens (5 gardens)", gasUsed);
        emit log_named_uint("Gas: per garden in batch of 5", gasUsed / 5);
        assertEq(gardens.length, 5);
    }

    // =========================================================================
    // Role Granting Benchmarks
    // =========================================================================

    /// @notice Benchmark: grantRole(Gardener) — single hat mint, no cascading
    function testGas_grantGardener() public {
        _setupGardenForRoles();

        address user = address(0x6001);
        uint256 gasBefore = gasleft();
        adapter.grantRole(garden, user, IHatsModule.GardenRole.Gardener);
        uint256 gasUsed = gasBefore - gasleft();

        emit log_named_uint("Gas: grantRole(Gardener) - single mint", gasUsed);
    }

    /// @notice Benchmark: grantRole(Evaluator) — single hat mint, no cascading
    function testGas_grantEvaluator() public {
        _setupGardenForRoles();

        address user = address(0x6001);
        uint256 gasBefore = gasleft();
        adapter.grantRole(garden, user, IHatsModule.GardenRole.Evaluator);
        uint256 gasUsed = gasBefore - gasleft();

        emit log_named_uint("Gas: grantRole(Evaluator) - single mint", gasUsed);
    }

    /// @notice Benchmark: grantRole(Operator) — cascading: mints Operator + Evaluator + Gardener
    function testGas_grantOperator() public {
        _setupGardenForRoles();

        address user = address(0x6001);
        uint256 gasBefore = gasleft();
        adapter.grantRole(garden, user, IHatsModule.GardenRole.Operator);
        uint256 gasUsed = gasBefore - gasleft();

        emit log_named_uint("Gas: grantRole(Operator) - cascading 3 mints", gasUsed);
    }

    /// @notice Benchmark: grantRole(Owner) — full cascade: Owner + Operator + Evaluator + Gardener
    function testGas_grantOwner() public {
        _setupGardenForRoles();

        address user = address(0x6001);
        uint256 gasBefore = gasleft();
        adapter.grantRole(garden, user, IHatsModule.GardenRole.Owner);
        uint256 gasUsed = gasBefore - gasleft();

        emit log_named_uint("Gas: grantRole(Owner) - cascading 4 mints", gasUsed);
    }

    /// @notice Benchmark: revokeRole(Gardener) — single hat transfer
    function testGas_revokeGardener() public {
        _setupGardenForRoles();

        address user = address(0x6001);
        adapter.grantRole(garden, user, IHatsModule.GardenRole.Gardener);

        uint256 gasBefore = gasleft();
        adapter.revokeRole(garden, user, IHatsModule.GardenRole.Gardener);
        uint256 gasUsed = gasBefore - gasleft();

        emit log_named_uint("Gas: revokeRole(Gardener) - single transfer", gasUsed);
    }

    // =========================================================================
    // Batch Role Benchmarks
    // =========================================================================

    /// @notice Benchmark: grantRoles batch — 5 gardeners at once
    function testGas_batchGrant5Gardeners() public {
        _setupGardenForRoles();

        address[] memory accounts = new address[](5);
        IHatsModule.GardenRole[] memory roles = new IHatsModule.GardenRole[](5);
        for (uint256 i = 0; i < 5; i++) {
            accounts[i] = address(uint160(0x6001 + i));
            roles[i] = IHatsModule.GardenRole.Gardener;
        }

        uint256 gasBefore = gasleft();
        adapter.grantRoles(garden, accounts, roles);
        uint256 gasUsed = gasBefore - gasleft();

        emit log_named_uint("Gas: grantRoles (5 gardeners)", gasUsed);
        emit log_named_uint("Gas: per gardener in batch of 5", gasUsed / 5);
    }

    /// @notice Benchmark: grantRoles batch — 5 operators (each cascades to 3 mints)
    function testGas_batchGrant5Operators() public {
        _setupGardenForRoles();

        address[] memory accounts = new address[](5);
        IHatsModule.GardenRole[] memory roles = new IHatsModule.GardenRole[](5);
        for (uint256 i = 0; i < 5; i++) {
            accounts[i] = address(uint160(0x6001 + i));
            roles[i] = IHatsModule.GardenRole.Operator;
        }

        uint256 gasBefore = gasleft();
        adapter.grantRoles(garden, accounts, roles);
        uint256 gasUsed = gasBefore - gasleft();

        emit log_named_uint("Gas: grantRoles (5 operators, cascading)", gasUsed);
        emit log_named_uint("Gas: per operator in batch of 5", gasUsed / 5);
    }

    // =========================================================================
    // Action Registry Benchmarks
    // =========================================================================

    /// @notice Benchmark: registerAction
    function testGas_registerAction() public {
        Capital[] memory capitals = new Capital[](1);
        capitals[0] = Capital.LIVING;
        string[] memory media = new string[](0);

        uint256 gasBefore = gasleft();
        actionRegistry.registerAction(
            block.timestamp, block.timestamp + 30 days, "Plant Trees", "ipfs://instructions", capitals, media
        );
        uint256 gasUsed = gasBefore - gasleft();

        emit log_named_uint("Gas: registerAction (single capital)", gasUsed);
    }

    /// @notice Benchmark: registerAction with all capital types
    function testGas_registerActionAllCapitals() public {
        Capital[] memory capitals = new Capital[](8);
        for (uint256 i = 0; i < 8; i++) {
            capitals[i] = Capital(i);
        }
        string[] memory media = new string[](3);
        media[0] = "ipfs://photo1";
        media[1] = "ipfs://photo2";
        media[2] = "ipfs://photo3";

        uint256 gasBefore = gasleft();
        actionRegistry.registerAction(
            block.timestamp, block.timestamp + 30 days, "Complex Action", "ipfs://instructions", capitals, media
        );
        uint256 gasUsed = gasBefore - gasleft();

        emit log_named_uint("Gas: registerAction (8 capitals + 3 media)", gasUsed);
    }

    // =========================================================================
    // Configuration Benchmarks
    // =========================================================================

    /// @notice Benchmark: createGardenHatTree (called internally by mintGarden)
    function testGas_createGardenHatTree() public {
        address testGarden = address(0xBEEF);

        uint256 gasBefore = gasleft();
        vm.prank(address(gardenToken));
        adapter.createGardenHatTree(testGarden, "Benchmark Garden", address(mockToken));
        uint256 gasUsed = gasBefore - gasleft();

        emit log_named_uint("Gas: createGardenHatTree (6 role hats)", gasUsed);
    }

    /// @notice Benchmark: configureGarden (manual hat ID assignment)
    function testGas_configureGarden() public {
        address testGarden = address(0xCAFE);

        uint256 gasBefore = gasleft();
        adapter.configureGarden(testGarden, 1, 2, 3, 4, 5, 6);
        uint256 gasUsed = gasBefore - gasleft();

        emit log_named_uint("Gas: configureGarden (manual)", gasUsed);
    }

    // =========================================================================
    // Role Check Benchmarks
    // =========================================================================

    /// @notice Benchmark: isGardenerOf view call
    function testGas_isGardenerOfCheck() public {
        _setupGardenForRoles();
        address user = address(0x6001);
        adapter.grantRole(garden, user, IHatsModule.GardenRole.Gardener);

        uint256 gasBefore = gasleft();
        adapter.isGardenerOf(garden, user);
        uint256 gasUsed = gasBefore - gasleft();

        emit log_named_uint("Gas: isGardenerOf view call", gasUsed);
    }

    // =========================================================================
    // Internal Helpers
    // =========================================================================

    function _setupGardenForRoles() internal {
        address[] memory gardeners = new address[](0);
        address[] memory operators = new address[](1);
        operators[0] = address(0x5001);

        GardenToken.GardenConfig memory config = GardenToken.GardenConfig({
            communityToken: address(mockToken),
            name: "Benchmark Garden",
            description: "Gas benchmark garden",
            location: "Location",
            bannerImage: "Banner",
            metadata: "",
            openJoining: false
        });

        garden = gardenToken.mintGarden(config);

        // Authorize ourselves as owner in HatsModule for role management
        (uint256 ownerHatId,,,,,,,) = adapter.gardenHats(garden);
        mockHats.setWearer(ownerHatId, owner, true);
    }

    function _uint2str(uint256 _i) internal pure returns (string memory) {
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
            bstr[k] = bytes1(uint8(48 + _i % 10));
            _i /= 10;
        }
        return string(bstr);
    }
}
