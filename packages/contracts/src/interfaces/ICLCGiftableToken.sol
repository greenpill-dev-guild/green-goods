// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/// @notice Hand-written integration interface from CLC docs/SPEC.md, GiftableToken section,
///         at ce090fd3d5a7493c726fb939da39af15ef1c9d7c. No upstream implementation is imported.
interface ICLCGiftableToken is IERC20Metadata {
    function initialize(
        string calldata name,
        string calldata symbol,
        uint8 decimals,
        address owner,
        uint256 expiresAt
    )
        external;

    function mintTo(address recipient, uint256 amount) external;

    function owner() external view returns (address);

    function isWriter(address account) external view returns (bool);
}

/// @notice Hand-written Solady factory interface from CLC docs/DEPLOY.md at the same pin.
interface ICLCERC1967Factory {
    function deployAndCall(
        address implementation,
        address admin,
        bytes calldata data
    )
        external
        payable
        returns (address proxy);

    function adminOf(address proxy) external view returns (address);
}
