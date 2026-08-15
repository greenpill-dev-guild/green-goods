// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;
/* solhint-disable no-console */

import { Script } from "forge-std/Script.sol";
import { console } from "forge-std/console.sol";
import { Create2 } from "@openzeppelin/contracts/utils/Create2.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { CommitmentPoolingClaimsLib } from "../src/lib/CommitmentPooling/ClaimsLib.sol";
import { CommitmentPoolingConfirmLib } from "../src/lib/CommitmentPooling/ConfirmLib.sol";
import { CommitmentPoolingCreationLib } from "../src/lib/CommitmentPooling/CreationLib.sol";
import { CommitmentPoolingCyclesLib } from "../src/lib/CommitmentPooling/CyclesLib.sol";
import { CommitmentPoolingExchangeLib } from "../src/lib/CommitmentPooling/ExchangeLib.sol";
import { CommitmentPoolingPoolsLib } from "../src/lib/CommitmentPooling/PoolsLib.sol";
import { CommitmentPoolingProofLib } from "../src/lib/CommitmentPooling/ProofLib.sol";
import { CommitmentPoolingRecognitionLib } from "../src/lib/CommitmentPooling/RecognitionLib.sol";
import { CommitmentPoolingRosterLib } from "../src/lib/CommitmentPooling/RosterLib.sol";
import { CommitmentPoolingSeriesLib } from "../src/lib/CommitmentPooling/SeriesLib.sol";
import { CommitmentPoolingSyncLib } from "../src/lib/CommitmentPooling/SyncLib.sol";
import { CommitmentPoolingTerminalLib } from "../src/lib/CommitmentPooling/TerminalLib.sol";
import { CommitmentPoolingTermsLib } from "../src/lib/CommitmentPooling/TermsLib.sol";
import { CommitmentPoolingViewsLib } from "../src/lib/CommitmentPooling/ViewsLib.sol";
import { SettlementAcknowledgmentLib } from "../src/lib/Settlement/AcknowledgmentLib.sol";
import { SettlementCommandLib } from "../src/lib/Settlement/CommandLib.sol";
import { SettlementConfigurationLib } from "../src/lib/Settlement/ConfigurationLib.sol";
import { SettlementFundingLib } from "../src/lib/Settlement/FundingLib.sol";
import { SettlementLifecycleLib } from "../src/lib/Settlement/LifecycleLib.sol";
import { SettlementLoanLib } from "../src/lib/Settlement/LoanLib.sol";
import { SettlementPlanLib } from "../src/lib/Settlement/PlanLib.sol";
import { CeloSettlementExecutor } from "../src/modules/CeloSettlementExecutor.sol";
import { CommitmentPoolingModule } from "../src/modules/CommitmentPooling.sol";
import { SettlementModule } from "../src/modules/SettlementModule.sol";
import { CommitmentRegistry } from "../src/registries/Commitment.sol";
import { CreditRegistry } from "../src/registries/Credit.sol";

interface IAssessmentV3ReleaseConfiguration {
    function setAssessmentV3SchemaUID(bytes32 uid) external;
}

