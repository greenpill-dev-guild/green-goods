// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Ownable } from "@openzeppelin/contracts@5.0.2/access/Ownable.sol";
import { ERC20 } from "@openzeppelin/contracts@5.0.2/token/ERC20/ERC20.sol";
import { ERC4626 } from "@openzeppelin/contracts@5.0.2/token/ERC20/extensions/ERC4626.sol";
import { IERC20 } from "@openzeppelin/contracts@5.0.2/token/ERC20/IERC20.sol";
import { IERC20Metadata } from "@openzeppelin/contracts@5.0.2/token/ERC20/extensions/IERC20Metadata.sol";
import { SafeERC20 } from "@openzeppelin/contracts@5.0.2/token/ERC20/utils/SafeERC20.sol";

import { IOctantStrategy } from "../interfaces/IOctantFactory.sol";

interface IAaveV3Pool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function withdraw(address asset, uint256 amount, address to) external returns (uint256 withdrawnAmount);
}

interface IAToken {
    function balanceOf(address account) external view returns (uint256);
}

interface IPoolDataProvider {
    function getReserveConfigurationData(address asset)
        external
        view
        returns (
            uint256 decimals,
            uint256 ltv,
            uint256 liquidationThreshold,
            uint256 liquidationBonus,
            uint256 reserveFactor,
            bool usageAsCollateralEnabled,
            bool borrowingEnabled,
            bool stableBorrowRateEnabled,
            bool isActive,
            bool isFrozen
        );

    function getReserveCaps(address asset) external view returns (uint256 borrowCap, uint256 supplyCap);
    function getPaused(address asset) external view returns (bool isPaused);
    function getATokenTotalSupply(address asset) external view returns (uint256);
}

