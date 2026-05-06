---
name: web3
user-invocable: false
description: Web3 frontend patterns - Wagmi, Viem, wallet/passkey auth, transaction lifecycle, contract interactions. Use for wallet flows, chain switching, contract reads/writes, and account abstraction.
version: "1.0.0"
status: active
packages: ["shared", "client", "admin"]
dependencies: []
last_updated: "2026-02-19"
last_verified: "2026-02-19"
---

# Web3 Skill

Frontend Web3 integration guide: wallet connections, passkey accounts, contract interactions, and transaction lifecycle.

---

## Activation

When invoked:
- Identify the auth mode (wallet EOA vs passkey smart account) before writing code.
- Import contract ABIs from deployment artifacts, never hardcode addresses.
- Use `Address` type from `@green-goods/shared` for all Ethereum addresses.
- Check `.claude/context/shared.md` for full hook patterns.

## Part 1: Dual Authentication

### Auth Architecture

Green Goods supports two auth modes via `useAuth()`:

| Mode | Provider | Account Type | Use Case |
|------|----------|-------------|----------|
| **Wallet** | Reown AppKit + Wagmi | EOA (externally owned) | Desktop users, existing wallets |
| **Passkey** | Pimlico | Smart Account (ERC-4337) | Mobile users, no wallet needed |

### Auth Hook Usage

```typescript
import { useAuth } from "@green-goods/shared";

function AuthGate() {
  const {
    authMode,          // "wallet" | "passkey" | null
    eoaAddress,        // Address | undefined (wallet mode)
    smartAccountAddress, // Address | undefined (passkey mode)
    smartAccountClient,  // SmartAccountClient | undefined
    isAuthenticated,
    loginWithWallet,
    loginWithPasskey,
    signOut,
  } = useAuth();

  // Get the active address regardless of mode
  const address = eoaAddress ?? smartAccountAddress;
}
```

### Auth-Aware Contract Calls

Always branch on `authMode` — wallet uses `getWalletClient()`, passkey uses `smartAccountClient`:

```typescript
import { getWalletClient } from "@wagmi/core";
import { useAuth } from "@green-goods/shared";

async function executeTransaction(config: WagmiConfig, args: ContractArgs) {
  const { authMode, smartAccountClient } = useAuth();

  if (authMode === "wallet") {
    const walletClient = await getWalletClient(config);
    const hash = await walletClient.writeContract(args);
    return waitForTransactionReceipt(config, { hash });
  } else if (authMode === "passkey") {
    const hash = await smartAccountClient.writeContract(args);
    return waitForTransactionReceipt(config, { hash });
  }
}
```

## Part 2: Contract Interactions

### Reading Contract State

```typescript
import { readContract } from "@wagmi/core";
import { GardenAccountABI } from "@green-goods/shared";

// Direct read (non-reactive)
const isOpen = await readContract(wagmiConfig, {
  address: gardenAddress as `0x${string}`,
  abi: GardenAccountABI,
  functionName: "openJoining",
});
```

### Writing to Contracts

Use the wallet submission module for full lifecycle management via the job queue:

```typescript
// packages/shared/src/modules/work/wallet-submission.ts
import { useJobQueue, type JobKind as QueueJobKind } from "@green-goods/shared";

const JobKind = {
  WORK_SUBMISSION: "work" as QueueJobKind,
};

function useSubmitWork() {
  const { addJob } = useJobQueue();

  async function submit({
    gardenAddress,
    actionUID,
    data,
  }: {
    gardenAddress: Address;
    actionUID: number;
    data: WorkInput;
  }) {
    await addJob(JobKind.WORK_SUBMISSION, {
      payload: {
        gardenAddress,
        actionUID,
        data,
      },
      maxRetries: 5,
    });
  }
}
```

The queued job owns the full lifecycle: validation → IPFS upload → tx broadcast → indexer sync. This keeps submissions offline-safe and retryable.

### Transaction Simulation

**Always simulate before sending real transactions:**

