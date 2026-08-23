/** @vitest-environment jsdom */

import {
  createFakeSmartAccountClient,
  createFakeWagmiDeps,
  createMockContractCall,
  describeConformance,
  type ConformanceLaw,
} from "@green-goods/shared/testing";
import { expect, vi } from "vitest";
import type { Hex } from "viem";
import { DEFAULT_CHAIN_ID } from "../../../config/blockchain";
import { EmbeddedSender } from "../embedded-sender";
import { PasskeySender } from "../passkey-sender";
import type { ContractCall, TransactionSender } from "../types";
import { WalletSender } from "../wallet-sender";

const SECOND_TX_HASH = `0x${"b".repeat(64)}` as Hex;
const NON_CANONICAL_HASH = `0x${"c".repeat(130)}` as Hex;

type SenderScenario = {
  hashes?: Hex[];
  receiptStatus?: string;
  transportFailure?: Error;
};

type ForwardedCall = {
  chainId?: number;
  clientChainId?: number;
  value?: bigint;
};

type SenderHarness = {
  sender: TransactionSender;
  trace: string[];
  forwarded: ForwardedCall[];
  guardedChains: number[];
  receiptHashes: Hex[];
};

type SenderExpectations = {
  authMode: TransactionSender["authMode"];
  sponsored: boolean;
  supportsBatching: boolean;
  batch: true | string;
  chainSource: "client" | "call";
  receipt: "none" | "always" | "canonical-only";
  revertedReceipt: true | string;
  nonCanonicalHash: true | string;
  guardOrder: string[];
  omittedValue: bigint | undefined;
};

type SenderCase = {
  name: string;
  expectations: SenderExpectations;
  make: (scenario?: SenderScenario) => SenderHarness;
};

function sequence<T>(values: T[], fallback: T): () => T {
  return () => values.shift() ?? fallback;
}

const cases: SenderCase[] = [
  {
    name: "WalletSender",
    expectations: {
      authMode: "wallet",
      sponsored: false,
      supportsBatching: false,
      batch: "wallet mode intentionally has no batch surface",
      chainSource: "call",
      receipt: "canonical-only",
      revertedReceipt: true,
      nonCanonicalHash: true,
      guardOrder: ["chain", "safety", "send", "receipt"],
      omittedValue: undefined,
    },
    make: (scenario = {}) => {
      const trace: string[] = [];
      const forwarded: ForwardedCall[] = [];
      const guardedChains: number[] = [];
      const receiptHashes: Hex[] = [];
      const hashes = sequence(scenario.hashes ?? [], SECOND_TX_HASH);
      const deps = createFakeWagmiDeps({ receiptStatus: scenario.receiptStatus });
      deps.ensureWalletChain.mockImplementation(async (chainId) => {
        trace.push("chain");
        guardedChains.push(chainId);
      });
      deps.assertWriteSafety.mockImplementation(async () => {
        trace.push("safety");
      });
      deps.writeContractAsync.mockImplementation(async (call) => {
        trace.push("send");
        forwarded.push({ chainId: call.chainId, value: call.value });
        if (scenario.transportFailure) throw scenario.transportFailure;
        return hashes() as `0x${string}`;
      });
      deps.waitForTransactionReceipt.mockImplementation(async (_config, receipt) => {
        trace.push("receipt");
        receiptHashes.push(receipt.hash);
        return { status: scenario.receiptStatus ?? "success" };
      });
      return {
        sender: new WalletSender(deps.config, deps.writeContractAsync, undefined, deps),
        trace,
        forwarded,
        guardedChains,
        receiptHashes,
      };
    },
  },
  {
    name: "PasskeySender",
    expectations: {
      authMode: "passkey",
      sponsored: true,
      supportsBatching: false,
      batch: true,
      chainSource: "client",
      receipt: "none",
      revertedReceipt: "the bundler returns an included transaction hash without a receipt wait",
      nonCanonicalHash: "the bundler result is returned directly and has no receipt branch",
      guardOrder: ["safety", "send"],
      omittedValue: 0n,
    },
    make: (scenario = {}) => {
      const trace: string[] = [];
      const forwarded: ForwardedCall[] = [];
      const hashes = sequence(scenario.hashes ?? [], SECOND_TX_HASH);
      const client = createFakeSmartAccountClient();
      client.sendTransaction.mockImplementation(async (call) => {
        trace.push("send");
        const transaction = call as { chain?: { id: number }; value?: bigint };
        forwarded.push({
          clientChainId: transaction.chain?.id,
          value: transaction.value,
        });
        if (scenario.transportFailure) throw scenario.transportFailure;
        return hashes();
      });
      const assertWriteSafety = vi.fn(async () => {
        trace.push("safety");
      });
      return {
        sender: new PasskeySender(client, { assertWriteSafety }),
        trace,
        forwarded,
        guardedChains: [],
        receiptHashes: [],
      };
    },
  },
  {
    name: "EmbeddedSender",
    expectations: {
      authMode: "embedded",
      sponsored: false,
      supportsBatching: false,
      batch: true,
      chainSource: "call",
      receipt: "always",
      revertedReceipt: true,
      nonCanonicalHash: "embedded mode always waits for its wagmi receipt",
      guardOrder: ["chain", "safety", "send", "receipt"],
      omittedValue: undefined,
    },
    make: (scenario = {}) => {
      const trace: string[] = [];
      const forwarded: ForwardedCall[] = [];
      const guardedChains: number[] = [];
      const receiptHashes: Hex[] = [];
      const hashes = sequence(scenario.hashes ?? [], SECOND_TX_HASH);
      const deps = createFakeWagmiDeps({ receiptStatus: scenario.receiptStatus });
      deps.ensureWalletChain.mockImplementation(async (chainId) => {
        trace.push("chain");
        guardedChains.push(chainId);
      });
      deps.assertWriteSafety.mockImplementation(async () => {
        trace.push("safety");
      });
      deps.writeContract.mockImplementation(async (_config, call) => {
        trace.push("send");
        forwarded.push({
          chainId: call.chainId as number,
          value: call.value as bigint | undefined,
        });
        if (scenario.transportFailure) throw scenario.transportFailure;
        return hashes();
      });
      deps.waitForTransactionReceipt.mockImplementation(async (_config, receipt) => {
        trace.push("receipt");
        receiptHashes.push(receipt.hash);
        return { status: scenario.receiptStatus ?? "success" };
      });
      return {
        sender: new EmbeddedSender(deps.config, undefined, deps),
        trace,
        forwarded,
        guardedChains,
        receiptHashes,
      };
    },
  },
];

