// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Script, console } from "forge-std/Script.sol";

interface IHatsStewardRelabel {
    function changeHatDetails(uint256 hatId, string calldata newDetails) external;

    function isAdminOfHat(address user, uint256 hatId) external view returns (bool);

    function viewHat(uint256 hatId)
        external
        view
        returns (
            string memory details,
            uint32 maxSupply,
            uint32 supply,
            address eligibility,
            address toggle,
            string memory imageURI,
            uint16 lastHatId,
            bool mutable_,
            bool active
        );
}

/// @notice Executes a reviewed PRD-748 direct-admin relabel plan.
/// @dev The plan path must be inside the Foundry project and supplied through
///      STEWARD_RELABEL_PLAN. The script fails closed if caller authorization,
///      current labels, mutability, or target count drift before broadcast.
contract RelabelStewardHats is Script {
    uint256 internal constant ARBITRUM_CHAIN_ID = 42_161;

    function run() external {
        require(block.chainid == ARBITRUM_CHAIN_ID, "Steward relabel: Arbitrum only");

        string memory planPath = vm.envString("STEWARD_RELABEL_PLAN");
        string memory json = vm.readFile(planPath);
        string memory planChainIdText = abi.decode(vm.parseJson(json, ".chainId"), (string));
        uint256 planChainId = vm.parseUint(planChainIdText);
        uint256 targetCount = abi.decode(vm.parseJson(json, ".targetCount"), (uint256));
        address caller = abi.decode(vm.parseJson(json, ".caller"), (address));
        address hatsAddress = abi.decode(vm.parseJson(json, ".hatsProtocol"), (address));

        require(planChainId == ARBITRUM_CHAIN_ID, "Steward relabel: wrong plan chain");
        require(targetCount > 0, "Steward relabel: empty plan");
        require(caller != address(0) && hatsAddress != address(0), "Steward relabel: zero address");

        IHatsStewardRelabel hats = IHatsStewardRelabel(hatsAddress);
        _preflight(json, hats, caller, targetCount);

        console.log("Relabeling Steward hats through:", hatsAddress);
        console.log("Authorized caller:", caller);
        console.log("Target count:", targetCount);

        vm.startBroadcast(caller);
        for (uint256 index = 0; index < targetCount; index++) {
            (uint256 hatId,, string memory targetDetails) = _planEntry(json, index);
            hats.changeHatDetails(hatId, targetDetails);
        }
        vm.stopBroadcast();

        for (uint256 index = 0; index < targetCount; index++) {
            (uint256 hatId,, string memory targetDetails) = _planEntry(json, index);
            (string memory details,,,,,,, bool mutable_, bool active) = hats.viewHat(hatId);
            require(keccak256(bytes(details)) == keccak256(bytes(targetDetails)), "Steward relabel: write mismatch");
            require(mutable_ && active, "Steward relabel: hat state changed");
        }

        console.log("Steward hat relabel completed successfully");
    }

    function _preflight(string memory json, IHatsStewardRelabel hats, address caller, uint256 targetCount) internal view {
        for (uint256 index = 0; index < targetCount; index++) {
            (uint256 hatId, string memory currentDetails,) = _planEntry(json, index);
            (string memory details,,,,,,, bool mutable_, bool active) = hats.viewHat(hatId);
            require(keccak256(bytes(details)) == keccak256(bytes(currentDetails)), "Steward relabel: stale details");
            require(mutable_ && active, "Steward relabel: hat is not mutable and active");
            require(hats.isAdminOfHat(caller, hatId), "Steward relabel: caller is not admin");
        }
    }

    function _planEntry(
        string memory json,
        uint256 index
    )
        internal
        pure
        returns (uint256 hatId, string memory currentDetails, string memory targetDetails)
    {
        string memory basePath = string.concat(".transactions[", vm.toString(index), "]");
        string memory hatIdText = abi.decode(vm.parseJson(json, string.concat(basePath, ".operatorHatId")), (string));
        hatId = vm.parseUint(hatIdText);
        currentDetails = abi.decode(vm.parseJson(json, string.concat(basePath, ".currentDetails")), (string));
        targetDetails = abi.decode(vm.parseJson(json, string.concat(basePath, ".targetDetails")), (string));
    }
}
