// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Burnable } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/// @title GoodsToken
/// @notice Standalone ERC-20 token for the Green Goods protocol
/// @dev Used on chains without Juicebox (Sepolia, Celo). Drop-in compatible with IJBToken
///      (standard ERC-20). Can later be replaced by a JB-backed token via setGoodsToken().
///      Supply is hard-capped at deployment to prevent governance inflation attacks.
contract GoodsToken is ERC20, ERC20Burnable, Ownable {
    /// @notice Maximum total supply (immutable, set at deployment)
    uint256 public immutable maxSupply;

    /// @notice Thrown when a mint would exceed maxSupply
    error ExceedsMaxSupply(uint256 requested, uint256 available);

    /// @notice Thrown when maxSupply is zero (must be positive)
    error MaxSupplyZero();

    /// @notice Deploy GOODS token with initial supply minted to owner
    /// @param _name Token name (e.g., "Green Goods")
    /// @param _symbol Token symbol (e.g., "GOODS")
    /// @param _owner Address that can mint new tokens
    /// @param _initialSupply Initial supply minted to owner (18 decimals)
    /// @param _maxSupply Maximum total supply (must be >= _initialSupply)
    constructor(
        string memory _name,
        string memory _symbol,
        address _owner,
        uint256 _initialSupply,
        uint256 _maxSupply
    )
        ERC20(_name, _symbol)
    {
        if (_maxSupply == 0) revert MaxSupplyZero();
        if (_initialSupply > _maxSupply) revert ExceedsMaxSupply(_initialSupply, _maxSupply);
        maxSupply = _maxSupply;
        _transferOwnership(_owner);
        _mint(_owner, _initialSupply);
    }

    /// @notice Mint new GOODS tokens (only owner — protocol deployer or GardensModule)
    /// @param to Recipient address
    /// @param amount Amount to mint (18 decimals)
    function mint(address to, uint256 amount) external onlyOwner {
        uint256 available = maxSupply - totalSupply();
        if (amount > available) revert ExceedsMaxSupply(amount, available);
        _mint(to, amount);
    }
}
