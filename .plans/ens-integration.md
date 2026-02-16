# ENS Integration Plan: `*.greengoods.eth` Unified Namespace

> **Status**: Draft v4b — Chainlink CCIP + Hats Protocol Verification
> **Branch**: `feature/ens-integration`
> **Depends on**: `feature/action-domains` (current)
> **Estimated scope**: ~25 files changed, ~1000 LOC new, ~300 LOC deleted

---

## 1. Architecture Overview

### Chainlink CCIP — Single Transaction, Fully On-Chain

ENS lives on Ethereum mainnet. We register there via **Chainlink CCIP cross-chain messaging** triggered from a single Arbitrum transaction. No APIs, no gateways, no manual chain-switching.

When a garden is minted on Arbitrum or a protocol member claims a name, the L2 contract sends a CCIP message to L1. Chainlink's decentralized oracle network relays it. The L1 receiver contract registers the ENS subdomain automatically.

```
L2 (Arbitrum)                                     L1 (Ethereum Mainnet)
┌───────────────────────────────┐  CCIP Message   ┌──────────────────────────┐
│ GreenGoodsENS (Sender)        │ ──────────────▶ │ GreenGoodsENSReceiver    │
│                               │  ~15-20 min     │ (CCIPReceiver)           │
│ • registerGarden()            │  ~$0.09 fee     │                          │
│   ← GardenToken mint          │                  │ • _ccipReceive()         │
│                               │                  │   → ENS Registry         │
│ • claimName()                 │                  │   → ENS Resolver         │
│ • claimNameSponsored()        │                  │   → setSubnodeOwner()    │
│   ← any protocol member       │                  │   → setAddr()            │
│                               │                  │                          │
│ • available() (L2 cache)      │                  │ • available() (L1 truth) │
│ • CCIP Router call            │                  │ • resolve()              │
│                               │                  │ • owns greengoods.eth    │
│ Fee: msg.value or contract    │                  │                          │
└───────────────────────────────┘                  └──────────────────────────┘

CCIP Infrastructure:
  Arbitrum Router: 0x141fa059441E0ca23ce184B6A78bafD2A517DdE8
  Ethereum Router: 0x80226fc0Ee2b096224EeAc085Bb9a8cba1146f7D
  Ethereum Chain Selector: 5009297550715157269
```

**Why this works:**
- **Single transaction** — operator mints garden on Arbitrum, ENS registration happens automatically
- **No infrastructure** — zero APIs, zero gateways; Chainlink DON handles relay
- **Fully on-chain** — both L2 sender and L1 receiver are smart contracts
- **Fast enough** — ~15-20 minutes vs 7 days (native bridge) or instant (direct L1)
- **Affordable** — ~$0.09-0.10 CCIP fee + L2 gas; L1 gas paid by CCIP message
- **Collision prevention** — L2 caches registrations + L1 is source of truth

### Transaction Flow

| Entity | Chain | Transaction | Cost |
|--------|-------|-------------|------|
| **Garden** | Arbitrum | `mintGarden({slug, ...})` → CCIP message to L1 | ~800K gas + ~$0.09 CCIP |
| **Member** (passkey) | Arbitrum | `GreenGoodsENS.claimNameSponsored(slug)` → CCIP message to L1 | ~300K gas (sponsored) + ~$0.09 CCIP (sponsored) |
| **Member** (wallet) | Arbitrum | `GreenGoodsENS.claimName(slug)` → CCIP message to L1 | ~300K gas + ~$0.09 CCIP |

Both flows are **single transactions on Arbitrum**. The CCIP message arrives on L1 in ~15-20 minutes and registers the ENS subdomain automatically.

---

## 2. Unified Namespace Design

### Naming Pattern

| Entity | ENS Name | Example |
|--------|----------|---------|
| Gardener | `{slug}.greengoods.eth` | `alice.greengoods.eth` |
| Garden | `{slug}.greengoods.eth` | `miyawaki-park.greengoods.eth` |

Single flat namespace. No domain prefixes. Collision prevention enforced by L2 cache + L1 source of truth.

### Slug Rules

- Characters: `a-z`, `0-9`, `-` (lowercase only)
- No leading/trailing hyphens, no consecutive hyphens
- Length: 3–50 characters
- Validation: on-chain in both L2 sender and L1 receiver
- Frontend mirrors validation for instant feedback

### Name Mutability

- **Gardens**: immutable (set once at creation)
- **Gardeners**: can change (old name released after 30-day cooldown)

---

## 3. Gardener Name Security: Hats Protocol Verification

### How It Works: Protocol Hat as Identity

Hats Protocol IS the Green Goods identity layer. The `protocolGardenersHatId` (already stored in `HatsModule` at slot 160, currently unused) represents protocol-wide membership. When anyone receives ANY role in ANY garden, they also get this protocol hat automatically. The ENS contract checks it with a single call:

```solidity
IHats(hatsAddress).isWearerOfHat(msg.sender, protocolHatId)
```

**How accounts get the protocol hat (automatic, no extra transactions):**

| Trigger | What Happens | Who Gets Protocol Hat |
|---------|-------------|----------------------|
| `mintGarden()` | Owner role granted via `hatsModule.grantRole()` | Garden minter |
| `joinGarden()` | Gardener role granted via `hatsModule.grantRole()` | New garden member |
| `grantRole()` | Any role granted by operator/owner | Role grantee |

The protocol hat is minted inside `HatsModule._grantRole()` — the same function that mints per-garden role hats. One code change, all pathways covered.

### Flow: Personal Name Claim

```
1. User creates passkey → smart account on Arbitrum
2. User joins a garden → HatsModule grants gardener hat + protocol hat
   │
   ├─ GardenAccount.joinGarden()
   │   └─ hatsModule.grantRole(garden, user, Gardener)
   │       └─ HatsModule._grantRole()
   │           ├─ hats.mintHat(gardenerHatId, user)     ← per-garden role
   │           └─ hats.mintHat(protocolGardenersHatId, user)  ← protocol-wide
   │
3. User claims ENS name → verified via Hats Protocol
   │
   ├─ GreenGoodsENS.claimName("alice")       // or claimNameSponsored()
   │   ├─ hats.isWearerOfHat(msg.sender, protocolHatId) ✓
   │   ├─ _validateSlug("alice") ✓
   │   ├─ _cacheRegistration("alice", account)
   │   └─ _sendCCIPMessage("alice", account, Gardener)
   │
   ▼
   Chainlink CCIP (~15-20 min) → L1 ENS registration
   ▼
   alice.greengoods.eth resolves globally ✓
```

### Why This Is Better Than a Custom Registry

| Aspect | Custom `protocolAccounts` mapping | Hats Protocol hat |
|--------|----------------------------------|-------------------|
| Identity source | Parallel registry (duplication) | Single source of truth |
| Revocable | Manual cleanup needed | Revoke hat → loses ENS eligibility |
| Registration | Extra function calls through GardenToken | Automatic in `_grantRole()` |
| New contracts/mappings | Yes (on ENS contract) | None — uses existing Hats |
| Code changes | GardenToken + GardenAccount + ENS | HatsModule only (1 line in `_grantRole()`) |

### Revocation Semantics

If the protocol hat is revoked (via `hats.transferHat` to a burn address, same as `_revokeRole()`), the account can no longer claim new ENS names. However, **existing ENS registrations are NOT affected** — the L1 receiver has already registered the subdomain. This is intentional: revoking protocol membership prevents *future* claims, not retroactive name deletion. Admin can still force-release names via `adminReleaseName()` on L1.

### Garden Registration (No Hat Check)

Garden ENS registrations don't need the hat check — they use **authorized callers** (GardenToken). GardenToken is the only contract that can call `registerGarden()`, and it only does so during `mintGarden()`. This is the same pattern used for all other modules.

---

## 4. Contract Architecture

### 4.1 New: `src/registries/ENS.sol` — L2 (Arbitrum) — CCIP Sender

The L2 contract validates inputs, caches registrations for collision prevention, and sends CCIP messages to L1.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IRouterClient } from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import { Client } from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";

