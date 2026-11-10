// TEST-QUALITY: allow-small-test-file - every other sender test injects its receipt wait, so only a real wagmi config with the RPC stubbed proves what a reverted or lost receipt looks like to the senders and the status checks.
import { createConfig, http } from "@wagmi/core";
import { HttpRequestError } from "viem";
import { arbitrum } from "viem/chains";
import { describe, expect, it } from "vitest";
import { MOCK_ADDRESSES, MOCK_TX_HASH } from "../../../__tests__/test-utils/mock-factories";
import {
  createFakeWagmiDeps,
  createMockContractCall,
} from "../../../__tests__/test-utils/transaction-fakes";
import { EmbeddedSender } from "../embedded-sender";
import { waitForReceipt } from "../receipt-wait";
import { TransactionRevertedError } from "../types";
import { WalletSender } from "../wallet-sender";

const CONTRACT = createMockContractCall().address;
const BLOCK_HASH = `0x${"cd".repeat(32)}`;

// The RPC holds MOCK_TX_HASH as a mined transaction whose receipt reverted. When the receipt poll
// is `unavailable`, the RPC answers it with a 503 instead.
let receiptPoll: "reverted" | "unavailable" = "reverted";
const minedAt = { blockHash: BLOCK_HASH, blockNumber: "0x10", transactionIndex: "0x0" };
const results: Record<string, unknown> = {
  eth_blockNumber: "0x11",
  eth_getTransactionByHash: {
    ...minedAt,
    hash: MOCK_TX_HASH,
    from: MOCK_ADDRESSES.deployer,
    to: CONTRACT,
    input: "0x",
    nonce: "0x1",
    gas: "0x30d40",
    maxFeePerGas: "0x2",
    maxPriorityFeePerGas: "0x1",
    value: "0x0",
    type: "0x2",
    accessList: [],
    chainId: "0xa4b1",
    v: "0x0",
    r: "0x1",
    s: "0x1",
    yParity: "0x0",
  },
  eth_getTransactionReceipt: {
    ...minedAt,
    transactionHash: MOCK_TX_HASH,
    from: MOCK_ADDRESSES.deployer,
    to: CONTRACT,
    status: "0x0",
    contractAddress: null,
    cumulativeGasUsed: "0x5208",
    effectiveGasPrice: "0x1",
    gasUsed: "0x5208",
    logs: [],
    logsBloom: `0x${"00".repeat(256)}`,
    type: "0x2",
  },
};

const config = createConfig({
  chains: [arbitrum],
  multiInjectedProviderDiscovery: false,
  transports: {
    [arbitrum.id]: http("https://rpc.test", {
      retryCount: 0,
      fetchFn: async (_url, init) => {
        const { id, method } = JSON.parse(String(init?.body));
        if (method === "eth_getTransactionReceipt" && receiptPoll === "unavailable") {
          return new Response("Service Unavailable", { status: 503 });
        }
        return Response.json(
          method in results
            ? { jsonrpc: "2.0", id, result: results[method] }
            : { jsonrpc: "2.0", id, error: { code: -32601, message: `No ${method} here` } }
        );
      },
    }),
  },
});

const wait = () => waitForReceipt(config, { hash: MOCK_TX_HASH, chainId: arbitrum.id });

/** Each sender with a stubbed wallet and its own default receipt wait. */
const senders = {
  wallet: () => {
    const deps = { ...createFakeWagmiDeps({ config }), waitForTransactionReceipt: undefined };
    return new WalletSender(config, deps.writeContractAsync, undefined, deps);
  },
  embedded: () =>
    new EmbeddedSender(config, undefined, {
      ...createFakeWagmiDeps({ config }),
      waitForTransactionReceipt: undefined,
    }),
};

describe("modules/transactions/receipt-wait", () => {
  it("hands back a reverted receipt instead of throwing", async () => {
    receiptPoll = "reverted";
    await expect(wait()).resolves.toMatchObject({
      status: "reverted",
      transactionHash: MOCK_TX_HASH,
    });
  });

  it("rejects when the RPC loses the receipt poll, so a send that went out stays unconfirmed", async () => {
    receiptPoll = "unavailable";
    await expect(wait()).rejects.toBeInstanceOf(HttpRequestError);
  });

  it.each(
    Object.entries(senders)
  )("lets the %s sender report a reverted receipt as a revert", async (_name, sender) => {
    receiptPoll = "reverted";
    await expect(sender().sendContractCall(createMockContractCall())).rejects.toBeInstanceOf(
      TransactionRevertedError
    );
  });
});
