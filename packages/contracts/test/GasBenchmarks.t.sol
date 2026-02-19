// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { HatsModule } from "../src/modules/Hats.sol";
import { IHatsModule } from "../src/interfaces/IHatsModule.sol";
import { MockHats } from "../src/mocks/Hats.sol";
import { ActionRegistry, Capital, Domain } from "../src/registries/Action.sol";
import { GardenToken } from "../src/tokens/Garden.sol";
import { GardenAccount } from "../src/accounts/Garden.sol";
import { MockERC20 } from "../src/mocks/ERC20.sol";
import { ERC6551Helper } from "./helpers/ERC6551Helper.sol";
import { IGardensModule } from "../src/interfaces/IGardensModule.sol";
import { YieldResolver } from "../src/resolvers/Yield.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {
    MockCookieJar,
    MockHypercertMarketplace,
    MockJBMultiTerminalForYield,
    MockOctantVaultForYield
} from "../src/mocks/YieldDeps.sol";
import { MockHatsModule as MockHatsModuleForBench } from "./helpers/MockHatsModule.sol";

/// @title GasBenchmarks
/// @notice Gas consumption benchmarks for critical contract operations
/// @dev Run with `forge test --match-contract GasBenchmarks -vvv` for gas reports
///      Uses MockHats (lighter than real Hats), so numbers are lower bounds.
contract GasBenchmarks is Test, ERC6551Helper {
    // =========================================================================
    // Gas Budget Constants (must stay under these to prevent regressions)
    // Set at ~2x measured values to allow headroom but still catch regressions
    // =========================================================================
    uint256 constant MAX_MINT_GARDEN_GAS = 3_500_000;
    uint256 constant MAX_MINT_GARDEN_WITH_GARDENERS_GAS = 3_500_000;
    uint256 constant MAX_BATCH_MINT_5_GARDENS_GAS = 16_000_000;
    uint256 constant MAX_GRANT_GARDENER_GAS = 200_000;
    uint256 constant MAX_GRANT_EVALUATOR_GAS = 200_000;
    uint256 constant MAX_GRANT_OPERATOR_GAS = 500_000;
    uint256 constant MAX_GRANT_OWNER_GAS = 600_000;
    uint256 constant MAX_REVOKE_GARDENER_GAS = 200_000;
    uint256 constant MAX_BATCH_GRANT_5_GARDENERS_GAS = 800_000;
    uint256 constant MAX_BATCH_GRANT_5_OPERATORS_GAS = 2_200_000;
    uint256 constant MAX_REGISTER_ACTION_GAS = 500_000;
    uint256 constant MAX_REGISTER_ACTION_ALL_CAPITALS_GAS = 700_000;
    uint256 constant MAX_CREATE_GARDEN_HAT_TREE_GAS = 2_200_000;
    uint256 constant MAX_CONFIGURE_GARDEN_GAS = 400_000;
    uint256 constant MAX_IS_GARDENER_OF_GAS = 20_000;
    uint256 constant MAX_SPLIT_YIELD_GAS = 700_000;
    uint256 constant MAX_SET_SPLIT_RATIO_GAS = 200_000;
    uint256 constant MAX_RESCUE_TOKENS_GAS = 100_000;

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

        // Wire HatsModule and community token into GardenToken
        gardenToken.setHatsModule(address(adapter));
        gardenToken.setCommunityToken(address(mockToken));

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
            name: "Gas Test Garden",
            slug: "",
            description: "A garden for gas benchmarking",
            location: "Location",
            bannerImage: "Banner",
            metadata: "",
            openJoining: false,
            weightScheme: IGardensModule.WeightScheme.Linear,
            domainMask: 0
        });

        uint256 gasBefore = gasleft();
        garden = gardenToken.mintGarden(config);
        uint256 gasUsed = gasBefore - gasleft();

        emit log_named_uint("Gas: mintGarden (single, with hat tree)", gasUsed);
        assertLt(gasUsed, MAX_MINT_GARDEN_GAS, "Gas budget exceeded for mintGarden");
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
            name: "Garden With Gardeners",
            slug: "",
            description: "5 initial gardeners",
            location: "Location",
            bannerImage: "Banner",
            metadata: "",
            openJoining: false,
            weightScheme: IGardensModule.WeightScheme.Linear,
            domainMask: 0
        });

        uint256 gasBefore = gasleft();
        address g = gardenToken.mintGarden(config);
        uint256 gasUsed = gasBefore - gasleft();

        emit log_named_uint("Gas: mintGarden (5 gardeners + hat tree)", gasUsed);
        assertLt(gasUsed, MAX_MINT_GARDEN_WITH_GARDENERS_GAS, "Gas budget exceeded for mintGarden with 5 gardeners");
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
                name: string(abi.encodePacked("Batch Garden ", _uint2str(i))),
                slug: "",
                description: "Batch description",
                location: "Location",
                bannerImage: "Banner",
                metadata: "",
                openJoining: false,
                weightScheme: IGardensModule.WeightScheme.Linear,
                domainMask: 0
            });
        }

        uint256 gasBefore = gasleft();
        address[] memory gardens = gardenToken.batchMintGardens(configs);
        uint256 gasUsed = gasBefore - gasleft();

        emit log_named_uint("Gas: batchMintGardens (5 gardens)", gasUsed);
        emit log_named_uint("Gas: per garden in batch of 5", gasUsed / 5);
        assertLt(gasUsed, MAX_BATCH_MINT_5_GARDENS_GAS, "Gas budget exceeded for batchMintGardens (5)");
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
        assertLt(gasUsed, MAX_GRANT_GARDENER_GAS, "Gas budget exceeded for grantRole(Gardener)");
    }

    /// @notice Benchmark: grantRole(Evaluator) — single hat mint, no cascading
    function testGas_grantEvaluator() public {
        _setupGardenForRoles();

        address user = address(0x6001);
        uint256 gasBefore = gasleft();
        adapter.grantRole(garden, user, IHatsModule.GardenRole.Evaluator);
        uint256 gasUsed = gasBefore - gasleft();

        emit log_named_uint("Gas: grantRole(Evaluator) - single mint", gasUsed);
        assertLt(gasUsed, MAX_GRANT_EVALUATOR_GAS, "Gas budget exceeded for grantRole(Evaluator)");
    }

    /// @notice Benchmark: grantRole(Operator) — cascading: mints Operator + Evaluator + Gardener
    function testGas_grantOperator() public {
        _setupGardenForRoles();

        address user = address(0x6001);
        uint256 gasBefore = gasleft();
        adapter.grantRole(garden, user, IHatsModule.GardenRole.Operator);
        uint256 gasUsed = gasBefore - gasleft();

        emit log_named_uint("Gas: grantRole(Operator) - cascading 3 mints", gasUsed);
        assertLt(gasUsed, MAX_GRANT_OPERATOR_GAS, "Gas budget exceeded for grantRole(Operator)");
    }

    /// @notice Benchmark: grantRole(Owner) — full cascade: Owner + Operator + Evaluator + Gardener
    function testGas_grantOwner() public {
        _setupGardenForRoles();

        address user = address(0x6001);
        uint256 gasBefore = gasleft();
        adapter.grantRole(garden, user, IHatsModule.GardenRole.Owner);
        uint256 gasUsed = gasBefore - gasleft();

        emit log_named_uint("Gas: grantRole(Owner) - cascading 4 mints", gasUsed);
        assertLt(gasUsed, MAX_GRANT_OWNER_GAS, "Gas budget exceeded for grantRole(Owner)");
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
        assertLt(gasUsed, MAX_REVOKE_GARDENER_GAS, "Gas budget exceeded for revokeRole(Gardener)");
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
        assertLt(gasUsed, MAX_BATCH_GRANT_5_GARDENERS_GAS, "Gas budget exceeded for batch grant 5 gardeners");
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
        assertLt(gasUsed, MAX_BATCH_GRANT_5_OPERATORS_GAS, "Gas budget exceeded for batch grant 5 operators");
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
            block.timestamp,
            block.timestamp + 30 days,
            "Plant Trees",
            "agro.planting_event",
            "ipfs://instructions",
            capitals,
            media,
            Domain.AGRO
        );
        uint256 gasUsed = gasBefore - gasleft();

        emit log_named_uint("Gas: registerAction (single capital)", gasUsed);
        assertLt(gasUsed, MAX_REGISTER_ACTION_GAS, "Gas budget exceeded for registerAction (single capital)");
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
            block.timestamp,
            block.timestamp + 30 days,
            "Complex Action",
            "solar.node_ops",
            "ipfs://instructions",
            capitals,
            media,
            Domain.SOLAR
        );
        uint256 gasUsed = gasBefore - gasleft();

        emit log_named_uint("Gas: registerAction (8 capitals + 3 media)", gasUsed);
        assertLt(gasUsed, MAX_REGISTER_ACTION_ALL_CAPITALS_GAS, "Gas budget exceeded for registerAction (all capitals)");
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
        assertLt(gasUsed, MAX_CREATE_GARDEN_HAT_TREE_GAS, "Gas budget exceeded for createGardenHatTree");
    }

    /// @notice Benchmark: configureGarden (manual hat ID assignment)
    function testGas_configureGarden() public {
        address testGarden = address(0xCAFE);

        uint256 gasBefore = gasleft();
        adapter.configureGarden(testGarden, 1, 2, 3, 4, 5, 6);
        uint256 gasUsed = gasBefore - gasleft();

        emit log_named_uint("Gas: configureGarden (manual)", gasUsed);
        assertLt(gasUsed, MAX_CONFIGURE_GARDEN_GAS, "Gas budget exceeded for configureGarden");
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
        assertLt(gasUsed, MAX_IS_GARDENER_OF_GAS, "Gas budget exceeded for isGardenerOf");
    }

    // =========================================================================
    // Internal Helpers
    // =========================================================================

    function _setupGardenForRoles() internal {
        address[] memory gardeners = new address[](0);
        address[] memory operators = new address[](1);
        operators[0] = address(0x5001);

        GardenToken.GardenConfig memory config = GardenToken.GardenConfig({
            name: "Benchmark Garden",
            slug: "",
            description: "Gas benchmark garden",
            location: "Location",
            bannerImage: "Banner",
            metadata: "",
            openJoining: false,
            weightScheme: IGardensModule.WeightScheme.Linear,
            domainMask: 0
        });

        garden = gardenToken.mintGarden(config);

        // Authorize ourselves as owner in HatsModule for role management
        (uint256 ownerHatId,,,,,,,) = adapter.gardenHats(garden);
        mockHats.setWearer(ownerHatId, owner, true);
    }

    // =========================================================================
    // YieldResolver Benchmarks
    // =========================================================================

    /// @notice Benchmark: splitYield (redeem + three-way split)
    function testGas_splitYield() public {
        // Deploy YieldResolver infrastructure
        (YieldResolver ys, MockOctantVaultForYield ysVault, MockWETHForBench ysWeth) = _setupYieldResolver();

        // Fund vault and mint shares
        ysWeth.mint(address(ysVault), 10_000);
        ysVault.mintShares(address(ys), 10_000);
        ys.registerShares(address(0x100), address(ysVault), 10_000);

        uint256 gasBefore = gasleft();
        ys.splitYield(address(0x100), address(ysWeth), address(ysVault));
        uint256 gasUsed = gasBefore - gasleft();

        emit log_named_uint("Gas: splitYield (three-way distribution)", gasUsed);
        assertLt(gasUsed, MAX_SPLIT_YIELD_GAS, "Gas budget exceeded for splitYield");
    }

    /// @notice Benchmark: setSplitRatio
    function testGas_setSplitRatio() public {
        (YieldResolver ys,,) = _setupYieldResolver();

        uint256 gasBefore = gasleft();
        ys.setSplitRatio(address(0x100), 5000, 3000, 2000);
        uint256 gasUsed = gasBefore - gasleft();

        emit log_named_uint("Gas: setSplitRatio", gasUsed);
        assertLt(gasUsed, MAX_SET_SPLIT_RATIO_GAS, "Gas budget exceeded for setSplitRatio");
    }

    /// @notice Benchmark: rescueTokens
    function testGas_rescueTokens() public {
        (YieldResolver ys,, MockWETHForBench ysWeth) = _setupYieldResolver();
        ysWeth.mint(address(ys), 5000);

        uint256 gasBefore = gasleft();
        ys.rescueTokens(address(ysWeth), address(0x400), 5000);
        uint256 gasUsed = gasBefore - gasleft();

        emit log_named_uint("Gas: rescueTokens", gasUsed);
        assertLt(gasUsed, MAX_RESCUE_TOKENS_GAS, "Gas budget exceeded for rescueTokens");
    }

    function _setupYieldResolver()
        internal
        returns (YieldResolver ys, MockOctantVaultForYield ysVault, MockWETHForBench ysWeth)
    {
        ysWeth = new MockWETHForBench();
        ysVault = new MockOctantVaultForYield(address(ysWeth));
        MockCookieJar cookieJar = new MockCookieJar();
        MockJBMultiTerminalForYield jbTerminal = new MockJBMultiTerminalForYield();
        MockHatsModuleForBench hatsModuleBench = new MockHatsModuleForBench();

        YieldResolver impl = new YieldResolver();
        bytes memory initData =
            abi.encodeWithSelector(YieldResolver.initialize.selector, owner, address(0x2), address(hatsModuleBench), 0);
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        ys = YieldResolver(address(proxy));

        address ysGarden = address(0x100);
        ys.setCookieJar(ysGarden, address(cookieJar));
        ys.setGardenTreasury(ysGarden, address(0x200));
        ys.setGardenVault(ysGarden, address(ysWeth), address(ysVault));
        ys.setHypercertMarketplace(address(new MockHypercertMarketplace()));
        ys.setJBMultiTerminal(address(jbTerminal));
        ys.setJuiceboxProjectId(1);

        hatsModuleBench.setOperator(ysGarden, owner, true);
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

/// @title MockWETHForBench — Minimal ERC20 for gas benchmarks
contract MockWETHForBench is ERC20 {
    constructor() ERC20("Wrapped Ether", "WETH") { }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
