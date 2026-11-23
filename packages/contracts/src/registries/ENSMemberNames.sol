// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import { ZeroAddress } from "../CommonErrors.sol";
import { IGreenGoodsENSMemberNames } from "../interfaces/IGreenGoodsENSMemberNames.sol";
import { IHats } from "../interfaces/IHats.sol";
import { ENSSlug } from "../lib/ENSSlug.sol";
import { GreenGoodsENSRegistrar } from "./ENSRegistrar.sol";

/// @title GreenGoodsENSMemberNames
/// @notice The registrar, with members registering their own names. It is the implementation the
/// registrar's proxy is upgraded to; its storage follows the registrar's.
/// @dev A member's name is the username the passkey directory holds for their account, and
/// nothing else: the directory signs a grant for one account and one name, valid for at most an
/// hour, and only that account, wearing the garden-member hat, can register it. A member cannot
/// choose a different name and cannot release their own; names are released or reassigned only by
/// the owner, through the registrar's recovery functions.
///
/// Each account gets one registration paid from this contract's balance. Members and garden mints
/// each have a daily limit, and a fee cap bounds what one sponsored registration can cost.
contract GreenGoodsENSMemberNames is IGreenGoodsENSMemberNames, GreenGoodsENSRegistrar {
    bytes32 private constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant NAME_GRANT_TYPEHASH = keccak256("NameGrant(address account,string name,uint256 deadline)");
    /// @notice The longest a grant may still run when it is submitted. It equals the shortest
    /// cooldown. It bounds a grant's remaining life, not its age: the directory sets short deadlines.
    uint256 public constant MAX_GRANT_LIFETIME = MIN_NAME_CHANGE_COOLDOWN;

    IHats public hats;
    /// @notice The hat every garden member wears. Only its wearers can register a name.
    uint256 public protocolHatId;
    /// @notice The passkey directory's signing key: it vouches that an account holds a username.
    address public nameAttestor;
    /// @notice What this contract's balance pays for, and what it has paid for today.
    Sponsorship public sponsorship;
    /// @notice Accounts whose one sponsored registration is spent.
    mapping(address account => bool used) public sponsoredClaimUsed;

    // Storage follows the registrar's and is append only (storage-layouts/GreenGoodsENSMemberNames.json).
    uint256[45] private __gap;

    /// @notice Register the caller's username as their Green Goods name.
    /// @param slug The username the passkey directory holds for the caller.
    /// @param deadline The moment the directory's grant lapses, at most an hour away.
    /// @param grant The directory's signature over this account, this name and this deadline.
    /// @dev The caller must wear the garden-member hat. Sending nothing uses the caller's one
    /// sponsored registration, within the members' daily limit and the fee cap; sending the fee
    /// pays for it instead.
    function claimName(string calldata slug, uint256 deadline, bytes calldata grant) external payable {
        address attestor = nameAttestor;
        if (attestor == address(0) || address(hats) == address(0)) revert ClaimsNotConfigured();
        _requireImportFinished();
        if (!hats.isWearerOfHat(msg.sender, protocolHatId)) revert NotProtocolMember();
        if (block.timestamp > deadline) revert NameGrantExpired();
        if (deadline > block.timestamp + MAX_GRANT_LIFETIME) revert NameGrantTooLong();
        (address signer, ECDSA.RecoverError recoverError) =
            ECDSA.tryRecover(nameGrantDigest(msg.sender, slug, deadline), grant);
        if (recoverError != ECDSA.RecoverError.NoError || signer != attestor) revert InvalidNameGrant();
        ENSSlug.validate(slug);
        _recordName(slug, msg.sender, NameType.Gardener, false);
        uint256 balanceFeeCap;
        if (msg.value == 0) {
            if (sponsoredClaimUsed[msg.sender]) revert SponsoredClaimUsed();
            sponsoredClaimUsed[msg.sender] = true;
            balanceFeeCap = _countSponsoredSend(false);
        }
        _sendRegistration(slug, msg.sender, NameType.Gardener, balanceFeeCap);
    }

    /// @notice Register a garden's name. Called by the garden token while it mints the garden.
    /// @dev `msg.value` pays the CCIP fee and the excess is refunded. A mint that sends nothing is
    /// paid from this contract's balance, within the gardens' daily limit and the fee cap. When the
    /// balance cannot pay today the name is still held here and its L1 registration waits, since
    /// the garden token carries on past a failed registration and a member could otherwise take
    /// the garden's name.
    function registerGarden(string calldata slug, address gardenAccount) external payable override {
        if (msg.value > 0) {
            _registerGarden(slug, gardenAccount, 0);
            return;
        }
        if (!authorizedCallers[msg.sender] && msg.sender != owner()) revert NotAuthorizedCaller();
        _requireImportFinished();
        ENSSlug.validate(slug);
        _recordName(slug, gardenAccount, NameType.Garden, false);
        uint256 fee = this.getRegistrationFee(slug, gardenAccount, NameType.Garden);
        if (!_sponsorsAGardenToday() || fee > sponsorship.maxFee || address(this).balance < fee + totalPendingRefunds) {
            emit GardenRegistrationDeferred(gardenAccount, fee, slug);
            return;
        }
        _sendRegistration(slug, gardenAccount, NameType.Garden, _countSponsoredSend(true));
    }

    /// @notice The digest the directory signs to vouch that `account` holds the username `slug`.
    function nameGrantDigest(address account, string calldata slug, uint256 deadline) public view returns (bytes32) {
        bytes32 domainSeparator = keccak256(
            abi.encode(DOMAIN_TYPEHASH, keccak256("Green Goods Names"), keccak256("1"), block.chainid, address(this))
        );
        return keccak256(
            abi.encodePacked(
                "\x19\x01",
                domainSeparator,
                keccak256(abi.encode(NAME_GRANT_TYPEHASH, account, keccak256(bytes(slug)), deadline))
            )
        );
    }

    /// @notice How many more registrations this contract's balance may pay for today.
    function sponsoredSendsLeftToday() external view returns (uint256 members, uint256 gardens) {
        Sponsorship memory limits = sponsorship;
        bool today = limits.day == uint32(block.timestamp / 1 days);
        uint256 membersUsed = today ? limits.memberSendsToday : 0;
        uint256 gardensUsed = today ? limits.gardenSendsToday : 0;
        members = membersUsed >= limits.memberSendsPerDay ? 0 : limits.memberSendsPerDay - membersUsed;
        gardens = gardensUsed >= limits.gardenSendsPerDay ? 0 : limits.gardenSendsPerDay - gardensUsed;
    }

    /// @notice Set the passkey directory's signer. The zero address stops every member claim.
    function setNameAttestor(address attestor) external onlyOwner {
        emit NameAttestorUpdated(nameAttestor, attestor);
        nameAttestor = attestor;
    }

    /// @notice Set the Hats contract and the garden-member hat.
    function setMembershipHat(address _hats, uint256 hatId) external onlyOwner {
        if (_hats == address(0)) revert ZeroAddress();
        hats = IHats(_hats);
        protocolHatId = hatId;
        emit MembershipHatUpdated(_hats, hatId);
    }

    /// @notice Set what this contract's balance pays for: registrations per day for members and
    /// for gardens, and the most it pays for one. A zero limit or a zero cap pays for none.
    function setSponsorship(uint32 memberSendsPerDay, uint32 gardenSendsPerDay, uint96 maxFee) external onlyOwner {
        sponsorship.memberSendsPerDay = memberSendsPerDay;
        sponsorship.gardenSendsPerDay = gardenSendsPerDay;
        sponsorship.maxFee = maxFee;
        emit SponsorshipUpdated(memberSendsPerDay, gardenSendsPerDay, maxFee);
    }

    /// @dev Whether the gardens' daily limit has room for one more registration today.
    function _sponsorsAGardenToday() private view returns (bool) {
        Sponsorship memory limits = sponsorship;
        uint256 used = limits.day == uint32(block.timestamp / 1 days) ? limits.gardenSendsToday : 0;
        return used < limits.gardenSendsPerDay;
    }

    /// @dev One more registration paid from this contract's balance today, or a revert at that
    /// group's limit. Returns the most the balance may pay for it.
    function _countSponsoredSend(bool garden) internal returns (uint256 balanceFeeCap) {
        Sponsorship memory limits = sponsorship;
        uint32 today = uint32(block.timestamp / 1 days);
        if (limits.day != today) {
            limits.day = today;
            limits.memberSendsToday = 0;
            limits.gardenSendsToday = 0;
        }
        if (garden) {
            if (limits.gardenSendsToday >= limits.gardenSendsPerDay) revert DailySponsorLimitReached();
            ++limits.gardenSendsToday;
        } else {
            if (limits.memberSendsToday >= limits.memberSendsPerDay) revert DailySponsorLimitReached();
            ++limits.memberSendsToday;
        }
        sponsorship = limits;
        return limits.maxFee;
    }
}
