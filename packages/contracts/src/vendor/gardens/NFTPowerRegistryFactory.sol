// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { NFTPowerRegistry } from "./NFTPowerRegistry.sol";
import { INFTPowerRegistryFactory, NFTPowerSource as GGPowerSource, NFTType } from "../../interfaces/IGardensV2.sol";

/// @title NFTPowerRegistryFactory
/// @notice Deploys NFTPowerRegistry instances from Green Goods NFTPowerSource structs.
/// @dev GG's NFTPowerSource is 1:1 with the vendor struct (same 5 fields, same enum ordering).
///      The factory maps fields directly and casts NFTType via uint8. hatsProtocol is derived
///      by scanning for the first HAT source (address(0) if none — vendor constructor allows this).
contract NFTPowerRegistryFactory is INFTPowerRegistryFactory {
    /// @inheritdoc INFTPowerRegistryFactory
    function deploy(GGPowerSource[] calldata sources) external override returns (address registry) {
        NFTPowerRegistry.NFTPowerSource[] memory converted = new NFTPowerRegistry.NFTPowerSource[](sources.length);
        address hatsProtocol;

        for (uint256 i = 0; i < sources.length; i++) {
            converted[i] = NFTPowerRegistry.NFTPowerSource({
                token: sources[i].token,
                nftType: NFTPowerRegistry.NFTType(uint8(sources[i].nftType)),
                weight: sources[i].weight,
                tokenId: sources[i].tokenId,
                hatId: sources[i].hatId
            });

            // Derive hatsProtocol from first HAT source encountered
            if (hatsProtocol == address(0) && sources[i].nftType == NFTType.HAT) {
                hatsProtocol = sources[i].token;
            }
        }

        registry = address(new NFTPowerRegistry(hatsProtocol, converted));
    }
}
