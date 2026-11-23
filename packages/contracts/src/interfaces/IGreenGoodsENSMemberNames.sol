// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title IGreenGoodsENSMemberNames
/// @notice The types, errors and events the registrar gains when members register their own names.
interface IGreenGoodsENSMemberNames {
    /// @notice The limits on registrations paid from the contract's balance. One storage slot.
    struct Sponsorship {
        /// @dev The most the balance pays for one registration, in wei. The CCIP fee follows L1
        /// gas, so a count alone would not bound what a day can cost.
        uint96 maxFee;
        /// @dev Days since the epoch of the two counts below.
        uint32 day;
        /// @dev Members and gardens have their own daily limit, so neither can use up the other's.
        uint32 memberSendsPerDay;
        uint32 memberSendsToday;
        uint32 gardenSendsPerDay;
        uint32 gardenSendsToday;
    }

    error ClaimsNotConfigured();
    error NotProtocolMember();
    error NameGrantExpired();
    error NameGrantTooLong();
    error InvalidNameGrant();
    error SponsoredClaimUsed();
    error DailySponsorLimitReached();

    event NameAttestorUpdated(address indexed oldAttestor, address indexed newAttestor);
    event MembershipHatUpdated(address indexed hats, uint256 indexed hatId);
    /// @notice A garden's name is held here but its L1 registration waits: the balance could not
    /// pay for it today. The owner sends it with `adminResendRegistration`.
    event GardenRegistrationDeferred(address indexed gardenAccount, uint256 indexed fee, string slug);
    event SponsorshipUpdated(uint32 indexed memberSendsPerDay, uint32 indexed gardenSendsPerDay, uint96 indexed maxFee);
}
