// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { DeploymentBase } from "../../helpers/DeploymentBase.sol";
import { ERC6551Helper } from "../../helpers/ERC6551Helper.sol";
import { GardensV2Addresses } from "./GardensV2Addresses.sol";

import { GardenToken } from "../../../src/tokens/Garden.sol";
import { ActionRegistry, Capital, Domain } from "../../../src/registries/Action.sol";
import { IHats } from "../../../src/interfaces/IHats.sol";
import { IHatsModule } from "../../../src/interfaces/IHatsModule.sol";
import { IGardensModule } from "../../../src/interfaces/IGardensModule.sol";
import { MockERC20 } from "../../../src/mocks/ERC20.sol";
import { WorkSchema, WorkApprovalSchema, AssessmentSchema } from "../../../src/Schemas.sol";
import { AttestationRequest, AttestationRequestData } from "@eas/IEAS.sol";

/// @notice Minimal EAS interface for ForkTestBase helpers (avoids IEAS naming conflict with DeploymentBase)
interface IEASBase {
    function attest(AttestationRequest calldata request) external payable returns (bytes32);
}

/// @notice Fork-test Hats eligibility/toggle module with explicit allowlisting.
/// @dev Avoids relying on Hats Protocol fallback behavior for no-code module addresses.
contract ForkTestEligibilityToggle {
    error NotOwner();

    struct WearerStatus {
        bool eligible;
        bool standing;
        bool configured;
    }

    address internal immutable owner;
    mapping(uint256 hatId => bool) internal hatConfigured;
    mapping(uint256 hatId => bool) internal hatActive;
    mapping(uint256 hatId => mapping(address wearer => WearerStatus status)) internal wearerStatus;

    constructor(address owner_) {
        owner = owner_;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function setHatActive(uint256 hatId, bool active) external onlyOwner {
        hatConfigured[hatId] = true;
        hatActive[hatId] = active;
    }

    function setWearerStatus(uint256 hatId, address wearer, bool eligible, bool standing) external onlyOwner {
        wearerStatus[hatId][wearer] = WearerStatus({ eligible: eligible, standing: standing, configured: true });
    }

    function getHatStatus(uint256 hatId) external view returns (bool) {
        if (!hatConfigured[hatId]) return true;
        return hatActive[hatId];
    }

    function getWearerStatus(uint256 hatId, address wearer) external view returns (bool eligible, bool standing) {
        WearerStatus memory status = wearerStatus[hatId][wearer];
        if (!status.configured) return (false, false);
        return (status.eligible, status.standing);
    }
}

/// @title ForkTestBase
/// @notice Shared base contract for fork tests. Provides multi-chain fork setup,
/// full-stack deployment against real EAS, and garden lifecycle helpers.
/// @dev Inherits DeploymentBase (production deployment logic) and ERC6551Helper
/// (canonical ERC6551 registry deployment). Test contracts should inherit this
/// and call _tryChainFork() + _deployFullStackOnFork() in setUp or per-test.
abstract contract ForkTestBase is DeploymentBase, ERC6551Helper {
    // ═══════════════════════════════════════════════════════════════════════════
    // ERC721 Receiver (required for GardenToken._safeMint to this contract)
    // ═══════════════════════════════════════════════════════════════════════════

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Constants
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Hats Protocol canonical address (same on all EVM chains)
    address internal constant HATS_PROTOCOL = 0x3bc1A0Ad72417f2d411118085256fC53CBdDd137;

    // ═══════════════════════════════════════════════════════════════════════════
    // Test Actors
    // ═══════════════════════════════════════════════════════════════════════════

    address internal forkOwner;
    address internal forkOperator;
    address internal forkGardener;
    address internal forkEvaluator;
    address internal forkNonMember;

    // ═══════════════════════════════════════════════════════════════════════════
    // Community Token
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Mock ERC20 used as community token for garden minting
    MockERC20 internal communityToken;

    /// @notice Mock ERC20 used as GOODS token for Gardens V2 community staking
    MockERC20 internal goodsToken;

    /// @notice Hats eligibility/toggle module used for fork test hat trees
    ForkTestEligibilityToggle internal hatsEligibilityToggle;

    // ═══════════════════════════════════════════════════════════════════════════
    // Fork State
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Whether a fork was successfully created
    bool internal forkActive;

    // ═══════════════════════════════════════════════════════════════════════════
    // Fork Setup
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Try to create a fork for the given chain
    /// @param chainName One of: "sepolia", "arbitrum", "celo"
    /// @return success True if fork was created and selected
    function _tryChainFork(string memory chainName) internal returns (bool success) {
        string memory rpc = _resolveRpcUrl(chainName);
        if (bytes(rpc).length == 0) return false;

        uint256 forkId = vm.createFork(rpc);
        vm.selectFork(forkId);
        forkActive = true;
        return true;
    }

    /// @notice Resolve RPC URL for a chain name from environment variables
    /// @dev Tries {CHAIN}_RPC_URL first, then {CHAIN}_RPC as fallback
    /// @param chainName The chain identifier (e.g., "sepolia", "arbitrum")
    /// @return rpc The resolved RPC URL, or empty string if not found
    function _resolveRpcUrl(string memory chainName) internal returns (string memory rpc) {
        // Convert chain name to uppercase env var prefix
        string memory envPrefix = _toUpperSnakeCase(chainName);

        // Try {CHAIN}_RPC_URL first
        string memory primaryVar = string.concat(envPrefix, "_RPC_URL");
        try vm.envString(primaryVar) returns (string memory value) {
            if (bytes(value).length > 0) return value;
        } catch { }

        // Fallback: try {CHAIN}_RPC
        string memory fallbackVar = string.concat(envPrefix, "_RPC");
        try vm.envString(fallbackVar) returns (string memory value) {
            if (bytes(value).length > 0) return value;
        } catch { }

        return "";
    }

    /// @notice Convert a chain name to uppercase snake case for env var lookup
    /// @dev "sepolia" → "SEPOLIA", "arbitrum" → "ARBITRUM"
    function _toUpperSnakeCase(string memory input) internal pure returns (string memory) {
        bytes memory b = bytes(input);
        bytes memory result = new bytes(b.length);
        for (uint256 i = 0; i < b.length; i++) {
            // Convert lowercase a-z to uppercase A-Z
            if (b[i] >= 0x61 && b[i] <= 0x7A) {
                result[i] = bytes1(uint8(b[i]) - 32);
            } else {
                result[i] = b[i];
            }
        }
        return string(result);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Full Stack Deployment
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Deploy the full protocol stack on the current fork
    /// @dev Must be called after _tryChainFork() succeeds. Deploys ERC6551 registry,
    /// community token, and the entire protocol stack using production deployment logic.
    /// After deployment, creates a fresh Hats tree so the test contract has admin rights.
    function _deployFullStackOnFork() internal {
        // 1. Set up test actors
        forkOwner = address(this);
        forkOperator = makeAddr("forkOperator");
        forkGardener = makeAddr("forkGardener");
        forkEvaluator = makeAddr("forkEvaluator");
        forkNonMember = makeAddr("forkNonMember");

        // 2. Deploy ERC6551 registry at canonical address (needed BEFORE GardenToken)
        _deployERC6551Registry();

        // 3. Deploy community token
        communityToken = new MockERC20();

        // 4. Deploy full stack using production deployment logic
        // DeploymentBase.deployFullStack() handles everything:
        // - EAS addresses from _getEASForChain()
        // - All CREATE2 deployments
        // - Schema registration
        // - Module wiring
        deployFullStack(address(communityToken), address(this));

        // 4b. Set community token on GardenToken (now a state variable, not per-config)
        gardenToken.setCommunityToken(address(communityToken));

        // 5. Set up a fresh Hats tree for the test environment
        // The on-chain Hats tree has admins we don't control. Creating our own
        // tree lets the HatsModule create garden sub-trees during mintGarden().
        _setupHatsTreeOnFork();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Hats Tree Setup
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Create a fresh Hats tree on the real Hats Protocol and reconfigure HatsModule
    /// @dev On fork chains, the pre-existing hat trees have admins we can't impersonate.
    ///      This creates a new tree owned by the test contract:
    ///      1. mintTopHat → creates tree with address(this) as top hat wearer
    ///      2. createHat → community, gardens, gardeners hats under the top hat
    ///      3. mintHat → grants community hat to HatsModule (admin of gardens hat)
    ///      4. setProtocolHatIds → reconfigures HatsModule to use the new tree
    function _setupHatsTreeOnFork() internal {
        IHats hats = IHats(HATS_PROTOCOL);

        // Use a real module contract so we exercise explicit eligibility/toggle code paths.
        hatsEligibilityToggle = new ForkTestEligibilityToggle(address(this));
        address module = address(hatsEligibilityToggle);

        // 1. Create a new top hat tree owned by this test contract
        uint256 topHat = hats.mintTopHat(address(this), "Fork Test Tree", "");

        // 2. Create Community hat (level 1) under top hat
        uint256 communityHat = hats.createHat(
            topHat,
            "Fork Test Community",
            100, // maxSupply
            module, // eligibility
            module, // toggle
            true, // mutable
            ""
        );

        // 3. Create Gardens hat (level 2) under Community hat
        // This is the parent for per-garden admin hats created by HatsModule
        uint256 gardensHat = hats.createHat(communityHat, "Fork Test Gardens", 100, module, module, true, "");

        // 4. Create Gardeners hat (level 2) under Community hat
        uint256 gardenersHat = hats.createHat(communityHat, "Fork Test Gardeners", 100, module, module, true, "");

        // Configure active hats + explicit wearer eligibility before minting.
        hatsEligibilityToggle.setHatActive(communityHat, true);
        hatsEligibilityToggle.setHatActive(gardensHat, true);
        hatsEligibilityToggle.setHatActive(gardenersHat, true);
        hatsEligibilityToggle.setWearerStatus(communityHat, address(hatsModule), true, true);

        // 5. Mint Community hat to HatsModule — makes it admin of Gardens hat
        // isAdminOfHat(hatsModule, gardensHat) checks: does hatsModule wear communityHat?
        hats.mintHat(communityHat, address(hatsModule));

        // 6. Reconfigure HatsModule to use our new hat IDs
        hatsModule.setProtocolHatIds(communityHat, gardensHat, gardenersHat);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Gardens V2 Configuration
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Configure GardensModule with real Gardens V2 addresses for the current fork chain.
    /// @dev Must be called AFTER _deployFullStackOnFork() and BEFORE _mintTestGarden().
    ///      1. Resolves the RegistryFactory for block.chainid from GardensV2Addresses
    ///      2. Calls gardensModule.setRegistryFactory() if non-zero
    ///      3. Deploys a new MockERC20 as goodsToken
    ///      4. Calls gardensModule.setGoodsToken() with the deployed token
    function _configureRealGardensV2() internal {
        // 1. Set real RegistryFactory if available for this chain
        address factory = GardensV2Addresses.getRegistryFactory(block.chainid);
        if (factory != address(0)) {
            gardensModule.setRegistryFactory(factory);
        }

        // 2. Deploy GOODS token and configure on GardensModule
        goodsToken = new MockERC20();
        gardensModule.setGoodsToken(address(goodsToken));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Garden Lifecycle Helpers
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Mint a test garden with sensible defaults
    /// @param name The garden name
    /// @param domainMask Bitmask of enabled domains (bit 0=Solar, 1=Agro, 2=Edu, 3=Waste)
    /// @return gardenAccount The address of the created garden TBA
    function _mintTestGarden(string memory name, uint8 domainMask) internal returns (address gardenAccount) {
        GardenToken.GardenConfig memory config = GardenToken.GardenConfig({
            name: name,
            slug: "",
            description: "Fork test garden",
            location: "Test Location",
            bannerImage: "ipfs://QmTest",
            metadata: "",
            openJoining: false,
            weightScheme: IGardensModule.WeightScheme.Linear,
            domainMask: domainMask
        });
        return gardenToken.mintGarden(config);
    }

    /// @notice Grant a garden role to a user via HatsModule
    /// @param garden The garden account address
    /// @param user The user to grant the role to
    /// @param role The GardenRole to grant
    function _grantGardenRole(address garden, address user, IHatsModule.GardenRole role) internal {
        hatsModule.grantRole(garden, user, role);
    }

    /// @notice Revoke a garden role from a user via HatsModule
    /// @param garden The garden account address
    /// @param user The user to revoke the role from
    /// @param role The GardenRole to revoke
    function _revokeGardenRole(address garden, address user, IHatsModule.GardenRole role) internal {
        hatsModule.revokeRole(garden, user, role);
    }

    /// @notice Track next expected action UID (mirrors ActionRegistry._nextActionUID)
    uint256 private _expectedNextActionUID;

    /// @notice Register a test action in the ActionRegistry
    /// @return actionUID The UID of the newly registered action
    function _registerTestAction() internal returns (uint256 actionUID) {
        actionUID = _expectedNextActionUID++;

        Capital[] memory capitals = new Capital[](2);
        capitals[0] = Capital.LIVING;
        capitals[1] = Capital.SOCIAL;

        actionRegistry.registerAction(
            block.timestamp,
            block.timestamp + 90 days,
            "Fork Test Action",
            "agro.fork_test",
            "ipfs://QmForkTestInstructions",
            capitals,
            new string[](0),
            Domain.AGRO
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Composite Helpers (garden + roles + action in one call)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Mint a garden, grant operator/gardener/evaluator roles, and register an action
    /// @param name The garden name
    /// @return gardenAccount The garden TBA address
    /// @return actionUID The registered action UID
    function _setupGardenWithRolesAndAction(string memory name)
        internal
        returns (address gardenAccount, uint256 actionUID)
    {
        gardenAccount = _mintTestGarden(name, 0x0F);
        _grantGardenRole(gardenAccount, forkOperator, IHatsModule.GardenRole.Operator);
        _grantGardenRole(gardenAccount, forkGardener, IHatsModule.GardenRole.Gardener);
        _grantGardenRole(gardenAccount, forkEvaluator, IHatsModule.GardenRole.Evaluator);
        actionUID = _registerTestAction();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // EAS Attestation Helpers
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Submit a work attestation as a specific attester
    /// @param attester The address submitting the work (pranked)
    /// @param gardenAccount The garden receiving the attestation
    /// @param actionUID The action UID for the work
    /// @return attestationUID The UID of the created attestation
    function _submitWorkAttestation(
        address attester,
        address gardenAccount,
        uint256 actionUID
    )
        internal
        returns (bytes32 attestationUID)
    {
        string[] memory media = new string[](1);
        media[0] = "ipfs://QmForkTestPhoto";

        WorkSchema memory work = WorkSchema({
            actionUID: actionUID,
            title: "Fork Test Work",
            feedback: "Completed task",
            metadata: "ipfs://QmForkTestWorkMeta",
            media: media
        });

        (address eas,) = _getEASForChain(block.chainid);

        AttestationRequest memory request = AttestationRequest({
            schema: workSchemaUID,
            data: AttestationRequestData({
                recipient: gardenAccount,
                expirationTime: 0,
                revocable: false,
                refUID: bytes32(0),
                data: abi.encode(work),
                value: 0
            })
        });

        vm.prank(attester);
        attestationUID = IEASBase(eas).attest(request);
    }

    /// @notice Submit a work approval attestation as a specific approver
    /// @param approver The address approving the work (pranked)
    /// @param gardenAccount The garden receiving the approval
    /// @param actionUID The action UID being approved
    /// @param workAttUID The work attestation UID being approved
    /// @return approvalUID The UID of the created approval attestation
    function _submitWorkApproval(
        address approver,
        address gardenAccount,
        uint256 actionUID,
        bytes32 workAttUID
    )
        internal
        returns (bytes32 approvalUID)
    {
        WorkApprovalSchema memory approval = WorkApprovalSchema({
            actionUID: actionUID,
            workUID: workAttUID,
            approved: true,
            feedback: "Verified on-site",
            confidence: 2,
            verificationMethod: 1,
            reviewNotesCID: ""
        });

        (address eas,) = _getEASForChain(block.chainid);

        AttestationRequest memory request = AttestationRequest({
            schema: workApprovalSchemaUID,
            data: AttestationRequestData({
                recipient: gardenAccount,
                expirationTime: 0,
                revocable: false,
                refUID: workAttUID,
                data: abi.encode(approval),
                value: 0
            })
        });

        vm.prank(approver);
        approvalUID = IEASBase(eas).attest(request);
    }

    /// @notice Submit an assessment attestation as a specific evaluator
    /// @param evaluator The address submitting the assessment (pranked)
    /// @param gardenAccount The garden receiving the assessment
    /// @param domain The assessment domain (0=SOLAR, 1=AGRO, 2=EDU, 3=WASTE)
    /// @return assessmentUID The UID of the created assessment attestation
    function _submitAssessment(
        address evaluator,
        address gardenAccount,
        uint8 domain
    )
        internal
        returns (bytes32 assessmentUID)
    {
        AssessmentSchema memory assessment = AssessmentSchema({
            title: "Fork Test Assessment",
            description: "Environmental impact assessment",
            assessmentConfigCID: "ipfs://QmForkTestConfig",
            domain: domain,
            startDate: block.timestamp,
            endDate: block.timestamp + 30 days,
            location: "Fork Test Site"
        });

        (address eas,) = _getEASForChain(block.chainid);

        AttestationRequest memory request = AttestationRequest({
            schema: assessmentSchemaUID,
            data: AttestationRequestData({
                recipient: gardenAccount,
                expirationTime: 0,
                revocable: false,
                refUID: bytes32(0),
                data: abi.encode(assessment),
                value: 0
            })
        });

        vm.prank(evaluator);
        assessmentUID = IEASBase(eas).attest(request);
    }
}
