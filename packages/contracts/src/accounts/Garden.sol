// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25;

import { AccountV3Upgradable } from "@tokenbound/AccountV3Upgradable.sol";
import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import { AttestationRequest, AttestationRequestData } from "@eas/IEAS.sol";

import { KarmaLib } from "../lib/Karma.sol";
import { StringUtils } from "../lib/StringUtils.sol";
import { IGap } from "../interfaces/IKarmaGap.sol";

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
error InvalidGAPOwner();
error GAPOwnershipTransferFailed();

/// @title GardenAccount Contract
/// @notice Manages gardeners and operators for a Garden, and supports community token management.
/// @dev Inherits from AccountV3Upgradable and uses OpenZeppelin's Initializable for upgradability.
contract GardenAccount is AccountV3Upgradable, Initializable {
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
        bool isOwner = _isValidSigner(_msgSender(), "");
        if (!isOwner && !gardenOperators[_msgSender()]) {
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
    /// @param _communityToken The address of the community token associated with the garden.
    /// @param _name The name of the garden.
    /// @param _description The description of the garden.
    /// @param _location The location of the garden.
    /// @param _bannerImage The IPFS CID of the banner image.
    /// @param _metadata The IPFS CID containing additional metadata as JSON.
    /// @param _gardeners An array of addresses representing the initial gardeners.
    /// @param _gardenOperators An array of addresses representing the initial garden operators.
    function initialize(
        address _communityToken,
        string calldata _name,
        string calldata _description,
        string calldata _location,
        string calldata _bannerImage,
        string calldata _metadata,
        address[] calldata _gardeners,
        address[] calldata _gardenOperators
    )
        external
        initializer
    {
        // Validate array lengths to prevent gas exhaustion
        if (_gardeners.length > 50) revert TooManyGardeners();
        if (_gardenOperators.length > 20) revert TooManyOperators();

        // Note: Community token validation is performed by GardenToken before minting
        communityToken = _communityToken;
        name = _name;
        description = _description;
        location = _location;
        bannerImage = _bannerImage;
        metadata = _metadata;

        // Enable open joining for root garden (tokenId 1)
        (,, uint256 tokenId) = token();
        openJoining = (tokenId == 1);

        gardeners[_msgSender()] = true;
        gardenOperators[_msgSender()] = true;

        for (uint256 i = 0; i < _gardeners.length; i++) {
            gardeners[_gardeners[i]] = true;
            emit GardenerAdded(_msgSender(), _gardeners[i]);
        }

        for (uint256 i = 0; i < _gardenOperators.length; i++) {
            gardenOperators[_gardenOperators[i]] = true;
            emit GardenOperatorAdded(_msgSender(), _gardenOperators[i]);
        }

        emit NameUpdated(_msgSender(), _name);
        emit DescriptionUpdated(_msgSender(), _description);

        emit GardenerAdded(_msgSender(), _msgSender());
        emit GardenOperatorAdded(_msgSender(), _msgSender());

        // Create GAP project if supported on current chain
        if (KarmaLib.isSupported()) {
            _createGAPProject();

            _addGAPProjectAdmin(_msgSender());

            // Add all operators as GAP project admins
            for (uint256 i = 0; i < _gardenOperators.length; i++) {
                _addGAPProjectAdmin(_gardenOperators[i]);
            }
        }
    }

    /// @notice Updates the community token of the garden.
    /// @dev Only callable by garden operators.
    /// @param _communityToken The new community token of the garden.
    function updateCommunityToken(address _communityToken) external onlyOperator {
        communityToken = _communityToken;

        emit CommunityTokenUpdated(_msgSender(), _communityToken);
    }

    /// @notice Updates the name of the garden.
    /// @dev Only callable by a valid signer of the contract.
    /// @param _name The new name of the garden.
    function updateName(string memory _name) external onlyGardenOwner {
        name = _name;

        emit NameUpdated(_msgSender(), _name);
    }

    /// @notice Updates the description of the garden.
    /// @dev Only callable by garden operators.
    /// @param _description The new description of the garden.
    function updateDescription(string memory _description) external onlyOperator {
        description = _description;

        emit DescriptionUpdated(_msgSender(), _description);
    }

    /// @notice Updates the location of the garden.
    /// @dev Only callable by garden operators.
    /// @param _location The new location of the garden.
    function updateLocation(string memory _location) external onlyOperator {
        location = _location;

        emit LocationUpdated(_msgSender(), _location);
    }

    /// @notice Updates the banner image of the garden.
    /// @dev Only callable by garden operators.
    /// @param _bannerImage The new banner image of the garden.
    function updateBannerImage(string memory _bannerImage) external onlyOperator {
        bannerImage = _bannerImage;

        emit BannerImageUpdated(_msgSender(), _bannerImage);
    }

    /// @notice Updates the metadata of the garden.
    /// @dev Only callable by garden operators.
    /// @param _metadata The new IPFS CID containing metadata JSON.
    function updateMetadata(string memory _metadata) external onlyOperator {
        metadata = _metadata;

        emit MetadataUpdated(_msgSender(), _metadata);
    }

    /// @notice Adds a new gardener to the garden.
    /// @dev Only callable by a valid signer of the contract.
    /// @param gardener The address of the gardener to add.
    function addGardener(address gardener) external onlyOperator {
        gardeners[gardener] = true;

        emit GardenerAdded(_msgSender(), gardener);
    }

    /// @notice Removes an existing gardener from the garden.
    /// @dev Only callable by a valid signer of the contract.
    /// @param gardener The address of the gardener to remove.
    function removeGardener(address gardener) external onlyOperator {
        gardeners[gardener] = false;

        emit GardenerRemoved(_msgSender(), gardener);
    }

    /// @notice Adds a new operator to the garden.
    /// @dev Only callable by a valid signer of the contract.
    /// @param operator The address of the operator to add.
    function addGardenOperator(address operator) external onlyOperator {
        gardenOperators[operator] = true;
        gardeners[operator] = true;

        emit GardenOperatorAdded(_msgSender(), operator);

        // Add as GAP project admin if GAP supported and project exists
        if (KarmaLib.isSupported() && gapProjectUID != bytes32(0)) {
            _addGAPProjectAdmin(operator);
        }
    }

    /// @notice Removes an existing operator from the garden.
    /// @dev Only callable by a valid signer of the contract.
    /// @param operator The address of the operator to remove.
    function removeGardenOperator(address operator) external onlyGardenOwner {
        gardenOperators[operator] = false;

        emit GardenOperatorRemoved(_msgSender(), operator);

        // Remove from GAP project admin if GAP supported and project exists
        if (KarmaLib.isSupported() && gapProjectUID != bytes32(0)) {
            _removeGAPProjectAdmin(operator);
        }
    }

    /// @notice Join garden if open joining is enabled
    /// @dev Allows anyone to join without invite code if openJoining is true
    function joinGarden() external {
        if (!openJoining) revert InvalidInvite();
        if (gardeners[_msgSender()]) revert AlreadyGardener();

        gardeners[_msgSender()] = true;

        emit GardenerAdded(address(this), _msgSender());
    }

    /// @notice Enable or disable open joining for the garden
    /// @dev Only callable by garden operators
    /// @param _openJoining Whether to enable open joining
    function setOpenJoining(bool _openJoining) external onlyOperator {
        openJoining = _openJoining;
    }

    /// @notice Returns the Karma GAP project UID for this garden
    /// @return The GAP project UID, or bytes32(0) if not initialized
    function getGAPProjectUID() external view returns (bytes32) {
        return gapProjectUID;
    }

    /// @notice Creates Karma GAP project via GAP contract
    /// @dev Atomic operation: all three attestations succeed or entire operation reverts
    /// @dev Project UID is captured directly from return value
    function _createGAPProject() private {
        IGap gap = IGap(KarmaLib.getGapContract());

        // 1. Create Project attestation - captures UID directly
        bytes memory projectData = abi.encode(true);
        AttestationRequest memory projectReq = AttestationRequest({
            schema: KarmaLib.getProjectSchemaUID(),
            data: AttestationRequestData({
                recipient: address(this),
                expirationTime: 0,
                revocable: true,
                refUID: bytes32(0),
                data: projectData,
                value: 0
            })
        });

        // Atomic operation: all three attestations or none
        try gap.attest(projectReq) returns (bytes32 projectUID) {
            gapProjectUID = projectUID;

            // 2. Create MemberOf attestation - references project UID
            bytes memory memberData = abi.encode(true);
            AttestationRequest memory memberReq = AttestationRequest({
                schema: KarmaLib.getMemberOfSchemaUID(),
                data: AttestationRequestData({
                    recipient: _msgSender(), // The creator becomes a member
                    expirationTime: 0,
                    revocable: true,
                    refUID: projectUID, // Reference the project
                    data: memberData,
                    value: 0
                })
            });

            try gap.attest(memberReq) {
                // 3. Create Details attestation - references project UID
                bytes memory detailsData = abi.encode(_buildGAPDetailsJSON());
                AttestationRequest memory detailsReq = AttestationRequest({
                    schema: KarmaLib.getDetailsSchemaUID(),
                    data: AttestationRequestData({
                        recipient: address(this),
                        expirationTime: 0,
                        revocable: true,
                        refUID: projectUID, // Reference the project
                        data: detailsData,
                        value: 0
                    })
                });

                try gap.attest(detailsReq) {
                    emit GAPProjectCreated(gapProjectUID, address(this), name);
                } catch {
                    // Rollback: clear projectUID on details failure
                    gapProjectUID = bytes32(0);
                    revert GAPImpactCreationFailed();
                }
            } catch {
                // Rollback: clear projectUID on member failure
                gapProjectUID = bytes32(0);
                revert GAPImpactCreationFailed();
            }
        } catch {
            revert GAPImpactCreationFailed();
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
    /// @return impactUID The impact attestation UID
    function createProjectImpact(
        string calldata workTitle,
        string calldata impactDescription,
        string calldata proofIPFS
    )
        external
        onlyWorkApprovalResolver
        returns (bytes32)
    {
        if (gapProjectUID == bytes32(0)) revert GAPProjectNotInitialized();
        if (!KarmaLib.isSupported()) revert GAPNotSupportedOnChain();

        IGap gap = IGap(KarmaLib.getGapContract());

        // Build project update JSON with required structure
        string memory isoDate = StringUtils.timestampToISO(block.timestamp);

        bytes memory impactData = abi.encode(
            string(
                abi.encodePacked(
                    "{",
                    "\"title\":\"",
                    StringUtils.escapeJSON(workTitle),
                    "\",",
                    "\"text\":\"",
                    StringUtils.escapeJSON(impactDescription),
                    "\",",
                    "\"startDate\":\"",
                    isoDate,
                    "\",",
                    "\"endDate\":\"",
                    isoDate,
                    "\",",
                    "\"grants\":[],",
                    "\"indicators\":[],",
                    "\"deliverables\":[{",
                    "\"name\":\"Work Evidence\",",
                    "\"proof\":\"ipfs://",
                    StringUtils.escapeJSON(proofIPFS),
                    "\",",
                    "\"description\":\"",
                    StringUtils.escapeJSON(impactDescription),
                    "\"",
                    "}],",
                    "\"type\":\"project-update\"",
                    "}"
                )
            )
        );

        AttestationRequest memory req = AttestationRequest({
            schema: KarmaLib.getDetailsSchemaUID(), // Note: Uses details schema with type "project-update"
            data: AttestationRequestData({
                recipient: address(this),
                expirationTime: 0,
                revocable: false,
                refUID: gapProjectUID,
                data: impactData,
                value: 0
            })
        });

        // Attest via GAP contract with error handling
        try gap.attest(req) returns (bytes32 impactUID) {
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
    /// @dev Third parameter (milestoneMeta) is intentionally unused - kept for API compatibility with AssessmentResolver
    /// @return milestoneUID The milestone attestation UID
    function createProjectMilestone(
        string calldata milestoneTitle,
        string calldata milestoneDescription,
        string calldata /* milestoneMeta */
    )
        external
        onlyAssessmentResolver
        returns (bytes32)
    {
        // Note: milestoneMeta is not used in simplified GAP milestone format
        // Keeping parameter for API compatibility with AssessmentResolver
        if (gapProjectUID == bytes32(0)) revert GAPProjectNotInitialized();
        if (!KarmaLib.isSupported()) revert GAPNotSupportedOnChain();

        IGap gap = IGap(KarmaLib.getGapContract());

        // Build milestone JSON - simple structure with title, text, type
        bytes memory milestoneData = abi.encode(
            string(
                abi.encodePacked(
                    "{",
                    "\"title\":\"",
                    StringUtils.escapeJSON(milestoneTitle),
                    "\",",
                    "\"text\":\"",
                    StringUtils.escapeJSON(milestoneDescription),
                    "\",",
                    "\"type\":\"project-milestone\"",
                    "}"
                )
            )
        );

        AttestationRequest memory req = AttestationRequest({
            schema: KarmaLib.getDetailsSchemaUID(), // Note: Uses details schema, not milestone schema
            data: AttestationRequestData({
                recipient: address(this),
                expirationTime: 0,
                revocable: false,
                refUID: gapProjectUID, // References project
                data: milestoneData,
                value: 0
            })
        });

        // Attest via GAP contract with error handling
        try gap.attest(req) returns (bytes32 milestoneUID) {
            return milestoneUID;
        } catch {
            revert GAPMilestoneCreationFailed();
        }
    }

    /// @notice Internal function to add GAP project admin
    /// @param admin Address to add as project admin
    function _addGAPProjectAdmin(address admin) private {
        if (gapProjectUID == bytes32(0)) return; // No project, skip silently

        // solhint-disable-next-line no-empty-blocks
        try IGap(KarmaLib.getGapContract()).addProjectAdmin(gapProjectUID, admin) {
            // Success: admin added to GAP project
        } catch Error(string memory) /* reason */ { // solhint-disable-line no-empty-blocks
                // Non-critical: GAP sync failed but operator added successfully
        } catch (bytes memory) /* lowLevelData */ { // solhint-disable-line no-empty-blocks
                // Non-critical: GAP sync failed but operator added successfully
        }
    }

    /// @notice Internal function to remove GAP project admin
    /// @param admin Address to remove as project admin
    function _removeGAPProjectAdmin(address admin) private {
        if (gapProjectUID == bytes32(0)) return; // No project, skip silently

        // solhint-disable-next-line no-empty-blocks
        try IGap(KarmaLib.getGapContract()).removeProjectAdmin(gapProjectUID, admin) {
            // Success: admin removed from GAP project
        } catch Error(string memory) /* reason */ { // solhint-disable-line no-empty-blocks
                // Non-critical: GAP sync failed but operator removed successfully
        } catch (bytes memory) /* lowLevelData */ { // solhint-disable-line no-empty-blocks
                // Non-critical: GAP sync failed but operator removed successfully
        }
    }

    /// @notice Transfers ownership of the GAP project to a new owner
    /// @param newOwner Address that will receive project ownership
    function transferGAPProjectOwnership(address newOwner) external onlyOperator {
        if (gapProjectUID == bytes32(0)) revert GAPProjectNotInitialized();
        if (!KarmaLib.isSupported()) revert GAPNotSupportedOnChain();
        if (newOwner == address(0)) revert InvalidGAPOwner();

        try IGap(KarmaLib.getGapContract()).transferProjectOwnership(gapProjectUID, newOwner) {
            // Ownership transferred successfully
        } catch {
            revert GAPOwnershipTransferFailed();
        }
    }

    /// @notice Builds JSON for GAP project details
    function _buildGAPDetailsJSON() private view returns (string memory) {
        // Prefix banner image CID with IPFS gateway if not empty
        string memory imageURL =
            bytes(bannerImage).length > 0 ? string(abi.encodePacked("https://w3s.link/ipfs/", bannerImage)) : "";

        return string(
            abi.encodePacked(
                "{",
                "\"title\":\"",
                StringUtils.escapeJSON(name),
                "\",",
                "\"description\":\"",
                StringUtils.escapeJSON(description),
                "\",",
                "\"problem\":\"",
                "\"\"",
                "\",",
                "\"solution\":\"",
                "\"\"",
                "\",",
                "\"missionSummary\":\"",
                StringUtils.escapeJSON(description),
                "\",",
                "\"locationOfImpact\":\"",
                StringUtils.escapeJSON(location),
                "\",",
                "\"imageURL\":\"",
                StringUtils.escapeJSON(imageURL),
                "\",",
                "\"links\":[",
                "{\"type\":\"twitter\",\"url\":\"\"},",
                "{\"type\":\"github\",\"url\":\"\"},",
                "{\"type\":\"discord\",\"url\":\"\"},",
                "{\"type\":\"website\",\"url\":\"\"},",
                "{\"type\":\"linkedin\",\"url\":\"\"},",
                "{\"type\":\"pitchDeck\",\"url\":\"\"},",
                "{\"type\":\"demoVideo\",\"url\":\"\"},",
                "{\"type\":\"farcaster\",\"url\":\"\"}",
                "],",
                "\"slug\":\"",
                StringUtils.escapeJSON(_generateSlug(name)),
                "\",",
                "\"businessModel\":\"\",",
                "\"stageIn\":\"\",",
                "\"raisedMoney\":\"\",",
                "\"pathToTake\":\"\",",
                "\"type\":\"project-details\"",
                "}"
            )
        );
    }

    /// @notice Generates a URL-safe slug from garden name
    /// @param str The string to convert to slug
    /// @return The slug (lowercase, hyphens for spaces, alphanumeric only)
    function _generateSlug(string memory str) private pure returns (string memory) {
        return StringUtils.generateSlug(str);
    }

    /// @notice Storage gap for upgradeable contract
    /// @dev Reserve 50 slots total for future upgrades
    /// Inherited storage (5 slots):
    ///   - Initializable: 1 slot (_initialized + _initializing packed)
    ///   - Lockable: 1 slot (lockedUntil)
    ///   - Overridable: 1 slot (overrides mapping)
    ///   - Permissioned: 1 slot (permissions mapping)
    ///   - ERC6551Account: 1 slot (_state)
    /// GardenAccount storage (13 slots):
    ///   - communityToken(1) + name(1) + description(1) + location(1) +
    ///   - bannerImage(1) + metadata(1) + gardeners(1) + gardenOperators(1) + gardenInvites(1) +
    ///   - inviteToGarden(1) + inviteExpiry(1) + inviteUsed(1) + openJoining(1) +
    ///   - gapProjectUID(1)
    /// Note: WORK_APPROVAL_RESOLVER and ASSESSMENT_RESOLVER are immutables (no storage slots)
    /// Gap calculation: 50 - (5 + 14) = 31 slots
    uint256[31] private __gap;
}
