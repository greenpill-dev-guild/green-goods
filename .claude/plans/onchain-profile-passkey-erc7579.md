# On-Chain ENS Profile + ERC-7579 Multi-Passkey

**Status:** Planned
**Created:** 2026-03-08
**Branch:** TBD

## Overview

Two interconnected features that transform Green Goods' fragile single-device passkey setup into a robust, recoverable identity system:

1. **ENS Profile Management** — L1 ENS text records for persistent identity (avatar, display name, bio) via the existing mainnet resolver, plus L2 slug-based username persistence
2. **ERC-7579 Multi-Passkey** — Users add passkeys on additional devices over time as recovery mechanism, with a fully on-chain cross-device proposal contract

**Recovery model:** Multi-passkey only. No ZK Email, no session keys, no Pimlico passkey server. Fully on-chain.

## Decisions Made

- L1 ENS text records (not L2 profile storage) — ecosystem interop with any ENS-aware app
- 48-hour timelock — not currently used (no ZK Email), but available if recovery modules added later
- Recovery module during onboarding — prompt to add backup passkey after initial registration
- No session keys — just ability to add more passkeys to Kernel account over time
- Cross-device passkey: fully on-chain proposal contract, no Pimlico passkey server relay

## Current State

### Deployment Inventory

| Contract | Chain | Address | Status |
|---|---|---|---|
| `GreenGoodsENSReceiver` | Mainnet (1) | `0x80a906c175ea875af8a2afca8f91f60b201dc824` | Deployed |
| `GreenGoodsENS` (L2) | Arbitrum (42161) | `0x4fAD8Db8e04005884D484eC730aDae10d7A2e491` | Deployed |
| ENS Public Resolver | Mainnet | `0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63` | Mainnet infra |
| ENS Registry | Mainnet | `0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e` | Mainnet infra |
| Kernel v0.3.1 accounts | Arbitrum | per-user | ERC-7579 capable |

### Current Auth Stack

- **Passkey creation:** `createWebAuthnCredential()` via viem (`passkeyServer.ts`)
- **Smart account:** Kernel v0.3.1, EntryPoint v0.7 (`authServices.ts`)
- **Bundler/Paymaster:** Pimlico (`permissionless@0.2.57`, `pimlico.ts`)
- **Auth state machine:** XState 5 (`authMachine.ts`)
- **Credential storage:** localStorage only (fragile)
- **RP ID:** `greengoods.app` (hardcoded, `passkeyServer.ts:29`)
- **Recovery:** None
- **ERC-7579 modules:** None installed (APIs available in permissionless.js)

### Available permissionless.js ERC-7579 APIs

All confirmed present in `permissionless@0.2.57`:
- `installModule(client, { type: "validator", address, context })`
- `isModuleInstalled(client, { type, address, context })`
- `uninstallModule(client, { type, address, context })`
- `supportsModule(client, { type })` — verify Kernel supports module type
- Module types: `"validator" | "executor" | "fallback" | "hook"`

### ENS Contract Capabilities

- `IENSResolver` interface already has `setText(node, key, value)` and `text(node, key)` (`IENS.sol:29,35`)
- ENSReceiver owns each subnode (via `setSubnodeOwner` in `_setENSRecords`) — has permission to call `setText`
- CCIP message protocol: action 0 = register, action 1 = release — extensible with action 2 for text records
- `ownerToSlug[address]` exists on both L2 (`ENS.sol:50`) and L1 (`ENSReceiver.sol:42`) for reverse lookup

## Phases

### Phase 1A — Username Persistence via On-Chain Slug Lookup

**Effort:** 1-2 days | **Deploy:** No

Use existing `ownerToSlug[address]` mapping on L2 to resolve username after passkey re-auth instead of relying on localStorage.

**Changes:**

`packages/shared/src/utils/blockchain/ens.ts` — new function:
```typescript
export async function resolveGreenGoodsSlug(address: Address, chainId: number): Promise<string | null>
// Reads GreenGoodsENS.ownerToSlug(address) on Arbitrum
```

`packages/shared/src/workflows/authServices.ts` — in `restoreSessionService` and `authenticatePasskeyService`:
- After `buildSmartAccountFromCredential`, call `resolveGreenGoodsSlug(address, chainId)`
- If slug found → use as username, update localStorage cache
- If offline or no slug → fall back to localStorage

localStorage becomes a cache, chain becomes source of truth.

---

### Phase 1B — L1 ENS Text Records for Profile

**Effort:** 5-6 days | **Deploy:** Yes (both L1 receiver and L2 sender redeploy)

Extend CCIP message protocol with action 2 for batch text record updates. Profile updates (display name, avatar, bio) are rare operations — 15-20 min CCIP delay is acceptable.

**Standard ENS text record keys** (ENSIP-5):

| Key | Purpose | Example |
|-----|---------|---------|
| `display` | Display name | "Alice" |
| `avatar` | Avatar URL/CID | "ipfs://Qm..." |
| `description` | Bio | "Regenerative gardener in São Paulo" |
| `url` | Website | "https://greengoods.app/alice" |

