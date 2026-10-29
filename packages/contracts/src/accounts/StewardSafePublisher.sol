// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { StewardRolePublisher } from "./StewardRolePublisher.sol";
import { IHatsSignerGateV2, IStewardSafe } from "../interfaces/IHatsSignerGateV2.sol";
import { StewardSafeLib } from "../libraries/StewardSafeLib.sol";

/// @notice Native steward Safe and canonical publisher for the same garden's Gnosis Safe.
/// @dev Signatures read current source authority, independently of best-effort owner cleanup.
contract StewardSafePublisher is StewardRolePublisher {
    uint256 public immutable ownerHat;
    uint256 public immutable signerHat;
    IHatsSignerGateV2 public immutable gate;
    IStewardSafe public immutable safe;

    event SourceStewardReconciled(address indexed account, bool eligible);
    event SourceReconciliationDeferred(address indexed account);

    constructor(
        address router_,
        address hatsModule_,
        address garden_,
        uint256 stewardHat_,
        address receiver_,
        string memory gardenName,
        uint256 expectedTopHat,
        uint256 salt
    )
        StewardRolePublisher(router_, hatsModule_, garden_, stewardHat_, receiver_)
    {
        (ownerHat, signerHat, gate, safe) = StewardSafeLib.deploy(gardenName, expectedTopHat, salt);
        gate.lock();
    }

    /// @dev Hats treats a reverting eligibility call as fallback to stored status: explicitly deny instead.
    function getWearerStatus(address account, uint256 hat) external view returns (bool eligible, bool standing) {
        if (hat != signerHat || !_validAccount(account)) return (false, true);
        try this.isCanonicalSteward(account) returns (bool current) {
            return (current, true);
        } catch {
            return (false, true);
        }
    }

    function getHatStatus(uint256 hat) external view returns (bool) {
        return hat == signerHat;
    }

    /// @notice Reads current authority, not a cached revision or caller-provided eligibility.
    function isCanonicalSteward(address account) external view returns (bool) {
        return _validAccount(account) && _isSteward(account);
    }

    /// @notice Permissionless recovery after a bounded callback failure.
    function reconcileSource(address account) external nonReentrant {
        _reconcileSource(account);
    }

    function reconcileSourceFromSync(address account) external {
        if (msg.sender != address(this)) revert OnlySelf();
        _reconcileSource(account);
    }

    function _afterSync(address account) internal override {
        try this.reconcileSourceFromSync{ gas: 350_000 }(account) { }
        catch {
            emit SourceReconciliationDeferred(account);
        }
    }

    function _reconcileSource(address account) private {
        if (!_validAccount(account)) revert InvalidAccount();
        bool eligible = _isSteward(account);
        StewardSafeLib.reconcile(gate, safe, signerHat, account, eligible);
        emit SourceStewardReconciled(account, eligible);
    }

    function _validAccount(address account) private view returns (bool) {
        return uint160(account) > 1 && account != address(this) && account != address(gate) && account != address(safe);
    }
}
