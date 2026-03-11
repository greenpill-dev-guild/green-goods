# Web2-Friendly Auth & Universal Gas Sponsorship

**GitHub Issue**: TBD
**Branch**: `feature/web2-auth-sponsorship`
**Status**: ACTIVE
**Created**: 2026-03-10
**Last Updated**: 2026-03-10

## Problem Statement

Green Goods currently has two auth paths:
1. **Passkey** (client) → Kernel smart account → gas sponsored via Pimlico paymaster
2. **Wallet** (admin + client fallback) → raw EOA → user pays own gas, no smart account

Email and social logins are **explicitly disabled** in AppKit config. This creates friction for web2 users who don't have a wallet or aren't comfortable with passkeys. Additionally, wallet users on the client side pay their own gas, creating an inconsistent experience.

## Goals

1. **Enable email & social login** via AppKit's embedded wallets (Google, Apple, Discord, Farcaster, etc.)
2. **Sponsor gas for ALL client-side users** regardless of auth method
3. **Preserve existing passkey flow** (custom Kernel smart accounts work well)
4. **Keep wallet-only for admin** (operators already have wallets)
5. **Minimize architecture disruption** — leverage what AppKit already provides
6. **Support offline-first** — email/social users must queue work submissions offline

---

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Use AppKit's built-in email/social (not custom) | AppKit creates embedded wallets with smart accounts automatically via Pimlico. No new infrastructure needed — just flip config flags. Reown handles OTP verification, social OAuth, wallet custody. |
| 2 | Keep custom passkey flow (don't migrate to AppKit passkeys) | Our Kernel v0.3.1 smart accounts with WebAuthn signers are battle-tested, give us full control over the account address derivation, and already integrate with our Pimlico sponsorship policy. AppKit's embedded wallet would give users a *different* address. Migration risk. |
| 3 | Add `authenticated.embedded` auth mode to XState machine | Email/social users go through AppKit's embedded wallet flow. They get a smart account automatically (managed by Reown). This is a third auth path alongside passkey and wallet. |
| 4 | Sponsor gas via EIP-5792 `sendCalls` with Pimlico ERC-7677 proxy | Unified paymaster URL pattern. Deploy a lightweight ERC-7677 proxy backed by Pimlico. Works for embedded wallets natively, and for external wallets that support EIP-5792. Same sponsorship policy `sp_next_monster_badoon`. |
| 5 | Build modular `TransactionSender` abstraction | Replace ad-hoc `authMode` branching in every mutation hook with a factory-based sender. Three implementations: `PasskeySender`, `EmbeddedSender`, `WalletSender`. |
| 6 | Deferred signing for offline embedded wallet users | AppKit embedded wallets use MPC/server-assisted signing — they CANNOT sign offline. Solution: cache address after first auth, queue transactions in IndexedDB (same job queue pattern), sign when back online. |
| 7 | Do NOT use Reown's paymaster service (beta) | Beta status, no SLA, Arbitrum/Celo support not confirmed. Pimlico is production-proven and already integrated. |
| 8 | EIP-7702 is NOT a dApp-side concern — wallets handle it internally | Investigation confirmed: Kernel is NOT on any wallet's 7702 allowlist. MetaMask only delegates to DeleGator, Coinbase to CoinbaseSmartWallet. But this is irrelevant — wallets that upgrade users to 7702 expose benefits transparently via ERC-5792 `sendCalls`. No separate `EIP7702Sender` needed. |
| 9 | Client login UI: progressive disclosure | Show email/social first (lowest friction), passkey second (returning users), wallet last (power users). |
| 10 | Admin remains wallet-only | Admin operators are gardeners/stewards who already have wallets. No email/social auth for admin. |

---

## Deep Dive: Offline Support for Embedded Wallets

### The Problem

AppKit embedded wallets use **server-assisted key management** (MPC or Reown's custodial signer). Unlike our custom passkey flow (where the P256 credential is stored in localStorage and signing happens entirely client-side via WebAuthn), embedded wallet signing requires a round-trip to Reown's infrastructure.

This means: **Embedded wallet users cannot sign transactions while offline.**

### The Solution: Deferred Signing Pattern

The job queue already supports exactly this pattern — passkey users queue work submissions and process them when online. Embedded wallet users follow the same flow:

```
User submits work (offline or online)
  ↓
Queue to IndexedDB via jobQueue.addJob()
  ├─ Store media blobs in jobImages table
  ├─ Generate offline tx hash (0xoffline_...)
  └─ Request background sync via service worker
  ↓
When online + authenticated:
  jobQueue.flush() / processJob()
  ├─ Passkey: use smartAccountClient.sendTransaction()
  ├─ Embedded: use EIP-5792 sendCalls() with paymaster
  └─ Wallet: use walletClient.sendTransaction()
```

### What DOES Work Offline for Embedded Wallet Users

| Capability | Offline? | Why |
|-----------|---------|-----|
| View cached gardens/work | ✅ | Service worker cache + IndexedDB |
| Draft work submissions | ✅ | Stored in component state / localStorage |
| Queue work submissions | ✅ | IndexedDB job queue (no signing needed) |
| Capture media (photos) | ✅ | Stored as blobs in IndexedDB |
| Sign transactions | ❌ | Requires Reown server round-trip |
| Verify identity (re-auth) | ❌ | Requires OTP/OAuth flow |

### Session Persistence After Initial Auth

After first email/social login, AppKit stores the embedded wallet session. On subsequent app loads:
- **Online**: Session restores automatically (wagmi reconnection)
- **Offline**: The address is cached, but the signer is unavailable. The app can show the user as "authenticated" (we know who they are) but cannot execute transactions until online.

### Implementation for Session Caching

```typescript
// In session.ts — extend AuthMode
export type AuthMode = "passkey" | "wallet" | "embedded" | null;

// Cache embedded address on first auth for offline identity
const EMBEDDED_ADDRESS_KEY = "greengoods_embedded_address";

export function setEmbeddedAddress(address: string): void {
  localStorage.setItem(EMBEDDED_ADDRESS_KEY, address);
}

export function getEmbeddedAddress(): string | null {
  return localStorage.getItem(EMBEDDED_ADDRESS_KEY);
}
```

This lets us show the user's identity and queue transactions even when the signer is unavailable.

---

## Deep Dive: Gas Sponsorship Architecture

### Comparison Matrix

| Approach | Status | Arbitrum | Celo | Sepolia | Wallet Support | Address Preserved? | Code Complexity |
|----------|--------|----------|------|---------|---------------|-------------------|-----------------|
| **Pimlico paymaster (current)** | Production ✅ | ✅ | ✅ | ✅ | Smart accounts only | N/A | Already done |
| **EIP-5792 + Pimlico ERC-7677 proxy** | Production ✅ | ✅ | ✅ | ✅ | Embedded ✅, MetaMask ✅, Coinbase ✅, Rabby ❓ | Yes | Medium |
| **EIP-7702 + Pimlico** | Early adoption ⚠️ | ✅ | ✅ (since July 2025) | ✅ | MetaMask partial, Coinbase partial | ✅ Yes (key benefit) | High |
| **Reown paymaster (beta)** | Beta ❌ | ❓ | ❓ | ❓ | Embedded only (confirmed) | N/A | Low but risky |

### Recommended Layered Strategy

```
Phase 1 (Now): EIP-5792 + Pimlico ERC-7677 Proxy
├─ Passkey users: unchanged (Pimlico paymaster via smartAccountClient)
├─ Embedded users: sendCalls() with paymasterService capability → Pimlico proxy
└─ Wallet users: sendCalls() attempt → fallback to writeContractAsync (user pays)

Phase 2 (When wallets mature): EIP-7702
├─ Wallet users: signAuthorization() → to7702KernelSmartAccount → Pimlico paymaster
├─ Same address, same sponsorship policy
└─ Graceful degradation: if wallet doesn't support 7702, fall back to Phase 1 path
```

### EIP-5792 + ERC-7677 Proxy (Phase 1 Detail)

Deploy a lightweight proxy ([pimlicolabs/erc7677-proxy](https://github.com/pimlicolabs/erc7677-proxy) template) that:
1. Receives ERC-7677 `pm_getPaymasterStubData` / `pm_getPaymasterData` calls
2. Forwards to Pimlico with our API key + sponsorship policy
3. Returns paymaster data for UserOperation signing

```
┌──────────────┐    sendCalls()     ┌──────────────┐   ERC-7677    ┌──────────────┐
│  AppKit /     │ ──────────────────→│  ERC-7677    │ ────────────→ │  Pimlico     │
│  Wallet       │  paymasterService │  Proxy       │              │  Verifying   │
│  (browser)    │  .url             │  (hosted)    │              │  Paymaster   │
└──────────────┘                    └──────────────┘              └──────────────┘
```

**Env var**: `VITE_ERC7677_PROXY_URL` (e.g., `https://paymaster.greengoods.app/api`)

### EIP-7702 (Phase 2 Detail)

```typescript
// How it would work with permissionless.js (already supports this)
import { to7702KernelSmartAccount } from "permissionless/accounts"

// 1. User signs a persistent delegation authorization
const authorization = await walletClient.signAuthorization({
  contractAddress: KERNEL_IMPLEMENTATION, // Must be on wallet's allowlist
  chainId: chain.id,
})

// 2. Create a "7702 Kernel" smart account — same Pimlico paymaster
const account = await to7702KernelSmartAccount({
  client: publicClient,
  owner: eoa7702,
})

const smartAccountClient = createSmartAccountClient({
  account,
  chain,
  paymaster: pimlicoClient,  // ← Same Pimlico infra, same sponsorship policy
  bundlerTransport: http(pimlicoBundlerUrl),
})

// 3. Transactions are now sponsored — user's EOA address is preserved
const hash = await smartAccountClient.sendTransaction({
  to: easAddress,
  data: attestCalldata,
  authorization, // Only needed on first tx (delegation persists)
})
```

**Key constraint**: Wallets (MetaMask, Coinbase) restrict which contracts can be delegation targets. Kernel v0.3.1 must be on their allowlist. This is the primary blocker for Phase 2.

**Chain support**: All three Green Goods chains support EIP-7702 (Arbitrum since Pectra, Celo since July 2025, Sepolia since Pectra).

---

## Deep Dive: Address Continuity & Long-Term Effects

### The Three-Address Problem

Each auth method produces a different address:

| Auth Method | Address Derivation | Persistence |
|------------|-------------------|-------------|
| Passkey | `toKernelSmartAccount({ owners: [webAuthnAccount] })` → deterministic from P256 public key | Permanent (as long as credential exists) |
| Email/Social | AppKit embedded wallet → Reown-managed smart account | Permanent (tied to email/social identity in Reown) |
| Wallet | EOA address from wallet seed phrase | Permanent (user's existing address) |

### What's Tied to Addresses On-Chain

| On-chain Entity | How Address Is Used | Impact of Multi-Address |
|----------------|--------------------|-----------------------|
| **Hats Protocol roles** | `hatId` minted to specific address | Each address needs separate hat assignment |
| **Garden membership** | Operator/gardener indexed by address | Must be a garden operator to submit/approve work |
| **Work attestations** (EAS) | `attester` field = submitter address | Different address = different contribution history |
| **Work approvals** (EAS) | `attester` field = approver address | Approver must hold operator hat at that address |
| **Hypercert claims** | Linked to attestation addresses | Contribution credit tied to auth method |
| **ENS subnames** | Owned by specific address | One ENS per address |
| **Vault shares** | ERC-20 balance at address | Yield split goes to specific address |

### Implications

1. **No cross-auth identity**: If a user signs up with email, then later connects a wallet, they appear as two different users on-chain. There is no on-chain mechanism to link these identities.

2. **Operator onboarding**: Garden stewards must grant operator roles (Hats) to the correct address. If a user authenticates via email and gets address `0xA`, the steward must add `0xA` as an operator — not whatever wallet or passkey address they might also have.

3. **Work history is per-address**: A user's contribution history (attestations) is permanently tied to the address they used when submitting. Switching auth methods means starting a "new" contributor identity.

4. **Acceptable for Phase 1**: Users choose ONE auth method and stick with it. The login UI should make clear that each method creates an independent account. We are NOT building account linking/merging.

### Future: Account Linking (Out of Scope)

If ever needed, options include:
- **ERC-6551 / token-bound accounts**: Single NFT owns multiple accounts
- **On-chain registry**: Smart contract mapping multiple addresses to one identity
- **Off-chain attestation**: EAS attestation linking addresses (social proof)

These are all significant scope expansions and NOT part of this plan.

---

## Architecture: Modular TransactionSender

### Why

Currently, every mutation hook has ad-hoc `authMode` branching:

```typescript
// Current pattern (repeated in 10+ hooks)
if (authMode === "passkey" && smartAccountClient) {
  return smartAccountClient.sendTransaction({ ... })
} else {
  return writeContractAsync({ ... })
}
```

Adding a third mode (embedded) means touching all 10+ hooks. A `TransactionSender` abstraction centralizes this.

### Interface

```typescript
// packages/shared/src/modules/transactions/types.ts

export interface ContractCall {
  address: Address;
  abi: Abi;
  functionName: string;
  args: readonly unknown[];
  value?: bigint;
}

export interface TxResult {
  hash: Hex;
  sponsored: boolean;
}

export interface TransactionSender {
  sendContractCall(call: ContractCall): Promise<TxResult>;
  sendBatch?(calls: ContractCall[]): Promise<TxResult>;
  readonly supportsSponsorship: boolean;
  readonly supportsBatching: boolean;
  readonly authMode: "passkey" | "embedded" | "wallet";
}
```

### Implementations

```
TransactionSender (interface)
├── PasskeySender
│   └── Uses smartAccountClient.sendTransaction()
│   └── Gas: Pimlico paymaster (always sponsored)
│   └── Batching: Kernel supports multi-call UserOps
│
├── EmbeddedSender
│   └── Uses EIP-5792 sendCalls() with paymasterService capability
│   └── Gas: Pimlico via ERC-7677 proxy
│   └── Batching: sendCalls() natively supports multiple calls
│
└── WalletSender
    └── Tries EIP-5792 sendCalls() with paymasterService first
    └── Falls back to writeContractAsync() (user pays gas)
    └── Gas: Sponsored if wallet supports EIP-5792, else user pays
    └── Batching: Only via sendCalls() (EIP-5792)
    └── Note: 7702-upgraded wallets (MetaMask, Coinbase) benefit
        automatically — their own delegation handles batching +
        sponsorship, exposed transparently through sendCalls()
```

### Factory Hook

```typescript
// packages/shared/src/hooks/blockchain/useTransactionSender.ts
// Replaces useContractTxSender with mode-aware factory

export function useTransactionSender(): TransactionSender {
  const { authMode, smartAccountClient } = useUser();
  const { writeContractAsync } = useWriteContract();
  const config = useConfig();

  return useMemo(() => {
    if (authMode === "passkey" && smartAccountClient) {
      return new PasskeySender(smartAccountClient);
    }
    if (authMode === "embedded") {
      return new EmbeddedSender(config, erc7677ProxyUrl);
    }
    return new WalletSender(config, writeContractAsync, erc7677ProxyUrl);
  }, [authMode, smartAccountClient, config, writeContractAsync]);
}
```

### EIP-5792 Considerations

`sendCalls()` returns a **calls identifier**, not a transaction hash. Polling for completion uses `getCallsStatus()`. This changes the receipt-waiting pattern:

```typescript
// EmbeddedSender / WalletSender (EIP-5792 path)
async sendContractCall(call: ContractCall): Promise<TxResult> {
  const callsId = await sendCalls(config, {
    calls: [{ to: call.address, data: encodeFunctionData(...), value: call.value ?? 0n }],
    capabilities: {
      paymasterService: { url: this.erc7677ProxyUrl },
    },
  });

  // Poll for completion (EIP-5792 pattern)
  const status = await waitForCallsStatus(config, { id: callsId });

  if (status.status === "CONFIRMED") {
    return { hash: status.receipts[0].transactionHash, sponsored: true };
  }
  throw new Error(`Transaction failed: ${status.status}`);
}
```

### Job Queue Integration

The job queue's `processJob()` currently receives `{ smartAccountClient }` as context. Extend to accept the `TransactionSender`:

```typescript
// Current
jobQueue.processJob(jobId, { smartAccountClient })

// New
jobQueue.processJob(jobId, { transactionSender: TransactionSender })
```

The sender abstraction means the job queue doesn't care HOW the transaction is sent — it just calls `sender.sendContractCall()`.

### Migration Path for Existing Hooks

| Hook | Current Pattern | Migration |
|------|----------------|-----------|
| `useContractTxSender` | if/else on authMode | Replace with `useTransactionSender()` |
| `useWorkMutation` | Separate `submitWorkDirectly()` / `submitWorkToQueue()` | Queue path uses sender; direct path uses sender |
| `useWorkApproval` | Separate `submitApprovalDirectly()` / `submitApprovalToQueue()` | Same pattern |
| `useBatchWorkApproval` | Separate wallet/passkey batch fns | Sender.sendBatch() |
| `useJoinGarden` | if/else authMode | Use sender |
| `useCreateGardenWorkflow` | wallet-only writeContract | Use sender (enables passkey/embedded garden creation) |
| Other mutation hooks (10+) | Use `useContractTxSender` | Just swap import |

---

## Requirements Coverage

| Requirement | Planned Step | Status |
|-------------|--------------|--------|
| Email login option | Step 1, 3 | ✅ |
| Social login (Google, Apple, Discord, etc.) | Step 1, 3 | ✅ |
| Gas sponsorship for email/social users | Step 2, 4 | ✅ |
| Preserve existing passkey flow | Step 5 | ✅ |
| Updated client login UI | Step 3 | ✅ |
| Auth state machine update | Step 5 | ✅ |
| Modular transaction sender | Step 4 | ✅ |
| Offline queue for embedded users | Step 6 | ✅ |
| Admin remains wallet-only | Step 8 | ✅ |
| Gas sponsorship for wallet users (EIP-5792 — includes 7702-upgraded wallets) | Step 4 | ✅ |
| Address continuity documentation | Step 9 | ✅ |

## CLAUDE.md Compliance

- [x] Hooks in shared package (all auth hooks already in shared)
- [ ] i18n for new UI strings (login button labels)
- [x] Deployment artifacts for addresses (no new contracts)
- [x] Single .env at root (new env vars go to root .env)
- [x] Barrel imports from @green-goods/shared
- [x] Error handling via logger (not console.log)

---

## Impact Analysis

### Files to Modify

- `packages/shared/src/config/appkit.ts` — Enable email + socials, connectMethodsOrder
- `packages/shared/src/workflows/authMachine.ts` — Add `authenticated.embedded` state
- `packages/shared/src/workflows/authServices.ts` — Embedded wallet session handling
- `packages/shared/src/providers/Auth.tsx` — Detect embedded vs external wallet connections
- `packages/shared/src/hooks/auth/useAuth.ts` — Expose `authMode: "embedded"`
- `packages/shared/src/hooks/auth/useUser.ts` — Map embedded wallet identity
- `packages/shared/src/hooks/auth/usePrimaryAddress.ts` — Handle embedded address
- `packages/shared/src/modules/auth/session.ts` — Add "embedded" auth mode + address cache
- `packages/shared/src/hooks/blockchain/useContractTxSender.ts` — Replace with `useTransactionSender`
- `packages/shared/src/hooks/work/useWorkMutation.ts` — Use TransactionSender
- `packages/shared/src/hooks/work/useWorkApproval.ts` — Use TransactionSender
- `packages/shared/src/hooks/work/useBatchWorkApproval.ts` — Use TransactionSender
- `packages/shared/src/modules/job-queue/index.ts` — Accept TransactionSender in processJob
- `packages/client/src/views/Login/index.tsx` — Progressive disclosure UI
- `.env.schema` — Add `VITE_ERC7677_PROXY_URL`
- `packages/shared/src/vite-env.d.ts` — Add env var type

### Files to Create

- `packages/shared/src/modules/transactions/types.ts` — TransactionSender interface
- `packages/shared/src/modules/transactions/passkey-sender.ts` — Kernel smart account sender
- `packages/shared/src/modules/transactions/embedded-sender.ts` — EIP-5792 sender
- `packages/shared/src/modules/transactions/wallet-sender.ts` — Wallet sender with EIP-5792 fallback
- `packages/shared/src/modules/transactions/factory.ts` — Sender factory
- `packages/shared/src/hooks/blockchain/useTransactionSender.ts` — Hook wrapper
- ERC-7677 proxy deployment (separate infra repo or serverless function)

---

## Test Strategy

- **Unit tests**: TransactionSender implementations (mock clients)
- **Unit tests**: Auth state machine transitions for `authenticated.embedded`
- **Unit tests**: Factory returns correct sender for each auth mode
- **Integration tests**: Job queue processes jobs with each sender type
- **E2E tests**: Full email login → work submission flow (staging)
- **Manual testing**: Social login (Google, Apple), offline queue, re-auth

---

## Implementation Steps

### Step 1: Enable AppKit Email & Social Login
**Files**: `packages/shared/src/config/appkit.ts`
**Details**:
- Change `email: false` → `email: true`
- Change `socials: false` → `socials: ['google', 'apple', 'discord', 'farcaster', 'x', 'github']`
- Add `connectMethodsOrder: ['email', 'social', 'wallet']` to features
- Keep `includeWalletIds` filter (only affects external wallet section)
- Verify WalletConnect project has email/social enabled in Reown dashboard

**Verification**: `appKit.open()` shows email input + social buttons

### Step 2: Deploy ERC-7677 Paymaster Proxy
**Files**: New infra (serverless function or edge worker)
**Details**:
- Clone [pimlicolabs/erc7677-proxy](https://github.com/pimlicolabs/erc7677-proxy) template
- Configure with `PIMLICO_API_KEY` and `SPONSORSHIP_POLICY_ID`
- Support all 3 chains (Arbitrum, Celo, Sepolia) via chain-aware routing
- Deploy to stable URL (e.g., `https://paymaster.greengoods.app/api`)
- Add `VITE_ERC7677_PROXY_URL` to `.env.schema` and `vite-env.d.ts`
- Add CORS for `greengoods.app` origins

**Verification**: Proxy responds to `pm_getPaymasterStubData` requests

### Step 3: Build TransactionSender Abstraction
**Files**: New files in `packages/shared/src/modules/transactions/`
**Details**:
- Create `types.ts` with `ContractCall`, `TxResult`, `TransactionSender` interfaces
- Implement `PasskeySender` (extract from current `useContractTxSender` passkey branch)
- Implement `EmbeddedSender` (EIP-5792 `sendCalls` with `paymasterService` capability)
- Implement `WalletSender` (try EIP-5792 → fallback to `writeContractAsync`)
- Create factory function
- Create `useTransactionSender` hook
- **Deprecate** `useContractTxSender` (keep as thin wrapper for backward compat during migration)

**Verification**: Unit tests pass for all three sender implementations

### Step 4: Migrate Mutation Hooks to TransactionSender
**Files**: `useWorkMutation.ts`, `useWorkApproval.ts`, `useBatchWorkApproval.ts`, `useContractTxSender.ts`
**Details**:
- Replace authMode branching with `useTransactionSender()` calls
- Update job queue `processJob()` to accept `TransactionSender` context
- Update `passkey-submission.ts` to use `PasskeySender`
- Update `wallet-submission/submit-work.ts` to use `WalletSender`
- Handle EIP-5792 `callsId` → receipt polling pattern
- Ensure offline queue works with all three senders (queue stores params, sender processes when online)

**Verification**: Existing passkey + wallet work submission still works. Work submission via embedded sender with gas sponsorship works.

### Step 5: Update Auth State Machine for Embedded Wallets
**Files**: `authMachine.ts`, `authServices.ts`, `Auth.tsx`, `session.ts`
**Details**:
- Add `authenticated.embedded` child state in machine
- Detect embedded wallet via wagmi connector type (AppKit embedded wallets use a specific connector ID)
- In `Auth.tsx`: when `EXTERNAL_WALLET_CONNECTED` fires, check if connector is AppKit embedded
  - If embedded → transition to `authenticated.embedded` (not `authenticated.wallet`)
  - If external → transition to `authenticated.wallet` (existing behavior)
- Store `authMode: "embedded"` + cache embedded address in localStorage
- Session restore: if `authMode === "embedded"`, wait for AppKit session reconnection
  - If offline: show user as "authenticated" with cached address but mark signer as unavailable
  - Queue operations still work (deferred signing)

**Verification**: Email login → `authMode === "embedded"`. Passkey login → `authMode === "passkey"`. Wallet connect → `authMode === "wallet"`.

### Step 6: Offline Queue Integration for Embedded Users
**Files**: `job-queue/index.ts`, `work-submission.ts`
**Details**:
- Embedded wallet users follow the passkey queue pattern (always queue, process when online)
- On `processJob()`: check if embedded signer is available (online + AppKit session active)
- If signer unavailable: skip job, schedule retry (exponential backoff already exists)
- Add `"embedded"` to job metadata for analytics
- Service worker background sync triggers `flush()` on reconnect (already wired)

**Verification**: Submit work offline as embedded user → queue persists → processes on reconnect

### Step 7: Update Client Login UI
**Files**: `packages/client/src/views/Login/index.tsx`
**Details**:
- Progressive disclosure layout:
  1. **Email/Social section**: "Sign in with email" input + social buttons (triggers `appKit.open()`)
  2. **Passkey section**: "Login with Passkey" / "Create Account" (existing custom flow)
  3. **Wallet section**: "Connect Wallet" (triggers `appKit.open()` with wallet tab)
- OR: Use AppKit's built-in modal which already shows email/social/wallet tabs when features are enabled
- Update i18n strings
- Clear messaging: each auth method creates an independent account

**Verification**: All three auth options visible with clear hierarchy

### Step 8: Admin Isolation
**Files**: `packages/admin/src/` (if AppKit is shared)
**Details**:
- Option A: Admin uses a separate `createAppKit()` call with `email: false, socials: false`
- Option B: Admin's `RequireAuth` checks `authMode !== "wallet"` and shows "Wallet required" message
- Verify AppKit is singleton — if shared, admin may see email/social in modal
  - If so: admin needs conditional AppKit config (may need separate initialization)

**Verification**: Admin login shows only wallet connection

### Step 9: Documentation & Address Continuity Messaging
**Files**: Client login UI, docs
**Details**:
- Add clear messaging on login page: "Each sign-in method creates a separate account"
- Document in user guide that passkey/email/wallet produce different addresses
- Add tooltip or help text explaining this is by design (blockchain identity = address)

**Verification**: Users understand auth method choice before signing in

---

## EIP-7702 Investigation (Resolved)

### Findings (2026-03-10)

**Kernel is NOT on any wallet's EIP-7702 delegation allowlist.** Each wallet vendor exclusively uses its own implementation:

| Wallet | Delegation Target | Kernel Allowed? |
|--------|-------------------|-----------------|
| MetaMask | Own `DeleGator` (`0x63c0...32b`) | No — "We only support our own Delegator" |
| Coinbase | Own `CoinbaseSmartWallet` via `EIP7702Proxy` | No — validator is Coinbase-specific |
| Rainbow | Own implementation | No |
| Rabby | No 7702 support yet | N/A |

**This is by design.** From Biconomy: *"EIP-7702 is controlled by wallets, not applications."* Over 97% of early 7702 delegations were linked to scams. Wallets reject `signAuthorization` from dApps for unknown contracts.

**No cross-wallet delegation registry exists.**

### Why This Doesn't Block Us

The `WalletSender` (ERC-5792 `sendCalls`) already covers the 7702-upgraded wallet case:
- When MetaMask users upgrade to 7702 smart accounts, they gain batching + paymaster capabilities
- These are exposed transparently via `wallet_sendCalls` — the wallet handles delegation internally
- Green Goods calls `sendCalls()` with `paymasterService` capability → wallet routes through its own 7702 delegation
- **No separate `EIP7702Sender` class needed** — `WalletSender` handles it automatically

### Where `to7702KernelSmartAccount` IS useful
- Embedded wallet providers (Privy, Dynamic, Turnkey) where the *app* controls the signer
- Not relevant for Green Goods since we use AppKit's embedded wallets (Reown manages the signer)
- Available in permissionless.js v0.2.24+ (we have v0.2.57)

### Sources
- [MetaMask Smart Account docs](https://support.metamask.io/configure/accounts/switch-to-or-revert-from-a-smart-account)
- [Coinbase EIP-7702 Proxy](https://github.com/base/eip-7702-proxy)
- [Biconomy EIP-7702 Guide for Apps](https://blog.biconomy.io/a-comprehensive-eip-7702-guide-for-apps/)
- [Pimlico EIP-7702 Guide](https://docs.pimlico.io/guides/eip7702)
- [ZeroDev 7702 Adoption Blog](https://docs.zerodev.app/blog/7702-adoption)

---

## Validation

- [ ] TypeScript passes (`bun build`)
- [ ] Tests pass (`bun run test`)
- [ ] Lint passes (`bun lint`)
- [ ] Format passes (`bun format`)
- [ ] Email login works on staging
- [ ] Social login works (Google, Apple minimum)
- [ ] Passkey flow unchanged
- [ ] Admin wallet-only flow unchanged
- [ ] Gas sponsored for email/social users (ERC-7677 proxy)
- [ ] Gas sponsored for wallet users with EIP-5792 support (MetaMask, Coinbase)
- [ ] Graceful fallback for wallets without EIP-5792 (user pays gas)
- [ ] 7702-upgraded wallet users benefit automatically via sendCalls
- [ ] Offline queue works for embedded wallet users
- [ ] Session restore works for all three auth modes
- [ ] Address continuity documented in UI
