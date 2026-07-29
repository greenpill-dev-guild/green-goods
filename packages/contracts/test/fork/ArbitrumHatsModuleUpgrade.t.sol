// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

import { IERC6551Registry } from "../../src/interfaces/IERC6551Registry.sol";
import { HatsModule } from "../../src/modules/Hats.sol";

interface IERC721OwnerOf {
    function ownerOf(uint256 tokenId) external view returns (address);
}

/// @title ArbitrumHatsModuleUpgradeForkTest
/// @notice Rehearses the HatsModule upgrade against the reviewed live Arbitrum state.
contract ArbitrumHatsModuleUpgradeForkTest is Test {
    struct ModuleSnapshot {
        address owner;
        address hats;
        address gardenToken;
        address karmaGAPModule;
        address hatsModuleFactory;
        address funderEligibilityModule;
        address communityEligibilityModule;
        uint256 communityMinBalance;
        uint256 communityHatId;
        uint256 gardensHatId;
        uint256 protocolGardenersHatId;
        address gardensModule;
    }

    struct GardenSnapshot {
        address garden;
        bytes32 configurationHash;
        bytes32 convictionStrategiesHash;
    }

    uint256 private constant ARBITRUM_CHAIN_ID = 42_161;
    uint256 private constant PINNED_FORK_BLOCK = 488_705_295;
    uint256 private constant REVIEWED_GARDEN_COUNT = 18;
    address private constant REVIEWED_HATS_MODULE = 0x5b943088ecdDBF8E4ae387348A88A654aC5F7266;
    address private constant REVIEWED_OWNER = 0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6;
    address private constant TOKENBOUND_REGISTRY = 0x000000006551c19487814612e58FE06813775758;
    bytes32 private constant TOKENBOUND_SALT = 0x6551655165516551655165516551655165516551655165516551655165516551;
    bytes32 private constant IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    address private gardenToken;
    address private gardenAccountImpl;

    function setUp() public {
        string memory rpcUrl = vm.envString("ARBITRUM_RPC_URL");
        vm.createSelectFork(rpcUrl, PINNED_FORK_BLOCK);

        assertEq(block.chainid, ARBITRUM_CHAIN_ID, "fork must use Arbitrum");

        string memory deployment = vm.readFile(string.concat(vm.projectRoot(), "/deployments/42161-latest.json"));
        address deployedHatsModule = abi.decode(vm.parseJson(deployment, ".hatsModule"), (address));
        gardenToken = abi.decode(vm.parseJson(deployment, ".gardenToken"), (address));
        gardenAccountImpl = abi.decode(vm.parseJson(deployment, ".gardenAccountImpl"), (address));

        assertEq(deployedHatsModule, REVIEWED_HATS_MODULE, "deployment HatsModule must match reviewed proxy");
    }

    function testForkArbitrum_hatsModuleUpgradePreservesLiveState() public {
        HatsModule proxy = HatsModule(REVIEWED_HATS_MODULE);
        ModuleSnapshot memory moduleBefore = _snapshotModule(proxy);
        GardenSnapshot[] memory gardensBefore = _snapshotGardens(proxy);
        address implementationBefore = _implementation();

        assertEq(moduleBefore.owner, REVIEWED_OWNER, "reviewed proxy owner changed");
        assertGt(implementationBefore.code.length, 0, "current implementation must contain code");

        HatsModule newImplementation = new HatsModule();
        vm.prank(moduleBefore.owner);
        UUPSUpgradeable(REVIEWED_HATS_MODULE).upgradeTo(address(newImplementation));

        assertEq(_implementation(), address(newImplementation), "proxy did not use rehearsed implementation");
        assertEq(
            keccak256(abi.encode(_snapshotModule(proxy))),
            keccak256(abi.encode(moduleBefore)),
            "module dependencies changed during upgrade"
        );

        GardenSnapshot[] memory gardensAfter = _snapshotGardens(proxy);
        assertEq(gardensAfter.length, gardensBefore.length, "garden inventory changed during upgrade");
        for (uint256 i = 0; i < gardensBefore.length; i++) {
            assertEq(
                keccak256(abi.encode(gardensAfter[i])),
                keccak256(abi.encode(gardensBefore[i])),
                string.concat("garden configuration changed for token ", vm.toString(i))
            );

            address gardenOwner = IERC721OwnerOf(gardenToken).ownerOf(i);
            assertEq(
                proxy.isStewardOf(gardensAfter[i].garden, gardenOwner),
                proxy.isOperatorOf(gardensAfter[i].garden, gardenOwner),
                string.concat("Steward alias mismatch for token ", vm.toString(i))
            );
        }
    }

    function _snapshotModule(HatsModule proxy) private view returns (ModuleSnapshot memory snapshot) {
        snapshot = ModuleSnapshot({
            owner: proxy.owner(),
            hats: address(proxy.hats()),
            gardenToken: proxy.gardenToken(),
            karmaGAPModule: address(proxy.karmaGAPModule()),
            hatsModuleFactory: address(proxy.hatsModuleFactory()),
            funderEligibilityModule: proxy.funderEligibilityModule(),
            communityEligibilityModule: proxy.communityEligibilityModule(),
            communityMinBalance: proxy.communityMinBalance(),
            communityHatId: proxy.communityHatId(),
            gardensHatId: proxy.gardensHatId(),
            protocolGardenersHatId: proxy.protocolGardenersHatId(),
            gardensModule: proxy.gardensModule()
        });
    }

    function _snapshotGardens(HatsModule proxy) private returns (GardenSnapshot[] memory snapshots) {
        snapshots = new GardenSnapshot[](REVIEWED_GARDEN_COUNT);
        for (uint256 tokenId = 0; tokenId < REVIEWED_GARDEN_COUNT; tokenId++) {
            address tokenOwner = IERC721OwnerOf(gardenToken).ownerOf(tokenId);
            assertTrue(tokenOwner != address(0), string.concat("garden token has no owner: ", vm.toString(tokenId)));

            address garden = IERC6551Registry(TOKENBOUND_REGISTRY).account(
                gardenAccountImpl, TOKENBOUND_SALT, ARBITRUM_CHAIN_ID, gardenToken, tokenId
            );
            assertGt(garden.code.length, 0, string.concat("garden account has no code: ", vm.toString(tokenId)));

            (bool success, bytes memory configuration) =
                address(proxy).staticcall(abi.encodeCall(proxy.getGardenHatIds, (garden)));
            assertTrue(success, string.concat("garden configuration read failed: ", vm.toString(tokenId)));
            assertEq(configuration.length, 32 * 8, "garden configuration response must contain all eight fields");

            snapshots[tokenId] = GardenSnapshot({
                garden: garden,
                configurationHash: keccak256(configuration),
                convictionStrategiesHash: keccak256(abi.encode(proxy.getConvictionStrategies(garden)))
            });
        }
    }

    function _implementation() private view returns (address) {
        return address(uint160(uint256(vm.load(REVIEWED_HATS_MODULE, IMPLEMENTATION_SLOT))));
    }
}