error NameTaken();
error InvalidSlug();
error NotProtocolMember();
error NotAuthorizedCaller();
error AlreadyHasName();
error CannotChangeGardenName();
error NoNameToRelease();
error InsufficientFee();
error NameInCooldown();

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
    IHats public immutable HATS;           // Hats Protocol contract
    uint256 public protocolHatId;          // protocolGardenersHatId from HatsModule
    address public l1Receiver;             // GreenGoodsENSReceiver on Ethereum

    enum NameType { Gardener, Garden }

    // ─────── L2 Registration Cache ───────
    // Prevents collisions before CCIP delivery. L1 is source of truth.
    mapping(bytes32 slugHash => address owner) public slugOwner;
    mapping(address owner => string slug) public ownerToSlug;
    mapping(string slug => uint256 releasedAt) public slugReleasedAt;

    uint256 public constant MIN_SLUG_LENGTH = 3;
    uint256 public constant MAX_SLUG_LENGTH = 50;
    uint256 public constant NAME_CHANGE_COOLDOWN = 30 days;

    /// @notice Authorized callers (GardenToken contract, owner)
    mapping(address => bool) public authorizedCallers;

    // ─────── Events ───────
    event NameRegistrationSent(
        bytes32 indexed messageId,
        string slug,
        address indexed owner,
        NameType nameType,
        uint256 ccipFee
    );
    event NameReleaseSent(bytes32 indexed messageId, string slug, address indexed previousOwner);
    event L1ReceiverUpdated(address indexed oldReceiver, address indexed newReceiver);
    event AuthorizedCallerUpdated(address indexed caller, bool authorized);
    event ProtocolHatIdUpdated(uint256 oldHatId, uint256 newHatId);

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
        _cacheRegistration(slug, gardenAccount);
        _sendRegistrationMessage(slug, gardenAccount, NameType.Garden);
    }

    /// @notice Claim a personal *.greengoods.eth name (user-funded). Any protocol member.
    /// @param slug The subdomain (e.g., "alice")
    /// @dev msg.value must cover CCIP fee. Caller must wear the protocol hat.
    ///      Works for ALL roles: gardener, operator, owner, evaluator, funder, community.
    function claimName(string calldata slug) external payable {
        if (!HATS.isWearerOfHat(msg.sender, protocolHatId)) revert NotProtocolMember();
        _validateSlug(slug);
        _cacheRegistration(slug, msg.sender);
        _sendRegistrationMessage(slug, msg.sender, NameType.Gardener);
    }

    /// @notice Claim a personal *.greengoods.eth name (contract-funded). Any protocol member.
    /// @dev CCIP fee paid from contract's ETH balance. Recommended for passkey users
    ///      who don't hold ETH. Contract must be pre-funded by owner.
    function claimNameSponsored(string calldata slug) external {
        if (!HATS.isWearerOfHat(msg.sender, protocolHatId)) revert NotProtocolMember();
        _validateSlug(slug);
        _cacheRegistration(slug, msg.sender);
        _sendSponsoredRegistrationMessage(slug, msg.sender, NameType.Gardener);
    }

    /// @notice Release current name (gardeners only, 30-day cooldown)
    function releaseName() external payable {
        string memory currentSlug = ownerToSlug[msg.sender];
        if (bytes(currentSlug).length == 0) revert NoNameToRelease();

        bytes32 slugHash = keccak256(bytes(currentSlug));
        // Cannot release garden names — they are immutable
        // (Garden accounts won't call this; only user accounts can)

        slugReleasedAt[currentSlug] = block.timestamp;
        delete slugOwner[slugHash];
        delete ownerToSlug[msg.sender];

        // Send release message to L1
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
        if (releasedAt > 0 && block.timestamp < releasedAt + NAME_CHANGE_COOLDOWN) return false;
        return true;
    }

    /// @notice Get the CCIP fee for a registration message
    function getRegistrationFee(string calldata slug, address owner, NameType nameType)
        external
        view
        returns (uint256)
    {
        bytes memory data = abi.encode(uint8(0), slug, owner, nameType); // 0 = register
        Client.EVM2AnyMessage memory message = _buildMessage(data);
        return CCIP_ROUTER.getFee(ETHEREUM_CHAIN_SELECTOR, message);
    }

    /// @notice Get the CCIP fee for a release message
    function getReleaseFee(string calldata slug) external view returns (uint256) {
        bytes memory data = abi.encode(uint8(1), slug, address(0), NameType.Gardener); // 1 = release
        Client.EVM2AnyMessage memory message = _buildMessage(data);
        return CCIP_ROUTER.getFee(ETHEREUM_CHAIN_SELECTOR, message);
    }

    // ═══════════════════════════════════════════════════════
    // Internal — CCIP Messaging
    // ═══════════════════════════════════════════════════════

    function _sendRegistrationMessage(string calldata slug, address owner, NameType nameType) internal {
        // action = 0 (register)
        bytes memory data = abi.encode(uint8(0), slug, owner, nameType);
        Client.EVM2AnyMessage memory message = _buildMessage(data);

        uint256 fee = CCIP_ROUTER.getFee(ETHEREUM_CHAIN_SELECTOR, message);
        if (msg.value < fee) revert InsufficientFee();

        bytes32 messageId = CCIP_ROUTER.ccipSend{value: fee}(ETHEREUM_CHAIN_SELECTOR, message);

        // Refund excess
        if (msg.value > fee) {
            (bool ok,) = msg.sender.call{value: msg.value - fee}("");
            ok; // Best effort refund
        }

        emit NameRegistrationSent(messageId, slug, owner, nameType, fee);
    }

    /// @dev Same as _sendRegistrationMessage but pays CCIP fee from contract balance
    function _sendSponsoredRegistrationMessage(string calldata slug, address owner, NameType nameType) internal {
        bytes memory data = abi.encode(uint8(0), slug, owner, nameType);
        Client.EVM2AnyMessage memory message = _buildMessage(data);

        uint256 fee = CCIP_ROUTER.getFee(ETHEREUM_CHAIN_SELECTOR, message);
        if (address(this).balance < fee) revert InsufficientFee();

        bytes32 messageId = CCIP_ROUTER.ccipSend{value: fee}(ETHEREUM_CHAIN_SELECTOR, message);
        emit NameRegistrationSent(messageId, slug, owner, nameType, fee);
    }

    function _sendReleaseMessage(string memory slug, address previousOwner) internal {
        bytes memory data = abi.encode(uint8(1), slug, previousOwner, NameType.Gardener);
        Client.EVM2AnyMessage memory message = _buildMessage(data);

        uint256 fee = CCIP_ROUTER.getFee(ETHEREUM_CHAIN_SELECTOR, message);
        if (msg.value < fee) revert InsufficientFee();

        bytes32 messageId = CCIP_ROUTER.ccipSend{value: fee}(ETHEREUM_CHAIN_SELECTOR, message);

        if (msg.value > fee) {
            (bool ok,) = msg.sender.call{value: msg.value - fee}("");
            ok;
        }

        emit NameReleaseSent(messageId, slug, previousOwner);
    }

    function _buildMessage(bytes memory data) internal view returns (Client.EVM2AnyMessage memory) {
        return Client.EVM2AnyMessage({
            receiver: abi.encode(l1Receiver),
            data: data,
            tokenAmounts: new Client.EVMTokenAmount[](0), // No token transfer
            extraArgs: Client._argsToBytes(Client.EVMExtraArgsV1({gasLimit: 300_000})),
            feeToken: address(0) // Pay in native ETH
        });
    }

    // ═══════════════════════════════════════════════════════
    // Internal — Validation & Cache
    // ═══════════════════════════════════════════════════════

    function _cacheRegistration(string calldata slug, address owner) internal {
        bytes32 slugHash = keccak256(bytes(slug));
        if (slugOwner[slugHash] != address(0)) revert NameTaken();

        uint256 releasedAt = slugReleasedAt[slug];
        if (releasedAt > 0 && block.timestamp < releasedAt + NAME_CHANGE_COOLDOWN) {
            revert NameInCooldown();
        }

        if (bytes(ownerToSlug[owner]).length > 0) revert AlreadyHasName();

        slugOwner[slugHash] = owner;
        ownerToSlug[owner] = slug;

        if (releasedAt > 0) delete slugReleasedAt[slug];
    }

    function _validateSlug(string calldata slug) internal pure {
        bytes memory b = bytes(slug);
        uint256 len = b.length;
        if (len < MIN_SLUG_LENGTH || len > MAX_SLUG_LENGTH) revert InvalidSlug();
        if (b[0] == 0x2D || b[len - 1] == 0x2D) revert InvalidSlug(); // no leading/trailing hyphens

        for (uint256 i = 0; i < len;) {
            bytes1 c = b[i];
            bool valid = (c >= 0x61 && c <= 0x7A)  // a-z
                || (c >= 0x30 && c <= 0x39)          // 0-9
                || c == 0x2D;                         // hyphen
            if (!valid) revert InvalidSlug();
            if (c == 0x2D && i + 1 < len && b[i + 1] == 0x2D) revert InvalidSlug(); // no consecutive hyphens
            unchecked { ++i; }
        }
    }

    // ═══════════════════════════════════════════════════════
    // Admin
    // ═══════════════════════════════════════════════════════

    function setL1Receiver(address _l1Receiver) external onlyOwner {
        address old = l1Receiver;
        l1Receiver = _l1Receiver;
        emit L1ReceiverUpdated(old, _l1Receiver);
    }

    function setAuthorizedCaller(address caller, bool authorized) external onlyOwner {
        authorizedCallers[caller] = authorized;
        emit AuthorizedCallerUpdated(caller, authorized);
    }

    /// @notice Update the protocol hat ID (e.g., after Hats tree restructuring)
    function setProtocolHatId(uint256 _protocolHatId) external onlyOwner {
        uint256 old = protocolHatId;
        protocolHatId = _protocolHatId;
        emit ProtocolHatIdUpdated(old, _protocolHatId);
    }

    /// @notice Withdraw stuck ETH (excess CCIP fees, etc.)
    function withdrawETH(address to) external onlyOwner {
        (bool ok,) = to.call{value: address(this).balance}("");
        require(ok);
    }

    /// @notice Allow contract to receive ETH (for CCIP fee funding)
    receive() external payable {}
}
```

### 4.2 New: `src/registries/ENSReceiver.sol` — L1 (Ethereum) — CCIP Receiver

The L1 contract receives CCIP messages and registers ENS subdomains.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { CCIPReceiver } from "@chainlink/contracts-ccip/src/v0.8/ccip/applications/CCIPReceiver.sol";
import { Client } from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IENS, IENSResolver } from "../interfaces/IENS.sol";

error UnauthorizedSender();
error UnauthorizedSourceChain();
error NameTaken();
error InvalidSlug();

/// @title GreenGoodsENSReceiver (L1 Receiver)
/// @notice Receives CCIP messages from Arbitrum and registers ENS subdomains
/// @dev Deployed on Ethereum mainnet. Owns greengoods.eth in ENS.
contract GreenGoodsENSReceiver is CCIPReceiver, Ownable {
    address public immutable ENS_REGISTRY;
    address public immutable ENS_RESOLVER;
    bytes32 public immutable BASE_NODE; // namehash("greengoods.eth")

    uint64 public immutable ARBITRUM_CHAIN_SELECTOR;
    address public l2Sender; // GreenGoodsENS on Arbitrum

    enum NameType { Gardener, Garden }

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
    event NameReleased(string slug, address indexed previousOwner, bytes32 indexed messageId);
    event L2SenderUpdated(address indexed oldSender, address indexed newSender);

    constructor(
        address _ccipRouter,
        uint64 _arbitrumChainSelector,
        address _l2Sender,
        address _ensRegistry,
        address _ensResolver,
        bytes32 _baseNode,
        address _owner
    ) CCIPReceiver(_ccipRouter) {
        ARBITRUM_CHAIN_SELECTOR = _arbitrumChainSelector;
        l2Sender = _l2Sender;
        ENS_REGISTRY = _ensRegistry;
        ENS_RESOLVER = _ensResolver;
        BASE_NODE = _baseNode;
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
        (uint8 action, string memory slug, address owner, NameType nameType) =
            abi.decode(message.data, (uint8, string, address, NameType));

        if (action == 0) {
            // Register
            _register(slug, owner, nameType, message.messageId);
        } else if (action == 1) {
            // Release
            _release(slug, owner, message.messageId);
        }
    }

    // ═══════════════════════════════════════════════════════
    // Internal — ENS Registration
    // ═══════════════════════════════════════════════════════

    function _register(string memory slug, address owner, NameType nameType, bytes32 messageId) internal {
        bytes32 slugHash = keccak256(bytes(slug));

        // If already taken on L1 (race condition), skip silently
        // The L2 cache should prevent this, but CCIP ordering isn't guaranteed
        if (registrations[slugHash].owner != address(0)) return;

        registrations[slugHash] = Registration({
            owner: owner,
            nameType: nameType,
            registeredAt: block.timestamp
        });
        ownerToSlug[owner] = slug;

        // Register on ENS
        _setENSRecords(slug, owner);

        emit NameRegistered(slug, owner, nameType, messageId);
    }

    function _release(string memory slug, address previousOwner, bytes32 messageId) internal {
        bytes32 slugHash = keccak256(bytes(slug));
        Registration memory reg = registrations[slugHash];

        // Verify the release is from the correct owner
        if (reg.owner != previousOwner) return;

        delete registrations[slugHash];
        delete ownerToSlug[previousOwner];

        // Clear ENS records
        bytes32 label = keccak256(bytes(slug));
        bytes32 node = keccak256(abi.encodePacked(BASE_NODE, label));
        IENSResolver(ENS_RESOLVER).setAddr(node, address(0));

        emit NameReleased(slug, previousOwner, messageId);
    }

    function _setENSRecords(string memory slug, address owner) internal {
        bytes32 label = keccak256(bytes(slug));
        bytes32 node = keccak256(abi.encodePacked(BASE_NODE, label));

        IENS(ENS_REGISTRY).setSubnodeOwner(BASE_NODE, label, address(this));
        IENS(ENS_REGISTRY).setResolver(node, ENS_RESOLVER);
        IENSResolver(ENS_RESOLVER).setAddr(node, owner);
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
        address old = l2Sender;
        l2Sender = _l2Sender;
        emit L2SenderUpdated(old, _l2Sender);
    }

    /// @notice Admin force-release a squatted name (direct L1, no CCIP)
    function adminReleaseName(string calldata slug) external onlyOwner {
        bytes32 slugHash = keccak256(bytes(slug));
        Registration memory reg = registrations[slugHash];
        if (reg.owner == address(0)) return;

        delete registrations[slugHash];
        delete ownerToSlug[reg.owner];

        bytes32 label = keccak256(bytes(slug));
        bytes32 node = keccak256(abi.encodePacked(BASE_NODE, label));
        IENSResolver(ENS_RESOLVER).setAddr(node, address(0));

        emit NameReleased(slug, reg.owner, bytes32(0));
    }

    /// @notice Admin can directly register (bypass CCIP, for migration/recovery)
    function adminRegister(string calldata slug, address owner, NameType nameType) external onlyOwner {
        bytes32 slugHash = keccak256(bytes(slug));
        if (registrations[slugHash].owner != address(0)) revert NameTaken();

        registrations[slugHash] = Registration({
            owner: owner,
            nameType: nameType,
            registeredAt: block.timestamp
        });
        ownerToSlug[owner] = slug;
        _setENSRecords(slug, owner);

        emit NameRegistered(slug, owner, nameType, bytes32(0));
    }
}
```

