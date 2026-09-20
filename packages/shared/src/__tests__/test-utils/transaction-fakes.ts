import type { Config } from "@wagmi/core";
import type { SmartAccountClient } from "permissionless";
import type { Abi, Chain, Hex } from "viem";
import { entryPoint07Address } from "viem/account-abstraction";
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

/** A fully prepared v0.7 UserOperation, the shape viem hands an account to sign. */
export function fakePreparedUserOperation(sender: Address) {
  return {
    sender,
    nonce: 7n,
    callData: "0xdeadbeef" as Hex,
    callGasLimit: 100_000n,
    verificationGasLimit: 200_000n,
    preVerificationGas: 50_000n,
    maxFeePerGas: 2_000_000n,
    maxPriorityFeePerGas: 1_000_000n,
    paymaster: "0x4444444444444444444444444444444444444444" as Address,
    paymasterVerificationGasLimit: 60_000n,
    paymasterPostOpGasLimit: 10_000n,
    paymasterData: "0x" as Hex,
    signature: "0x" as Hex,
  };
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
  const account = {
    address: accountAddress,
    entryPoint: { address: entryPoint07Address, version: "0.7" },
    signUserOperation: vi.fn(async () => `0x${"5".repeat(130)}` as Hex),
  } as unknown as NonNullable<SmartAccountClient["account"]>;
  const client = {
    account,
    chain,
    sendTransaction,
    // Mirrors viem's sendUserOperation: prepare, ask the account to sign, then broadcast.
    sendUserOperation: vi.fn(async (parameters: { account?: typeof account }) => {
      await (parameters?.account ?? account).signUserOperation(
        fakePreparedUserOperation(accountAddress)
      );
      if (fail !== undefined) throw fail;
      return result;
    }),
    waitForUserOperationReceipt: vi.fn(async ({ hash }: { hash: Hex }) => ({
      userOpHash: hash,
      sender: accountAddress,
      success: true,
      receipt: { status: "success", transactionHash: hash },
    })),
    getUserOperationReceipt: vi.fn(async ({ hash }: { hash: Hex }) => ({
      userOpHash: hash,
      sender: accountAddress,
      success: true,
      receipt: { status: "success", transactionHash: hash },
    })),
  };

  return client as unknown as FakeSmartAccountClient;
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
