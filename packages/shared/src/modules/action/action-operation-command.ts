import type { Abi, WalletClient } from "viem";
import { getChain } from "../../config/chains";
import type { ToastActionOptions } from "../../hooks/app/useToastAction";
import { ensureAppKitWalletChain } from "../transactions/chain-guard";
import { assertLocalArbitrumForkWallet } from "../transactions/local-fork-safety";
import { simulateTransaction } from "../../utils/blockchain/simulation";

export interface ActionOperationCommand {
  functionName: string;
  args: unknown[];
  messages: { loading: string; success: string; error: string };
}

export interface ActionOperationCall extends ActionOperationCommand {
  contractAddress: `0x${string}`;
  abi: Abi;
  account: `0x${string}`;
  chainId: number;
}

export interface ActionOperationResult {
  hash?: `0x${string}`;
  success: boolean;
  error?: { name: string; message: string; action?: string };
}

export interface ActionOperationPorts {
  reader: {
    simulate(call: ActionOperationCall): Promise<{
      success: boolean;
      error?: { name: string; message: string; action?: string };
    }>;
  };
  sender: { send(call: ActionOperationCall): Promise<`0x${string}`> };
}

export async function executeActionOperation(
  call: ActionOperationCall,
  ports: ActionOperationPorts
): Promise<ActionOperationResult> {
  const simulation = await ports.reader.simulate(call);
  if (!simulation.success) return { success: false, error: simulation.error };
  return { hash: await ports.sender.send(call), success: true };
}

export function createDefaultActionOperationPorts(input: {
  walletClient: WalletClient;
  executeWithToast: <T>(action: () => Promise<T>, options: ToastActionOptions) => Promise<T>;
}): ActionOperationPorts {
  return {
    reader: {
      simulate: (call) =>
        simulateTransaction(
          call.contractAddress,
          call.abi,
          call.functionName,
          call.args,
          call.account,
          call.chainId
        ),
    },
    sender: {
      send: (call) =>
        input.executeWithToast(
          async () => {
            await ensureAppKitWalletChain(call.chainId);
            await assertLocalArbitrumForkWallet();
            return input.walletClient.writeContract({
              address: call.contractAddress,
              abi: call.abi,
              functionName: call.functionName,
              account: call.account,
              args: call.args,
              chain: getChain(call.chainId),
            });
          },
          {
            loadingMessage: call.messages.loading,
            successMessage: call.messages.success,
            errorMessage: call.messages.error,
          }
        ),
    },
  };
}