### 4.3 Modified: `src/tokens/Garden.sol` (L2 — Arbitrum)

The mint flow on L2 now calls the ENS module to send a CCIP message. **No `registerProtocolAccount()`** — protocol membership is handled entirely by Hats Protocol (see 4.6).

```diff
+ import { IGreenGoodsENS } from "../interfaces/IGreenGoodsENS.sol";

  contract GardenToken is ERC721Upgradeable, OwnableUpgradeable, UUPSUpgradeable {
      // ... existing storage ...
      ICookieJarModule public cookieJarModule;
+     IGreenGoodsENS public ensModule;

      // Events
+     event ENSModuleUpdated(address indexed oldModule, address indexed newModule);

      struct GardenConfig {
          address communityToken;
          string name;
+         string slug;           // ENS subdomain slug
          string description;
          string location;
          string bannerImage;
          string metadata;
          bool openJoining;
          IGardensModule.WeightScheme weightScheme;
          uint8 domainMask;
      }

      // ... existing code ...

+     function setENSModule(address _ensModule) external onlyOwner {
+         address oldModule = address(ensModule);
+         ensModule = IGreenGoodsENS(_ensModule);
+         emit ENSModuleUpdated(oldModule, _ensModule);
+     }
  }
```

In `_initializeGardenModules()`, add ENS registration (same graceful degradation pattern):

