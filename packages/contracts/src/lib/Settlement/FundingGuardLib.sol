// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IHatsModule } from "../../interfaces/IHatsModule.sol";
import { ISettlementModule as Settlement } from "../../interfaces/ISettlementModule.sol";

/// @notice The common garden authority and Celo account boundary for both funding versions.
library SettlementFundingGuardLib {
    function activeAccount(
        mapping(address garden => Settlement.SettlementAccount account) storage accounts,
        address garden,
        uint64 destinationEvmChainId
    )
        internal
        view
        returns (Settlement.SettlementAccount storage account)
    {
        account = accounts[garden];
        if (account.account == address(0)) revert Settlement.UnknownSettlementAccount(garden);
        if (!account.active) revert Settlement.SettlementAccountInactive(garden);
        if (account.chainId != destinationEvmChainId) revert Settlement.InvalidSettlementChain(account.chainId);
    }

    function requireSteward(address hatsModule, address garden) internal view {
        if (hatsModule == address(0)) revert Settlement.FundingConfigurationIncomplete();
        if (
            !IHatsModule(hatsModule).isStewardOf(garden, msg.sender)
                && !IHatsModule(hatsModule).isOwnerOf(garden, msg.sender)
        ) {
            revert Settlement.NotSettlementSteward(msg.sender, garden);
        }
    }
}