/// @title AaveV3ERC4626
/// @notice ERC-4626 wrapper that deploys vault debt into Aave V3 while keeping OctantStrategy compatibility.
contract AaveV3ERC4626 is ERC4626, Ownable, IOctantStrategy {
    using SafeERC20 for IERC20;

    error ZeroAddress();
    error OnlyVault();
    error VaultAlreadySet();

    event DonationAddressUpdated(address indexed oldAddress, address indexed newAddress);
    event DepositsPauseUpdated(bool paused);
    event FundsDeployed(uint256 amount);
    event FundsFreed(uint256 amount, address indexed receiver);
    event StrategyReported(uint256 totalAssets);

    IAaveV3Pool public immutable aavePool;
    IAToken public immutable aToken;
    IPoolDataProvider public immutable dataProvider;

    address public vault;
    address public donationAddress;
    bool public depositsPaused;

    constructor(
        address asset_,
        string memory name_,
        string memory symbol_,
        address pool_,
        address aToken_,
        address dataProvider_,
        address initialOwner_
    )
        ERC20(name_, symbol_)
        ERC4626(IERC20(asset_))
        Ownable(initialOwner_)
    {
        if (
            asset_ == address(0) || pool_ == address(0) || aToken_ == address(0) || dataProvider_ == address(0)
                || initialOwner_ == address(0)
        ) {
            revert ZeroAddress();
        }

        aavePool = IAaveV3Pool(pool_);
        aToken = IAToken(aToken_);
        dataProvider = IPoolDataProvider(dataProvider_);
        depositsPaused = false;

        IERC20(asset_).forceApprove(pool_, type(uint256).max);
    }

    modifier onlyVault() {
        if (msg.sender != vault) revert OnlyVault();
        _;
    }

    function setVault(address vault_) external onlyOwner {
        if (vault != address(0)) revert VaultAlreadySet();
        if (vault_ == address(0)) revert ZeroAddress();
        vault = vault_;
    }

    function deposit(uint256 assets, address receiver) public override onlyVault returns (uint256) {
        return super.deposit(assets, receiver);
    }

    function mint(uint256 shares, address receiver) public override onlyVault returns (uint256) {
        return super.mint(shares, receiver);
    }

    function totalAssets() public view override returns (uint256) {
        return IERC20(asset()).balanceOf(address(this)) + aToken.balanceOf(address(this));
    }

    function maxDeposit(address) public view override returns (uint256) {
        if (depositsPaused) {
            return 0;
        }

        (,,,,,,,, bool isActive, bool isFrozen) = dataProvider.getReserveConfigurationData(asset());
        if (!isActive || isFrozen || dataProvider.getPaused(asset())) {
            return 0;
        }

        (, uint256 supplyCap) = dataProvider.getReserveCaps(asset());
        if (supplyCap == 0) {
            return type(uint256).max;
        }

        uint256 totalSupply = dataProvider.getATokenTotalSupply(asset());
        uint256 supplyCapScaled = supplyCap * 10 ** IERC20Metadata(asset()).decimals();
        if (supplyCapScaled <= totalSupply) {
            return 0;
        }

        return supplyCapScaled - totalSupply;
    }

    function maxMint(address receiver) public view override returns (uint256) {
        uint256 maxAssets = maxDeposit(receiver);
        if (maxAssets == type(uint256).max) {
            return type(uint256).max;
        }
        return previewDeposit(maxAssets);
    }

    /// @notice Cap withdrawals to available liquidity (idle balance + aToken-held underlying).
    /// @dev During high Aave utilization the pool may not have enough underlying to cover a full withdrawal.
    ///      In Aave V3, the underlying asset is held by the aToken contract, NOT the Pool proxy.
    ///      Reading IERC20(asset).balanceOf(aToken) gives the actual withdrawable liquidity.
    function maxWithdraw(address owner) public view override returns (uint256) {
        uint256 ownerAssets = convertToAssets(balanceOf(owner));
        uint256 availableLiquidity = IERC20(asset()).balanceOf(address(aToken));
        uint256 idle = IERC20(asset()).balanceOf(address(this));
        uint256 available = availableLiquidity + idle;
        return ownerAssets < available ? ownerAssets : available;
    }

    /// @notice Cap redemptions to the share equivalent of maxWithdraw.
    /// @dev When liquidity covers the full position, returns balanceOf(owner) directly
    ///      to avoid the double-rounding loss from convertToAssets→convertToShares.
    function maxRedeem(address owner) public view override returns (uint256) {
        uint256 ownerShares = balanceOf(owner);
        uint256 ownerAssets = convertToAssets(ownerShares);
        uint256 maxAssets = maxWithdraw(owner);
        // Full position is withdrawable — return exact shares to avoid rounding loss
        if (maxAssets >= ownerAssets) return ownerShares;
        return convertToShares(maxAssets);
    }

    function report() external override returns (uint256 totalManagedAssets) {
        totalManagedAssets = totalAssets();
        emit StrategyReported(totalManagedAssets);
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

    /// @dev SAFETY: super._deposit transfers tokens before aavePool.supply. Between
    ///      these calls, totalAssets() double-counts. This is safe because WETH/DAI have
    ///      no token callbacks (ERC-777/hooks). DO NOT add support for callback tokens
    ///      without reordering this function.
    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
        super._deposit(caller, receiver, assets, shares);
        if (assets > 0) {
            aavePool.supply(asset(), assets, address(this), 0);
            emit FundsDeployed(assets);
        }
    }

    function _withdraw(address caller, address receiver, address owner, uint256 assets, uint256 shares) internal override {
        uint256 idleBalance = IERC20(asset()).balanceOf(address(this));
        if (idleBalance < assets) {
            aavePool.withdraw(asset(), assets - idleBalance, address(this));
            uint256 totalAvailable = IERC20(asset()).balanceOf(address(this));
            require(totalAvailable >= assets, "Aave: insufficient liquidity");
            emit FundsFreed(assets - idleBalance, receiver);
        }

        super._withdraw(caller, receiver, owner, assets, shares);
    }
}
