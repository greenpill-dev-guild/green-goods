// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { IOctantStrategy } from "../interfaces/IOctantFactory.sol";

interface IAaveV3Pool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function withdraw(address asset, uint256 amount, address to) external returns (uint256 withdrawnAmount);
}

interface IAToken {
    function balanceOf(address account) external view returns (uint256);
}

/// @title AaveV3
/// @notice Minimal strategy wrapper used by Octant vault integration
/// @dev Exposes report/shutdown/donation hooks expected by OctantModule
contract AaveV3 is Ownable, IOctantStrategy {
    error ZeroAddress();
    error DepositsPaused();

    event DonationAddressUpdated(address indexed oldAddress, address indexed newAddress);
    event DepositsPauseUpdated(bool paused);
    event FundsDeployed(uint256 amount);
    event FundsFreed(uint256 amount, address indexed receiver);
    event StrategyReported(uint256 totalAssets);

    IERC20 public immutable underlyingAsset;
    IAaveV3Pool public immutable aavePool;
    IAToken public immutable aToken;

    address public donationAddress;
    bool public depositsPaused;

    constructor(address asset, address pool, address aTokenAddress, address initialOwner) {
        if (asset == address(0) || pool == address(0) || aTokenAddress == address(0) || initialOwner == address(0)) {
            revert ZeroAddress();
        }
        underlyingAsset = IERC20(asset);
        aavePool = IAaveV3Pool(pool);
        aToken = IAToken(aTokenAddress);

        if (initialOwner != msg.sender) {
            _transferOwnership(initialOwner);
        }
    }

    function setDonationAddress(address newDonationAddress) external override onlyOwner {
        if (newDonationAddress == address(0)) revert ZeroAddress();
        address oldAddress = donationAddress;
        donationAddress = newDonationAddress;
        emit DonationAddressUpdated(oldAddress, newDonationAddress);
    }

    function setDepositsPaused(bool paused) external onlyOwner {
        depositsPaused = paused;
        emit DepositsPauseUpdated(paused);
    }

    function shutdown() external override onlyOwner {
        if (!depositsPaused) {
            depositsPaused = true;
            emit DepositsPauseUpdated(true);
        }
    }

    /// @notice Deploys funds from this strategy to Aave V3
    function deployFunds(uint256 amount) external onlyOwner {
        if (depositsPaused) revert DepositsPaused();
        underlyingAsset.approve(address(aavePool), amount);
        aavePool.supply(address(underlyingAsset), amount, address(this), 0);
        emit FundsDeployed(amount);
    }

    /// @notice Frees funds from Aave V3 to a receiver address
    function freeFunds(uint256 amount, address receiver) external onlyOwner returns (uint256 withdrawnAmount) {
        withdrawnAmount = aavePool.withdraw(address(underlyingAsset), amount, receiver);
        emit FundsFreed(withdrawnAmount, receiver);
    }

    /// @notice Reports strategy-managed assets to caller
    /// @dev Sums idle underlying balance + aToken balance (funds deployed to Aave)
    function report() external override returns (uint256 totalAssets) {
        totalAssets = underlyingAsset.balanceOf(address(this)) + aToken.balanceOf(address(this));
        emit StrategyReported(totalAssets);
    }
}
