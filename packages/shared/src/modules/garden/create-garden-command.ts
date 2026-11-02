import { waitForTransactionReceipt } from "@wagmi/core";
import { encodeFunctionData, formatEther, parseEventLogs } from "viem";
import { getWagmiConfig } from "../../config/appkit";
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
import { reconcileTransaction, sendCheckpointedCall } from "../transactions/confirmation";
import { assertWalletCanFundTransaction } from "../transactions/wallet-funding";
import type {
  BroadcastReference,
  BroadcastConfirmation,
  TransactionSender,
  TxResult,
} from "../transactions/types";

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
    gardenNameReserve(input: { gardenToken: `0x${string}`; chainId: number }): Promise<bigint>;
    balanceOf(input: { accountAddress: `0x${string}`; chainId: number }): Promise<bigint>;
    simulate(input: {
      gardenToken: `0x${string}`;
      config: GardenContractConfig;
      accountAddress: `0x${string}`;
      chainId: number;
      ccipFee: bigint;
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
    }): Promise<TxResult>;
    reconcile(
      hash: `0x${string}`,
      chainId: number,
      reference?: BroadcastReference
    ): Promise<BroadcastConfirmation>;
  };
  documents: { addPending(hash: `0x${string}`, submittedAt: number): void };
  clock: { now(): number };
}

/** Who pays for the garden's name: the token's reserve, its creator, or nobody yet. */
export type GardenNameFunding = "reserve" | "creator" | "later";

export interface GardenCreationEstimate {
  gasEstimate: bigint;
  gasPrice: bigint;
  txFee: bigint;
  ccipFee: bigint;
  nameFunding: GardenNameFunding;
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
    stewards: params.stewards,
  };
}

/**
 * What the creator sends for the garden's name. The token's reserve pays when it can. A creator who
 * cannot pay either, such as a passkey account with no ETH, still gets the garden, and its setup can
 * register the name once the reserve is funded.
 */
async function nameFeeFromCreator(
  command: CreateGardenCommand,
  slug: string,
  ports: Pick<CreateGardenPorts, "reader">
): Promise<{ ccipFee: bigint; nameFunding: GardenNameFunding }> {
  const contracts = ports.reader.contracts(command.chainId);
  const fee = await ports.reader.estimateCcipFee({
    slug,
    ensAddress: contracts.greenGoodsENS as `0x${string}`,
    accountAddress: command.accountAddress,
    chainId: command.chainId,
  });
  if (fee === 0n) return { ccipFee: 0n, nameFunding: "later" };
  const [reserve, balance] = await Promise.all([
    ports.reader.gardenNameReserve({
      gardenToken: contracts.gardenToken as `0x${string}`,
      chainId: command.chainId,
    }),
    ports.reader.balanceOf({
      accountAddress: command.accountAddress,
      chainId: command.chainId,
    }),
  ]);
  if (reserve >= fee) return { ccipFee: 0n, nameFunding: "reserve" };
  return balance < fee
    ? { ccipFee: 0n, nameFunding: "later" }
    : { ccipFee: fee, nameFunding: "creator" };
}

/** The garden a confirmed creation minted, read from its receipt. Null when that cannot be told. */
export async function readCreatedGardenAddress(
  hash: `0x${string}`,
  chainId: number
): Promise<`0x${string}` | null> {
  try {
    const { publicClient } = createClients(chainId);
    const gardenToken = getNetworkContracts(chainId).gardenToken.toLowerCase();
    const receipt = await publicClient.getTransactionReceipt({ hash });
    const [minted] = parseEventLogs({
      abi: GardenTokenABI,
      eventName: "GardenMinted",
      logs: receipt.logs.filter((log) => log.address.toLowerCase() === gardenToken),
    });
    return (minted?.args as { account?: `0x${string}` } | undefined)?.account ?? null;
  } catch (error) {
    logger.warn("Could not read the created garden from its receipt", {
      source: "readCreatedGardenAddress",
      hash,
      chainId,
      error,
    });
    return null;
  }
}

