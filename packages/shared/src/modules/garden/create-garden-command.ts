import { waitForTransactionReceipt } from "@wagmi/core";
import type { WalletClient } from "viem";
import { formatEther } from "viem";
import { getWagmiConfig } from "../../config/appkit";
import { getChain } from "../../config/chains";
import type { CreateGardenParams } from "../../types/contracts";
import { isZeroAddress } from "../../utils/blockchain/address";
import {
  createClients,
  GardenTokenABI,
  GreenGoodsENSABI,
  getNetworkContracts,
} from "../../utils/blockchain/contracts";
import { TX_RECEIPT_TIMEOUT_MS } from "../../utils/blockchain/polling";
import { simulateTransaction } from "../../utils/blockchain/simulation";
import { logger } from "../app/logger";
import { ensureAppKitWalletChain } from "../transactions/chain-guard";
import { assertLocalArbitrumForkWallet } from "../transactions/local-fork-safety";

export interface CreateGardenCommand {
  params: CreateGardenParams;
  accountAddress: `0x${string}`;
  chainId: number;
}

type GardenContractConfig = CreateGardenParams;

export interface CreateGardenPorts {
  reader: {
    contracts(chainId: number): ReturnType<typeof getNetworkContracts>;
    estimateCcipFee(input: {
      slug: string;
      ensAddress: `0x${string}`;
      accountAddress: `0x${string}`;
      chainId: number;
    }): Promise<bigint>;
    simulate(input: {
      gardenToken: `0x${string}`;
      config: GardenContractConfig;
      accountAddress: `0x${string}`;
      chainId: number;
    }): Promise<{ success: boolean; error?: { message: string } }>;
    waitForReceipt(hash: `0x${string}`, chainId: number): Promise<void>;
    estimateTransaction(input: {
      gardenToken: `0x${string}`;
      config: GardenContractConfig;
      accountAddress: `0x${string}`;
      chainId: number;
      ccipFee: bigint;
    }): Promise<{ gasEstimate: bigint; gasPrice: bigint }>;
  };
  sender: {
    send(input: {
      gardenToken: `0x${string}`;
      config: GardenContractConfig;
      accountAddress: `0x${string}`;
      chainId: number;
      ccipFee: bigint;
    }): Promise<`0x${string}`>;
  };
  documents: { addPending(hash: `0x${string}`, submittedAt: number): void };
  clock: { now(): number };
}

export interface GardenCreationEstimate {
  gasEstimate: bigint;
  gasPrice: bigint;
  txFee: bigint;
  ccipFee: bigint;
  totalEstimatedFee: bigint;
  formatted: { txFeeEth: string; ccipFeeEth: string; totalEth: string };
}

function buildGardenContractConfig(params: CreateGardenParams): GardenContractConfig {
  return {
    name: params.name,
    slug: params.slug ?? "",
    description: params.description,
    location: params.location,
    bannerImage: params.bannerImage,
    metadata: params.metadata ?? "",
    openJoining: params.openJoining ?? false,
    weightScheme: params.weightScheme,
    domainMask: params.domainMask,
    gardeners: params.gardeners,
    operators: params.operators,
  };
}

export async function createGarden(
  command: CreateGardenCommand,
  ports: CreateGardenPorts
): Promise<`0x${string}`> {
  const config = buildGardenContractConfig(command.params);
  const contracts = ports.reader.contracts(command.chainId);
  const ccipFee = await ports.reader.estimateCcipFee({
    slug: config.slug,
    ensAddress: contracts.greenGoodsENS as `0x${string}`,
    accountAddress: command.accountAddress,
    chainId: command.chainId,
  });
  const simulation = await ports.reader.simulate({
    gardenToken: contracts.gardenToken as `0x${string}`,
    config,
    accountAddress: command.accountAddress,
    chainId: command.chainId,
  });
  if (!simulation.success) {
    throw new Error(simulation.error?.message ?? "Transaction simulation failed");
  }
  const txHash = await ports.sender.send({
    gardenToken: contracts.gardenToken as `0x${string}`,
    config,
    accountAddress: command.accountAddress,
    chainId: command.chainId,
    ccipFee,
  });
  ports.documents.addPending(txHash, ports.clock.now());
  await ports.reader.waitForReceipt(txHash, command.chainId);
  return txHash;
}

