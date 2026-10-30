// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { CCIPReceiver } from "@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol";
import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import { IHats } from "../interfaces/IHats.sol";
import { IHatsSignerGateV2, IStewardSafe } from "../interfaces/IHatsSignerGateV2.sol";
import { StewardSafeLib } from "../libraries/StewardSafeLib.sol";
import { StewardRoleCodec as Codec } from "../libraries/StewardRoleCodec.sol";

/// @notice Authenticated steward Safe that mirrors one garden's Hats steward roster.
/// @dev One valid steward signs alone; two or more always need two signatures. The locked gate
///      enforces this however an owner joined (absolute minimum one, target two). An optional
///      starting signer can act before the first mirror arrives; its exception ends once its own
///      Hats status is mirrored. No operator, platform admin, upgrade or arbitrary execution path.
///      This contract alone holds the top Hat.
contract StewardSafeReceiver is CCIPReceiver, ReentrancyGuard {
    address public constant HATS = 0x3bc1A0Ad72417f2d411118085256fC53CBdDd137;
    address public constant HSG_IMPLEMENTATION = 0x148057884AC910Bdd93693F230C5c35a8c47CA3b;
    address public constant MODULE_FACTORY = 0x000000000000aDdB49795b0f9bA5BC298cDda236;
    /// @dev Pinned v1.4.1 MultiSendCallOnly; the only delegatecall target left enabled for batches.
    address public constant CALL_ONLY_MULTISEND = 0x9641d764fc13c8B624c04430C7356C1C7C8102e2;
    uint64 public constant SOURCE_SELECTOR = Codec.SOURCE_SELECTOR;
    bytes32 public constant DOMAIN = Codec.DOMAIN;
    address public immutable publisher;
    address public immutable garden;
    uint256 public immutable ownerHat;
    uint256 public immutable signerHat;
    IHatsSignerGateV2 public immutable gate;
    IStewardSafe public immutable safe;
    address public immutable bootstrapSigner;

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
        string memory gardenName,
        uint256 expectedTopHat,
        uint256 salt,
        address bootstrapSigner_
    )
        CCIPReceiver(router_)
    {
        if (
            block.chainid != Codec.DESTINATION_CHAIN || router_.code.length == 0 || uint160(publisher_) <= 1
                || garden_ == address(0) || bytes(gardenName).length == 0 || expectedTopHat == 0
                || bootstrapSigner_ == address(1) || bootstrapSigner_ == address(this)
        ) revert InvalidConfiguration();
        bootstrapSigner = bootstrapSigner_;
        publisher = publisher_;
        garden = garden_;
        (ownerHat, signerHat, gate, safe) = StewardSafeLib.deploy(gardenName, expectedTopHat, salt);
        if (bootstrapSigner_ != address(0)) {
            if (bootstrapSigner_ == address(gate) || bootstrapSigner_ == address(safe)) revert InvalidConfiguration();
            IHats(HATS).mintHat(signerHat, bootstrapSigner_);
            gate.claimSignerFor(signerHat, bootstrapSigner_);
        }
        gate.lock();
    }

    /// @dev Hats falls back to stored standing on a reverting eligibility call. Always explicitly return false.
    function getWearerStatus(address account, uint256 hat) external view returns (bool eligible, bool standing) {
        State memory state = states[account];
        bool startingSigner = account == bootstrapSigner && account != address(0) && state.revision == 0;
        return (hat == signerHat && (state.eligible || startingSigner), true);
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
        StewardSafeLib.reconcile(gate, safe, signerHat, account, state.eligible);
        emit StewardReconciled(account, state.eligible);
    }
}
