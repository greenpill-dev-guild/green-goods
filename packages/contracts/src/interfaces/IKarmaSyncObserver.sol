// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IKarmaGAPModule } from "./IKarmaGAPModule.sol";

/// @notice Common fallback signal for best-effort Karma calls that revert before the module records an outcome.
interface IKarmaSyncObserver {
    event KarmaHookFailed(
        address indexed garden, address indexed account, IKarmaGAPModule.KarmaSyncOperation indexed operation, string reason
    );
}
