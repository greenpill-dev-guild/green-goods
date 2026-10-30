// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IHats } from "../interfaces/IHats.sol";
import { IHatsSignerGateV2, IModuleProxyFactory, IStewardSafe } from "../interfaces/IHatsSignerGateV2.sol";

/// @dev Shared deployment and owner reconciliation policy for native and mirrored steward Safes.
library StewardSafeLib {
    address internal constant HATS = 0x3bc1A0Ad72417f2d411118085256fC53CBdDd137;
    address internal constant HSG_IMPLEMENTATION = 0x148057884AC910Bdd93693F230C5c35a8c47CA3b;
    address internal constant MODULE_FACTORY = 0x000000000000aDdB49795b0f9bA5BC298cDda236;
    address internal constant CALL_ONLY_MULTISEND = 0x9641d764fc13c8B624c04430C7356C1C7C8102e2;

    error InvalidConfiguration();
    error DependencyMismatch(address dependency);

    /// @dev Caller must lock the gate before its constructor returns, after any approved bootstrap.
    function deploy(
        string memory gardenName,
        uint256 expectedTopHat,
        uint256 salt
    )
        internal
        returns (uint256 ownerHat, uint256 signerHat, IHatsSignerGateV2 gate, IStewardSafe safe)
    {
        if (bytes(gardenName).length == 0 || expectedTopHat == 0) revert InvalidConfiguration();
        _checkDependencies();
        ownerHat = IHats(HATS).mintTopHat(address(this), string.concat(gardenName, " cross-chain steward authority"), "");
        if (ownerHat != expectedTopHat) revert InvalidConfiguration();
        signerHat = IHats(HATS)
            .createHat(
                ownerHat,
                string.concat("Arbitrum ", gardenName, " stewards"),
                type(uint32).max,
                address(this),
                address(this),
                false,
                ""
            );
        uint256[] memory hats = new uint256[](1);
        hats[0] = signerHat;
        IHatsSignerGateV2.SetupParams memory params = IHatsSignerGateV2.SetupParams({
            ownerHat: ownerHat,
            signerHats: hats,
            safe: address(0),
            thresholdConfig: IHatsSignerGateV2.ThresholdConfig(0, 1, 2),
            locked: false,
            claimableFor: true,
            implementation: HSG_IMPLEMENTATION,
            hsgGuard: address(0),
            hsgModules: new address[](0)
        });
        gate = IHatsSignerGateV2(
            IModuleProxyFactory(MODULE_FACTORY)
                .deployModule(HSG_IMPLEMENTATION, abi.encodeWithSignature("setUp(bytes)", abi.encode(params)), salt)
        );
        gate.disableDelegatecallTarget(0x40A2aCCbd92BCA938b02010E17A5b8929b49130D);
        gate.disableDelegatecallTarget(0xA1dabEF33b3B82c7814B6D82A79e50F4AC44102B);
        safe = IStewardSafe(gate.safe());
    }

    function reconcile(
        IHatsSignerGateV2 gate,
        IStewardSafe safe,
        uint256 signerHat,
        address account,
        bool eligible
    )
        internal
    {
        if (eligible) {
            if (!IHats(HATS).isWearerOfHat(account, signerHat)) IHats(HATS).mintHat(signerHat, account);
            if (gate.registeredSignerHats(account) != signerHat || !safe.isOwner(account)) {
                gate.claimSignerFor(signerHat, account);
            }
        } else if (safe.isOwner(account)) {
            // Eligibility denies the signature before cosmetic owner cleanup can fail.
            gate.removeSigner(account);
        }
    }

    function _checkDependencies() private view {
        _code(HATS, 0x91b24bc822401959192fd43e8795e2c6e23db03cd375588ea4585417902f87b2);
        _code(HSG_IMPLEMENTATION, 0x7c1917a3082780bda5fbba9cbfdae8ac9d74487ede6ca42c249bc03a20f0531d);
        _code(MODULE_FACTORY, 0x01623cbcf010a1c326230f1b2d5f48a66b440232ee49096102bc84967dc5f21e);
        _code(
            0x29fcB43b46531BcA003ddC8FCB67FFE91900C762, 0xb1f926978a0f44a2c0ec8fe822418ae969bd8c3f18d61e5103100339894f81ff
        );
        _code(
            0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99, 0x7c6007a5d711cea8dfd5d91f5940ec29c7f200fe511eb1fc1397b367af3c42f9
        );
        _code(CALL_ONLY_MULTISEND, 0xecd5bd14a08c5d2122379900b2f272bdf107a7e92423c10dd5fe3254386c9939);
        _code(
            0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67, 0x50c3cdc4074750a7a974204a716c999edd37482f907608d960b2b025ee0b3317
        );
    }

    function _code(address dependency, bytes32 expected) private view {
        if (dependency.codehash != expected) revert DependencyMismatch(dependency);
    }
}
