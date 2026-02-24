// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {
    IJBController,
    IJBMultiTerminal,
    IJBTokens,
    IJBToken,
    IJBTerminal,
    IJBRulesetApprovalHook,
    JBRulesetConfig,
    JBRulesetMetadata,
    JBTerminalConfig,
    JBSplitGroup,
    JBSplit
} from "../interfaces/IJuicebox.sol";

/// @title MockGOODS
/// @notice Mock ERC-20 representing the GOODS token deployed by Juicebox
/// @dev Does not inherit IJBToken to avoid public/external visibility conflict with OZ ERC20.
///      The IJBToken interface is satisfied by the ERC-20 functions being present on-chain.
contract MockGOODS is ERC20 {
    constructor() ERC20("Green Goods", "GOODS") { }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @title MockJBTokens
/// @notice Mock JBTokens contract for testing
contract MockJBTokens is IJBTokens {
    mapping(uint256 projectId => IJBToken token) internal _tokens;
    mapping(address holder => mapping(uint256 projectId => uint256 credits)) internal _credits;
    mapping(uint256 projectId => uint256 supply) internal _totalSupply;

    function setToken(uint256 projectId, address token) external {
        _tokens[projectId] = IJBToken(token);
    }

    function tokenOf(uint256 projectId) external view override returns (IJBToken) {
        return _tokens[projectId];
    }

    function claimTokensFor(address holder, uint256 projectId, uint256 count, address beneficiary) external override {
        require(_credits[holder][projectId] >= count, "Insufficient credits");
        _credits[holder][projectId] -= count;
        MockGOODS(address(_tokens[projectId])).mint(beneficiary, count);
    }

    function creditBalanceOf(address holder, uint256 projectId) external view override returns (uint256) {
        return _credits[holder][projectId];
    }

    function totalSupplyOf(uint256 projectId) external view override returns (uint256) {
        return _totalSupply[projectId];
    }

    function addCredits(address holder, uint256 projectId, uint256 amount) external {
        _credits[holder][projectId] += amount;
        _totalSupply[projectId] += amount;
    }
}

/// @title MockJBController
/// @notice Mock JBController for testing project creation and token minting
contract MockJBController is IJBController {
    uint256 public nextProjectId = 1;
    MockJBTokens public tokensContract;
    MockGOODS public goodsToken;

    // Track calls for assertions
    struct LaunchCall {
        address owner;
        string projectUri;
        uint256 rulesetCount;
        uint256 terminalCount;
        string memo;
    }

    struct MintCall {
        uint256 projectId;
        uint256 tokenCount;
        address beneficiary;
        string memo;
        bool useReservedPercent;
    }

    LaunchCall[] public launchCalls;
    MintCall[] public mintCalls;
    mapping(uint256 projectId => JBRulesetMetadata metadata) public projectMetadata;
    mapping(uint256 projectId => JBSplitGroup[] splitGroups) internal _projectSplitGroups;
    mapping(uint256 projectId => address owner) public projectOwners;

    constructor() {
        tokensContract = new MockJBTokens();
        goodsToken = new MockGOODS();
    }

    function launchProjectFor(
        address owner,
        string calldata projectUri,
        JBRulesetConfig[] calldata rulesetConfigurations,
        JBTerminalConfig[] memory terminalConfigurations,
        string calldata memo
    )
        external
        override
        returns (uint256 _projectId)
    {
        _projectId = nextProjectId++;

        launchCalls.push(
            LaunchCall({
                owner: owner,
                projectUri: projectUri,
                rulesetCount: rulesetConfigurations.length,
                terminalCount: terminalConfigurations.length,
                memo: memo
            })
        );

        projectOwners[_projectId] = owner;

        // Store metadata and splits from first ruleset
        if (rulesetConfigurations.length > 0) {
            projectMetadata[_projectId] = rulesetConfigurations[0].metadata;
            for (uint256 i = 0; i < rulesetConfigurations[0].splitGroups.length; i++) {
                _projectSplitGroups[_projectId].push(rulesetConfigurations[0].splitGroups[i]);
            }
        }

        return _projectId;
    }

    function mintTokensOf(
        uint256 _projectId,
        uint256 tokenCount,
        address beneficiary,
        string calldata memo,
        bool useReservedPercent
    )
        external
        override
        returns (uint256 beneficiaryTokenCount)
    {
        mintCalls.push(
            MintCall({
                projectId: _projectId,
                tokenCount: tokenCount,
                beneficiary: beneficiary,
                memo: memo,
                useReservedPercent: useReservedPercent
            })
        );

        if (useReservedPercent) {
            JBRulesetMetadata storage meta = projectMetadata[_projectId];
            uint256 reserved = (tokenCount * meta.reservedPercent) / 10_000;
            beneficiaryTokenCount = tokenCount - reserved;
        } else {
            beneficiaryTokenCount = tokenCount;
        }

        // Mint tokens
        goodsToken.mint(beneficiary, beneficiaryTokenCount);
        return beneficiaryTokenCount;
    }

    function deployERC20For(
        uint256 _projectId,
        string calldata,
        string calldata,
        bytes32
    )
        external
        override
        returns (IJBToken token)
    {
        tokensContract.setToken(_projectId, address(goodsToken));
        return IJBToken(address(goodsToken));
    }

    function TOKENS() external view override returns (IJBTokens) {
        return IJBTokens(address(tokensContract));
    }

    function DIRECTORY() external pure override returns (address) {
        return address(0);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test Helpers
    // ═══════════════════════════════════════════════════════════════════════════

    function getLaunchCallCount() external view returns (uint256) {
        return launchCalls.length;
    }

    function getMintCallCount() external view returns (uint256) {
        return mintCalls.length;
    }

    function getProjectSplitGroups(uint256 _projectId) external view returns (uint256 count) {
        return _projectSplitGroups[_projectId].length;
    }

    function getProjectSplitGroup(
        uint256 _projectId,
        uint256 index
    )
        external
        view
        returns (uint256 groupId, uint256 splitsCount)
    {
        JBSplitGroup storage group = _projectSplitGroups[_projectId][index];
        return (group.groupId, group.splits.length);
    }

    function getProjectSplit(
        uint256 _projectId,
        uint256 groupIndex,
        uint256 splitIndex
    )
        external
        view
        returns (uint32 percent, address beneficiary)
    {
        JBSplit storage split = _projectSplitGroups[_projectId][groupIndex].splits[splitIndex];
        return (split.percent, split.beneficiary);
    }
}

/// @title MockJBMultiTerminal
/// @notice Mock JBMultiTerminal for testing payments
contract MockJBMultiTerminal is IJBMultiTerminal {
    struct PayCall {
        uint256 projectId;
        address token;
        uint256 amount;
        address beneficiary;
        uint256 minReturnedTokens;
        string memo;
    }

    PayCall[] public payCalls;
    MockJBController public controller;

    constructor(address _controller) {
        controller = MockJBController(_controller);
    }

    function pay(
        uint256 _projectId,
        address token,
        uint256 amount,
        address beneficiary,
        uint256 minReturnedTokens,
        string calldata memo,
        bytes calldata
    )
        external
        payable
        override
        returns (uint256 beneficiaryTokenCount)
    {
        // For native ETH, use msg.value
        uint256 payAmount = token == address(0x000000000000000000000000000000000000EEEe) ? msg.value : amount;

        payCalls.push(
            PayCall({
                projectId: _projectId,
                token: token,
                amount: payAmount,
                beneficiary: beneficiary,
                minReturnedTokens: minReturnedTokens,
                memo: memo
            })
        );

        // Mock: mint GOODS based on project weight (simplified: 1000 GOODS/ETH)
        beneficiaryTokenCount = (payAmount * 1000);
        if (beneficiaryTokenCount >= minReturnedTokens) {
            controller.goodsToken().mint(beneficiary, beneficiaryTokenCount);
        }

        return beneficiaryTokenCount;
    }

    function getPayCallCount() external view returns (uint256) {
        return payCalls.length;
    }
}
