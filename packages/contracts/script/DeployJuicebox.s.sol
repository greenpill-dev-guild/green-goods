// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Script, console2 } from "forge-std/Script.sol";

import {
    IJBController,
    IJBMultiTerminal,
    IJBToken,
    JBRulesetConfig,
    JBRulesetMetadata,
    JBSplitGroup,
    JBFundAccessLimitGroup,
    JBTerminalConfig,
    JBAccountingContext,
    IJBRulesetApprovalHook
} from "../src/interfaces/IJuicebox.sol";

/// @title DeployJuicebox
/// @notice Launches a Juicebox project for GOODS token on Arbitrum
/// @dev Usage: FOUNDRY_PROFILE=arbitrum forge script script/DeployJuicebox.s.sol --broadcast
contract DeployJuicebox is Script {
    // Arbitrum Juicebox v5 deployed addresses
    address constant ARBITRUM_JB_CONTROLLER = 0x84E1D0102A722b3f3c00EC4E2b7ca2B97edF4eB2;
    address constant ARBITRUM_JB_TERMINAL = 0x14785612bd5C27D8CbAd1d9A9E33BEBfF5F4C3b6;

    function run() external {
        uint256 deployerPk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPk);

        vm.startBroadcast(deployerPk);

        IJBController controller = IJBController(ARBITRUM_JB_CONTROLLER);
        IJBMultiTerminal terminal = IJBMultiTerminal(ARBITRUM_JB_TERMINAL);

        // Configure ruleset metadata
        JBRulesetMetadata memory metadata = JBRulesetMetadata({
            reservedPercent: 1000, // 10%
            cashOutTaxRate: 0,
            baseCurrency: 1, // USD
            pausePay: false,
            pauseCreditTransfers: false,
            allowOwnerMinting: true, // CRITICAL: allows minting GOODS for garden treasuries
            allowSetCustomToken: false,
            allowTerminalMigration: false,
            allowSetTerminals: false,
            allowSetController: false,
            allowAddAccountingContext: true,
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
            mustStartAtOrAfter: 0,
            duration: 0, // No duration (perpetual)
            weight: 1000e18, // 1000 GOODS per 1 ETH payment
            weightCutPercent: 0,
            approvalHook: IJBRulesetApprovalHook(address(0)),
            metadata: metadata,
            splitGroups: new JBSplitGroup[](0),
            fundAccessLimitGroups: new JBFundAccessLimitGroup[](0)
        });

        // Build terminal config (accept native ETH)
        JBAccountingContext[] memory accountingContexts = new JBAccountingContext[](1);
        accountingContexts[0] = JBAccountingContext({ token: address(0), decimals: 18, currency: 1 });

        JBTerminalConfig[] memory terminalConfigs = new JBTerminalConfig[](1);
        terminalConfigs[0] = JBTerminalConfig({ terminal: terminal, accountingContextsToAccept: accountingContexts });

        // Launch project
        uint256 projectId =
            controller.launchProjectFor(deployer, "ipfs://", rulesetConfigs, terminalConfigs, "Green Goods GOODS token");
        console2.log("Juicebox project ID:", projectId);

        // Deploy ERC-20 for the project
        bytes32 salt = keccak256("greenGoods:GOODS:v1");
        IJBToken goodsToken = controller.deployERC20For(projectId, "Green Goods", "GOODS", salt);
        console2.log("GOODS token address:", address(goodsToken));

        // Mint initial treasury supply
        controller.mintTokensOf(projectId, 100_000e18, deployer, "Garden treasury seed", false);
        console2.log("Initial 100,000 GOODS minted to deployer");

        vm.stopBroadcast();
    }
}
