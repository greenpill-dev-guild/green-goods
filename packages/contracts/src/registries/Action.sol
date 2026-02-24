// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.25;

import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { IHatsModule } from "../interfaces/IHatsModule.sol";

error NotActionOwner();
error EndTimeBeforeStartTime();
error StartTimeAfterEndTime();
error NotGardenOperator();
error InvalidDomainMask();
error NotGardenToken();
error ZeroAddress();

// ENUMS
enum Capital {
    SOCIAL,
    MATERIAL,
    FINANCIAL,
    LIVING,
    INTELLECTUAL,
    EXPERIENTIAL,
    SPIRITUAL,
    CULTURAL
}

/// @notice Domain categories for actions
enum Domain {
    SOLAR, // 0
    AGRO, // 1
    EDU, // 2
    WASTE // 3

}

/// @title Action Registry Contract
/// @notice This contract allows the owner to register and manage actions.
/// @dev This contract is upgradeable using the UUPS proxy pattern.
contract ActionRegistry is UUPSUpgradeable, OwnableUpgradeable {
    /// @dev Represents an action with its metadata.
    struct Action {
        uint256 startTime;
        uint256 endTime;
        string title;
        string slug;
        string instructions;
        Capital[] capitals;
        string[] media;
        Domain domain;
    }

    /// @notice Emitted when a new action is registered.
    /// @param owner The address of the action owner.
    /// @param actionUID The unique identifier of the action.
    /// @param startTime The start time of the action.
    /// @param endTime The end time of the action.
    /// @param title The title of the action.
    /// @param slug The slug identifier of the action.
    /// @param instructions The instructions of the action.
    /// @param capitals The capitals of the action.
    /// @param media The media of the action.
    /// @param domain The domain category of the action.
    event ActionRegistered(
        address owner,
        uint256 indexed actionUID,
        uint256 indexed startTime,
        uint256 indexed endTime,
        string title,
        string slug,
        string instructions,
        Capital[] capitals,
        string[] media,
        Domain domain
    );

    /// @notice Emitted when a garden's domain bitmask is updated.
    event GardenDomainsUpdated(address indexed garden, uint8 indexed domainMask);

    /// @notice Emitted when the HatsModule address is updated.
    event HatsModuleUpdated(address indexed oldModule, address indexed newModule);

    /// @notice Emitted when the GardenToken address is updated.
    event GardenTokenUpdated(address indexed oldToken, address indexed newToken);

    /// @notice Emitted when an existing action is start time is updated.
    /// @param owner The address of the action owner.
    /// @param actionUID The unique identifier of the action.
    /// @param startTime The new start time of the action.
    event ActionStartTimeUpdated(address indexed owner, uint256 indexed actionUID, uint256 indexed startTime);

    /// @notice Emitted when an existing action is end time is updated.
    /// @param owner The address of the action owner.
    /// @param actionUID The unique identifier of the action.
    /// @param endTime The new end time of the action.
    event ActionEndTimeUpdated(address indexed owner, uint256 indexed actionUID, uint256 indexed endTime);

    /// @notice Emitted when an existing action is title is updated.
    /// @param owner The address of the action owner.
    /// @param actionUID The unique identifier of the action.
    /// @param title The new title of the action.
    event ActionTitleUpdated(address indexed owner, uint256 indexed actionUID, string title);

    /// @notice Emitted when an existing action is instructions are updated.
    /// @param owner The address of the action owner.
    /// @param actionUID The unique identifier of the action.
    /// @param instructions The new instructions of the action.
    event ActionInstructionsUpdated(address indexed owner, uint256 indexed actionUID, string instructions);

    /// @notice Emitted when an existing action is media is updated.
    /// @param owner The address of the action owner.
    /// @param actionUID The unique identifier of the action.
    /// @param media The new media URLs of the action.
    event ActionMediaUpdated(address indexed owner, uint256 indexed actionUID, string[] media);

    uint256 private _nextActionUID;

    mapping(uint256 actionUID => address owner) public actionToOwner;
    mapping(uint256 actionUID => Action action) public idToAction;

    /// @notice Domain bitmask per garden (bit 0=Solar, 1=Agro, 2=Edu, 3=Waste)
    mapping(address garden => uint8 domainMask) public gardenDomains;

    /// @notice HatsModule for operator role checks
    address public hatsModule;

    /// @notice GardenToken address (for setGardenDomainsFromMint authorization)
    address public gardenToken;

    /**
     * @dev Storage gap for future upgrades
     * Reserves 44 slots (50 total - 6 used: _nextActionUID, actionToOwner, idToAction,
     * gardenDomains, hatsModule, gardenToken)
     * Allows adding new state variables without breaking storage layout in upgrades
     */
    uint256[44] private __gap;

    modifier onlyActionOwner(uint256 actionUID) {
        if (_msgSender() != actionToOwner[actionUID]) {
            revert NotActionOwner();
        }
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the contract and sets the specified address as the owner.
    /// @dev This function must be called only once during contract deployment.
    /// @param _multisig The address that will own the contract.
    function initialize(address _multisig) external initializer {
        __Ownable_init();
        _transferOwnership(_multisig);
    }

    function getAction(uint256 actionUID) external view returns (Action memory) {
        return idToAction[actionUID];
    }

    /// @notice Registers a new action with the specified parameters.
    /// @param _startTime The start time of the action.
    /// @param _endTime The end time of the action.
    /// @param _title The title of the action.
    /// @param _slug The slug identifier (e.g., "waste.cleanup_event").
    /// @param _instructions The CID JSON instructions for the action.
    /// @param _capitals An array of Capital structs associated with the action.
    /// @param _media An array of media CIDs associated with the action.
    /// @param _domain The domain category for this action.
    function registerAction(
        uint256 _startTime,
        uint256 _endTime,
        string calldata _title,
        string calldata _slug,
        string calldata _instructions,
        Capital[] calldata _capitals,
        string[] calldata _media,
        Domain _domain
    )
        external
        onlyOwner
    {
        if (_endTime <= _startTime) revert EndTimeBeforeStartTime();

        uint256 actionUID = _nextActionUID++;

        actionToOwner[actionUID] = _msgSender();
        idToAction[actionUID] = Action(_startTime, _endTime, _title, _slug, _instructions, _capitals, _media, _domain);

        emit ActionRegistered(
            _msgSender(), actionUID, _startTime, _endTime, _title, _slug, _instructions, _capitals, _media, _domain
        );
    }

    /// @notice Updates the start time of an existing action.
    /// @param actionUID The unique identifier of the action to update.
    /// @param _startTime The new start time of the action.
    function updateActionStartTime(uint256 actionUID, uint256 _startTime) external onlyActionOwner(actionUID) {
        if (_startTime >= idToAction[actionUID].endTime) revert StartTimeAfterEndTime();
        idToAction[actionUID].startTime = _startTime;

        emit ActionStartTimeUpdated(actionToOwner[actionUID], actionUID, _startTime);
    }

    /// @notice Updates the end time of an existing action.
    /// @param actionUID The unique identifier of the action to update.
    /// @param _endTime The new end time of the action.
    function updateActionEndTime(uint256 actionUID, uint256 _endTime) external onlyActionOwner(actionUID) {
        if (_endTime <= idToAction[actionUID].startTime) revert EndTimeBeforeStartTime();
        idToAction[actionUID].endTime = _endTime;

        emit ActionEndTimeUpdated(actionToOwner[actionUID], actionUID, _endTime);
    }

    /// @notice Updates the title of an existing action.
    /// @param actionUID The unique identifier of the action to update.
    /// @param _title The new title for the action.
    function updateActionTitle(uint256 actionUID, string calldata _title) external onlyActionOwner(actionUID) {
        idToAction[actionUID].title = _title;

        emit ActionTitleUpdated(actionToOwner[actionUID], actionUID, _title);
    }

    /// @notice Updates the instructions for an existing action.
    /// @param actionUID The unique identifier of the action to update.
    /// @param _instructions The new instructions for the action.
    function updateActionInstructions(
        uint256 actionUID,
        string calldata _instructions
    )
        external
        onlyActionOwner(actionUID)
    {
        idToAction[actionUID].instructions = _instructions;

        emit ActionInstructionsUpdated(actionToOwner[actionUID], actionUID, _instructions);
    }

    /// @notice Updates the media associated with an existing action.
    /// @param actionUID The unique identifier of the action to update.
    /// @param _media The new array of media URLs to associate with the action.
    function updateActionMedia(uint256 actionUID, string[] memory _media) external onlyActionOwner(actionUID) {
        idToAction[actionUID].media = _media;

        emit ActionMediaUpdated(actionToOwner[actionUID], actionUID, _media);
    }

    // =========================================================================
    // Domain Management
    // =========================================================================

    /// @notice Sets the domain bitmask for a garden. Callable by garden operators.
    /// @param garden The garden address
    /// @param _domainMask Bitmask of enabled domains (bit 0=Solar, 1=Agro, 2=Edu, 3=Waste)
    function setGardenDomains(address garden, uint8 _domainMask) external {
        if (_domainMask > 0x0F) revert InvalidDomainMask();
        if (hatsModule == address(0)) revert ZeroAddress();
        if (!IHatsModule(hatsModule).isOperatorOf(garden, _msgSender())) revert NotGardenOperator();
        gardenDomains[garden] = _domainMask;
        emit GardenDomainsUpdated(garden, _domainMask);
    }

    /// @notice Sets the domain bitmask for a garden during mint. Callable by GardenToken only.
    /// @param garden The garden address
    /// @param _domainMask Bitmask of enabled domains (bit 0=Solar, 1=Agro, 2=Edu, 3=Waste)
    function setGardenDomainsFromMint(address garden, uint8 _domainMask) external {
        if (_msgSender() != gardenToken) revert NotGardenToken();
        if (_domainMask > 0x0F) revert InvalidDomainMask();
        gardenDomains[garden] = _domainMask;
        emit GardenDomainsUpdated(garden, _domainMask);
    }

    /// @notice Checks if a garden has a specific domain enabled
    /// @param garden The garden address
    /// @param _domain The domain to check
    /// @return Whether the garden has the domain enabled
    function gardenHasDomain(address garden, Domain _domain) external view returns (bool) {
        return (gardenDomains[garden] & (1 << uint8(_domain))) != 0;
    }

    /// @notice Sets the HatsModule address (owner only)
    /// @param _hatsModule The new HatsModule address
    function setHatsModule(address _hatsModule) external onlyOwner {
        if (_hatsModule == address(0)) revert ZeroAddress();
        address oldModule = hatsModule;
        hatsModule = _hatsModule;
        emit HatsModuleUpdated(oldModule, _hatsModule);
    }

    /// @notice Sets the GardenToken address (owner only)
    /// @param _gardenToken The new GardenToken address
    function setGardenToken(address _gardenToken) external onlyOwner {
        if (_gardenToken == address(0)) revert ZeroAddress();
        address oldToken = gardenToken;
        gardenToken = _gardenToken;
        emit GardenTokenUpdated(oldToken, _gardenToken);
    }

    /// @dev Authorizes an upgrade to the contract's implementation.
    /// @param newImplementation The address of the new implementation contract.
    /// @custom:oz-upgrades-unsafe-allow override
    // solhint-disable-next-line no-empty-blocks
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {
        // Intentionally empty - UUPS upgrade authorization handled by onlyOwner modifier
    }
}
