// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { CCIPReceiver } from "@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol";
import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IENS, IENSResolver, INameWrapper } from "../interfaces/IENS.sol";

error UnauthorizedSender();
error UnauthorizedSourceChain();
error NameTaken();
error InvalidSlug();
error ZeroAddress();
error InvalidAction();
error OwnerAlreadyHasName(); // Kept for ABI compat — no longer reverted in _ccipReceive path
error OnlySelf();

/// @title GreenGoodsENSReceiver (L1 Receiver)
/// @notice Receives CCIP messages from Arbitrum and registers ENS subdomains
/// @dev Deployed on Ethereum mainnet. Owns greengoods.eth in ENS.
contract GreenGoodsENSReceiver is CCIPReceiver, Ownable {
    address public immutable ENS_REGISTRY;
    address public immutable ENS_RESOLVER;
    bytes32 public immutable BASE_NODE; // namehash("greengoods.eth")
    address public immutable NAME_WRAPPER; // address(0) for unwrapped names (Sepolia)

    uint64 public immutable ARBITRUM_CHAIN_SELECTOR;
    address public l2Sender; // GreenGoodsENS on Arbitrum

    enum NameType {
        Gardener,
        Garden
    }

    struct Registration {
        address owner;
        NameType nameType;
        uint256 registeredAt;
    }

    // ─────── Storage (L1 source of truth) ───────
    mapping(bytes32 slugHash => Registration) public registrations;
    mapping(address owner => string slug) public ownerToSlug;

    // ─────── Events ───────
    event NameRegistered(string slug, address indexed owner, NameType nameType, bytes32 indexed messageId);
    event NameRegistrationSkipped(string slug, address attemptedOwner, address existingOwner, bytes32 indexed messageId);
    event NameReleased(string slug, address indexed previousOwner, bytes32 indexed messageId);
    event L2SenderUpdated(address indexed oldSender, address indexed newSender);
    event ENSRegistrationFailed(string slug, address owner);
    event ENSReleaseFailed(string slug, address previousOwner);

    constructor(
        address _ccipRouter,
        uint64 _arbitrumChainSelector,
        address _l2Sender,
        address _ensRegistry,
        address _ensResolver,
        bytes32 _baseNode,
        address _owner,
        address _nameWrapper
    )
        CCIPReceiver(_ccipRouter)
    {
        ARBITRUM_CHAIN_SELECTOR = _arbitrumChainSelector;
        l2Sender = _l2Sender;
        ENS_REGISTRY = _ensRegistry;
        ENS_RESOLVER = _ensResolver;
        BASE_NODE = _baseNode;
        NAME_WRAPPER = _nameWrapper;
        _transferOwnership(_owner);
    }

    // ═══════════════════════════════════════════════════════
    // CCIP Receiver
    // ═══════════════════════════════════════════════════════

    function _ccipReceive(Client.Any2EVMMessage memory message) internal override {
        // Verify source chain
        if (message.sourceChainSelector != ARBITRUM_CHAIN_SELECTOR) {
            revert UnauthorizedSourceChain();
        }

        // Verify sender
        address sender = abi.decode(message.sender, (address));
        if (sender != l2Sender) revert UnauthorizedSender();

        // Decode message
        (uint8 action, string memory slug, address _owner, NameType nameType) =
            abi.decode(message.data, (uint8, string, address, NameType));

        if (action == 0) {
            _register(slug, _owner, nameType, message.messageId);
        } else if (action == 1) {
            _release(slug, _owner, message.messageId);
        } else {
            revert InvalidAction();
        }
    }

    // ═══════════════════════════════════════════════════════
    // Internal — ENS Registration
    // ═══════════════════════════════════════════════════════

    function _register(string memory slug, address _owner, NameType nameType, bytes32 messageId) internal {
        // Graceful skip on invalid slug — reverts in _ccipReceive cause permanent CCIP message failures.
        // L2 sender validates identically, so this should never trigger, but defense-in-depth for cross-chain.
        if (!_isValidSlug(slug)) {
            emit NameRegistrationSkipped(slug, _owner, address(0), messageId);
            return;
        }
        bytes32 slugHash = keccak256(bytes(slug));

        // If already taken on L1 (race condition), emit skip event instead of silent return
        if (registrations[slugHash].owner != address(0)) {
            emit NameRegistrationSkipped(slug, _owner, registrations[slugHash].owner, messageId);
            return;
        }

        // Enforce single-name-per-owner (CCIP race protection)
        // Graceful skip — reverts in _ccipReceive cause permanent CCIP message failures
        if (bytes(ownerToSlug[_owner]).length > 0) {
            emit NameRegistrationSkipped(slug, _owner, _owner, messageId);
            return;
        }

        registrations[slugHash] = Registration({ owner: _owner, nameType: nameType, registeredAt: block.timestamp });
        ownerToSlug[_owner] = slug;

        // Register on ENS (try/catch to prevent CCIP message failure on ENS issues)
        try this._setENSRecordsExternal(slug, _owner) { }
        catch {
            emit ENSRegistrationFailed(slug, _owner);
        }

        emit NameRegistered(slug, _owner, nameType, messageId);
    }

    /// @notice External wrapper for _setENSRecords (required for try/catch on internal calls)
    /// @dev Only callable by this contract itself
    function _setENSRecordsExternal(string calldata slug, address _owner) external {
        if (msg.sender != address(this)) revert OnlySelf();
        _setENSRecords(slug, _owner);
    }

    function _release(string memory slug, address previousOwner, bytes32 messageId) internal {
        bytes32 slugHash = keccak256(bytes(slug));
        Registration memory reg = registrations[slugHash];

        // Verify the release is from the correct owner
        if (reg.owner != previousOwner) return;

        delete registrations[slugHash];
        delete ownerToSlug[previousOwner];

        // Clear ENS records (try/catch to prevent CCIP message failure on ENS issues)
        // ENS ops can revert if: approval revoked, registry upgraded, or subnode never
        // created (registration ENS failure caught by try/catch in _register).
        try this._clearENSRecordsExternal(slug) { }
        catch {
            emit ENSReleaseFailed(slug, previousOwner);
        }

        emit NameReleased(slug, previousOwner, messageId);
    }

    /// @notice External wrapper for _clearENSRecords (required for try/catch on internal calls)
    /// @dev Only callable by this contract itself
    function _clearENSRecordsExternal(string calldata slug) external {
        if (msg.sender != address(this)) revert OnlySelf();
        _clearENSRecords(slug);
    }

    function _clearENSRecords(string memory slug) internal {
        bytes32 label = keccak256(bytes(slug));
        bytes32 node = keccak256(abi.encodePacked(BASE_NODE, label));

        IENSResolver(ENS_RESOLVER).setAddr(node, address(0));

        if (NAME_WRAPPER != address(0)) {
            // Wrapped path: reclaim subnode via NameWrapper
            INameWrapper(NAME_WRAPPER).setSubnodeOwner(BASE_NODE, slug, address(this), 0, type(uint64).max);
        } else {
            // Unwrapped path: raw registry
            IENS(ENS_REGISTRY).setSubnodeOwner(BASE_NODE, label, address(this));
        }
    }

    function _setENSRecords(string memory slug, address _owner) internal {
        bytes32 label = keccak256(bytes(slug));
        bytes32 node = keccak256(abi.encodePacked(BASE_NODE, label));

        if (NAME_WRAPPER != address(0)) {
            // Wrapped path: create subnode via NameWrapper, sets resolver in one call.
            // Resolver's isAuthorised() checks nameWrapper.ownerOf(node) == msg.sender.
            INameWrapper(NAME_WRAPPER).setSubnodeRecord(
                BASE_NODE,
                slug,
                address(this), // receiver owns the wrapped subnode
                ENS_RESOLVER,
                0, // ttl
                0, // fuses: CAN_DO_EVERYTHING (no restrictions)
                type(uint64).max // expiry: clamped to parent's expiry by NameWrapper
            );
            IENSResolver(ENS_RESOLVER).setAddr(node, _owner);
        } else {
            // Unwrapped path: raw registry (Sepolia, localhost)
            IENS(ENS_REGISTRY).setSubnodeOwner(BASE_NODE, label, address(this));
            IENS(ENS_REGISTRY).setResolver(node, ENS_RESOLVER);
            IENSResolver(ENS_RESOLVER).setAddr(node, _owner);
        }
    }

    /// @dev Non-reverting slug validation for CCIP receive path.
    ///      Mirrors L2 GreenGoodsENS._validateSlug() and shared/utils/blockchain/ens.ts validateSlug().
    ///      If updating rules here, update all three locations.
    function _isValidSlug(string memory slug) internal pure returns (bool) {
        bytes memory b = bytes(slug);
        uint256 len = b.length;
        if (len < 3 || len > 50) return false;
        if (b[0] == 0x2D || b[len - 1] == 0x2D) return false;
        for (uint256 i = 0; i < len;) {
            bytes1 c = b[i];
            bool valid = (c >= 0x61 && c <= 0x7A) || (c >= 0x30 && c <= 0x39) || c == 0x2D;
            if (!valid) return false;
            if (c == 0x2D && i + 1 < len && b[i + 1] == 0x2D) return false;
            unchecked {
                ++i;
            }
        }
        return true;
    }

    /// @dev Reverting slug validation for direct admin calls (not CCIP path).
    ///      Mirrors L2 GreenGoodsENS._validateSlug() and shared/utils/blockchain/ens.ts validateSlug().
    ///      If updating rules here, update all three locations.
    function _validateSlug(string memory slug) internal pure {
        if (!_isValidSlug(slug)) revert InvalidSlug();
    }

    // ═══════════════════════════════════════════════════════
    // ERC1155 Receiver (required for NameWrapper wrapped subnodes)
    // ═══════════════════════════════════════════════════════

    /// @dev NameWrapper mints ERC1155 tokens for wrapped subnodes. The receiver must
    ///      implement IERC1155Receiver to accept them, otherwise setSubnodeRecord reverts.
    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    )
        external
        pure
        returns (bytes4)
    {
        return this.onERC1155BatchReceived.selector;
    }

    /// @dev Override CCIPReceiver's supportsInterface to also report IERC1155Receiver support.
    function supportsInterface(bytes4 interfaceId) public pure override returns (bool) {
        // IERC1155Receiver interfaceId = 0x4e2312e0
        return interfaceId == 0x4e2312e0 || super.supportsInterface(interfaceId);
    }

    // ═══════════════════════════════════════════════════════
    // Views (L1 source of truth)
    // ═══════════════════════════════════════════════════════

    /// @notice Check if slug is available (L1 authoritative)
    function available(string calldata slug) external view returns (bool) {
        return registrations[keccak256(bytes(slug))].owner == address(0);
    }

    /// @notice Resolve slug to owner address
    function resolve(string calldata slug) external view returns (address) {
        return registrations[keccak256(bytes(slug))].owner;
    }

    /// @notice Get full registration data
    function getRegistration(string calldata slug) external view returns (Registration memory) {
        return registrations[keccak256(bytes(slug))];
    }

    // ═══════════════════════════════════════════════════════
    // Admin
    // ═══════════════════════════════════════════════════════

    function setL2Sender(address _l2Sender) external onlyOwner {
        if (_l2Sender == address(0)) revert ZeroAddress();
        address old = l2Sender;
        l2Sender = _l2Sender;
        emit L2SenderUpdated(old, _l2Sender);
    }

    /// @notice Admin force-release a squatted name (direct L1, no CCIP)
    /// @dev No try/catch here — admin calls can revert and be retried, unlike CCIP messages.
    function adminReleaseName(string calldata slug) external onlyOwner {
        bytes32 slugHash = keccak256(bytes(slug));
        Registration memory reg = registrations[slugHash];
        if (reg.owner == address(0)) return;

        delete registrations[slugHash];
        delete ownerToSlug[reg.owner];

        _clearENSRecords(slug);

        emit NameReleased(slug, reg.owner, bytes32(0));
    }

    /// @notice Admin can directly register (bypass CCIP, for migration/recovery).
    /// @dev Deliberately skips the single-name-per-owner check to support migration scenarios
    ///      where an owner needs re-registration. Note: ownerToSlug[_owner] will be overwritten
    ///      if the owner already has a name, orphaning the previous reverse lookup (forward lookups
    ///      via registrations[slugHash] remain intact for both names).
    function adminRegister(string calldata slug, address _owner, NameType nameType) external onlyOwner {
        _validateSlug(slug);
        bytes32 slugHash = keccak256(bytes(slug));
        if (registrations[slugHash].owner != address(0)) revert NameTaken();

        registrations[slugHash] = Registration({ owner: _owner, nameType: nameType, registeredAt: block.timestamp });
        ownerToSlug[_owner] = slug;
        _setENSRecords(slug, _owner);

        emit NameRegistered(slug, _owner, nameType, bytes32(0));
    }
}
