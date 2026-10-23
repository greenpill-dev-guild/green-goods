// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { CCIPReceiver } from "@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol";
import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import { IHats } from "../interfaces/IHats.sol";
import { IHatsSignerGateV2, IModuleProxyFactory, IStewardSafe } from "../interfaces/IHatsSignerGateV2.sol";
import { StewardRoleCodec as Codec } from "../libraries/StewardRoleCodec.sol";

/// @notice Authenticated Gnosis mirror, Hats eligibility module and dynamic fixed-two issuer Safe.
/// @dev No operator, platform admin, upgrade or arbitrary execution path. This contract alone holds the top Hat.
contract StewardSafeReceiver is CCIPReceiver, ReentrancyGuard {
    address public constant HATS = 0x3bc1A0Ad72417f2d411118085256fC53CBdDd137;
    address public constant HSG_IMPLEMENTATION = 0x148057884AC910Bdd93693F230C5c35a8c47CA3b;
    address public constant MODULE_FACTORY = 0x000000000000aDdB49795b0f9bA5BC298cDda236;
    uint64 public constant SOURCE_SELECTOR = Codec.SOURCE_SELECTOR;
    bytes32 public constant DOMAIN = Codec.DOMAIN;
    address public immutable publisher;
    address public immutable garden;
    uint256 public immutable ownerHat;
    uint256 public immutable signerHat;
    IHatsSignerGateV2 public immutable gate;
    IStewardSafe public immutable safe;

    struct State {
        uint64 revision;
        bool eligible;
    }
    mapping(address => State) public states;

    error InvalidConfiguration();
    error DependencyMismatch(address dependency);
    error InvalidMessage();
    error ConflictingRevision();
    error OnlySelf();
    event StewardMirrored(address indexed account, uint64 revision, bool eligible);
    event StewardReconciled(address indexed account, bool eligible);
    event ReconciliationDeferred(address indexed account);

    constructor(
        address router_,
        address publisher_,
        address garden_,
        uint256 expectedTopHat,
        uint256 salt
    )
        CCIPReceiver(router_)
    {
        if (
            block.chainid != Codec.DESTINATION_CHAIN || router_.code.length == 0 || uint160(publisher_) <= 1
                || garden_ == address(0) || expectedTopHat == 0
        ) revert InvalidConfiguration();
        _checkDependencies();
        publisher = publisher_;
        garden = garden_;
        ownerHat = IHats(HATS).mintTopHat(address(this), "Tech and Sun cross-chain steward authority", "");
        if (ownerHat != expectedTopHat) revert InvalidConfiguration();
        signerHat = IHats(HATS)
            .createHat(
                ownerHat, "Arbitrum Tech and Sun stewards", type(uint32).max, address(this), address(this), false, ""
            );
        uint256[] memory hats = new uint256[](1);
        hats[0] = signerHat;
        IHatsSignerGateV2.SetupParams memory params = IHatsSignerGateV2.SetupParams({
            ownerHat: ownerHat,
            signerHats: hats,
            safe: address(0),
            thresholdConfig: IHatsSignerGateV2.ThresholdConfig(0, 2, 2),
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
        // HSG enables these defaults. Remove all before the irreversible lock, in this same constructor.
        gate.disableDelegatecallTarget(0x40A2aCCbd92BCA938b02010E17A5b8929b49130D);
        gate.disableDelegatecallTarget(0xA1dabEF33b3B82c7814B6D82A79e50F4AC44102B);
        gate.disableDelegatecallTarget(0x9641d764fc13c8B624c04430C7356C1C7C8102e2);
        gate.lock();
        safe = IStewardSafe(gate.safe());
    }

    /// @dev Hats falls back to stored standing on a reverting eligibility call. Always explicitly return false.
    function getWearerStatus(address account, uint256 hat) external view returns (bool eligible, bool standing) {
        return (hat == signerHat && states[account].eligible, true);
    }

    function getHatStatus(uint256 hat) external view returns (bool) {
        return hat == signerHat;
    }

    function _ccipReceive(Client.Any2EVMMessage memory message) internal override nonReentrant {
        if (
            block.chainid != Codec.DESTINATION_CHAIN || message.sourceChainSelector != SOURCE_SELECTOR
                || keccak256(message.sender) != keccak256(abi.encode(publisher)) || message.destTokenAmounts.length != 0
        ) revert InvalidMessage();
        Codec.Update memory update = Codec.decode(message.data);
        address account = update.account;
        if (update.garden != garden || account == address(this) || account == address(gate) || account == address(safe)) {
            revert InvalidMessage();
        }
        uint64 revision = update.revision;
        bool eligible = update.eligible;
        State memory previous = states[account];
        if (revision < previous.revision) return;
        if (revision == previous.revision) {
            if (previous.eligible != eligible) revert ConflictingRevision();
            return;
        }
        // Commit authority first. Cleanup failure must NEVER roll back an authenticated revocation.
        states[account] = State(revision, eligible);
        emit StewardMirrored(account, revision, eligible);
        try this.reconcileFromMessage{ gas: 400_000 }(account) { }
        catch {
            emit ReconciliationDeferred(account);
        }
    }

    /// @notice Permissionless retry; roster authority always comes from the authenticated mirror.
    function reconcile(address account) external nonReentrant {
        _reconcile(account);
    }

    function reconcileFromMessage(address account) external {
        if (msg.sender != address(this)) revert OnlySelf();
        _reconcile(account);
    }

    function _reconcile(address account) private {
        State memory state = states[account];
        if (state.revision == 0) revert InvalidMessage();
        if (state.eligible) {
            if (!IHats(HATS).isWearerOfHat(account, signerHat)) IHats(HATS).mintHat(signerHat, account);
            if (gate.registeredSignerHats(account) != signerHat || !safe.isOwner(account)) {
                gate.claimSignerFor(signerHat, account);
            }
        } else {
            // Burning is cosmetic; the eligibility view already denies every signature from this account.
            if (safe.isOwner(account)) gate.removeSigner(account);
        }
        emit StewardReconciled(account, state.eligible);
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
        _code(
            0x9641d764fc13c8B624c04430C7356C1C7C8102e2, 0xecd5bd14a08c5d2122379900b2f272bdf107a7e92423c10dd5fe3254386c9939
        );
        _code(
            0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67, 0x50c3cdc4074750a7a974204a716c999edd37482f907608d960b2b025ee0b3317
        );
    }

    function _code(address dependency, bytes32 expected) private view {
        if (dependency.codehash != expected) revert DependencyMismatch(dependency);
    }
}
