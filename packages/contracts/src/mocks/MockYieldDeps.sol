// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IHypercertMarketplace } from "../yield/IHypercertMarketplace.sol";

/// @title MockCookieJar
/// @notice Mock cookie jar for testing — simply holds ERC-20 deposits
contract MockCookieJar {
    mapping(address asset => uint256 balance) public deposits;

    /// @notice Receive ERC-20 tokens (no-op, just tracks)
    /// @dev In production, Cookie Jar has Hats-gated withdrawal
    function getDeposits(address asset) external view returns (uint256) {
        return deposits[asset];
    }
}

/// @title MockHypercertMarketplace
/// @notice Mock marketplace for testing fraction purchases
contract MockHypercertMarketplace is IHypercertMarketplace {
    struct Purchase {
        uint256 hypercertId;
        uint256 amount;
        address asset;
        address recipient;
    }

    Purchase[] public purchases;
    uint256 private nextFractionId = 1;
    bool public shouldRevert;

    function buyFraction(
        uint256 hypercertId,
        uint256 amount,
        address asset,
        address recipient
    )
        external
        override
        returns (uint256 fractionId)
    {
        require(!shouldRevert, "MockHypercertMarketplace: forced revert");

        // Pull payment from caller
        ERC20(asset).transferFrom(msg.sender, address(this), amount);

        fractionId = nextFractionId++;
        purchases.push(Purchase({ hypercertId: hypercertId, amount: amount, asset: asset, recipient: recipient }));
    }

    function getPurchaseCount() external view returns (uint256) {
        return purchases.length;
    }

    function setShouldRevert(bool _shouldRevert) external {
        shouldRevert = _shouldRevert;
    }
}

/// @title MockJBMultiTerminal
/// @notice Mock Juicebox multi-terminal for testing yield→JB payments
contract MockJBMultiTerminalForYield {
    struct PayCall {
        uint256 projectId;
        address token;
        uint256 amount;
        address beneficiary;
    }

    PayCall[] public payCalls;
    bool public shouldRevert;

    function pay(
        uint256 projectId,
        address token,
        uint256 amount,
        address beneficiary,
        uint256,
        string calldata,
        bytes calldata
    )
        external
        returns (uint256)
    {
        require(!shouldRevert, "MockJBMultiTerminal: forced revert");

        // Pull payment from caller
        ERC20(token).transferFrom(msg.sender, address(this), amount);

        payCalls.push(PayCall({ projectId: projectId, token: token, amount: amount, beneficiary: beneficiary }));
        return amount * 1000; // Mock: return 1000 GOODS per unit
    }

    function getPayCallCount() external view returns (uint256) {
        return payCalls.length;
    }

    function setShouldRevert(bool _shouldRevert) external {
        shouldRevert = _shouldRevert;
    }
}

/// @title MockOctantVaultForYield
/// @notice Mock ERC-4626 vault for yield splitter testing
contract MockOctantVaultForYield {
    ERC20 public immutable UNDERLYING;
    mapping(address account => uint256 shares) public _balances;
    uint256 private _totalSupply;

    constructor(address _asset) {
        UNDERLYING = ERC20(_asset);
    }

    function asset() external view returns (address) {
        return address(UNDERLYING);
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    /// @notice Mint shares to an account (test helper)
    function mintShares(address account, uint256 shares) external {
        _balances[account] += shares;
        _totalSupply += shares;
    }

    /// @notice Mock deposit: takes asset, mints shares 1:1
    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
        UNDERLYING.transferFrom(msg.sender, address(this), assets);
        shares = assets; // 1:1 for simplicity
        _balances[receiver] += shares;
        _totalSupply += shares;
    }

    /// @notice Mock redeem: burns shares, returns assets 1:1
    function redeem(uint256 shares, address receiver, address shareOwner) external returns (uint256 assets) {
        require(_balances[shareOwner] >= shares, "Insufficient shares");
        _balances[shareOwner] -= shares;
        _totalSupply -= shares;
        assets = shares; // 1:1 for simplicity
        UNDERLYING.transfer(receiver, assets);
    }

    /// @notice Fund the vault with underlying (for redeem to work)
    function fund(uint256 amount) external {
        UNDERLYING.transferFrom(msg.sender, address(this), amount);
    }
}