const laws: ConformanceLaw<SenderCase>[] = [
  {
    name: "reports its auth mode and capability flags",
    verify: ({ make, expectations }) => {
      const { sender } = make();
      expect(sender.authMode).toBe(expectations.authMode);
      expect(sender.supportsSponsorship).toBe(expectations.sponsored);
      expect(sender.supportsBatching).toBe(expectations.supportsBatching);
      expect(typeof sender.sendBatch === "function").toBe(expectations.batch === true);
    },
  },
  {
    name: "returns a result with the sender sponsorship policy",
    verify: async ({ make, expectations }) => {
      const { sender } = make();
      await expect(sender.sendContractCall(createMockContractCall())).resolves.toEqual({
        hash: SECOND_TX_HASH,
        sponsored: expectations.sponsored,
      });
    },
  },
  {
    name: "sources chain identity from the intentional boundary",
    verify: async ({ make, expectations }) => {
      const explicit = make();
      await explicit.sender.sendContractCall(createMockContractCall({ chainId: 42161 }));
      const fallback = make();
      await fallback.sender.sendContractCall(createMockContractCall({ chainId: undefined }));

      if (expectations.chainSource === "client") {
        expect(explicit.forwarded[0]?.clientChainId).toBe(11155111);
        expect(fallback.forwarded[0]?.clientChainId).toBe(11155111);
        expect(explicit.guardedChains).toEqual([]);
      } else {
        expect(explicit.guardedChains).toEqual([42161]);
        expect(fallback.guardedChains).toEqual([DEFAULT_CHAIN_ID]);
        expect(explicit.forwarded[0]?.chainId).toBe(42161);
        expect(fallback.forwarded[0]?.chainId).toBe(DEFAULT_CHAIN_ID);
      }
    },
  },
  {
    name: "runs safety guards before transport",
    verify: async ({ make, expectations }) => {
      const harness = make();
      await harness.sender.sendContractCall(createMockContractCall());
      expect(harness.trace).toEqual(expectations.guardOrder);
    },
  },
  {
    name: "preserves omitted and explicit values",
    verify: async ({ make, expectations }) => {
      const omitted = make();
      await omitted.sender.sendContractCall(createMockContractCall({ value: undefined }));
      const payable = make();
      await payable.sender.sendContractCall(createMockContractCall({ value: 123n }));
      expect(omitted.forwarded[0]?.value).toBe(expectations.omittedValue);
      expect(payable.forwarded[0]?.value).toBe(123n);
    },
  },
  {
    name: "uses the declared receipt policy",
    verify: async ({ make, expectations }) => {
      const harness = make();
      await harness.sender.sendContractCall(createMockContractCall());
      expect(harness.receiptHashes).toHaveLength(expectations.receipt === "none" ? 0 : 1);
    },
  },
  {
    name: "rejects reverted receipts",
    applicable: ({ expectations }) => expectations.revertedReceipt,
    verify: async ({ make }) => {
      const { sender } = make({ receiptStatus: "reverted" });
      await expect(sender.sendContractCall(createMockContractCall())).rejects.toThrow(
        "Transaction reverted on-chain"
      );
    },
  },
  {
    name: "passes through a non-canonical wallet hash without waiting",
    applicable: ({ expectations }) => expectations.nonCanonicalHash,
    verify: async ({ make }) => {
      const harness = make({ hashes: [NON_CANONICAL_HASH] });
      await expect(harness.sender.sendContractCall(createMockContractCall())).resolves.toEqual({
        hash: NON_CANONICAL_HASH,
        sponsored: false,
      });
      expect(harness.receiptHashes).toEqual([]);
    },
  },
  {
    name: "propagates transport failures",
    verify: async ({ make }) => {
      const { sender } = make({ transportFailure: new Error("sender transport failed") });
      await expect(sender.sendContractCall(createMockContractCall())).rejects.toThrow(
        "sender transport failed"
      );
    },
  },
  {
    name: "rejects an empty batch",
    applicable: ({ expectations }) => expectations.batch,
    verify: async ({ make }) => {
      await expect(make().sender.sendBatch?.([])).rejects.toThrow("Cannot send empty batch");
    },
  },
  {
    name: "sends a multi-call batch sequentially and returns the last result",
    applicable: ({ expectations }) => expectations.batch,
    verify: async ({ make, expectations }) => {
      const harness = make({ hashes: [SECOND_TX_HASH, NON_CANONICAL_HASH] });
      const calls: ContractCall[] = [
        createMockContractCall(),
        createMockContractCall({ args: ["0x1111111111111111111111111111111111111111", 2000n] }),
      ];
      await expect(harness.sender.sendBatch?.(calls)).resolves.toEqual({
        hash: NON_CANONICAL_HASH,
        sponsored: expectations.sponsored,
      });
      expect(harness.forwarded).toHaveLength(2);
    },
  },
];

describeConformance("TransactionSender conformance", cases, laws);
