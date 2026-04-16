// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

import { ArrayLengthMismatch, ZeroAddress } from "../errors/CommonErrors.sol";
import { IGreenWillValidator } from "../interfaces/IGreenWillValidator.sol";
import { IGreenWillUnlockModule } from "../interfaces/IGreenWillUnlockModule.sol";

/// @title GreenWillRegistry
/// @notice Canonical onchain badge registry for GreenWill on Arbitrum
contract GreenWillRegistry is OwnableUpgradeable, UUPSUpgradeable {
    struct BadgeClass {
        string slug;
        string metadataURI;
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
    error ValidatorNotConfigured(bytes32 badgeId);
    error UnauthorizedIssuer(bytes32 badgeId, address caller);

    event UnlockModuleUpdated(address indexed oldUnlockModule, address indexed newUnlockModule);
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

    address public unlockModule;

    mapping(bytes32 badgeId => BadgeClass badgeClass) private _badgeClasses;
    mapping(bytes32 badgeId => mapping(address account => BadgeRecord badgeRecord)) private _badgeRecords;

    uint256[47] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _owner) external initializer {
        if (_owner == address(0)) revert ZeroAddress();

        __Ownable_init();
        _transferOwnership(_owner);
    }

    function setUnlockModule(address _unlockModule) external onlyOwner {
        address oldUnlockModule = unlockModule;
        unlockModule = _unlockModule;

        emit UnlockModuleUpdated(oldUnlockModule, _unlockModule);
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

    function claimBadge(bytes32 badgeId, bytes calldata claimData) external returns (uint256 tokenId) {
        BadgeClass storage badgeClass = _requireClaimableBadge(badgeId);
        address account = msg.sender;

        if (_badgeRecords[badgeId][account].issued) {
            revert BadgeAlreadyOwned(badgeId, account);
        }

        bytes32 sourceRef = IGreenWillValidator(badgeClass.validator).validate(account, claimData);
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

        BadgeClass storage badgeClass = _requireActiveBadge(badgeId);
        if (badgeClass.validator == address(0)) revert ValidatorNotConfigured(badgeId);

        for (uint256 i = 0; i < accounts.length; i++) {
            address account = accounts[i];

            if (_badgeRecords[badgeId][account].issued) {
                continue;
            }

            (bool success, bytes memory returnData) =
                badgeClass.validator.staticcall(abi.encodeCall(IGreenWillValidator.validate, (account, claimData[i])));
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

        if (badgeClass.unlockLock != address(0) && unlockModule != address(0)) {
            tokenId = IGreenWillUnlockModule(unlockModule).mintBadge(badgeClass.unlockLock, account);
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

    function _requireActiveBadge(bytes32 badgeId) internal view returns (BadgeClass storage badgeClass) {
        badgeClass = _badgeClasses[badgeId];

        if (bytes(badgeClass.slug).length == 0) revert BadgeClassNotConfigured(badgeId);
        if (!badgeClass.active) revert BadgeInactive(badgeId);
    }

    function _requireClaimableBadge(bytes32 badgeId) internal view returns (BadgeClass storage badgeClass) {
        badgeClass = _requireActiveBadge(badgeId);

        if (!badgeClass.claimable) revert BadgeNotClaimable(badgeId);
        if (badgeClass.validator == address(0)) revert ValidatorNotConfigured(badgeId);
    }

    function _authorizeUpgrade(address) internal override onlyOwner { }
}
