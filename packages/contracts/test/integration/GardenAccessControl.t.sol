// SPDX-License-Identifier: MIT
// solhint-disable one-contract-per-file
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { IGardenAccessControl } from "../../src/interfaces/IGardenAccessControl.sol";
import { IGardenAccount } from "../../src/interfaces/IGardenAccount.sol";
import { GardenAccount } from "../../src/accounts/Garden.sol";
import { AccountGuardian } from "@tokenbound/AccountGuardian.sol";
import { ERC6551Registry } from "erc6551/ERC6551Registry.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @notice Mock ERC721 for testing
contract MockGardenNFT is ERC721 {
    uint256 private _tokenIdCounter;
    address public hatsModule;
    address public karmaGAPModule;

    constructor() ERC721("MockGarden", "GARDEN") { }

    function mint(address to) external returns (uint256) {
        uint256 tokenId = _tokenIdCounter++;
        _mint(to, tokenId);
        return tokenId;
    }

    function setHatsModule(address _module) external {
        hatsModule = _module;
    }

    function setKarmaGAPModule(address _module) external {
        karmaGAPModule = _module;
    }
}

contract MockHatsModule {
    enum Role {
        Gardener,
        Evaluator,
        Operator,
        Owner,
        Funder,
        Community
    }

    mapping(address garden => mapping(address account => mapping(uint8 role => bool))) private roles;

    function setRole(address garden, address account, Role role, bool value) external {
        roles[garden][account][uint8(role)] = value;
    }

    function isGardenerOf(address garden, address account) external view returns (bool) {
        return roles[garden][account][uint8(Role.Gardener)];
    }

    function isEvaluatorOf(address garden, address account) external view returns (bool) {
        return roles[garden][account][uint8(Role.Evaluator)];
    }

    function isOperatorOf(address garden, address account) external view returns (bool) {
        return roles[garden][account][uint8(Role.Operator)];
    }

    function isOwnerOf(address garden, address account) external view returns (bool) {
        return roles[garden][account][uint8(Role.Owner)];
    }

    function isFunderOf(address garden, address account) external view returns (bool) {
        return roles[garden][account][uint8(Role.Funder)];
    }

    function isCommunityOf(address garden, address account) external view returns (bool) {
        return roles[garden][account][uint8(Role.Community)];
    }
}

