// SPDX-License-Identifier: MIT
// solhint-disable one-contract-per-file
pragma solidity ^0.8.25;

import { IOctantFactory, IOctantStrategy, IOctantVault } from "../interfaces/IOctantFactory.sol";

/// @title MockOctantFactory
/// @notice Mock implementation of Octant factory for testing
contract MockOctantFactory is IOctantFactory {
    mapping(address => address) public deployedVaults;
    uint256 public vaultCount;

    /// @notice Deploys a mock vault
    function deployNewVault(
        address asset,
        string memory _name,
        string memory symbol,
        address roleManager,
        uint256 profitMaxUnlockTime
    )
        external
        override
        returns (address vault)
    {
        vaultCount++;
        vault = address(new MockOctantVault(asset, _name, symbol, roleManager, profitMaxUnlockTime));
        deployedVaults[roleManager] = vault;
        return vault;
    }
}

/// @title MockOctantVault
/// @notice Mock implementation of Octant vault for testing with configurable exchange rate
/// @dev Uses snake_case API matching the real MultistrategyVault.
///      Exchange rate is configurable via setExchangeRate() to simulate yield accrual.
///      Default is 1:1 (rateNumerator=1, rateDenominator=1). Setting rateNumerator=110
///      and rateDenominator=100 simulates 10% yield (100 shares → 110 assets).
contract MockOctantVault is IOctantVault {
    address public override asset;
    string public name;
    string public symbol;
    address public roleManager;
    uint256 public profitUnlockTime;
    uint256 public _totalAssets;
    uint256 public override totalSupply;

    /// @notice Exchange rate numerator (assets per share = rateNumerator / rateDenominator)
    uint256 public rateNumerator = 1;
    /// @notice Exchange rate denominator
    uint256 public rateDenominator = 1;

    mapping(address account => uint256 balance) public balances;
    mapping(address strategy => bool active) public activeStrategies;

    /// @notice Recipient for process_report yield simulation (e.g., YieldResolver)
    address public processReportShareRecipient;
    /// @notice Number of shares to mint during next process_report call
    uint256 public processReportShareAmount;

    error InsufficientShares();
    error UnauthorizedRoleManager();

    constructor(
        address _asset,
        string memory _name,
        string memory _symbol,
        address _roleManager,
        uint256 _profitUnlockTime
    ) {
        asset = _asset;
        name = _name;
        symbol = _symbol;
        roleManager = _roleManager;
        profitUnlockTime = _profitUnlockTime;
    }

    /// @notice Set exchange rate to simulate yield accrual (e.g., 110/100 = 10% yield)
    function setExchangeRate(uint256 _numerator, uint256 _denominator) external {
        require(_denominator > 0, "denominator must be > 0");
        rateNumerator = _numerator;
        rateDenominator = _denominator;
    }

    /// @notice Configure shares to mint during process_report (simulates yield → donation address)
    /// @dev Shares are consumed after minting. Call again before each harvest to simulate new yield.
    function setProcessReportYield(address recipient, uint256 shareAmount) external {
        processReportShareRecipient = recipient;
        processReportShareAmount = shareAmount;
    }

    function deposit(uint256 assets, address receiver) external override returns (uint256 shares) {
        shares = convertToShares(assets);
        _totalAssets += assets;
        totalSupply += shares;
        balances[receiver] += shares;
    }

    function withdraw(
        uint256 assets,
        address,
        address owner,
        uint256,
        address[] calldata
    )
        external
        override
        returns (uint256 shares)
    {
        shares = convertToShares(assets);
        if (balances[owner] < shares) revert InsufficientShares();
        _totalAssets -= assets;
        totalSupply -= shares;
        balances[owner] -= shares;
    }

    function totalAssets() external view override returns (uint256) {
        return _totalAssets;
    }

    function redeem(
        uint256 shares,
        address,
        address owner,
        uint256,
        address[] calldata
    )
        external
        override
        returns (uint256 assets)
    {
        if (balances[owner] < shares) revert InsufficientShares();

        assets = convertToAssets(shares);
        if (_totalAssets < assets) revert InsufficientShares();

        _totalAssets -= assets;
        totalSupply -= shares;
        balances[owner] -= shares;
    }

    function balanceOf(address account) external view override returns (uint256) {
        return balances[account];
    }

    function convertToAssets(uint256 shares) public view override returns (uint256 assets) {
        return (shares * rateNumerator) / rateDenominator;
    }

    function convertToShares(uint256 assets) public view override returns (uint256 shares) {
        return (assets * rateDenominator) / rateNumerator;
    }

    function previewDeposit(uint256 assets) external view override returns (uint256 shares) {
        return convertToShares(assets);
    }

    function previewWithdraw(uint256 assets) external view override returns (uint256 shares) {
        return convertToShares(assets);
    }

    function maxDeposit(address) external pure override returns (uint256 assets) {
        return type(uint256).max;
    }

    function maxWithdraw(address account) external view override returns (uint256 assets) {
        return balances[account];
    }

    function add_strategy(address _strategy, bool) external override {
        if (msg.sender != roleManager) revert UnauthorizedRoleManager();
        activeStrategies[_strategy] = true;
    }

    function revoke_strategy(address _strategy) external override {
        if (msg.sender != roleManager) revert UnauthorizedRoleManager();
        activeStrategies[_strategy] = false;
    }

    function strategies(address _strategy)
        external
        view
        returns (uint256 activation, uint256 lastReport, uint256 currentDebt, uint256 maxDebt)
    {
        if (activeStrategies[_strategy]) {
            return (block.timestamp, block.timestamp, 0, type(uint256).max);
        }
        return (0, 0, 0, 0);
    }

    function update_max_debt_for_strategy(address, uint256) external override { }

    function update_debt(address, uint256 targetDebt, uint256) external override returns (uint256) {
        return targetDebt;
    }

    function process_report(address strategy) external virtual override returns (uint256, uint256) {
        // Mimic real Yearn V3: vault calls strategy.report() internally during process_report
        IOctantStrategy(strategy).report();

        // Simulate yield: mint shares to donation address (e.g., YieldResolver)
        if (processReportShareAmount > 0 && processReportShareRecipient != address(0)) {
            balances[processReportShareRecipient] += processReportShareAmount;
            totalSupply += processReportShareAmount;
            processReportShareAmount = 0; // Consume pending yield
        }

        return (0, 0);
    }
}