```solidity
// ENS: register garden subdomain via CCIP (graceful degradation)
if (address(ensModule) != address(0) && bytes(config.slug).length > 0) {
    // solhint-disable-next-line no-empty-blocks
    try ensModule.registerGarden{value: msg.value}(config.slug, gardenAccount) {
        // Success handled by ENS module events
    } catch {
        // Non-blocking — garden mint MUST NOT revert
    }
}
```

The `mintGarden()` function becomes `payable` to accept ETH for the CCIP fee:

```diff
- function mintGarden(GardenConfig calldata config) external onlyAuthorizedMinter returns (address) {
+ function mintGarden(GardenConfig calldata config) external payable onlyAuthorizedMinter returns (address) {
```

**Storage gap**: Reduce `__gap` from `[41]` to `[40]` (adding `ensModule`).

### 4.4 Modified: `src/interfaces/IGardenAccount.sol`

```diff
  struct InitParams {
      address communityToken;
      string name;
+     string slug;
      string description;
      string location;
      string bannerImage;
      string metadata;
      bool openJoining;
  }
```

### 4.5 Modified: `src/accounts/Garden.sol`

```diff
+ /// @notice The ENS subdomain slug (e.g., "miyawaki-park")
+ string public slug;
```

In `initialize()`:

```diff
  function initialize(IGardenAccount.InitParams calldata params) external initializer {
      communityToken = params.communityToken;
      name = params.name;
+     slug = params.slug;
      description = params.description;
      // ...
  }
```

**Storage gap**: Reduce `__gap` from `[34]` to `[33]`.

**No changes to `joinGarden()`** — protocol hat minting is handled by `HatsModule._grantRole()` (see 4.6), which is already called during `joinGarden()`. No additional code needed in GardenAccount.

### 4.6 New: `src/interfaces/IGreenGoodsENS.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title IGreenGoodsENS
/// @notice Interface for the L2 ENS registration sender
interface IGreenGoodsENS {
    enum NameType { Gardener, Garden }

    function registerGarden(string calldata slug, address gardenAccount) external payable;
    function claimName(string calldata slug) external payable;        // user-funded (wallet users)
    function claimNameSponsored(string calldata slug) external;       // contract-funded (passkey users)
    function releaseName() external payable;
    function available(string calldata slug) external view returns (bool);
    function getRegistrationFee(string calldata slug, address owner, NameType nameType)
        external view returns (uint256);
}
```

### 4.7 Modified: `src/modules/Hats.sol` — Protocol Hat Auto-Mint

The single key change: when ANY role is granted in ANY garden, `_grantRole()` also mints the `protocolGardenersHatId`. This makes every protocol member eligible for ENS name claims without any extra function calls.

```diff
  function _grantRole(address garden, address account, GardenRole role) internal {
      GardenHats storage hats_ = gardenHats[garden];
      // ... existing role hat selection logic ...

      hats.mintHat(hatId, account);
+
+     // Auto-mint protocol-wide gardener hat (enables ENS name claims)
+     // Best-effort: skip silently if already wearing or hat doesn't exist
+     if (protocolGardenersHatId != 0) {
+         // isWearerOfHat returns false if account doesn't wear it
+         if (!hats.isWearerOfHat(account, protocolGardenersHatId)) {
+             try hats.mintHat(protocolGardenersHatId, account) {} catch {}
+         }
+     }

      emit RoleGranted(garden, account, role);
  }
```

**Why this location**: `_grantRole()` is the single funnel for ALL role assignments — called by `createGardenHatTree()` (owner role during mint), `grantRole()` (operator/evaluator), and indirectly by `joinGarden()` (gardener role). One change, all pathways covered.

**Idempotency**: If the account already wears the protocol hat (e.g., they're already a member of another garden), `hats.isWearerOfHat()` returns `true` and the mint is skipped. If the hat doesn't exist yet, the `try/catch` handles it gracefully.

### 4.8 Deleted Files

| File | Reason |
|------|--------|
| `src/registries/Gardener.sol` | Replaced by `src/registries/ENS.sol` (L2) + `src/registries/ENSReceiver.sol` (L1) |
| `src/interfaces/IGardenerRegistry.sol` | Replaced by `src/interfaces/IGreenGoodsENS.sol` |

**Keep**: `src/interfaces/IENS.sol` — still needed by the L1 receiver.

---

## 5. CCIP Message Protocol

### Message Format

Both registration and release messages use the same encoding:

```solidity
// action: 0 = register, 1 = release
abi.encode(uint8 action, string slug, address owner, NameType nameType)
```

### Fee Payment

CCIP fees are paid in **native ETH** (`feeToken: address(0)`). The fee is ~$0.09-0.10 per message.

For **garden registration**: the operator passes `msg.value` when calling `mintGarden()`. GardenToken forwards it to `ensModule.registerGarden{value: msg.value}(...)`.

For **gardener registration**: passkey users have gas sponsored by Pimlico, but the CCIP fee (~$0.09 in ETH) needs a source. Two options:

1. **Pre-funded contract (recommended)**: The L2 GreenGoodsENS contract holds an ETH balance. A `claimNameSponsored()` function draws from this balance, requiring only a valid Hats Protocol hat. Best UX — passkey users don't need to acquire ETH.
2. **User-funded**: The UserOp includes `msg.value` for the CCIP fee. Requires the user to have ETH on Arbitrum — problematic for mobile-first passkey users.

Option 1 is strongly recommended for the client PWA. Operators in the admin dashboard (wallet-auth) can pay their own fees.

### Fee Estimation

The frontend calls `getRegistrationFee()` before submitting to show the exact cost:

```typescript
const fee = await l2Client.readContract({
  address: greenGoodsENSAddress,
  abi: greenGoodsENSABI,
  functionName: "getRegistrationFee",
  args: [slug, ownerAddress, nameType],
});
// fee ≈ 0.00003 ETH (~$0.09)
```

### Delivery Guarantees

- **Ordering**: CCIP doesn't guarantee message ordering. The L2 cache prevents double-registration. The L1 receiver silently skips if a name is already taken (handles race conditions).
- **Delivery**: CCIP guarantees at-least-once delivery. Duplicate messages are handled by the L1 receiver's idempotent `_register()`.
- **Failures**: If L1 execution fails (out of gas), CCIP retries. The `gasLimit: 300_000` in `extraArgs` is sufficient for ENS registration (~120K gas).

---

## 6. UX Flows

### 6.1 Garden Creation (Admin Dashboard) — Single Transaction

```
Operator fills garden form
  │ name: "Miyawaki Park"
  │ slug: "miyawaki-park" (auto-suggested, editable)
  │ domain: Agro
  │ ...
  ▼
Step 1: Check availability
  │ GreenGoodsENS.available("miyawaki-park") → true ✓ (L2 cache)
  │ Optional: also check L1 receiver for authoritative answer
  ▼
Step 2: Estimate CCIP fee
  │ GreenGoodsENS.getRegistrationFee(...) → ~0.00003 ETH
  ▼
Step 3: Single transaction on Arbitrum
  │ Wallet prompts: "Confirm transaction on Arbitrum"
  │ GardenToken.mintGarden{value: ccipFee}({slug: "miyawaki-park", ...})
  │ → Garden minted, TBA created, slug stored
  │ → CCIP message sent to Ethereum L1
  ▼
Step 4: Wait for ENS activation (~15-20 min)
  │ UI shows: "Garden created! ENS name activating..."
  │ Frontend polls L1 receiver or listens for CCIP delivery
  ▼
