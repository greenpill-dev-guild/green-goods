import { getPublicClient, waitForTransactionReceipt } from "@wagmi/core";
import type { Address, Hex } from "viem";
import { getWagmiConfig } from "../../config/appkit";
import { logger } from "../app/logger";
import { HATS_MODULE_ABI } from "../../utils/blockchain/abis/hats";
import { fetchHatsModuleAddress } from "../../utils/blockchain/garden-hats";
import { simulateGardenLeave } from "./garden-leave-availability";
import { TX_RECEIPT_TIMEOUT_MS } from "../../utils/blockchain/polling";
import { reconcileTransaction, sendCheckpointedCall } from "../transactions/confirmation";
import {
  TransactionConfirmationPendingError,
  TransactionRevertedError,
  type BroadcastConfirmation,
  type TransactionSender,
  type TxResult,
} from "../transactions/types";

export interface LeaveGardenCommand {
  gardenAddress: Address;
  userAddress: Address;
  chainId: number;
}
export interface LeaveGardenPending {
  load(command: LeaveGardenCommand): TxResult | undefined;
  record(command: LeaveGardenCommand, result: TxResult): void;
  clear(command: LeaveGardenCommand, result: TxResult): void;
}
export interface LeaveGardenPorts {
  moduleAddress(command: LeaveGardenCommand): Promise<Address | undefined>;
  simulate(command: LeaveGardenCommand, moduleAddress: Address): Promise<unknown>;
  send(command: LeaveGardenCommand, moduleAddress: Address): Promise<TxResult>;
  receipt(hash: Hex, chainId: number): Promise<{ status: string; blockNumber: bigint }>;
  reconcile(command: LeaveGardenCommand, result: TxResult): Promise<BroadcastConfirmation>;
  pending: LeaveGardenPending;
  confirmed(command: LeaveGardenCommand, blockNumber: bigint): void | Promise<void>;
}

/** A known submission is reconciled before another signature can be requested. */
export async function leaveGarden(
  command: LeaveGardenCommand,
  ports: LeaveGardenPorts
): Promise<Hex> {
  let result = ports.pending.load(command);
  if (!result) {
    const moduleAddress = await ports.moduleAddress(command);
    if (!moduleAddress) throw new Error("Hats module is not configured for this garden");
    await ports.simulate(command, moduleAddress);
    result = await ports.send(command, moduleAddress);
    ports.pending.record(command, result);
  }
  return settleDeparture(command, result, ports);
}

/** Read-only recovery never falls through to module lookup, simulation or a new send. */
export async function reconcileLeaveGarden(
  command: LeaveGardenCommand,
  ports: LeaveGardenPorts
): Promise<Hex> {
  const result = ports.pending.load(command);
  if (!result) throw new Error("No pending garden departure for this account");
  return settleDeparture(command, result, ports);
}

async function settleDeparture(
  command: LeaveGardenCommand,
  result: TxResult,
  ports: LeaveGardenPorts
): Promise<Hex> {
  let hash = result.hash;
  if (result.confirmation === "pending") {
    const outcome = await ports.reconcile(command, result);
    if (outcome.status !== "confirmed") {
      if (outcome.status === "reverted") {
        ports.pending.clear(command, result);
        throw new TransactionRevertedError(result.hash);
      }
      throw new TransactionConfirmationPendingError(result);
    }
    hash = outcome.transactionHash;
  }
  let receipt: Awaited<ReturnType<LeaveGardenPorts["receipt"]>>;
  try {
    receipt = await ports.receipt(hash, command.chainId);
  } catch (error) {
    logger.error("Could not read garden departure receipt", {
      source: "leaveGarden",
      error,
      hash,
      chainId: command.chainId,
    });
    throw new TransactionConfirmationPendingError(result);
  }
  if (receipt.status === "reverted") {
    ports.pending.clear(command, result);
    throw new TransactionRevertedError(hash);
  }
  if (receipt.status !== "success") throw new TransactionConfirmationPendingError(result);
  await ports.confirmed(command, receipt.blockNumber);
  ports.pending.clear(command, result);
  return hash;
}

export function createDefaultLeaveGardenPorts(input: {
  transactionSender: TransactionSender;
  assertOwnership(): void;
  pending: LeaveGardenPending;
  confirmed(command: LeaveGardenCommand, blockNumber: bigint): void | Promise<void>;
}): LeaveGardenPorts {
  return {
    pending: input.pending,
    moduleAddress: ({ gardenAddress, chainId }) =>
      fetchHatsModuleAddress(gardenAddress, chainId, { throwOnError: true }),
    simulate: ({ gardenAddress, userAddress, chainId }, address) =>
      simulateGardenLeave(address, gardenAddress, userAddress, chainId),
    send: async (command, address) => {
      const assertOwnership = async () => {
        input.assertOwnership();
        await input.transactionSender.assertOwnership?.(command.userAddress, command.chainId);
        input.assertOwnership();
      };
      await assertOwnership();
      return sendCheckpointedCall(
        input.transactionSender,
        {
          address,
          abi: HATS_MODULE_ABI,
          functionName: "leaveGarden",
          args: [command.gardenAddress],
          account: command.userAddress,
          chainId: command.chainId,
        },
        (result) => input.pending.record(command, result),
        (result) => input.pending.clear(command, result),
        { assertOwnership }
      );
    },
    receipt: (hash, chainId) =>
      waitForTransactionReceipt(getWagmiConfig(), {
        hash,
        chainId,
        timeout: TX_RECEIPT_TIMEOUT_MS,
      }),
    reconcile: (command, result) =>
      reconcileTransaction(input.transactionSender, result, async (hash) => {
        const client = getPublicClient(getWagmiConfig(), { chainId: command.chainId });
        if (!client) throw new Error("Receipt reader unavailable");
        return client.getTransactionReceipt({ hash });
      }),
    confirmed: input.confirmed,
  };
}
