import { afterEach, describe, expect, it, vi } from "vitest";
import { encodeEventTopics, parseAbiItem, type Hex, type Log } from "viem";
import { initBlockchain, resetBlockchain } from "../services/blockchain";

const chain = {
  id: 11155111,
  name: "Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["http://localhost:8545"] } },
} as const;

const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);
const txHash = `0x${"c".repeat(64)}` as Hex;
const token = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const destination = "0x2222222222222222222222222222222222222222";
const from = "0x1111111111111111111111111111111111111111";

function transferLog(value: bigint, to = destination, tokenAddress = token): Log {
  return {
    address: tokenAddress as Hex,
    topics: encodeEventTopics({
      abi: [transferEvent],
      eventName: "Transfer",
      args: { from, to },
    }) as Log["topics"],
    data: `0x${value.toString(16).padStart(64, "0")}`,
    blockNumber: 123n,
    transactionHash: txHash,
    transactionIndex: 0,
    blockHash: `0x${"d".repeat(64)}`,
    logIndex: 0,
    removed: false,
  };
}

describe("confirmFundingTransaction", () => {
  afterEach(() => {
    resetBlockchain();
  });

  it("confirms only ERC-20 Transfer logs that match the locked token, destination, chain, and minimum amount", async () => {
    const blockchain = initBlockchain(chain);
    (
      blockchain as unknown as {
        publicClient: { getTransactionReceipt: ReturnType<typeof vi.fn> };
      }
    ).publicClient = {
      getTransactionReceipt: vi.fn().mockResolvedValue({
        status: "success",
        blockNumber: 123n,
        logs: [transferLog(100n)],
      }),
    };

    const result = await blockchain.confirmFundingTransaction(txHash, {
      token,
      destinationAddress: destination,
      minAssetAmount: "100",
      chainId: 11155111,
    });

    expect(result).toMatchObject({
      status: "confirmed",
      txHash,
      matchedAssetAmount: "100",
      blockNumber: "123",
    });
  });

  it("returns tuple_mismatch when the receipt does not meet the locked tuple", async () => {
    const blockchain = initBlockchain(chain);
    (
      blockchain as unknown as {
        publicClient: { getTransactionReceipt: ReturnType<typeof vi.fn> };
      }
    ).publicClient = {
      getTransactionReceipt: vi.fn().mockResolvedValue({
        status: "success",
        blockNumber: 123n,
        logs: [transferLog(99n)],
      }),
    };

    await expect(
      blockchain.confirmFundingTransaction(txHash, {
        token,
        destinationAddress: destination,
        minAssetAmount: "100",
        chainId: 11155111,
      })
    ).resolves.toMatchObject({
      status: "tuple_mismatch",
      mismatchReason: "amount_below_min",
      matchedAssetAmount: "99",
    });

    await expect(
      blockchain.confirmFundingTransaction(txHash, {
        token,
        destinationAddress: destination,
        minAssetAmount: "1",
        chainId: 1,
      })
    ).resolves.toMatchObject({
      status: "tuple_mismatch",
      mismatchReason: "chain_mismatch",
    });
  });
});