Done. miyawaki-park.greengoods.eth resolves globally.
```

**Key difference from v3**: No chain switching. The operator stays on Arbitrum. The CCIP message handles L1 registration automatically.

### 6.2 Personal Name Claim — All Roles, Both Apps

Any protocol member can claim a personal `*.greengoods.eth` name. The protocol hat is auto-minted in `HatsModule._grantRole()`, so **every role grant in any garden** makes the recipient eligible — no extra steps.

**Online-only flow** — ENS claim requires blockchain connectivity and is NOT queued via the job queue. The claim form is visible when offline but the submit button is disabled ("Go online to claim").

#### Who can claim and how they got eligible

| Role | How they get the protocol hat | App |
|------|-------------------------------|-----|
| **Owner** | `mintGarden()` → `grantRole(Owner)` | Admin |
| **Operator** | Owner grants via `grantRole(Operator)` | Admin |
| **Evaluator** | Operator grants via `grantRole(Evaluator)` | Admin |
| **Gardener** | `joinGarden()` → `grantRole(Gardener)` | Client |
| **Funder** | Operator grants via `grantRole(Funder)` | Admin |
| **Community** | Operator grants via `grantRole(Community)` | Admin |

All paths flow through `HatsModule._grantRole()` → protocol hat auto-mint. One contract function, one frontend hook, all roles covered.

#### Client PWA (passkey users) — Sponsored

```
1. User creates passkey → smart account on Arbitrum
2. User joins a garden (or receives any role grant)
   │ → HatsModule auto-mints protocol hat
   ▼
3. Profile settings: "Claim your greengoods.eth name"
   │ Slug input pre-filled from username (editable)
   │ Instant format validation (Zod schema, onChange)
   │ Debounced availability check (300ms after typing stops)
   ▼
Step 1: Submit claim (single UserOp on Arbitrum)
   │ Pimlico sponsors gas
   │ CCIP fee paid from contract's ETH balance (sponsored)
   │ GreenGoodsENS.claimNameSponsored("alice")
   │ → hats.isWearerOfHat(msg.sender, protocolHatId) ✓
   │ → CCIP message sent to Ethereum L1
   ▼
Step 2: Progress timeline shown in profile
   │ [check] Transaction submitted
   │ [spin]  Cross-chain relay in progress (usually 15-20 min)
   │ [wait]  ENS name registered
   │
   │ Push notification sent when complete (via service worker)
   ▼
Done. alice.greengoods.eth resolves globally.
```

#### Admin Dashboard (wallet users) — Self-Funded

```
1. Operator connects wallet
2. Operator mints a garden (or has any role in any garden)
   │ → HatsModule auto-mints protocol hat
   ▼
3. Profile/settings: "Claim your greengoods.eth name"
   │ Same slug form as client (shared hook)
   ▼
Step 1: Submit claim (wallet transaction on Arbitrum)
   │ GreenGoodsENS.claimName{value: ccipFee}("operator-alice")
   │ → hats.isWearerOfHat(msg.sender, protocolHatId) ✓
   │ → CCIP message sent to Ethereum L1
   ▼
Step 2: Same progress timeline
   ▼
Done. operator-alice.greengoods.eth resolves globally.
```

#### Contract API — Single Function for Both Apps

The `useENSClaim` hook (section 8.1) detects the auth mode and calls the right contract function:

| Auth Mode | Contract Function | Who Pays CCIP Fee |
|-----------|-------------------|-------------------|
| Passkey (client) | `claimNameSponsored(slug)` | Contract balance |
| Wallet (admin) | `claimName{value: fee}(slug)` | User's wallet |

Both functions have the same access check: `HATS.isWearerOfHat(msg.sender, protocolHatId)`. The only difference is fee payment.

### 6.3 Pending State UX

During the ~15-20 minute CCIP delivery window, the UI shows a progress timeline. A ~15-20 minute wait is unusually long for a blockchain interaction — users will think something broke without clear communication.

**Three states:**

| State | Indicator | Description | Action |
|-------|-----------|-------------|--------|
| **Pending** | Pulsing animation | "Cross-chain relay in progress" + estimated time | CCIP message ID (copyable), Explorer link |
| **Active** | Green check | "ENS name registered" + resolved address | Full `.greengoods.eth` name shown |
| **Timed Out** | Warning icon | "Taking longer than expected" (>25 min) | Manual CCIP Explorer link, contact support |
| **Failed** | Error icon | Transaction reverted / message ID unavailable | Retry button |

**Progress timeline component** (shown inline in profile after submitting):

```
┌─────────────────────────────────────────────┐
│ alice.greengoods.eth                        │
│                                             │
│  [check] Transaction submitted              │
│  [spin]  Cross-chain relay in progress      │
│          Usually takes 15-20 minutes        │
│          Message: 0xabc...def  [copy]       │
│  [ ]     ENS name registered                │
│                                             │
│  Your name is being registered on Ethereum  │
│  mainnet via Chainlink CCIP. This is a      │
│  one-time cross-chain process.              │
│                                             │
│  [Track on Explorer ↗]                      │
└─────────────────────────────────────────────┘
```

**Persistence**: The pending state data (`ccipMessageId`, `submittedAt`, `slug`) is stored in TanStack Query cache, which is persisted to IndexedDB via `PersistQueryClientProvider`. This means the progress timeline survives app restarts.

**Push notification**: When `useENSRegistrationStatus` detects the status changed from "pending" to "active", trigger a service worker notification: "Your name alice.greengoods.eth is now active!"

**Mobile note**: The CCIP Explorer link opens in the system browser (not the PWA). Show it as a secondary action with an external link icon, not the primary CTA. The message ID should be copyable via the existing `AddressCopy` component pattern.

---

## 7. Deployment

### Prerequisites

1. **Own `greengoods.eth`** on ENS
2. **Deployer has ETH on both Ethereum and Arbitrum**
3. **LINK tokens or native ETH** for CCIP fees (native ETH preferred)

### Deployment Steps

**Step 1: Deploy L1 Receiver (Ethereum)**

```bash
# Deploy GreenGoodsENSReceiver on Ethereum
bun script/deploy-ens.ts receiver --network mainnet --broadcast

# Constructor args:
#   ccipRouter: 0x80226fc0Ee2b096224EeAc085Bb9a8cba1146f7D (Ethereum CCIP Router)
#   arbitrumChainSelector: 4949039107694359620 (Arbitrum One selector)
#   l2Sender: address(0) (set after L2 deploy)
#   ensRegistry: 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e
#   ensResolver: 0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63
#   baseNode: namehash("greengoods.eth")
#   owner: multisig address
```

**Step 2: Transfer `greengoods.eth` to L1 Receiver**

```bash
# Transfer ENS name ownership so receiver can register subdomains
# Done via ENS App or cast
```

**Step 3: Deploy L2 Sender (Arbitrum)**

```bash
# Deploy GreenGoodsENS on Arbitrum (part of normal deploy)
bun script/deploy-ens.ts sender --network arbitrum --broadcast

# Constructor args:
#   ccipRouter: 0x141fa059441E0ca23ce184B6A78bafD2A517DdE8 (Arbitrum CCIP Router)
#   ethereumChainSelector: 5009297550715157269 (Ethereum selector)
#   l1Receiver: <address from step 1>
#   hats: <Hats Protocol contract address on Arbitrum>
#   protocolHatId: <protocolGardenersHatId from HatsModule>
#   owner: multisig address
```

**Step 4: Wire Contracts**

```bash
# On L1: set L2 sender address
cast send <L1Receiver> "setL2Sender(address)" <L2SenderAddress> --rpc-url $MAINNET_RPC

# On L2: set GardenToken as authorized caller
cast send <L2Sender> "setAuthorizedCaller(address,bool)" <GardenToken> true --rpc-url $ARBITRUM_RPC

