// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.25;

import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import { Capital } from "../Constants.sol";

error NotActionOwner();

/// @title Action Registry Contract
/// @notice This contract allows the owner to register and manage actions.
/// @dev This contract is upgradeable using the UUPS proxy pattern.
contract ActionRegistry is UUPSUpgradeable, OwnableUpgradeable {
    /// @dev Represents an action with its metadata.
    struct Action {
        uint256 startTime;
        uint256 endTime;
        string title;
        string instructions;
        Capital[] capitals;
        string[] media;
    }

    /// @notice Emitted when a new action is registered.
    /// @param owner The address of the action owner.
    /// @param actionUID The unique identifier of the action.
    /// @param action The details of the registered action.
    /// @param timestamp The timestamp of the registration.
    event ActionRegistered(address indexed owner, uint256 indexed actionUID, Action indexed action, uint256 timestamp);

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
    event ActionTitleUpdated(address indexed owner, uint256 indexed actionUID, string indexed title);

    /// @notice Emitted when an existing action is instructions are updated.
    /// @param owner The address of the action owner.
    /// @param actionUID The unique identifier of the action.
    /// @param instructions The new instructions of the action.
    event ActionInstructionsUpdated(address indexed owner, uint256 indexed actionUID, string indexed instructions);

    /// @notice Emitted when an existing action is media is updated.
    /// @param owner The address of the action owner.
    /// @param actionUID The unique identifier of the action.
    /// @param media The new media URLs of the action.
    event ActionMediaUpdated(address indexed owner, uint256 indexed actionUID, string[] indexed media);

    uint256 private _nextActionUID;

    mapping(uint256 actionUID => address owner) public actionToOwner;
    mapping(uint256 actionUID => Action action) public idToAction;

    modifier onlyActionOwner(uint256 actionUID) {
        if (_msgSender() != actionToOwner[actionUID]) {
            revert NotActionOwner();
        }
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {}

    /// @notice Initializes the contract and sets the multisig wallet as the owner.
    /// @dev This function must be called only once during contract deployment.
    /// @param _multisig The address of the multisig wallet to transfer ownership to.
    function initialize(address _multisig) external initializer {
        __Ownable_init();
        // transferOwnership(_multisig);
        // _disableInitializers();
    }

    function getAction(uint256 actionUID) external view returns (Action memory) {
        return idToAction[actionUID];
    }

    /// @notice Registers a new action with the specified parameters.
    /// @param _startTime The start time of the action.
    /// @param _endTime The end time of the action.
    /// @param _instructions The CID JSON instructions for the action.
    /// @param _capitals An array of Capital structs associated with the action.
    /// @param _media An array of media CIDs associated with the action.
    function registerAction(
        uint256 _startTime,
        uint256 _endTime,
        string calldata _title,
        string calldata _instructions,
        Capital[] calldata _capitals,
        string[] calldata _media
    ) external onlyOwner {
        uint256 actionUID = _nextActionUID++;

        actionToOwner[actionUID] = _msgSender();
        idToAction[actionUID] = Action(_startTime, _endTime, _title, _instructions, _capitals, _media);

        emit ActionRegistered(_msgSender(), actionUID, idToAction[actionUID], block.timestamp);
    }

    /// @notice Updates the start time of an existing action.
    /// @param actionUID The unique identifier of the action to update.
    /// @param _startTime The new start time of the action.
    function updateActionStartTime(uint256 actionUID, uint256 _startTime) external onlyActionOwner(actionUID) {
        idToAction[actionUID].startTime = _startTime;

        emit ActionStartTimeUpdated(actionToOwner[actionUID], actionUID, _startTime);
    }

    /// @notice Updates the end time of an existing action.
    /// @param actionUID The unique identifier of the action to update.
    /// @param _endTime The new end time of the action.
    function updateActionEndTime(uint256 actionUID, uint256 _endTime) external onlyActionOwner(actionUID) {
        idToAction[actionUID].endTime = _endTime;

        emit ActionEndTimeUpdated(actionToOwner[actionUID], actionUID, _endTime);}

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
    ) external onlyActionOwner(actionUID) {
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

    /// @dev Authorizes an upgrade to the contract's implementation.
    /// @param newImplementation The address of the new implementation contract.
    /// @custom:oz-upgrades-unsafe-allow override
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
