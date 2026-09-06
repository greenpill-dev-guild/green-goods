import type { Config } from "@wagmi/core";
import type { SmartAccountClient } from "permissionless";
import type { Abi, Chain, Hex } from "viem";
import { sepolia } from "viem/chains";
import { vi } from "vitest";
import type { EmbeddedSenderDeps } from "../../modules/transactions/embedded-sender";
import type { ContractCall, TransactionSender, TxResult } from "../../modules/transactions/types";
import type { WalletSender, WalletSenderDeps } from "../../modules/transactions/wallet-sender";
import type { Address } from "../../types/domain";
import { MOCK_ADDRESSES, MOCK_TX_HASH } from "./mock-factories";

export const MOCK_CONTRACT_ABI = [
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "nonpayable",
  },
] as const satisfies Abi;

export function createMockContractCall(overrides: Partial<ContractCall> = {}): ContractCall {
  return {
    address: "0x3333333333333333333333333333333333333333",
    abi: MOCK_CONTRACT_ABI,
    functionName: "transfer",
    args: ["0x1111111111111111111111111111111111111111", 1000n],
    chainId: 42161,
    ...overrides,
  };
}

export interface MockTransactionSenderOptions extends Partial<TransactionSender> {
  result?: TxResult;
  fail?: unknown;
}

export type MockTransactionSender = TransactionSender & {
  sendContractCall: ReturnType<typeof vi.fn<TransactionSender["sendContractCall"]>>;
};

export function createMockTransactionSender(
  options: MockTransactionSenderOptions = {}
): MockTransactionSender {
  const {
    authMode = "passkey",
    supportsBatching = false,
    supportsSponsorship = authMode === "passkey",
    sendContractCall: sendContractCallOverride,
    sendBatch,
    result = { hash: MOCK_TX_HASH, sponsored: supportsSponsorship },
    fail,
  } = options;
  const sendContractCall = vi.fn<TransactionSender["sendContractCall"]>(
    sendContractCallOverride ??
      (async () => {
        if (fail !== undefined) throw fail;
        return result;
      })
  );

  return {
    authMode,
    supportsBatching,
    supportsSponsorship,
    sendContractCall,
    ...(sendBatch ? { sendBatch: vi.fn(sendBatch) } : {}),
  };
}

type SmartAccountSendTransaction = SmartAccountClient["sendTransaction"];

export type FakeSmartAccountClient = SmartAccountClient & {
  sendTransaction: ReturnType<typeof vi.fn<SmartAccountSendTransaction>>;
  sendUserOperation: ReturnType<typeof vi.fn<SmartAccountClient["sendUserOperation"]>>;
  waitForUserOperationReceipt: ReturnType<
    typeof vi.fn<SmartAccountClient["waitForUserOperationReceipt"]>
  >;
};

export interface FakeSmartAccountClientOptions {
  accountAddress?: Address;
  chain?: Chain;
  result?: Hex;
  fail?: unknown;
}

export function createFakeSmartAccountClient(
  options: FakeSmartAccountClientOptions = {}
): FakeSmartAccountClient {
  const {
    accountAddress = MOCK_ADDRESSES.deployer,
    chain = sepolia,
    result = MOCK_TX_HASH,
    fail,
  } = options;
  const sendTransaction = vi.fn<SmartAccountSendTransaction>(async () => {
    if (fail !== undefined) throw fail;
    return result;
  });
  const client = {
    account: { address: accountAddress } as NonNullable<SmartAccountClient["account"]>,
    chain,
    sendTransaction,
    sendUserOperation: vi.fn<SmartAccountClient["sendUserOperation"]>(async () => {
      if (fail !== undefined) throw fail;
      return `0x${"d".repeat(64)}`;
    }),
    waitForUserOperationReceipt: vi.fn<SmartAccountClient["waitForUserOperationReceipt"]>(
      async ({ hash }) =>
        ({
          userOpHash: hash,
          sender: accountAddress,
          success: true,
          receipt: { status: "success", transactionHash: result },
        }) as Awaited<ReturnType<SmartAccountClient["waitForUserOperationReceipt"]>>
    ),
  };

  return client as FakeSmartAccountClient;
}

type WalletWriteContract = ConstructorParameters<typeof WalletSender>[1];

export interface FakeWagmiDeps extends WalletSenderDeps, EmbeddedSenderDeps {
  config: Config;
  writeContractAsync: ReturnType<typeof vi.fn<WalletWriteContract>>;
  writeContract: ReturnType<typeof vi.fn<EmbeddedSenderDeps["writeContract"]>>;
  waitForTransactionReceipt: ReturnType<
    typeof vi.fn<WalletSenderDeps["waitForTransactionReceipt"]>
  >;
  assertWriteSafety: ReturnType<typeof vi.fn<NonNullable<WalletSenderDeps["assertWriteSafety"]>>>;
  ensureWalletChain: ReturnType<typeof vi.fn<NonNullable<WalletSenderDeps["ensureWalletChain"]>>>;
}

export interface FakeWagmiDepsOptions {
  config?: Config;
  result?: Hex;
  fail?: unknown;
  receiptStatus?: string;
}

export function createFakeWagmiDeps(options: FakeWagmiDepsOptions = {}): FakeWagmiDeps {
  const { config = {} as Config, result = MOCK_TX_HASH, fail, receiptStatus = "success" } = options;
  const writeContractAsync = vi.fn<WalletWriteContract>(async () => {
    if (fail !== undefined) throw fail;
    return result;
  });
  const writeContract = vi.fn<EmbeddedSenderDeps["writeContract"]>(async () => {
    if (fail !== undefined) throw fail;
    return result;
  });

  return {
    config,
    writeContractAsync,
    writeContract,
    waitForTransactionReceipt: vi
      .fn<WalletSenderDeps["waitForTransactionReceipt"]>()
      .mockResolvedValue({ status: receiptStatus }),
    assertWriteSafety: vi
      .fn<NonNullable<WalletSenderDeps["assertWriteSafety"]>>()
      .mockResolvedValue(),
    ensureWalletChain: vi
      .fn<NonNullable<WalletSenderDeps["ensureWalletChain"]>>()
      .mockResolvedValue(),
  };
}
