// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IHypercertMarketplace } from "../interfaces/IHypercertMarketplace.sol";

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

    /// @notice Preview purchase — returns amount as units (1:1 mock)
    function previewPurchase(uint256, uint256 amount, address) external pure returns (uint256 units) {
        return amount;
    }

    /// @notice Get min price — returns 1 (1 wei per unit mock)
    function getMinPrice(uint256, address) external pure returns (uint256 pricePerUnit) {
        return 1;
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

/// @title MockCVStrategy
/// @notice Mock CVStrategy (Conviction Voting) for testing conviction-weighted fraction purchasing
contract MockCVStrategy {
    struct Proposal {
        uint256 stakedAmount;
        uint256 conviction;
        uint8 status; // 0=Inactive, 1=Active, 2=Paused, 3=Cancelled, 4=Executed, 5=Disputed, 6=Rejected
    }

    uint256 public proposalCounter;
    mapping(uint256 proposalId => Proposal) public proposals;
    bool public shouldRevert;

    /// @notice Add a proposal with given staked amount and conviction (auto-increments counter)
    /// @dev Status defaults to 1 (Active)
    function addProposal(uint256 stakedAmount, uint256 conviction) external returns (uint256 proposalId) {
        proposalCounter++;
        proposalId = proposalCounter;
        proposals[proposalId] = Proposal({ stakedAmount: stakedAmount, conviction: conviction, status: 1 });
    }

    /// @notice Set proposal status (for testing inactive/cancelled proposals)
    function setProposalStatus(uint256 proposalId, uint8 status) external {
        proposals[proposalId].status = status;
    }

    /// @notice Set whether calls should revert (for testing graceful degradation)
    function setShouldRevert(bool _shouldRevert) external {
        shouldRevert = _shouldRevert;
    }

    function calculateProposalConviction(uint256 proposalId) external view returns (uint256) {
        require(!shouldRevert, "MockCVStrategy: forced revert");
        return proposals[proposalId].conviction;
    }

    function getProposalStakedAmount(uint256 proposalId) external view returns (uint256) {
        require(!shouldRevert, "MockCVStrategy: forced revert");
        return proposals[proposalId].stakedAmount;
    }

    function getProposal(uint256 proposalId)
        external
        view
        returns (
            address submitter,
            address beneficiary,
            address requestedToken,
            uint256 requestedAmount,
            uint256 stakedAmount,
            uint8 proposalStatus,
            uint256 blockLast,
            uint256 convictionLast,
            uint256 threshold,
            uint256 voterStakedPoints,
            uint256 arbitrableConfigVersion,
            uint256 protocol
        )
    {
        require(!shouldRevert, "MockCVStrategy: forced revert");
        Proposal memory p = proposals[proposalId];
        return (
            address(0), // submitter
            address(0), // beneficiary
            address(0), // requestedToken
            0, // requestedAmount
            p.stakedAmount,
            p.status,
            0, // blockLast
            p.conviction, // convictionLast
            0, // threshold
            0, // voterStakedPoints
            0, // arbitrableConfigVersion
            0 // protocol
        );
    }
}

/// @title MockOctantVaultForYield
/// @notice Mock ERC-4626 vault for yield splitter testing with configurable exchange rate
/// @dev Default is 1:1. Use setExchangeRate(110, 100) to simulate 10% yield accrual.
contract MockOctantVaultForYield {
    ERC20 public immutable UNDERLYING;
    mapping(address account => uint256 shares) public _balances;
    uint256 private _totalSupply;

    /// @notice Exchange rate: assets = shares * rateNumerator / rateDenominator
    uint256 public rateNumerator = 1;
    uint256 public rateDenominator = 1;

    constructor(address _asset) {
        UNDERLYING = ERC20(_asset);
    }

    /// @notice Set exchange rate to simulate yield (e.g., 110/100 = 10% yield)
    function setExchangeRate(uint256 _numerator, uint256 _denominator) external {
        require(_denominator > 0, "denominator must be > 0");
        rateNumerator = _numerator;
        rateDenominator = _denominator;
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

    /// @notice Mock deposit: takes asset, mints shares at current rate
    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
        UNDERLYING.transferFrom(msg.sender, address(this), assets);
        shares = (assets * rateDenominator) / rateNumerator;
        _balances[receiver] += shares;
        _totalSupply += shares;
    }

    /// @notice Mock redeem: burns shares, returns assets at current rate
    function redeem(
        uint256 shares,
        address receiver,
        address shareOwner,
        uint256,
        address[] calldata
    )
        external
        returns (uint256 assets)
    {
        require(_balances[shareOwner] >= shares, "Insufficient shares");
        _balances[shareOwner] -= shares;
        _totalSupply -= shares;
        assets = (shares * rateNumerator) / rateDenominator;
        UNDERLYING.transfer(receiver, assets);
    }

    /// @notice Fund the vault with underlying (for redeem to work)
    function fund(uint256 amount) external {
        UNDERLYING.transferFrom(msg.sender, address(this), amount);
    }
}
