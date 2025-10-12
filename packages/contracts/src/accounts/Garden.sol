// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25;

import { AccountV3Upgradable } from "@tokenbound/AccountV3Upgradable.sol";
import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { AttestationRequest, AttestationRequestData } from "@eas/IEAS.sol";
import { KarmaLib } from "../lib/Karma.sol";
import { IKarmaGap, IProjectResolver } from "../interfaces/IKarmaGap.sol";

// import { Action } from "../registries/Action.sol";

error NotGardenOwner();
error NotGardenOperator();
error NotAuthorizedCaller();
error InviteAlreadyExists();
error InvalidExpiry();
error InvalidInvite();
error InviteAlreadyUsed();
error InviteExpired();
error AlreadyGardener();
error InvalidCommunityToken();
error CommunityTokenNotContract();
error InvalidERC20Token();
error TooManyGardeners();
error TooManyOperators();
error GAPProjectNotInitialized();
error GAPNotSupportedOnChain();

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

    /// @notice Emitted when a garden invite is created.
    /// @param inviteCode The unique code for the invite.
    /// @param garden The address of the garden.
    /// @param creator The address of the operator who created the invite.
    /// @param expiry The expiration timestamp of the invite.
    event InviteCreated(bytes32 indexed inviteCode, address indexed garden, address indexed creator, uint256 expiry);

    /// @notice Emitted when a garden invite is used.
    /// @param inviteCode The unique code for the invite.
    /// @param garden The address of the garden.
    /// @param user The address of the user who used the invite.
    event InviteUsed(bytes32 indexed inviteCode, address indexed garden, address indexed user);

    /// @notice Emitted when a garden invite is revoked.
    /// @param inviteCode The unique code for the invite.
    /// @param garden The address of the garden.
    event InviteRevoked(bytes32 indexed inviteCode, address indexed garden);

    /// @notice Emitted when a Karma GAP project is created for this garden.
    /// @param projectUID The Karma GAP project attestation UID.
    /// @param gardenAddress The address of this garden account.
    /// @param projectName The name of the GAP project (garden name).
    event GAPProjectCreated(bytes32 indexed projectUID, address indexed gardenAddress, string projectName);

    /// @notice Emitted when a project impact is created for approved work.
    /// @param impactUID The impact attestation UID.
    /// @param projectUID The GAP project UID this impact belongs to.
    /// @param creator The address that created the impact.
    event GAPProjectImpactCreated(bytes32 indexed impactUID, bytes32 indexed projectUID, address indexed creator);

    /// @notice Emitted when a project milestone is created from an assessment.
    /// @param milestoneUID The milestone attestation UID.
    /// @param projectUID The GAP project UID this milestone belongs to.
    /// @param creator The address that created the milestone.
    event GAPProjectMilestoneCreated(bytes32 indexed milestoneUID, bytes32 indexed projectUID, address indexed creator);

    /// @notice Emitted when an operator is added as GAP project admin.
    /// @param projectUID The GAP project UID.
    /// @param admin The address added as admin.
    event GAPProjectAdminAdded(bytes32 indexed projectUID, address indexed admin);

    /// @notice The community token associated with this garden.
    address public communityToken;

    /// @notice The name of the garden.
    string public name;

    /// @notice The description of the garden.
    string public description;

    /// @notice The location of the garden.
    string public location;

    /// @notice The URL of the banner image of the garden.
    string public bannerImage;

    /// @notice Mapping of gardener addresses to their status.
    mapping(address gardener => bool isGardener) public gardeners;

    /// @notice Mapping of garden operator addresses to their status.
    mapping(address operator => bool isOperator) public gardenOperators;

    /// @notice Mapping of invite codes to their validity status.
    mapping(bytes32 inviteCode => bool isValid) public gardenInvites;

    /// @notice Mapping of invite codes to the garden address they belong to.
    mapping(bytes32 inviteCode => address garden) public inviteToGarden;

    /// @notice Mapping of invite codes to their expiration timestamps.
    mapping(bytes32 inviteCode => uint256 expiry) public inviteExpiry;

    /// @notice Mapping of invite codes to their used status.
    mapping(bytes32 inviteCode => bool isUsed) public inviteUsed;

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
        if (!gardenOperators[_msgSender()]) {
            revert NotGardenOperator();
        }

        _;
    }

    /// @notice Restricts function access to garden operators OR trusted resolvers
    /// @dev Security: Resolvers must verify user identity before calling
    /// @dev Trusted resolvers can create GAP attestations on behalf of verified operators
    /// @dev This enables automatic impact reporting while maintaining security
    modifier onlyOperatorOrResolver() {
        if (!gardenOperators[_msgSender()] && _msgSender() != WORK_APPROVAL_RESOLVER && _msgSender() != ASSESSMENT_RESOLVER)
        {
            revert NotAuthorizedCaller();
        }
        _;
    }

    /// @notice Restricts function access to ONLY trusted resolvers
    /// @dev SECURITY: Only resolvers can create GAP attestations
    /// @dev Prevents operators from directly calling GAP functions
    modifier onlyResolver() {
        if (_msgSender() != WORK_APPROVAL_RESOLVER && _msgSender() != ASSESSMENT_RESOLVER) {
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
    /// @param _gardeners An array of addresses representing the initial gardeners.
    /// @param _gardenOperators An array of addresses representing the initial garden operators.
    function initialize(
        address _communityToken,
        string calldata _name,
        string calldata _description,
        string calldata _location,
        string calldata _bannerImage,
        address[] calldata _gardeners,
        address[] calldata _gardenOperators
    )
        external
        initializer
    {
        // Validate array lengths to prevent gas exhaustion
        if (_gardeners.length > 100) revert TooManyGardeners();
        if (_gardenOperators.length > 100) revert TooManyOperators();

        // Validate community token is a valid ERC-20
        _validateCommunityToken(_communityToken);

        communityToken = _communityToken;
        name = _name;
        description = _description;
        location = _location;
        bannerImage = _bannerImage;

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

            // Add all operators as GAP project admins
            for (uint256 i = 0; i < _gardenOperators.length; i++) {
                _addGAPProjectAdmin(_gardenOperators[i]);
            }
        }
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
    }

    /// @notice Creates an invite code for the garden.
    /// @dev Only callable by garden operators. Invite codes allow users to join the garden.
    /// @param inviteCode The unique code for the invite.
    /// @param expiry The expiration timestamp for the invite.
    function createInviteCode(bytes32 inviteCode, uint256 expiry) external onlyOperator {
        if (gardenInvites[inviteCode]) revert InviteAlreadyExists();
        // solhint-disable-next-line not-rely-on-time
        if (expiry <= block.timestamp) revert InvalidExpiry();

        gardenInvites[inviteCode] = true;
        inviteToGarden[inviteCode] = address(this);
        inviteExpiry[inviteCode] = expiry;

        emit InviteCreated(inviteCode, address(this), _msgSender(), expiry);
    }

    /// @notice Allows a user to join the garden using a valid invite code.
    /// @dev This function can be called by anyone with a valid invite code.
    /// @param inviteCode The unique code for the invite.
    function joinGardenWithInvite(bytes32 inviteCode) external {
        if (!gardenInvites[inviteCode]) revert InvalidInvite();
        if (inviteUsed[inviteCode]) revert InviteAlreadyUsed();
        // solhint-disable-next-line not-rely-on-time
        if (block.timestamp > inviteExpiry[inviteCode]) revert InviteExpired();
        if (gardeners[_msgSender()]) revert AlreadyGardener();

        gardeners[_msgSender()] = true;
        inviteUsed[inviteCode] = true;

        emit InviteUsed(inviteCode, address(this), _msgSender());
        emit GardenerAdded(address(this), _msgSender());
    }

    /// @notice Revokes an unused invite code.
    /// @dev Only callable by garden operators.
    /// @param inviteCode The unique code for the invite to revoke.
    function revokeInvite(bytes32 inviteCode) external onlyOperator {
        if (!gardenInvites[inviteCode]) revert InvalidInvite();
        if (inviteUsed[inviteCode]) revert InviteAlreadyUsed();

        delete gardenInvites[inviteCode];
        delete inviteToGarden[inviteCode];
        delete inviteExpiry[inviteCode];

        emit InviteRevoked(inviteCode, address(this));
    }

    /// @notice Join garden if open joining is enabled
    /// @dev Allows anyone to join without invite code if openJoining is true
    function joinGarden() external {
        if (!openJoining) revert InvalidInvite();
        if (gardeners[_msgSender()]) revert AlreadyGardener();

        gardeners[_msgSender()] = true;
        emit GardenerAdded(address(this), _msgSender());
    }

    /// @notice Validates that the provided address is a valid ERC-20 token contract
    /// @dev Checks: non-zero address, has contract code, implements ERC-20 totalSupply
    /// @param _token The token address to validate
    function _validateCommunityToken(address _token) private view {
        // Check non-zero address
        if (_token == address(0)) {
            revert InvalidCommunityToken();
        }

        // Check that address contains contract code
        if (_token.code.length == 0) {
            revert CommunityTokenNotContract();
        }

        // Attempt to call totalSupply() to verify it's an ERC-20
        // This provides a basic sanity check without requiring full interface compliance
        // solhint-disable-next-line no-empty-blocks
        try IERC20(_token).totalSupply() returns (uint256) {
            // Success - token validated, no additional action needed
        } catch {
            revert InvalidERC20Token();
        }
    }

    /// @notice Returns the Karma GAP project UID for this garden
    /// @return The GAP project UID, or bytes32(0) if not initialized
    function getGAPProjectUID() external view returns (bytes32) {
        return gapProjectUID;
    }

    /// @notice Creates Karma GAP project attestation
    /// @dev Internal function called during initialization
    function _createGAPProject() private {
        IKarmaGap gapContract = IKarmaGap(KarmaLib.getGapContract());

        // 1. Create project attestation
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

        gapProjectUID = gapContract.attest(projectReq);

        // 2. Create project details
        bytes memory detailsData = abi.encode(_buildGAPDetailsJSON());

        AttestationRequest memory detailsReq = AttestationRequest({
            schema: KarmaLib.getDetailsSchemaUID(),
            data: AttestationRequestData({
                recipient: address(this),
                expirationTime: 0,
                revocable: true,
                refUID: gapProjectUID,
                data: detailsData,
                value: 0
            })
        });

        gapContract.attest(detailsReq);

        emit GAPProjectCreated(gapProjectUID, address(this), name);
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
        onlyResolver
        returns (bytes32)
    {
        if (gapProjectUID == bytes32(0)) revert GAPProjectNotInitialized();
        if (!KarmaLib.isSupported()) revert GAPNotSupportedOnChain();

        IKarmaGap gapContract = IKarmaGap(KarmaLib.getGapContract());

        // Build impact JSON
        bytes memory impactData = abi.encode(
            string(
                abi.encodePacked(
                    "{'title':'",
                    _escapeJSON(workTitle),
                    "',",
                    "'text':'",
                    _escapeJSON(impactDescription),
                    "',",
                    "'proof':'",
                    proofIPFS,
                    "',",
                    "'completedAt':",
                    // solhint-disable-next-line not-rely-on-time
                    _uint2str(block.timestamp), // Metadata only - not used for access control
                    ",",
                    "'type':'project-impact'}"
                )
            )
        );

        AttestationRequest memory req = AttestationRequest({
            schema: KarmaLib.getProjectUpdateSchemaUID(),
            data: AttestationRequestData({
                recipient: address(this),
                expirationTime: 0,
                revocable: true,
                refUID: gapProjectUID,
                data: impactData,
                value: 0
            })
        });

        bytes32 impactUID = gapContract.attest(req);

        emit GAPProjectImpactCreated(impactUID, gapProjectUID, _msgSender());

        return impactUID;
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
    /// @param milestoneMeta Assessment metadata (capitals, metrics, evidence)
    /// @return milestoneUID The milestone attestation UID
    function createProjectMilestone(
        string calldata milestoneTitle,
        string calldata milestoneDescription,
        string calldata milestoneMeta
    )
        external
        onlyResolver
        returns (bytes32)
    {
        if (gapProjectUID == bytes32(0)) revert GAPProjectNotInitialized();
        if (!KarmaLib.isSupported()) revert GAPNotSupportedOnChain();

        IKarmaGap gapContract = IKarmaGap(KarmaLib.getGapContract());

        // Build milestone JSON
        bytes memory milestoneData = abi.encode(
            string(
                abi.encodePacked(
                    "{'title':'",
                    _escapeJSON(milestoneTitle),
                    "',",
                    "'text:'",
                    _escapeJSON(milestoneDescription),
                    "',",
                    "'metadata':",
                    milestoneMeta,
                    ",",
                    "'completedAt':",
                    // solhint-disable-next-line not-rely-on-time
                    _uint2str(block.timestamp), // Metadata only - not used for access control
                    ",",
                    "'type':'project-milestone'}"
                )
            )
        );

        AttestationRequest memory req = AttestationRequest({
            schema: KarmaLib.getMilestoneSchemaUID(),
            data: AttestationRequestData({
                recipient: address(this),
                expirationTime: 0,
                revocable: true,
                refUID: gapProjectUID,
                data: milestoneData,
                value: 0
            })
        });

        bytes32 milestoneUID = gapContract.attest(req);

        emit GAPProjectMilestoneCreated(milestoneUID, gapProjectUID, _msgSender());

        return milestoneUID;
    }

    /// @notice Internal function to add GAP project admin
    /// @param admin Address to add as project admin
    function _addGAPProjectAdmin(address admin) private {
        IProjectResolver resolver = IProjectResolver(KarmaLib.getProjectResolver());

        try resolver.addAdmin(gapProjectUID, admin) {
            emit GAPProjectAdminAdded(gapProjectUID, admin);
            // solhint-disable-next-line no-empty-blocks
        } catch {
            // Intentionally ignore failures - operator addition succeeds even if GAP admin sync fails
        }
    }

    /// @notice Builds JSON for GAP project details
    function _buildGAPDetailsJSON() private view returns (string memory) {
        return string(
            abi.encodePacked(
                "{'title':'",
                _escapeJSON(name),
                "',",
                "'description':'",
                _escapeJSON(description),
                "',",
                "'imageURL':'",
                bannerImage,
                "',",
                "'location':'",
                _escapeJSON(location),
                "'}"
            )
        );
    }

    /// @notice Escapes double quotes in JSON strings
    function _escapeJSON(string memory str) private pure returns (string memory) {
        bytes memory b = bytes(str);
        uint256 quoteCount = 0;

        for (uint256 i = 0; i < b.length; i++) {
            if (b[i] == "'") quoteCount++;
        }

        if (quoteCount == 0) return str;

        bytes memory escaped = new bytes(b.length + quoteCount);
        uint256 j = 0;

        for (uint256 i = 0; i < b.length; i++) {
            if (b[i] == "'") {
                escaped[j++] = "\\";
            }
            escaped[j++] = b[i];
        }

        return string(escaped);
    }

    /// @notice Converts uint256 to string
    function _uint2str(uint256 _i) private pure returns (string memory) {
        if (_i == 0) return "0";

        uint256 temp = _i;
        uint256 digits;

        while (temp != 0) {
            digits++;
            temp /= 10;
        }

        bytes memory buffer = new bytes(digits);

        while (_i != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(_i % 10)));
            _i /= 10;
        }

        return string(buffer);
    }

    // ============================================
    // GAP STATE QUERY HELPERS
    // ============================================

    /// @notice Query all GAP project admins
    /// @dev Returns current admin list from GAP contract
    /// @return admins Array of admin addresses
    function getGAPProjectAdmins() external view returns (address[] memory admins) {
        if (gapProjectUID == bytes32(0)) revert GAPProjectNotInitialized();

        IProjectResolver resolver = IProjectResolver(KarmaLib.getProjectResolver());
        return resolver.getProjectAdmins(gapProjectUID);
    }

    /// @notice Check if address is GAP project admin
    /// @dev Queries GAP contract for admin status
    /// @param account The address to check
    /// @return isAdmin True if account is a project admin
    function isGAPProjectAdmin(address account) external view returns (bool isAdmin) {
        if (gapProjectUID == bytes32(0)) return false;

        IProjectResolver resolver = IProjectResolver(KarmaLib.getProjectResolver());
        return resolver.isProjectAdmin(gapProjectUID, account);
    }

    /// @notice Get GAP project metadata
    /// @dev Returns combined project info from GAP
    /// @return projectUID The project attestation UID
    /// @return isInitialized Whether GAP project exists
    function getGAPProjectMetadata() external view returns (bytes32 projectUID, bool isInitialized) {
        projectUID = gapProjectUID;
        isInitialized = projectUID != bytes32(0);
    }

    /// @notice Storage gap for upgradeable contract
    /// @dev Reserve 50 slots minus 15 existing state variables = 35 slots
    /// @dev Immutables (WORK_APPROVAL_RESOLVER, ASSESSMENT_RESOLVER) do NOT use storage slots
    /// State variables: communityToken(1) + name(1) + description(1) + location(1) +
    /// bannerImage(1) + gardeners(1) + gardenOperators(1) + gardenInvites(1) +
    /// inviteToGarden(1) + inviteExpiry(1) + inviteUsed(1) + openJoining(1) +
    /// gapProjectUID(1) + Initializable(1) + AccountV3Upgradable inherited slots(1) = 15
    uint256[35] private __gap;
}
