// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import { IRouterClient } from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";

import { ZeroAddress } from "../CommonErrors.sol";
import { IGreenGoodsENSRegistrar } from "../interfaces/IGreenGoodsENSRegistrar.sol";
import { ENSSlug } from "../lib/ENSSlug.sol";

/// @title GreenGoodsENSRegistrar (L2 sender, upgradeable)
/// @notice Registers `*.greengoods.eth` names on Arbitrum and relays them to the L1 receiver over
/// CCIP. It replaces `GreenGoodsENS`, which cannot be upgraded and gave operators no way to repair
/// a member's name.
/// @dev The L1 receiver is the source of truth for ENS records; this contract is the gate in front
/// of it. The CCIP payloads are the ones `GreenGoodsENSReceiver` already reads, so the receiver
/// only needs `setL2Sender` to follow this contract.
///
/// Garden names are registered by the garden token at mint and are never released. Member names
/// carried over from the previous sender are released or reassigned only by the owner, through
/// the recovery functions below, each of which records who acted and why.
contract GreenGoodsENSRegistrar is IGreenGoodsENSRegistrar, OwnableUpgradeable, UUPSUpgradeable {
    uint256 public constant DEFAULT_NAME_CHANGE_COOLDOWN = 30 days;
    uint256 public constant MIN_NAME_CHANGE_COOLDOWN = 1 hours;
    uint256 public constant MAX_NAME_CHANGE_COOLDOWN = 365 days;
    /// @dev The receiver's ENS writes fit in this; it is the value the previous sender used.
    uint256 private constant L1_GAS_LIMIT = 500_000;
    uint8 private constant ACTION_REGISTER = 0;
    uint8 private constant ACTION_RELEASE = 1;

    IRouterClient public ccipRouter;
    uint64 public ethereumChainSelector;
    address public l1Receiver;

    mapping(bytes32 slugHash => address owner) public slugOwner;
    mapping(bytes32 slugHash => NameType nameType) public slugNameType;
    mapping(address owner => string slug) public ownerToSlug;
    mapping(bytes32 slugHash => uint256 releasedAt) public slugReleasedAt;
    uint256 public nameChangeCooldown;

    /// @notice Contracts that may register garden names (the garden token).
    mapping(address caller => bool authorized) public authorizedCallers;
    /// @notice ETH from refunds that could not be delivered, claimable via `claimRefund`.
    mapping(address recipient => uint256 amount) public failedRefunds;
    uint256 public totalPendingRefunds;
    /// @notice True until the owner finishes carrying names over from the previous sender.
    bool public importOpen;

    // Storage is append only (storage-layouts/GreenGoodsENSRegistrar.json); new variables take slots from this gap.
    uint256[39] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _ccipRouter,
        uint64 _ethereumChainSelector,
        address _l1Receiver,
        address _owner
    )
        external
        initializer
    {
        if (_ccipRouter == address(0) || _l1Receiver == address(0) || _owner == address(0)) revert ZeroAddress();
        __Ownable_init();
        ccipRouter = IRouterClient(_ccipRouter);
        ethereumChainSelector = _ethereumChainSelector;
        l1Receiver = _l1Receiver;
        nameChangeCooldown = DEFAULT_NAME_CHANGE_COOLDOWN;
        importOpen = true;
        _transferOwnership(_owner);
    }

    /// @notice Register a garden's name. Called by the garden token while it mints the garden.
    /// @dev `msg.value` must cover the CCIP fee; the excess is refunded.
    function registerGarden(string calldata slug, address gardenAccount) external payable virtual {
        _registerGarden(slug, gardenAccount, 0);
    }

    /// @notice Release a member's name on both chains, for a username change or a lost account.
    /// @param expectedOwner The account the operator verified holds the name. A stale request
    /// (the name moved since the support record was written) reverts instead of releasing it.
    /// @param supportReference The support record that justifies the release.
    /// @dev The name enters the usual cooldown. `msg.value` pays the CCIP fee when sent;
    /// otherwise this contract's balance does. L1 releases only when its own holder matches and
    /// does not check the name's type, so the operator checks L1's holder and type first.
    function adminReleaseName(
        string calldata slug,
        address expectedOwner,
        bytes32 supportReference
    )
        external
        payable
        onlyOwner
    {
        if (supportReference == bytes32(0)) revert ReferenceRequired();
        _requireImportFinished();
        bytes32 slugHash = keccak256(bytes(slug));
        address previousOwner = slugOwner[slugHash];
        if (previousOwner == address(0)) revert NameNotRegistered();
        if (previousOwner != expectedOwner) revert NameOwnerMismatch(previousOwner);
        if (slugNameType[slugHash] == NameType.Garden) revert CannotReleaseGardenName();

        slugReleasedAt[slugHash] = block.timestamp;
        delete slugOwner[slugHash];
        delete slugNameType[slugHash];
        delete ownerToSlug[previousOwner];
        emit NameReleasedByOperator(slug, previousOwner, msg.sender, supportReference);

        (bytes32 messageId,) = _send(abi.encode(ACTION_RELEASE, slug, previousOwner, NameType.Gardener), type(uint256).max);
        emit NameReleaseSent(messageId, slug, previousOwner);
    }

    /// @notice Give a free name to an account without waiting for the cooldown: the second step of
    /// returning a member's exact name to their new account.
    /// @dev The name must be free here. Release it first and confirm the L1 receiver shows it
    /// free before assigning, or the receiver skips the registration and the chains disagree.
    function adminAssignName(string calldata slug, address newOwner, bytes32 supportReference) external payable onlyOwner {
        if (supportReference == bytes32(0)) revert ReferenceRequired();
        _requireImportFinished();
        ENSSlug.validate(slug);
        _recordName(slug, newOwner, NameType.Gardener, true);
        emit NameAssignedByOperator(slug, newOwner, msg.sender, supportReference);
        _sendRegistration(slug, newOwner, NameType.Gardener, type(uint256).max);
    }

    /// @notice Send a name's registration to L1 again, unchanged. L1 skips a registration it
    /// cannot apply (the name or the account was still held there) and reports nothing back, so
    /// this is how an operator repairs the two chains once L1 is clear.
    function adminResendRegistration(string calldata slug, bytes32 supportReference) external payable onlyOwner {
        if (supportReference == bytes32(0)) revert ReferenceRequired();
        _requireImportFinished();
        bytes32 slugHash = keccak256(bytes(slug));
        address holder = slugOwner[slugHash];
        if (holder == address(0)) revert NameNotRegistered();
        emit NameRegistrationResent(slug, holder, msg.sender, supportReference);
        _sendRegistration(slug, holder, slugNameType[slugHash], type(uint256).max);
    }

    /// @notice Record names the previous sender already registered. Sends nothing to L1, where
    /// they are registered already.
    function importNames(ImportedName[] calldata names) external onlyOwner {
        if (!importOpen) revert ImportClosed();
        for (uint256 i; i < names.length; ++i) {
            ENSSlug.validate(names[i].slug);
            _recordName(names[i].slug, names[i].owner, names[i].nameType, true);
            emit NameImported(names[i].slug, names[i].owner, names[i].nameType);
        }
    }

    /// @notice End the import for good, before this contract is wired to the garden token and L1.
    function finishImport() external onlyOwner {
        if (!importOpen) revert ImportClosed();
        importOpen = false;
        emit ImportFinished();
    }

    /// @notice Whether a name is free here. The L1 receiver has the final word.
    function available(string calldata slug) external view returns (bool) {
        bytes32 slugHash = keccak256(bytes(slug));
        if (slugOwner[slugHash] != address(0)) return false;
        return !_inCooldown(slugHash);
    }

    function getRegistrationFee(string calldata slug, address _owner, NameType nameType) external view returns (uint256) {
        return ccipRouter.getFee(ethereumChainSelector, _buildMessage(abi.encode(ACTION_REGISTER, slug, _owner, nameType)));
    }

    function getReleaseFee(string calldata slug) external view returns (uint256) {
        return ccipRouter.getFee(
            ethereumChainSelector, _buildMessage(abi.encode(ACTION_RELEASE, slug, address(0), NameType.Gardener))
        );
    }

    /// @notice Claim ETH from a refund that could not be delivered.
    function claimRefund() external {
        uint256 amount = failedRefunds[msg.sender];
        if (amount == 0) revert NoRefundAvailable();
        failedRefunds[msg.sender] = 0;
        totalPendingRefunds -= amount;
        (bool ok,) = msg.sender.call{ value: amount }("");
        if (!ok) revert RefundTransferFailed();
        emit RefundClaimed(msg.sender, amount);
    }

    /// @notice Deliver a waiting refund to an address the creditor cannot reach itself. The garden
    /// token forwards a minter's payment but cannot receive ETH, so its refunds wait here.
    function adminRedirectRefund(address creditor, address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        uint256 amount = failedRefunds[creditor];
        if (amount == 0) revert NoRefundAvailable();
        failedRefunds[creditor] = 0;
        totalPendingRefunds -= amount;
        emit RefundRedirected(creditor, to, amount);
        (bool ok,) = to.call{ value: amount }("");
        if (!ok) revert RefundTransferFailed();
    }

    /// @notice Withdraw this contract's ETH, less what is owed to refund claims.
    function withdrawETH(address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        uint256 balance = address(this).balance;
        if (balance <= totalPendingRefunds) revert NoWithdrawableBalance();
        (bool ok,) = to.call{ value: balance - totalPendingRefunds }("");
        if (!ok) revert WithdrawTransferFailed();
    }

    /// @notice Accept ETH that pays CCIP fees for operator actions.
    receive() external payable { }

    function setL1Receiver(address _l1Receiver) external onlyOwner {
        if (_l1Receiver == address(0)) revert ZeroAddress();
        emit L1ReceiverUpdated(l1Receiver, _l1Receiver);
        l1Receiver = _l1Receiver;
    }

    function setAuthorizedCaller(address caller, bool authorized) external onlyOwner {
        if (caller == address(0)) revert ZeroAddress();
        authorizedCallers[caller] = authorized;
        emit AuthorizedCallerUpdated(caller, authorized);
    }

    function setNameChangeCooldown(uint256 cooldown) external onlyOwner {
        if (cooldown < MIN_NAME_CHANGE_COOLDOWN || cooldown > MAX_NAME_CHANGE_COOLDOWN) revert InvalidCooldown();
        emit NameChangeCooldownUpdated(nameChangeCooldown, cooldown);
        nameChangeCooldown = cooldown;
    }

    /// @dev An ownerless registrar could never be upgraded, repaired or drained of its fees.
    function renounceOwnership() public view override onlyOwner {
        revert OwnershipCannotBeRenounced();
    }

    // solhint-disable-next-line no-empty-blocks
    function _authorizeUpgrade(address) internal override onlyOwner { }

    /// @dev One name per account and one account per name. `skipCooldown` is for the owner's
    /// paths, which act on a name a support decision already cleared.
    function _recordName(string calldata slug, address _owner, NameType nameType, bool skipCooldown) internal {
        if (_owner == address(0)) revert ZeroAddress();
        bytes32 slugHash = keccak256(bytes(slug));
        if (slugOwner[slugHash] != address(0)) revert NameTaken();
        if (!skipCooldown && _inCooldown(slugHash)) revert NameInCooldown();
        if (bytes(ownerToSlug[_owner]).length > 0) revert AlreadyHasName();

        slugOwner[slugHash] = _owner;
        slugNameType[slugHash] = nameType;
        ownerToSlug[_owner] = slug;
        delete slugReleasedAt[slugHash];
    }

    /// @dev Until the import ends, a live registration could take a name the manifest still has
    /// to carry over, and L1 would never hear of the clash.
    function _requireImportFinished() internal view {
        if (importOpen) revert ImportStillOpen();
    }

    function _inCooldown(bytes32 slugHash) internal view returns (bool) {
        uint256 releasedAt = slugReleasedAt[slugHash];
        return releasedAt > 0 && block.timestamp < releasedAt + nameChangeCooldown;
    }

    function _registerGarden(string calldata slug, address gardenAccount, uint256 balanceFeeCap) internal {
        if (!authorizedCallers[msg.sender] && msg.sender != owner()) revert NotAuthorizedCaller();
        _requireImportFinished();
        ENSSlug.validate(slug);
        _recordName(slug, gardenAccount, NameType.Garden, false);
        _sendRegistration(slug, gardenAccount, NameType.Garden, balanceFeeCap);
    }

    function _sendRegistration(string calldata slug, address _owner, NameType nameType, uint256 balanceFeeCap) internal {
        (bytes32 messageId, uint256 fee) = _send(abi.encode(ACTION_REGISTER, slug, _owner, nameType), balanceFeeCap);
        emit NameRegistrationSent(messageId, slug, _owner, nameType, fee);
    }

    /// @dev Pays the CCIP fee from `msg.value`, refunding the excess. When the caller sent nothing,
    /// this contract's balance pays instead, up to `balanceFeeCap` (zero: the balance pays nothing)
    /// and never touching ETH owed to refund claims.
    function _send(bytes memory data, uint256 balanceFeeCap) internal returns (bytes32 messageId, uint256 fee) {
        Client.EVM2AnyMessage memory message = _buildMessage(data);
        fee = ccipRouter.getFee(ethereumChainSelector, message);
        uint256 payment = msg.value;
        if (payment == 0 && balanceFeeCap > 0) {
            if (fee > balanceFeeCap) revert BalanceFeeCapExceeded(fee, balanceFeeCap);
            if (address(this).balance < fee + totalPendingRefunds) revert InsufficientFee();
        } else if (payment < fee) {
            revert InsufficientFee();
        }

        messageId = ccipRouter.ccipSend{ value: fee }(ethereumChainSelector, message);

        if (payment > fee) {
            uint256 refund = payment - fee;
            (bool ok,) = msg.sender.call{ value: refund }("");
            if (!ok) {
                failedRefunds[msg.sender] += refund;
                totalPendingRefunds += refund;
                emit RefundFailed(msg.sender, refund);
            }
        }
    }

    function _buildMessage(bytes memory data) internal view returns (Client.EVM2AnyMessage memory) {
        return Client.EVM2AnyMessage({
            receiver: abi.encode(l1Receiver),
            data: data,
            tokenAmounts: new Client.EVMTokenAmount[](0),
            extraArgs: Client._argsToBytes(Client.EVMExtraArgsV1({ gasLimit: L1_GAS_LIMIT })),
            feeToken: address(0)
        });
    }
}
