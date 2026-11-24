import { createConfig } from "@wagmi/core";
import { type Address, type Chain, type Hex, http, numberToHex } from "viem";

/** A log as the receipt carries it; the RPC adds where it was mined. */
interface ReceiptLog {
  address: Address;
  topics: readonly Hex[];
  data: Hex;
}

/** A receipt with this status and these logs, or a 503 because the RPC lost the receipt poll. */
type ReceiptPoll = { status: "success" | "reverted"; logs?: readonly ReceiptLog[] } | "unavailable";

/**
 * A real wagmi config with only its RPC stubbed. The RPC holds `transaction` as mined and answers
 * its receipt poll the way the test last set, so a receipt wait runs exactly as it would against a
 * node. Until a test sets it, the receipt succeeded and carries no logs.
 */
export function createReceiptRpc(
  chain: Chain,
  transaction: { hash: Hex; from: Address; to: Address }
) {
  let poll: ReceiptPoll = { status: "success" };
  const { hash, from, to } = transaction;
  const minedAt = {
    blockHash: `0x${"cd".repeat(32)}`,
    blockNumber: "0x10",
    transactionIndex: "0x0",
  };

  const answer = (method: string): unknown => {
    switch (method) {
      case "eth_blockNumber":
        return "0x11";
      case "eth_getTransactionByHash":
        return {
          ...minedAt,
          hash,
          from,
          to,
          input: "0x",
          nonce: "0x1",
          gas: "0x30d40",
          maxFeePerGas: "0x2",
          maxPriorityFeePerGas: "0x1",
          value: "0x0",
          type: "0x2",
          accessList: [],
          chainId: numberToHex(chain.id),
          v: "0x0",
          r: "0x1",
          s: "0x1",
          yParity: "0x0",
        };
      case "eth_getTransactionReceipt":
        if (poll === "unavailable") return undefined;
        return {
          ...minedAt,
          transactionHash: hash,
          from,
          to,
          status: poll.status === "success" ? "0x1" : "0x0",
          contractAddress: null,
          cumulativeGasUsed: "0x5208",
          effectiveGasPrice: "0x1",
          gasUsed: "0x5208",
          logs: (poll.logs ?? []).map((log, index) => ({
            ...minedAt,
            ...log,
            transactionHash: hash,
            logIndex: numberToHex(index),
            removed: false,
          })),
          logsBloom: `0x${"00".repeat(256)}`,
          type: "0x2",
        };
      default:
        return undefined;
    }
  };

  const config = createConfig({
    chains: [chain],
    multiInjectedProviderDiscovery: false,
    transports: {
      [chain.id]: http("https://rpc.test", {
        retryCount: 0,
        fetchFn: async (_url, init) => {
          const { id, method } = JSON.parse(String(init?.body)) as { id: number; method: string };
          if (method === "eth_getTransactionReceipt" && poll === "unavailable") {
            return new Response("Service Unavailable", { status: 503 });
          }
          const result = answer(method);
          return new Response(
            JSON.stringify(
              result === undefined
                ? { jsonrpc: "2.0", id, error: { code: -32601, message: `No ${method} here` } }
                : { jsonrpc: "2.0", id, result }
            ),
            { headers: { "content-type": "application/json" } }
          );
        },
      }),
    },
  });

  return {
    config,
    /** How the RPC answers the receipt poll from now on. */
    answerReceiptPoll(next: ReceiptPoll) {
      poll = next;
    },
  };
}