**Contract changes:**

`packages/contracts/src/registries/ENS.sol` (L2 sender) — add:
- `setTextRecords(slug, keys[], values[])` — user-funded CCIP
- `setTextRecordsSponsored(slug, keys[], values[])` — contract-funded for passkey users
- Validation: caller must own the slug (`slugOwner[keccak256(slug)] == msg.sender`)

`packages/contracts/src/registries/ENSReceiver.sol` (L1 receiver) — extend:
- `_ccipReceive`: add `action == 2` handler with decode `(uint8, string, string[], string[])`
- `_setTextRecords(slug, keys, values, messageId)` — iterates keys/values, calls `IENSResolver.setText(node, key, value)` with try/catch per field
- Enhance `_setENSRecords` to set initial `display` text record during name registration

**Frontend:**

- `packages/shared/src/hooks/ens/useENSProfile.ts` — read text records from mainnet resolver via `text(node, key)`
- `packages/shared/src/hooks/ens/useSetENSProfile.ts` — mutation calling `setTextRecords`/`setTextRecordsSponsored` (dual-path like `useENSClaim`)
- `packages/client/src/views/Profile/ProfileEditor.tsx` — profile editing UI

---

### Phase 2A — Module Infrastructure Layer

**Effort:** 2 days | **Deploy:** No

**`packages/shared/src/config/modules.ts`** — ERC-7579 module addresses:
```typescript
export const ERC7579_MODULES = {
  webAuthnValidator: "0x..." as Address, // Rhinestone WebAuthn Validator on Arbitrum
} as const;
```

