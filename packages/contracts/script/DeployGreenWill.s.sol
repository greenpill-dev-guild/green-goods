// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { Script, console2 } from "forge-std/Script.sol";

import { Deployment } from "../src/registries/Deployment.sol";
import { GreenWill } from "../src/registries/GreenWill.sol";

/// @title DeployGreenWill
/// @notice Deploy and configure the initial three-badge GreenWill proxy.
/// @dev Invoked by `bun script/deploy.ts greenwill --network <chain> --broadcast`.
///      Writes deployments/{chainId}-greenwill.json when GREENWILL_WRITE_ARTIFACT=true.
contract DeployGreenWill is Script {
    error MissingGenesisHatId();
    error ZeroAddress(string field);
    error ZeroBytes32(string field);

    bytes32 internal constant GENESIS_BADGE = keccak256("GENESIS");
    bytes32 internal constant FIRST_WORK_BADGE = keccak256("FIRST_WORK");
    bytes32 internal constant FIRST_SUPPORT_BADGE = keccak256("FIRST_SUPPORT");

    struct GreenWillConfig {
        address owner;
        address deploymentRegistry;
        address hats;
        address eas;
        address octantResolver;
        address genesisLock;
        address firstWorkLock;
        address firstSupportLock;
        bytes32 workSchemaUID;
        uint256 genesisHatId;
        string genesisMetadataURI;
        string firstWorkMetadataURI;
        string firstSupportMetadataURI;
        bool writeArtifact;
    }

    function run() external {
        GreenWillConfig memory config = _loadConfig();

        vm.startBroadcast();

        address deployer = msg.sender;
        GreenWill implementation = new GreenWill();
        GreenWill greenWill = GreenWill(
            address(
                new ERC1967Proxy(address(implementation), abi.encodeWithSelector(GreenWill.initialize.selector, deployer))
            )
        );

        _configureBadges(greenWill, config);
        Deployment(config.deploymentRegistry).updateGreenWill(address(greenWill));
        greenWill.transferOwnership(config.owner);

        vm.stopBroadcast();

        _printResult(config, deployer, address(implementation), address(greenWill));

        if (config.writeArtifact) {
            _saveResult(config, deployer, address(implementation), address(greenWill));
        }
    }

    function _configureBadges(GreenWill greenWill, GreenWillConfig memory config) internal {
        greenWill.configureBadgeClass(
            GENESIS_BADGE, "genesis", config.genesisMetadataURI, config.hats, address(0), config.genesisLock, true, true
        );
        greenWill.configureBadgeRule(GENESIS_BADGE, GreenWill.BadgeRule.Hat, bytes32(config.genesisHatId), 0);

        greenWill.configureBadgeClass(
            FIRST_WORK_BADGE,
            "first-work",
            config.firstWorkMetadataURI,
            config.eas,
            address(0),
            config.firstWorkLock,
            true,
            true
        );
        greenWill.configureBadgeRule(FIRST_WORK_BADGE, GreenWill.BadgeRule.WorkAttestation, config.workSchemaUID, 0);

        greenWill.configureBadgeClass(
            FIRST_SUPPORT_BADGE,
            "first-support",
            config.firstSupportMetadataURI,
            config.octantResolver,
            address(0),
            config.firstSupportLock,
            true,
            true
        );
        greenWill.configureBadgeRule(FIRST_SUPPORT_BADGE, GreenWill.BadgeRule.VaultShares, bytes32(0), 0);
    }

    function _loadConfig() internal view returns (GreenWillConfig memory config) {
        config.owner = _requiredAddress("GREENWILL_OWNER");
        config.deploymentRegistry = _requiredAddress("GREENWILL_DEPLOYMENT_REGISTRY");
        config.hats = _requiredAddress("GREENWILL_HATS");
        config.eas = _requiredAddress("GREENWILL_EAS");
        config.octantResolver = _requiredAddress("GREENWILL_OCTANT_RESOLVER");
        config.genesisLock = _requiredAddress("GREENWILL_GENESIS_LOCK");
        config.firstWorkLock = _requiredAddress("GREENWILL_FIRST_WORK_LOCK");
        config.firstSupportLock = _requiredAddress("GREENWILL_FIRST_SUPPORT_LOCK");
        config.workSchemaUID = _requiredBytes32("GREENWILL_WORK_SCHEMA_UID");
        config.genesisHatId = vm.envUint("GREENWILL_GENESIS_HAT_ID");
        if (config.genesisHatId == 0) revert MissingGenesisHatId();
        config.genesisMetadataURI = vm.envString("GREENWILL_GENESIS_METADATA_URI");
        config.firstWorkMetadataURI = vm.envString("GREENWILL_FIRST_WORK_METADATA_URI");
        config.firstSupportMetadataURI = vm.envString("GREENWILL_FIRST_SUPPORT_METADATA_URI");
        config.writeArtifact = vm.envBool("GREENWILL_WRITE_ARTIFACT");
    }

    function _requiredAddress(string memory envKey) internal view returns (address value) {
        value = vm.envAddress(envKey);
        if (value == address(0)) revert ZeroAddress(envKey);
    }

    function _requiredBytes32(string memory envKey) internal view returns (bytes32 value) {
        value = vm.envBytes32(envKey);
        if (value == bytes32(0)) revert ZeroBytes32(envKey);
    }

    function _printResult(
        GreenWillConfig memory config,
        address deployer,
        address implementation,
        address proxy
    )
        internal
        view
    {
        console2.log("\n=== GreenWill Deployment Plan ===");
        console2.log("Deployer:");
        console2.logAddress(deployer);
        console2.log("Final owner:");
        console2.logAddress(config.owner);
        console2.log("Implementation:");
        console2.logAddress(implementation);
        console2.log("Proxy:");
        console2.logAddress(proxy);
        console2.log("DeploymentRegistry:");
        console2.logAddress(config.deploymentRegistry);
        console2.log("Genesis hat ID:");
        console2.logUint(config.genesisHatId);
        console2.log("Genesis lock:");
        console2.logAddress(config.genesisLock);
        console2.log("First Work lock:");
        console2.logAddress(config.firstWorkLock);
        console2.log("First Support lock:");
        console2.logAddress(config.firstSupportLock);
    }

    function _saveResult(GreenWillConfig memory config, address deployer, address implementation, address proxy) internal {
        string memory obj = "greenWill";
        vm.serializeAddress(obj, "greenWill", proxy);
        vm.serializeAddress(obj, "greenWillImplementation", implementation);
        vm.serializeAddress(obj, "owner", config.owner);
        vm.serializeAddress(obj, "deployer", deployer);
        vm.serializeAddress(obj, "deploymentRegistry", config.deploymentRegistry);
        vm.serializeString(obj, "genesisBadgeId", vm.toString(GENESIS_BADGE));
        vm.serializeAddress(obj, "genesisLock", config.genesisLock);
        vm.serializeString(obj, "genesisCriteria", vm.toString(bytes32(config.genesisHatId)));
        vm.serializeString(obj, "genesisMetadataURI", config.genesisMetadataURI);
        vm.serializeString(obj, "firstWorkBadgeId", vm.toString(FIRST_WORK_BADGE));
        vm.serializeAddress(obj, "firstWorkLock", config.firstWorkLock);
        vm.serializeString(obj, "firstWorkCriteria", vm.toString(config.workSchemaUID));
        vm.serializeString(obj, "firstWorkMetadataURI", config.firstWorkMetadataURI);
        vm.serializeString(obj, "firstSupportBadgeId", vm.toString(FIRST_SUPPORT_BADGE));
        vm.serializeAddress(obj, "firstSupportLock", config.firstSupportLock);
        vm.serializeString(obj, "firstSupportCriteria", vm.toString(bytes32(0)));
        string memory finalJson = vm.serializeString(obj, "firstSupportMetadataURI", config.firstSupportMetadataURI);

        string memory outPath =
            string.concat(vm.projectRoot(), "/deployments/", vm.toString(block.chainid), "-greenwill.json");
        vm.writeJson(finalJson, outPath);
        console2.log("Saved to:", outPath);
    }
}
