// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title IJuicebox
/// @notice Minimal interfaces for Juicebox v5 (nana-core) integration on Arbitrum
/// @dev Only the functions Green Goods calls are included. Full interfaces at:
///      https://github.com/Bananapus/nana-core/tree/main/src/interfaces

// ═══════════════════════════════════════════════════════════════════════════
// Structs (subset of nana-core/src/structs/)
// ═══════════════════════════════════════════════════════════════════════════

/// @notice Ruleset approval hook interface (stub — we pass address(0) for no approval hook)
interface IJBRulesetApprovalHook { }

/// @notice Split hook interface (stub — we use direct beneficiary splits, no hooks)
interface IJBSplitHook { }

/// @notice Terminal interface marker for JBTerminalConfig
interface IJBTerminal { }

/// @notice Token interface returned by IJBTokens.tokenOf
/// @dev Extends IERC20 with ERC-20 metadata. Juicebox project tokens are standard ERC-20s.
interface IJBToken {
    // ERC-20 metadata
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);

    // ERC-20 core (duplicated from IERC20 for self-contained interface)
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
}

/// @notice Ruleset metadata controlling project behavior
struct JBRulesetMetadata {
    uint16 reservedPercent;
    uint16 cashOutTaxRate;
    uint32 baseCurrency;
    bool pausePay;
    bool pauseCreditTransfers;
    bool allowOwnerMinting;
    bool allowSetCustomToken;
    bool allowTerminalMigration;
    bool allowSetTerminals;
    bool allowSetController;
    bool allowAddAccountingContext;
    bool allowAddPriceFeed;
    bool ownerMustSendPayouts;
    bool holdFees;
    bool useTotalSurplusForCashOuts;
    bool useDataHookForPay;
    bool useDataHookForCashOut;
    address dataHook;
    uint16 metadata;
}

/// @notice A single split directing a % of tokens to a beneficiary, project, or hook
struct JBSplit {
    uint32 percent;
    uint64 projectId;
    address payable beneficiary;
    bool preferAddToBalance;
    uint48 lockedUntil;
    IJBSplitHook hook;
}

/// @notice A group of splits (e.g., reserved tokens group ID = 1)
struct JBSplitGroup {
    uint256 groupId;
    JBSplit[] splits;
}

/// @notice Accounting context for terminal configuration
struct JBAccountingContext {
    address token;
    uint8 decimals;
    uint32 currency;
}

/// @notice Terminal configuration for project launch
struct JBTerminalConfig {
    IJBTerminal terminal;
    JBAccountingContext[] accountingContextsToAccept;
}

/// @notice Fund access limits (not used in initial config — empty array)
struct JBFundAccessLimitGroup {
    address terminal;
    address token;
    JBPayoutLimit[] payoutLimits;
    JBSurplusAllowance[] surplusAllowances;
}

struct JBPayoutLimit {
    uint224 amount;
    uint32 currency;
}

struct JBSurplusAllowance {
    uint224 amount;
    uint32 currency;
}

/// @notice Complete ruleset configuration for project launch
struct JBRulesetConfig {
    uint48 mustStartAtOrAfter;
    uint32 duration;
    uint112 weight;
    uint32 weightCutPercent;
    IJBRulesetApprovalHook approvalHook;
    JBRulesetMetadata metadata;
    JBSplitGroup[] splitGroups;
    JBFundAccessLimitGroup[] fundAccessLimitGroups;
}

// ═══════════════════════════════════════════════════════════════════════════
// Interfaces
// ═══════════════════════════════════════════════════════════════════════════

