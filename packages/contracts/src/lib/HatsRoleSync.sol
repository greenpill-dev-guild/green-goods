// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;
import { IHatsModule } from "../interfaces/IHatsModule.sol";
import { IStewardRoleObserver } from "../interfaces/IStewardRoleObserver.sol";
import { IKarmaGAPModule } from "../interfaces/IKarmaGAPModule.sol";
import { IKarmaSyncObserver } from "../interfaces/IKarmaSyncObserver.sol";
import { ICVSyncPowerFacet } from "../interfaces/ICVSyncPowerFacet.sol";

/// @notice Best-effort downstream synchronization; failures never restore a revoked Hat.
library HatsRoleSync {
    uint256 internal constant SYNC_POWER_GAS_STIPEND = 100_000;

    function projectAdmin(IKarmaGAPModule module, address garden, address account, bool add) internal {
        if (address(module) == address(0)) {
            emit IKarmaSyncObserver.KarmaHookFailed(
                garden, account, IKarmaGAPModule.KarmaSyncOperation.Access, "module_unavailable"
            );
            return;
        }
        if (add) {
            try module.addProjectAdmin(garden, account) { }
            catch {
                emit IKarmaSyncObserver.KarmaHookFailed(
                    garden, account, IKarmaGAPModule.KarmaSyncOperation.Access, "module_call_reverted"
                );
            }
        } else {
            try module.removeProjectAdmin(garden, account) { }
            catch {
                emit IKarmaSyncObserver.KarmaHookFailed(
                    garden, account, IKarmaGAPModule.KarmaSyncOperation.Access, "module_call_reverted"
                );
            }
        }
    }

    function convictionPower(address[] storage strategies, address garden, address account) internal {
        uint256 len = strategies.length;
        if (len == 0) return;

        for (uint256 i = 0; i < len; i++) {
            address strategy = strategies[i];
            // solhint-disable-next-line no-empty-blocks
            try ICVSyncPowerFacet(strategy).syncPower{ gas: SYNC_POWER_GAS_STIPEND }(account) {
                emit IHatsModule.ConvictionSyncTriggered(garden, account, strategy);
            } catch Error(string memory reason) {
                emit IHatsModule.ConvictionSyncFailed(garden, account, strategy, reason);
            } catch {
                emit IHatsModule.ConvictionSyncFailed(garden, account, strategy, "");
            }
        }
    }

    function notifyStewardObserver(address observer, address account) internal returns (bool) {
        if (observer == address(0)) return true;
        try IStewardRoleObserver(observer).syncSteward{ gas: 800_000 }(account) {
            return true;
        } catch {
            return false;
        }
    }
}
