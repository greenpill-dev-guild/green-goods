// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { AccountV3Upgradable } from "@tokenbound/AccountV3Upgradable.sol";
import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import { AttestationRequest, AttestationRequestData } from "@eas/IEAS.sol";

import { KarmaLib } from "../lib/Karma.sol";
import { StringUtils } from "../lib/StringUtils.sol";
import { IGap } from "../interfaces/IKarma.sol";
import { IGardenAccessControl } from "../interfaces/IGardenAccessControl.sol";
import { IGardenAccount } from "../interfaces/IGardenAccount.sol";

error NotGardenOwner();
error NotGardenOperator();
error NotAuthorizedCaller();
error InvalidInvite();
error AlreadyGardener();
error TooManyGardeners();
error TooManyOperators();
error GAPProjectNotInitialized();
error GAPNotSupportedOnChain();
error GAPImpactCreationFailed();
error GAPMilestoneCreationFailed();

/// @dev Maximum number of gardeners allowed during initialization (prevents gas exhaustion)
uint256 constant MAX_INIT_GARDENERS = 50;

/// @dev Maximum number of operators allowed during initialization (prevents gas exhaustion)
uint256 constant MAX_INIT_OPERATORS = 20;

/// @title GardenAccount Contract
/// @notice Manages gardeners and operators for a Garden, and supports community token management.
/// @dev Inherits from AccountV3Upgradable and uses OpenZeppelin's Initializable for upgradability.
/// @dev Implements IGardenAccessControl for role verification by resolvers and modules.
contract GardenAccount is AccountV3Upgradable, Initializable, IGardenAccessControl, IGardenAccount {
    /// @notice Emitted when the garden name is updated.
    /// @param updater The address of the entity that updated the name.
    /// @param newName The new name of the garden.
    event NameUpdated(address indexed updater, string newName);

    /// @notice Emitted when the garden description is updated.
    /// @param updater The address of the entity that updated the description.
    /// @param newDescription The new description of the garden.
    event DescriptionUpdated(address indexed updater, string newDescription);

    /// @notice Emitted when the garden metadata is updated.
    /// @param updater The address of the entity that updated the metadata.
    /// @param newMetadata The new IPFS CID containing metadata JSON.
    event MetadataUpdated(address indexed updater, string newMetadata);

    /// @notice Emitted when the community token is updated.
    /// @param updater The address of the entity that updated the token.
    /// @param newToken The new community token address.
    event CommunityTokenUpdated(address indexed updater, address newToken);

    /// @notice Emitted when the garden location is updated.
    /// @param updater The address of the entity that updated the location.
    /// @param newLocation The new location of the garden.
    event LocationUpdated(address indexed updater, string newLocation);

    /// @notice Emitted when the garden banner image is updated.
    /// @param updater The address of the entity that updated the banner.
    /// @param newBannerImage The new banner image CID.
    event BannerImageUpdated(address indexed updater, string newBannerImage);

    /// @notice Emitted when a new gardener is added.
    /// @param updater The address of the entity that added the gardener.
    /// @param gardener The address of the added gardener.
    event GardenerAdded(address indexed updater, address indexed gardener);

    /// @notice Emitted when a gardener is removed.
    /// @param updater The address of the entity that removed the gardener.
    /// @param gardener The address of the removed gardener.
    event GardenerRemoved(address indexed updater, address indexed gardener);

    /// @notice Emitted when a new garden operator is added.
    /// @param updater The address of the entity that added the operator.
    /// @param operator The address of the added garden operator.
    event GardenOperatorAdded(address indexed updater, address indexed operator);

    /// @notice Emitted when a garden operator is removed.
    /// @param updater The address of the entity that removed the operator.
    /// @param operator The address of the removed garden operator.
    event GardenOperatorRemoved(address indexed updater, address indexed operator);

    /// @notice Emitted when open joining status is updated.
    /// @param updater The address of the entity that updated the setting.
    /// @param openJoining The new open joining status.
    event OpenJoiningUpdated(address indexed updater, bool openJoining);

    /// @notice Emitted when a Karma GAP project is created for this garden.
    /// @param projectUID The Karma GAP project attestation UID.
    /// @param gardenAddress The address of this garden account.
    /// @param projectName The name of the GAP project (garden name).
    event GAPProjectCreated(bytes32 indexed projectUID, address indexed gardenAddress, string projectName);

    /// @notice The community token associated with this garden.
    address public communityToken;

    /// @notice The name of the garden.
    string public name;

    /// @notice The description of the garden.
    string public description;

    /// @notice The location of the garden.
    string public location;

    /// @notice The CID of the banner image of the garden.
    string public bannerImage;

    /// @notice The IPFS CID containing additional garden metadata as JSON
    string public metadata;

    /// @notice Mapping of gardener addresses to their status.
    mapping(address gardener => bool isGardener) public gardeners;

    /// @notice Mapping of garden operator addresses to their status.
    mapping(address operator => bool isOperator) public gardenOperators;

    /// @notice Whether this garden allows open joining without invite
    bool public openJoining;

    /// @notice Karma GAP project UID for this garden
    bytes32 public gapProjectUID;

    /// @notice Immutable address of the WorkApprovalResolver
    /// @dev Set at deployment, cannot be changed. Allows resolver to call createProjectImpact()
    /// @dev Immutables don't use storage slots - stored in contract bytecode
    address public immutable WORK_APPROVAL_RESOLVER;

    /// @notice Immutable address of the AssessmentResolver
    /// @dev Set at deployment, reserved for future milestone integration
    address public immutable ASSESSMENT_RESOLVER;

    modifier onlyGardenOwner() {
        if (_isValidSigner(_msgSender(), "") == false) {
            revert NotGardenOwner();
        }

        _;
    }

    modifier onlyOperator() {
        bool callerIsOwner = _isValidSigner(_msgSender(), "");
        if (!callerIsOwner && !gardenOperators[_msgSender()]) {
            revert NotGardenOperator();
        }

        _;
    }

    /// @notice Restricts function access to ONLY WorkApprovalResolver
    /// @dev SECURITY: Only WorkApprovalResolver can create GAP project impacts
    /// @dev Prevents operators and other resolvers from directly calling impact creation
    modifier onlyWorkApprovalResolver() {
        if (_msgSender() != WORK_APPROVAL_RESOLVER) {
            revert NotAuthorizedCaller();
        }
        _;
    }

    /// @notice Restricts function access to ONLY AssessmentResolver
    /// @dev SECURITY: Only AssessmentResolver can create GAP milestones
    /// @dev Prevents operators and other resolvers from directly calling milestone creation
    modifier onlyAssessmentResolver() {
        if (_msgSender() != ASSESSMENT_RESOLVER) {
            revert NotAuthorizedCaller();
        }
        _;
    }

    /// @notice Initializes the contract with the necessary dependencies.
    /// @dev This constructor is for the upgradable pattern and uses Initializable for upgrade safety.
    /// @param erc4337EntryPoint The entry point address for ERC-4337 operations.
    /// @param multicallForwarder The forwarder address for multicall operations.
    /// @param erc6551Registry The registry address for ERC-6551.
    /// @param guardian The guardian address for security-related functions.
    /// @param workApprovalResolver The address of the WorkApprovalResolver contract.
    /// @param assessmentResolver The address of the AssessmentResolver contract.
    constructor(
        address erc4337EntryPoint,
        address multicallForwarder,
        address erc6551Registry,
        address guardian,
        address workApprovalResolver,
        address assessmentResolver
    )
        AccountV3Upgradable(erc4337EntryPoint, multicallForwarder, erc6551Registry, guardian)
    {
        WORK_APPROVAL_RESOLVER = workApprovalResolver;
        ASSESSMENT_RESOLVER = assessmentResolver;
        _disableInitializers();
    }

    /// @notice Initializes the GardenAccount with initial gardeners and operators.
    /// @dev This function must be called after the contract is deployed.
    /// @param params Initialization parameters struct
    function initialize(IGardenAccount.InitParams calldata params) external initializer {
        // Validate array lengths to prevent gas exhaustion
        if (params.gardeners.length > MAX_INIT_GARDENERS) revert TooManyGardeners();
        if (params.gardenOperators.length > MAX_INIT_OPERATORS) revert TooManyOperators();

        // Note: Community token validation is performed by GardenToken before minting
        communityToken = params.communityToken;
        name = params.name;
        description = params.description;
        location = params.location;
        bannerImage = params.bannerImage;
        // metadata = params.metadata;
        openJoining = params.openJoining;

        // NFT owner becomes operator only (can add themselves as gardener if needed)
        gardenOperators[_msgSender()] = true;

        for (uint256 i = 0; i < params.gardeners.length; i++) {
            gardeners[params.gardeners[i]] = true;
        }

        for (uint256 i = 0; i < params.gardenOperators.length; i++) {
            gardenOperators[params.gardenOperators[i]] = true;
        }

        // Create GAP project if supported on current chain
        if (KarmaLib.isSupported()) {
            _createGAPProject();

            _addGAPProjectAdmin(_msgSender());

            // Add all operators as GAP project admins
            for (uint256 i = 0; i < params.gardenOperators.length; i++) {
                _addGAPProjectAdmin(params.gardenOperators[i]);
            }
        }
    }

    /// @dev Temporarily disabled to reduce contract size - can be re-enabled via upgrade
    // function updateCommunityToken(address _communityToken) external onlyOperator {
    //     communityToken = _communityToken;
    //     emit CommunityTokenUpdated(_msgSender(), _communityToken);
    // }

    /// @notice Updates the name of the garden
    function updateName(string memory _name) external onlyGardenOwner {
        name = _name;
        emit NameUpdated(_msgSender(), _name);
    }

    /// @notice Updates the description of the garden
    function updateDescription(string memory _description) external onlyOperator {
        description = _description;
        emit DescriptionUpdated(_msgSender(), _description);
    }

    /// @dev Temporarily disabled to reduce contract size - can be re-enabled via upgrade
    // function updateLocation(string memory _location) external onlyOperator {
    //     location = _location;
    //     emit LocationUpdated(_msgSender(), _location);
    // }

    /// @dev Temporarily disabled to reduce contract size - can be re-enabled via upgrade
    // function updateBannerImage(string memory _bannerImage) external onlyOperator {
    //     bannerImage = _bannerImage;
    //     emit BannerImageUpdated(_msgSender(), _bannerImage);
    // }

    /// @dev Temporarily disabled to reduce contract size - can be re-enabled via upgrade
    // function updateMetadata(string memory _metadata) external onlyOperator {
    //     metadata = _metadata;
    //     emit MetadataUpdated(_msgSender(), _metadata);
    // }

    /// @notice Adds a new gardener to the garden
    function addGardener(address gardener) external onlyOperator {
        gardeners[gardener] = true;
        emit GardenerAdded(_msgSender(), gardener);
    }

    /// @notice Removes an existing gardener from the garden
    function removeGardener(address gardener) external onlyOperator {
        gardeners[gardener] = false;
        emit GardenerRemoved(_msgSender(), gardener);
    }

    /// @notice Adds a new operator to the garden
    function addGardenOperator(address operator) external onlyOperator {
        gardenOperators[operator] = true;
        gardeners[operator] = true;
        emit GardenOperatorAdded(_msgSender(), operator);
        if (KarmaLib.isSupported() && gapProjectUID != bytes32(0)) {
            _addGAPProjectAdmin(operator);
        }
    }

    /// @notice Removes an existing operator from the garden
    function removeGardenOperator(address operator) external onlyGardenOwner {
        gardenOperators[operator] = false;
        emit GardenOperatorRemoved(_msgSender(), operator);
        if (KarmaLib.isSupported() && gapProjectUID != bytes32(0)) {
            _removeGAPProjectAdmin(operator);
        }
    }

    /// @notice Join garden if open joining is enabled
    function joinGarden() external {
        if (!openJoining) revert InvalidInvite();
        if (gardeners[_msgSender()]) revert AlreadyGardener();
        gardeners[_msgSender()] = true;
        emit GardenerAdded(address(this), _msgSender());
    }

    /// @notice Enable or disable open joining for the garden
    function setOpenJoining(bool _openJoining) external onlyOperator {
        openJoining = _openJoining;
        emit OpenJoiningUpdated(_msgSender(), _openJoining);
    }

    /// @notice Returns the Karma GAP project UID for this garden
    function getGAPProjectUID() external view returns (bytes32) {
        return gapProjectUID;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // IGardenAccessControl Implementation
    // ═══════════════════════════════════════════════════════════════════════════

    /// @inheritdoc IGardenAccessControl
    function isGardener(address account) external view override returns (bool) {
        return gardeners[account];
    }

    /// @inheritdoc IGardenAccessControl
    function isOperator(address account) external view override returns (bool) {
        return gardenOperators[account];
    }

    /// @inheritdoc IGardenAccessControl
    function isOwner(address account) external view override returns (bool) {
        return _isValidSigner(account, "");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Internal GAP Functions
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Creates Karma GAP project via GAP contract
    /// @dev Refactored to use scoped blocks to avoid stack-too-deep errors
    function _createGAPProject() private {
        IGap gap = IGap(KarmaLib.getGapContract());
        bytes32 projectUID;

        // 1. Create Project attestation (scoped to reduce stack pressure)
        {
            AttestationRequestData memory reqData = AttestationRequestData({
                recipient: address(this),
                expirationTime: 0,
                revocable: true,
                refUID: bytes32(0),
                data: abi.encode(true),
                value: 0
            });

            AttestationRequest memory req = AttestationRequest({ schema: KarmaLib.getProjectSchemaUID(), data: reqData });

            try gap.attest(req) returns (bytes32 uid) {
                projectUID = uid;
            } catch {
                revert GAPImpactCreationFailed();
            }
        }

        gapProjectUID = projectUID;

        // 2. Create MemberOf attestation (scoped)
        {
            address sender = _msgSender();
            AttestationRequestData memory reqData = AttestationRequestData({
                recipient: sender,
                expirationTime: 0,
                revocable: true,
                refUID: projectUID,
                data: abi.encode(true),
                value: 0
            });

            AttestationRequest memory req = AttestationRequest({ schema: KarmaLib.getMemberOfSchemaUID(), data: reqData });

            try gap.attest(req) {
                // Success - continue to details
                // solhint-disable-next-line no-empty-blocks
            } catch {
                gapProjectUID = bytes32(0);
                revert GAPImpactCreationFailed();
            }
        }

        // 3. Create Details attestation (scoped)
        {
            string memory detailsJson = _buildGAPDetailsJSON();

            AttestationRequestData memory reqData = AttestationRequestData({
                recipient: address(this),
                expirationTime: 0,
                revocable: true,
                refUID: projectUID,
                data: abi.encode(detailsJson),
                value: 0
            });

            AttestationRequest memory req = AttestationRequest({ schema: KarmaLib.getDetailsSchemaUID(), data: reqData });

            try gap.attest(req) {
                emit GAPProjectCreated(projectUID, address(this), name);
            } catch {
                gapProjectUID = bytes32(0);
                revert GAPImpactCreationFailed();
            }
        }
    }

    /// @notice Creates Karma GAP project impact for approved work
    /// @dev SECURITY: Called ONLY by WorkApprovalResolver after full validation of work approval
    ///
    /// **Security Model:**
    /// - ONLY callable by WorkApprovalResolver (trusted contract)
    /// - Resolver verifies user identity BEFORE calling this function
    /// - Two-layer security: 1) Resolver validates operator status, 2) This checks caller is trusted
    /// - Operators CANNOT call this directly - prevents bypassing approval flow
    ///
    /// @param workTitle Action title from approved work
    /// @param impactDescription Approval feedback
    /// @param proofIPFS IPFS CID for evidence
    /// @param workUID The UID of the work attestation
    /// @return impactUID The impact attestation UID
    function createProjectImpact(
        string calldata workTitle,
        string calldata impactDescription,
        string calldata proofIPFS,
        bytes32 workUID
    )
        external
        onlyWorkApprovalResolver
        returns (bytes32)
    {
        if (gapProjectUID == bytes32(0)) revert GAPProjectNotInitialized();
        if (!KarmaLib.isSupported()) revert GAPNotSupportedOnChain();

        // Build impact JSON and attestation in steps to reduce stack pressure
        string memory impactJson = _buildImpactJSON(workTitle, impactDescription, proofIPFS, workUID);

        AttestationRequestData memory reqData = AttestationRequestData({
            recipient: address(this),
            expirationTime: 0,
            revocable: false,
            refUID: gapProjectUID,
            data: abi.encode(impactJson),
            value: 0
        });

        AttestationRequest memory req = AttestationRequest({ schema: KarmaLib.getDetailsSchemaUID(), data: reqData });

        try IGap(KarmaLib.getGapContract()).attest(req) returns (bytes32 impactUID) {
            return impactUID;
        } catch {
            revert GAPImpactCreationFailed();
        }
    }

    /// @notice Creates Karma GAP milestone for an assessment
    /// @dev SECURITY: Called ONLY by AssessmentResolver after full validation
    ///
    /// **Security Model:**
    /// - ONLY callable by AssessmentResolver (trusted contract)
    /// - Resolver verifies user identity BEFORE calling this function
    /// - Two-layer security: 1) Resolver validates operator status, 2) This checks caller is trusted
    /// - Operators CANNOT call this directly - prevents bypassing assessment flow
    ///
    /// @param milestoneTitle Assessment title
    /// @param milestoneDescription Assessment description
    /// @param milestoneMeta Additional metadata JSON from assessment (capitals, metricsJSON)
    /// @return milestoneUID The milestone attestation UID
    function createProjectMilestone(
        string calldata milestoneTitle,
        string calldata milestoneDescription,
        string calldata milestoneMeta
    )
        external
        onlyAssessmentResolver
        returns (bytes32)
    {
        if (gapProjectUID == bytes32(0)) revert GAPProjectNotInitialized();
        if (!KarmaLib.isSupported()) revert GAPNotSupportedOnChain();

        // Build milestone JSON in steps to reduce stack pressure
        string memory milestoneJson = _buildMilestoneJSON(milestoneTitle, milestoneDescription, milestoneMeta);

        AttestationRequestData memory reqData = AttestationRequestData({
            recipient: address(this),
            expirationTime: 0,
            revocable: false,
            refUID: gapProjectUID,
            data: abi.encode(milestoneJson),
            value: 0
        });

        AttestationRequest memory req = AttestationRequest({ schema: KarmaLib.getDetailsSchemaUID(), data: reqData });

        try IGap(KarmaLib.getGapContract()).attest(req) returns (bytes32 milestoneUID) {
            return milestoneUID;
        } catch {
            revert GAPMilestoneCreationFailed();
        }
    }

    /// @notice Builds milestone JSON string (helper to reduce stack depth)
    function _buildMilestoneJSON(
        string calldata title,
        string calldata desc,
        string calldata meta
    )
        private
        pure
        returns (string memory)
    {
        bytes memory part1 = abi.encodePacked("{\"title\":\"", StringUtils.escapeJSON(title), "\",\"text\":\"");
        bytes memory part2 = abi.encodePacked(StringUtils.escapeJSON(desc), "\",\"type\":\"project-milestone\",\"data\":");
        return string(abi.encodePacked(part1, part2, meta, "}"));
    }

    /// @notice Internal function to add GAP project admin
    /// @param admin Address to add as project admin
    function _addGAPProjectAdmin(address admin) private {
        if (gapProjectUID == bytes32(0)) return;
        // solhint-disable-next-line no-empty-blocks
        try IGap(KarmaLib.getGapContract()).addProjectAdmin(gapProjectUID, admin) { }
            catch { /* Non-critical: GAP sync failed */ }
    }

    /// @notice Internal function to remove GAP project admin
    /// @param admin Address to remove as project admin
    function _removeGAPProjectAdmin(address admin) private {
        if (gapProjectUID == bytes32(0)) return;
        // solhint-disable-next-line no-empty-blocks
        try IGap(KarmaLib.getGapContract()).removeProjectAdmin(gapProjectUID, admin) { }
            catch { /* Non-critical: GAP sync failed */ }
    }

    /// @notice Transfers ownership of the GAP project to a new owner
    /// @dev Temporarily disabled to reduce contract size - can be re-enabled via upgrade
    // function transferGAPProjectOwnership(address newOwner) external onlyOperator {
    //     if (gapProjectUID == bytes32(0)) revert GAPProjectNotInitialized();
    //     if (!KarmaLib.isSupported()) revert GAPNotSupportedOnChain();
    //     if (newOwner == address(0)) revert InvalidGAPOwner();

    //     try IGap(KarmaLib.getGapContract()).transferProjectOwnership(gapProjectUID, newOwner) {
    //     } catch {
    //         revert GAPOwnershipTransferFailed();
    //     }
    // }

    /// @notice Builds simplified JSON for GAP project details (removed empty fields)
    function _buildGAPDetailsJSON() private view returns (string memory) {
        string memory imageURL =
            bytes(bannerImage).length > 0 ? string(abi.encodePacked("https://w3s.link/ipfs/", bannerImage)) : "";

        return string(
            abi.encodePacked(
                "{\"title\":\"",
                StringUtils.escapeJSON(name),
                "\",\"description\":\"",
                StringUtils.escapeJSON(description),
                "\",\"locationOfImpact\":\"",
                StringUtils.escapeJSON(location),
                "\",\"imageURL\":\"",
                StringUtils.escapeJSON(imageURL),
                "\",\"slug\":\"",
                StringUtils.escapeJSON(StringUtils.generateSlug(name)),
                "\",\"type\":\"project-details\"}"
            )
        );
    }

    /// @notice Builds simplified impact JSON
    /// @dev Split into multiple parts to avoid stack-too-deep
    function _buildImpactJSON(
        string calldata workTitle,
        string calldata impactDescription,
        string calldata proofIPFS,
        bytes32 workUID
    )
        private
        view
        returns (string memory)
    {
        (,, uint256 tokenId) = token();
        string memory isoDate = StringUtils.timestampToISO(block.timestamp);

        // Part 1: title, text, dates
        bytes memory part1 = abi.encodePacked(
            "{\"title\":\"",
            StringUtils.escapeJSON(workTitle),
            "\",\"text\":\"",
            StringUtils.escapeJSON(impactDescription),
            "\",\"startDate\":\"",
            isoDate,
            "\",\"endDate\":\"",
            isoDate
        );

        // Part 2: deliverables
        bytes memory part2 = abi.encodePacked(
            "\",\"deliverables\":[{\"name\":\"Work Evidence\",\"proof\":\"ipfs://",
            StringUtils.escapeJSON(proofIPFS),
            "\",\"description\":\"",
            StringUtils.escapeJSON(impactDescription),
            "\"}]"
        );

        // Part 3: links
        bytes memory part3 = abi.encodePacked(
            ",\"links\":[{\"type\":\"other\",\"url\":\"https://greengoods.me/garden/",
            StringUtils.uint2str(block.chainid),
            "/",
            StringUtils.uint2str(tokenId),
            "/work/0x",
            StringUtils.bytes32ToHexString(workUID),
            "\",\"label\":\"View in Green Goods\"}],\"type\":\"project-update\"}"
        );

        return string(abi.encodePacked(part1, part2, part3));
    }

    /// @notice Storage gap for upgradeable contract
    /// @dev Reserve 50 slots total for future upgrades
    /// Inherited storage (5 slots):
    ///   - Initializable: 1 slot (_initialized + _initializing packed)
    ///   - Lockable: 1 slot (lockedUntil)
    ///   - Overridable: 1 slot (overrides mapping)
    ///   - Permissioned: 1 slot (permissions mapping)
    ///   - ERC6551Account: 1 slot (_state)
    /// GardenAccount storage (10 slots):
    ///   - communityToken (1) + name (1) + description (1) + location (1)
    ///   - bannerImage (1) + metadata (1) + gardeners (1) + gardenOperators (1)
    ///   - openJoining (1) + gapProjectUID (1)
    /// Note: WORK_APPROVAL_RESOLVER and ASSESSMENT_RESOLVER are immutables (no storage slots)
    /// Gap calculation: 50 - (5 + 10) = 35 slots
    uint256[35] private __gap;
}
