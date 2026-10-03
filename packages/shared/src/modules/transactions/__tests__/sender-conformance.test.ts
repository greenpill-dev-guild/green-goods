/** @vitest-environment happy-dom */

import {
  createFakeSmartAccountClient,
  createFakeWagmiDeps,
  createMockContractCall,
} from "../../../__tests__/test-utils/transaction-fakes";
import {
  describeConformance,
  type ConformanceLaw,
} from "../../../__tests__/test-utils/conformance";
import { fakePreparedUserOperation } from "../../../__tests__/test-utils/transaction-fakes";
import { expect, vi } from "vitest";
import type { Hex } from "viem";
import { DEFAULT_CHAIN_ID } from "../../../config/default-chain";
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
  /** The account the wallet holds now, for senders that read it from wagmi. */
  connectedAccount?: `0x${string}`;
  /** What happens while the guard reads the wallet, before it asks who signs. */
  whileGuardReads?: () => void;
};

type ForwardedCall = {
  account?: string;
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
  chainSource: "resolver" | "call";
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
      deps.getAccount = () => ({ address: scenario.connectedAccount });
      deps.ensureWalletChain.mockImplementation(async (chainId, _reason, beforeSwitch) => {
        // As the guard does for a wallet on another network.
        scenario.whileGuardReads?.();
        await beforeSwitch?.();
        trace.push("chain");
        guardedChains.push(chainId);
      });
      deps.assertWriteSafety.mockImplementation(async () => {
        trace.push("safety");
      });
      deps.writeContractAsync.mockImplementation(async (call) => {
        trace.push("send");
        forwarded.push({ account: call.account, chainId: call.chainId, value: call.value });
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
      chainSource: "resolver",
      receipt: "always",
      revertedReceipt: true,
      nonCanonicalHash: "passkey mode confirms a UserOperation receipt",
      guardOrder: ["safety", "send", "receipt"],
      omittedValue: 0n,
    },
    make: (scenario = {}) => {
      const trace: string[] = [];
      const forwarded: ForwardedCall[] = [];
      const hashes = sequence(scenario.hashes ?? [], SECOND_TX_HASH);
      const client = createFakeSmartAccountClient();
      client.sendUserOperation.mockImplementation(async (call) => {
        // viem asks the account to sign before it broadcasts.
        const signer = (call as { account: NonNullable<typeof client.account> }).account;
        await signer.signUserOperation(fakePreparedUserOperation(signer.address));
        trace.push("send");
        const transaction = (call as { calls: Array<{ value?: bigint }> }).calls[0];
        forwarded.push({
          clientChainId: client.chain?.id,
          value: transaction.value,
        });
        if (scenario.transportFailure) throw scenario.transportFailure;
        return hashes();
      });
      const receiptHashes: Hex[] = [];
      vi.mocked(client.waitForUserOperationReceipt).mockImplementation(async ({ hash }) => {
        trace.push("receipt");
        receiptHashes.push(hash);
        return {
          userOpHash: hash,
          sender: client.account!.address,
          success: scenario.receiptStatus !== "reverted",
          receipt: { status: "success", transactionHash: hash },
        } as Awaited<ReturnType<typeof client.waitForUserOperationReceipt>>;
      });
      const assertWriteSafety = vi.fn(async () => {
        trace.push("safety");
      });
      return {
        sender: new PasskeySender(client, {
          assertWriteSafety,
          resolveSmartAccountClient: async (chainId) => {
            client.chain = { ...client.chain!, id: chainId };
            return client;
          },
        }),
        trace,
        forwarded,
        guardedChains: [],
        receiptHashes,
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
      deps.getAccount = () => ({ address: scenario.connectedAccount });
      deps.ensureWalletChain.mockImplementation(async (chainId, _reason, beforeSwitch) => {
        // As the guard does for a wallet on another network.
        scenario.whileGuardReads?.();
        await beforeSwitch?.();
        trace.push("chain");
        guardedChains.push(chainId);
      });
      deps.assertWriteSafety.mockImplementation(async () => {
        trace.push("safety");
      });
      deps.writeContract.mockImplementation(async (_config, call) => {
        trace.push("send");
        forwarded.push({
          account: call.account as string | undefined,
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

      if (expectations.chainSource === "resolver") {
        expect(explicit.forwarded[0]?.clientChainId).toBe(42161);
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
    // An act can be prepared for minutes (uploads) before it is sent. A wallet
    // that took the connection over meanwhile must be refused before it is
    // asked to change network, not after. The guard asks at that moment.
    name: "has the guard ask who signs before the wallet changes network, and asks again after",
    applicable: ({ expectations }) =>
      expectations.chainSource === "call" || "a passkey send has no wallet network to guard",
    verify: async ({ make }) => {
      const owner = "0x1111111111111111111111111111111111111111";
      const harness = make();
      const assertOwnership = vi.fn(async () => {
        harness.trace.push("owner");
      });
      await harness.sender.sendContractCall(createMockContractCall(), { assertOwnership });
      expect(harness.trace.slice(0, 4)).toEqual(["owner", "chain", "safety", "owner"]);

      // The account is read last: one that changes while ownership is being
      // checked is still caught before the switch.
      const connection = { connectedAccount: owner } as SenderScenario;
      const takenOver = make(connection);
      await expect(
        takenOver.sender.sendContractCall(createMockContractCall({ account: owner }), {
          assertOwnership: async () => {
            connection.connectedAccount = "0x2222222222222222222222222222222222222222";
          },
        })
      ).rejects.toMatchObject({ code: "account_mismatch" });
      const disowned = make();
      await expect(
        disowned.sender.sendContractCall(createMockContractCall(), {
          assertOwnership: () => Promise.reject(new Error("submission-ownership-changed")),
        })
      ).rejects.toThrow("submission-ownership-changed");
      expect([takenOver.trace, disowned.trace]).toEqual([[], []]);
    },
  },
  {
    // A send belongs to one address: the one its call names, or else the one
    // connected when it starts. A wallet that takes the connection over after
    // that is asked neither to change network nor to sign.
    name: "pins a send that names no account to the address connected when it starts",
    applicable: ({ expectations }) =>
      expectations.chainSource === "call" || "a passkey send signs as its own smart account",
    verify: async ({ make }) => {
      const owner = "0x1111111111111111111111111111111111111111";
      const steady = make({ connectedAccount: owner });
      await steady.sender.sendContractCall(createMockContractCall());
      expect(steady.forwarded[0]?.account).toBe(owner);

      const connection: SenderScenario = {
        connectedAccount: owner,
        whileGuardReads: () => {
          connection.connectedAccount = "0x2222222222222222222222222222222222222222";
        },
      };
      const takenOver = make(connection);
      await expect(
        takenOver.sender.sendContractCall(createMockContractCall())
      ).rejects.toMatchObject({ code: "account_mismatch" });
      expect(takenOver.trace).toEqual([]);
    },
  },
  {
    name: "reports the send intent once, after its guards and before the transport sends",
    verify: async ({ make }) => {
      const harness = make();
      const onBeforeBroadcast = vi.fn(async () => {
        harness.trace.push("intent");
      });
      await harness.sender.sendContractCall(createMockContractCall(), { onBeforeBroadcast });
      expect(onBeforeBroadcast).toHaveBeenCalledOnce();
      const intent = harness.trace.indexOf("intent");
      expect(intent).toBe(harness.trace.indexOf("send") - 1);
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
      await expect(sender.sendContractCall(createMockContractCall())).rejects.toThrow(/reverted/i);
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
        confirmation: "pending",
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
