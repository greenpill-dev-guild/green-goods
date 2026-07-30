// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

import { IERC6551Registry } from "../../../src/interfaces/IERC6551Registry.sol";
import { HatsModule } from "../../../src/modules/Hats.sol";

interface IERC721OwnerOf {
    function ownerOf(uint256 tokenId) external view returns (address);
}

/// @notice Shared current-state rehearsal for a deployed HatsModule UUPS proxy.
abstract contract HatsModuleUpgradeForkHarness is Test {
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

    address private constant TOKENBOUND_REGISTRY = 0x000000006551c19487814612e58FE06813775758;
    bytes32 private constant TOKENBOUND_SALT = 0x6551655165516551655165516551655165516551655165516551655165516551;
    bytes32 private constant IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    uint256 private chainIdUnderTest;
    uint256 private reviewedGardenCount;
    address private hatsModule;
    address private gardenToken;
    address private gardenAccountImpl;

    function _setUpHatsModuleUpgrade(string memory rpcEnvironmentVariable, uint256 expectedChainId) internal {
        uint256 forkBlock = vm.envUint("HATS_MODULE_UPGRADE_FORK_BLOCK_NUMBER");
        reviewedGardenCount = vm.envUint("HATS_MODULE_UPGRADE_GARDEN_COUNT");
        address expectedImplementation = vm.envAddress("HATS_MODULE_UPGRADE_EXPECTED_IMPLEMENTATION");
        assertGt(forkBlock, 0, "reviewed fork block must be positive");
        assertGt(reviewedGardenCount, 0, "reviewed garden count must be positive");

        vm.createSelectFork(vm.envString(rpcEnvironmentVariable), forkBlock);
        assertEq(block.chainid, expectedChainId, "fork uses the wrong chain");
        chainIdUnderTest = expectedChainId;

        string memory deployment =
            vm.readFile(string.concat(vm.projectRoot(), "/deployments/", vm.toString(expectedChainId), "-latest.json"));
        hatsModule = abi.decode(vm.parseJson(deployment, ".hatsModule"), (address));
        gardenToken = abi.decode(vm.parseJson(deployment, ".gardenToken"), (address));
        gardenAccountImpl = abi.decode(vm.parseJson(deployment, ".gardenAccountImpl"), (address));

        assertGt(hatsModule.code.length, 0, "HatsModule proxy must contain code");
        assertGt(gardenToken.code.length, 0, "GardenToken must contain code");
        assertEq(
            _implementation(), expectedImplementation, "fork block does not contain the reviewed current implementation"
        );
        _assertReviewedGardenCountIsExact();
    }

    function _rehearseHatsModuleUpgrade() internal {
        HatsModule proxy = HatsModule(hatsModule);
        ModuleSnapshot memory moduleBefore = _snapshotModule(proxy);
        GardenSnapshot[] memory gardensBefore = _snapshotGardens(proxy);
        address implementationBefore = _implementation();

        assertTrue(moduleBefore.owner != address(0), "live proxy owner must be configured");
        assertGt(implementationBefore.code.length, 0, "current implementation must contain code");

        HatsModule newImplementation = new HatsModule();
        vm.prank(moduleBefore.owner);
        UUPSUpgradeable(hatsModule).upgradeTo(address(newImplementation));

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

    function _assertReviewedGardenCountIsExact() private {
        for (uint256 tokenId = 0; tokenId < reviewedGardenCount; tokenId++) {
            assertTrue(
                IERC721OwnerOf(gardenToken).ownerOf(tokenId) != address(0),
                string.concat("garden token has no owner: ", vm.toString(tokenId))
            );
        }

        (bool nextTokenExists,) = gardenToken.staticcall(abi.encodeCall(IERC721OwnerOf.ownerOf, (reviewedGardenCount)));
        assertFalse(nextTokenExists, "reviewed garden count is stale");
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
        snapshots = new GardenSnapshot[](reviewedGardenCount);
        for (uint256 tokenId = 0; tokenId < reviewedGardenCount; tokenId++) {
            address garden = IERC6551Registry(TOKENBOUND_REGISTRY).account(
                gardenAccountImpl, TOKENBOUND_SALT, chainIdUnderTest, gardenToken, tokenId
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
        return address(uint160(uint256(vm.load(hatsModule, IMPLEMENTATION_SLOT))));
    }
}
