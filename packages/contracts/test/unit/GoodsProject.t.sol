// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {
    IJBController,
    IJBMultiTerminal,
    IJBTokens,
    IJBToken,
    IJBSplitHook,
    IJBRulesetApprovalHook,
    JBRulesetConfig,
    JBRulesetMetadata,
    JBSplitGroup,
    JBSplit,
    JBTerminalConfig,
    JBAccountingContext,
    JBFundAccessLimitGroup
} from "../../src/interfaces/IJuicebox.sol";

import { MockJBController, MockJBMultiTerminal, MockGOODS, MockJBTokens } from "../../src/mocks/Juicebox.sol";

/// @title GoodsProjectTest
/// @notice Unit tests for Juicebox v5 GOODS project creation and token operations
/// @dev Tests verify:
///      - JB project creation with correct configuration
///      - Payment → GOODS minting at correct weight
///      - Reserved rate distributes to splits
///      - GOODS ERC-20 standard compliance
///      - Bootstrap: seed payment and free mint buffer
contract GoodsProjectTest is Test {
    // ═══════════════════════════════════════════════════════════════════════════
    // Test Contracts
    // ═══════════════════════════════════════════════════════════════════════════

    MockJBController public controller;
    MockJBMultiTerminal public terminal;
    MockGOODS public goodsToken;

    // ═══════════════════════════════════════════════════════════════════════════
    // Test Addresses
    // ═══════════════════════════════════════════════════════════════════════════

    address public multisig = address(0xABCD);
    address public airdropPool = address(0x1001);
    address public operatorPool = address(0x1002);
    address public devPool = address(0x1003);
    address public payer = address(0x2001);
    address public gardenTreasury = address(0x3001);

    // ═══════════════════════════════════════════════════════════════════════════
    // Constants (mirror DeployGoodsProject.s.sol)
    // ═══════════════════════════════════════════════════════════════════════════

    address constant JB_NATIVE_TOKEN = address(0x000000000000000000000000000000000000EEEe);
    uint112 constant WEIGHT = 1000e18;
    uint16 constant RESERVED_PERCENT = 2000; // 20%
    uint16 constant CASH_OUT_TAX_RATE = 5000; // 50%
    uint32 constant AIRDROP_SPLIT_PERCENT = 500_000_000; // 50% of reserved
    uint32 constant OPERATOR_SPLIT_PERCENT = 300_000_000; // 30% of reserved
    uint32 constant DEV_SPLIT_PERCENT = 200_000_000; // 20% of reserved
    uint256 constant RESERVED_TOKENS_GROUP_ID = 1;
    uint256 constant FREE_MINT_AMOUNT = 100_000e18;
    uint256 constant SEED_PAYMENT_AMOUNT = 0.01 ether;

    // ═══════════════════════════════════════════════════════════════════════════
    // Setup
    // ═══════════════════════════════════════════════════════════════════════════

    function setUp() public {
        controller = new MockJBController();
        terminal = new MockJBMultiTerminal(address(controller));
        goodsToken = controller.goodsToken();

        // Fund payer for tests
        vm.deal(payer, 100 ether);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Project Creation Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_launchProject_createsProjectWithCorrectOwner() public {
        uint256 projectId = _launchDefaultProject();

        assertEq(controller.projectOwners(projectId), multisig, "Project owner should be multisig");
    }

    function test_launchProject_returnsIncrementingProjectId() public {
        uint256 projectId1 = _launchDefaultProject();
        uint256 projectId2 = _launchDefaultProject();

        assertEq(projectId1, 1, "First project should be ID 1");
        assertEq(projectId2, 2, "Second project should be ID 2");
    }

    function test_launchProject_storesRulesetMetadata() public {
        uint256 projectId = _launchDefaultProject();

        (uint16 reservedPercent, uint16 cashOutTaxRate,,,,,,,,,,,,,,,,,) = controller.projectMetadata(projectId);

        assertEq(reservedPercent, RESERVED_PERCENT, "Reserved percent should be 20%");
        assertEq(cashOutTaxRate, CASH_OUT_TAX_RATE, "Cash out tax rate should be 50%");
    }

    function test_launchProject_storesReservedSplits() public {
        uint256 projectId = _launchDefaultProject();

        // Verify split group exists
        uint256 groupCount = controller.getProjectSplitGroups(projectId);
        assertEq(groupCount, 1, "Should have 1 split group");

        // Verify group ID and split count
        (uint256 groupId, uint256 splitsCount) = controller.getProjectSplitGroup(projectId, 0);
        assertEq(groupId, RESERVED_TOKENS_GROUP_ID, "Group ID should be reserved tokens (1)");
        assertEq(splitsCount, 3, "Should have 3 splits");

        // Verify individual splits
        (uint32 airdropPercent, address airdropBeneficiary) = controller.getProjectSplit(projectId, 0, 0);
        assertEq(airdropPercent, AIRDROP_SPLIT_PERCENT, "Airdrop split should be 50%");
        assertEq(airdropBeneficiary, airdropPool, "Airdrop beneficiary should be airdrop pool");

        (uint32 operatorPercent, address operatorBeneficiary) = controller.getProjectSplit(projectId, 0, 1);
        assertEq(operatorPercent, OPERATOR_SPLIT_PERCENT, "Operator split should be 30%");
        assertEq(operatorBeneficiary, operatorPool, "Operator beneficiary should be operator pool");

        (uint32 devPercent, address devBeneficiary) = controller.getProjectSplit(projectId, 0, 2);
        assertEq(devPercent, DEV_SPLIT_PERCENT, "Dev split should be 20%");
        assertEq(devBeneficiary, devPool, "Dev beneficiary should be dev pool");
    }

    function test_launchProject_splitsSum100Percent() public {
        // Verify the split percentages sum to 1e9 (100% in JB v5)
        uint256 total = uint256(AIRDROP_SPLIT_PERCENT) + uint256(OPERATOR_SPLIT_PERCENT) + uint256(DEV_SPLIT_PERCENT);
        assertEq(total, 1_000_000_000, "Splits should sum to 1e9 (100%)");
    }

    function test_launchProject_configuresTerminal() public {
        _launchDefaultProject();

        // Verify the launch call included terminal config
        (,,, uint256 terminalCount,) = controller.launchCalls(0);
        assertEq(terminalCount, 1, "Should have 1 terminal config");
    }

    function test_launchProject_allowsOwnerMinting() public {
        uint256 projectId = _launchDefaultProject();

        // Verify allowOwnerMinting is true (required for free mint buffer)
        (,,,,, bool allowOwnerMinting,,,,,,,,,,,,,) = controller.projectMetadata(projectId);
        assertTrue(allowOwnerMinting, "allowOwnerMinting should be true for free mint buffer");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Payment → GOODS Minting Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_pay_mintsGOODSTokens() public {
        _launchDefaultProject();

        vm.prank(payer);
        uint256 tokensReceived = terminal.pay{ value: 1 ether }(
            1, // projectId
            JB_NATIVE_TOKEN,
            1 ether,
            payer,
            0,
            "test payment",
            ""
        );

        assertGt(tokensReceived, 0, "Should have received GOODS tokens");
    }

    function test_pay_mintsAtCorrectWeight() public {
        _launchDefaultProject();

        vm.prank(payer);
        uint256 tokensReceived = terminal.pay{ value: 1 ether }(1, JB_NATIVE_TOKEN, 1 ether, payer, 0, "test payment", "");

        // Mock terminal: 1 ETH * 1000 = 1000 GOODS (simplified mock without 18 decimals)
        assertEq(tokensReceived, 1000 ether, "1 ETH should mint 1000 GOODS");
    }

    function test_pay_transfersGOODSToBeneficiary() public {
        _launchDefaultProject();

        vm.prank(payer);
        terminal.pay{ value: 1 ether }(
            1,
            JB_NATIVE_TOKEN,
            1 ether,
            gardenTreasury, // different beneficiary
            0,
            "payment for garden",
            ""
        );

        uint256 treasuryBalance = goodsToken.balanceOf(gardenTreasury);
        assertGt(treasuryBalance, 0, "Garden treasury should have received GOODS");
    }

    function test_pay_recordsPayCallDetails() public {
        _launchDefaultProject();

        vm.prank(payer);
        terminal.pay{ value: 2 ether }(1, JB_NATIVE_TOKEN, 2 ether, payer, 0, "test memo", "");

        assertEq(terminal.getPayCallCount(), 1, "Should have recorded 1 pay call");
        (uint256 projectId, address token, uint256 amount, address beneficiary,,) = terminal.payCalls(0);
        assertEq(projectId, 1, "Project ID should be 1");
        assertEq(token, JB_NATIVE_TOKEN, "Token should be native ETH");
        assertEq(amount, 2 ether, "Amount should be 2 ETH");
        assertEq(beneficiary, payer, "Beneficiary should be payer");
    }

    function test_pay_multiplePayments_accumulateTokens() public {
        _launchDefaultProject();

        vm.startPrank(payer);
        terminal.pay{ value: 1 ether }(1, JB_NATIVE_TOKEN, 1 ether, payer, 0, "", "");
        terminal.pay{ value: 2 ether }(1, JB_NATIVE_TOKEN, 2 ether, payer, 0, "", "");
        vm.stopPrank();

        uint256 totalBalance = goodsToken.balanceOf(payer);
        assertEq(totalBalance, 3000 ether, "Should have accumulated 3000 GOODS (1000 + 2000)");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Reserved Rate Distribution Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_mintTokensOf_withReservedPercent_deductsReserved() public {
        uint256 projectId = _launchDefaultProject();

        uint256 mintAmount = 10_000e18;
        uint256 beneficiaryReceived = controller.mintTokensOf(
            projectId,
            mintAmount,
            multisig,
            "reserved test",
            true // useReservedPercent
        );

        // 20% reserved → beneficiary gets 80%
        uint256 expectedBeneficiary = mintAmount * (10_000 - RESERVED_PERCENT) / 10_000;
        assertEq(beneficiaryReceived, expectedBeneficiary, "Beneficiary should receive 80% when reserved is applied");
    }

    function test_mintTokensOf_withoutReservedPercent_fullAmount() public {
        uint256 projectId = _launchDefaultProject();

        uint256 mintAmount = 10_000e18;
        uint256 beneficiaryReceived = controller.mintTokensOf(
            projectId,
            mintAmount,
            multisig,
            "full mint",
            false // do NOT use reserved percent
        );

        assertEq(beneficiaryReceived, mintAmount, "Beneficiary should receive full amount without reserved");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // GOODS ERC-20 Standard Compliance Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_goodsToken_hasCorrectName() public {
        assertEq(goodsToken.name(), "Green Goods", "Token name should be 'Green Goods'");
    }

    function test_goodsToken_hasCorrectSymbol() public {
        assertEq(goodsToken.symbol(), "GOODS", "Token symbol should be 'GOODS'");
    }

    function test_goodsToken_has18Decimals() public {
        assertEq(goodsToken.decimals(), 18, "Token should have 18 decimals");
    }

    function test_goodsToken_isTransferable() public {
        // Mint some tokens
        goodsToken.mint(payer, 1000e18);

        // Transfer
        vm.prank(payer);
        bool success = goodsToken.transfer(gardenTreasury, 500e18);

        assertTrue(success, "Transfer should succeed");
        assertEq(goodsToken.balanceOf(payer), 500e18, "Sender balance should decrease");
        assertEq(goodsToken.balanceOf(gardenTreasury), 500e18, "Receiver balance should increase");
    }

    function test_goodsToken_isApprovable() public {
        goodsToken.mint(payer, 1000e18);

        vm.prank(payer);
        bool success = goodsToken.approve(gardenTreasury, 500e18);

        assertTrue(success, "Approve should succeed");
        assertEq(goodsToken.allowance(payer, gardenTreasury), 500e18, "Allowance should be set");
    }

    function test_goodsToken_transferFrom_worksWithApproval() public {
        goodsToken.mint(payer, 1000e18);

        vm.prank(payer);
        goodsToken.approve(address(this), 500e18);

        bool success = goodsToken.transferFrom(payer, gardenTreasury, 500e18);

        assertTrue(success, "TransferFrom should succeed");
        assertEq(goodsToken.balanceOf(gardenTreasury), 500e18, "Treasury should receive tokens");
    }

    function test_goodsToken_totalSupply_tracksAllMints() public {
        uint256 initialSupply = goodsToken.totalSupply();
        assertEq(initialSupply, 0, "Initial supply should be 0");

        goodsToken.mint(payer, 500e18);
        goodsToken.mint(gardenTreasury, 300e18);

        assertEq(goodsToken.totalSupply(), 800e18, "Total supply should track all mints");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Bootstrap Tests (Seed Payment + Free Mint)
    // ═══════════════════════════════════════════════════════════════════════════

    function test_bootstrap_seedPayment_mintsTokens() public {
        uint256 projectId = _launchDefaultProject();

        vm.deal(multisig, 1 ether);
        vm.prank(multisig);
        uint256 tokensReceived = terminal.pay{ value: SEED_PAYMENT_AMOUNT }(
            projectId, JB_NATIVE_TOKEN, SEED_PAYMENT_AMOUNT, multisig, 0, "Green Goods seed payment", ""
        );

        assertGt(tokensReceived, 0, "Seed payment should mint GOODS");
    }

    function test_bootstrap_freeMint_distributeToMultisig() public {
        uint256 projectId = _launchDefaultProject();

        uint256 minted = controller.mintTokensOf(
            projectId,
            FREE_MINT_AMOUNT,
            multisig,
            "Initial staking distribution buffer",
            false // no reserved percent on free mint
        );

        assertEq(minted, FREE_MINT_AMOUNT, "Full free mint amount should go to multisig");
        assertEq(goodsToken.balanceOf(multisig), FREE_MINT_AMOUNT, "Multisig should hold free mint tokens");
    }

    function test_bootstrap_freeMint_recordsMintCall() public {
        uint256 projectId = _launchDefaultProject();

        controller.mintTokensOf(projectId, FREE_MINT_AMOUNT, multisig, "Initial staking distribution buffer", false);

        assertEq(controller.getMintCallCount(), 1, "Should have recorded 1 mint call");
        (uint256 callProjectId, uint256 tokenCount, address beneficiary,, bool useReserved) = controller.mintCalls(0);
        assertEq(callProjectId, projectId, "Mint project ID should match");
        assertEq(tokenCount, FREE_MINT_AMOUNT, "Mint amount should be FREE_MINT_AMOUNT");
        assertEq(beneficiary, multisig, "Beneficiary should be multisig");
        assertFalse(useReserved, "Free mint should NOT use reserved percent");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ERC-20 Token Deployment Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_deployERC20_returnsTokenAddress() public {
        uint256 projectId = _launchDefaultProject();

        IJBToken token = controller.deployERC20For(projectId, "Green Goods", "GOODS", bytes32(0));

        assertEq(address(token), address(goodsToken), "Deployed token should be GOODS");
        assertTrue(address(token) != address(0), "Token address should not be zero");
    }

    function test_deployERC20_setsTokenInJBTokens() public {
        uint256 projectId = _launchDefaultProject();

        controller.deployERC20For(projectId, "Green Goods", "GOODS", bytes32(0));

        IJBTokens tokens = controller.TOKENS();
        IJBToken registeredToken = tokens.tokenOf(projectId);
        assertEq(address(registeredToken), address(goodsToken), "JBTokens should return GOODS for project");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Credit → ERC-20 Claim Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_claimTokensFor_convertsCreditsToERC20() public {
        uint256 projectId = _launchDefaultProject();
        controller.deployERC20For(projectId, "Green Goods", "GOODS", bytes32(0));

        // Add credits to holder
        MockJBTokens tokensContract = controller.tokensContract();
        tokensContract.addCredits(payer, projectId, 500e18);
        assertEq(tokensContract.creditBalanceOf(payer, projectId), 500e18, "Should have credits");

        // Claim credits as ERC-20
        tokensContract.claimTokensFor(payer, projectId, 500e18, payer);

        assertEq(tokensContract.creditBalanceOf(payer, projectId), 0, "Credits should be consumed");
        assertEq(goodsToken.balanceOf(payer), 500e18, "Should have ERC-20 tokens");
    }

    function test_claimTokensFor_canClaimToDifferentBeneficiary() public {
        uint256 projectId = _launchDefaultProject();
        controller.deployERC20For(projectId, "Green Goods", "GOODS", bytes32(0));

        MockJBTokens tokensContract = controller.tokensContract();
        tokensContract.addCredits(payer, projectId, 500e18);

        // Claim to different address
        tokensContract.claimTokensFor(payer, projectId, 500e18, gardenTreasury);

        assertEq(goodsToken.balanceOf(gardenTreasury), 500e18, "Beneficiary should receive claimed tokens");
        assertEq(goodsToken.balanceOf(payer), 0, "Holder should not receive tokens");
    }

    function test_claimTokensFor_revertsOnInsufficientCredits() public {
        uint256 projectId = _launchDefaultProject();
        controller.deployERC20For(projectId, "Green Goods", "GOODS", bytes32(0));

        MockJBTokens tokensContract = controller.tokensContract();
        tokensContract.addCredits(payer, projectId, 100e18);

        vm.expectRevert("Insufficient credits");
        tokensContract.claimTokensFor(payer, projectId, 200e18, payer);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // GOODS + Gardens V2 RegistryCommunity Staking Compatibility
    // ═══════════════════════════════════════════════════════════════════════════

    function test_goodsToken_stakingCompatibility_approveAndTransfer() public {
        // Simulate: user approves RegistryCommunity to stake GOODS
        address registryCommunity = address(0x9999);
        uint256 stakeAmount = 1e18; // 1 GOODS per member (plan spec)

        goodsToken.mint(payer, 10e18);

        // Approve community contract to pull stake
        vm.prank(payer);
        goodsToken.approve(registryCommunity, stakeAmount);

        // Community pulls stake (simulating RegistryCommunity.joinCommunity)
        vm.prank(registryCommunity);
        bool success = goodsToken.transferFrom(payer, registryCommunity, stakeAmount);

        assertTrue(success, "Staking transfer should succeed");
        assertEq(goodsToken.balanceOf(registryCommunity), stakeAmount, "Community should hold stake");
        assertEq(goodsToken.balanceOf(payer), 9e18, "User balance should decrease by stake");
    }

    function test_goodsToken_stakingCompatibility_multipleMembers() public {
        address registryCommunity = address(0x9999);
        address member1 = address(0xA001);
        address member2 = address(0xA002);
        address member3 = address(0xA003);
        uint256 stakeAmount = 1e18;

        // Distribute GOODS to members (simulating airdrop)
        goodsToken.mint(member1, 10e18);
        goodsToken.mint(member2, 10e18);
        goodsToken.mint(member3, 10e18);

        // Each member approves + stakes
        address[3] memory members = [member1, member2, member3];
        for (uint256 i = 0; i < members.length; i++) {
            vm.startPrank(members[i]);
            goodsToken.approve(registryCommunity, stakeAmount);
            vm.stopPrank();

            vm.prank(registryCommunity);
            goodsToken.transferFrom(members[i], registryCommunity, stakeAmount);
        }

        assertEq(goodsToken.balanceOf(registryCommunity), 3e18, "Community should hold 3 members' stakes");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Edge Cases
    // ═══════════════════════════════════════════════════════════════════════════

    function test_pay_zeroAmount_mintsZeroTokens() public {
        _launchDefaultProject();

        vm.prank(payer);
        uint256 tokensReceived = terminal.pay{ value: 0 }(1, JB_NATIVE_TOKEN, 0, payer, 0, "zero payment", "");

        assertEq(tokensReceived, 0, "Zero payment should mint zero tokens");
    }

    function test_goodsToken_transfer_revertsOnInsufficientBalance() public {
        // Payer has 0 tokens
        vm.prank(payer);
        vm.expectRevert();
        goodsToken.transfer(gardenTreasury, 1e18);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Helper Functions
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Launch a default GOODS project with standard configuration
    function _launchDefaultProject() internal returns (uint256 projectId) {
        // Build reserved splits
        JBSplit[] memory reservedSplits = new JBSplit[](3);
        reservedSplits[0] = JBSplit({
            percent: AIRDROP_SPLIT_PERCENT,
            projectId: 0,
            beneficiary: payable(airdropPool),
            preferAddToBalance: false,
            lockedUntil: 0,
            hook: IJBSplitHook(address(0))
        });
        reservedSplits[1] = JBSplit({
            percent: OPERATOR_SPLIT_PERCENT,
            projectId: 0,
            beneficiary: payable(operatorPool),
            preferAddToBalance: false,
            lockedUntil: 0,
            hook: IJBSplitHook(address(0))
        });
        reservedSplits[2] = JBSplit({
            percent: DEV_SPLIT_PERCENT,
            projectId: 0,
            beneficiary: payable(devPool),
            preferAddToBalance: false,
            lockedUntil: 0,
            hook: IJBSplitHook(address(0))
        });

        JBSplitGroup[] memory splitGroups = new JBSplitGroup[](1);
        splitGroups[0] = JBSplitGroup({ groupId: RESERVED_TOKENS_GROUP_ID, splits: reservedSplits });

        JBRulesetMetadata memory metadata = JBRulesetMetadata({
            reservedPercent: RESERVED_PERCENT,
            cashOutTaxRate: CASH_OUT_TAX_RATE,
            baseCurrency: 0,
            pausePay: false,
            pauseCreditTransfers: false,
            allowOwnerMinting: true,
            allowSetCustomToken: false,
            allowTerminalMigration: false,
            allowSetTerminals: false,
            allowSetController: false,
            allowAddAccountingContext: false,
            allowAddPriceFeed: false,
            ownerMustSendPayouts: false,
            holdFees: false,
            useTotalSurplusForCashOuts: false,
            useDataHookForPay: false,
            useDataHookForCashOut: false,
            dataHook: address(0),
            metadata: 0
        });

        JBRulesetConfig[] memory rulesetConfigs = new JBRulesetConfig[](1);
        rulesetConfigs[0] = JBRulesetConfig({
            mustStartAtOrAfter: 0,
            duration: 0,
            weight: WEIGHT,
            weightCutPercent: 0,
            approvalHook: IJBRulesetApprovalHook(address(0)),
            metadata: metadata,
            splitGroups: splitGroups,
            fundAccessLimitGroups: new JBFundAccessLimitGroup[](0)
        });

        JBAccountingContext[] memory accountingContexts = new JBAccountingContext[](1);
        accountingContexts[0] = JBAccountingContext({ token: JB_NATIVE_TOKEN, decimals: 18, currency: 0 });

        JBTerminalConfig[] memory terminalConfigs = new JBTerminalConfig[](1);
        terminalConfigs[0] = JBTerminalConfig({ terminal: terminal, accountingContextsToAccept: accountingContexts });

        projectId =
            controller.launchProjectFor(multisig, "", rulesetConfigs, terminalConfigs, "Green Goods GOODS Token Project");
    }
}
