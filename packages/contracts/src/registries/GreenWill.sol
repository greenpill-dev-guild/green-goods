// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import { IEAS, Attestation } from "@eas/IEAS.sol";

import { ArrayLengthMismatch, ZeroAddress } from "../CommonErrors.sol";
import { IHats } from "../interfaces/IHats.sol";
import { IPublicLock } from "../interfaces/IUnlock.sol";
import { IOctantVault } from "../interfaces/IOctantFactory.sol";

interface IGreenWillVaultResolver {
    function gardenAssetVaults(address garden, address asset) external view returns (address vault);
}

/// @title GreenWill
/// @notice Claim-driven onchain badge registry for GreenWill
/// @dev Users prove badge eligibility from onchain state at claim time:
///      Hats membership, EAS attestations, and existing vault-share positions.
contract GreenWill is OwnableUpgradeable, UUPSUpgradeable {
    enum BadgeRule {
        None,
        Hat,
        WorkAttestation,
        VaultShares
    }

    bytes32 public constant GENESIS_BADGE = keccak256("GENESIS");
    bytes32 public constant FIRST_WORK_BADGE = keccak256("FIRST_WORK");
    bytes32 public constant FIRST_SUPPORT_BADGE = keccak256("FIRST_SUPPORT");

    struct BadgeClass {
        string slug;
        string metadataURI;
        // Legacy ABI name retained for compatibility. This is the onchain eligibility source:
        // Hats membership contract, EAS contract, or vault resolver.
        address validator;
        address authorizedIssuer;
        address unlockLock;
        bool claimable;
        bool active;
    }

    struct BadgeRecord {
        bool issued;
        uint64 issuedAt;
        bytes32 sourceRef;
        uint256 unlockTokenId;
        address issuer;
    }

    error BadgeClassNotConfigured(bytes32 badgeId);
    error BadgeInactive(bytes32 badgeId);
    error BadgeNotClaimable(bytes32 badgeId);
    error BadgeAlreadyOwned(bytes32 badgeId, address account);
    error BadgeRuleNotConfigured(bytes32 badgeId);
    error UnauthorizedIssuer(bytes32 badgeId, address caller);
    error UnsupportedBadgeRule(bytes32 badgeId, uint8 rule);
    error InvalidClaimData(bytes32 badgeId);
    error NotHatWearer(address account, uint256 hatId);
    error AttestationNotFound(bytes32 uid);
    error AttestationRevoked(bytes32 uid);
    error InvalidAttestationSchema(bytes32 uid, bytes32 expectedSchema, bytes32 actualSchema);
    error InvalidAttester(bytes32 uid, address expectedAttester, address actualAttester);
    error VaultNotFound(address garden, address asset);
    error NoVaultShares(address account, address vault);

    event BadgeRuleConfigured(bytes32 indexed badgeId, uint8 rule, bytes32 criteria, uint256 unlockDuration);
    event BadgeClassConfigured(
        bytes32 indexed badgeId,
        string slug,
        address indexed validator,
        address indexed authorizedIssuer,
        address unlockLock,
        bool claimable,
        bool active,
        string metadataURI
    );
    event BadgeIssued(
        bytes32 indexed badgeId, address indexed account, bytes32 indexed sourceRef, address issuer, uint256 unlockTokenId
    );

    // Deprecated compatibility slot retained for upgrade safety after removing the old Unlock adapter.
    address public unlockModule;

    mapping(bytes32 badgeId => BadgeClass badgeClass) private _badgeClasses;
    mapping(bytes32 badgeId => mapping(address account => BadgeRecord badgeRecord)) private _badgeRecords;
    mapping(bytes32 badgeId => BadgeRule rule) private _badgeRules;
    mapping(bytes32 badgeId => bytes32 criteria) private _badgeCriteria;
    mapping(bytes32 badgeId => uint256 unlockDuration) private _badgeUnlockDurations;

    uint256[44] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _owner) external initializer {
        if (_owner == address(0)) revert ZeroAddress();

        __Ownable_init();
        _transferOwnership(_owner);
    }

    function configureBadgeClass(
        bytes32 badgeId,
        string calldata slug,
        string calldata metadataURI,
        address validator,
        address authorizedIssuer,
        address unlockLock,
        bool claimable,
        bool active
    )
        external
        onlyOwner
    {
        _badgeClasses[badgeId] = BadgeClass({
            slug: slug,
            metadataURI: metadataURI,
            validator: validator,
            authorizedIssuer: authorizedIssuer,
            unlockLock: unlockLock,
            claimable: claimable,
            active: active
        });

        emit BadgeClassConfigured(badgeId, slug, validator, authorizedIssuer, unlockLock, claimable, active, metadataURI);
    }

    function configureBadgeRule(
        bytes32 badgeId,
        BadgeRule rule,
        bytes32 criteria,
        uint256 unlockDuration
    )
        external
        onlyOwner
    {
        _requireConfiguredBadge(badgeId);

        _badgeRules[badgeId] = rule;
        _badgeCriteria[badgeId] = criteria;
        _badgeUnlockDurations[badgeId] = unlockDuration;

        emit BadgeRuleConfigured(badgeId, uint8(rule), criteria, unlockDuration);
    }

    function previewClaim(
        bytes32 badgeId,
        address account,
        bytes calldata claimData
    )
        external
        view
        returns (bytes32 sourceRef)
    {
        BadgeClass storage badgeClass = _requireClaimableBadge(badgeId);
        return _validateClaim(badgeId, badgeClass, account, claimData);
    }

    function claimBadge(bytes32 badgeId, bytes calldata claimData) external returns (uint256 tokenId) {
        BadgeClass storage badgeClass = _requireClaimableBadge(badgeId);
        address account = msg.sender;

        if (_badgeRecords[badgeId][account].issued) {
            revert BadgeAlreadyOwned(badgeId, account);
        }

        bytes32 sourceRef = _validateClaim(badgeId, badgeClass, account, claimData);
        return _issueBadge(badgeId, account, sourceRef, account);
    }

    function batchIssueEligible(
        bytes32 badgeId,
        address[] calldata accounts,
        bytes[] calldata claimData
    )
        external
        onlyOwner
        returns (uint256 issuedCount)
    {
        if (accounts.length != claimData.length) revert ArrayLengthMismatch();

        _requireClaimableBadge(badgeId);

        for (uint256 i = 0; i < accounts.length; i++) {
            address account = accounts[i];

            if (_badgeRecords[badgeId][account].issued) {
                continue;
            }

            (bool success, bytes memory returnData) =
                address(this).staticcall(abi.encodeCall(this.previewClaim, (badgeId, account, claimData[i])));
            if (!success) {
                continue;
            }

            bytes32 sourceRef = abi.decode(returnData, (bytes32));
            _issueBadge(badgeId, account, sourceRef, msg.sender);
            issuedCount++;
        }
    }

    function issueByAuthorizedIssuer(
        bytes32 badgeId,
        address account,
        bytes32 sourceRef
    )
        external
        returns (uint256 tokenId)
    {
        BadgeClass storage badgeClass = _requireActiveBadge(badgeId);

        if (badgeClass.authorizedIssuer == address(0) || msg.sender != badgeClass.authorizedIssuer) {
            revert UnauthorizedIssuer(badgeId, msg.sender);
        }
        if (_badgeRecords[badgeId][account].issued) {
            revert BadgeAlreadyOwned(badgeId, account);
        }

        return _issueBadge(badgeId, account, sourceRef, msg.sender);
    }

    function hasBadge(bytes32 badgeId, address account) public view returns (bool) {
        return _badgeRecords[badgeId][account].issued;
    }

    function getBadgeClass(bytes32 badgeId) external view returns (BadgeClass memory badgeClass) {
        return _badgeClasses[badgeId];
    }

    function getBadgeRecord(bytes32 badgeId, address account) external view returns (BadgeRecord memory badgeRecord) {
        return _badgeRecords[badgeId][account];
    }

    function getBadgeRule(bytes32 badgeId)
        external
        view
        returns (BadgeRule rule, bytes32 criteria, uint256 unlockDuration)
    {
        return (_badgeRules[badgeId], _badgeCriteria[badgeId], _badgeUnlockDurations[badgeId]);
    }

    function _issueBadge(
        bytes32 badgeId,
        address account,
        bytes32 sourceRef,
        address issuer
    )
        internal
        returns (uint256 tokenId)
    {
        BadgeClass storage badgeClass = _badgeClasses[badgeId];

        if (badgeClass.unlockLock != address(0)) {
            tokenId = _grantUnlockKey(badgeId, badgeClass.unlockLock, account);
        }

        _badgeRecords[badgeId][account] = BadgeRecord({
            issued: true,
            issuedAt: uint64(block.timestamp),
            sourceRef: sourceRef,
            unlockTokenId: tokenId,
            issuer: issuer
        });

        emit BadgeIssued(badgeId, account, sourceRef, issuer, tokenId);
    }

    function _grantUnlockKey(bytes32 badgeId, address lock, address recipient) internal returns (uint256 tokenId) {
        address[] memory recipients = new address[](1);
        recipients[0] = recipient;

        uint256[] memory expirationTimestamps = new uint256[](1);
        expirationTimestamps[0] = _getUnlockExpirationTimestamp(badgeId);

        address[] memory keyManagers = new address[](1);
        keyManagers[0] = recipient;

        uint256[] memory tokenIds = IPublicLock(lock).grantKeys(recipients, expirationTimestamps, keyManagers);
        tokenId = tokenIds[0];
    }

    function _getUnlockExpirationTimestamp(bytes32 badgeId) internal view returns (uint256) {
        uint256 duration = _badgeUnlockDurations[badgeId];
        if (duration == 0) {
            return type(uint256).max;
        }

        return block.timestamp + duration;
    }

    function _validateClaim(
        bytes32 badgeId,
        BadgeClass storage badgeClass,
        address account,
        bytes calldata claimData
    )
        internal
        view
        returns (bytes32 sourceRef)
    {
        BadgeRule rule = _badgeRules[badgeId];
        if (rule == BadgeRule.None) revert BadgeRuleNotConfigured(badgeId);

        if (rule == BadgeRule.Hat) {
            return _validateHatClaim(badgeId, badgeClass.validator, account);
        }
        if (rule == BadgeRule.WorkAttestation) {
            return _validateWorkAttestationClaim(badgeId, badgeClass.validator, account, claimData);
        }
        if (rule == BadgeRule.VaultShares) {
            return _validateVaultSharesClaim(badgeId, badgeClass.validator, account, claimData);
        }

        revert UnsupportedBadgeRule(badgeId, uint8(rule));
    }

    function _validateHatClaim(
        bytes32 badgeId,
        address hatsAddress,
        address account
    )
        internal
        view
        returns (bytes32 sourceRef)
    {
        uint256 hatId = uint256(_badgeCriteria[badgeId]);
        if (!IHats(hatsAddress).isWearerOfHat(account, hatId)) {
            revert NotHatWearer(account, hatId);
        }

        return bytes32(hatId);
    }

    function _validateWorkAttestationClaim(
        bytes32 badgeId,
        address easAddress,
        address account,
        bytes calldata claimData
    )
        internal
        view
        returns (bytes32 sourceRef)
    {
        if (claimData.length != 32) revert InvalidClaimData(badgeId);

        bytes32 uid = abi.decode(claimData, (bytes32));
        Attestation memory attestation = IEAS(easAddress).getAttestation(uid);
        bytes32 schemaUID = _badgeCriteria[badgeId];

        if (attestation.uid == bytes32(0)) revert AttestationNotFound(uid);
        if (attestation.revocationTime != 0) revert AttestationRevoked(uid);
        if (attestation.schema != schemaUID) {
            revert InvalidAttestationSchema(uid, schemaUID, attestation.schema);
        }
        if (attestation.attester != account) {
            revert InvalidAttester(uid, account, attestation.attester);
        }

        return uid;
    }

    function _validateVaultSharesClaim(
        bytes32 badgeId,
        address resolver,
        address account,
        bytes calldata claimData
    )
        internal
        view
        returns (bytes32 sourceRef)
    {
        if (claimData.length != 64) revert InvalidClaimData(badgeId);

        (address garden, address asset) = abi.decode(claimData, (address, address));
        address vault = IGreenWillVaultResolver(resolver).gardenAssetVaults(garden, asset);
        if (vault == address(0)) revert VaultNotFound(garden, asset);
        if (IOctantVault(vault).balanceOf(account) == 0) revert NoVaultShares(account, vault);

        return keccak256(abi.encode(garden, asset, vault));
    }

    function _requireConfiguredBadge(bytes32 badgeId) internal view returns (BadgeClass storage badgeClass) {
        badgeClass = _badgeClasses[badgeId];
        if (bytes(badgeClass.slug).length == 0) revert BadgeClassNotConfigured(badgeId);
    }

    function _requireActiveBadge(bytes32 badgeId) internal view returns (BadgeClass storage badgeClass) {
        badgeClass = _requireConfiguredBadge(badgeId);
        if (!badgeClass.active) revert BadgeInactive(badgeId);
    }

    function _requireClaimableBadge(bytes32 badgeId) internal view returns (BadgeClass storage badgeClass) {
        badgeClass = _requireActiveBadge(badgeId);
        if (!badgeClass.claimable) revert BadgeNotClaimable(badgeId);
    }

    function _authorizeUpgrade(address) internal override onlyOwner { }
}
