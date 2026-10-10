import type { SmartAccountClient } from "permissionless";
import { encodeFunctionData, type Hex } from "viem";
import { GardenAccountABI } from "../../utils/blockchain/contracts";
import { simulateJoinGarden } from "../../utils/blockchain/simulation";
import { ensureAppKitWalletChain } from "../transactions/chain-guard";
import {
  assertLocalArbitrumForkSmartAccountsDisabled,
  assertLocalArbitrumForkWallet,
} from "../transactions/local-fork-safety";

export interface JoinGardenCommand {
  gardenAddress: Hex;
  userAddress: Hex;
  chainId: number;
  smartAccountClient: SmartAccountClient | null;
}

export interface JoinGardenPorts {
  reader: {
    simulate(command: JoinGardenCommand): Promise<{
      success: boolean;
      error?: { name: string; message: string };
    }>;
  };
  sender: {
    smartAccount(command: JoinGardenCommand): Promise<string>;
    wallet(command: JoinGardenCommand): Promise<string>;
  };
  documents: {
    recordPending(gardenAddress: string, userAddress: string, timestamp: number): void;
  };
  clock: { now(): number };
}

export async function joinGarden(
  command: JoinGardenCommand,
  ports: JoinGardenPorts
): Promise<string> {
  let txHash: string;
  if (command.smartAccountClient?.account) {
    txHash = await ports.sender.smartAccount(command);
  } else {
    const simulation = await ports.reader.simulate(command);
    if (!simulation.success) {
      const error = new Error(
        simulation.error?.message ?? "Transaction simulation failed. Please try again."
      );
      if (simulation.error?.name) error.name = simulation.error.name;
      throw error;
    }
    txHash = await ports.sender.wallet(command);
  }

  ports.documents.recordPending(command.gardenAddress, command.userAddress, ports.clock.now());
  return txHash;
}

export function createDefaultJoinGardenPorts(input: {
  walletSend(command: JoinGardenCommand): Promise<string>;
  recordPending(gardenAddress: string, userAddress: string, timestamp: number): void;
}): JoinGardenPorts {
  return {
    reader: {
      simulate: ({ gardenAddress, userAddress, chainId }) =>
        simulateJoinGarden(gardenAddress, userAddress, undefined, chainId),
    },
    sender: {
      smartAccount: async ({ smartAccountClient, gardenAddress }) => {
        if (!smartAccountClient?.account) throw new Error("Passkey session is not ready");
        assertLocalArbitrumForkSmartAccountsDisabled();
        return smartAccountClient.sendTransaction({
          account: smartAccountClient.account,
          chain: smartAccountClient.chain,
          to: gardenAddress,
          value: 0n,
          data: encodeFunctionData({ abi: GardenAccountABI, functionName: "joinGarden", args: [] }),
        });
      },
      wallet: async (command) => {
        await ensureAppKitWalletChain(command.chainId);
        await assertLocalArbitrumForkWallet();
        return input.walletSend(command);
      },
    },
    documents: { recordPending: input.recordPending },
    clock: { now: () => Date.now() },
  };
}
