// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import { IRouterClient } from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import { IHatsModule } from "../interfaces/IHatsModule.sol";
import { IStewardRoleObserver } from "../interfaces/IStewardRoleObserver.sol";
import { StewardRoleCodec as Codec } from "../libraries/StewardRoleCodec.sol";

/// @notice Immutable Arbitrum authority for one garden's Gnosis steward Safe.
/// @dev Funded hooks dispatch automatically; transport failure leaves a permissionless retry. Delivery is asynchronous.
contract StewardRolePublisher is ReentrancyGuard, IStewardRoleObserver {
    bytes32 public constant DOMAIN = Codec.DOMAIN;
    uint64 public constant DESTINATION_SELECTOR = Codec.DESTINATION_SELECTOR;
    uint256 public constant DESTINATION_GAS = 1_200_000;
    address public immutable router;
    IHatsModule public immutable hatsModule;
    address public immutable garden;
    uint256 public immutable stewardHat;
    address public immutable receiver;

    struct State {
        uint64 revision;
        bool eligible;
    }
    mapping(address => State) public states;
    mapping(address account => uint64 revision) public dispatchedRevision;

    error InvalidConfiguration();
    error InvalidAccount();
    error IncorrectFee();
    error OnlySelf();
    error InsufficientTransportFunding();
    event StewardQueued(address indexed account, uint64 revision, bool eligible);
    event StewardDispatched(address indexed account, uint64 revision, bool eligible, bytes32 messageId);
    event TransportFunded(address indexed sender, uint256 value);
    event DispatchDeferred(address indexed account, uint64 revision);

    constructor(address router_, address hatsModule_, address garden_, uint256 stewardHat_, address receiver_) {
        if (
            block.chainid != Codec.SOURCE_CHAIN || router_.code.length == 0 || hatsModule_.code.length == 0
                || garden_ == address(0) || stewardHat_ == 0 || uint160(receiver_) <= 1
        ) revert InvalidConfiguration();
        router = router_;
        hatsModule = IHatsModule(hatsModule_);
        garden = garden_;
        stewardHat = stewardHat_;
        receiver = receiver_;
    }

    function syncSteward(address account) public override nonReentrant {
        State memory state = _sync(account);
        // Never subsidize unknown non-stewards or repeat an already-dispatched revision.
        if (
            address(this).balance == 0 || state.revision <= dispatchedRevision[account]
                || (!state.eligible && dispatchedRevision[account] == 0)
        ) return;
        try this.dispatchFromBalance{ gas: 600_000 }(account) { }
        catch {
            emit DispatchDeferred(account, state.revision);
        }
    }

    /// @notice Native transport fuel only. There is no withdrawal or arbitrary spending path.
    receive() external payable {
        emit TransportFunded(msg.sender, msg.value);
    }

    /// @dev Separate call frame preserves the queued revision if quoting or CCIP dispatch fails.
    function dispatchFromBalance(address account) external {
        if (msg.sender != address(this)) revert OnlySelf();
        State memory state = states[account];
        Client.EVM2AnyMessage memory message = _message(account, state);
        uint256 fee = IRouterClient(router).getFee(DESTINATION_SELECTOR, message);
        if (address(this).balance < fee) revert InsufficientTransportFunding();
        _send(account, state, message, fee);
    }

    function quoteSteward(address account) external view returns (uint256) {
        State memory state = _nextState(account);
        return IRouterClient(router).getFee(DESTINATION_SELECTOR, _message(account, state));
    }

    /// @notice Refresh immediately before dispatch, so an old queued grant cannot be sent after revocation.
    function dispatchSteward(address account) external payable nonReentrant returns (bytes32 id) {
        State memory state = _sync(account);
        Client.EVM2AnyMessage memory message = _message(account, state);
        uint256 fee = IRouterClient(router).getFee(DESTINATION_SELECTOR, message);
        if (msg.value != fee) revert IncorrectFee();
        return _send(account, state, message, fee);
    }

    function _send(
        address account,
        State memory state,
        Client.EVM2AnyMessage memory message,
        uint256 fee
    )
        private
        returns (bytes32 id)
    {
        id = IRouterClient(router).ccipSend{ value: fee }(DESTINATION_SELECTOR, message);
        dispatchedRevision[account] = state.revision;
        emit StewardDispatched(account, state.revision, state.eligible, id);
    }

    function _sync(address account) private returns (State memory next) {
        next = _nextState(account);
        if (next.revision != states[account].revision) {
            states[account] = next;
            emit StewardQueued(account, next.revision, next.eligible);
        }
        _afterSync(account);
    }

    /// @dev Native Safe reconciliation is isolated by the dual-chain publisher; legacy publishers have no local Safe.
    function _afterSync(address) internal virtual { }

    function _nextState(address account) private view returns (State memory next) {
        if (uint160(account) <= 1) revert InvalidAccount();
        next = states[account];
        bool eligible = _isSteward(account);
        if (next.revision == 0 || next.eligible != eligible) {
            next.revision++;
            next.eligible = eligible;
        }
    }

    function _isSteward(address account) internal view returns (bool) {
        // Changing/deconfiguring the pinned source hat cannot silently grant a different roster.
        (, uint256 currentHat,,,,,, bool configured) = hatsModule.getGardenHatIds(garden);
        if (!configured || currentHat != stewardHat) return false;
        // Unavailable authority is a failed refresh, not a caller-chosen revocation.
        return hatsModule.isStewardOf(garden, account);
    }

    function _message(address account, State memory state) private view returns (Client.EVM2AnyMessage memory) {
        return Client.EVM2AnyMessage({
            receiver: abi.encode(receiver),
            data: Codec.encode(garden, account, state.revision, state.eligible),
            tokenAmounts: new Client.EVMTokenAmount[](0),
            feeToken: address(0),
            extraArgs: Client._argsToBytes(
                Client.GenericExtraArgsV2({ gasLimit: DESTINATION_GAS, allowOutOfOrderExecution: true })
            )
        });
    }
}