**`packages/shared/src/modules/account/module-manager.ts`** — wrappers:
- `installPasskeyValidator(client, publicKey, credentialId)` → `installModule` with validator type
- `isPasskeyValidatorInstalled(client, publicKey)` → `isModuleInstalled`
- `removePasskeyValidator(client, publicKey)` → `uninstallModule` (with safety: can't remove last signer)
- `getInstalledValidatorCount(client)` → count

---

### Phase 2B — Add Passkey (Same Device)

**Effort:** 3-4 days | **Deploy:** No

`packages/shared/src/hooks/account/useAddPasskey.ts` — mutation:
1. `createWebAuthnCredential({ name: "${label} (recovery)", rp: ... })`
2. Encode public key + credential ID as module context
3. `installModule(client, { type: "validator", address: webAuthnValidator, context })`

`packages/shared/src/hooks/account/usePasskeys.ts` — query installed passkey validators.

`packages/client/src/views/Profile/SecuritySection.tsx` — UI:
- List registered passkeys with device labels
- "Add passkey" button → biometric prompt → module installation
- "Remove passkey" → safety check (can't remove last) → uninstall module

---

### Phase 2C — On-Chain Cross-Device Passkey Proposals

**Effort:** 5-6 days | **Deploy:** Yes (PasskeyProposals contract on Arbitrum)

Fully on-chain solution — no server relay. A new device proposes its public key on-chain; the primary device approves.

**New contract: `packages/contracts/src/accounts/PasskeyProposals.sol`**

```solidity
contract PasskeyProposals {
    struct Proposal {
        bytes publicKey;       // P256 public key from new passkey
        string credentialId;   // WebAuthn credential ID (base64url)
        string label;          // Device label ("iPhone 16", "Laptop")
        address proposedBy;    // Throwaway smart account from new device
        uint256 timestamp;
        bool consumed;         // True after approve/reject
    }

    mapping(address account => Proposal[]) public proposals;

    function propose(address targetAccount, bytes calldata publicKey, string calldata credentialId, string calldata label) external;
    function consumeProposal(uint256 index, bool approved) external; // Only callable by target account
    function getPendingProposals(address account) external view returns (Proposal[] memory);
    function proposalCount(address account) external view returns (uint256);
}
```

**Cross-device flow:**

```
Device B (new)                           Device A (primary)
─────────────                            ─────────────────
1. User enters slug "alice"
2. Resolve slugOwner → 0xABC
3. Create new passkey (biometric)
4. Derive temporary smart account
   (gas-sponsored by Pimlico)
5. Call propose(0xABC, pubKey,
   credentialId, "Laptop")
                                         6. See notification: "New device
                                            'Laptop' wants to join"
                                         7. Verify out-of-band ("Is this you?")
                                         8. Approve: consumeProposal + installModule
                                            (batched UserOperation)

                                         9. Done — Device B can now sign
                                            for the same smart account
```

Step 4: Device B's new passkey deterministically derives a temporary Kernel account. Pimlico sponsors it (policy `sp_next_monster_badoon` sponsors any Kernel account). User never sees this throwaway account.

**Frontend hooks:**
- `usePasskeyProposals()` — query pending proposals (poll every 30s)
- `useProposePasskey()` — Device B: resolve slug → create passkey → submit proposal
- `useApprovePasskey()` — Device A: consumeProposal + installModule in one UserOp

**New views:**
- `packages/client/src/views/Auth/AddDevice.tsx` — "Join existing account" flow (Device B)
- `packages/client/src/views/Profile/SecuritySection.tsx` — pending proposals with approve/reject (Device A)

---

### Phase 3 — Migration for Existing Accounts

**Effort:** 2 days | **Deploy:** No

`packages/shared/src/hooks/account/useAccountHealth.ts`:
- Check how many passkey validators are installed
- If only 1 (built-in owner) → `needsMigration: true`

**UX:** Persistent but dismissible banner after login:
> "Your account has only one passkey. Add a backup passkey from another device to protect against device loss."

---

## Execution Order

```
Phase 1A ─── Slug lookup on restore ────────── [1-2 days, no deploy]
    │
    ├── Phase 2A ─── Module infrastructure ──── [2 days, no deploy]
    │       │
    │       └── Phase 2B ─── Same-device add ── [3-4 days, no deploy]
    │               │
    │               ├── Phase 2C ─── On-chain proposals ── [5-6 days, deploy]
    │               │
    │               └── Phase 3 ── Migration prompt ────── [2 days, no deploy]
    │
    └── Phase 1B ─── L1 ENS text records ──────────────── [5-6 days, deploy]
```

Phases 1B and 2C can run **in parallel** (different contracts).

**Total: ~20-22 days across both workstreams.**

## Pre-Work Checklist

Before any implementation:

- [ ] **Verify WebAuthn Validator module on Arbitrum** — check [Rhinestone module registry](https://erc7579.com/modules) for deployment. If not deployed, deploy ourselves (permissionless CREATE2)
- [ ] **Verify Kernel ERC-7579 support** — call `supportsModule(1)` on existing Kernel account
- [ ] **Test `installModule` on Sepolia** — install dummy validator on test Kernel account to validate full permissionless.js flow

## File Map

```
packages/contracts/
├── src/registries/
│   ├── ENS.sol                    ← Phase 1B (add setTextRecords, setTextRecordsSponsored)
│   └── ENSReceiver.sol            ← Phase 1B (add action==2, _setTextRecords)
├── src/accounts/
│   └── PasskeyProposals.sol       ← Phase 2C (NEW)
└── test/
    ├── ENSTextRecords.t.sol       ← Phase 1B (NEW)
    └── PasskeyProposals.t.sol     ← Phase 2C (NEW)

packages/shared/
├── src/config/
│   └── modules.ts                 ← Phase 2A (NEW)
├── src/modules/account/
│   └── module-manager.ts          ← Phase 2A (NEW)
├── src/hooks/
│   ├── ens/
│   │   ├── useENSProfile.ts       ← Phase 1B (NEW)
│   │   └── useSetENSProfile.ts    ← Phase 1B (NEW)
│   └── account/
│       ├── useAddPasskey.ts        ← Phase 2B (NEW)
│       ├── usePasskeys.ts          ← Phase 2B (NEW)
│       ├── usePasskeyProposals.ts  ← Phase 2C (NEW)
│       ├── useProposePasskey.ts    ← Phase 2C (NEW)
│       ├── useApprovePasskey.ts    ← Phase 2C (NEW)
│       └── useAccountHealth.ts     ← Phase 3  (NEW)
├── src/utils/blockchain/
│   └── ens.ts                     ← Phase 1A (add resolveGreenGoodsSlug)
└── src/workflows/
    └── authServices.ts            ← Phase 1A (slug lookup on restore)

packages/client/
└── src/views/
    ├── Profile/
    │   ├── SecuritySection.tsx     ← Phase 2B (NEW)
    │   └── ProfileEditor.tsx       ← Phase 1B (NEW)
    └── Auth/
        └── AddDevice.tsx           ← Phase 2C (NEW)
```

## Key Design Notes

### P256 Public Keys Are Safe to Publish On-Chain
The security comes from the private key in the device secure enclave, which never leaves the device. The PasskeyProposals contract safely stores public keys — anyone can read them, but only the secure enclave can produce valid signatures.

### ENS Is the Identity Bridge for Recovery
Without the slug→address mapping, a user who loses their device would need to remember their 42-character hex address. With ENS, they type `alice` on the new device and the app resolves everything via `slugOwner[keccak256("alice")]`.

### The "Throwaway Account" Pattern
Device B's new passkey deterministically derives a Kernel smart account address (same CREATE2 factory). This temporary account exists solely to submit the on-chain proposal. Pimlico sponsors it gaslessly. The user never manages this address — it's an implementation detail.

### L1 Text Records: Rare Writes, Universal Reads
Profile updates via CCIP take 15-20 min. This is acceptable because profile changes are rare (set once, update occasionally). The payoff: any ENS-aware app (Etherscan, Rainbow, ENS app) natively displays the profile for `alice.greengoods.eth`.

### Module Safety Invariant
Cannot remove last signer. `removePasskeyValidator` must check that at least one other validator (or the built-in owner) remains before uninstalling.
