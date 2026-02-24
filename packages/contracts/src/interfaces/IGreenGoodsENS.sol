// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title IGreenGoodsENS
/// @notice Interface for the L2 ENS registration sender
interface IGreenGoodsENS {
    enum NameType {
        Gardener,
        Garden
    }

    function registerGarden(string calldata slug, address gardenAccount) external payable;
    function claimName(string calldata slug) external payable; // user-funded (wallet users)
    function claimNameSponsored(string calldata slug) external; // contract-funded (passkey users)
    function releaseName() external payable;
    function available(string calldata slug) external view returns (bool);
    function getRegistrationFee(string calldata slug, address owner, NameType nameType) external view returns (uint256);
}