/// @notice Juicebox v5 Controller — launches projects and mints tokens
/// @dev Deployed on Arbitrum, Arbitrum Sepolia, and other supported chains
interface IJBController {
    /// @notice Launch a new Juicebox project
    /// @param owner Address that will own the project NFT
    /// @param projectUri IPFS URI with project metadata
    /// @param rulesetConfigurations Initial rulesets (weight, reserves, splits, etc.)
    /// @param terminalConfigurations Terminals the project accepts payments through
    /// @param memo A memo to associate with the project creation
    /// @return projectId The ID of the newly created project
    function launchProjectFor(
        address owner,
        string calldata projectUri,
        JBRulesetConfig[] calldata rulesetConfigurations,
        JBTerminalConfig[] memory terminalConfigurations,
        string calldata memo
    )
        external
        returns (uint256 projectId);

    /// @notice Mint project tokens to a beneficiary
    /// @dev Requires allowOwnerMinting = true in ruleset metadata
    /// @param projectId The project to mint tokens for
    /// @param tokenCount Number of tokens to mint (18 decimals)
    /// @param beneficiary Address to receive the tokens
    /// @param memo A memo for the mint
    /// @param useReservedPercent Whether to route reservedPercent to splits
    /// @return beneficiaryTokenCount Tokens actually sent to beneficiary
    function mintTokensOf(
        uint256 projectId,
        uint256 tokenCount,
        address beneficiary,
        string calldata memo,
        bool useReservedPercent
    )
        external
        returns (uint256 beneficiaryTokenCount);

    /// @notice Deploy an ERC-20 token for a project (replaces credit-only mode)
    /// @param projectId The project to deploy a token for
    /// @param name Token name
    /// @param symbol Token symbol
    /// @param salt CREATE2 salt for deterministic deployment
    /// @return token The deployed IJBToken
    function deployERC20For(
        uint256 projectId,
        string calldata name,
        string calldata symbol,
        bytes32 salt
    )
        external
        returns (IJBToken token);

    /// @notice Get the JBTokens contract used by this controller
    function TOKENS() external view returns (IJBTokens);

    /// @notice Get the JBDirectory contract
    function DIRECTORY() external view returns (address);
}

/// @notice Juicebox v5 Multi-Terminal — accepts payments and distributes payouts
/// @dev The `pay` function is how ETH/tokens flow into a project and mint project tokens
interface IJBMultiTerminal is IJBTerminal {
    /// @notice Pay a project, minting tokens for the beneficiary
    /// @param projectId The project being paid
    /// @param token The token being paid (address(0) for native ETH on JB v5)
    /// @param amount The amount being paid (ignored for native ETH, uses msg.value)
    /// @param beneficiary Address to receive minted project tokens
    /// @param minReturnedTokens Minimum tokens to mint (reverts if less)
    /// @param memo A memo for the payment
    /// @param metadata Additional payment metadata
    /// @return beneficiaryTokenCount Tokens minted for the beneficiary
    function pay(
        uint256 projectId,
        address token,
        uint256 amount,
        address beneficiary,
        uint256 minReturnedTokens,
        string calldata memo,
        bytes calldata metadata
    )
        external
        payable
        returns (uint256 beneficiaryTokenCount);
}

/// @notice Juicebox v5 Tokens — manages project token credits and ERC-20 claims
interface IJBTokens {
    /// @notice Get the ERC-20 token for a project (address(0) if credit-only)
    /// @param projectId The project ID
    /// @return The token contract
    function tokenOf(uint256 projectId) external view returns (IJBToken);

    /// @notice Claim credits as ERC-20 tokens
    /// @param holder Address whose credits to claim
    /// @param projectId The project ID
    /// @param count Number of credits to convert to ERC-20
    /// @param beneficiary Address to receive the ERC-20 tokens
    function claimTokensFor(address holder, uint256 projectId, uint256 count, address beneficiary) external;

    /// @notice Get credit balance for a holder
    /// @param holder The address to check
    /// @param projectId The project ID
    /// @return The credit balance
    function creditBalanceOf(address holder, uint256 projectId) external view returns (uint256);

    /// @notice Get total token supply for a project (credits + ERC-20)
    /// @param projectId The project ID
    /// @return The total supply
    function totalSupplyOf(uint256 projectId) external view returns (uint256);
}
