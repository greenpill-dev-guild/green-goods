// TEST-QUALITY: allow-small-test-file - every other sender test injects its receipt wait, so only a real wagmi config with the RPC stubbed proves what a reverted or lost receipt looks like to the senders and the status checks.
import { HttpRequestError } from "viem";
import { arbitrum } from "viem/chains";
import { describe, expect, it } from "vitest";
import { MOCK_ADDRESSES, MOCK_TX_HASH } from "../../../__tests__/test-utils/mock-factories";
import { createReceiptRpc } from "../../../__tests__/test-utils/receipt-rpc";
import {
  createFakeWagmiDeps,
  createMockContractCall,
} from "../../../__tests__/test-utils/transaction-fakes";
import { EmbeddedSender } from "../embedded-sender";
import { waitForReceipt } from "../receipt-wait";
import { TransactionRevertedError } from "../types";
import { WalletSender } from "../wallet-sender";

// The RPC holds MOCK_TX_HASH as a mined transaction; each test sets how its receipt poll answers.
const rpc = createReceiptRpc(arbitrum, {
  hash: MOCK_TX_HASH,
  from: MOCK_ADDRESSES.deployer,
  to: createMockContractCall().address,
});
const { config } = rpc;

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
    rpc.answerReceiptPoll({ status: "reverted" });
    await expect(wait()).resolves.toMatchObject({
      status: "reverted",
      transactionHash: MOCK_TX_HASH,
    });
  });

  it("rejects when the RPC loses the receipt poll, so a send that went out stays unconfirmed", async () => {
    rpc.answerReceiptPoll("unavailable");
    await expect(wait()).rejects.toBeInstanceOf(HttpRequestError);
  });

  it.each(
    Object.entries(senders)
  )("lets the %s sender report a reverted receipt as a revert", async (_name, sender) => {
    rpc.answerReceiptPoll({ status: "reverted" });
    await expect(sender().sendContractCall(createMockContractCall())).rejects.toBeInstanceOf(
      TransactionRevertedError
    );
  });
});