# On L2: set ENS module on GardenToken
cast send <GardenToken> "setENSModule(address)" <L2Sender> --rpc-url $ARBITRUM_RPC
```

### Deployment Artifacts

`deployments/1-latest.json` (new file for mainnet):
```json
{
  "greenGoodsENSReceiver": "0x...",
  "ensNamespace": "greengoods.eth"
}
```

`deployments/42161-latest.json` (updated):
```json
{
  "greenGoodsENS": "0x...",
  ...existing fields...
}
```

---

## 8. Frontend Integration

### 8.1 ENS Claim — Decoupled from Auth Machine

The ENS claim is **fully decoupled from the XState auth machine**. Remove the `claiming_ens` state and `CLAIM_ENS` event from the auth machine. Instead, use a standalone TanStack Query `useMutation` hook — this coordinates naturally with `useENSRegistrationStatus` (both in TanStack Query's cache).

**Discovery**: Surface the ENS claim in two places:
1. **Profile header**: If user has no ENS name and IS a protocol member, show a "Claim your .greengoods.eth name" chip below the display name (primary discovery).
2. **Profile Account section**: Full claim form between "Gardens" and "Account" headers.
3. **One-time toast**: After joining first garden, show: "You can now claim your greengoods.eth name!"

```typescript
// packages/shared/src/hooks/ens/useENSClaim.ts
export function useENSClaim() {
  const queryClient = useQueryClient();
  const { user, smartAccountClient, walletClient } = useAuth();
  const isPasskeyUser = user?.authMode === "passkey";

  return useMutation({
    mutationFn: async ({ slug }: { slug: string }) => {
      const ensAddress = getDeploymentConfig().greenGoodsENS;
      if (!ensAddress) throw new Error("ENS module not configured");

      let txHash: Hex;

      if (isPasskeyUser && smartAccountClient) {
        // Passkey user: sponsored registration (CCIP fee from contract balance)
        const data = encodeFunctionData({
          abi: greenGoodsENSABI,
          functionName: "claimNameSponsored",
          args: [slug],
        });
        txHash = await smartAccountClient.sendTransaction({
          account: smartAccountClient.account!,
          to: ensAddress,
          data,
        });
      } else if (walletClient) {
        // Wallet user: user-funded registration
        const fee = await publicClient.readContract({
          address: ensAddress,
          abi: greenGoodsENSABI,
          functionName: "getRegistrationFee",
          args: [slug, walletClient.account!.address, 0],
        });
        txHash = await walletClient.writeContract({
          address: ensAddress,
          abi: greenGoodsENSABI,
          functionName: "claimName",
          args: [slug],
          value: fee,
        });
      } else {
        throw new Error("No connected account");
      }

      // Parse NameRegistrationSent event from receipt
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      const ccipMessageId = parseEventLogs(receipt, "NameRegistrationSent");

      return { slug, ccipMessageId, submittedAt: Date.now() };
    },
    onSuccess: (data) => {
      // Seed registration status query with initial "pending" data
      queryClient.setQueryData(
        queryKeys.ens.registrationStatus(data.slug),
        { status: "pending", ccipMessageId: data.ccipMessageId, submittedAt: data.submittedAt }
      );
    },
    onError: (error) => {
      const parsed = parseContractError(error);
      const message = ENS_ERROR_MESSAGES[parsed.name] || "Registration failed";
      logger.error("ENS claim failed", { error, parsed });
      toast.error(message);
    },
  });
}

// Contract error → user-friendly message mapping
const ENS_ERROR_MESSAGES: Record<string, string> = {
  NameTaken: "This name is already taken. Please choose a different one.",
  InvalidSlug: "This name contains invalid characters.",
  NotProtocolMember: "You need to join a garden before claiming a name.",
  AlreadyHasName: "You already have a greengoods.eth name. Release it first.",
  InsufficientFee: "Not enough ETH to cover the registration fee.",
  NameInCooldown: "This name was recently released and is in a 30-day cooldown.",
};
```

**Auth machine cleanup**: Remove `claiming_ens` state, `CLAIM_ENS` event, and `claimENS` from `AuthContextType`. The auth machine should only handle authentication concerns.

### 8.2 Garden Creation: Single-Chain Flow

```typescript
// packages/admin — garden creation view
async function createGarden(config: GardenConfig) {
  // Step 1: Check availability on L2 cache
  const isAvailable = await l2Client.readContract({
    address: greenGoodsENSAddress,
    abi: greenGoodsENSABI,
    functionName: "available",
    args: [config.slug],
  });
  if (!isAvailable) throw new Error("Slug already taken");

  // Step 2: Get CCIP fee
  const ccipFee = await l2Client.readContract({
    address: greenGoodsENSAddress,
    abi: greenGoodsENSABI,
    functionName: "getRegistrationFee",
    args: [config.slug, gardenAccount, 1 /* Garden */],
  });

  // Step 3: Single transaction on Arbitrum
  const tx = await walletClient.writeContract({
    address: gardenTokenAddress,
    abi: gardenTokenABI,
    functionName: "mintGarden",
    args: [config],
    value: ccipFee,  // Forwarded to CCIP Router
  });

  // Step 4: Return tx hash — frontend tracks CCIP delivery
  return tx;
}
```

### 8.3 CCIP Delivery Tracking

```typescript
// packages/shared/src/hooks/ens/useENSRegistrationStatus.ts

interface ENSRegistrationData {
  status: "available" | "pending" | "active" | "timed_out";
  ccipMessageId?: string;
  submittedAt?: number;
  registration?: { owner: Address; nameType: number; registeredAt: bigint };
}

export function useENSRegistrationStatus(slug: string | undefined) {
  return useQuery<ENSRegistrationData>({
    queryKey: queryKeys.ens.registrationStatus(slug ?? ""),
    queryFn: async () => {
      // Check L1 receiver for authoritative status
      const registration = await mainnetClient.readContract({
        address: l1ReceiverAddress,
        abi: ensReceiverABI,
        functionName: "getRegistration",
        args: [slug!],
      });

      if (registration.owner !== zeroAddress) {
        return { status: "active", registration };
      }

      // Check L2 cache — if cached but not on L1, it's pending
      const l2Owner = await arbitrumClient.readContract({
        address: greenGoodsENSAddress,
        abi: greenGoodsENSABI,
        functionName: "slugOwner",
        args: [keccak256(toBytes(slug!))],
      });

      if (l2Owner !== zeroAddress) {
        return { status: "pending" };
      }

      return { status: "available" };
    },
    enabled: Boolean(slug),
    staleTime: STALE_TIME_MEDIUM, // 30s — not a magic number
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data || data.status !== "pending") return false;

      // Adaptive polling: 60s for first 10 min, then 30s
      const elapsed = Date.now() - (data.submittedAt ?? Date.now());
      if (elapsed > 25 * 60_000) return false; // Stop after 25 min (timed out)
      return elapsed < 10 * 60_000 ? 60_000 : 30_000;
    },
    // NOTE: Return data must be fully serializable (no functions/classes)
    // for IndexedDB persistence via PersistQueryClientProvider
  });
}
```

### 8.4 Protocol Membership Check

```typescript
// packages/shared/src/hooks/ens/useProtocolMemberStatus.ts
export function useProtocolMemberStatus(address: Address | undefined) {
  const ensAddress = getDeploymentConfig().greenGoodsENS;

  return useQuery({
    queryKey: queryKeys.ens.protocolMembership(address ?? ""),
    queryFn: async () => {
      if (!address || !ensAddress) return false;

      const protocolHatId = await publicClient.readContract({
        address: ensAddress,
        abi: greenGoodsENSABI,
        functionName: "protocolHatId",
      });

      return publicClient.readContract({
        address: hatsAddress,
        abi: hatsABI,
        functionName: "isWearerOfHat",
        args: [address, protocolHatId],
      });
    },
    enabled: Boolean(address) && Boolean(ensAddress),
    staleTime: STALE_TIME_RARE, // 5 min — protocol membership changes infrequently
  });
}
```

### 8.5 Slug Form + Availability

**Three-tier validation** — never call the RPC on every keystroke:
1. **Synchronous (instant)**: Zod schema validates format on every keystroke
2. **Debounced (300ms)**: After typing stops AND format is valid, check `available()` on L2
3. **On-submit (final)**: Re-check availability before sending the transaction

```typescript
// packages/shared/src/hooks/ens/useSlugForm.ts
export const slugSchema = z.object({
  slug: z.string()
    .min(3, "Too short (min 3 characters)")
    .max(50, "Too long (max 50 characters)")
    .regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens")
    .refine((s) => !/^-|-$/.test(s), "Cannot start or end with hyphen")
    .refine((s) => !s.includes("--"), "No consecutive hyphens"),
});

export function useSlugForm(suggestedSlug?: string) {
  return useForm<z.infer<typeof slugSchema>>({
    resolver: zodResolver(slugSchema),
    mode: "onChange",
    defaultValues: { slug: suggestedSlug ?? "" },
  });
}

