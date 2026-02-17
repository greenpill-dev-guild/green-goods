// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IRouterClient } from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";

error NameTaken();
error InvalidSlug();
error NotProtocolMember();
error NotAuthorizedCaller();
error AlreadyHasName();
error CannotReleaseGardenName();
error NoNameToRelease();
error InsufficientFee();
error NameInCooldown();
error ZeroAddress();
error NotOwner();
error NoRefundAvailable();
error RefundTransferFailed();
error NoWithdrawableBalance();
error WithdrawTransferFailed();
error OnlySelf();
error InvalidCooldown();

interface IHats {
    function isWearerOfHat(address account, uint256 hatId) external view returns (bool);
}

/// @title GreenGoodsENS (L2 Sender)
/// @notice Manages *.greengoods.eth registrations on Arbitrum, relays to L1 via CCIP
/// @dev Deployed on Arbitrum. Sends cross-chain messages to GreenGoodsENSReceiver on Ethereum.
///      Gardener eligibility verified via Hats Protocol (protocolGardenersHatId).
contract GreenGoodsENS is Ownable {
    IRouterClient public immutable CCIP_ROUTER;
    uint64 public immutable ETHEREUM_CHAIN_SELECTOR;
    IHats public immutable HATS;
    uint256 public protocolHatId;
    address public l1Receiver;

    enum NameType {
        Gardener,
        Garden
    }

    // ─────── L2 Registration Cache ───────
    // Prevents collisions before CCIP delivery. L1 is source of truth.
    mapping(bytes32 slugHash => address owner) public slugOwner;
    mapping(bytes32 slugHash => NameType nameType) public slugNameType;
    mapping(address owner => string slug) public ownerToSlug;
    mapping(string slug => uint256 releasedAt) public slugReleasedAt;

    uint256 public constant MIN_SLUG_LENGTH = 3;
    uint256 public constant MAX_SLUG_LENGTH = 50;
    uint256 public constant DEFAULT_NAME_CHANGE_COOLDOWN = 30 days;
    uint256 public nameChangeCooldown;

    /// @notice Authorized callers (GardenToken contract, owner)
    mapping(address => bool) public authorizedCallers;

    /// @notice Tracks ETH from failed refunds, claimable via claimRefund()
    mapping(address => uint256) public failedRefunds;

    /// @notice Total ETH reserved for pending refund claims
    uint256 public totalPendingRefunds;

    // ─────── Events ───────
    event NameRegistrationSent(
        bytes32 indexed messageId, string slug, address indexed owner, NameType nameType, uint256 ccipFee
    );
    event NameReleaseSent(bytes32 indexed messageId, string slug, address indexed previousOwner);
    event L1ReceiverUpdated(address indexed oldReceiver, address indexed newReceiver);
    event AuthorizedCallerUpdated(address indexed caller, bool authorized);
    event ProtocolHatIdUpdated(uint256 oldHatId, uint256 newHatId);
    event NameChangeCooldownUpdated(uint256 oldCooldown, uint256 newCooldown);
    event RefundFailed(address indexed recipient, uint256 amount);
    event RefundClaimed(address indexed recipient, uint256 amount);

    constructor(
        address _ccipRouter,
        uint64 _ethereumChainSelector,
        address _l1Receiver,
        address _hats,
        uint256 _protocolHatId,
        address _owner
    ) {
        CCIP_ROUTER = IRouterClient(_ccipRouter);
        ETHEREUM_CHAIN_SELECTOR = _ethereumChainSelector;
        l1Receiver = _l1Receiver;
        HATS = IHats(_hats);
        protocolHatId = _protocolHatId;
        nameChangeCooldown = DEFAULT_NAME_CHANGE_COOLDOWN;
        _transferOwnership(_owner);
    }

    // ═══════════════════════════════════════════════════════
    // Registration (L2 → sends CCIP to L1)
    // ═══════════════════════════════════════════════════════

    /// @notice Register a garden name. Called by GardenToken during mintGarden().
    /// @param slug The subdomain (e.g., "miyawaki-park")
    /// @param gardenAccount The garden TBA address
    /// @dev msg.value must cover CCIP fee. Called by authorized caller (GardenToken).
    function registerGarden(string calldata slug, address gardenAccount) external payable {
        if (!authorizedCallers[msg.sender] && msg.sender != owner()) {
            revert NotAuthorizedCaller();
        }
        _validateSlug(slug);
        _cacheRegistration(slug, gardenAccount, NameType.Garden);
        _sendRegistrationMessage(slug, gardenAccount, NameType.Garden);
    }

    /// @notice Claim a personal *.greengoods.eth name (user-funded). Any protocol member.
    /// @param slug The subdomain (e.g., "alice")
    /// @dev msg.value must cover CCIP fee. Caller must wear the protocol hat.
    ///      Works for ALL roles: gardener, operator, owner, evaluator, funder, community.
    function claimName(string calldata slug) external payable {
        if (!HATS.isWearerOfHat(msg.sender, protocolHatId)) revert NotProtocolMember();
        _validateSlug(slug);
        _cacheRegistration(slug, msg.sender, NameType.Gardener);
        _sendRegistrationMessage(slug, msg.sender, NameType.Gardener);
    }

    /// @notice Claim a personal *.greengoods.eth name (contract-funded). Any protocol member.
    /// @dev CCIP fee paid from contract's ETH balance. Recommended for passkey users
    ///      who don't hold ETH. Contract must be pre-funded by owner.
    function claimNameSponsored(string calldata slug) external {
        if (!HATS.isWearerOfHat(msg.sender, protocolHatId)) revert NotProtocolMember();
        _validateSlug(slug);
        _cacheRegistration(slug, msg.sender, NameType.Gardener);
        _sendSponsoredRegistrationMessage(slug, msg.sender, NameType.Gardener);
    }

    /// @notice Release current name (gardener names only, owner-configurable cooldown)
    /// @dev Garden names (NameType.Garden) are immutable and cannot be released.
    function releaseName() external payable {
        string memory currentSlug = ownerToSlug[msg.sender];
        if (bytes(currentSlug).length == 0) revert NoNameToRelease();

        bytes32 slugHash = keccak256(bytes(currentSlug));
        if (slugOwner[slugHash] != msg.sender) revert NotOwner();
        if (slugNameType[slugHash] == NameType.Garden) revert CannotReleaseGardenName();

        slugReleasedAt[currentSlug] = block.timestamp;
        delete slugOwner[slugHash];
        delete slugNameType[slugHash];
        delete ownerToSlug[msg.sender];

        _sendReleaseMessage(currentSlug, msg.sender);
    }

    // ═══════════════════════════════════════════════════════
    // Views
    // ═══════════════════════════════════════════════════════

    /// @notice Check if slug is available on L2 cache
    /// @dev For authoritative check, query L1 receiver directly
    function available(string calldata slug) external view returns (bool) {
        bytes32 slugHash = keccak256(bytes(slug));
        if (slugOwner[slugHash] != address(0)) return false;
        uint256 releasedAt = slugReleasedAt[slug];
        if (releasedAt > 0 && block.timestamp < releasedAt + nameChangeCooldown) return false;
        return true;
    }

    /// @notice Get the CCIP fee for a registration message
    function getRegistrationFee(string calldata slug, address _owner, NameType nameType) external view returns (uint256) {
        bytes memory data = abi.encode(uint8(0), slug, _owner, nameType);
        Client.EVM2AnyMessage memory message = _buildMessage(data);
        return CCIP_ROUTER.getFee(ETHEREUM_CHAIN_SELECTOR, message);
    }

    /// @notice Get the CCIP fee for a release message
    function getReleaseFee(string calldata slug) external view returns (uint256) {
        bytes memory data = abi.encode(uint8(1), slug, address(0), NameType.Gardener);
        Client.EVM2AnyMessage memory message = _buildMessage(data);
        return CCIP_ROUTER.getFee(ETHEREUM_CHAIN_SELECTOR, message);
    }

    // ═══════════════════════════════════════════════════════
    // Internal — CCIP Messaging
    // ═══════════════════════════════════════════════════════

    function _sendRegistrationMessage(string calldata slug, address _owner, NameType nameType) internal {
        bytes memory data = abi.encode(uint8(0), slug, _owner, nameType);
        Client.EVM2AnyMessage memory message = _buildMessage(data);

        uint256 fee = CCIP_ROUTER.getFee(ETHEREUM_CHAIN_SELECTOR, message);
        if (msg.value < fee) revert InsufficientFee();

        bytes32 messageId = CCIP_ROUTER.ccipSend{ value: fee }(ETHEREUM_CHAIN_SELECTOR, message);

        // Refund excess (pull-pattern: track failed refunds for later withdrawal)
        if (msg.value > fee) {
            uint256 refundAmount = msg.value - fee;
            (bool ok,) = msg.sender.call{ value: refundAmount }("");
            if (!ok) {
                failedRefunds[msg.sender] += refundAmount;
                totalPendingRefunds += refundAmount;
                emit RefundFailed(msg.sender, refundAmount);
            }
        }

        emit NameRegistrationSent(messageId, slug, _owner, nameType, fee);
    }

    /// @dev Same as _sendRegistrationMessage but pays CCIP fee from contract balance.
    ///      Must reserve ETH for pending refund claims (totalPendingRefunds).
    function _sendSponsoredRegistrationMessage(string calldata slug, address _owner, NameType nameType) internal {
        bytes memory data = abi.encode(uint8(0), slug, _owner, nameType);
        Client.EVM2AnyMessage memory message = _buildMessage(data);

        uint256 fee = CCIP_ROUTER.getFee(ETHEREUM_CHAIN_SELECTOR, message);
        if (address(this).balance < fee + totalPendingRefunds) revert InsufficientFee();

        bytes32 messageId = CCIP_ROUTER.ccipSend{ value: fee }(ETHEREUM_CHAIN_SELECTOR, message);
        emit NameRegistrationSent(messageId, slug, _owner, nameType, fee);
    }

    function _sendReleaseMessage(string memory slug, address previousOwner) internal {
        bytes memory data = abi.encode(uint8(1), slug, previousOwner, NameType.Gardener);
        Client.EVM2AnyMessage memory message = _buildMessage(data);

        uint256 fee = CCIP_ROUTER.getFee(ETHEREUM_CHAIN_SELECTOR, message);
        if (msg.value < fee) revert InsufficientFee();

        bytes32 messageId = CCIP_ROUTER.ccipSend{ value: fee }(ETHEREUM_CHAIN_SELECTOR, message);

        if (msg.value > fee) {
            uint256 refundAmount = msg.value - fee;
            (bool ok,) = msg.sender.call{ value: refundAmount }("");
            if (!ok) {
                failedRefunds[msg.sender] += refundAmount;
                totalPendingRefunds += refundAmount;
                emit RefundFailed(msg.sender, refundAmount);
            }
        }

        emit NameReleaseSent(messageId, slug, previousOwner);
    }

    function _buildMessage(bytes memory data) internal view returns (Client.EVM2AnyMessage memory) {
        return Client.EVM2AnyMessage({
            receiver: abi.encode(l1Receiver),
            data: data,
            tokenAmounts: new Client.EVMTokenAmount[](0),
            extraArgs: Client._argsToBytes(Client.EVMExtraArgsV1({ gasLimit: 500_000 })),
            feeToken: address(0) // Pay in native ETH
         });
    }

    // ═══════════════════════════════════════════════════════
    // Internal — Validation & Cache
    // ═══════════════════════════════════════════════════════

    function _cacheRegistration(string calldata slug, address _owner, NameType nameType) internal {
        if (_owner == address(0)) revert ZeroAddress();
        bytes32 slugHash = keccak256(bytes(slug));
        if (slugOwner[slugHash] != address(0)) revert NameTaken();

        uint256 releasedAt = slugReleasedAt[slug];
        if (releasedAt > 0 && block.timestamp < releasedAt + nameChangeCooldown) {
            revert NameInCooldown();
        }

        if (bytes(ownerToSlug[_owner]).length > 0) revert AlreadyHasName();

        slugOwner[slugHash] = _owner;
        slugNameType[slugHash] = nameType;
        ownerToSlug[_owner] = slug;

        if (releasedAt > 0) delete slugReleasedAt[slug];
    }

    /// @dev Slug validation rules: 3-50 chars, [a-z0-9-], no leading/trailing/consecutive hyphens.
    ///      Mirrored in: ENSReceiver._isValidSlug(), shared/utils/blockchain/ens.ts validateSlug(),
    ///      shared/hooks/ens/useSlugForm.ts slugSchema. If updating, sync all four.
    function _validateSlug(string calldata slug) internal pure {
        bytes memory b = bytes(slug);
        uint256 len = b.length;
        if (len < MIN_SLUG_LENGTH || len > MAX_SLUG_LENGTH) revert InvalidSlug();
        if (b[0] == 0x2D || b[len - 1] == 0x2D) revert InvalidSlug(); // no leading/trailing hyphens

        for (uint256 i = 0; i < len;) {
            bytes1 c = b[i];
            bool valid = (c >= 0x61 && c <= 0x7A) // a-z
                || (c >= 0x30 && c <= 0x39) // 0-9
                || c == 0x2D; // hyphen
            if (!valid) revert InvalidSlug();
            if (c == 0x2D && i + 1 < len && b[i + 1] == 0x2D) revert InvalidSlug(); // no consecutive hyphens
            unchecked {
                ++i;
            }
        }
    }

    // ═══════════════════════════════════════════════════════
    // Refund Withdrawal (pull-pattern)
    // ═══════════════════════════════════════════════════════

    /// @notice Claim ETH from failed refunds
    function claimRefund() external {
        uint256 amount = failedRefunds[msg.sender];
        if (amount == 0) revert NoRefundAvailable();
        failedRefunds[msg.sender] = 0;
        totalPendingRefunds -= amount;
        (bool ok,) = msg.sender.call{ value: amount }("");
        if (!ok) revert RefundTransferFailed();
        emit RefundClaimed(msg.sender, amount);
    }

    // ═══════════════════════════════════════════════════════
    // Admin
    // ═══════════════════════════════════════════════════════

    function setL1Receiver(address _l1Receiver) external onlyOwner {
        if (_l1Receiver == address(0)) revert ZeroAddress();
        address old = l1Receiver;
        l1Receiver = _l1Receiver;
        emit L1ReceiverUpdated(old, _l1Receiver);
    }

    function setAuthorizedCaller(address caller, bool authorized) external onlyOwner {
        if (caller == address(0)) revert ZeroAddress();
        authorizedCallers[caller] = authorized;
        emit AuthorizedCallerUpdated(caller, authorized);
    }

    /// @notice Update the protocol hat ID (e.g., after Hats tree restructuring)
    function setProtocolHatId(uint256 _protocolHatId) external onlyOwner {
        uint256 old = protocolHatId;
        protocolHatId = _protocolHatId;
        emit ProtocolHatIdUpdated(old, _protocolHatId);
    }

    /// @notice Update the cooldown enforced after releasing a slug.
    function setNameChangeCooldown(uint256 _cooldown) external onlyOwner {
        if (_cooldown == 0) revert InvalidCooldown();
        uint256 old = nameChangeCooldown;
        nameChangeCooldown = _cooldown;
        emit NameChangeCooldownUpdated(old, _cooldown);
    }

    /// @notice Withdraw stuck ETH (excess CCIP fees, etc.)
    /// @dev Reserves totalPendingRefunds for failed refund claims.
    function withdrawETH(address to) external onlyOwner {
        uint256 bal = address(this).balance;
        if (bal <= totalPendingRefunds) revert NoWithdrawableBalance();
        uint256 withdrawable = bal - totalPendingRefunds;
        (bool ok,) = to.call{ value: withdrawable }("");
        if (!ok) revert WithdrawTransferFailed();
    }

    /// @notice Allow contract to receive ETH (for CCIP fee funding)
    receive() external payable { }
}