export async function estimateGardenCreation(
  command: CreateGardenCommand,
  ports: Pick<CreateGardenPorts, "reader">
): Promise<GardenCreationEstimate> {
  const config = buildGardenContractConfig(command.params);
  const contracts = ports.reader.contracts(command.chainId);
  const ccipFee = await ports.reader.estimateCcipFee({
    slug: config.slug,
    ensAddress: contracts.greenGoodsENS as `0x${string}`,
    accountAddress: command.accountAddress,
    chainId: command.chainId,
  });
  const { gasEstimate, gasPrice } = await ports.reader.estimateTransaction({
    gardenToken: contracts.gardenToken as `0x${string}`,
    config,
    accountAddress: command.accountAddress,
    chainId: command.chainId,
    ccipFee,
  });
  const txFee = gasEstimate * gasPrice;
  const totalEstimatedFee = txFee + ccipFee;
  return {
    gasEstimate,
    gasPrice,
    txFee,
    ccipFee,
    totalEstimatedFee,
    formatted: {
      txFeeEth: formatEther(txFee),
      ccipFeeEth: formatEther(ccipFee),
      totalEth: formatEther(totalEstimatedFee),
    },
  };
}

export function createDefaultCreateGardenPorts(input: {
  walletClient: WalletClient;
  addPending(hash: `0x${string}`): void;
}): CreateGardenPorts {
  return {
    reader: {
      contracts: getNetworkContracts,
      estimateCcipFee: async ({ slug, ensAddress, accountAddress, chainId }) => {
        if (!slug || isZeroAddress(ensAddress)) return 0n;
        try {
          const { publicClient } = createClients(chainId);
          return (await publicClient.readContract({
            address: ensAddress,
            abi: GreenGoodsENSABI,
            functionName: "getRegistrationFee",
            args: [slug, accountAddress, 1],
          })) as bigint;
        } catch (error) {
          logger.warn("ENS fee estimation failed, proceeding without ENS", {
            source: "createDefaultCreateGardenPorts",
            slug,
            ensAddress,
            chainId,
            error,
          });
          return 0n;
        }
      },
      simulate: ({ gardenToken, config, accountAddress, chainId }) =>
        simulateTransaction(
          gardenToken,
          GardenTokenABI,
          "mintGarden",
          [config],
          accountAddress,
          chainId
        ),
      waitForReceipt: async (hash, chainId) => {
        await waitForTransactionReceipt(getWagmiConfig(), {
          hash,
          chainId,
          timeout: TX_RECEIPT_TIMEOUT_MS,
        });
      },
      estimateTransaction: async ({ gardenToken, config, accountAddress, chainId, ccipFee }) => {
        const { publicClient } = createClients(chainId);
        const gasEstimate = await publicClient.estimateContractGas({
          address: gardenToken,
          abi: GardenTokenABI,
          functionName: "mintGarden",
          account: accountAddress,
          args: [config],
          value: ccipFee,
        });
        const gasPrice = await publicClient.getGasPrice();
        return { gasEstimate, gasPrice };
      },
    },
    sender: {
      send: async ({ gardenToken, config, accountAddress, chainId, ccipFee }) => {
        await ensureAppKitWalletChain(chainId);
        await assertLocalArbitrumForkWallet();
        return input.walletClient.writeContract({
          address: gardenToken,
          abi: GardenTokenABI,
          functionName: "mintGarden",
          account: accountAddress,
          args: [config],
          value: ccipFee,
          chain: getChain(chainId),
        });
      },
    },
    documents: { addPending: (hash) => input.addPending(hash) },
    clock: { now: () => Date.now() },
  };
}