```typescript
import { simulateWorkSubmission } from "@green-goods/shared";

// Validates the transaction will succeed before spending gas
const simulation = await simulateWorkSubmission({
  gardenAddress,
  actionUID,
  data,
  config: wagmiConfig,
});

if (!simulation.success) {
  toast.error(simulation.error);
  return;
}
```

### Contract Address Resolution

```typescript
// ✅ ALWAYS: Import from deployment artifacts
import deployment from "../../../contracts/deployments/11155111-latest.json";
const gardenToken = deployment.gardenToken;

// ✅ ALSO: Use shared utilities
import { getContractAddresses } from "@green-goods/shared";
const addresses = getContractAddresses(chainId);

// ❌ NEVER: Hardcode addresses
const GARDEN_TOKEN = "0x1234...";
```

### ABI Imports

```typescript
// ✅ ALWAYS: Import from shared barrel
import {
  GardenAccountABI,
  GardenTokenABI,
  ActionRegistryABI,
} from "@green-goods/shared";

// ❌ NEVER: Import from contract output directly
import abi from "../../../contracts/out/Garden.sol/GardenAccount.json";
```

## Part 3: Chain Configuration

### Current Chain Detection

```typescript
import { useCurrentChain } from "@green-goods/shared";

function ChainInfo() {
  const chain = useCurrentChain();
  // chain includes: id, name, rpcUrls, blockExplorers
}
```

### Supported Networks

| Chain ID | Network | Usage |
|----------|---------|-------|
| `11155111` | Sepolia | Default testnet |
| `42161` | Arbitrum One | Production |
| `42220` | Celo | Production |
| `31337` | Localhost (Anvil) | Local development |

### EAS Configuration

```typescript
import { getEASConfig } from "@green-goods/shared";

const easConfig = getEASConfig(chainId);
// Returns: { address, schemaRegistry, graphqlUrl }
```

## Part 4: Transaction Lifecycle

### Stage Tracking

Green Goods uses a stage-based progress model for transactions:

```text
┌──────────┐   ┌───────────┐   ┌────────────┐   ┌─────────┐   ┌──────────┐
│ Validating│──→│ Uploading │──→│ Confirming │──→│ Syncing │──→│ Complete │
└──────────┘   └───────────┘   └────────────┘   └─────────┘   └──────────┘
  Simulate       IPFS media     Tx broadcast     Wait for       Done
  contract       upload         + receipt        indexer
```

### Error Handling

```typescript
import { parseContractError, USER_FRIENDLY_ERRORS } from "@green-goods/shared";

try {
  await contractCall();
} catch (error) {
  const parsed = parseContractError(error);
  const message = USER_FRIENDLY_ERRORS[parsed.name] || "Transaction failed";
  toast.error(message);
}
```

### Common Contract Errors

| Error | Cause | User Message |
|-------|-------|-------------|
| `UserRejectedRequestError` | User cancelled in wallet | "Transaction cancelled" |
| `InsufficientFundsError` | Not enough ETH for gas | "Insufficient funds for gas" |
| `ContractFunctionRevertedError` | Contract logic rejection | Parse custom error name |
| `TransactionReceiptNotFoundError` | Tx dropped from mempool | "Transaction lost, please retry" |

## Part 5: Hats Protocol Integration

Green Goods uses Hats Protocol for role-based access control on-chain:

```typescript
import { gardenHats } from "@green-goods/shared";

// Check role membership
const isOperator = await gardenHats.isOperator(gardenAddress, userAddress);
const isGardener = await gardenHats.isGardener(gardenAddress, userAddress);

// Role hierarchy: Top Hat → Garden Hat → Operator Hat → Gardener Hat
```

## Part 6: Chain Operations

### Chain Switching

Green Goods is single-chain per deployment (`VITE_CHAIN_ID`), but users may connect on the wrong chain:

