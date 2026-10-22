// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import { CCIPReceiver } from "@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol";
import { IRouterClient } from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";

/// @notice Shared voucher transport and governance boundary; no custody or mutable peer rerouting.
/// @dev Live owners must satisfy the repository's community Safe release gates. Local EOA owners
///      are rehearsal stand-ins. A guardian can stop execution, never resume it or bypass the delay.
abstract contract VoucherEndpoint is OwnableUpgradeable, UUPSUpgradeable, ReentrancyGuardUpgradeable, CCIPReceiver {
    uint256 public constant UPGRADE_DELAY = 48 hours;
    address public immutable CCIP_ROUTER;
    uint256 public immutable LOCAL_CHAIN_ID;

    address public guardian;
    uint64 public remoteChainSelector;
    uint256 public remoteChainId;
    address public remotePeer;
    bool public paused;
    address public scheduledImplementation;
    bytes32 public scheduledCodehash;
    uint64 public upgradeAvailableAt;

    error InvalidEndpoint();
    error VoucherPaused();
    error NotPauseAuthority();
    error InvalidVoucherPeer();
    error AttachedTokensForbidden();
    error UpgradeNotReady();
    error ImmutableEndpointMismatch();
    error InsufficientTransportFee(uint256 required, uint256 available);

    event VoucherPauseChanged(bool paused);
    event VoucherUpgradeScheduled(address indexed implementation, bytes32 codehash, uint64 availableAt);
    event VoucherUpgradeCancelled();
    event VoucherEndpointPinned(
        uint256 localChainId, address router, uint64 remoteChainSelector, uint256 remoteChainId, address remotePeer
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address router_) CCIPReceiver(router_) {
        CCIP_ROUTER = router_;
        LOCAL_CHAIN_ID = block.chainid;
        _disableInitializers();
    }

    function __VoucherEndpoint_init(
        address owner_,
        address guardian_,
        uint64 remoteSelector_,
        uint256 remoteChainId_,
        address remotePeer_
    )
        internal
        onlyInitializing
    {
        if (
            owner_ == address(0) || guardian_ == address(0) || owner_ == guardian_ || remoteSelector_ == 0
                || remoteChainId_ == 0 || remotePeer_ == address(0)
        ) revert InvalidEndpoint();
        __Ownable_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        _transferOwnership(owner_);
        guardian = guardian_;
        remoteChainSelector = remoteSelector_;
        remoteChainId = remoteChainId_;
        remotePeer = remotePeer_;
        paused = true;
        emit VoucherEndpointPinned(LOCAL_CHAIN_ID, CCIP_ROUTER, remoteSelector_, remoteChainId_, remotePeer_);
        emit VoucherPauseChanged(true);
    }

    modifier whenVoucherActive() {
        if (paused) revert VoucherPaused();
        _;
    }

    function pause() external nonReentrant {
        if (msg.sender != owner() && msg.sender != guardian) revert NotPauseAuthority();
        paused = true;
        emit VoucherPauseChanged(true);
    }

    function unpause() external onlyOwner nonReentrant {
        paused = false;
        emit VoucherPauseChanged(false);
    }

    function transferOwnership(address newOwner) public override onlyOwner nonReentrant {
        super.transferOwnership(newOwner);
    }

    /// @dev Renouncing would strand accepted entitlements and recovery administration.
    function renounceOwnership() public view override onlyOwner {
        revert InvalidEndpoint();
    }

    function scheduleUpgrade(address implementation) external onlyOwner nonReentrant {
        if (implementation.code.length == 0) revert InvalidEndpoint();
        scheduledImplementation = implementation;
        scheduledCodehash = implementation.codehash;
        upgradeAvailableAt = uint64(block.timestamp + UPGRADE_DELAY);
        emit VoucherUpgradeScheduled(implementation, scheduledCodehash, upgradeAvailableAt);
    }

    function cancelUpgrade() external onlyOwner nonReentrant {
        _clearUpgrade();
        emit VoucherUpgradeCancelled();
    }

    function upgradeTo(address implementation) public override nonReentrant {
        super.upgradeTo(implementation);
    }

    function upgradeToAndCall(address implementation, bytes memory data) public payable override nonReentrant {
        super.upgradeToAndCall(implementation, data);
    }

    function _authorizeUpgrade(address implementation) internal override onlyOwner {
        if (
            !paused || implementation != scheduledImplementation || implementation.codehash != scheduledCodehash
                || upgradeAvailableAt == 0 || block.timestamp < upgradeAvailableAt
        ) revert UpgradeNotReady();
        if (
            VoucherEndpoint(payable(implementation)).CCIP_ROUTER() != CCIP_ROUTER
                || VoucherEndpoint(payable(implementation)).LOCAL_CHAIN_ID() != LOCAL_CHAIN_ID
        ) revert ImmutableEndpointMismatch();
        _clearUpgrade();
    }

    function _clearUpgrade() private {
        scheduledImplementation = address(0);
        scheduledCodehash = bytes32(0);
        upgradeAvailableAt = 0;
    }

    /// @dev Incoming results can reconcile while paused; derived receivers own execution policy.
    function _authenticate(Client.Any2EVMMessage memory message) internal view {
        if (
            block.chainid != LOCAL_CHAIN_ID || message.sourceChainSelector != remoteChainSelector
                || message.sender.length != 32 || keccak256(message.sender) != keccak256(abi.encode(remotePeer))
        ) revert InvalidVoucherPeer();
        if (message.destTokenAmounts.length != 0) revert AttachedTokensForbidden();
    }

    function _quote(bytes memory payload, uint256 gasLimit) internal view returns (uint256) {
        return IRouterClient(CCIP_ROUTER).getFee(remoteChainSelector, _message(payload, gasLimit));
    }

    function _send(bytes memory payload, uint256 gasLimit) internal returns (bytes32) {
        Client.EVM2AnyMessage memory message = _message(payload, gasLimit);
        uint256 fee = IRouterClient(CCIP_ROUTER).getFee(remoteChainSelector, message);
        if (address(this).balance < fee) revert InsufficientTransportFee(fee, address(this).balance);
        return IRouterClient(CCIP_ROUTER).ccipSend{ value: fee }(remoteChainSelector, message);
    }

    function _message(bytes memory payload, uint256 gasLimit) private view returns (Client.EVM2AnyMessage memory) {
        if (block.chainid != LOCAL_CHAIN_ID) revert InvalidEndpoint();
        return Client.EVM2AnyMessage({
            receiver: abi.encode(remotePeer),
            data: payload,
            tokenAmounts: new Client.EVMTokenAmount[](0),
            feeToken: address(0),
            extraArgs: Client._argsToBytes(
                Client.GenericExtraArgsV2({ gasLimit: gasLimit, allowOutOfOrderExecution: true })
            )
        });
    }

    receive() external payable { }

    // 50 slots less six used slots (packed fields counted together).
    uint256[44] private __gap;
}