/// @title GardenAccessControlTest
/// @notice Tests for IGardenAccessControl interface implementation in GardenAccount
contract GardenAccessControlTest is Test {
    GardenAccount public gardenAccountImpl;
    GardenAccount public gardenAccount;
    MockGardenNFT public gardenNFT;
    MockHatsModule public hatsModule;
    ERC6551Registry public registry;
    AccountGuardian public guardian;

    address public owner;
    address public operator1;
    address public gardener1;
    address public gardener2;
    address public randomUser;

    // Mock addresses for constructor
    address constant ENTRY_POINT = address(0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789);
    address constant MULTICALL = address(0xcA11bde05977b3631167028862bE2a173976CA11);
    address constant WORK_RESOLVER = address(0x1111);
    address constant ASSESSMENT_RESOLVER = address(0x2222);

    function setUp() public {
        owner = address(this);
        operator1 = address(0x100);
        gardener1 = address(0x200);
        gardener2 = address(0x300);
        randomUser = address(0x400);

        // Deploy dependencies
        guardian = new AccountGuardian(owner);
        registry = new ERC6551Registry();
        gardenNFT = new MockGardenNFT();
        hatsModule = new MockHatsModule();
        gardenNFT.setHatsModule(address(hatsModule));

        // Deploy GardenAccount implementation
        gardenAccountImpl = new GardenAccount(
            ENTRY_POINT, MULTICALL, address(registry), address(guardian), WORK_RESOLVER, ASSESSMENT_RESOLVER
        );

        // Mint NFT and create TBA
        uint256 tokenId = gardenNFT.mint(owner);
        address tbaAddress =
            registry.createAccount(address(gardenAccountImpl), bytes32(0), block.chainid, address(gardenNFT), tokenId);
        gardenAccount = GardenAccount(payable(tbaAddress));

        // Initialize garden
        IGardenAccount.InitParams memory params = IGardenAccount.InitParams({
            communityToken: address(0),
            name: "Test Garden",
            description: "A test garden",
            location: "Test Location",
            bannerImage: "",
            metadata: "",
            openJoining: false
        });

        gardenAccount.initialize(params);

        // Set initial roles via mock Hats module
        hatsModule.setRole(address(gardenAccount), owner, MockHatsModule.Role.Owner, true);
        hatsModule.setRole(address(gardenAccount), operator1, MockHatsModule.Role.Operator, true);
        hatsModule.setRole(address(gardenAccount), gardener1, MockHatsModule.Role.Gardener, true);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // IGardenAccessControl Interface Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_isGardener_returnsTrueForGardener() public {
        IGardenAccessControl accessControl = IGardenAccessControl(address(gardenAccount));
        assertTrue(accessControl.isGardener(gardener1), "gardener1 should be a gardener");
    }

    function test_isGardener_returnsTrueForOwner() public {
        // Owner inherits gardener permissions in Hats-based roles
        IGardenAccessControl accessControl = IGardenAccessControl(address(gardenAccount));
        assertTrue(accessControl.isGardener(owner), "owner should be a gardener via inheritance");
    }

    function test_isGardener_returnsFalseForNonGardener() public {
        IGardenAccessControl accessControl = IGardenAccessControl(address(gardenAccount));
        assertFalse(accessControl.isGardener(randomUser), "randomUser should not be a gardener");
    }

    function test_isOperator_returnsTrueForOperator() public {
        IGardenAccessControl accessControl = IGardenAccessControl(address(gardenAccount));
        assertTrue(accessControl.isOperator(operator1), "operator1 should be an operator");
    }

    function test_isOperator_returnsTrueForOwner() public {
        IGardenAccessControl accessControl = IGardenAccessControl(address(gardenAccount));
        assertTrue(accessControl.isOperator(owner), "owner should be an operator via inheritance");
    }

    function test_isOperator_returnsFalseForNonOperator() public {
        IGardenAccessControl accessControl = IGardenAccessControl(address(gardenAccount));
        assertFalse(accessControl.isOperator(gardener1), "gardener1 should not be an operator");
        assertFalse(accessControl.isOperator(randomUser), "randomUser should not be an operator");
    }

    function test_isOwner_returnsTrueForOwner() public {
        IGardenAccessControl accessControl = IGardenAccessControl(address(gardenAccount));
        assertTrue(accessControl.isOwner(owner), "owner should be the garden owner");
    }

    function test_isOwner_returnsFalseForNonOwner() public {
        IGardenAccessControl accessControl = IGardenAccessControl(address(gardenAccount));
        assertFalse(accessControl.isOwner(operator1), "operator should not be owner");
        assertFalse(accessControl.isOwner(gardener1), "gardener should not be owner");
        assertFalse(accessControl.isOwner(randomUser), "randomUser should not be owner");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Role Changes Reflected in Interface
    // ═══════════════════════════════════════════════════════════════════════════

    function test_isGardener_updatesAfterRoleChange() public {
        IGardenAccessControl accessControl = IGardenAccessControl(address(gardenAccount));

        // Initially not a gardener
        assertFalse(accessControl.isGardener(gardener2), "gardener2 should not be a gardener initially");

        // Grant gardener role
        hatsModule.setRole(address(gardenAccount), gardener2, MockHatsModule.Role.Gardener, true);

        // Now should be a gardener
        assertTrue(accessControl.isGardener(gardener2), "gardener2 should be a gardener after adding");

        // Revoke gardener role
        hatsModule.setRole(address(gardenAccount), gardener2, MockHatsModule.Role.Gardener, false);
        assertFalse(accessControl.isGardener(gardener2), "gardener2 should not be a gardener after removal");
    }

    function test_isOperator_updatesAfterRoleChange() public {
        IGardenAccessControl accessControl = IGardenAccessControl(address(gardenAccount));
        address newOperator = address(0x500);

        // Initially not an operator
        assertFalse(accessControl.isOperator(newOperator), "newOperator should not be an operator initially");

        // Grant operator role
        hatsModule.setRole(address(gardenAccount), newOperator, MockHatsModule.Role.Operator, true);
        assertTrue(accessControl.isOperator(newOperator), "newOperator should be an operator after adding");

        // Revoke operator role
        hatsModule.setRole(address(gardenAccount), newOperator, MockHatsModule.Role.Operator, false);
        assertFalse(accessControl.isOperator(newOperator), "newOperator should not be an operator after removal");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Interface Compatibility
    // ═══════════════════════════════════════════════════════════════════════════

    function test_gardenAccount_implementsIGardenAccessControl() public {
        IGardenAccessControl accessControl = IGardenAccessControl(address(gardenAccount));
        accessControl.isGardener(owner);
        accessControl.isEvaluator(owner);
        accessControl.isOperator(owner);
        accessControl.isOwner(owner);
        accessControl.isFunder(owner);
        accessControl.isCommunity(owner);
    }

    function test_interfaceMethodsMatchHatsModule() public {
        IGardenAccessControl accessControl = IGardenAccessControl(address(gardenAccount));

        assertEq(
            accessControl.isGardener(gardener1),
            hatsModule.isGardenerOf(address(gardenAccount), gardener1),
            "gardener role should match hats module"
        );
        assertEq(
            accessControl.isOperator(operator1),
            hatsModule.isOperatorOf(address(gardenAccount), operator1),
            "operator role should match hats module"
        );
        assertEq(
            accessControl.isOwner(owner),
            hatsModule.isOwnerOf(address(gardenAccount), owner),
            "owner role should match hats module"
        );
    }
}