```typescript
import { useSwitchChain } from "wagmi";
import { useCurrentChain } from "@green-goods/shared";

function ChainGuard({ children }: { children: React.ReactNode }) {
  const expectedChain = useCurrentChain();
  const { chainId } = useAccount();
  const { switchChain, isPending } = useSwitchChain();

  if (chainId !== expectedChain.id) {
    return (
      <div>
        <p>Please switch to {expectedChain.name}</p>
        <button
          onClick={() => switchChain({ chainId: expectedChain.id })}
          disabled={isPending}
        >
          {isPending ? "Switching..." : `Switch to ${expectedChain.name}`}
        </button>
      </div>
    );
  }

  return children;
}
```

### Gas Estimation

```typescript
import { estimateGas } from "@wagmi/core";

async function estimateWorkSubmission(config: WagmiConfig, args: ContractArgs) {
  try {
    const gasEstimate = await estimateGas(config, {
      to: args.address,
      data: encodeFunctionData({
        abi: args.abi,
        functionName: args.functionName,
        args: args.args,
      }),
    });

    // Add 20% buffer for safety
    return (gasEstimate * 120n) / 100n;
  } catch (error) {
    const parsed = parseContractError(error);
    throw new Error(`Gas estimation failed: ${parsed.name}`);
  }
}

// Show gas cost to user before confirming
function GasIndicator({ gasEstimate }: { gasEstimate: bigint }) {
  const { data: gasPrice } = useGasPrice();
  const costWei = gasEstimate * (gasPrice ?? 0n);
  const costEth = formatEther(costWei);

  return (
    <span className="text-sm text-muted-foreground">
      Estimated gas: ~{Number(costEth).toFixed(6)} ETH
    </span>
  );
}
```

### Event Watching

```typescript
import { watchContractEvent } from "@wagmi/core";

// Watch for new work submissions in real-time
function useWorkEvents(gardenAddress: Address) {
  useEffect(() => {
    const unwatch = watchContractEvent(wagmiConfig, {
      address: gardenAddress,
      abi: GardenAccountABI,
      eventName: "WorkSubmitted",
      onLogs(logs) {
        // Invalidate queries to refresh UI
        queryClient.invalidateQueries({
          queryKey: queryKeys.work.list(gardenAddress),
        });
      },
    });

    return () => unwatch();
  }, [gardenAddress]);
}
```

### Block Confirmations

```typescript
import { waitForTransactionReceipt } from "@wagmi/core";

// Wait for sufficient confirmations before considering final
const receipt = await waitForTransactionReceipt(wagmiConfig, {
  hash: txHash,
  confirmations: 2,  // Wait for 2 block confirmations
  timeout: 60_000,   // 60s timeout
});

if (receipt.status === "reverted") {
  throw new Error("Transaction reverted on-chain");
}
```

### Balance Checks

```typescript
import { getBalance } from "@wagmi/core";

// Check user has enough gas before submitting
async function ensureSufficientBalance(address: Address) {
  const balance = await getBalance(wagmiConfig, { address });

  // Minimum 0.001 ETH for gas
  const MIN_BALANCE = parseEther("0.001");
  if (balance.value < MIN_BALANCE) {
    throw new Error("Insufficient funds for gas. Please add ETH to your wallet.");
  }
}
```

## Anti-Patterns

- **Never use `string` for addresses** — always `Address` type
- **Never hardcode contract addresses** — use deployment artifacts
- **Never skip simulation** — always validate before sending
- **Never ignore auth mode** — wallet and passkey have different write patterns
- **Never import ABIs from contract output** — use shared barrel exports
- **Never assume EOA** — passkey users have smart accounts

## Quick Reference Checklist

### Before Writing Web3 Code

- [ ] Auth mode checked (`wallet` vs `passkey`)
- [ ] Contract addresses from deployment artifacts
- [ ] ABIs imported from `@green-goods/shared`
- [ ] `Address` type used (not `string`)
- [ ] Transaction simulated before broadcast
- [ ] Error handling with `parseContractError()`
- [ ] Stage-based progress UI for long transactions

## Related Skills

- `react` (error-handling sub-file) — Contract error categorization and user messages
- `react` — State management for transaction UI
- `contracts` — Solidity side of the contract interactions
- `data-layer` — Job queue for offline transaction queueing