// packages/shared/src/hooks/ens/useSlugAvailability.ts
export function useSlugAvailability(slug: string | undefined) {
  const debouncedSlug = useDebounce(slug, 300);
  const isValidFormat = debouncedSlug ? slugSchema.safeParse({ slug: debouncedSlug }).success : false;

  return useQuery({
    queryKey: queryKeys.ens.availability(debouncedSlug ?? ""),
    queryFn: async () => {
      return publicClient.readContract({
        address: greenGoodsENSAddress,
        abi: greenGoodsENSABI,
        functionName: "available",
        args: [debouncedSlug!],
      });
    },
    enabled: Boolean(debouncedSlug) && isValidFormat,
    staleTime: 5_000, // 5s — names can be claimed quickly
  });
}
```

**Auto-suggest from username** (pre-fill slug input):

```typescript
const suggestedSlug = useMemo(() => {
  if (!userName) return "";
  return userName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}, [userName]);
```

**Mobile input attributes**: Use `inputMode="text"` and `autoCapitalize="none"` on the slug input since slugs are lowercase-only. Auto-lowercase on change.

### 8.6 Shared Utils

```typescript
// packages/shared/src/utils/blockchain/ens.ts — add slug validation

export function validateSlug(slug: string): { valid: boolean; error?: string } {
  if (slug.length < 3) return { valid: false, error: "Too short (min 3 characters)" };
  if (slug.length > 50) return { valid: false, error: "Too long (max 50 characters)" };
  if (/^-|-$/.test(slug)) return { valid: false, error: "Cannot start or end with hyphen" };
  if (/--/.test(slug)) return { valid: false, error: "No consecutive hyphens" };
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return { valid: false, error: "Only lowercase letters, numbers, and hyphens" };
  }
  return { valid: true };
}

// Existing resolveEnsName/resolveEnsAddress/resolveEnsAvatar — NO CHANGES NEEDED
// ENS resolution works natively since subdomains are registered directly on L1
```

### 8.7 Query Key Extensions

```typescript
// packages/shared/src/hooks/query-keys.ts — extend ens namespace
ens: {
  all: ["greengoods", "ens"] as const,
  name: (address: string) => ["greengoods", "ens", "name", address] as const,
  address: (name: string) => ["greengoods", "ens", "address", name] as const,
  avatar: (address: string) => ["greengoods", "ens", "avatar", address] as const,
  // New for ENS registration
  registrationStatus: (slug: string) => ["greengoods", "ens", "registration", slug] as const,
  availability: (slug: string) => ["greengoods", "ens", "availability", slug] as const,
  protocolMembership: (address: string) => ["greengoods", "ens", "protocolMembership", address] as const,
},
```

---

## 9. Indexer Integration

### Schema Updates (`packages/indexer/schema.graphql`)

The indexer runs on Arbitrum. It indexes the `slug` field from `GardenAccount` events AND the CCIP message events from the L2 GreenGoodsENS contract.

```graphql
# Existing Garden entity gets slug field
type Garden @entity {
  # ... existing fields ...
  slug: String            # From GardenAccount initialization
  ensStatus: String       # "pending" | "active" — tracked via CCIP events
}