/// @title ProcessReportRevertingVault
/// @notice Vault whose process_report always reverts, for testing harvest fallback to strategy.report()
/// @dev Inherits MockOctantVault for full functionality, then overrides process_report to revert.
///      Unlike RevertingOctantVault, this vault supports add_strategy/balanceOf normally.
contract ProcessReportRevertingVault is MockOctantVault {
    constructor(
        address _asset,
        string memory _name,
        string memory _symbol,
        address _roleManager,
        uint256 _profitUnlockTime
    )
        MockOctantVault(_asset, _name, _symbol, _roleManager, _profitUnlockTime)
    { }

    function process_report(address) external pure override returns (uint256, uint256) {
        revert("process_report reverted");
    }
}

/// @title ProcessReportRevertingFactory
/// @notice Factory that deploys ProcessReportRevertingVaults for testing harvest fallback
contract ProcessReportRevertingFactory is IOctantFactory {
    function deployNewVault(
        address asset,
        string memory _name,
        string memory _symbol,
        address roleManager,
        uint256 _profitUnlockTime
    )
        external
        override
        returns (address vault)
    {
        vault = address(new ProcessReportRevertingVault(asset, _name, _symbol, roleManager, _profitUnlockTime));
    }
}

/// @title RevertingOctantFactory
/// @notice Factory that deploys vaults whose add_strategy always reverts
contract RevertingOctantFactory is IOctantFactory {
    function deployNewVault(
        address asset,
        string memory _name,
        string memory _symbol,
        address roleManager,
        uint256 _profitUnlockTime
    )
        external
        override
        returns (address vault)
    {
        vault = address(new RevertingOctantVault(asset, _name, _symbol, roleManager, _profitUnlockTime));
    }
}

/// @title RevertingOctantVault
/// @notice Vault whose add_strategy always reverts, for testing StrategyAttachmentFailed
contract RevertingOctantVault is IOctantVault {
    address public override asset;
    string public name;
    string public symbol;
    address public roleManager;
    uint256 public profitUnlockTime;

    constructor(
        address _asset,
        string memory _name,
        string memory _symbol,
        address _roleManager,
        uint256 _profitUnlockTime
    ) {
        asset = _asset;
        name = _name;
        symbol = _symbol;
        roleManager = _roleManager;
        profitUnlockTime = _profitUnlockTime;
    }

    function add_strategy(address, bool) external pure override {
        revert("add_strategy reverted");
    }

    // Stubs for IOctantVault interface compliance
    function deposit(uint256, address) external pure override returns (uint256) {
        return 0;
    }

    function withdraw(uint256, address, address, uint256, address[] calldata) external pure override returns (uint256) {
        return 0;
    }

    function redeem(uint256, address, address, uint256, address[] calldata) external pure override returns (uint256) {
        return 0;
    }

    function totalAssets() external pure override returns (uint256) {
        return 0;
    }

    function balanceOf(address) external pure override returns (uint256) {
        return 0;
    }

    function totalSupply() external pure override returns (uint256) {
        return 0;
    }

    function convertToAssets(uint256 shares) external pure override returns (uint256) {
        return shares;
    }

    function convertToShares(uint256 assets) external pure override returns (uint256) {
        return assets;
    }

    function previewDeposit(uint256 assets) external pure override returns (uint256) {
        return assets;
    }

    function previewWithdraw(uint256 assets) external pure override returns (uint256) {
        return assets;
    }

    function maxDeposit(address) external pure override returns (uint256) {
        return type(uint256).max;
    }

    function maxWithdraw(address) external pure override returns (uint256) {
        return 0;
    }

    function revoke_strategy(address) external pure override { }
    function update_max_debt_for_strategy(address, uint256) external pure override { }

    function update_debt(address, uint256 targetDebt, uint256) external pure override returns (uint256) {
        return targetDebt;
    }

    function process_report(address) external pure override returns (uint256, uint256) {
        return (0, 0);
    }
}
