// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC6551Registry } from "erc6551/ERC6551Registry.sol";
import { AccountGuardian } from "@tokenbound/AccountGuardian.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

import { GardenAccount, InvalidInvite, AlreadyGardener, HatsModuleNotAvailable } from "../../src/accounts/Garden.sol";
import { IGardenAccount } from "../../src/interfaces/IGardenAccount.sol";
import { IHatsModule } from "../../src/interfaces/IHatsModule.sol";

contract MockGardenNFTForJoin is ERC721 {
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

contract MockHatsModuleForJoin is IHatsModule {
    mapping(address garden => mapping(address account => mapping(uint8 role => bool))) private roles;

    function createGardenHatTree(address, string calldata, address) external pure returns (uint256 adminHatId) {
        return 1;
    }

    function grantRole(address garden, address account, GardenRole role) external {
        roles[garden][account][uint8(role)] = true;
    }

    function revokeRole(address garden, address account, GardenRole role) external {
        roles[garden][account][uint8(role)] = false;
    }

    function grantRoles(address garden, address[] calldata accounts, GardenRole[] calldata roleList) external {
        for (uint256 i = 0; i < accounts.length; i++) {
            roles[garden][accounts[i]][uint8(roleList[i])] = true;
        }
    }

    function revokeRoles(address garden, address[] calldata accounts, GardenRole[] calldata roleList) external {
        for (uint256 i = 0; i < accounts.length; i++) {
            roles[garden][accounts[i]][uint8(roleList[i])] = false;
        }
    }

    function setRole(address garden, address account, GardenRole role, bool enabled) external {
        roles[garden][account][uint8(role)] = enabled;
    }

    function isGardenerOf(address garden, address account) external view returns (bool) {
        return roles[garden][account][uint8(GardenRole.Gardener)];
    }

    function isEvaluatorOf(address garden, address account) external view returns (bool) {
        return roles[garden][account][uint8(GardenRole.Evaluator)];
    }

    function isOperatorOf(address garden, address account) external view returns (bool) {
        return roles[garden][account][uint8(GardenRole.Operator)];
    }

    function isOwnerOf(address garden, address account) external view returns (bool) {
        return roles[garden][account][uint8(GardenRole.Owner)];
    }

    function isFunderOf(address garden, address account) external view returns (bool) {
        return roles[garden][account][uint8(GardenRole.Funder)];
    }

    function isCommunityOf(address garden, address account) external view returns (bool) {
        return roles[garden][account][uint8(GardenRole.Community)];
    }

    function setConvictionStrategies(address, address[] calldata) external { }

    function getConvictionStrategies(address) external view returns (address[] memory) {
        return new address[](0);
    }

    function getGardenHatIds(address)
        external
        pure
        returns (uint256, uint256, uint256, uint256, uint256, uint256, uint256, bool)
    {
        return (0, 0, 0, 0, 0, 0, 0, false);
    }
}

contract GardenJoinIntegrationTest is Test {
    GardenAccount public gardenAccountImpl;
    ERC6551Registry public registry;
    AccountGuardian public guardian;
    MockGardenNFTForJoin public gardenNFT;
    MockHatsModuleForJoin public hatsModule;

    address public owner;
    address public joiner;

    // Mock constructor dependencies
    address constant ENTRY_POINT = address(0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789);
    address constant MULTICALL = address(0xcA11bde05977b3631167028862bE2a173976CA11);
    address constant WORK_RESOLVER = address(0x1111);
    address constant ASSESSMENT_RESOLVER = address(0x2222);

    function setUp() public {
        owner = address(this);
        joiner = address(0x1234);

        guardian = new AccountGuardian(owner);
        registry = new ERC6551Registry();
        gardenNFT = new MockGardenNFTForJoin();
        hatsModule = new MockHatsModuleForJoin();

        gardenAccountImpl = new GardenAccount(
            ENTRY_POINT, MULTICALL, address(registry), address(guardian), WORK_RESOLVER, ASSESSMENT_RESOLVER
        );
    }

    function _createGardenAccount(bool openJoining, bool configureHats) internal returns (GardenAccount) {
        if (configureHats) {
            gardenNFT.setHatsModule(address(hatsModule));
        } else {
            gardenNFT.setHatsModule(address(0));
        }

        uint256 tokenId = gardenNFT.mint(owner);
        address tbaAddress =
            registry.createAccount(address(gardenAccountImpl), bytes32(0), block.chainid, address(gardenNFT), tokenId);

        GardenAccount account = GardenAccount(payable(tbaAddress));
        IGardenAccount.InitParams memory params = IGardenAccount.InitParams({
            communityToken: address(0),
            name: "Test Garden",
            slug: "",
            description: "A test garden",
            location: "Location",
            bannerImage: "",
            metadata: "",
            openJoining: openJoining
        });
        account.initialize(params);

        return account;
    }

    function test_joinGarden_succeedsForOpenGarden() public {
        GardenAccount account = _createGardenAccount(true, true);

        vm.prank(joiner);
        account.joinGarden();

        assertTrue(hatsModule.isGardenerOf(address(account), joiner));
    }

    function test_joinGarden_revertsForClosedGarden() public {
        GardenAccount account = _createGardenAccount(false, true);

        vm.prank(joiner);
        vm.expectRevert(InvalidInvite.selector);
        account.joinGarden();
    }

    function test_joinGarden_revertsForAlreadyGardener() public {
        GardenAccount account = _createGardenAccount(true, true);
        hatsModule.setRole(address(account), joiner, IHatsModule.GardenRole.Gardener, true);

        vm.prank(joiner);
        vm.expectRevert(AlreadyGardener.selector);
        account.joinGarden();
    }

    function test_joinGarden_revertsWhenHatsModuleMissing() public {
        GardenAccount account = _createGardenAccount(true, false);

        vm.prank(joiner);
        vm.expectRevert(HatsModuleNotAvailable.selector);
        account.joinGarden();
    }
}