# New entity for ENS registrations
type ENSRegistration @entity {
  id: ID!                 # slug
  slug: String!
  owner: String!
  nameType: String!       # "Gardener" | "Garden"
  ccipMessageId: String!
  status: String!         # "pending" | "active"
  registeredAt: BigInt!
}
```

Event handlers index `NameRegistrationSent` from the L2 contract to create `ENSRegistration` entities with `status: "pending"`. The frontend can use this for tracking.

---

## 10. Chainlink CCIP Dependencies

### npm Packages

```bash
# In packages/contracts
bun add @chainlink/contracts-ccip
```

### Foundry Remappings

```toml
# In foundry.toml or remappings.txt
@chainlink/contracts-ccip/=node_modules/@chainlink/contracts-ccip/
```

### Contract Addresses (Production)

| Contract | Chain | Address |
|----------|-------|---------|
| CCIP Router | Arbitrum One | `0x141fa059441E0ca23ce184B6A78bafD2A517DdE8` |
| CCIP Router | Ethereum Mainnet | `0x80226fc0Ee2b096224EeAc085Bb9a8cba1146f7D` |
| Arbitrum Chain Selector | — | `4949039107694359620` |
| Ethereum Chain Selector | — | `5009297550715157269` |
| ENS Registry | Ethereum Mainnet | `0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e` |
| ENS Public Resolver | Ethereum Mainnet | `0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63` |

### Testing

> **No L2 testnet for CCIP** — the project uses Ethereum Sepolia (11155111) for contract testing but does not deploy to an L2 testnet. CCIP cross-chain flows are tested via **fork tests** with mock CCIP routers on Anvil (see `test/integration/CCIPENSFlow.t.sol`). Production deployment goes directly to Arbitrum → Ethereum mainnet.

---

## 11. Implementation Order

### Phase 1: Contracts (P0)
1. Add `@chainlink/contracts-ccip` dependency + Foundry remappings
2. Write `IGreenGoodsENS.sol` interface
3. Write `src/registries/ENS.sol` (L2 CCIP Sender):
   - Hats Protocol integration (`IHats.isWearerOfHat` for gardener access control)
   - Slug validation
   - L2 registration cache
   - CCIP message construction + sending
   - Fee estimation
4. Write `src/registries/ENSReceiver.sol` (L1 CCIP Receiver):
   - Source chain + sender verification
   - ENS registration (`setSubnodeOwner` + `setAddr`)
   - Idempotent handling (skip if already registered)
   - Admin functions (force-release, direct register)
5. Add `slug` to `GardenConfig`, `InitParams`, `GardenAccount`
6. Add `ensModule` to `GardenToken` + `setENSModule()`
7. Add ENS call in `_initializeGardenModules()` with graceful degradation
8. **Add protocol hat auto-mint in `HatsModule._grantRole()`** (single line — mints `protocolGardenersHatId`)
9. Make `mintGarden()` / `batchMintGardens()` payable
10. Write unit tests (~30 tests):
    - Slug validation edge cases
    - Hats Protocol membership gating (wear hat → can register, no hat → revert)
    - L2 cache operations
    - CCIP message encoding
    - L1 receiver: registration, release, admin functions
    - Source chain/sender verification
    - Fee estimation
    - Race condition handling (duplicate messages)
    - Protocol hat auto-mint: grantRole → protocol hat minted, already wearing → skipped
    - End-to-end: mint garden → owner has protocol hat → can claim name
11. Write `script/deploy-ens.ts` for L1 + L2 deployment
12. Delete old `Gardener.sol`, `IGardenerRegistry.sol`

### Phase 2: Frontend (P1)
1. **Remove** `claiming_ens` state and `CLAIM_ENS` event from auth machine
2. Add `useENSClaim()` mutation hook (decoupled from auth machine, supports passkey + wallet)
3. Add `useProtocolMemberStatus()` hook for checking protocol hat (Hats Protocol)
4. Add `useENSRegistrationStatus()` hook for CCIP delivery tracking (adaptive polling, IndexedDB persistence)
5. Add `useSlugForm()` with Zod schema + `useSlugAvailability()` with debounced RPC check
6. Add `validateSlug()` to shared utils
7. Extend `queryKeys.ens` namespace with new keys
8. Add personal name claim to profile settings (client + admin) — visible only after wearing protocol hat
9. Add ENS claim discovery: profile header badge + one-time toast after first garden join
10. Add slug field to garden creation form (admin) with auto-suggest from garden name
11. Make garden creation `payable` with CCIP fee forwarding
12. Add progress timeline component for CCIP delivery (~15-20 min)
13. Add offline gate: disable ENS claim form when offline (use existing `useOffline()`)
14. Add service worker push notification on registration completion

### Phase 3: Indexer (P1)
1. Add `slug` and `ensStatus` fields to Garden entity
2. Add `ENSRegistration` entity
3. Index `NameRegistrationSent` events from L2 GreenGoodsENS

### Phase 4: Future Celo Support (P2)
1. Deploy separate GreenGoodsENS (L2 Sender) on Celo
2. Wire to same L1 Receiver — set Celo sender as authorized
3. CCIP supports Celo (chain selector TBD)
4. Same single-transaction flow on Celo

---

## 12. Files Touched Summary

### New Files
| File | Package | Description |
|------|---------|-------------|
| `src/registries/ENS.sol` | contracts (L2) | GreenGoodsENS — CCIP sender, L2 cache, sponsored registration |
| `src/registries/ENSReceiver.sol` | contracts (L1) | GreenGoodsENSReceiver — CCIP receiver, ENS registration |
| `src/interfaces/IGreenGoodsENS.sol` | contracts | Interface for L2 sender |
| `test/unit/GreenGoodsENS.t.sol` | contracts | L2 sender unit tests |
| `test/unit/GreenGoodsENSReceiver.t.sol` | contracts | L1 receiver unit tests |
| `test/integration/CCIPENSFlow.t.sol` | contracts | Integration test (mock CCIP) |
| `script/deploy-ens.ts` | contracts | L1 + L2 deployment script |
| `src/hooks/ens/useENSClaim.ts` | shared | Mutation hook for ENS name claim |
| `src/hooks/ens/useENSRegistrationStatus.ts` | shared | CCIP delivery tracking with adaptive polling |
| `src/hooks/ens/useProtocolMemberStatus.ts` | shared | Hats Protocol hat check |
| `src/hooks/ens/useSlugForm.ts` | shared | Zod schema + React Hook Form for slug input |
| `src/hooks/ens/useSlugAvailability.ts` | shared | Debounced L2 availability check |

### Modified Files
| File | Change |
|------|--------|
| `src/tokens/Garden.sol` | Add `ensModule`, `slug` to GardenConfig, `setENSModule()`, `payable` mint |
| `src/accounts/Garden.sol` | Add `slug` storage field |
| `src/modules/Hats.sol` | Add protocol hat auto-mint in `_grantRole()` (~5 LOC) |
| `src/interfaces/IGardenAccount.sol` | Add `slug` to InitParams |
| `test/helpers/DeploymentBase.sol` | Remove old mainnet-only ENS path, add CCIP mock setup |
| `packages/shared/src/workflows/authMachine.ts` | Remove `claiming_ens` state and `CLAIM_ENS` event |
| `packages/shared/src/workflows/authServices.ts` | Remove `claimENSService` (replaced by `useENSClaim` hook) |
| `packages/shared/src/hooks/query-keys.ts` | Extend `ens` namespace with registration/availability/membership keys |
| `packages/shared/src/utils/blockchain/ens.ts` | Add `validateSlug()` |
| `packages/indexer/schema.graphql` | Add `slug`, `ensStatus` to Garden, new `ENSRegistration` entity |
| `packages/contracts/package.json` | Add `@chainlink/contracts-ccip` dependency |
| `packages/contracts/remappings.txt` | Add Chainlink remapping |

### Deleted Files
| File | Reason |
|------|--------|
| `src/registries/Gardener.sol` | Replaced by ENS.sol + ENSReceiver.sol |
| `src/interfaces/IGardenerRegistry.sol` | Replaced by IGreenGoodsENS.sol |

---

## 13. Decisions Summary

| Question | Decision | Rationale |
|----------|----------|-----------|
| Cross-chain mechanism | **Chainlink CCIP** | Single tx on L2, decentralized relay, no APIs to host |
| Delivery time | **~15-20 minutes** | Acceptable tradeoff for single-tx UX vs instant (direct L1) |
| Fee payment | **Native ETH** — sponsored for passkey users | Contract pre-funded; passkey users call `claimNameSponsored()`. Wallet users self-fund. |
| Gardener access control | **Hats Protocol hat** | Only accounts wearing `protocolGardenersHatId` — auto-minted in `_grantRole()` |
| Garden ENS registration | **Auto via CCIP** from `mintGarden()` | Single operator tx on Arbitrum |
| Collision prevention | **L2 cache + L1 source of truth** | L2 prevents double-registration, L1 is authoritative |
| Garden slug format | **No domain prefix** | Just "miyawaki-park", not "waste.miyawaki-park" |
| Garden name changes | **Immutable** | Set once at creation |
| Gardener name changes | **Allowed**, 30-day cooldown | Prevent squatting |
| L1 upgradeability | **Not upgradeable** (Ownable) | Simple receiver, redeploy + re-wire if needed |
| L2 upgradeability | **Not upgradeable** (Ownable) | Same rationale; GardenToken can point to new module |
| Race conditions | **Idempotent L1 receiver** | Silently skips duplicate registrations |
| Alternative protocols | Chainlink CCIP over LayerZero/Hyperlane/Axelar | Largest DON, native ETH fees, best Arbitrum support |
| ENS claim integration | **TanStack Query `useMutation`** (not XState) | Decoupled from auth machine; coordinates with polling hook via query cache |
| Slug validation | **Three-tier**: sync Zod → debounced RPC → on-submit | Prevents RPC spam on every keystroke |
| Offline behavior | **Online-only** (not job queue) | CCIP fee changes + slug availability make queuing impractical |
| Pending state persistence | **TanStack Query + IndexedDB** | Survives app restarts via `PersistQueryClientProvider` |

---

## 14. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `greengoods.eth` not owned | **Blocking** | Critical | Must acquire before deployment |
| CCIP message delivery failure | Very Low | Medium | CCIP guarantees delivery; gasLimit 300K is sufficient |
| CCIP delivery delay > 30 min | Low | Low | UI shows pending state with CCIP Explorer link |
| L2 cache / L1 state divergence | Low | Medium | L1 receiver is idempotent; admin can force-sync |
| Must join garden before claiming name | Low | Low | Natural UX flow; any role grant auto-mints protocol hat; owners get it on mint |
| Slug squatting | Low | Low | Hats Protocol gated for gardeners, authorized-only for gardens, admin release |
| CCIP fee increase | Low | Low | Currently ~$0.09; even 10x = $0.90, still viable |
| CCIP Arbitrum→Ethereum lane deprecated | Very Low | High | Chainlink's flagship lane; migrate to alternative if needed |
| Gas spike on L1 (CCIP execution) | Low | Low | gasLimit in message; CCIP handles gas pricing |

---

## 15. Gas & Cost Estimates

| Operation | Chain | Gas | Cost |
|-----------|-------|-----|------|
| `registerGarden()` (L2 sender + CCIP) | Arbitrum | ~200K L2 gas | ~$0.002 + $0.09 CCIP |
| `claimName()` (wallet users) | Arbitrum | ~300K L2 gas | ~$0.003 + $0.09 CCIP |
| `claimNameSponsored()` (passkey users) | Arbitrum | ~300K L2 gas | $0 to user (contract pays CCIP) |
| `_ccipReceive()` (L1 ENS registration) | Ethereum | ~120K L1 gas | Included in CCIP fee |
| `releaseName()` (L2 + CCIP) | Arbitrum | ~150K L2 gas | ~$0.002 + $0.09 CCIP |
| `available()` | Arbitrum | ~5K | Free (view) |
| `mintGarden()` with slug + ENS | Arbitrum | ~800K total | ~$0.005 + $0.09 CCIP |
| L2 Sender deployment | Arbitrum | ~1.5M | ~$0.01 |
| L1 Receiver deployment | Ethereum | ~2M | ~$0.15 |

**Total per garden creation**: ~$0.10 (CCIP fee dominates)
**Total per name claim (wallet)**: ~$0.10 (CCIP fee + L2 gas)
**Total per name claim (passkey)**: $0 to user (contract-sponsored)

---

## 16. Comparison: CCIP vs Alternatives

| Criteria | CCIP (chosen) | Direct L1 (v3) | Native Bridge | Unruggable | Durin |
|----------|--------------|-----------------|---------------|------------|-------|
| UX (operator) | Single tx (Arb) | Two txs (Arb + Eth) | Single tx (Arb) | Single tx (Arb) | Single tx (Arb) |
| Delivery | ~15-20 min | Instant | ~7 days | Instant | Instant |
| Infrastructure | None | None | None | Gateway API | Gateway API |
| Cost per reg | ~$0.10 | ~$0.01 | ~$0.01 | ~$0.01 | ~$0.01 |
| Trust model | Chainlink DON | Direct L1 | Arbitrum fraud proof | Storage proofs | Trusted gateway |
| Complexity | Medium | Low | Low | High | Medium |
| Fully on-chain | Yes | Yes | Yes | No (gateway) | No (gateway) |

**CCIP wins** on the single-transaction UX + no infrastructure requirements. The ~$0.10 cost and ~15-20 minute delay are acceptable tradeoffs.