export async function createGarden(
  command: CreateGardenCommand,
  ports: CreateGardenPorts
): Promise<TxResult> {
  const config = buildGardenContractConfig(command.params);
  const contracts = ports.reader.contracts(command.chainId);
  const { ccipFee } = await nameFeeFromCreator(command, config.slug, ports);
  const simulation = await ports.reader.simulate({
    gardenToken: contracts.gardenToken as `0x${string}`,
    config,
    accountAddress: command.accountAddress,
    chainId: command.chainId,
    ccipFee,
  });
  if (!simulation.success) {
    throw new Error(simulation.error?.message ?? "Transaction simulation failed");
  }
  const result = await ports.sender.send({
    gardenToken: contracts.gardenToken as `0x${string}`,
    config,
    accountAddress: command.accountAddress,
    chainId: command.chainId,
    ccipFee,
  });
  ports.documents.addPending(result.hash, ports.clock.now());
  if (result.confirmation !== "pending") {
    await ports.reader.waitForReceipt(result.hash, command.chainId);
  }
  return result;
}

export async function estimateGardenCreation(
  command: CreateGardenCommand,
  ports: Pick<CreateGardenPorts, "reader">
): Promise<GardenCreationEstimate> {
  const config = buildGardenContractConfig(command.params);
  const contracts = ports.reader.contracts(command.chainId);
  const { ccipFee, nameFunding } = await nameFeeFromCreator(command, config.slug, ports);
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
    nameFunding,
    totalEstimatedFee,
    formatted: {
      txFeeEth: formatEther(txFee),
      ccipFeeEth: formatEther(ccipFee),
      totalEth: formatEther(totalEstimatedFee),
    },
  };
}

export function createDefaultCreateGardenPorts(input: {
  transactionSender: TransactionSender;
  addPending(hash: `0x${string}`): void;
  checkpoint?: (result: TxResult) => void;
  clearCheckpoint?: (result: TxResult) => void;
}): CreateGardenPorts {
  const confirmed = new Set<`0x${string}`>();
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
      gardenNameReserve: async ({ gardenToken, chainId }) => {
        try {
          const { publicClient } = createClients(chainId);
          return (await publicClient.readContract({
            address: gardenToken,
            abi: GardenTokenABI,
            functionName: "gardenNameReserve",
          })) as bigint;
        } catch (error) {
          // A token from before the reserve has nothing to pay with, and neither does an RPC failure.
          logger.warn("Garden name reserve read failed, treating it as empty", {
            source: "createDefaultCreateGardenPorts",
            gardenToken,
            chainId,
            error,
          });
          return 0n;
        }
      },
      balanceOf: ({ accountAddress, chainId }) =>
        createClients(chainId).publicClient.getBalance({ address: accountAddress }),
      simulate: ({ gardenToken, config, accountAddress, chainId, ccipFee }) =>
        simulateTransaction(
          gardenToken,
          GardenTokenABI,
          "mintGarden",
          [config],
          accountAddress,
          chainId,
          ccipFee
        ),
      waitForReceipt: async (hash, chainId) => {
        if (confirmed.has(hash)) return;
        const receipt = await waitForTransactionReceipt(getWagmiConfig(), {
          hash,
          chainId,
          timeout: TX_RECEIPT_TIMEOUT_MS,
        });
        if (receipt.status !== "success") throw new Error("Garden creation transaction reverted");
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
      reconcile: (hash, chainId, broadcastReference) =>
        reconcileTransaction(
          input.transactionSender,
          {
            hash,
            sponsored: false,
            confirmation: "pending",
            broadcastReference: broadcastReference ?? { kind: "transaction", hash, chainId },
          },
          (hash) => createClients(chainId).publicClient.getTransactionReceipt({ hash })
        ),
      send: async ({ gardenToken, config, accountAddress, chainId, ccipFee }) => {
        const sender = input.transactionSender;
        const assertOwnership = () => sender.assertOwnership?.(accountAddress, chainId);
        await assertOwnership();
        // A wallet opened for a transaction it cannot pay for may show no request at all.
        if (!sender.supportsSponsorship) {
          await assertWalletCanFundTransaction(createClients(chainId).publicClient, {
            account: accountAddress,
            to: gardenToken,
            data: encodeFunctionData({
              abi: GardenTokenABI,
              functionName: "mintGarden",
              args: [config],
            }),
            value: ccipFee,
          });
        }
        const result = await sendCheckpointedCall(
          sender,
          {
            address: gardenToken,
            abi: GardenTokenABI,
            functionName: "mintGarden",
            account: accountAddress,
            args: [config],
            value: ccipFee,
            chainId,
          },
          (result) => input.checkpoint?.(result),
          (result) => input.clearCheckpoint?.(result),
          { assertOwnership }
        );
        if (result.confirmation !== "pending") {
          confirmed.add(result.hash);
          input.clearCheckpoint?.(result);
        }
        return result;
      },
    },
    documents: { addPending: (hash) => input.addPending(hash) },
    clock: { now: () => Date.now() },
  };
}
