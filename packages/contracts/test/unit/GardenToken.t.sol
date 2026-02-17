// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { GardenToken } from "../../src/tokens/Garden.sol";
import { GardenAccount } from "../../src/accounts/Garden.sol";
import { ActionRegistry } from "../../src/registries/Action.sol";
import { MockERC20 } from "../../src/mocks/ERC20.sol";
import { MockNonERC20 } from "../../src/mocks/NonERC20.sol";
import { MockHatsModule } from "../helpers/MockHatsModule.sol";
import { ERC6551Helper } from "../helpers/ERC6551Helper.sol";
import { IGardensModule } from "../../src/interfaces/IGardensModule.sol";
import { IGreenGoodsENS } from "../../src/interfaces/IGreenGoodsENS.sol";

/// @title RevertingENSModule
/// @notice Mock ENS module that always reverts on registerGarden
/// @dev Used to test the try-catch at GardenToken.sol:376-380
contract RevertingENSModule is IGreenGoodsENS {
    function registerGarden(string calldata, address) external payable override {
        revert("RevertingENSModule: registerGarden failed");
    }

    function claimName(string calldata) external payable override { }
    function claimNameSponsored(string calldata) external override { }
    function releaseName() external payable override { }

    function available(string calldata) external pure override returns (bool) {
        return true;
    }

    function getRegistrationFee(string calldata, address, NameType) external pure override returns (uint256) {
        return 0;
    }
}


/// @title AcceptingENSModule
/// @notice Mock ENS module that accepts registration and records the forwarded ETH
contract AcceptingENSModule is IGreenGoodsENS {
    uint256 public totalValueReceived;

    function registerGarden(string calldata, address) external payable override {
        totalValueReceived += msg.value;
    }

    function claimName(string calldata) external payable override { }
    function claimNameSponsored(string calldata) external override { }
    function releaseName() external payable override { }

    function available(string calldata) external pure override returns (bool) {
        return true;
    }

    function getRegistrationFee(string calldata, address, NameType) external pure override returns (uint256) {
        return 0;
    }
}

