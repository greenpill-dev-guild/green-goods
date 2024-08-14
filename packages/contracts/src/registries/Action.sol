// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

error NotActionResolver();
error NotActionOwner();
error InvalidActionData();

contract ActionRegistry {
    enum ActionCategory {
        LIVING,
        SOCIAL
    }

    struct ActionStruct  {
        uint frequency;
        ActionCategory category;
        string metadata;
    }

    event ActionRegistered(address indexed creator, /*uint256 hypercertId,*/ string[] capitals, string metadata);
    event ActionUpdated(address indexed creator, /*uint256 hypercertId,*/ string[] capitals, string metadata);

    address private actionResolver;

    mapping(bytes32 => address) public actionToOwner;
    mapping(bytes32 => ActionStruct) public idToActionData; 

    constructor(
        address _actionResolver
    ) {
        actionResolver = _actionResolver;
    }

    function registerAction(
        address _owner,
        bytes32 _id,
        uint _frequency,
        ActionCategory _category,
        string calldata _metadata
    ) external {
        // Check that sender is the resolver
        if (msg.sender != actionResolver) {
            revert NotActionResolver();
        }

        // Create mapping for action to owner
        actionToOwner[_id] = _owner;

        // Create mapping for action id to action data
        idToActionData[_id] = ActionStruct(_frequency, _category, _metadata);
      
    }

    function updateActionFrequency(
        bytes32 _id,
        uint _frequency
    ) external returns(address, uint256){
        address owner = actionToOwner[_id];

        if (msg.sender != owner) {
            revert NotActionOwner();
        }

        ActionStruct memory action = idToActionData[_id];

        action.frequency = _frequency;

        idToActionData[_id] = action;
    }

     function updateActionCategory(
        bytes32 _id,
        ActionCategory _category
    ) external returns(address, uint256){
        address owner = actionToOwner[_id];

        if (msg.sender != owner) {
            revert NotActionOwner();
        }

        ActionStruct memory action = idToActionData[_id];

        action.category = _category;

        idToActionData[_id] = action;
    }

     function updateActionMetadata(
        bytes32 _id,
        string calldata _metadata
    ) external returns(address, uint256){
        address owner = actionToOwner[_id];

        if (msg.sender != owner) {
            revert NotActionOwner();
        }

        ActionStruct memory action = idToActionData[_id];

        action.metadata = _metadata;

        idToActionData[_id] = action;
    }
}
