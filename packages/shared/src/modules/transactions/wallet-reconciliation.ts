import { getConnectorClient, getPublicClient, type Config } from "@wagmi/core";
import { decodeEventLog, parseAbi, toEventSelector, type Hex } from "viem";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import type { Address } from "../../types/domain";
import { isCanonicalTransactionHash } from "./confirmation";
import type { BroadcastConfirmation, BroadcastReference } from "./types";

interface WalletReceiptLocation {
  blockHash: Hex;
  transactionIndex: Hex | number;
}
interface ExecutionReceipt {
  blockHash: Hex;
  transactionHash: Hex;
  status: "success" | "reverted";
  logs: readonly { address: Address; topics: readonly Hex[]; data: Hex }[];
}

interface WalletReconciliationReads {
  walletReceipt(hash: Hex, chainId: number): Promise<WalletReceiptLocation | null>;
  blockTransactions(blockHash: Hex, chainId: number): Promise<readonly Hex[]>;
  executionReceipt(hash: Hex, chainId: number): Promise<ExecutionReceipt>;
}

/** Resolve through the connected wallet, then verify the execution on its chain. */
export async function reconcileWalletBroadcast(
  config: Config,
  reference: BroadcastReference,
  connectedAccount?: Address,
  reads: WalletReconciliationReads = {
    walletReceipt: async (hash, chainId) => {
      const client = await getConnectorClient(config, { chainId });
      if (client.chain.id !== chainId) return null;
      return client.request({ method: "eth_getTransactionReceipt", params: [hash] });
    },
    blockTransactions: async (blockHash, chainId) => {
      const client = getPublicClient(config, { chainId });
      if (!client) throw new Error("Wallet execution reader unavailable");
      return (await client.getBlock({ blockHash })).transactions;
    },
    executionReceipt: async (hash, chainId) => {
      const client = getPublicClient(config, { chainId });
      if (!client) throw new Error("Wallet execution reader unavailable");
      return client.getTransactionReceipt({ hash });
    },
  }
): Promise<BroadcastConfirmation> {
  if (reference.kind !== "transaction") return { status: "unresolved" };
  const account = reference.account ?? connectedAccount;
  if (!account || account.toLowerCase() !== connectedAccount?.toLowerCase())
    return { status: "unresolved" };
  const chainId = reference.chainId ?? DEFAULT_CHAIN_ID;
  try {
    const location = await reads.walletReceipt(reference.hash, chainId);
    if (!location || !isCanonicalTransactionHash(location.blockHash))
      return { status: "unresolved" };
    const index = Number(location.transactionIndex);
    if (!Number.isSafeInteger(index) || index < 0) return { status: "unresolved" };
    // Safe Apps replaces receipt.transactionHash with its proposal ID. The
    // block/index identifies the real execution without trusting that field.
    const hash = (await reads.blockTransactions(location.blockHash, chainId))[index];
    if (!hash || !isCanonicalTransactionHash(hash)) return { status: "unresolved" };
    const receipt = await reads.executionReceipt(hash, chainId);
    if (
      receipt.blockHash.toLowerCase() !== location.blockHash.toLowerCase() ||
      receipt.transactionHash.toLowerCase() !== hash.toLowerCase()
    )
      return { status: "unresolved" };
    const safeLogs = receipt.logs.filter(
      (log) => log.address.toLowerCase() === account.toLowerCase()
    );
    const executionFailure = toEventSelector("ExecutionFailure(bytes32,uint256)");
    if (hash.toLowerCase() === reference.hash.toLowerCase()) {
      const safeFailed = safeLogs.some(
        (log) => log.topics[0]?.toLowerCase() === executionFailure.toLowerCase()
      );
      return receipt.status === "reverted" || safeFailed
        ? { status: "reverted" }
        : { status: "confirmed", transactionHash: hash };
    }
    if (receipt.status !== "success") return { status: "unresolved" };
    const abi = parseAbi([
      "event ExecutionSuccess(bytes32 txHash, uint256 payment)",
      "event ExecutionFailure(bytes32 txHash, uint256 payment)",
    ]);
    for (const log of safeLogs) {
      if (!log.topics[0]) continue;
      try {
        const event = decodeEventLog({
          abi,
          topics: [log.topics[0], ...log.topics.slice(1)],
          data: log.data,
        });
        if (event.args.txHash.toLowerCase() !== reference.hash.toLowerCase()) continue;
        return event.eventName === "ExecutionFailure"
          ? { status: "reverted" }
          : { status: "confirmed", transactionHash: hash };
      } catch {
        /* Ignore unrelated or malformed events. */
      }
    }
    return { status: "unresolved" };
  } catch {
    return { status: "unresolved" };
  }
}
