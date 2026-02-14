// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;
/* solhint-disable no-console */

import { Script } from "forge-std/Script.sol";
import { console } from "forge-std/console.sol";

import {
    IJBController,
    IJBMultiTerminal,
    IJBTokens,
    IJBToken,
    IJBRulesetApprovalHook,
    IJBSplitHook,
    JBRulesetConfig,
    JBRulesetMetadata,
    JBSplitGroup,
    JBSplit,
    JBTerminalConfig,
    JBAccountingContext,
    JBFundAccessLimitGroup
} from "../src/interfaces/IJuicebox.sol";

/// @title DeployGoodsProject
/// @notice Deploy/configure the Green Goods Juicebox v5 project for the GOODS token
/// @dev Creates a JB project on Arbitrum (Sepolia or mainnet) with:
///      - Weight: 1000 GOODS per ETH
///      - Reserved rate: 20% → protocol splits (airdrop 50%, operator 30%, dev 20%)
///      - Cash out tax: 50%
///      - Owner: protocol multisig (Gnosis Safe)
///      - Bootstrap: seed ETH payment + free mint buffer via mintTokensOf()
///
/// Usage (via deploy.ts, never direct forge script):
///   bun script/deploy.ts goods --network arbitrumSepolia              # Dry run
///   bun script/deploy.ts goods --network arbitrumSepolia --broadcast  # Deploy
contract DeployGoodsProject is Script {
    // ═══════════════════════════════════════════════════════════════════════════
    // Errors
    // ═══════════════════════════════════════════════════════════════════════════

    error MissingMultisig();
    error MissingJBController();
    error MissingJBMultiTerminal();
    error MissingSplitBeneficiary(string name);
    error ProjectCreationFailed();
    error TokenDeployFailed();
    error SeedPaymentFailed();
    error FreeMintFailed();

    // ═══════════════════════════════════════════════════════════════════════════
    // Constants — Juicebox v5 Arbitrum Sepolia Addresses
    // ═══════════════════════════════════════════════════════════════════════════

    /// @dev Juicebox v5 deployed addresses (Arbitrum Sepolia 421614)
    ///      Source: https://docs.juicebox.money/dev/v5/addresses
    /// @dev These will be overridden by env vars if set

    /// @notice Native token address in Juicebox v5 (represents ETH)
    address constant JB_NATIVE_TOKEN = address(0x000000000000000000000000000000000000EEEe);

    // ═══════════════════════════════════════════════════════════════════════════
    // Ruleset Configuration (from plan decisions 22-26)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Tokens minted per ETH paid (18 decimals, so 1000e18 = 1000 GOODS/ETH)
    uint112 constant WEIGHT = 1000e18;

    /// @notice 20% of minted tokens reserved for splits (basis points: 2000 = 20%)
    uint16 constant RESERVED_PERCENT = 2000;

    /// @notice 50% cash out tax rate (basis points: 5000 = 50%)
    uint16 constant CASH_OUT_TAX_RATE = 5000;

    /// @notice Reserved split: 50% to airdrop pool
    uint32 constant AIRDROP_SPLIT_PERCENT = 500_000_000; // JBConstants: 1e9 = 100%

    /// @notice Reserved split: 30% to operator incentives
    uint32 constant OPERATOR_SPLIT_PERCENT = 300_000_000;

    /// @notice Reserved split: 20% to protocol dev
    uint32 constant DEV_SPLIT_PERCENT = 200_000_000;

    /// @notice Reserved tokens split group ID (Juicebox convention)
    uint256 constant RESERVED_TOKENS_GROUP_ID = 1;

    /// @notice Free mint buffer for initial garden staking (decision 26)
    uint256 constant FREE_MINT_AMOUNT = 100_000e18; // 100,000 GOODS

    /// @notice Seed ETH payment for treasury backing (decision 26)
    uint256 constant SEED_PAYMENT_AMOUNT = 0.01 ether;

    // ═══════════════════════════════════════════════════════════════════════════
    // Deployment Result
    // ═══════════════════════════════════════════════════════════════════════════

    uint256 public projectId;
    address public goodsToken;

    // ═══════════════════════════════════════════════════════════════════════════
    // Main Entry Point
    // ═══════════════════════════════════════════════════════════════════════════

    function run() external {
        // Load configuration from environment
        address multisig = vm.envAddress("GOODS_MULTISIG");
        if (multisig == address(0)) revert MissingMultisig();

        address jbControllerAddr = vm.envAddress("JB_CONTROLLER");
        if (jbControllerAddr == address(0)) revert MissingJBController();

        address jbMultiTerminalAddr = vm.envAddress("JB_MULTI_TERMINAL");
        if (jbMultiTerminalAddr == address(0)) revert MissingJBMultiTerminal();

        address airdropPool = vm.envAddress("GOODS_AIRDROP_POOL");
        if (airdropPool == address(0)) revert MissingSplitBeneficiary("airdropPool");

        address operatorPool = vm.envAddress("GOODS_OPERATOR_POOL");
        if (operatorPool == address(0)) revert MissingSplitBeneficiary("operatorPool");

        address devPool = vm.envAddress("GOODS_DEV_POOL");
        if (devPool == address(0)) revert MissingSplitBeneficiary("devPool");

        IJBController controller = IJBController(jbControllerAddr);
        IJBMultiTerminal terminal = IJBMultiTerminal(jbMultiTerminalAddr);

        vm.startBroadcast();

        // ─── Step 1: Create Juicebox Project ─────────────────────────────
        projectId = _launchProject(controller, terminal, multisig, airdropPool, operatorPool, devPool);
        console.log("GOODS project created with ID:", projectId);

        // ─── Step 2: Deploy GOODS ERC-20 ─────────────────────────────────
        IJBToken token = controller.deployERC20For(
            projectId,
            "Green Goods",
            "GOODS",
            bytes32(0) // default salt
        );
        goodsToken = address(token);
        console.log("GOODS token deployed at:", goodsToken);

        // ─── Step 3: Bootstrap — Seed Payment ────────────────────────────
        if (msg.sender.balance >= SEED_PAYMENT_AMOUNT) {
            terminal.pay{ value: SEED_PAYMENT_AMOUNT }(
                projectId,
                JB_NATIVE_TOKEN,
                SEED_PAYMENT_AMOUNT,
                msg.sender, // beneficiary receives GOODS
                0, // minReturnedTokens
                "Green Goods seed payment",
                ""
            );
            console.log("Seed payment:", SEED_PAYMENT_AMOUNT, "wei");
        } else {
            console.log("Insufficient balance for seed payment, skipping");
        }

        // ─── Step 4: Bootstrap — Free Mint Buffer ────────────────────────
        // Requires allowOwnerMinting = true in ruleset metadata
        uint256 minted = controller.mintTokensOf(
            projectId,
            FREE_MINT_AMOUNT,
            multisig, // tokens go to multisig for distribution
            "Initial staking distribution buffer",
            false // do not apply reserved percent to free mint
        );
        console.log("Free mint buffer:", minted, "GOODS to multisig");

        vm.stopBroadcast();

        // ─── Step 5: Save Deployment Artifacts ───────────────────────────
        _saveArtifacts();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Internal — Project Launch
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Build ruleset config and launch the Juicebox project
    function _launchProject(
        IJBController controller,
        IJBMultiTerminal terminal,
        address multisig,
        address airdropPool,
        address operatorPool,
        address devPool
    )
        internal
        returns (uint256)
    {
        // Build reserved token splits
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

        // Build split groups (only reserved tokens group)
        JBSplitGroup[] memory splitGroups = new JBSplitGroup[](1);
        splitGroups[0] = JBSplitGroup({ groupId: RESERVED_TOKENS_GROUP_ID, splits: reservedSplits });

        // Build ruleset metadata
        JBRulesetMetadata memory metadata = JBRulesetMetadata({
            reservedPercent: RESERVED_PERCENT,
            cashOutTaxRate: CASH_OUT_TAX_RATE,
            baseCurrency: 0, // ETH
            pausePay: false,
            pauseCreditTransfers: false,
            allowOwnerMinting: true, // Required for free mint buffer
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

        // Build ruleset config
        JBRulesetConfig[] memory rulesetConfigs = new JBRulesetConfig[](1);
        rulesetConfigs[0] = JBRulesetConfig({
            mustStartAtOrAfter: 0, // Start immediately
            duration: 0, // No time-limited cycles (decision: no decay initially)
            weight: WEIGHT,
            weightCutPercent: 0, // No weight decay initially
            approvalHook: IJBRulesetApprovalHook(address(0)),
            metadata: metadata,
            splitGroups: splitGroups,
            fundAccessLimitGroups: new JBFundAccessLimitGroup[](0) // No payout limits
         });

        // Build terminal config (accept native ETH)
        JBAccountingContext[] memory accountingContexts = new JBAccountingContext[](1);
        accountingContexts[0] = JBAccountingContext({
            token: JB_NATIVE_TOKEN,
            decimals: 18,
            currency: 0 // ETH
         });

        JBTerminalConfig[] memory terminalConfigs = new JBTerminalConfig[](1);
        terminalConfigs[0] = JBTerminalConfig({ terminal: terminal, accountingContextsToAccept: accountingContexts });

        // Launch project
        return controller.launchProjectFor(
            multisig, // Owner = protocol multisig (decision 25)
            "", // Project URI (set later via IPFS)
            rulesetConfigs,
            terminalConfigs,
            "Green Goods GOODS Token Project"
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Internal — Artifact Storage
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Save project ID and GOODS token address to deployment artifacts
    function _saveArtifacts() internal {
        string memory chainIdStr = vm.toString(block.chainid);
        string memory artifactPath = string.concat(vm.projectRoot(), "/deployments/", chainIdStr, "-goods.json");

        string memory obj = "goods";
        vm.serializeUint(obj, "projectId", projectId);
        vm.serializeAddress(obj, "goodsToken", goodsToken);
        vm.serializeUint(obj, "chainId", block.chainid);
        string memory finalJson = vm.serializeUint(obj, "deployedAt", block.timestamp);

        vm.writeFile(artifactPath, finalJson);
        console.log("Artifacts saved to:", artifactPath);
    }
}