contract GardenTokenTest is Test, ERC6551Helper {
    GardenToken private gardenToken;
    address private multisig = address(0x123);
    address private gardenAccountImplementation = address(
        new GardenAccount(
            address(0x001), // erc4337EntryPoint
            address(0x002), // multicallForwarder
            address(0x003), // erc6551Registry
            address(0x004), // guardian
            address(0x2001), // workApprovalResolver
            address(0x2002) // assessmentResolver
        )
    );
    MockERC20 private mockToken;
    MockNonERC20 private mockNonERC20;
    MockHatsModule private mockHatsModule;

    // Events (mirrored from GardenToken for vm.expectEmit)
    event HatsModuleUpdated(address indexed oldModule, address indexed newModule);
    event KarmaGAPModuleUpdated(address indexed oldModule, address indexed newModule);
    event OctantModuleUpdated(address indexed oldModule, address indexed newModule);
    event ENSRegistrationRefundQueued(address indexed minter, uint256 amount);
    event ENSRegistrationRefundClaimed(address indexed minter, uint256 amount);
    event GardenMinted(
        uint256 indexed tokenId,
        address indexed account,
        string name,
        string description,
        string location,
        string bannerImage,
        bool openJoining
    );

    function setUp() public {
        _deployERC6551Registry();

        GardenToken implementation = new GardenToken(gardenAccountImplementation);
        bytes memory initData = abi.encodeWithSelector(GardenToken.initialize.selector, multisig, address(0));
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        gardenToken = GardenToken(address(proxy));

        mockToken = new MockERC20();
        mockNonERC20 = new MockNonERC20();
        mockHatsModule = new MockHatsModule();
    }

    function _setHatsModule() internal {
        vm.prank(multisig);
        gardenToken.setHatsModule(address(mockHatsModule));
    }

    function _defaultConfig(address token) internal pure returns (GardenToken.GardenConfig memory) {
        return GardenToken.GardenConfig({
            communityToken: token,
            name: "Test Garden",
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

    function testInitialize() public {
        assertEq(gardenToken.owner(), multisig, "Owner should be the multisig address");
    }

    function testMintGarden_RevertsWithZeroAddressToken() public {
        vm.prank(multisig);
        vm.expectRevert(GardenToken.InvalidCommunityToken.selector);
        gardenToken.mintGarden(_defaultConfig(address(0)));
    }

    function testMintGarden_RevertsWithEOA() public {
        address eoa = address(0x999);

        vm.prank(multisig);
        vm.expectRevert(GardenToken.CommunityTokenNotContract.selector);
        gardenToken.mintGarden(_defaultConfig(eoa));
    }

    function testMintGarden_RevertsWithNonERC20Contract() public {
        vm.prank(multisig);
        vm.expectRevert(GardenToken.InvalidERC20Token.selector);
        gardenToken.mintGarden(_defaultConfig(address(mockNonERC20)));
    }

    function testMintGarden_RevertsWhenHatsModuleNotSet() public {
        vm.prank(multisig);
        vm.expectRevert(GardenToken.HatsModuleNotSet.selector);
        gardenToken.mintGarden(_defaultConfig(address(mockToken)));
    }

    function testMintGarden_SucceedsWithValidERC20AndHatsModuleSet() public {
        _setHatsModule();

        vm.prank(multisig);
        address gardenAccount = gardenToken.mintGarden(_defaultConfig(address(mockToken)));

        assertTrue(gardenAccount != address(0), "Garden account should be created");
        assertEq(gardenToken.ownerOf(0), multisig, "Token should be minted to multisig");
    }

    function testOnlyOwnerOrAllowlistCanMint() public {
        address notAuthorized = address(0x999);

        vm.prank(notAuthorized);
        vm.expectRevert(GardenToken.DeploymentNotConfigured.selector);
        gardenToken.mintGarden(_defaultConfig(address(mockToken)));
    }

    function testBatchMintGardensRevertsWithEmptyArray() public {
        GardenToken.GardenConfig[] memory configs = new GardenToken.GardenConfig[](0);

        vm.prank(multisig);
        vm.expectRevert(GardenToken.InvalidBatchSize.selector);
        gardenToken.batchMintGardens(configs);
    }

    function testBatchMintGardensRevertsWithTooManyGardens() public {
        GardenToken.GardenConfig[] memory configs = new GardenToken.GardenConfig[](11);

        vm.prank(multisig);
        vm.expectRevert(GardenToken.InvalidBatchSize.selector);
        gardenToken.batchMintGardens(configs);
    }

    function testBatchMintGardens_RevertsWithInvalidToken() public {
        GardenToken.GardenConfig[] memory configs = new GardenToken.GardenConfig[](2);
        configs[0] = _defaultConfig(address(mockToken));
        configs[1] = _defaultConfig(address(0));

        vm.prank(multisig);
        vm.expectRevert(GardenToken.InvalidCommunityToken.selector);
        gardenToken.batchMintGardens(configs);
    }

    function testBatchMintGardens_RevertsWhenHatsModuleNotSet() public {
        GardenToken.GardenConfig[] memory configs = new GardenToken.GardenConfig[](1);
        configs[0] = _defaultConfig(address(mockToken));

        vm.prank(multisig);
        vm.expectRevert(GardenToken.HatsModuleNotSet.selector);
        gardenToken.batchMintGardens(configs);
    }

    function testBatchMintGardens_SucceedsWithValidTokensAndHatsModuleSet() public {
        _setHatsModule();

        GardenToken.GardenConfig[] memory configs = new GardenToken.GardenConfig[](2);
        configs[0] = _defaultConfig(address(mockToken));
        configs[1] = GardenToken.GardenConfig({
            communityToken: address(mockToken),
            name: "Garden 2",
            slug: "",
            description: "Description 2",
            location: "Location 2",
            bannerImage: "Banner 2",
            metadata: "",
            openJoining: true,
            weightScheme: IGardensModule.WeightScheme.Linear,
            domainMask: 0
        });

        vm.prank(multisig);
        address[] memory gardenAccounts = gardenToken.batchMintGardens(configs);

        assertEq(gardenAccounts.length, 2, "Should create 2 gardens");
        assertTrue(gardenAccounts[0] != address(0), "First garden should be created");
        assertTrue(gardenAccounts[1] != address(0), "Second garden should be created");
        assertEq(gardenToken.ownerOf(0), multisig, "First token should be minted");
        assertEq(gardenToken.ownerOf(1), multisig, "Second token should be minted");
    }

    // =========================================================================
    // Event Emission Tests
    // =========================================================================

    function test_setHatsModule_emitsEvent() public {
        vm.expectEmit(true, true, false, false);
        emit HatsModuleUpdated(address(0), address(mockHatsModule));

        vm.prank(multisig);
        gardenToken.setHatsModule(address(mockHatsModule));
    }

    function test_setKarmaGAPModule_emitsEvent() public {
        address module = address(0xCAFE);

        vm.expectEmit(true, true, false, false);
        emit KarmaGAPModuleUpdated(address(0), module);

        vm.prank(multisig);
        gardenToken.setKarmaGAPModule(module);
    }

    function test_setOctantModule_emitsEvent() public {
        address module = address(0xBEEF);

        vm.expectEmit(true, true, false, false);
        emit OctantModuleUpdated(address(0), module);

        vm.prank(multisig);
        gardenToken.setOctantModule(module);
    }

    function test_mintGarden_emitsGardenMintedEvent() public {
        _setHatsModule();

        // We can't predict the exact garden account address, so check topic matching only
        vm.expectEmit(true, false, false, false);
        emit GardenMinted(0, address(0), "Test Garden", "Description", "Location", "Banner", false);

        vm.prank(multisig);
        gardenToken.mintGarden(_defaultConfig(address(mockToken)));
    }

    // =========================================================================
    // Setter Access Control Tests
    // =========================================================================

    function test_setKarmaGAPModule_onlyOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        gardenToken.setKarmaGAPModule(address(0xCAFE));
    }

    function test_setOctantModule_onlyOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        gardenToken.setOctantModule(address(0xBEEF));
    }

    function test_setDeployment_onlyOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        gardenToken.setDeployment(address(0xDEAD));
    }

    // =========================================================================
    // Double Initialization Test
    // =========================================================================

    function test_initialize_revertsOnDoubleInit() public {
        vm.expectRevert("Initializable: contract is already initialized");
        gardenToken.initialize(address(0x999), address(0));
    }

    // =========================================================================
    // UUPS Upgrade Tests
    // =========================================================================

    function test_authorizeUpgrade_ownerCanUpgrade() public {
        GardenToken newImpl = new GardenToken(gardenAccountImplementation);

        vm.prank(multisig);
        gardenToken.upgradeTo(address(newImpl));
    }

    function test_authorizeUpgrade_nonOwnerCannotUpgrade() public {
        GardenToken newImpl = new GardenToken(gardenAccountImplementation);

        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        gardenToken.upgradeTo(address(newImpl));
    }

    // =========================================================================
    // Domain Masking Integration Tests
    // =========================================================================

    function test_mintGarden_setsDomainMaskOnActionRegistry() public {
        _setHatsModule();

        // Deploy and wire ActionRegistry
        ActionRegistry ar = ActionRegistry(
            address(
                new ERC1967Proxy(
                    address(new ActionRegistry()), abi.encodeWithSelector(ActionRegistry.initialize.selector, multisig)
                )
            )
        );

        vm.startPrank(multisig);
        ar.setGardenToken(address(gardenToken));
        gardenToken.setActionRegistry(address(ar));
        vm.stopPrank();

        // Mint garden with domainMask = 0x05 (Solar + Edu)
        GardenToken.GardenConfig memory config = _defaultConfig(address(mockToken));
        config.domainMask = 0x05;

        vm.prank(multisig);
        address garden = gardenToken.mintGarden(config);

        // Verify domain mask was set
        assertEq(ar.gardenDomains(garden), 0x05, "Domain mask should be set on ActionRegistry");
    }

    function test_mintGarden_zeroDomainMask_skipsActionRegistry() public {
        _setHatsModule();

        ActionRegistry ar = ActionRegistry(
            address(
                new ERC1967Proxy(
                    address(new ActionRegistry()), abi.encodeWithSelector(ActionRegistry.initialize.selector, multisig)
                )
            )
        );

        vm.startPrank(multisig);
        ar.setGardenToken(address(gardenToken));
        gardenToken.setActionRegistry(address(ar));
        vm.stopPrank();

        GardenToken.GardenConfig memory config = _defaultConfig(address(mockToken));
        config.domainMask = 0; // zero = skip

        vm.prank(multisig);
        address garden = gardenToken.mintGarden(config);

        assertEq(ar.gardenDomains(garden), 0x00, "Zero mask should not set domains");
    }

    function test_mintGarden_allDomains_0x0F() public {
        _setHatsModule();

        ActionRegistry ar = ActionRegistry(
            address(
                new ERC1967Proxy(
                    address(new ActionRegistry()), abi.encodeWithSelector(ActionRegistry.initialize.selector, multisig)
                )
            )
        );

        vm.startPrank(multisig);
        ar.setGardenToken(address(gardenToken));
        gardenToken.setActionRegistry(address(ar));
        vm.stopPrank();

        GardenToken.GardenConfig memory config = _defaultConfig(address(mockToken));
        config.domainMask = 0x0F; // all 4 domains

        vm.prank(multisig);
        address garden = gardenToken.mintGarden(config);

        assertEq(ar.gardenDomains(garden), 0x0F, "All domains should be set");
    }

    function test_mintGarden_withoutActionRegistry_stillSucceeds() public {
        _setHatsModule();

        GardenToken.GardenConfig memory config = _defaultConfig(address(mockToken));
        config.domainMask = 0x0F; // all domains, but no ActionRegistry wired

        vm.prank(multisig);
        address garden = gardenToken.mintGarden(config);
        assertTrue(garden != address(0), "Mint should succeed without ActionRegistry");
    }

    // =========================================================================
    // Module Setter Access Control (Completeness)
    // =========================================================================

    function test_setGardensModule_onlyOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        gardenToken.setGardensModule(address(0xCAFE));
    }

    function test_setActionRegistry_onlyOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        gardenToken.setActionRegistry(address(0xCAFE));
    }

    function test_setCookieJarModule_onlyOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        gardenToken.setCookieJarModule(address(0xCAFE));
    }

    function test_setHatsModule_onlyOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        gardenToken.setHatsModule(address(0xCAFE));
    }

    // =========================================================================
    // Module Setter Event Emissions (Completeness)
    // =========================================================================

    event GardensModuleUpdated(address indexed oldModule, address indexed newModule);
    event ActionRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
    event CookieJarModuleUpdated(address indexed oldModule, address indexed newModule);

    function test_setGardensModule_emitsEvent() public {
        address newModule = address(0xBEEF);
        vm.expectEmit(true, true, false, false);
        emit GardensModuleUpdated(address(0), newModule);

        vm.prank(multisig);
        gardenToken.setGardensModule(newModule);
    }

    function test_setActionRegistry_emitsEvent() public {
        address newRegistry = address(0xBEEF);
        vm.expectEmit(true, true, false, false);
        emit ActionRegistryUpdated(address(0), newRegistry);

        vm.prank(multisig);
        gardenToken.setActionRegistry(newRegistry);
    }

    function test_setCookieJarModule_emitsEvent() public {
        address newModule = address(0xBEEF);
        vm.expectEmit(true, true, false, false);
        emit CookieJarModuleUpdated(address(0), newModule);

        vm.prank(multisig);
        gardenToken.setCookieJarModule(newModule);
    }

    // =========================================================================
    // Batch Mint Uniqueness
    // =========================================================================

    function test_batchMintGardens_producesUniqueGardenAddresses() public {
        _setHatsModule();

        GardenToken.GardenConfig[] memory configs = new GardenToken.GardenConfig[](3);
        configs[0] = _defaultConfig(address(mockToken));
        configs[0].name = "Garden 0";
        configs[1] = _defaultConfig(address(mockToken));
        configs[1].name = "Garden 1";
        configs[2] = _defaultConfig(address(mockToken));
        configs[2].name = "Garden 2";

        vm.prank(multisig);
        address[] memory accounts = gardenToken.batchMintGardens(configs);

        // Verify all addresses are unique
        assertTrue(accounts[0] != accounts[1], "Garden 0 and 1 should differ");
        assertTrue(accounts[1] != accounts[2], "Garden 1 and 2 should differ");
        assertTrue(accounts[0] != accounts[2], "Garden 0 and 2 should differ");
    }

    // =========================================================================
    // Transfer Restriction Tests
    // =========================================================================

    function test_transferRestriction_locked() public {
        _setHatsModule();

        vm.prank(multisig);
        address gardenAccount = gardenToken.mintGarden(_defaultConfig(address(mockToken)));
        assertTrue(gardenAccount != address(0), "Garden should be minted");

        // Set transfer restriction to Locked
        vm.prank(multisig);
        gardenToken.setTransferRestriction(GardenToken.TransferRestriction.Locked);

        // Try to transfer — should revert
        vm.prank(multisig);
        vm.expectRevert(GardenToken.TransfersLocked.selector);
        gardenToken.transferFrom(multisig, address(0x999), 0);
    }

    function test_transferRestriction_ownerOnly() public {
        _setHatsModule();

        vm.prank(multisig);
        address gardenAccount = gardenToken.mintGarden(_defaultConfig(address(mockToken)));
        assertTrue(gardenAccount != address(0), "Garden should be minted");

        // Set restriction to OwnerOnly
        vm.prank(multisig);
        gardenToken.setTransferRestriction(GardenToken.TransferRestriction.OwnerOnly);

        // Transfer by owner should succeed
        vm.prank(multisig);
        gardenToken.transferFrom(multisig, address(0x999), 0);
        assertEq(gardenToken.ownerOf(0), address(0x999), "Token should transfer to new owner");

        // Mint another token for non-owner transfer test
        vm.prank(multisig);
        gardenToken.mintGarden(_defaultConfig(address(mockToken)));

        // Approve a non-owner to transfer
        vm.prank(multisig);
        gardenToken.approve(address(0x888), 1);

        // Non-owner transfer should revert
        vm.prank(address(0x888));
        vm.expectRevert(GardenToken.TransfersRestricted.selector);
        gardenToken.transferFrom(multisig, address(0x777), 1);
    }

    function test_transferRestriction_unrestricted() public {
        _setHatsModule();

        vm.prank(multisig);
        gardenToken.mintGarden(_defaultConfig(address(mockToken)));

        // Default is Unrestricted — transfer should work
        vm.prank(multisig);
        gardenToken.transferFrom(multisig, address(0x999), 0);
        assertEq(gardenToken.ownerOf(0), address(0x999), "Token should transfer successfully");
    }

    function test_setTransferRestriction_onlyOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        gardenToken.setTransferRestriction(GardenToken.TransferRestriction.Locked);
    }

    function test_batchMintGardens_withDomainMasks() public {
        _setHatsModule();

        ActionRegistry ar = ActionRegistry(
            address(
                new ERC1967Proxy(
                    address(new ActionRegistry()), abi.encodeWithSelector(ActionRegistry.initialize.selector, multisig)
                )
            )
        );

        vm.startPrank(multisig);
        ar.setGardenToken(address(gardenToken));
        gardenToken.setActionRegistry(address(ar));
        vm.stopPrank();

        GardenToken.GardenConfig[] memory configs = new GardenToken.GardenConfig[](3);
        configs[0] = _defaultConfig(address(mockToken));
        configs[0].domainMask = 0x01; // Solar
        configs[1] = _defaultConfig(address(mockToken));
        configs[1].domainMask = 0x06; // Agro + Edu
        configs[2] = _defaultConfig(address(mockToken));
        configs[2].domainMask = 0x0F; // All

        vm.prank(multisig);
        address[] memory accounts = gardenToken.batchMintGardens(configs);

        assertEq(ar.gardenDomains(accounts[0]), 0x01, "Garden 0 should have Solar");
        assertEq(ar.gardenDomains(accounts[1]), 0x06, "Garden 1 should have Agro+Edu");
        assertEq(ar.gardenDomains(accounts[2]), 0x0F, "Garden 2 should have all domains");
    }

    // =========================================================================
    // Fault Injection: ENS Registration Failure (GardenToken.sol:376-380)
    // =========================================================================

    /// @notice FAULT INJECTION: ENS registerGarden reverts, garden mint still succeeds
    /// @dev Tests the try-catch at GardenToken.sol:376-380. When the ENS module fails
    ///      to register the garden subdomain, the catch block silently absorbs the error
    ///      and garden minting completes normally. This proves ENS is non-blocking.
    function test_mintGarden_ensModuleFails_gardenStillMinted() public {
        _setHatsModule();

        // Wire a reverting ENS module
        RevertingENSModule revertingENS = new RevertingENSModule();
        vm.prank(multisig);
        gardenToken.setENSModule(address(revertingENS));

        // Mint with a slug (triggers ENS registration path at line 374)
        GardenToken.GardenConfig memory config = _defaultConfig(address(mockToken));
        config.slug = "test-garden"; // Non-empty slug triggers ENS path

        vm.prank(multisig);
        address gardenAccount = gardenToken.mintGarden(config);

        // Garden should be successfully minted despite ENS failure.
        // The ENS module is set + slug is non-empty, so the try block at line 374-376
        // attempted registerGarden which reverted. The catch at line 378 absorbed the
        // revert, proving graceful degradation — without the try-catch, mintGarden
        // would revert entirely.
        assertTrue(gardenAccount != address(0), "Garden should be minted despite ENS failure");
        assertEq(gardenToken.balanceOf(multisig), 1, "Owner should have 1 garden NFT");

        // Verify ENS module is wired (confirms the code path was exercised)
        assertEq(address(gardenToken.ensModule()), address(revertingENS), "ENS module should be set");
    }

    function test_mintGarden_ensFailureQueuesRefundAndClaimSucceeds() public {
        _setHatsModule();

        RevertingENSModule revertingENS = new RevertingENSModule();
        vm.prank(multisig);
        gardenToken.setENSModule(address(revertingENS));

        GardenToken.GardenConfig memory config = _defaultConfig(address(mockToken));
        config.slug = "refund-garden";

        uint256 refundAmount = 0.05 ether;
        vm.deal(multisig, 1 ether);

        vm.prank(multisig);
        vm.expectEmit(true, false, false, true);
        emit ENSRegistrationRefundQueued(multisig, refundAmount);
        gardenToken.mintGarden{ value: refundAmount }(config);

        assertEq(gardenToken.failedENSRefunds(multisig), refundAmount, "refund should be queued");
        assertEq(gardenToken.totalPendingENSRefunds(), refundAmount, "pending total should increase");

        uint256 before = multisig.balance;
        vm.prank(multisig);
        vm.expectEmit(true, false, false, true);
        emit ENSRegistrationRefundClaimed(multisig, refundAmount);
        gardenToken.claimENSRefund();

        assertEq(multisig.balance, before + refundAmount, "refund should be paid out");
        assertEq(gardenToken.failedENSRefunds(multisig), 0, "refund credit should clear");
        assertEq(gardenToken.totalPendingENSRefunds(), 0, "pending total should clear");
    }

    function test_mintGarden_ensSuccessDoesNotQueueRefund() public {
        _setHatsModule();

        AcceptingENSModule ens = new AcceptingENSModule();
        vm.prank(multisig);
        gardenToken.setENSModule(address(ens));

        GardenToken.GardenConfig memory config = _defaultConfig(address(mockToken));
        config.slug = "success-garden";

        uint256 forwardedValue = 0.03 ether;
        vm.deal(multisig, 1 ether);

        vm.prank(multisig);
        gardenToken.mintGarden{ value: forwardedValue }(config);

        assertEq(ens.totalValueReceived(), forwardedValue, "value should be forwarded to ENS module");
        assertEq(gardenToken.failedENSRefunds(multisig), 0, "no refund should be queued");
    }

    function test_claimENSRefund_revertsWithoutBalance() public {
        vm.prank(multisig);
        vm.expectRevert(GardenToken.NoENSRefundAvailable.selector);
        gardenToken.claimENSRefund();
    }

}
