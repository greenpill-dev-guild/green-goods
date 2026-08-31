// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IEAS, Attestation } from "@eas/IEAS.sol";
import { SchemaResolver } from "@eas/resolver/SchemaResolver.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

import { CommunityTestimonySchema } from "../Schemas.sol";
import { InvalidSchema, ZeroAddress } from "../CommonErrors.sol";
import { ICommitmentPoolingModule } from "../interfaces/ICommitmentPoolingModule.sol";
import { IGardenAccessControl } from "../interfaces/IGardenAccessControl.sol";

error NotCommunityMember(address attester, address garden);
error TestimonyRequired();
error InvalidCommitment(uint256 commitmentId);
error CommitmentGardenMismatch(uint256 commitmentId, address expectedGarden, address actualGarden);
error SchemaUIDRequired();
error SchemaUIDConflict(bytes32 currentUID, bytes32 requestedUID);
error CommitmentModuleRequired();

/// @title TestimonyResolver
/// @notice Append-only Community-Hat-gated resolver for garden and commitment testimony.
contract TestimonyResolver is SchemaResolver, OwnableUpgradeable, UUPSUpgradeable {
    bytes32 public schemaUID;
    address public commitmentModule;

    /// @dev Declares two named storage entries above and reserves 48 more here (50 total).
    uint256[48] private __gap;

    event SchemaUIDUpdated(bytes32 indexed oldUID, bytes32 indexed newUID);
    event CommitmentModuleUpdated(address indexed oldModule, address indexed newModule);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address easAddress) SchemaResolver(IEAS(easAddress)) {
        _disableInitializers();
    }

    function initialize(address owner_) external initializer {
        if (owner_ == address(0)) revert ZeroAddress();
        __Ownable_init();
        _transferOwnership(owner_);
    }

    function setSchemaUID(bytes32 uid) external onlyOwner {
        if (uid == bytes32(0)) revert SchemaUIDRequired();
        bytes32 currentUID = schemaUID;
        if (currentUID == uid) return;
        if (currentUID != bytes32(0)) revert SchemaUIDConflict(currentUID, uid);

        schemaUID = uid;
        emit SchemaUIDUpdated(currentUID, uid);
    }

    function setCommitmentModule(address module) external onlyOwner {
        if (schemaUID == bytes32(0)) revert SchemaUIDRequired();
        if (module == address(0)) revert CommitmentModuleRequired();

        address oldModule = commitmentModule;
        commitmentModule = module;
        emit CommitmentModuleUpdated(oldModule, module);
    }

    function isPayable() public pure override returns (bool) {
        return false;
    }

    function onAttest(Attestation calldata attestation, uint256) internal view override returns (bool) {
        if (commitmentModule == address(0)) revert CommitmentModuleRequired();
        if (schemaUID == bytes32(0) || attestation.schema != schemaUID) revert InvalidSchema();

        CommunityTestimonySchema memory testimony;
        (testimony.commitmentId, testimony.title, testimony.testimonyCID) =
            abi.decode(attestation.data, (uint256, string, string));

        if (!IGardenAccessControl(attestation.recipient).isCommunity(attestation.attester)) {
            revert NotCommunityMember(attestation.attester, attestation.recipient);
        }
        if (bytes(testimony.testimonyCID).length == 0) revert TestimonyRequired();

        if (testimony.commitmentId != 0) {
            _validateCommitmentGarden(testimony.commitmentId, attestation.recipient);
        }
        return true;
    }

    function _validateCommitmentGarden(uint256 commitmentId, address attestationGarden) private view {
        ICommitmentPoolingModule module = ICommitmentPoolingModule(commitmentModule);
        ICommitmentPoolingModule.Commitment memory commitment;
        try module.getCommitment(commitmentId) returns (ICommitmentPoolingModule.Commitment memory found) {
            commitment = found;
        } catch {
            revert InvalidCommitment(commitmentId);
        }
        if (commitment.poolId == 0) revert InvalidCommitment(commitmentId);

        ICommitmentPoolingModule.Pool memory pool;
        try module.getPool(commitment.poolId) returns (ICommitmentPoolingModule.Pool memory foundPool) {
            pool = foundPool;
        } catch {
            revert InvalidCommitment(commitmentId);
        }
        if (pool.garden != attestationGarden) {
            revert CommitmentGardenMismatch(commitmentId, pool.garden, attestationGarden);
        }
    }

    function onRevoke(Attestation calldata, uint256) internal pure override returns (bool) {
        return false;
    }

    // solhint-disable-next-line no-empty-blocks
    function _authorizeUpgrade(address) internal override onlyOwner { }
}