/// @title DeployCommitmentRelease
/// @notice Selective deterministic deploy entrypoint for the Phase-A-reviewed release manifest.
/// @dev The Bun wrapper supplies the exact predicted library map to this script compilation. Every
///      target is deployed through the same EIP-2470 singleton factory and stays paused. The
///      script writes a stage side artifact only; the Bun wrapper owns atomic canonical promotion.
contract DeployCommitmentRelease is Script {
    error Create2DeploymentFailed(string label);
    error DeploymentAddressMismatch(string label, address expected, address actual);
    error InvalidStage(string stage);
    error InvalidReleaseStep(string label);
    error MissingDependency(string name);
    error SenderOwnerMismatch(address sender, address owner);

    address private factory;
    address private owner;
    string private baseSalt;
    string private selectedStep;
    uint256 private executedSteps;

    function run() public {
        factory = vm.envAddress("RELEASE_CREATE2_FACTORY");
        owner = vm.envAddress("RELEASE_OWNER");
        address sender = vm.envAddress("RELEASE_SENDER");
        baseSalt = vm.envString("RELEASE_BASE_SALT");
        selectedStep = vm.envString("RELEASE_STEP_LABEL");
        if (factory == address(0)) revert MissingDependency("RELEASE_CREATE2_FACTORY");
        if (owner == address(0)) revert MissingDependency("RELEASE_OWNER");
        if (sender != owner) revert SenderOwnerMismatch(sender, owner);

        string memory stage = vm.envString("RELEASE_STAGE");
        console.log("Release stage:", stage);
        console.log("CREATE2 factory:", factory);
        console.log("Base salt:", baseSalt);
        console.log("Sender/initial owner:", sender);

        vm.startBroadcast(sender);
        if (_same(stage, "pooling")) {
            _deployPooling();
        } else if (_same(stage, "settlement-module")) {
            _deploySettlementModule();
        } else if (_same(stage, "credit-registry")) {
            _deployCreditRegistry();
        } else if (_same(stage, "arbitrum-through-settlement")) {
            _deployPooling();
            _deploySettlementModule();
        } else if (_same(stage, "arbitrum-through-credit")) {
            _deployPooling();
            _deploySettlementModule();
            _deployCreditRegistry();
        } else if (_same(stage, "settlement-executor")) {
            _deploySettlementExecutor();
        } else {
            revert InvalidStage(stage);
        }
        vm.stopBroadcast();
        if (bytes(selectedStep).length != 0 && executedSteps != 1) revert InvalidReleaseStep(selectedStep);
    }

    function _deployPooling() private {
        _deploy(type(CommitmentPoolingClaimsLib).creationCode, "library:CommitmentPoolingClaimsLib");
        _deploy(type(CommitmentPoolingConfirmLib).creationCode, "library:CommitmentPoolingConfirmLib");
        _deploy(type(CommitmentPoolingCreationLib).creationCode, "library:CommitmentPoolingCreationLib");
        _deploy(type(CommitmentPoolingCyclesLib).creationCode, "library:CommitmentPoolingCyclesLib");
        _deploy(type(CommitmentPoolingExchangeLib).creationCode, "library:CommitmentPoolingExchangeLib");
        _deploy(type(CommitmentPoolingPoolsLib).creationCode, "library:CommitmentPoolingPoolsLib");
        _deploy(type(CommitmentPoolingProofLib).creationCode, "library:CommitmentPoolingProofLib");
        _deploy(type(CommitmentPoolingRecognitionLib).creationCode, "library:CommitmentPoolingRecognitionLib");
        _deploy(type(CommitmentPoolingRosterLib).creationCode, "library:CommitmentPoolingRosterLib");
        _deploy(type(CommitmentPoolingSeriesLib).creationCode, "library:CommitmentPoolingSeriesLib");
        _deploy(type(CommitmentPoolingSyncLib).creationCode, "library:CommitmentPoolingSyncLib");
        _deploy(type(CommitmentPoolingTerminalLib).creationCode, "library:CommitmentPoolingTerminalLib");
        _deploy(type(CommitmentPoolingTermsLib).creationCode, "library:CommitmentPoolingTermsLib");
        _deploy(type(CommitmentPoolingViewsLib).creationCode, "library:CommitmentPoolingViewsLib");

        address rootGarden = vm.envAddress("RELEASE_PROTOCOL_GARDEN");
        _requireAddress(rootGarden, "RELEASE_PROTOCOL_GARDEN");
        address moduleImplementation =
            _deploy(type(CommitmentPoolingModule).creationCode, "implementation:CommitmentPoolingModule");
        address moduleProxy = _deploy(
            abi.encodePacked(
                type(ERC1967Proxy).creationCode,
                abi.encode(
                    moduleImplementation,
                    abi.encodeWithSelector(CommitmentPoolingModule.initialize.selector, owner, rootGarden)
                )
            ),
            "proxy:CommitmentPoolingModule"
        );

        address registryImplementation = _deploy(type(CommitmentRegistry).creationCode, "implementation:CommitmentRegistry");
        address registryProxy = _deploy(
            abi.encodePacked(
                type(ERC1967Proxy).creationCode,
                abi.encode(
                    registryImplementation,
                    abi.encodeWithSelector(CommitmentRegistry.initialize.selector, owner, moduleProxy)
                )
            ),
            "proxy:CommitmentRegistry"
        );
        _wirePooling(CommitmentPoolingModule(moduleProxy), registryProxy);
        _writePooling(moduleProxy, moduleImplementation, registryProxy, registryImplementation);
    }

    function _wirePooling(CommitmentPoolingModule module, address registry) private {
        string memory json = _deploymentJson();
        if (_execute("set garden token")) {
            module.setGardenToken(_jsonAddress(json, ".gardenToken", "gardenToken"));
        }
        if (_execute("set Hats module")) {
            module.setHatsModule(_jsonAddress(json, ".hatsModule", "hatsModule"));
        }
        if (_execute("set action registry")) {
            module.setActionRegistry(_jsonAddress(json, ".actionRegistry", "actionRegistry"));
        }
        if (_execute("set commitment registry")) module.setCommitmentRegistry(registry);
        if (_execute("set work-approval resolver")) {
            module.setWorkApprovalResolver(_jsonAddress(json, ".workApprovalResolver", "workApprovalResolver"));
        }
        if (_execute("set EAS")) module.setEAS(_jsonAddress(json, ".eas.address", "eas.address"));
        if (_execute("set four pairwise-distinct schema UIDs")) {
            module.setSchemaUIDs(
                _jsonBytes32(json, ".schemas.workSchemaUID", "schemas.workSchemaUID"),
                _jsonBytes32(json, ".schemas.workApprovalSchemaUID", "schemas.workApprovalSchemaUID"),
                _jsonBytes32(json, ".schemas.assessmentSchemaUID", "schemas.assessmentSchemaUID"),
                vm.envBytes32("RELEASE_ASSESSMENT_V3_SCHEMA_UID")
            );
        }
        if (_execute("set Assessment v3 schema UID")) {
            IAssessmentV3ReleaseConfiguration(_jsonAddress(json, ".assessmentResolver", "assessmentResolver"))
                .setAssessmentV3SchemaUID(vm.envBytes32("RELEASE_ASSESSMENT_V3_SCHEMA_UID"));
        }
        console.log("Pooling dependencies wired; module remains paused");
    }

    function _deploySettlementModule() private {
        _deploy(type(SettlementCommandLib).creationCode, "library:SettlementCommandLib");
        _deploy(type(SettlementConfigurationLib).creationCode, "library:SettlementConfigurationLib");
        _deploy(type(SettlementLifecycleLib).creationCode, "library:SettlementLifecycleLib");
        _deploy(type(SettlementLoanLib).creationCode, "library:SettlementLoanLib");
        _deploy(type(SettlementPlanLib).creationCode, "library:SettlementPlanLib");
        _deploy(type(SettlementFundingLib).creationCode, "library:SettlementFundingLib");
        _deploy(type(SettlementAcknowledgmentLib).creationCode, "library:SettlementAcknowledgmentLib");

        address router = vm.envAddress("RELEASE_ROUTER");
        uint64 localSelector = uint64(vm.envUint("RELEASE_LOCAL_SELECTOR"));
        uint64 remoteChainId = uint64(vm.envUint("RELEASE_REMOTE_CHAIN_ID"));
        address hatsModule = vm.envAddress("RELEASE_HATS_MODULE");
        address poolingModule = vm.envAddress("RELEASE_POOLING_MODULE");
        address protocolGarden = vm.envAddress("RELEASE_PROTOCOL_GARDEN");
        address gDollar = vm.envAddress("RELEASE_G_DOLLAR");
        _requireAddress(router, "RELEASE_ROUTER");
        _requireAddress(hatsModule, "RELEASE_HATS_MODULE");
        _requireCode(poolingModule, "RELEASE_POOLING_MODULE");
        _requireAddress(protocolGarden, "RELEASE_PROTOCOL_GARDEN");
        _requireAddress(gDollar, "RELEASE_G_DOLLAR");

        address implementation = _deploy(
            abi.encodePacked(type(SettlementModule).creationCode, abi.encode(router, localSelector, remoteChainId)),
            "implementation:SettlementModule"
        );
        address proxy = _deploy(
            abi.encodePacked(
                type(ERC1967Proxy).creationCode,
                abi.encode(
                    implementation,
                    abi.encodeWithSelector(
                        SettlementModule.initialize.selector, owner, hatsModule, poolingModule, protocolGarden, gDollar
                    )
                )
            ),
            "proxy:SettlementModule"
        );
        _writePair("settlementModule", proxy, "settlementModuleImpl", implementation);
    }

    function _deployCreditRegistry() private {
        address hatsModule = vm.envAddress("RELEASE_HATS_MODULE");
        address poolingModule = vm.envAddress("RELEASE_POOLING_MODULE");
        address settlementModule = vm.envAddress("RELEASE_SETTLEMENT_MODULE");
        _requireAddress(hatsModule, "RELEASE_HATS_MODULE");
        _requireCode(poolingModule, "RELEASE_POOLING_MODULE");
        _requireCode(settlementModule, "RELEASE_SETTLEMENT_MODULE");

        address implementation = _deploy(type(CreditRegistry).creationCode, "implementation:CreditRegistry");
        address proxy = _deploy(
            abi.encodePacked(
                type(ERC1967Proxy).creationCode,
                abi.encode(
                    implementation,
                    abi.encodeWithSelector(
                        CreditRegistry.initialize.selector, owner, hatsModule, poolingModule, settlementModule
                    )
                )
            ),
            "proxy:CreditRegistry"
        );
        if (_execute("bind SettlementModule to CreditRegistry")) {
            SettlementModule(payable(settlementModule)).setCreditRegistry(proxy);
        }
        _writePair("creditRegistry", proxy, "creditRegistryImpl", implementation);
    }

    function _deploySettlementExecutor() private {
        address router = vm.envAddress("RELEASE_ROUTER");
        address gDollar = vm.envAddress("RELEASE_G_DOLLAR");
        uint64 localSelector = uint64(vm.envUint("RELEASE_LOCAL_SELECTOR"));
        uint64 remoteChainId = uint64(vm.envUint("RELEASE_REMOTE_CHAIN_ID"));
        uint64 sourceSelector = uint64(vm.envUint("RELEASE_SOURCE_SELECTOR"));
        address sourceSettlement = vm.envAddress("RELEASE_SETTLEMENT_MODULE");
        uint8 version = uint8(vm.envUint("RELEASE_PROTOCOL_VERSION"));
        _requireAddress(router, "RELEASE_ROUTER");
        _requireAddress(gDollar, "RELEASE_G_DOLLAR");
        _requireAddress(sourceSettlement, "RELEASE_SETTLEMENT_MODULE");

        address implementation = _deploy(
            abi.encodePacked(
                type(CeloSettlementExecutor).creationCode, abi.encode(router, gDollar, localSelector, remoteChainId)
            ),
            "implementation:CeloSettlementExecutor"
        );
        address proxy = _deploy(
            abi.encodePacked(
                type(ERC1967Proxy).creationCode,
                abi.encode(
                    implementation,
                    abi.encodeWithSelector(
                        CeloSettlementExecutor.initialize.selector, owner, sourceSelector, sourceSettlement, version
                    )
                )
            ),
            "proxy:CeloSettlementExecutor"
        );
        _writePair("celoSettlementExecutor", proxy, "celoSettlementExecutorImpl", implementation);
    }

    function _deploy(bytes memory initCode, string memory label) private returns (address deployed) {
        bytes32 salt = _salt(label);
        address predicted = Create2.computeAddress(salt, keccak256(initCode), factory);
        console.log("Target:", label);
        console.log("  salt:");
        console.logBytes32(salt);
        console.log("  predicted:", predicted);
        if (!_execute(label)) return predicted;
        if (predicted.code.length > 0) {
            console.log("  replay: code already present");
            return predicted;
        }
        // The EIP-2470 singleton factory accepts salt || initCode and returns the raw address.
        // solhint-disable-next-line avoid-low-level-calls
        (bool success, bytes memory result) = factory.call(abi.encodePacked(salt, initCode));
        if (!success) revert Create2DeploymentFailed(label);
        // solhint-disable-next-line no-inline-assembly
        assembly {
            deployed := mload(add(result, 20))
        }
        if (deployed != predicted) revert DeploymentAddressMismatch(label, predicted, deployed);
    }

    function _salt(string memory label) private view returns (bytes32) {
        return keccak256(bytes(string.concat(baseSalt, ":", label)));
    }

    function _deploymentJson() private view returns (string memory) {
        string memory path = string.concat(vm.projectRoot(), "/deployments/", vm.toString(block.chainid), "-latest.json");
        return vm.readFile(path);
    }

    function _jsonAddress(
        string memory json,
        string memory jsonPath,
        string memory name
    )
        private
        pure
        returns (address value)
    {
        value = abi.decode(vm.parseJson(json, jsonPath), (address));
        _requireAddress(value, name);
    }

    function _jsonBytes32(
        string memory json,
        string memory jsonPath,
        string memory name
    )
        private
        pure
        returns (bytes32 value)
    {
        value = abi.decode(vm.parseJson(json, jsonPath), (bytes32));
        if (value == bytes32(0)) revert MissingDependency(name);
    }

    function _writePooling(address module, address moduleImpl, address registry, address registryImpl) private {
        string memory objectKey = "release";
        vm.serializeAddress(objectKey, "commitmentPoolingModule", module);
        vm.serializeAddress(objectKey, "commitmentPoolingModuleImpl", moduleImpl);
        vm.serializeAddress(objectKey, "commitmentRegistry", registry);
        string memory json = vm.serializeAddress(objectKey, "commitmentRegistryImpl", registryImpl);
        vm.writeJson(json, vm.envString("RELEASE_OUTPUT_PATH"));
    }

    function _writePair(string memory proxyKey, address proxy, string memory implKey, address implementation) private {
        string memory objectKey = "release";
        vm.serializeAddress(objectKey, proxyKey, proxy);
        string memory json = vm.serializeAddress(objectKey, implKey, implementation);
        vm.writeJson(json, vm.envString("RELEASE_OUTPUT_PATH"));
    }

    function _requireAddress(address value, string memory name) private pure {
        if (value == address(0)) revert MissingDependency(name);
    }

    function _requireCode(address value, string memory name) private view {
        if (value == address(0) || value.code.length == 0) revert MissingDependency(name);
    }

    function _same(string memory left, string memory right) private pure returns (bool) {
        return keccak256(bytes(left)) == keccak256(bytes(right));
    }

    function _execute(string memory label) private returns (bool) {
        if (bytes(selectedStep).length != 0 && !_same(selectedStep, label)) return false;
        executedSteps += 1;
        return true;
    }
}
